// ==================== XSphere - Full Logic ====================
let currentUser = null;
let allPosts = [];
let mediaRecorder, audioChunks = [], isRecording = false;
let filesToUpload = [], uploadProgress = {};

// Bad words filter
const badWords = ["كس", "زنا", "سكس", "عاهرة", "خنزير", "شرموطة"];
function containsBadWords(t) { if (!t) return false; return badWords.some(w => t.toLowerCase().includes(w)); }
function showToast(msg, isErr = false) { let t = document.createElement('div'); t.innerText = msg; t.className = `fixed top-24 left-1/2 transform -translate-x-1/2 z-[500] px-5 py-2 rounded-full text-sm backdrop-blur-xl shadow-xl ${isErr ? 'bg-red-600/80' : 'bg-cyan-600/80'} text-white`; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function timeAgo(ts) { if (!ts) return 'الآن'; let sec = Math.floor((Date.now() - ts) / 1000); if (sec < 60) return 'منذ ثوان'; let min = Math.floor(sec / 60); if (min < 60) return `منذ ${min} دقيقة`; let hr = Math.floor(min / 60); if (hr < 24) return `منذ ${hr} ساعة`; return new Date(ts).toLocaleDateString('ar-EG'); }
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'); }

// ========== Upload with Progress ==========
function updateProgressUI() { let container = document.getElementById('progressList'); if (!container) return; container.innerHTML = ''; for (let i = 0; i < filesToUpload.length; i++) { let f = filesToUpload[i]; let percent = uploadProgress[f.name] || 0; container.innerHTML += `<div class="progress-item"><div class="flex justify-between text-xs"><span>${f.name.substring(0, 30)}</span><span>${percent}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div></div>`; } }
function uploadFileToCloudinary(file) { return new Promise((resolve, reject) => { let xhr = new XMLHttpRequest(); let fd = new FormData(); fd.append('file', file); fd.append('upload_preset', UPLOAD_PRESET); xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) { uploadProgress[file.name] = Math.round((e.loaded / e.total) * 100); updateProgressUI(); } }); xhr.onload = () => { if (xhr.status === 200) resolve(JSON.parse(xhr.responseText).secure_url); else reject(xhr.statusText); }; xhr.onerror = () => reject('Network error'); xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`); xhr.send(fd); }); }
document.getElementById('uploadFloatingBtn').onclick = () => { document.getElementById('uploadModal').style.display = 'flex'; filesToUpload = []; uploadProgress = {}; updateProgressUI(); document.getElementById('postCaption').value = ''; };
document.getElementById('closeUploadModal').onclick = () => document.getElementById('uploadModal').style.display = 'none';
let dropArea = document.getElementById('dropArea'), fileInput = document.getElementById('fileInput');
dropArea.onclick = () => fileInput.click();
dropArea.ondragover = e => { e.preventDefault(); dropArea.style.background = '#0ff2'; };
dropArea.ondragleave = () => dropArea.style.background = '';
dropArea.ondrop = e => { e.preventDefault(); dropArea.style.background = ''; filesToUpload = Array.from(e.dataTransfer.files); updateProgressUI(); };
fileInput.onchange = e => { filesToUpload = Array.from(e.target.files); updateProgressUI(); };
document.getElementById('startUploadBtn').onclick = async () => {
  if (filesToUpload.length === 0) return showToast('اختر ملفات أولاً', true);
  let caption = document.getElementById('postCaption').value.trim();
  if (containsBadWords(caption)) return showToast('وصف مخالف', true);
  showToast(`جاري رفع ${filesToUpload.length} ملف...`);
  let urls = [];
  for (let f of filesToUpload) {
    let file = f;
    if (file.type.startsWith('image/')) { const opts = { maxSizeMB: 1, maxWidthOrHeight: 1080 }; file = await imageCompression(file, opts); }
    let url = await uploadFileToCloudinary(file);
    urls.push(url);
  }
  await db.ref('posts').push({ userId: currentUser.uid, userName: currentUser.displayName, userAvatar: currentUser.photoURL || null, text: caption, mediaUrls: urls, likes: {}, createdAt: Date.now() });
  showToast('تم النشر بنجاح!');
  document.getElementById('uploadModal').style.display = 'none';
  filesToUpload = [];
};

// ========== Render Posts with Gallery ==========
function renderPosts(posts) {
  let feed = document.getElementById('feedContainer');
  if (!posts.length) { feed.innerHTML = '<div class="text-center text-gray-400 mt-40 text-xl">✨ لا توجد منشورات بعد ✨</div>'; return; }
  let html = '';
  posts.forEach(post => {
    let mediaUrls = post.mediaUrls ? (Array.isArray(post.mediaUrls) ? post.mediaUrls : Object.values(post.mediaUrls)) : [];
    let liked = post.likes && post.likes[currentUser.uid];
    let mainMedia = '', galleryThumbs = '';
    if (mediaUrls.length) {
      let first = mediaUrls[0];
      let isVideo = first && (first.includes('.mp4') || first.includes('.mov'));
      mainMedia = isVideo ? `<video src="${first}" class="media-element" loop muted playsinline></video>` : `<img src="${first}" class="media-element" loading="lazy">`;
      if (mediaUrls.length > 1) galleryThumbs = `<div class="media-gallery">${mediaUrls.slice(1).map(url => `<img src="${url}" onclick="viewFullscreen('${url}')">`).join('')}</div>`;
    }
    html += `<div class="story-card" data-id="${post.id}">${mainMedia}${galleryThumbs}<div class="gradient-overlay"></div><div class="user-info-card"><div class="flex items-center gap-2"><img src="${post.userAvatar || 'https://via.placeholder.com/40'}" class="w-8 h-8 rounded-full"><span class="font-bold">${escapeHtml(post.userName)}</span></div><div class="text-sm mt-1">${escapeHtml(post.text || '')}</div><div class="text-xs text-gray-300">${timeAgo(post.createdAt)}</div></div><div class="action-bar"><div class="action-icon like-btn" data-id="${post.id}"><i class="fas ${liked ? 'fa-heart text-pink-500' : 'fa-heart'}"></i><span>${Object.keys(post.likes || {}).length}</span></div><div class="action-icon comment-toggle" data-id="${post.id}"><i class="fas fa-comment"></i><span>تعليق</span></div><div class="action-icon share-btn" data-url="${location.origin}"><i class="fas fa-share-alt"></i></div></div><div class="comment-panel hidden" id="commentBox-${post.id}"><input type="text" id="commentInput-${post.id}" placeholder="اكتب تعليقاً..."><button class="sendComment" data-id="${post.id}">نشر</button><div id="commentsList-${post.id}" class="mt-2 text-xs space-y-1"></div></div></div>`;
  });
  feed.innerHTML = html;
  document.querySelectorAll('.like-btn').forEach(btn => btn.onclick = () => toggleLike(btn.dataset.id));
  document.querySelectorAll('.comment-toggle').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); let box = document.getElementById(`commentBox-${btn.dataset.id}`); box.classList.toggle('hidden'); if (!box.classList.contains('hidden')) loadComments(btn.dataset.id); });
  document.querySelectorAll('.sendComment').forEach(btn => btn.onclick = () => addComment(btn.dataset.id));
  document.querySelectorAll('.share-btn').forEach(btn => btn.onclick = () => { if (navigator.share) navigator.share({title:'منشور', url:btn.dataset.url}); else navigator.clipboard.writeText(btn.dataset.url).then(()=>showToast('تم نسخ الرابط')); });
  let observer = new IntersectionObserver(entries => { entries.forEach(entry => { let vid = entry.target.querySelector('video'); if (entry.isIntersecting && vid) vid.play().catch(e=>{}); else if (vid) vid.pause(); }); }, { threshold: 0.6 });
  document.querySelectorAll('.story-card').forEach(c => observer.observe(c));
}
window.viewFullscreen = (url) => { let modal = document.getElementById('fullscreenModal'); let content = document.getElementById('fullscreenContent'); let isVideo = url.includes('.mp4')||url.includes('.mov'); content.innerHTML = isVideo ? `<video src="${url}" controls autoplay style="max-width:95%; max-height:95%"></video>` : `<img src="${url}" style="max-width:95%; max-height:95%">`; modal.style.display = 'flex'; };
document.getElementById('closeFullscreen').onclick = () => document.getElementById('fullscreenModal').style.display = 'none';

async function toggleLike(postId) { let ref = db.ref(`posts/${postId}`); let snap = await ref.once('value'); let p = snap.val(); if (!p) return; let likes = p.likes || {}; if (likes[currentUser.uid]) delete likes[currentUser.uid]; else likes[currentUser.uid] = true; await ref.update({ likes }); }
async function loadComments(postId) { let container = document.getElementById(`commentsList-${postId}`); if (!container) return; container.innerHTML = 'جاري...'; let snap = await db.ref(`comments/${postId}`).orderByChild('createdAt').once('value'); let cmts = snap.val(); if (!cmts) { container.innerHTML = '<div class="text-gray-400">لا تعليقات</div>'; return; } let html = ''; Object.values(cmts).forEach(c => { html += `<div><span class="font-bold text-cyan-300">${escapeHtml(c.userName)}</span> ${escapeHtml(c.text)}</div>`; }); container.innerHTML = html; }
async function addComment(postId) { let input = document.getElementById(`commentInput-${postId}`); let text = input.value.trim(); if (!text || containsBadWords(text)) return showToast(containsBadWords(text)?'نص مخالف':'',true); await db.ref(`comments/${postId}`).push({ userId: currentUser.uid, userName: currentUser.displayName, text, createdAt: Date.now() }); input.value = ''; loadComments(postId); }

// ========== Profile & Presence ==========
function setupPresence() { let statusRef = db.ref(`status/${currentUser.uid}`); db.ref('.info/connected').on('value', (snap) => { if (snap.val() === true) { statusRef.onDisconnect().set({ state: 'offline', lastSeen: Date.now() }); statusRef.set({ state: 'online', lastSeen: Date.now() }); } }); }
async function updateProfile(avatar, username, bio) { let updates = {}; if (avatar) updates.avatar = avatar; if (username) updates.username = username; if (bio !== undefined) updates.bio = bio; await db.ref(`users/${currentUser.uid}`).update(updates); if (username) await currentUser.updateProfile({ displayName: username }); showToast('تم تحديث الملف'); loadProfileData(currentUser.uid); }
async function uploadProfileImage(file) { let fd = new FormData(); fd.append('file', file); fd.append('upload_preset', UPLOAD_PRESET); let res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd }); let data = await res.json(); updateProfile(data.secure_url, null, null); }
let currentProfileUserId = null;
async function loadProfileData(uid) { let userSnap = await db.ref(`users/${uid}`).once('value'); let user = userSnap.val() || {}; let postsSnap = await db.ref('posts').orderByChild('userId').equalTo(uid).once('value'); let posts = postsSnap.val() || {}; let followers = await db.ref(`userFollowers/${uid}`).once('value'); let following = await db.ref(`userFollowing/${uid}`).once('value'); document.getElementById('modalUsername').innerText = user.username || 'unknown'; document.getElementById('modalPosts').innerText = Object.keys(posts).length; document.getElementById('modalFollowers').innerText = followers.exists() ? Object.keys(followers.val()).length : 0; document.getElementById('modalFollowing').innerText = following.exists() ? Object.keys(following.val()).length : 0; document.getElementById('editUsername').value = user.username || ''; document.getElementById('editBio').value = user.bio || ''; if (user.avatar) document.getElementById('profileAvatar').src = user.avatar; let followBtn = document.getElementById('followBtn'); if (followBtn) { let isFollowing = followers.exists() && followers.val()[currentUser.uid]; followBtn.innerText = isFollowing ? 'إلغاء المتابعة' : 'متابعة'; followBtn.onclick = () => toggleFollow(uid); } let pList = ''; Object.values(posts).forEach(p => { pList += `<div class="bg-gray-800/30 p-2 rounded-lg">${escapeHtml(p.text||'')}</div>`; }); document.getElementById('profilePostsList').innerHTML = pList || '<div class="text-gray-500">لا منشورات</div>'; document.getElementById('profileModal').style.display = 'flex'; currentProfileUserId = uid; }
async function toggleFollow(targetId) { let fRef = db.ref(`userFollowers/${targetId}/${currentUser.uid}`); let folRef = db.ref(`userFollowing/${currentUser.uid}/${targetId}`); let snap = await fRef.once('value'); if (snap.exists()) { await fRef.remove(); await folRef.remove(); } else { await fRef.set(true); await folRef.set(true); } if (currentProfileUserId === targetId) loadProfileData(targetId); }

// ========== Admin Panel ==========
async function loadAdminPanel() { let usersSnap = await db.ref('users').once('value'); let users = usersSnap.val() || {}; let usersHtml = ''; for (let uid in users) { usersHtml += `<div class="flex justify-between bg-gray-800 p-2 rounded"><span>${escapeHtml(users[uid].username)} (${users[uid].email})</span><button class="deleteUserBtn text-red-500" data-uid="${uid}"><i class="fas fa-trash"></i> حظر</button></div>`; } document.getElementById('adminUsersList').innerHTML = usersHtml; document.querySelectorAll('.deleteUserBtn').forEach(btn => btn.onclick = async () => { if (confirm('حظر هذا المستخدم؟')) { let uid = btn.dataset.uid; let postsSnap = await db.ref('posts').orderByChild('userId').equalTo(uid).once('value'); let posts = postsSnap.val(); if (posts) for (let pid in posts) await db.ref(`posts/${pid}`).remove(); await db.ref(`users/${uid}`).remove(); await db.ref(`status/${uid}`).remove(); showToast('تم حظر المستخدم'); loadAdminPanel(); } }); let postsSnap = await db.ref('posts').once('value'); let posts = postsSnap.val() || {}; let postsHtml = ''; for (let pid in posts) { postsHtml += `<div class="flex justify-between bg-gray-800 p-2 rounded"><span>${escapeHtml(posts[pid].userName)}: ${escapeHtml(posts[pid].text||'')}</span><button class="deletePostBtn text-red-500" data-pid="${pid}"><i class="fas fa-trash"></i></button></div>`; } document.getElementById('adminPostsList').innerHTML = postsHtml; document.querySelectorAll('.deletePostBtn').forEach(btn => btn.onclick = async () => { if (confirm('حذف المنشور؟')) { await db.ref(`posts/${btn.dataset.pid}`).remove(); showToast('تم الحذف'); loadAdminPanel(); } }); }

// ========== Global Chat with Voice ==========
async function uploadAudio(blob) { let fd = new FormData(); fd.append('file', blob, 'recording.webm'); fd.append('upload_preset', UPLOAD_PRESET); let res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: 'POST', body: fd }); let data = await res.json(); return data.secure_url; }
function startRecording() { navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => { mediaRecorder = new MediaRecorder(stream); audioChunks = []; mediaRecorder.ondataavailable = e => audioChunks.push(e.data); mediaRecorder.onstop = async () => { let audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); let audioUrl = await uploadAudio(audioBlob); await db.ref('globalChat').push({ userId: currentUser.uid, userName: currentUser.displayName, text: '🎙️ رسالة صوتية', audioUrl, timestamp: Date.now() }); showToast('تم إرسال التسجيل'); stream.getTracks().forEach(t => t.stop()); }; mediaRecorder.start(); isRecording = true; document.getElementById('recordingStatus').classList.remove('hidden'); }).catch(()=>showToast('لا يمكن الوصول للميكروفون',true)); }
function stopRecording() { if (mediaRecorder && isRecording) { mediaRecorder.stop(); isRecording = false; document.getElementById('recordingStatus').classList.add('hidden'); } }
function listenGlobalChat() { db.ref('globalChat').orderByChild('timestamp').limitToLast(50).on('child_added', snap => { let msg = snap.val(); let div = document.getElementById('chatMessagesList'); let audioHtml = msg.audioUrl ? `<audio controls src="${msg.audioUrl}" class="h-8"></audio>` : escapeHtml(msg.text); div.innerHTML += `<div><span class="text-pink-400 font-bold">${escapeHtml(msg.userName)}</span> ${audioHtml}</div>`; div.scrollTop = div.scrollHeight; }); }
document.getElementById('sendChatMsgBtn').onclick = async () => { let txt = document.getElementById('chatMsgInput').value.trim(); if (!txt || containsBadWords(txt)) return showToast('نص مخالف',true); await db.ref('globalChat').push({ userId: currentUser.uid, userName: currentUser.displayName, text: txt, timestamp: Date.now() }); document.getElementById('chatMsgInput').value = ''; };
let recordBtn = document.getElementById('recordAudioBtn'); recordBtn.onmousedown = startRecording; recordBtn.onmouseup = stopRecording; recordBtn.ontouchend = stopRecording;

// ========== UI Events ==========
document.getElementById('closeModal').onclick = () => document.getElementById('profileModal').style.display = 'none';
document.getElementById('closeAdminPanel').onclick = () => document.getElementById('adminPanel').style.display = 'none';
document.getElementById('chatToggle').onclick = () => document.getElementById('chatWindow').style.display = 'flex';
document.getElementById('closeChat').onclick = () => document.getElementById('chatWindow').style.display = 'none';
document.getElementById('profileBtn').onclick = () => loadProfileData(currentUser.uid);
document.getElementById('changeAvatarBtn').onclick = () => { let inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=e=>uploadProfileImage(e.target.files[0]); inp.click(); };
document.getElementById('saveProfileBtn').onclick = async () => { let uname = document.getElementById('editUsername').value.trim(); let bio = document.getElementById('editBio').value.trim(); await updateProfile(null, uname, bio); };
function listenPosts() { db.ref('posts').orderByChild('createdAt').on('value', snap => { let postsObj = snap.val() || {}; let arr = Object.entries(postsObj).map(([id,data])=>({id,...data})).reverse(); allPosts = arr; renderPosts(arr); }); }

// ========== Auth State ==========
auth.onAuthStateChanged(async user => {
  if (!user) { location.href='auth.html'; return; }
  if (!user.emailVerified) { await auth.signOut(); alert('يرجى تأكيد بريدك'); location.href='auth.html'; return; }
  currentUser = user;
  document.getElementById('profileName').innerText = user.displayName || user.email.split('@')[0];
  let userRef = db.ref(`users/${user.uid}`);
  let snap = await userRef.once('value');
  if (!snap.exists()) await userRef.set({ username: user.displayName, email: user.email, avatar: user.photoURL || null, bio: '', createdAt: Date.now() });
  setupPresence();
  if (user.email === ADMIN_EMAIL) { document.getElementById('adminButtonContainer').classList.remove('hidden'); document.getElementById('adminPanelBtn').onclick = () => { loadAdminPanel(); document.getElementById('adminPanel').style.display = 'flex'; }; }
  listenPosts();
  listenGlobalChat();
});
