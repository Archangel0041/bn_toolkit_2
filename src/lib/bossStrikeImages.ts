// ID-based mappings for CURRENT boss strike backgrounds
const currentIdToBackground: Record<string, string> = {
  "1": "/boss-strike-images/boss_animal_raider_1136x640.png",
};

// ID-based mappings for CURRENT boss strike names
const currentIdToName: Record<string, string> = {
  "1": "Yuzul the Raptor Trainer",
};

// ID-based mappings for ARCHIVED boss strike backgrounds
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

// ID-based mappings for ARCHIVED boss strike names
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

export function getBossStrikeBackgroundById(id: string | number, archived = false): string | null {
  const map = archived ? archivedIdToBackground : currentIdToBackground;
  // Fall back to archived if not found in current
  return map[String(id)] || archivedIdToBackground[String(id)] || null;
}

export function getBossStrikeNameById(id: string | number, archived = false): string | null {
  const map = archived ? archivedIdToName : currentIdToName;
  // Fall back to archived if not found in current
  return map[String(id)] || archivedIdToName[String(id)] || null;
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
