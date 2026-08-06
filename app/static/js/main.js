// Global App State
let currentUser = null;
let selectedFile = null;
let cameraStream = null;
let activeTab = 'camera';
let currentPhotos = []; // Store fetched photos globally
let notifsDropdownOpen = false;

// --- INITIALIZATION ---
window.addEventListener('load', async () => {
  setupCaptionCounter();
  await loadUserProfile();
  loadFeed();
});

// Load current user from Flask session via API
async function loadUserProfile() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      // Update header with real user info
      document.getElementById('authHeaderContainer').innerHTML = `
        <div class="relative">
          <button onclick="toggleNotifications()" class="text-gray-400 hover:text-white p-2 rounded-full relative transition-all mr-1">
            <i class="fa-solid fa-bell text-[18px]"></i>
            <span id="notifBadge" class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full hidden"></span>
          </button>
          
          <!-- Notifications Dropdown -->
          <div id="notifDropdown" class="absolute top-12 right-0 w-72 bg-fw-card border border-teal-500/10 rounded-2xl shadow-2xl p-2 hidden z-50 max-h-80 flex flex-col">
            <div class="px-3 py-2 flex justify-between items-center mb-1 border-b border-white/5 pb-2">
              <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Thông báo mới</h3>
              <button onclick="markNotifsRead()" class="text-[10px] text-fw-accent hover:underline">Đánh dấu đã đọc</button>
            </div>
            <div id="notifList" class="flex-1 overflow-y-auto flex flex-col gap-1 pr-1 no-scrollbar pb-1">
              <!-- Notifs injected here -->
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-fw-card px-3 py-1.5 rounded-full border border-teal-500/15 cursor-pointer hover:bg-white/5 transition-all" onclick="switchTab('profile')">
          <span class="text-base">${currentUser.avatar}</span>
          <span class="text-xs font-bold text-white max-w-[90px] truncate">${escapeHtml(currentUser.name)}</span>
        </div>
        <button onclick="handleLogout()" class="ml-1 text-xs text-gray-400 hover:text-red-400 p-1.5 rounded-full hover:bg-white/5" title="Đăng xuất">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      `;
      
      // Poll notifications initially and every 5 seconds
      fetchNotifications();
      setInterval(fetchNotifications, 5000);
    } else {
      // Not logged in, redirect to login page
      window.location.href = '/login';
    }
  } catch (err) {
    window.location.href = '/login';
  }
}

// --- LOGOUT ---
async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

// --- UPLOAD LOCKET (using Flask API) ---
async function uploadLocket() {
  if (!selectedFile) {
    showToast('Vui lòng chọn hoặc chụp 1 bức ảnh!', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitLocketBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang đăng Locket...</span>`;

  try {
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('caption', document.getElementById('captionInput').value.trim());

    const response = await fetch('/api/photos', {
      method: 'POST',
      body: formData
    });
    const res = await response.json();

    if (res.success) {
      showToast('Đã gửi Locket thành công!', 'success');
      resetImageSelection();
      document.getElementById('captionInput').value = '';
      document.getElementById('charCounter').innerText = '0/60';
      switchTab('feed');
      loadFeed();
    } else {
      showToast(res.message || 'Có lỗi xảy ra!', 'error');
    }
  } catch (error) {
    console.error("Locket upload error:", error);
    showToast('Có lỗi xảy ra khi gửi. Vui lòng thử lại!', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>Gửi ngay</span>`;
  }
}

// --- LOAD FEED (from Flask API) ---
async function loadFeed() {
  try {
    const res = await fetch('/api/photos');
    const data = await res.json();

    if (data.success) {
      const photos = data.photos || [];
      currentPhotos = photos; // store globally for likes modal
      document.getElementById('feedCount').innerText = photos.length;
      renderFeed(photos);
    }
  } catch (err) {
    console.error("Feed load error:", err);
  }
}

// --- RENDER FEED ---
function renderFeed(photos) {
  const container = document.getElementById('feedList');
  if (!container) return;

  if (photos.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-center text-gray-500 space-y-3">
        <div class="w-16 h-16 rounded-full bg-fw-card flex items-center justify-center text-2xl text-fw-light border border-teal-500/10">
          <i class="fa-regular fa-images"></i>
        </div>
        <p class="text-sm font-semibold text-gray-300">Chưa có khoảnh khắc nào</p>
        <p class="text-xs text-gray-500">Hãy là người đầu tiên đăng Locket lên bảng tin!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = photos.map(photo => {
    const timeAgo = formatTimeAgo(photo.createdAt);
    const likesMap = photo.likes || {};
    const likeCount = Object.keys(likesMap).length;
    const isLiked = currentUser && likesMap[currentUser.id];

    return `
      <div class="w-full max-w-[340px] bg-fw-card border border-teal-500/10 squircle-frame p-3 shadow-xl space-y-3 transition-transform hover:scale-[1.01]">
        
        <!-- Header: Sender profile -->
        <div class="flex justify-between items-center px-1">
          <div class="flex items-center gap-2.5 cursor-pointer hover:bg-white/5 p-1 -ml-1 rounded-xl transition-all" onclick="switchTab('profile', '${photo.userId}')">
            <div class="w-8 h-8 rounded-full bg-fw-subtle border border-teal-500/10 flex items-center justify-center text-lg shadow-inner pointer-events-none">
              ${photo.senderAvatar || '👤'}
            </div>
            <div class="pointer-events-none">
              <h4 class="text-xs font-bold text-white tracking-tight">${escapeHtml(photo.senderName || 'Ẩn danh')}</h4>
              <p class="text-[10px] text-gray-400 font-medium">${timeAgo}</p>
            </div>
          </div>

          ${currentUser && photo.userId === currentUser.id ? `
            <button onclick="deletePhoto('${photo.id}')" title="Xóa Locket này" class="text-gray-500 hover:text-red-400 p-1.5 rounded-full hover:bg-white/5 transition-all text-xs">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>

        <!-- Main Photo Display -->
        <div class="relative aspect-square squircle-frame overflow-hidden bg-black border border-white/5 cursor-pointer group" onclick="openPhotoModal('${photo.imageUrl}', '${escapeHtml(photo.senderName)}', '${escapeHtml(photo.caption || '')}', '${timeAgo}')">
          <img src="${photo.imageUrl}" alt="Locket photo" class="w-full h-full object-cover group-hover:scale-105 transition-all duration-300">
          
          <!-- Floating Caption pill on photo -->
          ${photo.caption ? `
            <div class="absolute bottom-3 left-3 right-3 glass-pill px-3 py-2 rounded-xl text-xs font-medium text-white text-center shadow-lg backdrop-blur-md border border-white/20 truncate">
              ${escapeHtml(photo.caption)}
            </div>
          ` : ''}
        </div>

        <!-- Footer Interaction Bar -->
        <div class="flex justify-between items-center px-1 pt-1">
          <div class="flex items-center bg-fw-subtle rounded-full border border-teal-500/10 overflow-hidden">
            <button onclick="toggleLike('${photo.id}')" class="px-3 py-1.5 ${isLiked ? 'bg-red-500/20 text-red-500' : 'text-gray-300 hover:bg-white/10'} transition-all flex items-center justify-center focus:outline-none">
              <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart text-sm"></i>
            </button>
            <button onclick="openLikesModal('${photo.id}')" class="px-3 py-1.5 text-xs font-bold text-gray-300 hover:bg-white/10 hover:text-white transition-all border-l border-white/10 focus:outline-none">
              ${likeCount}
            </button>
          </div>

          <div class="flex gap-1 text-sm">
            <button onclick="toggleLike('${photo.id}')" class="hover:scale-125 transition-transform p-1">❤️</button>
            <button onclick="toggleLike('${photo.id}')" class="hover:scale-125 transition-transform p-1">🔥</button>
            <button onclick="toggleLike('${photo.id}')" class="hover:scale-125 transition-transform p-1">😍</button>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// --- TOGGLE LIKE ---
async function toggleLike(photoId) {
  try {
    const res = await fetch(`/api/photos/${photoId}/like`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      loadFeed(); // Reload to reflect like state
    }
  } catch (err) {
    console.error("Like toggle error:", err);
  }
}

// --- FILE SELECTION ---
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Vui lòng chọn tệp hình ảnh hợp lệ!', 'error');
    return;
  }

  selectedFile = file;
  const reader = new FileReader();
  reader.onload = function(e) {
    showPreview(e.target.result);
  };
  reader.readAsDataURL(file);
}

// --- CAMERA ---
async function startCamera() {
  try {
    const video = document.getElementById('webcamVideo');
    const placeholder = document.getElementById('uploadPlaceholder');
    const controls = document.getElementById('cameraControls');

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', aspectRatio: 1 },
      audio: false
    });

    video.srcObject = cameraStream;
    video.classList.remove('hidden');
    placeholder.classList.add('hidden');
    controls.classList.remove('hidden');
  } catch (err) {
    console.error("Camera access error:", err);
    showToast('Không thể kết nối Camera. Vui lòng thử tải ảnh từ máy!', 'error');
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  document.getElementById('webcamVideo').classList.add('hidden');
  document.getElementById('uploadPlaceholder').classList.remove('hidden');
  document.getElementById('cameraControls').classList.add('hidden');
}

function takeSnap() {
  const video = document.getElementById('webcamVideo');
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(video, 0, 0, 600, 600);
  
  stopCamera();

  // Convert canvas to File object for FormData upload
  canvas.toBlob(function(blob) {
    selectedFile = new File([blob], 'camera_snap.jpg', { type: 'image/jpeg' });
    showPreview(canvas.toDataURL('image/jpeg', 0.8));
  }, 'image/jpeg', 0.8);
}

function showPreview(base64) {
  const img = document.getElementById('imagePreview');
  const placeholder = document.getElementById('uploadPlaceholder');
  const resetBtn = document.getElementById('resetImgBtn');
  const submitBtn = document.getElementById('submitLocketBtn');

  img.src = base64;
  img.classList.remove('hidden');
  placeholder.classList.add('hidden');
  resetBtn.classList.remove('hidden');

  submitBtn.disabled = false;
  submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

function resetImageSelection() {
  selectedFile = null;
  document.getElementById('imagePreview').classList.add('hidden');
  document.getElementById('imagePreview').src = '';
  document.getElementById('uploadPlaceholder').classList.remove('hidden');
  document.getElementById('resetImgBtn').classList.add('hidden');
  document.getElementById('fileInput').value = '';

  const submitBtn = document.getElementById('submitLocketBtn');
  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
}

// --- UI TAB SWITCHER ---
function switchTab(tab, targetUserId = null) {
  activeTab = tab;
  const cameraBtn = document.getElementById('tabCameraBtn');
  const feedBtn = document.getElementById('tabFeedBtn');
  const cameraView = document.getElementById('cameraView');
  const feedView = document.getElementById('feedView');
  const profileView = document.getElementById('profileView');

  if (tab === 'camera') {
    cameraBtn.className = "flex-1 py-2.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 text-white bg-gradient-to-r from-fw-primary to-fw-light shadow-md shadow-teal-500/25";
    feedBtn.className = "flex-1 py-2.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-white";
    cameraView.classList.remove('hidden');
    feedView.classList.add('hidden');
    if (profileView) profileView.classList.add('hidden');
  } else if (tab === 'feed') {
    feedBtn.className = "flex-1 py-2.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 text-white bg-gradient-to-r from-fw-primary to-fw-light shadow-md shadow-teal-500/25";
    cameraBtn.className = "flex-1 py-2.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-white";
    feedView.classList.remove('hidden');
    cameraView.classList.add('hidden');
    if (profileView) profileView.classList.add('hidden');
    stopCamera();
  } else if (tab === 'profile') {
    cameraBtn.className = "flex-1 py-2.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-white";
    feedBtn.className = "flex-1 py-2.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-white";
    if (profileView) profileView.classList.remove('hidden');
    cameraView.classList.add('hidden');
    feedView.classList.add('hidden');
    stopCamera();
    loadProfileData(targetUserId);
  }
}

// --- QUICK CAPTIONS ---
function setQuickCaption(text) {
  const input = document.getElementById('captionInput');
  input.value = text;
  document.getElementById('charCounter').innerText = `${text.length}/60`;
}

function setupCaptionCounter() {
  const input = document.getElementById('captionInput');
  const counter = document.getElementById('charCounter');
  if (input && counter) {
    input.addEventListener('input', () => {
      counter.innerText = `${input.value.length}/60`;
    });
  }
}

// --- LOAD PROFILE DATA ---
async function loadProfileData(targetUserId = null) {
  if (!currentUser) return;
  
  let profileUser = currentUser;
  
  if (targetUserId && targetUserId !== currentUser.id) {
    try {
      const userRes = await fetch(`/api/users/${targetUserId}`);
      const userData = await userRes.json();
      if (userData.success) {
        profileUser = userData.user;
      } else {
        showToast('Không tìm thấy người dùng!', 'error');
        return switchTab('feed');
      }
    } catch (err) {
      console.error("Error fetching user info:", err);
      return showToast('Lỗi tải thông tin!', 'error');
    }
  }
  
  document.getElementById('profileAvatar').innerText = profileUser.avatar || '👤';
  document.getElementById('profileName').innerText = escapeHtml(profileUser.name);
  document.getElementById('profileUsername').innerText = escapeHtml(profileUser.username || 'user');
  
  // Update title based on whether it's personal or someone else's profile
  const titleEl = document.querySelector('#profileView .uppercase.tracking-wider');
  if (titleEl) {
    titleEl.innerText = (profileUser.id === currentUser.id) ? 'Khoảnh khắc của bạn' : `Khoảnh khắc của ${escapeHtml(profileUser.name)}`;
  }
  
  try {
    const res = await fetch('/api/photos');
    const data = await res.json();
    
    if (data.success) {
      const photos = data.photos || [];
      currentPhotos = photos; // store globally for likes modal
      const myPhotos = photos.filter(p => p.userId === profileUser.id);
      
      document.getElementById('profilePostsCount').innerText = myPhotos.length;
      
      let totalLikes = 0;
      myPhotos.forEach(p => {
         totalLikes += Object.keys(p.likes || {}).length;
      });
      document.getElementById('profileLikesCount').innerText = totalLikes;
      
      renderProfileFeed(myPhotos);
    }
  } catch (err) {
    console.error("Profile load error:", err);
  }
}

// --- RENDER PROFILE FEED ---
function renderProfileFeed(photos) {
  const container = document.getElementById('profilePostsList');
  if (!container) return;

  if (photos.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 flex flex-col items-center justify-center py-10 text-center text-gray-500 bg-fw-card squircle-frame border border-teal-500/10 shadow-inner">
        <i class="fa-solid fa-camera text-2xl mb-2 text-fw-accent"></i>
        <p class="text-xs font-medium text-gray-300">Chưa có Locket nào.</p>
        <p class="text-[10px] text-gray-500 mt-1">Hãy đăng khoảnh khắc đầu tiên!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = photos.map(photo => {
    const timeAgo = formatTimeAgo(photo.createdAt);
    const likeCount = Object.keys(photo.likes || {}).length;

    return `
      <div class="relative aspect-square squircle-frame overflow-hidden bg-fw-card border border-white/5 cursor-pointer group shadow-md" onclick="openPhotoModal('${photo.imageUrl}', '${escapeHtml(photo.senderName)}', '${escapeHtml(photo.caption || '')}', '${timeAgo}')">
        <img src="${photo.imageUrl}" alt="Locket photo" class="w-full h-full object-cover group-hover:scale-110 transition-all duration-500">
        
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2">
          <div class="flex justify-between items-center text-white text-[10px]">
            <span class="font-medium truncate max-w-[80%]">${escapeHtml(photo.caption || '')}</span>
            <span class="flex items-center gap-1 text-fw-accent"><i class="fa-solid fa-heart"></i> ${likeCount}</span>
          </div>
        </div>
        
        ${currentUser && photo.userId === currentUser.id ? `
        <button onclick="event.stopPropagation(); deletePhoto('${photo.id}')" title="Xóa ảnh" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 backdrop-blur-md shadow-md">
          <i class="fa-solid fa-trash-can"></i>
        </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

// --- NOTIFICATIONS ---
function toggleNotifications() {
  notifsDropdownOpen = !notifsDropdownOpen;
  const dropdown = document.getElementById('notifDropdown');
  if (notifsDropdownOpen) {
    dropdown.classList.remove('hidden');
    markNotifsRead(); // Auto mark read when opening
  } else {
    dropdown.classList.add('hidden');
  }
}

async function fetchNotifications() {
  if (!currentUser) return;
  try {
    const res = await fetch('/api/notifications');
    const data = await res.json();
    if (data.success) {
      const notifs = data.notifications || [];
      const unreadCount = notifs.filter(n => !n.read).length;
      
      const badge = document.getElementById('notifBadge');
      if (badge) {
        if (unreadCount > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
      }
      
      renderNotifications(notifs);
    }
  } catch (err) { }
}

function renderNotifications(notifs) {
  const container = document.getElementById('notifList');
  if (!container) return;

  if (notifs.length === 0) {
    container.innerHTML = '<p class="text-[10px] text-gray-500 text-center py-6">Bạn chưa có thông báo nào.</p>';
    return;
  }
  
  container.innerHTML = notifs.map(n => `
    <div class="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-all ${n.read ? 'opacity-60' : 'bg-white/10'}" onclick="openPhotoModal('${n.photoUrl}', '${escapeHtml(n.senderName)}', '', '${formatTimeAgo(n.createdAt)}'); toggleNotifications()">
      <div class="w-8 h-8 rounded-full bg-fw-subtle flex items-center justify-center text-[16px] shadow-inner shrink-0">${n.senderAvatar || '👤'}</div>
      <div class="flex-1 min-w-0">
        <p class="text-[10px] text-gray-300 leading-tight">
          <span class="font-extrabold text-white">${escapeHtml(n.senderName)}</span> đã thả cảm xúc vào Locket của bạn.
        </p>
        <p class="text-[9px] text-gray-500 font-medium mt-0.5">${formatTimeAgo(n.createdAt)}</p>
      </div>
      <img src="${n.photoUrl}" class="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10 shadow-sm">
    </div>
  `).join('');
}

async function markNotifsRead() {
  try {
    await fetch('/api/notifications/read', { method: 'POST' });
    const badge = document.getElementById('notifBadge');
    if (badge) badge.classList.add('hidden');
  } catch (err) { }
}

// --- LIKES MODAL ---
function openLikesModal(photoId) {
  const photo = currentPhotos.find(p => p.id === photoId);
  if (!photo) return;
  
  const likesMap = photo.likes || {};
  const userIds = Object.keys(likesMap);
  
  const container = document.getElementById('likesList');
  if (userIds.length === 0) {
    container.innerHTML = '<p class="text-xs text-gray-500 text-center py-6">Chưa có ai thả cảm xúc.</p>';
  } else {
    container.innerHTML = userIds.map(uid => {
      const user = likesMap[uid];
      let avatar = '👤';
      let name = 'Người dùng';
      
      if (typeof user === 'object') {
        avatar = user.avatar;
        name = user.name;
      } else if (currentUser && uid === currentUser.id) {
         avatar = currentUser.avatar;
         name = currentUser.name;
      }
      
      return `
        <div class="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/5 transition-all" onclick="closeLikesModal(); switchTab('profile', '${uid}')">
          <div class="w-10 h-10 rounded-full bg-fw-subtle border border-teal-500/10 flex items-center justify-center text-xl shadow-inner shrink-0">${avatar}</div>
          <p class="text-sm font-bold text-white truncate flex-1">${escapeHtml(name)}</p>
          <i class="fa-solid fa-heart text-red-500 text-lg shadow-sm drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"></i>
        </div>
      `;
    }).join('');
  }
  
  document.getElementById('likesModal').classList.remove('hidden');
}

function closeLikesModal() {
  document.getElementById('likesModal').classList.add('hidden');
}

// --- DELETE PHOTO ---
function deletePhoto(photoId) {
  showToast('Tính năng xóa ảnh đang được phát triển!', 'info');
}

// --- PHOTO MODAL ---
function openPhotoModal(imgUrl, sender, caption, time) {
  document.getElementById('modalImg').src = imgUrl;
  document.getElementById('modalSender').innerText = 'Gửi bởi: ' + sender;
  document.getElementById('modalCaption').innerText = caption ? `"${caption}"` : 'Không có trạng thái';
  document.getElementById('modalTime').innerText = time;
  document.getElementById('photoModal').classList.remove('hidden');
}

function closePhotoModal() {
  document.getElementById('photoModal').classList.add('hidden');
}

// --- TOAST NOTIFICATION ---
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  toastMsg.innerText = msg;

  if (type === 'error') {
    toastIcon.className = "fa-solid fa-circle-exclamation text-red-400";
  } else if (type === 'success') {
    toastIcon.className = "fa-solid fa-circle-check text-fw-accent";
  } else {
    toastIcon.className = "fa-solid fa-circle-info text-blue-400";
  }

  toast.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
  
  setTimeout(() => {
    toast.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
  }, 3000);
}

// --- UTILITY: Format Time Ago ---
function formatTimeAgo(isoString) {
  if (!isoString) return 'Vừa xong';
  const date = new Date(isoString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

// --- SECURITY: Escape HTML ---
function escapeHtml(str) {
  return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
