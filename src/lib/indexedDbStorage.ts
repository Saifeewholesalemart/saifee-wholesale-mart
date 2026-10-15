/**
 * High-Capacity IndexedDB Storage Driver for Saifee General Stores ERP
 * Replaces the 5MB browser localStorage limit with gigabytes of local storage capacity,
 * fully supporting catalogs with 6,000 to 50,000+ FMCG products, stock ledgers, and batches.
 */

const DB_NAME = 'SaifeeFmcgDatabase';
const DB_VERSION = 1;
const STORE_NAME = 'fmcg_stores';

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase | null> | null = null;

export function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * Opens or returns the cached IndexedDB database connection
 */
export function openIndexedDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) return Promise.resolve(null);
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event: Event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        dbInstance.onclose = () => {
          dbInstance = null;
          dbOpenPromise = null;
        };
        resolve(dbInstance);
      };

      request.onerror = (event: Event) => {
        console.warn('[IndexedDB] Failed to open database:', (event.target as IDBOpenDBRequest).error);
        dbOpenPromise = null;
        resolve(null);
      };
    } catch (err) {
      console.warn('[IndexedDB] Initialization exception:', err);
      dbOpenPromise = null;
      resolve(null);
    }
  });

  return dbOpenPromise;
}

/**
 * Retrieves an item from IndexedDB by key
 */
export async function getIdbItem<T>(key: string): Promise<T | null> {
  const db = await openIndexedDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result !== undefined ? (request.result as T) : null);
      };

      request.onerror = () => {
        console.warn(`[IndexedDB] Error reading key ${key}:`, request.error);
        resolve(null);
      };
    } catch (e) {
      console.warn(`[IndexedDB] Transaction error for key ${key}:`, e);
      resolve(null);
    }
  });
}

/**
 * Stores an item in IndexedDB by key
 */
export async function setIdbItem<T>(key: string, value: T): Promise<void> {
  const db = await openIndexedDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn(`[IndexedDB] Error writing key ${key}:`, request.error);
        resolve();
      };
    } catch (e) {
      console.warn(`[IndexedDB] Transaction write error for key ${key}:`, e);
      resolve();
    }
  });
}

/**
 * Reads all key-value entries from the IndexedDB store
 */
export async function getAllIdbItems(): Promise<Record<string, any>> {
  const db = await openIndexedDb();
  if (!db) return {};

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const items: Record<string, any> = {};
      const anyStore = store as any;

      if (typeof anyStore.getAllKeys === 'function' && typeof anyStore.getAll === 'function') {
        const keysReq = anyStore.getAllKeys();
        keysReq.onsuccess = () => {
          const keys = keysReq.result as string[];
          const valuesReq = anyStore.getAll();
          valuesReq.onsuccess = () => {
            const values = valuesReq.result;
            keys.forEach((k, idx) => {
              items[k] = values[idx];
            });
            resolve(items);
          };
          valuesReq.onerror = () => resolve({});
        };
        keysReq.onerror = () => resolve({});
      } else {
        const cursorReq = anyStore.openCursor();
        cursorReq.onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (cursor) {
            items[cursor.key as string] = cursor.value;
            cursor.continue();
          } else {
            resolve(items);
          }
        };
        cursorReq.onerror = () => resolve(items);
      }
    } catch (e) {
      console.warn('[IndexedDB] Error reading all items:', e);
      resolve({});
    }
  });
}

/**
 * Removes an item from IndexedDB by key
 */
export async function deleteIdbItem(key: string): Promise<void> {
  const db = await openIndexedDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
