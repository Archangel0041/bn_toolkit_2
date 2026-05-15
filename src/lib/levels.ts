/**
 * Per-level data for the Levels tab.
 * Source: Config/levels.json (player level → unlocks/limits).
 */
import type { LevelEntry } from "@/lib/dataLoader";

export interface ParsedLevel {
  level: number;
  nextLevelXp: number; // XP needed to advance from this level to the next
  populationLimit: number;
  populationDelta: number; // change vs previous level
  attackZones: number;
  attackZonesDelta: number;
  encounterLimits: { land: string; min: number; max: number }[];
  awards: Record<string, number>;
  dialog?: string;
}

export function parseLevels(raw: Record<string, LevelEntry>): ParsedLevel[] {
  const sorted = Object.entries(raw)
    .map(([k, v]) => ({ level: parseInt(k, 10), v }))
    .filter((e) => Number.isFinite(e.level))
    .sort((a, b) => a.level - b.level);

  const out: ParsedLevel[] = [];
  let prevPop = 0;
  let prevZones = 0;
  for (const { level, v } of sorted) {
    const populationLimit = v.population_limit ?? 0;
    const attackZones = v.attack_zones_count ?? 0;
    const encounterLimits = Object.entries(v.encounter_limits ?? {}).map(
      ([land, lim]) => ({
        land,
        min: lim?.min_encounter_limit ?? 0,
        max: lim?.max_encounter_limit ?? 0,
      })
    );
    const awards: Record<string, number> = {};
    for (const [k, n] of Object.entries(v.awards ?? {})) {
      if (typeof n === "number" && n > 0) awards[k] = n;
    }
    out.push({
      level,
      nextLevelXp: v.next_level_xp ?? 0,
      populationLimit,
      populationDelta: populationLimit - prevPop,
      attackZones,
      attackZonesDelta: attackZones - prevZones,
      encounterLimits,
      awards,
      dialog: v.dialog,
    });
    prevPop = populationLimit;
    prevZones = attackZones;
  }
  return out;
}
