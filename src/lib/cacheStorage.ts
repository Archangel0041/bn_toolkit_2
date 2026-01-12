// Cache Storage utility for icons and configs
const ICON_CACHE_NAME = 'game-icons-v1';
const CONFIG_CACHE_NAME = 'game-configs-v1';
const ICON_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day
const CONFIG_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day

interface CacheMetadata {
  timestamp: number;
  expiryMs: number;
}

// Store metadata in a separate cache
const METADATA_CACHE_NAME = 'cache-metadata-v1';

async function getMetadata(url: string): Promise<CacheMetadata | null> {
  try {
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

// Config caching functions
export async function getCachedConfig<T>(key: string): Promise<T | null> {
  try {
    if (!('caches' in window)) return null;
    
    const cache = await caches.open(CONFIG_CACHE_NAME);
    const cacheKey = `config://${key}`;
    const response = await cache.match(cacheKey);
    
    if (response) {
      if (await isExpired(cacheKey)) {
        await cache.delete(cacheKey);
        return null;
      }
      return await response.json();
    }
  } catch (e) {
    console.warn('Failed to get cached config:', e);
  }
  return null;
}

export async function cacheConfig<T>(key: string, data: T): Promise<void> {
  try {
    if (!('caches' in window)) return;
    
    const cache = await caches.open(CONFIG_CACHE_NAME);
    const cacheKey = `config://${key}`;
    await cache.put(cacheKey, new Response(JSON.stringify(data)));
    await setMetadata(cacheKey, CONFIG_EXPIRY_MS);
  } catch (e) {
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
