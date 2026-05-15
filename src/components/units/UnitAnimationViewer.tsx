import { useEffect, useMemo, useRef, useState } from "react";
import { decode } from "@msgpack/msgpack";
import { supabase } from "@/integrations/supabase/client";
import { loadAnimationFileMap } from "@/lib/dataLoader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import {
  normalizeTimeline, computeBbox, tightenBbox, canvasSize, renderFrameToCtx,
  type Frame, type Timelines, type BBox,
} from "@/lib/timelineRenderer";

const PAD = 4;
const ANIMATIONS_BUCKET = "Animations";
const TARGET_PX = 140;

interface Props {
  /** The unit's icon name (e.g. "artillery_icon"). The trailing "_icon" is stripped to derive the asset stem. */
  iconName: string;
  /** Optional map of raw animation name → human-friendly label (e.g. "Rifle attack — Aimed Shot"). */
  labelMap?: Record<string, string>;
  /** Optional ordered groups (e.g. Idle, per-weapon attacks). Names not present go into "Other". */
  groups?: Array<{ title: string; names: string[] }>;
  /** When set, only show animations matching these names. */
  filterNames?: string[];
  /** Compact mode: hides count + export-all button. */
  compact?: boolean;
}

// Module-level cache so multiple viewers for the same unit share a single fetch.
const assetCache = new Map<string, Promise<{ atlas: HTMLImageElement; timelines: Timelines }>>();

function loadAssets(stem: string): Promise<{ atlas: HTMLImageElement; timelines: Timelines }> {
  const cached = assetCache.get(stem);
  if (cached) return cached;
  const texUrl = supabase.storage
    .from(ANIMATIONS_BUCKET)
    .getPublicUrl(`textures/${stem}_texture.png`).data.publicUrl;
  const timelineUrl = supabase.storage
    .from(ANIMATIONS_BUCKET)
    .getPublicUrl(`timelines/${stem}_timeline.bytes`).data.publicUrl;
  const imgPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("texture not found"));
    img.src = texUrl;
  });
  const tlPromise = (async () => {
    const res = await fetch(timelineUrl);
    if (!res.ok) throw new Error("timeline not found");
    const buf = new Uint8Array(await res.arrayBuffer());
    const raw = decode(buf);
    return normalizeTimeline(raw, stem);
  })();
  const p = Promise.all([imgPromise, tlPromise]).then(([atlas, timelines]) => ({ atlas, timelines }));
  // Don't cache failures — let next viewer retry.
  p.catch(() => assetCache.delete(stem));
  assetCache.set(stem, p);
  return p;
}

function deriveStem(iconName: string): string {
  return iconName.replace(/_icon$/i, "").replace(/\.png$/i, "");
}

// Module-level cache for the animation_file_map.json (animationName -> stem).
let fileMapPromise: Promise<Record<string, string>> | null = null;
function getFileMap(): Promise<Record<string, string>> {
  if (!fileMapPromise) {
    fileMapPromise = loadAnimationFileMap()
      .then((raw) => {
        const out: Record<string, string> = {};
        for (const k in raw) {
          const f = raw[k]?.file;
          if (typeof f === "string" && f) out[k] = f;
        }
        return out;
      })
      .catch((e) => {
        fileMapPromise = null;
        throw e;
      });
  }
  return fileMapPromise;
}

function autoScaleFor(bbox: BBox): number {
  const w = Math.max(1, bbox.gx1 - bbox.gx0);
  const h = Math.max(1, bbox.gy1 - bbox.gy0);
  const longest = Math.max(w, h);
  return Math.max(1, Math.min(6, Math.round(TARGET_PX / longest)));
}

// ----------------------------------------------------------------------------
// gif.js loader (shared singleton)
// ----------------------------------------------------------------------------
async function loadGifJs(): Promise<{ GIF: any; workerUrl: string }> {
  if (typeof (window as any).GIF !== "function") {
    const mod = await import("gif.js/dist/gif.js");
    const GIFCtor = (mod as any).default ?? (mod as any).GIF ?? (window as any).GIF;
    if (typeof GIFCtor !== "function") throw new Error("GIF encoder failed to load");
    (window as any).GIF = GIFCtor;
  }
  if (!(window as any).__gifWorkerUrl) {
    const mod = await import("gif.js/dist/gif.worker.js?url");
    (window as any).__gifWorkerUrl = (mod as any).default;
  }
  return { GIF: (window as any).GIF, workerUrl: (window as any).__gifWorkerUrl };
}

function encodeGif(
  frames: Frame[],
  atlas: HTMLImageElement,
  bbox: BBox,
  ppu: number,
  fps: number,
  bg: string | null, // null = transparent
  GIF: any,
  workerUrl: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { w, h } = canvasSize(bbox, ppu, PAD);
    const SENTINEL = { r: 255, g: 0, b: 255 };
    const sentinelHex = 0xff00ff;
    const transparent = bg === null;
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: w,
      height: h,
      workerScript: workerUrl,
      transparent: transparent ? sentinelHex : null,
    });
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const octx = off.getContext("2d")!;
    const delay = Math.max(20, Math.round(1000 / fps));
    for (const fr of frames) {
      octx.clearRect(0, 0, w, h);
      if (!transparent) {
        octx.fillStyle = bg!;
        octx.fillRect(0, 0, w, h);
      }
      renderFrameToCtx(octx, fr, atlas, bbox, ppu, PAD, false);
      if (transparent) {
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
    gif.on("finished", (blob: Blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("GIF encoding aborted")));
    gif.render();
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ----------------------------------------------------------------------------
// Single-animation player
// ----------------------------------------------------------------------------
interface PlayerProps {
  name: string;
  label?: string;
  frames: Frame[];
  atlas: HTMLImageElement;
  /** Minimal mode: no label, no advanced options toggle — just the canvas. */
  minimal?: boolean;
}

function AnimationPlayer({ name, label, frames, atlas, minimal }: PlayerProps) {
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(30);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [bgMode, setBgMode] = useState<"transparent" | "color">("transparent");
  const [bgColor, setBgColor] = useState<string>("#1a1a1a");
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();

  const baseBbox = useMemo(() => computeBbox(frames), [frames]);
  const autoPpu = useMemo(() => autoScaleFor(baseBbox), [baseBbox]);
  const [ppu, setPpu] = useState(autoPpu);
  useEffect(() => { setPpu(autoPpu); }, [autoPpu]);

  const bbox: BBox = useMemo(() => {
    return tightenBbox(frames, atlas, baseBbox, ppu, PAD);
  }, [frames, atlas, baseBbox, ppu]);

  const effectiveBg = bgMode === "transparent" ? null : bgColor;

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = canvasSize(bbox, ppu, PAD);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = "auto";
    canvas.style.maxWidth = "100%";
    canvas.style.aspectRatio = `${w} / ${h}`;
    const ctx = canvas.getContext("2d")!;
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const octx = off.getContext("2d")!;
    if (effectiveBg) {
      octx.fillStyle = effectiveBg;
      octx.fillRect(0, 0, w, h);
    }
    renderFrameToCtx(octx, frames[frameIdx] || frames[0], atlas, bbox, ppu, PAD, false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }, [frames, atlas, bbox, ppu, frameIdx, effectiveBg]);

  // Playback
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      acc += dt;
      const period = 1 / fps;
      while (acc >= period) {
        setFrameIdx((i) => (i + 1) % frames.length);
        acc -= period;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, fps, frames]);

  useEffect(() => {
    if (frameIdx >= frames.length) setFrameIdx(0);
  }, [frames, frameIdx]);

  const downloadGif = async () => {
    try {
      setDownloading(true);
      const { GIF, workerUrl } = await loadGifJs();
      const blob = await encodeGif(frames, atlas, bbox, ppu, fps, effectiveBg, GIF, workerUrl);
      downloadBlob(blob, `${name}.gif`);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const wrapperBg = effectiveBg ?? undefined;

  return (
    <div className="relative flex flex-col items-center gap-2 p-3 rounded-md border border-border bg-card/40">
      <Button
        size="icon"
        variant="ghost"
        onClick={downloadGif}
        disabled={downloading}
        title={downloading ? "Encoding…" : "Download GIF"}
        aria-label="Download GIF"
        className="absolute top-1 right-1 h-6 w-6"
      >
        <Download className="h-3.5 w-3.5" />
      </Button>
      {!minimal && (
        <div className="w-full text-center pr-7">
          <div className="text-sm font-medium truncate" title={label || name}>
            {label || name}
          </div>
          {label && (
            <div className="text-[10px] text-muted-foreground/70 font-mono truncate" title={name}>
              {name}
            </div>
          )}
        </div>
      )}
      <div className="rounded p-1 max-w-full overflow-hidden flex items-center justify-center" style={{ background: wrapperBg }}>
        <canvas
          ref={canvasRef}
          className="block max-w-full h-auto"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      {!minimal && (
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Additional options
        </button>
      )}
      {!minimal && showAdvanced && (
        <div className="w-full space-y-2 pt-2 border-t border-border">
          <div className="flex gap-1 justify-center flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setPlaying((p) => !p)} disabled={frames.length < 2}>
              {playing ? "Pause" : "Play"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setPlaying(false); setFrameIdx(0); }}>
              Reset
            </Button>
            <Button size="sm" variant="outline" onClick={downloadGif} disabled={downloading} className="gap-1">
              <Download className="h-3 w-3" />
              {downloading ? "Encoding…" : "GIF"}
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Frame {frameIdx + 1} / {frames.length}</Label>
            <Slider
              value={[frameIdx]}
              min={0}
              max={Math.max(0, frames.length - 1)}
              step={1}
              onValueChange={(v) => { setPlaying(false); setFrameIdx(v[0]); }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">FPS: {fps}</Label>
            <Slider value={[fps]} min={1} max={60} step={1} onValueChange={(v) => setFps(v[0])} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Scale: {ppu}×</Label>
            <Slider value={[ppu]} min={1} max={6} step={1} onValueChange={(v) => setPpu(v[0])} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Background</Label>
            <div className="flex gap-1 flex-wrap items-center">
              <Button
                size="sm"
                variant={bgMode === "transparent" ? "default" : "outline"}
                onClick={() => setBgMode("transparent")}
              >
                Transparent
              </Button>
              <Button
                size="sm"
                variant={bgMode === "color" && bgColor.toLowerCase() === "#ffffff" ? "default" : "outline"}
                onClick={() => { setBgMode("color"); setBgColor("#ffffff"); }}
              >
                White
              </Button>
              <Button
                size="sm"
                variant={bgMode === "color" && bgColor.toLowerCase() === "#000000" ? "default" : "outline"}
                onClick={() => { setBgMode("color"); setBgColor("#000000"); }}
              >
                Black
              </Button>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => { setBgMode("color"); setBgColor(e.target.value); }}
                className="h-8 w-8 rounded border border-border bg-transparent cursor-pointer"
                title="Pick a color"
              />
              <input
                type="text"
                value={bgColor}
                onChange={(e) => {
                  const v = e.target.value;
                  setBgColor(v);
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) setBgMode("color");
                }}
                placeholder="#rrggbb"
                className="h-8 w-24 rounded border border-border bg-background px-2 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Loader + list + export-all
// ----------------------------------------------------------------------------
export function UnitAnimationViewer({ iconName, labelMap, groups, filterNames, compact }: Props) {
  const stem = useMemo(() => deriveStem(iconName), [iconName]);

  const [atlas, setAtlas] = useState<HTMLImageElement | null>(null);
  const [timelines, setTimelines] = useState<Timelines | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMsg(null);
    setAtlas(null);
    setTimelines(null);

    loadAssets(stem)
      .then(({ atlas, timelines }) => {
        if (cancelled) return;
        setAtlas(atlas);
        setTimelines(timelines);
        setStatus("ready");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        if (e.message.includes("not found")) {
          setStatus("missing");
        } else {
          setStatus("error");
          setErrorMsg(e.message);
        }
      });

    return () => { cancelled = true; };
  }, [stem]);

  const exportAll = async () => {
    if (!atlas || !timelines) return;
    try {
      const names = Object.keys(timelines);
      setExportProgress({ current: 0, total: names.length });
      const { GIF, workerUrl } = await loadGifJs();
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const frames = timelines[name];
        const baseBbox = computeBbox(frames);
        const ppu = autoScaleFor(baseBbox);
        const bbox = tightenBbox(frames, atlas, baseBbox, ppu, PAD);
        const blob = await encodeGif(frames, atlas, bbox, ppu, 30, null, GIF, workerUrl);
        zip.file(`${name}.gif`, blob);
        setExportProgress({ current: i + 1, total: names.length });
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${stem}_animations.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportProgress(null);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(`Export failed: ${e.message}`);
      setExportProgress(null);
    }
  };

  if (status === "loading") {
    return <div className="text-sm text-muted-foreground">Loading animations…</div>;
  }
  if (status === "missing") {
    if (compact) return null;
    return (
      <div className="text-sm text-muted-foreground">
        No animation assets found for <code>{stem}</code>.
      </div>
    );
  }
  if (status === "error") {
    return <div className="text-sm text-destructive">Failed to load animation: {errorMsg}</div>;
  }
  if (!atlas || !timelines) return null;

  // Apply name filter (only animations actually present in the timelines).
  const filterSet = filterNames ? new Set(filterNames.filter((n) => n in timelines)) : null;
  const animNames = Object.keys(timelines).filter((n) => !filterSet || filterSet.has(n));
  if (animNames.length === 0) return null;

  // Build resolved groups.
  const used = new Set<string>();
  const resolvedGroups: Array<{ title: string; names: string[] }> = [];
  if (groups) {
    for (const g of groups) {
      const present = g.names.filter((n) => n in timelines && (!filterSet || filterSet.has(n)) && !used.has(n));
      if (present.length === 0) continue;
      present.forEach((n) => used.add(n));
      resolvedGroups.push({ title: g.title, names: present });
    }
  }
  const leftover = animNames.filter((n) => !used.has(n));
  if (leftover.length > 0) {
    resolvedGroups.push({ title: resolvedGroups.length === 0 ? (compact ? "" : "Animations") : "Other", names: leftover });
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {animNames.length} animation{animNames.length === 1 ? "" : "s"}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={exportAll}
            disabled={exportProgress !== null}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {exportProgress
              ? `Exporting ${exportProgress.current}/${exportProgress.total}…`
              : "Export all as ZIP"}
          </Button>
        </div>
      )}
      {errorMsg && <div className="text-xs text-destructive">{errorMsg}</div>}
      <div className="space-y-6">
        {resolvedGroups.map((g, gi) => (
          <div key={g.title || gi} className="space-y-2">
            {g.title && (
              <h4 className="text-sm font-semibold text-foreground/80 border-b border-border pb-1">
                {g.title}
              </h4>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {g.names.map((name) => (
                <AnimationPlayer
                  key={name}
                  name={name}
                  label={labelMap?.[name]}
                  frames={timelines[name]}
                  atlas={atlas}
                  minimal={compact}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
