import { Mesh, MAT, type Style, type V3, mix3, hex } from '../mesh';

/**
 * Rajput architecture from primitives: kanguras, chajjas, cusped arches, jharokhas, chhatris,
 * bastions, havelis, temple spires, stepwells and the observatory's great sundial.
 * Everything is built from front-facing polygons whose normals describe the real 3D form.
 */

export const STONE = hex('#d6a75e');
export const STONE_LIGHT = hex('#e4bb72');
export const STONE_DEEP = hex('#b9864a');
export const WOOD = hex('#4b2c1a');
export const RECESS = hex('#3a2416');

const UP: V3 = [0, 0.92, 0.39];
const DOWN: V3 = [0, -0.7, 0.71];
const FRONT: V3 = [0, 0, 1];

export const st = (color: V3, extra: Partial<Style> = {}): Style => ({ color, mat: MAT.stone, ...extra });
export const plain = (color: V3, extra: Partial<Style> = {}): Style => ({ color, mat: MAT.plain, ...extra });

/** Pointed, optionally cusped, arch outline from the springing line upward. */
export function archPts(cx: number, y: number, w: number, h: number, cusps = 0, seg = 18): number[] {
  const pts: number[] = [];
  const spring = y + h - w * 0.62; // where the curve starts
  pts.push(cx - w / 2, y, cx + w / 2, y, cx + w / 2, spring);
  for (let i = 1; i < seg; i++) {
    const u = i / seg; // right side up to apex, then left side down
    const ang = u * Math.PI;
    // two-centred pointed arch: blend a circle with a lifted apex
    let px = cx + (Math.cos(ang) * w) / 2;
    let py = spring + Math.sin(ang) * w * 0.5 + Math.pow(Math.sin(ang), 6) * w * 0.12;
    if (cusps > 0) {
      const c = Math.abs(Math.sin(ang * cusps)) * w * 0.05;
      px -= Math.cos(ang) * c;
      py -= Math.sin(ang) * c;
    }
    pts.push(px, py);
  }
  pts.push(cx - w / 2, spring);
  return pts;
}

export function recess(m: Mesh, pts: number[], lit = 0, depth = 0.3) {
  m.poly(pts, { color: RECESS, mat: MAT.plain, ao: depth, em: lit });
}

/** Row of Rajput merlons: a rectangle topped with a pointed leaf. */
export function kanguras(m: Mesh, x0: number, x1: number, y: number, size: number, color: V3) {
  const gap = size * 0.38;
  const n = Math.max(1, Math.floor((x1 - x0 + gap) / (size + gap)));
  const used = n * size + (n - 1) * gap;
  let x = x0 + (x1 - x0 - used) / 2;
  for (let i = 0; i < n; i++) {
    const pts = [x, y, x + size, y, x + size, y + size * 0.6];
    for (let k = 1; k < 8; k++) {
      const u = k / 8;
      const px = x + size - u * size;
      const py = y + size * 0.6 + Math.sin(u * Math.PI) * size * 0.55 + (1 - Math.abs(u - 0.5) * 2) * size * 0.25;
      pts.push(px, py);
    }
    pts.push(x, y + size * 0.6);
    m.poly(pts, st(color));
    x += size + gap;
  }
}

/** Sloping stone eave with brackets: a lit top lip and a shaded underside. */
export function chajja(m: Mesh, x: number, y: number, w: number, over = 6, color: V3 = STONE, brackets = true) {
  const t = 3;
  m.quad(x - over, y, x + w + over, y, x + w + over, y + t, x - over, y + t, plain(color, { n: UP }));
  m.quad(x - over, y, x + w + over, y, x + w + 1, y - 7, x - 1, y - 7, plain(color, { n: DOWN, ao: 0.75 }));
  if (brackets) {
    const n = Math.max(2, Math.round(w / 18));
    for (let i = 0; i <= n; i++) {
      const bx = x + (w * i) / n;
      m.poly([bx - 2, y - 7, bx + 2, y - 7, bx + 1, y - 15, bx - 1, y - 15], plain(mix3(color, RECESS, 0.25), { n: DOWN }));
    }
  }
}

export function cornice(m: Mesh, x: number, y: number, w: number, color: V3, h = 3) {
  m.quad(x - 2, y, x + w + 2, y, x + w + 2, y + h, x - 2, y + h, plain(color, { n: UP }));
  m.quad(x - 1, y - 2, x + w + 1, y - 2, x + w + 2, y, x - 2, y, plain(color, { n: DOWN, ao: 0.7 }));
}

/** Small brass-and-stone finial (kalash). */
export function kalash(m: Mesh, cx: number, y: number, s: number, color: V3) {
  m.ball(cx, y + s * 0.5, s * 0.55, plain(color));
  m.ball(cx, y + s * 1.25, s * 0.38, plain(color));
  m.poly([cx - s * 0.12, y + s * 1.5, cx + s * 0.12, y + s * 1.5, cx, y + s * 2.4], plain(color));
}

/** Row of lotus petals at the base of a dome. */
export function lotus(m: Mesh, cx: number, y: number, w: number, color: V3) {
  const n = Math.max(5, Math.round(w / 7));
  for (let i = 0; i < n; i++) {
    const px = cx - w / 2 + (w * (i + 0.5)) / n;
    const pw = w / n;
    const a = ((i + 0.5) / n - 0.5) * Math.PI;
    m.poly([px - pw * 0.55, y, px + pw * 0.55, y, px, y + pw * 0.9], plain(color, { n: [Math.sin(a) * 0.7, 0.3, Math.cos(a) * 0.7] }));
  }
}

export interface ChhatriOpts {
  bays?: number;
  dome?: 'hemi' | 'onion';
  plinth?: number;
  color?: V3;
  lit?: number;
}

/** Open domed pavilion on pillars: the defining silhouette of the Thar. */
export function chhatri(m: Mesh, cx: number, y: number, w: number, o: ChhatriOpts = {}) {
  const color = o.color ?? STONE;
  const bays = o.bays ?? 1;
  const ph = o.plinth ?? w * 0.22;
  // plinth with two steps
  if (ph > 0) {
    m.rect(cx - w * 0.62, y, w * 1.24, ph * 0.5, st(color));
    m.rect(cx - w * 0.56, y + ph * 0.5, w * 1.12, ph * 0.5, st(color));
    cornice(m, cx - w * 0.56, y + ph - 2, w * 1.12, color, 2);
  }
  const by = y + ph;
  const hh = w * 0.72; // pillar height
  const pw = Math.max(1.5, w * 0.07);
  const bw = w / bays;
  for (let b = 0; b < bays; b++) {
    const x0 = cx - w / 2 + b * bw;
    const hole = archPts(x0 + bw / 2, by - 1, bw - pw * 2, hh * 0.92, 3);
    m.poly([x0, by, x0 + bw, by, x0 + bw, by + hh, x0, by + hh], st(color), [hole]);
  }
  for (let b = 0; b <= bays; b++) {
    const px = cx - w / 2 + b * bw;
    m.cylinder(px + (b === 0 ? pw / 2 : b === bays ? -pw / 2 : 0), by, pw, hh * 0.8, plain(color), 5);
  }
  chajja(m, cx - w / 2, by + hh, w, w * 0.12, color);
  const dy = by + hh + 3;
  m.rect(cx - w * 0.42, dy, w * 0.84, w * 0.08, st(color));
  lotus(m, cx, dy + w * 0.08, w * 0.84, color);
  const domeH = o.dome === 'onion' ? w * 0.62 : w * 0.46;
  m.dome(cx, dy + w * 0.08, w * 0.84, domeH, plain(color), o.dome ?? 'hemi', 12, 8);
  kalash(m, cx, dy + w * 0.08 + domeH - 1, Math.max(2, w * 0.07), color);
}

/** Projecting balcony window with a corbelled base and curved roof. */
export function jharokha(m: Mesh, cx: number, y: number, w: number, color: V3 = STONE, lit = 0) {
  // corbels
  for (let i = 0; i < 3; i++) {
    const ww = w * (0.94 - i * 0.12);
    m.quad(cx - ww / 2, y - i * 3.2, cx + ww / 2, y - i * 3.2, cx + ww / 2 - 1.5, y - (i + 1) * 3.2, cx - ww / 2 + 1.5, y - (i + 1) * 3.2, plain(color, { n: [0, -0.3, 0.95], ao: 0.92 - i * 0.05 }));
    m.rect(cx - ww / 2, y - (i + 1) * 3.2, ww, 0.6, { color: RECESS, mat: MAT.plain, ao: 0.6 });
  }
  for (const s of [-0.32, 0, 0.32]) m.poly([cx + s * w - 1.5, y - 9.6, cx + s * w + 1.5, y - 9.6, cx + s * w, y - 15], plain(color, { n: [0, -0.3, 0.95] }));
  // floor slab and body
  m.quad(cx - w / 2 - 2, y, cx + w / 2 + 2, y, cx + w / 2 + 2, y + 3, cx - w / 2 - 2, y + 3, plain(color, { n: UP }));
  const h = w * 0.78;
  const n = w > 30 ? 3 : 2;
  const bw = (w - 4) / n;
  const holes: number[][] = [];
  for (let i = 0; i < n; i++) holes.push(archPts(cx - w / 2 + 2 + bw * (i + 0.5), y + 5, bw * 0.72, h * 0.82, 2, 12));
  m.poly([cx - w / 2, y + 3, cx + w / 2, y + 3, cx + w / 2, y + 3 + h, cx - w / 2, y + 3 + h], st(color), holes);
  for (const hp of holes) recess(m, hp, lit, 0.35);
  // low jali rail
  m.rect(cx - w / 2, y + 3, w, h * 0.18, plain(mix3(color, RECESS, 0.15), { ao: 0.9 }));
  chajja(m, cx - w / 2, y + 3 + h, w, 5, color, false);
  // bangaldar roof: a low curved vault
  m.dome(cx, y + 6 + h, w * 0.95, w * 0.3, plain(color), 'flat', 10, 5);
  kalash(m, cx, y + 5 + h + w * 0.3, 2.2, color);
}

/** Lattice screen: a grid of small dark diamonds. */
export function jali(m: Mesh, x: number, y: number, w: number, h: number, color: V3, cell = 6, lit = 0) {
  m.rect(x, y, w, h, plain(mix3(color, RECESS, 0.1)));
  for (let yy = y + cell / 2; yy < y + h - cell / 3; yy += cell) {
    for (let xx = x + cell / 2; xx < x + w - cell / 3; xx += cell) {
      const s = cell * 0.32;
      m.poly([xx, yy - s, xx + s, yy, xx, yy + s, xx - s, yy], { color: RECESS, mat: MAT.plain, ao: 0.5, em: lit * 0.7 });
    }
  }
}

/** Round fort bastion with a battered profile, merlons and arrow slits. */
export function bastion(m: Mesh, cx: number, y: number, w: number, h: number, color: V3 = STONE, opts: { cap?: boolean; slits?: boolean } = {}) {
  m.cylinder(cx, y, w, h, st(color), 16, 0.88);
  const tw = w * 0.88;
  // band below the parapet
  m.cylinder(cx, y + h - 2, tw * 1.04, 5, plain(color), 12, 1);
  m.quad(cx - tw * 0.52, y + h + 3, cx + tw * 0.52, y + h + 3, cx + tw * 0.52, y + h + 5, cx - tw * 0.52, y + h + 5, plain(color, { n: UP }));
  m.cylinder(cx, y + h + 5, tw, w * 0.1, st(color), 12, 1);
  kanguras(m, cx - tw / 2, cx + tw / 2, y + h + 5 + w * 0.1, Math.max(3, w * 0.075), color);
  if (opts.slits !== false) {
    for (let k = 0; k < 3; k++) {
      for (let j = -1; j <= 1; j++) {
        const sx = cx + j * w * 0.22;
        const sy = y + h * (0.35 + k * 0.2);
        m.rect(sx - 0.8, sy, 1.6, Math.max(3, h * 0.06), { color: RECESS, mat: MAT.plain, ao: 0.4 });
      }
    }
  }
  if (opts.cap) chhatri(m, cx, y + h + 5 + w * 0.1, w * 0.42, { plinth: 2, color });
}

/** Straight crenellated curtain wall. */
export function wall(m: Mesh, x: number, y: number, w: number, h: number, color: V3 = STONE, merlon = 5) {
  m.rect(x, y, w, h, st(color));
  cornice(m, x, y + h, w, color, 2);
  kanguras(m, x, x + w, y + h + 2, merlon, color);
}

/** Jain temple shikhara: a ribbed curvilinear spire with an amalaka disc. */
export function shikhara(m: Mesh, cx: number, y: number, w: number, h: number, color: V3 = STONE_LIGHT) {
  const seg = 12;
  for (let i = 0; i < seg; i++) {
    const v0 = i / seg, v1 = (i + 1) / seg;
    const r = (v: number) => (w / 2) * (1 - Math.pow(v, 1.6) * 0.8);
    const y0 = y + v0 * h, y1 = y + v1 * h;
    const tilt = 0.25 + v0 * 0.5;
    m.quad(cx - r(v0), y0, cx, y0, cx, y1, cx - r(v1), y1, plain(color), [-0.7, tilt, 0.6], [0, tilt, 1], [0, tilt, 1], [-0.7, tilt, 0.6]);
    m.quad(cx, y0, cx + r(v0), y0, cx + r(v1), y1, cx, y1, plain(color), [0, tilt, 1], [0.7, tilt, 0.6], [0.7, tilt, 0.6], [0, tilt, 1]);
    // horizontal ribs
    m.rect(cx - r(v0) - 0.5, y0, r(v0) * 2 + 1, 1.4, plain(mix3(color, RECESS, 0.2), { n: UP }));
  }
  // smaller attached spires (urushringas)
  for (const s of [-1, 1]) {
    const sx = cx + s * w * 0.32;
    for (let i = 0; i < 6; i++) {
      const v0 = i / 6, v1 = (i + 1) / 6;
      const rr = (v: number) => (w * 0.17) * (1 - Math.pow(v, 1.5) * 0.85);
      m.quad(sx - rr(v0), y + v0 * h * 0.55, sx + rr(v0), y + v0 * h * 0.55, sx + rr(v1), y + v1 * h * 0.55, sx - rr(v1), y + v1 * h * 0.55, plain(color, { n: [s * 0.4, 0.3, 0.86] }));
    }
  }
  m.disc(cx, y + h + 1, w * 0.16, w * 0.06, plain(color));
  kalash(m, cx, y + h + 2, w * 0.06, hex('#c9a04a'));
  m.rect(cx - w * 0.55, y - h * 0.18, w * 1.1, h * 0.18, st(color));
}

export interface HaveliOpts {
  floors?: number;
  color?: V3;
  lit?: number;
  jharokhas?: boolean;
  door?: boolean;
  seed?: number;
  roofChhatris?: boolean;
}

/** Merchant mansion facade: floors of jharokhas, jali screens and a carved parapet. */
export function haveli(m: Mesh, x: number, y: number, w: number, o: HaveliOpts = {}) {
  const color = o.color ?? STONE;
  const floors = o.floors ?? 3;
  const fh = 38;
  const H = floors * fh + 10;
  m.rect(x, y, w, H, st(color));
  // a slightly deeper plinth
  m.rect(x - 3, y, w + 6, 10, st(mix3(color, STONE_DEEP, 0.4)));
  cornice(m, x - 3, y + 10, w + 6, color, 2);
  const seed = o.seed ?? 1;
  const r = (k: number) => {
    const v = Math.sin((seed * 97.3 + k) * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let f = 0; f < floors; f++) {
    const fy = y + 10 + f * fh;
    if (f > 0) cornice(m, x, fy, w, color, 2.5);
    const n = Math.max(1, Math.round(w / 46));
    for (let i = 0; i < n; i++) {
      const cx = x + (w * (i + 0.5)) / n;
      const lit = r(f * 10 + i) > 0.45 ? o.lit ?? 0 : 0;
      if (f === 0 && o.door !== false && i === Math.floor(n / 2)) {
        const dw = 20;
        const hole = archPts(cx, fy, dw, 30, 2);
        recess(m, hole, lit * 0.6, 0.45);
        m.poly(archPts(cx, fy, dw - 5, 26, 0), plain(WOOD, { ao: 0.75 }));
        continue;
      }
      if (f > 0 && o.jharokhas !== false && (i + f) % 2 === 0) {
        jharokha(m, cx, fy + 6, 24, color, lit);
      } else {
        const hole = archPts(cx, fy + 8, 12, 22, 2, 12);
        recess(m, hole, lit, 0.35);
        jali(m, cx - 9, fy + 4, 18, 4, color, 4);
      }
    }
  }
  cornice(m, x - 2, y + H, w + 4, color, 3);
  m.rect(x, y + H + 3, w, 6, st(color));
  kanguras(m, x, x + w, y + H + 9, 5, color);
  if (o.roofChhatris) {
    chhatri(m, x + 10, y + H + 9, 16, { plinth: 3, color });
    chhatri(m, x + w - 10, y + H + 9, 16, { plinth: 3, color });
  }
}

/** A plain flat-roofed house, for distant towns and villages. */
export function house(m: Mesh, x: number, y: number, w: number, h: number, color: V3, lit = 0, seed = 1) {
  m.rect(x, y, w, h, plain(color));
  m.quad(x - 1, y + h, x + w + 1, y + h, x + w + 1, y + h + 2, x - 1, y + h + 2, plain(color, { n: UP }));
  const rr = Math.sin(seed * 78.233) * 43758.5453;
  const k = rr - Math.floor(rr);
  if (w > 10) {
    const ww = Math.min(6, w * 0.25);
    m.rect(x + w * 0.5 - ww / 2, y + h * 0.4, ww, h * 0.35, { color: RECESS, mat: MAT.plain, ao: 0.4, em: k > 0.4 ? lit : 0 });
  }
}

/** Stepped pyramid of stairs: the repeating module of a stepwell wall. */
export function stairModule(m: Mesh, x: number, y: number, w: number, h: number, steps: number, color: V3, riser = 0.25, ao = 0.85) {
  const sw = w / 2 / steps, sh = h / steps;
  for (let i = 0; i < steps; i++) {
    const x0 = x + i * sw, x1 = x + w - i * sw;
    const yy = y + i * sh;
    // tread (lit, faces up) and riser (front, darker)
    m.quad(x0, yy + sh * 0.7, x1, yy + sh * 0.7, x1 - sw, yy + sh, x0 + sw, yy + sh, plain(color, { n: UP, ao: Math.min(1, ao + 0.15) }));
    m.rect(x0, yy, x1 - x0, sh * 0.7, plain(mix3(color, RECESS, riser), { ao }));
  }
}

/** Back wall of a stepwell: levels of interlocking stair flights. */
export function stepwellWall(m: Mesh, x: number, top: number, w: number, depth: number, color: V3) {
  m.rect(x, top - depth, w, depth, plain(mix3(color, RECESS, 0.72), { ao: 0.6 }));
  const rows = Math.floor(depth / 26);
  for (let r = 0; r < rows; r++) {
    const yy = top - depth + r * 26 + 2;
    const u = r / Math.max(1, rows - 1); // 0 at the water, 1 at the rim
    const ao = 0.45 + 0.5 * u; // the pit darkens as it descends
    // ledge
    m.quad(x, yy + 22, x + w, yy + 22, x + w, yy + 24, x, yy + 24, plain(color, { n: UP, ao: Math.min(1, ao + 0.2) }));
    m.rect(x, yy + 20, w, 2, plain(mix3(color, RECESS, 0.6), { ao }));
    const mw = 52;
    const off = r % 2 === 0 ? 0 : mw / 2;
    for (let xx = x - mw + off; xx < x + w; xx += mw) {
      const a = Math.max(x, xx), b = Math.min(x + w, xx + mw);
      if (b - a < mw * 0.98) continue;
      stairModule(m, a + 2, yy, mw - 4, 22, 5, color, 0.48, ao);
    }
  }
}

/** The great equinoctial sundial, seen from the side: a right triangle carrying a staircase. */
export function samratYantra(m: Mesh, x: number, y: number, base: number, h: number, color: V3) {
  // body
  m.poly([x, y, x + base, y, x + base, y + h], st(color));
  // stair treads along the hypotenuse
  const n = Math.floor(h / 10);
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n;
    const x0 = x + base * u0, x1 = x + base * u1;
    const y0 = y + h * u0;
    m.quad(x0, y0, x1, y0, x1, y0 + h / n, x0 + 0.5, y0 + h / n * 0.2, plain(mix3(color, STONE_LIGHT, 0.4), { n: UP }));
  }
  // vertical face shaded, with a scale of hour marks
  m.quad(x + base - 6, y, x + base, y, x + base, y + h, x + base - 6, y + h - 6 * (h / base), plain(mix3(color, RECESS, 0.3), { n: [1, 0, 0.3] }));
  for (let k = 1; k < 12; k++) {
    const yy = y + (h * k) / 12;
    m.rect(x + base - 5, yy, 4, 0.8, { color: RECESS, mat: MAT.plain, ao: 0.6 });
  }
  // arched openings at the foot
  for (let k = 0; k < 4; k++) {
    const cx = x + base * (0.45 + k * 0.13);
    recess(m, archPts(cx, y, base * 0.07, base * 0.11, 2), 0, 0.4);
  }
  // small cupola at the apex
  chhatri(m, x + base - 14, y + h, 22, { plinth: 2, color });
}

/** Quarter-ring scale of the sundial, drawn flat behind it. */
export function quadrantArc(m: Mesh, cx: number, cy: number, r: number, thick: number, a0: number, a1: number, color: V3) {
  const seg = 40;
  for (let i = 0; i < seg; i++) {
    const t0 = a0 + ((a1 - a0) * i) / seg, t1 = a0 + ((a1 - a0) * (i + 1)) / seg;
    m.quad(
      cx + Math.cos(t0) * r, cy + Math.sin(t0) * r, cx + Math.cos(t1) * r, cy + Math.sin(t1) * r,
      cx + Math.cos(t1) * (r - thick), cy + Math.sin(t1) * (r - thick), cx + Math.cos(t0) * (r - thick), cy + Math.sin(t0) * (r - thick),
      plain(color, { n: [Math.cos(t0) * 0.3, 0.6, 0.74] }),
    );
    if (i % 2 === 0) {
      const tx = cx + Math.cos(t0) * (r - thick * 0.5), ty = cy + Math.sin(t0) * (r - thick * 0.5);
      m.rect(tx - 0.5, ty - 0.5, 1, 1, { color: RECESS, mat: MAT.plain });
    }
  }
}

/** Gateway (pol): a tall arch between two bastions. */
export function pol(m: Mesh, cx: number, y: number, w: number, h: number, color: V3 = STONE, lit = 0) {
  const hole = archPts(cx, y, w * 0.42, h * 0.7, 3);
  m.poly([cx - w / 2, y, cx + w / 2, y, cx + w / 2, y + h, cx - w / 2, y + h], st(color), [hole]);
  // the passage seen through the arch is shadowed, and open: draw only a dark band at the very top
  m.poly(archPts(cx, y + h * 0.48, w * 0.42 - 2, h * 0.22, 3), { color: RECESS, mat: MAT.plain, ao: 0.3 });
  jharokha(m, cx, y + h * 0.78, w * 0.3, color, lit);
  cornice(m, cx - w / 2, y + h, w, color, 3);
  kanguras(m, cx - w / 2, cx + w / 2, y + h + 3, 6, color);
  bastion(m, cx - w / 2 - w * 0.12, y, w * 0.3, h * 1.12, color, { cap: true });
  bastion(m, cx + w / 2 + w * 0.12, y, w * 0.3, h * 1.12, color, { cap: true });
}

export { FRONT };
