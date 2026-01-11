import { supabase } from "@/integrations/supabase/client";

const BUCKET_NAME = "Art";
const UI_PATH = "ui";

// Damage type ID to icon name mapping
const DAMAGE_TYPE_ICONS: Record<number, string> = {
  1: "damage_bullet",      // Piercing/Bullet
  2: "damage_cold",        // Cold
  3: "damage_crushing",    // Crushing
  4: "damage_shell",       // Explosive/Shell
  5: "damage_fire",        // Fire
  6: "damage_torpedo",     // Torpedo
};

// Resistance type to icon name mapping
const RESISTANCE_ICONS: Record<string, { normal: string; resistant: string; vulnerable: string }> = {
  cold: { normal: "damage_cold", resistant: "damage_cold_resistant", vulnerable: "damage_cold_vulnerable" },
  crushing: { normal: "damage_melee", resistant: "damage_melee_resistant", vulnerable: "damage_melee_vulnerable" },
  explosive: { normal: "damage_shell", resistant: "damage_shell_resistant", vulnerable: "damage_shell_vulnerable" },
  fire: { normal: "damage_fire", resistant: "damage_fire_resistant", vulnerable: "damage_fire_vulnerable" },
  piercing: { normal: "damage_bullet", resistant: "damage_bullet_resistant", vulnerable: "damage_bullet_vulnerable" },
};

export function getDamageTypeName(damageType: number): string {
  const names: Record<number, string> = {
    1: "Bullet",
    2: "Cold",
    3: "Crushing",
    4: "Explosive",
    5: "Fire",
    6: "Torpedo",
  };
  return names[damageType] || `Type ${damageType}`;
}

export function getDamageTypeIconUrl(damageType: number): string | null {
  const iconName = DAMAGE_TYPE_ICONS[damageType];
  if (!iconName) return null;

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${UI_PATH}/${iconName}.png`);

  return data.publicUrl;
}

export function getDamageResistanceIconUrl(
  resistanceType: string,
  isResistant: boolean,
  isVulnerable: boolean
): string | null {
  const icons = RESISTANCE_ICONS[resistanceType];
  if (!icons) return null;

  let iconName = icons.normal;
  if (isResistant) iconName = icons.resistant;
  else if (isVulnerable) iconName = icons.vulnerable;

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${UI_PATH}/${iconName}.png`);

  return data.publicUrl;
}

export function getDamageImageUrl(iconName: string): string | null {
  if (!iconName) return null;

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`${UI_PATH}/${iconName}.png`);

  return data.publicUrl;
}
