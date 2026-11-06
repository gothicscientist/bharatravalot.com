// The wanderer: a small blocky figure in a saffron turban with a long scarf, built from boxes.
import * as THREE from 'three';
import type { Grid } from './voxels';

const mat = (c: string, emissive = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, emissive: emissive ? c : '#000', emissiveIntensity: emissive });

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent?.add(mesh);
  return mesh;
}

/** A pivot group so limbs swing from the joint. */
function limb(w: number, h: number, d: number, m: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  parent.add(p);
  box(w, h, d, m, 0, -h / 2, 0, p);
  return p;
}

export class Hero {
  root = new THREE.Group();
  body = new THREE.Group();
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  facing = 0;
  onGround = true;
  speed = 0;
  private legL!: THREE.Group; private legR!: THREE.Group; private armL!: THREE.Group; private armR!: THREE.Group;
  private head!: THREE.Group;
  private scarf: THREE.Mesh[] = [];
  private scarfPts: THREE.Vector3[] = [];
  private phase = 0;
  stepped: (() => void) | null = null;
  landed: ((v: number) => void) | null = null;

  constructor() {
    const skin = mat('#c98a5e'), white = mat('#efe4d0'), saffron = mat('#e8842a'), maroon = mat('#7a2630'), indigo = mat('#2c3a6e'), dark = mat('#3a2418'), gold = mat('#e8b84a'), leather = mat('#6a3a22');
    const b = this.body;
    this.root.add(b);
    b.scale.setScalar(1.15);
    // legs (trousers) and boots
    this.legL = limb(0.42, 1.0, 0.42, white, b, -0.24, 1.05, 0);
    this.legR = limb(0.42, 1.0, 0.42, white, b, 0.24, 1.05, 0);
    box(0.46, 0.22, 0.6, leather, 0, -0.95, 0.06, this.legL);
    box(0.46, 0.22, 0.6, leather, 0, -0.95, 0.06, this.legR);
    // tunic with a long skirt
    box(0.95, 0.85, 0.55, indigo, 0, 1.55, 0, b);
    box(1.05, 0.38, 0.62, indigo, 0, 1.0, 0, b);
    box(1.0, 0.14, 0.6, maroon, 0, 1.22, 0, b); // sash
    box(0.16, 0.5, 0.06, gold, 0.3, 1.05, 0.31, b);
    // shawl over one shoulder
    box(1.0, 0.18, 0.62, maroon, 0, 1.94, 0, b);
    // arms
    this.armL = limb(0.3, 0.85, 0.3, indigo, b, -0.62, 1.92, 0);
    this.armR = limb(0.3, 0.85, 0.3, indigo, b, 0.62, 1.92, 0);
    box(0.28, 0.22, 0.28, skin, 0, -0.95, 0, this.armL);
    box(0.28, 0.22, 0.28, skin, 0, -0.95, 0, this.armR);
    // curved sword at the hip
    const sw = new THREE.Group(); sw.position.set(-0.55, 1.1, -0.1); sw.rotation.z = 0.5; b.add(sw);
    box(0.08, 0.9, 0.12, mat('#cfd3d8'), 0, -0.3, 0, sw); box(0.24, 0.06, 0.16, gold, 0, 0.18, 0, sw); box(0.07, 0.2, 0.07, dark, 0, 0.32, 0, sw);
    // head, beard, turban
    const h = new THREE.Group(); h.position.set(0, 2.05, 0); b.add(h); this.head = h;
    box(0.62, 0.62, 0.6, skin, 0, 0.33, 0, h);
    box(0.64, 0.2, 0.08, dark, 0, 0.12, 0.29, h); // beard line
    box(0.42, 0.06, 0.04, dark, 0, 0.24, 0.31, h); // moustache
    box(0.1, 0.08, 0.04, mat('#1a1010'), -0.15, 0.42, 0.31, h); box(0.1, 0.08, 0.04, mat('#1a1010'), 0.15, 0.42, 0.31, h);
    box(0.74, 0.34, 0.72, saffron, 0, 0.72, 0, h);
    box(0.62, 0.18, 0.6, saffron, 0, 0.94, -0.02, h);
    box(0.2, 0.2, 0.08, gold, 0, 0.74, 0.37, h); // jewel
    box(0.08, 0.3, 0.08, mat('#fff1d0', 0.6), 0.08, 1.08, -0.05, h); // plume
    // the scarf tail: a chain of segments that trails in the wind
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.34 - i * 0.025, 0.1, 0.42), saffron);
      s.castShadow = true;
      this.scarf.push(s);
      this.scarfPts.push(new THREE.Vector3());
    }
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.root);
    for (const s of this.scarf) scene.add(s);
  }

  place(x: number, y: number, z: number) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    for (const p of this.scarfPts) p.set(x, y + 2.8, z);
  }

  /** Move with collision against the voxel grid. input is a world-space direction (length 0..1). */
  update(dt: number, g: Grid, input: THREE.Vector2, run: boolean, jump: boolean, t: number) {
    const R = 0.42, H = 3.2;
    const max = run ? 11 : 7;
    const want = new THREE.Vector2(input.x, input.y).multiplyScalar(max);
    const k = 1 - Math.exp(-dt * (this.onGround ? 14 : 4));
    this.vel.x += (want.x - this.vel.x) * k;
    this.vel.z += (want.y - this.vel.z) * k;
    this.vel.y -= 38 * dt;
    if (jump && this.onGround) { this.vel.y = 13; this.onGround = false; }

    const blocked = (x: number, y: number, z: number) => {
      for (const ox of [-R, R]) for (const oz of [-R, R]) for (let yy = y + 0.05; yy < y + H; yy += 0.9) if (g.solid(x + ox, yy, z + oz)) return true;
      for (const ox of [-R, R]) for (const oz of [-R, R]) if (g.solid(x + ox, y + H, z + oz)) return true;
      return false;
    };
    const tryAxis = (dx: number, dz: number) => {
      const nx = this.pos.x + dx, nz = this.pos.z + dz;
      if (!blocked(nx, this.pos.y, nz)) { this.pos.x = nx; this.pos.z = nz; return true; }
      // step up one voxel when on the ground
      if (this.onGround) {
        const up = Math.floor(this.pos.y) + 1;
        if (up - this.pos.y <= 1.05 && !blocked(nx, up, nz)) { this.pos.x = nx; this.pos.z = nz; this.pos.y = up; return true; }
      }
      return false;
    };
    const steps = Math.ceil((Math.abs(this.vel.x) + Math.abs(this.vel.z)) * dt / 0.3) || 1;
    for (let s = 0; s < steps; s++) {
      if (!tryAxis((this.vel.x * dt) / steps, 0)) this.vel.x = 0;
      if (!tryAxis(0, (this.vel.z * dt) / steps)) this.vel.z = 0;
    }
    // vertical
    const ny = this.pos.y + this.vel.y * dt;
    const wasAir = !this.onGround;
    if (this.vel.y <= 0) {
      const floor = this.groundBelow(g, this.pos.x, this.pos.y + 0.01, this.pos.z, R);
      if (ny <= floor) {
        if (wasAir && this.vel.y < -14) this.landed?.(Math.min(1, -this.vel.y / 30));
        this.pos.y = floor; this.vel.y = 0; this.onGround = true;
      } else { this.pos.y = ny; this.onGround = ny - floor < 0.02; }
    } else {
      if (blocked(this.pos.x, ny, this.pos.z)) this.vel.y = 0; else this.pos.y = ny;
      this.onGround = false;
    }
    if (this.pos.y < -20) this.pos.y = 40; // fell out of the world

    // animate
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.speed = sp;
    if (sp > 0.3) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-dt * 14));
    }
    const prev = this.phase;
    this.phase += dt * sp * 1.25;
    if (this.onGround && sp > 1 && Math.floor(prev / Math.PI) !== Math.floor(this.phase / Math.PI)) this.stepped?.();
    const sw = Math.sin(this.phase) * Math.min(1, sp / 6) * 0.9;
    const air = this.onGround ? 0 : 1;
    this.legL.rotation.x = air ? -0.6 : sw;
    this.legR.rotation.x = air ? 0.4 : -sw;
    this.armL.rotation.x = air ? -2.4 : -sw * 0.9;
    this.armR.rotation.x = air ? -2.2 : sw * 0.9;
    this.armL.rotation.z = air ? -0.3 : 0.08; this.armR.rotation.z = air ? 0.3 : -0.08;
    const bob = this.onGround ? Math.abs(Math.cos(this.phase)) * Math.min(1, sp / 6) * 0.12 : 0;
    const idle = Math.sin(t * 2) * 0.02;
    this.body.position.y = bob + idle;
    this.body.rotation.x = Math.min(0.18, sp * 0.015);
    this.head.rotation.y = Math.sin(t * 0.7) * 0.15 * (sp < 0.5 ? 1 : 0);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;

    // scarf: verlet-ish follow from the back of the turban, blown by the wind
    const anchor = new THREE.Vector3(0, 2.85 + bob, -0.38).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.facing).add(this.pos);
    const wind = new THREE.Vector3(Math.sin(t * 0.8) * 0.4 + 0.9, 0.15, Math.cos(t * 1.3) * 0.5 + 0.3);
    let prevP = anchor;
    for (let i = 0; i < this.scarf.length; i++) {
      const p = this.scarfPts[i];
      if (p.distanceTo(prevP) > 4) p.copy(prevP);
      p.addScaledVector(wind, dt * (1.4 + i * 0.3));
      p.y += Math.sin(t * 9 + i * 0.9) * dt * 0.8 - dt * 0.6;
      const L = 0.34;
      const d = p.clone().sub(prevP);
      const len = d.length() || 1;
      p.copy(prevP).addScaledVector(d, L / len);
      const s = this.scarf[i];
      s.position.copy(p).add(prevP).multiplyScalar(0.5);
      s.lookAt(p);
      prevP = p;
    }
  }

  groundBelow(g: Grid, x: number, y: number, z: number, R: number) {
    let best = -1e9;
    for (const ox of [-R, 0, R]) for (const oz of [-R, 0, R]) {
      for (let yy = Math.floor(y); yy > Math.floor(y) - 40; yy--) if (g.solid(x + ox, yy, z + oz)) { best = Math.max(best, yy + 1); break; }
    }
    return best;
  }
}
