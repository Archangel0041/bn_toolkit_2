import { supabase } from "@/integrations/supabase/client";
import { getStatusEffectsData, getStatusEffectFamiliesData } from "@/lib/gameDataStore";

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

// Get family directly by family ID (for immunities which use family IDs)
export function getStatusEffectFamily(familyId: number): StatusEffectFamily | undefined {
  const families = getStatusEffectFamiliesData();
  return families[familyId.toString()] as StatusEffectFamily | undefined;
}

// Get status effect by effect ID, then resolve to family
export function getStatusEffect(effectId: number): StatusEffect | undefined {
  const effects = getStatusEffectsData();
  return effects[effectId.toString()] as StatusEffect | undefined;
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
  const families = getStatusEffectFamiliesData();
  return Object.entries(families).map(([id, family]) => ({
    id: parseInt(id),
    family: family as StatusEffectFamily,
  }));
}
