import earcut from 'earcut';

/**
 * Vector geometry for the 2.5D world. Every shape is flat in x/y but carries a 3D normal,
 * so the shader can light round towers, domes and dune faces as the sun crosses the sky.
 *
 * Vertex layout (12 floats):
 *   pos.xy | normal.xyz | albedo.rgb | ao, emissive, material, sway
 */
export const FLOATS = 12;

export const MAT = {
  stone: 0, // ashlar sandstone with masonry courses
  sand: 1, // dune sand with ripples
  plain: 2, // smooth surface, no detail
  cloth: 3, // fabric, slightly translucent to the sun
  flame: 4, // unlit, always glowing
  water: 5, // reflective water
  leaf: 6, // foliage
  dark: 7, // silhouette: lit only by rim
} as const;

export type V3 = [number, number, number];

export interface Style {
  color: V3; // linear rgb
  ao?: number;
  em?: number;
  mat?: number;
  sway?: number;
  n?: V3;
}

export function hex(h: string, mul = 1): V3 {
  const v = parseInt(h.replace('#', ''), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.pow(x / 255, 2.2) * mul);
  return c as V3;
}

export function mix3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const FRONT: V3 = [0, 0, 1];

export class Mesh {
  data: Float32Array;
  count = 0; // vertices
  minX = Infinity;
  maxX = -Infinity;

  constructor(capacity = 4096) {
    this.data = new Float32Array(capacity * FLOATS);
  }

  private grow(n: number) {
    const need = (this.count + n) * FLOATS;
    if (need <= this.data.length) return;
    let cap = this.data.length;
    while (cap < need) cap *= 2;
    const d = new Float32Array(cap);
    d.set(this.data);
    this.data = d;
  }

  reset() {
    this.count = 0;
    this.minX = Infinity;
    this.maxX = -Infinity;
  }

  /** Current placement transform: local shapes are drawn at (tx, ty) with uniform scale ts. */
  tx = 0;
  ty = 0;
  ts = 1;

  /** Draw `fn` with its local origin at (x, y), scaled by `s`. Nests. */
  at(x: number, y: number, s: number, fn: () => void) {
    const ox = this.tx, oy = this.ty, os = this.ts;
    this.tx = ox + x * os;
    this.ty = oy + y * os;
    this.ts = os * s;
    fn();
    this.tx = ox;
    this.ty = oy;
    this.ts = os;
  }

  v(x: number, y: number, n: V3, s: Style, sway?: number) {
    x = x * this.ts + this.tx;
    y = y * this.ts + this.ty;
    this.grow(1);
    const o = this.count * FLOATS;
    const d = this.data;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = n[0];
    d[o + 3] = n[1];
    d[o + 4] = n[2];
    d[o + 5] = s.color[0];
    d[o + 6] = s.color[1];
    d[o + 7] = s.color[2];
    d[o + 8] = s.ao ?? 1;
    d[o + 9] = s.em ?? 0;
    d[o + 10] = s.mat ?? MAT.stone;
    d[o + 11] = (sway ?? s.sway ?? 0) * this.ts;
    this.count++;
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
  }

  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, s: Style) {
    const n = s.n ?? FRONT;
    this.v(ax, ay, n, s);
    this.v(bx, by, n, s);
    this.v(cx, cy, n, s);
  }

  /** Quad from four corners (counter-clockwise or not, it does not matter: no culling). */
  quad(
    x0: number, y0: number, x1: number, y1: number,
    x2: number, y2: number, x3: number, y3: number,
    s: Style, n0?: V3, n1?: V3, n2?: V3, n3?: V3,
  ) {
    const n = s.n ?? FRONT;
    const a = n0 ?? n, b = n1 ?? n, c = n2 ?? n, d = n3 ?? n;
    this.v(x0, y0, a, s); this.v(x1, y1, b, s); this.v(x2, y2, c, s);
    this.v(x0, y0, a, s); this.v(x2, y2, c, s); this.v(x3, y3, d, s);
  }

  rect(x: number, y: number, w: number, h: number, s: Style) {
    this.quad(x, y, x + w, y, x + w, y + h, x, y + h, s);
  }

  /** Arbitrary simple polygon, flat array [x0,y0,x1,y1,...]. */
  poly(pts: number[], s: Style, holes?: number[][]) {
    let flat = pts;
    let holeIdx: number[] | undefined;
    if (holes && holes.length) {
      flat = pts.slice();
      holeIdx = [];
      for (const h of holes) {
        holeIdx.push(flat.length / 2);
        flat = flat.concat(h);
      }
    }
    const idx = earcut(flat, holeIdx);
    const n = s.n ?? FRONT;
    for (let i = 0; i < idx.length; i++) {
      const k = idx[i] * 2;
      this.v(flat[k], flat[k + 1], n, s);
    }
  }

  /**
   * Vertical cylinder seen from the front: strips whose normals sweep from left to right,
   * so a round bastion catches the sun on one side and falls into shade on the other.
   * `topScale` < 1 gives the batter (inward slope) of fort towers.
   */
  cylinder(cx: number, y: number, w: number, h: number, s: Style, segs = 10, topScale = 1) {
    const r0 = w / 2, r1 = (w / 2) * topScale;
    for (let i = 0; i < segs; i++) {
      const a0 = -Math.PI / 2 + (Math.PI * i) / segs;
      const a1 = -Math.PI / 2 + (Math.PI * (i + 1)) / segs;
      const n0: V3 = [Math.sin(a0), 0, Math.cos(a0)];
      const n1: V3 = [Math.sin(a1), 0, Math.cos(a1)];
      this.quad(
        cx + Math.sin(a0) * r0, y, cx + Math.sin(a1) * r0, y,
        cx + Math.sin(a1) * r1, y + h, cx + Math.sin(a0) * r1, y + h,
        s, n0, n1, n1, n0,
      );
    }
  }

  /**
   * Dome from a profile: radius(v) for v in 0..1 (base to tip). Normals tilt upward with the profile slope.
   */
  dome(cx: number, y: number, w: number, h: number, s: Style, kind: 'hemi' | 'onion' | 'bangla' | 'flat' = 'hemi', segU = 10, segV = 8) {
    const R = (v: number) => {
      if (kind === 'onion') {
        // bulge a little beyond the base, then pinch to a point
        const b = Math.sin(Math.PI * Math.min(1, v * 1.05)) * 0.35;
        return Math.max(0, (Math.cos((v * Math.PI) / 2) * 1.0 + b * (1 - v)) * (1 - Math.pow(v, 6) * 0.2));
      }
      if (kind === 'flat') return Math.sqrt(Math.max(0, 1 - v * v)) ;
      return Math.sqrt(Math.max(0, 1 - v * v));
    };
    for (let j = 0; j < segV; j++) {
      const v0 = j / segV, v1 = (j + 1) / segV;
      const r0 = R(v0) * (w / 2), r1 = R(v1) * (w / 2);
      const y0 = y + v0 * h, y1 = y + v1 * h;
      // slope: how much the surface faces up
      const dr = (r1 - r0) / (w / 2), dy = (y1 - y0) / h;
      const up0 = Math.atan2(-dr, dy);
      const tilt = Math.max(-1.2, Math.min(1.4, up0));
      const ny = Math.sin(tilt), nh = Math.cos(tilt);
      for (let i = 0; i < segU; i++) {
        const a0 = -Math.PI / 2 + (Math.PI * i) / segU;
        const a1 = -Math.PI / 2 + (Math.PI * (i + 1)) / segU;
        const na0: V3 = [Math.sin(a0) * nh, ny, Math.cos(a0) * nh];
        const na1: V3 = [Math.sin(a1) * nh, ny, Math.cos(a1) * nh];
        this.quad(
          cx + Math.sin(a0) * r0, y0, cx + Math.sin(a1) * r0, y0,
          cx + Math.sin(a1) * r1, y1, cx + Math.sin(a0) * r1, y1,
          s, na0, na1, na1, na0,
        );
      }
    }
  }

  /** Disc whose normals bulge toward the viewer, like a shield boss or a lamp. */
  disc(cx: number, cy: number, rx: number, ry: number, s: Style, segs = 20, bulge = 0.8) {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      const e0: V3 = [Math.cos(a0) * bulge, Math.sin(a0) * bulge, 1 - bulge * 0.6];
      const e1: V3 = [Math.cos(a1) * bulge, Math.sin(a1) * bulge, 1 - bulge * 0.6];
      this.v(cx, cy, FRONT, s);
      this.v(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, e0, s);
      this.v(cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry, e1, s);
    }
  }

  /**
   * A ribbon along a path with per-point half-widths. With `round`, normals sweep across
   * the width so limbs, scarves and branches read as volumes. `swayFn` lets cloth move in wind.
   */
  ribbon(path: [number, number][], widths: number[] | number, s: Style, round = true, swayFn?: (i: number) => number) {
    const n = path.length;
    if (n < 2) return;
    const L: [number, number][] = [], Rr: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const p = path[i];
      const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const w = typeof widths === 'number' ? widths : widths[i];
      L.push([p[0] - ty * w, p[1] + tx * w]);
      Rr.push([p[0] + ty * w, p[1] - tx * w]);
    }
    for (let i = 0; i < n - 1; i++) {
      const sw0 = swayFn ? swayFn(i) : undefined, sw1 = swayFn ? swayFn(i + 1) : undefined;
      if (round) {
        // split down the middle so the centre faces the viewer and the edges face out
        const pa = path[i], pb = path[i + 1];
        const nl0 = this.edgeNormal(L[i], pa), nr0 = this.edgeNormal(Rr[i], pa);
        const nl1 = this.edgeNormal(L[i + 1], pb), nr1 = this.edgeNormal(Rr[i + 1], pb);
        this.v(L[i][0], L[i][1], nl0, s, sw0); this.v(pa[0], pa[1], FRONT, s, sw0); this.v(pb[0], pb[1], FRONT, s, sw1);
        this.v(L[i][0], L[i][1], nl0, s, sw0); this.v(pb[0], pb[1], FRONT, s, sw1); this.v(L[i + 1][0], L[i + 1][1], nl1, s, sw1);
        this.v(pa[0], pa[1], FRONT, s, sw0); this.v(Rr[i][0], Rr[i][1], nr0, s, sw0); this.v(Rr[i + 1][0], Rr[i + 1][1], nr1, s, sw1);
        this.v(pa[0], pa[1], FRONT, s, sw0); this.v(Rr[i + 1][0], Rr[i + 1][1], nr1, s, sw1); this.v(pb[0], pb[1], FRONT, s, sw1);
      } else {
        const nn = s.n ?? FRONT;
        this.v(L[i][0], L[i][1], nn, s, sw0); this.v(Rr[i][0], Rr[i][1], nn, s, sw0); this.v(Rr[i + 1][0], Rr[i + 1][1], nn, s, sw1);
        this.v(L[i][0], L[i][1], nn, s, sw0); this.v(Rr[i + 1][0], Rr[i + 1][1], nn, s, sw1); this.v(L[i + 1][0], L[i + 1][1], nn, s, sw1);
      }
    }
  }

  private edgeNormal(e: [number, number], c: [number, number]): V3 {
    const dx = e[0] - c[0], dy = e[1] - c[1];
    const l = Math.hypot(dx, dy) || 1;
    return [(dx / l) * 0.85, (dy / l) * 0.85, 0.53];
  }

  /** Circle approximated with a round normal field (a ball / head). */
  ball(cx: number, cy: number, r: number, s: Style, segs = 16) {
    this.disc(cx, cy, r, r, s, segs, 0.9);
  }
}

// ---------- small math helpers shared by the art kit ----------

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** 1D value noise, smooth, deterministic. */
export function noise1(x: number, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const h = (n: number) => {
    const v = Math.sin((n + seed * 131.7) * 127.1) * 43758.5453;
    return v - Math.floor(v);
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

export function fbm1(x: number, seed = 0, oct = 4) {
  let a = 0.5, s = 0, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * noise1(x * f, seed + i * 17);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}
