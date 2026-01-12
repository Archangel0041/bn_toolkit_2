/**
 * Game Data Store - Global access to loaded game data
 * 
 * This provides synchronous access to game data after it's been loaded by GameDataContext.
 * The store is initialized by the GameDataContext on app startup.
 */

import type { Ability } from "@/lib/abilities";
import type { ParsedUnit, UnitConfig, SharedDataFile, LocalizedFile, SupportedLanguage } from "@/types/units";
import type { EncountersData, Encounter, EncounterUnit } from "@/types/encounters";

interface GameDataStore {
  battleUnits: Record<string, UnitConfig[]> | null;
  battleAbilities: Record<string, Ability> | null;
  battleEncounters: EncountersData | null;
  battleConfig: any | null;
  statusEffects: Record<string, any> | null;
  statusEffectFamilies: Record<string, any> | null;
  bossStrikeConfig: any | null;
  sharedData: SharedDataFile | null;
  languageData: Record<SupportedLanguage, LocalizedFile> | null;
  parsedUnits: ParsedUnit[] | null;
  
  // Lookup maps for performance
  keyToIdMap: Map<string, string> | null;
  idToTextMaps: Record<SupportedLanguage, Map<string, string>> | null;
}

// Global store instance
const store: GameDataStore = {
  battleUnits: null,
  battleAbilities: null,
  battleEncounters: null,
  battleConfig: null,
  statusEffects: null,
  statusEffectFamilies: null,
  bossStrikeConfig: null,
  sharedData: null,
  languageData: null,
  parsedUnits: null,
  keyToIdMap: null,
  idToTextMaps: null,
};

// Track if we've already logged initialization (avoid StrictMode double-log)
let hasLoggedInit = false;

// Initialize the store with loaded data
export function initializeGameDataStore(data: {
  battleUnits: Record<string, UnitConfig[]>;
  battleAbilities: Record<string, Ability>;
  battleEncounters: EncountersData;
  battleConfig: any;
  statusEffects: Record<string, any>;
  statusEffectFamilies: Record<string, any>;
  bossStrikeConfig: any;
  sharedData: SharedDataFile;
  languageData: Partial<Record<SupportedLanguage, LocalizedFile>>;
  parsedUnits: ParsedUnit[];
}) {
  store.battleUnits = data.battleUnits;
  store.battleAbilities = data.battleAbilities;
  store.battleEncounters = data.battleEncounters;
  store.battleConfig = data.battleConfig;
  store.statusEffects = data.statusEffects;
  store.statusEffectFamilies = data.statusEffectFamilies;
  store.bossStrikeConfig = data.bossStrikeConfig;
  store.sharedData = data.sharedData;
  store.languageData = data.languageData as Record<SupportedLanguage, LocalizedFile>;
  store.parsedUnits = data.parsedUnits;
  
  // Build lookup maps for localization
  buildLocalizationMaps();
  
  if (!hasLoggedInit) {
    console.log("[GameDataStore] Store initialized with data from Supabase Storage");
    hasLoggedInit = true;
  }
}

// Add language data to existing store (for lazy loading)
export function addLanguageToStore(lang: SupportedLanguage, data: LocalizedFile) {
  if (!store.languageData) {
    store.languageData = {} as Record<SupportedLanguage, LocalizedFile>;
  }
  store.languageData[lang] = data;
  
  // Rebuild the map for this language
  if (store.idToTextMaps) {
    const map = new Map<string, string>();
    data.m_TableData.forEach((entry) => {
      map.set(String(entry.m_Id), entry.m_Localized);
    });
    store.idToTextMaps[lang] = map;
  }
}

function buildLocalizationMaps() {
  if (!store.sharedData || !store.languageData) return;
  
  // Build key to ID map
  store.keyToIdMap = new Map<string, string>();
  store.sharedData.m_Entries.forEach((entry) => {
    store.keyToIdMap!.set(entry.m_Key, String(entry.m_Id));
  });
  
  // Build ID to text maps for each language
  store.idToTextMaps = {} as Record<SupportedLanguage, Map<string, string>>;
  Object.entries(store.languageData).forEach(([lang, file]) => {
    const map = new Map<string, string>();
    file.m_TableData.forEach((entry) => {
      map.set(String(entry.m_Id), entry.m_Localized);
    });
    store.idToTextMaps![lang as SupportedLanguage] = map;
  });
}

// Check if store is initialized
export function isGameDataStoreInitialized(): boolean {
  return store.parsedUnits !== null && store.battleAbilities !== null;
}

// Getters that throw if store not initialized
function assertInitialized() {
  if (!isGameDataStoreInitialized()) {
    throw new Error("GameDataStore not initialized. Make sure GameDataContext has loaded data.");
  }
}

// ===== Units =====
export function getAllUnits(): ParsedUnit[] {
  assertInitialized();
  return store.parsedUnits!;
}

export function getUnitById(id: number): ParsedUnit | undefined {
  assertInitialized();
  return store.parsedUnits!.find(u => u.id === id);
}

export function getAllTags(): number[] {
  assertInitialized();
  const tags = new Set<number>();
  store.parsedUnits!.forEach((unit) => {
    unit.identity.tags.forEach((tag) => tags.add(tag));
  });
  return Array.from(tags).sort((a, b) => a - b);
}

export function getAllSides(): number[] {
  assertInitialized();
  const sides = new Set<number>();
  store.parsedUnits!.forEach((unit) => {
    sides.add(unit.identity.side);
  });
  return Array.from(sides).sort((a, b) => a - b);
}

// ===== Abilities =====
export function getAbilityById(id: number): Ability | undefined {
  assertInitialized();
  return store.battleAbilities![id.toString()];
}

export function getAllAbilities(): Record<string, Ability> {
  assertInitialized();
  return store.battleAbilities!;
}

// ===== Encounters =====
export function getEncounterById(id: number | string): Encounter | undefined {
  assertInitialized();
  return store.battleEncounters!.armies?.[String(id)];
}

export function getAllEncounterIds(): string[] {
  assertInitialized();
  return Object.keys(store.battleEncounters!.armies || {}).sort((a, b) => parseInt(a) - parseInt(b));
}

export function getEncountersData(): EncountersData {
  assertInitialized();
  return store.battleEncounters!;
}

// ===== Battle Config =====
export function getBattleConfig(): any {
  assertInitialized();
  return store.battleConfig!;
}

export function getClassType(classId: number): any | undefined {
  assertInitialized();
  return store.battleConfig?.classes?.class_types?.[classId.toString()];
}

export function getAllClassTypes(): { id: number; classType: any }[] {
  assertInitialized();
  const classTypes = store.battleConfig?.classes?.class_types || {};
  return Object.entries(classTypes).map(([id, classType]) => ({
    id: parseInt(id),
    classType,
  }));
}

// ===== Status Effects =====
export function getStatusEffectsData(): Record<string, any> {
  assertInitialized();
  return store.statusEffects!;
}

export function getStatusEffectFamiliesData(): Record<string, any> {
  assertInitialized();
  return store.statusEffectFamilies!;
}

// ===== Boss Strikes =====
export function getBossStrikeConfigData(): any {
  assertInitialized();
  return store.bossStrikeConfig!;
}

// ===== Localization =====
export function getLocalizedText(key: string, language: SupportedLanguage): string {
  if (!store.keyToIdMap || !store.idToTextMaps) {
    return key; // Return key if not initialized
  }
  
  const id = store.keyToIdMap.get(key);
  if (id === undefined) return key;

  const text = store.idToTextMaps[language]?.get(id);
  if (text) return text;

  // Fallback to English
  const enText = store.idToTextMaps.en?.get(id);
  return enText || key;
}
