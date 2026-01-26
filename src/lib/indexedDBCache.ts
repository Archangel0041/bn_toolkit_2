// IndexedDB-based cache for large game configs (avoids localStorage quota issues)
const DB_NAME = 'game-cache-db';
const DB_VERSION = 1;
const CONFIG_STORE = 'configs';
const CONFIG_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedConfig<T> {
  key: string;
  data: T;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.warn('[IndexedDB] Failed to open database:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE, { keyPath: 'key' });
      }
    };
  });
  
  return dbPromise;
}

export async function getCachedConfigIDB<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CONFIG_STORE, 'readonly');
      const store = tx.objectStore(CONFIG_STORE);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result as CachedConfig<T> | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        
        // Check expiry
        if (Date.now() - result.timestamp > CONFIG_EXPIRY_MS) {
          // Delete expired entry
          deleteCachedConfigIDB(key);
          resolve(null);
          return;
        }
        
        resolve(result.data);
      };
      
      request.onerror = () => {
        console.warn('[IndexedDB] Failed to get config:', request.error);
        resolve(null);
      };
    });
  } catch (e) {
    console.warn('[IndexedDB] Cache read failed:', e);
    return null;
  }
}

export async function cacheConfigIDB<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CONFIG_STORE, 'readwrite');
      const store = tx.objectStore(CONFIG_STORE);
      
      const cached: CachedConfig<T> = {
        key,
        data,
        timestamp: Date.now(),
      };
      
      const request = store.put(cached);
      
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn('[IndexedDB] Failed to cache config:', request.error);
        reject(request.error);
      };
    });
  } catch (e) {
    console.warn('[IndexedDB] Cache write failed:', e);
  }
}

export async function deleteCachedConfigIDB(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CONFIG_STORE, 'readwrite');
      const store = tx.objectStore(CONFIG_STORE);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch (e) {
    // Ignore errors
  }
}

export async function clearAllConfigsIDB(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CONFIG_STORE, 'readwrite');
      const store = tx.objectStore(CONFIG_STORE);
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('[IndexedDB] All configs cleared');
        resolve();
      };
      request.onerror = () => resolve();
    });
  } catch (e) {
    // Ignore errors
  }
}

// Clear old localStorage config cache entries (migration)
export function clearOldLocalStorageConfigs(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('config_cache_') || key?.startsWith('gamedata_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    if (keysToRemove.length > 0) {
      console.log(`[IndexedDB] Migrated: cleared ${keysToRemove.length} old localStorage entries`);
    }
  } catch (e) {
    console.warn('[IndexedDB] Failed to clear old localStorage:', e);
  }
}
