/**
 * Mission parsing helpers for the Mission Tree feature.
 * v1: extract identity, required level, and prerequisite mission IDs.
 */

export type MissionPrereqEdgeType =
  | "complete-all"
  | "complete-any"
  | "active"
  | "inactive"
  | "not-started";

export interface MissionRewards {
  resources: Record<string, number>;
  units: Record<string, number>;
}

export interface ParsedObjective {
  title?: string;
  description?: string;
  type?: string;
  count?: number;
  unitId?: number;
  opponentId?: number;
  icon?: string;
  speakerNpcId?: number;
  jobId?: number;
  encounterId?: number;
  encounterIds?: number[];
  npcCompositionId?: number;
  prereqRaw?: Record<string, unknown>;
}

export interface ParsedMission {
  id: number;
  title: string;
  description?: string;
  giver?: string;
  level: number;
  displayLevel: number;
  prereqMissionIds: {
    all: number[];
    any: number[];
    active: number[];
    inactive: number[];
    notStarted: number[];
  };
  otherPrereqCount: number;
  otherPrereqTypes: string[];
  rewards: MissionRewards;
  objectives: ParsedObjective[];
}

type RawComponent = Record<string, any>;

function collectLevelFromRule(rule: RawComponent): number {
  if (rule?._t === "player_level_prereq_config" && typeof rule.min_level === "number") {
    return rule.min_level;
  }
  return 0;
}

function walkObjectiveLevels(objectivesConfig: RawComponent | undefined): number {
  if (!objectivesConfig) return 0;
  let max = 0;
  for (const obj of objectivesConfig.objectives ?? []) {
    for (const comp of obj.objective_components ?? []) {
      if (comp._t === "objective_completion_config" && comp.prereq) {
        max = Math.max(max, collectLevelFromRule(comp.prereq));
      }
    }
  }
  return max;
}

const MISSION_PREREQ_KEYS: Record<string, keyof ParsedMission["prereqMissionIds"]> = {
  complete_all_missions_prereq_config: "all",
  complete_any_mission_prereq_config: "any",
  active_missions_prereq_config: "active",
  inactive_missions_prereq_config: "inactive",
  not_started_missions_prereq_config: "notStarted",
};

export function parseMissions(raw: Record<string, RawComponent[]>): ParsedMission[] {
  const out: ParsedMission[] = [];
  for (const [, components] of Object.entries(raw)) {
    const identity = components.find((c) => c._t === "mission_identity_config");
    if (!identity) continue;

    const existence = components.find((c) => c._t === "mission_existence_config");
    const objectives = components.find((c) => c._t === "mission_objectives_config");
    const rewardsCfg = components.find((c) => c._t === "mission_rewards_config");
    const rewards: MissionRewards = {
      resources: { ...(rewardsCfg?.resources ?? {}) },
      units: Object.fromEntries(
        Object.entries(rewardsCfg?.units ?? {}).map(([k, v]) => [k, Number(v)])
      ),
    };

    let level = 0;
    const prereqMissionIds = {
      all: [] as number[],
      any: [] as number[],
      active: [] as number[],
      inactive: [] as number[],
      notStarted: [] as number[],
    };
    let otherPrereqCount = 0;
    const otherPrereqTypes: string[] = [];

    const allRules: RawComponent[] = [
      ...(existence?.start_rules ?? []),
      ...(existence?.persistence_rules ?? []),
    ];

    for (const rule of allRules) {
      const t = rule?._t;
      if (!t) continue;
      if (t === "player_level_prereq_config") {
        level = Math.max(level, rule.min_level ?? 0);
      } else if (t in MISSION_PREREQ_KEYS) {
        const bucket = MISSION_PREREQ_KEYS[t];
        for (const id of rule.mission_ids ?? []) {
          if (typeof id === "number") prereqMissionIds[bucket].push(id);
        }
      } else {
        otherPrereqCount++;
        if (!otherPrereqTypes.includes(t)) otherPrereqTypes.push(t);
      }
    }

    level = Math.max(level, walkObjectiveLevels(objectives));
    if (level === 0) level = 1;

    const parsedObjectives: ParsedObjective[] = (objectives?.objectives ?? []).map(
      (o: RawComponent) => {
        const comps: RawComponent[] = o.objective_components ?? [];
        const identity = comps.find((c) => c?._t === "objective_identity_config");
        const completion = comps.find((c) => c?._t === "objective_completion_config");
        const prereq = completion?.prereq as RawComponent | undefined;
        return {
          title: identity?.objective_text ?? o.title ?? o.name ?? o.objective_name,
          description: o.description ?? o.objective_description,
          type: prereq?._t ?? o._t,
          count: typeof prereq?.count === "number" ? prereq.count : undefined,
          unitId: typeof prereq?.unit_id === "number" ? prereq.unit_id : undefined,
          opponentId:
            typeof prereq?.opponent_id === "number"
              ? prereq.opponent_id
              : typeof identity?.npc_id === "number"
                ? identity.npc_id
                : undefined,
          icon: typeof identity?.icon === "string" ? identity.icon : undefined,
          speakerNpcId: typeof identity?.npc_id === "number" ? identity.npc_id : undefined,
          prereqRaw: prereq,
        };
      }
    );

    out.push({
      id: identity.id,
      title: identity.title,
      description: identity.description,
      giver: identity.giver,
      level,
      displayLevel: level,
      prereqMissionIds,
      otherPrereqCount,
      otherPrereqTypes,
      rewards,
      objectives: parsedObjectives,
    });
  }

  // Propagate level: a mission's displayLevel is max(its own level, displayLevel of every prereq it strictly requires).
  // We only propagate via "all" (complete-all) and "any" (complete-any) rules — those gate availability.
  // For "any" we take the MIN of the alternatives (the easiest path), then max with self.
  const byId = new Map(out.map((m) => [m.id, m]));
  const memo = new Map<number, number>();
  const stack = new Set<number>();
  const compute = (id: number): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (stack.has(id)) return byId.get(id)?.level ?? 1; // cycle guard
    const m = byId.get(id);
    if (!m) return 0;
    stack.add(id);
    let lvl = m.level;
    for (const pid of m.prereqMissionIds.all) {
      lvl = Math.max(lvl, compute(pid));
    }
    if (m.prereqMissionIds.any.length > 0) {
      let easiest = Infinity;
      for (const pid of m.prereqMissionIds.any) {
        easiest = Math.min(easiest, compute(pid));
      }
      if (easiest !== Infinity) lvl = Math.max(lvl, easiest);
    }
    stack.delete(id);
    memo.set(id, lvl);
    return lvl;
  };
  for (const m of out) m.displayLevel = compute(m.id);

  return out.sort((a, b) => a.displayLevel - b.displayLevel || a.id - b.id);
}

export function buildMissionIndex(missions: ParsedMission[]): Map<number, ParsedMission> {
  return new Map(missions.map((m) => [m.id, m]));
}

export interface MissionEdge {
  from: number; // prerequisite mission id
  to: number; // dependent mission id
  type: MissionPrereqEdgeType;
}

export function buildMissionEdges(missions: ParsedMission[]): MissionEdge[] {
  const ids = new Set(missions.map((m) => m.id));
  const edges: MissionEdge[] = [];
  const push = (from: number, to: number, type: MissionPrereqEdgeType) => {
    if (ids.has(from) && ids.has(to)) edges.push({ from, to, type });
  };
  for (const m of missions) {
    for (const id of m.prereqMissionIds.all) push(id, m.id, "complete-all");
    for (const id of m.prereqMissionIds.any) push(id, m.id, "complete-any");
    for (const id of m.prereqMissionIds.active) push(id, m.id, "active");
    for (const id of m.prereqMissionIds.inactive) push(id, m.id, "inactive");
    for (const id of m.prereqMissionIds.notStarted) push(id, m.id, "not-started");
  }
  return edges;
}

export interface RemainingFilter {
  currentLevel: number;
  completedIds: Set<number>;
  hideAboveLevel?: boolean;
}

/**
 * Returns the subset of missions still relevant given completed IDs + level.
 * "Available now" = all `complete-all` prereqs are completed AND
 *   (no `complete-any` rule, or at least one of its IDs is completed).
 * `inactive`/`not-started` prereqs are treated as satisfied if those IDs are completed
 * (best-effort approximation without live game state).
 */
export function filterRemaining(
  missions: ParsedMission[],
  filter: RemainingFilter
): { remaining: ParsedMission[]; availableNow: Set<number> } {
  const { currentLevel, completedIds, hideAboveLevel } = filter;
  const remaining = missions.filter((m) => {
    if (completedIds.has(m.id)) return false;
    if (hideAboveLevel && m.displayLevel > currentLevel) return false;
    return true;
  });
  const availableNow = new Set<number>();
  for (const m of remaining) {
    if (m.displayLevel > currentLevel) continue;
    const allOk = m.prereqMissionIds.all.every((id) => completedIds.has(id));
    const anyOk =
      m.prereqMissionIds.any.length === 0 ||
      m.prereqMissionIds.any.some((id) => completedIds.has(id));
    if (allOk && anyOk) availableNow.add(m.id);
  }
  return { remaining, availableNow };
}
