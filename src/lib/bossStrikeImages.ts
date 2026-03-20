import { getBossStrikeById } from "@/lib/bossStrikes";
import { getMenuBackgroundUrl } from "@/lib/resourceImages";
import { useLanguage } from "@/contexts/LanguageContext";

// ID-based mappings for ARCHIVED boss strike backgrounds (static, since archived data is bundled)
const archivedIdToBackground: Record<string, string> = {
  "1": "/boss-strike-images/boss_strike_mad_scientist_1136x640.png",
  "2": "/boss-strike-images/boss_strike_mad_scientist_1136x640.png",
  "3": "/boss-strike-images/navy_boss_strike1136x640.png",
  "4": "/boss-strike-images/navy_boss_strike1136x640.png",
  "13": "/boss-strike-images/navy_boss_strike1136x640.png",
  "14": "/boss-strike-images/navy_boss_strike1136x640.png",
  "25": "/boss-strike-images/navy_boss_strike1136x640.png",
  "5": "/boss-strike-images/boss_animal_raider_1136x640.png",
  "6": "/boss-strike-images/boss_animal_raider_1136x640.png",
  "9": "/boss-strike-images/boss_animal_raider_1136x640.png",
  "10": "/boss-strike-images/boss_animal_raider_1136x640.png",
  "20": "/boss-strike-images/boss_animal_raider_1136x640.png",
  "24": "/boss-strike-images/boss_animal_raider_1136x640.png",
  "15": "/boss-strike-images/boss_rebel_girl_pilot_1136x640.png",
  "16": "/boss-strike-images/boss_rebel_girl_pilot_1136x640.png",
  "19": "/boss-strike-images/boss_rebel_girl_pilot_1136x640.png",
  "17": "/boss-strike-images/boss_rebel_tanks_1136x640.png",
  "18": "/boss-strike-images/boss_rebel_tanks_1136x640.png",
  "28": "/boss-strike-images/boss_rebel_tanks_1136x640.png",
  "29": "/boss-strike-images/boss_rebel_tanks_1136x640.png",
  "7": "/boss-strike-images/boss_strike7.png",
  "8": "/boss-strike-images/boss_strike7.png",
  "11": "/boss-strike-images/infected_boss_strike_illustration_1136x640.png",
  "12": "/boss-strike-images/infected_boss_strike_illustration_1136x640.png",
  "23": "/boss-strike-images/infected_boss_strike_illustration_1136x640.png",
  "26": "/boss-strike-images/raider_bosses_boss_strike1136x640.png",
  "27": "/boss-strike-images/raider_bosses_boss_strike1136x640.png",
  "21": "/boss-strike-images/raider_bosses_boss_strike1136x640.png",
  "22": "/boss-strike-images/raider_bosses_boss_strike1136x640.png",
};

// ID-based mappings for ARCHIVED boss strike names (static)
const archivedIdToName: Record<string, string> = {
  "1": "Dr. Vogel",
  "2": "Dr. Vogel",
  "3": "Sovereign Forces",
  "4": "Sovereign Forces",
  "13": "Sovereign Forces",
  "14": "Sovereign Forces",
  "25": "Sovereign Forces",
  "5": "Yuzul the Raptor Trainer",
  "6": "Yuzul the Raptor Trainer",
  "9": "Yuzul the Raptor Trainer",
  "10": "Yuzul the Raptor Trainer",
  "20": "Yuzul the Raptor Trainer",
  "24": "Yuzul the Raptor Trainer",
  "15": "Rebel Pilot Evaline Acehart",
  "16": "Rebel Pilot Evaline Acehart",
  "19": "Rebel Pilot Evaline Acehart",
  "17": "Sergeant Ludlow",
  "18": "Sergeant Ludlow",
  "28": "Sergeant Ludlow",
  "29": "Sergeant Ludlow",
  "7": "Enforcer Shrow",
  "8": "Enforcer Shrow",
  "11": "Infected Troops",
  "12": "Infected Troops",
  "23": "Infected Troops",
  "26": "Shaman Kuros' Army",
  "27": "Shaman Kuros' Army",
  "21": "Raiders",
  "22": "Raiders",
};

/**
 * Get boss strike background image URL.
 * For current boss strikes, reads ui_config.menu_bg from the config data.
 * For archived, uses the static mapping.
 */
export function getBossStrikeBackgroundById(id: string | number, archived = false): string | null {
  const strId = String(id);

  if (archived) {
    return archivedIdToBackground[strId] || null;
  }

  // For current boss strikes, read from the config's ui_config
  const bossStrike = getBossStrikeById(strId, false);
  if (bossStrike?.ui_config?.menu_bg) {
    return getMenuBackgroundUrl(bossStrike.ui_config.menu_bg);
  }

  // Fallback to archived mapping
  return archivedIdToBackground[strId] || null;
}

/**
 * Get boss strike display name.
 * For current boss strikes, returns the ui_config.event_title localization key.
 * For archived, uses the static mapping.
 * Returns null if no name found (caller should use encounter name or fallback).
 */
export function getBossStrikeNameById(id: string | number, archived = false): string | null {
  const strId = String(id);

  if (archived) {
    return archivedIdToName[strId] || null;
  }

  // For current boss strikes, return the event_title localization key
  // The caller (component) is responsible for translating via t()
  const bossStrike = getBossStrikeById(strId, false);
  if (bossStrike?.ui_config?.event_title) {
    return bossStrike.ui_config.event_title;
  }

  // Fallback to archived mapping
  return archivedIdToName[strId] || null;
}

// Legacy functions kept for compatibility
export function getBossStrikeBackgroundFromMissionIcon(missionIcon?: string): string | null {
  return null;
}

export function getBossStrikeFallbackName(missionIcon?: string): string | null {
  return null;
}

export function getBossStrikeBackgroundUrl(bossStrikeId: string): string | null {
  return getBossStrikeBackgroundById(bossStrikeId);
}
