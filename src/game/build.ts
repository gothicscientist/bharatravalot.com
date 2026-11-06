// The hidden labyrinth: canyon corridors cut into the rock under the dunes, chambers along the
// way for each part of the work, and an open palace courtyard at the end.
import { Grid, M, SX, SY, SZ, hash } from './voxels';

export const G = 12; // floor level: the hero stands at y = G

export interface Relic { id: string; x: number; y: number; z: number; room: string; color: number }
export interface Room { id: string; name: string; x0: number; z0: number; x1: number; z1: number; spawn: [number, number, number] }
export interface Light { x: number; y: number; z: number; big?: boolean; noFlame?: boolean }
export interface Water { x0: number; z0: number; x1: number; z1: number; y: number }
export interface Prop { kind: string; x: number; y: number; z: number; grid?: Grid; data?: number[] }

export interface World {
  grid: Grid;
  relics: Relic[];
  rooms: Room[];
  lights: Light[];
  water: Water[];
  props: Prop[];
  spawn: [number, number, number];
}

// ------------------------------------------------------------------ noise
function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(xi, 0, zi), b = hash(xi + 1, 0, zi), c = hash(xi, 0, zi + 1), d = hash(xi + 1, 0, zi + 1);
  const u = s(xf), v = s(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x: number, z: number) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3) * 0.15;

let seed = 1337;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const ri = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));

// ------------------------------------------------------------------ builder
export function buildWorld(): World {
  const g = new Grid();
  const relics: Relic[] = [], rooms: Room[] = [], lights: Light[] = [], water: Water[] = [], props: Prop[] = [];

  // ---------- helpers
  const floorAt = (x0: number, z0: number, x1: number, z1: number, m: number | ((x: number, z: number) => number), y = G - 1) => {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      g.set(x, y, z, typeof m === 'number' ? m : m(x, z));
  };

  /** Axis-aligned wall with a base course, a trim band and crenellations. */
  const wall = (x0: number, z0: number, x1: number, z1: number, h: number, o: { y?: number; mat?: number; crenel?: boolean; t?: number; ruin?: number } = {}) => {
    const y0 = o.y ?? G, mat = o.mat ?? M.stone, t = o.t ?? 2;
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1) + (x0 === x1 ? t - 1 : 0);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1) + (z0 === z1 ? t - 1 : 0);
    for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) {
      // ruined walls lose their tops in a ragged line
      let hh = h;
      if (o.ruin) hh = Math.max(1, Math.round(h - o.ruin * fbm(x * 0.21 + z * 0.17, x * 0.05 - z * 0.13) * 1.6));
      for (let y = y0; y < y0 + hh; y++) {
        const k = y - y0;
        const m = k === 0 ? M.stoneDark : k === hh - 2 && !o.ruin ? M.stoneLight : mat;
        g.set(x, y, z, m);
      }
      if (o.crenel && !o.ruin) {
        const along = x0 === x1 ? z : x;
        if (along % 4 < 2) g.set(x, y0 + hh, z, M.stoneLight);
      }
    }
  };

  /** Cut a pointed-arch opening through whatever is at this spot. axis 'x' means the wall runs along x. */
  const arch = (cx: number, cz: number, axis: 'x' | 'z', w: number, h: number, depth = 2, y0 = G, trim = true) => {
    const hw = w / 2;
    const archH = Math.ceil(hw * 1.1);
    for (let d = -1; d < depth + 1; d++) for (let o = -Math.ceil(hw) - 1; o <= Math.ceil(hw); o++) {
      const off = o + 0.5;
      const inside = Math.abs(off) <= hw;
      const u = Math.abs(off) / hw;
      const top = h - archH + Math.round(archH * Math.sqrt(Math.max(0, 1 - u * u * 0.98)) * (1 - u * 0.25));
      const x = axis === 'x' ? cx + o : cx + d, z = axis === 'x' ? cz + d : cz + o;
      if (d < 0 || d >= depth) continue;
      if (inside) for (let y = y0; y < y0 + top; y++) g.set(x, y, z, 0);
      // trim stones along the arch edge
      if (trim) {
        const edge = inside ? y0 + top : -1;
        if (edge > 0 && g.get(x, edge, z)) g.set(x, edge, z, M.stoneLight);
        if (!inside && Math.abs(off) <= hw + 1) for (let y = y0; y < y0 + h - archH; y++) if (g.get(x, y, z)) g.set(x, y, z, M.stoneLight);
      }
    }
  };

  const pillar = (x: number, z: number, h: number, o: { y?: number; mat?: number; r?: number } = {}) => {
    const y0 = o.y ?? G, mat = o.mat ?? M.stoneLight, r = o.r ?? 1;
    g.box(x - r, y0, z - r, x + r, y0, z + r, M.stoneDark);
    g.box(x - r + (r > 0 ? 0 : 0), y0 + 1, z - r, x + r, y0 + h - 2, z + r, mat);
    if (r > 0) for (let y = y0 + 2; y < y0 + h - 2; y += 3) { g.set(x - r, y, z - r, M.stone); g.set(x + r, y, z + r, M.stone); }
    g.box(x - r - 1, y0 + h - 1, z - r - 1, x + r + 1, y0 + h - 1, z + r + 1, M.stoneLight);
  };

  /** A row of pillars carrying pointed arches. */
  const arcade = (x0: number, z0: number, x1: number, z1: number, h: number, step = 6, y0 = G) => {
    const alongX = z0 === z1;
    const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const s = alongX ? Math.sign(x1 - x0) : Math.sign(z1 - z0);
    for (let i = 0; i <= len; i++) {
      const x = alongX ? x0 + i * s : x0, z = alongX ? z0 : z0 + i * s;
      // beam
      g.box(x, y0 + h, z, x, y0 + h + 2, z, M.stone);
      g.set(x, y0 + h + 3, z, i % 2 ? M.stoneLight : 0);
      const k = i % step;
      if (k === 0) { g.box(x, y0, z, x, y0 + h - 1, z, M.stoneLight); g.set(x, y0, z, M.stoneDark); }
      else {
        const u = Math.abs(k - step / 2) / (step / 2);
        const drop = Math.round((1 - Math.sqrt(1 - u * u)) * 3.2);
        for (let y = y0 + h - drop; y < y0 + h; y++) g.set(x, y, z, M.stoneLight);
      }
    }
  };

  /** Voxel dome. kind: 'hemi' or 'onion'. */
  const dome = (cx: number, cy: number, cz: number, r: number, mat: number, kind: 'hemi' | 'onion' = 'hemi', finial = true) => {
    const H = kind === 'onion' ? r * 1.9 : r;
    for (let y = 0; y <= H; y++) {
      const t = y / H;
      let rr: number;
      if (kind === 'hemi') rr = r * Math.sqrt(Math.max(0, 1 - t * t));
      else rr = r * (t < 0.35 ? 1 + 0.18 * Math.sin((t / 0.35) * Math.PI * 0.5) : (1.18 * Math.pow(Math.max(0, 1 - (t - 0.35) / 0.65), 0.9)));
      for (let z = -Math.ceil(rr); z <= Math.ceil(rr); z++) for (let x = -Math.ceil(rr); x <= Math.ceil(rr); x++) {
        if (x * x + z * z <= rr * rr + 0.5) g.set(cx + x, cy + y, cz + z, (y + x + z) % 7 === 0 && mat === M.tileBlue ? M.tileTeal : mat);
      }
    }
    if (finial) { g.set(cx, cy + Math.ceil(H) + 1, cz, M.gold); g.set(cx, cy + Math.ceil(H) + 2, cz, M.gold); g.set(cx, cy + Math.ceil(H) + 3, cz, M.glowGold); }
  };

  const cylinder = (cx: number, cz: number, y0: number, h: number, r: number, mat: number, hollow = false) => {
    for (let y = y0; y < y0 + h; y++) for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
      const d = x * x + z * z;
      if (d <= r * r + 0.5 && (!hollow || d > (r - 1.6) * (r - 1.6))) g.set(cx + x, y, cz + z, mat);
    }
  };

  const tower = (cx: number, cz: number, h: number, r: number, o: { y?: number; dome?: number; onion?: boolean; windows?: boolean } = {}) => {
    const y0 = o.y ?? G;
    cylinder(cx, cz, y0, h, r, M.stone);
    cylinder(cx, cz, y0, 1, r + 1, M.stoneDark);
    // bands
    for (let y = y0 + 6; y < y0 + h; y += 7) cylinder(cx, cz, y, 1, r, M.stoneLight);
    // windows
    if (o.windows !== false) for (let y = y0 + 8; y < y0 + h - 3; y += 7) {
      for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { g.set(cx + dx, y, cz + dz, M.dark); g.set(cx + dx, y + 1, cz + dz, M.dark); }
    }
    // balcony and crown
    cylinder(cx, cz, y0 + h, 1, r + 1, M.stoneLight);
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      if (a % 2 === 0) g.set(cx + Math.round(Math.cos(ang) * (r + 1)), y0 + h + 1, cz + Math.round(Math.sin(ang) * (r + 1)), M.stoneLight);
    }
    if (o.dome) dome(cx, y0 + h + 1, cz, r - 1, o.dome, o.onion ? 'onion' : 'hemi');
  };

  /** Straight stairs rising one voxel per step. dir: +x, -x, +z, -z. */
  const stairs = (x: number, z: number, dir: 'px' | 'nx' | 'pz' | 'nz', w: number, rise: number, y0 = G, mat = M.stoneLight, run = 1) => {
    for (let s = 0; s < rise; s++) for (let r = 0; r < run; r++) for (let i = 0; i < w; i++) {
      const k = s * run + r;
      const [xx, zz] = dir === 'px' ? [x + k, z + i] : dir === 'nx' ? [x - k, z + i] : dir === 'pz' ? [x + i, z + k] : [x + i, z - k];
      g.box(xx, y0 - 1, zz, xx, y0 + s, zz, (_x, y) => (y === y0 + s ? mat : M.stoneDark));
    }
  };

  const palm = (x: number, z: number, h = 12, y0 = G) => {
    let px = x, pz = z;
    const lean = rnd() * Math.PI * 2;
    const lx = Math.cos(lean) * 0.18, lz = Math.sin(lean) * 0.18;
    for (let y = 0; y < h; y++) {
      g.set(Math.round(px), y0 + y, Math.round(pz), y % 3 === 0 ? M.wood : M.trunk);
      px += lx * (y / h) * 1.6; pz += lz * (y / h) * 1.6;
    }
    const tx = Math.round(px), tz = Math.round(pz), ty = y0 + h;
    g.box(tx - 1, ty - 1, tz - 1, tx + 1, ty, tz + 1, M.leafDark);
    g.set(tx + 1, ty - 2, tz, M.copper); g.set(tx - 1, ty - 2, tz + 1, M.copper);
    for (let a = 0; a < 7; a++) {
      const ang = (a / 7) * Math.PI * 2 + rnd() * 0.4;
      const L = 6 + ri(0, 2);
      for (let i = 1; i <= L; i++) {
        const fx = tx + Math.round(Math.cos(ang) * i), fz = tz + Math.round(Math.sin(ang) * i);
        const fy = ty + 1 - Math.round((i * i) / (L * 1.4));
        g.set(fx, fy, fz, i % 2 ? M.leaf : M.leafDark);
        if (i > 2 && i < L) g.set(fx + Math.round(Math.sin(ang)), fy - 1, fz - Math.round(Math.cos(ang)), M.leaf);
      }
    }
  };

  const torch = (x: number, y: number, z: number, post = false) => {
    if (post) { g.box(x, G, z, x, y - 1, z, M.wood); g.set(x, G, z, M.stoneDark); }
    g.set(x, y, z, M.copper);
    lights.push({ x: x + 0.5, y: y + 1.6, z: z + 0.5 });
  };
  const brazier = (x: number, z: number, y = G) => {
    g.box(x - 1, y, z - 1, x + 1, y, z + 1, M.stoneDark);
    g.box(x, y + 1, z, x, y + 1, z, M.copper);
    g.box(x - 1, y + 2, z - 1, x + 1, y + 2, z + 1, M.copper);
    g.set(x, y + 2, z, M.glowGold);
    lights.push({ x: x + 0.5, y: y + 4, z: z + 0.5, big: true });
  };

  const banner = (x: number, y: number, z: number, axis: 'x' | 'z', w: number, h: number, col: number) => {
    for (let k = 0; k < h; k++) for (let i = 0; i < w; i++) {
      const xx = axis === 'x' ? x + i : x, zz = axis === 'x' ? z : z + i;
      const edge = i === 0 || i === w - 1;
      const m = k === 0 ? M.gold : edge && k < h - 1 ? M.gold : k === Math.floor(h / 2) ? M.clothYellow : col;
      // pointed tail
      if (k === h - 1 && (i === 0 || i === w - 1)) continue;
      g.set(xx, y - k, zz, m);
    }
  };

  const pot = (x: number, z: number, y = G, m: number = M.stoneRed) => {
    g.set(x, y, z, m); g.set(x, y + 1, z, m); g.set(x, y + 2, z, M.stoneDark);
  };
  const crate = (x: number, z: number, y = G) => g.box(x, y, z, x + 1, y + 1, z + 1, M.wood);

  const drift = (cx: number, cz: number, r: number, h: number) => {
    for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + z * z) / r;
      if (d > 1) continue;
      const hh = Math.round((1 - d * d) * h + (hash(cx + x, 3, cz + z) - 0.5) * 0.8);
      const base = g.top(cx + x, cz + z, G + 20);
      if (base < G - 1 || base > G + 1) continue;
      for (let y = 0; y < hh; y++) if (!g.get(cx + x, base + y, cz + z)) g.set(cx + x, base + y, cz + z, M.sand);
    }
  };

  const rubble = (cx: number, cz: number, n: number, r = 4) => {
    for (let i = 0; i < n; i++) {
      const x = cx + ri(-r, r), z = cz + ri(-r, r);
      const y = g.top(x, z, G + 6);
      if (y >= G && y <= G + 1) g.set(x, y, z, rnd() > 0.5 ? M.stone : M.stoneBlock);
    }
  };

  const rug = (x0: number, z0: number, x1: number, z1: number, y = G - 1, m: number = M.rug) => floorAt(x0, z0, x1, z1, (x, z) => (x === x0 || x === x1 || z === z0 || z === z1 ? M.gold : m), y);

  const pedestal = (x: number, z: number, id: string, roomName: string, color = 0xffd27a, y = G) => {
    g.box(x - 2, y, z - 2, x + 2, y, z + 2, M.stoneDark);
    g.box(x - 1, y + 1, z - 1, x + 1, y + 1, z + 1, M.marble);
    g.set(x, y + 2, z, M.gold);
    g.set(x - 1, y + 2, z - 1, M.gold); g.set(x + 1, y + 2, z - 1, M.gold); g.set(x - 1, y + 2, z + 1, M.gold); g.set(x + 1, y + 2, z + 1, M.gold);
    relics.push({ id, x: x + 0.5, y: y + 5, z: z + 0.5, room: roomName, color });
  };

  const room = (id: string, name: string, x0: number, z0: number, x1: number, z1: number, spawn: [number, number, number]) => rooms.push({ id, name, x0, z0, x1, z1, spawn });

  /** A walled room with doorways. doors: list of [side, offset, width]. */
  const hall = (x0: number, z0: number, x1: number, z1: number, h: number, doors: [('n' | 's' | 'e' | 'w'), number, number][], o: { ruin?: number; mat?: number; floor?: number | ((x: number, z: number) => number) } = {}) => {
    if (o.floor !== undefined) floorAt(x0, z0, x1, z1, o.floor);
    wall(x0, z0, x1, z0, h, { crenel: true, ruin: o.ruin, mat: o.mat });
    wall(x0, z1 - 1, x1, z1 - 1, h, { crenel: true, ruin: o.ruin, mat: o.mat });
    wall(x0, z0, x0, z1, h, { crenel: true, ruin: o.ruin, mat: o.mat });
    wall(x1 - 1, z0, x1 - 1, z1, h, { crenel: true, ruin: o.ruin, mat: o.mat });
    for (const [side, off, w] of doors) {
      const dh = Math.min(h - 2, Math.round(w * 1.3) + 3);
      if (side === 'n') arch(x0 + off, z0, 'x', w, dh);
      if (side === 's') arch(x0 + off, z1 - 2, 'x', w, dh);
      if (side === 'w') arch(x0, z0 + off, 'z', w, dh);
      if (side === 'e') arch(x1 - 2, z0 + off, 'z', w, dh);
    }
    // torches flank inner walls
    for (let x = x0 + 6; x < x1 - 4; x += 10) { if (g.get(x, G + 5, z0 + 1)) torch(x, G + 5, z0 + 2); if (g.get(x, G + 5, z1 - 2)) torch(x, G + 5, z1 - 3); }
  };

  /** A paved path between two points (axis-aligned legs). */
  const path = (pts: [number, number][], w = 5, m = M.path) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const hw = Math.floor(w / 2);
      for (let z = Math.min(az, bz) - hw; z <= Math.max(az, bz) + hw; z++) for (let x = Math.min(ax, bx) - hw; x <= Math.max(ax, bx) + hw; x++) {
        const edge = ax === bx ? Math.abs(x - ax) === hw : Math.abs(z - az) === hw;
        if (g.get(x, G - 1, z) && !g.get(x, G, z)) g.set(x, G - 1, z, edge ? M.stoneDark : m);
      }
    }
  };

  // =====================================================================
  // THE HIDDEN LABYRINTH
  // A mass of rock under the dunes, cut into canyon corridors and chambers. You climb down from
  // the desert at the south and come out, at the end, in an open palace courtyard.
  const WT = G + 10; // top of the labyrinth walls
  const LX0 = 8, LX1 = 248, LZ0 = 8, LZ1 = 238;
  const inLab = (x: number, z: number) => x >= LX0 && x <= LX1 && z >= LZ0 && z <= LZ1;

  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    g.box(x, 0, z, x, G - 2, z, M.sandDark);
    g.set(x, G - 1, z, M.path);
    if (inLab(x, z)) {
      g.box(x, G, z, x, WT - 1, z, M.stoneBlock);
      const dune = Math.round(fbm(x * 0.045, z * 0.06) * 7 - 1.5);
      const ripple = Math.sin(x * 0.55 + z * 0.22 + fbm(x * 0.1, z * 0.1) * 6) > 0.55;
      for (let y = WT; y < WT + Math.max(1, dune); y++) g.set(x, y, z, ripple && y === WT + Math.max(1, dune) - 1 ? M.sandDark : M.sand);
    } else {
      const dx = x < LX0 ? LX0 - x : x > LX1 ? x - LX1 : 0;
      const dz = z < LZ0 ? LZ0 - z : z > LZ1 ? z - LZ1 : 0;
      const d = Math.max(dx, dz);
      const dune = fbm(x * 0.035, z * 0.05) * 7 + Math.sin(x * 0.07 + z * 0.03) * 1.5 + 1 + d * 0.06;
      const h = Math.round(WT + dune - 2);
      const ripple = Math.sin(x * 0.5 + z * 0.25 + fbm(x * 0.1, z * 0.1) * 6) > 0.6;
      g.box(x, G, z, x, h, z, (_x, y) => (y === h && ripple ? M.sandDark : y >= h - 1 ? M.sand : M.sandDark));
    }
  }

  /** Clear a space down to the floor, open to the sky. */
  const carve = (x0: number, z0: number, x1: number, z1: number, floor: number | ((x: number, z: number) => number) = M.path) => {
    g.clear(x0, G, z0, x1, SY - 1, z1);
    floorAt(x0, z0, x1, z1, floor);
  };
  const carveCircle = (cx: number, cz: number, r: number, floor: number | ((x: number, z: number) => number)) => {
    for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) if (x * x + z * z <= r * r + 0.5) {
      g.clear(cx + x, G, cz + z, cx + x, SY - 1, cz + z);
      g.set(cx + x, G - 1, cz + z, typeof floor === 'number' ? floor : floor(cx + x, cz + z));
    }
  };
  /** A winding corridor along axis-aligned legs. */
  const corridor = (pts: [number, number][], w = 5, roofed = false) => {
    const hw = Math.floor(w / 2);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      for (let z = Math.min(az, bz) - hw; z <= Math.max(az, bz) + hw; z++) for (let x = Math.min(ax, bx) - hw; x <= Math.max(ax, bx) + hw; x++) {
        g.clear(x, G, z, x, SY - 1, z);
        g.set(x, G - 1, z, (x + z) % 7 === 0 ? M.stoneDark : M.path);
      }
      // stone beams across the top here and there, so parts read as tunnels
      if (roofed) {
        const len = Math.max(Math.abs(bx - ax), Math.abs(bz - az));
        for (let k = 2; k < len; k += 4) {
          const x = ax === bx ? ax : ax + Math.sign(bx - ax) * k, z = az === bz ? az : az + Math.sign(bz - az) * k;
          if (ax === bx) g.box(x - hw - 1, WT - 2, z, x + hw + 1, WT - 1, z, M.stone);
          else g.box(x, WT - 2, z - hw - 1, x, WT - 1, z + hw + 1, M.stone);
        }
      }
    }
  };

  // ---------------------------------------------------------- the route
  // entrance stair from the dunes
  {
    const sy = g.top(128, 250);
    for (let s = 0; s <= sy - G; s++) {
      const z = 246 - s;
      g.clear(122, sy - s, z, 134, SY - 1, z);
      floorAt(123, z, 133, z, M.stoneLight, sy - s - 1);
      g.box(122, G, z, 122, sy - s + 1, z, M.stone); g.box(134, G, z, 134, sy - s + 1, z, M.stone);
    }
    g.clear(123, G, 236, 133, SY - 1, 247 - (sy - G));
    floorAt(123, 236, 133, 247 - (sy - G), M.path);
  }
  corridor([[128, 238], [128, 230]], 9);
  // 1. the first hall (about)
  carve(104, 196, 152, 232, (x, z) => { const d = Math.abs(x - 128) + Math.abs(z - 214); return d % 8 === 0 ? M.tileBlue : (x + z) % 2 === 0 && d < 20 ? M.stoneLight : M.floor; });
  corridor([[104, 213], [94, 213]], 6, true);
  // 2. builders' hall
  carve(50, 180, 94, 224, (x, z) => ((x + z) % 2 ? M.floor : M.stoneBlock));
  corridor([[72, 180], [72, 172]], 6, true);
  // 3. cloth market
  carve(38, 118, 82, 172, (x, z) => (Math.abs(x - 60) < 4 ? M.path : (x + z) % 3 ? M.stoneBlock : M.sand));
  corridor([[60, 118], [60, 112]], 8);
  // 4. hall of keys
  carve(34, 70, 88, 112, (x, z) => (((x >> 1) + (z >> 1)) % 2 ? M.ink : M.grey));
  corridor([[57, 70], [57, 64]], 6, true);
  // 5. strata quarry (dug out below)
  carve(28, 20, 86, 64, M.path);
  // 6. chasm crossing
  corridor([[86, 44], [92, 44]], 6);
  // 7. rally court
  carve(124, 22, 168, 66, (x, z) => (Math.abs(x - 146) < 18 && Math.abs(z - 44) < 12 ? ((x + z) % 2 ? M.tileGreen : M.leafDark) : M.stoneBlock));
  corridor([[168, 44], [176, 44]], 6, true);
  // 8. speed trials
  carve(176, 20, 236, 104, (x, z) => ((x + z) % 2 ? M.stoneBlock : M.path));
  corridor([[205, 104], [205, 120]], 6, true);
  // 9. council chamber
  carveCircle(206, 138, 19, (x, z) => { const d = Math.hypot(x - 206, z - 138); return d < 9 ? (Math.round(d) % 3 ? M.rug : M.gold) : M.floor; });
  corridor([[205, 156], [205, 172]], 6, true);
  // 10. archive of voices
  carve(172, 172, 228, 228, (x, z) => ((x + z) % 4 === 0 ? M.stoneLight : M.floor));
  corridor([[172, 184], [160, 184], [160, 160], [146, 160]], 6, true);
  // 11. star well (education)
  carveCircle(128, 158, 17, (x, z) => ((x + z) % 2 ? M.marble : M.stoneLight));
  corridor([[128, 141], [128, 130]], 8);
  // 12. palace courtyard (contact)
  carve(90, 76, 166, 130, (x, z) => { const d = Math.max(Math.abs(x - 128), Math.abs(z - 104)); return d % 6 === 0 ? M.tileBlue : (x + z) % 2 ? M.floor : M.stoneLight; });

  // side passages and dead ends: the maze part of the labyrinth
  const alcoves: [number, number][] = [];
  const side = (pts: [number, number][], w = 3) => { corridor(pts, w); alcoves.push(pts[pts.length - 1]); };
  side([[94, 200], [98, 200], [98, 186], [104, 186], [104, 178]]);
  side([[38, 150], [24, 150], [24, 132], [18, 132]]);
  side([[82, 96], [96, 96], [96, 110], [104, 110]]);
  side([[34, 84], [20, 84], [20, 72], [14, 72]]);
  side([[86, 56], [88, 56], [88, 76]]);
  side([[168, 30], [172, 30], [172, 12]]);
  side([[236, 70], [244, 70], [244, 116], [238, 116]]);
  side([[187, 138], [176, 138], [176, 150], [166, 150]]);
  side([[228, 200], [242, 200], [242, 226]]);
  side([[152, 220], [162, 220], [162, 232], [168, 232]]);
  side([[60, 224], [60, 232], [40, 232], [40, 214]]);
  side([[146, 168], [150, 168], [150, 176], [160, 176]]);

  // ---------------------------------------------------------- dress the cut faces
  // Every rock face along a floor gets a base course, ashlar, a trim band and a cap, with
  // niches and torch brackets here and there. This is what turns a cut into a labyrinth.
  {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const faces: [number, number, number, number][] = [];
    for (let z = LZ0; z <= LZ1; z++) for (let x = LX0; x <= LX1; x++) {
      if (!g.get(x, G, z)) continue;
      for (const [dx, dz] of dirs) if (!g.get(x + dx, G, z + dz) && g.get(x + dx, G - 1, z + dz)) { faces.push([x, z, dx, dz]); break; }
    }
    for (const [x, z, dx, dz] of faces) {
      const region = fbm(x * 0.02, z * 0.02) > 0.5;
      for (let y = G; y < WT; y++) {
        if (!g.get(x, y, z) || g.get(x, y, z) === M.sand) continue;
        const k = y - G;
        g.set(x, y, z, k === 0 ? M.stoneDark : k === 7 ? M.stoneLight : k === 9 ? M.stoneLight : k === 8 ? M.stone : region ? M.bigBrick : M.stone);
      }
      const h = hash(x, 77, z);
      const along = dx === 0 ? x : z;
      // niches with a dark back
      if (h > 0.93 && along % 3 === 0) {
        for (let y = G + 2; y <= G + 4; y++) g.set(x, y, z, M.dark);
        g.set(x, G + 5, z, M.stoneLight);
      }
      // torch brackets on the face, flame in the corridor
      else if (along % 9 === 0 && h > 0.45 && g.get(x, G + 5, z)) {
        g.set(x + dx, G + 5, z + dz, M.copper);
        lights.push({ x: x + dx + 0.5, y: G + 6.6, z: z + dz + 0.5 });
      }
    }
  }
  // sand spills over the rims and gathers in corners
  for (let i = 0; i < 260; i++) {
    const x = ri(LX0, LX1), z = ri(LZ0, LZ1);
    if (!g.get(x, G, z) && g.get(x, G - 1, z)) {
      let near = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.get(x + dx, G, z + dz)) near++;
      if (near) drift(x, z, ri(2, 4), ri(1, 2));
    }
  }

  // worn floors: cracked slabs, sand in the joints, a few tufts of grass and fallen blocks
  for (let z = LZ0; z <= LZ1; z++) for (let x = LX0; x <= LX1; x++) {
    if (g.get(x, G, z) || g.get(x, G - 1, z) !== M.path) continue;
    const h = hash(x, 41, z);
    if (h < 0.05) g.set(x, G - 1, z, M.stoneDark);
    else if (h < 0.12) g.set(x, G - 1, z, M.sand);
    else if (h > 0.996) g.set(x, G, z, M.stone);
    else if (h > 0.99) {
      let wall = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.get(x + dx, G, z + dz)) wall = true;
      if (wall) g.set(x, G, z, M.grass);
    }
  }

  // ---------------------------------------------------------- surface: the desert above
  {
    const surf = (x: number, z: number) => g.top(x, z, SY - 1);
    // half-buried gate at the entrance
    for (const x of [118, 138]) { const y = surf(x, 248); g.box(x - 1, y - 2, 247, x + 1, y + 8, 249, M.stone); g.box(x - 1, y + 9, 247, x + 1, y + 9, 249, M.stoneLight); }
    g.box(117, surf(128, 248) + 10, 247, 139, surf(128, 248) + 11, 249, M.stone);
    arch(128, 247, 'x', 15, surf(128, 248) - G + 10, 3, G, true);
    g.box(123, surf(128, 248) + 12, 248, 133, surf(128, 248) + 12, 248, M.tileBlue);
    for (const [x, z] of [[116, 250], [140, 250]]) torch(x, surf(x, z) + 3, z, false);
    for (const [x, z] of [[116, 250], [140, 250]]) g.box(x, surf(x, z) - 1, z, x, surf(x, z) + 2, z, M.wood);
    // colossus head half-sunk in the sand
    {
      const hx = 150, hz = 244, hy = surf(hx, hz) - 3;
      g.box(hx, hy, hz, hx + 7, hy + 7, hz + 6, M.stoneBlock);
      g.box(hx + 1, hy + 8, hz, hx + 6, hy + 9, hz + 6, M.stoneLight);
      g.box(hx + 1, hy + 4, hz + 7, hx + 2, hy + 4, hz + 7, M.dark); g.box(hx + 5, hy + 4, hz + 7, hx + 6, hy + 4, hz + 7, M.dark);
      g.box(hx + 3, hy + 2, hz + 7, hx + 4, hy + 3, hz + 7, M.stoneDark);
    }
    palm(104, 250, 12, surf(104, 250)); palm(160, 252, 10, surf(160, 252)); palm(96, 244, 9, surf(96, 244));
    pedestal(128, 251, 'intro', 'The way down', 0xffd27a, surf(128, 251));
    room('gate', 'The way down', 112, 236, 144, 255, [128, surf(128, 252), 252]);
    // ruins poking out of the dunes on top of the labyrinth
    for (let i = 0; i < 160; i++) {
      const x = ri(LX0 + 2, LX1 - 2), z = ri(LZ0 + 2, LZ1 - 2);
      const y = surf(x, z);
      if (y < WT || g.get(x, G, z) === 0) continue;
      const k = rnd();
      if (k < 0.3) palm(x, z, ri(7, 11), y);
      else if (k < 0.6) { const h = ri(2, 6); g.box(x, y, z, x, y + h, z, M.stoneLight); g.set(x, y + h + 1, z, M.stone); }
      else if (k < 0.8) g.box(x, y, z, x + ri(1, 4), y + ri(0, 2), z + ri(0, 1), M.stone);
      else if (k < 0.9) pot(x, z, y, M.stoneRed);
      else { dome(x, y - 3, z, ri(3, 5), rnd() > 0.5 ? M.tileBlue : M.stoneLight, 'hemi', false); }
    }
  }

  // ---------------------------------------------------------- 1. the first hall (about)
  {
    const fx = 128, fz = 214;
    for (let z = -8; z <= 8; z++) for (let x = -8; x <= 8; x++) {
      const d = Math.max(Math.abs(x), Math.abs(z), (Math.abs(x) + Math.abs(z)) * 0.72);
      if (d <= 8 && d > 6.6) { g.set(fx + x, G, fz + z, M.stoneLight); g.set(fx + x, G + 1, fz + z, M.marble); }
      else if (d <= 6.6) g.set(fx + x, G - 1, fz + z, M.tileTeal);
    }
    water.push({ x0: fx - 7, z0: fz - 7, x1: fx + 8, z1: fz + 8, y: G + 0.6 });
    cylinder(fx, fz, G, 4, 2, M.marble); cylinder(fx, fz, G + 4, 1, 3, M.stoneLight); cylinder(fx, fz, G + 5, 2, 1, M.marble); g.set(fx, G + 7, fz, M.gold);
    props.push({ kind: 'spout', x: fx + 0.5, y: G + 7.5, z: fz + 0.5 });
    arcade(108, 200, 108, 228, 7, 7); arcade(148, 200, 148, 228, 7, 7);
    // guardian statues
    for (const x of [114, 142]) {
      g.box(x - 1, G, 200, x + 1, G + 1, 202, M.stoneDark);
      g.box(x - 1, G + 2, 201, x + 1, G + 6, 201, M.stoneLight); g.box(x, G + 7, 201, x, G + 8, 201, M.stoneLight);
      g.box(x - 2, G + 5, 201, x - 2, G + 7, 201, M.stoneLight); g.set(x - 2, G + 8, 201, M.gold);
    }
    for (const [x, z] of [[116, 206], [140, 206], [116, 224], [140, 224]]) brazier(x, z);
    for (const z of [204, 222]) { banner(104, G + 9, z, 'z', 3, 7, M.clothBlue); banner(152, G + 9, z, 'z', 3, 7, M.clothBlue); }
    palm(112, 228, 11); palm(144, 228, 11);
    pedestal(128, 200, 'about', 'The first hall', 0x7ff4ff);
    room('court', 'The first hall', 104, 196, 152, 232, [128, G, 226]);
  }

  // ---------------------------------------------------------- 2. builders' hall (Radiant Tech)
  {
    const x0 = 50, z0 = 180, x1 = 94, z1 = 224;
    for (let z = z0 + 8; z < z1 - 6; z += 8) { pillar(x0 + 8, z, 11); pillar(x1 - 9, z, 11); g.box(x0 + 7, G + 11, z, x1 - 8, G + 11, z, M.wood); }
    const plinth = (x: number, z: number) => { g.box(x - 3, G, z - 3, x + 3, G + 2, z + 3, M.stoneDark); g.box(x - 3, G + 3, z - 3, x + 3, G + 3, z + 3, M.stoneLight); };
    plinth(62, 192); plinth(82, 192); plinth(62, 212);
    props.push({ kind: 'diorama', x: 62.5, y: G + 4, z: 192.5, data: [0] }, { kind: 'diorama', x: 82.5, y: G + 4, z: 192.5, data: [1] }, { kind: 'diorama', x: 62.5, y: G + 4, z: 212.5, data: [2] });
    g.box(76, G, 208, 86, G + 1, 210, M.wood);
    for (let i = 0; i < 6; i++) g.set(77 + i * 2, G + 2, 209, [M.clothRed, M.tileBlue, M.gold, M.leaf, M.clothPurple, M.stoneLight][i]);
    crate(88, 216); crate(88, 213); crate(86, 216); crate(52, 184);
    pedestal(74, 216, 'radiant', "The builders' hall", 0xffb35a);
    banner(x0, G + 9, 198, 'z', 3, 7, M.clothYellow);
    room('builders', "The builders' hall", x0, z0, x1, z1, [72, G, 206]);
  }

  // ---------------------------------------------------------- 3. cloth market (pileGo!)
  {
    const z0 = 118, z1 = 172;
    const cloths = [M.clothRed, M.clothBlue, M.clothYellow, M.clothPurple, M.clothGreen, M.clothWhite];
    for (let z = z0 + 4; z < z1 - 8; z += 11) for (const sd of [0, 1]) {
      const sx = sd ? 68 : 42, c = cloths[(z + sd * 3) % cloths.length], c2 = cloths[(z + sd * 3 + 2) % cloths.length];
      g.box(sx, G, z, sx + 8, G + 1, z + 7, M.wood);
      for (const [px, pz] of [[sx, z], [sx + 8, z], [sx, z + 7], [sx + 8, z + 7]]) g.box(px, G, pz, px, G + 6, pz, M.wood);
      for (let i = 0; i <= 8; i++) for (let k = 0; k <= 8; k++) g.set(sx + i, G + 7 + (sd ? Math.round(i / 4) : Math.round((8 - i) / 4)), z - 1 + k, k % 2 ? c : c2);
      for (let i = 1; i < 8; i++) g.set(sx + i, G + 2, z + 2 + (i % 3), cloths[(i + z) % cloths.length]);
      for (let k = 0; k < 14; k++) { const hx = sx + ri(1, 7), hz = z + ri(4, 6); const hy = g.top(hx, hz, G + 5); if (hy < G + 4) g.set(hx, hy, hz, cloths[ri(0, 5)]); }
    }
    for (let z = z0 + 9; z < z1 - 6; z += 11) {
      for (let x = 52; x <= 68; x++) {
        const sag = Math.round(Math.pow((x - 60) / 8, 2) * 2);
        g.set(x, G + 8 + sag, z, M.wood);
        if (x % 3 !== 0 && x > 52 && x < 68) g.box(x, G + 5 + sag, z, x, G + 7 + sag, z, cloths[(x + z) % cloths.length]);
      }
      g.box(52, G, z, 52, G + 10, z, M.wood); g.box(68, G, z, 68, G + 10, z, M.wood);
    }
    for (let i = 0; i < 520; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 6;
      const x = Math.round(60 + Math.cos(a) * r), z = Math.round(132 + Math.sin(a) * r);
      const y = g.top(x, z, G + 10);
      if (y - G < 6 - r * 0.8) g.set(x, y, z, cloths[ri(0, 5)]);
    }
    pedestal(60, 160, 'pilego', 'The cloth market', 0xff8fa8);
    room('market', 'The cloth market', 38, z0, 82, z1, [60, G, 166]);
  }

  // ---------------------------------------------------------- 4. hall of keys (Thock)
  {
    const caps = [M.keyCream, M.keyCream, M.keyCream, M.keyDark, M.keyCream, M.keyOrange, M.keyTeal];
    for (let row = 0; row < 4; row++) {
      const zz = 78 + row * 5;
      let x = 40 + row, k = 0;
      while (x < 80) {
        const space = row === 3 && k === 3;
        const w = space ? 18 : k === 0 && row > 0 ? 5 : 4;
        const m = space ? M.keyCream : k === 0 ? M.keyDark : caps[(k * 3 + row) % caps.length];
        const hgt = 1 + ((k + row) % 3 === 0 ? 1 : 0);
        g.box(x, G, zz, Math.min(82, x + w - 2), G + hgt - 1, zz + 3, m);
        x += w; k++;
      }
    }
    g.box(40, G, 73, 42, G, 76, M.keyOrange);
    for (const [x, z] of [[40, 106], [82, 106], [82, 74]]) {
      g.box(x - 1, G, z - 1, x + 1, G + 6, z + 1, M.keyDark);
      g.box(x - 2, G + 7, z - 2, x + 2, G + 8, z + 2, M.keyCream);
      g.box(x - 1, G + 9, z - 1, x + 1, G + 9, z + 1, M.keyCream);
    }
    g.box(66, G, 104, 78, G + 1, 108, M.wood);
    for (let i = 0; i < 6; i++) g.set(67 + i * 2, G + 2, 106, [M.clothRed, M.clothBlue, M.clothYellow, M.keyTeal, M.clothPurple, M.keyOrange][i]);
    pedestal(50, 104, 'thock', 'The hall of keys', 0xffa060);
    banner(34, G + 9, 90, 'z', 3, 7, M.clothPurple); banner(88, G + 9, 90, 'z', 3, 7, M.clothPurple);
    room('keys', 'The hall of keys', 34, 70, 88, 112, [60, G, 108]);
  }

  // ---------------------------------------------------------- 5. strata quarry (Strata)
  const QY = G - 9;
  {
    const x0 = 28, z0 = 20, x1 = 86, z1 = 64;
    const band = (y: number) => [M.strataCream, M.strataOchre, M.strataRed, M.strataOchre, M.strataPlum, M.strataCream, M.strataRed, M.strataOchre, M.rock][((y % 9) + 9) % 9];
    for (let z = z0 - 3; z <= z1 + 3; z++) for (let x = x0 - 3; x <= x1 + 3; x++) for (let y = 1; y < WT; y++) if (g.get(x, y, z) && g.get(x, y, z) !== M.copper) g.set(x, y, z, band(y));
    for (let lvl = 0; lvl < 9; lvl++) { const inset = 4 + lvl * 2; g.clear(x0 + inset, G - 1 - lvl, z0 + inset, x1 - inset, G + 12, z1 - inset); }
    floorAt(x0 + 22, z0 + 22, x1 - 22, z1 - 22, M.strataCream, QY + 2);
    // a ramp down the south terraces
    for (let lvl = 0; lvl < 9; lvl++) { const inset = 4 + lvl * 2; for (let i = 0; i < 4; i++) { g.set(55 + i, G - 1 - lvl, z1 - inset, M.strataCream); g.set(55 + i, G - 2 - lvl, z1 - inset - 1, M.strataCream); } }
    const hx = 57, hz = 42;
    for (let y = 0; y < 24; y++) {
      const a = y * 0.42, ax = Math.round(Math.cos(a) * 4), az = Math.round(Math.sin(a) * 4);
      g.set(hx + ax, QY + 3 + y, hz + az, M.glowCyan); g.set(hx - ax, QY + 3 + y, hz - az, M.glowRose);
      if (y % 3 === 0) for (let t = -3; t <= 3; t++) g.set(hx + Math.round((ax * t) / 4), QY + 3 + y, hz + Math.round((az * t) / 4), M.stoneLight);
    }
    for (let i = 0; i < 7; i++) { const x = x0 + 8 + i * 7, z = z0 + 1; for (let y = 0; y < 7; y++) g.set(x, G + y, z, band(y + i)); g.set(x, G + 7, z, M.stoneLight); }
    pedestal(50, 48, 'strata', 'The strata quarry', 0x7ff4ff, QY + 3);
    lights.push({ x: 57.5, y: QY + 14, z: 42.5, big: true, noFlame: true });
    room('strata', 'The strata quarry', x0, z0, x1, z1, [57, G, 62]);
  }

  // ---------------------------------------------------------- 6. the chasm and the rope bridge
  {
    const cx0 = 92, cx1 = 120, cz0 = 10, cz1 = 74;
    for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) {
      const edge = Math.min(x - cx0, cx1 - x, z - cz0, cz1 - z) + hash(x, 9, z) * 2.5;
      if (edge < 0.6) continue;
      const depth = Math.min(10, Math.round(edge * 2.2));
      g.clear(x, G - 1 - depth, z, x, SY - 1, z);
      for (let y = 1; y < G - 1 - depth; y++) g.set(x, y, z, y % 4 === 0 ? M.strataRed : M.rock);
    }
    props.push({ kind: 'sandfall', x: 92.5, y: WT, z: 28.5 }, { kind: 'sandfall', x: 120.5, y: WT, z: 58.5 });
    const bz = 42;
    for (let x = cx0 - 1; x <= cx1 + 1; x++) {
      const sag = Math.round(Math.sin(((x - cx0 + 1) / (cx1 - cx0 + 2)) * Math.PI) * 1.4);
      for (let i = 0; i < 5; i++) g.set(x, G - 1 - sag, bz + i, x % 2 ? M.wood : M.trunk);
      g.set(x, G + 1 - sag, bz - 1, M.trunk); g.set(x, G + 1 - sag, bz + 5, M.trunk);
      if (x % 5 === 0) { g.box(x, G - 1 - sag, bz - 1, x, G + 1 - sag, bz - 1, M.wood); g.box(x, G - 1 - sag, bz + 5, x, G + 1 - sag, bz + 5, M.wood); }
    }
    for (const x of [cx0 - 2, cx1 + 2]) { g.box(x, G, bz - 2, x, G + 4, bz - 2, M.wood); g.box(x, G, bz + 6, x, G + 4, bz + 6, M.wood); torch(x, G + 5, bz - 2); torch(x, G + 5, bz + 6); }
    corridor([[120, 44], [124, 44]], 6);
  }

  // ---------------------------------------------------------- 7. rally court (Rally Assist)
  {
    const x0 = 124, z0 = 22, x1 = 168;
    for (let t = 0; t < 4; t++) g.box(x0 + 4, G, z0 + 1 + t, x1 - 5, G + 3 - t, z0 + 1 + t, t % 2 ? M.stoneLight : M.stone);
    for (let x = x0 + 6; x < x1 - 6; x += 3) g.set(x, G + 4, z0 + 1, [M.clothRed, M.clothBlue, M.clothYellow][x % 3]);
    const tx = 146, tz = 44;
    g.box(tx - 9, G, tz - 5, tx + 9, G + 2, tz + 5, M.wood);
    g.box(tx - 10, G + 3, tz - 6, tx + 10, G + 3, tz + 6, (x, _y, z) => (x === tx - 10 || x === tx + 10 || z === tz - 6 || z === tz + 6 || z === tz ? M.clothWhite : M.tileBlue));
    g.box(tx, G + 4, tz - 7, tx, G + 5, tz + 7, M.clothWhite);
    for (const [x, m] of [[tx - 15, M.clothRed], [tx + 15, M.ink]] as [number, number][]) {
      g.box(x, G, tz, x, G + 4, tz, M.wood);
      for (let y = 0; y < 6; y++) for (let z = -3; z <= 3; z++) if (y * y * 0.4 + z * z < 10) g.set(x, G + 5 + y, tz + z, m);
    }
    props.push({ kind: 'ball', x: tx, y: G + 8, z: tz });
    for (const [x, z] of [[130, 60], [162, 60]]) brazier(x, z);
    pedestal(146, 60, 'rally', 'The rally court', 0x9fffb0);
    room('rally', 'The rally court', x0, z0, x1, 66, [146, G, 58]);
  }

  // ---------------------------------------------------------- 8. speed trials (+1 Speed Sponge Escape)
  {
    const gate = (x: number, z: number, m: number) => { g.box(x - 5, G, z, x - 4, G + 9, z, M.stoneLight); g.box(x + 4, G, z, x + 5, G + 9, z, M.stoneLight); g.box(x - 5, G + 9, z, x + 5, G + 10, z, m); };
    gate(205, 30, M.clothRed); gate(205, 96, M.gold);
    for (let z = 32; z < 52; z++) for (let x = 201; x <= 209; x++) g.set(x, G - 1, z, z % 2 ? M.ink : M.grey);
    props.push({ kind: 'treadmill', x: 205, y: G, z: 42 });
    for (let z = 54; z < 92; z++) for (let x = 196; x <= 214; x++) { g.set(x, G - 1, z, M.sand); g.set(x, G - 2, z, M.sand); }
    const boards: [number, number, number][] = [[205, 56, 0], [201, 61, 1], [207, 65, 2], [203, 70, 3], [209, 74, 2], [204, 79, 1], [200, 84, 2], [205, 89, 0]];
    for (const [x, z, h] of boards) g.box(x - 2, G, z - 1, x + 2, G + h, z + 2, (xx, y, zz) => (y === G + h ? ((xx + zz) % 3 ? M.clothYellow : M.gold) : M.wood));
    for (const [x, z] of [[216, 60], [194, 76], [216, 88]]) { g.box(x, G, z, x, G + 6, z, M.wood); g.box(x + 1, G + 4, z, x + 3, G + 6, z, M.clothGreen); }
    for (const [x, z, m] of [[186, 70, M.marble], [188, 76, M.tileTeal], [184, 82, M.clothPurple]] as [number, number, number][]) { g.box(x - 1, G, z - 1, x + 1, G + 2, z + 1, m); g.set(x, G + 3, z, m); }
    props.push({ kind: 'pet', x: 224, y: G, z: 70 }, { kind: 'pet', x: 228, y: G, z: 78 }, { kind: 'pet', x: 190, y: G, z: 92 });
    // speed pads: glowing chevrons that point down the course
    for (let z = 34; z < 98; z += 6) for (let i = -2; i <= 2; i++) g.set(186 + Math.abs(i), G - 1, z + i, M.glowGold);
    for (let z = 34; z < 98; z += 6) for (let i = -2; i <= 2; i++) g.set(224 + Math.abs(i), G - 1, z + i, M.glowGold);
    // stands of stacked sponge cubes and banners along the walls
    for (const [x, z] of [[180, 40], [180, 60], [232, 50], [232, 84], [180, 88]]) {
      g.box(x - 1, G, z - 1, x + 1, G + 2, z + 1, M.clothYellow); g.box(x, G + 3, z, x, G + 4, z, M.gold);
    }
    for (const z of [36, 56, 76]) { banner(176, G + 9, z, 'z', 3, 7, M.clothRed); banner(236, G + 9, z, 'z', 3, 7, M.clothGreen); }
    brazier(196, 100); brazier(214, 100);
    pedestal(222, 96, 'speed', 'The speed trials', 0xffe066);
    room('speed', 'The speed trials', 176, 20, 236, 104, [205, G, 24]);
  }

  // ---------------------------------------------------------- 9. council chamber (Agora, FBLA)
  {
    const cx = 206, cz = 138;
    for (let z = -16; z <= 16; z++) for (let x = -16; x <= 16; x++) {
      const d = Math.sqrt(x * x + z * z);
      if (d > 12 && d <= 16 && Math.abs(x) > 3) for (let y = G; y < G + Math.floor((d - 12) / 1.4) + 1; y++) g.set(cx + x, y, cz + z, y % 2 ? M.stoneLight : M.stone);
    }
    cylinder(cx, cz, G, 2, 5, M.wood); cylinder(cx, cz, G + 1, 1, 6, M.wood); cylinder(cx, cz, G + 2, 1, 1, M.gold);
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2 + 0.2;
      const px = Math.round(cx + Math.cos(ang) * 10), pz = Math.round(cz + Math.sin(ang) * 10);
      if (Math.abs(px - cx) < 4) continue;
      pillar(px, pz, 10, { r: 0 }); torch(px, G + 7, pz);
    }
    pedestal(cx - 7, cz + 6, 'agora', 'The council chamber', 0xffd27a);
    pedestal(cx + 7, cz + 6, 'fbla', 'The council chamber', 0xb0a0ff);
    room('council', 'The council chamber', cx - 19, cz - 19, cx + 19, cz + 19, [cx, G, cz + 12]);
  }

  // ---------------------------------------------------------- 10. archive of voices (Marwari)
  {
    const x0 = 172, z0 = 172, x1 = 228, z1 = 228;
    const spines = [M.clothRed, M.clothBlue, M.clothYellow, M.clothGreen, M.clothPurple, M.copper, M.ink];
    for (let row = 0; row < 3; row++) {
      const z = z0 + 18 + row * 9;
      for (const [sx, ex] of [[x0 + 4, x0 + 22], [x0 + 32, x1 - 6]]) for (let x = sx; x <= ex; x++) for (let y = G; y < G + 7; y++) {
        g.set(x, y, z, (y - G) % 3 === 0 ? M.wood : spines[Math.floor(hash(x, y, z) * spines.length)]);
        g.set(x, y, z + 1, (y - G) % 3 === 0 ? M.wood : spines[Math.floor(hash(x, y, z + 1) * spines.length)]);
      }
    }
    for (const [x, z] of [[184, 220], [198, 220]]) { g.box(x, G, z, x + 4, G + 1, z + 2, M.wood); g.box(x + 1, G + 2, z + 1, x + 3, G + 2, z + 1, M.clothWhite); }
    for (let i = 0; i < 5; i++) { g.box(x0 + 26 + i * 5, G + 3, z1, x0 + 28 + i * 5, G + 8, z1, M.marble); for (let k = 0; k < 3; k++) g.set(x0 + 27 + i * 5, G + 4 + k, z1 - 1, M.ink); }
    pedestal(206, 214, 'marwari', 'The archive of voices', 0xffc48a);
    brazier(186, 180); brazier(216, 180);
    room('archive', 'The archive of voices', x0, z0, x1, z1, [206, G, 178]);
  }

  // ---------------------------------------------------------- 11. star well (Education)
  {
    for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2, r = rnd() * 12; g.set(Math.round(128 + Math.cos(a) * r), G - 1, Math.round(158 + Math.sin(a) * r), rnd() > 0.7 ? M.glowGold : M.tileBlue); }
    for (let a = 0; a < 72; a++) { const ang = (a / 72) * Math.PI * 2; g.set(Math.round(128 + Math.cos(ang) * 13), G - 1, Math.round(158 + Math.sin(ang) * 13), M.gold); }
    g.box(127, G, 157, 129, G + 2, 159, M.marble);
    props.push({ kind: 'armillary', x: 128.5, y: G + 8, z: 158.5 });
    g.box(142, G, 150, 142, G + 3, 150, M.copper);
    for (let i = 0; i < 7; i++) g.set(142 + Math.round(i * 0.4), G + 4 + Math.round(i * 0.7), 150 - i, i < 2 ? M.gold : M.copper);
    pedestal(118, 166, 'education', 'The star well', 0xc8d8ff);
    for (const [x, z] of [[116, 148], [140, 168]]) brazier(x, z);
    room('star', 'The star well', 111, 141, 145, 175, [128, G, 172]);
  }

  // ---------------------------------------------------------- 12. palace courtyard (contact)
  {
    const x0 = 90, z0 = 76, x1 = 166, z1 = 130;
    // the palace facade along the north side
    g.box(x0, G, z0 - 6, x1, G + 22, z0 + 8, (x, y) => (y % 6 === 5 ? M.stoneLight : (x + y) % 9 === 0 ? M.bigBrick : M.stone));
    g.box(x0, G + 22, z0 - 6, x1, G + 22, z0 + 8, M.stoneLight);
    for (let x = x0; x <= x1; x += 2) g.set(x, G + 23, z0 + 8, M.stoneLight);
    for (let x = x0 + 4; x < x1 - 2; x += 6) { g.box(x, G + 17, z0 + 9, x + 2, G + 19, z0 + 9, M.dark); g.set(x + 1, G + 17, z0 + 9, M.glowGold); g.set(x + 1, G + 20, z0 + 9, M.stoneLight); }
    for (let x = x0 + 5; x < x1 - 2; x += 12) torch(x, G + 6, z0 + 9);
    for (let x = x0 + 8; x < x1 - 6; x += 12) { arch(x, z0 + 6, 'x', 6, 10, 3); g.box(x - 3, G + 11, z0 + 9, x + 3, G + 12, z0 + 9, M.tileBlue); }
    arch(128, z0 + 4, 'x', 12, 14, 5);
    g.box(120, G + 15, z0 + 9, 136, G + 16, z0 + 9, M.tileTeal);
    cylinder(128, z0 + 1, G + 22, 3, 10, M.stoneLight);
    dome(128, G + 25, z0 + 1, 10, M.gold, 'onion');
    dome(104, G + 23, z0 + 1, 5, M.stoneLight); dome(152, G + 23, z0 + 1, 5, M.stoneLight);
    tower(x0 + 2, z0 + 1, 36, 4, { dome: M.tileBlue, onion: true }); tower(x1 - 2, z0 + 1, 36, 4, { dome: M.tileBlue, onion: true });
    lights.push({ x: 128.5, y: G + 21, z: z0 + 10.5, big: true, noFlame: true });
    // a long pool with palms on either side
    for (let z = 96; z <= 122; z++) for (let x = 124; x <= 132; x++) g.set(x, G - 1, z, x === 124 || x === 132 || z === 96 || z === 122 ? M.stoneLight : M.tileTeal);
    for (let z = 96; z <= 122; z++) { g.set(124, G, z, M.marble); g.set(132, G, z, M.marble); }
    for (let x = 124; x <= 132; x++) { g.set(x, G, 96, M.marble); g.set(x, G, 122, M.marble); }
    water.push({ x0: 125, z0: 97, x1: 132, z1: 122, y: G + 0.55 });
    for (let z = 98; z <= 122; z += 8) { palm(118, z, 12); palm(138, z, 12); }
    arcade(x0 + 3, 92, x0 + 3, 126, 8, 6); arcade(x1 - 3, 92, x1 - 3, 126, 8, 6);
    for (const x of [x0, x1]) for (const z of [100, 116]) banner(x, G + 10, z, 'z', 3, 8, M.clothRed);
    // the last fire, on a carpet under a canopy
    rug(98, 104, 112, 118); rug(144, 104, 158, 118, G - 1, M.clothPurple);
    for (const [x, z, m] of [[100, 106, M.clothYellow], [109, 115, M.clothRed], [146, 106, M.clothBlue], [155, 115, M.clothGreen]] as [number, number, number][]) g.box(x, G, z, x + 1, G, z + 1, m);
    g.box(103, G, 109, 107, G, 113, M.stoneDark); g.box(104, G, 110, 106, G, 112, M.wood);
    lights.push({ x: 105.5, y: G + 3, z: 111.5, big: true });
    props.push({ kind: 'fire', x: 105.5, y: G + 1, z: 111.5 });
    for (const [x, z] of [[97, 103], [113, 103], [97, 119], [113, 119]]) g.box(x, G, z, x, G + 7, z, M.wood);
    for (let x = 97; x <= 113; x++) for (let z = 103; z <= 119; z++) if (z <= 105 || z >= 117 || x === 97 || x === 113) g.set(x, G + 8, z, (x + z) % 4 < 2 ? M.clothRed : M.clothYellow);
    pedestal(105, 122, 'contact', 'The palace courtyard', 0xffa040);
    for (const [x, z] of [[144, 100], [158, 124], [96, 126]]) brazier(x, z);
    room('palace', 'The palace courtyard', x0, z0, x1, z1, [128, G, 126]);
  }

  // dead ends hold small finds: urns, a chest, a mural
  for (const [x, z] of alcoves) {
    const k = hash(x, 5, z);
    if (k < 0.4) { pot(x, z); pot(x + 1, z, G, M.copper); }
    else if (k < 0.7) { g.box(x - 1, G, z, x + 1, G + 1, z, M.wood); g.set(x, G + 1, z, M.gold); lights.push({ x: x + 0.5, y: G + 3, z: z + 0.5 }); }
    else { g.set(x, G, z, M.glowGold); }
  }

  const sp = g.top(128, 253);
  return { grid: g, relics, rooms, lights, water, props, spawn: [128.5, sp, 253.5] };
}

/** Small voxel models used as animated props. */
export function miniGrid(kind: string, variant = 0): Grid {
  if (kind === 'diorama') {
    const m = new Grid(7, 9, 7, false);
    if (variant === 0) {
      // floating island with a tree
      m.box(1, 0, 1, 5, 0, 5, M.rock); m.box(0, 1, 0, 6, 1, 6, M.grass); m.box(2, -1, 2, 4, 0, 4, M.rock);
      m.box(3, 2, 3, 3, 4, 3, M.trunk); m.box(2, 5, 2, 4, 6, 4, M.leaf); m.set(3, 7, 3, M.leaf);
      m.set(5, 2, 1, M.clothRed);
    } else if (variant === 1) {
      m.box(0, 0, 0, 6, 0, 6, M.grey); m.box(1, 1, 1, 5, 3, 5, M.stoneLight); m.box(2, 4, 2, 4, 5, 4, M.stoneLight);
      for (const [x, z] of [[1, 1], [5, 1], [1, 5], [5, 5]]) m.box(x, 1, z, x, 5, z, M.grey);
      m.set(3, 6, 3, M.tileBlue); m.set(3, 7, 3, M.gold);
    } else {
      m.box(0, 0, 0, 6, 0, 6, M.ink);
      const steps: [number, number, number, number][] = [[1, 1, 1, M.clothRed], [3, 2, 1, M.clothYellow], [5, 3, 2, M.clothGreen], [5, 4, 4, M.clothBlue], [3, 5, 5, M.clothPurple], [1, 6, 5, M.gold]];
      for (const [x, y, z, c] of steps) m.set(x, y, z, c);
    }
    return m;
  }
  if (kind === 'pet') {
    const m = new Grid(3, 4, 4, false);
    m.box(0, 0, 0, 2, 1, 3, M.clothWhite); m.box(0, 2, 2, 2, 3, 3, M.clothWhite);
    m.set(0, 3, 3, M.ink); m.set(2, 3, 3, M.ink); m.set(1, 2, 3, M.keyOrange);
    return m;
  }
  return new Grid(1, 1, 1, false);
}
