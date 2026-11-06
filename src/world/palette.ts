import { hex, type V3 } from './mesh';

/**
 * The colour of one day in the Thar. `t` runs 0..1 from before dawn to deep night and is
 * driven by how far west the traveller has walked.
 */
interface Key {
  t: number;
  zenith: string;
  mid: string;
  horizon: string;
  sun: string; // direct light colour
  sunI: number; // direct light intensity
  ambSky: string;
  ambGround: string;
  ambI: number;
  fog: string; // aerial perspective
  stars: number;
  lamps: number; // how lit windows and diyas are
  bloom: number;
  exposure: number;
  grade: string; // shadow tint for grading
}

const KEYS: Key[] = [
  { t: 0.0, zenith: '#060a1f', mid: '#141b3d', horizon: '#38365e', sun: '#4a5a9a', sunI: 0.0, ambSky: '#2a3566', ambGround: '#1a1830', ambI: 0.42, fog: '#2c2c52', stars: 1, lamps: 0.9, bloom: 0.9, exposure: 1.15, grade: '#101836' },
  { t: 0.05, zenith: '#0e1736', mid: '#2e3366', horizon: '#9a6f86', sun: '#ff9a6a', sunI: 0.05, ambSky: '#4a5288', ambGround: '#3a2a3c', ambI: 0.6, fog: '#5d4d72', stars: 0.6, lamps: 0.7, bloom: 0.9, exposure: 1.1, grade: '#1a1a3a' },
  { t: 0.1, zenith: '#2a3f74', mid: '#7a6a96', horizon: '#ffae74', sun: '#ffb070', sunI: 0.9, ambSky: '#7c88b8', ambGround: '#8a5a4a', ambI: 0.55, fog: '#d79a86', stars: 0.1, lamps: 0.2, bloom: 1.1, exposure: 1.0, grade: '#2a2048' },
  { t: 0.18, zenith: '#3466ac', mid: '#88aad2', horizon: '#f4c896', sun: '#ffcc8a', sunI: 1.3, ambSky: '#86a8d6', ambGround: '#a87e56', ambI: 0.42, fog: '#dcc0a0', stars: 0, lamps: 0, bloom: 0.65, exposure: 0.96, grade: '#2a2844' },
  { t: 0.3, zenith: '#2c64b8', mid: '#7eaedc', horizon: '#e4dcc8', sun: '#ffeccc', sunI: 1.45, ambSky: '#8ab2e0', ambGround: '#c09466', ambI: 0.38, fog: '#d8d0c0', stars: 0, lamps: 0, bloom: 0.45, exposure: 0.92, grade: '#282a44' },
  { t: 0.45, zenith: '#245ab4', mid: '#74a6dc', horizon: '#d8e4ea', sun: '#fff4dc', sunI: 1.55, ambSky: '#86ade0', ambGround: '#c09060', ambI: 0.36, fog: '#d6d8d0', stars: 0, lamps: 0, bloom: 0.4, exposure: 0.9, grade: '#2a2c44' },
  { t: 0.6, zenith: '#305fb0', mid: '#8cb0d8', horizon: '#f0d4a0', sun: '#ffdca0', sunI: 1.45, ambSky: '#8eaed8', ambGround: '#b88654', ambI: 0.38, fog: '#e2c8a0', stars: 0, lamps: 0, bloom: 0.55, exposure: 0.94, grade: '#2c2840' },
  { t: 0.7, zenith: '#4c64a4', mid: '#c49a9a', horizon: '#ffbe6e', sun: '#ffb45a', sunI: 1.35, ambSky: '#9a92b8', ambGround: '#b0703e', ambI: 0.5, fog: '#f0b07c', stars: 0, lamps: 0.05, bloom: 1.0, exposure: 1.0, grade: '#30203e' },
  { t: 0.78, zenith: '#3a3a78', mid: '#b0607a', horizon: '#ff8a3e', sun: '#ff7a32', sunI: 1.1, ambSky: '#7a6a9e', ambGround: '#8a4632', ambI: 0.55, fog: '#e0785a', stars: 0.05, lamps: 0.35, bloom: 1.3, exposure: 1.02, grade: '#2c1838' },
  { t: 0.84, zenith: '#1c1c48', mid: '#5a3a6e', horizon: '#c0546a', sun: '#d0485a', sunI: 0.2, ambSky: '#4a4a82', ambGround: '#4a2a3a', ambI: 0.6, fog: '#6a4068', stars: 0.4, lamps: 0.8, bloom: 1.1, exposure: 1.08, grade: '#181838' },
  { t: 0.9, zenith: '#070a20', mid: '#141a40', horizon: '#2e2a58', sun: '#6a7ab8', sunI: 0.0, ambSky: '#2e3a74', ambGround: '#1a1830', ambI: 0.42, fog: '#242450', stars: 1, lamps: 1, bloom: 1.1, exposure: 1.18, grade: '#0c1230' },
  { t: 1.0, zenith: '#04061a', mid: '#0e1234', horizon: '#26244c', sun: '#6a7ab8', sunI: 0.0, ambSky: '#2a3470', ambGround: '#16142c', ambI: 0.4, fog: '#1e1e46', stars: 1, lamps: 1, bloom: 1.15, exposure: 1.2, grade: '#0a1030' },
];

export interface Light {
  t: number;
  zenith: V3;
  mid: V3;
  horizon: V3;
  sun: V3;
  ambSky: V3;
  ambGround: V3;
  fog: V3;
  grade: V3;
  stars: number;
  lamps: number;
  bloom: number;
  exposure: number;
  sunDir: V3; // world-space direction to the sun (z toward viewer)
  sunScreen: [number, number]; // normalised screen position, 0..1 (x), elevation (y) above horizon
  sunVisible: number;
  moonDir: V3;
  moonScreen: [number, number];
  moonI: number;
}

const parsed = KEYS.map((k) => ({
  ...k,
  zenithV: hex(k.zenith),
  midV: hex(k.mid),
  horizonV: hex(k.horizon),
  sunV: hex(k.sun, k.sunI),
  ambSkyV: hex(k.ambSky, k.ambI),
  ambGroundV: hex(k.ambGround, k.ambI),
  fogV: hex(k.fog),
  gradeV: hex(k.grade),
}));

const L = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const sm = (u: number) => u * u * (3 - 2 * u);

export const SUNRISE = 0.075;
export const SUNSET = 0.835;

export function lightAt(t: number): Light {
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < parsed.length - 2 && parsed[i + 1].t < t) i++;
  const a = parsed[i], b = parsed[i + 1];
  const u = sm(Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))));
  const n = (x: number, y: number) => x + (y - x) * u;

  // sun arc from east (left, behind the traveller) to west (ahead)
  const d = (t - SUNRISE) / (SUNSET - SUNRISE);
  const az = -1 + 2 * d; // -1 left .. 1 right
  const el = Math.sin(Math.PI * Math.max(-0.08, Math.min(1.08, d)));
  const sx = az * 0.95;
  const sy = el;
  const sz = 0.38 + 0.32 * Math.max(0, el);
  const l = Math.hypot(sx, sy, sz);
  const sunDir: V3 = [sx / l, sy / l, sz / l];

  // moon rises opposite as night falls; sits high on the right during the last stretch
  const moonU = Math.max(0, Math.min(1, (t - 0.82) / 0.18));
  const mAz = 0.9 - moonU * 1.1;
  const mEl = 0.25 + 0.55 * moonU;
  const ml = Math.hypot(mAz, mEl, 0.6);

  return {
    t,
    zenith: L(a.zenithV, b.zenithV, u),
    mid: L(a.midV, b.midV, u),
    horizon: L(a.horizonV, b.horizonV, u),
    sun: L(a.sunV, b.sunV, u),
    ambSky: L(a.ambSkyV, b.ambSkyV, u),
    ambGround: L(a.ambGroundV, b.ambGroundV, u),
    fog: L(a.fogV, b.fogV, u),
    grade: L(a.gradeV, b.gradeV, u),
    stars: n(a.stars, b.stars),
    lamps: n(a.lamps, b.lamps),
    bloom: n(a.bloom, b.bloom),
    exposure: n(a.exposure, b.exposure),
    sunDir,
    sunScreen: [0.5 + az * 0.42, el],
    sunVisible: Math.max(0, Math.min(1, (el + 0.05) / 0.1)),
    moonDir: [mAz / ml, mEl / ml, 0.6 / ml],
    moonScreen: [0.5 + mAz * 0.38, mEl],
    moonI: Math.max(0, Math.min(1, (t - 0.84) / 0.06)) * 0.9 + Math.max(0, Math.min(1, (0.06 - t) / 0.06)) * 0.6,
  };
}
