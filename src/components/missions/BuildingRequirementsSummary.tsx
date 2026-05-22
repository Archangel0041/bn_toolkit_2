import { useMemo } from "react";
import type { ParsedMission } from "@/lib/missions";
import type { JobInfoEntry } from "@/lib/dataLoader";
import {
  type ProjectBuildingIndex,
  type BuildingInfo,
  formatDuration,
} from "@/lib/missionJobs";
import { useLanguage } from "@/contexts/LanguageContext";
import { getJobIconUrl } from "@/lib/unitImages";

interface Props {
  missions: ParsedMission[];
  jobs: Record<string, JobInfoEntry>;
  compositions: Record<string, any[]>;
  projectBuildingIndex: ProjectBuildingIndex;
}

interface JobUsage {
  jobId?: number;
  projectId?: number;
  compositionId?: number;
  name: string;
  icon?: string;
  perItemSeconds?: number;
  totalCount: number;
  missions: Array<{ id: number; title: string; level: number; count: number }>;
}

interface BuildingGroup {
  compositionId: number;
  name: string;
  icon?: string;
  earliestLevel: number;
  jobs: Map<string, JobUsage>;
}

export function BuildingRequirementsSummary({
  missions,
  jobs,
  compositions,
  projectBuildingIndex,
}: Props) {
  const { t } = useLanguage();
  const localize = (key: string | undefined, fb: string) => {
    if (!key) return fb;
    const v = t(key);
    return v && v !== key ? v : fb;
  };

  const groups = useMemo(() => {
    const byBuilding = new Map<number, BuildingGroup>();

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

    for (const m of missions) {
      for (const o of m.objectives) {
        const jobOrProjectId = o.jobId ?? o.projectId;
        let info: BuildingInfo | undefined =
          jobOrProjectId != null ? projectBuildingIndex.get(jobOrProjectId) : undefined;
        if (!info && o.compositionId != null) info = resolveBuildingByComp(o.compositionId);
        if (!info) continue;

        const bName = localize(info.nameKey, `Building #${info.compositionId}`);
        const bIcon = info.iconKey ? getJobIconUrl(info.iconKey) : undefined;

        let group = byBuilding.get(info.compositionId);
        if (!group) {
          group = {
            compositionId: info.compositionId,
            name: bName,
            icon: bIcon,
            earliestLevel: m.displayLevel,
            jobs: new Map(),
          };
          byBuilding.set(info.compositionId, group);
        }
        group.earliestLevel = Math.min(group.earliestLevel, m.displayLevel);

        // Job/project key
        const jobEntry = jobOrProjectId != null ? jobs?.[String(jobOrProjectId)] : undefined;
        const key =
          o.jobId != null
            ? `j:${o.jobId}`
            : o.projectId != null
              ? `p:${o.projectId}`
              : `c:${info.compositionId}`;
        const count = o.count ?? 1;
        const jobName = jobEntry?.name
          ? localize(jobEntry.name, jobEntry.name)
          : o.title
            ? localize(o.title, o.title)
            : o.compositionId != null
              ? bName
              : `Job #${jobOrProjectId ?? "?"}`;
        const jobIcon = jobEntry?.icon
          ? getJobIconUrl(jobEntry.icon)
          : o.icon
            ? getJobIconUrl(o.icon)
            : undefined;

        let usage = group.jobs.get(key);
        if (!usage) {
          usage = {
            jobId: o.jobId,
            projectId: o.projectId,
            compositionId: o.jobId == null && o.projectId == null ? info.compositionId : undefined,
            name: jobName,
            icon: jobIcon,
            perItemSeconds: jobEntry?.build_time,
            totalCount: 0,
            missions: [],
          };
          group.jobs.set(key, usage);
        }
        usage.totalCount += count;
        usage.missions.push({
          id: m.id,
          title: localize(m.title, m.title),
          level: m.displayLevel,
          count,
        });
      }
    }

    return Array.from(byBuilding.values()).sort((a, b) => a.earliestLevel - b.earliestLevel);
  }, [missions, jobs, compositions, projectBuildingIndex, t]);

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Buildings & jobs needed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          None of the visible missions require building production or collection.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Buildings & jobs needed</h2>
        <p className="text-xs text-muted-foreground">
          Every building required to complete the {missions.length} visible missions, with the
          jobs/projects you'll need to queue up, per-item time, total quantity, and total time.
          Sorted by the earliest mission that needs them.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.compositionId} className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              {g.icon ? (
                <img
                  src={g.icon}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded bg-background object-contain"
                  onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                  draggable={false}
                />
              ) : (
                <div className="h-9 w-9 shrink-0 rounded bg-background" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold" title={g.name}>
                  {g.name}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  First needed at Lv {g.earliestLevel}
                </div>
              </div>
            </div>

            <ul className="space-y-1.5">
              {Array.from(g.jobs.values())
                .sort(
                  (a, b) =>
                    Math.min(...a.missions.map((m) => m.level)) -
                    Math.min(...b.missions.map((m) => m.level))
                )
                .map((u, i) => {
                  const totalSec =
                    u.perItemSeconds != null ? u.perItemSeconds * u.totalCount : undefined;
                  return (
                    <li
                      key={i}
                      className="rounded border bg-background/60 px-2 py-1.5 text-xs space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        {u.icon && (
                          <img
                            src={u.icon}
                            alt=""
                            className="h-5 w-5 shrink-0 rounded object-contain"
                            onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                            draggable={false}
                          />
                        )}
                        <span className="flex-1 truncate font-medium" title={u.name}>
                          {u.name}
                        </span>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                          ×{u.totalCount}
                        </span>
                      </div>
                      {u.perItemSeconds != null && (
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
                          <span>{formatDuration(u.perItemSeconds)} each</span>
                          {totalSec != null && u.totalCount > 1 && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-foreground">
                                total {formatDuration(totalSec)}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {u.missions
                          .sort((a, b) => a.level - b.level)
                          .map((mm) => (
                            <span
                              key={mm.id}
                              className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              title={mm.title}
                            >
                              <span className="opacity-70">Lv{mm.level}</span>
                              <span className="max-w-[140px] truncate">{mm.title}</span>
                              {mm.count > 1 && (
                                <span className="tabular-nums">×{mm.count}</span>
                              )}
                            </span>
                          ))}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
