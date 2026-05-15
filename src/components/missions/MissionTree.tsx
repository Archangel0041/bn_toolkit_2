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
const ROW_H = 130;

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

function layout(missions: ParsedMission[], edges: MissionEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 30, ranksep: 60, marginx: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const m of missions) g.setNode(String(m.id), { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(String(e.from), String(e.to));
  dagre.layout(g);

  const levels = Array.from(new Set(missions.map((m) => m.displayLevel))).sort((a, b) => a - b);
  const rowY = new Map(levels.map((lvl, i) => [lvl, i * ROW_H + 40]));

  const positions = new Map<number, { x: number; y: number }>();
  for (const m of missions) {
    const node = g.node(String(m.id));
    positions.set(m.id, { x: node?.x ?? 0, y: rowY.get(m.displayLevel) ?? 0 });
  }
  return { positions, levels, rowY };
}

interface MissionNodeData extends Record<string, unknown> {
  title: string;
  level: number;
  giver?: string;
  otherCount: number;
  otherTypes: string[];
  isAvailable?: boolean;
  isHighlight?: boolean;
  missionId: number;
}

function MissionNode({ data }: { data: MissionNodeData }) {
  return (
    <div
      className={[
        "h-full w-full rounded-md border px-2 py-1.5 text-left shadow-sm transition-colors bg-card text-card-foreground",
        data.isAvailable ? "border-primary ring-1 ring-primary/40" : "border-border",
        data.isHighlight ? "ring-2 ring-accent" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="truncate text-[11px] font-semibold leading-tight" title={data.title}>
          {data.title}
        </div>
        <span className="shrink-0 rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground">
          Lv{data.level}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <span className="truncate text-[9px] text-muted-foreground" title={data.giver}>
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
  );
}

const nodeTypes = { mission: MissionNode };

export function MissionTree({ missions, edges, availableNow, highlightId }: MissionTreeProps) {
  const { t } = useLanguage();

  const { rfNodes, rfEdges, levels, rowY } = useMemo(() => {
    const { positions, levels, rowY } = layout(missions, edges);
    const rfNodes: Node[] = missions.map((m) => {
      const pos = positions.get(m.id) ?? { x: 0, y: 0 };
      const localized = t(m.title);
      const title = localized && localized !== m.title ? localized : m.title;
      const data: MissionNodeData = {
        title,
        level: m.displayLevel,
        giver: m.giver,
        otherCount: m.otherPrereqCount,
        otherTypes: m.otherPrereqTypes,
        isAvailable: availableNow?.has(m.id),
        isHighlight: highlightId === m.id,
        missionId: m.id,
      };
      return {
        id: String(m.id),
        position: pos,
        data,
        type: "mission",
        style: { width: NODE_W, height: NODE_H, padding: 0, border: "none", background: "transparent" },
      };
    });

    const rfEdges: Edge[] = edges.map((e, i) => ({
      id: `e${i}`,
      source: String(e.from),
      target: String(e.to),
      type: "smoothstep",
      style: {
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
        strokeDasharray: EDGE_DASH[e.type],
        opacity: 0.85,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))", width: 18, height: 18 },
    }));

    return { rfNodes, rfEdges, levels, rowY };
  }, [missions, edges, availableNow, highlightId, t]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(rfEdges);
  useEffect(() => setNodes(rfNodes), [rfNodes, setNodes]);
  useEffect(() => setEdges(rfEdges), [rfEdges, setEdges]);

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
      <div className="absolute inset-0 pl-12">
        <ReactFlow
          nodes={nodes}
          edges={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1, minZoom: 0.5 }}
          minZoom={0.4}
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
