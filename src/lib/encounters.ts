import encountersData from "@/data/battle_encounters.json";
import type { Encounter, EncountersData, EncounterUnit } from "@/types/encounters";

const rawData = encountersData as unknown as EncountersData;

export function getEncounterById(id: number | string): Encounter | undefined {
  return rawData.armies[String(id)];
}

export function getAllEncounterIds(): string[] {
  return Object.keys(rawData.armies).sort((a, b) => parseInt(a) - parseInt(b));
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
