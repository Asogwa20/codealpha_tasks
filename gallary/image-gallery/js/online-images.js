import { saveImage, uid, isQuotaError } from './storage.js';

let deps = {
  toast: () => {},
  showLoading: () => {},
  hideLoading: () => {},
  onImported: async () => {},
  escapeHtml: (s) => s
};

const API_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
const state = {
  results: [],
  selected: null
};
const els = {};

export function initOnlineImages(provided) {
  deps = { ...deps, ...provided };
  els.form = document.getElementById('exploreForm');
  els.query = document.getElementById('exploreQuery');
  els.grid = document.getElementById('exploreGrid');
  els.status = document.getElementById('exploreStatus');
  els.empty = document.getElementById('exploreEmpty');
  els.previewDialog = document.getElementById('explorePreviewDialog');
  els.previewImg = document.getElementById('explorePreviewImage');
  els.previewTitle = document.getElementById('explorePreviewTitle');
  els.previewAuthor = document.getElementById('explorePreviewAuthor');
  els.previewLicense = document.getElementById('explorePreviewLicense');
  els.previewSource = document.getElementById('explorePreviewSource');
  els.previewDesc = document.getElementById('explorePreviewDescription');
  els.previewOpen = document.getElementById('explorePreviewOpenSource');
  els.previewDownload = document.getElementById('explorePreviewDownloadBtn');
  els.previewImport = document.getElementById('explorePreviewImportBtn');

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = els.query.value.trim();
    if (!q) return;
    await search(q);
  });
  els.previewDownload.addEventListener('click', () => { if (state.selected) downloadRemote(state.selected); });
  els.previewImport.addEventListener('click', () => { if (state.selected) importToGallery(state.selected); });
}

function setStatus(msg) { els.status.textContent = msg || ''; }

function buildApiUrl(params) {
  const url = new URL(API_ENDPOINT);
  const base = { origin: '*', format: 'json' };
  Object.entries({ ...base, ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function search(query) {
  setStatus('Searching Wikimedia Commons…');
  els.grid.innerHTML = '';
  els.empty.classList.add('hidden');
  deps.showLoading();
  try {
    // Use generator=search in namespace 6 (File) to get image pages with imageinfo/metadata
    const url = buildApiUrl({
      action: 'query',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6',
      gsrlimit: '24',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|size|mime|user',
      iiurlwidth: '640'
    });
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Search failed (${res.status}).`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.info || 'Wikimedia API error.');
    const pages = data.query?.pages ? Object.values(data.query.pages) : [];
    const results = pages.map(normalizePage).filter(Boolean);
    // sort by index (search relevance) if present
    results.sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
    state.results = results;
    renderResults();
    if (!results.length) {
      els.empty.textContent = 'No images found. Try a different search term.';
      els.empty.classList.remove('hidden');
      setStatus('No results.');
    } else {
      setStatus(`Found ${results.length} result${results.length === 1 ? '' : 's'}.`);
    }
  } catch (err) {
    console.error(err);
    setStatus('');
    els.empty.textContent = 'Unable to load results. Check your connection and try again.';
    els.empty.classList.remove('hidden');
    deps.toast(err.message || 'Failed to search Wikimedia Commons.', 'error');
  } finally {
    deps.hideLoading();
  }
}

function textFromHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}

function normalizePage(page) {
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata || {};
  const title = (page.title || '').replace(/^File:/i, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  const license = textFromHtml(meta.LicenseShortName?.value) || textFromHtml(meta.License?.value) || 'Unknown';
  const artist = textFromHtml(meta.Artist?.value) || info.user || 'Unknown';
  const description = textFromHtml(meta.ImageDescription?.value) || textFromHtml(meta.ObjectName?.value) || '';
  const credit = textFromHtml(meta.Credit?.value);
  return {
    pageid: page.pageid,
    title,
    rawTitle: page.title,
    thumbUrl: info.thumburl || info.url,
    originalUrl: info.url,
    sourcePage: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || '')}`,
    author: artist,
    license,
    description,
    credit,
    mime: info.mime,
    width: info.width,
    height: info.height,
    index: page.index
  };
}

function renderResults() {
  els.grid.innerHTML = state.results.map((r) => {
    const safeTitle = escapeHtml(r.title);
    const safeAuthor = escapeHtml(r.author || 'Unknown');
    const safeLicense = escapeHtml(r.license || 'Unknown');
    return `<article class="image-card explore-card" data-pageid="${r.pageid}">
      <div class="card-media" data-action="preview" tabindex="0" role="button" aria-label="Preview ${safeTitle}">
        <img src="${escapeAttr(r.thumbUrl || r.originalUrl)}" alt="${escapeAttr(r.title)}" loading="lazy">
      </div>
      <div class="card-body">
        <h4 class="card-title">${safeTitle}</h4>
        <p class="card-meta">By ${safeAuthor}</p>
        <span class="license-pill">${safeLicense}</span>
      </div>
      <div class="card-actions">
        <button type="button" class="secondary-btn" data-action="preview">Preview</button>
        <button type="button" class="secondary-btn" data-action="open-source">Source</button>
        <button type="button" class="primary-btn" data-action="import">Add to Gallery</button>
      </div>
    </article>`;
  }).join('');

  els.grid.querySelectorAll('[data-action]').forEach((el) => {
    const handler = (e) => {
      const card = e.currentTarget.closest('[data-pageid]') || el.closest('[data-pageid]');
      const id = Number(card?.dataset.pageid);
      const item = state.results.find((r) => r.pageid === id);
      if (!item) return;
      const action = el.dataset.action;
      if (action === 'preview') openPreview(item);
      else if (action === 'open-source') window.open(item.sourcePage, '_blank', 'noopener');
      else if (action === 'import') importToGallery(item);
    };
    el.addEventListener('click', handler);
    if (el.classList.contains('card-media')) {
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); } });
    }
  });
}

function openPreview(item) {
  state.selected = item;
  els.previewTitle.textContent = item.title || 'Image preview';
  els.previewImg.src = item.thumbUrl || item.originalUrl || '';
  els.previewImg.alt = item.title || 'Preview image';
  els.previewAuthor.textContent = item.author || 'Unknown';
  els.previewLicense.textContent = item.license || 'Unknown';
  els.previewSource.innerHTML = `<a href="${escapeAttr(item.sourcePage)}" target="_blank" rel="noopener noreferrer">View on Wikimedia Commons</a>`;
  els.previewDesc.textContent = item.description || 'No description available.';
  els.previewOpen.href = item.sourcePage || '#';
  if (typeof els.previewDialog.showModal === 'function') els.previewDialog.showModal();
  else els.previewDialog.setAttribute('open', '');
}

async function fetchImageBlob(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.blob();
}

async function importToGallery(item) {
  deps.showLoading();
  try {
    let blob;
    let fetchError = null;
    // Try original, then thumbnail as fallback
    for (const candidate of [item.originalUrl, item.thumbUrl]) {
      if (!candidate) continue;
      try {
        blob = await fetchImageBlob(candidate);
        if (blob) break;
      } catch (err) { fetchError = err; }
    }
    if (!blob) {
      const open = confirm('This image cannot be imported directly due to browser/network restrictions. Open the original source page instead?');
      if (open && item.sourcePage) window.open(item.sourcePage, '_blank', 'noopener');
      return;
    }
    const now = new Date().toISOString();
    const image = {
      id: uid('img'),
      title: item.title || 'Imported image',
      description: item.description || '',
      category: 'Wikimedia Commons',
      tags: ['wikimedia'],
      favorite: false,
      albumIds: [],
      createdAt: now,
      updatedAt: now,
      source: 'wikimedia',
      mimeType: blob.type || item.mime || 'image/jpeg',
      size: blob.size,
      width: item.width || null,
      height: item.height || null,
      blob,
      originalBlob: blob,
      attribution: item.author || item.credit || '',
      license: item.license || '',
      sourcePage: item.sourcePage || ''
    };
    await saveImage(image);
    deps.toast('Image added to your gallery.', 'success');
    await deps.onImported(image);
  } catch (err) {
    console.error(err);
    if (isQuotaError(err)) {
      deps.toast('Browser storage is full. Remove some images or empty trash, then try again.', 'error');
    } else {
      deps.toast('Failed to import image. You can try opening the source page instead.', 'error');
      if (item.sourcePage) window.open(item.sourcePage, '_blank', 'noopener');
    }
  } finally {
    deps.hideLoading();
  }
}

async function downloadRemote(item) {
  deps.showLoading();
  try {
    const url = item.originalUrl || item.thumbUrl;
    let blob;
    try { blob = await fetchImageBlob(url); } catch { blob = null; }
    if (blob) {
      const a = document.createElement('a');
      const obj = URL.createObjectURL(blob);
      a.href = obj;
      a.download = sanitizeFilename(item.title || 'image');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 1000);
    } else {
      // fallback: open source page (direct download may be restricted by CORS)
      if (item.sourcePage) window.open(item.sourcePage, '_blank', 'noopener');
      deps.toast('Direct download was blocked. Opened the source page instead.', 'error');
    }
  } finally {
    deps.hideLoading();
  }
}

function sanitizeFilename(name) {
  return (name || 'image').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'image';
}

function escapeHtml(str) { return deps.escapeHtml(str); }
function escapeAttr(str) { return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
