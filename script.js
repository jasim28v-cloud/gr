const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let allPosts = [];

// Cloudinary config
const CLOUD_NAME = "da457cqma";
const UPLOAD_PRESET = "do33_x";

// Bad words filter (أضف ما يناسبك)
const badWords = ["كس", "زنا", "سكس", "عاهرة", "خنزير", "شرموطة", "قحبة", "منيوك"];

function containsBadWords(text) {
  if (!text) return false;
  return badWords.some(word => text.toLowerCase().includes(word.toLowerCase()));
}

// DOM elements
const feed = document.getElementById('feedContainer');
const uploadBtn = document.getElementById('uploadBtn');
const chatToggle = document.getElementById('chatToggle');
const chatWindow = document.getElementById('chatWindow');
const closeChat = document.getElementById('closeChat');
const chatMessagesList = document.getElementById('chatMessagesList');
const chatMsgInput = document.getElementById('chatMsgInput');
const sendChatMsgBtn = document.getElementById('sendChatMsgBtn');
const profileBtn = document.getElementById('profileBtn');
const profileModal = document.getElementById('profileModal');
const closeModal = document.getElementById('closeModal');

let currentProfileUserId = null;

function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.innerText = msg;
  t.className = `fixed top-24 left-1/2 transform -translate-x-1/2 z-[500] px-5 py-2 rounded-full text-sm backdrop-blur-xl shadow-xl ${isError ? 'bg-red-600/80' : 'bg-cyan-600/80'} text-white`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function timeAgo(timestamp) {
  if (!timestamp) return 'الآن';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'منذ ثوان';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return date.toLocaleDateString('ar-EG');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

// Render posts
function renderPosts(posts) {
  if (!posts.length) {
    feed.innerHTML = `<div class="flex items-center justify-center h-full text-center text-gray-400 text-xl">✨ لا توجد منشورات بعد... <br> كن أول من يشارك ✨</div>`;
    return;
  }
  let html = '';
  posts.forEach(post => {
    const isVideo = post.mediaUrls && post.mediaUrls[0] && (post.mediaUrls[0].includes('.mp4') || post.mediaUrls[0].includes('.mov'));
    const firstMedia = post.mediaUrls ? post.mediaUrls[0] : '';
    const mediaTag = isVideo ? `<video src="${firstMedia}" class="media-element" loop muted playsinline></video>` : `<img src="${firstMedia}" class="media-element" loading="lazy">`;
    const liked = post.likes && post.likes.includes(currentUser.uid);
    // عرض الصور المتعددة إذا وجدت أكثر من واحدة
    let multiImagesHtml = '';
    if (post.mediaUrls && post.mediaUrls.length > 1) {
      multiImagesHtml = `<div class="multi-images">${post.mediaUrls.slice(1).map(url => `<img src="${url}">`).join('')}</div>`;
    }
    html += `
      <div class="story-card" data-id="${post.id}">
        ${mediaTag}
        ${multiImagesHtml}
        <div class="gradient-overlay"></div>
        <div class="user-info-card">
          <div class="font-bold text-xl flex items-center gap-2"><i class="fas fa-user-circle text-cyan-400"></i> ${escapeHtml(post.userName)}</div>
          <div class="text-sm opacity-90 mt-1">${escapeHtml(post.text || '')}</div>
          <div class="text-xs text-gray-300">${timeAgo(post.createdAt)}</div>
        </div>
        <div class="action-bar">
          <div class="action-icon like-btn" data-id="${post.id}"><i class="fas ${liked ? 'fa-heart text-pink-500' : 'fa-heart'}"></i><span>${post.likeCount || 0}</span></div>
          <div class="action-icon comment-toggle" data-id="${post.id}"><i class="fas fa-comment"></i><span>تعليق</span></div>
          <div class="action-icon share-btn" data-url="${window.location.origin}/post?id=${post.id}"><i class="fas fa-share-alt"></i></div>
        </div>
        <div class="comment-panel hidden" id="commentBox-${post.id}">
          <input type="text" id="commentInput-${post.id}" placeholder="اكتب تعليقاً...">
          <button class="sendComment" data-id="${post.id}">نشر</button>
          <div class="comments-list mt-2 w-full text-xs space-y-1" id="commentsList-${post.id}"></div>
        </div>
      </div>
    `;
  });
  feed.innerHTML = html;

  document.querySelectorAll('.like-btn').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); toggleLike(btn.dataset.id); });
  document.querySelectorAll('.comment-toggle').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const box = document.getElementById(`commentBox-${btn.dataset.id}`);
      box.classList.toggle('hidden');
      if (!box.classList.contains('hidden')) loadComments(btn.dataset.id);
    };
  });
  document.querySelectorAll('.sendComment').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); addComment(btn.dataset.id); });
  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (navigator.share) navigator.share({ title: 'منشور', url: btn.dataset.url });
      else navigator.clipboard.writeText(btn.dataset.url).then(() => showToast('تم نسخ الرابط'));
    };
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target.querySelector('video');
      if (entry.isIntersecting && video) video.play().catch(e=>{});
      else if (video) video.pause();
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('.story-card').forEach(card => observer.observe(card));
}

async function toggleLike(postId) {
  const postRef = db.collection('posts').doc(postId);
  const doc = await postRef.get();
  if (!doc.exists) return;
  const data = doc.data();
  const likes = data.likes || [];
  const has = likes.includes(currentUser.uid);
  const newLikes = has ? likes.filter(uid => uid !== currentUser.uid) : [...likes, currentUser.uid];
  await postRef.update({ likes: newLikes, likeCount: newLikes.length });
  // تحديث إحصائيات المستخدم (الإعجابات المستلمة)
  if (!has) {
    const postOwnerId = data.userId;
    const userRef = db.collection('users').doc(postOwnerId);
    await userRef.update({ totalLikesReceived: firebase.firestore.FieldValue.increment(1) });
  }
}

async function loadComments(postId) {
  const container = document.getElementById(`commentsList-${postId}`);
  if (!container) return;
  container.innerHTML = '<div class="text-gray-400">جاري...</div>';
  const snapshot = await db.collection('posts').doc(postId).collection('comments').orderBy('createdAt', 'asc').get();
  if (snapshot.empty) {
    container.innerHTML = '<div class="text-gray-400">لا تعليقات بعد</div>';
    return;
  }
  let html = '';
  snapshot.forEach(doc => {
    const c = doc.data();
    html += `<div><span class="font-bold text-cyan-300">${escapeHtml(c.userName)}</span> ${escapeHtml(c.text)}</div>`;
  });
  container.innerHTML = html;
}

async function addComment(postId) {
  const input = document.getElementById(`commentInput-${postId}`);
  const text = input.value.trim();
  if (!text) return;
  if (containsBadWords(text)) return showToast('نص التعليق يحتوي على كلمات مخالفة', true);
  await db.collection('posts').doc(postId).collection('comments').add({
    userId: currentUser.uid,
    userName: currentUser.displayName,
    text: text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  input.value = '';
  loadComments(postId);
}

// رفع متعدد الصور
uploadBtn.onclick = () => {
  const caption = prompt("أضف وصفاً (اختياري):");
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*,video/mp4';
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    showToast('جاري رفع ' + files.length + ' ملف...');
    const uploadedUrls = [];
    for (let file of files) {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1080 };
        fileToUpload = await imageCompression(file, options);
      }
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('upload_preset', UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      uploadedUrls.push(data.secure_url);
    }
    await db.collection('posts').add({
      userId: currentUser.uid,
      userName: currentUser.displayName,
      text: caption || '',
      mediaUrls: uploadedUrls,
      likes: [],
      likeCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('تم النشر بنجاح!');
  };
  input.click();
};

// متابعة نظام
async function toggleFollow(targetUserId) {
  const currentUserId = currentUser.uid;
  const userRef = db.collection('users').doc(targetUserId);
  const currentUserRef = db.collection('users').doc(currentUserId);
  const targetDoc = await userRef.get();
  const followers = targetDoc.data()?.followers || [];
  const isFollowing = followers.includes(currentUserId);
  if (isFollowing) {
    await userRef.update({ followers: firebase.firestore.FieldValue.arrayRemove(currentUserId) });
    await currentUserRef.update({ following: firebase.firestore.FieldValue.arrayRemove(targetUserId) });
  } else {
    await userRef.update({ followers: firebase.firestore.FieldValue.arrayUnion(currentUserId) });
    await currentUserRef.update({ following: firebase.firestore.FieldValue.arrayUnion(targetUserId) });
  }
  // تحديث واجهة البروفايل
  if (currentProfileUserId === targetUserId) loadProfileData(targetUserId);
}

async function loadProfileData(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data() || { followers: [], following: [], totalPosts: 0 };
  const postsSnap = await db.collection('posts').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
  document.getElementById('modalUsername').innerText = userData.username || 'unknown';
  document.getElementById('modalPosts').innerText = postsSnap.size;
  document.getElementById('modalFollowers').innerText = userData.followers?.length || 0;
  document.getElementById('modalFollowing').innerText = userData.following?.length || 0;
  const followBtn = document.getElementById('followBtn');
  const isFollowing = userData.followers?.includes(currentUser.uid);
  followBtn.innerText = isFollowing ? 'إلغاء المتابعة' : 'متابعة';
  followBtn.onclick = () => toggleFollow(userId);
  let postsHtml = '';
  postsSnap.forEach(doc => {
    const p = doc.data();
    postsHtml += `<div class="bg-gray-800/30 p-2 rounded-lg text-sm">${escapeHtml(p.text || '')}</div>`;
  });
  document.getElementById('profilePostsList').innerHTML = postsHtml || '<div class="text-gray-500">لا منشورات</div>';
  profileModal.style.display = 'flex';
}

// Global chat
function listenGlobalChat() {
  db.collection('globalChat').orderBy('timestamp', 'asc').limitToLast(50).onSnapshot(snap => {
    chatMessagesList.innerHTML = '';
    snap.forEach(doc => {
      const msg = doc.data();
      chatMessagesList.innerHTML += `<div><span class="text-pink-400 font-bold">${escapeHtml(msg.userName)}</span> ${escapeHtml(msg.text)}</div>`;
    });
    chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
  });
}
sendChatMsgBtn.onclick = async () => {
  const txt = chatMsgInput.value.trim();
  if (!txt) return;
  if (containsBadWords(txt)) return showToast('نص مخالف', true);
  await db.collection('globalChat').add({
    userName: currentUser.displayName,
    userId: currentUser.uid,
    text: txt,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  chatMsgInput.value = '';
};
chatToggle.onclick = () => chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
closeChat.onclick = () => chatWindow.style.display = 'none';
profileBtn.onclick = () => loadProfileData(currentUser.uid);
closeModal.onclick = () => profileModal.style.display = 'none';

// Listen posts
function listenPosts() {
  db.collection('posts').orderBy('createdAt', 'desc').onSnapshot(snap => {
    const posts = [];
    snap.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
    allPosts = posts;
    renderPosts(allPosts);
  });
}

// Auth state
auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'auth.html'; return; }
  if (!user.emailVerified) { await auth.signOut(); alert('يرجى تأكيد بريدك أولاً'); window.location.href = 'auth.html'; return; }
  currentUser = user;
  document.getElementById('profileName').innerText = user.displayName || user.email.split('@')[0];
  // إنشاء وثيقة المستخدم إذا لم تكن موجودة
  const userRef = db.collection('users').doc(user.uid);
  const doc = await userRef.get();
  if (!doc.exists) {
    await userRef.set({
      username: user.displayName,
      email: user.email,
      followers: [],
      following: [],
      totalPosts: 0,
      totalLikesReceived: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  listenPosts();
  listenGlobalChat();
});
