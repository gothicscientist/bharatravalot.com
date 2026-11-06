import { Mesh, MAT, hex, mix3, rng, fbm1, smooth, clamp, type V3 } from './mesh';
import {
  STONE, STONE_LIGHT, STONE_DEEP, WOOD, RECESS, chhatri, jharokha, bastion, wall, shikhara, haveli, house,
  stepwellWall, samratYantra, quadrantArc, pol, kanguras, cornice, chajja, archPts, recess, st, plain, jali, kalash,
} from './art/arch';
import { dune, groundBand, khejri, grass, rock, camel, blob, flame, SAND, SAND_DEEP } from './art/nature';
import { person, clothLine, kite, SAFFRON, MAGENTA, INDIGO, LEHERIYA, MAROON, KESARI, GOLD } from './art/figures';
import { stations } from '../content';

export const X0 = 1200;
export const GAP = 2600;
export const SX = stations.map((_, i) => X0 + i * GAP);
export const END = SX[SX.length - 1] + 1300;
export const START_X = 640;

/** Time of day at each station (0 = before dawn, 1 = night). */
export const STATION_T = [0.02, 0.105, 0.2, 0.28, 0.36, 0.45, 0.54, 0.63, 0.72, 0.795, 0.9, 0.975];
/** Vertical extent of the view at each station, in world units. */
export const STATION_VIEW = [940, 1180, 900, 920, 980, 1060, 900, 1100, 960, 1040, 1180, 820];

export interface LayerDef {
  name: string;
  par: number;
  fog: number;
  darken: number;
  hazeY: number;
  mesh: Mesh;
}

export interface World {
  layers: LayerDef[];
  heights: Float32Array;
  step: number;
  platforms: { x0: number; x1: number; y: number }[];
  height(x: number): number;
  platform(x: number, yPrev: number, yNow: number): number | null;
  fires: { x: number; y: number }[];
  chisels: number[];
}

const SANDS = {
  far: hex('#c4946a'),
  far2: hex('#cf9a62'),
  mid: hex('#d6a466'),
  near: hex('#dcac6c'),
  main: hex('#e0b274'),
};

function makeLayer(name: string, par: number, fog: number, darken = 1, hazeY = -40): LayerDef {
  return { name, par, fog, darken, hazeY, mesh: new Mesh(1 << 16) };
}

// ---------------------------------------------------------------- terrain

function buildHeights(step: number): Float32Array {
  const S = SX;
  const pts: [number, number][] = [
    [-400, 160], [0, 120], [380, 70], [700, 112], [1150, 60], [1600, 30], [2050, 80], [2500, 24],
    [S[1] - 950, 20], [S[1] - 560, 64], [S[1] + 900, 64], [S[1] + 1200, 44],
    [S[4] + 900, 44], [S[5] - 740, 40],
    [S[5] + 760, 40], [S[5] + 1000, 26], [S[6] - 400, 20], [S[6] + 700, 20],
    [S[7] - 1150, 20], [S[7] - 260, 330], [S[7] + 950, 12],
    [S[8] - 650, 28], [S[8] + 650, 28], [S[9] - 760, 30], [S[9] - 320, 96], [S[9] + 520, 96], [S[9] + 900, 30],
    [S[10] - 700, 22], [S[10] + 760, 22], [S[11] - 650, 34], [S[11] - 60, 86], [S[11] + 420, 80], [END - 150, 220], [END + 400, 520],
  ];
  const n = Math.ceil((END + 600) / step);
  const h = new Float32Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const x = i * step;
    while (k < pts.length - 2 && pts[k + 1][0] < x) k++;
    const a = pts[k], b = pts[k + 1];
    const u = clamp((x - a[0]) / (b[0] - a[0]));
    const e = (1 - Math.cos(u * Math.PI)) / 2;
    let y = a[1] + (b[1] - a[1]) * e;
    // sand undulation outside the paved town and plazas
    const town = (x > S[1] - 700 && x < S[4] + 950) || Math.abs(x - S[8]) < 700 || Math.abs(x - S[10]) < 760 || Math.abs(x - S[5]) < 800;
    if (!town) y += (fbm1(x * 0.004, 5) - 0.5) * 26;
    h[i] = y;
  }
  // stepwell: flights of steps down to a landing at the water, and up again
  const sw = S[5];
  for (let i = 0; i < n; i++) {
    const x = i * step;
    const dx = Math.abs(x - sw);
    if (dx < 720) {
      const fromEdge = 720 - dx;
      const stepN = Math.min(15, Math.floor(fromEdge / 40));
      h[i] = 40 - stepN * 24;
    }
  }
  // samrat yantra: a staircase climbing the sundial's hypotenuse, then a sheer drop
  const yx0 = S[10] - 320, yx1 = S[10] + 180;
  for (let i = 0; i < n; i++) {
    const x = i * step;
    if (x >= yx0 && x < yx1) {
      const u = (x - yx0) / (yx1 - yx0);
      const y = 22 + Math.floor((u * 420) / 12) * 12;
      h[i] = Math.max(h[i], y);
    }
  }
  return h;
}

function terrainMesh(m: Mesh, h: Float32Array, step: number, x0: number, x1: number) {
  const top = SANDS.main;
  for (let i = Math.max(0, Math.floor(x0 / step)); i < Math.min(h.length - 1, Math.ceil(x1 / step)); i++) {
    const xa = i * step, xb = xa + step;
    const ya = h[i], yb = h[i + 1];
    const slope = (yb - ya) / step;
    const stepEdge = Math.abs(yb - ya) > 6;
    const nTop: [number, number, number] = stepEdge ? [0, 0, 1] : [-slope * 0.9, 0.85, 0.45];
    const inWell = Math.abs(xa - SX[5]) < 740;
    const inYantra = xa >= SX[10] - 320 && xa < SX[10] + 180;
    const c = inWell || inYantra ? STONE : top;
    const mat = inWell || inYantra ? MAT.stone : MAT.sand;
    // a lit band near the surface, then the body facing the viewer
    m.quad(xa, ya - 26, xb, yb - 26, xb, yb, xa, ya, { color: c, mat, n: nTop }, [0, 0.4, 0.92], [0, 0.4, 0.92], nTop, nTop);
    const body = mix3(c, SAND_DEEP, 0.25);
    const F: [number, number, number] = [0, 0.4, 0.92];
    m.v(xa, ya - 26, F, { color: body, mat, ao: 1 }); m.v(xb, yb - 26, F, { color: body, mat, ao: 1 }); m.v(xb, yb - 260, F, { color: body, mat, ao: 0.62 });
    m.v(xa, ya - 26, F, { color: body, mat, ao: 1 }); m.v(xb, yb - 260, F, { color: body, mat, ao: 0.62 }); m.v(xa, ya - 260, F, { color: body, mat, ao: 0.62 });
    m.v(xa, ya - 260, F, { color: body, mat, ao: 0.62 }); m.v(xb, yb - 260, F, { color: body, mat, ao: 0.62 }); m.v(xb, -3200, F, { color: body, mat, ao: 0.3 });
    m.v(xa, ya - 260, F, { color: body, mat, ao: 0.62 }); m.v(xb, -3200, F, { color: body, mat, ao: 0.3 }); m.v(xa, -3200, F, { color: body, mat, ao: 0.3 });
    if (stepEdge && (inWell || inYantra)) {
      // tread lip
      const yy = Math.max(ya, yb);
      m.rect(ya > yb ? xa - 3 : xb - 3, yy - 3, 6, 3, plain(STONE_LIGHT, { n: [0, 0.9, 0.4] }));
    }
  }
}

// ---------------------------------------------------------------- the world

export function buildWorld(): World {
  const step = 4;
  const heights = buildHeights(step);
  const height = (x: number) => {
    const f = x / step;
    const i = Math.floor(f);
    if (i < 0) return heights[0];
    if (i >= heights.length - 1) return heights[heights.length - 1];
    const u = f - i;
    // keep step edges crisp: no interpolation across a big jump
    if (Math.abs(heights[i + 1] - heights[i]) > 6) return u < 0.5 ? heights[i] : heights[i + 1];
    return heights[i] * (1 - u) + heights[i + 1] * u;
  };
  const platforms: World['platforms'] = [];
  const platform = (x: number, yPrev: number, yNow: number) => {
    let best: number | null = null;
    for (const p of platforms) {
      if (x >= p.x0 && x <= p.x1 && yPrev >= p.y - 1 && yNow <= p.y + 1) {
        if (best === null || p.y > best) best = p.y;
      }
    }
    return best;
  };

  const far = makeLayer('far', 0.08, 0.7, 1, -60);
  const far2 = makeLayer('far2', 0.22, 0.5, 1, -60);
  const mid = makeLayer('mid', 0.45, 0.22, 1, -60);
  const near = makeLayer('near', 0.75, 0.08, 1, -40);
  const main = makeLayer('main', 1, 0, 1, -9999);
  const fg = makeLayer('fg', 1.32, 0, 0.4, -9999);
  const fires: World['fires'] = [];
  const chisels: number[] = [];

  const S = SX;
  const r = rng(42);

  // ---------- far: low mesas and the long horizon ----------
  {
    const m = far.mesh;
    const x1 = END * far.par + 1600;
    groundBand(m, -1600, x1, -42, 16, 0.002, SANDS.far, 11, MAT.plain);
    // flat-topped mesas
    for (let x = -1400; x < x1; x += 260 + r() * 420) {
      const w = 160 + r() * 380, h = 18 + r() * 42;
      const pts = [x, -60, x + w * 0.18, -42 + h * 0.9, x + w * 0.3, -42 + h, x + w * 0.72, -42 + h * (0.92 + r() * 0.1), x + w * 0.86, -42 + h * 0.7, x + w, -60];
      m.poly(pts, { color: mix3(SANDS.far, hex('#a87a62'), 0.4), mat: MAT.plain, n: [0, 0.5, 0.86] });
    }
    // a distant ruined watchtower or two
    for (const fx of [600, 1500, 2200]) {
      m.at(fx, -40, 0.35, () => bastion(m, 0, 0, 40, 60, STONE_DEEP, { slits: false }));
    }
  }

  // ---------- far2: rolling dunes, villages and trees ----------
  {
    const m = far2.mesh;
    const x1 = END * far2.par + 1600;
    groundBand(m, -1600, x1, -72, 6, 0.004, SANDS.far2, 21);
    for (let x = -1600; x < x1; x += 180 + r() * 260) {
      dune(m, x, -70, 300 + r() * 360, 30 + r() * 50, SANDS.far2, Math.floor(r() * 1e6), 0.2);
    }
    for (let x = -1200; x < x1; x += 160 + r() * 520) {
      if (r() > 0.55) m.at(x, -52 + r() * 10, 0.28 + r() * 0.12, () => khejri(m, 0, 0, 140, Math.floor(r() * 1e5), { sway: 0.4 }));
    }
    // villages: clusters of flat-roofed houses
    for (const vx of [S[2], S[6], S[8], S[9]]) {
      const cx = vx * far2.par + 220;
      for (let k = 0; k < 9; k++) house(m, cx + k * 16 + r() * 6, -60, 12 + r() * 8, 8 + r() * 8, mix3(STONE, SANDS.far2, 0.4), 1, k + vx);
    }
    // distant chhatris on a hill near the cenotaphs
    const cx9 = S[9] * far2.par - 140;
    m.poly([cx9 - 200, -70, cx9 - 60, -30, cx9 + 70, -26, cx9 + 200, -70], { color: SANDS.far2, mat: MAT.sand, n: [0, 0.6, 0.8] });
    for (let k = 0; k < 6; k++) m.at(cx9 - 60 + k * 26, -30, 0.4 + r() * 0.15, () => chhatri(m, 0, 0, 40, { plinth: 8 }));
  }

  // ---------- mid: the golden fort, the city, the distant dunes ----------
  {
    const m = mid.mesh;
    const x1 = END * mid.par + 1600;
    groundBand(m, -1600, x1, -82, 6, 0.004, SANDS.mid, 31);
    for (let x = -1600; x < x1; x += 220 + r() * 300) {
      const nearFort = Math.abs(x - S[1] * mid.par) < 900;
      if (nearFort) continue;
      dune(m, x, -80, 360 + r() * 400, 40 + r() * 70, SANDS.mid, Math.floor(r() * 1e6), 0.25);
    }
    // Sonar Qila on Trikuta hill
    const fx = S[1] * mid.par + 140;
    buildFort(m, fx, -70, r);
    // the walled town spreading west below the fort
    for (let x = fx + 420; x < S[4] * mid.par + 600; x += 22 + r() * 26) {
      const w = 26 + r() * 40;
      if (r() > 0.82) m.at(x, -64, 0.45, () => haveli(m, 0, 0, w * 2, { floors: 2 + Math.floor(r() * 2), lit: 1, seed: x, jharokhas: r() > 0.5 }));
      else house(m, x, -64, w, 16 + r() * 26, mix3(STONE, STONE_LIGHT, r()), 1, x);
      if (r() > 0.93) m.at(x + 10, -64 + 30, 0.5, () => shikhara(m, 0, 0, 40, 90));
    }
    // Gadisar-style ghat pavilions near the stepwell
    m.at(S[5] * mid.par + 260, -66, 0.6, () => {
      for (let k = 0; k < 3; k++) chhatri(m, k * 70, 0, 50, { bays: 1, plinth: 16 });
    });
    // the observatory's other instruments, far behind
    m.at(S[10] * mid.par + 200, -66, 0.6, () => {
      m.dome(0, 0, 120, 40, plain(STONE_LIGHT), 'flat', 12, 4);
      m.dome(160, 0, 120, 40, plain(STONE_LIGHT), 'flat', 12, 4);
      m.cylinder(330, 0, 90, 60, st(STONE), 12, 1);
      kanguras(m, 290, 370, 60, 6, STONE);
    });
    // a camel caravan on a ridge in the golden hour
    for (let k = 0; k < 6; k++) {
      m.at(S[8] * mid.par - 300 + k * 30, -10 + Math.sin(k) * 2, 0.5, () => camel(m, 0, 0, 40, hex('#5a3a22'), 0, 1, k % 2 ? MAGENTA : KESARI));
    }
  }

  // ---------- near: backdrops for each station ----------
  buildNear(near.mesh, near.par, r, platforms);

  // ---------- main: terrain and the stations ----------
  {
    const m = main.mesh;
    buildMain(m, height, r, platforms, fires, chisels);
    terrainMesh(m, heights, step, -500, END + 600);
  }

  // ---------- fg: close framing silhouettes ----------
  {
    const m = fg.mesh;
    const x1 = END * fg.par + 800;
    for (let x = 0; x < x1; x += 90 + r() * 260) {
      const wx = x / fg.par;
      const gy = height(wx) - 70 - r() * 60;
      if (r() > 0.25) grass(m, x, gy - 40, 70 + r() * 70, Math.floor(r() * 1e5), hex('#8a7448'));
      else if (r() > 0.5) {
        const bw = 30 + r() * 50;
        blob(m, x, gy - 70, bw, bw * 0.5, { color: hex('#6a4a30'), mat: MAT.stone }, Math.floor(r() * 1e5));
        blob(m, x + bw * 0.7, gy - 76, bw * 0.55, bw * 0.3, { color: hex('#5a3e28'), mat: MAT.stone }, Math.floor(r() * 1e5));
      }
    }
    // a framing khejri at the very start, and a carved pillar in the town
    m.at(START_X * fg.par - 380, height(START_X) - 140, 1.5, () => khejri(m, 0, 0, 260, 7, { sway: 0.8 }));

  }

  return { layers: [far, far2, mid, near, main, fg], heights, step, platforms, height, platform, fires, chisels };
}

// ---------------------------------------------------------------- the fort

function buildFort(m: Mesh, x: number, y: number, r: () => number) {
  // Trikuta hill: a long sandstone ridge
  const hill: number[] = [x - 520, y - 40];
  for (let k = 0; k <= 24; k++) {
    const u = k / 24;
    const hx = x - 520 + u * 1040;
    const hy = y + Math.pow(Math.sin(u * Math.PI), 0.7) * 120 + (fbm1(u * 9, 4) - 0.5) * 16;
    hill.push(hx, hy);
  }
  hill.push(x + 520, y - 40);
  m.poly(hill, { color: hex('#b98850'), mat: MAT.stone, n: [0, 0.55, 0.83] });
  for (let k = 0; k < 18; k++) {
    const rx = x - 420 + r() * 840;
    rock(m, rx, y + 20 + r() * 50, 30 + r() * 50, 10 + r() * 16, hex('#a87a46'), k);
  }
  // lower ring of walls and bastions following the hill
  const ring = (y0: number, w: number, n: number, size: number, h: number) => {
    for (let k = 0; k < n; k++) {
      const bx = x - w / 2 + (w * k) / (n - 1);
      const u = (bx - (x - 520)) / 1040;
      const gy = y + Math.pow(Math.sin(u * Math.PI), 0.7) * 120 - 10 + y0;
      if (k < n - 1) {
        const nx = x - w / 2 + (w * (k + 1)) / (n - 1);
        const nu = (nx - (x - 520)) / 1040;
        const ny = y + Math.pow(Math.sin(nu * Math.PI), 0.7) * 120 - 10 + y0;
        const top = Math.max(gy, ny) + h * 0.7;
        m.poly([bx, gy - 10, nx, ny - 10, nx, top, bx, top], st(STONE));
        cornice(m, bx, top, nx - bx, STONE, 2);
        kanguras(m, bx + 2, nx - 2, top + 2, 4.5, STONE);
      }
      bastion(m, bx, gy - 10, size * (0.85 + r() * 0.3), h + r() * 14, STONE, { cap: r() > 0.7 });
    }
  };
  ring(0, 780, 13, 34, 48);
  ring(60, 560, 9, 30, 52);
  // palaces and temples crowning the fort
  const crownY = y + 150;
  m.at(x - 250, crownY, 0.62, () => haveli(m, 0, 0, 180, { floors: 3, lit: 1, seed: 3, roofChhatris: true }));
  m.at(x - 120, crownY + 6, 0.62, () => haveli(m, 0, 0, 130, { floors: 4, lit: 1, seed: 5 }));
  m.at(x + 10, crownY, 0.62, () => haveli(m, 0, 0, 200, { floors: 3, lit: 1, seed: 9, roofChhatris: true }));
  m.at(x + 150, crownY + 10, 0.6, () => shikhara(m, 0, 0, 60, 140));
  m.at(x + 205, crownY + 10, 0.55, () => shikhara(m, 0, 0, 50, 110));
  m.at(x + 250, crownY, 0.62, () => haveli(m, 0, 0, 110, { floors: 2, lit: 1, seed: 11 }));
  // the royal palace's tall jharokha tower
  m.at(x - 40, crownY + 6, 0.62, () => {
    m.rect(0, 0, 60, 230, st(STONE_LIGHT));
    for (let f = 0; f < 4; f++) jharokha(m, 30, 40 + f * 48, 34, STONE_LIGHT, 1);
    cornice(m, 0, 230, 60, STONE_LIGHT, 3);
    chhatri(m, 30, 233, 40, { plinth: 4, color: STONE_LIGHT });
  });
  // flags on the highest towers
  for (const fx of [x - 20, x + 180]) {
    m.ribbon([[fx, crownY + 160], [fx, crownY + 220]], 0.8, plain(WOOD));
    m.poly([fx, crownY + 220, fx + 26, crownY + 212, fx, crownY + 202], { color: SAFFRON, mat: MAT.cloth, sway: 3 });
  }
}

// ---------------------------------------------------------------- near layer

function buildNear(m: Mesh, p: number, r: () => number, _platforms: World['platforms']) {
  const S = SX;
  const L = (x: number) => x * p;
  const x1 = END * p + 1200;
  groundBand(m, -1000, x1, -62, 6, 0.004, SANDS.near, 41);
  // continuous low dunes behind everything
  for (let x = -1000; x < x1; x += 260 + r() * 300) {
    const wx = x / p;
    const town = wx > S[1] - 900 && wx < S[5] + 900;
    if (town) continue;
    dune(m, x, -60, 420 + r() * 420, 40 + r() * 80, SANDS.near, Math.floor(r() * 1e6), 0.25);
  }
  // town ground
  m.rect(L(S[1] - 900), -3000, L(S[5] + 900) - L(S[1] - 900), 2950, { color: SANDS.near, mat: MAT.sand, n: [0, 0.5, 0.86] });

  // fort station: the fort's outermost wall with the first gate, climbing toward the hill
  m.at(L(S[1]) - 420, -50, 1.4, () => {
    wall(m, 0, 0, 160, 70, STONE, 6);
    bastion(m, 0, 0, 50, 90, STONE, { cap: true });
    bastion(m, 160, 0, 54, 96, STONE, { cap: false });
    wall(m, 160, 0, 220, 80, STONE, 6);
    bastion(m, 380, 0, 56, 104, STONE, { cap: true });
  });

  // stone carvers' yard: a facade in progress with bamboo scaffolding
  {
    const cx = L(S[2]);
    m.at(cx - 200, -50, 1.5, () => {
      haveli(m, 0, 0, 220, { floors: 3, lit: 0.6, seed: 21, door: true });
      // scaffolding
      for (let k = 0; k <= 5; k++) m.ribbon([[k * 44, 0], [k * 44 + 2, 150]], 1.1, plain(hex('#8a6a40')));
      for (let f = 1; f <= 3; f++) m.ribbon([[-4, f * 40], [224, f * 40 + 2]], 1, plain(hex('#8a6a40')));
    });
    m.at(cx + 260, -50, 1.4, () => {
      house(m, 0, 0, 140, 90, STONE_LIGHT, 0.6, 3);
      chajja(m, 0, 70, 140, 8, STONE_LIGHT);
    });
  }

  // bazaar: shop fronts with awnings
  {
    const cx = L(S[3]);
    m.at(cx - 520, -50, 1.4, () => {
      for (let k = 0; k < 6; k++) {
        const x = k * 120;
        haveli(m, x, 0, 110, { floors: 2 + (k % 2), lit: 0.8, seed: 40 + k, jharokhas: true });
        // shop opening and awning
        recess(m, [x + 20, 10, x + 90, 10, x + 90, 44, x + 20, 44], 0.5, 0.35);
        const awn = [MAGENTA, INDIGO, SAFFRON, LEHERIYA][k % 4];
        m.quad(x + 14, 52, x + 96, 52, x + 104, 40, x + 6, 40, { color: awn, mat: MAT.cloth, n: [0, 0.6, 0.8] });
      }
    });
  }

  // merchants' havelis: the grand, intricately carved street
  {
    const cx = L(S[4]);
    m.at(cx - 640, -50, 1.65, () => {
      let x = 0;
      for (let k = 0; k < 5; k++) {
        const w = 120 + (k % 3) * 30;
        haveli(m, x, 0, w, { floors: 3 + (k % 2), lit: 1, seed: 60 + k, roofChhatris: k % 2 === 0 });
        x += w + 4;
      }
    });
  }

  // stepwell: the far wall of the pit, levels of interlocking flights
  {
    const cx = L(S[5]);
    m.at(cx, -40, 1, () => {
      const w = 980;
      m.rect(-w / 2 - 60, -40, w + 120, 50, st(STONE));
      stepwellWall(m, -w / 2, 0, w, 380, STONE);
      // water at the bottom
      m.rect(-w / 2, -380, w, 40, { color: hex('#2c4a52'), mat: MAT.water });
      // galleried pavilion on the far side
      m.at(-120, 0, 1, () => {
        m.rect(0, 0, 240, 40, st(STONE));
        for (let k = 0; k < 4; k++) chhatri(m, 30 + k * 60, 40, 46, { plinth: 4 });
      });
    });
  }

  // archery ground: straw butts with painted rings, tents and pennants
  {
    const cx = L(S[6]);
    m.at(cx - 300, -50, 1, () => {
      for (let k = 0; k < 4; k++) {
        const tx = k * 150;
        m.ribbon([[tx - 14, 0], [tx, 60]], 1.2, plain(WOOD));
        m.ribbon([[tx + 14, 0], [tx, 60]], 1.2, plain(WOOD));
        m.disc(tx, 54, 26, 26, plain(hex('#d8c08a')), 20, 0.5);
        m.disc(tx, 54, 18, 18, plain(hex('#c0392b')), 20, 0.3);
        m.disc(tx, 54, 10, 10, plain(hex('#f0e0b0')), 16, 0.2);
        m.disc(tx, 54, 4, 4, plain(hex('#2c3a86')), 10, 0.1);
      }
      // a royal tent
      m.at(700, 0, 1, () => {
        m.poly([-80, 0, 80, 0, 70, 60, -70, 60], { color: hex('#f2e6cc'), mat: MAT.cloth });
        m.poly([-90, 60, 90, 60, 0, 110], { color: hex('#c0392b'), mat: MAT.cloth });
        for (let k = -3; k <= 3; k++) m.rect(k * 20 - 4, 0, 8, 60, { color: hex('#c0392b'), mat: MAT.cloth, ao: 0.9 });
        m.poly([-20, 0, 20, 0, 0, 44], { color: RECESS, mat: MAT.plain, em: 0.6 });
        m.ribbon([[0, 110], [0, 140]], 1, plain(WOOD));
        m.poly([0, 140, 24, 134, 0, 128], { color: SAFFRON, mat: MAT.cloth, sway: 3 });
      });
    });
  }

  // caravanserai: arcaded courtyard walls, camels at rest, kites overhead
  {
    const cx = L(S[8]);
    m.at(cx - 480, -50, 1.3, () => {
      const w = 760;
      m.rect(0, 0, w, 110, st(STONE));
      const holes: number[][] = [];
      for (let k = 0; k < 11; k++) holes.push(archPts(30 + k * 68, 6, 46, 74, 3, 14));
      for (const hp of holes) recess(m, hp, 0.9, 0.3);
      cornice(m, 0, 110, w, STONE, 3);
      kanguras(m, 0, w, 113, 6, STONE);
      chhatri(m, 0, 113, 50, { plinth: 6 });
      chhatri(m, w, 113, 50, { plinth: 6 });
      pol(m, w / 2, 0, 120, 150, STONE, 1);
    });
    for (let k = 0; k < 5; k++) {
      m.at(cx - 340 + k * 140, 150 + (k % 2) * 60, 1, () => kite(m, 0, 0, 12, [MAGENTA, SAFFRON, INDIGO, LEHERIYA, hex('#f2c230')][k], hex('#f4e6c8')));
    }
  }

  // royal cenotaphs: Bada Bagh, a hill crowded with chhatris
  {
    const cx = L(S[9]);
    m.poly([cx - 700, -60, cx - 400, 30, cx - 100, 60, cx + 300, 54, cx + 700, -60], { color: SANDS.near, mat: MAT.sand, n: [0, 0.6, 0.8] });
    const placements = [
      [-520, 0.9], [-430, 1.3], [-330, 1.0], [-240, 1.7], [-120, 1.2], [-20, 2.2], [110, 1.4], [220, 1.8], [330, 1.1], [430, 1.5], [540, 0.9],
    ];
    for (const [dx, s] of placements) {
      const gx = cx + dx;
      const gy = dx < -100 ? -60 + (dx + 700) / 600 * 120 : 50;
      m.at(gx, Math.min(gy, 56), s, () => chhatri(m, 0, 0, 52, { bays: s > 1.6 ? 3 : 1, plinth: 14, dome: s > 2 ? 'onion' : 'hemi' }));
    }
  }

  // observatory: quadrant scales flanking the sundial
  {
    const cx = L(S[10]);
    m.at(cx - 40, -40, 1, () => {
      // Ram Yantra: open cylindrical walls with pillars
      for (const rx of [-420, 520]) {
        m.at(rx, 0, 1, () => {
          const holes: number[][] = [];
          for (let k = 0; k < 6; k++) holes.push(archPts(-75 + k * 30, 8, 18, 60, 2, 10));
          m.poly([-95, 0, 95, 0, 95, 80, -95, 80], st(STONE_LIGHT), holes);
          for (const hp of holes) recess(m, hp, 0, 0.35);
          cornice(m, -95, 80, 190, STONE_LIGHT, 3);
          m.cylinder(0, -20, 200, 20, plain(STONE), 12, 1);
        });
      }
      m.rect(-600, -30, 1300, 34, st(STONE));
    });
  }
}

// ---------------------------------------------------------------- main plane

function buildMain(m: Mesh, height: (x: number) => number, r: () => number, platforms: World['platforms'], fires: World['fires'], chisels: number[]) {
  const S = SX;
  const g = height;

  // scattered khejri and grass in the open desert
  for (let x = -300; x < END; x += 140 + r() * 380) {
    const town = (x > S[1] - 800 && x < S[5] + 800) || Math.abs(x - S[8]) < 600 || Math.abs(x - S[10]) < 500;
    const nearStation = S.some((sx, i) => i > 0 && Math.abs(x - sx) < 520);
    if (town || nearStation) continue;
    if (r() > 0.72) m.at(x, g(x) - 4, 0.9 + r() * 0.5, () => khejri(m, 0, 0, 220, Math.floor(r() * 1e5)));
    else grass(m, x, g(x) - 2, 22 + r() * 22, Math.floor(r() * 1e5));
  }

  // 1. fort: the outer gate the traveller passes on his way up
  m.at(S[1] + 260, g(S[1] + 260), 2.2, () => pol(m, 0, 0, 130, 150, STONE, 1));
  m.at(S[1] - 380, g(S[1] - 380), 1, () => {
    camel(m, 0, 0, 120, hex('#7a4e2c'), 1, 1, MAGENTA);
  });
  m.at(S[1] - 220, g(S[1] - 220), 1, () => person(m, 0, 0, 86, { pose: 'carry', garment: MAGENTA, veil: SAFFRON, dir: -1 }));

  // 2. stone carvers' yard: blocks to climb on, a jharokha half-carved, carvers at work
  {
    const sx = S[2];
    const gy = g(sx);
    const blocks: [number, number, number][] = [[-420, 70, 46], [-330, 90, 64], [-180, 110, 40], [160, 80, 52], [300, 120, 30]];
    for (const [dx, w, h] of blocks) {
      m.rect(sx + dx, gy - 2, w, h, st(STONE_LIGHT));
      m.quad(sx + dx, gy + h - 2, sx + dx + w, gy + h - 2, sx + dx + w - 4, gy + h + 3, sx + dx + 4, gy + h + 3, plain(STONE_LIGHT, { n: [0, 0.95, 0.3] }));
      platforms.push({ x0: sx + dx + 2, x1: sx + dx + w - 2, y: gy + h - 2 });
    }
    // a finished jharokha resting on trestles, waiting to be lifted
    m.at(sx - 40, gy + 34, 2.2, () => jharokha(m, 0, 0, 40, STONE_LIGHT, 0));
    m.ribbon([[sx - 80, gy], [sx - 70, gy + 36]], 2, plain(WOOD));
    m.ribbon([[sx, gy], [sx - 10, gy + 36]], 2, plain(WOOD));
    // carvers
    m.at(sx + 120, gy, 1, () => person(m, 0, 0, 84, { pose: 'carve', turban: hex('#f2f0e8'), dir: 1 }));
    m.at(sx + 350, gy + 28, 1, () => person(m, 0, 0, 84, { pose: 'sit', turban: KESARI }));
    m.at(sx - 300, gy + 62, 1, () => person(m, 0, 0, 84, { pose: 'carve', turban: hex('#c0392b'), dir: -1 }));
    chisels.push(sx + 120, sx - 300);
    // chips and loose stones
    for (let k = 0; k < 20; k++) rock(m, sx - 500 + r() * 1000, gy - 2, 6 + r() * 12, 3 + r() * 5, STONE_LIGHT, k + 300);
  }

  // 3. dyers' bazaar: stalls with cloth canopies you can jump on, lines of dyed fabric
  {
    const sx = S[3];
    const gy = g(sx);
    const colors: V3[] = [MAGENTA, SAFFRON, INDIGO, LEHERIYA, hex('#f2c230'), MAROON, hex('#e85a8a')];
    for (let k = 0; k < 4; k++) {
      const x = sx - 520 + k * 300;
      const c = colors[k % colors.length];
      m.ribbon([[x, gy], [x, gy + 130]], 2.2, plain(WOOD));
      m.ribbon([[x + 170, gy], [x + 170, gy + 130]], 2.2, plain(WOOD));
      m.quad(x - 18, gy + 128, x + 188, gy + 128, x + 180, gy + 148, x - 10, gy + 148, { color: c, mat: MAT.cloth, n: [0, 0.7, 0.7], sway: 0.5 });
      for (let s = 0; s < 6; s++) m.rect(x - 14 + s * 34, gy + 124, 17, 6, { color: mix3(c, hex('#ffffff'), 0.35), mat: MAT.cloth, sway: 1 });
      platforms.push({ x0: x - 14, x1: x + 184, y: gy + 146 });
      // folded bolts of cloth stacked on the counter
      m.rect(x + 10, gy, 150, 40, plain(WOOD, { ao: 0.9 }));
      for (let b = 0; b < 8; b++) {
        const bc = colors[(b + k * 3) % colors.length];
        m.rect(x + 14 + (b % 4) * 36, gy + 40 + Math.floor(b / 4) * 12, 34, 11, { color: bc, mat: MAT.cloth, n: [0, 0.4, 0.92] });
      }
    }
    clothLine(m, sx - 600, gy + 300, sx + 700, gy + 290, colors, 1);
    clothLine(m, sx - 300, gy + 380, sx + 400, gy + 400, colors.slice().reverse(), 5);
    m.at(sx + 600, gy, 1, () => person(m, 0, 0, 86, { pose: 'stand', garment: INDIGO, veil: MAGENTA, dir: -1 }));
    m.at(sx - 600, gy, 1, () => person(m, 0, 0, 86, { pose: 'stand', turban: hex('#f2c230'), dir: 1 }));
  }

  // 4. merchants' havelis: the traveller walks beneath carved balconies
  {
    const sx = S[4];
    const gy = g(sx);
    m.at(sx - 520, gy - 4, 2.4, () => haveli(m, 0, 0, 150, { floors: 3, lit: 1, seed: 81, roofChhatris: true }));
    m.at(sx + 120, gy - 4, 2.4, () => haveli(m, 0, 0, 170, { floors: 3, lit: 1, seed: 87 }));
    // stone benches (oti) along the street, climbable
    for (const dx of [-180, 40, 560]) {
      m.rect(sx + dx, gy - 2, 100, 30, st(STONE_LIGHT));
      cornice(m, sx + dx, gy + 28, 100, STONE_LIGHT, 2);
      platforms.push({ x0: sx + dx, x1: sx + dx + 100, y: gy + 30 });
    }
    m.at(sx + 600, gy + 30, 1, () => person(m, 0, 0, 84, { pose: 'sit', turban: hex('#c0392b') }));
  }

  // 5. stepwell: side galleries frame the descent
  {
    const sx = S[5];
    for (const side of [-1, 1]) {
      const x = sx + side * 800;
      const gy = g(x);
      m.at(x, gy, 1.6, () => chhatri(m, 0, 0, 70, { bays: 3, plinth: 10 }));
    }
    // carved niches on the side walls of the flights
    for (let k = 1; k < 14; k += 3) {
      for (const side of [-1, 1]) {
        const x = sx + side * (720 - k * 40);
        recess(m, archPts(x, g(x) + 18, 16, 30, 2), 0, 0.4);
      }
    }
  }

  // 6. archery ground: an archer at the line, a bundle of arrows
  {
    const sx = S[6];
    const gy = g(sx);
    m.at(sx - 120, gy, 1, () => person(m, 0, 0, 88, { pose: 'stand', turban: SAFFRON, dir: 1 }));
    m.ribbon([[sx - 92, gy + 46], [sx - 70, gy + 90], [sx - 92, gy + 134]], 1.2, plain(WOOD));
    for (let k = 0; k < 7; k++) m.ribbon([[sx + 60 + k * 3, gy], [sx + 64 + k * 4, gy + 70]], 0.7, plain(hex('#8a6a40')));
    m.ribbon([[sx - 420, gy], [sx - 420, gy + 180]], 1.5, plain(WOOD));
    m.poly([sx - 420, gy + 180, sx - 360, gy + 170, sx - 420, gy + 156], { color: KESARI, mat: MAT.cloth, sway: 3 });
  }

  // 7. great dunes: a caravan resting at the foot, the long slide down
  {
    const sx = S[7];
    m.at(sx + 1050, g(sx + 1050), 1, () => camel(m, 0, 0, 120, hex('#7a4e2c'), 0, -1, INDIGO));
    m.at(sx + 1180, g(sx + 1180), 1, () => camel(m, 0, 0, 110, hex('#6a4228'), 1, -1, KESARI));
    for (let k = 0; k < 12; k++) {
      const x = sx - 900 + k * 170;
      grass(m, x, g(x) - 2, 28, k + 900);
    }
  }

  // 8. caravanserai: a well, traders, lanterns
  {
    const sx = S[8];
    const gy = g(sx);
    m.at(sx - 160, gy, 1, () => {
      m.cylinder(0, 0, 90, 40, st(STONE), 12, 1);
      cornice(m, -45, 40, 90, STONE, 3);
      m.ribbon([[-40, 40], [-36, 120]], 2, plain(WOOD));
      m.ribbon([[40, 40], [36, 120]], 2, plain(WOOD));
      m.ribbon([[-40, 118], [40, 118]], 2, plain(WOOD));
    });
    m.at(sx + 90, gy, 1, () => person(m, 0, 0, 86, { pose: 'stand', turban: MAGENTA, dir: -1 }));
    m.at(sx + 160, gy, 1, () => person(m, 0, 0, 86, { pose: 'stand', turban: hex('#f2f0e8'), dir: 1 }));
    m.at(sx + 330, gy, 1, () => camel(m, 0, 0, 120, hex('#7a4e2c'), 1, -1, MAGENTA));
    for (let k = 0; k < 6; k++) {
      const lx = sx - 500 + k * 200;
      m.ribbon([[lx, gy], [lx, gy + 150]], 1.6, plain(WOOD));
      m.ribbon([[lx, gy + 150], [lx + 14, gy + 150]], 1.2, plain(WOOD));
      m.disc(lx + 14, gy + 138, 6, 8, { color: hex('#ffb050'), mat: MAT.plain, em: 1 });
      m.poly([lx + 8, gy + 146, lx + 20, gy + 146, lx + 14, gy + 152], plain(WOOD));
    }
  }

  // 9. cenotaphs: the bards sing at sunset
  {
    const sx = S[9];
    const gy = g(sx);
    m.at(sx - 250, gy, 2.6, () => chhatri(m, 0, 0, 80, { bays: 3, plinth: 14, dome: 'hemi' }));
    m.at(sx + 320, gy, 2.0, () => chhatri(m, 0, 0, 70, { bays: 1, plinth: 12, dome: 'onion' }));
    m.at(sx + 60, gy, 1, () => person(m, 0, 0, 84, { pose: 'sit', turban: hex('#c0392b') }));
    m.at(sx + 130, gy, 1, () => person(m, 0, 0, 84, { pose: 'sit', turban: SAFFRON }));
    m.at(sx + 30, gy, 1, () => {
      // kamaicha player, seated, instrument upright
      m.ball(26, 30, 7, { color: hex('#6a3a1e'), mat: MAT.plain });
      m.ribbon([[26, 34], [26, 76]], 1.2, { color: hex('#6a3a1e'), mat: MAT.plain });
    });
    m.at(sx + 200, gy, 1, () => {
      // a dholak drum
      m.cylinder(0, 0, 30, 22, plain(hex('#7a3a1a')), 8, 1);
    });
  }

  // 10. observatory: the great sundial with its walkable staircase
  {
    const sx = S[10];
    const base = g(sx - 400);
    samratYantra(m, sx - 320, 20, 500, 420, STONE_LIGHT);
    void base;
    // Jai Prakash: sunken hemispherical bowls with a lattice rim
    m.at(sx + 420, g(sx + 420), 1, () => {
      m.rect(-110, 0, 220, 30, st(STONE));
      for (const bx of [-55, 55]) {
        m.dome(bx, 30, 100, 20, plain(STONE_LIGHT), 'flat', 10, 3);
        m.rect(bx - 1, 30, 2, 44, plain(STONE_DEEP));
      }
    });
  }

  // 11. camp: the last fire
  {
    const sx = S[11];
    const gy = g(sx);
    const fx = sx + 40;
    fires.push({ x: fx, y: g(fx) });
    // stones ringing the fire
    for (let k = 0; k < 7; k++) rock(m, fx - 30 + k * 10, g(fx) - 2, 10, 6, hex('#6a5040'), k + 1200);
    // logs and flames
    m.ribbon([[fx - 22, g(fx) + 2], [fx + 22, g(fx) + 10]], 3, plain(WOOD));
    m.ribbon([[fx + 22, g(fx) + 2], [fx - 22, g(fx) + 10]], 3, plain(WOOD));
    for (let k = 0; k < 5; k++) {
      const off = (k - 2) * 7;
      flame(m, fx + off, g(fx) + 6, 18 - Math.abs(k - 2) * 3, 58 - Math.abs(k - 2) * 12 + r() * 8, k + 7);
    }
    // a tent and a resting camel
    m.at(sx + 260, g(sx + 260), 1, () => {
      m.poly([-90, 0, 90, 0, 0, 110], { color: hex('#d8c8a8'), mat: MAT.cloth });
      m.poly([-30, 0, 30, 0, 0, 70], { color: RECESS, mat: MAT.plain, em: 0.8 });
    });
    m.at(sx - 220, g(sx - 220), 1, () => camel(m, 0, 0, 120, hex('#6a4228'), 1, 1, KESARI));
    m.at(sx + 120, g(sx + 120), 1, () => {
      // a sleeping dog curled by the warmth
      blob(m, 0, 8, 20, 9, { color: hex('#7a5a3a'), mat: MAT.plain }, 5);
    });
  }

  void jali; void kalash; void GOLD;
}
