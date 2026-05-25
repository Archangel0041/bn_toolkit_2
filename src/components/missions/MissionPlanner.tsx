import { useMemo } from "react";
import type { ParsedMission, ParsedObjective } from "@/lib/missions";
import type { JobInfoEntry } from "@/lib/dataLoader";
import {
  type ProjectBuildingIndex,
  type BuildingInfo,
  type BuildingDetails,
  formatDuration,
  getJobActiveMissionGate,
  getBuildingDetails,
} from "@/lib/missionJobs";
import { useLanguage } from "@/contexts/LanguageContext";
import { getJobIconUrl, getResourceIconUrl } from "@/lib/resourceImages";

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
  rewards: Record<string, number>; // rewards * count
  gateMissionIds: number[];
  isQuestGated: boolean;
}

interface AssistTask {
  description: string;
  count: number;
}

interface BuildEvent {
  compositionId: number;
  name: string;
  icon?: string;
  count: number; // how many NEW buildings to construct for this mission
  perBuildSeconds: number;
  totalSeconds: number; // sequential build estimate
  costPer: Record<string, number>;
  costTotal: Record<string, number>;
  startBy: number; // latest time to start construction
}

interface PlannedMission {
  id: number;
  title: string;
  level: number;
  builds: BuildEvent[];
  questGatedJobs: PlannedJob[];
  prepJobs: PlannedJob[];
  assist: AssistTask[];
  battle: string[];
  dialogue: string[];
  other: string[];
  prepSeconds: number;
  gateSeconds: number;
  rewards: Record<string, number>; // mission rewards (resources only)
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

function addRes(into: Record<string, number>, from: Record<string, number> | undefined, scale = 1) {
  if (!from) return;
  for (const [k, v] of Object.entries(from)) {
    const n = Number(v);
    if (!n) continue;
    into[k] = (into[k] ?? 0) + n * scale;
  }
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

  const {
    plan,
    schedule,
    totalSeconds,
    totalBuildCost,
    totalJobRewards,
    totalMissionRewards,
    peakPopulation,
    peakPopulationMission,
  } = useMemo(() => {
    const sorted = [...missions].sort(
      (a, b) => a.displayLevel - b.displayLevel || a.id - b.id
    );
    const byId = new Map(missions.map((m) => [m.id, m]));
    const detailsCache = new Map<number, BuildingDetails | undefined>();
    const getDetails = (cid: number) => {
      if (!detailsCache.has(cid)) detailsCache.set(cid, getBuildingDetails(compositions, cid));
      return detailsCache.get(cid);
    };

    // First pass — collect planned jobs per mission (without builds yet)
    const drafts: PlannedMission[] = [];
    for (const m of sorted) {
      const pm: PlannedMission = {
        id: m.id,
        title: loc(m.title, m.title),
        level: m.displayLevel,
        builds: [],
        questGatedJobs: [],
        prepJobs: [],
        assist: [],
        battle: [],
        dialogue: [],
        other: [],
        prepSeconds: 0,
        gateSeconds: 0,
        rewards: { ...m.rewards.resources },
      };

      for (const o of m.objectives) {
        const kind = classify(o);
        const count = o.count ?? 1;

        if (kind === "assist") {
          pm.assist.push({ description: loc(o.title, o.title ?? "Assist a friend"), count });
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

        const ref = o.jobId ?? o.projectId;
        let binfo: BuildingInfo | undefined =
          ref != null ? projectBuildingIndex.get(ref) : undefined;
        if (!binfo && o.compositionId != null) binfo = resolveBuildingByComp(o.compositionId);
        if (!binfo) {
          if (o.title) pm.other.push(loc(o.title, o.title));
          continue;
        }

        const jobEntry = ref != null ? jobs?.[String(ref)] : undefined;
        const gate = jobEntry ? getJobActiveMissionGate(jobEntry) : [];
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
        const rewards: Record<string, number> = {};
        addRes(rewards, jobEntry?.rewards, count);

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
          rewards,
          gateMissionIds: gate,
          isQuestGated,
        };
        if (isQuestGated) {
          pm.questGatedJobs.push(pj);
          pm.gateSeconds += total;
        } else {
          pm.prepJobs.push(pj);
          pm.prepSeconds += total;
        }
      }
      drafts.push(pm);
    }

    // Schedule activation / completion
    const activation = new Map<number, number>();
    const completion = new Map<number, number>();
    const memo = new Map<number, number>();
    const stack = new Set<number>();
    const gateSec = new Map<number, number>();
    const prepSec = new Map<number, number>();
    for (const pm of drafts) {
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
      for (const pid of m.prereqMissionIds.all) act = Math.max(act, computeCompletion(pid));
      if (m.prereqMissionIds.any.length > 0) {
        let easiest = Infinity;
        for (const pid of m.prereqMissionIds.any) easiest = Math.min(easiest, computeCompletion(pid));
        if (easiest !== Infinity) act = Math.max(act, easiest);
      }
      activation.set(id, act);
      const comp = act + (gateSec.get(id) ?? 0);
      completion.set(id, comp);
      memo.set(id, comp);
      stack.delete(id);
      return comp;
    };
    for (const pm of drafts) computeCompletion(pm.id);

    // Second pass — building demand & construction events, peak population, totals
    const owned = new Map<number, number>(); // cid -> running max # of buildings already constructed
    const totalBuildCost: Record<string, number> = {};
    const totalJobRewards: Record<string, number> = {};
    const totalMissionRewards: Record<string, number> = {};
    let peakPopulation = 0;
    let peakPopulationMission = "";

    const schedule = new Map<
      number,
      { activation: number; completion: number; prepLatestStart: number }
    >();

    for (const pm of drafts) {
      // demand per cid this mission = sum of counts for all (prep+gated) jobs at that cid
      const demand = new Map<number, number>();
      const allJobs = [...pm.prepJobs, ...pm.questGatedJobs];
      for (const j of allJobs) {
        demand.set(j.compositionId, (demand.get(j.compositionId) ?? 0) + j.count);
        addRes(totalJobRewards, j.rewards);
      }
      addRes(totalMissionRewards, pm.rewards);

      const act = activation.get(pm.id) ?? 0;
      const comp = completion.get(pm.id) ?? act;

      for (const [cid, need] of demand) {
        const have = owned.get(cid) ?? 0;
        if (need > have) {
          const delta = need - have;
          const det = getDetails(cid);
          const buildName =
            allJobs.find((j) => j.compositionId === cid)?.buildingName ??
            loc(det?.nameKey, `Building #${cid}`);
          const buildIcon = allJobs.find((j) => j.compositionId === cid)?.buildingIcon;
          const per = det?.buildTime ?? 0;
          // Sequential estimate (can be parallelized in-game but provides upper bound).
          const totalBuild = per * delta;
          const startBy = Math.max(0, act - totalBuild);
          const costPer = det?.cost ?? {};
          const costTotal: Record<string, number> = {};
          addRes(costTotal, costPer, delta);
          addRes(totalBuildCost, costTotal);
          pm.builds.push({
            compositionId: cid,
            name: buildName,
            icon: buildIcon,
            count: delta,
            perBuildSeconds: per,
            totalSeconds: totalBuild,
            costPer,
            costTotal,
            startBy,
          });
          owned.set(cid, need);
        }
      }
      pm.builds.sort((a, b) => a.startBy - b.startBy);

      // Population snapshot while this mission's jobs are active
      let pop = 0;
      for (const [cid, count] of owned) {
        const det = getDetails(cid);
        pop += (det?.population ?? 0) * count;
      }
      if (pop > peakPopulation) {
        peakPopulation = pop;
        peakPopulationMission = pm.title;
      }

      schedule.set(pm.id, {
        activation: act,
        completion: comp,
        prepLatestStart: Math.max(0, act - (prepSec.get(pm.id) ?? 0)),
      });
    }

    const totalSeconds = drafts.reduce(
      (mx, pm) => Math.max(mx, completion.get(pm.id) ?? 0),
      0
    );

    return {
      plan: drafts,
      schedule,
      totalSeconds,
      totalBuildCost,
      totalJobRewards,
      totalMissionRewards,
      peakPopulation,
      peakPopulationMission,
    };
  }, [missions, jobs, compositions, projectBuildingIndex, t, visibleMissionIds]);

  const assistSummary = useMemo(() => {
    const list: Array<{ missionTitle: string; level: number; tasks: AssistTask[] }> = [];
    for (const m of plan) {
      if (m.assist.length > 0)
        list.push({ missionTitle: m.title, level: m.level, tasks: m.assist });
    }
    return list;
  }, [plan]);

  if (plan.length === 0) return null;

  const resLabel = (k: string) => {
    for (const lk of [`resource_${k}_name`, `bn_resource_${k}`, `resource_${k}`]) {
      const tr = t(lk);
      if (tr && tr !== lk) return tr;
    }
    return k.replace(/_/g, " ");
  };

  const renderResourceRow = (rec: Record<string, number>) => {
    const entries = Object.entries(rec).filter(([, v]) => v > 0);
    if (entries.length === 0) return <span className="text-xs text-muted-foreground">none</span>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {entries
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded border bg-background/70 px-1.5 py-0.5 text-[11px]"
              title={resLabel(k)}
            >
              <img
                src={getResourceIconUrl(k)}
                alt=""
                className="h-3.5 w-3.5 object-contain"
                onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                draggable={false}
              />
              <span className="tabular-nums font-medium">{v.toLocaleString()}</span>
            </span>
          ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Plan totals */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Plan totals</h2>
            <p className="text-xs text-muted-foreground">
              Costs, rewards and peak population required to clear all visible missions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border bg-primary/10 px-3 py-1.5 text-sm">
              <span className="font-medium">Total time: </span>
              <span className="tabular-nums font-semibold">
                {formatDuration(totalSeconds) || "0s"}
              </span>
            </span>
            <span className="rounded-md border bg-amber-500/10 px-3 py-1.5 text-sm">
              <span className="font-medium">Peak population: </span>
              <span className="tabular-nums font-semibold">{peakPopulation}</span>
              {peakPopulationMission && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (@ {peakPopulationMission})
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border bg-muted/30 p-2 space-y-1">
            <div className="text-xs font-semibold">Building cost</div>
            {renderResourceRow(totalBuildCost)}
          </div>
          <div className="rounded border bg-muted/30 p-2 space-y-1">
            <div className="text-xs font-semibold">Job rewards</div>
            {renderResourceRow(totalJobRewards)}
          </div>
          <div className="rounded border bg-muted/30 p-2 space-y-1">
            <div className="text-xs font-semibold">Mission rewards</div>
            {renderResourceRow(totalMissionRewards)}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Timeline (t = 0 is now)</h2>
          <p className="text-xs text-muted-foreground">
            Missions in completion order. Build new structures and prep jobs early so they finish
            exactly when the mission activates. Quest-gated jobs only start after activation.
          </p>
        </div>
        <ol className="space-y-2">
          {plan.map((m, i) => {
            const s = schedule.get(m.id) ?? {
              activation: 0,
              completion: 0,
              prepLatestStart: 0,
            };
            const prepIsBottleneck =
              s.prepLatestStart === 0 && m.prepSeconds > s.activation;
            const activatesIn = s.activation === 0 ? "now" : `in ${formatDuration(s.activation)}`;
            return (
              <li key={m.id} className="rounded-md border bg-muted/20 p-3 space-y-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                    #{i + 1}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                    Lv {m.level}
                  </span>
                  <span className="text-sm font-semibold">{m.title}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                    activates t={formatDuration(s.activation) || "0s"} · done t=
                    {formatDuration(s.completion) || "0s"}
                  </span>
                </div>

                {m.builds.length > 0 && (
                  <div className="rounded border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs space-y-1">
                    <div className="font-medium text-emerald-700 dark:text-emerald-300">
                      Construct (for mission activating {activatesIn})
                    </div>
                    <ul className="space-y-1">
                      {m.builds.map((b) => (
                        <li key={b.compositionId} className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            {b.icon ? (
                              <img
                                src={b.icon}
                                alt=""
                                className="h-5 w-5 shrink-0 rounded object-contain"
                                onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                                draggable={false}
                              />
                            ) : (
                              <div className="h-5 w-5 shrink-0 rounded bg-muted" />
                            )}
                            <span className="font-medium">×{b.count}</span>
                            <span className="truncate">{b.name}</span>
                            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                              start by t={formatDuration(b.startBy) || "0s"}
                              {b.perBuildSeconds > 0 && ` · ${formatDuration(b.perBuildSeconds)}/ea`}
                            </span>
                          </div>
                          {Object.keys(b.costTotal).length > 0 && (
                            <div className="pl-7">{renderResourceRow(b.costTotal)}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.prepJobs.length > 0 && (
                  <div className="rounded border bg-background/60 p-2 text-xs space-y-1">
                    <div className="font-medium">
                      Prep jobs — latest start t={formatDuration(s.prepLatestStart) || "0s"} (mission
                      activates {activatesIn})
                      {prepIsBottleneck && (
                        <span className="ml-1 text-amber-600 dark:text-amber-400">
                          (start now — prep is the bottleneck)
                        </span>
                      )}
                    </div>
                    <ul className="space-y-0.5">
                      {m.prepJobs.map((j) => (
                        <li key={j.key} className="flex items-center gap-2">
                          <span className="truncate">
                            {j.jobName}{" "}
                            <span className="text-muted-foreground">@ {j.buildingName}</span>
                          </span>
                          <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                            ×{j.count}
                            {j.perItemSeconds != null ? ` · ${formatDuration(j.totalSeconds)}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.questGatedJobs.length > 0 && (
                  <div className="rounded border bg-background/60 p-2 text-xs space-y-1">
                    <div className="font-medium">
                      After activation (t={formatDuration(s.activation) || "0s"}), queue:
                    </div>
                    <ul className="space-y-0.5">
                      {m.questGatedJobs.map((j) => (
                        <li key={j.key} className="flex items-center gap-2">
                          <span className="truncate">
                            {j.jobName}{" "}
                            <span className="text-muted-foreground">@ {j.buildingName}</span>
                          </span>
                          <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                            ×{j.count}
                            {j.perItemSeconds != null ? ` · ${formatDuration(j.totalSeconds)}` : ""}
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
                      <span
                        key={`b${idx}`}
                        className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-700 dark:text-rose-300"
                      >
                        ⚔ {b}
                      </span>
                    ))}
                    {m.assist.map((a, idx) => (
                      <span
                        key={`a${idx}`}
                        className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-300"
                      >
                        🤝 Assist ×{a.count} — {a.description}
                      </span>
                    ))}
                    {m.dialogue.map((d, idx) => (
                      <span
                        key={`d${idx}`}
                        className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-700 dark:text-sky-300"
                      >
                        💬 {d}
                      </span>
                    ))}
                    {m.other.map((o, idx) => (
                      <span
                        key={`o${idx}`}
                        className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground"
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
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
