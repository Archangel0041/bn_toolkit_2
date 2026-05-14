import { useEffect, useMemo, useRef, useState } from "react";
import { decode } from "@msgpack/msgpack";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

export function UnitAnimationViewer({ iconName }: Props) {
  const stem = useMemo(() => deriveStem(iconName), [iconName]);

  const [atlas, setAtlas] = useState<HTMLImageElement | null>(null);
  const [timelines, setTimelines] = useState<Timelines | null>(null);
  const [animName, setAnimName] = useState<string>("");
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(30);
  const [ppu, setPpu] = useState(3);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();

  const frames: Frame[] | null = animName && timelines ? timelines[animName] : null;

  const bbox: BBox | null = useMemo(() => {
    if (!frames) return null;
    const conservative = computeBbox(frames);
    return atlas ? tightenBbox(frames, atlas, conservative, ppu, PAD) : conservative;
  }, [frames, atlas, ppu]);

  // Load atlas + timeline whenever stem changes
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMsg(null);
    setAtlas(null);
    setTimelines(null);
    setAnimName("");
    setFrameIdx(0);

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
        const names = Object.keys(tl);
        // Prefer an idle animation if present
        const preferred =
          names.find((n) => /front.*idle|idle.*front|^idle$/i.test(n)) ??
          names.find((n) => /idle/i.test(n)) ??
          names[0] ??
          "";
        setAnimName(preferred);
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

  // Keep frame index in range
  useEffect(() => {
    if (!frames) return;
    if (frameIdx >= frames.length) setFrameIdx(0);
  }, [frames, frameIdx]);

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
    if (!playing || !frames || frames.length < 2) return;
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

  const animNames = timelines ? Object.keys(timelines) : [];
  const totalFrames = frames?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[240px]">
          <Label className="text-xs">Animation</Label>
          <Select
            value={animName}
            onValueChange={(v) => { setPlaying(false); setFrameIdx(0); setAnimName(v); }}
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
        <Button variant="outline" onClick={() => { setPlaying(false); setFrameIdx(0); }}>
          Reset
        </Button>
      </div>

      {frames && (
        <div className="space-y-3 max-w-2xl">
          <div className="space-y-1">
            <Label className="text-xs">
              Frame {frameIdx + 1} / {totalFrames}
            </Label>
            <Slider
              value={[frameIdx]}
              min={0}
              max={Math.max(0, totalFrames - 1)}
              step={1}
              onValueChange={(v) => { setPlaying(false); setFrameIdx(v[0]); }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">FPS: {fps}</Label>
              <Slider value={[fps]} min={1} max={60} step={1} onValueChange={(v) => setFps(v[0])} />
            </div>
            <div>
              <Label className="text-xs">Scale: {ppu}×</Label>
              <Slider value={[ppu]} min={1} max={6} step={1} onValueChange={(v) => setPpu(v[0])} />
            </div>
          </div>
        </div>
      )}

      <div
        className="inline-block rounded-md border border-border p-2"
        style={{
          background:
            "repeating-conic-gradient(hsl(var(--muted)) 0% 25%, hsl(var(--background)) 0% 50%) 50% / 16px 16px",
        }}
      >
        <canvas ref={canvasRef} className="block" style={{ imageRendering: "pixelated" }} />
      </div>
    </div>
  );
}
