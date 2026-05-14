// Shared sprite-timeline rendering utilities.
// Extracted from TimelinePreview so other pages (e.g. UnitDetail) can reuse it.

const NORM = 32767;

export type Transform = {
  m00: number; m01: number; m02: number;
  m10: number; m11: number; m12: number;
};
export type Poly = { xpoints: number[]; ypoints: number[] };
export type Frame = { transforms: Transform[]; polys: Poly[]; alpha: any[] };
export type Timelines = Record<string, Frame[]>;
export type BBox = { gx0: number; gy0: number; gx1: number; gy1: number };

function normTransform(t: any): Transform {
  if (Array.isArray(t)) return { m00: t[0], m01: t[1], m02: t[2], m10: t[3], m11: t[4], m12: t[5] };
  return t;
}
function normPoly(p: any): Poly {
  if (Array.isArray(p)) return { xpoints: p[0], ypoints: p[1] };
  return p;
}

export function normalizeTimeline(raw: any, fallbackName: string): Timelines {
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

export function partAlpha(alphaList: any[] | undefined, i: number): number {
  if (!alphaList || i >= alphaList.length) return 1.0;
  const a = alphaList[i];
  return Array.isArray(a) ? +a[0] : +a;
}

export function computeBbox(frames: Frame[]): BBox {
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

export function canvasSize(bbox: BBox, ppu: number, pad: number) {
  const w = Math.max(1, Math.ceil((bbox.gx1 - bbox.gx0) * ppu) + 2 * pad);
  const h = Math.max(1, Math.ceil((bbox.gy1 - bbox.gy0) * ppu) + 2 * pad);
  return { w, h };
}

export function renderFrameToCtx(
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

export function tightenBbox(
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
