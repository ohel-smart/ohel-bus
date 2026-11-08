// A tiny key-value store on IndexedDB, for data too big for localStorage (~5 MB). Every
// failure (private mode, storage blocked or cleared, quota) resolves to "nothing stored" /
// "not saved", so callers simply work without the cache.

const DB_NAME = 'ohel-bus';
const STORE = 'kv';

function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => { resolve((req.result as T) ?? null); db.close(); };
      req.onerror = () => { resolve(null); db.close(); };
    } catch {
      resolve(null);
      db.close();
    }
  });
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await open();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => { resolve(true); db.close(); };
      tx.onerror = () => { resolve(false); db.close(); };
      tx.onabort = () => { resolve(false); db.close(); };
    } catch {
      resolve(false);
      db.close();
    }
  });
}
