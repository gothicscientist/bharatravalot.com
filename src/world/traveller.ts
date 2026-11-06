import { Mesh, MAT, type Style, hex, clamp, lerp } from './mesh';
import { SKIN, WHITE_CLOTH, KESARI, SAFFRON, GOLD, MAROON, limb } from './art/figures';

/**
 * The traveller: a young Rajput in a white angarkha, a saffron safa whose long tail streams in
 * the wind, a maroon shawl, a talwar at the hip and a dhal on his back. Procedural walk, run,
 * jump and sit, with verlet cloth for the turban tail and shawl.
 */

type P = [number, number];

class Chain {
  p: P[] = [];
  q: P[] = [];
  constructor(n: number, public seg: number, x: number, y: number) {
    for (let i = 0; i < n; i++) {
      this.p.push([x - i * seg, y]);
      this.q.push([x - i * seg, y]);
    }
  }
  reset(x: number, y: number, dir: number) {
    for (let i = 0; i < this.p.length; i++) {
      this.p[i] = [x - i * this.seg * dir, y - i * 1.5];
      this.q[i] = [x - i * this.seg * dir, y - i * 1.5];
    }
  }
  step(anchor: P, dt: number, wind: number, grav: number, t: number, flutter: number, back: number) {
    const n = this.p.length;
    if (Math.hypot(anchor[0] - this.p[0][0], anchor[1] - this.p[0][1]) > 60) this.reset(anchor[0], anchor[1], 1);
    this.p[0][0] = anchor[0];
    this.p[0][1] = anchor[1];
    for (let i = 1; i < n; i++) {
      const p = this.p[i], q = this.q[i];
      let vx = (p[0] - q[0]) * 0.96, vy = (p[1] - q[1]) * 0.96;
      const vl = Math.hypot(vx, vy);
      if (vl > 12) { vx *= 12 / vl; vy *= 12 / vl; }
      q[0] = p[0];
      q[1] = p[1];
      const f = Math.sin(t * 9 + i * 0.9) * flutter * (i / n);
      p[0] += vx + (wind + back) * dt * dt * 60;
      p[1] += vy - grav * dt * dt * 60 + f * dt * 60;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < n; i++) {
        const a = this.p[i - 1], b = this.p[i];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const d = Math.hypot(dx, dy) || 0.0001;
        const k = (d - this.seg) / d;
        if (i === 1) {
          b[0] -= dx * k;
          b[1] -= dy * k;
        } else {
          a[0] += dx * k * 0.5;
          a[1] += dy * k * 0.5;
          b[0] -= dx * k * 0.5;
          b[1] -= dy * k * 0.5;
        }
      }
      this.p[0][0] = anchor[0];
      this.p[0][1] = anchor[1];
    }
  }
}

export interface Ground {
  height(x: number): number;
  platform(x: number, yPrev: number, yNow: number): number | null;
}

export class Traveller {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  dir: 1 | -1 = 1;
  onGround = true;
  phase = 0;
  speed01 = 0; // 0 idle, ~0.5 walk, 1 run
  air = 0;
  landT = 1;
  sit = 0; // 0..1 blend into sitting by the fire
  look = 0; // head tilt upward
  S = 92; // height in world units
  tail: Chain;
  shawl: Chain;
  time = 0;
  stepEvents: number[] = [];
  private lastStepSign = 0;
  justLanded = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.tail = new Chain(9, 6.5, x, y + 80);
    this.shawl = new Chain(8, 7, x, y + 70);
  }

  update(dt: number, input: { move: number; run: boolean; jump: boolean }, g: Ground, wind: number) {
    this.time += dt;
    const target = input.move * (input.run ? 360 : 190);
    const accel = this.onGround ? 900 : 420;
    if (Math.abs(target - this.vx) < accel * dt) this.vx = target;
    else this.vx += Math.sign(target - this.vx) * accel * dt;
    if (input.move !== 0) this.dir = input.move > 0 ? 1 : -1;

    if (input.jump && this.onGround && this.sit < 0.1) {
      this.vy = 520;
      this.onGround = false;
      this.air = 0;
    }

    const prevY = this.y;
    this.vy -= 1500 * dt;
    let nx = this.x + this.vx * dt;
    let ny = this.y + this.vy * dt;
    const gh = g.height(nx);
    // walls: a sudden rise taller than a step blocks the way
    if (this.onGround && gh - this.y > 26) {
      nx = this.x;
      this.vx = 0;
    }
    const gh2 = g.height(nx);
    const plat = this.vy <= 0 ? g.platform(nx, prevY, ny) : null;
    const floor = plat !== null ? Math.max(plat, gh2) : gh2;
    if (this.onGround && this.vy <= 0 && ny - floor < 26 && ny - floor > -26) {
      ny = floor;
      this.vy = 0;
    }
    if (ny <= floor) {
      if (!this.onGround && this.air > 0.15) {
        this.landT = 0;
        this.justLanded = Math.min(1, Math.abs(this.vy) / 900 + 0.3);
      }
      ny = floor;
      this.vy = 0;
      this.onGround = true;
    } else if (ny - floor > 2) {
      this.onGround = false;
    }
    if (!this.onGround) this.air += dt;
    this.x = nx;
    this.y = ny;
    this.landT = Math.min(1, this.landT + dt * 4);

    const sp = Math.abs(this.vx);
    this.speed01 = lerp(this.speed01, clamp(sp / 360), 1 - Math.exp(-dt * 8));
    const stride = lerp(3.2, 2.2, clamp((sp - 190) / 170));
    this.phase += (sp / 92) * stride * dt * 1.0;
    // footstep events at each footfall
    const s = Math.sign(Math.sin(this.phase));
    if (this.onGround && sp > 30 && s !== this.lastStepSign) {
      this.stepEvents.push(clamp(sp / 360));
      this.lastStepSign = s;
    }

    // cloth: anchors come from the pose, computed in draw; here only physics
    const back = -this.vx * 0.012;
    const anchorTail: P = this.headBack;
    const anchorShawl: P = this.shoulderBack;
    this.tail.step(anchorTail, dt, wind * 0.7 + back * 1.4, 0.35, this.time, 0.18 + this.speed01 * 0.3, 0);
    this.shawl.step(anchorShawl, dt, wind * 0.5 + back * 1.1, 0.5, this.time + 1.3, 0.12 + this.speed01 * 0.25, 0);
  }

  private headBack: P = [0, 0];
  private shoulderBack: P = [0, 0];

  draw(m: Mesh) {
    m.reset();
    const S = this.S;
    const d = this.dir;
    const t = this.time;
    const run = this.speed01;
    const moving = clamp(run * 3);
    const ph = this.phase;
    const sit = this.sit;
    const air = !this.onGround;
    const landSquash = (1 - this.landT) * 0.08;

    const hipBob = Math.abs(Math.cos(ph)) * S * 0.025 * moving;
    const breath = Math.sin(t * 2) * S * 0.004;
    let hipY = this.y + S * 0.48 - hipBob * 0.5 + (moving > 0 ? S * 0.01 : 0) - landSquash * S - sit * S * 0.36;
    const hipX = this.x;
    const lean = (0.08 + run * 0.22) * moving + (air ? 0.12 : 0);
    const X = (dx: number) => hipX + dx * d;

    // ---- legs ----
    const thigh = S * 0.245, shin = S * 0.235;
    const legs: { hip: P; knee: P; foot: P }[] = [];
    for (let k = 0; k < 2; k++) {
      const p = ph + k * Math.PI;
      let a1: number, a2: number;
      if (sit > 0.01) {
        // cross-legged
        a1 = lerp(0, k === 0 ? 1.45 : 1.3, sit);
        a2 = lerp(0, k === 0 ? -2.6 : -2.5, sit);
      } else if (air) {
        a1 = k === 0 ? 0.9 : 0.2;
        a2 = k === 0 ? -1.6 : -0.7;
      } else {
        const amp = lerp(0.42, 0.62, run) * moving;
        a1 = Math.sin(p) * amp;
        // the knee bends while the leg swings forward
        a2 = -Math.max(0, Math.sin(p + 1.4)) * lerp(0.8, 1.5, run) * moving - 0.06 - landSquash * 4;
      }
      const hip: P = [X(k === 0 ? 1.5 : -1.5), hipY];
      const knee: P = [hip[0] + Math.sin(a1) * thigh * d, hip[1] - Math.cos(a1) * thigh];
      const ang = a1 + a2;
      const foot: P = [knee[0] + Math.sin(ang) * shin * d, knee[1] - Math.cos(ang) * shin];
      legs.push({ hip, knee, foot });
    }

    // ---- torso ----
    const torsoLen = S * 0.3;
    const neck: P = [hipX + Math.sin(lean) * torsoLen * d, hipY + Math.cos(lean) * torsoLen + breath];
    const headR = S * 0.062;
    const look = this.look;
    const head: P = [neck[0] + Math.sin(lean * 0.6 - look * 0.3) * S * 0.08 * d, neck[1] + S * 0.085];
    this.headBack = [head[0] - headR * 0.9 * d, head[1] + headR * 0.4];
    this.shoulderBack = [neck[0] - S * 0.05 * d, neck[1] - S * 0.02];

    // ---- arms ----
    const upper = S * 0.17, fore = S * 0.16;
    const arms: { sh: P; el: P; hand: P }[] = [];
    for (let k = 0; k < 2; k++) {
      const p = ph + k * Math.PI + Math.PI;
      let a1: number, a2: number;
      if (sit > 0.01) {
        a1 = lerp(0, 0.5, sit);
        a2 = lerp(0, 1.1, sit);
      } else if (air) {
        a1 = k === 0 ? -0.9 : 1.6;
        a2 = k === 0 ? 0.6 : 0.4;
      } else {
        a1 = Math.sin(p) * lerp(0.35, 0.8, run) * moving + lean * 0.5;
        a2 = 0.25 + Math.max(0, Math.sin(p)) * lerp(0.3, 1.2, run) * moving;
      }
      const sh: P = [neck[0] + (k === 0 ? 2 : -2) * d - S * 0.01 * d, neck[1] - S * 0.03];
      const el: P = [sh[0] + Math.sin(a1) * upper * d, sh[1] - Math.cos(a1) * upper];
      const ang = a1 + a2;
      const hand: P = [el[0] + Math.sin(ang) * fore * d, el[1] - Math.cos(ang) * fore];
      arms.push({ sh, el, hand });
    }

    const white: Style = { color: WHITE_CLOTH, mat: MAT.cloth };
    const whiteBack: Style = { color: hex('#bfb39e'), mat: MAT.cloth };
    const skinS: Style = { color: SKIN, mat: MAT.plain };
    const saffron: Style = { color: SAFFRON, mat: MAT.cloth };
    const kesari: Style = { color: KESARI, mat: MAT.cloth };
    const maroon: Style = { color: MAROON, mat: MAT.cloth };
    const gold: Style = { color: GOLD, mat: MAT.plain };
    const dark: Style = { color: hex('#2a1a12'), mat: MAT.plain };

    // back arm and back leg first (further from camera, slightly darker)
    const bl = legs[1], ba = arms[1];
    limb(m, bl.hip, bl.knee, bl.foot, S * 0.05, S * 0.038, S * 0.028, whiteBack);
    m.ribbon([bl.foot, [bl.foot[0] + S * 0.07 * d, bl.foot[1] - 1]], S * 0.022, dark);

    // dhal: shield on the back, a bulging disc with brass bosses
    const shX = neck[0] - S * 0.09 * d, shY = neck[1] - S * 0.12;
    m.disc(shX, shY, S * 0.11, S * 0.11, { color: hex('#3a2418'), mat: MAT.plain }, 20, 0.85);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.6;
      m.disc(shX + Math.cos(a) * S * 0.05, shY + Math.sin(a) * S * 0.05, S * 0.013, S * 0.013, gold, 8, 0.9);
    }

    limb(m, ba.sh, ba.el, ba.hand, S * 0.028, S * 0.024, S * 0.02, whiteBack);

    // shawl behind the body
    const sp = this.shawl.p;
    m.ribbon(sp.map((p) => [p[0], p[1]] as P), sp.map((_, i) => S * (0.04 - i * 0.003)), maroon);

    // angarkha skirt: flares and swings with motion
    const swing = Math.sin(ph) * S * 0.04 * moving - this.vx * 0.01 * d;
    const hemY = sit > 0.01 ? hipY - S * 0.06 : hipY - S * 0.27 + (air ? S * 0.04 : 0);
    const skirt: number[] = [
      X(-S * 0.07), hipY + S * 0.02, X(S * 0.075), hipY + S * 0.02,
      X(S * 0.13) + swing * d * 0.5, hemY, X(-S * 0.14) + swing * d * 0.5 - (this.vx * 0.012), hemY - S * 0.01,
    ];
    m.poly(skirt, white);
    // torso
    const tl: P = [X(-S * 0.075), hipY + S * 0.02], tr: P = [X(S * 0.075), hipY + S * 0.02];
    m.quad(tl[0], tl[1], tr[0], tr[1], neck[0] + S * 0.07 * d, neck[1] - S * 0.02, neck[0] - S * 0.07 * d, neck[1] - S * 0.02, white,
      [-0.6 * d, 0.1, 0.8], [0.6 * d, 0.1, 0.8], [0.6 * d, 0.3, 0.75], [-0.6 * d, 0.3, 0.75]);
    // kamarbandh sash
    m.quad(tl[0] - 0.5 * d, hipY - S * 0.0, tr[0] + 0.5 * d, hipY - S * 0.0, tr[0] + 0.5 * d, hipY + S * 0.045, tl[0] - 0.5 * d, hipY + S * 0.045, kesari);
    m.ribbon([[X(-S * 0.06), hipY + S * 0.02], [X(-S * 0.1), hipY - S * 0.08 - Math.sin(t * 3) * 1]], S * 0.015, kesari);

    // talwar: curved sword in its scabbard at the hip
    const swA: P = [X(S * 0.02), hipY + S * 0.0];
    const curve: P[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      curve.push([swA[0] - d * (S * 0.36 * u), swA[1] - S * 0.14 * u + Math.sin(u * Math.PI) * S * 0.02 + Math.sin(ph) * u * 2 * moving]);
    }
    m.ribbon(curve, S * 0.012, { color: hex('#24160e'), mat: MAT.plain });
    m.ribbon([[swA[0] + S * 0.02 * d, swA[1] + S * 0.02], [swA[0] + S * 0.06 * d, swA[1] + S * 0.04]], S * 0.012, gold);
    m.ball(swA[0] + S * 0.065 * d, swA[1] + S * 0.045, S * 0.012, gold);

    // front leg
    const fl = legs[0];
    limb(m, fl.hip, fl.knee, fl.foot, S * 0.052, S * 0.04, S * 0.03, white);
    // mojari with the curled toe
    m.ribbon([fl.foot, [fl.foot[0] + S * 0.06 * d, fl.foot[1] - 1], [fl.foot[0] + S * 0.085 * d, fl.foot[1] + 2]], [S * 0.024, S * 0.02, S * 0.008], { color: hex('#5a2a14'), mat: MAT.plain });

    // neck and head
    m.ribbon([[neck[0], neck[1] - S * 0.03], [head[0], head[1] - headR * 0.6]], S * 0.022, skinS);
    m.ball(head[0], head[1], headR, skinS);
    // a hint of profile: nose and jaw
    m.poly([head[0] + headR * 0.75 * d, head[1] + headR * 0.15, head[0] + headR * 1.18 * d, head[1] - headR * 0.18, head[0] + headR * 0.7 * d, head[1] - headR * 0.35], skinS);
    // moustache, the Rajput signature, kept short for a young man
    m.ribbon([[head[0] + headR * 0.9 * d, head[1] - headR * 0.42], [head[0] + headR * 0.55 * d, head[1] - headR * 0.5], [head[0] + headR * 0.3 * d, head[1] - headR * 0.36]], [0.6, 0.9, 0.4], dark);

    // safa: a tall wrapped turban with diagonal folds
    const tb: P = [head[0] - headR * 0.1 * d, head[1] + headR * 0.25];
    m.dome(tb[0], tb[1], headR * 2.6, headR * 1.55, saffron, 'hemi', 10, 6);
    for (let i = 0; i < 4; i++) {
      const yy = tb[1] + headR * (0.2 + i * 0.3);
      const w = headR * (1.25 - i * 0.22);
      m.ribbon([[tb[0] - w * d, yy - headR * 0.18], [tb[0] + w * d, yy + headR * 0.16]], 0.7, kesari, false);
    }
    // turra: a small fan at the crown
    m.poly([tb[0] - headR * 0.4 * d, tb[1] + headR * 1.3, tb[0] - headR * 1.0 * d, tb[1] + headR * 2.05, tb[0] - headR * 0.05 * d, tb[1] + headR * 1.6], kesari);
    // the long tail (pech) streaming behind
    const tp = this.tail.p;
    m.ribbon(tp.map((p) => [p[0], p[1]] as P), tp.map((_, i) => S * (0.03 - i * 0.0018)), saffron);

    // front arm over everything
    const fa = arms[0];
    limb(m, fa.sh, fa.el, fa.hand, S * 0.03, S * 0.026, S * 0.022, white);
    m.ball(fa.hand[0], fa.hand[1], S * 0.022, skinS);
    // shawl end over the front shoulder
    m.ribbon([[neck[0] + S * 0.05 * d, neck[1] - S * 0.01], [neck[0] - S * 0.02 * d, neck[1] - S * 0.12]], S * 0.03, maroon);
  }
}
