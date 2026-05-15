import { useEffect, useMemo, useState } from "react";
import { loadMissions, loadCharacters, loadNpcs, loadDialogues, loadJobInfo, loadEncounters, type CharacterEntry, type NpcEntry, type DialogueLine, type JobInfoEntry, type EncounterEntry } from "@/lib/dataLoader";
import {
  parseMissions,
  buildMissionEdges,
  filterRemaining,
  type ParsedMission,
} from "@/lib/missions";
import { MissionTree } from "@/components/missions/MissionTree";
import { MissionPicker } from "@/components/missions/MissionPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameData } from "@/contexts/GameDataContext";
import { getResourceIconUrl } from "@/lib/resourceImages";
import { getUnitImageUrl } from "@/lib/unitImages";

const VISIBLE_KEY = "missions:visible";
const HIDE_ABOVE_KEY = "missions:hideAbove";
const LEVEL_CAP_KEY = "missions:levelCap";

const idsToText = (ids: number[]) =>
  [...new Set(ids)].sort((a, b) => a - b).join(", ");

const parseIdText = (s: string): Set<number> => {
  const out = new Set<number>();
  for (const tok of s.split(/[\s,]+/)) {
    const n = parseInt(tok, 10);
    if (!isNaN(n)) out.add(n);
  }
  return out;
};

const titleCase = (s: string) =>
  s.replace(/[_-]+/g, " ").trim().split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ");

export default function MissionsView() {
  const { accountLevel } = useAccountLevel();
  const { t } = useLanguage();
  const { data: gameData } = useGameData();
  const unitsById = useMemo(() => {
    const map = new Map<number, { name: string; icon?: string }>();
    for (const u of gameData?.parsedUnits ?? []) {
      map.set(u.id, { name: u.identity?.name, icon: u.identity?.icon });
    }
    return map;
  }, [gameData?.parsedUnits]);

  const [raw, setRaw] = useState<Record<string, any[]> | null>(null);
  const [characters, setCharacters] = useState<Record<string, CharacterEntry>>({});
  const [npcs, setNpcs] = useState<Record<string, NpcEntry>>({});
  const [dialogues, setDialogues] = useState<Record<string, DialogueLine[]>>({});
  const [jobs, setJobs] = useState<Record<string, JobInfoEntry>>({});
  const [encounters, setEncounters] = useState<Record<string, EncounterEntry>>({});
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [currentLevel, setCurrentLevel] = useState(accountLevel);
  const [visibleText, setVisibleText] = useState<string>(
    () => localStorage.getItem(VISIBLE_KEY) ?? ""
  );
  const [hideAbove, setHideAbove] = useState<boolean>(
    () => localStorage.getItem(HIDE_ABOVE_KEY) === "1"
  );
  const [levelCap, setLevelCap] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem(LEVEL_CAP_KEY) ?? "", 10);
    if (!isNaN(saved)) return saved;
    return Math.max(65, accountLevel);
  });
  const [setupComplete, setSetupComplete] = useState<boolean>(false);

  // Account level from settings is the source of truth — keep both inputs in sync.
  // Level cap floors at the player's current level but never auto-shrinks below 65
  // so newly-unlocked / continuation missions remain visible by default.
  useEffect(() => {
    setCurrentLevel(accountLevel);
    setLevelCap((cur) => Math.max(cur, accountLevel, 65));
  }, [accountLevel]);

  useEffect(() => {
    loadMissions()
      .then(setRaw)
      .catch((e) => setError(String(e)));
    loadCharacters()
      .then(setCharacters)
      .catch(() => {});
    loadNpcs()
      .then(setNpcs)
      .catch(() => {});
    loadDialogues()
      .then(setDialogues)
      .catch(() => {});
    loadJobInfo()
      .then(setJobs)
      .catch(() => {});
    loadEncounters()
      .then((d) => setEncounters(d?.armies ?? {}))
      .catch(() => {});
  }, []);

  const allParsed = useMemo(() => (raw ? parseMissions(raw) : []), [raw]);

  const visibleIds = useMemo(() => parseIdText(visibleText), [visibleText]);

  useEffect(() => {
    localStorage.setItem(VISIBLE_KEY, visibleText);
  }, [visibleText]);
  useEffect(() => {
    localStorage.setItem(HIDE_ABOVE_KEY, hideAbove ? "1" : "0");
  }, [hideAbove]);
  useEffect(() => {
    localStorage.setItem(LEVEL_CAP_KEY, String(levelCap));
  }, [levelCap]);

  // If user clears their current missions, force them back into setup.
  useEffect(() => {
    if (setupComplete && visibleIds.size === 0) setSetupComplete(false);
  }, [setupComplete, visibleIds]);

  /**
   * Inferred-completed: anything at/below current level that isn't a visible
   * mission and isn't downstream of one is presumed already done. Plus the
   * full prereq chain of every visible mission.
   */
  const effectiveCompletedIds = useMemo(() => {
    const completed = new Set<number>();
    if (allParsed.length === 0) return completed;
    const byId = new Map(allParsed.map((m) => [m.id, m]));

    const markPrereqs = (id: number, seen = new Set<number>()) => {
      if (seen.has(id)) return;
      seen.add(id);
      const m = byId.get(id);
      if (!m) return;
      for (const pid of [
        ...m.prereqMissionIds.all,
        ...m.prereqMissionIds.any,
        ...m.prereqMissionIds.active,
      ]) {
        completed.add(pid);
        markPrereqs(pid, seen);
      }
    };
    for (const id of visibleIds) markPrereqs(id);

    if (visibleIds.size === 0) return completed;

    const dependents = new Map<number, Set<number>>();
    for (const m of allParsed) {
      for (const pid of [...m.prereqMissionIds.all, ...m.prereqMissionIds.any]) {
        if (!dependents.has(pid)) dependents.set(pid, new Set());
        dependents.get(pid)!.add(m.id);
      }
    }
    const downstream = new Set<number>();
    const stack = [...visibleIds];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const next of dependents.get(cur) ?? []) {
        if (!downstream.has(next)) {
          downstream.add(next);
          stack.push(next);
        }
      }
    }

    for (const m of allParsed) {
      if (m.displayLevel > currentLevel) continue;
      if (visibleIds.has(m.id)) continue;
      if (downstream.has(m.id)) continue;
      completed.add(m.id);
    }
    return completed;
  }, [allParsed, visibleIds, currentLevel]);

  // Effective cap: when "Cap at current level" is on, only show up to current
  // level. Otherwise show up to user-defined level cap.
  const effectiveCap = hideAbove ? currentLevel : levelCap;

  const { visibleMissions, availableNow } = useMemo(() => {
    const r = filterRemaining(allParsed, {
      currentLevel,
      completedIds: effectiveCompletedIds,
      hideAboveLevel: false,
    });
    let missions = r.remaining.filter((m) => m.displayLevel <= effectiveCap);

    if (search.trim()) {
      const q = search.toLowerCase();
      missions = missions.filter((m) => {
        const localized = t(m.title);
        const title = localized && localized !== m.title ? localized : m.title;
        return (
          title.toLowerCase().includes(q) ||
          (m.giver ?? "").toLowerCase().includes(q) ||
          String(m.id).includes(q)
        );
      });
    }
    return { visibleMissions: missions, availableNow: r.availableNow };
  }, [allParsed, currentLevel, effectiveCap, effectiveCompletedIds, search, t]);

  const rewardTotals = useMemo(() => {
    const resources: Record<string, number> = {};
    const units: Record<string, number> = {};
    for (const m of visibleMissions) {
      for (const [k, v] of Object.entries(m.rewards.resources)) {
        resources[k] = (resources[k] ?? 0) + (Number(v) || 0);
      }
      for (const [k, v] of Object.entries(m.rewards.units)) {
        units[k] = (units[k] ?? 0) + (Number(v) || 0);
      }
    }
    return { resources, units };
  }, [visibleMissions]);

  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleMissions.map((m) => m.id));
    return buildMissionEdges(visibleMissions).filter(
      (e) => ids.has(e.from) && ids.has(e.to)
    );
  }, [visibleMissions]);

  // ---- Setup gate ----
  if (!setupComplete) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Mission Tree</h1>
          <p className="text-muted-foreground text-sm">
            Tell us what missions you currently have so we can show you only what's
            still ahead. Anything at or below your level that isn't in your visible
            list is assumed already done (along with its prerequisites).
          </p>
        </div>

        {error && (
          <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load missions: {error}
          </div>
        )}

        <div className="rounded-lg border p-4 space-y-4 max-w-2xl">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="setup-level" className="text-sm font-medium">
                Current player level
              </Label>
              <Input
                id="setup-level"
                type="number"
                min={1}
                max={200}
                value={currentLevel}
                onChange={(e) => setCurrentLevel(parseInt(e.target.value || "1", 10))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="setup-cap" className="text-sm font-medium">
                Level cap
              </Label>
              <Input
                id="setup-cap"
                type="number"
                min={1}
                max={200}
                value={levelCap}
                onChange={(e) => setLevelCap(parseInt(e.target.value || "1", 10))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="setup-hide-above" checked={hideAbove} onCheckedChange={setHideAbove} />
            <Label htmlFor="setup-hide-above" className="text-sm">
              Cap at current level
            </Label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">
              My current missions (search by name)
            </Label>
            <MissionPicker
              missions={allParsed}
              selectedIds={visibleIds}
              onChange={(ids) => setVisibleText(idsToText(ids))}
              placeholder="Type a mission name…"
            />
            <p className="text-xs text-muted-foreground">
              Add at least one mission to continue.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={() => setSetupComplete(true)}
              disabled={!raw || visibleIds.size === 0}
            >
              {raw ? "Show mission tree" : "Loading missions…"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-1">Mission Tree</h1>
          <p className="text-muted-foreground text-sm">
            Showing remaining missions up to level {effectiveCap}.{" "}
            {raw ? `${allParsed.length} missions loaded.` : "Loading…"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSetupComplete(false)}>
          Edit setup
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="mission-search" className="text-xs">Search</Label>
          <Input
            id="mission-search"
            placeholder="Title, giver, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="current-level" className="text-xs">Current level</Label>
          <Input
            id="current-level"
            type="number"
            className="w-24"
            min={1}
            max={200}
            value={currentLevel}
            onChange={(e) => setCurrentLevel(parseInt(e.target.value || "1", 10))}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="level-cap" className="text-xs">Level cap</Label>
          <Input
            id="level-cap"
            type="number"
            className="w-24"
            min={1}
            max={200}
            value={levelCap}
            onChange={(e) => setLevelCap(parseInt(e.target.value || "1", 10))}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch id="hide-above" checked={hideAbove} onCheckedChange={setHideAbove} />
          <Label htmlFor="hide-above" className="text-xs">Cap at current level</Label>
        </div>
      </div>

      <div className="rounded-lg border p-3 space-y-1.5">
        <Label className="text-xs">My current missions (search by name)</Label>
        <MissionPicker
          missions={allParsed}
          selectedIds={visibleIds}
          onChange={(ids) => setVisibleText(idsToText(ids))}
          placeholder="Type a mission name…"
        />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{visibleIds.size} visible</span>
          <span>·</span>
          <span>{effectiveCompletedIds.size} inferred done</span>
          <span>·</span>
          <span>{availableNow?.size ?? 0} available now</span>
        </div>
      </div>

      {error && (
        <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load missions: {error}
        </div>
      )}

      {raw && (
        <>
          <div className="text-xs text-muted-foreground">
            Showing {visibleMissions.length} missions, {visibleEdges.length} dependency edges
          </div>
          <MissionTree
            missions={visibleMissions}
            edges={visibleEdges}
            availableNow={availableNow}
            characters={characters}
            npcs={npcs}
            dialogues={dialogues}
            unitsById={unitsById}
          />

          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Total rewards in tree</h2>
              <p className="text-xs text-muted-foreground">
                Summed across the {visibleMissions.length} missions currently shown.
              </p>
            </div>
            {Object.keys(rewardTotals.resources).length === 0 &&
            Object.keys(rewardTotals.units).length === 0 ? (
              <p className="text-sm text-muted-foreground">No rewards on these missions.</p>
            ) : (
              <>
                {Object.keys(rewardTotals.resources).length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {Object.entries(rewardTotals.resources)
                      .sort(([a], [b]) => (a === "xp" ? -1 : b === "xp" ? 1 : a.localeCompare(b)))
                      .map(([k, v]) => {
                        const locKeys = [`resource_${k}_name`, `bn_resource_${k}`, `resource_${k}`];
                        let label = titleCase(k);
                        for (const lk of locKeys) {
                          const tr = t(lk);
                          if (tr && tr !== lk) { label = tr; break; }
                        }
                        return (
                          <div
                            key={k}
                            className="flex items-center gap-2 rounded border bg-muted/40 px-2 py-1.5"
                          >
                            <img
                              src={getResourceIconUrl(k)}
                              alt=""
                              className="h-6 w-6 shrink-0 object-contain"
                              onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                              draggable={false}
                            />
                            <span className="flex-1 truncate text-xs text-muted-foreground" title={label}>
                              {label}
                            </span>
                            <span className="text-sm font-semibold tabular-nums">
                              {v.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
                {Object.keys(rewardTotals.units).length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Units</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {Object.entries(rewardTotals.units).map(([id, qty]) => {
                        const u = unitsById.get(Number(id));
                        const localized = u?.name ? t(u.name) : "";
                        const label = localized && localized !== u?.name ? localized : (u?.name ?? `Unit #${id}`);
                        const iconUrl = u?.icon ? getUnitImageUrl(u.icon) : null;
                        return (
                          <div
                            key={id}
                            className="flex items-center gap-2 rounded border bg-muted/40 px-2 py-1.5"
                          >
                            {iconUrl ? (
                              <img
                                src={iconUrl}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded bg-background object-contain"
                                onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                                draggable={false}
                              />
                            ) : (
                              <div className="h-8 w-8 shrink-0 rounded bg-background" />
                            )}
                            <span className="flex-1 truncate text-xs" title={label}>
                              {label}
                            </span>
                            <span className="text-sm font-semibold tabular-nums">×{qty}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
