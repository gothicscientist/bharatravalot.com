import { Renderer, GPUMesh, type LayerDraw } from './renderer';
import { buildWorld, SX, STATION_T, STATION_VIEW, START_X, END, GAP } from './layout';
import { lightAt } from './palette';
import { Traveller } from './traveller';
import { Mesh, MAT, hex, clamp, lerp } from './mesh';
import { crane } from './art/nature';
import { UI } from './ui';
import { Sound } from './audio';
import { stations } from '../content';

const canvas = document.getElementById('world') as HTMLCanvasElement;

function piecewise(x: number, xs: number[], ys: number[]) {
  if (x <= xs[0]) return ys[0];
  for (let i = 0; i < xs.length - 1; i++) {
    if (x <= xs[i + 1]) {
      const u = (x - xs[i]) / (xs[i + 1] - xs[i]);
      const e = u * u * (3 - 2 * u);
      return ys[i] + (ys[i + 1] - ys[i]) * e;
    }
  }
  return ys[ys.length - 1];
}

export function start() {
  let renderer: Renderer;
  try {
    renderer = new Renderer(canvas);
  } catch (e) {
    console.warn(e);
    location.replace('/work/?from=world');
    return;
  }
  const gl = renderer.gl;
  const t0 = performance.now();
  const world = buildWorld();
  console.info(`world built in ${Math.round(performance.now() - t0)} ms`);
  const gpu = world.layers.map((l) => new GPUMesh(gl, l.mesh));
  const travellerMesh = new Mesh(8192);
  const travellerGPU = new GPUMesh(gl);
  const fxMesh = new Mesh(8192);
  const fxGPU = new GPUMesh(gl);
  const skyFxMesh = new Mesh(4096);
  const skyFxGPU = new GPUMesh(gl);

  const trav = new Traveller(START_X, world.height(START_X));
  const sound = new Sound();
  const ui = new UI({
    travel: (i) => travelTo(i),
    sound: (on) => sound.setEnabled(on),
    pause: (p) => (paused = p),
  });

  // ---------- input ----------
  const keys = new Set<string>();
  let jumpQueued = false;
  let targetX: number | null = null;
  let paused = false;
  addEventListener('keydown', (e) => {
    if (ui.modalOpen || ui.introOpen) return;
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd', 'shift'].includes(k)) {
      keys.add(k);
      targetX = null;
      ui.hintDone();
      e.preventDefault();
    }
    if ([' ', 'arrowup', 'w'].includes(k)) {
      jumpQueued = true;
      ui.hintDone();
      e.preventDefault();
    }
    if (k === 'enter' && ui.activeEntry) ui.openActive();
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  addEventListener(
    'wheel',
    (e) => {
      if (ui.modalOpen || ui.introOpen) return;
      if ((e.target as HTMLElement).closest('.card, .scroll-ok')) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const unit = e.deltaMode === 1 ? 32 : 1;
      targetX = clamp((targetX ?? trav.x) + d * unit * 1.4, 200, END - 320);
      ui.hintDone();
      e.preventDefault();
    },
    { passive: false },
  );

  let touch: { x: number; y: number; t: number; lastX: number; lastY: number; moved: boolean } | null = null;
  canvas.addEventListener('touchstart', (e) => {
    const p = e.touches[0];
    touch = { x: p.clientX, y: p.clientY, t: performance.now(), lastX: p.clientX, lastY: p.clientY, moved: false };
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!touch) return;
    const p = e.touches[0];
    const dx = p.clientX - touch.lastX, dy = p.clientY - touch.lastY;
    touch.lastX = p.clientX;
    touch.lastY = p.clientY;
    if (Math.hypot(p.clientX - touch.x, p.clientY - touch.y) > 10) touch.moved = true;
    // drag the world: swipe left or up to go west
    const d = -(Math.abs(dx) > Math.abs(dy) ? dx : dy) * 2.6;
    targetX = clamp((targetX ?? trav.x) + d, 200, END - 320);
    ui.hintDone();
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => {
    if (touch && !touch.moved && performance.now() - touch.t < 260) jumpQueued = true;
    touch = null;
  });

  // ---------- camera ----------
  let camX = trav.x + 120;
  let camY = trav.y + 200;
  let fade = 0;
  let fadeTarget = 1;
  let pendingJump: number | null = null;

  function travelTo(i: number) {
    const x = SX[i] - 140;
    if (Math.abs(x - trav.x) > GAP * 1.6) {
      fadeTarget = 0;
      pendingJump = x;
    } else {
      targetX = x;
    }
    keys.clear();
  }

  // ---------- ambient life ----------
  const flock = Array.from({ length: 11 }, (_, i) => ({
    ox: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * -26,
    oy: Math.ceil(i / 2) * -14 + (i % 3) * 2,
    ph: i * 0.7,
  }));
  const dust = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random(), v: 0.5 + Math.random() }));
  const embers = Array.from({ length: 28 }, () => ({ life: Math.random(), x: 0, y: 0, vx: 0, vy: 0, s: Math.random() }));

  const DUST = hex('#f6e2b0');
  const EMBER = hex('#ffae4a');

  // ---------- resize ----------
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, innerWidth < 800 ? 1.75 : 1.6);
    renderer.quality = innerWidth < 800 ? 'low' : 'high';
    renderer.resize(innerWidth, innerHeight, dpr);
  };
  resize();
  addEventListener('resize', resize);

  const qs = new URLSearchParams(location.search);
  const stillVH = +(qs.get('vh') || 0);
  const stillDY = +(qs.get('dy') || 0);
  // ---------- loop ----------
  let last = performance.now();
  let time = 0;
  let activeIdx = -1;
  let wind = 0;
  let frameAvg = 16;

  const loop = (now: number) => {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frameAvg = frameAvg * 0.95 + dt * 1000 * 0.05;
    if (paused) dt = 0;
    time += dt;

    // fades for long-distance travel
    fade += (fadeTarget - fade) * (1 - Math.exp(-dt * 6 - 0.0001));
    if (pendingJump !== null && fade < 0.02) {
      trav.x = pendingJump;
      trav.y = world.height(pendingJump);
      trav.vx = 0;
      camX = trav.x + 120;
      camY = trav.y + 200;
      targetX = pendingJump + 140;
      pendingJump = null;
      fadeTarget = 1;
    }

    // input to movement
    let move = 0;
    let run = keys.has('shift');
    if (keys.has('arrowright') || keys.has('d')) move += 1;
    if (keys.has('arrowleft') || keys.has('a')) move -= 1;
    if (move === 0 && targetX !== null) {
      const dx = targetX - trav.x;
      if (Math.abs(dx) > 8) {
        move = Math.sign(dx);
        run = Math.abs(dx) > 420;
      } else targetX = null;
    }
    if (ui.introOpen) move = 0;
    // stop at the edges of the world
    if (trav.x > END - 330 && move > 0) move = 0;
    if (trav.x < 160 && move < 0) move = 0;

    // sit by the fire at the end
    const fire = world.fires[0];
    const nearFire = fire && Math.abs(trav.x - (fire.x - 70)) < 40 && move === 0 && trav.onGround;
    trav.sit = lerp(trav.sit, nearFire ? 1 : 0, 1 - Math.exp(-dt * 3));
    if (trav.sit > 0.5 && move !== 0) trav.sit = 0.49;

    wind = 0.6 + Math.sin(time * 0.3) * 0.5 + Math.sin(time * 1.3) * 0.25;
    trav.update(dt, { move, run, jump: jumpQueued }, world, wind * 0.25 - 0.1);
    jumpQueued = false;
    if (trav.justLanded) {
      sound.land(trav.justLanded);
      trav.justLanded = 0;
    }
    for (const s of trav.stepEvents) sound.step(s, isStone(trav.x));
    trav.stepEvents.length = 0;

    // camera follows with a little look-ahead
    const look = trav.dir * 140 * (0.4 + trav.speed01);
    camX += (trav.x + look - camX) * (1 - Math.exp(-dt * 2.4));
    const viewH = (stillVH || piecewise(camX, SX, STATION_VIEW)) * (innerWidth < innerHeight ? 1.25 : 1);
    const desiredY = Math.max(trav.y, world.height(camX)) + viewH * 0.2 + stillDY;
    camY += (desiredY - camY) * (1 - Math.exp(-dt * 2.2));

    const tDay = piecewise(camX, SX, STATION_T);
    const light = lightAt(tDay);

    // which station are we at?
    let best = -1, bestD = 700;
    for (let i = 0; i < SX.length; i++) {
      const d = Math.abs(trav.x - SX[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best !== activeIdx) {
      activeIdx = best;
      ui.setStation(best);
      if (best >= 0) sound.station(stations[best].id);
    }
    ui.setProgress(tDay, trav.x / END);
    // look up at the great sights
    trav.look = lerp(trav.look, best === 1 || best === 10 ? 1 : 0, 1 - Math.exp(-dt * 2));

    // ---- dynamic geometry ----
    trav.draw(travellerMesh);
    travellerGPU.upload(travellerMesh, true);

    fxMesh.reset();
    const aspect = renderer.w / renderer.h;
    const viewW = viewH * aspect;
    // drifting sand motes, lit by the sun
    for (const p of dust) {
      p.x += (wind * 0.012 + 0.004) * p.v * dt;
      p.y += Math.sin(time * 0.7 + p.s * 10) * 0.004 * dt;
      const wx = camX - viewW / 2 + (((p.x % 1) + 1) % 1) * viewW;
      const wy = camY - viewH / 2 + (((p.y % 1) + 1) % 1) * viewH * 0.75;
      const s = 0.9 + p.s * 1.6;
      fxMesh.disc(wx, wy, s, s, { color: DUST, mat: MAT.cloth, em: 0 }, 6, 0.2);
    }
    // embers above the fire
    if (fire && Math.abs(camX - fire.x) < viewW) {
      for (const e of embers) {
        e.life += dt * (0.4 + e.s * 0.5);
        if (e.life > 1) {
          e.life = 0;
          e.x = fire.x + (Math.random() - 0.5) * 30;
          e.y = fire.y + 20;
          e.vx = (Math.random() - 0.5) * 20 + wind * 10;
          e.vy = 50 + Math.random() * 60;
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const k = 1 - e.life;
        fxMesh.disc(e.x, e.y, 1.6 * k + 0.4, 1.6 * k + 0.4, { color: EMBER, mat: MAT.flame, em: k }, 5, 0);
      }
    }
    fxGPU.upload(fxMesh, true);

    // cranes cross the sky at dawn and dusk
    skyFxMesh.reset();
    const birdT = Math.max(clamp(1 - Math.abs(tDay - 0.06) / 0.07), clamp(1 - Math.abs(tDay - 0.77) / 0.05));
    if (birdT > 0.01) {
      const fx = ((time * 26) % 1800) - 900;
      for (const b of flock) {
        crane(skyFxMesh, camX * 0.3 + fx + b.ox, 230 + b.oy + Math.sin(time * 0.5) * 6, 13, time * 6 + b.ph, hex('#1a1424'));
      }
    }
    skyFxGPU.upload(skyFxMesh, true);

    const draws: LayerDraw[] = [];
    world.layers.forEach((l, i) => {
      if (l.name === 'mid') draws.push({ mesh: skyFxGPU, par: 0.3, fog: 0.25, darken: 1, hazeY: -9999 });
      if (l.name === 'fg') {
        draws.push({ mesh: travellerGPU, par: 1, fog: 0, darken: 1, hazeY: -9999 });
        draws.push({ mesh: fxGPU, par: 1, fog: 0, darken: 1, hazeY: -9999 });
      }
      draws.push({ mesh: gpu[i], par: l.par, fog: l.fog, darken: l.darken, hazeY: l.hazeY });
    });

    const farGround = -40;
    const horizonY = clamp(0.5 + (farGround - camY * 0.08) / viewH, 0.12, 0.8);
    const heat = clamp(1 - Math.abs(tDay - 0.47) / 0.15);

    const fireI = fire ? clamp(1 - Math.abs(camX - fire.x) / 2400) * clamp((tDay - 0.84) / 0.08) : 0;
    renderer.render({ camX, camY, viewH, time, wind: (wind - 0.6) * 0.6, light, horizonY, heat, fade: fade * (ui.introOpen ? 0.55 : 1), fire: [fire?.x ?? 0, (fire?.y ?? 0) + 30, fireI] }, draws);
    sound.update(dt, tDay, Math.abs(trav.vx) / 360, fire ? Math.abs(trav.x - fire.x) : 9999, world.chisels.reduce((a, c) => Math.min(a, Math.abs(trav.x - c)), 9999));

    // adapt resolution if frames are slow
    if (frameAvg > 30 && renderer.dpr > 1) {
      renderer.resize(innerWidth, innerHeight, Math.max(1, renderer.dpr - 0.25));
      frameAvg = 16;
    }
    requestAnimationFrame(loop);
  };

  function isStone(x: number) {
    return (x > SX[1] - 600 && x < SX[5] + 760) || Math.abs(x - SX[8]) < 650 || (x > SX[10] - 330 && x < SX[10] + 190);
  }

  ui.ready(() => {
    sound.start();
  });
  // ?still=<x> renders a clean frame for stills and social images
  const still = new URLSearchParams(location.search).get('still');
  if (still !== null) {
    document.body.classList.add('still');
    ui.skipIntro();
    setTimeout(() => (window as unknown as { __world: { snap(x: number): void } }).__world.snap(+still), 0);
  }
  requestAnimationFrame(loop);
  (window as unknown as { __world: unknown }).__world = {
    trav,
    travelTo,
    get camX() { return camX; },
    snap(x: number) {
      trav.x = x;
      trav.y = world.height(x);
      trav.vx = 0;
      targetX = null;
      camX = x + 120 + +(qs.get('dx') || 0);
      camY = trav.y + (stillVH || piecewise(camX, SX, STATION_VIEW)) * 0.2 + stillDY;
      for (let i = 0; i < 90; i++) trav.update(1 / 60, { move: 0, run: false, jump: false }, world, 0.1);
    },
  };
}
