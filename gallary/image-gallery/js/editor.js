import { saveImage, uid } from './storage.js';

let deps = {
  toast: () => {},
  onSaved: async () => {},
  showLoading: () => {},
  hideLoading: () => {}
};

const els = {};
let state = null;

export function initEditor(provided) {
  deps = { ...deps, ...provided };
  els.dialog = document.getElementById('editorDialog');
  els.canvas = document.getElementById('editorCanvas');
  els.ctx = els.canvas.getContext('2d');
  els.brightness = document.getElementById('adjBrightness');
  els.contrast = document.getElementById('adjContrast');
  els.filter = document.getElementById('adjFilter');
  els.cropX = document.getElementById('cropX');
  els.cropY = document.getElementById('cropY');
  els.cropW = document.getElementById('cropW');
  els.cropH = document.getElementById('cropH');
  els.resizeW = document.getElementById('resizeW');
  els.resizeH = document.getElementById('resizeH');
  els.resizeLock = document.getElementById('resizeLock');
  els.saveBtn = document.getElementById('editorSaveCopyBtn');

  els.dialog.querySelectorAll('[data-editor-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleAction(btn.dataset.editorAction));
  });
  [els.brightness, els.contrast, els.filter].forEach((el) => el.addEventListener('input', renderPreview));
  els.resizeW.addEventListener('input', () => syncResize('w'));
  els.resizeH.addEventListener('input', () => syncResize('h'));
  els.saveBtn.addEventListener('click', saveEditedCopy);
}

function handleAction(action) {
  if (!state) return;
  switch (action) {
    case 'rotate-left': rotate(-90); break;
    case 'rotate-right': rotate(90); break;
    case 'flip-h': state.flipH = !state.flipH; renderPreview(); break;
    case 'flip-v': state.flipV = !state.flipV; renderPreview(); break;
    case 'apply-crop': applyCrop(); break;
    case 'apply-resize': applyResize(); break;
    case 'reset': resetAdjustments(); break;
  }
}

function rotate(deg) {
  // rotate base canvas by creating temp canvas
  const rad = (deg * Math.PI) / 180;
  const swap = Math.abs(deg) % 180 !== 0;
  const w = swap ? state.base.height : state.base.width;
  const h = swap ? state.base.width : state.base.height;
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext('2d');
  tctx.translate(w / 2, h / 2);
  tctx.rotate(rad);
  tctx.drawImage(state.base, -state.base.width / 2, -state.base.height / 2);
  state.base = tmp;
  state.flipH = false; state.flipV = false;
  updateSizeFields();
  clampCropFields();
  renderPreview();
}

function applyCrop() {
  const x = clampInt(parseInt(els.cropX.value, 10) || 0, 0, state.base.width - 1);
  const y = clampInt(parseInt(els.cropY.value, 10) || 0, 0, state.base.height - 1);
  const w = clampInt(parseInt(els.cropW.value, 10) || state.base.width, 1, state.base.width - x);
  const h = clampInt(parseInt(els.cropH.value, 10) || state.base.height, 1, state.base.height - y);
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d').drawImage(state.base, x, y, w, h, 0, 0, w, h);
  state.base = tmp;
  updateSizeFields();
  clampCropFields();
  renderPreview();
}

function applyResize() {
  const w = clampInt(parseInt(els.resizeW.value, 10) || state.base.width, 1, 8000);
  const h = clampInt(parseInt(els.resizeH.value, 10) || state.base.height, 1, 8000);
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext('2d');
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(state.base, 0, 0, w, h);
  state.base = tmp;
  updateSizeFields();
  clampCropFields();
  renderPreview();
}

function syncResize(changed) {
  if (!state || !els.resizeLock.checked) return;
  const ratio = state.base.width / state.base.height || 1;
  if (changed === 'w') {
    const w = parseInt(els.resizeW.value, 10);
    if (w > 0) els.resizeH.value = Math.max(1, Math.round(w / ratio));
  } else {
    const h = parseInt(els.resizeH.value, 10);
    if (h > 0) els.resizeW.value = Math.max(1, Math.round(h * ratio));
  }
}

function resetAdjustments() {
  if (!state) return;
  state.base = cloneCanvas(state.originalBase);
  state.flipH = false; state.flipV = false;
  els.brightness.value = 100;
  els.contrast.value = 100;
  els.filter.value = 'none';
  updateSizeFields();
  clampCropFields();
  renderPreview();
}

function updateSizeFields() {
  els.resizeW.value = state.base.width;
  els.resizeH.value = state.base.height;
}

function clampCropFields() {
  els.cropX.value = 0;
  els.cropY.value = 0;
  els.cropW.value = state.base.width;
  els.cropH.value = state.base.height;
  els.cropX.max = Math.max(0, state.base.width - 1);
  els.cropY.max = Math.max(0, state.base.height - 1);
  els.cropW.max = state.base.width;
  els.cropH.max = state.base.height;
}

function filterString() {
  const b = els.brightness.value;
  const c = els.contrast.value;
  const f = els.filter.value;
  let parts = [`brightness(${b}%)`, `contrast(${c}%)`];
  if (f === 'grayscale') parts.push('grayscale(100%)');
  else if (f === 'sepia') parts.push('sepia(100%)');
  else if (f === 'invert') parts.push('invert(100%)');
  else if (f === 'saturate') parts.push('saturate(180%)');
  return parts.join(' ');
}

function renderPreview() {
  if (!state) return;
  const w = state.base.width;
  const h = state.base.height;
  els.canvas.width = w;
  els.canvas.height = h;
  const ctx = els.ctx;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.filter = filterString();
  ctx.translate(state.flipH ? w : 0, state.flipV ? h : 0);
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  ctx.drawImage(state.base, 0, 0);
  ctx.restore();
}

function cloneCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

function clampInt(v, min, max) { return Math.min(max, Math.max(min, v)); }

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image for editing.')); };
    img.src = url;
  });
}

export async function openEditor(image) {
  if (!image) return;
  try {
    deps.showLoading();
    const img = await loadImage(image.blob || image.originalBlob);
    const base = document.createElement('canvas');
    base.width = img.naturalWidth || img.width;
    base.height = img.naturalHeight || img.height;
    base.getContext('2d').drawImage(img, 0, 0);
    state = {
      image,
      originalBase: cloneCanvas(base),
      base: cloneCanvas(base),
      flipH: false,
      flipV: false
    };
    els.brightness.value = 100;
    els.contrast.value = 100;
    els.filter.value = 'none';
    updateSizeFields();
    clampCropFields();
    renderPreview();
    if (typeof els.dialog.showModal === 'function') els.dialog.showModal();
    else els.dialog.setAttribute('open', '');
  } catch (err) {
    console.error(err);
    deps.toast('Unable to open editor: ' + err.message, 'error');
  } finally {
    deps.hideLoading();
  }
}

function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create image copy.'));
    }, type, quality);
  });
}

async function saveEditedCopy() {
  if (!state) return;
  try {
    deps.showLoading();
    renderPreview(); // ensure latest
    const mime = state.image.mimeType && state.image.mimeType !== 'image/svg+xml' ? state.image.mimeType : 'image/png';
    const blob = await canvasToBlob(els.canvas, mime);
    const now = new Date().toISOString();
    const copy = {
      ...state.image,
      id: uid('img'),
      title: `${state.image.title || 'Image'} (edited)`,
      createdAt: now,
      updatedAt: now,
      blob,
      originalBlob: blob,
      size: blob.size,
      width: els.canvas.width,
      height: els.canvas.height,
      editedFrom: state.image.id,
      favorite: false
    };
    // keep attribution if present
    await saveImage(copy);
    deps.toast('Edited copy saved to your gallery.', 'success');
    els.dialog.close();
    await deps.onSaved(copy);
  } catch (err) {
    console.error(err);
    deps.toast('Failed to save edited copy: ' + err.message, 'error');
  } finally {
    deps.hideLoading();
  }
}
