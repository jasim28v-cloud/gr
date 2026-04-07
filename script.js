// ==================== XSPHERE FULL LOGIC ====================
let currentUser = null;
let allPosts = [];
let mediaRecorder, audioChunks = [], isRecording = false;
let filesToUpload = [], uploadProgress = {};

const badWords = ["كس", "زنا", "سكس", "عاهرة", "خنزير", "شرموطة"];
function containsBadWords(t) { if (!t) return false; return badWords.some(w => t.toLowerCase().includes(w)); }
function showToast(msg, isErr = false) {
    let d = document.createElement('div');
    d.innerText = msg;
    d.className = `fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[500] px-5 py-2 rounded-full text-sm backdrop-blur-xl shadow-xl ${isErr ? 'bg-red-600/80' : 'bg-cyan-600/80'} text-white`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2600);
}
function timeAgo(ts) { if (!ts) return 'الآن'; let s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return 'منذ ثوان'; let m = Math.floor(s / 60); if (m < 60) return `منذ ${m} دقيقة`; let h = Math.floor(m / 60); if (h < 24) return `منذ ${h} ساعة`; return new Date(ts).toLocaleDateString('ar-EG'); }
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'); }

setInterval(() => { document.getElementById('liveClock').innerText = new Date().toLocaleTimeString('en-GB'); }, 1000);

// ========== UPLOAD ==========
function updateProgressUI() {
    let cont = document.getElementById('progressList'); if (!cont) return;
    cont.innerHTML = '';
    for (let f of filesToUpload) {
        let p = uploadProgress[f.name] || 0;
        cont.innerHTML += `<div class="progress-item"><div class="flex justify-between text-xs"><span>${f.name.substring(0, 30)}</span><span>${p}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${p}%"></div></div></div>`;
    }
}
function uploadFileToCloudinary(file) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        let fd = new FormData();
        fd.append('file', file);
        fd.append('upload_preset', UPLOAD_PRESET);
        xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) { uploadProgress[file.name] = Math.round((e.loaded / e.total) * 100); updateProgressUI(); } });
        xhr.onload = () => { if (xhr.status === 200) resolve(JSON.parse(xhr.responseText).secure_url); else reject(xhr.statusText); };
        xhr.onerror = () => reject('Network error');
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`);
        xhr.send(fd);
    });
}
document.getElementById('uploadBtn').onclick = () => { document.getElementById('uploadModal').style.display = 'flex'; filesToUpload = []; uploadProgress = {}; updateProgressUI(); document.getElementById('postCaption').value = ''; };
document.getElementById('closeUpload').onclick = () => document.getElementById('uploadModal').style.display = 'none';
let dropZone = document.getElementById('dropZone'), fileInput = document.getElementById('fileInput');
dropZone.onclick = () => fileInput.click();
dropZone.ondragover = e => { e.preventDefault(); dropZone.style.background = '#0ff2'; };
dropZone.ondragleave = () => dropZone.style.background = '';
dropZone.ondrop = e => { e.preventDefault(); dropZone.style.background = ''; filesToUpload = Array.from(e.dataTransfer.files); updateProgressUI(); };
fileInput.onchange = e => { filesToUpload = Array.from(e.target.files); updateProgressUI(); };
document.getElementById('startUpload').onclick = async () => {
    if (filesToUpload.length === 0) return showToast('اختر ملفات أولاً', true);
    let caption = document.getElementById('postCaption').value.trim();
    if (containsBadWords(caption)) return showToast('وصف مخالف', true);
    showToast(`رفع ${filesToUpload.length} ملف...`);
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

// ========== RENDER POSTS GRID ==========
function renderPosts(posts) {
    let grid = document.getElementById('postsGrid');
    if (!posts.length) { grid.innerHTML = '<div class="text-center text-gray-400 col-span-full mt-40 text-xl">✨ لا منشورات بعد ✨</div>'; return; }
    let html = '';
    posts.forEach(post => {
        let mediaUrls = post.mediaUrls ? (Array.isArray(post.mediaUrls) ? post.mediaUrls : Object.values(post.mediaUrls)) : [];
        let firstMedia = mediaUrls[0] || '';
        let isVideo = firstMedia && (firstMedia.includes('.mp4') || firstMedia.includes('.mov'));
        let mediaTag = isVideo ? `<video src="${firstMedia}" class="media-fit" loop muted playsinline></video>` : `<img src="${firstMedia}" class="media-fit" loading="lazy">`;
        let liked = post.likes && post.likes[currentUser.uid];
        html += `<div class="post-card" data-id="${post.id}">${mediaTag}<div class="post-info"><div class="user-row"><img src="${post.userAvatar || 'https://via.placeholder.com/40'}" class="avatar-sm"><div><div class="font-bold">${escapeHtml(post.userName)}</div><div class="text-xs text-gray-400">${timeAgo(post.createdAt)}</div></div></div><div class="post-text">${escapeHtml(post.text || '')}</div><div class="post-stats"><button class="stat-btn like-btn" data-id="${post.id}"><i class="fas ${liked ? 'fa-heart text-pink-500' : 'fa-heart'}"></i> <span>${Object.keys(post.likes || {}).length}</span></button><button class="stat-btn comment-toggle" data-id="${post.id}"><i class="fas fa-comment"></i> تعليق</button><button class="stat-btn share-btn" data-url="${location.origin}"><i class="fas fa-share-alt"></i></button></div><div class="comment-panel hidden mt-3 border-t border-white/10 pt-3" id="commentBox-${post.id}"><div class="flex gap-2 mb-2"><input type="text" id="commentInput-${post.id}" placeholder="اكتب تعليقاً..." class="flex-1 bg-black/50 rounded-full px-3 py-1 text-sm"><button class="sendComment bg-pink-600 px-3 rounded-full text-sm" data-id="${post.id}">نشر</button></div><div id="commentsList-${post.id}" class="text-xs space-y-1"></div></div></div></div>`;
    });
    grid.innerHTML = html;
    document.querySelectorAll('.like-btn').forEach(btn => btn.onclick = () => toggleLike(btn.dataset.id));
    document.querySelectorAll('.comment-toggle').forEach(btn => btn.onclick = e => { e.stopPropagation(); let box = document.getElementById(`commentBox-${btn.dataset.id}`); box.classList.toggle('hidden'); if (!box.classList.contains('hidden')) loadComments(btn.dataset.id); });
    document.querySelectorAll('.sendComment').forEach(btn => btn.onclick = () => addComment(btn.dataset.id));
    document.querySelectorAll('.share-btn').forEach(btn => btn.onclick = () => { if (navigator.share) navigator.share({ title: 'منشور', url: btn.dataset.url }); else navigator.clipboard.writeText(btn.dataset.url).then(() => showToast('تم نسخ الرابط')); });
}
async function toggleLike(postId) { let ref = db.ref(`posts/${postId}`); let snap = await ref.once('value'); let p = snap.val(); if (!p) return; let likes = p.likes || {}; if (likes[currentUser.uid]) delete likes[currentUser.uid]; else likes[currentUser.uid] = true; await ref.update({ likes }); }
async function loadComments(postId) { let cont = document.getElementById(`commentsList-${postId}`); if (!cont) return; cont.innerHTML = 'جاري...'; let snap = await db.ref(`comments/${postId}`).orderByChild('createdAt').once('value'); let cmts = snap.val(); if (!cmts) { cont.innerHTML = '<div class="text-gray-400">لا تعليقات</div>'; return; } let html = ''; Object.values(cmts).forEach(c => { html += `<div><span class="font-bold text-pink-400">${escapeHtml(c.userName)}</span> ${escapeHtml(c.text)}</div>`; }); cont.innerHTML = html; }
async function addComment(postId) { let input = document.getElementById(`commentInput-${postId}`); let text = input.value.trim(); if (!text || containsBadWords(text)) return showToast(containsBadWords(text) ? 'نص مخالف' : '', true); await db.ref(`comments/${postId}`).push({ userId: currentUser.uid, userName: currentUser.displayName, text, createdAt: Date.now() }); input.value = ''; loadComments(postId); }

// ========== PROFILE & PRESENCE ==========
function setupPresence() { let statusRef = db.ref(`status/${currentUser.uid}`); db.ref('.info/connected').on('value', snap => { if (snap.val() === true) { statusRef.onDisconnect().set({ state: 'offline', lastSeen: Date.now() }); statusRef.set({ state: 'online', lastSeen: Date.now() }); } }); }
async function updateProfile(avatar, username, bio) { let up = {}; if (avatar) up.avatar = avatar; if (username) up.username = username; if (bio !== undefined) up.bio = bio; await db.ref(`users/${currentUser.uid}`).update(up); if (username) await currentUser.updateProfile({ displayName: username }); showToast('تم تحديث الملف'); loadProfileData(currentUser.uid); }
async function uploadProfileImage(file) { let fd = new FormData(); fd.append('file', file); fd.append('upload_preset', UPLOAD_PRESET); let res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd }); let data = await res.json(); updateProfile(data.secure_url, null, null); }
let currentProfileUserId = null;
async function loadProfileData(uid) {
    let userSnap = await db.ref(`users/${uid}`).once('value'); let user = userSnap.val() || {};
    let postsSnap = await db.ref('posts').orderByChild('userId').equalTo(uid).once('value'); let posts = postsSnap.val() || {};
    let followers = await db.ref(`userFollowers/${uid}`).once('value'); let following = await db.ref(`userFollowing/${uid}`).once('value');
    document.getElementById('modalUsername').innerText = user.username || 'unknown';
    document.getElementById('modalPosts').innerText = Object.keys(posts).length;
    document.getElementById('modalFollowers').innerText = followers.exists() ? Object.keys(followers.val()).length : 0;
    document.getElementById('modalFollowing').innerText = following.exists() ? Object.keys(following.val()).length : 0;
    document.getElementById('editUsername').value = user.username || '';
    document.getElementById('editBio').value = user.bio || '';
    if (user.avatar) document.getElementById('profileAvatar').src = user.avatar;
    let pList = ''; Object.values(posts).forEach(p => { pList += `<div class="bg-white/5 p-2 rounded-lg text-sm">${escapeHtml(p.text || '')}</div>`; });
    document.getElementById('userPostsList').innerHTML = pList || '<div class="text-gray-500">لا منشورات</div>';
    document.getElementById('profileModal').style.display = 'flex';
    currentProfileUserId = uid;
}
async function toggleFollow(targetId) { let fRef = db.ref(`userFollowers/${targetId}/${currentUser.uid}`); let folRef = db.ref(`userFollowing/${currentUser.uid}/${targetId}`); let snap = await fRef.once('value'); if (snap.exists()) { await fRef.remove(); await folRef.remove(); } else { await fRef.set(true); await folRef.set(true); } if (currentProfileUserId === targetId) loadProfileData(targetId); }

// ========== ADMIN PANEL ==========
async function loadAdminPanel() {
    let usersSnap = await db.ref('users').once('value'); let users = usersSnap.val() || {};
    let usersHtml = ''; for (let uid in users) { usersHtml += `<div class="flex justify-between bg-white/5 p-2 rounded"><span>${escapeHtml(users[uid].username)} (${users[uid].email})</span><button class="deleteUserBtn text-red-500" data-uid="${uid}"><i class="fas fa-trash"></i> حظر</button></div>`; }
    document.getElementById('adminUsersList').innerHTML = usersHtml;
    document.querySelectorAll('.deleteUserBtn').forEach(btn => btn.onclick = async () => { if (confirm('حظر هذا المستخدم؟')) { let uid = btn.dataset.uid; let postsSnap = await db.ref('posts').orderByChild('userId').equalTo(uid).once('value'); let posts = postsSnap.val(); if (posts) for (let pid in posts) await db.ref(`posts/${pid}`).remove(); await db.ref(`users/${uid}`).remove(); await db.ref(`status/${uid}`).remove(); showToast('تم حظر المستخدم'); loadAdminPanel(); } });
    let postsSnap = await db.ref('posts').once('value'); let posts = postsSnap.val() || {};
    let postsHtml = ''; for (let pid in posts) { postsHtml += `<div class="flex justify-between bg-white/5 p-2 rounded"><span>${escapeHtml(posts[pid].userName)}: ${escapeHtml(posts[pid].text || '')}</span><button class="deletePostBtn text-red-500" data-pid="${pid}"><i class="fas fa-trash"></i></button></div>`; }
    document.getElementById('adminPostsList').innerHTML = postsHtml;
    document.querySelectorAll('.deletePostBtn').forEach(btn => btn.onclick = async () => { if (confirm('حذف المنشور؟')) { await db.ref(`posts/${btn.dataset.pid}`).remove(); showToast('تم الحذف'); loadAdminPanel(); } });
}

// ========== CHAT + VOICE ==========
async function uploadAudio(blob) { let fd = new FormData(); fd.append('file', blob, 'recording.webm'); fd.append('upload_preset', UPLOAD_PRESET); let res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: 'POST', body: fd }); let data = await res.json(); return data.secure_url; }
function startRecording() { navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => { mediaRecorder = new MediaRecorder(stream); audioChunks = []; mediaRecorder.ondataavailable = e => audioChunks.push(e.data); mediaRecorder.onstop = async () => { let audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); let audioUrl = await uploadAudio(audioBlob); await db.ref('globalChat').push({ userId: currentUser.uid, userName: currentUser.displayName, text: '🎙️ رسالة صوتية', audioUrl, timestamp: Date.now() }); showToast('تم إرسال التسجيل'); stream.getTracks().forEach(t => t.stop()); }; mediaRecorder.start(); isRecording = true; document.getElementById('recordingStatus').classList.remove('hidden'); }).catch(() => showToast('لا يمكن الوصول للميكروفون', true)); }
function stopRecording() { if (mediaRecorder && isRecording) { mediaRecorder.stop(); isRecording = false; document.getElementById('recordingStatus').classList.add('hidden'); } }
function listenGlobalChat() { db.ref('globalChat').orderByChild('timestamp').limitToLast(50).on('child_added', snap => { let msg = snap.val(); let div = document.getElementById('chatMessages'); let audioHtml = msg.audioUrl ? `<audio controls src="${msg.audioUrl}" class="h-8"></audio>` : escapeHtml(msg.text); div.innerHTML += `<div><span class="text-pink-400 font-bold">${escapeHtml(msg.userName)}</span> ${audioHtml}</div>`; div.scrollTop = div.scrollHeight; }); }
document.getElementById('sendChat').onclick = async () => { let txt = document.getElementById('chatInput').value.trim(); if (!txt || containsBadWords(txt)) return showToast('نص مخالف', true); await db.ref('globalChat').push({ userId: currentUser.uid, userName: currentUser.displayName, text: txt, timestamp: Date.now() }); document.getElementById('chatInput').value = ''; };
let recordBtn = document.getElementById('recordAudio'); recordBtn.onmousedown = startRecording; recordBtn.onmouseup = stopRecording; recordBtn.ontouchend = stopRecording;

// ========== UI EVENTS ==========
document.getElementById('chatToggle').onclick = () => document.getElementById('chatWindow').style.display = 'flex';
document.getElementById('closeChat').onclick = () => document.getElementById('chatWindow').style.display = 'none';
document.getElementById('closeProfile').onclick = () => document.getElementById('profileModal').style.display = 'none';
document.getElementById('closeAdmin').onclick = () => document.getElementById('adminModal').style.display = 'none';
document.getElementById('profileBtn')?.addEventListener('click', () => loadProfileData(currentUser.uid));
document.getElementById('changeAvatar').onclick = () => { let inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = e => uploadProfileImage(e.target.files[0]); inp.click(); };
document.getElementById('saveProfile').onclick = async () => { let uname = document.getElementById('editUsername').value.trim(); let bio = document.getElementById('editBio').value.trim(); await updateProfile(null, uname, bio); };
function listenPosts() { db.ref('posts').orderByChild('createdAt').on('value', snap => { let obj = snap.val() || {}; let arr = Object.entries(obj).map(([id, data]) => ({ id, ...data })).reverse(); allPosts = arr; renderPosts(arr); }); }

// ========== AUTH ==========
auth.onAuthStateChanged(async user => {
    if (!user) { location.href = 'auth.html'; return; }
    if (!user.emailVerified) { await auth.signOut(); alert('❌ يرجى تأكيد بريدك الإلكتروني أولاً. تحقق من صندوق الوارد (بما في ذلك spam).'); location.href = 'auth.html'; return; }
    currentUser = user;
    document.getElementById('profileName').innerText = user.displayName || user.email.split('@')[0];
    let userRef = db.ref(`users/${user.uid}`);
    let snap = await userRef.once('value');
    if (!snap.exists()) await userRef.set({ username: user.displayName, email: user.email, avatar: user.photoURL || null, bio: '', createdAt: Date.now() });
    setupPresence();
    if (user.email === ADMIN_EMAIL) { document.getElementById('adminBtnContainer').classList.remove('hidden'); document.getElementById('openAdminPanel').onclick = () => { loadAdminPanel(); document.getElementById('adminModal').style.display = 'flex'; }; }
    listenPosts();
    listenGlobalChat();
});
