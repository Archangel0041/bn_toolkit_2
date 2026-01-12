/**
 * Data Loader - Fetches game data from Supabase Storage buckets
 * 
 * Features:
 * - Cache Storage API for persistent config caching
 * - Memory caching for fast repeated access
 * - Cache versioning to invalidate stale data
 * 
 * Config bucket paths:
 * - battle/battle_units.json
 * - battle/battle_abilities.json
 * - battle/battle_encounters.json
 * - battle/battle_config.json
 * - battle/damage_anim_config.json
 * - battle/exclude_tags.json
 * - boss_strike_config.json
 * - status_effects.json
 * - status_effect_families.json
 * 
 * Localizations bucket paths:
 * - tables/GameText Shared Data.json
 * - tables/GameText_{lang}.json
 */

import { supabase } from "@/integrations/supabase/client";
import { getCachedConfig, cacheConfig } from "@/lib/cacheStorage";

const CONFIG_BUCKET = "config";
const LOCALIZATIONS_BUCKET = "Localizations";

// Cache version - increment this to invalidate all cached data
const CACHE_VERSION = "1.0.1";
const CACHE_PREFIX = "gamedata_cache_";
const CACHE_VERSION_KEY = "gamedata_cache_version";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Memory cache for loaded data (fastest access)
const memoryCache = new Map<string, any>();
const loadingPromises = new Map<string, Promise<any>>();

export interface DataLoadingState {
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
}

interface CachedItem {
  data: any;
  timestamp: number;
  version: string;
}

// Check and clear cache if version mismatch
function checkCacheVersion(): void {
  try {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (storedVersion !== CACHE_VERSION) {
      console.log(`[DataLoader] Cache version mismatch (${storedVersion} vs ${CACHE_VERSION}), clearing cache...`);
      clearLocalStorageCache();
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    }
  } catch (err) {
    console.warn("[DataLoader] Failed to check cache version:", err);
  }
}

// Clear all localStorage cache entries
function clearLocalStorageCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[DataLoader] Cleared ${keysToRemove.length} cached items`);
  } catch (err) {
    console.warn("[DataLoader] Failed to clear localStorage cache:", err);
  }
}

// Get from localStorage cache
function getFromLocalStorage(cacheKey: string): any | null {
  try {
    const stored = localStorage.getItem(CACHE_PREFIX + cacheKey);
    if (!stored) return null;
    
    const cached: CachedItem = JSON.parse(stored);
    
    // Check version
    if (cached.version !== CACHE_VERSION) {
      localStorage.removeItem(CACHE_PREFIX + cacheKey);
      return null;
    }
    
    // Check expiry
    if (Date.now() - cached.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_PREFIX + cacheKey);
      return null;
    }
    
    return cached.data;
  } catch (err) {
    console.warn(`[DataLoader] Failed to read from localStorage (${cacheKey}):`, err);
    return null;
  }
}

// Save to localStorage cache
function saveToLocalStorage(cacheKey: string, data: any): void {
  try {
    const cached: CachedItem = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(cached));
  } catch (err) {
    // localStorage might be full or disabled
    console.warn(`[DataLoader] Failed to save to localStorage (${cacheKey}):`, err);
  }
}

// Initialize cache version check
checkCacheVersion();

// Fetch JSON from a storage bucket using public URL with caching
async function fetchFromBucket(bucket: string, path: string, usePersistentCache = true): Promise<any> {
  const cacheKey = `${bucket}/${path}`;
  
  // Check memory cache first (fastest)
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }
  
  // Check Cache Storage first (preferred), then fall back to localStorage
  if (usePersistentCache) {
    // Try Cache Storage API first
    const cacheStorageData = await getCachedConfig(cacheKey);
    if (cacheStorageData !== null) {
      console.log(`[DataLoader] Loaded ${cacheKey} from Cache Storage`);
      memoryCache.set(cacheKey, cacheStorageData);
      return cacheStorageData;
    }
    
    // Fall back to localStorage (legacy)
    const localCached = getFromLocalStorage(cacheKey);
    if (localCached !== null) {
      console.log(`[DataLoader] Loaded ${cacheKey} from localStorage cache`);
      memoryCache.set(cacheKey, localCached);
      // Migrate to Cache Storage
      await cacheConfig(cacheKey, localCached);
      return localCached;
    }
  }
  
  // Return existing promise if already loading
  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey);
  }
  
  // Create new loading promise
  const loadPromise = (async () => {
    try {
      console.log(`[DataLoader] Fetching ${cacheKey} from server...`);
      
      // Get public URL for the file
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      
      // Fetch using the public URL
      const response = await fetch(urlData.publicUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const json = await response.json();
      
      console.log(`[DataLoader] Successfully fetched ${cacheKey}`);
      
      // Cache in memory
      memoryCache.set(cacheKey, json);
      
      // Cache in Cache Storage for persistence (preferred)
      if (usePersistentCache) {
        await cacheConfig(cacheKey, json);
        // Also save to localStorage as backup
        saveToLocalStorage(cacheKey, json);
      }
      
      loadingPromises.delete(cacheKey);
      
      return json;
    } catch (err) {
      console.error(`[DataLoader] Failed to load ${cacheKey}:`, err);
      loadingPromises.delete(cacheKey);
      throw err;
    }
  })();
  
  loadingPromises.set(cacheKey, loadPromise);
  return loadPromise;
}

// Config bucket loaders
export async function loadBattleUnits(): Promise<Record<string, any[]>> {
  return fetchFromBucket(CONFIG_BUCKET, "battle/battle_units.json");
}

export async function loadBattleAbilities(): Promise<Record<string, any>> {
  return fetchFromBucket(CONFIG_BUCKET, "battle/battle_abilities.json");
}

export async function loadBattleEncounters(): Promise<any> {
  return fetchFromBucket(CONFIG_BUCKET, "battle/battle_encounters.json");
}

export async function loadBattleConfig(): Promise<any> {
  return fetchFromBucket(CONFIG_BUCKET, "battle/battle_config.json");
}

export async function loadDamageAnimConfig(): Promise<any> {
  return fetchFromBucket(CONFIG_BUCKET, "battle/damage_anim_config.json");
}

export async function loadExcludeTags(): Promise<any> {
  return fetchFromBucket(CONFIG_BUCKET, "battle/exclude_tags.json");
}

export async function loadBossStrikeConfig(): Promise<any> {
  return fetchFromBucket(CONFIG_BUCKET, "boss_strike_config.json");
}

export async function loadStatusEffects(): Promise<any> {
  return fetchFromBucket(CONFIG_BUCKET, "status_effects.json");
}

export async function loadStatusEffectFamilies(): Promise<any> {
  return fetchFromBucket(CONFIG_BUCKET, "status_effect_families.json");
}

// Localization loaders
export async function loadGameTextSharedData(): Promise<any> {
  return fetchFromBucket(LOCALIZATIONS_BUCKET, "tables/GameText Shared Data.json");
}

export async function loadGameTextLanguage(lang: string): Promise<any> {
  return fetchFromBucket(LOCALIZATIONS_BUCKET, `tables/GameText_${lang}.json`);
}

// Load all core battle data at once
export async function loadCoreBattleData() {
  const [units, abilities, encounters, config] = await Promise.all([
    loadBattleUnits(),
    loadBattleAbilities(),
    loadBattleEncounters(),
    loadBattleConfig(),
  ]);
  
  return { units, abilities, encounters, config };
}

// Load all localization data for a language
export async function loadLocalizationData(lang: string) {
  const [shared, langData] = await Promise.all([
    loadGameTextSharedData(),
    loadGameTextLanguage(lang),
  ]);
  
  return { shared, langData };
}

// Clear all caches (memory + localStorage + Cache Storage)
export async function clearDataCache() {
  memoryCache.clear();
  clearLocalStorageCache();
  // Also clear Cache Storage
  const { clearAllCaches } = await import("@/lib/cacheStorage");
  await clearAllCaches();
  console.log("[DataLoader] All caches cleared");
}

// Clear only memory cache (keeps localStorage)
export function clearMemoryCache() {
  memoryCache.clear();
}

// Check if data is cached in memory
export function isDataCached(bucket: string, path: string): boolean {
  return memoryCache.has(`${bucket}/${path}`);
}

// Check if all core data is in memory (synchronous check)
export function isAllCoreDataInMemory(): boolean {
  const requiredKeys = [
    `${CONFIG_BUCKET}/battle/battle_units.json`,
    `${CONFIG_BUCKET}/battle/battle_abilities.json`,
    `${CONFIG_BUCKET}/battle/battle_encounters.json`,
    `${CONFIG_BUCKET}/battle/battle_config.json`,
    `${CONFIG_BUCKET}/status_effects.json`,
    `${CONFIG_BUCKET}/status_effect_families.json`,
    `${LOCALIZATIONS_BUCKET}/tables/GameText Shared Data.json`,
  ];
  return requiredKeys.every(key => memoryCache.has(key));
}

// Get all cached core data synchronously (returns null if any missing)
export function getCoreDataFromMemory(): {
  battleUnits: Record<string, any[]>;
  battleAbilities: Record<string, any>;
  battleEncounters: any;
  battleConfig: any;
  statusEffects: Record<string, any>;
  statusEffectFamilies: Record<string, any>;
  sharedData: any;
} | null {
  const battleUnits = memoryCache.get(`${CONFIG_BUCKET}/battle/battle_units.json`);
  const battleAbilities = memoryCache.get(`${CONFIG_BUCKET}/battle/battle_abilities.json`);
  const battleEncounters = memoryCache.get(`${CONFIG_BUCKET}/battle/battle_encounters.json`);
  const battleConfig = memoryCache.get(`${CONFIG_BUCKET}/battle/battle_config.json`);
  const statusEffects = memoryCache.get(`${CONFIG_BUCKET}/status_effects.json`);
  const statusEffectFamilies = memoryCache.get(`${CONFIG_BUCKET}/status_effect_families.json`);
  const sharedData = memoryCache.get(`${LOCALIZATIONS_BUCKET}/tables/GameText Shared Data.json`);
  
  if (!battleUnits || !battleAbilities || !battleEncounters || !battleConfig || 
      !statusEffects || !statusEffectFamilies || !sharedData) {
    return null;
  }
  
  return { battleUnits, battleAbilities, battleEncounters, battleConfig, statusEffects, statusEffectFamilies, sharedData };
}

// Get language data from memory
export function getLanguageDataFromMemory(lang: string): any | null {
  return memoryCache.get(`${LOCALIZATIONS_BUCKET}/tables/GameText_${lang}.json`) || null;
}

// Check if data is cached in localStorage
export function isDataCachedLocally(bucket: string, path: string): boolean {
  return getFromLocalStorage(`${bucket}/${path}`) !== null;
}

// Get cached data directly from memory (returns undefined if not cached)
export function getCachedData<T>(bucket: string, path: string): T | undefined {
  return memoryCache.get(`${bucket}/${path}`);
}

// Force refresh a specific cache key
export async function refreshCacheKey(bucket: string, path: string): Promise<any> {
  const cacheKey = `${bucket}/${path}`;
  memoryCache.delete(cacheKey);
  try {
    localStorage.removeItem(CACHE_PREFIX + cacheKey);
  } catch {}
  return fetchFromBucket(bucket, path);
}

// Get cache stats for debugging
export function getCacheStats(): { memoryCount: number; localStorageCount: number; localStorageSize: string } {
  let localStorageCount = 0;
  let localStorageSize = 0;
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        localStorageCount++;
        localStorageSize += (localStorage.getItem(key) || "").length * 2; // UTF-16 chars = 2 bytes
      }
    }
  } catch {}
  
  return {
    memoryCount: memoryCache.size,
    localStorageCount,
    localStorageSize: `${(localStorageSize / 1024 / 1024).toFixed(2)} MB`,
  };
}
