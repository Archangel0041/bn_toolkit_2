import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { SupportedLanguage } from "@/types/units";
import { detectBrowserLanguage, getLocalizedText } from "@/lib/localization";
import { loadGameTextLanguage } from "@/lib/dataLoader";
import { addLanguageToStore } from "@/lib/gameDataStore";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
  isLanguageLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "battle-units-language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ["en", "de", "es", "fr", "it", "ja", "ko", "ru", "zh-Hans", "zh-Hant"].includes(stored)) {
      return stored as SupportedLanguage;
    }
    return detectBrowserLanguage();
  });
  const [isLanguageLoading, setIsLanguageLoading] = useState(false);

  // Lazy load language data when language changes
  const loadLanguageData = useCallback(async (lang: SupportedLanguage) => {
    setIsLanguageLoading(true);
    try {
      const langData = await loadGameTextLanguage(lang);
      addLanguageToStore(lang, langData);
    } catch (err) {
      console.warn(`Failed to load language ${lang}:`, err);
    } finally {
      setIsLanguageLoading(false);
    }
  }, []);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    // Trigger lazy load
    loadLanguageData(lang);
  }, [loadLanguageData]);

  const t = (key: string) => getLocalizedText(key, language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isLanguageLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
