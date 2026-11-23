import { applyGalleryFilters, collectCategories, collectTags } from './search.js';

let deps = {
  getImages: () => [],
  getAlbums: () => [],
  getState: () => ({ query: '', category: '', tag: '', sort: 'newest', selectMode: false, selectedIds: new Set() }),
  setState: () => {},
  openLightbox: () => {},
  openDetails: () => {},
  openEditor: () => {},
  toggleFavorite: async () => {},
  deleteImage: async () => {},
  downloadImage: () => {},
  addToAlbumPrompt: async () => {},
  toast: () => {},
  escapeHtml: (s) => String(s ?? '')
};

const els = {};
const objectUrls = new Map(); // id -> url

export function initGallery(provided) {
  deps = { ...deps, ...provided };
  els.grid = document.getElementById('galleryGrid');
  els.empty = document.getElementById('galleryEmpty');
  els.sort = document.getElementById('gallerySort');
  els.category = document.getElementById('galleryCategoryFilter');
  els.tag = document.getElementById('galleryTagFilter');
  els.selectModeBtn = document.getElementById('selectModeBtn');
  els.selectAllBtn = document.getElementById('selectAllBtn');
  els.bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  els.bulkDownloadBtn = document.getElementById('bulkDownloadBtn');

  els.sort.addEventListener('change', () => { deps.setState({ sort: els.sort.value }); renderGallery(); });
  els.category.addEventListener('change', () => { deps.setState({ category: els.category.value }); renderGallery(); });
  els.tag.addEventListener('change', () => { deps.setState({ tag: els.tag.value }); renderGallery(); });
  els.selectModeBtn.addEventListener('click', toggleSelectMode);
  els.selectAllBtn.addEventListener('click', selectAllVisible);
  els.bulkDeleteBtn.addEventListener('click', () => deps.deleteSelected?.());
  els.bulkDownloadBtn.addEventListener('click', () => deps.downloadSelected?.());
}

function toggleSelectMode() {
  const st = deps.getState();
  const next = !st.selectMode;
  deps.setState({ selectMode: next, selectedIds: new Set() });
  els.selectModeBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
  els.selectModeBtn.textContent = next ? 'Cancel select' : 'Select';
  renderGallery();
}

function selectAllVisible() {
  const st = deps.getState();
  const images = getVisibleImages();
  const set = new Set(st.selectedIds);
  images.forEach((img) => set.add(img.id));
  deps.setState({ selectedIds: set });
  renderGallery();
}

function getVisibleImages() {
  const st = deps.getState();
  return applyGalleryFilters(deps.getImages(), { query: st.query, category: st.category, tag: st.tag, sort: st.sort });
}

export function getVisibleImageIds() {
  return getVisibleImages().map((i) => i.id);
}

export function renderGallery() {
  const images = getVisibleImages();
  renderFilters();
  updateBulkControls(images);
  renderImageCards(els.grid, images, { selectable: deps.getState().selectMode, context: 'gallery' });
  els.empty.classList.toggle('hidden', images.length > 0);
}

function updateBulkControls(visibleImages) {
  const st = deps.getState();
  const count = st.selectedIds.size;
  const hasVisible = visibleImages.length > 0;
  els.selectAllBtn.disabled = !st.selectMode || !hasVisible;
  els.bulkDeleteBtn.disabled = count === 0;
  els.bulkDownloadBtn.disabled = count === 0;
  els.bulkDeleteBtn.textContent = count ? `Delete selected (${count})` : 'Delete selected';
  els.bulkDownloadBtn.textContent = count ? `Download selected (${count})` : 'Download selected';
}

function renderFilters() {
  const images = deps.getImages();
  const categories = collectCategories(images);
  const tags = collectTags(images);
  fillSelect(els.category, categories, 'All categories', deps.getState().category);
  fillSelect(els.tag, tags, 'All tags', deps.getState().tag);
  // datalist suggestions
  const dl = document.getElementById('categorySuggestions');
  if (dl) dl.innerHTML = categories.map((c) => `<option value="${escapeAttr(c)}"></option>`).join('');
}

function fillSelect(select, values, allLabel, current) {
  if (!select) return;
  const prev = current ?? select.value;
  const options = [`<option value="">${deps.escapeHtml(allLabel)}</option>`]
    .concat(values.map((v) => `<option value="${escapeAttr(v)}">${deps.escapeHtml(v)}</option>`));
  select.innerHTML = options.join('');
  if ([...select.options].some((o) => o.value === prev)) select.value = prev;
}

export function getObjectUrl(image) {
  if (!image) return '';
  const existing = objectUrls.get(image.id);
  if (existing) return existing;
  const blob = image.blob || image.originalBlob;
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  objectUrls.set(image.id, url);
  return url;
}

export function revokeObjectUrl(id) {
  const url = objectUrls.get(id);
  if (url) { URL.revokeObjectURL(url); objectUrls.delete(id); }
}

export function revokeAllObjectUrls() {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}

export function renderImageCards(container, images, { selectable = false, context = 'gallery', showRestore = false, showPermanentDelete = false } = {}) {
  if (!container) return;
  const st = deps.getState();
  const selected = st.selectedIds || new Set();
  // Revoke URLs for images no longer rendered in this container? handled globally by caller refreshing; keep simple
  container.innerHTML = images.map((img) => cardHtml(img, { selectable, selected: selected.has(img.id), context, showRestore, showPermanentDelete })).join('');

  container.querySelectorAll('[data-card-id]').forEach((card) => {
    const id = card.dataset.cardId;
    card.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = el.dataset.action;
        const image = deps.getImages().find((i) => i.id === id) || images.find((i) => i.id === id);
        if (action === 'select-toggle') {
          const set = new Set(deps.getState().selectedIds);
          if (el.checked) set.add(id); else set.delete(id);
          deps.setState({ selectedIds: set });
          renderGallery();
          return;
        }
        if (!image && !['restore','delete-permanent'].includes(action)) return;
        if (action === 'open') openFromContext(images, id, context);
        else if (action === 'favorite') await deps.toggleFavorite(id);
        else if (action === 'details') deps.openDetails(image);
        else if (action === 'edit') deps.openEditor(image);
        else if (action === 'download') deps.downloadImage(image);
        else if (action === 'delete') await deps.deleteImage(id, context);
        else if (action === 'add-album') await deps.addToAlbumPrompt(image);
        else if (action === 'restore') await deps.restoreImage?.(id);
        else if (action === 'delete-permanent') await deps.deletePermanent?.(id);
      });
    });
    const media = card.querySelector('.card-media');
    if (media) {
      media.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="select-toggle"]')) return;
        if (deps.getState().selectMode && context === 'gallery') {
          const set = new Set(deps.getState().selectedIds);
          if (set.has(id)) set.delete(id); else set.add(id);
          deps.setState({ selectedIds: set });
          renderGallery();
          return;
        }
        if (showRestore) return;
        openFromContext(images, id, context);
      });
    }
  });
}

function openFromContext(images, id, context) {
  const ids = images.map((i) => i.id);
  deps.openLightbox(ids, id, context);
}

function cardHtml(img, { selectable, selected, context, showRestore, showPermanentDelete }) {
  const title = deps.escapeHtml(img.title || 'Untitled');
  const cat = img.category ? `<p class="card-meta">${deps.escapeHtml(img.category)}</p>` : '';
  const tags = (img.tags || []).slice(0, 5).map((t) => `<span class="tag">${deps.escapeHtml(t)}</span>`).join('');
  const url = getObjectUrl(img);
  const favLabel = img.favorite ? 'Unfavourite' : 'Favourite';
  const favIcon = img.favorite ? '♥' : '♡';
  const selectUi = selectable ? `<label class="card-select"><input type="checkbox" data-action="select-toggle" ${selected ? 'checked' : ''} aria-label="Select ${escapeAttr(img.title || 'image')}"></label>` : '';
  let actions = '';
  if (showRestore || showPermanentDelete) {
    actions = `<div class="card-actions">
      ${showRestore ? `<button class="secondary-btn" data-action="restore">Restore</button>` : ''}
      ${showPermanentDelete ? `<button class="danger-btn" data-action="delete-permanent">Delete forever</button>` : ''}
    </div>`;
  } else {
    actions = `<div class="card-actions">
      <button class="icon-btn" data-action="favorite" title="${favLabel}" aria-label="${favLabel}">${favIcon}</button>
      <button class="secondary-btn" data-action="details">Details</button>
      <button class="secondary-btn" data-action="edit">Edit</button>
      <button class="secondary-btn" data-action="add-album">Albums</button>
      <button class="secondary-btn" data-action="download">Download</button>
      <button class="danger-btn" data-action="delete">Delete</button>
    </div>`;
  }
  return `<article class="image-card ${selectable ? 'selectable' : ''} ${selected ? 'selected' : ''}" data-card-id="${img.id}">
    <div class="card-media" data-action="open" role="button" tabindex="0" aria-label="Open ${escapeAttr(img.title || 'image')}">
      ${selectUi}
      <img src="${escapeAttr(url)}" alt="${escapeAttr(img.title || 'Image')}" loading="lazy">
    </div>
    <div class="card-body">
      <h4 class="card-title">${title}</h4>
      ${cat}
      ${img.description ? `<p class="card-meta">${deps.escapeHtml(truncate(img.description, 90))}</p>` : ''}
      ${tags ? `<div class="tag-row">${tags}</div>` : ''}
    </div>
    ${actions}
  </article>`;
}

export function renderSimpleGrid(container, images, emptyEl, emptyText) {
  if (!container) return;
  container.innerHTML = images.map((img) => `<div class="mini-card" title="${escapeAttr(img.title || '')}"><img src="${escapeAttr(getObjectUrl(img))}" alt="${escapeAttr(img.title || 'Image')}" loading="lazy"></div>`).join('');
  if (emptyEl) {
    emptyEl.textContent = emptyText || 'Nothing to show.';
    emptyEl.classList.toggle('hidden', images.length > 0);
  }
}

function truncate(s, n) { s = s || ''; return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function escapeAttr(str) { return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
