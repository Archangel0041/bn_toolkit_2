import { supabase } from "@/integrations/supabase/client";

const BUCKET_NAME = "Art";
const RESOURCE_PATH = "icons/bn_resources";
const REWARD_PATH = "icons/rewards";
const MENU_BG_PATH = "icons/boss_strikes";
const ENCOUNTER_PATH = "icons/encounters";
const MISSION_PATH = "icons/missions";
const NPC_PATH = "icons/npcs";

export function getResourceIconUrl(resourceKey: string): string {
  const fileName = `resource_${resourceKey}.png`;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(`${RESOURCE_PATH}/${fileName}`);
  return data.publicUrl;
}

export function getEventRewardIconUrl(rewardImage: string): string {
  // Remove trailing period if exists and add .png
  const cleanName = rewardImage.replace(/\.$/, '');
  const fileName = `${cleanName}.png`;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(`${REWARD_PATH}/${fileName}`);
  return data.publicUrl;
}

export function getMenuBackgroundUrl(backgroundKey: string): string {
  // Handle cases where extension may or may not be included
  const fileName = backgroundKey.endsWith('.png') ? backgroundKey : `${backgroundKey}.png`;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(`${MENU_BG_PATH}/${fileName}`);
  return data.publicUrl;
}

// Common icon mappings from encounter icon field to actual file names
const encounterIconMappings: Record<string, string> = {
  "raider": "encounter_raider_event_boss_icon",
  "rebel_avatar": "encounter_rebel_event_boss_icon",
  "infected": "challenge_encounter_infected_icon",
  "silverwolves": "challenge_encounter_silver_wolves_icon",
  "rebel": "challenge_encounter_rebel_icon",
  "grouper": "encounter_grouper_icon",
  "raptor": "land_encounter_raptor",
  "boar": "land_encounter_boar",
  "mammoth": "land_encounter_mammoth",
  "spider_wasp": "encounter_spider_wasp_icon",
  "kraken": "encounter_kraken_icon",
  "gantas": "gantas",
};

export function getEncounterIconUrl(iconKey: string): string {
  // Check if we have a mapping for this icon
  const mappedIcon = encounterIconMappings[iconKey.toLowerCase()];
  const fileName = mappedIcon
    ? `${mappedIcon}.png`
    : iconKey.endsWith('.png') ? iconKey : `${iconKey}.png`;

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(`${ENCOUNTER_PATH}/${fileName}`);
  return data.publicUrl;
}

export function getMissionIconUrl(iconKey: string): string {
  const fileName = `${iconKey}.png`;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(`${MISSION_PATH}/${fileName}`);
  return data.publicUrl;
}

export function getNpcIconUrl(iconKey: string): string {
  const fileName = iconKey.endsWith('.png') ? iconKey : `${iconKey}.png`;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(`${NPC_PATH}/${fileName}`);
  return data.publicUrl;
}
