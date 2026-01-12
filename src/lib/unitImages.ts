import { supabase } from "@/integrations/supabase/client";
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
 * Preload unit images using link preload for high-priority loading
 * This uses the browser's native preloading mechanism for optimal performance
 */
export function preloadUnitImages(units: ParsedUnit[], count: number = 20): void {
  const unitsToPreload = units.slice(0, count);
  
  unitsToPreload.forEach(unit => {
    const iconName = unit.identity?.icon;
    if (!iconName) return;
    
    const url = getUnitImageUrl(iconName);
    if (!url || preloadedImages.has(url)) return;
    
    preloadedImages.add(url);
    
    // Use link preload for high-priority images
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

/**
 * Preload images in the background using Image objects (lower priority)
 */
export function preloadUnitImagesBackground(units: ParsedUnit[], count: number = 50): void {
  const unitsToPreload = units.slice(0, count);
  
  // Use requestIdleCallback for background loading
  const loadImages = () => {
    unitsToPreload.forEach(unit => {
      const iconName = unit.identity?.icon;
      if (!iconName) return;
      
      const url = getUnitImageUrl(iconName);
      if (!url || preloadedImages.has(url)) return;
      
      preloadedImages.add(url);
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
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
