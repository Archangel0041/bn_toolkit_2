import { useEffect, useMemo, useState } from "react";
import { loadMissions } from "@/lib/dataLoader";
import {
  parseMissions,
  buildMissionEdges,
  filterRemaining,
  type ParsedMission,
} from "@/lib/missions";
import { MissionTree } from "@/components/missions/MissionTree";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { useLanguage } from "@/contexts/LanguageContext";

const COMPLETED_KEY = "missions:completed";
const VISIBLE_KEY = "missions:visible";
const HIDE_ABOVE_KEY = "missions:hideAbove";

export default function MissionsView() {
  const { accountLevel } = useAccountLevel();
  const { t } = useLanguage();
  const [raw, setRaw] = useState<Record<string, any[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"all" | "remaining">("all");
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

  useEffect(() => setCurrentLevel(accountLevel), [accountLevel]);

  useEffect(() => {
    loadMissions()
      .then(setRaw)
      .catch((e) => setError(String(e)));
  }, []);

  const allParsed = useMemo(() => (raw ? parseMissions(raw) : []), [raw]);

  const completedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const tok of completedText.split(/[\s,]+/)) {
      const n = parseInt(tok, 10);
      if (!isNaN(n)) ids.add(n);
    }
    return ids;
  }, [completedText]);

  useEffect(() => {
    localStorage.setItem(COMPLETED_KEY, completedText);
  }, [completedText]);
  useEffect(() => {
    localStorage.setItem(HIDE_ABOVE_KEY, hideAbove ? "1" : "0");
  }, [hideAbove]);

  const { visibleMissions, availableNow } = useMemo(() => {
    let missions: ParsedMission[];
    let availableNow: Set<number> | undefined;
    if (mode === "remaining") {
      const r = filterRemaining(allParsed, {
        currentLevel,
        completedIds,
        hideAboveLevel: hideAbove,
      });
      missions = r.remaining;
      availableNow = r.availableNow;
    } else {
      missions = hideAbove ? allParsed.filter((m) => m.displayLevel <= currentLevel) : allParsed;
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
  }, [allParsed, mode, currentLevel, completedIds, hideAbove, search, t]);

  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleMissions.map((m) => m.id));
    return buildMissionEdges(visibleMissions).filter(
      (e) => ids.has(e.from) && ids.has(e.to)
    );
  }, [visibleMissions]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold mb-1">Mission Tree</h1>
        <p className="text-muted-foreground text-sm">
          All missions grouped by required player level. Edges flow from prerequisite to
          dependent. {raw ? `${allParsed.length} missions loaded.` : "Loading…"}
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-end">
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

        <div className="flex items-center gap-2">
          <Switch id="hide-above" checked={hideAbove} onCheckedChange={setHideAbove} />
          <Label htmlFor="hide-above" className="text-xs">Hide above my level</Label>
        </div>
      </div>

      {mode === "remaining" && (
        <div className="rounded-lg border p-3">
          <Label htmlFor="completed-ids" className="text-xs">
            Completed mission IDs (comma or space separated)
          </Label>
          <Textarea
            id="completed-ids"
            className="mt-1 font-mono text-xs"
            rows={2}
            placeholder="1, 2, 5, 12 …"
            value={completedText}
            onChange={(e) => setCompletedText(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{completedIds.size} marked complete</span>
            <span>·</span>
            <span>{availableNow?.size ?? 0} available now</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7"
              onClick={() => setCompletedText("")}
            >
              Clear
            </Button>
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
        </>
      )}
    </div>
  );
}
