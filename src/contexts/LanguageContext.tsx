import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { SupportedLanguage } from "@/types/units";
import { detectBrowserLanguage, getLocalizedText } from "@/lib/localization";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
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

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  const t = (key: string) => getLocalizedText(key, language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
