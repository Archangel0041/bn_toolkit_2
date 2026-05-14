import { useEffect, useMemo, useRef, useState } from "react";
import { decode } from "@msgpack/msgpack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ----------------------------------------------------------------------------
// Schema (matches the reference renderer)
// ----------------------------------------------------------------------------
const NORM = 32767;

type Transform = { m00: number; m01: number; m02: number; m10: number; m11: number; m12: number };
type Poly = { xpoints: number[]; ypoints: number[] };
type Frame = { transforms: Transform[]; polys: Poly[]; alpha: any[] };
type Timelines = Record<string, Frame[]>;
type BBox = { gx0: number; gy0: number; gx1: number; gy1: number };

function normTransform(t: any): Transform {
  if (Array.isArray(t)) return { m00: t[0], m01: t[1], m02: t[2], m10: t[3], m11: t[4], m12: t[5] };
  return t;
}
function normPoly(p: any): Poly {
  if (Array.isArray(p)) return { xpoints: p[0], ypoints: p[1] };
  return p;
}

function normalizeTimeline(raw: any, fallbackName: string): Timelines {
  if (raw && typeof raw === "object" && Array.isArray((raw as any).frames)) {
    raw = { [fallbackName || "animation"]: raw };
  }
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Top-level timeline must be an object");
  }
  const out: Timelines = {};
  for (const name of Object.keys(raw)) {
    const val = (raw as any)[name];
    let frames: any[];
    if (val && typeof val === "object" && Array.isArray(val.frames)) frames = val.frames;
    else if (Array.isArray(val) && val.length >= 1 && Array.isArray(val[0])) frames = val[0];
    else if (Array.isArray(val)) frames = val;
    else throw new Error(`Animation '${name}': unrecognized value shape`);

    out[name] = frames.map((fr: any, idx: number): Frame => {
      if (Array.isArray(fr)) {
        if (fr.length < 2) throw new Error(`Frame ${idx}: expected [transforms, polys, ...]`);
        return {
          transforms: fr[0].map(normTransform),
          polys: fr[1].map(normPoly),
          alpha: fr[2] || [],
        };
      }
      if (fr && typeof fr === "object") {
        return {
          transforms: (fr.transforms || []).map(normTransform),
          polys: (fr.polys || []).map(normPoly),
          alpha: fr.alpha || [],
        };
      }
      throw new Error(`Frame ${idx}: unrecognized type`);
    });
  }
  return out;
}

function partAlpha(alphaList: any[] | undefined, i: number): number {
  if (!alphaList || i >= alphaList.length) return 1.0;
  const a = alphaList[i];
  return Array.isArray(a) ? +a[0] : +a;
}

// ----------------------------------------------------------------------------
// BBox + render
// ----------------------------------------------------------------------------
function computeBbox(frames: Frame[]): BBox {
  let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
  for (const fr of frames) {
    for (let i = 0; i < fr.transforms.length; i++) {
      if (partAlpha(fr.alpha, i) <= 0) continue;
      const t = fr.transforms[i];
      const p = fr.polys[i];
      const xs = p.xpoints, ys = p.ypoints;
      let nxLo = xs[0], nxHi = xs[0], nyLo = ys[0], nyHi = ys[0];
      for (let j = 1; j < xs.length; j++) {
        if (xs[j] < nxLo) nxLo = xs[j];
        if (xs[j] > nxHi) nxHi = xs[j];
        if (ys[j] < nyLo) nyLo = ys[j];
        if (ys[j] > nyHi) nyHi = ys[j];
      }
      for (const x of [nxLo, nxHi]) {
        for (const y of [nyLo, nyHi]) {
          const cx = t.m00 * x + t.m01 * y + t.m02;
          const cy = t.m10 * x + t.m11 * y + t.m12;
          if (cx < gx0) gx0 = cx;
          if (cy < gy0) gy0 = cy;
          if (cx > gx1) gx1 = cx;
          if (cy > gy1) gy1 = cy;
        }
      }
    }
  }
  if (!isFinite(gx0)) return { gx0: 0, gy0: 0, gx1: 1, gy1: 1 };
  return { gx0, gy0, gx1, gy1 };
}

function canvasSize(bbox: BBox, ppu: number, pad: number) {
  const w = Math.max(1, Math.ceil((bbox.gx1 - bbox.gx0) * ppu) + 2 * pad);
  const h = Math.max(1, Math.ceil((bbox.gy1 - bbox.gy0) * ppu) + 2 * pad);
  return { w, h };
}

function renderFrameToCtx(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  atlas: HTMLImageElement,
  bbox: BBox,
  ppu: number,
  pad: number,
  smooth: boolean,
) {
  ctx.imageSmoothingEnabled = smooth;
  if (smooth) ctx.imageSmoothingQuality = "high";
  const aw = atlas.naturalWidth, ah = atlas.naturalHeight;

  for (let i = 0; i < frame.transforms.length; i++) {
    const partA = partAlpha(frame.alpha, i);
    if (partA <= 0) continue;
    const t = frame.transforms[i];
    const p = frame.polys[i];
    if (!t || !p) continue;
    const xs = p.xpoints, ys = p.ypoints;
    if (!xs?.length || !ys?.length) continue;
    let nx0 = xs[0], nx1 = xs[0], ny0 = ys[0], ny1 = ys[0];
    for (let j = 1; j < xs.length; j++) {
      if (xs[j] < nx0) nx0 = xs[j];
      if (xs[j] > nx1) nx1 = xs[j];
      if (ys[j] < ny0) ny0 = ys[j];
      if (ys[j] > ny1) ny1 = ys[j];
    }
    if (nx1 === nx0 || ny1 === ny0) continue;

    const sx = Math.max(0, (nx0 / NORM) * aw);
    const sy = Math.max(0, (ny0 / NORM) * ah);
    const sw = Math.min(aw - sx, ((nx1 - nx0) / NORM) * aw);
    const sh = Math.min(ah - sy, ((ny1 - ny0) / NORM) * ah);
    if (sw <= 0 || sh <= 0) continue;

    const a = ppu * t.m00, b = ppu * t.m10;
    const c = ppu * t.m01, d = ppu * t.m11;
    const e = ppu * (t.m02 - bbox.gx0) + pad;
    const f = ppu * (t.m12 - bbox.gy0) + pad;
    ctx.setTransform(a, b, c, d, e, f);
    ctx.globalAlpha = partA;
    ctx.drawImage(atlas, sx, sy, sw, sh, nx0, ny0, nx1 - nx0, ny1 - ny0);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// Two-pass alpha-bbox tighten (mirrors the reference)
function tightenBbox(
  frames: Frame[],
  atlas: HTMLImageElement,
  bbox: BBox,
  ppu: number,
  pad: number,
): BBox {
  const { w, h } = canvasSize(bbox, ppu, pad);
  if (w <= 0 || h <= 0 || !frames.length) return bbox;
  const scratch = document.createElement("canvas");
  scratch.width = w; scratch.height = h;
  const ctx = scratch.getContext("2d", { willReadFrequently: true })!;

  let ux0 = w, uy0 = h, ux1 = -1, uy1 = -1;
  for (const fr of frames) {
    ctx.clearRect(0, 0, w, h);
    renderFrameToCtx(ctx, fr, atlas, bbox, ppu, pad, true);
    const data = ctx.getImageData(0, 0, w, h).data;
    let y0 = -1;
    outerTop: for (let y = 0; y < h; y++) {
      const row = y * w * 4 + 3;
      for (let x = 0; x < w; x++) {
        if (data[row + x * 4] !== 0) { y0 = y; break outerTop; }
      }
    }
    if (y0 < 0) continue;
    let y1 = h - 1;
    outerBot: for (let y = h - 1; y >= y0; y--) {
      const row = y * w * 4 + 3;
      for (let x = 0; x < w; x++) {
        if (data[row + x * 4] !== 0) { y1 = y; break outerBot; }
      }
    }
    let x0 = w - 1, x1 = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * w * 4 + 3;
      for (let x = 0; x < x0; x++) {
        if (data[row + x * 4] !== 0) { x0 = x; break; }
      }
      for (let x = w - 1; x > x1; x--) {
        if (data[row + x * 4] !== 0) { x1 = x; break; }
      }
    }
    if (x0 < ux0) ux0 = x0;
    if (y0 < uy0) uy0 = y0;
    if (x1 > ux1) ux1 = x1;
    if (y1 > uy1) uy1 = y1;
  }
  if (ux1 < 0) return bbox;
  const margin = Math.max(1, pad);
  ux0 = Math.max(0, ux0 - margin);
  uy0 = Math.max(0, uy0 - margin);
  ux1 = Math.min(w - 1, ux1 + margin);
  uy1 = Math.min(h - 1, uy1 + margin);
  return {
    gx0: (ux0 - pad) / ppu + bbox.gx0,
    gy0: (uy0 - pad) / ppu + bbox.gy0,
    gx1: (ux1 + 1 - pad) / ppu + bbox.gx0,
    gy1: (uy1 + 1 - pad) / ppu + bbox.gy0,
  };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
const PAD = 4;

export default function TimelinePreview() {
  const [atlas, setAtlas] = useState<HTMLImageElement | null>(null);
  const [atlasName, setAtlasName] = useState<string>("");
  const [timelines, setTimelines] = useState<Timelines | null>(null);
  const [timelineName, setTimelineName] = useState<string>("");
  const [animName, setAnimName] = useState<string>("");
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(30);
  const [ppu, setPpu] = useState(2);
  const [smooth, setSmooth] = useState(false);
  const [bgMode, setBgMode] = useState<"transparent" | "white" | "black">("transparent");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();

  const frames: Frame[] | null = animName && timelines ? timelines[animName] : null;

  // Re-derive bbox when frames/atlas/ppu change
  const bbox: BBox | null = useMemo(() => {
    if (!frames) return null;
    const conservative = computeBbox(frames);
    return atlas ? tightenBbox(frames, atlas, conservative, ppu, PAD) : conservative;
  }, [frames, atlas, ppu]);

  // Keep frame index in range
  useEffect(() => {
    if (!frames) return;
    if (frameIdx >= frames.length) setFrameIdx(0);
  }, [frames, frameIdx]);

  // Auto-pick first animation when timeline loads
  useEffect(() => {
    if (timelines && !animName) {
      const names = Object.keys(timelines);
      if (names.length) setAnimName(names[0]);
    }
  }, [timelines, animName]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frames || !atlas || !bbox) return;
    const { w, h } = canvasSize(bbox, ppu, PAD);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (bgMode !== "transparent") {
      ctx.fillStyle = bgMode === "white" ? "#ffffff" : "#000000";
      ctx.fillRect(0, 0, w, h);
    }
    const fr = frames[frameIdx] || frames[0];
    // After dpr setTransform, we need to stack. Easier: scale incoming render coords.
    // The reference renders at logical px and uses dpr only for backing-store sharpness.
    // Translate that here: do a fresh render, then set dpr scaling on a child transform via save/restore.
    ctx.save();
    ctx.scale(dpr, dpr); // wait – setTransform already had dpr; renderFrameToCtx uses setTransform again.
    ctx.restore();
    // Simplest correct approach: render at 1:1, then upscale by dpr by drawing through an offscreen.
    // To avoid double-cost, just render directly at backing-store resolution by multiplying ppu... but bbox depends on ppu.
    // Cleanest: render to offscreen at css size, then drawImage scaled.
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const octx = off.getContext("2d")!;
    if (bgMode !== "transparent") {
      octx.fillStyle = bgMode === "white" ? "#ffffff" : "#000000";
      octx.fillRect(0, 0, w, h);
    }
    renderFrameToCtx(octx, fr, atlas, bbox, ppu, PAD, smooth);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = smooth;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }, [frames, atlas, bbox, ppu, frameIdx, smooth, bgMode]);

  // Playback
  useEffect(() => {
    if (!playing || !frames || frames.length < 2) return;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      acc += dt;
      const period = 1 / fps;
      let advanced = false;
      while (acc >= period) {
        setFrameIdx((i) => (i + 1) % frames.length);
        acc -= period;
        advanced = true;
      }
      void advanced;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, fps, frames]);

  // ------------------------------------------------------------ file ingest
  const ingestImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Prefer larger (untrimmed) atlas if same stem
      const stem = (n: string) => n.replace(/_#\d+\.png$/i, "").replace(/\.png$/i, "");
      if (atlas && stem(atlasName) === stem(file.name)) {
        const prev = atlas.naturalWidth * atlas.naturalHeight;
        const next = img.naturalWidth * img.naturalHeight;
        if (next <= prev) return;
      }
      setAtlas(img);
      setAtlasName(file.name);
    };
    img.onerror = () => setError("Failed to load texture");
    img.src = url;
  };

  const ingestTimeline = async (file: File) => {
    try {
      const lower = file.name.toLowerCase();
      let raw: any;
      const buf = await file.arrayBuffer();
      if (lower.endsWith(".json")) {
        raw = JSON.parse(new TextDecoder().decode(buf));
      } else if (lower.endsWith(".bytes") || lower.endsWith(".msgpack") || lower.endsWith(".bin")) {
        raw = decode(new Uint8Array(buf));
      } else {
        // sniff
        const u8 = new Uint8Array(buf);
        let i = 0;
        while (i < u8.length && (u8[i] === 0x20 || u8[i] === 0x09 || u8[i] === 0x0a || u8[i] === 0x0d)) i++;
        if (u8[i] === 0x7b || u8[i] === 0x5b) raw = JSON.parse(new TextDecoder().decode(u8));
        else raw = decode(u8);
      }
      console.log("[timeline] decoded:", raw);
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const norm = normalizeTimeline(raw, baseName);
      console.log("[timeline] anims:", Object.keys(norm));
      setTimelines(norm);
      setTimelineName(file.name);
      setAnimName(""); // trigger auto-pick
      setFrameIdx(0);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(`Failed to decode timeline: ${e.message}`);
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      const lower = f.name.toLowerCase();
      if (f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/.test(lower)) ingestImage(f);
      else ingestTimeline(f);
    }
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${animName || "frame"}_${String(frameIdx).padStart(3, "0")}.png`;
    a.click();
  };

  const [gifProgress, setGifProgress] = useState<number | null>(null);
  const [gifTransparent, setGifTransparent] = useState(true);

  const loadGifJs = async (): Promise<any> => {
    if ((window as any).GIF) return (window as any).GIF;
    await new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js";
      s.onload = () => res();
      s.onerror = () => rej(new Error("Failed to load gif.js"));
      document.head.appendChild(s);
    });
    return (window as any).GIF;
  };

  const exportGif = async () => {
    if (!frames || !atlas || !bbox) return;
    try {
      setGifProgress(0);
      const GIF = await loadGifJs();
      const { w, h } = canvasSize(bbox, ppu, PAD);

      // GIF can't store true alpha — use a sentinel color (magenta) marked transparent.
      // Any pixel with alpha < 128 becomes magenta; opaque pixels render as-is.
      const SENTINEL = { r: 255, g: 0, b: 255 };
      const sentinelHex = 0xff00ff;

      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: w,
        height: h,
        workerScript: "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js",
        transparent: gifTransparent && bgMode === "transparent" ? sentinelHex : null,
      });

      const off = document.createElement("canvas");
      off.width = w; off.height = h;
      const octx = off.getContext("2d")!;
      const delay = Math.max(20, Math.round(1000 / fps));

      for (let i = 0; i < frames.length; i++) {
        octx.clearRect(0, 0, w, h);
        if (bgMode === "white") { octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, w, h); }
        else if (bgMode === "black") { octx.fillStyle = "#000000"; octx.fillRect(0, 0, w, h); }
        renderFrameToCtx(octx, frames[i], atlas, bbox, ppu, PAD, smooth);

        if (gifTransparent && bgMode === "transparent") {
          const img = octx.getImageData(0, 0, w, h);
          const d = img.data;
          for (let p = 0; p < d.length; p += 4) {
            if (d[p + 3] < 128) {
              d[p] = SENTINEL.r; d[p + 1] = SENTINEL.g; d[p + 2] = SENTINEL.b; d[p + 3] = 255;
            } else {
              d[p + 3] = 255;
            }
          }
          octx.putImageData(img, 0, 0);
        }

        gif.addFrame(octx, { copy: true, delay });
      }

      gif.on("progress", (p: number) => setGifProgress(p));
      gif.on("finished", (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${animName || "animation"}.gif`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setGifProgress(null);
      });
      gif.render();
    } catch (e: any) {
      console.error(e);
      setError(`GIF export failed: ${e.message}`);
      setGifProgress(null);
    }
  };


  const animNames = timelines ? Object.keys(timelines) : [];
  const totalFrames = frames?.length ?? 0;

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
      <h1 className="text-2xl font-bold">Sprite Timeline Preview</h1>
      <p className="text-sm text-muted-foreground">
        Drag &amp; drop a texture atlas (.png) and a timeline (.bytes / .json) anywhere on the page.
      </p>

      <div
        className={`border-2 border-dashed rounded-md p-6 text-center text-sm transition-colors ${
          dragOver ? "border-primary bg-primary/10" : "border-border text-muted-foreground"
        }`}
      >
        {dragOver ? "Drop files to load" : "Drop atlas + timeline here (or use the pickers below)"}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <div className="space-y-2">
          <Label>Texture atlas</Label>
          <Input
            type="file"
            accept="image/*,.png"
            onChange={(e) => e.target.files?.[0] && ingestImage(e.target.files[0])}
          />
          {atlasName && (
            <p className="text-xs text-muted-foreground truncate">
              {atlasName} ({atlas?.naturalWidth}×{atlas?.naturalHeight})
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Timeline</Label>
          <Input
            type="file"
            accept=".bytes,.msgpack,.bin,.json,application/octet-stream"
            onChange={(e) => e.target.files?.[0] && ingestTimeline(e.target.files[0])}
          />
          {timelineName && (
            <p className="text-xs text-muted-foreground truncate">
              {timelineName} — {animNames.length} animation{animNames.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>

      {error && <div className="text-destructive text-sm">{error}</div>}

      {animNames.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 max-w-3xl">
          <div className="space-y-1 min-w-[220px]">
            <Label className="text-xs">Animation</Label>
            <Select
              value={animName}
              onValueChange={(v) => {
                setPlaying(false);
                setFrameIdx(0);
                setAnimName(v);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {animNames.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setPlaying((p) => !p)} disabled={totalFrames < 2}>
            {playing ? "Pause" : "Play"}
          </Button>
          <Button variant="outline" onClick={() => { setPlaying(false); setFrameIdx(0); }}>Reset</Button>
          <Button variant="outline" onClick={exportPng} disabled={!atlas || !frames}>Export frame PNG</Button>
        </div>
      )}

      {frames && (
        <div className="space-y-3 max-w-3xl">
          <div className="space-y-1">
            <Label className="text-xs">
              Frame {frameIdx + 1} / {totalFrames}
              {frames[frameIdx] && (
                <> · {frames[frameIdx].transforms.length} parts</>
              )}
            </Label>
            <Slider
              value={[frameIdx]}
              min={0}
              max={Math.max(0, totalFrames - 1)}
              step={1}
              onValueChange={(v) => { setPlaying(false); setFrameIdx(v[0]); }}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">FPS: {fps}</Label>
              <Slider value={[fps]} min={1} max={60} step={1} onValueChange={(v) => setFps(v[0])} />
            </div>
            <div>
              <Label className="text-xs">Scale: {ppu}×</Label>
              <Slider value={[ppu]} min={1} max={8} step={1} onValueChange={(v) => setPpu(v[0])} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Smoothing</Label>
              <div className="flex gap-1">
                <Button size="sm" variant={smooth ? "default" : "outline"} onClick={() => setSmooth(true)}>Smooth</Button>
                <Button size="sm" variant={!smooth ? "default" : "outline"} onClick={() => setSmooth(false)}>Pixel</Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Background</Label>
              <div className="flex gap-1">
                <Button size="sm" variant={bgMode === "transparent" ? "default" : "outline"} onClick={() => setBgMode("transparent")}>None</Button>
                <Button size="sm" variant={bgMode === "white" ? "default" : "outline"} onClick={() => setBgMode("white")}>W</Button>
                <Button size="sm" variant={bgMode === "black" ? "default" : "outline"} onClick={() => setBgMode("black")}>B</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="inline-block rounded-md border border-border p-2"
        style={{
          background:
            bgMode === "transparent"
              ? "repeating-conic-gradient(#1a1510 0% 25%, #221c14 0% 50%) 50% / 16px 16px"
              : undefined,
        }}
      >
        <canvas
          ref={canvasRef}
          className="block"
          style={{ imageRendering: smooth ? "auto" : "pixelated" }}
        />
      </div>
    </div>
  );
}
