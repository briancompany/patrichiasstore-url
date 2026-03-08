/**
 * IndexedDB cache layer — replaces localStorage for large datasets.
 * Stale-while-revalidate: always serve cache first, refresh in background.
 */

const DB_NAME = 'ps_cache_v1';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore — fallback to memory
  }
}

export async function idbRemove(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export async function idbGetWithTTL<T>(key: string): Promise<{ data: T; stale: boolean } | null> {
  const entry = await idbGet<CacheEntry<T>>(key);
  if (!entry || !entry.data) return null;
  const stale = Date.now() - entry.ts > CACHE_TTL;
  return { data: entry.data, stale };
}

export async function idbSetWithTTL<T>(key: string, data: T): Promise<void> {
  await idbSet(key, { data, ts: Date.now() } as CacheEntry<T>);
}
