export interface DamageMods {
  piercing?: number;
  cold?: number;
  crushing?: number;
  explosive?: number;
  fire?: number;
  torpedo?: number;
  depth_charge?: number;
  melee?: number;
  projectile?: number;
  shell?: number;
}

export interface WeaponStats {
  ammo: number;
  base_atk: number;
  base_crit_percent: number;
  base_damage_max: number;
  base_damage_min: number;
  range_bonus: number;
  reload_time?: number;
}

export interface Weapon {
  abilities: number[];
  backattack_animation: string;
  damage_animation_delay: number;
  firesound: string;
  firesound_frame: number;
  frontattack_animation: string;
  name: string;
  stats: WeaponStats;
}

export interface UnitStats {
  ability_slots: number;
  accuracy: number;
  armor_damage_mods?: DamageMods;
  armor_def_style?: number;
  armor_hp?: number;
  bravery: number;
  critical: number;
  damage_mods?: DamageMods;
  defense: number;
  dodge: number;
  hp: number;
  power: number;
  pv: number;
  size?: number;
  rewards?: { sp?: number; gold?: number };
  level_cutoff?: number;
  level_up_cost?: Record<string, number>;
  level_up_rewards?: { xp?: number };
  level_up_time?: number;
  min_drop_level?: number;
  prereqs_for_level?: Array<{ _t: string; min_level: number }>;
}

export interface IdentityConfig {
  _t: "battle_unit_identity_config";
  id: number;
  name: string;
  description: string;
  class_name: number;
  short_name: string;
  icon: string;
  back_icon: string;
  side: number;
  tags: number[];
}

export interface AnimationConfig {
  _t: "battle_unit_animation_config";
  back_idle: string;
  front_idle: string;
  dont_randomize_idle_animation: boolean;
}

export interface StatsConfig {
  _t: "battle_unit_stats_config";
  blocking: number;
  stats: UnitStats[];
  unimportant: boolean;
  status_effect_immunities?: number[];
  preferred_row: number;
  size: number;
}

export interface RequirementsConfig {
  _t: "battle_unit_requirements_config";
  cost: Record<string, number>;
  build_time: number;
}

export interface HealingConfig {
  _t: "battle_unit_healing_config";
  heal_cost: Record<string, number>;
  heal_time: number;
}

export interface WeaponsConfig {
  _t: "battle_unit_weapons_config";
  weapons: Record<string, Weapon>;
}

export interface VisibilityConfig {
  _t: "battle_unit_visibility_config";
}

export type UnitConfig = IdentityConfig | AnimationConfig | StatsConfig | RequirementsConfig | HealingConfig | WeaponsConfig | VisibilityConfig;

export interface ParsedUnit {
  id: number;
  identity: IdentityConfig;
  animation?: AnimationConfig;
  statsConfig?: StatsConfig;
  requirements?: RequirementsConfig;
  healing?: HealingConfig;
  weapons?: WeaponsConfig;
}

export type SupportedLanguage = "en" | "de" | "es" | "fr" | "it" | "ja" | "ko" | "ru" | "zh-Hans" | "zh-Hant";

export interface LocalizedEntry {
  m_Id: number;
  m_Localized: string;
  m_Metadata: { m_Items: unknown[] };
}

export interface LocalizedFile {
  m_Name: string;
  m_LocaleId: { m_Code: string };
  m_TableData: LocalizedEntry[];
}

export interface SharedDataEntry {
  m_Id: number;
  m_Key: string;
  m_Metadata: { m_Items: unknown[] };
}

export interface SharedDataFile {
  m_Name: string;
  m_Entries: SharedDataEntry[];
}
