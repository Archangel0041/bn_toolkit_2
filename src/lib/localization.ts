import type { SupportedLanguage, LocalizedFile, SharedDataFile } from "@/types/units";

// Import all language files
import sharedData from "@/data/GameText_Shared_Data.json";
import enData from "@/data/GameText_en.json";
import deData from "@/data/GameText_de.json";
import esData from "@/data/GameText_es.json";
import frData from "@/data/GameText_fr.json";
import itData from "@/data/GameText_it.json";
import jaData from "@/data/GameText_ja.json";
import koData from "@/data/GameText_ko.json";
import ruData from "@/data/GameText_ru.json";
import zhHansData from "@/data/GameText_zh-Hans.json";
import zhHantData from "@/data/GameText_zh-Hant.json";

const shared = sharedData as unknown as SharedDataFile;

const languageFiles: Record<SupportedLanguage, LocalizedFile> = {
  en: enData as unknown as LocalizedFile,
  de: deData as unknown as LocalizedFile,
  es: esData as unknown as LocalizedFile,
  fr: frData as unknown as LocalizedFile,
  it: itData as unknown as LocalizedFile,
  ja: jaData as unknown as LocalizedFile,
  ko: koData as unknown as LocalizedFile,
  ru: ruData as unknown as LocalizedFile,
  "zh-Hans": zhHansData as unknown as LocalizedFile,
  "zh-Hant": zhHantData as unknown as LocalizedFile,
};

// Build lookup maps for performance
// Use string keys because IDs exceed Number.MAX_SAFE_INTEGER and lose precision as numbers
const keyToIdMap = new Map<string, string>();
shared.m_Entries.forEach((entry) => {
  // Convert ID to string to preserve precision for large numbers
  keyToIdMap.set(entry.m_Key, String(entry.m_Id));
});

const idToTextMaps: Record<SupportedLanguage, Map<string, string>> = {} as Record<SupportedLanguage, Map<string, string>>;

Object.entries(languageFiles).forEach(([lang, file]) => {
  const map = new Map<string, string>();
  file.m_TableData.forEach((entry) => {
    map.set(String(entry.m_Id), entry.m_Localized);
  });
  idToTextMaps[lang as SupportedLanguage] = map;
});

export function getLocalizedText(key: string, language: SupportedLanguage): string {
  const id = keyToIdMap.get(key);
  if (id === undefined) return key;

  const text = idToTextMaps[language]?.get(id);
  if (text) return text;

  // Fallback to English
  const enText = idToTextMaps.en?.get(id);
  return enText || key;
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
