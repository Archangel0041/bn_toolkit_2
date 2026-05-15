import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { ParsedMission, MissionEdge, MissionPrereqEdgeType } from "@/lib/missions";
import type { DialogueLine, JobInfoEntry, EncounterEntry } from "@/lib/dataLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMissionIconUrl, getNpcIconUrl, getResourceIconUrl, getJobIconUrl } from "@/lib/resourceImages";
import { getUnitImageUrl } from "@/lib/unitImages";

const NODE_W = 240;
const NODE_H = 96;
const ROW_GAP = 190;
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
  let cursorY = 0;
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

    const bandMaxDepth = compList.reduce((m, c) => Math.max(m, c.maxDepth), 0);
    const numCols = compList.length;
    const totalWidth = Math.max(0, (numCols - 1) * (NODE_W + COL_GAP));
    compList.forEach((comp, colIdx) => {
      const x = colIdx * (NODE_W + COL_GAP) - totalWidth / 2;
      for (const id of comp.ids) {
        const depth = depthMemo.get(id) ?? 0;
        positions.set(id, { x, y: cursorY + depth * SUB_ROW_GAP });
      }
    });

    cursorY += (bandMaxDepth + 1) * SUB_ROW_GAP + BAND_GAP;
  }

  const allPos = [...positions.values()];
  const leftLane = Math.min(...allPos.map((p) => p.x), 0) - COL_GAP;
  const rightLane = Math.max(...allPos.map((p) => p.x + NODE_W), NODE_W) + COL_GAP;
  const edgePoints = new Map<string, { x: number; y: number }[]>();
  edges.forEach((e, index) => {
    const from = positions.get(e.from);
    const to = positions.get(e.to);
    if (!from || !to) return;
    const fromCenterX = from.x + NODE_W / 2;
    const toCenterX = to.x + NODE_W / 2;
    const fromRow = Math.round(from.y / ROW_GAP);
    const toRow = Math.round(to.y / ROW_GAP);
    const sameRow = fromRow === toRow;
    if (sameRow) {
      const goesRight = toCenterX >= fromCenterX;
      const laneY = from.y + NODE_H + 28 + (index % 3) * 12;
      edgePoints.set(`${e.from}->${e.to}`, [
        { x: goesRight ? from.x + NODE_W : from.x, y: from.y + NODE_H / 2 },
        { x: goesRight ? from.x + NODE_W + 28 : from.x - 28, y: from.y + NODE_H / 2 },
        { x: goesRight ? from.x + NODE_W + 28 : from.x - 28, y: laneY },
        { x: goesRight ? to.x - 28 : to.x + NODE_W + 28, y: laneY },
        { x: goesRight ? to.x - 28 : to.x + NODE_W + 28, y: to.y + NODE_H / 2 },
        { x: goesRight ? to.x : to.x + NODE_W, y: to.y + NODE_H / 2 },
      ]);
      return;
    }

    const downward = to.y > from.y;
    const start = { x: fromCenterX, y: downward ? from.y + NODE_H : from.y };
    const end = { x: toCenterX, y: downward ? to.y : to.y + NODE_H };
    const skippedRows = Math.abs(toRow - fromRow) > 1;
    if (skippedRows) {
      const laneX = toCenterX >= fromCenterX ? rightLane + (index % 4) * 18 : leftLane - (index % 4) * 18;
      edgePoints.set(`${e.from}->${e.to}`, [
        start,
        { x: start.x, y: start.y + (downward ? 28 : -28) },
        { x: laneX, y: start.y + (downward ? 28 : -28) },
        { x: laneX, y: end.y + (downward ? -28 : 28) },
        { x: end.x, y: end.y + (downward ? -28 : 28) },
        end,
      ]);
      return;
    }

    const midY = (start.y + end.y) / 2;
    edgePoints.set(`${e.from}->${e.to}`, [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]);
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
}

function MissionNode({ data }: { data: MissionNodeData }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div
      className={[
        "relative h-full w-full rounded-md border-2 px-2 py-1.5 text-left shadow-md transition-all bg-card text-card-foreground",
        data.isAvailable ? "border-primary ring-2 ring-primary/40" : "border-border/80",
        data.isHighlight ? "ring-2 ring-accent" : "",
        data.isDimmed ? "opacity-30" : "",
      ].join(" ")}
    >
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
}: MissionTreeProps) {
  const { t } = useLanguage();
  const localize = useLocalize();
  const [pinnedId, setPinnedId] = useState<number | null>(null);

  const byId = useMemo(() => new Map(missions.map((m) => [m.id, m])), [missions]);

  const { forward, backward, edgeTypeMap } = useMemo(() => {
    const f = new Map<number, Set<number>>();
    const b = new Map<number, Set<number>>();
    const types = new Map<string, MissionPrereqEdgeType>();
    for (const e of edges) {
      if (!f.has(e.from)) f.set(e.from, new Set());
      f.get(e.from)!.add(e.to);
      if (!b.has(e.to)) b.set(e.to, new Set());
      b.get(e.to)!.add(e.from);
      types.set(`${e.from}->${e.to}`, e.type);
    }
    return { forward: f, backward: b, edgeTypeMap: types };
  }, [edges]);

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
    const { positions, edgePoints } = layout(missions, edges);
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
      };
      return {
        id: String(m.id),
        position: pos,
        data,
        type: "mission",
        style: { width: NODE_W, height: NODE_H, padding: 0, border: "none", background: "transparent" },
      };
    });

    const rfEdges: Edge[] = edges.map((e, i) => {
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
  }, [missions, edges, availableNow, highlightId, t, localize, chain, pinnedId, characters, unitsById]);

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
          onClose={() => setPinnedId(null)}
        />
      )}
    </div>
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
  onClose,
}: MissionDetailPanelProps) {
  const { t } = useLanguage();
  const localize = useLocalize();

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
                if (o.unitId != null) {
                  const u = unitsById?.get(o.unitId);
                  const lname = u?.name ? localize(u.name, u.name) : `Unit #${o.unitId}`;
                  detail = `${o.count ?? 1}× ${lname}`;
                  detailIconUrl = u?.icon ? getUnitImageUrl(u.icon) : undefined;
                } else if (o.opponentId != null) {
                  const npc = npcs?.[String(o.opponentId)];
                  const lname = npc?.name ? localize(npc.name, npc.name) : `Opponent #${o.opponentId}`;
                  detail = `${o.count ?? 1}× ${lname}`;
                  detailIconUrl = npc?.icon ? getNpcIconUrl(npc.icon) : undefined;
                } else if (o.count != null) {
                  detail = `${o.count}×`;
                }
                const objIconUrl = o.icon ? getMissionIconUrl(o.icon) : undefined;
                const speakerNpc = o.speakerNpcId != null ? npcs?.[String(o.speakerNpcId)] : undefined;
                const speakerIconUrl = speakerNpc?.icon ? getNpcIconUrl(speakerNpc.icon) : undefined;
                const speakerName = speakerNpc?.name ? localize(speakerNpc.name, speakerNpc.name) : undefined;
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
