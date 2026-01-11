import { getUnitById } from "@/lib/units";
import { UnitTag, DamageType } from "@/data/gameEnums";
import { getAbilityById } from "@/lib/abilities";
import { getUnitAbilities, calculateDodgeChance, calculateDamageWithArmor, canTargetUnit, getUnitImmunityReason, getDamageModifier, calculateCritChance } from "@/lib/battleCalculations";
import { getBlockingUnits, checkLineOfFire, calculateRange } from "@/lib/battleTargeting";
import { getStatusEffect, getEffectDisplayNameTranslated } from "@/lib/statusEffects";
import { unitMatchesTargets } from "@/lib/tagHierarchy";
import { getAffectedGridPositions, getFixedAttackPositions, GRID_ID_TO_COORDS, COORDS_TO_GRID_ID } from "@/types/battleSimulator";
import type { AbilityInfo, PartyUnit, TargetArea, DamageAreaPosition } from "@/types/battleSimulator";
import type { EncounterUnit } from "@/types/encounters";
import type { 
  LiveBattleUnit, 
  LiveBattleState, 
  BattleAction, 
  BattleTurn,
  DamageRoll,
  ActiveStatusEffect,
  TurnSummary 
} from "@/types/liveBattle";

// Get combined damage modifiers from a unit's active status effects
// Returns modifiers keyed by damage type
export function getStatusEffectDamageMods(unit: LiveBattleUnit): Record<string, number> {
  const mods: Record<string, number> = {};
  
  for (const activeEffect of unit.activeStatusEffects) {
    const effect = getStatusEffect(activeEffect.effectId);
    if (!effect?.stun_damage_mods) continue;
    
    // Merge damage modifiers (take the highest modifier for each damage type)
    for (const [damageType, modifier] of Object.entries(effect.stun_damage_mods)) {
      if (!mods[damageType] || modifier > mods[damageType]) {
        mods[damageType] = modifier;
      }
    }
  }
  
  return mods;
}

// Get combined armor damage modifiers from a unit's active status effects
export function getStatusEffectArmorDamageMods(unit: LiveBattleUnit): Record<string, number> {
  const mods: Record<string, number> = {};
  
  for (const activeEffect of unit.activeStatusEffects) {
    const effect = getStatusEffect(activeEffect.effectId);
    if (!effect?.stun_armor_damage_mods) continue;
    
    for (const [damageType, modifier] of Object.entries(effect.stun_armor_damage_mods)) {
      if (!mods[damageType] || modifier > mods[damageType]) {
        mods[damageType] = modifier;
      }
    }
  }
  
  return mods;
}

// Check if unit has a stun/freeze effect that bypasses armor (for Active armor units)
export function hasArmorBypassingStun(unit: LiveBattleUnit, unitArmorDefenseStyle?: string): boolean {
  // Only Riot Trooper and Armadillo (Active armor style) bypass armor when stunned
  if (unitArmorDefenseStyle !== 'active') return false;
  
  return unit.activeStatusEffects.some(e => e.isStun);
}

// Initialize a live battle unit from party/encounter unit
export function createLiveBattleUnit(
  unitId: number,
  gridId: number,
  rank: number,
  isEnemy: boolean
): LiveBattleUnit | null {
  const unit = getUnitById(unitId);
  if (!unit) return null;

  const stats = unit.statsConfig?.stats?.[rank - 1];
  const hp = stats?.hp || 100;
  const armor = stats?.armor_hp || 0;

  // Initialize weapon ammo
  const weaponAmmo: Record<string, number> = {};
  const weaponReloadCooldown: Record<string, number> = {};
  
  if (unit.weapons?.weapons) {
    for (const [weaponName, weapon] of Object.entries(unit.weapons.weapons)) {
      // -1 means infinite ammo
      weaponAmmo[weaponName] = weapon.stats.ammo === -1 ? -1 : weapon.stats.ammo;
      weaponReloadCooldown[weaponName] = 0;
    }
  }

  return {
    unitId,
    gridId,
    rank,
    isEnemy,
    currentHp: hp,
    maxHp: hp,
    currentArmor: armor,
    maxArmor: armor,
    isDead: false,
    abilityCooldowns: {},
    weaponGlobalCooldown: {},
    weaponAmmo,
    weaponReloadCooldown,
    activeStatusEffects: [],
    abilityChargeProgress: {},
  };
}

// Initialize battle state from encounter and party
export function initializeBattle(
  friendlyParty: PartyUnit[],
  enemyWaves: EncounterUnit[][],
  startingWave: number = 0
): LiveBattleState {
  const friendlyUnits = friendlyParty
    .map(u => createLiveBattleUnit(u.unitId, u.gridId, u.rank, false))
    .filter((u): u is LiveBattleUnit => u !== null);

  const currentWaveUnits = enemyWaves[startingWave] || [];
  const enemyUnits = currentWaveUnits
    .filter(u => u.grid_id !== undefined)
    .map(u => {
      const unit = getUnitById(u.unit_id);
      const maxRank = unit?.statsConfig?.stats?.length || 1;
      return createLiveBattleUnit(u.unit_id, u.grid_id!, maxRank, true);
    })
    .filter((u): u is LiveBattleUnit => u !== null);

  return {
    friendlyUnits,
    enemyUnits,
    friendlyCollapsedRows: new Set<number>(),
    enemyCollapsedRows: new Set<number>(),
    currentTurn: 1,
    isPlayerTurn: true, // Player always goes first
    currentEnemyIndex: 0, // Start from first enemy
    battleLog: [],
    isBattleOver: false,
    isPlayerVictory: null,
    currentWave: startingWave,
    totalWaves: enemyWaves.length,
  };
}

// Roll random damage between min and max
export function rollDamage(minDamage: number, maxDamage: number): number {
  return Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
}

// Roll for dodge (returns true if attack misses)
export function rollDodge(dodgeChance: number): boolean {
  if (dodgeChance <= 0) return false;
  return Math.random() * 100 < dodgeChance;
}

// Roll for critical hit
export function rollCrit(critChance: number): boolean {
  if (critChance <= 0) return false;
  return Math.random() * 100 < critChance;
}

// Roll for status effect application
export function rollStatusEffect(chance: number): boolean {
  if (chance <= 0) return false;
  return Math.random() * 100 < chance;
}

// Check if a weapon has enough ammo for an ability
function hasEnoughAmmo(unit: LiveBattleUnit, ability: AbilityInfo): boolean {
  // -1 means infinite ammo
  if (ability.weaponMaxAmmo === -1) return true;
  
  // Check if weapon is reloading
  if (unit.weaponReloadCooldown[ability.weaponName] > 0) return false;
  
  // Check if enough ammo
  const currentAmmo = unit.weaponAmmo[ability.weaponName] ?? 0;
  return currentAmmo >= ability.ammoRequired;
}

// Get available abilities for a unit (respecting cooldowns and ammo)
export function getAvailableAbilities(
  unit: LiveBattleUnit,
  allEnemies: LiveBattleUnit[],
  allFriendlies: LiveBattleUnit[],
  friendlyCollapsedRows?: Set<number>,
  enemyCollapsedRows?: Set<number>
): AbilityInfo[] {
  const abilities = getUnitAbilities(unit.unitId, unit.rank);
  console.log(`[getAvailableAbilities] Unit ${unit.unitId} has ${abilities.length} total abilities`);
  
  const available = abilities.filter(ability => {
    // Check ability-specific cooldown
    const abilityCooldown = unit.abilityCooldowns[ability.abilityId] ?? 0;
    console.log(`[getAvailableAbilities] Ability ${ability.abilityId} (${ability.weaponName}): abilityCooldown=${abilityCooldown} (from unit.abilityCooldowns), ability.cooldown=${ability.cooldown}`);
    if (abilityCooldown > 0) {
      console.log(`[getAvailableAbilities] Ability ${ability.abilityId} is on cooldown (${abilityCooldown} turns remaining)`);
      return false;
    }
    
    // Check charge time (prep time) - ability needs to charge before it can be used
    if (ability.chargeTime > 0) {
      const chargeProgress = unit.abilityChargeProgress[ability.abilityId] ?? 0;
      console.log(`[getAvailableAbilities] Ability ${ability.abilityId} has chargeTime=${ability.chargeTime}, chargeProgress=${chargeProgress}`);
      if (chargeProgress < ability.chargeTime) {
        console.log(`[getAvailableAbilities] Ability ${ability.abilityId} is still charging (${chargeProgress}/${ability.chargeTime} turns)`);
        return false;
      }
    }
    
    // Check weapon global cooldown - blocks ALL abilities on this weapon
    const weaponCooldown = unit.weaponGlobalCooldown[ability.weaponName] ?? 0;
    console.log(`[getAvailableAbilities] Ability ${ability.abilityId} (${ability.weaponName}): weaponGlobalCooldown=${weaponCooldown} (from unit.weaponGlobalCooldown), ability.globalCooldown=${ability.globalCooldown}`);
    if (weaponCooldown > 0) {
      console.log(`[getAvailableAbilities] Ability ${ability.abilityId} blocked by weapon global cooldown (weapon: ${ability.weaponName}, ${weaponCooldown} turns remaining)`);
      return false;
    }
    
    // Check ammo
    if (!hasEnoughAmmo(unit, ability)) {
      console.log(`[getAvailableAbilities] Ability ${ability.abilityId} has no ammo`);
      return false;
    }

    // Check if there's at least one valid target
    const targets = unit.isEnemy ? allFriendlies : allEnemies;
    const aliveTargets = targets.filter(t => !t.isDead);
    
    // Determine which collapsed rows to use based on who is attacking
    const attackerCollapsedRows = unit.isEnemy ? enemyCollapsedRows : friendlyCollapsedRows;
    const targetCollapsedRows = unit.isEnemy ? friendlyCollapsedRows : enemyCollapsedRows;

    // For Contact line of fire, check if there's at least one valid target at the closest range
    if (ability.lineOfFire === 0) { // Contact
      // Find the minimum range that has valid targetable units
      let closestRange = Infinity;
      for (const target of aliveTargets) {
        const range = calculateRange(unit.gridId, target.gridId, unit.isEnemy, attackerCollapsedRows, targetCollapsedRows);
        if (range >= ability.minRange && range <= ability.maxRange) {
          if (canTargetUnit(target.unitId, ability.targets)) {
            if (range < closestRange) {
              closestRange = range;
            }
          }
        }
      }
      if (closestRange === Infinity) {
        console.log(`[getAvailableAbilities] Ability ${ability.abilityId} (Contact) has no valid targets`);
        return false;
      }
      console.log(`[getAvailableAbilities] Ability ${ability.abilityId} (Contact) has targets at range ${closestRange}`);
      return true;
    }

    // For other line of fire types, check blocking
    const blockingUnits = getBlockingUnits(
      aliveTargets.map(u => ({ unit_id: u.unitId, grid_id: u.gridId })),
      true
    );

    for (const target of aliveTargets) {
      if (!canTargetUnit(target.unitId, ability.targets)) continue;
      const range = calculateRange(unit.gridId, target.gridId, unit.isEnemy, attackerCollapsedRows, targetCollapsedRows);
      if (range < ability.minRange || range > ability.maxRange) continue;
      const blockCheck = checkLineOfFire(unit.gridId, target.gridId, ability.lineOfFire, unit.isEnemy, blockingUnits);
      if (!blockCheck.isBlocked) {
        console.log(`[getAvailableAbilities] Ability ${ability.abilityId} has valid target ${target.unitId}`);
        return true;
      }
    }
    
    console.log(`[getAvailableAbilities] Ability ${ability.abilityId} has no valid targets`);
    return false;
  });
  
  console.log(`[getAvailableAbilities] Unit ${unit.unitId} has ${available.length} available abilities`);
  return available;
}

// Get valid targets for an ability
// strictTagCheck: If true (for enemies), only allow targeting units that match ability's target tags
//                 If false (for players), allow targeting any position within range/LoF
export function getValidTargets(
  attacker: LiveBattleUnit,
  ability: AbilityInfo,
  allEnemies: LiveBattleUnit[],
  allFriendlies: LiveBattleUnit[],
  friendlyCollapsedRows?: Set<number>,
  enemyCollapsedRows?: Set<number>,
  strictTagCheck: boolean = true
): LiveBattleUnit[] {
  const targets = attacker.isEnemy ? allFriendlies : allEnemies;
  const aliveTargets = targets.filter(t => !t.isDead);

  // Determine which collapsed rows to use based on who is attacking
  const attackerCollapsedRows = attacker.isEnemy ? enemyCollapsedRows : friendlyCollapsedRows;
  const targetCollapsedRows = attacker.isEnemy ? friendlyCollapsedRows : enemyCollapsedRows;

  // Only alive units can block
  // Use grid_id format for EncounterUnit-style mapping (isEnemy=true uses grid_id)
  const blockingUnits = getBlockingUnits(
    aliveTargets.map(u => ({ unit_id: u.unitId, grid_id: u.gridId })),
    true // Always use EncounterUnit format (grid_id) since we're mapping with grid_id
  );

  // For Contact line of fire, target the closest unit in EACH column (not overall closest)
  if (ability.lineOfFire === 0) { // Contact
    console.log(`[getValidTargets-Contact] Attacker grid ${attacker.gridId}, isEnemy=${attacker.isEnemy}, abilityId=${ability.abilityId}`);

    // Group targets by column (x coordinate), find closest in each column
    const columnClosest: Map<number, { target: LiveBattleUnit; range: number }> = new Map();

    for (const target of aliveTargets) {
      const range = calculateRange(attacker.gridId, target.gridId, attacker.isEnemy, attackerCollapsedRows, targetCollapsedRows);
      if (range < ability.minRange || range > ability.maxRange) continue;
      // Only check tag targeting if strictTagCheck is enabled (for enemies)
      if (strictTagCheck && !canTargetUnit(target.unitId, ability.targets)) continue;

      const coords = GRID_ID_TO_COORDS[target.gridId];
      if (!coords) continue;

      const column = coords.x;
      const existing = columnClosest.get(column);

      // Keep the closest unit in this column (smallest range)
      if (!existing || range < existing.range) {
        columnClosest.set(column, { target, range });
      }
    }

    const validTargets = Array.from(columnClosest.values()).map(v => v.target);
    console.log(`[getValidTargets-Contact] Returning ${validTargets.length} valid targets (closest per column):`,
      validTargets.map(t => ({ gridId: t.gridId, range: calculateRange(attacker.gridId, t.gridId, attacker.isEnemy, attackerCollapsedRows, targetCollapsedRows) })));
    return validTargets;
  }

  return aliveTargets.filter(target => {
    // Only check tag targeting if strictTagCheck is enabled (for enemies)
    if (strictTagCheck && !canTargetUnit(target.unitId, ability.targets)) return false;

    // Check range
    const range = calculateRange(attacker.gridId, target.gridId, attacker.isEnemy, attackerCollapsedRows, targetCollapsedRows);
    if (range < ability.minRange || range > ability.maxRange) return false;
    
    // Check line of fire
    const blockCheck = checkLineOfFire(
      attacker.gridId,
      target.gridId,
      ability.lineOfFire,
      attacker.isEnemy,
      blockingUnits
    );
    
    // Debug logging for blocking
    console.log(`[getValidTargets] Attacker grid ${attacker.gridId} -> Target grid ${target.gridId}, ` +
      `lineOfFire: ${ability.lineOfFire}, blocked: ${blockCheck.isBlocked}, ` +
      `reason: ${blockCheck.reason || 'none'}, blockedBy: ${blockCheck.blockedBy?.unitId || 'none'}`);
    
    return !blockCheck.isBlocked;
  });
}

// Detect collapsed rows - rows where no alive units exist
// Returns a Set of collapsed row indices (0=front, 1=middle, 2=back)
// Rows collapse from front to back: if row 0 is empty, it collapses.
// Row 1 only collapses if row 0 is also empty or collapsed.
// IMPORTANT: Only one new row can collapse per turn to prevent instant multi-row collapse
export function detectCollapsedRows(units: LiveBattleUnit[], previousCollapsedRows: Set<number> = new Set()): Set<number> {
  const aliveUnits = units.filter(u => !u.isDead);
  const collapsedRows = new Set(previousCollapsedRows); // Start with previous collapsed rows

  // Check each row from front (0) to back (2)
  for (let row = 0; row <= 2; row++) {
    // Skip if this row is already collapsed
    if (collapsedRows.has(row)) continue;

    const unitsInRow = aliveUnits.filter(u => {
      const coords = GRID_ID_TO_COORDS[u.gridId];
      return coords?.y === row;
    });

    // A row is eligible to collapse if:
    // 1. It has no alive units
    // 2. All rows in front of it are also collapsed (cascading collapse from front)
    if (unitsInRow.length === 0) {
      // Check if all previous rows are collapsed
      let allPreviousCollapsed = true;
      for (let prevRow = 0; prevRow < row; prevRow++) {
        if (!collapsedRows.has(prevRow)) {
          allPreviousCollapsed = false;
          break;
        }
      }

      // Only collapse this row if it's the front row or all previous rows are collapsed
      if (row === 0 || allPreviousCollapsed) {
        collapsedRows.add(row);
        // CRITICAL: Only collapse one new row per turn
        // Return immediately after adding the first new collapsed row
        break;
      }
    }
  }

  return collapsedRows;
}

// Legacy function kept for backwards compatibility, now just updates collapsed rows state
export function collapseGrid(units: LiveBattleUnit[], previousCollapsedRows?: Set<number>): Set<number> {
  return detectCollapsedRows(units, previousCollapsedRows);
}

// Execute an attack and return the actions
export function executeAttack(
  attacker: LiveBattleUnit,
  ability: AbilityInfo,
  targetGridId: number,
  state: LiveBattleState,
  environmentalDamageMods?: Record<string, number>
): BattleAction[] {
  const actions: BattleAction[] = [];
  const allTargets = attacker.isEnemy ? state.friendlyUnits : state.enemyUnits;
  const aliveTargets = allTargets.filter(t => !t.isDead);
  
  // Build blocking units map for line of fire checks
  const blockingUnits = getBlockingUnits(
    aliveTargets.map(u => ({ unit_id: u.unitId, grid_id: u.gridId })),
    true
  );
  
  // Get attacker name
  const attackerUnit = getUnitById(attacker.unitId);
  const attackerName = attackerUnit?.identity?.name || `Unit ${attacker.unitId}`;
  
  // Get affected positions (for AOE/fixed attacks)
  let affectedPositions: { gridId: number; damagePercent: number }[];
  
  // Check if this is a "single-selection with splash" ability:
  // - Has damageArea with non-center positions (splash)
  // - targetArea is either missing, or only has center position (no movable reticle)
  const hasNonCenterSplash = ability.damageArea?.some(d => d.x !== 0 || d.y !== 0) ?? false;
  const targetAreaHasOnlyCenter = !ability.targetArea || 
    (ability.targetArea.data.length === 1 && 
     ability.targetArea.data[0].x === 0 && 
     ability.targetArea.data[0].y === 0);
  const isSingleSelectionWithSplash = hasNonCenterSplash && targetAreaHasOnlyCenter;
  
  if (ability.isSingleTarget && !ability.damageArea) {
    // Pure single-target: only the selected target gets hit
    affectedPositions = [{ gridId: targetGridId, damagePercent: 100 }];
  } else if (isSingleSelectionWithSplash) {
    // Single-selection with splash damage (like Legendary Sandworm's Maul)
    // Create a synthetic targetArea with just the center point, then apply damageArea
    const syntheticTargetArea: TargetArea = {
      targetType: 2,
      data: [{ x: 0, y: 0, damagePercent: 100 }],
    };
    affectedPositions = getAffectedGridPositions(targetGridId, syntheticTargetArea, !attacker.isEnemy, ability.damageArea);
  } else if (ability.isFixed && ability.targetArea) {
    // Fixed AOE pattern (like Heavy Chem Tank cone) - hits all positions in pattern
    // Pass collapsed rows so the pattern accounts for row collapse
    const attackerCollapsedRows = attacker.isEnemy ? state.enemyCollapsedRows : state.friendlyCollapsedRows;
    const targetCollapsedRows = attacker.isEnemy ? state.friendlyCollapsedRows : state.enemyCollapsedRows;
    const fixedPos = getFixedAttackPositions(
      attacker.gridId,
      ability.targetArea,
      !attacker.isEnemy,
      attackerCollapsedRows,
      targetCollapsedRows
    );
    console.log(`[executeAttack-fixed] Attacker gridId=${attacker.gridId}, isEnemy=${attacker.isEnemy}, isAttackerFriendly=${!attacker.isEnemy}`);
    console.log(`[executeAttack-fixed] Raw positions:`, JSON.stringify(fixedPos.map(p => ({ gridId: p.gridId, damagePercent: p.damagePercent, isOnEnemyGrid: p.isOnEnemyGrid }))));
    // Filter to only hit positions on the ENEMY grid (from attacker's perspective)
    const enemyPositions = fixedPos.filter(p => p.isOnEnemyGrid);
    console.log(`[executeAttack-fixed] Enemy grid positions only:`, JSON.stringify(enemyPositions.map(p => ({ gridId: p.gridId, damagePercent: p.damagePercent }))));
    affectedPositions = enemyPositions.map(p => ({ gridId: p.gridId, damagePercent: p.damagePercent }));
  } else if (ability.targetArea) {
    // AOE with movable reticle - hits positions around selected target
    affectedPositions = getAffectedGridPositions(targetGridId, ability.targetArea, !attacker.isEnemy, ability.damageArea);
  } else {
    // Fallback: just the target
    affectedPositions = [{ gridId: targetGridId, damagePercent: 100 }];
  }
  
  // Deduplicate: each grid position should only be hit once per attack
  // If same position appears multiple times, take the highest damage percent
  const positionMap = new Map<number, number>();
  for (const pos of affectedPositions) {
    const existing = positionMap.get(pos.gridId);
    if (existing === undefined || pos.damagePercent > existing) {
      positionMap.set(pos.gridId, pos.damagePercent);
    }
  }
  affectedPositions = Array.from(positionMap.entries()).map(([gridId, damagePercent]) => ({ gridId, damagePercent }));

  const abilityData = getAbilityById(ability.abilityId);
  const abilityName = abilityData?.name || `Ability ${ability.abilityId}`;
  
  const totalShots = ability.shotsPerAttack * ability.attacksPerUse;
  console.log(`[executeAttack] Ability ${ability.abilityId}: shotsPerAttack=${ability.shotsPerAttack}, attacksPerUse=${ability.attacksPerUse}, totalShots=${totalShots}, isFixed=${ability.isFixed}, isSingleTarget=${ability.isSingleTarget}, lineOfFire=${ability.lineOfFire}, affectedPositions=${affectedPositions.length}`);

  // Determine if this is an AOE or splash attack that should check reticle blocking instead of per-position
  // For these attacks, blocking is checked once for the reticle/primary target, not each affected position
  // target_type: 2 = movable reticle AOE (like column attacks) - check reticle blocking
  // target_type: 1 = fixed pattern (like turrets) - check blocking per position
  const isAoeOrSplashAttack = isSingleSelectionWithSplash ||
                               (ability.targetArea && ability.targetArea.targetType === 2);

  // For AOE/splash attacks, validate reticle blocking once BEFORE processing targets
  if (isAoeOrSplashAttack) {
    const reticleBlockCheck = checkLineOfFire(
      attacker.gridId,
      targetGridId,
      ability.lineOfFire,
      attacker.isEnemy,
      blockingUnits
    );

    console.log(`[executeAttack-reticle] AOE/Splash attack - checking reticle blocking at grid ${targetGridId}, isBlocked: ${reticleBlockCheck.isBlocked}, reason: ${reticleBlockCheck.reason || 'none'}`);

    if (reticleBlockCheck.isBlocked) {
      console.log(`[executeAttack] AOE/Splash attack blocked - reticle at grid ${targetGridId} is blocked by unit ${reticleBlockCheck.blockedBy?.unitId}`);
      return actions; // Entire AOE/splash attack is blocked
    }
  }

  for (const pos of affectedPositions) {
    const target = allTargets.find(u => u.gridId === pos.gridId && !u.isDead);
    if (!target) continue;

    // **CRITICAL**: Validate that target can be targeted by this ability (tag validation)
    // For enemy attackers: skip immune units silently
    // For player attackers: allow attack but log immunity
    if (!canTargetUnit(target.unitId, ability.targets)) {
      const targetUnit = getUnitById(target.unitId);
      const targetName = targetUnit?.identity?.name || `Unit ${target.unitId}`;
      
      if (attacker.isEnemy) {
        // Enemies skip immune targets silently
        console.log(`[executeAttack] Skipping target at grid ${target.gridId} - unit ${target.unitId} cannot be targeted by ability (tag mismatch)`);
        continue;
      } else {
        // Players get an immunity log message
        const immunityReason = getUnitImmunityReason(target.unitId, ability.targets) || "tag mismatch";
        console.log(`[executeAttack] Target ${target.unitId} is immune: ${immunityReason}`);
        actions.push({
          type: "skip",
          attackerGridId: attacker.gridId,
          attackerName,
          targetGridId: target.gridId,
          targetName,
          abilityId: ability.abilityId,
          abilityName,
          message: `${targetName} is immune (${immunityReason})`,
        });
        continue;
      }
    }

    // For non-AOE attacks, check blocking for each individual target
    if (!isAoeOrSplashAttack) {
      const blockCheck = checkLineOfFire(
        attacker.gridId,
        target.gridId,
        ability.lineOfFire,
        attacker.isEnemy,
        blockingUnits
      );

      console.log(`[executeAttack-blocking] Attacker grid ${attacker.gridId} -> Target grid ${target.gridId}, lineOfFire: ${ability.lineOfFire}, isBlocked: ${blockCheck.isBlocked}, reason: ${blockCheck.reason || 'none'}, blockedBy: ${blockCheck.blockedBy?.unitId || 'none'}`);

      if (blockCheck.isBlocked) {
        console.log(`[executeAttack] Skipping target at grid ${target.gridId} - blocked by unit ${blockCheck.blockedBy?.unitId}`);
        continue; // Skip this individual target
      }
    }
    
    const targetUnit = getUnitById(target.unitId);
    const targetName = targetUnit?.identity?.name || `Unit ${target.unitId}`;
    const targetStats = targetUnit?.statsConfig?.stats?.[target.rank - 1];
    const defense = targetStats?.defense || 0;
    
    // Reduce dodge chance if target is stunned/frozen
    const isStunned = target.activeStatusEffects.some(e => e.isStun);
    const stunDodgePenalty = isStunned ? 20 : 0; // Stunned units have reduced dodge
    const effectiveDodgeChance = Math.max(0, calculateDodgeChance(defense, ability.offense) - stunDodgePenalty);
    
    // Calculate crit chance with bonuses (includes unit base crit + ability crit + tag bonuses with hierarchy)
    const critChance = calculateCritChance(
      ability.unitBaseCrit,
      ability.critPercent,
      ability.critBonuses,
      target.unitId
    );
    
    // Roll dodge
    if (rollDodge(effectiveDodgeChance)) {
      actions.push({
        type: "dodge",
        attackerGridId: attacker.gridId,
        attackerName,
        targetGridId: target.gridId,
        targetName,
        abilityId: ability.abilityId,
        abilityName,
        wasDodged: true,
        message: `Attack dodged!`,
      });
      continue;
    }
    
    // Get status effect damage modifiers from target
    const statusDamageMods = getStatusEffectDamageMods(target);
    const statusArmorDamageMods = getStatusEffectArmorDamageMods(target);
    
    // Check if armor is bypassed due to stun (Active armor units only)
    // armor_def_style: 1 = Passive, 2 = Active
    const armorDefStyle = targetStats?.armor_def_style;
    const bypassArmor = armorDefStyle === 2 && isStunned;
    
    // Roll damage for all shots
    let totalArmorDamage = 0;
    let totalHpDamage = 0;
    
    for (let shot = 0; shot < totalShots; shot++) {
      // Roll base damage
      const baseDamage = rollDamage(ability.minDamage, ability.maxDamage);
      
      // Apply damage percent modifier
      const adjustedDamage = Math.floor(baseDamage * (pos.damagePercent / 100));
      
      // Roll crit
      const isCrit = rollCrit(critChance);
      const critMultiplier = isCrit ? 2 : 1;
      const finalBaseDamage = Math.floor(adjustedDamage * critMultiplier);
      
      // Calculate damage with armor and status effect modifiers
      const result = calculateDamageWithArmor(
        finalBaseDamage,
        target.currentArmor,
        targetStats?.armor_damage_mods,
        targetStats?.damage_mods,
        ability.damageType,
        ability.armorPiercing,
        environmentalDamageMods,
        Object.keys(statusDamageMods).length > 0 ? statusDamageMods : undefined,
        Object.keys(statusArmorDamageMods).length > 0 ? statusArmorDamageMods : undefined,
        bypassArmor
      );
      
      // Apply damage
      target.currentArmor = Math.max(0, target.currentArmor - result.armorDamage);
      target.currentHp = Math.max(0, target.currentHp - result.hpDamage);
      
      totalArmorDamage += result.armorDamage;
      totalHpDamage += result.hpDamage;
      
      if (isCrit) {
        actions.push({
          type: "crit",
          attackerGridId: attacker.gridId,
          attackerName,
          targetGridId: target.gridId,
          targetName,
          abilityId: ability.abilityId,
          wasCrit: true,
          message: `Critical hit!`,
        });
      }
    }
    
    actions.push({
      type: "attack",
      attackerGridId: attacker.gridId,
      attackerName,
      targetGridId: target.gridId,
      targetName,
      abilityId: ability.abilityId,
      abilityName,
      damage: totalArmorDamage + totalHpDamage,
      armorDamage: totalArmorDamage,
      hpDamage: totalHpDamage,
      message: `Dealt ${totalHpDamage} HP damage${totalArmorDamage > 0 ? ` and ${totalArmorDamage} armor damage` : ''}`,
    });
    
    // Check for death
    if (target.currentHp <= 0) {
      target.isDead = true;
      actions.push({
        type: "death",
        targetGridId: target.gridId,
        targetName,
        message: `${targetName} defeated!`,
      });
    }
    
    // Apply status effects (scaled by damage percent)
    const immunities = targetUnit?.statsConfig?.status_effect_immunities || [];
    for (const [effectIdStr, chance] of Object.entries(ability.statusEffects)) {
      const effectId = parseInt(effectIdStr);
      const effect = getStatusEffect(effectId);
      if (!effect) continue;
      
      // Check immunity
      if (immunities.includes(effect.family)) continue;
      
      // Scale chance by damage percent
      const adjustedChance = Math.floor(chance * (pos.damagePercent / 100));
      
      if (rollStatusEffect(adjustedChance)) {
        // Calculate base DoT damage: (actualDamageDealt + dot_bonus_damage) * dot_ability_damage_mult
        // Environmental modifiers will be applied via resistances when DoT ticks, not to base damage
        const actualDamageDealt = totalHpDamage + totalArmorDamage;
        const dotBonusDamage = effect.dot_bonus_damage ?? 0;
        const dotAbilityDamageMult = effect.dot_ability_damage_mult ?? 1;

        let dotDamage = actualDamageDealt + dotBonusDamage;

        // Environmental modifiers are NO LONGER applied to base DoT damage
        // They will be applied via resistances when the DoT actually ticks

        // Apply ability damage multiplier
        dotDamage = Math.floor(dotDamage * dotAbilityDamageMult);
        
        const isStun = effect.stun_block_action === true;
        const dotDiminishing = effect.dot_diminishing ?? false;
        
        // Add or refresh status effect
        const existingEffect = target.activeStatusEffects.find(e => e.effectId === effectId);
        if (existingEffect) {
          existingEffect.remainingDuration = effect.duration;
          // Reset DoT tracking on refresh
          existingEffect.originalDotDamage = dotDamage;
          existingEffect.originalDuration = effect.duration;
          existingEffect.dotDamage = dotDamage;
          existingEffect.currentTurn = 1;
          existingEffect.dotDiminishing = dotDiminishing;
        } else {
          target.activeStatusEffects.push({
            effectId,
            remainingDuration: effect.duration,
            dotDamage,
            dotDamageType: effect.dot_damage_type || null,
            isStun,
            originalDotDamage: dotDamage,
            originalDuration: effect.duration,
            currentTurn: 1,
            dotDiminishing,
          });
        }
        
        const effectName = getEffectDisplayNameTranslated(effectId);
        
        actions.push({
          type: "status_applied",
          targetGridId: target.gridId,
          targetName,
          statusEffectId: effectId,
          statusEffectName: effectName,
          message: `${effectName} applied for ${effect.duration} turns`,
        });
      }
    }
  }
  
  // Set cooldowns (add +1 because cooldowns are reduced at end of turn, so we need to account for that)
  console.log(`[executeAttack] Ability ${ability.abilityId} used. weaponName="${ability.weaponName}", ability.cooldown=${ability.cooldown}, ability.globalCooldown=${ability.globalCooldown}`);
  console.log(`[executeAttack] Current weaponGlobalCooldowns BEFORE setting:`, JSON.stringify(attacker.weaponGlobalCooldown));
  
  if (ability.cooldown > 0) {
    attacker.abilityCooldowns[ability.abilityId] = ability.cooldown + 1;
    console.log(`[executeAttack] Set ability ${ability.abilityId} cooldown to ${ability.cooldown + 1}`);
  }
  // Set weapon global cooldown based on ability's globalCooldown value
  if (ability.globalCooldown > 0) {
    attacker.weaponGlobalCooldown[ability.weaponName] = ability.globalCooldown + 1;
    console.log(`[executeAttack] Set weapon "${ability.weaponName}" cooldown to ${ability.globalCooldown + 1} for unit gridId ${attacker.gridId}`);
  }
  console.log(`[executeAttack] Current weaponGlobalCooldowns AFTER setting:`, JSON.stringify(attacker.weaponGlobalCooldown));
  
  // Note: Charge/prep time is NOT reset after use - it only applies once at battle start
  
  // Consume ammo
  if (ability.weaponMaxAmmo !== -1 && ability.ammoRequired > 0) {
    const currentAmmo = attacker.weaponAmmo[ability.weaponName] ?? 0;
    attacker.weaponAmmo[ability.weaponName] = Math.max(0, currentAmmo - ability.ammoRequired);
    
    if (attacker.weaponAmmo[ability.weaponName] === 0 && ability.weaponReloadTime > 0) {
      attacker.weaponReloadCooldown[ability.weaponName] = ability.weaponReloadTime;
    }
  }
  
  return actions;
}

// Check if ability uses random targeting
export function isRandomAttack(ability: AbilityInfo): boolean {
  return ability.targetArea?.random === true;
}

// Execute a random attack (for abilities with random: true in targetArea)
export function executeRandomAttack(
  attacker: LiveBattleUnit,
  ability: AbilityInfo,
  state: LiveBattleState,
  environmentalDamageMods?: Record<string, number>
): BattleAction[] {
  const actions: BattleAction[] = [];
  const allTargets = attacker.isEnemy ? state.friendlyUnits : state.enemyUnits;
  const targetArea = ability.targetArea;
  
  if (!targetArea?.random || !targetArea.data || targetArea.data.length === 0) {
    return actions;
  }
  
  // Get attacker name
  const attackerUnit = getUnitById(attacker.unitId);
  const attackerName = attackerUnit?.identity?.name || `Unit ${attacker.unitId}`;
  
  const abilityData = getAbilityById(ability.abilityId);
  const abilityName = abilityData?.name || `Ability ${ability.abilityId}`;
  
  const allGridPositions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13];
  // Total shots comes from the ability's attack configuration, not targetArea.data.length
  const totalHits = ability.shotsPerAttack * ability.attacksPerUse;
  const totalWeight = targetArea.data.reduce((sum, pos) => sum + (pos.weight || 1), 0);
  
  const damagePerPosition: Record<number, { damage: number; hits: number }> = {};
  const emptySpotHits: Record<number, number> = {}; // Track hits on empty spots
  
  for (let i = 0; i < totalHits; i++) {
    const roll = Math.random() * totalWeight;
    let cumulative = 0;
    let selectedIndex = 0;
    
    for (let j = 0; j < targetArea.data.length; j++) {
      cumulative += (targetArea.data[j].weight || 1);
      if (roll < cumulative) {
        selectedIndex = j;
        break;
      }
    }
    
    const selectedPos = targetArea.data[selectedIndex];
    const centerGridId = allGridPositions[Math.floor(allGridPositions.length / 2)];
    const centerCoords = GRID_ID_TO_COORDS[centerGridId];
    
    if (centerCoords) {
      const targetX = centerCoords.x + (selectedPos.x || 0);
      const targetY = centerCoords.y + (selectedPos.y || 0);
      const targetGridId = COORDS_TO_GRID_ID[`${targetX},${targetY}`];
      
      if (targetGridId !== undefined) {
        // Check if there's a target at this position
        const target = allTargets.find(t => t.gridId === targetGridId && !t.isDead);
        if (target) {
          if (!damagePerPosition[targetGridId]) {
            damagePerPosition[targetGridId] = { damage: 0, hits: 0 };
          }
          damagePerPosition[targetGridId].hits++;
        } else {
          // Hit landed on empty spot
          emptySpotHits[targetGridId] = (emptySpotHits[targetGridId] || 0) + 1;
        }
      }
    }
  }
  
  // Log empty spot hits
  for (const [gridIdStr, hits] of Object.entries(emptySpotHits)) {
    const gridId = parseInt(gridIdStr);
    actions.push({
      type: "skip",
      attackerGridId: attacker.gridId,
      attackerName,
      targetGridId: gridId,
      abilityId: ability.abilityId,
      abilityName,
      hitCount: hits,
      message: `${hits} hit${hits > 1 ? 's' : ''} landed on empty position (${gridId})`,
    });
  }
  
  for (const [gridIdStr, { hits }] of Object.entries(damagePerPosition)) {
    const gridId = parseInt(gridIdStr);
    const target = allTargets.find(t => t.gridId === gridId && !t.isDead);
    if (!target) continue;
    
    // **CRITICAL**: Validate that target can be targeted by this ability (tag validation)
    // For enemy attackers: skip immune units silently (but log hit for random)
    // For player attackers: show immunity message with reason
    if (!canTargetUnit(target.unitId, ability.targets)) {
      const targetUnit = getUnitById(target.unitId);
      const targetName = targetUnit?.identity?.name || `Unit ${target.unitId}`;
      
      if (attacker.isEnemy) {
        // Enemies skip immune targets with a generic message
        console.log(`[executeRandomAttack] Skipping target at grid ${target.gridId} - unit ${target.unitId} cannot be targeted by ability (tag mismatch)`);
        actions.push({
          type: "skip",
          attackerGridId: attacker.gridId,
          attackerName,
          targetGridId: gridId,
          abilityId: ability.abilityId,
          abilityName,
          hitCount: hits,
          message: `${hits} hit${hits > 1 ? 's' : ''} missed - cannot target this unit type`,
        });
      } else {
        // Players get an immunity log message with reason
        const immunityReason = getUnitImmunityReason(target.unitId, ability.targets) || "tag mismatch";
        console.log(`[executeRandomAttack] Target ${target.unitId} is immune: ${immunityReason}`);
        actions.push({
          type: "skip",
          attackerGridId: attacker.gridId,
          attackerName,
          targetGridId: gridId,
          targetName,
          abilityId: ability.abilityId,
          abilityName,
          hitCount: hits,
          message: `${targetName} is immune (${immunityReason})`,
        });
      }
      continue;
    }
    
    const targetUnit = getUnitById(target.unitId);
    const targetName = targetUnit?.identity?.name || `Unit ${target.unitId}`;
    const targetStats = targetUnit?.statsConfig?.stats?.[target.rank - 1];
    const defense = targetStats?.defense || 0;
    const dodgeChance = calculateDodgeChance(defense, ability.offense);
    
    let totalDamage = 0;
    let totalArmorDamage = 0;
    let totalHpDamage = 0;
    
    for (let h = 0; h < hits; h++) {
      if (rollDodge(dodgeChance)) {
        actions.push({
          type: "dodge",
          attackerGridId: attacker.gridId,
          attackerName,
          targetGridId: target.gridId,
          targetName,
          wasDodged: true,
          message: "Attack dodged!",
        });
        continue;
      }
      
      const baseDamage = rollDamage(ability.minDamage, ability.maxDamage);
      // Calculate crit chance with tag bonuses and unit base crit
      const critChance = calculateCritChance(
        ability.unitBaseCrit,
        ability.critPercent,
        ability.critBonuses,
        target.unitId
      );
      const isCrit = rollCrit(critChance);
      const finalDamage = isCrit ? Math.floor(baseDamage * 2) : baseDamage;
      
      if (isCrit) {
        actions.push({
          type: "crit",
          attackerGridId: attacker.gridId,
          attackerName,
          targetGridId: target.gridId,
          targetName,
          wasCrit: true,
          message: "Critical hit!",
        });
      }
      
      const statusDamageMods = getStatusEffectDamageMods(target);
      const statusArmorDamageMods = getStatusEffectArmorDamageMods(target);
      const bypassArmor = hasArmorBypassingStun(target, targetStats?.armor_def_style === 1 ? 'active' : 'passive');
      
      const damageResult = calculateDamageWithArmor(
        finalDamage,
        target.currentArmor,
        targetStats?.armor_damage_mods,
        targetStats?.damage_mods,
        ability.damageType,
        ability.armorPiercing,
        environmentalDamageMods,
        statusDamageMods,
        statusArmorDamageMods,
        bypassArmor
      );
      
      target.currentArmor = Math.max(0, target.currentArmor - damageResult.armorDamage);
      target.currentHp = Math.max(0, target.currentHp - damageResult.hpDamage);
      
      totalDamage += finalDamage;
      totalArmorDamage += damageResult.armorDamage;
      totalHpDamage += damageResult.hpDamage;
    }
    
    if (totalDamage > 0) {
      actions.push({
        type: "attack",
        attackerGridId: attacker.gridId,
        attackerName,
        targetGridId: target.gridId,
        targetName,
        abilityId: ability.abilityId,
        abilityName,
        damage: totalArmorDamage + totalHpDamage,
        armorDamage: totalArmorDamage,
        hpDamage: totalHpDamage,
        hitCount: hits, // Show how many times this position was hit
        message: `Dealt ${totalHpDamage} HP damage${totalArmorDamage > 0 ? ` and ${totalArmorDamage} armor damage` : ''} (${hits} hit${hits > 1 ? 's' : ''})`,
      });
    }
    
    if (target.currentHp <= 0) {
      target.isDead = true;
      actions.push({
        type: "death",
        targetGridId: target.gridId,
        targetName,
        message: `${targetName} defeated!`,
      });
    }
  }
  
  // Set cooldowns
  if (ability.cooldown > 0) {
    attacker.abilityCooldowns[ability.abilityId] = ability.cooldown + 1;
  }
  if (ability.globalCooldown > 0) {
    attacker.weaponGlobalCooldown[ability.weaponName] = ability.globalCooldown + 1;
  }
  
  if (ability.weaponMaxAmmo !== -1 && ability.ammoRequired > 0) {
    const currentAmmo = attacker.weaponAmmo[ability.weaponName] ?? 0;
    attacker.weaponAmmo[ability.weaponName] = Math.max(0, currentAmmo - ability.ammoRequired);
    if (attacker.weaponAmmo[ability.weaponName] === 0 && ability.weaponReloadTime > 0) {
      attacker.weaponReloadCooldown[ability.weaponName] = ability.weaponReloadTime;
    }
  }
  
  return actions;
}

// Process status effect ticks at start of turn
// environmentalDamageMods: Optional damage modifiers from environmental status effects (e.g., Firemod)
export function processStatusEffects(
  units: LiveBattleUnit[],
  environmentalDamageMods?: Record<string, number>
): BattleAction[] {
  const actions: BattleAction[] = [];
  
  for (const unit of units) {
    if (unit.isDead) continue;
    
    const unitData = getUnitById(unit.unitId);
    const unitName = unitData?.identity?.name || `Unit ${unit.unitId}`;
    const unitStats = unitData?.statsConfig?.stats?.[unit.rank - 1];
    
    for (const effect of unit.activeStatusEffects) {
      if (effect.dotDamage > 0 && effect.dotDamageType !== null) {
        // Calculate DoT decay multiplier
        // If dot_diminishing is true: use formula (d-t+1)/d
        // Otherwise: no decay (multiplier = 1)
        let decayMultiplier = 1;

        if (effect.dotDiminishing) {
          const d = effect.originalDuration;
          const t = effect.currentTurn;
          decayMultiplier = (d - t + 1) / d;
        }

        // Apply decay multiplier to base DoT damage
        const rawDotDamage = Math.floor(effect.originalDotDamage * decayMultiplier);

        // Get status effect damage mods from other active effects (like freeze/shatter)
        const statusDamageMods = getStatusEffectDamageMods(unit);
        const statusArmorDamageMods = getStatusEffectArmorDamageMods(unit);

        // Check if armor should be bypassed (active armor units when stunned)
        const bypassArmor = hasArmorBypassingStun(unit, unitStats?.armor_def_style === 1 ? 'active' : 'passive');

        // Calculate damage with armor and resistances
        // Environmental modifiers are applied via resistances (not to base damage)
        const damageResult = calculateDamageWithArmor(
          rawDotDamage,
          unit.currentArmor,
          unitStats?.armor_damage_mods,
          unitStats?.damage_mods,
          effect.dotDamageType,
          0, // DOT has no armor piercing
          environmentalDamageMods, // Environmental mods affect resistances when DOT ticks
          statusDamageMods,
          statusArmorDamageMods,
          bypassArmor
        );
        
        // Apply damage to armor first, then HP
        unit.currentArmor = Math.max(0, unit.currentArmor - damageResult.armorDamage);
        unit.currentHp = Math.max(0, unit.currentHp - damageResult.hpDamage);
        
        const effectName = getEffectDisplayNameTranslated(effect.effectId);
        const turnsLeft = effect.remainingDuration - 1;
        
        // Build damage message parts
        const damageParts: string[] = [];
        if (damageResult.hpDamage > 0) {
          damageParts.push(`${damageResult.hpDamage} HP`);
        }
        if (damageResult.armorDamage > 0) {
          damageParts.push(`${damageResult.armorDamage} armor`);
        }
        const damageText = damageParts.length > 0 ? damageParts.join(' and ') : '0';
        
        actions.push({
          type: "status_tick",
          targetGridId: unit.gridId,
          targetName: unitName,
          statusEffectId: effect.effectId,
          statusEffectName: effectName,
          hpDamage: damageResult.hpDamage,
          armorDamage: damageResult.armorDamage,
          message: `took ${damageText} ${effectName} damage (${turnsLeft}t left)`,
        });
        
        if (unit.currentHp <= 0) {
          unit.isDead = true;
          actions.push({ 
            type: "death", 
            targetGridId: unit.gridId, 
            targetName: unitName,
            statusEffectName: effectName,
            message: `defeated by ${effectName}!` 
          });
        }
      }
    }
    
    // Reduce durations, increment turn counter for decay, and remove expired effects
    unit.activeStatusEffects = unit.activeStatusEffects.filter(e => {
      e.remainingDuration--;
      e.currentTurn++; // Increment turn for next tick's decay calculation
      
      return e.remainingDuration > 0;
    });
  }
  
  return actions;
}

// Calculate turn summary from actions
export function calculateTurnSummary(actions: BattleAction[]): TurnSummary {
  let totalDamage = 0;
  let totalHpDamage = 0;
  let totalArmorDamage = 0;
  let dodges = 0;
  let crits = 0;
  let statusEffectsApplied = 0;
  let kills = 0;
  
  for (const action of actions) {
    if (action.type === 'attack' || action.type === 'status_tick') {
      totalHpDamage += action.hpDamage || 0;
      totalArmorDamage += action.armorDamage || 0;
      totalDamage += (action.hpDamage || 0) + (action.armorDamage || 0);
    }
    if (action.type === 'dodge') {
      dodges++;
    }
    if (action.type === 'crit' || action.wasCrit) {
      crits++;
    }
    if (action.type === 'status_applied') {
      statusEffectsApplied++;
    }
    if (action.type === 'death') {
      kills++;
    }
  }
  
  return { totalDamage, totalHpDamage, totalArmorDamage, dodges, crits, statusEffectsApplied, kills };
}

// Reduce cooldowns and increment charge progress at end of turn
// Check if a unit is stunned/frozen/disabled (cannot act)
export function isUnitStunned(unit: LiveBattleUnit): boolean {
  return unit.activeStatusEffects.some(e => e.isStun);
}

export function reduceCooldowns(units: LiveBattleUnit[]): void {
  for (const unit of units) {
    if (unit.isDead) continue;
    
    // Check if unit is stunned - stunned units don't get cooldown reduction
    const stunned = isUnitStunned(unit);
    if (stunned) {
      console.log(`[reduceCooldowns] Unit ${unit.unitId} is stunned, skipping cooldown reduction`);
      continue;
    }
    
    // Reduce ability cooldowns
    for (const abilityId of Object.keys(unit.abilityCooldowns)) {
      const id = parseInt(abilityId);
      if (unit.abilityCooldowns[id] > 0) {
        unit.abilityCooldowns[id]--;
      }
    }
    
    // Reduce weapon global cooldowns
    for (const weaponName of Object.keys(unit.weaponGlobalCooldown)) {
      if (unit.weaponGlobalCooldown[weaponName] > 0) {
        unit.weaponGlobalCooldown[weaponName]--;
      }
    }
    
    // Handle weapon reload cooldowns
    const unitData = getUnitById(unit.unitId);
    for (const weaponName of Object.keys(unit.weaponReloadCooldown)) {
      if (unit.weaponReloadCooldown[weaponName] > 0) {
        unit.weaponReloadCooldown[weaponName]--;
        if (unit.weaponReloadCooldown[weaponName] === 0) {
          const weapon = unitData?.weapons?.weapons?.[weaponName];
          if (weapon) {
            unit.weaponAmmo[weaponName] = weapon.stats.ammo;
          }
        }
      }
    }
    
    // Increment charge progress for abilities with charge time
    const abilities = getUnitAbilities(unit.unitId, unit.rank);
    for (const ability of abilities) {
      if (ability.chargeTime > 0) {
        const currentProgress = unit.abilityChargeProgress[ability.abilityId] ?? 0;
        // Only increment if not already fully charged
        if (currentProgress < ability.chargeTime) {
          unit.abilityChargeProgress[ability.abilityId] = currentProgress + 1;
          console.log(`[reduceCooldowns] Unit ${unit.unitId} ability ${ability.abilityId} charge progress: ${currentProgress + 1}/${ability.chargeTime}`);
        }
      }
    }
  }
}

// Check if battle is over
export function checkBattleEnd(state: LiveBattleState): { isOver: boolean; playerWon: boolean | null } {
  // Check if any important friendly units are alive
  const friendlyImportantAlive = state.friendlyUnits.some(u => {
    if (u.isDead) return false;
    const unitData = getUnitById(u.unitId);
    const isUnimportant = unitData?.statsConfig?.unimportant === true;
    return !isUnimportant;
  });
  
  if (!friendlyImportantAlive) {
    return { isOver: true, playerWon: false };
  }
  
  // Check if any important enemy units are alive
  // Units with Ignorable tag (like Stone Slab) don't count for victory
  const enemyImportantAlive = state.enemyUnits.some(u => {
    if (u.isDead) return false;
    const unitData = getUnitById(u.unitId);
    const isUnimportant = unitData?.statsConfig?.unimportant === true;
    const tags = unitData?.identity?.tags || [];
    const isIgnorable = tags.includes(UnitTag.Ignorable);
    return !isUnimportant && !isIgnorable;
  });
  
  if (!enemyImportantAlive) {
    if (state.currentWave < state.totalWaves - 1) {
      return { isOver: false, playerWon: null };
    }
    return { isOver: true, playerWon: true };
  }
  
  return { isOver: false, playerWon: null };
}

// AI: Pick a random ability and target
export function aiSelectAction(
  unit: LiveBattleUnit,
  state: LiveBattleState
): { ability: AbilityInfo; targetGridId: number } | null {
  const unitData = getUnitById(unit.unitId);
  const unitName = unitData?.identity?.name || `Unit ${unit.unitId}`;
  
  // Log all abilities for this unit with their cooldown states
  const allAbilities = getUnitAbilities(unit.unitId, unit.rank);
  console.log(`[AI] ${unitName} (grid ${unit.gridId}) - All abilities:`, allAbilities.map(a => ({
    id: a.abilityId,
    weapon: a.weaponName,
    cooldown: a.cooldown,
    globalCooldown: a.globalCooldown
  })));
  console.log(`[AI] ${unitName} - Current ability cooldowns:`, unit.abilityCooldowns);
  console.log(`[AI] ${unitName} - Current weapon global cooldowns:`, unit.weaponGlobalCooldown);
  
  const availableAbilities = getAvailableAbilities(
    unit,
    state.enemyUnits,
    state.friendlyUnits,
    state.friendlyCollapsedRows,
    state.enemyCollapsedRows
  );

  console.log(`[AI] ${unitName} (grid ${unit.gridId}): ${availableAbilities.length} available abilities after filtering`);

  if (availableAbilities.length === 0) {
    console.log(`[AI] ${unitName}: No available abilities`);
    return null;
  }

  const ability = availableAbilities[Math.floor(Math.random() * availableAbilities.length)];
  console.log(`[AI] ${unitName}: Selected ability ${ability.abilityId} (weapon: ${ability.weaponName})`);

  // AI uses strict targeting - must match ability's target tags
  const validTargets = getValidTargets(
    unit,
    ability,
    state.enemyUnits,
    state.friendlyUnits,
    state.friendlyCollapsedRows,
    state.enemyCollapsedRows,
    true // AI requires valid target tags
  );
  console.log(`[AI] ${unitName}: ${validTargets.length} valid targets`);
  
  if (validTargets.length === 0) {
    console.log(`[AI] ${unitName}: No valid targets for selected ability`);
    return null;
  }
  
  const target = validTargets[Math.floor(Math.random() * validTargets.length)];
  const targetData = getUnitById(target.unitId);
  const targetName = targetData?.identity?.name || `Unit ${target.unitId}`;
  console.log(`[AI] ${unitName}: Targeting ${targetName} (grid ${target.gridId})`);
  
  return { ability, targetGridId: target.gridId };
}
