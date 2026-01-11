import type { DamageMods } from "@/types/units";

export interface PartyUnit {
  unitId: number;
  gridId: number;
  rank: number;
}

export interface Party {
  id: string;
  name: string;
  units: PartyUnit[];
  createdAt: number;
  updatedAt: number;
}

// Temporary formation state (not saved to storage)
export interface TempFormation {
  units: PartyUnit[];
}

export interface SelectedUnit {
  unitId: number;
  gridId: number;
  rank: number;
  isEnemy: boolean;
}

// Target area data for AOE abilities
export interface TargetAreaPosition {
  x: number;
  y: number;
  damagePercent?: number;
  weight?: number;
  order?: number;
}

export interface DamageAreaPosition {
  x: number;
  y: number;
  damagePercent: number;
}

export interface TargetArea {
  targetType: number; // 1 = single target/fixed, 2 = AOE pattern (movable)
  data: TargetAreaPosition[];
  random?: boolean;
  aoeOrderDelay?: number;
}

// Line of Fire types
export const LineOfFire = {
  Contact: 0,  // Can only target first unit in range
  Direct: 1,   // Can fire past None blocking units
  Precise: 2,  // Can target behind Partial blocking, not Full
  Indirect: 3, // Can target any unit in range
} as const;

export const LineOfFireLabels: Record<number, string> = {
  [LineOfFire.Contact]: "Contact",
  [LineOfFire.Direct]: "Direct",
  [LineOfFire.Precise]: "Precise",
  [LineOfFire.Indirect]: "Indirect",
};

export interface AbilityInfo {
  abilityId: number;
  weaponName: string;
  minDamage: number;
  maxDamage: number;
  offense: number;
  shotsPerAttack: number;
  attacksPerUse: number;
  lineOfFire: number; // 0=Contact, 1=Direct, 2=Precise, 3=Indirect
  attackDirection: number; // 1=Front, 2=Back
  targets: number[];
  damageType: number;
  minRange: number;
  maxRange: number;
  cooldown: number;
  globalCooldown: number;
  armorPiercing: number;
  critPercent: number; // Ability's base critical hit percent
  unitBaseCrit: number; // Unit's base critical stat from statsConfig
  critBonuses: Record<number, number>; // tag_id -> bonus crit %
  chargeTime: number;
  suppressionMultiplier: number;
  suppressionBonus: number;
  statusEffects: Record<string, number>; // effect_id -> chance %
  targetArea?: TargetArea; // AOE targeting data
  damageArea?: DamageAreaPosition[]; // Splash damage pattern around each impact point
  isFixed: boolean; // True if attack pattern is fixed (can't be aimed)
  isSingleTarget: boolean; // True if ability is single-target (no AOE pattern)
  // Ammo system
  ammoRequired: number; // Ammo consumed per use
  weaponMaxAmmo: number; // Max ammo for this weapon (-1 = infinite)
  weaponReloadTime: number; // Turns to reload when empty
}

export interface StatusEffectPreview {
  effectId: number;
  name: string;
  chance: number;
  duration: number;
  damageType: number | null;
  dotDamage: number; // Calculated DoT damage per tick
  isImmune: boolean;
  isStun: boolean;
  color: string;
}

export interface DamageResult {
  rawDamage: number;
  armorDamage: number;
  hpDamage: number;
  armorRemaining: number;
  effectiveMultiplier: number;
  // Breakdown details for damage calculation
  breakdown?: {
    baseDamage: number;
    powerBonus: number;
    baseHpMod: number;
    baseArmorMod: number;
    envMod: number;
    statusHpMod: number;
    statusArmorMod: number;
    finalHpMod: number;
    finalArmorMod: number;
    piercingDamage: number;
    armorableDamage: number;
    effectiveArmorCapacity: number;
    armorAbsorbed: number;
    overflowToHp: number;
    bypassedArmor: boolean;
  };
}

export interface DamagePreview {
  targetGridId: number;
  targetUnitId: number;
  minDamage: DamageResult;
  maxDamage: DamageResult;
  // Multi-hit totals (shots_per_attack * attacks_per_use)
  totalShots: number;
  minTotalDamage: DamageResult;
  maxTotalDamage: DamageResult;
  dodgeChance: number;
  critChance: number;
  canTarget: boolean;
  targetHasArmor: boolean;
  targetArmorHp: number;
  targetHp: number;
  targetDefense: number;
  statusEffects: StatusEffectPreview[];
  // AOE damage modifier (100 = full damage, 25 = 25% splash)
  damagePercent: number;
  // Range and blocking info
  inRange: boolean;
  range: number;
  isBlocked: boolean;
  blockedByUnitId?: number;
  blockedByUnitName?: string;
  blockedByBlockingLevel?: number;
  blockReason?: string;
  // Random attack info
  isRandomAttack?: boolean;
  expectedHits?: number;
  // Damage type for breakdown display
  damageType: number;
}

// Row mapping: preferred_row 1 = front (row 1), 2 = middle (row 2), 3 = back (row 3)
export const PREFERRED_ROW_MAP = {
  1: [4, 3, 2, 1, 0],      // Row 1 positions
  2: [9, 8, 7, 6, 5],      // Row 2 positions
  3: [13, 12, 11],         // Row 3 positions
} as const;

export const FRIENDLY_GRID_LAYOUT = {
  ROW_1: [0, 1, 2, 3, 4],   // Mirrored for friendly side
  ROW_2: [5, 6, 7, 8, 9],
  ROW_3: [11, 12, 13],
} as const;

export const ENEMY_GRID_LAYOUT = {
  ROW_1: [4, 3, 2, 1, 0],
  ROW_2: [9, 8, 7, 6, 5],
  ROW_3: [13, 12, 11],
} as const;

// Grid coordinate mapping: gridId -> {x, y} where y=0 is front row (ROW_1)
// x ranges from 0-4 for rows 1-2, and 0-2 for row 3 (centered)
export const GRID_ID_TO_COORDS: Record<number, { x: number; y: number }> = {
  // Row 1 (y=0): positions 0-4
  0: { x: 0, y: 0 }, 1: { x: 1, y: 0 }, 2: { x: 2, y: 0 }, 3: { x: 3, y: 0 }, 4: { x: 4, y: 0 },
  // Row 2 (y=1): positions 5-9
  5: { x: 0, y: 1 }, 6: { x: 1, y: 1 }, 7: { x: 2, y: 1 }, 8: { x: 3, y: 1 }, 9: { x: 4, y: 1 },
  // Row 3 (y=2): positions 11-13 (centered, so x = 1, 2, 3)
  11: { x: 1, y: 2 }, 12: { x: 2, y: 2 }, 13: { x: 3, y: 2 },
};

// Reverse mapping: {x,y} string -> gridId
export const COORDS_TO_GRID_ID: Record<string, number> = {
  "0,0": 0, "1,0": 1, "2,0": 2, "3,0": 3, "4,0": 4,
  "0,1": 5, "1,1": 6, "2,1": 7, "3,1": 8, "4,1": 9,
  "1,2": 11, "2,2": 12, "3,2": 13,
};

// Get grid positions affected by an AOE ability centered on a target position
// Coordinate system from data: x: -1=left, 0=same, 1=right; y: -1=down(toward front), 0=same, 1=up(toward back)
// Now supports overlapping splash damage from damageArea
export function getAffectedGridPositions(
  targetGridId: number,
  targetArea: TargetArea | undefined,
  isTargetOnEnemyGrid: boolean,
  damageArea?: DamageAreaPosition[]
): { gridId: number; damagePercent: number; hitCount?: number }[] {
  // If no target area or single target type with no data, just return the target
  if (!targetArea || targetArea.data.length === 0) {
    return [{ gridId: targetGridId, damagePercent: 100 }];
  }

  const targetCoords = GRID_ID_TO_COORDS[targetGridId];
  if (!targetCoords) return [{ gridId: targetGridId, damagePercent: 100 }];

  // First, get all impact points from targetArea
  const impactPoints: { x: number; y: number; damagePercent: number }[] = [];
  
  for (const pos of targetArea.data) {
    const newX = targetCoords.x + pos.x;
    const newY = targetCoords.y + pos.y;
    impactPoints.push({ x: newX, y: newY, damagePercent: pos.damagePercent || 100 });
  }

  // If there's no damageArea (no splash), just return the impact points as before
  if (!damageArea || damageArea.length === 0) {
    const affected: { gridId: number; damagePercent: number }[] = [];
    for (const impact of impactPoints) {
      const coordKey = `${impact.x},${impact.y}`;
      const gridId = COORDS_TO_GRID_ID[coordKey];
      if (gridId !== undefined) {
        affected.push({ gridId, damagePercent: impact.damagePercent });
      }
    }
    if (affected.length === 0) {
      affected.push({ gridId: targetGridId, damagePercent: 100 });
    }
    return affected;
  }

  // With damageArea, calculate overlapping splash damage
  // Key: gridId, Value: { totalDamagePercent, hitCount }
  const damageMap = new Map<number, { totalDamagePercent: number; hitCount: number }>();

  for (const impact of impactPoints) {
    // For each impact point, apply the damageArea pattern
    for (const splash of damageArea) {
      const splashX = impact.x + splash.x;
      const splashY = impact.y + splash.y;
      const coordKey = `${splashX},${splashY}`;
      const gridId = COORDS_TO_GRID_ID[coordKey];
      
      if (gridId !== undefined) {
        // Scale splash damage by the impact point's damage percent
        const effectiveDamage = Math.floor((splash.damagePercent * impact.damagePercent) / 100);
        
        const existing = damageMap.get(gridId);
        if (existing) {
          // Accumulate damage from multiple hits
          existing.totalDamagePercent += effectiveDamage;
          existing.hitCount += 1;
        } else {
          damageMap.set(gridId, { totalDamagePercent: effectiveDamage, hitCount: 1 });
        }
      }
    }
  }

  // Convert map to array
  const affected: { gridId: number; damagePercent: number; hitCount: number }[] = [];
  for (const [gridId, data] of damageMap) {
    affected.push({
      gridId,
      damagePercent: data.totalDamagePercent,
      hitCount: data.hitCount,
    });
  }

  if (affected.length === 0) {
    affected.push({ gridId: targetGridId, damagePercent: 100, hitCount: 1 });
  }

  return affected;
}

// Get fixed attack pattern positions relative to attacker's grid position
// Fixed attacks hit specific positions relative to the attacker - they can't be aimed
// Now accounts for collapsed rows to calculate effective target rows
export function getFixedAttackPositions(
  attackerGridId: number,
  targetArea: TargetArea | undefined,
  isAttackerFriendly: boolean,
  attackerCollapsedRows?: Set<number>,
  targetCollapsedRows?: Set<number>
): { gridId: number; damagePercent: number; isOnEnemyGrid: boolean }[] {
  if (!targetArea || targetArea.data.length === 0) {
    return [];
  }

  const attackerCoords = GRID_ID_TO_COORDS[attackerGridId];
  if (!attackerCoords) return [];

  const affected: { gridId: number; damagePercent: number; isOnEnemyGrid: boolean }[] = [];

  // For fixed attacks, the y positions in data represent distance toward enemy:
  // y = -1 means 1 row toward enemy from attacker
  // y = -2 means 2 rows toward enemy from attacker
  // etc.
  
  // Friendly grid y: 0 = front, 1 = middle, 2 = back (attacker positions)
  // Enemy grid y: 0 = front (closest to friendly), 1 = middle, 2 = back
  
  // IMPORTANT: The grids face each other, so x positions need to be mirrored
  // when crossing to the enemy grid. A unit at x=0 (left from player view)
  // attacks an enemy at x=4 (also left from player view, but mirrored in coords)
  
  // When friendly attacks:
  // - Attacker at y=0 (front row): y=-1 hits enemy y=0, y=-2 hits enemy y=1, y=-3 hits enemy y=2
  // - Attacker at y=1 (middle row): y=-1 stays on friendly grid (front row), y=-2 hits enemy y=0
  // - Attacker at y=2 (back row): y=-1 hits friendly y=1, y=-2 hits friendly y=0, y=-3 hits enemy y=0

  for (const pos of targetArea.data) {
    // Calculate the effective y position
    // For friendly: negative y means toward enemy (decreasing our y, then crossing to enemy grid)
    // For enemy: negative y means toward friendly (decreasing our y, then crossing to friendly grid)
    
    let targetGridId: number | undefined;
    let isOnEnemyGrid = false;
    
    if (isAttackerFriendly) {
      // Friendly attacker
      const rowsTowardEnemy = Math.abs(pos.y); // How many rows toward enemy (pos.y is negative)
      const attackerRowFromFront = attackerCoords.y; // 0 = front, 2 = back
      
      // Rows on friendly side that the attack passes through
      const rowsOnFriendlySide = attackerRowFromFront; // Number of friendly rows in front of attacker
      
      if (rowsTowardEnemy <= rowsOnFriendlySide) {
        // Still on friendly grid - x position stays the same
        const newX = attackerCoords.x + pos.x;
        const newY = attackerCoords.y - rowsTowardEnemy;
        const coordKey = `${newX},${newY}`;
        targetGridId = COORDS_TO_GRID_ID[coordKey];
        isOnEnemyGrid = false;
      } else {
        // Crossed to enemy grid
        // Mirror the x coordinate so attacks align visually (left attacks left, right attacks right)
        const mirroredX = 4 - attackerCoords.x;
        const newX = mirroredX - pos.x; // Negate offset: pattern "left" (-1) should hit visual left (+1 in mirrored coords)

        const rowsIntoEnemyGrid = rowsTowardEnemy - rowsOnFriendlySide - 1; // -1 for the gap between grids

        // Calculate effective enemy row accounting for collapsed rows
        // If row 0 has collapsed, row 1 becomes the effective "front row"
        let effectiveEnemyY = rowsIntoEnemyGrid;
        if (targetCollapsedRows) {
          // Count how many rows before the target row have collapsed
          // These collapsed rows should be skipped
          let collapsedBeforeTarget = 0;
          for (let checkRow = 0; checkRow < rowsIntoEnemyGrid; checkRow++) {
            if (targetCollapsedRows.has(checkRow)) {
              collapsedBeforeTarget++;
            }
          }
          effectiveEnemyY = rowsIntoEnemyGrid + collapsedBeforeTarget;

          // Skip over the target row itself if it's collapsed
          while (effectiveEnemyY <= 2 && targetCollapsedRows.has(effectiveEnemyY)) {
            effectiveEnemyY++;
          }
        }

        const coordKey = `${newX},${effectiveEnemyY}`;
        targetGridId = COORDS_TO_GRID_ID[coordKey];
        isOnEnemyGrid = true;
      }
    } else {
      // Enemy attacker - mirror logic
      const rowsTowardFriendly = Math.abs(pos.y);
      const attackerRowFromFront = attackerCoords.y;
      const rowsOnEnemySide = attackerRowFromFront;
      
      if (rowsTowardFriendly <= rowsOnEnemySide) {
        // Still on enemy grid - x position stays the same
        const newX = attackerCoords.x + pos.x;
        const newY = attackerCoords.y - rowsTowardFriendly;
        const coordKey = `${newX},${newY}`;
        targetGridId = COORDS_TO_GRID_ID[coordKey];
        isOnEnemyGrid = true;
      } else {
        // Crossed to friendly grid - mirror x coordinate
        const mirroredX = 4 - attackerCoords.x;
        const newX = mirroredX - pos.x;

        const rowsIntoFriendlyGrid = rowsTowardFriendly - rowsOnEnemySide - 1;

        // Calculate effective friendly row accounting for collapsed rows
        let effectiveFriendlyY = rowsIntoFriendlyGrid;
        if (targetCollapsedRows) {
          // Count how many rows before the target row have collapsed
          let collapsedBeforeTarget = 0;
          for (let checkRow = 0; checkRow < rowsIntoFriendlyGrid; checkRow++) {
            if (targetCollapsedRows.has(checkRow)) {
              collapsedBeforeTarget++;
            }
          }
          effectiveFriendlyY = rowsIntoFriendlyGrid + collapsedBeforeTarget;

          // Skip over the target row itself if it's collapsed
          while (effectiveFriendlyY <= 2 && targetCollapsedRows.has(effectiveFriendlyY)) {
            effectiveFriendlyY++;
          }
        }

        const coordKey = `${newX},${effectiveFriendlyY}`;
        targetGridId = COORDS_TO_GRID_ID[coordKey];
        isOnEnemyGrid = false;
      }
    }
    
    if (targetGridId !== undefined) {
      affected.push({
        gridId: targetGridId,
        damagePercent: pos.damagePercent || 100,
        isOnEnemyGrid,
      });
    }
  }

  return affected;
}

// Calculate the row distance between attacker and target grids
// Returns the number of rows between them (used for range calculation)
export function calculateRowDistance(
  attackerGridId: number,
  targetGridId: number,
  attackerIsEnemy: boolean
): number {
  const attackerCoords = GRID_ID_TO_COORDS[attackerGridId];
  const targetCoords = GRID_ID_TO_COORDS[targetGridId];
  
  if (!attackerCoords || !targetCoords) return 999;
  
  // Both grids use y=0 as front, y=2 as back
  // Distance from friendly front (y=0) to enemy front (y=0) is 1 row
  // Friendly back (y=2) to enemy front (y=0) is 3 rows
  
  if (attackerIsEnemy) {
    // Enemy attacking friendly: enemy back to friendly front
    // Enemy y=2 to friendly y=0 = 2 + 0 + 1 = 3 rows
    return attackerCoords.y + targetCoords.y + 1;
  } else {
    // Friendly attacking enemy: friendly back to enemy front
    return attackerCoords.y + targetCoords.y + 1;
  }
}

// Check if an ability can reach a target based on range
export function isInRange(
  attackerGridId: number,
  targetGridId: number,
  minRange: number,
  maxRange: number,
  attackerIsEnemy: boolean
): boolean {
  const distance = calculateRowDistance(attackerGridId, targetGridId, attackerIsEnemy);
  return distance >= minRange && distance <= maxRange;
}

// Damage type IDs to property names mapping (matches DamageType enum)
export const DAMAGE_TYPE_MAP: Record<number, keyof DamageMods> = {
  1: "piercing",
  2: "cold",
  3: "crushing",
  4: "explosive",
  5: "fire",
  6: "torpedo",
  7: "depth_charge",
  8: "melee",
  9: "projectile",
  10: "shell",
} as const;
