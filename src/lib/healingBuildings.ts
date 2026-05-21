/**
 * Healing-building scaling helpers.
 *
 * Hospitals, Vehicle Repair Bays (VRB), and Ship Repair Bays (SRB) each have a
 * normal and an advanced variant defined in compositions.json. Each variant has
 * a 10-level `building_upgrade_config.levels[]` array where:
 *   - `input` is the % of the unit's base heal_cost charged at that level
 *   - `time`  is the % of the unit's base heal_time used at that level
 *
 * We apply Math.ceil(base * pct / 100) per resource and to time.
 */

import { useEffect, useState } from "react";
import { loadCompositions } from "@/lib/dataLoader";
import { UnitTag } from "@/data/gameEnums";

export type HealingBuildingKind = "hospital" | "vrb" | "srb";

export interface HealingBuildingGroup {
  kind: HealingBuildingKind;
  label: string;
  normalId: number;
  advancedId: number;
}

export const HEALING_BUILDING_GROUPS: Record<HealingBuildingKind, HealingBuildingGroup> = {
  hospital: { kind: "hospital", label: "Hospital", normalId: 133, advancedId: 134 },
  vrb: { kind: "vrb", label: "VRB", normalId: 142, advancedId: 143 },
  srb: { kind: "srb", label: "SRB", normalId: 140, advancedId: 141 },
};

export interface BuildingUpgradeLevel {
  input?: number;
  time?: number;
  maximum_healing_queue_size?: number;
  upgrade_cost?: Record<string, number>;
  upgrade_time?: number;
}

/** Return the healing building group that applies to a unit based on its tags. */
export function getApplicableBuildingGroup(unitTags: number[] | undefined): HealingBuildingGroup | null {
  if (!unitTags || unitTags.length === 0) return null;
  if (unitTags.includes(UnitTag.Hospital)) return HEALING_BUILDING_GROUPS.hospital;
  if (unitTags.includes(UnitTag.Vrb)) return HEALING_BUILDING_GROUPS.vrb;
  if (unitTags.includes(UnitTag.Srb)) return HEALING_BUILDING_GROUPS.srb;
  return null;
}

/** Pull the 10-level upgrade table from a composition entry. */
export function getBuildingLevels(
  compositions: Record<string, any[]> | null,
  buildingId: number
): BuildingUpgradeLevel[] {
  if (!compositions) return [];
  const entry = compositions[String(buildingId)];
  if (!entry) return [];
  const cfg = entry.find((c: any) => c?._t === "building_upgrade_config");
  return (cfg?.levels as BuildingUpgradeLevel[]) ?? [];
}

/** Scale a heal_cost record by the given percent, ceiling per resource. */
export function scaleHealCost(
  baseCost: Record<string, number> | undefined,
  inputPercent: number | undefined
): Record<string, number> {
  if (!baseCost) return {};
  const pct = inputPercent ?? 100;
  const out: Record<string, number> = {};
  for (const [resource, amount] of Object.entries(baseCost)) {
    out[resource] = Math.ceil((amount * pct) / 100);
  }
  return out;
}

/** Scale a heal_time (seconds) by the given percent, ceiling. */
export function scaleHealTime(baseTime: number | undefined, timePercent: number | undefined): number {
  if (!baseTime) return 0;
  const pct = timePercent ?? 100;
  return Math.ceil((baseTime * pct) / 100);
}

/** Lightweight hook: loads compositions.json on demand and caches it. */
export function useCompositions(): Record<string, any[]> | null {
  const [comp, setComp] = useState<Record<string, any[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCompositions()
      .then((d) => {
        if (!cancelled) setComp(d);
      })
      .catch((err) => {
        console.warn("[useCompositions] failed to load compositions.json", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return comp;
}
