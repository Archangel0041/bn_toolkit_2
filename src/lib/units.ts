import battleUnitsData from "@/data/battle_units.json";
import type { ParsedUnit, UnitConfig, IdentityConfig, AnimationConfig, StatsConfig, RequirementsConfig, HealingConfig, WeaponsConfig } from "@/types/units";

const rawData = battleUnitsData as Record<string, UnitConfig[]>;

function parseUnit(id: string, configs: UnitConfig[]): ParsedUnit {
  const unit: ParsedUnit = {
    id: parseInt(id),
    identity: configs.find((c) => c._t === "battle_unit_identity_config") as IdentityConfig,
  };

  unit.animation = configs.find((c) => c._t === "battle_unit_animation_config") as AnimationConfig | undefined;
  unit.statsConfig = configs.find((c) => c._t === "battle_unit_stats_config") as StatsConfig | undefined;
  unit.requirements = configs.find((c) => c._t === "battle_unit_requirements_config") as RequirementsConfig | undefined;
  unit.healing = configs.find((c) => c._t === "battle_unit_healing_config") as HealingConfig | undefined;
  unit.weapons = configs.find((c) => c._t === "battle_unit_weapons_config") as WeaponsConfig | undefined;

  return unit;
}

export const allUnits: ParsedUnit[] = Object.entries(rawData).map(([id, configs]) => parseUnit(id, configs));

export function getUnitById(id: number): ParsedUnit | undefined {
  return allUnits.find((u) => u.id === id);
}

export function getAllTags(): number[] {
  const tags = new Set<number>();
  allUnits.forEach((unit) => {
    unit.identity.tags.forEach((tag) => tags.add(tag));
  });
  return Array.from(tags).sort((a, b) => a - b);
}

export function getAllSides(): number[] {
  const sides = new Set<number>();
  allUnits.forEach((unit) => {
    sides.add(unit.identity.side);
  });
  return Array.from(sides).sort((a, b) => a - b);
}

export function filterUnits(
  units: ParsedUnit[],
  searchQuery: string,
  selectedTags: number[],
  selectedSide: number | null,
  getLocalizedName: (key: string) => string
): ParsedUnit[] {
  return units.filter((unit) => {
    // Filter by search query (ID or localized name)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const idMatch = unit.id.toString().includes(query);
      const nameMatch = getLocalizedName(unit.identity.name).toLowerCase().includes(query);
      const shortNameMatch = getLocalizedName(unit.identity.short_name).toLowerCase().includes(query);
      if (!idMatch && !nameMatch && !shortNameMatch) return false;
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      const hasAllTags = selectedTags.every((tag) => unit.identity.tags.includes(tag));
      if (!hasAllTags) return false;
    }

    // Filter by side
    if (selectedSide !== null && unit.identity.side !== selectedSide) {
      return false;
    }

    return true;
  });
}
