import {
  getAllImages, getAllAlbums, getAllTrash, saveImage, saveImages, deleteImageRecord,
  saveAlbum, saveTrashItem, deleteTrashItem, emptyTrashStore, getPrefs, setPrefs,
  estimateStorage, uid, isQuotaError
} from './storage.js';
import { importFiles, bindDropzone } from './upload.js';
import { initGallery, renderGallery, getVisibleImageIds, renderImageCards, renderSimpleGrid, revokeObjectUrl, revokeAllObjectUrls } from './gallery.js';
import { initAlbums, renderAlbumsView, getCurrentAlbumId, resetAlbumDetail } from './albums.js';
import { initLightbox, openLightbox, closeLightbox, updateLightboxList, refreshLightboxIfOpen } from './lightbox.js';
import { initEditor, openEditor } from './editor.js';
import { initOnlineImages } from './online-images.js';

const state = {
  images: [],
  albums: [],
  trash: [],
  ui: {
    currentView: 'dashboard',
    query: '',
    category: '',
    tag: '',
    sort: 'newest',
    selectMode: false,
    selectedIds: new Set(),
    lightboxContext: 'gallery' // gallery | favorites | album | dashboard
  }
};

const els = {};
const viewMeta = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your library' },
  gallery: { title: 'My Gallery', subtitle: 'Upload, organize, and manage your images' },
  explore: { title: 'Explore Images', subtitle: 'Discover and import images from Wikimedia Commons' },
  albums: { title: 'Albums', subtitle: 'Group images into collections' },
  favorites: { title: 'Favourites', subtitle: 'Images you marked as favourite' },
  trash: { title: 'Trash', subtitle: 'Restore or permanently remove deleted images' },
  help: { title: 'Quick Help', subtitle: 'Tips for using Precious Tech Gallary' }
};

function $(id) { return document.getElementById(id); }
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function toast(message, type = 'info', timeout = 3500) {
  const container = $('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.remove(); }, timeout);
}

function showLoading() { $('loadingOverlay').classList.remove('hidden'); }
function hideLoading() { $('loadingOverlay').classList.add('hidden'); }

function confirmDialog(message, title = 'Confirm') {
  return new Promise((resolve) => {
    const dialog = $('confirmDialog');
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    const ok = $('confirmOkBtn');
    const cancel = $('confirmCancelBtn');
    const cleanup = (result) => {
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      dialog.removeEventListener('cancel', onCancelEvent);
      dialog.close();
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onCancelEvent = (e) => { e.preventDefault(); cleanup(false); };
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    dialog.addEventListener('cancel', onCancelEvent);
    dialog.showModal();
  });
}

async function loadData() {
  [state.images, state.albums, state.trash] = await Promise.all([getAllImages(), getAllAlbums(), getAllTrash()]);
  // normalize
  state.images.forEach((img) => {
    img.tags = Array.isArray(img.tags) ? img.tags : [];
    img.albumIds = Array.isArray(img.albumIds) ? img.albumIds : [];
    img.favorite = !!img.favorite;
  });
}

async function refreshAll({ keepView = true } = {}) {
  await loadData();
  renderCurrentView();
  updateDashboard();
  refreshLightboxIfOpen();
  if (state.ui.currentView === 'gallery') updateLightboxForContext();
}

function getState() { return state.ui; }
function setState(patch) {
  Object.assign(state.ui, patch);
  if (patch.selectedIds && !(patch.selectedIds instanceof Set)) state.ui.selectedIds = new Set(patch.selectedIds);
}

function getImageDims(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: null, height: null });
    };
    img.src = url;
  });
}

async function seedBundledAssets() {
  const prefs = getPrefs();
  if (prefs.bundledAssetsSeededV1) return;
  let manifest;
  try {
    const res = await fetch('assets/seed-manifest.json', { cache: 'no-cache' });
    if (!res.ok) return;
    manifest = await res.json();
  } catch {
    return;
  }

  showLoading();
  toast('Adding bundled images to your gallery…');
  try {
    const existingAlbums = await getAllAlbums();
    const albumIdByName = new Map(existingAlbums.map((a) => [a.name.toLowerCase(), a.id]));
    for (const group of (manifest.albums || [])) {
      if (!albumIdByName.has(group.name.toLowerCase())) {
        const now = new Date().toISOString();
        const album = { id: uid('alb'), name: group.name, createdAt: now, updatedAt: now };
        await saveAlbum(album);
        albumIdByName.set(group.name.toLowerCase(), album.id);
      }
    }

    const existingImages = await getAllImages();
    const existingSeedKeys = new Set(
      existingImages
        .filter((img) => img && img.seedFile)
        .map((img) => img.seedFile)
    );

    const newImages = [];
    for (const group of (manifest.albums || [])) {
      const albumId = albumIdByName.get(group.name.toLowerCase());
      for (const item of (group.images || [])) {
        if (!item.file || existingSeedKeys.has(item.file)) continue;
        try {
          const r = await fetch(item.file);
          if (!r.ok) continue;
          const blob = await r.blob();
          const dims = await getImageDims(blob);
          const now = new Date().toISOString();
          const fileName = item.file.split('/').pop() || 'image.jpg';
          newImages.push({
            id: uid('img'),
            title: item.title || fileName.replace(/\.[^.]+$/, ''),
            description: item.description || '',
            category: group.category || group.name || 'Bundled',
            tags: Array.from(new Set(['bundled', ...(item.tags || [])])),
            favorite: false,
            albumIds: albumId ? [albumId] : [],
            createdAt: now,
            updatedAt: now,
            source: 'bundled',
            mimeType: blob.type || 'image/jpeg',
            size: blob.size,
            width: dims.width,
            height: dims.height,
            originalName: fileName,
            blob,
            originalBlob: blob,
            attribution: item.attribution || null,
            sourcePage: item.sourcePage || null,
            license: item.license || null,
            seedFile: item.file
          });
        } catch (e) {
          console.warn('Failed to seed bundled image:', item.file, e);
        }
      }
    }

    if (newImages.length) {
      try {
        await saveImages(newImages);
      } catch (err) {
        if (isQuotaError(err)) {
          toast('Browser storage is full. Some bundled images could not be added.', 'error', 5000);
        } else {
          throw err;
        }
      }
    }

    setPrefs({ bundledAssetsSeededV1: true });
    if (newImages.length) {
      toast(`${newImages.length} bundled images added and grouped into albums.`, 'success', 4500);
    }
  } catch (err) {
    console.error(err);
    toast('Some bundled images could not be added.', 'error');
  } finally {
    hideLoading();
  }
}

function setView(view, { push = true } = {}) {
  if (!viewMeta[view]) view = 'dashboard';
  state.ui.currentView = view;
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  $('viewTitle').textContent = viewMeta[view].title;
  $('viewSubtitle').textContent = viewMeta[view].subtitle;
  closeSidebarOnMobile();
  if (view !== 'albums') resetAlbumDetail();
  renderCurrentView();
  if (view === 'gallery') updateLightboxForContext();
}

function renderCurrentView() {
  const view = state.ui.currentView;
  if (view === 'dashboard') renderDashboard();
  else if (view === 'gallery') renderGallery();
  else if (view === 'albums') renderAlbumsView();
  else if (view === 'favorites') renderFavorites();
  else if (view === 'trash') renderTrash();
  // explore/help are mostly static or self-managed
}

async function updateDashboard() {
  $('statTotalImages').textContent = String(state.images.length);
  $('statTotalAlbums').textContent = String(state.albums.length);
  $('statFavorites').textContent = String(state.images.filter((i) => i.favorite).length);
  const recent = [...state.images].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
  $('statRecent').textContent = String(Math.min(state.images.length, 8));
  const storage = await estimateStorage();
  if (storage && storage.quota) {
    $('statStorage').textContent = formatBytes(storage.usage || 0);
    $('statStorageDetail').textContent = `of ${formatBytes(storage.quota)} available to browser`;
  } else {
    $('statStorage').textContent = formatBytes(state.images.reduce((s, i) => s + (i.size || 0), 0));
    $('statStorageDetail').textContent = 'Approximate (browser quota unavailable)';
  }
}

function renderDashboard() {
  updateDashboard();
  const recent = [...state.images].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
  renderSimpleGrid($('dashboardRecentGrid'), recent, $('dashboardRecentEmpty'), 'No images yet. Upload images to get started.');
}

function renderFavorites() {
  const favs = state.images.filter((i) => i.favorite).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  renderImageCards($('favoritesGrid'), favs, { context: 'favorites' });
  $('favoritesEmpty').classList.toggle('hidden', favs.length > 0);
}

function renderTrash() {
  const items = [...state.trash].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  renderImageCards($('trashGrid'), items, { context: 'trash', showRestore: true, showPermanentDelete: true });
  $('trashEmpty').classList.toggle('hidden', items.length > 0);
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['B','KB','MB','GB','TB'];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function sanitizeFilename(name) {
  return (name || 'image').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'image';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function downloadImage(image) {
  if (!image?.blob && !image?.originalBlob) { toast('Image data is unavailable.', 'error'); return; }
  const ext = (image.mimeType && image.mimeType.split('/')[1]) || 'jpg';
  downloadBlob(image.blob || image.originalBlob, `${sanitizeFilename(image.title || 'image')}.${ext.replace('jpeg','jpg')}`);
}

async function downloadSelected() {
  const ids = Array.from(state.ui.selectedIds);
  if (!ids.length) return;
  const images = ids.map((id) => state.images.find((i) => i.id === id)).filter(Boolean);
  if (!images.length) return;
  toast(`Starting ${images.length} download${images.length === 1 ? '' : 's'}…`);
  for (let i = 0; i < images.length; i++) {
    downloadImage(images[i]);
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function toggleFavorite(id) {
  const img = state.images.find((i) => i.id === id);
  if (!img) return;
  const updated = { ...img, favorite: !img.favorite, updatedAt: new Date().toISOString() };
  await saveImage(updated);
  await refreshAll();
}

async function moveToTrash(id, context) {
  const img = state.images.find((i) => i.id === id);
  if (!img) return;
  const ok = await confirmDialog(`Move "${img.title || 'this image'}" to Trash?`, 'Delete image');
  if (!ok) return;
  try {
    const item = { ...img, deletedAt: new Date().toISOString() };
    await saveTrashItem(item);
    await deleteImageRecord(id);
    revokeObjectUrl(id);
    // remove from selection
    state.ui.selectedIds.delete(id);
    toast('Image moved to Trash.', 'success');
    await refreshAll();
    updateLightboxForContext();
  } catch (err) {
    if (isQuotaError(err)) toast('Storage error while moving to trash.', 'error');
    else toast('Failed to delete image: ' + err.message, 'error');
  }
}

async function deleteSelected() {
  const ids = Array.from(state.ui.selectedIds);
  if (!ids.length) return;
  const ok = await confirmDialog(`Move ${ids.length} selected image${ids.length === 1 ? '' : 's'} to Trash?`, 'Delete selected');
  if (!ok) return;
  showLoading();
  try {
    for (const id of ids) {
      const img = state.images.find((i) => i.id === id);
      if (!img) continue;
      await saveTrashItem({ ...img, deletedAt: new Date().toISOString() });
      await deleteImageRecord(id);
      revokeObjectUrl(id);
    }
    state.ui.selectedIds = new Set();
    toast('Selected images moved to Trash.', 'success');
    await refreshAll();
  } catch (err) {
    toast('Failed to delete some images: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

async function restoreFromTrash(id) {
  const item = state.trash.find((t) => t.id === id);
  if (!item) return;
  try {
    const restored = { ...item };
    delete restored.deletedAt;
    await saveImage(restored);
    await deleteTrashItem(id);
    toast('Image restored.', 'success');
    await refreshAll();
  } catch (err) {
    if (isQuotaError(err)) toast('Browser storage is full. Cannot restore image.', 'error');
    else toast('Failed to restore image.', 'error');
  }
}

async function deletePermanent(id) {
  const item = state.trash.find((t) => t.id === id);
  if (!item) return;
  const ok = await confirmDialog(`Permanently delete "${item.title || 'this image'}"? This cannot be undone.`, 'Delete permanently');
  if (!ok) return;
  await deleteTrashItem(id);
  revokeObjectUrl(id);
  toast('Image permanently deleted.', 'success');
  await refreshAll();
}

async function emptyTrash() {
  if (!state.trash.length) { toast('Trash is already empty.'); return; }
  const ok = await confirmDialog('Permanently delete all images in Trash? This cannot be undone.', 'Empty trash');
  if (!ok) return;
  state.trash.forEach((t) => revokeObjectUrl(t.id));
  await emptyTrashStore();
  toast('Trash emptied.', 'success');
  await refreshAll();
}

function openDetailsDialog(image) {
  if (!image) return;
  $('detailsImageId').value = image.id;
  $('detailsTitle').value = image.title || '';
  $('detailsDescription').value = image.description || '';
  $('detailsCategory').value = image.category || '';
  $('detailsTags').value = (image.tags || []).join(', ');
  $('detailsDialogTitle').textContent = `Edit details: ${image.title || 'Image'}`;
  renderDetailsAlbumCheckboxes(image);
  $('detailsDialog').showModal();
}

function renderDetailsAlbumCheckboxes(image) {
  const container = $('detailsAlbumsList');
  const albums = [...state.albums].sort((a, b) => a.name.localeCompare(b.name));
  if (!albums.length) {
    container.innerHTML = '<p class="muted small">No albums yet. Create one from the Albums page.</p>';
    return;
  }
  const member = new Set(image.albumIds || []);
  container.innerHTML = albums.map((a) => `<label><input type="checkbox" value="${a.id}" ${member.has(a.id) ? 'checked' : ''}> ${escapeHtml(a.name)}</label>`).join('');
}

async function saveDetails(e) {
  e.preventDefault();
  const id = $('detailsImageId').value;
  const img = state.images.find((i) => i.id === id);
  if (!img) { $('detailsDialog').close(); return; }
  const tags = $('detailsTags').value.split(',').map((t) => t.trim()).filter(Boolean);
  const albumIds = Array.from($('detailsAlbumsList').querySelectorAll('input[type="checkbox"]:checked')).map((i) => i.value);
  const updated = {
    ...img,
    title: $('detailsTitle').value.trim() || 'Untitled',
    description: $('detailsDescription').value.trim(),
    category: $('detailsCategory').value.trim(),
    tags,
    albumIds,
    updatedAt: new Date().toISOString()
  };
  await saveImage(updated);
  $('detailsDialog').close();
  toast('Image details saved.', 'success');
  await refreshAll();
}

async function handleFiles(fileList, opts = {}) {
  if (opts.openPicker || !fileList) { $('fileInput').click(); return; }
  if (!fileList.length) return;
  showLoading();
  try {
    const { images, errors } = await importFiles(fileList);
    if (images.length) toast(`${images.length} image${images.length === 1 ? '' : 's'} uploaded.`, 'success');
    errors.forEach((err) => toast(err, 'error', 4500));
    await refreshAll();
    if (state.ui.currentView === 'dashboard' || state.ui.currentView === 'gallery') renderCurrentView();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Upload failed.', 'error', 5000);
  } finally {
    hideLoading();
    $('fileInput').value = '';
  }
}

function openLightboxForContext(ids, startId, context) {
  state.ui.lightboxContext = context || state.ui.currentView;
  openLightbox(ids, startId);
}

function getCurrentLightboxImages() {
  const ctx = state.ui.lightboxContext;
  if (ctx === 'favorites') return state.images.filter((i) => i.favorite);
  if (ctx === 'album') {
    const albumId = getCurrentAlbumId();
    return albumId ? state.images.filter((i) => (i.albumIds || []).includes(albumId)) : [];
  }
  if (ctx === 'dashboard') return [...state.images].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
  // gallery/default
  const { query, category, tag, sort } = state.ui;
  // reuse search logic via gallery? easier to compute directly
  return applyFiltersLocal(state.images, { query, category, tag, sort });
}

function applyFiltersLocal(images, { query, category, tag, sort }) {
  const q = (query || '').toLowerCase();
  let result = images.filter((img) => {
    if (q) {
      const hay = [img.title, img.description, img.category, ...(img.tags||[])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (category && (img.category || '').toLowerCase() !== category.toLowerCase()) return false;
    if (tag && !(img.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
    return true;
  });
  switch (sort) {
    case 'oldest': result.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)); break;
    case 'name-asc': result.sort((a,b)=>(a.title||'').localeCompare(b.title||'')); break;
    case 'name-desc': result.sort((a,b)=>(b.title||'').localeCompare(a.title||'')); break;
    case 'size-desc': result.sort((a,b)=>(b.size||0)-(a.size||0)); break;
    default: result.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  }
  return result;
}

function updateLightboxForContext() {
  const imgs = getCurrentLightboxImages();
  updateLightboxList(imgs.map((i) => i.id));
}

function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  const btn = $('themeToggleBtn');
  btn.textContent = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  setPrefs({ theme: t });
}

function initTheme() {
  const prefs = getPrefs();
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefs.theme || (prefersDark ? 'dark' : 'light'));
}

function initSidebar() {
  const prefs = getPrefs();
  if (prefs.sidebarCollapsed) document.body.classList.add('sidebar-collapsed');
  $('sidebarToggleBtn').addEventListener('click', () => {
    $('sidebar').classList.toggle('open');
    $('sidebarToggleBtn').setAttribute('aria-expanded', $('sidebar').classList.contains('open') ? 'true' : 'false');
  });
  $('sidebarCloseBtn').addEventListener('click', closeSidebarOnMobile);
}

function closeSidebarOnMobile() {
  $('sidebar').classList.remove('open');
  $('sidebarToggleBtn').setAttribute('aria-expanded', 'false');
}

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.goto));
  });
}

function closeDialogsOnOutsideClick() {
  document.querySelectorAll('dialog.modal').forEach((dialog) => {
    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      if (e.target === dialog && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) {
        dialog.close();
      }
    });
    dialog.querySelectorAll('[data-close-dialog]').forEach((btn) => btn.addEventListener('click', () => dialog.close()));
  });
}

function showWelcomeIfNeeded() {
  const prefs = getPrefs();
  if (!prefs.welcomed) {
    $('welcomeDialog').showModal();
  }
}

function wireWelcome() {
  $('welcomeStartBtn').addEventListener('click', () => {
    setPrefs({ welcomed: true });
    $('welcomeDialog').close();
  });
  $('welcomeHelpBtn').addEventListener('click', () => {
    setPrefs({ welcomed: true });
    $('welcomeDialog').close();
    setView('help');
  });
  $('welcomeDialog').addEventListener('close', () => setPrefs({ welcomed: true }));
}

function setupUploads() {
  $('fileInput').addEventListener('change', (e) => handleFiles(e.target.files));
  $('quickUploadBtn').addEventListener('click', () => $('fileInput').click());
  $('galleryBrowseBtn').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); $('fileInput').click(); });
  bindDropzone($('galleryDropzone'), handleFiles);
  bindDropzone($('dashboardDropzone'), handleFiles);
}

function setupSearch() {
  const input = $('globalSearchInput');
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.ui.query = input.value.trim();
      if (state.ui.currentView !== 'gallery' && state.ui.query) setView('gallery');
      else renderGallery();
      updateLightboxForContext();
    }, 150);
  });
}

async function init() {
  initTheme();
  initSidebar();
  setupNavigation();
  closeDialogsOnOutsideClick();
  setupUploads();
  setupSearch();
  wireWelcome();

  $('themeToggleBtn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
  $('detailsForm').addEventListener('submit', saveDetails);
  $('emptyTrashBtn').addEventListener('click', emptyTrash);

  // init modules
  initGallery({
    getImages: () => state.images,
    getAlbums: () => state.albums,
    getState,
    setState: (patch) => { setState(patch); },
    openLightbox: openLightboxForContext,
    openDetails: openDetailsDialog,
    openEditor,
    toggleFavorite,
    deleteImage: moveToTrash,
    downloadImage,
    addToAlbumPrompt: async (image) => { openDetailsDialog(image); }, // convenient way to manage albums
    deleteSelected,
    downloadSelected,
    restoreImage: restoreFromTrash,
    deletePermanent,
    toast,
    escapeHtml
  });

  initAlbums({
    getAlbums: () => state.albums,
    getImages: () => state.images,
    refresh: refreshAll,
    toast,
    confirm: confirmDialog,
    escapeHtml,
    openLightboxForImages: (ids, startId) => openLightboxForContext(ids, startId, 'album')
  });

  initLightbox({
    getImages: () => getCurrentLightboxImages(),
    onFavorite: toggleFavorite,
    onDelete: async (id) => { closeLightbox(); await moveToTrash(id); },
    onEdit: (img) => { openEditor(img); },
    onDownload: downloadImage
  });

  initEditor({
    toast,
    showLoading,
    hideLoading,
    onSaved: async () => { await refreshAll(); }
  });

  initOnlineImages({
    toast,
    showLoading,
    hideLoading,
    escapeHtml,
    onImported: async () => { await refreshAll(); }
  });

  try {
    showLoading();
    await loadData();
  } catch (err) {
    console.error(err);
    toast('Failed to initialize local storage: ' + (err.message || err), 'error', 6000);
  } finally {
    hideLoading();
  }

  await seedBundledAssets();
  try {
    await loadData();
  } catch (err) {
    console.error(err);
  }

  renderCurrentView();
  updateDashboard();
  showWelcomeIfNeeded();

  // warn on storage issues early
  const storage = await estimateStorage();
  if (storage && storage.quota && storage.usage / storage.quota > 0.9) {
    toast('Browser storage is over 90% full. Consider removing unused images.', 'error', 6000);
  }
}

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('beforeunload', () => { revokeAllObjectUrls(); });

// expose minimal debug if needed
window.__lumen = { state, refreshAll };
