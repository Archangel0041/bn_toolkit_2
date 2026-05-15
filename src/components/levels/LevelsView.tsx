import { useEffect, useMemo, useState } from "react";
import { loadLevels, loadMissions, loadJobInfo, type LevelEntry, type JobInfoEntry } from "@/lib/dataLoader";
import { parseLevels, type ParsedLevel } from "@/lib/levels";
import { parseMissions, type ParsedMission } from "@/lib/missions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Users, Building2, Map as MapIcon, Trophy, Swords, Coins } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameData } from "@/contexts/GameDataContext";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { getResourceIconUrl, getJobIconUrl } from "@/lib/resourceImages";
import { getUnitImageUrl } from "@/lib/unitImages";

interface UnitRef { id: number; qty: number; missionId: number; missionTitle: string; }
interface JobRef { id: number; entry: JobInfoEntry; }

function bestT(t: (k: string) => string, keys: string[], fallback: string) {
  for (const k of keys) {
    if (!k) continue;
    const tr = t(k);
    if (tr && tr !== k) return tr;
  }
  return fallback;
}

function jobMinLevel(job: JobInfoEntry | undefined): number | null {
  if (!job) return null;
  for (const p of (job as any).prereqs ?? []) {
    if (p?._t === "player_level_prereq_config" && typeof p.min_level === "number") {
      return p.min_level;
    }
  }
  return null;
}

export default function LevelsView() {
  const { t } = useLanguage();
  const { data: gameData } = useGameData();
  const { accountLevel } = useAccountLevel();

  const [rawLevels, setRawLevels] = useState<Record<string, LevelEntry> | null>(null);
  const [rawMissions, setRawMissions] = useState<Record<string, any[]> | null>(null);
  const [jobs, setJobs] = useState<Record<string, JobInfoEntry>>({});
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [showFutureOnly, setShowFutureOnly] = useState(false);
  const [maxLevel, setMaxLevel] = useState(200);

  useEffect(() => {
    let alive = true;
    Promise.all([loadLevels(), loadMissions(), loadJobInfo()])
      .then(([lv, ms, jb]) => {
        if (!alive) return;
        setRawLevels(lv);
        setRawMissions(ms);
        setJobs(jb);
      })
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => { alive = false; };
  }, []);

  const unitsById = useMemo(() => {
    const map = new Map<number, { name: string; icon?: string }>();
    for (const u of gameData?.parsedUnits ?? []) {
      map.set(u.id, { name: u.identity?.name, icon: u.identity?.icon });
    }
    return map;
  }, [gameData?.parsedUnits]);

  const levels = useMemo<ParsedLevel[]>(
    () => (rawLevels ? parseLevels(rawLevels) : []),
    [rawLevels]
  );

  const missions = useMemo<ParsedMission[]>(
    () => (rawMissions ? parseMissions(rawMissions) : []),
    [rawMissions]
  );

  // Group missions / units / jobs by level
  const byLevel = useMemo(() => {
    const missionsAt = new Map<number, ParsedMission[]>();
    const unitsAt = new Map<number, UnitRef[]>();
    const jobsAt = new Map<number, JobRef[]>();

    for (const m of missions) {
      const l = m.displayLevel || 1;
      if (!missionsAt.has(l)) missionsAt.set(l, []);
      missionsAt.get(l)!.push(m);

      for (const [uid, qty] of Object.entries(m.rewards?.units ?? {})) {
        const id = Number(uid);
        if (!Number.isFinite(id)) continue;
        if (!unitsAt.has(l)) unitsAt.set(l, []);
        unitsAt.get(l)!.push({ id, qty: Number(qty) || 0, missionId: m.id, missionTitle: m.title });
      }
    }

    for (const [jid, entry] of Object.entries(jobs)) {
      const lvl = jobMinLevel(entry);
      if (lvl == null) continue;
      const id = Number(jid);
      if (!Number.isFinite(id)) continue;
      if (!jobsAt.has(lvl)) jobsAt.set(lvl, []);
      jobsAt.get(lvl)!.push({ id, entry });
    }

    return { missionsAt, unitsAt, jobsAt };
  }, [missions, jobs]);

  const visibleLevels = useMemo(() => {
    let lst = levels.filter((l) => l.level <= maxLevel);
    if (showFutureOnly) lst = lst.filter((l) => l.level > accountLevel);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      lst = lst.filter((l) => {
        if (String(l.level).includes(q)) return true;
        const ms = byLevel.missionsAt.get(l.level) ?? [];
        if (ms.some((m) => (t(m.title) || m.title).toLowerCase().includes(q))) return true;
        const us = byLevel.unitsAt.get(l.level) ?? [];
        if (us.some((u) => {
          const meta = unitsById.get(u.id);
          const name = meta?.name ? t(meta.name) : "";
          return name.toLowerCase().includes(q);
        })) return true;
        const js = byLevel.jobsAt.get(l.level) ?? [];
        if (js.some((j) => (t(j.entry.name ?? "") || "").toLowerCase().includes(q))) return true;
        return false;
      });
    }
    return lst;
  }, [levels, maxLevel, showFutureOnly, accountLevel, search, byLevel, unitsById, t]);

  if (error) {
    return <div className="text-sm text-destructive">Failed to load levels: {error}</div>;
  }
  if (!rawLevels || !rawMissions) {
    return <div className="text-sm text-muted-foreground">Loading levels…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Account Levels</h1>
        <p className="text-muted-foreground">
          XP requirements, population caps, and what unlocks at each player level.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="lvl-search" className="text-xs">Search</Label>
          <Input
            id="lvl-search"
            placeholder="Mission, unit, building, or level number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-28">
          <Label htmlFor="lvl-cap" className="text-xs">Up to level</Label>
          <Input
            id="lvl-cap"
            type="number"
            min={1}
            max={200}
            value={maxLevel}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n)) setMaxLevel(Math.max(1, Math.min(200, n)));
            }}
          />
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Switch
            id="future-only"
            checked={showFutureOnly}
            onCheckedChange={setShowFutureOnly}
          />
          <Label htmlFor="future-only" className="text-xs cursor-pointer">
            Future only (above lv {accountLevel})
          </Label>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {visibleLevels.length} levels
      </div>

      <div className="space-y-3">
        {visibleLevels.map((lv) => {
          const isCurrent = lv.level === accountLevel;
          const isPast = lv.level < accountLevel;
          const ms = byLevel.missionsAt.get(lv.level) ?? [];
          const us = byLevel.unitsAt.get(lv.level) ?? [];
          const js = byLevel.jobsAt.get(lv.level) ?? [];
          const hasUnlocks = ms.length + us.length + js.length > 0;

          return (
            <Card
              key={lv.level}
              className={isCurrent ? "border-primary" : isPast ? "opacity-70" : undefined}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-2xl tabular-nums">Lv {lv.level}</CardTitle>
                    {isCurrent && <Badge>Current</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {lv.nextLevelXp > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">XP to next:</span>
                        <span className="font-semibold tabular-nums">
                          {lv.nextLevelXp.toLocaleString()}
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <img
                        src={getResourceIconUrl("population")}
                        alt=""
                        className="h-4 w-4 object-contain"
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                      />
                      <span className="text-muted-foreground">Pop:</span>
                      <span className="font-semibold tabular-nums">{lv.populationLimit}</span>
                      {lv.populationDelta > 0 && (
                        <span className="text-emerald-500 text-xs font-semibold">
                          (+{lv.populationDelta})
                        </span>
                      )}
                    </span>
                    {lv.attackZonesDelta > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Swords className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Attack zones:</span>
                        <span className="font-semibold tabular-nums">{lv.attackZones}</span>
                        <span className="text-emerald-500 text-xs font-semibold">
                          (+{lv.attackZonesDelta})
                        </span>
                      </span>
                    )}
                    {Object.entries(lv.awards).map(([k, v]) => (
                      <span key={k} className="flex items-center gap-1.5">
                        <img
                          src={getResourceIconUrl(k)}
                          alt=""
                          className="h-4 w-4 object-contain"
                          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                        />
                        <span className="font-semibold tabular-nums">+{v.toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </CardHeader>
              {hasUnlocks && (
                <CardContent className="pt-0">
                  <Collapsible defaultOpen={isCurrent}>
                    <CollapsibleTrigger className="flex w-full items-center gap-2 rounded border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/50 transition">
                      <ChevronDown className="h-4 w-4 transition-transform data-[state=closed]:-rotate-90" />
                      <span className="flex-1 text-left">
                        Unlocks
                      </span>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {ms.length > 0 && (
                          <span className="flex items-center gap-1">
                            <MapIcon className="h-3 w-3" /> {ms.length}
                          </span>
                        )}
                        {us.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {us.length}
                          </span>
                        )}
                        {js.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {js.length}
                          </span>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3 space-y-4">
                      {ms.length > 0 && (
                        <Section icon={<MapIcon className="h-4 w-4" />} label={`Missions (${ms.length})`}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {ms.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center gap-2 rounded border bg-muted/40 px-2 py-1.5"
                                title={`#${m.id} from ${m.giver ?? "?"}`}
                              >
                                <span className="flex-1 truncate text-xs">
                                  {bestT(t, [m.title], m.title) || `Mission #${m.id}`}
                                </span>
                                {m.rewards?.resources?.xp ? (
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {m.rewards.resources.xp.toLocaleString()} xp
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </Section>
                      )}
                      {js.length > 0 && (
                        <Section icon={<Building2 className="h-4 w-4" />} label={`Buildings & jobs (${js.length})`}>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {js.map(({ id, entry }) => {
                              const label = bestT(t, [entry.name ?? ""], entry.name ?? `Job #${id}`);
                              return (
                                <div
                                  key={id}
                                  className="flex items-center gap-2 rounded border bg-muted/40 px-2 py-1.5"
                                  title={`Job #${id}`}
                                >
                                  {entry.icon ? (
                                    <img
                                      src={getJobIconUrl(entry.icon)}
                                      alt=""
                                      className="h-7 w-7 shrink-0 rounded bg-background object-contain"
                                      onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                                      draggable={false}
                                    />
                                  ) : (
                                    <div className="h-7 w-7 shrink-0 rounded bg-background" />
                                  )}
                                  <span className="flex-1 truncate text-xs" title={label}>
                                    {label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </Section>
                      )}
                      {us.length > 0 && (
                        <Section icon={<Users className="h-4 w-4" />} label={`Units rewarded (${us.length})`}>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {us.map((u, i) => {
                              const meta = unitsById.get(u.id);
                              const label = meta?.name
                                ? bestT(t, [meta.name], meta.name)
                                : `Unit #${u.id}`;
                              const iconUrl = meta?.icon ? getUnitImageUrl(meta.icon) : null;
                              return (
                                <div
                                  key={`${u.missionId}-${u.id}-${i}`}
                                  className="flex items-center gap-2 rounded border bg-muted/40 px-2 py-1.5"
                                  title={`From mission "${bestT(t, [u.missionTitle], u.missionTitle)}"`}
                                >
                                  {iconUrl ? (
                                    <img
                                      src={iconUrl}
                                      alt=""
                                      className="h-8 w-8 shrink-0 rounded bg-background object-contain"
                                      onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                                      draggable={false}
                                    />
                                  ) : (
                                    <div className="h-8 w-8 shrink-0 rounded bg-background" />
                                  )}
                                  <span className="flex-1 truncate text-xs">{label}</span>
                                  <span className="text-xs font-semibold tabular-nums">×{u.qty}</span>
                                </div>
                              );
                            })}
                          </div>
                        </Section>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Section({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}
