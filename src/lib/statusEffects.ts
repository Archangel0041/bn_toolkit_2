import { supabase } from "@/integrations/supabase/client";
import statusEffectFamiliesData from "@/data/status_effect_families.json";
import statusEffectsData from "@/data/status_effects.json";
import { validateFile, sanitizeFilename } from "./uploadValidation";

const BUCKET_NAME = "Art";
const STATUS_PATH = "icons/status_effects";

interface StatusEffectFamily {
  color_hex: string;
  display_name: string;
  effect_icon: string;
  pulse_speed: number;
  sound: string;
  ui_icon: string;
}

interface StatusEffect {
  family: number;
  duration: number;
  status_effect_type: number;
  dot_ability_damage_mult?: number;
  dot_bonus_damage?: number;
  dot_damage_type?: number;
  dot_diminishing?: boolean;
  dot_ap_percent?: number;
  stun_block_action?: boolean;
  stun_block_movement?: boolean;
  stun_damage_break?: boolean;
  // Environmental effect damage modifiers (like firemod)
  stun_damage_mods?: Record<string, number>;
  stun_armor_damage_mods?: Record<string, number>;
}

export type { StatusEffect, StatusEffectFamily };

const families = statusEffectFamiliesData as Record<string, StatusEffectFamily>;
const effects = statusEffectsData as Record<string, StatusEffect>;

// Get family directly by family ID (for immunities which use family IDs)
export function getStatusEffectFamily(familyId: number): StatusEffectFamily | undefined {
  return families[familyId.toString()];
}

// Get status effect by effect ID, then resolve to family
export function getStatusEffect(effectId: number): StatusEffect | undefined {
  return effects[effectId.toString()];
}

// Get family from a status effect ID (for abilities which use effect IDs)
export function getFamilyFromEffectId(effectId: number): StatusEffectFamily | undefined {
  const effect = getStatusEffect(effectId);
  if (!effect) return undefined;
  return getStatusEffectFamily(effect.family);
}

// Direct translations for status effects - bypasses the localization system
// which has issues with large numeric IDs losing precision in JavaScript
const STATUS_EFFECT_NAMES: Record<string, string> = {
  se_stun: "Stun",
  se_poison: "Poison",
  se_frozen: "Frozen",
  se_plague: "Plague",
  se_fire: "Fire",
  se_flammable: "Flammable",
  se_breach: "Breach",
  se_shell: "Shell",
  se_cold: "Cold",
  se_shatter: "Shatter",
  se_quake: "Quake",
};

// For immunities (which use family IDs directly)
// Returns the translated name directly instead of the key
export function getStatusEffectDisplayName(familyId: number): string {
  const family = getStatusEffectFamily(familyId);
  if (!family) return `Effect #${familyId}`;
  return STATUS_EFFECT_NAMES[family.display_name] || family.display_name;
}

// For abilities (which use effect IDs that need to be resolved to families)
// Returns the translated name directly
export function getEffectDisplayNameTranslated(effectId: number): string {
  const family = getFamilyFromEffectId(effectId);
  if (!family) return `Effect #${effectId}`;
  return STATUS_EFFECT_NAMES[family.display_name] || family.display_name;
}

export function getStatusEffectColor(familyId: number): string {
  const family = getStatusEffectFamily(familyId);
  return family?.color_hex ? `#${family.color_hex}` : "#888888";
}

export function getStatusEffectIconUrl(familyId: number): string | null {
  const family = getStatusEffectFamily(familyId);
  if (!family?.ui_icon) return null;

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${STATUS_PATH}/${family.ui_icon}.png`);

  return data.publicUrl;
}

// For abilities (which use effect IDs that need to be resolved to families)
export function getEffectDisplayName(effectId: number): string {
  const family = getFamilyFromEffectId(effectId);
  return family?.display_name || `Effect #${effectId}`;
}

export function getEffectColor(effectId: number): string {
  const family = getFamilyFromEffectId(effectId);
  return family?.color_hex ? `#${family.color_hex}` : "#888888";
}

export function getEffectIconUrl(effectId: number): string | null {
  const family = getFamilyFromEffectId(effectId);
  if (!family?.ui_icon) return null;

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${STATUS_PATH}/${family.ui_icon}.png`);

  return data.publicUrl;
}

export function getEffectDuration(effectId: number): number {
  const effect = getStatusEffect(effectId);
  return effect?.duration || 0;
}

export function getAllStatusEffectFamilies(): { id: number; family: StatusEffectFamily }[] {
  return Object.entries(families).map(([id, family]) => ({
    id: parseInt(id),
    family,
  }));
}

export async function uploadMultipleStatusImages(
  files: FileList,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      results.failed++;
      results.errors.push(validation.error || `Invalid file: ${file.name}`);
      continue;
    }

    const iconName = file.name.replace(/\.(png|jpg|jpeg|webp|gif)$/i, "");
    const sanitizedName = sanitizeFilename(`${STATUS_PATH}/${iconName}.png`);

    onProgress?.(i + 1, files.length, file.name);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(sanitizedName, file, { upsert: true });

    if (error) {
      results.failed++;
      results.errors.push(`${file.name}: ${error.message}`);
    } else {
      results.success++;
    }
  }

  return results;
}

export async function listUploadedStatusImages(): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(STATUS_PATH);

  if (error || !data) return [];

  return data.map((file) => file.name.replace(/\.png$/, ""));
}
