// Stat icon imports
import hpIcon from "@/assets/unit_stat_hp_icon.png";
import powerIcon from "@/assets/unit_stat_power_icon.png";
import accuracyIcon from "@/assets/unit_stat_accuracy_icon.png";
import dodgeIcon from "@/assets/unit_stat_speed_dodge_icon.png";
import braveryIcon from "@/assets/unit_stat_bravery_icon.png";
import criticalIcon from "@/assets/unit_stat_critical_icon.png";
import armorHpIcon from "@/assets/unit_stat_armor_hp_icon.png";
import abilitySlotIcon from "@/assets/unit_stat_ability_slot_icon.png";
import damageModIcon from "@/assets/unit_stat_damage_modifier_icon.png";
import suppressIcon from "@/assets/unit_stat_suppress_icon.png";

export const statIcons = {
  hp: hpIcon,
  power: powerIcon,
  accuracy: accuracyIcon,
  dodge: dodgeIcon,
  bravery: braveryIcon,
  critical: criticalIcon,
  armor_hp: armorHpIcon,
  ability_slots: abilitySlotIcon,
  damage_mods: damageModIcon,
  suppress: suppressIcon,
  defense: armorHpIcon, // Reuse armor icon for defense
  pv: armorHpIcon, // Reuse armor icon for PV
} as const;

export type StatIconKey = keyof typeof statIcons;

export function getStatIcon(stat: string): string | undefined {
  return statIcons[stat as StatIconKey];
}
