import { useEffect, useMemo, useState } from "react";
import { loadMissions, loadCharacters, type CharacterEntry } from "@/lib/dataLoader";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { useLanguage } from "@/contexts/LanguageContext";

const COMPLETED_KEY = "missions:completed";
const VISIBLE_KEY = "missions:visible";
const HIDE_ABOVE_KEY = "missions:hideAbove";
const LEVEL_CAP_KEY = "missions:levelCap";
const SETUP_KEY = "missions:setupComplete";

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

export default function MissionsView() {
  const { accountLevel } = useAccountLevel();
  const { t } = useLanguage();
  const [raw, setRaw] = useState<Record<string, any[]> | null>(null);
  const [characters, setCharacters] = useState<Record<string, CharacterEntry>>({});
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"all" | "remaining">("remaining");
  const [search, setSearch] = useState("");
  const [currentLevel, setCurrentLevel] = useState(accountLevel);
  const [completedText, setCompletedText] = useState<string>(
    () => localStorage.getItem(COMPLETED_KEY) ?? ""
  );
  const [visibleText, setVisibleText] = useState<string>(
    () => localStorage.getItem(VISIBLE_KEY) ?? ""
  );
  const [hideAbove, setHideAbove] = useState<boolean>(
    () => localStorage.getItem(HIDE_ABOVE_KEY) === "1"
  );
  const [levelCap, setLevelCap] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem(LEVEL_CAP_KEY) ?? "", 10);
    return isNaN(saved) ? accountLevel : saved;
  });
  // Always start gated on tab mount — user must explicitly click "Show mission tree".
  const [setupComplete, setSetupComplete] = useState<boolean>(false);

  useEffect(() => setCurrentLevel(accountLevel), [accountLevel]);

  useEffect(() => {
    loadMissions()
      .then(setRaw)
      .catch((e) => setError(String(e)));
  }, []);

  const allParsed = useMemo(() => (raw ? parseMissions(raw) : []), [raw]);

  const completedIds = useMemo(() => parseIdText(completedText), [completedText]);
  const visibleIds = useMemo(() => parseIdText(visibleText), [visibleText]);

  useEffect(() => {
    localStorage.setItem(COMPLETED_KEY, completedText);
  }, [completedText]);
  useEffect(() => {
    localStorage.setItem(VISIBLE_KEY, visibleText);
  }, [visibleText]);
  useEffect(() => {
    localStorage.setItem(HIDE_ABOVE_KEY, hideAbove ? "1" : "0");
  }, [hideAbove]);
  useEffect(() => {
    localStorage.setItem(LEVEL_CAP_KEY, String(levelCap));
  }, [levelCap]);

  /**
   * Inferred-completed logic:
   *   A mission is presumed COMPLETE if it is at/below current level AND it is
   *   neither one of the user's currently-visible missions nor a downstream
   *   dependent of one. Rationale: if a visible mission doesn't require it,
   *   the user has already moved past it.
   *   We also always mark the prereq chain of visible missions complete (those
   *   may be above current level if propagation pushed them up).
   */
  const effectiveCompletedIds = useMemo(() => {
    const completed = new Set(completedIds);
    if (allParsed.length === 0) return completed;
    const byId = new Map(allParsed.map((m) => [m.id, m]));

    // 1. Walk prereq chain of each visible mission -> mark complete.
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

    // 2. Compute downstream set of visible missions (missions that depend on
    //    them, transitively) — these are NOT completed.
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

    // 3. Anything at/below current level that isn't visible and isn't
    //    downstream of a visible mission is presumed complete.
    for (const m of allParsed) {
      if (m.displayLevel > currentLevel) continue;
      if (visibleIds.has(m.id)) continue;
      if (downstream.has(m.id)) continue;
      completed.add(m.id);
    }
    return completed;
  }, [allParsed, completedIds, visibleIds, currentLevel]);

  const { visibleMissions, availableNow } = useMemo(() => {
    let missions: ParsedMission[];
    let availableNow: Set<number> | undefined;
    const cap = Math.max(currentLevel, levelCap);
    if (mode === "remaining") {
      const r = filterRemaining(allParsed, {
        currentLevel,
        completedIds: effectiveCompletedIds,
        hideAboveLevel: false,
      });
      missions = hideAbove ? r.remaining.filter((m) => m.displayLevel <= cap) : r.remaining;
      availableNow = r.availableNow;
    } else {
      missions = hideAbove ? allParsed.filter((m) => m.displayLevel <= cap) : allParsed;
    }

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
    return { visibleMissions: missions, availableNow };
  }, [allParsed, mode, currentLevel, levelCap, effectiveCompletedIds, hideAbove, search, t]);

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
            still ahead. Anything at or below your level that isn't in your visible list
            is assumed already done (along with its prerequisites).
          </p>
        </div>

        {error && (
          <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load missions: {error}
          </div>
        )}

        <div className="rounded-lg border p-4 space-y-4 max-w-2xl">
          <div className="flex flex-col gap-1">
            <Label htmlFor="setup-level" className="text-sm font-medium">
              Your current player level
            </Label>
            <Input
              id="setup-level"
              type="number"
              className="w-32"
              min={1}
              max={200}
              value={currentLevel}
              onChange={(e) => setCurrentLevel(parseInt(e.target.value || "1", 10))}
            />
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">
              Optionally: explicitly completed missions
            </Label>
            <MissionPicker
              missions={allParsed}
              selectedIds={completedIds}
              onChange={(ids) => setCompletedText(idsToText(ids))}
              placeholder="Search a completed mission…"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={() => setSetupComplete(true)} disabled={!raw}>
              {raw ? "Show mission tree" : "Loading missions…"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setMode("all");
                setSetupComplete(true);
              }}
              disabled={!raw}
            >
              Skip — show all missions
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
            Grouped by required player level. Edges flow from prerequisite to dependent.{" "}
            {raw ? `${allParsed.length} missions loaded.` : "Loading…"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSetupComplete(false)}>
          Edit setup
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Mode</Label>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "all" | "remaining")}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="remaining">Remaining</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

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
          <Label htmlFor="hide-above" className="text-xs">Cap at level cap</Label>
        </div>
      </div>

      {mode === "remaining" && (
        <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">My current missions (search by name)</Label>
            <MissionPicker
              missions={allParsed}
              selectedIds={visibleIds}
              onChange={(ids) => setVisibleText(idsToText(ids))}
              placeholder="Type a mission name…"
            />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{visibleIds.size} visible</span>
              {visibleIds.size > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {effectiveCompletedIds.size - completedIds.size} inferred done
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Explicitly completed missions</Label>
            <MissionPicker
              missions={allParsed}
              selectedIds={completedIds}
              onChange={(ids) => setCompletedText(idsToText(ids))}
              placeholder="Search a completed mission…"
            />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{completedIds.size} marked complete</span>
              <span>·</span>
              <span>{effectiveCompletedIds.size} total complete</span>
              <span>·</span>
              <span>{availableNow?.size ?? 0} available now</span>
            </div>
          </div>
        </div>
      )}

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
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between rounded border bg-muted/40 px-2 py-1.5"
                        >
                          <span className="text-xs capitalize text-muted-foreground">
                            {k.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm font-semibold tabular-nums">
                            {v.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
                {Object.keys(rewardTotals.units).length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Units</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(rewardTotals.units).map(([id, qty]) => (
                        <div
                          key={id}
                          className="rounded border bg-muted/40 px-2 py-1 text-xs tabular-nums"
                        >
                          #{id} × {qty}
                        </div>
                      ))}
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
