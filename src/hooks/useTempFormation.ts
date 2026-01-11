import { useState, useCallback, useEffect, useRef } from "react";
import type { PartyUnit } from "@/types/battleSimulator";
import type { Encounter } from "@/types/encounters";
import { getUnitById } from "@/lib/units";
import { getNextAvailablePosition } from "@/lib/battleCalculations";
import { checkDeployLimits, checkEncounterUnitLimit } from "@/lib/unitRestrictions";

interface UseTempFormationOptions {
  encounter?: Encounter | null;
  initialUnits?: PartyUnit[];
}

export function useTempFormation(options: UseTempFormationOptions = {}) {
  const [units, setUnits] = useState<PartyUnit[]>(options.initialUnits || []);
  const hasInitialized = useRef(false);
  
  // Sync initial units on first render (handles async location.state)
  useEffect(() => {
    if (!hasInitialized.current && options.initialUnits && options.initialUnits.length > 0) {
      console.log("Loading initial formation:", options.initialUnits);
      setUnits([...options.initialUnits]);
      hasInitialized.current = true;
    }
  }, [options.initialUnits]);

  const addUnit = useCallback((unitId: number, preferredGridId?: number): { success: boolean; error?: string } => {
    const unit = getUnitById(unitId);
    if (!unit) return { success: false, error: "Unit not found" };

    // Check encounter unit limit
    if (options.encounter) {
      const limitCheck = checkEncounterUnitLimit(options.encounter, units);
      if (!limitCheck.allowed) {
        return { 
          success: false, 
          error: `Unit limit reached: ${limitCheck.current}/${limitCheck.limit}` 
        };
      }
    }

    // Check tag deploy limits
    const deployCheck = checkDeployLimits(unitId, units);
    if (!deployCheck.allowed) {
      const violation = deployCheck.violations[0];
      return { 
        success: false, 
        error: `Deploy limit reached for ${violation.stringId}: ${violation.current}/${violation.limit}` 
      };
    }

    const occupiedPositions = units.map(u => u.gridId);
    
    let gridId: number | null = null;
    
    // If preferred position provided and available, use it
    if (preferredGridId !== undefined && !occupiedPositions.includes(preferredGridId)) {
      gridId = preferredGridId;
    } else {
      // Otherwise use preferred row logic
      const preferredRow = unit.statsConfig?.preferred_row || 1;
      gridId = getNextAvailablePosition(preferredRow, occupiedPositions);
    }

    if (gridId === null) return { success: false, error: "Grid full" };

    const maxRank = unit.statsConfig?.stats?.length || 1;

    setUnits(prev => [...prev, {
      unitId,
      gridId,
      rank: maxRank,
    }]);
    
    return { success: true };
  }, [units, options.encounter]);

  const removeUnit = useCallback((gridId: number) => {
    setUnits(prev => prev.filter(u => u.gridId !== gridId));
  }, []);

  const setUnitRank = useCallback((gridId: number, rank: number) => {
    setUnits(prev => prev.map(u => 
      u.gridId === gridId ? { ...u, rank } : u
    ));
  }, []);

  const moveUnit = useCallback((fromGridId: number, toGridId: number) => {
    setUnits(prev => {
      const fromUnit = prev.find(u => u.gridId === fromGridId);
      const toUnit = prev.find(u => u.gridId === toGridId);
      
      if (!fromUnit) return prev;
      
      return prev.map(u => {
        if (u.gridId === fromGridId) {
          return { ...u, gridId: toGridId };
        }
        if (toUnit && u.gridId === toGridId) {
          return { ...u, gridId: fromGridId };
        }
        return u;
      });
    });
  }, []);

  const loadFromParty = useCallback((partyUnits: PartyUnit[]) => {
    setUnits([...partyUnits]);
  }, []);

  const clearFormation = useCallback(() => {
    setUnits([]);
  }, []);

  return {
    units,
    addUnit,
    removeUnit,
    setUnitRank,
    moveUnit,
    loadFromParty,
    clearFormation,
  };
}
