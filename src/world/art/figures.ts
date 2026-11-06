import { Mesh, MAT, type V3, hex, type Style } from '../mesh';

export const SKIN = hex('#8a5838');
export const WHITE_CLOTH = hex('#ece2cf');
export const SAFFRON = hex('#e8742a');
export const KESARI = hex('#d9541e');
export const MAROON = hex('#7d1f2a');
export const INDIGO = hex('#2c3a86');
export const MAGENTA = hex('#c0275e');
export const GOLD = hex('#c99a3a');
export const LEHERIYA = hex('#2f8a5a');

type P = [number, number];

const cloth = (c: V3, extra: Partial<Style> = {}): Style => ({ color: c, mat: MAT.cloth, ...extra });
const skin = (): Style => ({ color: SKIN, mat: MAT.plain });

export function limb(m: Mesh, a: P, b: P, c: P, w0: number, w1: number, w2: number, s: Style) {
  m.ribbon([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2], c], [w0, (w0 + w1) / 2, w1, (w1 + w2) / 2, w2], s);
}

export interface PersonOpts {
  pose?: 'stand' | 'sit' | 'carry' | 'carve' | 'play' | 'dance';
  turban?: V3;
  garment?: V3;
  veil?: V3; // odhni for women
  dir?: 1 | -1;
  phase?: number;
}

/** Villagers, bards and craftsmen. Simple, dignified silhouettes in local dress. */
export function person(m: Mesh, x: number, y: number, s: number, o: PersonOpts = {}) {
  const d = o.dir ?? 1;
  const X = (v: number) => x + v * s * d;
  const Y = (v: number) => y + v * s;
  const garment = o.garment ?? WHITE_CLOTH;
  const pose = o.pose ?? 'stand';
  if (pose === 'sit') {
    // cross-legged on the ground
    m.poly([X(-0.22), Y(0), X(0.24), Y(0), X(0.2), Y(0.12), X(-0.18), Y(0.12)], cloth(garment));
    m.poly([X(-0.12), Y(0.1), X(0.12), Y(0.1), X(0.1), Y(0.42), X(-0.1), Y(0.42)], cloth(garment));
    m.ball(X(0), Y(0.5), s * 0.075, skin());
    if (o.turban) {
      m.dome(X(0), Y(0.52), s * 0.2, s * 0.12, cloth(o.turban), 'hemi', 8, 4);
    }
    if (o.veil) m.poly([X(-0.1), Y(0.58), X(0.12), Y(0.56), X(0.2), Y(0.1), X(-0.2), Y(0.12)], cloth(o.veil, { sway: 0.4 }));
    return;
  }
  const lean = pose === 'carve' ? 0.12 : 0;
  // legs or skirt
  if (o.veil) {
    // ghaghra: a wide flared skirt
    m.poly([X(-0.1), Y(0.5), X(0.1), Y(0.5), X(0.2), Y(0.02), X(-0.2), Y(0.02)], cloth(garment, { sway: 0.6 }));
  } else {
    limb(m, [X(-0.04), Y(0.5)], [X(-0.06), Y(0.25)], [X(-0.06), Y(0.02)], s * 0.045, s * 0.035, s * 0.03, cloth(garment));
    limb(m, [X(0.04), Y(0.5)], [X(0.07), Y(0.25)], [X(0.06), Y(0.02)], s * 0.045, s * 0.035, s * 0.03, cloth(garment));
    m.poly([X(-0.11), Y(0.6), X(0.11), Y(0.6), X(0.13), Y(0.32), X(-0.13), Y(0.32)], cloth(garment));
  }
  // torso
  m.poly([X(-0.1), Y(0.5), X(0.1), Y(0.5), X(0.1 + lean), Y(0.82), X(-0.09 + lean), Y(0.82)], cloth(garment));
  const hx = X(0.01 + lean), hy = Y(0.9);
  m.ball(hx, hy, s * 0.065, skin());
  if (o.turban) {
    m.dome(hx, hy + s * 0.01, s * 0.16, s * 0.1, cloth(o.turban), 'hemi', 8, 4);
    m.ribbon([[hx - s * 0.05 * d, hy], [hx - s * 0.1 * d, hy - s * 0.15], [hx - s * 0.12 * d, hy - s * 0.28]], [s * 0.025, s * 0.02, s * 0.015], cloth(o.turban, { sway: 1.5 }));
  }
  if (o.veil) {
    m.poly([hx - s * 0.08 * d, hy + s * 0.07, hx + s * 0.07 * d, hy + s * 0.06, X(0.16), Y(0.45), X(-0.18), Y(0.42)], cloth(o.veil, { sway: 0.8 }));
  }
  // arms
  if (pose === 'carry') {
    limb(m, [X(0.06), Y(0.8)], [X(0.12), Y(0.95)], [X(0.04), Y(1.04)], s * 0.025, s * 0.022, s * 0.02, skin());
    // stacked water pots (matka)
    m.ball(hx, hy + s * 0.16, s * 0.08, { color: hex('#a0522d'), mat: MAT.plain });
    m.ball(hx, hy + s * 0.29, s * 0.06, { color: hex('#b8862e'), mat: MAT.plain });
  } else if (pose === 'carve') {
    const ph = Math.sin(o.phase ?? 0);
    limb(m, [X(0.08), Y(0.78)], [X(0.2), Y(0.66)], [X(0.3), Y(0.58 + ph * 0.02)], s * 0.025, s * 0.022, s * 0.02, skin());
    limb(m, [X(-0.02), Y(0.78)], [X(0.14), Y(0.74)], [X(0.25), Y(0.7)], s * 0.025, s * 0.022, s * 0.02, skin());
  } else if (pose === 'play') {
    // kamaicha: a bowed lute held upright
    m.ball(X(0.12), Y(0.55), s * 0.07, { color: WOOD2, mat: MAT.plain });
    m.ribbon([[X(0.12), Y(0.6)], [X(0.12), Y(1.0)]], s * 0.015, { color: WOOD2, mat: MAT.plain });
    limb(m, [X(0.06), Y(0.78)], [X(0.18), Y(0.7)], [X(0.25), Y(0.62)], s * 0.025, s * 0.022, s * 0.02, skin());
  } else {
    limb(m, [X(-0.08), Y(0.8)], [X(-0.1), Y(0.62)], [X(-0.09), Y(0.46)], s * 0.025, s * 0.022, s * 0.02, cloth(garment));
    limb(m, [X(0.08), Y(0.8)], [X(0.11), Y(0.62)], [X(0.1), Y(0.46)], s * 0.025, s * 0.022, s * 0.02, cloth(garment));
  }
}

const WOOD2 = hex('#6a3a1e');

/** Strung lines of freshly dyed cloth, the colour of the bazaar. */
export function clothLine(m: Mesh, x0: number, y0: number, x1: number, y1: number, colors: V3[], seed = 1) {
  const sag = 18;
  const n = 18;
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * sag]);
  }
  m.ribbon(pts, 0.4, { color: hex('#3a2a20'), mat: MAT.plain }, false);
  const k = Math.floor((x1 - x0) / 34);
  for (let i = 0; i < k; i++) {
    const u = (i + 0.5) / k;
    const px = x0 + (x1 - x0) * u, py = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * sag;
    const w = 20 + ((i * 7 + seed) % 3) * 4;
    const h = 46 + ((i * 13 + seed) % 4) * 10;
    const c = colors[(i + seed) % colors.length];
    const seg = 8;
    for (let j = 0; j < seg; j++) {
      const v0 = j / seg, v1 = (j + 1) / seg;
      const fold = (v: number) => Math.sin(v * 5 + i) * 1.5;
      m.quad(px - w / 2 + fold(v0), py - h * v0, px + w / 2 + fold(v0), py - h * v0, px + w / 2 + fold(v1), py - h * v1, px - w / 2 + fold(v1), py - h * v1,
        { color: c, mat: MAT.cloth, n: [Math.sin(v0 * 5 + i) * 0.3, 0, 0.95] }, undefined, undefined, undefined, undefined);
      // sway increases toward the hem
      const base = m.count - 6;
      const sw = [v0, v1, v1, v0, v1, v1].map((v) => v * 6);
      const order = [v0, v0, v1, v0, v1, v1];
      for (let q = 0; q < 6; q++) m.data[(base + q) * 12 + 11] = order[q] * 6 + 0 * sw[q];
    }
    // bandhani dots on some pieces
    if ((i + seed) % 2 === 0) {
      for (let dy = 6; dy < h - 4; dy += 7) for (let dx = -w / 2 + 4; dx < w / 2 - 2; dx += 6) {
        m.disc(px + dx, py - dy, 0.9, 0.9, { color: hex('#f4e6c8'), mat: MAT.cloth, sway: (dy / h) * 6 }, 5, 0);
      }
    }
  }
}

/** A woven paper kite, tethered, drifting. */
export function kite(m: Mesh, x: number, y: number, s: number, color: V3, accent: V3) {
  m.poly([x, y + s, x + s * 0.7, y, x, y - s, x - s * 0.7, y], { color, mat: MAT.cloth, sway: 4 });
  m.poly([x, y + s, x + s * 0.7, y, x, y], { color: accent, mat: MAT.cloth, sway: 4 });
  m.ribbon([[x, y - s], [x - s * 0.3, y - s * 2], [x + s * 0.2, y - s * 3]], 0.6, { color: accent, mat: MAT.cloth, sway: 6 }, false);
}
