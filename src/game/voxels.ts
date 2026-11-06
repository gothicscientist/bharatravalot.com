// The voxel grid, its materials, and the mesher that turns it into lit, textured chunks.
import * as THREE from 'three';

export const SX = 256, SY = 64, SZ = 256;

/** Atlas tiles, 4x4 grid of 16px pixel textures (see atlas.ts). */
export const T = { noise: 0, brick: 1, sand: 2, smooth: 3, tile: 4, plank: 5, cloth: 6, leaf: 7, glyph: 8, key: 9, rug: 10, rock: 11, star: 12, block: 13, bigbrick: 14, water: 15 } as const;

interface MatDef { color: string; tile: number; glow?: number; topTile?: number; jitter?: number }

// Material ids. 0 is air.
export const M = {
  sand: 1, sandDark: 2, stone: 3, stoneLight: 4, stoneDark: 5, floor: 6, tileBlue: 7, tileTeal: 8, gold: 9, wood: 10,
  clothRed: 11, clothBlue: 12, clothYellow: 13, clothPurple: 14, leaf: 15, leafDark: 16, trunk: 17, dark: 18, rock: 19,
  strataRed: 20, strataOchre: 21, strataCream: 22, strataPlum: 23, glowGold: 24, glowCyan: 25, flame: 26, marble: 27,
  keyDark: 28, keyCream: 29, keyOrange: 30, keyTeal: 31, copper: 32, grey: 33, rug: 34, tileGreen: 35, stoneBlock: 36,
  stoneRed: 37, glowRose: 38, clothWhite: 39, bigBrick: 40, path: 41, grass: 42, glowWhite: 43, ink: 44, clothGreen: 45,
} as const;

const DEFS: Record<number, MatDef> = {
  [M.sand]: { color: '#dcae6e', tile: T.sand, jitter: 0.05 },
  [M.sandDark]: { color: '#cf9a5c', tile: T.sand, jitter: 0.05 },
  [M.stone]: { color: '#dba66a', tile: T.brick, jitter: 0.07 },
  [M.stoneLight]: { color: '#f0cf98', tile: T.smooth, jitter: 0.04 },
  [M.stoneDark]: { color: '#b27a4a', tile: T.brick, jitter: 0.07 },
  [M.floor]: { color: '#d39a64', tile: T.tile, jitter: 0.06 },
  [M.tileBlue]: { color: '#2a7fa6', tile: T.star, jitter: 0.05 },
  [M.tileTeal]: { color: '#56b9ae', tile: T.star, jitter: 0.05 },
  [M.gold]: { color: '#f0bb4c', tile: T.smooth, jitter: 0.03 },
  [M.wood]: { color: '#8a5530', tile: T.plank, jitter: 0.06 },
  [M.clothRed]: { color: '#c0392b', tile: T.cloth, jitter: 0.04 },
  [M.clothBlue]: { color: '#2b5aa6', tile: T.cloth, jitter: 0.04 },
  [M.clothYellow]: { color: '#e8a92a', tile: T.cloth, jitter: 0.04 },
  [M.clothPurple]: { color: '#74408f', tile: T.cloth, jitter: 0.04 },
  [M.leaf]: { color: '#5b9a3c', tile: T.leaf, jitter: 0.1 },
  [M.leafDark]: { color: '#3c7032', tile: T.leaf, jitter: 0.1 },
  [M.trunk]: { color: '#9a7446', tile: T.plank, jitter: 0.06 },
  [M.dark]: { color: '#3a2a22', tile: T.noise, jitter: 0.03 },
  [M.rock]: { color: '#a8825c', tile: T.rock, jitter: 0.08 },
  [M.strataRed]: { color: '#b85a3a', tile: T.rock, jitter: 0.06 },
  [M.strataOchre]: { color: '#dc9c48', tile: T.rock, jitter: 0.06 },
  [M.strataCream]: { color: '#ecd6a4', tile: T.rock, jitter: 0.05 },
  [M.strataPlum]: { color: '#7e5868', tile: T.rock, jitter: 0.06 },
  [M.glowGold]: { color: '#ffd27a', tile: T.smooth, glow: 3.2 },
  [M.glowCyan]: { color: '#7ff4ff', tile: T.smooth, glow: 3.0 },
  [M.flame]: { color: '#ff9a3a', tile: T.smooth, glow: 4.0 },
  [M.marble]: { color: '#f1e8d8', tile: T.smooth, jitter: 0.03 },
  [M.keyDark]: { color: '#36302e', tile: T.key, jitter: 0.02 },
  [M.keyCream]: { color: '#eedcbc', tile: T.key, jitter: 0.02 },
  [M.keyOrange]: { color: '#e2672c', tile: T.key, jitter: 0.02 },
  [M.keyTeal]: { color: '#3aa2a0', tile: T.key, jitter: 0.02 },
  [M.copper]: { color: '#c47a3a', tile: T.smooth, jitter: 0.05 },
  [M.grey]: { color: '#958a80', tile: T.block, jitter: 0.06 },
  [M.rug]: { color: '#a52c2c', tile: T.rug, jitter: 0.02 },
  [M.tileGreen]: { color: '#3d8f62', tile: T.star, jitter: 0.05 },
  [M.stoneBlock]: { color: '#d9a46c', tile: T.block, jitter: 0.06 },
  [M.stoneRed]: { color: '#c0744c', tile: T.bigbrick, jitter: 0.06 },
  [M.glowRose]: { color: '#ff8fa8', tile: T.smooth, glow: 3.0 },
  [M.clothWhite]: { color: '#f2e8d8', tile: T.cloth, jitter: 0.03 },
  [M.bigBrick]: { color: '#e0ad72', tile: T.bigbrick, jitter: 0.06 },
  [M.path]: { color: '#e3b880', tile: T.block, jitter: 0.07 },
  [M.grass]: { color: '#7aa64a', tile: T.leaf, jitter: 0.1 },
  [M.glowWhite]: { color: '#fff1d6', tile: T.smooth, glow: 3.0 },
  [M.ink]: { color: '#241c2e', tile: T.smooth, jitter: 0.02 },
  [M.clothGreen]: { color: '#2f7d52', tile: T.cloth, jitter: 0.04 },
};

const COLORS: Float32Array = new Float32Array(256 * 3);
const TILE = new Uint8Array(256);
const GLOW = new Float32Array(256);
const JIT = new Float32Array(256);
{
  const c = new THREE.Color();
  for (const k in DEFS) {
    const d = DEFS[+k];
    c.set(d.color); // sRGB -> linear
    COLORS.set([c.r, c.g, c.b], +k * 3);
    TILE[+k] = d.tile;
    GLOW[+k] = d.glow ?? 0;
    JIT[+k] = d.jitter ?? 0.05;
  }
}
export const isGlow = (m: number) => GLOW[m] > 0;

export class Grid {
  d: Uint8Array;
  constructor(public sx = SX, public sy = SY, public sz = SZ, public floorBelow = true) {
    this.d = new Uint8Array(sx * sy * sz);
  }
  idx(x: number, y: number, z: number) { return x + this.sx * (z + this.sz * y); }
  inb(x: number, y: number, z: number) { return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz; }
  get(x: number, y: number, z: number) {
    x |= 0; y |= 0; z |= 0;
    if (!this.inb(x, y, z)) return y < 0 && this.floorBelow ? M.sand : 0;
    return this.d[this.idx(x, y, z)];
  }
  set(x: number, y: number, z: number, m: number) {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (this.inb(x, y, z)) this.d[this.idx(x, y, z)] = m;
  }
  /** Solid for collision: anything but air, glow-only decor and cloth awnings are solid. */
  solid(x: number, y: number, z: number) {
    const m = this.get(Math.floor(x), Math.floor(y), Math.floor(z));
    return m !== 0 && m !== M.flame;
  }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: number | ((x: number, y: number, z: number) => number)) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
    for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) {
      const v = typeof m === 'number' ? m : m(x, y, z);
      if (v >= 0) this.set(x, y, z, v);
    }
  }
  clear(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) { this.box(x0, y0, z0, x1, y1, z1, 0); }
  /** Height of the highest solid voxel under (x, z), searching down from y. */
  top(x: number, z: number, from = this.sy - 1) {
    for (let y = from; y >= 0; y--) if (this.solid(x, y, z)) return y + 1;
    return 0;
  }
}

const hash = (x: number, y: number, z: number) => {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

// face definitions: normal, and the four corners (as offsets) in CCW order seen from outside
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], u: [-1, 0, 0], v: [0, 1, 0] },
];
const AO = [0.42, 0.62, 0.82, 1];
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];

interface Buf { pos: number[]; nor: number[]; col: number[]; uv: number[]; idx: number[] }
const newBuf = (): Buf => ({ pos: [], nor: [], col: [], uv: [], idx: [] });

function toGeo(b: Buf) {
  if (!b.idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setIndex(b.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

const opaque = (m: number) => m !== 0 && GLOW[m] === 0;

/** Mesh one chunk. Returns lit and glowing geometry. */
export function meshChunk(g: Grid, cx0 = 0, cz0 = 0, cs = Math.max(g.sx, g.sz), ox = 0, oy = 0, oz = 0) {
  const lit = newBuf(), glow = newBuf();
  const tileSz = 1 / 4;
  const xe = Math.min(g.sx, cx0 + cs), ze = Math.min(g.sz, cz0 + cs);
  for (let y = 0; y < g.sy; y++) for (let z = cz0; z < ze; z++) for (let x = cx0; x < xe; x++) {
    const m = g.d[g.idx(x, y, z)];
    if (!m) continue;
    const glowing = GLOW[m] > 0;
    const b = glowing ? glow : lit;
    const base = m * 3;
    const j = 1 + (hash(x, y, z) - 0.5) * 2 * JIT[m];
    const tile = TILE[m];
    const tu = (tile % 4) * tileSz, tv = 1 - (Math.floor(tile / 4) + 1) * tileSz;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
      const nm = g.get(nx, ny, nz);
      if (glowing ? nm === m || opaque(nm) : opaque(nm)) continue;
      if (ny < 0 && g.floorBelow) continue;
      const vi = b.pos.length / 3;
      const ao: number[] = [];
      for (let k = 0; k < 4; k++) {
        const c = F.c[k];
        let a = 3;
        if (!glowing) {
          // neighbours around this corner, in the plane just outside the face
          const dv = F.v;
          // corner direction along u and v
          const su = [0, 0, 0], sv = [0, 0, 0];
          for (let i = 0; i < 3; i++) {
            if (F.n[i] !== 0) continue;
            if (F.u[i] !== 0) su[i] = c[i] === 1 ? 1 : -1;
            if (dv[i] !== 0) sv[i] = c[i] === 1 ? 1 : -1;
          }
          const s1 = opaque(g.get(nx + su[0], ny + su[1], nz + su[2])) ? 1 : 0;
          const s2 = opaque(g.get(nx + sv[0], ny + sv[1], nz + sv[2])) ? 1 : 0;
          const cc = opaque(g.get(nx + su[0] + sv[0], ny + su[1] + sv[1], nz + su[2] + sv[2])) ? 1 : 0;
          a = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
        }
        ao.push(a);
        b.pos.push(x + c[0] - ox, y + c[1] - oy, z + c[2] - oz);
        b.nor.push(F.n[0], F.n[1], F.n[2]);
        const shade = AO[a] * j;
        b.col.push(COLORS[base] * shade, COLORS[base + 1] * shade, COLORS[base + 2] * shade);
        const uv = UVS[k];
        // inset to avoid sampling the neighbouring tile
        b.uv.push(tu + (0.002 + uv[0] * 0.996) * tileSz, tv + (0.002 + uv[1] * 0.996) * tileSz);
      }
      if (ao[0] + ao[2] < ao[1] + ao[3]) b.idx.push(vi + 1, vi + 2, vi + 3, vi + 1, vi + 3, vi);
      else b.idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    }
  }
  return { lit: toGeo(lit), glow: toGeo(glow) };
}

export { hash };
