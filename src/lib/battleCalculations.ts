import { getUnitById } from "@/lib/units";
import { getAbilityById } from "@/lib/abilities";
import { unitMatchesTargets } from "@/lib/tagHierarchy";
import { getStatusEffect, getEffectDisplayNameTranslated, getEffectColor } from "@/lib/statusEffects";
import { getBlockingUnits, checkLineOfFire, isTargetInRange, calculateRange, BlockingUnit } from "@/lib/battleTargeting";
import { UnitBlockingLabels, UnitTagLabels } from "@/data/gameEnums";
import type { AbilityInfo, DamagePreview, DamageResult, PartyUnit, StatusEffectPreview, TargetArea } from "@/types/battleSimulator";
import { DAMAGE_TYPE_MAP, getAffectedGridPositions, getFixedAttackPositions } from "@/types/battleSimulator";
import type { EncounterUnit } from "@/types/encounters";
import type { DamageMods, UnitStats } from "@/types/units";

// Helper to get blocker info for damage preview
function getBlockerInfo(blockedBy?: BlockingUnit): { blockedByUnitName?: string; blockedByBlockingLevel?: number } {
  if (!blockedBy) return {};
  const blockerUnit = getUnitById(blockedBy.unitId);
  // Use the unit's name key or fallback to ID
  const blockerName = blockerUnit?.identity?.name || `Unit ${blockedBy.unitId}`;
  return {
    blockedByUnitName: blockerName,
    blockedByBlockingLevel: blockedBy.blocking,
  };
}

// Calculate damage at rank: Damage = Base Damage * (1 + 2 * 0.01 * Power)
export function calculateDamageAtRank(baseDamage: number, power: number): number {
  return Math.floor(baseDamage * (1 + 2 * 0.01 * power));
}

// Calculate dodge chance: defense - offense + 5 (only positive values)
export function calculateDodgeChance(defenderDefense: number, attackerOffense: number): number {
  const dodgeChance = defenderDefense - attackerOffense + 5;
  return Math.max(0, dodgeChance);
}

// Get damage modifier for a specific damage type
// Values can be stored as percentages (100 = 1x, 150 = 1.5x) or decimals (1.0 = 1x, 1.5 = 1.5x)
export function getDamageModifier(damageMods: DamageMods | undefined, damageType: number): number {
  if (!damageMods) return 1;
  const modKey = DAMAGE_TYPE_MAP[damageType];
  if (!modKey) return 1;
  const mod = damageMods[modKey];
  if (mod === undefined) return 1;
  // If value > 10, assume it's a percentage (e.g., 100, 150), otherwise it's a decimal (e.g., 1.0, 1.5)
  return mod > 10 ? mod / 100 : mod;
}

// Get environmental damage modifier from status effect stun_damage_mods
// These are keyed by damage type number as string (e.g., "5" for Fire)
// Returns undefined if the damage type is not present in the mods
function getEnvironmentalDamageModifier(envMods: Record<string, number>, damageType: number): number | undefined {
  const mod = envMods[damageType.toString()];
  if (mod === undefined) return undefined;
  // Environmental mods are typically stored as decimals (1.5 = 150% damage)
  return mod;
}

// Calculate damage with armor mechanics
// environmentalDamageMods: Optional damage modifiers from environmental status effects (e.g., Firemod)
// statusEffectDamageMods: Optional damage modifiers from target's active status effects (e.g., Freeze, Shatter)
// statusEffectArmorDamageMods: Optional armor damage modifiers from target's active status effects
// bypassArmorDueToStun: If true, all damage bypasses armor (for Active armor units when stunned)
// includeBreakdown: If true, include detailed calculation breakdown in the result
export function calculateDamageWithArmor(
  rawDamage: number,
  armorHp: number,
  armorDamageMods: DamageMods | undefined,
  hpDamageMods: DamageMods | undefined,
  damageType: number,
  armorPiercingPercent: number,
  environmentalDamageMods?: Record<string, number>,
  statusEffectDamageMods?: Record<string, number>,
  statusEffectArmorDamageMods?: Record<string, number>,
  bypassArmorDueToStun?: boolean,
  includeBreakdown?: boolean
): DamageResult {
  // Get base resistance modifiers
  const baseHpMod = getDamageModifier(hpDamageMods, damageType);
  const baseArmorMod = getDamageModifier(armorDamageMods, damageType);

  // Get environmental damage modifier - only if it explicitly modifies this damage type
  const envMod = environmentalDamageMods ? getEnvironmentalDamageModifier(environmentalDamageMods, damageType) : undefined;

  // Get status effect damage modifiers - only if they explicitly modify this damage type
  const statusHpMod = statusEffectDamageMods ? getEnvironmentalDamageModifier(statusEffectDamageMods, damageType) : undefined;
  const statusArmorMod = statusEffectArmorDamageMods ? getEnvironmentalDamageModifier(statusEffectArmorDamageMods, damageType) : undefined;

  // Apply modifiers in priority order:
  // 1. Status effect mods (highest priority - e.g., Freeze increases damage taken)
  // 2. Environmental mods (medium priority - e.g., Firemod increases fire damage)
  // 3. Base resistances (lowest priority - unit's innate resistance)
  // Only override if the higher priority mod exists for this damage type
  const hpMod = statusHpMod ?? envMod ?? baseHpMod;
  const armorMod = statusArmorMod ?? envMod ?? baseArmorMod;

  // If bypassing armor due to stun (Active armor units), all damage goes to HP
  if (bypassArmorDueToStun && armorHp > 0) {
    const hpDamage = Math.floor(rawDamage * hpMod);
    return {
      rawDamage: rawDamage,
      armorDamage: 0,
      hpDamage,
      armorRemaining: armorHp, // Armor is bypassed, not damaged
      effectiveMultiplier: hpMod,
      breakdown: includeBreakdown ? {
        baseDamage: rawDamage,
        powerBonus: 0,
        baseHpMod,
        baseArmorMod,
        envMod: envMod ?? 0,
        statusHpMod: statusHpMod ?? 0,
        statusArmorMod: statusArmorMod ?? 0,
        finalHpMod: hpMod,
        finalArmorMod: armorMod,
        piercingDamage: rawDamage,
        armorableDamage: 0,
        effectiveArmorCapacity: 0,
        armorAbsorbed: 0,
        overflowToHp: rawDamage,
        bypassedArmor: true,
      } : undefined,
    };
  }

  // If no armor, damage goes straight to HP
  if (armorHp <= 0) {
    const hpDamage = Math.floor(rawDamage * hpMod);
    return {
      rawDamage: rawDamage,
      armorDamage: 0,
      hpDamage,
      armorRemaining: 0,
      effectiveMultiplier: hpMod,
      breakdown: includeBreakdown ? {
        baseDamage: rawDamage,
        powerBonus: 0,
        baseHpMod,
        baseArmorMod,
        envMod: envMod ?? 0,
        statusHpMod: statusHpMod ?? 0,
        statusArmorMod: statusArmorMod ?? 0,
        finalHpMod: hpMod,
        finalArmorMod: armorMod,
        piercingDamage: 0,
        armorableDamage: rawDamage,
        effectiveArmorCapacity: 0,
        armorAbsorbed: 0,
        overflowToHp: rawDamage,
        bypassedArmor: false,
      } : undefined,
    };
  }

  // Armor piercing: percentage of damage that bypasses armor entirely
  const piercingDamage = Math.floor(rawDamage * armorPiercingPercent);
  const armorableDamage = rawDamage - piercingDamage;

  // Effective armor capacity = armorHp / armorMod
  // If armorMod is 0.6 (60% damage taken), armor blocks more raw damage
  const effectiveArmorCapacity = armorMod > 0 ? Math.floor(armorHp / armorMod) : armorHp;

  let armorDamage = 0;
  let damageToHp = piercingDamage;
  let armorRemaining = armorHp;
  let armorAbsorbed = 0;
  let overflowDamage = 0;

  if (armorableDamage <= effectiveArmorCapacity) {
    // Armor absorbs all armorable damage
    armorDamage = Math.floor(armorableDamage * armorMod);
    armorRemaining = armorHp - armorDamage;
    armorAbsorbed = armorableDamage;
  } else {
    // Armor is depleted, remainder goes to HP
    armorDamage = armorHp;
    armorRemaining = 0;
    overflowDamage = armorableDamage - effectiveArmorCapacity;
    damageToHp += overflowDamage;
    armorAbsorbed = effectiveArmorCapacity;
  }

  // Apply HP damage modifier to the HP portion (already calculated above)
  const finalHpDamage = Math.floor(damageToHp * hpMod);

  return {
    rawDamage: rawDamage,
    armorDamage,
    hpDamage: finalHpDamage,
    armorRemaining: Math.max(0, armorRemaining),
    effectiveMultiplier: hpMod,
    breakdown: includeBreakdown ? {
      baseDamage: rawDamage,
      powerBonus: 0,
      baseHpMod,
      baseArmorMod,
      envMod: envMod ?? 0,
      statusHpMod: statusHpMod ?? 0,
      statusArmorMod: statusArmorMod ?? 0,
      finalHpMod: hpMod,
      finalArmorMod: armorMod,
      piercingDamage,
      armorableDamage,
      effectiveArmorCapacity,
      armorAbsorbed,
      overflowToHp: overflowDamage + piercingDamage,
      bypassedArmor: false,
    } : undefined,
  };
}

// Multiply damage result by number of shots
function multiplyDamageResult(result: DamageResult, shots: number): DamageResult {
  return {
    rawDamage: result.rawDamage * shots,
    armorDamage: result.armorDamage * shots,
    hpDamage: result.hpDamage * shots,
    armorRemaining: result.armorRemaining, // Armor remaining doesn't multiply
    effectiveMultiplier: result.effectiveMultiplier,
  };
}

// Calculate status effect previews for a target
// damagePercentMod: Optional modifier for splash damage (100 = full, 50 = half chance)
function calculateStatusEffectPreviews(
  statusEffects: Record<string, number>,
  abilityDamage: number,
  targetImmunities: number[],
  damagePercentMod: number = 100
): StatusEffectPreview[] {
  const previews: StatusEffectPreview[] = [];
  
  for (const [effectIdStr, chance] of Object.entries(statusEffects)) {
    const effectId = parseInt(effectIdStr);
    const effect = getStatusEffect(effectId);
    if (!effect) continue;
    
    const isImmune = targetImmunities.includes(effect.family);
    const name = getEffectDisplayNameTranslated(effectId);
    const color = getEffectColor(effectId);
    
    // Calculate DoT damage if applicable
    let dotDamage = 0;
    if (effect.dot_ability_damage_mult || effect.dot_bonus_damage) {
      const mult = effect.dot_ability_damage_mult || 0;
      const bonus = effect.dot_bonus_damage || 0;
      dotDamage = Math.floor(abilityDamage * mult + bonus);
    }
    
    const isStun = effect.stun_block_action === true || effect.stun_block_movement === true;
    
    // Apply damage percent modifier to status effect chance (for splash damage)
    const adjustedChance = Math.floor(chance * (damagePercentMod / 100));
    
    previews.push({
      effectId,
      name,
      chance: adjustedChance,
      duration: effect.duration,
      damageType: effect.dot_damage_type || null,
      dotDamage,
      isImmune,
      isStun,
      color,
    });
  }
  
  return previews;
}

// Get all abilities for a unit at a specific rank
export function getUnitAbilities(unitId: number, rank: number): AbilityInfo[] {
  const unit = getUnitById(unitId);
  if (!unit?.weapons?.weapons) return [];

  const stats = unit.statsConfig?.stats?.[rank - 1];
  const power = stats?.power || 0;
  const accuracy = stats?.accuracy || 0;
  const unitBaseCrit = stats?.critical || 0; // Unit's base critical hit chance stat

  const abilities: AbilityInfo[] = [];

  Object.entries(unit.weapons.weapons).forEach(([weaponName, weapon]) => {
    weapon.abilities.forEach(abilityId => {
      const ability = getAbilityById(abilityId);
      if (!ability) return;

      const minDamage = calculateDamageAtRank(weapon.stats.base_damage_min, power);
      const maxDamage = calculateDamageAtRank(weapon.stats.base_damage_max, power);
      // Total attack = weapon base_atk + ability attack
      const totalAttack = (weapon.stats.base_atk || 0) + ability.stats.attack;
      const offense = totalAttack + accuracy;

      // Parse target area data
      const rawTargetArea = (ability.stats as any).target_area;
      let targetArea = undefined;
      let isFixed = false;
      let isSingleTarget = true; // Default to single target
      
      if (rawTargetArea) {
        targetArea = {
          targetType: rawTargetArea.target_type || 1,
          data: (rawTargetArea.data || []).map((d: any) => ({
            x: d.pos?.x || 0,
            y: d.pos?.y || 0,
            damagePercent: d.damage_percent,
            weight: d.weight,
            order: d.order,
          })),
          random: rawTargetArea.random || false,
          aoeOrderDelay: rawTargetArea.aoe_order_delay,
        };
        
        // Fixed attacks have target_type 1 but have multiple positions in data
        // (single target uses target_type 1 with just the center position)
        // If target_type is 1 AND there are positions with non-zero offsets, it's fixed
        isFixed = rawTargetArea.target_type === 1 && 
          targetArea.data.some((d: any) => d.x !== 0 || d.y !== 0);
        
        // Single target = no target_area OR only center position with 100% damage
        // AOE (target_type 2) = has splash pattern, needs reticle
        // Fixed (target_type 1 with offsets) = no reticle but shows pattern
        // If there's a damage_area (splash damage), it's NOT single target
        isSingleTarget = !rawTargetArea || (
          rawTargetArea.target_type === 1 && 
          !targetArea.data.some((d: any) => d.x !== 0 || d.y !== 0)
        );
      }

      // Parse damage_area - splash damage pattern around each impact point
      const rawDamageArea = (ability.stats as any).damage_area;
      const damageArea = rawDamageArea 
        ? rawDamageArea.map((d: any) => ({
            x: d.pos?.x || 0,
            y: d.pos?.y || 0,
            damagePercent: d.damage_percent || 100,
          }))
        : undefined;
      
      // IMPORTANT: If there's damage_area (splash damage), it's NOT a single target ability
      // The splash pattern applies around the center impact point
      if (damageArea && damageArea.length > 0) {
        // Only mark as non-single-target if there are actual splash positions (non-center)
        const hasNonCenterSplash = damageArea.some((d: any) => d.x !== 0 || d.y !== 0);
        if (hasNonCenterSplash) {
          isSingleTarget = false;
        }
      }


      const attackDirection = ability.stats.attack_direction || 1;
      const lineOfFire = ability.stats.line_of_fire ?? 1; // Default to Direct

      abilities.push({
        abilityId,
        weaponName,
        minDamage,
        maxDamage,
        offense,
        shotsPerAttack: ability.stats.shots_per_attack,
        attacksPerUse: (ability.stats as any).attacks_per_use || 1,
        lineOfFire,
        attackDirection,
        targets: ability.stats.targets || [],
        damageType: ability.stats.damage_type,
        minRange: ability.stats.min_range,
        maxRange: ability.stats.max_range,
        cooldown: ability.stats.ability_cooldown,
        globalCooldown: (ability.stats as any).global_cooldown || 0,
        armorPiercing: ability.stats.armor_piercing_percent,
        critPercent: ability.stats.critical_hit_percent,
        unitBaseCrit: unitBaseCrit,
        critBonuses: (ability.stats as any).critical_bonuses || {},
        chargeTime: (ability.stats as any).charge_time || 0,
        suppressionMultiplier: (ability.stats as any).damage_distraction || 1,
        suppressionBonus: (ability.stats as any).damage_distraction_bonus || 0,
        statusEffects: ability.stats.status_effects || {},
        targetArea,
        damageArea,
        isFixed,
        isSingleTarget,
        // Ammo system
        ammoRequired: ability.stats.ammo_required || 0,
        weaponMaxAmmo: weapon.stats.ammo,
        weaponReloadTime: weapon.stats.reload_time || 0,
      });
    });
  });

  return abilities;
}

// Check if a unit can be targeted by an ability based on tags (with hierarchy)
export function canTargetUnit(targetUnitId: number, abilityTargets: number[]): boolean {
  if (abilityTargets.length === 0) return true; // No restrictions
  
  const targetUnit = getUnitById(targetUnitId);
  if (!targetUnit) return false;

  const unitTags = targetUnit.identity.tags;
  return unitMatchesTargets(unitTags, abilityTargets);
}

// Get the reason why a unit is immune to an ability based on tags
// Returns null if not immune, otherwise returns a formatted reason string
export function getUnitImmunityReason(targetUnitId: number, abilityTargets: number[]): string | null {
  if (abilityTargets.length === 0) return null; // No restrictions
  
  const targetUnit = getUnitById(targetUnitId);
  if (!targetUnit) return null;

  const unitTags = targetUnit.identity.tags;
  
  // Check if already matching (not immune)
  if (unitMatchesTargets(unitTags, abilityTargets)) return null;
  
  // Format ability target tags
  const targetTagNames = abilityTargets
    .map(tag => UnitTagLabels[tag] || `Tag ${tag}`)
    .join(", ");
  
  return `ability targets ${targetTagNames}`;
}

// Get unit stats at a specific rank
function getUnitStatsAtRank(unitId: number, rank: number): UnitStats | undefined {
  const unit = getUnitById(unitId);
  return unit?.statsConfig?.stats?.[rank - 1];
}

// Calculate crit chance based on unit base crit + ability crit + tag-based bonuses
// unitBaseCrit: The attacker unit's base critical stat from statsConfig
// abilityCrit: The ability's base critical_hit_percent
// critBonuses: Tag-based critical bonuses from the ability
// targetUnitId: The target unit to check tags against
export function calculateCritChance(
  unitBaseCrit: number,
  abilityCrit: number,
  critBonuses: Record<number, number>,
  targetUnitId: number
): number {
  const targetUnit = getUnitById(targetUnitId);

  // Start with unit base crit + ability crit
  let totalCrit = unitBaseCrit + abilityCrit;

  if (!targetUnit) return totalCrit;

  // critBonuses are keyed by tag IDs - check if target has any matching tags
  // Use tag hierarchy: if a bonus applies to a parent tag, it applies to all child tags
  const targetTags = targetUnit.identity.tags;
  let tagBonus = 0;

  for (const [bonusTagStr, bonus] of Object.entries(critBonuses)) {
    const bonusTag = parseInt(bonusTagStr);
    // Check if target matches this bonus tag (directly or through hierarchy)
    if (unitMatchesTargets(targetTags, [bonusTag])) {
      tagBonus += bonus;
    }
  }

  return totalCrit + tagBonus;
}

// Calculate damage preview for all valid targets
export function calculateDamagePreviewsForEnemy(
  attackerAbility: AbilityInfo,
  attackerGridId: number,
  enemyUnits: EncounterUnit[],
  enemyRankOverrides: Record<number, number> = {},
  environmentalDamageMods?: Record<string, number>,
  includeBreakdown?: boolean
): DamagePreview[] {
  const totalShots = attackerAbility.shotsPerAttack * attackerAbility.attacksPerUse;
  const blockingUnits = getBlockingUnits(enemyUnits, true);
  
  return enemyUnits
    .filter(u => u.grid_id !== undefined)
    .map(enemyUnit => {
      const enemy = getUnitById(enemyUnit.unit_id);
      const enemyRank = enemyRankOverrides[enemyUnit.grid_id!] || (enemy?.statsConfig?.stats?.length || 1);
      const enemyStats = getUnitStatsAtRank(enemyUnit.unit_id, enemyRank);
      const canTarget = canTargetUnit(enemyUnit.unit_id, attackerAbility.targets);
      const defense = enemyStats?.defense || 0;
      const dodgeChance = calculateDodgeChance(defense, attackerAbility.offense);
      const critChance = calculateCritChance(attackerAbility.unitBaseCrit, attackerAbility.critPercent, attackerAbility.critBonuses, enemyUnit.unit_id);

      const armorHp = enemyStats?.armor_hp || 0;
      const hp = enemyStats?.hp || 0;
      const immunities = enemy?.statsConfig?.status_effect_immunities || [];
      
      // Check range
      const range = calculateRange(attackerGridId, enemyUnit.grid_id!, false);
      const inRange = range >= attackerAbility.minRange && range <= attackerAbility.maxRange;
      
      // Check line of fire blocking
      const blockCheck = checkLineOfFire(
        attackerGridId,
        enemyUnit.grid_id!,
        attackerAbility.lineOfFire,
        false,
        blockingUnits
      );
      
      const minResult = calculateDamageWithArmor(
        attackerAbility.minDamage,
        armorHp,
        enemyStats?.armor_damage_mods,
        enemyStats?.damage_mods,
        attackerAbility.damageType,
        attackerAbility.armorPiercing,
        environmentalDamageMods,
        undefined,
        undefined,
        undefined,
        includeBreakdown
      );

      const maxResult = calculateDamageWithArmor(
        attackerAbility.maxDamage,
        armorHp,
        enemyStats?.armor_damage_mods,
        enemyStats?.damage_mods,
        attackerAbility.damageType,
        attackerAbility.armorPiercing,
        environmentalDamageMods,
        undefined,
        undefined,
        undefined,
        includeBreakdown
      );
      
      // Calculate status effect previews
      const avgDamage = Math.floor((attackerAbility.minDamage + attackerAbility.maxDamage) / 2);
      const statusEffects = calculateStatusEffectPreviews(
        attackerAbility.statusEffects,
        avgDamage,
        immunities
      );

      const blockerInfo = getBlockerInfo(blockCheck.blockedBy);

      return {
        targetGridId: enemyUnit.grid_id!,
        targetUnitId: enemyUnit.unit_id,
        minDamage: minResult,
        maxDamage: maxResult,
        totalShots,
        minTotalDamage: multiplyDamageResult(minResult, totalShots),
        maxTotalDamage: multiplyDamageResult(maxResult, totalShots),
        dodgeChance,
        critChance,
        canTarget,
        targetHasArmor: armorHp > 0,
        targetArmorHp: armorHp,
        targetHp: hp,
        targetDefense: defense,
        statusEffects,
        damagePercent: 100,
        inRange,
        range,
        isBlocked: blockCheck.isBlocked,
        blockedByUnitId: blockCheck.blockedBy?.unitId,
        ...blockerInfo,
        blockReason: blockCheck.reason,
        damageType: attackerAbility.damageType,
      };
    });
}

export function calculateDamagePreviewsForFriendly(
  attackerAbility: AbilityInfo,
  attackerGridId: number,
  friendlyUnits: PartyUnit[],
  environmentalDamageMods?: Record<string, number>,
  includeBreakdown?: boolean
): DamagePreview[] {
  const totalShots = attackerAbility.shotsPerAttack * attackerAbility.attacksPerUse;
  const blockingUnits = getBlockingUnits(friendlyUnits, false);
  
  return friendlyUnits.map(friendlyUnit => {
    const unit = getUnitById(friendlyUnit.unitId);
    const stats = getUnitStatsAtRank(friendlyUnit.unitId, friendlyUnit.rank);
    const canTarget = canTargetUnit(friendlyUnit.unitId, attackerAbility.targets);
    const defense = stats?.defense || 0;
    const dodgeChance = calculateDodgeChance(defense, attackerAbility.offense);
    const critChance = calculateCritChance(attackerAbility.unitBaseCrit, attackerAbility.critPercent, attackerAbility.critBonuses, friendlyUnit.unitId);

    const armorHp = stats?.armor_hp || 0;
    const hp = stats?.hp || 0;
    const immunities = unit?.statsConfig?.status_effect_immunities || [];
    
    // Check range
    const range = calculateRange(attackerGridId, friendlyUnit.gridId, true);
    const inRange = range >= attackerAbility.minRange && range <= attackerAbility.maxRange;
    
    // Check line of fire blocking
    const blockCheck = checkLineOfFire(
      attackerGridId,
      friendlyUnit.gridId,
      attackerAbility.lineOfFire,
      true,
      blockingUnits
    );
    
    const minResult = calculateDamageWithArmor(
      attackerAbility.minDamage,
      armorHp,
      stats?.armor_damage_mods,
      stats?.damage_mods,
      attackerAbility.damageType,
      attackerAbility.armorPiercing,
      environmentalDamageMods,
      undefined,
      undefined,
      undefined,
      includeBreakdown
    );

    const maxResult = calculateDamageWithArmor(
      attackerAbility.maxDamage,
      armorHp,
      stats?.armor_damage_mods,
      stats?.damage_mods,
      attackerAbility.damageType,
      attackerAbility.armorPiercing,
      environmentalDamageMods,
      undefined,
      undefined,
      undefined,
      includeBreakdown
    );
    
    // Calculate status effect previews
    const avgDamage = Math.floor((attackerAbility.minDamage + attackerAbility.maxDamage) / 2);
    const statusEffects = calculateStatusEffectPreviews(
      attackerAbility.statusEffects,
      avgDamage,
      immunities
    );

    const blockerInfo = getBlockerInfo(blockCheck.blockedBy);

    return {
      targetGridId: friendlyUnit.gridId,
      targetUnitId: friendlyUnit.unitId,
      minDamage: minResult,
      maxDamage: maxResult,
      totalShots,
      minTotalDamage: multiplyDamageResult(minResult, totalShots),
      maxTotalDamage: multiplyDamageResult(maxResult, totalShots),
      dodgeChance,
      critChance,
      canTarget,
      targetHasArmor: armorHp > 0,
      targetArmorHp: armorHp,
      targetHp: hp,
      targetDefense: defense,
      statusEffects,
      damagePercent: 100,
      inRange,
      range,
      isBlocked: blockCheck.isBlocked,
      blockedByUnitId: blockCheck.blockedBy?.unitId,
      ...blockerInfo,
      blockReason: blockCheck.reason,
      damageType: attackerAbility.damageType,
    };
  });
}

// Calculate damage previews with AOE pattern applied at reticle position
export function calculateAoeDamagePreviewsForEnemy(
  attackerAbility: AbilityInfo,
  attackerGridId: number,
  enemyUnits: EncounterUnit[],
  reticleGridId: number,
  enemyRankOverrides: Record<number, number> = {},
  environmentalDamageMods?: Record<string, number>,
  includeBreakdown?: boolean
): DamagePreview[] {
  const totalShots = attackerAbility.shotsPerAttack * attackerAbility.attacksPerUse;
  const affectedPositions = getAffectedGridPositions(reticleGridId, attackerAbility.targetArea, true, attackerAbility.damageArea);
  const blockingUnits = getBlockingUnits(enemyUnits, true);
  
  // Create a map of gridId -> damagePercent
  const damagePercentMap = new Map<number, number>();
  for (const pos of affectedPositions) {
    damagePercentMap.set(pos.gridId, pos.damagePercent);
  }
  
  return enemyUnits
    .filter(u => u.grid_id !== undefined && damagePercentMap.has(u.grid_id))
    .map(enemyUnit => {
      const enemy = getUnitById(enemyUnit.unit_id);
      const enemyRank = enemyRankOverrides[enemyUnit.grid_id!] || (enemy?.statsConfig?.stats?.length || 1);
      const enemyStats = getUnitStatsAtRank(enemyUnit.unit_id, enemyRank);
      const canTarget = canTargetUnit(enemyUnit.unit_id, attackerAbility.targets);
      const defense = enemyStats?.defense || 0;
      const dodgeChance = calculateDodgeChance(defense, attackerAbility.offense);
      const critChance = calculateCritChance(attackerAbility.unitBaseCrit, attackerAbility.critPercent, attackerAbility.critBonuses, enemyUnit.unit_id);

      const armorHp = enemyStats?.armor_hp || 0;
      const hp = enemyStats?.hp || 0;
      const immunities = enemy?.statsConfig?.status_effect_immunities || [];
      
      // For AOE attacks, splash damage ignores range - only the reticle position matters
      // The unit is hit because they're in the splash area, not because they're in range
      const range = calculateRange(attackerGridId, enemyUnit.grid_id!, false);
      const inRange = true; // AOE splash always hits if in affected area
      
      // Check line of fire blocking
      const blockCheck = checkLineOfFire(
        attackerGridId,
        enemyUnit.grid_id!,
        attackerAbility.lineOfFire,
        false,
        blockingUnits
      );
      
      // Apply damage percent modifier to damage
      const damagePercent = damagePercentMap.get(enemyUnit.grid_id!) || 100;
      const adjustedMinDamage = Math.floor(attackerAbility.minDamage * (damagePercent / 100));
      const adjustedMaxDamage = Math.floor(attackerAbility.maxDamage * (damagePercent / 100));

      const minResult = calculateDamageWithArmor(
        adjustedMinDamage,
        armorHp,
        enemyStats?.armor_damage_mods,
        enemyStats?.damage_mods,
        attackerAbility.damageType,
        attackerAbility.armorPiercing,
        environmentalDamageMods,
        undefined,
        undefined,
        undefined,
        includeBreakdown
      );

      const maxResult = calculateDamageWithArmor(
        adjustedMaxDamage,
        armorHp,
        enemyStats?.armor_damage_mods,
        enemyStats?.damage_mods,
        attackerAbility.damageType,
        attackerAbility.armorPiercing,
        environmentalDamageMods,
        undefined,
        undefined,
        undefined,
        includeBreakdown
      );
      
      // Calculate status effect previews with adjusted damage
      const avgDamage = Math.floor((adjustedMinDamage + adjustedMaxDamage) / 2);
      const statusEffects = calculateStatusEffectPreviews(
        attackerAbility.statusEffects,
        avgDamage,
        immunities
      );

      const blockerInfo = getBlockerInfo(blockCheck.blockedBy);

      return {
        targetGridId: enemyUnit.grid_id!,
        targetUnitId: enemyUnit.unit_id,
        minDamage: minResult,
        maxDamage: maxResult,
        totalShots,
        minTotalDamage: multiplyDamageResult(minResult, totalShots),
        maxTotalDamage: multiplyDamageResult(maxResult, totalShots),
        dodgeChance,
        critChance,
        canTarget,
        targetHasArmor: armorHp > 0,
        targetArmorHp: armorHp,
        targetHp: hp,
        targetDefense: defense,
        statusEffects,
        damagePercent,
        inRange,
        range,
        isBlocked: blockCheck.isBlocked,
        blockedByUnitId: blockCheck.blockedBy?.unitId,
        ...blockerInfo,
        blockReason: blockCheck.reason,
        damageType: attackerAbility.damageType,
      };
    });
}

export function calculateAoeDamagePreviewsForFriendly(
  attackerAbility: AbilityInfo,
  attackerGridId: number,
  friendlyUnits: PartyUnit[],
  reticleGridId: number,
  environmentalDamageMods?: Record<string, number>,
  includeBreakdown?: boolean
): DamagePreview[] {
  const totalShots = attackerAbility.shotsPerAttack * attackerAbility.attacksPerUse;
  const affectedPositions = getAffectedGridPositions(reticleGridId, attackerAbility.targetArea, false, attackerAbility.damageArea);
  const blockingUnits = getBlockingUnits(friendlyUnits, false);
  
  // Create a map of gridId -> damagePercent
  const damagePercentMap = new Map<number, number>();
  for (const pos of affectedPositions) {
    damagePercentMap.set(pos.gridId, pos.damagePercent);
  }
  
  return friendlyUnits
    .filter(u => damagePercentMap.has(u.gridId))
    .map(friendlyUnit => {
      const unit = getUnitById(friendlyUnit.unitId);
      const stats = getUnitStatsAtRank(friendlyUnit.unitId, friendlyUnit.rank);
      const canTarget = canTargetUnit(friendlyUnit.unitId, attackerAbility.targets);
      const defense = stats?.defense || 0;
      const dodgeChance = calculateDodgeChance(defense, attackerAbility.offense);
      const critChance = calculateCritChance(attackerAbility.unitBaseCrit, attackerAbility.critPercent, attackerAbility.critBonuses, friendlyUnit.unitId);

      const armorHp = stats?.armor_hp || 0;
      const hp = stats?.hp || 0;
      const immunities = unit?.statsConfig?.status_effect_immunities || [];
      
      // For AOE attacks, splash damage ignores range - only the reticle position matters
      const range = calculateRange(attackerGridId, friendlyUnit.gridId, true);
      const inRange = true; // AOE splash always hits if in affected area
      
      // Check line of fire blocking
      const blockCheck = checkLineOfFire(
        attackerGridId,
        friendlyUnit.gridId,
        attackerAbility.lineOfFire,
        true,
        blockingUnits
      );

      // Apply damage percent modifier
      const damagePercent = damagePercentMap.get(friendlyUnit.gridId) || 100;
      const adjustedMinDamage = Math.floor(attackerAbility.minDamage * (damagePercent / 100));
      const adjustedMaxDamage = Math.floor(attackerAbility.maxDamage * (damagePercent / 100));

      const minResult = calculateDamageWithArmor(
        adjustedMinDamage,
        armorHp,
        stats?.armor_damage_mods,
        stats?.damage_mods,
        attackerAbility.damageType,
        attackerAbility.armorPiercing,
        environmentalDamageMods,
        undefined,
        undefined,
        undefined,
        includeBreakdown
      );

      const maxResult = calculateDamageWithArmor(
        adjustedMaxDamage,
        armorHp,
        stats?.armor_damage_mods,
        stats?.damage_mods,
        attackerAbility.damageType,
        attackerAbility.armorPiercing,
        environmentalDamageMods,
        undefined,
        undefined,
        undefined,
        includeBreakdown
      );
      
      // Calculate status effect previews
      const avgDamage = Math.floor((adjustedMinDamage + adjustedMaxDamage) / 2);
      const statusEffects = calculateStatusEffectPreviews(
        attackerAbility.statusEffects,
        avgDamage,
        immunities
      );

      const blockerInfo = getBlockerInfo(blockCheck.blockedBy);

      return {
        targetGridId: friendlyUnit.gridId,
        targetUnitId: friendlyUnit.unitId,
        minDamage: minResult,
        maxDamage: maxResult,
        totalShots,
        minTotalDamage: multiplyDamageResult(minResult, totalShots),
        maxTotalDamage: multiplyDamageResult(maxResult, totalShots),
        dodgeChance,
        critChance,
        canTarget,
        targetHasArmor: armorHp > 0,
        targetArmorHp: armorHp,
        targetHp: hp,
        targetDefense: defense,
        statusEffects,
        damagePercent,
        inRange,
        range,
        isBlocked: blockCheck.isBlocked,
        blockedByUnitId: blockCheck.blockedBy?.unitId,
        ...blockerInfo,
        blockReason: blockCheck.reason,
        damageType: attackerAbility.damageType,
      };
    });
}

// Calculate damage previews for fixed attack patterns
export function calculateFixedDamagePreviewsForEnemy(
  attackerAbility: AbilityInfo,
  attackerGridId: number,
  enemyUnits: EncounterUnit[],
  fixedPositions: { gridId: number; damagePercent: number }[],
  enemyRankOverrides: Record<number, number> = {},
  environmentalDamageMods?: Record<string, number>,
  includeBreakdown?: boolean
): DamagePreview[] {
  const totalShots = attackerAbility.shotsPerAttack * attackerAbility.attacksPerUse;
  const blockingUnits = getBlockingUnits(enemyUnits, true);
  
  // Create a map of gridId -> damagePercent from fixed positions
  const damagePercentMap = new Map<number, number>();
  for (const pos of fixedPositions) {
    damagePercentMap.set(pos.gridId, pos.damagePercent);
  }
  
  return enemyUnits
    .filter(u => u.grid_id !== undefined && damagePercentMap.has(u.grid_id))
    .map(enemyUnit => {
      const enemy = getUnitById(enemyUnit.unit_id);
      const enemyRank = enemyRankOverrides[enemyUnit.grid_id!] || (enemy?.statsConfig?.stats?.length || 1);
      const enemyStats = getUnitStatsAtRank(enemyUnit.unit_id, enemyRank);
      const canTarget = canTargetUnit(enemyUnit.unit_id, attackerAbility.targets);
      const defense = enemyStats?.defense || 0;
      const dodgeChance = calculateDodgeChance(defense, attackerAbility.offense);
      const critChance = calculateCritChance(attackerAbility.unitBaseCrit, attackerAbility.critPercent, attackerAbility.critBonuses, enemyUnit.unit_id);

      const armorHp = enemyStats?.armor_hp || 0;
      const hp = enemyStats?.hp || 0;
      const immunities = enemy?.statsConfig?.status_effect_immunities || [];
      
      // Fixed pattern attacks: splash damage ignores range
      const range = calculateRange(attackerGridId, enemyUnit.grid_id!, false);
      const inRange = true; // Fixed pattern splash always hits
      
      // Check line of fire blocking
      const blockCheck = checkLineOfFire(
        attackerGridId,
        enemyUnit.grid_id!,
        attackerAbility.lineOfFire,
        false,
        blockingUnits
      );
      
      // Apply damage percent modifier from fixed position
      const damagePercent = damagePercentMap.get(enemyUnit.grid_id!) || 100;
      const adjustedMinDamage = Math.floor(attackerAbility.minDamage * (damagePercent / 100));
      const adjustedMaxDamage = Math.floor(attackerAbility.maxDamage * (damagePercent / 100));

      const minResult = calculateDamageWithArmor(
        adjustedMinDamage,
        armorHp,
        enemyStats?.armor_damage_mods,
        enemyStats?.damage_mods,
        attackerAbility.damageType,
        attackerAbility.armorPiercing,
        environmentalDamageMods,
        undefined,
        undefined,
        undefined,
        includeBreakdown
      );

      const maxResult = calculateDamageWithArmor(
        adjustedMaxDamage,
        armorHp,
        enemyStats?.armor_damage_mods,
        enemyStats?.damage_mods,
        attackerAbility.damageType,
        attackerAbility.armorPiercing,
        environmentalDamageMods,
        undefined,
        undefined,
        undefined,
        includeBreakdown
      );
      
      // Calculate status effect previews with adjusted chance based on damagePercent
      const avgDamage = Math.floor((adjustedMinDamage + adjustedMaxDamage) / 2);
      const statusEffects = calculateStatusEffectPreviews(
        attackerAbility.statusEffects,
        avgDamage,
        immunities,
        damagePercent // Pass damage percent to scale status effect chances
      );

      return {
        targetGridId: enemyUnit.grid_id!,
        targetUnitId: enemyUnit.unit_id,
        minDamage: minResult,
        maxDamage: maxResult,
        totalShots,
        minTotalDamage: multiplyDamageResult(minResult, totalShots),
        maxTotalDamage: multiplyDamageResult(maxResult, totalShots),
        dodgeChance,
        critChance,
        canTarget,
        targetHasArmor: armorHp > 0,
        targetArmorHp: armorHp,
        targetHp: hp,
        targetDefense: defense,
        statusEffects,
        damagePercent,
        inRange,
        range,
        isBlocked: blockCheck.isBlocked,
        blockedByUnitId: blockCheck.blockedBy?.unitId,
        blockReason: blockCheck.reason,
        damageType: attackerAbility.damageType,
      };
    });
}

export function calculateFixedDamagePreviewsForFriendly(
  attackerAbility: AbilityInfo,
  attackerGridId: number,
  friendlyUnits: PartyUnit[],
  fixedPositions: { gridId: number; damagePercent: number }[],
  environmentalDamageMods?: Record<string, number>,
  includeBreakdown?: boolean
): DamagePreview[] {
  const totalShots = attackerAbility.shotsPerAttack * attackerAbility.attacksPerUse;
  const blockingUnits = getBlockingUnits(friendlyUnits, false);
  
  // Create a map of gridId -> damagePercent from fixed positions
  const damagePercentMap = new Map<number, number>();
  for (const pos of fixedPositions) {
    damagePercentMap.set(pos.gridId, pos.damagePercent);
  }
  
  return friendlyUnits
    .filter(u => damagePercentMap.has(u.gridId))
    .map(friendlyUnit => {
      const unit = getUnitById(friendlyUnit.unitId);
      const stats = getUnitStatsAtRank(friendlyUnit.unitId, friendlyUnit.rank);
      const canTarget = canTargetUnit(friendlyUnit.unitId, attackerAbility.targets);
      const defense = stats?.defense || 0;
      const dodgeChance = calculateDodgeChance(defense, attackerAbility.offense);
      const critChance = calculateCritChance(attackerAbility.unitBaseCrit, attackerAbility.critPercent, attackerAbility.critBonuses, friendlyUnit.unitId);

      const armorHp = stats?.armor_hp || 0;
      const hp = stats?.hp || 0;
      const immunities = unit?.statsConfig?.status_effect_immunities || [];
      
      // Fixed pattern attacks: splash damage ignores range
      const range = calculateRange(attackerGridId, friendlyUnit.gridId, true);
      const inRange = true; // Fixed pattern splash always hits
      
      // Check line of fire blocking
      const blockCheck = checkLineOfFire(
        attackerGridId,
        friendlyUnit.gridId,
        attackerAbility.lineOfFire,
        true,
        blockingUnits
      );

      // Apply damage percent modifier
      const damagePercent = damagePercentMap.get(friendlyUnit.gridId) || 100;
      const adjustedMinDamage = Math.floor(attackerAbility.minDamage * (damagePercent / 100));
      const adjustedMaxDamage = Math.floor(attackerAbility.maxDamage * (damagePercent / 100));

      const minResult = calculateDamageWithArmor(
        adjustedMinDamage,
        armorHp,
        stats?.armor_damage_mods,
        stats?.damage_mods,
        attackerAbility.damageType,
        attackerAbility.armorPiercing,
        environmentalDamageMods,
        undefined,
        undefined,
        undefined,
        includeBreakdown
      );

      const maxResult = calculateDamageWithArmor(
        adjustedMaxDamage,
        armorHp,
        stats?.armor_damage_mods,
        stats?.damage_mods,
        attackerAbility.damageType,
        attackerAbility.armorPiercing,
        environmentalDamageMods,
        undefined,
        undefined,
        undefined,
        includeBreakdown
      );
      
      // Calculate status effect previews with adjusted chance
      const avgDamage = Math.floor((adjustedMinDamage + adjustedMaxDamage) / 2);
      const statusEffects = calculateStatusEffectPreviews(
        attackerAbility.statusEffects,
        avgDamage,
        immunities,
        damagePercent
      );

      return {
        targetGridId: friendlyUnit.gridId,
        targetUnitId: friendlyUnit.unitId,
        minDamage: minResult,
        maxDamage: maxResult,
        totalShots,
        minTotalDamage: multiplyDamageResult(minResult, totalShots),
        maxTotalDamage: multiplyDamageResult(maxResult, totalShots),
        dodgeChance,
        critChance,
        canTarget,
        targetHasArmor: armorHp > 0,
        targetArmorHp: armorHp,
        targetHp: hp,
        targetDefense: defense,
        statusEffects,
        damagePercent,
        inRange,
        range,
        isBlocked: blockCheck.isBlocked,
        blockedByUnitId: blockCheck.blockedBy?.unitId,
        blockReason: blockCheck.reason,
        damageType: attackerAbility.damageType,
      };
    });
}

// Get the first available grid position based on preferred row
export function getNextAvailablePosition(
  preferredRow: number,
  occupiedPositions: number[]
): number | null {
  const rowOrder = preferredRow === 1 ? [1, 2, 3] :
                   preferredRow === 2 ? [2, 1, 3] :
                   [3, 2, 1];

  const positions: Record<number, number[]> = {
    1: [0, 1, 2, 3, 4],
    2: [5, 6, 7, 8, 9],
    3: [11, 12, 13],
  };

  for (const row of rowOrder) {
    for (const pos of positions[row]) {
      if (!occupiedPositions.includes(pos)) {
        return pos;
      }
    }
  }

  return null;
}
