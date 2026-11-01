const DB_NAME = 'madrasat-al-kazimi-preview';
const STORE = 'attachments';
let dbPromise;

function openDB() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => { dbPromise = null; throw error; });
  return dbPromise;
}

async function transaction(mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = action(tx.objectStore(STORE));
    let result;
    req.onsuccess = () => { result = req.result; };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted'));
  });
}

export async function saveAttachment(id, kind, file) {
  if (!file) return;
  return transaction('readwrite', store => store.put(file, `${id}:${kind}`));
}

export async function getAttachment(id, kind) {
  return transaction('readonly', store => store.get(`${id}:${kind}`));
}

export async function removeAttachments(id, kinds = ['audio', 'pdf']) {
  for (const kind of kinds) await transaction('readwrite', store => store.delete(`${id}:${kind}`));
}
