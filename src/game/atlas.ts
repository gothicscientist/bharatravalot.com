// A 64x64 atlas of 16px greyscale pixel textures. Colour comes from the voxel; these only add grain.
import * as THREE from 'three';
import { T } from './voxels';

export function makeAtlas() {
  const N = 16, S = N * 4;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(S, S);
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const tiles: Record<number, (x: number, y: number) => number> = {
    [T.noise]: () => 0.9 + r() * 0.1,
    [T.brick]: (x, y) => {
      const row = Math.floor(y / 4);
      const off = row % 2 ? 4 : 0;
      const bx = (x + off) % 8;
      if (y % 4 === 3 || bx === 7) return 0.68 + r() * 0.06;
      return (y % 4 === 0 ? 1.0 : 0.92) + r() * 0.06 - (bx === 0 ? 0.02 : 0);
    },
    [T.sand]: (x, y) => {
      const ripple = Math.sin((x * 0.5 + y * 1.6)) * 0.025;
      return 0.91 + r() * 0.07 + ripple - (r() > 0.96 ? 0.12 : 0);
    },
    [T.smooth]: (x, y) => (x === 0 || y === 0 ? 0.9 : x === 15 || y === 15 ? 0.86 : 0.97 + r() * 0.03),
    [T.tile]: (x, y) => {
      if (x % 8 === 0 || y % 8 === 0) return 0.7 + r() * 0.05;
      const cx = (x % 8) - 4, cy = (y % 8) - 4;
      return (Math.abs(cx) + Math.abs(cy) < 3 ? 1.0 : 0.9) + r() * 0.05;
    },
    [T.plank]: (x, y) => {
      if (x % 4 === 3) return 0.62;
      const grain = Math.sin(y * 0.9 + (x >> 2) * 3.1) * 0.04;
      return 0.86 + grain + r() * 0.08 - ((y + (x >> 2) * 5) % 13 === 0 ? 0.1 : 0);
    },
    [T.cloth]: (x, y) => ((x + y) % 2 ? 0.94 : 1.0) - (y % 6 === 0 ? 0.08 : 0) + r() * 0.03,
    [T.leaf]: (x, y) => 0.78 + r() * 0.22 - ((x + y) % 5 === 0 ? 0.1 : 0),
    [T.glyph]: (x, y) => {
      const on = (x > 3 && x < 12 && (y === 4 || y === 11)) || ((x === 4 || x === 11) && y > 4 && y < 11) || (x === 8 && y > 6 && y < 10);
      return on ? 0.55 : 0.95 + r() * 0.05;
    },
    [T.key]: (x, y) => {
      const e = Math.min(x, y, 15 - x, 15 - y);
      if (e === 0) return 0.62;
      if (e === 1) return y < 8 ? 1.0 : 0.82;
      return 0.94 + r() * 0.02;
    },
    [T.rug]: (x, y) => {
      const cx = Math.abs(x - 7.5), cy = Math.abs(y - 7.5);
      if (x === 0 || y === 0 || x === 15 || y === 15) return 0.6;
      if (x === 2 || y === 2 || x === 13 || y === 13) return 1.25;
      const d = cx + cy;
      return d < 3 ? 1.3 : d < 5 ? 0.75 : d < 6.5 ? 1.15 : 0.9 + r() * 0.04;
    },
    [T.rock]: (x, y) => 0.82 + r() * 0.18 - (Math.sin(y * 1.3 + x * 0.2) > 0.85 ? 0.12 : 0),
    [T.star]: (x, y) => {
      if (x === 0 || y === 0) return 0.72;
      const cx = Math.abs(x - 8), cy = Math.abs(y - 8);
      const star = Math.max(cx, cy) < 4 || cx + cy < 6;
      return star ? 1.25 + r() * 0.03 : 0.88 + r() * 0.04;
    },
    [T.block]: (x, y) => {
      if (x === 0 || y === 0) return 0.74;
      if (x === 15 || y === 15) return 0.84;
      return 0.94 + r() * 0.06;
    },
    [T.bigbrick]: (x, y) => {
      const row = Math.floor(y / 8);
      const bx = (x + (row % 2 ? 8 : 0)) % 16;
      if (y % 8 === 7 || bx === 15) return 0.7;
      return 0.92 + r() * 0.08 + (y % 8 === 0 ? 0.04 : 0);
    },
    [T.water]: () => 0.95 + r() * 0.05,
  };

  for (let t = 0; t < 16; t++) {
    const f = tiles[t] ?? tiles[T.noise];
    const ox = (t % 4) * N, oy = Math.floor(t / 4) * N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = Math.max(0, Math.min(1, f(x, y) / 1.3));
      const i = ((oy + y) * S + ox + x) * 4;
      const c = Math.round(v * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = true;
  return tex;
}

/** Atlas values are divided by 1.3 so highlights fit; the material multiplies them back. */
export const ATLAS_GAIN = 1.3;
