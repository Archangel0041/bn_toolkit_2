// Cache Storage utility for icons and configs
const ICON_CACHE_NAME = 'game-icons-v1';
const CONFIG_CACHE_NAME = 'game-configs-v1';
const ICON_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (increased from 1 day)
const CONFIG_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheMetadata {
  timestamp: number;
  expiryMs: number;
}

// Store metadata in a separate cache
const METADATA_CACHE_NAME = 'cache-metadata-v1';

// Request persistent storage to prevent browser from evicting our cache
let persistentStorageRequested = false;

export async function requestPersistentStorage(): Promise<boolean> {
  if (persistentStorageRequested) return true;
  
  try {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[Cache] Persistent storage ${granted ? 'granted' : 'denied'}`);
        persistentStorageRequested = true;
        return granted;
      }
      persistentStorageRequested = true;
      return true;
    }
  } catch (e) {
    console.warn('[Cache] Failed to request persistent storage:', e);
  }
  return false;
}

// Get storage quota information
export async function getStorageQuota(): Promise<{
  usage: number;
  quota: number;
  usagePercent: number;
  persistent: boolean;
} | null> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const persistent = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        usagePercent: estimate.quota ? Math.round((estimate.usage || 0) / estimate.quota * 100) : 0,
        persistent
      };
    }
  } catch (e) {
    console.warn('[Cache] Failed to get storage quota:', e);
  }
  return null;
}

async function getMetadata(url: string): Promise<CacheMetadata | null> {
  try {
    // Only use Cache API for http/https URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return null;
    }
    const cache = await caches.open(METADATA_CACHE_NAME);
    const response = await cache.match(url);
    if (response) {
      return await response.json();
    }
  } catch (e) {
    console.warn('Failed to get cache metadata:', e);
  }
  return null;
}

async function setMetadata(url: string, expiryMs: number): Promise<void> {
  try {
    // Only use Cache API for http/https URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return;
    }
    const cache = await caches.open(METADATA_CACHE_NAME);
    const metadata: CacheMetadata = {
      timestamp: Date.now(),
      expiryMs
    };
    await cache.put(url, new Response(JSON.stringify(metadata)));
  } catch (e) {
    console.warn('Failed to set cache metadata:', e);
  }
}

async function isExpired(url: string): Promise<boolean> {
  const metadata = await getMetadata(url);
  if (!metadata) return true;
  return Date.now() - metadata.timestamp > metadata.expiryMs;
}

// Icon caching functions
export async function getCachedIcon(url: string): Promise<string | null> {
  try {
    if (!('caches' in window)) return null;
    
    const cache = await caches.open(ICON_CACHE_NAME);
    const response = await cache.match(url);
    
    if (response) {
      // Check if expired
      if (await isExpired(url)) {
        await cache.delete(url);
        return null;
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    console.warn('Failed to get cached icon:', e);
  }
  return null;
}

export async function cacheIcon(url: string, response: Response): Promise<void> {
  try {
    if (!('caches' in window)) return;
    
    const cache = await caches.open(ICON_CACHE_NAME);
    await cache.put(url, response.clone());
    await setMetadata(url, ICON_EXPIRY_MS);
  } catch (e) {
    console.warn('Failed to cache icon:', e);
  }
}

export async function fetchAndCacheIcon(url: string): Promise<string | null> {
  try {
    // Check cache first
    const cached = await getCachedIcon(url);
    if (cached) return cached;
    
    // Fetch and cache
    const response = await fetch(url);
    if (response.ok) {
      await cacheIcon(url, response.clone());
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    console.warn('Failed to fetch and cache icon:', e);
  }
  return null;
}

// Config caching functions - use localStorage since Cache API requires http:// URLs
export async function getCachedConfig<T>(key: string): Promise<T | null> {
  try {
    const cacheKey = `config_cache_${key}`;
    const stored = localStorage.getItem(cacheKey);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    // Check expiry
    if (Date.now() - parsed.timestamp > CONFIG_EXPIRY_MS) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    return parsed.data;
  } catch (e) {
    console.warn('Failed to get cached config:', e);
  }
  return null;
}

export async function cacheConfig<T>(key: string, data: T): Promise<void> {
  try {
    const cacheKey = `config_cache_${key}`;
    const stored = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(stored));
  } catch (e) {
    // localStorage might be full
    console.warn('Failed to cache config:', e);
  }
}

// Clear all caches
export async function clearAllCaches(): Promise<void> {
  try {
    if (!('caches' in window)) return;
    
    await caches.delete(ICON_CACHE_NAME);
    await caches.delete(CONFIG_CACHE_NAME);
    await caches.delete(METADATA_CACHE_NAME);
    console.log('All caches cleared');
  } catch (e) {
    console.warn('Failed to clear caches:', e);
  }
}

// Get cache stats
export async function getCacheStorageStats(): Promise<{
  iconCount: number;
  configCount: number;
  supported: boolean;
}> {
  if (!('caches' in window)) {
    return { iconCount: 0, configCount: 0, supported: false };
  }
  
  try {
    const iconCache = await caches.open(ICON_CACHE_NAME);
    const configCache = await caches.open(CONFIG_CACHE_NAME);
    
    const iconKeys = await iconCache.keys();
    const configKeys = await configCache.keys();
    
    return {
      iconCount: iconKeys.length,
      configCount: configKeys.length,
      supported: true
    };
  } catch (e) {
    return { iconCount: 0, configCount: 0, supported: false };
  }
}
