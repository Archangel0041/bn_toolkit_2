/**
 * Encounters - Helper functions for battle encounters
 * 
 * Uses game data from the global store (loaded from Supabase Storage)
 */

import { getEncounterById as getEncounterFromStore, getAllEncounterIds as getAllEncounterIdsFromStore } from "@/lib/gameDataStore";
import type { Encounter, EncounterUnit } from "@/types/encounters";

export function getEncounterById(id: number | string): Encounter | undefined {
  return getEncounterFromStore(id);
}

export function getAllEncounterIds(): string[] {
  return getAllEncounterIdsFromStore();
}

export function getEncounterWaves(encounter: Encounter): EncounterUnit[][] {
  if (!encounter.units || encounter.units.length === 0) {
    return [];
  }

  // Group units by wave_number (undefined = wave 0)
  const waveMap = new Map<number, EncounterUnit[]>();
  
  encounter.units.forEach(unit => {
    if (unit.grid_id === undefined) return;
    
    const waveNum = unit.wave_number ?? 0;
    if (!waveMap.has(waveNum)) {
      waveMap.set(waveNum, []);
    }
    waveMap.get(waveNum)!.push(unit);
  });

  // Sort by wave number and return as array
  const sortedWaves = Array.from(waveMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([_, units]) => units);

  return sortedWaves;
}

export function getUnitAtGridPosition(units: EncounterUnit[], gridId: number): EncounterUnit | undefined {
  return units.find(u => u.grid_id === gridId);
}
