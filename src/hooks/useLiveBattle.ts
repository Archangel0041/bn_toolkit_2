import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  initializeBattle,
  getAvailableAbilities,
  getValidTargets,
  executeAttack,
  executeRandomAttack,
  isRandomAttack,
  processStatusEffects,
  reduceCooldowns,
  isUnitStunned,
  checkBattleEnd,
  aiSelectAction,
  createLiveBattleUnit,
  collapseGrid,
  calculateTurnSummary,
} from "@/lib/liveBattleEngine";
import { getUnitAbilities, calculateDodgeChance, calculateDamageWithArmor, canTargetUnit, calculateCritChance } from "@/lib/battleCalculations";
import { getBlockingUnits, checkLineOfFire, calculateRange, findFrontmostUnblockedPosition, getTargetingInfo } from "@/lib/battleTargeting";
import { getStatusEffect, getStatusEffectDisplayName, getStatusEffectColor, getEffectDisplayNameTranslated } from "@/lib/statusEffects";
import { getUnitById } from "@/lib/units";
import { UnitTag } from "@/data/gameEnums";
import { getAbilityById } from "@/lib/abilities";
import { getFixedAttackPositions, getAffectedGridPositions } from "@/types/battleSimulator";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PartyUnit, AbilityInfo, DamagePreview, DamageResult, StatusEffectPreview, TargetArea } from "@/types/battleSimulator";
import type { EncounterUnit, Encounter } from "@/types/encounters";
import type { LiveBattleState, LiveBattleUnit, BattleAction, BattleTurn, TurnSummary } from "@/types/liveBattle";

interface UseLiveBattleOptions {
  encounter?: Encounter | null;
  waves: EncounterUnit[][];
  friendlyParty: PartyUnit[];
  startingWave?: number;
}

export function useLiveBattle({ encounter, waves, friendlyParty, startingWave = 0 }: UseLiveBattleOptions) {
  const { t } = useLanguage();
  const [battleState, setBattleState] = useState<LiveBattleState | null>(null);
  const [selectedUnitGridId, setSelectedUnitGridId] = useState<number | null>(null);
  const [selectedUnitIsEnemy, setSelectedUnitIsEnemy] = useState<boolean>(false);
  const [selectedAbilityId, setSelectedAbilityId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // Track if the current player turn has had its start-of-turn processing done
  const [playerTurnStartProcessed, setPlayerTurnStartProcessed] = useState(false);
  
  // Get environmental damage mods
  const environmentalDamageMods = useMemo(() => {
    if (!encounter?.environmental_status_effect) return undefined;
    const envEffect = getStatusEffect(encounter.environmental_status_effect);
    return envEffect?.stun_damage_mods;
  }, [encounter?.environmental_status_effect]);

  // Start or restart battle
  const startBattle = useCallback(() => {
    console.log("Starting battle with party:", friendlyParty.map(u => ({ unitId: u.unitId, gridId: u.gridId, rank: u.rank })));
    const state = initializeBattle(friendlyParty, waves, startingWave);
    console.log("Battle initialized, friendly units:", state.friendlyUnits.map(u => ({ unitId: u.unitId, gridId: u.gridId })));
    setBattleState(state);
    setSelectedUnitGridId(null);
    setSelectedUnitIsEnemy(false);
    setSelectedAbilityId(null);
    setIsProcessing(false);
    // First turn is already ready - no DOT to process yet
    setPlayerTurnStartProcessed(true);
  }, [friendlyParty, waves, startingWave]);

  // Execute player turn start phase: DoT -> deaths -> collapse -> cooldowns
  // Called automatically when player turn begins (after enemy turn ends)
  const executePlayerTurnStart = useCallback(() => {
    if (!battleState || !battleState.isPlayerTurn || battleState.isBattleOver || isProcessing) return;
    if (playerTurnStartProcessed) return; // Already processed this turn
    
    console.log('[executePlayerTurnStart] Processing player turn start');
    setIsProcessing(true);
    
    setBattleState(prev => {
      if (!prev) return prev;
      
      // Deep clone state
      const newState: LiveBattleState = {
        ...prev,
        friendlyUnits: prev.friendlyUnits.map(u => ({
          ...u,
          abilityCooldowns: { ...u.abilityCooldowns },
          weaponGlobalCooldown: { ...u.weaponGlobalCooldown },
          weaponAmmo: { ...u.weaponAmmo },
          weaponReloadCooldown: { ...u.weaponReloadCooldown },
          activeStatusEffects: u.activeStatusEffects.map(e => ({ ...e })),
          abilityChargeProgress: { ...u.abilityChargeProgress },
        })),
        enemyUnits: prev.enemyUnits.map(u => ({
          ...u,
          abilityCooldowns: { ...u.abilityCooldowns },
          weaponGlobalCooldown: { ...u.weaponGlobalCooldown },
          weaponAmmo: { ...u.weaponAmmo },
          weaponReloadCooldown: { ...u.weaponReloadCooldown },
          activeStatusEffects: u.activeStatusEffects.map(e => ({ ...e })),
          abilityChargeProgress: { ...u.abilityChargeProgress },
        })),
        friendlyCollapsedRows: new Set(prev.friendlyCollapsedRows),
        enemyCollapsedRows: new Set(prev.enemyCollapsedRows),
        battleLog: [...prev.battleLog],
      };
      
      const actions: BattleAction[] = [];
      
      // 1. Collapse rows if needed
      newState.friendlyCollapsedRows = collapseGrid(newState.friendlyUnits, newState.friendlyCollapsedRows);
      newState.enemyCollapsedRows = collapseGrid(newState.enemyUnits, newState.enemyCollapsedRows);
      
      // 2. Process status effects (DoT damage)
      actions.push(...processStatusEffects([...newState.friendlyUnits, ...newState.enemyUnits], environmentalDamageMods));
      
      // 3. Reduce cooldowns for player units (before action selection) - stunned units skip this
      reduceCooldowns(newState.friendlyUnits);
      
      // 4. Check if battle ended from status effects
      const endCheck = checkBattleEnd(newState);
      
      // If there were status effect actions, add them to the log
      if (actions.length > 0) {
        const turn: BattleTurn = {
          turnNumber: newState.currentTurn,
          isPlayerTurn: true,
          actions,
          summary: calculateTurnSummary(actions),
        };
        newState.battleLog = [...newState.battleLog, turn];
      }
      
      return {
        ...newState,
        isBattleOver: endCheck.isOver,
        isPlayerVictory: endCheck.playerWon,
      };
    });
    
    setPlayerTurnStartProcessed(true);
    setIsProcessing(false);
  }, [battleState, isProcessing, playerTurnStartProcessed, environmentalDamageMods]);

  // Reset playerTurnStartProcessed when turn changes to enemy
  useEffect(() => {
    if (battleState && !battleState.isPlayerTurn) {
      setPlayerTurnStartProcessed(false);
    }
  }, [battleState?.isPlayerTurn]);

  // Get currently selected unit - use both gridId AND isEnemy to find the right unit
  const selectedUnit = useMemo(() => {
    if (!battleState || selectedUnitGridId === null) return null;
    const units = selectedUnitIsEnemy ? battleState.enemyUnits : battleState.friendlyUnits;
    return units.find(u => u.gridId === selectedUnitGridId && !u.isDead) || null;
  }, [battleState, selectedUnitGridId, selectedUnitIsEnemy]);

  // Get ALL abilities for selected unit (regardless of cooldown/ammo)
  const allAbilities = useMemo<AbilityInfo[]>(() => {
    if (!selectedUnit) return [];
    return getUnitAbilities(selectedUnit.unitId, selectedUnit.rank);
  }, [selectedUnit]);

  // Get available abilities for selected unit (respecting cooldowns/ammo)
  const availableAbilities = useMemo<AbilityInfo[]>(() => {
    if (!battleState || !selectedUnit) return [];
    return getAvailableAbilities(
      selectedUnit,
      battleState.enemyUnits,
      battleState.friendlyUnits,
      battleState.friendlyCollapsedRows,
      battleState.enemyCollapsedRows
    );
  }, [battleState, selectedUnit]);

  // Get selected ability (from all abilities, not just available)
  const selectedAbility = useMemo(() => {
    if (!selectedAbilityId) return null;
    return allAbilities.find(a => a.abilityId === selectedAbilityId) || null;
  }, [selectedAbilityId, allAbilities]);

  // State for reticle position (for AOE abilities)
  const [enemyReticleGridId, setEnemyReticleGridId] = useState<number>(7);

  // Update default reticle position when ability changes
  useEffect(() => {
    if (!selectedAbility || !selectedUnit || !battleState || selectedAbility.isSingleTarget || selectedAbility.isFixed) return;
    
    const targetUnits = selectedUnit.isEnemy 
      ? battleState.friendlyUnits 
      : battleState.enemyUnits;
    
    const blockingUnits = getBlockingUnits(
      targetUnits.filter(u => !u.isDead).map(u => ({ unit_id: u.unitId, grid_id: u.gridId })),
      true // Always use EncounterUnit format (grid_id) since we're mapping with grid_id
    );
    
    const frontmostPosition = findFrontmostUnblockedPosition(
      selectedUnit.gridId,
      selectedAbility.minRange,
      selectedAbility.maxRange,
      selectedAbility.lineOfFire,
      selectedUnit.isEnemy,
      blockingUnits
    );
    
    if (frontmostPosition !== null) {
      setEnemyReticleGridId(frontmostPosition);
    }
  }, [selectedAbility?.abilityId, selectedUnit?.gridId, selectedUnit?.isEnemy, battleState]);

  // Calculate fixed attack positions
  const fixedAttackPositions = useMemo(() => {
    if (!selectedUnit || !selectedAbility?.isFixed || !selectedAbility.targetArea || !battleState) {
      return { enemyGrid: [] as { gridId: number; damagePercent: number }[], friendlyGrid: [] as { gridId: number; damagePercent: number }[] };
    }

    // Get collapsed rows for proper targeting
    const attackerCollapsedRows = selectedUnit.isEnemy ? battleState.enemyCollapsedRows : battleState.friendlyCollapsedRows;
    const targetCollapsedRows = selectedUnit.isEnemy ? battleState.friendlyCollapsedRows : battleState.enemyCollapsedRows;

    const positions = getFixedAttackPositions(
      selectedUnit.gridId,
      selectedAbility.targetArea,
      !selectedUnit.isEnemy,
      attackerCollapsedRows,
      targetCollapsedRows
    );

    const enemyGrid = positions.filter(p => p.isOnEnemyGrid);
    const friendlyGrid = positions.filter(p => !p.isOnEnemyGrid);

    return { enemyGrid, friendlyGrid };
  }, [selectedUnit, selectedAbility, battleState]);

  // Calculate valid reticle positions
  const validReticlePositions = useMemo(() => {
    if (!selectedUnit || !selectedAbility || !battleState || selectedAbility.isSingleTarget || selectedAbility.isFixed) {
      return undefined;
    }
    
    const targetUnits = selectedUnit.isEnemy 
      ? battleState.friendlyUnits 
      : battleState.enemyUnits;
    
    const blockingUnits = getBlockingUnits(
      targetUnits.filter(u => !u.isDead).map(u => ({ unit_id: u.unitId, grid_id: u.gridId })),
      true // Always use EncounterUnit format (grid_id) since we're mapping with grid_id
    );
    
    const targetingInfo = getTargetingInfo(
      selectedUnit.gridId,
      selectedAbility.minRange,
      selectedAbility.maxRange,
      selectedAbility.lineOfFire,
      selectedUnit.isEnemy,
      blockingUnits
    );
    
    return new Set(
      targetingInfo
        .filter(t => t.inRange && !t.isBlocked)
        .map(t => t.gridId)
    );
  }, [selectedUnit, selectedAbility, battleState]);

  // Calculate damage previews for live battle (uses current HP/armor)
  const damagePreviews = useMemo<DamagePreview[]>(() => {
    if (!battleState || !selectedUnit || !selectedAbility || selectedUnit.isEnemy) return [];
    
    const totalShots = selectedAbility.shotsPerAttack * selectedAbility.attacksPerUse;
    const targets = battleState.enemyUnits;
    
    const blockingUnits = getBlockingUnits(
      targets.filter(u => !u.isDead).map(u => ({ unit_id: u.unitId, grid_id: u.gridId })),
      true
    );

    // Check if this is a random attack
    const isRandom = selectedAbility.targetArea?.random === true;
    const targetAreaData = selectedAbility.targetArea?.data || [];
    
    // For random attacks, calculate expected hits per tile
    // The number of shots comes from shotsPerAttack * attacksPerUse, not targetArea.data.length
    let expectedHitsPerTile: Map<number, number> = new Map();
    if (isRandom) {
      // All grid positions on enemy grid
      const allGridPositions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13];
      
      // Each shot independently targets a random tile
      // Expected hits per tile = totalShots / numTiles
      const expectedHitsPerPosition = totalShots / allGridPositions.length;
      
      for (const gridId of allGridPositions) {
        expectedHitsPerTile.set(gridId, expectedHitsPerPosition);
      }
    }

    // Get affected positions based on ability type
    let affectedPositions: { gridId: number; damagePercent: number }[];
    
    // Check if this is a "single-selection with splash" ability:
    // - Has damageArea with non-center positions (splash)
    // - targetArea is either missing, or only has center position (no movable reticle)
    const hasNonCenterSplash = selectedAbility.damageArea?.some(d => d.x !== 0 || d.y !== 0) ?? false;
    const targetAreaHasOnlyCenter = !selectedAbility.targetArea || 
      (selectedAbility.targetArea.data.length === 1 && 
       selectedAbility.targetArea.data[0].x === 0 && 
       selectedAbility.targetArea.data[0].y === 0);
    const isSingleSelectionWithSplash = hasNonCenterSplash && targetAreaHasOnlyCenter;
    
    if (isRandom) {
      // For random attacks, all enemy positions are potentially affected
      affectedPositions = targets.map(u => ({ gridId: u.gridId, damagePercent: 100 }));
    } else if (selectedAbility.isFixed && fixedAttackPositions.enemyGrid.length > 0) {
      affectedPositions = fixedAttackPositions.enemyGrid;
    } else if (isSingleSelectionWithSplash) {
      // Single-selection with splash (like Legendary Sandworm's Maul)
      // Calculate splash positions for ALL potential targets to show in preview
      const allSplashPositions: { gridId: number; damagePercent: number }[] = [];
      for (const target of targets.filter(t => !t.isDead)) {
        const syntheticTargetArea: TargetArea = {
          targetType: 2,
          data: [{ x: 0, y: 0, damagePercent: 100 }],
        };
        const splashPositions = getAffectedGridPositions(target.gridId, syntheticTargetArea, true, selectedAbility.damageArea);
        for (const pos of splashPositions) {
          // Check if this position already exists
          const existing = allSplashPositions.find(p => p.gridId === pos.gridId);
          if (existing) {
            // Take max damage percent (targets hit by multiple abilities would get multiple preview calculations)
            existing.damagePercent = Math.max(existing.damagePercent, pos.damagePercent);
          } else {
            allSplashPositions.push({ gridId: pos.gridId, damagePercent: pos.damagePercent });
          }
        }
      }
      affectedPositions = allSplashPositions;
    } else if (!selectedAbility.isSingleTarget && selectedAbility.targetArea) {
      affectedPositions = getAffectedGridPositions(enemyReticleGridId, selectedAbility.targetArea, true, selectedAbility.damageArea);
    } else {
      // Pure single target - calculate for all valid targets
      affectedPositions = targets.map(u => ({ gridId: u.gridId, damagePercent: 100 }));
    }

    return targets
      .filter(t => !t.isDead)
      .map(target => {
        const targetUnit = getUnitById(target.unitId);
        const targetStats = targetUnit?.statsConfig?.stats?.[target.rank - 1];
        const immunities = targetUnit?.statsConfig?.status_effect_immunities || [];
        
        const affectedPos = affectedPositions.find(p => p.gridId === target.gridId);
        const damagePercent = affectedPos?.damagePercent ?? 100;
        const isAffected = affectedPos !== undefined;
        
        const canTarget = canTargetUnit(target.unitId, selectedAbility.targets);
        const defense = targetStats?.defense || 0;
        const dodgeChance = calculateDodgeChance(defense, selectedAbility.offense);

        // Calculate crit chance with bonuses (includes unit base crit + ability crit + tag bonuses with hierarchy)
        const critChance = calculateCritChance(
          selectedAbility.unitBaseCrit,
          selectedAbility.critPercent,
          selectedAbility.critBonuses,
          target.unitId
        );
        
        // Check range (not applicable for random attacks)
        const range = calculateRange(selectedUnit.gridId, target.gridId, false);
        const inRange = isRandom ? true : (range >= selectedAbility.minRange && range <= selectedAbility.maxRange);
        
        // Check line of fire blocking (not applicable for random attacks)
        const blockCheck = isRandom 
          ? { isBlocked: false, blockedBy: undefined, reason: undefined }
          : checkLineOfFire(
              selectedUnit.gridId,
              target.gridId,
              selectedAbility.lineOfFire,
              false,
              blockingUnits
            );
        
        // Calculate damage using current HP/armor values
        const adjustedMinDamage = Math.floor(selectedAbility.minDamage * (damagePercent / 100));
        const adjustedMaxDamage = Math.floor(selectedAbility.maxDamage * (damagePercent / 100));
        
        const minResult = calculateDamageWithArmor(
          adjustedMinDamage,
          target.currentArmor,
          targetStats?.armor_damage_mods,
          targetStats?.damage_mods,
          selectedAbility.damageType,
          selectedAbility.armorPiercing,
          environmentalDamageMods,
          undefined,
          undefined,
          undefined,
          true // Include breakdown for damage previews
        );

        const maxResult = calculateDamageWithArmor(
          adjustedMaxDamage,
          target.currentArmor,
          targetStats?.armor_damage_mods,
          targetStats?.damage_mods,
          selectedAbility.damageType,
          selectedAbility.armorPiercing,
          environmentalDamageMods,
          undefined,
          undefined,
          undefined,
          true // Include breakdown for damage previews
        );
        
        // Calculate effective shots for this tile
        let effectiveShots = totalShots;
        if (isRandom) {
          // Use expected hits based on uniform random tile selection
          effectiveShots = expectedHitsPerTile.get(target.gridId) ?? 0;
        }
        
        // Multiply by shots
        const multiplyResult = (result: DamageResult, shots: number): DamageResult => ({
          rawDamage: Math.floor(result.rawDamage * shots),
          armorDamage: Math.floor(result.armorDamage * shots),
          hpDamage: Math.floor(result.hpDamage * shots),
          armorRemaining: result.armorRemaining,
          effectiveMultiplier: result.effectiveMultiplier,
        });
        
        // Calculate status effect previews
        // Use average expected damage (HP + armor combined) for DoT preview
        const avgTotalDamage = Math.floor(
          (minResult.hpDamage + minResult.armorDamage + maxResult.hpDamage + maxResult.armorDamage) / 2
        );
        const statusEffects: StatusEffectPreview[] = [];
        for (const [effectIdStr, chance] of Object.entries(selectedAbility.statusEffects)) {
          const effectId = parseInt(effectIdStr);
          const effect = getStatusEffect(effectId);
          if (!effect) continue;
          
          const isImmune = immunities.includes(effect.family);
          const adjustedChance = Math.floor(chance * (damagePercent / 100));
          
          let dotDamage = 0;
          if (effect.dot_ability_damage_mult || effect.dot_bonus_damage) {
            // DoT is based on actual damage dealt (scaled by multiplier and bonus)
            const baseDotDamage = Math.floor(avgTotalDamage * (effect.dot_ability_damage_mult || 0) + (effect.dot_bonus_damage || 0));
            dotDamage = baseDotDamage;
          }
          
          statusEffects.push({
            effectId,
            name: getEffectDisplayNameTranslated(effectId),
            chance: adjustedChance,
            duration: effect.duration,
            damageType: effect.dot_damage_type || null,
            dotDamage,
            isImmune,
            isStun: effect.stun_block_action === true,
            color: getStatusEffectColor(effectId),
          });
        }
        
        // For random attacks, show preview for all targetable units
        // For single target abilities, only show preview if in range and not blocked
        const shouldShow = isRandom 
          ? canTarget
          : (selectedAbility.isSingleTarget 
              ? (canTarget && inRange && !blockCheck.isBlocked)
              : isAffected);
        
        return {
          targetGridId: target.gridId,
          targetUnitId: target.unitId,
          minDamage: minResult,
          maxDamage: maxResult,
          totalShots: effectiveShots,
          minTotalDamage: multiplyResult(minResult, effectiveShots),
          maxTotalDamage: multiplyResult(maxResult, effectiveShots),
          dodgeChance,
          critChance,
          canTarget: shouldShow ? canTarget : false,
          targetHasArmor: target.currentArmor > 0,
          targetArmorHp: target.currentArmor,
          targetHp: target.currentHp,
          targetDefense: defense,
          statusEffects,
          damagePercent,
          inRange,
          range,
          isBlocked: blockCheck.isBlocked,
          blockedByUnitId: blockCheck.blockedBy?.unitId,
          blockReason: blockCheck.reason,
          isRandomAttack: isRandom,
          expectedHits: isRandom ? effectiveShots : undefined,
          damageType: selectedAbility.damageType,
        };
      });
  }, [battleState, selectedUnit, selectedAbility, fixedAttackPositions, enemyReticleGridId, environmentalDamageMods]);

  // Get valid targets for selected ability
  // For player units, use relaxed targeting (strictTagCheck=false) - allow placing reticle anywhere in range/LoF
  const validTargets = useMemo<LiveBattleUnit[]>(() => {
    if (!battleState || !selectedUnit || !selectedAbility) return [];
    return getValidTargets(
      selectedUnit,
      selectedAbility,
      battleState.enemyUnits,
      battleState.friendlyUnits,
      battleState.friendlyCollapsedRows,
      battleState.enemyCollapsedRows,
      false // Players can target any position within range/LoF
    );
  }, [battleState, selectedUnit, selectedAbility]);

  // Execute player action
  const executePlayerAction = useCallback((targetGridId: number) => {
    if (!battleState || !selectedUnit || !selectedAbility || isProcessing) return;
    
    // Guard: Check if selected ability is actually available (respects cooldowns, ammo, charge time)
    const currentAvailableAbilities = getAvailableAbilities(
      selectedUnit,
      battleState.enemyUnits,
      battleState.friendlyUnits,
      battleState.friendlyCollapsedRows,
      battleState.enemyCollapsedRows
    );
    
    if (!currentAvailableAbilities.some(a => a.abilityId === selectedAbility.abilityId)) {
      // Check specifically for charge time issue to give helpful message
      const chargeProgress = selectedUnit.abilityChargeProgress[selectedAbility.abilityId] ?? 0;
      if (selectedAbility.chargeTime > 0 && chargeProgress < selectedAbility.chargeTime) {
        const turnsLeft = selectedAbility.chargeTime - chargeProgress;
        toast.error(`Ability is still charging (${turnsLeft} turn${turnsLeft > 1 ? 's' : ''} remaining)`);
      } else {
        toast.error("Ability is not available");
      }
      return;
    }
    
    // For random attacks, we don't need a specific target validation
    const isRandom = isRandomAttack(selectedAbility);
    
    // For AOE attacks (not single target, not fixed), validate against valid reticle positions
    const isAOE = !selectedAbility.isSingleTarget && !selectedAbility.isFixed;
    
    // Recalculate valid targets fresh to ensure we're using current state
    // Players use relaxed targeting (can place ability anywhere in range/LoF)
    const freshValidTargets = getValidTargets(
      selectedUnit,
      selectedAbility,
      battleState.enemyUnits,
      battleState.friendlyUnits,
      battleState.friendlyCollapsedRows,
      battleState.enemyCollapsedRows,
      false // Players can target any position within range/LoF
    );
    
    console.log(`[executePlayerAction] Fresh valid targets for ability ${selectedAbility.abilityId}:`, 
      freshValidTargets.map(t => t.gridId));
    
    // Validate target based on attack type
    if (isRandom) {
      // Random attacks don't need target validation
    } else if (isAOE && validReticlePositions) {
      // AOE attacks can target any valid reticle position (including empty tiles)
      if (!validReticlePositions.has(targetGridId)) return;
    } else {
      // Single target and fixed attacks need a valid target unit
      if (!freshValidTargets.some(t => t.gridId === targetGridId)) {
        console.log(`[executePlayerAction] Target grid ${targetGridId} not in fresh valid targets, rejecting`);
        return;
      }
    }

    setIsProcessing(true);

    setBattleState(prev => {
      if (!prev) return prev;

      // Deep clone state to avoid mutation issues in StrictMode
      const clonedState: LiveBattleState = {
        ...prev,
        friendlyUnits: prev.friendlyUnits.map(u => ({
          ...u,
          abilityCooldowns: { ...u.abilityCooldowns },
          weaponGlobalCooldown: { ...u.weaponGlobalCooldown },
          weaponAmmo: { ...u.weaponAmmo },
          weaponReloadCooldown: { ...u.weaponReloadCooldown },
          activeStatusEffects: u.activeStatusEffects.map(e => ({ ...e })),
          abilityChargeProgress: { ...u.abilityChargeProgress },
        })),
        enemyUnits: prev.enemyUnits.map(u => ({
          ...u,
          abilityCooldowns: { ...u.abilityCooldowns },
          weaponGlobalCooldown: { ...u.weaponGlobalCooldown },
          weaponAmmo: { ...u.weaponAmmo },
          weaponReloadCooldown: { ...u.weaponReloadCooldown },
          activeStatusEffects: u.activeStatusEffects.map(e => ({ ...e })),
          abilityChargeProgress: { ...u.abilityChargeProgress },
        })),
        friendlyCollapsedRows: new Set(prev.friendlyCollapsedRows),
        enemyCollapsedRows: new Set(prev.enemyCollapsedRows),
        battleLog: [...prev.battleLog],
      };

      // Find the attacker in cloned state
      const clonedAttacker = clonedState.friendlyUnits.find(u => u.gridId === selectedUnit.gridId);
      if (!clonedAttacker) return prev;

      // Get localized names
      const attackerUnit = getUnitById(selectedUnit.unitId);
      const attackerName = attackerUnit ? t(attackerUnit.identity.name) : `Unit ${selectedUnit.unitId}`;
      const abilityData = getAbilityById(selectedAbility.abilityId);
      const localizedAbilityName = abilityData ? t(abilityData.name) : `Ability ${selectedAbility.abilityId}`;

      // Execute the attack (random or normal) on cloned state
      let actions: BattleAction[];
      if (isRandom) {
        actions = executeRandomAttack(
          clonedAttacker,
          selectedAbility,
          clonedState,
          environmentalDamageMods
        );
      } else {
        actions = executeAttack(
          clonedAttacker,
          selectedAbility,
          targetGridId,
          clonedState,
          environmentalDamageMods
        );
      }

      // Add attacker name and localized ability name to actions
      actions = actions.map(a => ({
        ...a,
        attackerName,
        abilityName: a.abilityName ? localizedAbilityName : a.abilityName,
      }));

      // Add turn to log with summary
      const turn: BattleTurn = {
        turnNumber: clonedState.currentTurn,
        isPlayerTurn: true,
        actions,
        summary: calculateTurnSummary(actions),
      };

      // Check battle end
      const endCheck = checkBattleEnd(clonedState);

      // Update collapsed rows after attack (units may have died)
      // Pass previous collapsed rows to ensure only 1 row collapses per turn
      clonedState.friendlyCollapsedRows = collapseGrid(clonedState.friendlyUnits, clonedState.friendlyCollapsedRows);
      clonedState.enemyCollapsedRows = collapseGrid(clonedState.enemyUnits, clonedState.enemyCollapsedRows);

      // Cooldowns will be reduced at the START of next player turn, not here

      return {
        ...clonedState,
        battleLog: [...clonedState.battleLog, turn],
        isBattleOver: endCheck.isOver,
        isPlayerVictory: endCheck.playerWon,
        isPlayerTurn: !endCheck.isOver ? false : clonedState.isPlayerTurn,
        currentEnemyIndex: 0, // Reset enemy index when transitioning to enemy turn
      };
    });

    setSelectedUnitGridId(null);
    setSelectedAbilityId(null);
    setIsProcessing(false);
  }, [battleState, selectedUnit, selectedAbility, validTargets, validReticlePositions, isProcessing, environmentalDamageMods, t]);

  // Helper to select a unit by grid and enemy flag
  const selectUnit = useCallback((gridId: number, isEnemy: boolean) => {
    setSelectedUnitGridId(gridId);
    setSelectedUnitIsEnemy(isEnemy);
    setSelectedAbilityId(null);
  }, []);

  // Execute enemy turn - NEW SIMPLER APPROACH:
  // 1. Gather ALL available abilities from ALL alive enemies
  // 2. Pick ONE random ability from the pool
  // 3. Execute it
  // 4. Return control to player
  const executeEnemyTurn = useCallback(() => {
    console.log('[executeEnemyTurn] Called. isPlayerTurn:', battleState?.isPlayerTurn, 'isProcessing:', isProcessing);
    
    // Guard: only execute if it's enemy turn and not already processing
    if (!battleState || battleState.isPlayerTurn || battleState.isBattleOver || isProcessing) {
      console.log('[executeEnemyTurn] Early return - guard failed');
      return;
    }

    console.log('[executeEnemyTurn] Starting enemy turn');
    setIsProcessing(true);

    // 1. Clone state as working copy
    const newState: LiveBattleState = {
      ...battleState,
      friendlyUnits: battleState.friendlyUnits.map(u => ({
        ...u,
        abilityCooldowns: { ...u.abilityCooldowns },
        weaponGlobalCooldown: { ...u.weaponGlobalCooldown },
        weaponAmmo: { ...u.weaponAmmo },
        weaponReloadCooldown: { ...u.weaponReloadCooldown },
        activeStatusEffects: u.activeStatusEffects.map(e => ({ ...e })),
        abilityChargeProgress: { ...u.abilityChargeProgress },
      })),
      enemyUnits: battleState.enemyUnits.map(u => ({
        ...u,
        abilityCooldowns: { ...u.abilityCooldowns },
        weaponGlobalCooldown: { ...u.weaponGlobalCooldown },
        weaponAmmo: { ...u.weaponAmmo },
        weaponReloadCooldown: { ...u.weaponReloadCooldown },
        activeStatusEffects: u.activeStatusEffects.map(e => ({ ...e })),
        abilityChargeProgress: { ...u.abilityChargeProgress },
      })),
      friendlyCollapsedRows: new Set(battleState.friendlyCollapsedRows),
      enemyCollapsedRows: new Set(battleState.enemyCollapsedRows),
      battleLog: [...battleState.battleLog],
    };

    const actions: BattleAction[] = [];

    // 2. Detect collapsed rows and process status effects (with environmental mods for DOT damage)
    // Pass previous collapsed rows to ensure only 1 row collapses per turn
    newState.friendlyCollapsedRows = collapseGrid(newState.friendlyUnits, newState.friendlyCollapsedRows);
    newState.enemyCollapsedRows = collapseGrid(newState.enemyUnits, newState.enemyCollapsedRows);
    actions.push(...processStatusEffects([...newState.friendlyUnits, ...newState.enemyUnits], environmentalDamageMods));

    // 2b. Reduce cooldowns for enemies (before ability selection) - stunned units skip this
    reduceCooldowns(newState.enemyUnits);

    // 3. Check if battle ended from status effects
    let endCheck = checkBattleEnd(newState);
    if (endCheck.isOver) {
      const turn: BattleTurn = { turnNumber: newState.currentTurn, isPlayerTurn: false, actions };
      setBattleState({
        ...newState,
        battleLog: [...newState.battleLog, turn],
        isBattleOver: true,
        isPlayerVictory: endCheck.playerWon,
      });
      setIsProcessing(false);
      return;
    }

    // 3b. Check if wave should advance due to DoT kills
    // If all non-ignorable enemies died from DoT, advance wave and continue with new enemies
    const allNonIgnorableEnemiesDead = newState.enemyUnits.every(u => {
      if (u.isDead) return true;
      const unit = getUnitById(u.unitId);
      const tags = unit?.identity?.tags || [];
      const isIgnorable = tags.includes(UnitTag.Ignorable);
      const isUnimportant = unit?.statsConfig?.unimportant === true;
      return isIgnorable || isUnimportant;
    });
    
    if (allNonIgnorableEnemiesDead && newState.currentWave < newState.totalWaves - 1) {
      console.log('[executeEnemyTurn] All enemies dead from DoT, advancing wave inline');
      const nextWave = newState.currentWave + 1;
      const nextWaveUnits = waves[nextWave] || [];
      const newEnemyUnits = nextWaveUnits
        .filter(u => u.grid_id !== undefined)
        .map(u => {
          const unit = createLiveBattleUnit(u.unit_id, u.grid_id!, 1, true);
          return unit;
        })
        .filter((u): u is LiveBattleUnit => u !== null);
      
      newState.enemyUnits = newEnemyUnits;
      newState.enemyCollapsedRows = new Set<number>(); // Reset enemy grid layout for new wave
      newState.currentWave = nextWave;
      newState.currentEnemyIndex = 0;
      actions.push({ type: "skip", message: `Wave ${nextWave + 1} begins! Enemies attack first.` });
    }

    // 4. Get alive enemies, filter to non-stunned
    // Filter AGAIN after DoT processing (and potential wave advance) to exclude any enemies that died from DoT
    const aliveEnemies = newState.enemyUnits.filter(e => !e.isDead);
    const activeEnemies = aliveEnemies.filter(e => !e.activeStatusEffects.some(s => s.isStun));
    
    // Also get alive friendlies AFTER DoT processing
    const aliveFriendlies = newState.friendlyUnits.filter(f => !f.isDead);
    
    console.log('[executeEnemyTurn] After DoT: aliveEnemies=', aliveEnemies.length, 'aliveFriendlies=', aliveFriendlies.length);

    // Log stunned enemies
    for (const enemy of aliveEnemies.filter(e => e.activeStatusEffects.some(s => s.isStun))) {
      const unit = getUnitById(enemy.unitId);
      actions.push({
        type: "skip",
        attackerGridId: enemy.gridId,
        attackerName: unit?.identity?.name || `Unit ${enemy.unitId}`,
        message: `Stunned and cannot act`,
      });
    }

    // 5. Build ability pool: each active enemy's available abilities with valid targets
    // IMPORTANT: Pass only ALIVE units to ability/target checks
    const abilityPool: { enemy: LiveBattleUnit; ability: AbilityInfo; targets: LiveBattleUnit[] }[] = [];
    for (const enemy of activeEnemies) {
      for (const ability of getAvailableAbilities(
        enemy,
        aliveEnemies,
        aliveFriendlies,
        newState.friendlyCollapsedRows,
        newState.enemyCollapsedRows
      )) {
        // Enemies use strict targeting - must match ability's target tags
        const targets = getValidTargets(
          enemy,
          ability,
          aliveEnemies,
          aliveFriendlies,
          newState.friendlyCollapsedRows,
          newState.enemyCollapsedRows,
          true // Enemies require valid target tags
        );
        if (targets.length > 0) {
          abilityPool.push({ enemy, ability, targets });
        }
      }
    }
    console.log('[executeEnemyTurn] Ability pool size:', abilityPool.length);

    // 6. If no valid abilities, skip turn
    if (abilityPool.length === 0) {
      for (const enemy of activeEnemies) {
        const unit = getUnitById(enemy.unitId);
        actions.push({
          type: "skip",
          attackerGridId: enemy.gridId,
          attackerName: unit?.identity?.name || `Unit ${enemy.unitId}`,
          message: `No valid targets`,
        });
      }

      // Ensure the enemy turn always produces at least one log entry
      if (actions.length === 0) {
        actions.push({ type: "skip", message: "Enemy skipped turn" });
      }
    } else {
      // 7. Pick one random ability from pool
      const { enemy, ability, targets } = abilityPool[Math.floor(Math.random() * abilityPool.length)];
      const target = targets[Math.floor(Math.random() * targets.length)];

      // 8. Execute attack and get actions
      let attackActions: BattleAction[];
      if (isRandomAttack(ability)) {
        attackActions = executeRandomAttack(enemy, ability, newState, environmentalDamageMods);
      } else {
        attackActions = executeAttack(enemy, ability, target.gridId, newState, environmentalDamageMods);
      }

      // Add localized names
      const unit = getUnitById(enemy.unitId);
      const abilityData = getAbilityById(ability.abilityId);
      attackActions = attackActions.map(a => ({
        ...a,
        attackerName: unit ? t(unit.identity.name) : a.attackerName,
        abilityName: abilityData ? t(abilityData.name) : a.abilityName,
      }));
      actions.push(...attackActions);
    }

    // Ensure the enemy turn always produces at least one log entry
    if (actions.length === 0) {
      actions.push({ type: "skip", message: "Enemy skipped turn" });
    }

    // Cooldowns already reduced at turn start (before ability selection)

    // 10. Check battle end
    endCheck = checkBattleEnd(newState);

    // 11. Create turn log with summary and set final state
    const turn: BattleTurn = { turnNumber: newState.currentTurn, isPlayerTurn: false, actions, summary: calculateTurnSummary(actions) };
    
    setBattleState({
      ...newState,
      currentTurn: newState.currentTurn + 1,
      isPlayerTurn: true,
      currentEnemyIndex: 0,
      battleLog: [...newState.battleLog, turn],
      isBattleOver: endCheck.isOver,
      isPlayerVictory: endCheck.playerWon,
    });

    setIsProcessing(false);
  }, [battleState, isProcessing, environmentalDamageMods, t]);

  // Check if all enemies are dead and auto-advance wave
  const checkWaveAdvance = useCallback(() => {
    if (!battleState) return false;
    
    // Check if all non-ignorable/non-unimportant enemies are dead
    // Units with the Ignorable tag (like Stone Slab) or unimportant flag don't count for wave completion
    const allNonIgnorableEnemiesDead = battleState.enemyUnits.every(u => {
      if (u.isDead) return true;
      const unit = getUnitById(u.unitId);
      const tags = unit?.identity?.tags || [];
      const isIgnorable = tags.includes(UnitTag.Ignorable);
      const isUnimportant = unit?.statsConfig?.unimportant === true;
      return isIgnorable || isUnimportant;
    });
    
    if (allNonIgnorableEnemiesDead && battleState.currentWave < battleState.totalWaves - 1) {
      return true;
    }
    return false;
  }, [battleState]);

  // Advance to next wave (enemies go first on subsequent waves)
  const advanceWave = useCallback(() => {
    if (!battleState || battleState.currentWave >= battleState.totalWaves - 1) return;

    setBattleState(prev => {
      if (!prev) return prev;

      const nextWave = prev.currentWave + 1;
      const nextWaveUnits = waves[nextWave] || [];
      const enemyUnits = nextWaveUnits
        .filter(u => u.grid_id !== undefined)
        .map(u => {
          const unit = createLiveBattleUnit(u.unit_id, u.grid_id!, 1, true);
          return unit;
        })
        .filter((u): u is LiveBattleUnit => u !== null);

      // On subsequent waves, enemies go first
      // Reset enemy collapsed rows since new enemies spawn on the full grid
      return {
        ...prev,
        enemyUnits,
        enemyCollapsedRows: new Set<number>(), // Reset enemy grid layout for new wave
        currentWave: nextWave,
        currentEnemyIndex: 0, // Reset enemy index for new wave
        isPlayerTurn: false, // Enemy goes first on wave 2+
        battleLog: [...prev.battleLog, {
          turnNumber: prev.currentTurn,
          isPlayerTurn: true,
          actions: [{ type: "skip", message: `Wave ${nextWave + 1} begins! Enemies attack first.` }],
        }],
      };
    });
  }, [battleState, waves]);

  // Skip player turn
  const skipTurn = useCallback(() => {
    if (!battleState || !battleState.isPlayerTurn || battleState.isBattleOver || isProcessing) return;

    setBattleState(prev => {
      if (!prev) return prev;

      const turn: BattleTurn = {
        turnNumber: prev.currentTurn,
        isPlayerTurn: true,
        actions: [{ type: "skip", message: "Player skipped turn" }],
      };

      // Cooldowns are reduced at turn START, not when skipping
      // (they were already reduced in executePlayerTurnStart)

      return {
        ...prev,
        battleLog: [...prev.battleLog, turn],
        isPlayerTurn: false,
        currentEnemyIndex: 0, // Reset enemy index when transitioning to enemy turn
      };
    });
  }, [battleState, isProcessing]);

  return {
    battleState,
    selectedUnit,
    selectedUnitGridId,
    selectedUnitIsEnemy,
    selectUnit,
    setSelectedAbilityId,
    selectedAbilityId,
    allAbilities,
    availableAbilities,
    selectedAbility,
    validTargets,
    isProcessing,
    startBattle,
    executePlayerAction,
    executePlayerTurnStart,
    playerTurnStartProcessed,
    executeEnemyTurn,
    advanceWave,
    skipTurn,
    checkWaveAdvance,
    // Targeting support
    damagePreviews,
    enemyReticleGridId,
    setEnemyReticleGridId,
    fixedAttackPositions,
    validReticlePositions,
    isRandomAttack: selectedAbility?.targetArea?.random === true,
  };
}
