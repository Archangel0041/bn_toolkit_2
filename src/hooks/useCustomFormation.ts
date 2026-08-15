/**
 * Custom Formation Hook - Manages custom enemy formations
 * 
 * Allows logged-in users to create and edit enemy unit placements
 */

import { useState, useCallback } from "react";
import { getUnitById } from "@/lib/units";
import { ALL_GRID_POSITIONS } from "@/types/encounters";
import type { EncounterUnit } from "@/types/encounters";
import type { PartyUnit } from "@/types/battleSimulator";

export interface CustomFormationUnit extends EncounterUnit {
  rank?: number;
}

export interface CustomWave {
  units: CustomFormationUnit[];
}

export interface CustomFormation {
  name: string;
  waves: CustomWave[];
  level?: number;
  /** Player-side formation (both sides of the battle are editable) */
  playerUnits?: PartyUnit[];
}

export function useCustomFormation(initialFormation?: CustomFormation) {
  const [formation, setFormation] = useState<CustomFormation>(
    initialFormation || {
      name: "Custom Formation",
      waves: [{ units: [] }],
      level: 1,
      playerUnits: [],
    }
  );
  const [currentWave, setCurrentWave] = useState(0);

  const getCurrentWaveUnits = useCallback(() => {
    return formation.waves[currentWave]?.units || [];
  }, [formation.waves, currentWave]);

  const addUnit = useCallback((unitId: number, gridId?: number): { success: boolean; error?: string } => {
    const unit = getUnitById(unitId);
    if (!unit) return { success: false, error: "Unit not found" };

    const waveUnits = getCurrentWaveUnits();
    const occupiedPositions = new Set(waveUnits.map(u => u.grid_id));

    // Find available position if not specified
    let targetGridId = gridId;
    if (targetGridId === undefined) {
      const available = ALL_GRID_POSITIONS.find(pos => !occupiedPositions.has(pos));
      if (available === undefined) {
        return { success: false, error: "Grid is full" };
      }
      targetGridId = available;
    }

    if (occupiedPositions.has(targetGridId)) {
      return { success: false, error: "Position occupied" };
    }

    const maxRank = unit.statsConfig?.stats?.length || 1;

    const newUnit: CustomFormationUnit = {
      unit_id: unitId,
      grid_id: targetGridId,
      wave_number: currentWave,
      rank: maxRank,
    };

    setFormation(prev => ({
      ...prev,
      waves: prev.waves.map((wave, idx) =>
        idx === currentWave
          ? { ...wave, units: [...wave.units, newUnit] }
          : wave
      ),
    }));

    return { success: true };
  }, [currentWave, getCurrentWaveUnits]);

  const removeUnit = useCallback((gridId: number) => {
    setFormation(prev => ({
      ...prev,
      waves: prev.waves.map((wave, idx) =>
        idx === currentWave
          ? { ...wave, units: wave.units.filter(u => u.grid_id !== gridId) }
          : wave
      ),
    }));
  }, [currentWave]);

  const moveUnit = useCallback((fromGridId: number, toGridId: number) => {
    setFormation(prev => ({
      ...prev,
      waves: prev.waves.map((wave, idx) => {
        if (idx !== currentWave) return wave;
        
        const fromUnit = wave.units.find(u => u.grid_id === fromGridId);
        const toUnit = wave.units.find(u => u.grid_id === toGridId);
        
        if (!fromUnit) return wave;
        
        return {
          ...wave,
          units: wave.units.map(u => {
            if (u.grid_id === fromGridId) {
              return { ...u, grid_id: toGridId };
            }
            if (toUnit && u.grid_id === toGridId) {
              return { ...u, grid_id: fromGridId };
            }
            return u;
          }),
        };
      }),
    }));
  }, [currentWave]);

  const setUnitRank = useCallback((gridId: number, rank: number) => {
    setFormation(prev => ({
      ...prev,
      waves: prev.waves.map((wave, idx) =>
        idx === currentWave
          ? {
              ...wave,
              units: wave.units.map(u =>
                u.grid_id === gridId ? { ...u, rank } : u
              ),
            }
          : wave
      ),
    }));
  }, [currentWave]);

  const addWave = useCallback(() => {
    setFormation(prev => ({
      ...prev,
      waves: [...prev.waves, { units: [] }],
    }));
    setCurrentWave(formation.waves.length);
  }, [formation.waves.length]);

  const removeWave = useCallback((waveIndex: number) => {
    if (formation.waves.length <= 1) return;
    
    setFormation(prev => ({
      ...prev,
      waves: prev.waves.filter((_, idx) => idx !== waveIndex),
    }));
    
    if (currentWave >= formation.waves.length - 1) {
      setCurrentWave(Math.max(0, formation.waves.length - 2));
    }
  }, [formation.waves.length, currentWave]);

  const clearWave = useCallback(() => {
    setFormation(prev => ({
      ...prev,
      waves: prev.waves.map((wave, idx) =>
        idx === currentWave ? { ...wave, units: [] } : wave
      ),
    }));
  }, [currentWave]);

  const setFormationName = useCallback((name: string) => {
    setFormation(prev => ({ ...prev, name }));
  }, []);

  const setFormationLevel = useCallback((level: number) => {
    setFormation(prev => ({ ...prev, level }));
  }, []);

  const loadFormation = useCallback((newFormation: CustomFormation) => {
    setFormation(newFormation);
    setCurrentWave(0);
  }, []);

  const clearFormation = useCallback(() => {
    setFormation({
      name: "Custom Formation",
      waves: [{ units: [] }],
      level: 1,
      playerUnits: [],
    });
    setCurrentWave(0);
  }, []);

  // ===== Player side =====
  const playerUnits = formation.playerUnits ?? [];

  const setPlayerUnits = useCallback((updater: (prev: PartyUnit[]) => PartyUnit[]) => {
    setFormation(prev => ({ ...prev, playerUnits: updater(prev.playerUnits ?? []) }));
  }, []);

  const addPlayerUnit = useCallback((unitId: number, gridId?: number): { success: boolean; error?: string } => {
    const unit = getUnitById(unitId);
    if (!unit) return { success: false, error: "Unit not found" };

    const current = formation.playerUnits ?? [];
    const occupied = new Set(current.map(u => u.gridId));

    let targetGridId = gridId;
    if (targetGridId === undefined || occupied.has(targetGridId)) {
      const available = ALL_GRID_POSITIONS.find(pos => !occupied.has(pos));
      if (available === undefined) return { success: false, error: "Grid is full" };
      targetGridId = available;
    }

    const maxRank = unit.statsConfig?.stats?.length || 1;
    setPlayerUnits(prev => [...prev, { unitId, gridId: targetGridId!, rank: maxRank }]);
    return { success: true };
  }, [formation.playerUnits, setPlayerUnits]);

  const removePlayerUnit = useCallback((gridId: number) => {
    setPlayerUnits(prev => prev.filter(u => u.gridId !== gridId));
  }, [setPlayerUnits]);

  const setPlayerUnitRank = useCallback((gridId: number, rank: number) => {
    setPlayerUnits(prev => prev.map(u => (u.gridId === gridId ? { ...u, rank } : u)));
  }, [setPlayerUnits]);

  const movePlayerUnit = useCallback((fromGridId: number, toGridId: number) => {
    setPlayerUnits(prev => {
      const fromUnit = prev.find(u => u.gridId === fromGridId);
      if (!fromUnit) return prev;
      const toUnit = prev.find(u => u.gridId === toGridId);
      return prev.map(u => {
        if (u.gridId === fromGridId) return { ...u, gridId: toGridId };
        if (toUnit && u.gridId === toGridId) return { ...u, gridId: fromGridId };
        return u;
      });
    });
  }, [setPlayerUnits]);

  const clearPlayerUnits = useCallback(() => {
    setPlayerUnits(() => []);
  }, [setPlayerUnits]);

  const loadPlayerUnits = useCallback((units: PartyUnit[]) => {
    setPlayerUnits(() => [...units]);
  }, [setPlayerUnits]);

  // Convert to encounter format for simulation
  const toEncounterUnits = useCallback((): EncounterUnit[] => {
    return formation.waves.flatMap((wave, waveIdx) =>
      wave.units.map(u => ({
        unit_id: u.unit_id,
        grid_id: u.grid_id,
        wave_number: waveIdx,
      }))
    );
  }, [formation.waves]);

  return {
    formation,
    currentWave,
    setCurrentWave,
    getCurrentWaveUnits,
    addUnit,
    removeUnit,
    moveUnit,
    setUnitRank,
    addWave,
    removeWave,
    clearWave,
    setFormationName,
    setFormationLevel,
    loadFormation,
    clearFormation,
    toEncounterUnits,
    // Player side
    playerUnits,
    addPlayerUnit,
    removePlayerUnit,
    setPlayerUnitRank,
    movePlayerUnit,
    clearPlayerUnits,
    loadPlayerUnits,
  };
}