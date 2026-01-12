/**
 * Data Loader - Fetches game data from Supabase Storage buckets
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

const CONFIG_BUCKET = "config";
const LOCALIZATIONS_BUCKET = "Localizations";

// Cache for loaded data
const dataCache = new Map<string, any>();
const loadingPromises = new Map<string, Promise<any>>();

export interface DataLoadingState {
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
}

// Fetch JSON from a storage bucket using public URL
async function fetchFromBucket(bucket: string, path: string): Promise<any> {
  const cacheKey = `${bucket}/${path}`;
  
  // Return cached data if available
  if (dataCache.has(cacheKey)) {
    return dataCache.get(cacheKey);
  }
  
  // Return existing promise if already loading
  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey);
  }
  
  // Create new loading promise
  const loadPromise = (async () => {
    try {
      console.log(`[DataLoader] Loading ${cacheKey}...`);
      
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
      
      console.log(`[DataLoader] Successfully loaded ${cacheKey}`);
      
      // Cache the result
      dataCache.set(cacheKey, json);
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

// Clear cache (useful for refreshing data)
export function clearDataCache() {
  dataCache.clear();
}

// Check if data is cached
export function isDataCached(bucket: string, path: string): boolean {
  return dataCache.has(`${bucket}/${path}`);
}

// Get cached data directly (returns undefined if not cached)
export function getCachedData<T>(bucket: string, path: string): T | undefined {
  return dataCache.get(`${bucket}/${path}`);
}
