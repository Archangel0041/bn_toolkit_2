// Battle targeting and blocking calculations
import { getUnitById } from "@/lib/units";
import { UnitBlocking } from "@/data/gameEnums";
import { LineOfFire } from "@/types/battleSimulator";
import type { EncounterUnit } from "@/types/encounters";
import type { PartyUnit } from "@/types/battleSimulator";
import { GRID_ID_TO_COORDS, COORDS_TO_GRID_ID } from "@/types/battleSimulator";

export interface BlockingUnit {
  gridId: number;
  unitId: number;
  blocking: number; // UnitBlocking value
  x: number;
  y: number;
}

// Get blocking level of a unit (from statsConfig.blocking)
export function getUnitBlocking(unitId: number): number {
  const unit = getUnitById(unitId);
  return unit?.statsConfig?.blocking ?? UnitBlocking.None;
}

// Get all units with their blocking levels on a grid
export function getBlockingUnits(
  units: EncounterUnit[] | PartyUnit[],
  isEnemy: boolean
): BlockingUnit[] {
  return units
    .filter(u => {
      const gridId = isEnemy ? (u as EncounterUnit).grid_id : (u as PartyUnit).gridId;
      return gridId !== undefined;
    })
    .map(u => {
      const gridId = isEnemy ? (u as EncounterUnit).grid_id! : (u as PartyUnit).gridId;
      const unitId = isEnemy ? (u as EncounterUnit).unit_id : (u as PartyUnit).unitId;
      const coords = GRID_ID_TO_COORDS[gridId];
      return {
        gridId,
        unitId,
        blocking: getUnitBlocking(unitId),
        x: coords?.x ?? 0,
        y: coords?.y ?? 0,
      };
    });
}

// Check if a target is blocked by units in front of it based on line of fire
// Returns: { isBlocked: boolean, blockedBy?: BlockingUnit }
// 
// IMPORTANT: Blocking propagates - if a unit blocks at row Y, all units at row Y+1, Y+2, etc.
// are also blocked because the attack cannot pass through the blocker.
// 
// For cross-grid attacks, we need to account for x-coordinate mirroring.
// When a friendly unit at x=0 attacks an enemy, the attack goes "straight ahead".
// But enemy grid coords are mirrored, so enemy x=4 is visually aligned with friendly x=0.
export function checkLineOfFire(
  attackerGridId: number,
  targetGridId: number,
  lineOfFire: number,
  attackerIsEnemy: boolean,
  targetUnits: BlockingUnit[]
): { isBlocked: boolean; blockedBy?: BlockingUnit; reason?: string } {
  // Indirect fire ignores all blocking
  if (lineOfFire === LineOfFire.Indirect) {
    return { isBlocked: false };
  }

  // Contact fire now checks blocking like other fire types
  // This is critical for reticle-based abilities (target_type: 2) where the reticle
  // can be placed beyond the front row, and blocking should still apply

  const attackerCoords = GRID_ID_TO_COORDS[attackerGridId];
  const targetCoords = GRID_ID_TO_COORDS[targetGridId];
  
  if (!attackerCoords || !targetCoords) {
    return { isBlocked: false };
  }

  // Get units in the same column as the target that could block
  // For attacks from friendly -> enemy, "in front" means units at lower y (closer to attacker)
  const unitsInColumn = targetUnits.filter(u => {
    const unitCoords = GRID_ID_TO_COORDS[u.gridId];
    if (!unitCoords) return false;
    
    // Don't consider the target itself
    if (u.gridId === targetGridId) return false;
    
    // Unit must be in the same column as the target (on the target's grid)
    if (unitCoords.x !== targetCoords.x) return false;
    
    // Unit must be in front of the target (lower y = closer to attacker)
    return unitCoords.y < targetCoords.y;
  });

  // Sort by y (front to back - lowest y first)
  unitsInColumn.sort((a, b) => {
    const aCoords = GRID_ID_TO_COORDS[a.gridId];
    const bCoords = GRID_ID_TO_COORDS[b.gridId];
    return (aCoords?.y ?? 0) - (bCoords?.y ?? 0);
  });

  // Check each unit in path based on line of fire rules
  // If ANY unit blocks, the target is blocked (blocking propagates to all rows behind)
  for (const blockingUnit of unitsInColumn) {
    const blocking = blockingUnit.blocking;

    switch (lineOfFire) {
      case LineOfFire.Contact:
        // Contact fire: Blocked by ANY unit in the path
        // Contact fire requires direct physical contact, so any unit presence blocks
        return {
          isBlocked: true,
          blockedBy: blockingUnit,
          reason: "Contact fire blocked by unit in path"
        };

      case LineOfFire.Direct:
        // Direct: Can fire PAST None blocking units
        // Blocked by Partial, Full, God
        if (blocking >= UnitBlocking.Partial) {
          return { 
            isBlocked: true, 
            blockedBy: blockingUnit,
            reason: "Direct fire blocked by Partial+ blocking"
          };
        }
        break;
        
      case LineOfFire.Precise:
        // Precise: Can fire past None and Partial blocking
        // Blocked by Full, God
        if (blocking >= UnitBlocking.Full) {
          return { 
            isBlocked: true, 
            blockedBy: blockingUnit,
            reason: "Precise fire blocked by Full+ blocking"
          };
        }
        break;
        
      // Indirect handled above - never blocked
    }
  }

  return { isBlocked: false };
}

// Find the frontmost unblocked target position for initial reticle placement
export function findFrontmostUnblockedPosition(
  attackerGridId: number,
  minRange: number,
  maxRange: number,
  lineOfFire: number,
  attackerIsEnemy: boolean,
  targetUnits: BlockingUnit[]
): number | null {
  const attackerCoords = GRID_ID_TO_COORDS[attackerGridId];
  if (!attackerCoords) return null;
  
  // Check center column first (x=2), then expand outward
  const columnOrder = [2, 1, 3, 0, 4];
  
  // Check front row first (y=0), then middle (y=1), then back (y=2)
  for (let y = 0; y <= 2; y++) {
    for (const x of columnOrder) {
      const coordKey = `${x},${y}`;
      const gridId = COORDS_TO_GRID_ID[coordKey];
      if (gridId === undefined) continue;
      
      // Check if in range
      const range = calculateRange(attackerGridId, gridId, attackerIsEnemy);
      if (range < minRange || range > maxRange) continue;
      
      // Check if blocked
      const blockCheck = checkLineOfFire(attackerGridId, gridId, lineOfFire, attackerIsEnemy, targetUnits);
      if (!blockCheck.isBlocked) {
        return gridId;
      }
    }
  }
  
  // Fallback to center of front row even if blocked
  return COORDS_TO_GRID_ID["2,0"] ?? 2;
}

// Calculate row distance from attacker to target for range checking
// Returns the number of "rows" between them, accounting for collapsed rows
// Collapsed rows on either side reduce the effective range needed
export function calculateRange(
  attackerGridId: number,
  targetGridId: number,
  attackerIsEnemy: boolean,
  attackerCollapsedRows?: Set<number>,
  targetCollapsedRows?: Set<number>
): number {
  const attackerCoords = GRID_ID_TO_COORDS[attackerGridId];
  const targetCoords = GRID_ID_TO_COORDS[targetGridId];
  
  if (!attackerCoords || !targetCoords) return 999;
  
  // Count collapsed rows between attacker and the "gap" between grids
  // Attacker side: rows 0 to (attackerY - 1) that are collapsed
  let attackerCollapsedCount = 0;
  if (attackerCollapsedRows) {
    for (let row = 0; row < attackerCoords.y; row++) {
      if (attackerCollapsedRows.has(row)) {
        attackerCollapsedCount++;
      }
    }
  }
  
  // Target side: rows 0 to (targetY - 1) that are collapsed
  let targetCollapsedCount = 0;
  if (targetCollapsedRows) {
    for (let row = 0; row < targetCoords.y; row++) {
      if (targetCollapsedRows.has(row)) {
        targetCollapsedCount++;
      }
    }
  }
  
  // Base distance: attacker row + target row + 1 (gap between grids)
  // Subtract collapsed rows from both sides
  const effectiveAttackerY = attackerCoords.y - attackerCollapsedCount;
  const effectiveTargetY = targetCoords.y - targetCollapsedCount;
  
  return effectiveAttackerY + effectiveTargetY + 1;
}

// Check if a target is within ability range
export function isTargetInRange(
  attackerGridId: number,
  targetGridId: number,
  minRange: number,
  maxRange: number,
  attackerIsEnemy: boolean
): boolean {
  const range = calculateRange(attackerGridId, targetGridId, attackerIsEnemy);
  return range >= minRange && range <= maxRange;
}

// Get all targetable grid positions with their range and blocking status
export interface TargetingInfo {
  gridId: number;
  inRange: boolean;
  range: number;
  isBlocked: boolean;
  blockedBy?: BlockingUnit;
  blockReason?: string;
}

export function getTargetingInfo(
  attackerGridId: number,
  minRange: number,
  maxRange: number,
  lineOfFire: number,
  attackerIsEnemy: boolean,
  targetUnits: BlockingUnit[]
): TargetingInfo[] {
  const result: TargetingInfo[] = [];
  
  // Check all grid positions
  const allGridIds = Object.keys(GRID_ID_TO_COORDS).map(k => parseInt(k));
  
  for (const gridId of allGridIds) {
    const range = calculateRange(attackerGridId, gridId, attackerIsEnemy);
    const inRange = range >= minRange && range <= maxRange;
    
    const blockCheck = checkLineOfFire(
      attackerGridId,
      gridId,
      lineOfFire,
      attackerIsEnemy,
      targetUnits
    );
    
    result.push({
      gridId,
      inRange,
      range,
      isBlocked: blockCheck.isBlocked,
      blockedBy: blockCheck.blockedBy,
      blockReason: blockCheck.reason,
    });
  }
  
  return result;
}
