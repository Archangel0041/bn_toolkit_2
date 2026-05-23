/**
 * Helpers for resolving the "producing building" of a job or project id
 * (i.e. the composition whose `project_list_config.jobs` array references it),
 * and turning prereq configs into human-readable lines.
 */

export interface BuildingInfo {
  compositionId: number;
  nameKey?: string;        // localization key for the building name
  iconKey?: string;
  cost?: Record<string, number>;
  prereqs?: Array<Record<string, any>>;
}

export type ProjectBuildingIndex = Map<number, BuildingInfo>;

export function buildProjectBuildingIndex(
  compositions: Record<string, any[]> | undefined | null
): ProjectBuildingIndex {
  const idx: ProjectBuildingIndex = new Map();
  if (!compositions) return idx;
  for (const [cidStr, comps] of Object.entries(compositions)) {
    if (!Array.isArray(comps)) continue;
    const cid = Number(cidStr);
    const smc = comps.find((c) => c?._t === "structure_menu_config") ?? {};
    const info: BuildingInfo = {
      compositionId: cid,
      nameKey: typeof smc.name === "string" ? smc.name : undefined,
      iconKey: typeof smc.icon === "string" ? smc.icon : undefined,
      cost: smc.cost && typeof smc.cost === "object" ? smc.cost : undefined,
      prereqs: Array.isArray(smc.prereqs) ? smc.prereqs : undefined,
    };
    // Both project_list_config (unit production projects) and
    // job_list_config (collect jobs / resource production) reference the
    // same job/project id space used by mission objectives.
    const collectIds = (key: string): number[] => {
      const c = comps.find((x) => x?._t === key);
      return Array.isArray(c?.jobs)
        ? (c.jobs as unknown[]).filter((v): v is number => typeof v === "number")
        : [];
    };
    for (const id of [...collectIds("project_list_config"), ...collectIds("job_list_config")]) {
      if (!idx.has(id)) idx.set(id, info);
    }
  }
  return idx;
}

/**
 * Format seconds as a short readable duration: 1d2h, 3h45m, 2m30s, 45s.
 */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return h > 0 ? `${d}d${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m${s}s` : `${m}m`;
  return `${s}s`;
}

/**
 * Convert a single building/job prereq config into a short human-readable line.
 * Returns null if we don't know how to render it.
 */
export function describePrereq(
  prereq: Record<string, any> | undefined,
  resolvers: {
    missionTitle?: (id: number) => string | undefined;
    buildingName?: (compositionId: number) => string | undefined;
  } = {}
): string | null {
  if (!prereq || typeof prereq !== "object") return null;
  const t: string = prereq._t ?? "";
  switch (t) {
    case "player_level_prereq_config":
      return `Player Lv ${prereq.min_level}`;
    case "building_level_prereq_config": {
      const bn = resolvers.buildingName?.(prereq.composition_id ?? prereq.building_id);
      return `${bn ?? `Building #${prereq.composition_id ?? prereq.building_id ?? "?"}`} Lv ${prereq.level ?? prereq.min_level ?? "?"}`;
    }
    case "have_any_of_these_structures_prereq_config": {
      const ids: number[] = Array.isArray(prereq.composition_ids) ? prereq.composition_ids : [];
      const names = ids.map((id) => resolvers.buildingName?.(id) ?? `#${id}`);
      return `Requires: ${names.join(" or ")}`;
    }
    case "complete_all_missions_prereq_config":
    case "complete_any_mission_prereq_config": {
      const ids: number[] = Array.isArray(prereq.mission_ids) ? prereq.mission_ids : [];
      const names = ids.slice(0, 3).map((id) => resolvers.missionTitle?.(id) ?? `#${id}`);
      const more = ids.length > 3 ? ` (+${ids.length - 3})` : "";
      const verb = t === "complete_any_mission_prereq_config" ? "Any of" : "Complete";
      return `${verb}: ${names.join(", ")}${more}`;
    }
    case "active_missions_prereq_config":
    case "inactive_missions_prereq_config":
    case "not_started_missions_prereq_config":
      return null; // gameplay-state prereqs — noisy, skip
    case "min_population_capacity_prereq_config":
      return `Population ≥ ${prereq.min_capacity ?? prereq.value ?? "?"}`;
    default:
      return null;
  }
}
