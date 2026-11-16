/**
 * What the downward-looking sensors see.
 *
 *  - VectorMatSampler: computed from a geometric description of the mat. Pure maths, works in Node
 *    (tests, batch runs) and in the browser before the mat picture has loaded.
 *  - RasterMatSampler: reads the real mat picture, so the sensors see exactly what is printed
 *    (including the illustrations). Browser only (needs a canvas to decode the image).
 */
import type { Vec2 } from './geometry';
import type { MatLayer, MatSampler, MatVector, RGB } from './types';

type StrokeLayer = Extract<MatLayer, { kind: 'stroke' }>;
type PolygonLayer = Extract<MatLayer, { kind: 'polygon' }>;

interface PreparedStroke {
  layer: StrokeLayer;
  /** segments with the cumulative length at their start */
  segs: Array<{ a: Vec2; b: Vec2; len: number; start: number; roundA: boolean; roundB: boolean }>;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function prepareStroke(layer: StrokeLayer): PreparedStroke {
  const pts = layer.points;
  const n = pts.length;
  const segs: PreparedStroke['segs'] = [];
  const count = layer.closed ? n : n - 1;
  let start = 0;
  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    // joints between segments are rounded; free ends of an open polyline are cut square (butt caps)
    const roundA = layer.closed ? true : i > 0;
    const roundB = layer.closed ? true : i < count - 1;
    segs.push({ a, b, len, start, roundA, roundB });
    start += len;
  }
  const hw = layer.width / 2;
  return {
    layer,
    segs,
    minX: Math.min(...pts.map((p) => p.x)) - hw,
    minY: Math.min(...pts.map((p) => p.y)) - hw,
    maxX: Math.max(...pts.map((p) => p.x)) + hw,
    maxY: Math.max(...pts.map((p) => p.y)) + hw,
  };
}

function strokeCovers(s: PreparedStroke, x: number, y: number): boolean {
  if (x < s.minX || x > s.maxX || y < s.minY || y > s.maxY) return false;
  const hw = s.layer.width / 2;
  const dash = s.layer.dash;
  for (const seg of s.segs) {
    if (seg.len < 1e-9) continue;
    const ux = (seg.b.x - seg.a.x) / seg.len;
    const uy = (seg.b.y - seg.a.y) / seg.len;
    const px = x - seg.a.x;
    const py = y - seg.a.y;
    const t = px * ux + py * uy;
    let along: number;
    if (t >= 0 && t <= seg.len) {
      if (Math.abs(px * uy - py * ux) > hw) continue;
      along = seg.start + t;
    } else if (t < 0 && seg.roundA) {
      if (px * px + py * py > hw * hw) continue;
      along = seg.start;
    } else if (t > seg.len && seg.roundB) {
      const qx = x - seg.b.x;
      const qy = y - seg.b.y;
      if (qx * qx + qy * qy > hw * hw) continue;
      along = seg.start + seg.len;
    } else {
      continue;
    }
    if (!dash) return true;
    const period = dash.on + dash.off;
    if (along % period < dash.on) return true;
  }
  return false;
}

interface PreparedPolygon {
  layer: PolygonLayer;
  /** every edge of every outline: x1, y1, x2, y2 one after the other */
  edges: Float64Array;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function preparePolygon(layer: PolygonLayer): PreparedPolygon {
  const coords: number[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const contour of layer.contours) {
    const n = contour.length;
    if (n < 3) continue; // (fewer than three points enclose nothing)
    for (let i = 0; i < n; i++) {
      const a = contour[i];
      const b = contour[(i + 1) % n];
      coords.push(a.x, a.y, b.x, b.y);
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x);
      maxY = Math.max(maxY, a.y);
    }
  }
  return { layer, edges: Float64Array.from(coords), minX, minY, maxX, maxY };
}

/** Even-odd rule: a ray from the point to the right crosses the outlines an odd number of times. */
function polygonCovers(p: PreparedPolygon, x: number, y: number): boolean {
  if (x < p.minX || x > p.maxX || y < p.minY || y > p.maxY) return false;
  const e = p.edges;
  let inside = false;
  for (let i = 0; i < e.length; i += 4) {
    const y1 = e[i + 1];
    const y2 = e[i + 3];
    if (y1 > y !== y2 > y) {
      const x1 = e[i];
      const crossX = x1 + ((e[i + 2] - x1) * (y - y1)) / (y2 - y1);
      if (x < crossX) inside = !inside;
    }
  }
  return inside;
}

export class VectorMatSampler implements MatSampler {
  private readonly prepared: Array<{ layer: MatLayer; stroke?: PreparedStroke; polygon?: PreparedPolygon }>;

  constructor(private readonly mat: MatVector) {
    // top-most layer first
    this.prepared = [...mat.layers]
      .reverse()
      .map((layer) =>
        layer.kind === 'stroke'
          ? { layer, stroke: prepareStroke(layer) }
          : layer.kind === 'polygon'
            ? { layer, polygon: preparePolygon(layer) }
            : { layer },
      );
  }

  sample(x: number, y: number): RGB {
    const m = this.mat;
    if (x < 0 || y < 0 || x > m.width || y > m.height) return m.outside;
    for (const p of this.prepared) {
      if (p.layer.kind === 'rect') {
        const r = p.layer.rect;
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return p.layer.color;
      } else if (p.stroke && strokeCovers(p.stroke, x, y)) {
        return p.layer.color;
      } else if (p.polygon && polygonCovers(p.polygon, x, y)) {
        return p.layer.color;
      }
    }
    return m.background;
  }
}

export interface RasterLike {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export class RasterMatSampler implements MatSampler {
  private readonly sx: number;
  private readonly sy: number;

  constructor(
    private readonly raster: RasterLike,
    private readonly matWidth: number,
    private readonly matHeight: number,
    private readonly outside: RGB,
  ) {
    this.sx = raster.width / matWidth;
    this.sy = raster.height / matHeight;
  }

  sample(x: number, y: number): RGB {
    if (x < 0 || y < 0 || x >= this.matWidth || y >= this.matHeight) return this.outside;
    const px = Math.min(this.raster.width - 1, Math.floor(x * this.sx));
    const py = Math.min(this.raster.height - 1, Math.floor(y * this.sy));
    const i = (py * this.raster.width + px) * 4;
    const d = this.raster.data;
    return { r: d[i], g: d[i + 1], b: d[i + 2] };
  }
}

/** Browser only: decode the mat picture and build a sampler from its pixels. */
export function loadRasterMatSampler(
  url: string,
  matWidth: number,
  matHeight: number,
  outside: RGB,
): Promise<RasterMatSampler> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('loadRasterMatSampler needs a browser'));
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('2-D canvas is not available');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(new RasterMatSampler(data, matWidth, matHeight, outside));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    img.onerror = () => reject(new Error(`could not load mat image ${url}`));
    img.src = url;
  });
}
