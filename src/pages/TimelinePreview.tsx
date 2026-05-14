import { useEffect, useRef, useState } from "react";
import { decode } from "@msgpack/msgpack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type AnyObj = Record<string, any>;

// Walk decoded msgpack and extract per-frame data heuristically.
// Expected shapes (we try several):
//  - { frames: [{ transform, polys, alpha }] }
//  - { transform: [...], polys: [...], alpha: [...] } (parallel arrays per frame)
//  - top-level array of frame objects
function normalizeTimeline(raw: any): { frames: AnyObj[]; raw: any } {
  if (!raw) return { frames: [], raw };
  if (Array.isArray(raw)) {
    if (raw.length && typeof raw[0] === "object") return { frames: raw as AnyObj[], raw };
  }
  if (typeof raw === "object") {
    if (Array.isArray(raw.frames)) return { frames: raw.frames, raw };
    const t = raw.transform ?? raw.transforms;
    const p = raw.polys ?? raw.poly ?? raw.polygons;
    const a = raw.alpha ?? raw.alphas;
    if (Array.isArray(t) || Array.isArray(p) || Array.isArray(a)) {
      const len = Math.max(
        Array.isArray(t) ? t.length : 0,
        Array.isArray(p) ? p.length : 0,
        Array.isArray(a) ? a.length : 0,
      );
      const frames: AnyObj[] = [];
      for (let i = 0; i < len; i++) {
        frames.push({
          transform: Array.isArray(t) ? t[i] : undefined,
          polys: Array.isArray(p) ? p[i] : undefined,
          alpha: Array.isArray(a) ? a[i] : undefined,
        });
      }
      return { frames, raw };
    }
  }
  return { frames: [raw], raw };
}

// Apply a 2D transform (try a few common encodings) onto a CanvasRenderingContext2D
function applyTransform(ctx: CanvasRenderingContext2D, t: any) {
  if (!t) return;
  if (Array.isArray(t)) {
    if (t.length === 6) {
      // [a, b, c, d, e, f]
      ctx.transform(t[0], t[1], t[2], t[3], t[4], t[5]);
      return;
    }
    if (t.length === 9) {
      // 3x3 matrix row-major
      ctx.transform(t[0], t[3], t[1], t[4], t[2], t[5]);
      return;
    }
  }
  if (typeof t === "object") {
    const a = t.a ?? t.m11 ?? t.scaleX ?? 1;
    const b = t.b ?? t.m12 ?? 0;
    const c = t.c ?? t.m21 ?? 0;
    const d = t.d ?? t.m22 ?? t.scaleY ?? 1;
    const e = t.e ?? t.tx ?? t.x ?? 0;
    const f = t.f ?? t.ty ?? t.y ?? 0;
    ctx.transform(a, b, c, d, e, f);
    if (typeof t.rotation === "number") ctx.rotate(t.rotation);
  }
}

// Extract polygons. Each poly = list of vertices with x,y,u,v
function extractPolys(p: any): Array<Array<{ x: number; y: number; u: number; v: number }>> {
  if (!p) return [];
  const arr = Array.isArray(p) ? p : [p];
  const out: Array<Array<{ x: number; y: number; u: number; v: number }>> = [];
  for (const poly of arr) {
    if (!poly) continue;
    // Form A: { verts: [[x,y,u,v], ...] } or { vertices: [...] }
    const verts = poly.verts ?? poly.vertices ?? poly.points ?? poly;
    if (Array.isArray(verts) && verts.length) {
      const first = verts[0];
      let pts: Array<{ x: number; y: number; u: number; v: number }> = [];
      if (Array.isArray(first)) {
        pts = verts.map((v: any) => ({ x: v[0], y: v[1], u: v[2] ?? 0, v: v[3] ?? 0 }));
      } else if (typeof first === "object") {
        pts = verts.map((v: any) => ({
          x: v.x ?? v[0] ?? 0,
          y: v.y ?? v[1] ?? 0,
          u: v.u ?? v.s ?? 0,
          v: v.v ?? v.t ?? 0,
        }));
      } else if (typeof first === "number") {
        // Flat: [x,y,u,v, x,y,u,v, ...]
        for (let i = 0; i < verts.length; i += 4) {
          pts.push({ x: verts[i], y: verts[i + 1], u: verts[i + 2] ?? 0, v: verts[i + 3] ?? 0 });
        }
      }
      if (pts.length >= 3) out.push(pts);
    }
  }
  return out;
}

// Texture-mapped triangle render via affine approximation
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  p0: { x: number; y: number; u: number; v: number },
  p1: { x: number; y: number; u: number; v: number },
  p2: { x: number; y: number; u: number; v: number },
) {
  const tw = img.width;
  const th = img.height;
  const u0 = p0.u * tw, v0 = p0.v * th;
  const u1 = p1.u * tw, v1 = p1.v * th;
  const u2 = p2.u * tw, v2 = p2.v * th;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.clip();

  const denom = u0 * (v1 - v2) - v0 * (u1 - u2) + u1 * v2 - v1 * u2;
  if (denom === 0) {
    ctx.restore();
    return;
  }
  const a = (p0.x * (v1 - v2) - v0 * (p1.x - p2.x) + v1 * p2.x - v2 * p1.x) / denom;
  const b = (u0 * (p1.x - p2.x) - p0.x * (u1 - u2) + u1 * p2.x - u2 * p1.x) / denom;
  const c = (u0 * (v1 * p2.x - v2 * p1.x) - v0 * (u1 * p2.x - u2 * p1.x) + p0.x * (u1 * v2 - u2 * v1)) / denom;
  const d = (p0.y * (v1 - v2) - v0 * (p1.y - p2.y) + v1 * p2.y - v2 * p1.y) / denom;
  const e = (u0 * (p1.y - p2.y) - p0.y * (u1 - u2) + u1 * p2.y - u2 * p1.y) / denom;
  const f = (u0 * (v1 * p2.y - v2 * p1.y) - v0 * (u1 * p2.y - u2 * p1.y) + p0.y * (u1 * v2 - u2 * v1)) / denom;

  ctx.transform(a, d, b, e, c, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function drawPoly(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  poly: Array<{ x: number; y: number; u: number; v: number }>,
  showWire: boolean,
) {
  if (img && poly.every((p) => p.u !== 0 || p.v !== 0 || true)) {
    // triangle fan from first vertex
    for (let i = 1; i < poly.length - 1; i++) {
      drawTexturedTriangle(ctx, img, poly[0], poly[i], poly[i + 1]);
    }
  }
  if (showWire) {
    ctx.strokeStyle = "rgba(0,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
  }
}

export default function TimelinePreview() {
  const [texture, setTexture] = useState<HTMLImageElement | null>(null);
  const [timeline, setTimeline] = useState<{ frames: AnyObj[]; raw: any } | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(30);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 400, y: 300 });
  const [showWire, setShowWire] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();

  const handleTexture = (file: File) => {
    const img = new Image();
    img.onload = () => setTexture(img);
    img.onerror = () => setError("Failed to load texture");
    img.src = URL.createObjectURL(file);
  };

  const handleTimeline = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const decoded = decode(new Uint8Array(buf));
      console.log("[timeline] decoded:", decoded);
      const norm = normalizeTimeline(decoded);
      console.log("[timeline] normalized frames:", norm.frames.length, norm.frames[0]);
      setTimeline(norm);
      setFrameIdx(0);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(`Failed to decode timeline: ${e.message}`);
    }
  };

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!timeline || !timeline.frames.length) return;
    const frame = timeline.frames[frameIdx];
    if (!frame) return;

    const alpha = typeof frame.alpha === "number" ? frame.alpha : Array.isArray(frame.alpha) ? frame.alpha[0] : 1;

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha ?? 1));
    applyTransform(ctx, frame.transform);

    const polys = extractPolys(frame.polys);
    for (const poly of polys) drawPoly(ctx, texture, poly, showWire);

    ctx.restore();

    // overlay info
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "12px monospace";
    ctx.fillText(
      `frame ${frameIdx + 1}/${timeline.frames.length}  polys=${polys.length}  alpha=${alpha}`,
      10,
      20,
    );
  }, [timeline, frameIdx, texture, zoom, offset, showWire]);

  // Playback
  useEffect(() => {
    if (!playing || !timeline) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      if (dt >= 1000 / fps) {
        last = now;
        setFrameIdx((i) => (i + 1) % timeline.frames.length);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, fps, timeline]);

  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      const name = f.name.toLowerCase();
      if (f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/.test(name)) {
        handleTexture(f);
      } else {
        handleTimeline(f);
      }
    }
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground p-6 space-y-4"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
      }}
    >
      <h1 className="text-2xl font-bold">Timeline Preview (temp)</h1>
      <p className="text-sm text-muted-foreground">
        Drag &amp; drop a texture image and a msgpack timeline anywhere on the page, or use the pickers below.
      </p>

      <div
        className={`border-2 border-dashed rounded-md p-6 text-center text-sm transition-colors ${
          dragOver ? "border-primary bg-primary/10" : "border-border text-muted-foreground"
        }`}
      >
        {dragOver ? "Drop files to load" : "Drop texture (image) + timeline (.bytes) here"}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <div className="space-y-2">
          <Label>Texture (PNG/JPG)</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleTexture(e.target.files[0])}
          />
        </div>
        <div className="space-y-2">
          <Label>Timeline (.bytes / .msgpack / .bin)</Label>
          <Input
            type="file"
            accept=".bytes,.msgpack,.bin,.mp,application/octet-stream"
            onChange={(e) => e.target.files?.[0] && handleTimeline(e.target.files[0])}
          />
        </div>
      </div>

      {error && <div className="text-destructive text-sm">{error}</div>}

      {timeline && (
        <div className="space-y-3 max-w-3xl">
          <div className="flex items-center gap-2">
            <Button onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</Button>
            <Button variant="outline" onClick={() => setFrameIdx(0)}>Reset</Button>
            <Button variant="outline" onClick={() => setShowWire((w) => !w)}>
              {showWire ? "Hide" : "Show"} wireframe
            </Button>
            <span className="text-sm">FPS:</span>
            <Input
              type="number"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value) || 1)}
              className="w-20"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Frame {frameIdx + 1} / {timeline.frames.length}</Label>
            <Slider
              value={[frameIdx]}
              min={0}
              max={Math.max(0, timeline.frames.length - 1)}
              step={1}
              onValueChange={(v) => setFrameIdx(v[0])}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Zoom</Label>
              <Slider value={[zoom]} min={0.1} max={4} step={0.05} onValueChange={(v) => setZoom(v[0])} />
            </div>
            <div>
              <Label className="text-xs">Offset X</Label>
              <Slider value={[offset.x]} min={0} max={800} step={1} onValueChange={(v) => setOffset((o) => ({ ...o, x: v[0] }))} />
            </div>
            <div>
              <Label className="text-xs">Offset Y</Label>
              <Slider value={[offset.y]} min={0} max={600} step={1} onValueChange={(v) => setOffset((o) => ({ ...o, y: v[0] }))} />
            </div>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border border-border rounded-md bg-black"
      />

      {timeline && (
        <details className="max-w-3xl">
          <summary className="cursor-pointer text-sm text-muted-foreground">Inspect first frame JSON</summary>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(timeline.frames[frameIdx], (_k, v) => (v instanceof Uint8Array ? `<bytes:${v.length}>` : v), 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
