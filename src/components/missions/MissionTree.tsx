import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import type { ParsedMission, MissionEdge, MissionPrereqEdgeType } from "@/lib/missions";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMissionIconUrl } from "@/lib/resourceImages";

const NODE_W = 240;
const NODE_H = 76;
const ROW_H = 170;

interface MissionTreeProps {
  missions: ParsedMission[];
  edges: MissionEdge[];
  availableNow?: Set<number>;
  highlightId?: number;
}

const EDGE_DASH: Record<MissionPrereqEdgeType, string | undefined> = {
  "complete-all": undefined,
  "complete-any": "6 4",
  active: "2 4",
  inactive: "2 4",
  "not-started": "1 4",
};

/** Convert "big_game_hunter" / "MORGAN" -> "Big Game Hunter" / "Morgan". */
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
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 80, marginx: 50, marginy: 30 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const m of missions) g.setNode(String(m.id), { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(String(e.from), String(e.to));
  dagre.layout(g);

  // Use dagre's natural tree layout — it ranks nodes by dependency depth, so
  // chains visibly cascade top-down instead of being squashed into level rows.
  const positions = new Map<number, { x: number; y: number }>();
  for (const m of missions) {
    const node = g.node(String(m.id));
    positions.set(m.id, { x: node?.x ?? 0, y: node?.y ?? 0 });
  }
  return { positions };
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
}

function MissionNode({ data }: { data: MissionNodeData }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div
      className={[
        "h-full w-full rounded-md border px-2 py-1.5 text-left shadow-sm transition-all bg-card text-card-foreground",
        data.isAvailable ? "border-primary ring-1 ring-primary/40" : "border-border",
        data.isHighlight ? "ring-2 ring-accent" : "",
        data.isDimmed ? "opacity-30" : "",
      ].join(" ")}
    >
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
    </div>
  );
}

const nodeTypes = { mission: MissionNode };

export function MissionTree(props: MissionTreeProps) {
  return (
    <ReactFlowProvider>
      <MissionTreeInner {...props} />
    </ReactFlowProvider>
  );
}

function MissionTreeInner({ missions, edges, availableNow, highlightId }: MissionTreeProps) {
  const { t } = useLanguage();
  const [pinnedId, setPinnedId] = useState<number | null>(null);

  // Build forward & backward adjacency for chain highlighting
  const { forward, backward } = useMemo(() => {
    const f = new Map<number, Set<number>>();
    const b = new Map<number, Set<number>>();
    for (const e of edges) {
      if (!f.has(e.from)) f.set(e.from, new Set());
      f.get(e.from)!.add(e.to);
      if (!b.has(e.to)) b.set(e.to, new Set());
      b.get(e.to)!.add(e.from);
    }
    return { forward: f, backward: b };
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

  const { rfNodes, rfEdges, levels, rowY } = useMemo(() => {
    const { positions, levels, rowY } = layout(missions, edges);
    const rfNodes: Node[] = missions.map((m) => {
      const pos = positions.get(m.id) ?? { x: 0, y: 0 };
      const localized = t(m.title);
      const title = localized && localized !== m.title ? localized : m.title;
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
        iconUrl: m.giver ? getMissionIconUrl(m.giver) : undefined,
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
      return {
        id: `e${i}`,
        source: String(e.from),
        target: String(e.to),
        type: "smoothstep",
        style: {
          stroke: "hsl(var(--primary))",
          strokeWidth: inChain ? 2.5 : 2,
          strokeDasharray: EDGE_DASH[e.type],
          opacity: chain && !inChain ? 0.15 : 0.9,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))", width: 20, height: 20 },
      };
    });

    return { rfNodes, rfEdges, levels, rowY };
  }, [missions, edges, availableNow, highlightId, t, chain, pinnedId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(rfEdges);
  const { fitView } = useReactFlow();
  useEffect(() => setNodes(rfNodes), [rfNodes, setNodes]);
  useEffect(() => setEdges(rfEdges), [rfEdges, setEdges]);

  // Re-fit the viewport whenever the visible mission set changes (filters, search, mode).
  // Use a small timeout so React Flow has committed the new node positions first.
  useEffect(() => {
    if (rfNodes.length === 0) return;
    const handle = setTimeout(() => {
      fitView({ padding: 0.18, maxZoom: 1, minZoom: 0.4, duration: 350 });
    }, 60);
    return () => clearTimeout(handle);
  }, [rfNodes, fitView]);

  const onNodeClick = useCallback<NodeMouseHandler>((_evt, node) => {
    const id = parseInt(node.id, 10);
    setPinnedId((cur) => (cur === id ? null : id));
  }, []);

  const onPaneClick = useCallback(() => setPinnedId(null), []);

  return (
    <div className="relative h-[calc(100vh-320px)] min-h-[500px] w-full rounded-lg border bg-card overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 border-r bg-background/40 backdrop-blur-sm">
        {levels.map((lvl) => (
          <div
            key={lvl}
            className="absolute left-0 right-0 -translate-y-1/2 text-center text-[10px] font-medium text-muted-foreground"
            style={{ top: (rowY.get(lvl) ?? 0) + NODE_H / 2 }}
          >
            Lv {lvl}
          </div>
        ))}
      </div>
      {pinnedId != null && (
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow">
          Showing chain · click background to clear
        </div>
      )}
      <div className="absolute inset-0 pl-12">
        <ReactFlow
          nodes={nodes}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 1, minZoom: 0.4 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <Controls />
          <MiniMap pannable zoomable className="!bg-card" />
        </ReactFlow>
      </div>
    </div>
  );
}
