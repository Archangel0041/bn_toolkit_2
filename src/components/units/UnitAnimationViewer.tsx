import { useEffect, useMemo, useRef, useState } from "react";
import { decode } from "@msgpack/msgpack";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  normalizeTimeline, computeBbox, tightenBbox, canvasSize, renderFrameToCtx,
  type Frame, type Timelines, type BBox,
} from "@/lib/timelineRenderer";

const PAD = 4;
const ANIMATIONS_BUCKET = "Animations";

interface Props {
  /** The unit's icon name (e.g. "artillery_icon"). The trailing "_icon" is stripped to derive the asset stem. */
  iconName: string;
}

function deriveStem(iconName: string): string {
  return iconName.replace(/_icon$/i, "").replace(/\.png$/i, "");
}

// ----------------------------------------------------------------------------
// Single-animation player
// ----------------------------------------------------------------------------
interface PlayerProps {
  name: string;
  frames: Frame[];
  atlas: HTMLImageElement;
  showAdvanced: boolean;
}

function AnimationPlayer({ name, frames, atlas, showAdvanced }: PlayerProps) {
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(30);

  // Auto-pick a scale that fits the animation into a roughly uniform target size.
  const TARGET_PX = 140;
  const baseBbox = useMemo(() => computeBbox(frames), [frames]);
  const autoPpu = useMemo(() => {
    const w = Math.max(1, baseBbox.gx1 - baseBbox.gx0);
    const h = Math.max(1, baseBbox.gy1 - baseBbox.gy0);
    const longest = Math.max(w, h);
    const raw = TARGET_PX / longest;
    // Snap to a sensible integer-ish range so pixel art stays crisp
    return Math.max(1, Math.min(6, Math.round(raw)));
  }, [baseBbox]);
  const [ppu, setPpu] = useState(autoPpu);
  useEffect(() => { setPpu(autoPpu); }, [autoPpu]);

  const bbox: BBox = useMemo(() => {
    return tightenBbox(frames, atlas, baseBbox, ppu, PAD);
  }, [frames, atlas, baseBbox, ppu]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = canvasSize(bbox, ppu, PAD);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d")!;
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const octx = off.getContext("2d")!;
    renderFrameToCtx(octx, frames[frameIdx] || frames[0], atlas, bbox, ppu, PAD, false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }, [frames, atlas, bbox, ppu, frameIdx]);

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

  // Keep frame index in range
  useEffect(() => {
    if (frameIdx >= frames.length) setFrameIdx(0);
  }, [frames, frameIdx]);

  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-md border border-border bg-card/40">
      <div className="text-xs font-medium text-muted-foreground truncate w-full text-center" title={name}>
        {name}
      </div>
      <canvas ref={canvasRef} className="block" style={{ imageRendering: "pixelated" }} />
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => setPlaying((p) => !p)} disabled={frames.length < 2}>
          {playing ? "Pause" : "Play"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setPlaying(false); setFrameIdx(0); }}>
          Reset
        </Button>
      </div>
      {showAdvanced && (
        <div className="w-full space-y-2 pt-2 border-t border-border">
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
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Loader + grid
// ----------------------------------------------------------------------------
export function UnitAnimationViewer({ iconName }: Props) {
  const stem = useMemo(() => deriveStem(iconName), [iconName]);

  const [atlas, setAtlas] = useState<HTMLImageElement | null>(null);
  const [timelines, setTimelines] = useState<Timelines | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMsg(null);
    setAtlas(null);
    setTimelines(null);

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

    const timelinePromise = (async () => {
      const res = await fetch(timelineUrl);
      if (!res.ok) throw new Error("timeline not found");
      const buf = new Uint8Array(await res.arrayBuffer());
      const raw = decode(buf);
      return normalizeTimeline(raw, stem);
    })();

    Promise.all([imgPromise, timelinePromise])
      .then(([img, tl]) => {
        if (cancelled) return;
        setAtlas(img);
        setTimelines(tl);
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

  if (status === "loading") {
    return <div className="text-sm text-muted-foreground">Loading animations…</div>;
  }
  if (status === "missing") {
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

  const animNames = Object.keys(timelines);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Additional options
      </button>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {animNames.map((name) => (
          <AnimationPlayer
            key={name}
            name={name}
            frames={timelines[name]}
            atlas={atlas}
            showAdvanced={showAdvanced}
          />
        ))}
      </div>
    </div>
  );
}
