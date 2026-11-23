let deps = {
  getImage: async () => null,
  getImages: () => [],
  onFavorite: async () => {},
  onDelete: async () => {},
  onEdit: () => {},
  onDownload: () => {},
  onClose: () => {}
};

let state = {
  open: false,
  ids: [],
  index: 0
};

const els = {};

export function initLightbox(provided) {
  deps = { ...deps, ...provided };
  els.root = document.getElementById('lightbox');
  els.image = document.getElementById('lightboxImage');
  els.title = document.getElementById('lightboxTitle');
  els.meta = document.getElementById('lightboxMeta');
  els.caption = document.getElementById('lightboxCaption');
  els.close = document.getElementById('lightboxCloseBtn');
  els.prev = document.getElementById('lightboxPrevBtn');
  els.next = document.getElementById('lightboxNextBtn');
  els.fav = document.getElementById('lightboxFavBtn');
  els.edit = document.getElementById('lightboxEditBtn');
  els.download = document.getElementById('lightboxDownloadBtn');
  els.delete = document.getElementById('lightboxDeleteBtn');

  els.close.addEventListener('click', closeLightbox);
  els.prev.addEventListener('click', () => showByOffset(-1));
  els.next.addEventListener('click', () => showByOffset(1));
  els.root.addEventListener('click', (e) => { if (e.target === els.root) closeLightbox(); });
  els.fav.addEventListener('click', async () => {
    const img = getCurrent(); if (!img) return;
    await deps.onFavorite(img.id);
    await renderCurrent();
  });
  els.edit.addEventListener('click', () => {
    const img = getCurrent(); if (!img) return;
    deps.onEdit(img);
  });
  els.download.addEventListener('click', () => {
    const img = getCurrent(); if (!img) return;
    deps.onDownload(img);
  });
  els.delete.addEventListener('click', async () => {
    const img = getCurrent(); if (!img) return;
    await deps.onDelete(img.id);
  });

  document.addEventListener('keydown', (e) => {
    if (!state.open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); showByOffset(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); showByOffset(1); }
  });
}

function getCurrent() {
  const id = state.ids[state.index];
  if (!id) return null;
  const images = deps.getImages();
  return images.find((i) => i.id === id) || null;
}

let currentObjectUrl = null;
function setImageSrc(blob) {
  if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
  if (blob) {
    currentObjectUrl = URL.createObjectURL(blob);
    els.image.src = currentObjectUrl;
  } else {
    els.image.removeAttribute('src');
  }
}

async function renderCurrent() {
  const img = getCurrent();
  if (!img) { closeLightbox(); return; }
  setImageSrc(img.blob || img.originalBlob);
  els.image.alt = img.title || 'Image preview';
  els.title.textContent = img.title || 'Untitled image';
  const parts = [];
  if (img.category) parts.push(img.category);
  if (img.width && img.height) parts.push(`${img.width}×${img.height}`);
  if (img.size) parts.push(formatBytes(img.size));
  if (img.source === 'wikimedia') parts.push('Wikimedia Commons');
  els.meta.textContent = parts.join(' • ');
  const captionBits = [];
  if (img.description) captionBits.push(img.description);
  if (img.attribution) captionBits.push(`Credit: ${img.attribution}`);
  if (img.license) captionBits.push(`Licence: ${img.license}`);
  els.caption.textContent = captionBits.join(' — ');
  els.fav.textContent = img.favorite ? '♥' : '♡';
  els.fav.setAttribute('aria-pressed', img.favorite ? 'true' : 'false');
  els.prev.disabled = state.ids.length <= 1;
  els.next.disabled = state.ids.length <= 1;
}

function showByOffset(offset) {
  if (!state.ids.length) return;
  state.index = (state.index + offset + state.ids.length) % state.ids.length;
  renderCurrent();
}

export async function openLightbox(ids, startId) {
  state.ids = Array.isArray(ids) ? [...ids] : [];
  state.index = Math.max(0, state.ids.indexOf(startId));
  state.open = true;
  els.root.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  await renderCurrent();
  els.close.focus();
}

export function closeLightbox() {
  if (!state.open) return;
  state.open = false;
  els.root.classList.add('hidden');
  document.body.style.overflow = '';
  setImageSrc(null);
  deps.onClose?.();
}

export function updateLightboxList(ids) {
  if (!state.open) return;
  const currentId = state.ids[state.index];
  state.ids = [...ids];
  const idx = state.ids.indexOf(currentId);
  if (idx === -1) {
    if (!state.ids.length) closeLightbox();
    else { state.index = Math.min(state.index, state.ids.length - 1); renderCurrent(); }
  } else {
    state.index = idx;
    renderCurrent();
  }
}

export function refreshLightboxIfOpen() {
  if (state.open) renderCurrent();
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['B','KB','MB','GB'];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
