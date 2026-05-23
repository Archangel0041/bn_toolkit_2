import { useMemo } from "react";
import type { ParsedMission, ParsedObjective } from "@/lib/missions";
import type { JobInfoEntry } from "@/lib/dataLoader";
import {
  type ProjectBuildingIndex,
  type BuildingInfo,
  formatDuration,
  getJobActiveMissionGate,
} from "@/lib/missionJobs";
import { useLanguage } from "@/contexts/LanguageContext";
import { getJobIconUrl } from "@/lib/resourceImages";

interface Props {
  missions: ParsedMission[];
  jobs: Record<string, JobInfoEntry>;
  compositions: Record<string, any[]>;
  projectBuildingIndex: ProjectBuildingIndex;
}

type ObjKind = "build" | "assist" | "battle" | "dialogue" | "other";

interface PlannedJob {
  key: string;
  jobId?: number;
  projectId?: number;
  compositionId: number;
  buildingName: string;
  buildingIcon?: string;
  jobName: string;
  jobIcon?: string;
  perItemSeconds?: number;
  count: number;
  totalSeconds: number;
  /** mission IDs this job is gated by (must be active). [] = generic */
  gateMissionIds: number[];
}

interface AssistTask {
  description: string;
  count: number;
}

interface PlannedMission {
  id: number;
  title: string;
  level: number;
  questGatedJobs: PlannedJob[];
  prepJobs: PlannedJob[]; // generic jobs needed by this mission
  assist: AssistTask[];
  battle: string[];
  dialogue: string[];
  other: string[];
  prepSeconds: number;
  gateSeconds: number;
}

interface BuildingUsageWindow {
  compositionId: number;
  name: string;
  icon?: string;
  missionLevels: number[]; // sorted unique
  missionTitles: string[];
}

function classify(o: ParsedObjective): ObjKind {
  const t = (o.type ?? "").toLowerCase();
  if (t.includes("assist") || t.includes("visit_friend") || t.includes("help_friend"))
    return "assist";
  if (
    t.includes("encounter") ||
    t.includes("attack_npc") ||
    t.includes("opponent") ||
    t.includes("defeat") ||
    t.includes("battle") ||
    t.includes("kill") ||
    t.includes("pvp") ||
    o.encounterId != null ||
    (o.encounterIds && o.encounterIds.length > 0) ||
    o.opponentId != null ||
    o.npcCompositionId != null
  )
    return "battle";
  if (
    t.includes("dialog") ||
    t.includes("talk") ||
    t.includes("speak") ||
    t.includes("conversation") ||
    t.includes("npc_interaction")
  )
    return "dialogue";
  if (
    o.jobId != null ||
    o.projectId != null ||
    o.compositionId != null ||
    t.includes("job") ||
    t.includes("project") ||
    t.includes("build") ||
    t.includes("construct") ||
    t.includes("collect") ||
    t.includes("has_composition") ||
    t.includes("composition")
  )
    return "build";
  return "other";
}

export function MissionPlanner({
  missions,
  jobs,
  compositions,
  projectBuildingIndex,
}: Props) {
  const { t } = useLanguage();
  const loc = (key: string | undefined, fb: string) => {
    if (!key) return fb;
    const v = t(key);
    return v && v !== key ? v : fb;
  };

  const visibleMissionIds = useMemo(
    () => new Set(missions.map((m) => m.id)),
    [missions]
  );

  const resolveBuildingByComp = (cid: number): BuildingInfo | undefined => {
    const comps = compositions?.[String(cid)];
    if (!Array.isArray(comps)) return undefined;
    const smc = comps.find((c) => c?._t === "structure_menu_config") ?? {};
    return {
      compositionId: cid,
      nameKey: typeof smc.name === "string" ? smc.name : undefined,
      iconKey: typeof smc.icon === "string" ? smc.icon : undefined,
    };
  };

  const { plan, buildingWindows, schedule, totalSeconds } = useMemo(() => {
    const sorted = [...missions].sort(
      (a, b) => a.displayLevel - b.displayLevel || a.id - b.id
    );
    const plan: PlannedMission[] = [];
    const usage = new Map<number, BuildingUsageWindow>();
    const byId = new Map(missions.map((m) => [m.id, m]));

    for (const m of sorted) {
      const pm: PlannedMission = {
        id: m.id,
        title: loc(m.title, m.title),
        level: m.displayLevel,
        questGatedJobs: [],
        prepJobs: [],
        assist: [],
        battle: [],
        dialogue: [],
        other: [],
        prepSeconds: 0,
        gateSeconds: 0,
      };

      for (const o of m.objectives) {
        const kind = classify(o);
        const count = o.count ?? 1;

        if (kind === "assist") {
          pm.assist.push({
            description: loc(o.title, o.title ?? "Assist a friend"),
            count,
          });
          continue;
        }
        if (kind === "battle") {
          pm.battle.push(loc(o.title, o.title ?? `Defeat target ×${count}`));
          continue;
        }
        if (kind === "dialogue") {
          pm.dialogue.push(loc(o.title, o.title ?? "Talk to NPC"));
          continue;
        }
        if (kind === "other") {
          if (o.title) pm.other.push(loc(o.title, o.title));
          continue;
        }

        // build/job/project/collect
        const ref = o.jobId ?? o.projectId;
        let binfo: BuildingInfo | undefined =
          ref != null ? projectBuildingIndex.get(ref) : undefined;
        if (!binfo && o.compositionId != null)
          binfo = resolveBuildingByComp(o.compositionId);
        if (!binfo) {
          if (o.title) pm.other.push(loc(o.title, o.title));
          continue;
        }

        const jobEntry = ref != null ? jobs?.[String(ref)] : undefined;
        const gate = jobEntry ? getJobActiveMissionGate(jobEntry) : [];
        // "has_composition" objectives only need the building to EXIST —
        // they can be satisfied by pre-building.
        const isHasComposition =
          (o.type ?? "").toLowerCase().includes("has_composition") ||
          (o.compositionId != null && ref == null);
        const isQuestGated =
          !isHasComposition &&
          gate.length > 0 &&
          gate.some((mid) => mid === m.id || visibleMissionIds.has(mid));

        const buildingName = loc(binfo.nameKey, `Building #${binfo.compositionId}`);
        const buildingIcon = binfo.iconKey ? getJobIconUrl(binfo.iconKey) : undefined;
        const jobName = jobEntry?.name
          ? loc(jobEntry.name, jobEntry.name)
          : o.title
            ? loc(o.title, o.title)
            : o.compositionId != null
              ? buildingName
              : `Job #${ref ?? "?"}`;
        const jobIcon = jobEntry?.icon
          ? getJobIconUrl(jobEntry.icon)
          : o.icon
            ? getJobIconUrl(o.icon)
            : undefined;
        const per = jobEntry?.build_time;
        const total = (per ?? 0) * count;
        const pj: PlannedJob = {
          key:
            o.jobId != null
              ? `j:${o.jobId}`
              : o.projectId != null
                ? `p:${o.projectId}`
                : `c:${binfo.compositionId}`,
          jobId: o.jobId,
          projectId: o.projectId,
          compositionId: binfo.compositionId,
          buildingName,
          buildingIcon,
          jobName,
          jobIcon,
          perItemSeconds: per,
          count,
          totalSeconds: total,
          gateMissionIds: gate,
        };
        if (isQuestGated) {
          pm.questGatedJobs.push(pj);
          pm.gateSeconds += total;
        } else {
          pm.prepJobs.push(pj);
          pm.prepSeconds += total;
        }

        let w = usage.get(binfo.compositionId);
        if (!w) {
          w = {
            compositionId: binfo.compositionId,
            name: buildingName,
            icon: buildingIcon,
            missionLevels: [],
            missionTitles: [],
          };
          usage.set(binfo.compositionId, w);
        }
        if (!w.missionLevels.includes(m.displayLevel))
          w.missionLevels.push(m.displayLevel);
        if (!w.missionTitles.includes(pm.title))
          w.missionTitles.push(pm.title);
      }
      plan.push(pm);
    }

    const buildingWindows = Array.from(usage.values())
      .map((w) => ({ ...w, missionLevels: [...w.missionLevels].sort((a, b) => a - b) }))
      .sort((a, b) => a.missionLevels[0] - b.missionLevels[0]);

    // ---- Time scheduling. t=0 = now; all initial buildings assumed in place.
    // activation[m] = max completion of prereq missions
    // completion[m] = activation[m] + gateSeconds[m]
    // prep latest start[m] = max(0, activation[m] - prepSeconds[m])
    // (battle/dialogue/assist time not modelled — treated as instant.)
    const activation = new Map<number, number>();
    const completion = new Map<number, number>();
    const memo = new Map<number, number>();
    const stack = new Set<number>();
    const gateSec = new Map<number, number>();
    const prepSec = new Map<number, number>();
    for (const pm of plan) {
      gateSec.set(pm.id, pm.gateSeconds);
      prepSec.set(pm.id, pm.prepSeconds);
    }
    const computeCompletion = (id: number): number => {
      if (memo.has(id)) return memo.get(id)!;
      if (stack.has(id)) return 0;
      const m = byId.get(id);
      if (!m) return 0;
      stack.add(id);
      let act = 0;
      for (const pid of m.prereqMissionIds.all) {
        act = Math.max(act, computeCompletion(pid));
      }
      if (m.prereqMissionIds.any.length > 0) {
        let easiest = Infinity;
        for (const pid of m.prereqMissionIds.any) {
          easiest = Math.min(easiest, computeCompletion(pid));
        }
        if (easiest !== Infinity) act = Math.max(act, easiest);
      }
      activation.set(id, act);
      const comp = act + (gateSec.get(id) ?? 0);
      completion.set(id, comp);
      memo.set(id, comp);
      stack.delete(id);
      return comp;
    };
    for (const pm of plan) computeCompletion(pm.id);

    const schedule = new Map<
      number,
      { activation: number; completion: number; prepLatestStart: number }
    >();
    for (const pm of plan) {
      const act = activation.get(pm.id) ?? 0;
      const comp = completion.get(pm.id) ?? act;
      const prep = prepSec.get(pm.id) ?? 0;
      schedule.set(pm.id, {
        activation: act,
        completion: comp,
        prepLatestStart: Math.max(0, act - prep),
      });
    }
    const totalSeconds = plan.reduce(
      (mx, pm) => Math.max(mx, completion.get(pm.id) ?? 0),
      0
    );

    return { plan, buildingWindows, schedule, totalSeconds };
  }, [missions, jobs, compositions, projectBuildingIndex, t, visibleMissionIds]);

  // Aggregate the two pools across the whole plan, grouped by building.
  const pools = useMemo(() => {
    type Pool = {
      compositionId: number;
      name: string;
      icon?: string;
      totalSeconds: number;
      jobs: Map<
        string,
        {
          jobName: string;
          jobIcon?: string;
          perItemSeconds?: number;
          count: number;
          missions: Set<string>;
        }
      >;
    };
    const make = () => new Map<number, Pool>();
    const generic = make();
    const gated = make();
    const accumulate = (map: Map<number, Pool>, j: PlannedJob, missionTitle: string) => {
      let p = map.get(j.compositionId);
      if (!p) {
        p = {
          compositionId: j.compositionId,
          name: j.buildingName,
          icon: j.buildingIcon,
          totalSeconds: 0,
          jobs: new Map(),
        };
        map.set(j.compositionId, p);
      }
      p.totalSeconds += j.totalSeconds;
      let u = p.jobs.get(j.key);
      if (!u) {
        u = {
          jobName: j.jobName,
          jobIcon: j.jobIcon,
          perItemSeconds: j.perItemSeconds,
          count: 0,
          missions: new Set(),
        };
        p.jobs.set(j.key, u);
      }
      u.count += j.count;
      u.missions.add(missionTitle);
    };
    for (const m of plan) {
      for (const j of m.prepJobs) accumulate(generic, j, m.title);
      for (const j of m.questGatedJobs) accumulate(gated, j, m.title);
    }
    const toArr = (m: Map<number, Pool>) =>
      Array.from(m.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
    return { generic: toArr(generic), gated: toArr(gated) };
  }, [plan]);

  // Total assistance summary
  const assistSummary = useMemo(() => {
    const list: Array<{ missionTitle: string; level: number; tasks: AssistTask[] }> = [];
    for (const m of plan) {
      if (m.assist.length > 0)
        list.push({ missionTitle: m.title, level: m.level, tasks: m.assist });
    }
    return list;
  }, [plan]);

  // Teardown hints: any building unused for >= 5 mission-levels between two windows
  const teardownHints = useMemo(() => {
    const hints: Array<{ name: string; gapStart: number; gapEnd: number }> = [];
    for (const w of buildingWindows) {
      for (let i = 1; i < w.missionLevels.length; i++) {
        const gap = w.missionLevels[i] - w.missionLevels[i - 1];
        if (gap >= 5) {
          hints.push({
            name: w.name,
            gapStart: w.missionLevels[i - 1],
            gapEnd: w.missionLevels[i],
          });
        }
      }
    }
    return hints;
  }, [buildingWindows]);

  if (plan.length === 0) return null;

  const renderPool = (
    title: string,
    sub: string,
    pool: ReturnType<typeof Array.from> extends Array<infer P> ? P[] : never
  ) => {
    if ((pool as any[]).length === 0) return null;
    return (
      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {(pool as any[]).map((p) => (
            <div key={p.compositionId} className="rounded-md border bg-background/60 p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                {p.icon ? (
                  <img
                    src={p.icon}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded object-contain"
                    onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                    draggable={false}
                  />
                ) : (
                  <div className="h-7 w-7 shrink-0 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  {p.totalSeconds > 0 && (
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      ~{formatDuration(p.totalSeconds)} of queue
                    </div>
                  )}
                </div>
              </div>
              <ul className="space-y-1">
                {Array.from(p.jobs.entries()).map(([k, u]: [string, any]) => (
                  <li
                    key={k}
                    className="flex items-center gap-2 rounded border bg-background px-2 py-1 text-xs"
                  >
                    {u.jobIcon && (
                      <img
                        src={u.jobIcon}
                        alt=""
                        className="h-4 w-4 shrink-0 rounded object-contain"
                        onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                        draggable={false}
                      />
                    )}
                    <span className="flex-1 truncate" title={u.jobName}>
                      {u.jobName}
                    </span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                      ×{u.count}
                    </span>
                    {u.perItemSeconds != null && (
                      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                        {formatDuration(u.perItemSeconds * u.count)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Mission planner</h2>
          <p className="text-xs text-muted-foreground">
            Jobs split into <span className="font-medium">generic</span> (no mission gate — start
            anytime to pre-stock) and <span className="font-medium">quest-gated</span> (only
            buildable while the mission is active). Aim to have generic items ready just in time
            for each mission.
          </p>
        </div>

        {renderPool(
          "Generic queue (prepare in advance)",
          "These have no mission prerequisite. Knock them out early so they're ready when the mission activates.",
          pools.generic as any
        )}

        {renderPool(
          "Quest-gated queue (only after activation)",
          "These jobs require the relevant mission to be ACTIVE before you can queue them.",
          pools.gated as any
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Timeline</h2>
          <p className="text-xs text-muted-foreground">
            Missions in completion order. Each block shows what to prep ahead, what to queue once
            active, plus battles/assists/dialogue you'll need.
          </p>
        </div>
        <ol className="space-y-2">
          {plan.map((m, i) => (
            <li
              key={m.id}
              className="rounded-md border bg-muted/20 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                  #{i + 1}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                  Lv {m.level}
                </span>
                <span className="text-sm font-semibold">{m.title}</span>
                {(m.prepSeconds > 0 || m.gateSeconds > 0) && (
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                    prep {formatDuration(m.prepSeconds) || "0s"} · gated{" "}
                    {formatDuration(m.gateSeconds) || "0s"}
                  </span>
                )}
              </div>

              {m.prepJobs.length > 0 && (
                <div className="rounded border bg-background/60 p-2 text-xs space-y-1">
                  <div className="font-medium">Start ahead of time:</div>
                  <ul className="space-y-0.5">
                    {m.prepJobs.map((j) => (
                      <li key={j.key} className="flex items-center gap-2">
                        <span className="truncate">
                          {j.jobName}{" "}
                          <span className="text-muted-foreground">@ {j.buildingName}</span>
                        </span>
                        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                          ×{j.count}
                          {j.perItemSeconds != null
                            ? ` · ${formatDuration(j.totalSeconds)}`
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {m.questGatedJobs.length > 0 && (
                <div className="rounded border bg-background/60 p-2 text-xs space-y-1">
                  <div className="font-medium">After activation, queue:</div>
                  <ul className="space-y-0.5">
                    {m.questGatedJobs.map((j) => (
                      <li key={j.key} className="flex items-center gap-2">
                        <span className="truncate">
                          {j.jobName}{" "}
                          <span className="text-muted-foreground">@ {j.buildingName}</span>
                        </span>
                        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                          ×{j.count}
                          {j.perItemSeconds != null
                            ? ` · ${formatDuration(j.totalSeconds)}`
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(m.battle.length > 0 ||
                m.assist.length > 0 ||
                m.dialogue.length > 0 ||
                m.other.length > 0) && (
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {m.battle.map((b, idx) => (
                    <span key={`b${idx}`} className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-700 dark:text-rose-300">
                      ⚔ {b}
                    </span>
                  ))}
                  {m.assist.map((a, idx) => (
                    <span key={`a${idx}`} className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">
                      🤝 Assist ×{a.count} — {a.description}
                    </span>
                  ))}
                  {m.dialogue.map((d, idx) => (
                    <span key={`d${idx}`} className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">
                      💬 {d}
                    </span>
                  ))}
                  {m.other.map((o, idx) => (
                    <span key={`o${idx}`} className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {o}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* Building lifecycle */}
      <div className="rounded-lg border p-4 space-y-2">
        <div>
          <h2 className="text-lg font-semibold">Building lifecycle</h2>
          <p className="text-xs text-muted-foreground">
            When each building is needed. Big gaps mean you can tear it down and rebuild later to
            save population.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {buildingWindows.map((w) => (
            <div key={w.compositionId} className="flex items-center gap-2 rounded border bg-background/60 px-2 py-1.5 text-xs">
              {w.icon ? (
                <img
                  src={w.icon}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded object-contain"
                  onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                  draggable={false}
                />
              ) : (
                <div className="h-6 w-6 shrink-0 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{w.name}</div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  Needed at Lv {w.missionLevels.join(", ")}
                </div>
              </div>
            </div>
          ))}
        </div>
        {teardownHints.length > 0 && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs space-y-1">
            <div className="font-medium text-amber-700 dark:text-amber-300">
              Teardown opportunities
            </div>
            <ul className="space-y-0.5">
              {teardownHints.map((h, i) => (
                <li key={i}>
                  <span className="font-medium">{h.name}</span>: unused between Lv {h.gapStart} and
                  Lv {h.gapEnd} — consider removing and rebuilding later.
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Assistance summary */}
      {assistSummary.length > 0 && (
        <div className="rounded-lg border p-4 space-y-2">
          <div>
            <h2 className="text-lg font-semibold">Assistance you'll owe</h2>
            <p className="text-xs text-muted-foreground">
              Mission objectives that require helping a friend or visiting their base.
            </p>
          </div>
          <ul className="space-y-1 text-xs">
            {assistSummary.map((s) => (
              <li key={s.missionTitle} className="flex items-start gap-2">
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 tabular-nums">
                  Lv {s.level}
                </span>
                <span className="font-medium">{s.missionTitle}:</span>
                <span className="text-muted-foreground">
                  {s.tasks.map((t) => `${t.description} ×${t.count}`).join("; ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
