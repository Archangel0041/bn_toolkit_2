/**
 * Localization - Text translation helpers
 * 
 * Uses game data from the global store (loaded from Supabase Storage)
 */

import type { SupportedLanguage } from "@/types/units";
import { getLocalizedText as getLocalizedTextFromStore } from "@/lib/gameDataStore";

export function getLocalizedText(key: string, language: SupportedLanguage): string {
  return getLocalizedTextFromStore(key, language);
}

export function detectBrowserLanguage(): SupportedLanguage {
  const browserLang = navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage || "en";
  const langCode = browserLang.toLowerCase();

  if (langCode.startsWith("zh-hans") || langCode === "zh-cn") return "zh-Hans";
  if (langCode.startsWith("zh-hant") || langCode === "zh-tw" || langCode === "zh-hk") return "zh-Hant";
  if (langCode.startsWith("de")) return "de";
  if (langCode.startsWith("es")) return "es";
  if (langCode.startsWith("fr")) return "fr";
  if (langCode.startsWith("it")) return "it";
  if (langCode.startsWith("ja")) return "ja";
  if (langCode.startsWith("ko")) return "ko";
  if (langCode.startsWith("ru")) return "ru";
  if (langCode.startsWith("zh")) return "zh-Hans";

  return "en";
}

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  ru: "Русский",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
};

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  "en", "de", "es", "fr", "it", "ja", "ko", "ru", "zh-Hans", "zh-Hant"
];
