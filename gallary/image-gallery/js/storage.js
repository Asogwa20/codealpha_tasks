const DB_NAME = 'lumen-gallery-db';
const DB_VERSION = 1;
const STORES = {
  images: 'images',
  albums: 'albums',
  trash: 'trash'
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.images)) {
        const images = db.createObjectStore(STORES.images, { keyPath: 'id' });
        images.createIndex('createdAt', 'createdAt', { unique: false });
        images.createIndex('favorite', 'favorite', { unique: false });
        images.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.albums)) {
        const albums = db.createObjectStore(STORES.albums, { keyPath: 'id' });
        albums.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.trash)) {
        const trash = db.createObjectStore(STORES.trash, { keyPath: 'id' });
        trash.createIndex('deletedAt', 'deletedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open database.'));
  });
  return dbPromise;
}

function tx(storeNames, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeNames, mode));
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
  });
}

export async function getAll(storeName) {
  const transaction = await tx(storeName);
  const store = transaction.objectStore(storeName);
  return reqToPromise(store.getAll());
}

export async function getById(storeName, id) {
  const transaction = await tx(storeName);
  const store = transaction.objectStore(storeName);
  return reqToPromise(store.get(id));
}

export async function put(storeName, value) {
  const transaction = await tx(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  store.put(value);
  await txDone(transaction);
  return value;
}

export async function putMany(storeName, values) {
  const transaction = await tx(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  values.forEach((v) => store.put(v));
  await txDone(transaction);
}

export async function remove(storeName, id) {
  const transaction = await tx(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(id);
  await txDone(transaction);
}

export async function clearStore(storeName) {
  const transaction = await tx(storeName, 'readwrite');
  transaction.objectStore(storeName).clear();
  await txDone(transaction);
}

export async function getAllImages() { return getAll(STORES.images); }
export async function getImage(id) { return getById(STORES.images, id); }
export async function saveImage(image) { return put(STORES.images, image); }
export async function saveImages(images) { return putMany(STORES.images, images); }
export async function deleteImageRecord(id) { return remove(STORES.images, id); }

export async function getAllAlbums() { return getAll(STORES.albums); }
export async function saveAlbum(album) { return put(STORES.albums, album); }
export async function deleteAlbumRecord(id) { return remove(STORES.albums, id); }

export async function getAllTrash() { return getAll(STORES.trash); }
export async function saveTrashItem(item) { return put(STORES.trash, item); }
export async function deleteTrashItem(id) { return remove(STORES.trash, id); }
export async function emptyTrashStore() { return clearStore(STORES.trash); }

export function uid(prefix = 'id') {
  if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getPrefs() {
  try {
    return JSON.parse(localStorage.getItem('lumen:prefs') || '{}');
  } catch {
    return {};
  }
}

export function setPrefs(patch) {
  const prefs = { ...getPrefs(), ...patch };
  localStorage.setItem('lumen:prefs', JSON.stringify(prefs));
  return prefs;
}

export async function estimateStorage() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    } catch {
      return null;
    }
  }
  return null;
}

export function isQuotaError(err) {
  if (!err) return false;
  return err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota/i.test(err.message || '');
}

export { STORES };
