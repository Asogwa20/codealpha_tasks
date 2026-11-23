import { saveImages, uid, isQuotaError } from './storage.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml']);

export function validateFiles(files) {
  const accepted = [];
  const errors = [];
  for (const file of files) {
    if (!file.type.startsWith('image/') && !ALLOWED_TYPES.has(file.type)) {
      errors.push(`${file.name}: unsupported file type.`);
      continue;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      errors.push(`${file.name}: unsupported format (${file.type || 'unknown'}).`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: exceeds 20 MB limit.`);
      continue;
    }
    accepted.push(file);
  }
  return { accepted, errors };
}

function getImageDimensions(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight, url });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: null, height: null });
    };
    img.src = url;
  });
}

export async function importFiles(files, { onProgress } = {}) {
  const { accepted, errors } = validateFiles(Array.from(files || []));
  const images = [];
  for (let i = 0; i < accepted.length; i++) {
    const file = accepted[i];
    const dims = await getImageDimensions(file);
    const now = new Date().toISOString();
    images.push({
      id: uid('img'),
      title: file.name.replace(/\.[^.]+$/, ''),
      description: '',
      category: '',
      tags: [],
      favorite: false,
      albumIds: [],
      createdAt: now,
      updatedAt: now,
      source: 'local',
      mimeType: file.type,
      size: file.size,
      width: dims.width,
      height: dims.height,
      originalName: file.name,
      blob: file,
      originalBlob: file,
      attribution: null,
      sourcePage: null,
      license: null
    });
    if (onProgress) onProgress(i + 1, accepted.length);
  }
  if (images.length) {
    try {
      await saveImages(images);
    } catch (err) {
      if (isQuotaError(err)) {
        throw new Error('Browser storage is full. Remove some images or empty trash, then try again.');
      }
      throw err;
    }
  }
  return { images, errors };
}

export function bindDropzone(dropzone, onFiles) {
  if (!dropzone) return;
  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover'].forEach((evt) => dropzone.addEventListener(evt, (e) => {
    prevent(e);
    dropzone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach((evt) => dropzone.addEventListener(evt, (e) => {
    prevent(e);
    dropzone.classList.remove('dragover');
  }));
  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files?.length) onFiles(files);
  });
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFiles(null, { openPicker: true });
    }
  });
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    onFiles(null, { openPicker: true });
  });
}
