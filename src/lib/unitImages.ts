import { supabase } from "@/integrations/supabase/client";
import { preloadImagesIntoCache } from "@/lib/imageCache";
import type { ParsedUnit } from "@/types/units";

const BUCKET_NAME = "Art";
const FRONT_PATH = "icons/units/front";
const BACK_PATH = "icons/units/back";

// Track preloaded images to avoid duplicates
const preloadedImages = new Set<string>();

export function getUnitImageUrl(iconName: string, useBackIcon: boolean = false): string | null {
  if (!iconName) return null;

  const path = useBackIcon ? BACK_PATH : FRONT_PATH;
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${path}/${iconName}.png`);

  return data.publicUrl;
}

/**
 * Preload unit images into the persistent cache
 * Uses Cache Storage API so images persist across page refreshes
 */
export function preloadUnitImages(units: ParsedUnit[], count: number = 20): void {
  const urls: string[] = [];
  const unitsToPreload = units.slice(0, count);
  
  unitsToPreload.forEach(unit => {
    const iconName = unit.identity?.icon;
    if (!iconName) return;
    
    const url = getUnitImageUrl(iconName);
    if (!url || preloadedImages.has(url)) return;
    
    preloadedImages.add(url);
    urls.push(url);
  });
  
  if (urls.length > 0) {
    // Preload into persistent cache
    preloadImagesIntoCache(urls);
  }
}

/**
 * Preload images in the background (lower priority)
 */
export function preloadUnitImagesBackground(units: ParsedUnit[], count: number = 50): void {
  const urls: string[] = [];
  const unitsToPreload = units.slice(0, count);
  
  unitsToPreload.forEach(unit => {
    const iconName = unit.identity?.icon;
    if (!iconName) return;
    
    const url = getUnitImageUrl(iconName);
    if (!url || preloadedImages.has(url)) return;
    
    preloadedImages.add(url);
    urls.push(url);
  });
  
  if (urls.length === 0) return;
  
  // Use requestIdleCallback for background loading
  const loadImages = () => {
    preloadImagesIntoCache(urls);
  };
  
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadImages, { timeout: 2000 });
  } else {
    setTimeout(loadImages, 100);
  }
}

/**
 * Clear preload tracking (useful for testing)
 */
export function clearPreloadTracking(): void {
  preloadedImages.clear();
}
