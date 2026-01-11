import abilitiesData from "@/data/battle_abilities.json";

export interface AbilityStats {
  ability_cooldown: number;
  ammo_required: number;
  armor_piercing_percent: number;
  attack: number;
  attack_direction: number;
  critical_hit_percent: number;
  damage: number;
  damage_type: number;
  line_of_fire?: number;
  max_range: number;
  min_range: number;
  shots_per_attack: number;
  targets?: number[];
  status_effects?: Record<string, number>;
}

export function getLineOfFireLabel(lof: number | undefined): string | null {
  if (lof === undefined) return null;
  switch (lof) {
    case 1: return "Direct";
    case 2: return "Precise";
    case 3: return "Indirect";
    default: return null;
  }
}

export interface Ability {
  damage_animation_type?: string;
  icon: string;
  name: string;
  stats: AbilityStats;
  inf_hitsound?: string;
  veh_hitsound?: string;
}

const rawAbilities = abilitiesData as unknown as Record<string, Ability>;

export function getAbilityById(id: number): Ability | undefined {
  return rawAbilities[id.toString()];
}

export function getAbilityName(id: number, t: (key: string) => string): string {
  const ability = getAbilityById(id);
  if (!ability) return `Ability #${id}`;
  return t(ability.name) || ability.name;
}

export function getAllAbilities(): Record<string, Ability> {
  return rawAbilities;
}
