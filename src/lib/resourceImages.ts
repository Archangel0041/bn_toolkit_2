import { supabase } from "@/integrations/supabase/client";
import { validateFile, sanitizeFilename } from "./uploadValidation";

const BUCKET_NAME = "Art";
const RESOURCE_PATH = "icons/bn_resources";
const REWARD_PATH = "icons/rewards";
const MENU_BG_PATH = "icons/boss_strikes";
const ENCOUNTER_PATH = "icons/encounters";
const MISSION_PATH = "icons/missions";

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

export async function uploadMultipleResourceIcons(
  files: FileList,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      failed++;
      errors.push(validation.error || `Invalid file: ${file.name}`);
      continue;
    }

    const sanitizedName = sanitizeFilename(`${RESOURCE_PATH}/${file.name}`);
    onProgress?.(i + 1, total, file.name);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(sanitizedName, file, { upsert: true });

    if (error) {
      failed++;
      errors.push(`${file.name}: ${error.message}`);
    } else {
      success++;
    }
  }

  return { success, failed, errors };
}

export async function uploadMultipleEventRewardIcons(
  files: FileList,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      failed++;
      errors.push(validation.error || `Invalid file: ${file.name}`);
      continue;
    }

    const sanitizedName = sanitizeFilename(`${REWARD_PATH}/${file.name}`);
    onProgress?.(i + 1, total, file.name);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(sanitizedName, file, { upsert: true });

    if (error) {
      failed++;
      errors.push(`${file.name}: ${error.message}`);
    } else {
      success++;
    }
  }

  return { success, failed, errors };
}

export async function uploadMultipleMenuBackgrounds(
  files: FileList,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      failed++;
      errors.push(validation.error || `Invalid file: ${file.name}`);
      continue;
    }

    const sanitizedName = sanitizeFilename(`${MENU_BG_PATH}/${file.name}`);
    onProgress?.(i + 1, total, file.name);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(sanitizedName, file, { upsert: true });

    if (error) {
      failed++;
      errors.push(`${file.name}: ${error.message}`);
    } else {
      success++;
    }
  }

  return { success, failed, errors };
}

export async function listResourceIcons(): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(RESOURCE_PATH);
  if (error || !data) return [];
  return data.map(f => f.name);
}

export async function listEventRewardIcons(): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(REWARD_PATH);
  if (error || !data) return [];
  return data.map(f => f.name);
}

export async function listMenuBackgrounds(): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(MENU_BG_PATH);
  if (error || !data) return [];
  return data.map(f => f.name);
}

export async function uploadMultipleEncounterIcons(
  files: FileList,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      failed++;
      errors.push(validation.error || `Invalid file: ${file.name}`);
      continue;
    }

    const sanitizedName = sanitizeFilename(`${ENCOUNTER_PATH}/${file.name}`);
    onProgress?.(i + 1, total, file.name);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(sanitizedName, file, { upsert: true });

    if (error) {
      failed++;
      errors.push(`${file.name}: ${error.message}`);
    } else {
      success++;
    }
  }

  return { success, failed, errors };
}

export async function uploadMultipleMissionIcons(
  files: FileList,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      failed++;
      errors.push(validation.error || `Invalid file: ${file.name}`);
      continue;
    }

    const sanitizedName = sanitizeFilename(`${MISSION_PATH}/${file.name}`);
    onProgress?.(i + 1, total, file.name);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(sanitizedName, file, { upsert: true });

    if (error) {
      failed++;
      errors.push(`${file.name}: ${error.message}`);
    } else {
      success++;
    }
  }

  return { success, failed, errors };
}

export async function listEncounterIcons(): Promise<string[]> {
  const { data, error} = await supabase.storage.from(BUCKET_NAME).list(ENCOUNTER_PATH);
  if (error || !data) return [];
  return data.map(f => f.name);
}

export async function listMissionIcons(): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(MISSION_PATH);
  if (error || !data) return [];
  return data.map(f => f.name);
}
