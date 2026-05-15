import { useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import type { ParsedMission, MissionEdge, MissionPrereqEdgeType } from "@/lib/missions";
import { useLanguage } from "@/contexts/LanguageContext";

const NODE_W = 220;
const NODE_H = 64;
const ROW_H = 130; // vertical spacing per level band

interface MissionTreeProps {
  missions: ParsedMission[];
  edges: MissionEdge[];
  availableNow?: Set<number>;
  highlightId?: number;
}

const EDGE_STYLES: Record<MissionPrereqEdgeType, { strokeDasharray?: string; label: string }> = {
  "complete-all": { label: "requires complete" },
  "complete-any": { strokeDasharray: "6 4", label: "requires any of" },
  active: { strokeDasharray: "2 4", label: "requires active" },
  inactive: { strokeDasharray: "2 4", label: "requires inactive" },
  "not-started": { strokeDasharray: "1 4", label: "requires not started" },
};

function layout(missions: ParsedMission[], edges: MissionEdge[]) {
  // Group by level row; X positions assigned via dagre but Y pinned by level.
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 30, ranksep: 60, marginx: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const m of missions) g.setNode(String(m.id), { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(String(e.from), String(e.to));
  dagre.layout(g);

  // Determine row index per unique level (sorted ascending)
  const levels = Array.from(new Set(missions.map((m) => m.level))).sort((a, b) => a - b);
  const rowY = new Map(levels.map((lvl, i) => [lvl, i * ROW_H + 40]));

  const positions = new Map<number, { x: number; y: number }>();
  for (const m of missions) {
    const node = g.node(String(m.id));
    positions.set(m.id, { x: node?.x ?? 0, y: rowY.get(m.level) ?? 0 });
  }
  return { positions, levels, rowY };
}

export function MissionTree({ missions, edges, availableNow, highlightId }: MissionTreeProps) {
  const { t } = useLanguage();

  const { rfNodes, rfEdges, levels, rowY } = useMemo(() => {
    const { positions, levels, rowY } = layout(missions, edges);
    const rfNodes: Node[] = missions.map((m) => {
      const pos = positions.get(m.id) ?? { x: 0, y: 0 };
      const isAvailable = availableNow?.has(m.id);
      const isHighlight = highlightId === m.id;
      const titleText = (() => {
        const localized = t(m.title);
        return localized && localized !== m.title ? localized : m.title;
      })();
      return {
        id: String(m.id),
        position: pos,
        data: { 
          label: null,
          meta: { title: titleText, level: m.level, giver: m.giver, otherCount: m.otherPrereqCount, isAvailable, isHighlight, otherTypes: m.otherPrereqTypes, id: m.id }
        },
        type: "mission",
        style: {
          width: NODE_W,
          height: NODE_H,
          padding: 0,
          border: "none",
          background: "transparent",
        },
      };
    });

    const rfEdges: Edge[] = edges.map((e, i) => {
      const style = EDGE_STYLES[e.type];
      return {
        id: `e${i}`,
        source: String(e.from),
        target: String(e.to),
        type: "smoothstep",
        animated: false,
        style: {
          stroke: "hsl(var(--muted-foreground))",
          strokeWidth: 1.2,
          strokeDasharray: style.strokeDasharray,
          opacity: 0.6,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--muted-foreground))" },
      };
    });

    return { rfNodes, rfEdges, levels, rowY };
  }, [missions, edges, availableNow, highlightId, t]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  useEffect(() => setNodes(rfNodes), [rfNodes, setNodes]);
  useEffect(() => setEdges(rfEdges), [rfEdges, setEdges]);

  const nodeTypesMap = useMemo(
    () => ({
      mission: MissionNode as any,
    }),
    []
  );

  return (
    <div className="relative h-[calc(100vh-280px)] min-h-[500px] w-full rounded-lg border bg-card">
      {/* Level band labels (left gutter) */}
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
      <div className="absolute inset-0 pl-12">
        <ReactFlow
          nodes={nodes}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypesMap}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.1}
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

function MissionNode({ data }: { data: any }) {
  const meta = data?.meta ?? data;
  const isAvailable = meta.isAvailable;
  const isHighlight = meta.isHighlight;
  return (
    <div
      className={[
        "h-full w-full rounded-md border px-2 py-1.5 text-left shadow-sm transition-colors",
        "bg-card text-card-foreground",
        isAvailable ? "border-primary ring-1 ring-primary/40" : "border-border",
        isHighlight ? "ring-2 ring-accent" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="truncate text-[11px] font-semibold leading-tight" title={meta.title}>
          {meta.title}
        </div>
        <span className="shrink-0 rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground">
          Lv{meta.level}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <span className="truncate text-[9px] text-muted-foreground" title={meta.giver}>
          {meta.giver ?? "—"}
        </span>
        <span className="shrink-0 text-[9px] text-muted-foreground/70">#{meta.id}</span>
      </div>
      {meta.otherCount > 0 && (
        <div
          className="mt-0.5 truncate text-[9px] text-amber-600 dark:text-amber-400"
          title={meta.otherTypes?.join(", ")}
        >
          +{meta.otherCount} req
        </div>
      )}
    </div>
  );
}
