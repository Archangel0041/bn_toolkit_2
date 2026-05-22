import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isLovableEnvironment } from "@/components/ProtectedRoute";

// Lazy so the protected battle path literal stays out of the main bundle.
const ProtectedBattleLinkLazy = lazy(async () => {
  const mod = await import("@/protected/ProtectedNavSlot");
  return { default: mod.ProtectedBattleLink };
});
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  Handle,
  Position,
  BaseEdge,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeMouseHandler,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { ChevronDown, ChevronRight, X, Swords } from "lucide-react";
import { Link } from "react-router-dom";
import { type ParsedMission, type MissionEdge, type MissionPrereqEdgeType, type MissionCategory, getMissionCategories, MISSION_CATEGORY_META } from "@/lib/missions";
import { type ProjectBuildingIndex, type BuildingInfo, formatDuration, describePrereq } from "@/lib/missionJobs";
import type { DialogueLine, JobInfoEntry, EncounterEntry } from "@/lib/dataLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMissionIconUrl, getNpcIconUrl, getResourceIconUrl, getJobIconUrl } from "@/lib/resourceImages";
import { getUnitImageUrl } from "@/lib/unitImages";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { EncounterGrid } from "@/components/encounters/EncounterGrid";

const NODE_W = 240;
const NODE_H = 96;
const SUB_ROW_GAP = 140;
const BAND_GAP = 60;
const COL_GAP = 90;

interface UnitInfo { name?: string; icon?: string }
interface NpcInfo { name?: string; icon?: string }

interface MissionTreeProps {
  missions: ParsedMission[];
  edges: MissionEdge[];
  availableNow?: Set<number>;
  highlightId?: number;
  characters?: Record<string, { small_icon?: string; regular_icon?: string }>;
  unitsById?: Map<number, UnitInfo>;
  npcs?: Record<string, NpcInfo>;
  dialogues?: Record<string, DialogueLine[]>;
  jobs?: Record<string, JobInfoEntry>;
  encounters?: Record<string, EncounterEntry>;
  compositions?: Record<string, any[]>;
  projectBuildingIndex?: ProjectBuildingIndex;
}

const EDGE_DASH: Record<MissionPrereqEdgeType, string | undefined> = {
  "complete-all": undefined,
  "complete-any": "6 4",
  active: "2 4",
  inactive: "2 4",
  "not-started": "1 4",
};

const EDGE_LABEL: Record<MissionPrereqEdgeType, string> = {
  "complete-all": "Complete (required)",
  "complete-any": "Complete (any of)",
  active: "Must be active",
  inactive: "Must be inactive",
  "not-started": "Must not be started",
};

function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function layout(missions: ParsedMission[], edges: MissionEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 110, marginx: 50, marginy: 30 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const m of missions) g.setNode(String(m.id), { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(String(e.from), String(e.to));
  dagre.layout(g);

  const positions = new Map<number, { x: number; y: number }>();
  const byLevel = new Map<number, ParsedMission[]>();
  for (const m of missions) {
    const level = Number.isFinite(m.displayLevel) ? m.displayLevel : 0;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(m);
  }
  const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b);

  // Build per-level intra-band layout:
  //  - chains = weakly-connected components using only edges where BOTH endpoints share this level.
  //  - within a chain, sub-row = longest-path depth from a chain source (vertical stacking of related missions).
  //  - chains sit side-by-side (different columns) within the band.
  const levelLayouts: { comps: { ids: number[]; minX: number; maxDepth: number }[] }[] = [];
  for (const level of sortedLevels) {
    const bandMissions = byLevel.get(level) ?? [];
    const bandIds = new Set(bandMissions.map((m) => m.id));
    const intraEdges = edges.filter((e) => bandIds.has(e.from) && bandIds.has(e.to));

    // Union-find for chain components
    const parent = new Map<number, number>();
    for (const m of bandMissions) parent.set(m.id, m.id);
    const find = (x: number): number => {
      let r = x;
      while (parent.get(r)! !== r) r = parent.get(r)!;
      while (parent.get(x)! !== r) {
        const next = parent.get(x)!;
        parent.set(x, r);
        x = next;
      }
      return r;
    };
    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    for (const e of intraEdges) union(e.from, e.to);

    // Group ids by component root
    const components = new Map<number, number[]>();
    for (const m of bandMissions) {
      const r = find(m.id);
      if (!components.has(r)) components.set(r, []);
      components.get(r)!.push(m.id);
    }

    // Depth (sub-row) per mission within its chain via longest path.
    // Build adjacency among intra-band ids.
    const inEdges = new Map<number, number[]>();
    for (const id of bandIds) inEdges.set(id, []);
    for (const e of intraEdges) inEdges.get(e.to)!.push(e.from);
    const depthMemo = new Map<number, number>();
    const depthOf = (id: number, stack: Set<number>): number => {
      if (depthMemo.has(id)) return depthMemo.get(id)!;
      if (stack.has(id)) return 0; // cycle guard
      stack.add(id);
      let d = 0;
      for (const p of inEdges.get(id) ?? []) d = Math.max(d, depthOf(p, stack) + 1);
      stack.delete(id);
      depthMemo.set(id, d);
      return d;
    };
    for (const id of bandIds) depthOf(id, new Set());

    // Order components left-to-right by dagre x of their leftmost member.
    const compList = [...components.values()].map((ids) => {
      const minX = Math.min(...ids.map((id) => g.node(String(id))?.x ?? 0));
      const maxDepth = Math.max(...ids.map((id) => depthMemo.get(id) ?? 0));
      // Per-component column ordering: stable by id when depths tie.
      const sorted = [...ids].sort((a, b) => {
        const da = depthMemo.get(a) ?? 0;
        const db = depthMemo.get(b) ?? 0;
        if (da !== db) return da - db;
        return (g.node(String(a))?.x ?? 0) - (g.node(String(b))?.x ?? 0) || a - b;
      });
      return { ids: sorted, minX, maxDepth };
    });
    compList.sort((a, b) => a.minX - b.minX);

    levelLayouts.push({ comps: compList });
  }

  const colStep = NODE_W + COL_GAP;
  const nominalLevelStep = SUB_ROW_GAP + BAND_GAP;
  // Track every placed node's footprint so future columns (which may not align
  // by index across levels) cannot overlap an existing one horizontally.
  const placedRects: { x1: number; x2: number; y2: number }[] = [];
  levelLayouts.forEach(({ comps }, levelIdx) => {
    const numCols = comps.length;
    const nominalY = levelIdx * nominalLevelStep;
    comps.forEach((comp, colIdx) => {
      const columnKey = colIdx - (numCols - 1) / 2;
      const x = columnKey * colStep;
      const x1 = x;
      const x2 = x + NODE_W;
      // Find the lowest bottom of any previously placed node whose x-range
      // overlaps this column. Push our base below it (plus BAND_GAP).
      let blockerBottom = 0;
      for (const r of placedRects) {
        if (r.x2 > x1 && r.x1 < x2) blockerBottom = Math.max(blockerBottom, r.y2);
      }
      const baseY = Math.max(
        nominalY,
        blockerBottom > 0 ? blockerBottom + BAND_GAP : 0,
      );
      for (let i = 0; i < comp.ids.length; i++) {
        const id = comp.ids[i];
        const y = baseY + i * SUB_ROW_GAP;
        positions.set(id, { x, y });
        placedRects.push({ x1, x2, y2: y + NODE_H });
      }
    });
  });

  const allPos = [...positions.values()];
  const leftLane = Math.min(...allPos.map((p) => p.x), 0) - COL_GAP;
  const rightLane = Math.max(...allPos.map((p) => p.x + NODE_W), NODE_W) + COL_GAP;

  // Node bounding rects (with small padding) for obstacle checks.
  const PAD = 6;
  const nodeRects: { id: number; x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const [id, p] of positions) {
    nodeRects.push({ id, x1: p.x - PAD, y1: p.y - PAD, x2: p.x + NODE_W + PAD, y2: p.y + NODE_H + PAD });
  }
  const segHitsAny = (
    fromId: number,
    toId: number,
    ax: number, ay: number, bx: number, by: number,
  ) => {
    // Axis-aligned segment vs rect intersection (segments are vertical or horizontal).
    const isVert = ax === bx;
    const yMin = Math.min(ay, by), yMax = Math.max(ay, by);
    const xMin = Math.min(ax, bx), xMax = Math.max(ax, bx);
    for (const r of nodeRects) {
      if (r.id === fromId || r.id === toId) continue;
      if (isVert) {
        if (ax > r.x1 && ax < r.x2 && yMax > r.y1 && yMin < r.y2) return true;
      } else {
        if (ay > r.y1 && ay < r.y2 && xMax > r.x1 && xMin < r.x2) return true;
      }
    }
    return false;
  };
  const segIntersectsRect = (
    ax: number, ay: number, bx: number, by: number,
    r: { x1: number; y1: number; x2: number; y2: number },
  ) => {
    let t0 = 0;
    let t1 = 1;
    const dx = bx - ax;
    const dy = by - ay;
    const clip = (p: number, q: number) => {
      if (p === 0) return q >= 0;
      const t = q / p;
      if (p < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
      return true;
    };
    return clip(-dx, ax - r.x1) && clip(dx, r.x2 - ax) && clip(-dy, ay - r.y1) && clip(dy, r.y2 - ay);
  };
  const straightHitsAny = (
    fromId: number,
    toId: number,
    ax: number, ay: number, bx: number, by: number,
  ) => nodeRects.some((r) => r.id !== fromId && r.id !== toId && segIntersectsRect(ax, ay, bx, by, r));
  const elbowClear = (
    fromId: number, toId: number,
    sx: number, sy: number, ex: number, ey: number, midY: number,
  ) =>
    !segHitsAny(fromId, toId, sx, sy, sx, midY) &&
    !segHitsAny(fromId, toId, sx, midY, ex, midY) &&
    !segHitsAny(fromId, toId, ex, midY, ex, ey);

  const edgePoints = new Map<string, { x: number; y: number }[]>();
  edges.forEach((e, index) => {
    const from = positions.get(e.from);
    const to = positions.get(e.to);
    if (!from || !to) return;
    const fromCenterX = from.x + NODE_W / 2;
    const toCenterX = to.x + NODE_W / 2;
    const downward = to.y >= from.y;
    const start = { x: fromCenterX, y: downward ? from.y + NODE_H : from.y };
    const end = { x: toCenterX, y: downward ? to.y : to.y + NODE_H };

    if (!straightHitsAny(e.from, e.to, start.x, start.y, end.x, end.y)) {
      edgePoints.set(`${e.from}->${e.to}`, [start, end]);
      return;
    }

    const sameRow = Math.abs(from.y - to.y) < 1;
    if (sameRow) {
      // Same-row: still attach to bottom (source) and top (target) of nodes,
      // dipping below into a shared lane between rows.
      const laneY = from.y + NODE_H + 32 + (index % 3) * 10;
      edgePoints.set(`${e.from}->${e.to}`, [
        start,
        { x: start.x, y: laneY },
        { x: end.x, y: laneY },
        end,
      ]);
      return;
    }

    const midY = (start.y + end.y) / 2;

    // Try the simple 3-segment elbow first; only fall back to a side lane if
    // it would cut through another node.
    if (elbowClear(e.from, e.to, start.x, start.y, end.x, end.y, midY)) {
      edgePoints.set(`${e.from}->${e.to}`, [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]);
      return;
    }

    // Compute the minimal sideways detour: find every node whose bounding rect
    // overlaps the vertical band between source and target, then route just
    // past the closest free side.
    const goesRight = toCenterX >= fromCenterX;
    const yLo = Math.min(start.y, end.y);
    const yHi = Math.max(start.y, end.y);
    const blockers = nodeRects.filter(
      (r) => r.id !== e.from && r.id !== e.to && r.y2 > yLo && r.y1 < yHi,
    );
    const stub = downward ? 18 : -18;
    const tryLane = (laneX: number) => {
      const ok =
        !segHitsAny(e.from, e.to, start.x, start.y, start.x, start.y + stub) &&
        !segHitsAny(e.from, e.to, start.x, start.y + stub, laneX, start.y + stub) &&
        !segHitsAny(e.from, e.to, laneX, start.y + stub, laneX, end.y - stub) &&
        !segHitsAny(e.from, e.to, laneX, end.y - stub, end.x, end.y - stub) &&
        !segHitsAny(e.from, e.to, end.x, end.y - stub, end.x, end.y);
      if (!ok) return false;
      edgePoints.set(`${e.from}->${e.to}`, [
        start,
        { x: start.x, y: start.y + stub },
        { x: laneX, y: start.y + stub },
        { x: laneX, y: end.y - stub },
        { x: end.x, y: end.y - stub },
        end,
      ]);
      return true;
    };

    // Candidate lanes: just outside the relevant blocker columns. Try the side
    // closest to the target first.
    const rightCandidates: number[] = [];
    const leftCandidates: number[] = [];
    const baseRight = Math.max(from.x + NODE_W, to.x + NODE_W);
    const baseLeft = Math.min(from.x, to.x);
    rightCandidates.push(baseRight + 18);
    leftCandidates.push(baseLeft - 18);
    for (const r of blockers) {
      if (r.x2 + 18 > baseRight) rightCandidates.push(r.x2 + 18);
      if (r.x1 - 18 < baseLeft) leftCandidates.push(r.x1 - 18);
    }
    rightCandidates.sort((a, b) => a - b);
    leftCandidates.sort((a, b) => b - a);

    const ordered = goesRight ? [...rightCandidates, ...leftCandidates] : [...leftCandidates, ...rightCandidates];
    let placed = false;
    for (const laneX of ordered) {
      if (tryLane(laneX)) { placed = true; break; }
    }
    if (placed) return;

    // Last resort: route via the global outer lane.
    const laneX = goesRight ? rightLane + (index % 4) * 18 : leftLane - (index % 4) * 18;
    edgePoints.set(`${e.from}->${e.to}`, [
      start,
      { x: start.x, y: start.y + (downward ? 28 : -28) },
      { x: laneX, y: start.y + (downward ? 28 : -28) },
      { x: laneX, y: end.y + (downward ? -28 : 28) },
      { x: end.x, y: end.y + (downward ? -28 : 28) },
      end,
    ]);
  });
  return { positions, edgePoints };
}

interface RewardChip {
  iconUrl?: string;
  label: string;
  amount: number;
}

interface MissionNodeData extends Record<string, unknown> {
  title: string;
  level: number;
  giver?: string;
  otherCount: number;
  otherTypes: string[];
  isAvailable?: boolean;
  isHighlight?: boolean;
  isDimmed?: boolean;
  missionId: number;
  iconUrl?: string;
  rewardChips: RewardChip[];
  categories: MissionCategory[];
}

function MissionNode({ data }: { data: MissionNodeData }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div
      className={[
        "relative h-full w-full overflow-hidden rounded-md border-2 pl-3 pr-2 py-1.5 text-left shadow-md transition-all bg-card text-card-foreground",
        data.isAvailable ? "border-primary ring-2 ring-primary/40" : "border-border/80",
        data.isHighlight ? "ring-2 ring-accent" : "",
        data.isDimmed ? "opacity-30" : "",
      ].join(" ")}
    >
      {data.categories.length > 0 && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-1.5 flex-col">
          {data.categories.map((c) => (
            <span
              key={c}
              className="flex-1"
              style={{ background: `hsl(var(${MISSION_CATEGORY_META[c].cssVar}))` }}
              title={MISSION_CATEGORY_META[c].label}
            />
          ))}
        </div>
      )}
      <Handle type="target" position={Position.Top} style={{ background: "hsl(var(--primary))", width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "hsl(var(--primary))", width: 8, height: 8 }} />

      <div className="flex items-start gap-2">
        {data.iconUrl && !imgFailed ? (
          <img
            src={data.iconUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded bg-muted object-cover"
            onError={() => setImgFailed(true)}
            draggable={false}
          />
        ) : (
          <div className="h-9 w-9 shrink-0 rounded bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
            {(data.giver ?? "?").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <div className="truncate text-[11px] font-semibold leading-tight" title={data.title}>
              {data.title}
            </div>
            <span className="shrink-0 rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground">
              Lv{data.level}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-1">
            <span className="truncate text-[10px] text-muted-foreground" title={data.giver}>
              {data.giver ?? "—"}
            </span>
            <span className="shrink-0 text-[9px] text-muted-foreground/70">#{data.missionId}</span>
          </div>
          {data.otherCount > 0 && (
            <div
              className="mt-0.5 truncate text-[9px] text-amber-600 dark:text-amber-400"
              title={data.otherTypes.join(", ")}
            >
              +{data.otherCount} other req
            </div>
          )}
        </div>
      </div>
      {data.rewardChips.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {data.rewardChips.map((r, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 rounded bg-muted/60 px-1 py-px text-[9px] font-medium tabular-nums text-foreground"
              title={`${r.label}: ${r.amount.toLocaleString()}`}
            >
              {r.iconUrl ? (
                <img
                  src={r.iconUrl}
                  alt=""
                  className="h-3 w-3 shrink-0 object-contain"
                  onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                  draggable={false}
                />
              ) : null}
              {r.amount.toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { mission: MissionNode };

function RoutedEdge({ id, data, style, markerEnd }: EdgeProps) {
  const pts = (data as { points?: { x: number; y: number }[] } | undefined)?.points;
  if (!pts || pts.length < 2) return null;
  const r = 10;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const dx1 = cur.x - prev.x;
    const dy1 = cur.y - prev.y;
    const len1 = Math.hypot(dx1, dy1) || 1;
    const dx2 = next.x - cur.x;
    const dy2 = next.y - cur.y;
    const len2 = Math.hypot(dx2, dy2) || 1;
    const off = Math.min(r, len1 / 2, len2 / 2);
    const p1 = { x: cur.x - (dx1 / len1) * off, y: cur.y - (dy1 / len1) * off };
    const p2 = { x: cur.x + (dx2 / len2) * off, y: cur.y + (dy2 / len2) * off };
    d += ` L ${p1.x} ${p1.y} Q ${cur.x} ${cur.y} ${p2.x} ${p2.y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return <BaseEdge id={id} path={d} style={style} markerEnd={markerEnd} />;
}

const edgeTypes = { routed: RoutedEdge };

export function MissionTree(props: MissionTreeProps) {
  return (
    <ReactFlowProvider>
      <MissionTreeInner {...props} />
    </ReactFlowProvider>
  );
}

/** Translate, falling back to title-cased raw key. */
function useLocalize() {
  const { t } = useLanguage();
  return useCallback(
    (key?: string, fallback?: string) => {
      if (!key) return fallback ?? "";
      const tr = t(key);
      return tr && tr !== key ? tr : fallback ?? titleCase(key);
    },
    [t]
  );
}

function resourceLabel(t: (k: string) => string, k: string): string {
  for (const lk of [`resource_${k}_name`, `bn_resource_${k}`, `resource_${k}`]) {
    const tr = t(lk);
    if (tr && tr !== lk) return tr;
  }
  return titleCase(k);
}

function buildRewardChips(
  m: ParsedMission,
  t: (k: string) => string,
  unitsById?: Map<number, UnitInfo>
): RewardChip[] {
  const chips: RewardChip[] = [];
  // XP first, then other resources, then units. Cap to keep node compact.
  const resourceEntries = Object.entries(m.rewards.resources).sort(([a], [b]) =>
    a === "xp" ? -1 : b === "xp" ? 1 : a.localeCompare(b)
  );
  for (const [k, v] of resourceEntries) {
    chips.push({ iconUrl: getResourceIconUrl(k), label: resourceLabel(t, k), amount: Number(v) || 0 });
  }
  for (const [id, qty] of Object.entries(m.rewards.units)) {
    const u = unitsById?.get(Number(id));
    const localized = u?.name ? t(u.name) : "";
    const label = localized && localized !== u?.name ? localized : u?.name ?? `Unit #${id}`;
    chips.push({ iconUrl: u?.icon ? getUnitImageUrl(u.icon) : undefined, label, amount: Number(qty) || 0 });
  }
  return chips;
}

function MissionTreeInner({
  missions,
  edges,
  availableNow,
  highlightId,
  characters,
  unitsById,
  npcs,
  dialogues,
  jobs,
  encounters,
  compositions,
  projectBuildingIndex,
}: MissionTreeProps) {
  const { t } = useLanguage();
  const localize = useLocalize();
  const { user, hasAccess } = useAuth();
  const canSeeProtected = isLovableEnvironment() || (!!user && hasAccess);
  const [pinnedId, setPinnedId] = useState<number | null>(null);

  const byId = useMemo(() => new Map(missions.map((m) => [m.id, m])), [missions]);

  // Transitive reduction per edge type: if A→B and B→...→C exist (same type),
  // drop the redundant direct edge A→C. Keeps the graph visually clean and
  // produces the shortest possible arrows in the dagre layout.
  const reducedEdges = useMemo(() => {
    const byType = new Map<MissionPrereqEdgeType, MissionEdge[]>();
    for (const e of edges) {
      if (!byType.has(e.type)) byType.set(e.type, []);
      byType.get(e.type)!.push(e);
    }
    const keep: MissionEdge[] = [];
    for (const [, group] of byType) {
      const adj = new Map<number, Set<number>>();
      for (const e of group) {
        if (!adj.has(e.from)) adj.set(e.from, new Set());
        adj.get(e.from)!.add(e.to);
      }
      for (const e of group) {
        const succs = adj.get(e.from)!;
        // BFS from each other direct successor of e.from; if e.to is reachable
        // via a path of length >=2, this edge is redundant.
        let redundant = false;
        const visited = new Set<number>();
        const stack: number[] = [];
        for (const s of succs) {
          if (s === e.to) continue;
          stack.push(s);
        }
        while (stack.length) {
          const cur = stack.pop()!;
          if (visited.has(cur)) continue;
          visited.add(cur);
          if (cur === e.to) { redundant = true; break; }
          for (const next of adj.get(cur) ?? []) {
            if (!visited.has(next)) stack.push(next);
          }
        }
        if (!redundant) keep.push(e);
      }
    }
    return keep;
  }, [edges]);

  const { forward, backward, edgeTypeMap } = useMemo(() => {
    const f = new Map<number, Set<number>>();
    const b = new Map<number, Set<number>>();
    const types = new Map<string, MissionPrereqEdgeType>();
    for (const e of reducedEdges) {
      if (!f.has(e.from)) f.set(e.from, new Set());
      f.get(e.from)!.add(e.to);
      if (!b.has(e.to)) b.set(e.to, new Set());
      b.get(e.to)!.add(e.from);
      types.set(`${e.from}->${e.to}`, e.type);
    }
    return { forward: f, backward: b, edgeTypeMap: types };
  }, [reducedEdges]);

  const chain = useMemo(() => {
    if (pinnedId == null) return null;
    const inChain = new Set<number>([pinnedId]);
    const walk = (id: number, adj: Map<number, Set<number>>) => {
      const stack = [id];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const next of adj.get(cur) ?? []) {
          if (!inChain.has(next)) {
            inChain.add(next);
            stack.push(next);
          }
        }
      }
    };
    walk(pinnedId, forward);
    walk(pinnedId, backward);
    return inChain;
  }, [pinnedId, forward, backward]);

  const { rfNodes, rfEdges } = useMemo(() => {
    const { positions, edgePoints } = layout(missions, reducedEdges);
    const rfNodes: Node[] = missions.map((m) => {
      const pos = positions.get(m.id) ?? { x: 0, y: 0 };
      const title = localize(m.title, m.title);
      const data: MissionNodeData = {
        title,
        level: m.displayLevel,
        giver: m.giver ? titleCase(m.giver) : undefined,
        otherCount: m.otherPrereqCount,
        otherTypes: m.otherPrereqTypes,
        isAvailable: availableNow?.has(m.id),
        isHighlight: highlightId === m.id || pinnedId === m.id,
        isDimmed: chain ? !chain.has(m.id) : false,
        missionId: m.id,
        iconUrl: (() => {
          if (!m.giver) return undefined;
          const ch = characters?.[m.giver.toLowerCase()];
          const key = ch?.small_icon ?? ch?.regular_icon;
          return key ? getNpcIconUrl(key) : getNpcIconUrl(m.giver);
        })(),
        rewardChips: buildRewardChips(m, t, unitsById),
        categories: getMissionCategories(m),

      };
      return {
        id: String(m.id),
        position: pos,
        data,
        type: "mission",
        style: { width: NODE_W, height: NODE_H, padding: 0, border: "none", background: "transparent" },
      };
    });

    const rfEdges: Edge[] = reducedEdges.map((e, i) => {
      const inChain = chain ? chain.has(e.from) && chain.has(e.to) : true;
      const points = edgePoints.get(`${e.from}->${e.to}`);
      return {
        id: `e${i}`,
        source: String(e.from),
        target: String(e.to),
        type: points ? "routed" : "smoothstep",
        data: { points },
        style: {
          stroke: "hsl(var(--primary))",
          strokeWidth: inChain ? 2.5 : 2,
          strokeDasharray: EDGE_DASH[e.type],
          opacity: chain && !inChain ? 0.15 : 0.9,
          fill: "none",
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))", width: 20, height: 20 },
      };
    });

    return { rfNodes, rfEdges };
  }, [missions, reducedEdges, availableNow, highlightId, t, localize, chain, pinnedId, characters, unitsById]);

  const [nodes, setNodes] = useNodesState(rfNodes);
  const [edgesState, setEdges] = useEdgesState(rfEdges);
  const { fitView } = useReactFlow();
  useEffect(() => setNodes(rfNodes), [rfNodes, setNodes]);
  useEffect(() => setEdges(rfEdges), [rfEdges, setEdges]);

  // Only fit on first non-empty layout. After that, leave the user's zoom/pan alone.
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current || rfNodes.length === 0) return;
    didInitialFit.current = true;
    const handle = setTimeout(() => {
      fitView({ padding: 0.18, maxZoom: 1, minZoom: 0.05, duration: 350 });
    }, 60);
    return () => clearTimeout(handle);
  }, [rfNodes, fitView]);

  const onNodeClick = useCallback<NodeMouseHandler>((_evt, node) => {
    const id = parseInt(node.id, 10);
    setPinnedId((cur) => (cur === id ? null : id));
  }, []);

  const onPaneClick = useCallback(() => setPinnedId(null), []);

  const pinned = pinnedId != null ? byId.get(pinnedId) : null;

  return (
    <>
      <div className="relative h-[calc(100vh-320px)] min-h-[500px] w-full rounded-lg border bg-muted/40 overflow-hidden mission-tree-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edgesState}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 1, minZoom: 0.05 }}
          minZoom={0.05}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          edgesReconnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {pinned && (
        <MissionDetailPanel
          mission={pinned}
          byId={byId}
          forward={forward}
          backward={backward}
          edgeTypeMap={edgeTypeMap}
          characters={characters}
          unitsById={unitsById}
          npcs={npcs}
          dialogues={dialogues}
          jobs={jobs}
          encounters={encounters}
          compositions={compositions}
          projectBuildingIndex={projectBuildingIndex}
          onClose={() => setPinnedId(null)}
        />
      )}
    </>
  );
}


interface MissionDetailPanelProps {
  mission: ParsedMission;
  byId: Map<number, ParsedMission>;
  forward: Map<number, Set<number>>;
  backward: Map<number, Set<number>>;
  edgeTypeMap: Map<string, MissionPrereqEdgeType>;
  characters?: Record<string, { small_icon?: string; regular_icon?: string }>;
  unitsById?: Map<number, UnitInfo>;
  npcs?: Record<string, NpcInfo>;
  dialogues?: Record<string, DialogueLine[]>;
  jobs?: Record<string, JobInfoEntry>;
  encounters?: Record<string, EncounterEntry>;
  compositions?: Record<string, any[]>;
  projectBuildingIndex?: ProjectBuildingIndex;
  onClose: () => void;
}

function MissionDetailPanel({
  mission,
  byId,
  forward,
  backward,
  edgeTypeMap,
  characters,
  unitsById,
  npcs,
  dialogues,
  jobs,
  encounters,
  compositions,
  projectBuildingIndex,
  onClose,
}: MissionDetailPanelProps) {
  const { t } = useLanguage();
  const localize = useLocalize();
  const { user, hasAccess } = useAuth();
  const canSeeProtected = isLovableEnvironment() || (!!user && hasAccess);

  const giverIcon = (() => {
    if (!mission.giver) return undefined;
    const ch = characters?.[mission.giver.toLowerCase()];
    const key = ch?.small_icon ?? ch?.regular_icon;
    return key ? getNpcIconUrl(key) : getNpcIconUrl(mission.giver);
  })();

  const prereqIds = [...(backward.get(mission.id) ?? [])];
  const followIds = [...(forward.get(mission.id) ?? [])];
  const chips = buildRewardChips(mission, t, unitsById);

  const renderRelatedRow = (otherId: number, edgeKey: string) => {
    const m = byId.get(otherId);
    const type = edgeTypeMap.get(edgeKey);
    const title = m ? localize(m.title, m.title) : `Mission #${otherId}`;
    return (
      <li key={edgeKey} className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate" title={title}>
          {title}
          {m ? <span className="ml-1 text-[10px] text-muted-foreground">Lv{m.displayLevel}</span> : null}
        </span>
        {type && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[9px] uppercase tracking-wide text-muted-foreground">
            {EDGE_LABEL[type]}
          </span>
        )}
      </li>
    );
  };

  return (
    <div className="absolute right-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-[340px] max-w-[calc(100%-1.5rem)] flex-col rounded-lg border bg-background/95 shadow-lg backdrop-blur">
      <div className="flex items-start gap-2 border-b p-3">
        {giverIcon && (
          <img
            src={giverIcon}
            alt=""
            className="h-10 w-10 shrink-0 rounded bg-muted object-cover"
            onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
            draggable={false}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">
            {localize(mission.title, mission.title)}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Lv{mission.displayLevel}</span>
            <span>·</span>
            <span>#{mission.id}</span>
            {mission.giver && <><span>·</span><span>{titleCase(mission.giver)}</span></>}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {(() => {
          const base = mission.title?.replace(/_title$/, "") ?? "";
          const hintLines: string[] = [];
          if (base) {
            for (let i = 0; i < 12; i++) {
              const k = `mis_${base}_20hint_${i}_body_0`;
              const tr = t(k);
              if (!tr || tr === k) {
                if (i === 0) continue;
                break;
              }
              hintLines.push(tr);
            }
          }
          const fallback = mission.description
            ? localize(mission.description, mission.description)
            : "";
          const lines = hintLines.length > 0 ? hintLines : fallback ? [fallback] : [];
          if (lines.length === 0) return null;
          return (
            <div className="space-y-1">
              {lines.map((line, i) => (
                <p key={i} className="text-xs text-muted-foreground">{line}</p>
              ))}
            </div>
          );
        })()}

        <DialogSection title="Pre-mission Dialog" baseKey={mission.title} suffix="10startdialog" t={t} characters={characters} dialogues={dialogues} fallbackSpeakerIconUrl={giverIcon} fallbackSpeakerName={mission.giver ? titleCase(mission.giver) : undefined} />
        <DialogSection title="Completion Dialog" baseKey={mission.title} suffix="70enddialog" t={t} characters={characters} dialogues={dialogues} fallbackSpeakerIconUrl={giverIcon} fallbackSpeakerName={mission.giver ? titleCase(mission.giver) : undefined} />
        <DialogSection title="Reward Dialog" baseKey={mission.title} suffix="60reward" t={t} characters={characters} dialogues={dialogues} fallbackSpeakerIconUrl={giverIcon} fallbackSpeakerName={mission.giver ? titleCase(mission.giver) : undefined} />

        <section>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Objectives ({mission.objectives.length})
          </h4>
          {mission.objectives.length === 0 ? (
            <p className="text-xs text-muted-foreground/70">No objective metadata.</p>
          ) : (
            <ol className="space-y-1 text-xs">
              {mission.objectives.map((o, i) => {
                const title = o.title ? localize(o.title, o.title) : `Objective ${i + 1}`;
                const desc = o.description ? localize(o.description, o.description) : "";
                const typeLabel = o.type
                  ? o.type.replace(/_prereq_config$/, "").replace(/_/g, " ")
                  : "";
                let detail = "";
                let detailIconUrl: string | undefined;
                // jobId & projectId both reference the same id space (job_info + units).
                // Resolve order: explicit jobId, then projectId (jobs → units fallback).
                const jobOrProjectId = o.jobId ?? o.projectId;
                const jobEntry = jobOrProjectId != null ? jobs?.[String(jobOrProjectId)] : undefined;
                const unitFromProject =
                  o.projectId != null && !jobEntry ? unitsById?.get(o.projectId) : undefined;

                if (o.unitId != null) {
                  const u = unitsById?.get(o.unitId);
                  const lname = u?.name ? localize(u.name, u.name) : `Unit #${o.unitId}`;
                  detail = `${o.count ?? 1}× ${lname}`;
                  detailIconUrl = u?.icon ? getUnitImageUrl(u.icon) : undefined;
                } else if (jobEntry) {
                  const lname = jobEntry.name ? localize(jobEntry.name, jobEntry.name) : `Job #${jobOrProjectId}`;
                  detail = `${o.count ?? 1}× ${lname}`;
                  detailIconUrl = jobEntry.icon ? getJobIconUrl(jobEntry.icon) : undefined;
                } else if (unitFromProject) {
                  const lname = unitFromProject.name ? localize(unitFromProject.name, unitFromProject.name) : `Unit #${o.projectId}`;
                  detail = `${o.count ?? 1}× ${lname}`;
                  detailIconUrl = unitFromProject.icon ? getUnitImageUrl(unitFromProject.icon) : undefined;
                } else if (o.opponentId != null) {
                  const npc = npcs?.[String(o.opponentId)];
                  const lname = npc?.name ? localize(npc.name, npc.name) : `Opponent #${o.opponentId}`;
                  detail = `${o.count ?? 1}× ${lname}`;
                  detailIconUrl = npc?.icon ? getNpcIconUrl(npc.icon) : undefined;
                } else if (o.count != null) {
                  detail = `${o.count}×`;
                }

                // Resolve producing building (for collect_job / collect_project / start_*).
                // Fall back to direct composition_id (e.g. has_composition prereq → "build" objective).
                let buildingInfo: BuildingInfo | undefined =
                  jobOrProjectId != null ? projectBuildingIndex?.get(jobOrProjectId) : undefined;
                if (!buildingInfo && o.compositionId != null) {
                  const comps = compositions?.[String(o.compositionId)];
                  const smc = comps?.find((c: any) => c?._t === "structure_menu_config");
                  if (smc) {
                    buildingInfo = {
                      compositionId: o.compositionId,
                      nameKey: typeof smc.name === "string" ? smc.name : undefined,
                      iconKey: typeof smc.icon === "string" ? smc.icon : undefined,
                      cost: smc.cost && typeof smc.cost === "object" ? smc.cost : undefined,
                      prereqs: Array.isArray(smc.prereqs) ? smc.prereqs : undefined,
                    };
                  }
                }
                // If the objective is a has_composition and we have no other detail, show the building as the target.
                if (!detail && o.compositionId != null && buildingInfo) {
                  const lname = buildingInfo.nameKey
                    ? localize(buildingInfo.nameKey, buildingInfo.nameKey)
                    : `Building #${o.compositionId}`;
                  detail = `${o.count ?? 1}× ${lname}`;
                  detailIconUrl = buildingInfo.iconKey ? getJobIconUrl(buildingInfo.iconKey) : undefined;
                }
                const buildingLocalName = buildingInfo?.nameKey
                  ? localize(buildingInfo.nameKey, buildingInfo.nameKey)
                  : undefined;
                const buildingIconUrl = buildingInfo?.iconKey
                  ? getJobIconUrl(buildingInfo.iconKey)
                  : undefined;

                // Per-item build time (only available for job_info entries).
                const perItemSeconds: number | undefined = jobEntry?.build_time;
                const count = o.count ?? 1;
                const totalSeconds = perItemSeconds ? perItemSeconds * count : undefined;

                // Building prereqs (player level, building level, structures required).
                const prereqLines: string[] = [];
                const resolveBuildingName = (cid: number): string | undefined => {
                  const comps = compositions?.[String(cid)];
                  if (!comps) return undefined;
                  const smc = comps.find((c: any) => c?._t === "structure_menu_config");
                  return smc?.name ? localize(smc.name, smc.name) : undefined;
                };
                for (const p of buildingInfo?.prereqs ?? []) {
                  const line = describePrereq(p, { buildingName: resolveBuildingName });
                  if (line) prereqLines.push(line);
                }
                // Also surface the job's own player-level prereq when relevant.
                for (const p of (jobEntry?.prereqs as any[] | undefined) ?? []) {
                  const line = describePrereq(p, { buildingName: resolveBuildingName });
                  if (line && !prereqLines.includes(line)) prereqLines.push(line);
                }
                if (jobEntry?.building_level != null) {
                  prereqLines.unshift(
                    `${buildingLocalName ?? "Building"} Lv ${jobEntry.building_level}`
                  );
                }

                const objIconUrl = o.icon ? getMissionIconUrl(o.icon) : undefined;
                const speakerNpc = o.speakerNpcId != null ? npcs?.[String(o.speakerNpcId)] : undefined;
                const speakerIconUrl = speakerNpc?.icon ? getNpcIconUrl(speakerNpc.icon) : undefined;
                const speakerName = speakerNpc?.name ? localize(speakerNpc.name, speakerNpc.name) : undefined;

                // Collect encounter info: for finish_battle (single) or defeat_encounter_set (many).
                const encIds: number[] = o.encounterIds && o.encounterIds.length > 0
                  ? o.encounterIds
                  : o.encounterId != null ? [o.encounterId] : [];
                const encList = encIds
                  .map((eid) => ({ id: eid, enc: encounters?.[String(eid)] }))
                  .filter((x) => x.enc);
                // Union of enemy units across listed encounters.
                const enemyUnitMap = new Map<number, { count: number }>();
                for (const { enc } of encList) {
                  for (const u of enc?.units ?? []) {
                    const cur = enemyUnitMap.get(u.unit_id);
                    if (cur) cur.count += 1;
                    else enemyUnitMap.set(u.unit_id, { count: 1 });
                  }
                }
                const enemyUnits = [...enemyUnitMap.entries()].slice(0, 24);

                return (
                  <li key={i} className="rounded border bg-muted/30 px-2 py-1">
                    <div className="flex items-start gap-1.5">
                      {objIconUrl && (
                        <img
                          src={objIconUrl}
                          alt=""
                          className="h-5 w-5 shrink-0 rounded bg-background object-contain"
                          onError={(e) => ((e.currentTarget.style.display = "none"))}
                          draggable={false}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{title}</div>
                        {desc && desc !== title && (
                          <div className="text-[11px] text-muted-foreground">{desc}</div>
                        )}
                      </div>
                      {speakerIconUrl && (
                        <img
                          src={speakerIconUrl}
                          alt=""
                          title={speakerName}
                          className="h-5 w-5 shrink-0 rounded-full bg-background object-cover"
                          onError={(e) => ((e.currentTarget.style.display = "none"))}
                          draggable={false}
                        />
                      )}
                    </div>
                    {(typeLabel || detail) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground/80">
                        {typeLabel && (
                          <span className="uppercase tracking-wide">{typeLabel}</span>
                        )}
                        {detail && (
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-1 py-px font-medium tabular-nums text-foreground">
                            {detailIconUrl && (
                              <img
                                src={detailIconUrl}
                                alt=""
                                className="h-3.5 w-3.5 object-contain"
                                onError={(e) => ((e.currentTarget.style.display = "none"))}
                                draggable={false}
                              />
                            )}
                            {detail}
                          </span>
                        )}
                      </div>
                    )}

                    {(buildingInfo || perItemSeconds != null || prereqLines.length > 0) && (
                      <div className="mt-1.5 space-y-1 rounded border border-border/60 bg-background/60 p-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {buildingInfo && (
                            <span
                              className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground"
                              title={buildingLocalName ?? `Composition #${buildingInfo.compositionId}`}
                            >
                              {buildingIconUrl && (
                                <img
                                  src={buildingIconUrl}
                                  alt=""
                                  className="h-3.5 w-3.5 object-contain"
                                  onError={(e) => ((e.currentTarget.style.display = "none"))}
                                  draggable={false}
                                />
                              )}
                              <span className="max-w-[140px] truncate">
                                {buildingLocalName ?? `Building #${buildingInfo.compositionId}`}
                              </span>
                            </span>
                          )}
                          {perItemSeconds != null && (
                            <span
                              className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 tabular-nums text-muted-foreground"
                              title={`Per item: ${formatDuration(perItemSeconds)}${totalSeconds ? ` · Total: ${formatDuration(totalSeconds)}` : ""}`}
                            >
                              {formatDuration(perItemSeconds)}
                              {count > 1 && totalSeconds != null && (
                                <span className="text-muted-foreground/80">
                                  × {count} = {formatDuration(totalSeconds)}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {prereqLines.length > 0 && (
                          <ul className="space-y-0.5 text-[10px] text-muted-foreground">
                            {prereqLines.map((p, pi) => (
                              <li key={pi}>· {p}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}


                    {encList.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                          {encList.length === 1 ? "Encounter" : `${encList.length} encounters`}
                          {o.count != null && encList.length > 1 && (
                            <span className="ml-1 normal-case tracking-normal">· need {o.count}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {encList.map(({ id, enc }) => {
                            const ename = enc?.name ? localize(enc.name, enc.name) : `Encounter #${id}`;
                            const lvl = typeof enc?.level === "number" ? enc.level : undefined;
                            const trigger = canSeeProtected ? (
                              <Suspense
                                fallback={
                                  <span className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px]">
                                    <Swords className="h-3 w-3" />
                                    <span className="max-w-[140px] truncate">{ename}</span>
                                    {lvl != null && (
                                      <span className="text-muted-foreground">Lv{lvl}</span>
                                    )}
                                  </span>
                                }
                              >
                                <ProtectedBattleLinkLazy
                                  encounterId={id}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`Open battle: ${ename}${lvl != null ? ` (Lv ${lvl})` : ""}`}
                                  className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] hover:bg-accent hover:text-accent-foreground transition-colors"
                                >
                                  <Swords className="h-3 w-3" />
                                  <span className="max-w-[140px] truncate">{ename}</span>
                                  {lvl != null && (
                                    <span className="text-muted-foreground">Lv{lvl}</span>
                                  )}
                                </ProtectedBattleLinkLazy>
                              </Suspense>
                            ) : (
                              <span
                                title={`${ename}${lvl != null ? ` (Lv ${lvl})` : ""}`}
                                className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px]"
                              >
                                <Swords className="h-3 w-3" />
                                <span className="max-w-[140px] truncate">{ename}</span>
                                {lvl != null && (
                                  <span className="text-muted-foreground">Lv{lvl}</span>
                                )}
                              </span>
                            );
                            return (
                              <HoverCard key={id} openDelay={150} closeDelay={100}>
                                <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
                                <HoverCardContent className="w-auto p-2" side="top">
                                  <div className="mb-1 text-xs font-semibold">
                                    {ename}
                                    {lvl != null && (
                                      <span className="ml-1 text-muted-foreground font-normal">Lv {lvl}</span>
                                    )}
                                  </div>
                                  {enc?.units && enc.units.length > 0 ? (
                                    <EncounterGrid units={enc.units} compact />
                                  ) : (
                                    <div className="text-xs text-muted-foreground">No preview available</div>
                                  )}
                                </HoverCardContent>
                              </HoverCard>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Prerequisites ({prereqIds.length})
          </h4>
          {prereqIds.length === 0 ? (
            <p className="text-xs text-muted-foreground/70">None.</p>
          ) : (
            <ul className="space-y-1">
              {prereqIds.map((pid) => renderRelatedRow(pid, `${pid}->${mission.id}`))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Follow-ups ({followIds.length})
          </h4>
          {followIds.length === 0 ? (
            <p className="text-xs text-muted-foreground/70">None.</p>
          ) : (
            <ul className="space-y-1">
              {followIds.map((fid) => renderRelatedRow(fid, `${mission.id}->${fid}`))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rewards
          </h4>
          {chips.length === 0 ? (
            <p className="text-xs text-muted-foreground/70">None.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {chips.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded border bg-muted/40 px-1.5 py-1"
                  title={r.label}
                >
                  {r.iconUrl ? (
                    <img
                      src={r.iconUrl}
                      alt=""
                      className="h-5 w-5 shrink-0 object-contain"
                      onError={(e) => ((e.currentTarget.style.visibility = "hidden"))}
                      draggable={false}
                    />
                  ) : (
                    <div className="h-5 w-5 shrink-0 rounded bg-background" />
                  )}
                  <span className="flex-1 truncate text-[11px]" title={r.label}>
                    {r.label}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums">
                    {r.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface DialogSectionProps {
  title: string;
  baseKey?: string;
  suffix: string;
  t: (k: string) => string;
  defaultOpen?: boolean;
  characters?: Record<string, { small_icon?: string; regular_icon?: string }>;
  dialogues?: Record<string, DialogueLine[]>;
  fallbackSpeakerIconUrl?: string;
  fallbackSpeakerName?: string;
}

interface DialogLineRender {
  body: string;
  speaker?: string;
  iconUrl?: string;
}

function DialogSection({
  title,
  baseKey,
  suffix,
  t,
  defaultOpen = false,
  characters,
  dialogues,
  fallbackSpeakerIconUrl,
  fallbackSpeakerName,
}: DialogSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const base = baseKey ? baseKey.replace(/_title$/, "") : "";
  const scriptId = base ? `mis_${base}_${suffix}` : "";

  const lines = useMemo<DialogLineRender[]>(() => {
    if (!base) return [];
    const script = dialogues?.[scriptId];
    const resolveIcon = (speaker?: string): string | undefined => {
      if (!speaker) return undefined;
      const ch = characters?.[speaker.toLowerCase()];
      const key = ch?.small_icon ?? ch?.regular_icon;
      return key ? getNpcIconUrl(key) : getNpcIconUrl(speaker);
    };
    if (script && script.length > 0) {
      const out: DialogLineRender[] = [];
      for (const entry of script) {
        for (const txt of entry.text ?? []) {
          if (!txt.body) continue;
          const tr = t(txt.body);
          if (!tr || tr === txt.body) continue;
          out.push({
            body: tr,
            speaker: entry.speaker,
            iconUrl: resolveIcon(entry.speaker),
          });
        }
      }
      return out;
    }
    // Fallback: probe text keys directly when script isn't available.
    const out: DialogLineRender[] = [];
    for (let i = 0; i < 12; i++) {
      const k = `mis_${base}_${suffix}_${i}_body_0`;
      const tr = t(k);
      if (!tr || tr === k) {
        if (i === 0) continue;
        break;
      }
      out.push({ body: tr, iconUrl: fallbackSpeakerIconUrl, speaker: fallbackSpeakerName });
    }
    return out;
  }, [base, scriptId, suffix, t, dialogues, characters, fallbackSpeakerIconUrl, fallbackSpeakerName]);

  if (lines.length === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>{title} ({lines.length})</span>
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {lines.map((line, i) => (
            <div key={i} className="flex items-start gap-1.5 rounded border bg-muted/30 px-2 py-1">
              {line.iconUrl ? (
                <img
                  src={line.iconUrl}
                  alt=""
                  title={line.speaker}
                  className="h-6 w-6 shrink-0 rounded-full bg-background object-cover"
                  onError={(e) => ((e.currentTarget.style.display = "none"))}
                  draggable={false}
                />
              ) : null}
              <div className="flex-1 min-w-0">
                {line.speaker && (
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    {titleCase(line.speaker)}
                  </div>
                )}
                <p className="text-xs leading-snug text-foreground">{line.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
