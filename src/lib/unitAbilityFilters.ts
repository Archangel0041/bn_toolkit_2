import type { ParsedUnit } from "@/types/units";
import { getAbilityById, type Ability } from "@/lib/abilities";
import { expandTargetTags } from "@/lib/tagHierarchy";
import { DamageType, UnitTag } from "@/data/gameEnums";

// Key target categories for filtering
export const TargetCategories = {
  Air: UnitTag.Air,
  Ground: UnitTag.Ground,
  Sea: UnitTag.Sea,
  Soldier: UnitTag.Soldier,
  Vehicle: UnitTag.Vehicle,
  Tank: UnitTag.Tank,
  Critter: UnitTag.Critter,
  Metal: UnitTag.Metal,
} as const;

export const TargetCategoryLabels: Record<number, string> = {
  [UnitTag.Air]: "Air",
  [UnitTag.Ground]: "Ground",
  [UnitTag.Sea]: "Sea",
  [UnitTag.Soldier]: "Soldier",
  [UnitTag.Vehicle]: "Vehicle",
  [UnitTag.Tank]: "Tank",
  [UnitTag.Critter]: "Critter",
  [UnitTag.Metal]: "Metal",
};

// Get all abilities for a unit
export function getUnitAbilities(unit: ParsedUnit): { id: number; ability: Ability }[] {
  const abilities: { id: number; ability: Ability }[] = [];
  
  if (!unit.weapons) return abilities;
  
  for (const weapon of Object.values(unit.weapons.weapons)) {
    for (const abilityId of weapon.abilities) {
      const ability = getAbilityById(abilityId);
      if (ability) {
        abilities.push({ id: abilityId, ability });
      }
    }
  }
  
  return abilities;
}

// Check if unit can target a specific category
export function unitCanTargetCategory(unit: ParsedUnit, targetTag: number): boolean {
  const abilities = getUnitAbilities(unit);
  
  for (const { ability } of abilities) {
    const targets = ability.stats.targets || [];
    if (targets.length === 0) return true; // No restrictions means can target anything
    
    const expandedTargets = expandTargetTags(targets);
    if (expandedTargets.includes(targetTag)) {
      return true;
    }
  }
  
  return false;
}

// Get all damage types a unit can deal
export function getUnitDamageTypes(unit: ParsedUnit): number[] {
  const damageTypes = new Set<number>();
  const abilities = getUnitAbilities(unit);
  
  for (const { ability } of abilities) {
    if (ability.stats.damage_type && ability.stats.damage_type !== DamageType.None) {
      damageTypes.add(ability.stats.damage_type);
    }
  }
  
  return Array.from(damageTypes);
}

// Check if unit has any abilities with status effects (DoT)
export function unitHasStatusEffects(unit: ParsedUnit): boolean {
  const abilities = getUnitAbilities(unit);
  
  for (const { ability } of abilities) {
    if (ability.stats.status_effects && Object.keys(ability.stats.status_effects).length > 0) {
      return true;
    }
  }
  
  return false;
}

// Get damage resistances under 100% (vulnerabilities)
export function getUnitVulnerabilities(unit: ParsedUnit): number[] {
  const vulnerabilities: number[] = [];
  
  if (!unit.statsConfig?.stats?.[0]?.damage_mods) return vulnerabilities;
  
  const damageMods = unit.statsConfig.stats[0].damage_mods;
  const damageTypeMap: Record<string, number> = {
    piercing: DamageType.Piercing,
    cold: DamageType.Cold,
    crushing: DamageType.Crushing,
    explosive: DamageType.Explosive,
    fire: DamageType.Fire,
    torpedo: DamageType.Torpedo,
    depth_charge: DamageType.DepthCharge,
    melee: DamageType.Melee,
    projectile: DamageType.Projectile,
    shell: DamageType.Shell,
  };
  
  for (const [key, damageTypeId] of Object.entries(damageTypeMap)) {
    const resistance = damageMods[key as keyof typeof damageMods];
    if (resistance !== undefined && resistance < 100) {
      vulnerabilities.push(damageTypeId);
    }
  }
  
  return vulnerabilities;
}

// Check if unit has vulnerability to a specific damage type
export function unitHasVulnerabilityTo(unit: ParsedUnit, damageType: number): boolean {
  return getUnitVulnerabilities(unit).includes(damageType);
}

// Filter units by advanced criteria
export interface AdvancedFilterCriteria {
  targetCategories: number[]; // Unit can target these categories
  damageTypes: number[]; // Unit deals these damage types
  hasStatusEffects: boolean; // Unit has DoT/status effect abilities
  vulnerableTo: number[]; // Unit is vulnerable to these damage types
}

export function filterUnitsByAdvancedCriteria(
  units: ParsedUnit[],
  criteria: Partial<AdvancedFilterCriteria>
): ParsedUnit[] {
  return units.filter((unit) => {
    // Filter by target categories (OR logic - can target any of selected)
    if (criteria.targetCategories && criteria.targetCategories.length > 0) {
      const canTargetAny = criteria.targetCategories.some((tag) =>
        unitCanTargetCategory(unit, tag)
      );
      if (!canTargetAny) return false;
    }

    // Filter by damage types (OR logic - deals any of selected)
    if (criteria.damageTypes && criteria.damageTypes.length > 0) {
      const unitDamageTypes = getUnitDamageTypes(unit);
      const hasAnyDamageType = criteria.damageTypes.some((dt) =>
        unitDamageTypes.includes(dt)
      );
      if (!hasAnyDamageType) return false;
    }

    // Filter by status effects
    if (criteria.hasStatusEffects === true) {
      if (!unitHasStatusEffects(unit)) return false;
    }

    // Filter by vulnerabilities (OR logic - vulnerable to any of selected)
    if (criteria.vulnerableTo && criteria.vulnerableTo.length > 0) {
      const hasAnyVulnerability = criteria.vulnerableTo.some((dt) =>
        unitHasVulnerabilityTo(unit, dt)
      );
      if (!hasAnyVulnerability) return false;
    }

    return true;
  });
}
