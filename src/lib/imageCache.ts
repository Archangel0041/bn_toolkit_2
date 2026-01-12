/**
 * Persistent Image Cache using Cache Storage API
 * 
 * This caches images locally so they don't need to be re-downloaded
 * on page refresh, even if server headers don't allow browser caching.
 */

const IMAGE_CACHE_NAME = 'unit-images-v1';
const IMAGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  timestamp: number;
  blobUrl: string;
}

// In-memory map of URL -> blob URL for instant access
const blobUrlCache = new Map<string, string>();

// Track pending fetches to avoid duplicate requests
const pendingFetches = new Map<string, Promise<string | null>>();

/**
 * Get an image from cache, or fetch and cache it
 * Returns a blob URL that can be used as img src
 */
export async function getCachedImageUrl(originalUrl: string): Promise<string | null> {
  // Check in-memory cache first
  if (blobUrlCache.has(originalUrl)) {
    return blobUrlCache.get(originalUrl)!;
  }

  // Check if there's already a pending fetch for this URL
  if (pendingFetches.has(originalUrl)) {
    return pendingFetches.get(originalUrl)!;
  }

  // Start fetch and cache the promise
  const fetchPromise = fetchAndCache(originalUrl);
  pendingFetches.set(originalUrl, fetchPromise);

  try {
    const result = await fetchPromise;
    return result;
  } finally {
    pendingFetches.delete(originalUrl);
  }
}

async function fetchAndCache(url: string): Promise<string | null> {
  try {
    if (!('caches' in window)) {
      // Fall back to regular URL if Cache API not supported
      return url;
    }

    const cache = await caches.open(IMAGE_CACHE_NAME);
    
    // Check cache first
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      // Check if expired via custom header
      const cachedAt = cachedResponse.headers.get('x-cached-at');
      if (cachedAt) {
        const age = Date.now() - parseInt(cachedAt, 10);
        if (age < IMAGE_EXPIRY_MS) {
          const blob = await cachedResponse.blob();
          const blobUrl = URL.createObjectURL(blob);
          blobUrlCache.set(url, blobUrl);
          return blobUrl;
        }
        // Expired, delete and re-fetch
        await cache.delete(url);
      }
    }

    // Fetch from network
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${url}`, response.status);
      return url; // Fall back to original URL
    }

    // Clone response and add timestamp header for expiry tracking
    const blob = await response.blob();
    const headers = new Headers();
    headers.set('Content-Type', blob.type || 'image/png');
    headers.set('x-cached-at', Date.now().toString());
    
    const cacheResponse = new Response(blob, { headers });
    await cache.put(url, cacheResponse);

    // Create blob URL for immediate use
    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(url, blobUrl);
    
    return blobUrl;
  } catch (e) {
    console.warn('Image cache error:', e);
    return url; // Fall back to original URL
  }
}

/**
 * Check if an image is already in the memory cache
 */
export function isImageInMemoryCache(url: string): boolean {
  return blobUrlCache.has(url);
}

/**
 * Preload images into cache (for background loading)
 */
export async function preloadImagesIntoCache(urls: string[]): Promise<void> {
  // Load in batches to avoid overwhelming the browser
  const batchSize = 10;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(url => getCachedImageUrl(url)));
  }
}

/**
 * Clear the image cache
 */
export async function clearImageCache(): Promise<void> {
  try {
    // Revoke all blob URLs
    blobUrlCache.forEach(blobUrl => URL.revokeObjectURL(blobUrl));
    blobUrlCache.clear();
    
    // Clear Cache Storage
    if ('caches' in window) {
      await caches.delete(IMAGE_CACHE_NAME);
    }
  } catch (e) {
    console.warn('Failed to clear image cache:', e);
  }
}

/**
 * Get cache statistics
 */
export async function getImageCacheStats(): Promise<{ 
  memoryCount: number; 
  storageCount: number;
  supported: boolean;
}> {
  const memoryCount = blobUrlCache.size;
  
  if (!('caches' in window)) {
    return { memoryCount, storageCount: 0, supported: false };
  }
  
  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const keys = await cache.keys();
    return { memoryCount, storageCount: keys.length, supported: true };
  } catch {
    return { memoryCount, storageCount: 0, supported: true };
  }
}
