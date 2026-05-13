/**
 * Game Data Context - Provides loaded game data to the entire app
 * 
 * This context handles loading data from Supabase Storage and makes it
 * available synchronously throughout the app after initial load.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  loadBattleUnits,
  loadBattleAbilities,
  loadBattleEncounters,
  loadBattleConfig,
  loadStatusEffects,
  loadStatusEffectFamilies,
  loadBossStrikeConfig,
  loadGameTextSharedData,
  loadGameTextLanguage,
  clearDataCache,
  getCoreDataFromMemory,
  getLanguageDataFromMemory,
} from "@/lib/dataLoader";
import { initializeGameDataStore, isGameDataStoreInitialized, addLanguageToStore } from "@/lib/gameDataStore";
import { requestPersistentStorage, getStorageQuota } from "@/lib/cacheStorage";
import type { Ability } from "@/lib/abilities";
import type { ParsedUnit, UnitConfig, IdentityConfig, AnimationConfig, StatsConfig, RequirementsConfig, HealingConfig, WeaponsConfig, SharedDataFile, LocalizedFile, SupportedLanguage } from "@/types/units";
import type { EncountersData } from "@/types/encounters";

interface GameData {
  // Battle data
  battleUnits: Record<string, UnitConfig[]>;
  battleAbilities: Record<string, Ability>;
  battleEncounters: EncountersData;
  battleConfig: any;
  
  // Status effects
  statusEffects: Record<string, any>;
  statusEffectFamilies: Record<string, any>;
  
  // Boss strikes
  bossStrikeConfig: any;
  
  // Localizations - now lazy loaded
  sharedData: SharedDataFile;
  languageData: Partial<Record<SupportedLanguage, LocalizedFile>>;
  
  // Parsed units (computed from battleUnits)
  parsedUnits: ParsedUnit[];
}

// Get initial language from localStorage or browser
function getInitialLanguage(): SupportedLanguage {
  const stored = localStorage.getItem("battle-units-language");
  if (stored && ["en", "de", "es", "fr", "it", "ja", "ko", "ru", "zh-Hans", "zh-Hant"].includes(stored)) {
    return stored as SupportedLanguage;
  }
  // Simple browser language detection
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("de")) return "de";
  if (browserLang.startsWith("es")) return "es";
  if (browserLang.startsWith("fr")) return "fr";
  if (browserLang.startsWith("it")) return "it";
  if (browserLang.startsWith("ja")) return "ja";
  if (browserLang.startsWith("ko")) return "ko";
  if (browserLang.startsWith("ru")) return "ru";
  if (browserLang === "zh-tw" || browserLang === "zh-hant") return "zh-Hant";
  if (browserLang.startsWith("zh")) return "zh-Hans";
  return "en";
}

interface GameDataContextType {
  data: GameData | null;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  loadProgress: number;
  reload: () => Promise<void>;
  loadLanguage: (lang: SupportedLanguage) => Promise<void>;
  
  // Convenience accessors (these throw if data not loaded)
  getUnitById: (id: number) => ParsedUnit | undefined;
  getAbilityById: (id: number) => Ability | undefined;
  getEncounterById: (id: number | string) => any | undefined;
  getAllUnits: () => ParsedUnit[];
  getAllAbilities: () => Record<string, Ability>;
}

const GameDataContext = createContext<GameDataContextType | undefined>(undefined);

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "de", "es", "fr", "it", "ja", "ko", "ru", "zh-Hans", "zh-Hant"];

function parseUnit(id: string, configs: UnitConfig[]): ParsedUnit {
  const identity = configs.find((c) => c._t === "battle_unit_identity_config") as IdentityConfig;

  // Inject manual icon override (sentinel name resolved by getUnitImageUrl).
  const numericId = parseInt(id);
  if (identity && UNIT_ICON_OVERRIDES[numericId]) {
    identity.icon = makeOverrideSentinel(numericId);
  }

  const unit: ParsedUnit = {
    id: numericId,
    identity,
  };

  unit.animation = configs.find((c) => c._t === "battle_unit_animation_config") as AnimationConfig | undefined;
  unit.statsConfig = configs.find((c) => c._t === "battle_unit_stats_config") as StatsConfig | undefined;
  unit.requirements = configs.find((c) => c._t === "battle_unit_requirements_config") as RequirementsConfig | undefined;
  unit.healing = configs.find((c) => c._t === "battle_unit_healing_config") as HealingConfig | undefined;
  unit.weapons = configs.find((c) => c._t === "battle_unit_weapons_config") as WeaponsConfig | undefined;

  return unit;
}

interface GameDataProviderProps {
  children: ReactNode;
}

export function GameDataProvider({ children }: GameDataProviderProps) {
  const [data, setData] = useState<GameData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);

  // Try to restore from memory cache synchronously on mount
  const tryRestoreFromMemory = useCallback((): boolean => {
    const coreData = getCoreDataFromMemory();
    if (!coreData) return false;
    
    // Only require the initial language + English fallback
    const initialLang = getInitialLanguage();
    const languageData: Partial<Record<SupportedLanguage, LocalizedFile>> = {};
    
    const initialLangData = getLanguageDataFromMemory(initialLang);
    if (!initialLangData) return false;
    languageData[initialLang] = initialLangData;
    
    // Also check for English fallback
    if (initialLang !== "en") {
      const enData = getLanguageDataFromMemory("en");
      if (enData) languageData.en = enData;
    }
    
    // Parse units
    const parsedUnits = Object.entries(coreData.battleUnits).map(([id, configs]) => 
      parseUnit(id, configs as UnitConfig[])
    );
    
    const gameData: GameData = {
      battleUnits: coreData.battleUnits,
      battleAbilities: coreData.battleAbilities,
      battleEncounters: coreData.battleEncounters,
      battleConfig: coreData.battleConfig,
      statusEffects: coreData.statusEffects,
      statusEffectFamilies: coreData.statusEffectFamilies,
      bossStrikeConfig: { boss_strikes: {} }, // Will be loaded async
      sharedData: coreData.sharedData,
      languageData,
      parsedUnits,
    };
    
    // Initialize store if not already
    if (!isGameDataStoreInitialized()) {
      initializeGameDataStore(gameData);
    }
    
    setData(gameData);
    setIsLoading(false);
    setLoadProgress(100);
    console.log("[GameDataContext] Restored from memory cache instantly");
    return true;
  }, []);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLoadProgress(0);

    try {
      // Request persistent storage to prevent cache eviction
      requestPersistentStorage().then(async (granted) => {
        if (granted) {
          const quota = await getStorageQuota();
          if (quota) {
            console.log(`[Cache] Storage: ${(quota.usage / 1024 / 1024).toFixed(1)}MB / ${(quota.quota / 1024 / 1024).toFixed(0)}MB (${quota.usagePercent}%), persistent: ${quota.persistent}`);
          }
        }
      });

      // Load core battle data first (most critical)
      setLoadProgress(10);
      const [battleUnits, battleAbilities, battleEncounters, battleConfig] = await Promise.all([
        loadBattleUnits(),
        loadBattleAbilities(),
        loadBattleEncounters(),
        loadBattleConfig(),
      ]);
      
      setLoadProgress(40);
      
      // Load status effects and boss strikes
      const [statusEffects, statusEffectFamilies, bossStrikeConfig] = await Promise.all([
        loadStatusEffects(),
        loadStatusEffectFamilies(),
        loadBossStrikeConfig().catch(() => ({ boss_strikes: {} })), // Optional
      ]);
      
      setLoadProgress(60);
      
      // Load shared localization data + initial language only
      const initialLang = getInitialLanguage();
      const [sharedData, initialLangData] = await Promise.all([
        loadGameTextSharedData(),
        loadGameTextLanguage(initialLang),
      ]);
      
      // Also load English as fallback if not already the initial language
      let languageData: Partial<Record<SupportedLanguage, LocalizedFile>> = {
        [initialLang]: initialLangData,
      };
      
      if (initialLang !== "en") {
        try {
          const enData = await loadGameTextLanguage("en");
          languageData.en = enData;
        } catch (err) {
          console.warn("Failed to load English fallback:", err);
        }
      }
      
      setLoadProgress(90);
      
      // Parse units
      const parsedUnits = Object.entries(battleUnits).map(([id, configs]) => 
        parseUnit(id, configs as UnitConfig[])
      );
      
      setLoadProgress(100);
      
      const gameData: GameData = {
        battleUnits,
        battleAbilities,
        battleEncounters,
        battleConfig,
        statusEffects,
        statusEffectFamilies,
        bossStrikeConfig,
        sharedData,
        languageData,
        parsedUnits,
      };
      
      // Initialize the global store for synchronous access
      initializeGameDataStore(gameData);
      
      setData(gameData);
      
      console.log("[GameDataContext] All game data loaded successfully");
    } catch (err) {
      console.error("[GameDataContext] Failed to load game data:", err);
      setError(err instanceof Error ? err.message : "Failed to load game data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data on mount - try memory first
  useEffect(() => {
    // Try instant restore from memory cache first
    if (!tryRestoreFromMemory()) {
      loadAllData();
    }
  }, [loadAllData, tryRestoreFromMemory]);

  // Convenience accessors
  const getUnitById = useCallback((id: number): ParsedUnit | undefined => {
    return data?.parsedUnits.find(u => u.id === id);
  }, [data]);

  const getAbilityById = useCallback((id: number): Ability | undefined => {
    return data?.battleAbilities[id.toString()];
  }, [data]);

  const getEncounterById = useCallback((id: number | string): any | undefined => {
    return data?.battleEncounters?.armies?.[String(id)];
  }, [data]);

  const getAllUnits = useCallback((): ParsedUnit[] => {
    return data?.parsedUnits || [];
  }, [data]);

  const getAllAbilities = useCallback((): Record<string, Ability> => {
    return data?.battleAbilities || {};
  }, [data]);

  const reload = useCallback(async () => {
    await clearDataCache();
    await loadAllData();
  }, [loadAllData]);

  // Lazy load additional languages
  const loadLanguage = useCallback(async (lang: SupportedLanguage) => {
    if (!data) return;
    if (data.languageData[lang]) return; // Already loaded
    
    try {
      console.log(`[GameDataContext] Lazy loading language: ${lang}`);
      const langData = await loadGameTextLanguage(lang);
      
      // Update state
      setData(prev => prev ? {
        ...prev,
        languageData: { ...prev.languageData, [lang]: langData }
      } : null);
      
      // Update store
      addLanguageToStore(lang, langData);
    } catch (err) {
      console.warn(`Failed to load language ${lang}:`, err);
    }
  }, [data]);

  const isLoaded = data !== null && !isLoading;

  return (
    <GameDataContext.Provider
      value={{
        data,
        isLoading,
        isLoaded,
        error,
        loadProgress,
        reload,
        loadLanguage,
        getUnitById,
        getAbilityById,
        getEncounterById,
        getAllUnits,
        getAllAbilities,
      }}
    >
      {children}
    </GameDataContext.Provider>
  );
}

// Default fallback for HMR edge cases
const defaultContext: GameDataContextType = {
  data: null,
  isLoading: true,
  isLoaded: false,
  error: null,
  loadProgress: 0,
  reload: async () => {},
  loadLanguage: async () => {},
  getUnitById: () => undefined,
  getAbilityById: () => undefined,
  getEncounterById: () => undefined,
  getAllUnits: () => [],
  getAllAbilities: () => ({}),
};
export function useGameData() {
  const context = useContext(GameDataContext);
  // Return default loading state during HMR transitions instead of throwing
  if (context === undefined) {
    console.warn("[useGameData] Context undefined - returning loading state (likely HMR transition)");
    return defaultContext;
  }
  return context;
}

// Hook that waits for data to be loaded
export function useGameDataRequired() {
  const { data, isLoading, error } = useGameData();
  
  if (isLoading) {
    throw new Promise(() => {}); // Suspend for React Suspense
  }
  
  if (error) {
    throw new Error(error);
  }
  
  if (!data) {
    throw new Error("Game data not loaded");
  }
  
  return data;
}
