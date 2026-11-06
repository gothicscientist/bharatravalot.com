import { Mesh, MAT, type V3, hex, mix3, rng, fbm1, type Style } from '../mesh';

export const SAND = hex('#dcae6c');
export const SAND_DEEP = hex('#c68f52');
export const BARK = hex('#4a3426');
export const LEAF = hex('#6b7442');
export const LEAF_DRY = hex('#8a8048');

/**
 * A dune seen from the side. The sharp crest line splits the body into a windward face and a
 * slip face with different normals, so dunes catch the low sun on one side and drop into
 * shadow on the other, the way they do at Sam and Khuri.
 */
export function dune(m: Mesh, cx: number, base: number, w: number, h: number, color: V3, seed = 1, skew = 0.15, bottom = base - 4) {
  const r = rng(seed * 7919);
  const left = cx - w / 2, right = cx + w / 2;
  const crestX = cx + w * skew * (r() - 0.3);
  const seg = 28;
  const top: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const x = left + (w * i) / seg;
    let y: number;
    if (x <= crestX) {
      const u = (x - left) / (crestX - left);
      y = base + h * Math.pow(Math.sin((u * Math.PI) / 2), 1.6);
    } else {
      const u = (x - crestX) / (right - crestX);
      y = base + h * (1 - Math.pow(u, 0.75)) * (1 - u * 0.15);
    }
    y += (fbm1(x * 0.01, seed) - 0.5) * h * 0.08;
    top.push([x, y]);
  }
  // crest-to-foot ridge line, sinuous
  const ridge: [number, number][] = [];
  const crestY = base + h;
  const footX = crestX + w * (0.1 + r() * 0.12);
  for (let k = 0; k <= 10; k++) {
    const u = k / 10;
    ridge.push([crestX + (footX - crestX) * Math.pow(u, 0.8) + Math.sin(u * 3 + seed) * w * 0.02, crestY - (crestY - bottom) * u]);
  }
  // windward (left) polygon: top until crest, then down the ridge, then bottom
  const lit: Style = { color, mat: MAT.sand, n: [-0.42, 0.62, 0.66] };
  const shade: Style = { color: mix3(color, SAND_DEEP, 0.3), mat: MAT.sand, n: [0.62, 0.42, 0.66] };
  const A: number[] = [];
  for (const p of top) if (p[0] <= crestX) A.push(p[0], p[1]);
  for (const p of ridge) A.push(p[0], p[1]);
  A.push(ridge[ridge.length - 1][0], bottom, left, bottom);
  m.poly(A, lit);
  const B: number[] = [];
  for (let k = ridge.length - 1; k >= 0; k--) B.push(ridge[k][0], ridge[k][1]);
  for (const p of top) if (p[0] > crestX) B.push(p[0], p[1]);
  B.push(right, bottom, ridge[ridge.length - 1][0], bottom);
  m.poly(B, shade);
  // bright crest lip
  const lip: [number, number][] = top.filter((p) => Math.abs(p[0] - crestX) < w * 0.18);
  if (lip.length > 2) m.ribbon(lip, 1.2, { color: mix3(color, hex('#fff0c8'), 0.3), mat: MAT.sand, n: [0, 1, 0.3] }, false);
}

/** Endless gently rolling ground band for distant layers. */
export function groundBand(m: Mesh, x0: number, x1: number, base: number, amp: number, freq: number, color: V3, seed: number, mat: number = MAT.sand, bottom = -3000) {
  const step = 24;
  for (let x = x0; x < x1; x += step) {
    const y0 = base + (fbm1(x * freq, seed) - 0.5) * amp * 2;
    const y1 = base + (fbm1((x + step) * freq, seed) - 0.5) * amp * 2;
    const slope = (y1 - y0) / step;
    const n: V3 = [-slope * 0.8, 0.8, 0.6];
    m.quad(x, bottom, x + step, bottom, x + step, y1, x, y0, { color, mat, n });
  }
}

function branch(m: Mesh, x: number, y: number, ang: number, len: number, w: number, depth: number, r: () => number, tips: [number, number][], color: V3, sway: number) {
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  const mx = (x + x2) / 2 + (r() - 0.5) * len * 0.2, my = (y + y2) / 2 + (r() - 0.5) * len * 0.2;
  m.ribbon([[x, y], [mx, my], [x2, y2]], [w, w * 0.8, w * 0.6], { color, mat: MAT.plain, ao: 0.9 }, true, () => sway * (depth < 2 ? 0.4 : 0.15));
  if (depth <= 0 || len < 4) {
    tips.push([x2, y2]);
    return;
  }
  const k = 2 + (r() > 0.6 ? 1 : 0);
  for (let i = 0; i < k; i++) {
    const a = ang + (r() - 0.5) * 1.2 + (i - (k - 1) / 2) * 0.5;
    branch(m, x2, y2, a, len * (0.62 + r() * 0.2), w * 0.62, depth - 1, r, tips, color, sway);
  }
}

/** Khejri tree: twisted trunk and a wind-shaped, flat crown of small leaves. */
export function khejri(m: Mesh, x: number, y: number, s: number, seed: number, opts: { leaf?: V3; bark?: V3; sway?: number } = {}) {
  const r = rng(seed * 31 + 7);
  const tips: [number, number][] = [];
  const bark = opts.bark ?? BARK;
  const sway = opts.sway ?? 1;
  branch(m, x, y, Math.PI / 2 + (r() - 0.5) * 0.3, s * 0.42, s * 0.05, 3, r, tips, bark, sway);
  const leaf = opts.leaf ?? LEAF;
  for (const [tx, ty] of tips) {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const cx = tx + (r() - 0.5) * s * 0.14, cy = ty + (r() - 0.3) * s * 0.07;
      const rx = s * (0.07 + r() * 0.05), ry = rx * (0.45 + r() * 0.2);
      const c = mix3(leaf, LEAF_DRY, r() * 0.5);
      blob(m, cx, cy, rx, ry, { color: c, mat: MAT.leaf, sway: sway * (1.2 + r()) }, seed + i);
    }
  }
}

/** Irregular rounded blob with an upward-bulging normal field. */
export function blob(m: Mesh, cx: number, cy: number, rx: number, ry: number, s: Style, seed = 1) {
  const seg = 14;
  const r = rng(seed * 13 + 3);
  const rad: number[] = [];
  for (let i = 0; i < seg; i++) rad.push(0.8 + r() * 0.35);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const r0 = rad[i], r1 = rad[(i + 1) % seg];
    m.v(cx, cy + ry * 0.1, [0, 0.4, 0.92], s);
    m.v(cx + Math.cos(a0) * rx * r0, cy + Math.sin(a0) * ry * r0, [Math.cos(a0) * 0.75, Math.sin(a0) * 0.75 + 0.15, 0.55], s);
    m.v(cx + Math.cos(a1) * rx * r1, cy + Math.sin(a1) * ry * r1, [Math.cos(a1) * 0.75, Math.sin(a1) * 0.75 + 0.15, 0.55], s);
  }
}

/** Desert grass: a fan of fine blades that move with the wind. */
export function grass(m: Mesh, x: number, y: number, s: number, seed: number, color: V3 = hex('#a28a52')) {
  const r = rng(seed * 101 + 1);
  const n = 5 + Math.floor(r() * 6);
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + (r() - 0.5) * 1.3;
    const l = s * (0.5 + r() * 0.6);
    const tx = x + Math.cos(a) * l, ty = y + Math.sin(a) * l;
    const c = mix3(color, hex('#d8c48a'), r() * 0.5);
    m.v(x - 0.8, y, [0, 0.5, 0.85], { color: c, mat: MAT.plain }, 0);
    m.v(x + 0.8, y, [0, 0.5, 0.85], { color: c, mat: MAT.plain }, 0);
    m.v(tx, ty, [Math.cos(a) * 0.5, 0.6, 0.6], { color: c, mat: MAT.plain }, 2.5 + r() * 2);
  }
}

export function rock(m: Mesh, x: number, y: number, w: number, h: number, color: V3, seed: number) {
  const r = rng(seed * 17 + 5);
  const pts: number[] = [x - w / 2, y];
  const n = 7;
  for (let i = 1; i < n; i++) {
    const u = i / n;
    pts.push(x - w / 2 + w * u, y + Math.sin(u * Math.PI) * h * (0.7 + r() * 0.4));
  }
  pts.push(x + w / 2, y);
  // two faces split down the middle for a lit side and a shaded side
  const mid = Math.floor(pts.length / 4) * 2;
  m.poly(pts.slice(0, mid + 2).concat([pts[mid], y]), { color, mat: MAT.stone, n: [-0.5, 0.6, 0.62] });
  m.poly([pts[mid], y].concat(pts.slice(mid)), { color: mix3(color, hex('#3a2a20'), 0.2), mat: MAT.stone, n: [0.55, 0.5, 0.66] });
}

/** Dromedary in profile, the ship of the Thar. `pose` 0 = standing, 1 = sitting (legs folded). */
export function camel(m: Mesh, x: number, y: number, s: number, color: V3 = hex('#8a5a34'), pose = 0, dir = 1, saddle?: V3) {
  const lift = pose === 1 ? -0.42 : 0;
  const X = (dx: number) => x + dx * s * dir;
  const Y = (dy: number) => y + (dy + lift) * s;
  const body: Style = { color, mat: MAT.plain };
  const far: Style = { color: mix3(color, hex('#2a1a10'), 0.25), mat: MAT.plain };
  const leg = (st: Style, a: [number, number], k: [number, number], f: [number, number], w: number) => {
    const pts: [number, number][] = [[X(a[0]), Y(a[1])], [X(k[0]), Y(k[1])], [X(f[0]), y + Math.max(0, (f[1] + lift)) * s]];
    m.ribbon(pts, [s * w, s * w * 0.55, s * w * 0.5], st);
    m.ball(X(k[0]), Y(k[1]), s * w * 0.7, st);
  };
  if (pose === 0) {
    leg(far, [0.2, 0.58], [0.24, 0.3], [0.22, 0], 0.045);
    leg(far, [-0.38, 0.6], [-0.42, 0.3], [-0.38, 0], 0.05);
  }
  const outline: [number, number][] = [
    [-0.45, 0.6], [-0.52, 0.72], [-0.47, 0.86], [-0.3, 0.93], [-0.16, 1.05], [-0.02, 1.11], [0.12, 1.01], [0.25, 0.91],
    [0.36, 0.86], [0.48, 0.74], [0.58, 0.71], [0.64, 0.82], [0.67, 0.97], [0.77, 1.01], [0.9, 0.95], [0.88, 0.88],
    [0.75, 0.88], [0.65, 0.7], [0.56, 0.59], [0.43, 0.6], [0.34, 0.58], [0.1, 0.51], [-0.2, 0.52],
  ];
  const pts: number[] = [];
  for (const [a, b] of outline) pts.push(X(a), Y(b));
  m.poly(pts, body);
  // hump catches the light
  m.dome(X(-0.03), Y(0.92), s * 0.42, s * 0.18, body, 'hemi', 8, 4);
  m.ball(X(0.74), Y(0.96), s * 0.012, { color: hex('#1a100a'), mat: MAT.plain });
  if (pose === 0) {
    leg(body, [0.28, 0.58], [0.3, 0.3], [0.31, 0], 0.05);
    leg(body, [-0.32, 0.6], [-0.36, 0.3], [-0.31, 0], 0.055);
  } else {
    // folded legs tucked beneath the body
    m.poly([X(-0.46), y, X(0.4), y, X(0.36), Y(0.56), X(-0.42), Y(0.6)], far);
    m.ribbon([[X(0.18), y + s * 0.05], [X(0.44), y + s * 0.06]], s * 0.045, body);
    m.ribbon([[X(-0.44), y + s * 0.05], [X(-0.2), y + s * 0.06]], s * 0.05, body);
  }
  if (saddle) {
    const sc: Style = { color: saddle, mat: MAT.cloth };
    m.poly([X(-0.24), Y(0.98), X(0.18), Y(0.97), X(0.2), Y(0.68), X(-0.26), Y(0.7)], sc);
    m.rect(Math.min(X(-0.26), X(0.2)), Y(0.68), s * 0.46, s * 0.04, { color: hex('#f2c230'), mat: MAT.cloth });
    for (let k = 0; k < 5; k++) m.ribbon([[X(-0.24 + k * 0.1), Y(0.68)], [X(-0.24 + k * 0.1), Y(0.6)]], s * 0.008, { color: hex('#f2c230'), mat: MAT.cloth, sway: 1 });
  }
}

/** A tongue of flame: layered teardrops whose tips flicker and sway. */
export function flame(m: Mesh, x: number, y: number, w: number, h: number, seed: number) {
  const r = rng(seed * 53 + 9);
  const layers: [string, number, number][] = [['#e8501a', 1, 0.4], ['#ff8a2a', 0.72, 0.7], ['#ffd27a', 0.42, 1]];
  for (const [c, k, em] of layers) {
    const ww = w * k, hh = h * (0.55 + 0.45 * k);
    const lean = (r() - 0.5) * w * 0.6;
    const seg = 10;
    const st: Style = { color: hex(c), mat: MAT.flame, em };
    for (let i = 0; i < seg; i++) {
      const v0 = i / seg, v1 = (i + 1) / seg;
      const half = (v: number) => (ww / 2) * Math.sin(Math.PI * Math.pow(1 - v, 0.9) * 0.5 + 0.35) * Math.pow(1 - v, 0.6);
      const cx0 = x + lean * v0 * v0, cx1 = x + lean * v1 * v1;
      const y0 = y + v0 * hh, y1 = y + v1 * hh;
      const sw0 = v0 * v0 * 5, sw1 = v1 * v1 * 5;
      const n: V3 = [0, 0, 1];
      m.v(cx0 - half(v0), y0, n, st, sw0); m.v(cx0 + half(v0), y0, n, st, sw0); m.v(cx1 + half(v1), y1, n, st, sw1);
      m.v(cx0 - half(v0), y0, n, st, sw0); m.v(cx1 + half(v1), y1, n, st, sw1); m.v(cx1 - half(v1), y1, n, st, sw1);
    }
  }
}

/** Flock geometry for a demoiselle crane (kurja), wings parameterised by phase. */
export function crane(m: Mesh, x: number, y: number, s: number, phase: number, color: V3) {
  const wing = Math.sin(phase) * 0.6;
  const st: Style = { color, mat: MAT.dark };
  m.ribbon([[x - s * 0.6, y], [x, y], [x + s * 0.5, y + s * 0.05]], [s * 0.05, s * 0.07, s * 0.03], st, false);
  m.poly([x - s * 0.1, y, x + s * 0.15, y, x - s * 0.05 + s * 0.2 * wing, y + s * 0.6 * wing + s * 0.05], st);
  m.poly([x - s * 0.1, y, x + s * 0.15, y, x + s * 0.05, y - s * 0.3 * wing], st);
}
