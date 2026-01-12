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
} from "@/lib/dataLoader";
import { initializeGameDataStore } from "@/lib/gameDataStore";
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
  
  // Localizations
  sharedData: SharedDataFile;
  languageData: Record<SupportedLanguage, LocalizedFile>;
  
  // Parsed units (computed from battleUnits)
  parsedUnits: ParsedUnit[];
}

interface GameDataContextType {
  data: GameData | null;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  loadProgress: number;
  reload: () => Promise<void>;
  
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
  const unit: ParsedUnit = {
    id: parseInt(id),
    identity: configs.find((c) => c._t === "battle_unit_identity_config") as IdentityConfig,
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

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLoadProgress(0);

    try {
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
      
      // Load shared localization data
      const sharedData = await loadGameTextSharedData();
      
      setLoadProgress(70);
      
      // Load all language files in parallel
      const languagePromises = SUPPORTED_LANGUAGES.map(async (lang) => {
        try {
          const langData = await loadGameTextLanguage(lang);
          return [lang, langData] as const;
        } catch (err) {
          console.warn(`Failed to load language ${lang}:`, err);
          return [lang, { m_Name: lang, m_LocaleId: { m_Code: lang }, m_TableData: [] }] as const;
        }
      });
      
      const languageResults = await Promise.all(languagePromises);
      const languageData = Object.fromEntries(languageResults) as Record<SupportedLanguage, LocalizedFile>;
      
      setLoadProgress(90);
      
      // Parse units
      const parsedUnits = Object.entries(battleUnits).map(([id, configs]) => 
        parseUnit(id, configs as UnitConfig[])
      );
      
      setLoadProgress(100);
      
      const gameData = {
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

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

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

export function useGameData() {
  const context = useContext(GameDataContext);
  if (context === undefined) {
    throw new Error("useGameData must be used within a GameDataProvider");
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
