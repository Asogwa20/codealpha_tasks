import { saveAlbum, deleteAlbumRecord, saveImage, uid } from './storage.js';
import { getObjectUrl } from './gallery.js';

let deps = {
  getAlbums: () => [],
  getImages: () => [],
  setAlbums: () => {},
  setImages: () => {},
  refresh: async () => {},
  toast: () => {},
  confirm: async () => false,
  escapeHtml: (s) => String(s ?? ''),
  openLightboxForImages: () => {}
};

const els = {};
let currentAlbumId = null;

export function initAlbums(provided) {
  deps = { ...deps, ...provided };
  els.list = document.getElementById('albumsList');
  els.empty = document.getElementById('albumsEmpty');
  els.form = document.getElementById('createAlbumForm');
  els.nameInput = document.getElementById('newAlbumName');
  els.detail = document.getElementById('albumDetail');
  els.detailTitle = document.getElementById('albumDetailTitle');
  els.detailGrid = document.getElementById('albumImagesGrid');
  els.detailEmpty = document.getElementById('albumImagesEmpty');
  els.backBtn = document.getElementById('albumBackBtn');
  els.renameBtn = document.getElementById('renameAlbumBtn');
  els.deleteBtn = document.getElementById('deleteAlbumBtn');

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = els.nameInput.value.trim();
    if (!name) return;
    await createAlbum(name);
    els.nameInput.value = '';
  });
  els.backBtn.addEventListener('click', () => showAlbumDetail(null));
  els.renameBtn.addEventListener('click', renameCurrentAlbum);
  els.deleteBtn.addEventListener('click', deleteCurrentAlbum);
}

async function createAlbum(name) {
  const albums = deps.getAlbums();
  if (albums.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
    deps.toast('An album with this name already exists.', 'error');
    return;
  }
  const now = new Date().toISOString();
  const album = { id: uid('alb'), name, createdAt: now, updatedAt: now };
  await saveAlbum(album);
  deps.toast('Album created.', 'success');
  await deps.refresh();
}

export function renderAlbumsView() {
  if (currentAlbumId) { renderAlbumDetail(currentAlbumId); return; }
  showAlbumDetail(null, { skipRender: true });
  const albums = [...deps.getAlbums()].sort((a, b) => a.name.localeCompare(b.name));
  const images = deps.getImages();
  els.list.innerHTML = albums.map((a) => {
    const count = images.filter((img) => (img.albumIds || []).includes(a.id)).length;
    return `<article class="album-card" data-album-id="${a.id}" tabindex="0" role="button" aria-label="Open album ${escapeAttr(a.name)}">
      <h4>${deps.escapeHtml(a.name)}</h4>
      <p class="muted">${count} image${count === 1 ? '' : 's'}</p>
    </article>`;
  }).join('');
  els.empty.classList.toggle('hidden', albums.length > 0);
  els.list.querySelectorAll('[data-album-id]').forEach((card) => {
    const open = () => showAlbumDetail(card.dataset.albumId);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

function showAlbumDetail(albumId, { skipRender = false } = {}) {
  currentAlbumId = albumId;
  if (!albumId) {
    els.detail.classList.add('hidden');
    els.list.classList.remove('hidden');
    if (!skipRender) renderAlbumsView();
    return;
  }
  els.list.classList.add('hidden');
  els.empty.classList.add('hidden');
  els.detail.classList.remove('hidden');
  renderAlbumDetail(albumId);
}

function renderAlbumDetail(albumId) {
  const album = deps.getAlbums().find((a) => a.id === albumId);
  if (!album) { showAlbumDetail(null); return; }
  els.detailTitle.textContent = album.name;
  const images = deps.getImages().filter((img) => (img.albumIds || []).includes(albumId));
  els.detailGrid.innerHTML = images.map((img) => albumImageCard(img, albumId)).join('');
  els.detailEmpty.classList.toggle('hidden', images.length > 0);
  els.detailGrid.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      const id = el.closest('[data-card-id]')?.dataset.cardId;
      const image = deps.getImages().find((i) => i.id === id);
      const action = el.dataset.action;
      if (action === 'open' && image) {
        deps.openLightboxForImages(images.map((i) => i.id), id);
      } else if (action === 'remove' && image) {
        await removeFromAlbum(image, albumId);
      }
    });
  });
}

function albumImageCard(img, albumId) {
  const url = getObjectUrl(img);
  return `<article class="image-card" data-card-id="${img.id}">
    <div class="card-media" data-action="open" role="button" tabindex="0" aria-label="Open ${escapeAttr(img.title || 'image')}">
      <img src="${escapeAttr(url)}" alt="${escapeAttr(img.title || 'Image')}" loading="lazy">
    </div>
    <div class="card-body"><h4 class="card-title">${deps.escapeHtml(img.title || 'Untitled')}</h4></div>
    <div class="card-actions"><button class="danger-btn" data-action="remove">Remove from album</button></div>
  </article>`;
}

async function removeFromAlbum(image, albumId) {
  const next = { ...image, albumIds: (image.albumIds || []).filter((id) => id !== albumId), updatedAt: new Date().toISOString() };
  await saveImage(next);
  deps.toast('Removed from album.', 'success');
  await deps.refresh();
  renderAlbumDetail(albumId);
}

async function renameCurrentAlbum() {
  if (!currentAlbumId) return;
  const album = deps.getAlbums().find((a) => a.id === currentAlbumId);
  if (!album) return;
  const name = prompt('Rename album', album.name);
  if (name == null) return;
  const trimmed = name.trim();
  if (!trimmed) { deps.toast('Album name cannot be empty.', 'error'); return; }
  const duplicate = deps.getAlbums().some((a) => a.id !== album.id && a.name.toLowerCase() === trimmed.toLowerCase());
  if (duplicate) { deps.toast('Another album already has this name.', 'error'); return; }
  await saveAlbum({ ...album, name: trimmed, updatedAt: new Date().toISOString() });
  deps.toast('Album renamed.', 'success');
  await deps.refresh();
  renderAlbumDetail(currentAlbumId);
}

async function deleteCurrentAlbum() {
  if (!currentAlbumId) return;
  const album = deps.getAlbums().find((a) => a.id === currentAlbumId);
  if (!album) return;
  const ok = await deps.confirm(`Delete album "${album.name}"? Images will remain in your gallery.`);
  if (!ok) return;
  await deleteAlbumRecord(album.id);
  // remove album id from images
  const affected = deps.getImages().filter((img) => (img.albumIds || []).includes(album.id));
  for (const img of affected) {
    await saveImage({ ...img, albumIds: img.albumIds.filter((id) => id !== album.id), updatedAt: new Date().toISOString() });
  }
  deps.toast('Album deleted.', 'success');
  currentAlbumId = null;
  await deps.refresh();
  showAlbumDetail(null);
}

export async function addImageToAlbum(imageId, albumId) {
  const image = deps.getImages().find((i) => i.id === imageId);
  if (!image) return;
  const set = new Set(image.albumIds || []);
  set.add(albumId);
  await saveImage({ ...image, albumIds: Array.from(set), updatedAt: new Date().toISOString() });
}

export async function removeImageFromAlbum(imageId, albumId) {
  const image = deps.getImages().find((i) => i.id === imageId);
  if (!image) return;
  await saveImage({ ...image, albumIds: (image.albumIds || []).filter((id) => id !== albumId), updatedAt: new Date().toISOString() });
}

export function getCurrentAlbumId() { return currentAlbumId; }
export function resetAlbumDetail() { currentAlbumId = null; showAlbumDetail(null, { skipRender: true }); }

function escapeAttr(str) { return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
