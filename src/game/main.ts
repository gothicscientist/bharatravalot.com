// The labyrinth: renderer, light, camera, input and the loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildWorld, miniGrid, G, type World } from './build';
import { meshChunk, SX, SZ } from './voxels';
import { makeAtlas, ATLAS_GAIN } from './atlas';
import { Hero } from './hero';
import { Sound } from './audio';
import { UI } from './ui';

const ROUTE = ['gate', 'court', 'builders', 'market', 'keys', 'strata', 'rally', 'speed', 'council', 'archive', 'star', 'palace'];

// time of day along the route: afternoon at the way down, dusk in the palace courtyard
interface Sky { sunEl: number; sunAz: number; sun: string; sunI: number; sky: string; ground: string; hemiI: number; fog: string; fogD: number; top: string; torch: number }
const SKIES: Sky[] = [
  { sunEl: 52, sunAz: 310, sun: '#ffe6c0', sunI: 2.8, sky: '#9cbcf5', ground: '#b07a4a', hemiI: 0.85, fog: '#e6c391', fogD: 0.0045, top: '#5d8fd6', torch: 0.55 },
  { sunEl: 44, sunAz: 303, sun: '#ffd49c', sunI: 2.8, sky: '#a0b4f0', ground: '#aa7448', hemiI: 0.82, fog: '#e6b885', fogD: 0.0048, top: '#5a7ac8', torch: 0.75 },
  { sunEl: 32, sunAz: 296, sun: '#ffac68', sunI: 2.6, sky: '#a08ad8', ground: '#a0603e', hemiI: 0.95, fog: '#e09a70', fogD: 0.0054, top: '#4a4aa0', torch: 1.05 },
  { sunEl: 16, sunAz: 290, sun: '#ff7a4a', sunI: 1.9, sky: '#6a64b8', ground: '#70404a', hemiI: 1.05, fog: '#9a6a86', fogD: 0.006, top: '#22266a', torch: 1.5 },
];

export function start() {
  const canvas = document.getElementById('world') as HTMLCanvasElement;
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const params = new URLSearchParams(location.search);
  const still = params.has('still');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: still });
  let dpr = Math.min(devicePixelRatio || 1, mobile ? 1.6 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 1, 900);

  // ---------------------------------------------------------- world
  const t0 = performance.now();
  const world: World = buildWorld();
  const g = world.grid;
  const atlas = makeAtlas();
  atlas.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const cut = { hero: { value: new THREE.Vector3() }, cam: { value: new THREE.Vector3() }, on: { value: 1 } };
  const litMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.92, metalness: 0 });
  litMat.color.setScalar(ATLAS_GAIN);
  litMat.onBeforeCompile = (sh) => {
    sh.uniforms.uHero = cut.hero; sh.uniforms.uCam = cut.cam; sh.uniforms.uCutOn = cut.on;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWorldP; uniform vec3 uHero; uniform vec3 uCam; uniform float uCutOn;
float bayer4(vec2 p){ ivec2 i = ivec2(mod(p, 4.0)); int idx = i.x + i.y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[idx] + 0.5) / 16.0; }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (uCutOn > 0.5 && vWorldP.y > uHero.y + 1.4) {
  vec3 ax = uCam - uHero; float L = length(ax); vec3 dir = ax / L;
  vec3 rel = vWorldP - uHero; float t = dot(rel, dir);
  if (t > 1.5 && t < L) {
    float d = length(rel - dir * t);
    float R = 4.2 + t * 0.12;
    float f = smoothstep(R, R * 0.55, d);
    if (f > bayer4(gl_FragCoord.xy)) discard;
  }
}`);
  };
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, map: atlas, toneMapped: true });
  glowMat.color.setScalar(ATLAS_GAIN * 2.6);

  const chunks: THREE.Mesh[] = [];
  const CS = 32;
  for (let cz = 0; cz < SZ; cz += CS) for (let cx = 0; cx < SX; cx += CS) {
    const { lit, glow } = meshChunk(g, cx, cz, CS);
    if (lit) { const m = new THREE.Mesh(lit, litMat); m.castShadow = m.receiveShadow = true; scene.add(m); chunks.push(m); }
    if (glow) scene.add(new THREE.Mesh(glow, glowMat));
  }
  console.info(`labyrinth built in ${Math.round(performance.now() - t0)} ms, ${Math.round(chunks.reduce((a, m) => a + m.geometry.index!.count / 3, 0) / 1000)}k triangles in ${chunks.length} chunks`);

  // distant desert beyond the grid: a wide ring of low dunes fading into haze
  {
    const geo = new THREE.PlaneGeometry(1400, 1400, 140, 140);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + 128, z = p.getZ(i) + 128;
      const inside = x > -6 && x < SX + 6 && z > -6 && z < SZ + 6;
      const h = Math.sin(x * 0.03) * 3 + Math.sin(z * 0.045 + x * 0.01) * 4 + Math.sin((x + z) * 0.012) * 6;
      p.setY(i, inside ? G - 30 : G + 9 + h);
      p.setX(i, x); p.setZ(i, z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#d9a868', roughness: 1, flatShading: true }));
    m.receiveShadow = true;
    scene.add(m);
  }

  // sky dome
  const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `varying vec3 vD; uniform vec3 top, hor, sunDir, sunCol;
      void main(){ float h = clamp(vD.y, 0.0, 1.0); vec3 c = mix(hor, top, pow(h, 0.55));
      float s = max(dot(normalize(vD), sunDir), 0.0); c += sunCol * (pow(s, 600.0) * 6.0 + pow(s, 12.0) * 0.35);
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);

  // ---------------------------------------------------------- light
  const hemi = new THREE.HemisphereLight('#a9c4ff', '#c8945a', 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd7a0', 3);
  sun.castShadow = true;
  const SH = mobile ? 40 : 52;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 260 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  scene.fog = new THREE.FogExp2('#e8c79a', 0.006);

  // torches: a pool of real lights moved to the nearest flames, plus instanced flame cubes everywhere
  const POOL = mobile ? 6 : 12;
  const pool: THREE.PointLight[] = [];
  for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight('#ff9a48', 0, 18, 1.7); scene.add(l); pool.push(l); }
  const FL = world.lights.length;
  const flameGeo = new THREE.BoxGeometry(1, 1, 1);
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffae55').multiplyScalar(4.5) });
  const flames = new THREE.InstancedMesh(flameGeo, flameMat, FL * 3);
  flames.frustumCulled = false;
  scene.add(flames);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  const flameCol = [new THREE.Color('#ffd27a').multiplyScalar(5), new THREE.Color('#ff8a3a').multiplyScalar(4), new THREE.Color('#ff5a2a').multiplyScalar(3)];
  for (let i = 0; i < FL * 3; i++) flames.setColorAt(i, flameCol[i % 3]);

  // water
  const waterU = { time: { value: 0 }, sunDir: skyU.sunDir, sunCol: skyU.sunCol, ...THREE.UniformsLib.fog };
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, fog: true, uniforms: waterU,
    vertexShader: `varying vec3 vW; #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition; #include <fog_vertex> }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
    fragmentShader: `uniform float time; uniform vec3 sunDir, sunCol; varying vec3 vW; #include <common> #include <fog_pars_fragment>
      void main(){ vec2 p = vW.xz; float w = sin(p.x*1.3+time*1.4)*0.5 + sin(p.y*1.7-time*1.1)*0.5 + sin((p.x+p.y)*0.9+time*0.7);
        vec3 deep = vec3(0.02,0.16,0.2), shallow = vec3(0.1,0.52,0.55);
        vec3 c = mix(deep, shallow, 0.5 + 0.18*w);
        float px = floor(p.x*4.0)/4.0, pz = floor(p.y*4.0)/4.0;
        float sp = step(0.985, fract(sin(dot(vec2(px,pz)+floor(time*3.0)*0.37, vec2(12.9898,78.233)))*43758.5453));
        c += sunCol * sp * 1.6 + vec3(0.9,0.85,0.7) * smoothstep(1.2, 1.9, w) * 0.25;
        gl_FragColor = vec4(c, 0.86);
        #include <fog_fragment>
      }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
  });
  for (const w of world.water) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0, w.z1 - w.z0), waterMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((w.x0 + w.x1) / 2, w.y, (w.z0 + w.z1) / 2);
    scene.add(m);
  }

  // ---------------------------------------------------------- props
  const animated: ((t: number, dt: number) => void)[] = [];
  const voxelMesh = (kind: string, v = 0) => {
    const mg = miniGrid(kind, v);
    const { lit, glow } = meshChunk(mg, 0, 0, 16, mg.sx / 2, 0, mg.sz / 2);
    const grp = new THREE.Group();
    if (lit) { const m = new THREE.Mesh(lit, litMat); m.castShadow = true; grp.add(m); }
    if (glow) grp.add(new THREE.Mesh(glow, glowMat));
    return grp;
  };
  const gold = new THREE.MeshStandardMaterial({ color: '#f0bb4c', roughness: 0.35, metalness: 0.8 });
  let fireAt: THREE.Vector3 | null = null;
  const embers: { p: THREE.Vector3; v: THREE.Vector3; life: number }[] = [];
  for (const p of world.props) {
    if (p.kind === 'diorama') {
      const m = voxelMesh('diorama', p.data?.[0] ?? 0);
      m.scale.setScalar(0.8);
      m.position.set(p.x, p.y, p.z);
      scene.add(m);
      const ph = p.x * 0.3;
      animated.push((t) => { m.rotation.y = t * 0.35 + ph; m.position.y = p.y + 0.4 + Math.sin(t * 1.3 + ph) * 0.25; });
    } else if (p.kind === 'pet') {
      const m = voxelMesh('pet');
      m.position.set(p.x, p.y, p.z);
      scene.add(m);
      const ph = p.z;
      animated.push((t) => { const k = Math.abs(Math.sin(t * 3 + ph)); m.position.y = p.y + k * 1.2; m.rotation.y = Math.sin(t * 0.6 + ph) * 1.2; m.position.x = p.x + Math.sin(t * 0.5 + ph) * 3; });
    } else if (p.kind === 'armillary') {
      const grp = new THREE.Group();
      grp.position.set(p.x, p.y, p.z);
      const rings: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(4.2 - i * 0.9, 0.22, 4, 28), gold);
        r.castShadow = true; grp.add(r); rings.push(r);
      }
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#c8d8ff').multiplyScalar(3) }));
      grp.add(core);
      const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 10, 4), gold); axis.rotation.z = 0.4; grp.add(axis);
      scene.add(grp);
      animated.push((t) => { rings[0].rotation.set(t * 0.3, 0.4, 0); rings[1].rotation.set(1.2, t * 0.45, 0.3); rings[2].rotation.set(t * 0.6, t * 0.2, 1); core.rotation.y = t; });
    } else if (p.kind === 'ball') {
      const ball = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4dc').multiplyScalar(2.5) }));
      scene.add(ball);
      const trail: THREE.Mesh[] = [];
      for (let i = 0; i < 6; i++) { const tr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.5), transparent: true, opacity: 0.5 - i * 0.07 })); scene.add(tr); trail.push(tr); }
      const at = (t: number, v: THREE.Vector3) => { const u = (t * 0.45) % 2, s = u < 1 ? u : 2 - u; const x = p.x - 12 + 24 * s; v.set(x, p.y - 4.5 + 1 + Math.abs(Math.sin(s * Math.PI * 2)) * 4.5, p.z + Math.sin(t * 0.9) * 3); };
      animated.push((t) => { at(t, ball.position); ball.rotation.set(t * 3, t * 2, 0); trail.forEach((tr, i) => at(t - (i + 1) * 0.04, tr.position)); });
    } else if (p.kind === 'fire') {
      fireAt = new THREE.Vector3(p.x, p.y, p.z);
    } else if (p.kind === 'sandfall' || p.kind === 'spout') {
      const N = p.kind === 'spout' ? 120 : 260;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: p.kind === 'spout' ? '#cfefff' : '#f0c890', size: p.kind === 'spout' ? 0.35 : 0.5, transparent: true, opacity: 0.85, depthWrite: false }));
      pts.frustumCulled = false;
      scene.add(pts);
      const seeds = Array.from({ length: N }, () => [Math.random(), Math.random(), Math.random()]);
      animated.push((t) => {
        for (let i = 0; i < N; i++) {
          const [a, b, c] = seeds[i];
          const u = (t * (p.kind === 'spout' ? 0.6 : 0.35) + a) % 1;
          if (p.kind === 'spout') {
            const ang = b * Math.PI * 2, r = u * 3.2;
            pos.set([p.x + Math.cos(ang) * r, p.y + u * 2.4 - u * u * 8, p.z + Math.sin(ang) * r], i * 3);
          } else {
            pos.set([p.x + (b - 0.5) * 1.6 + u * 0.6, p.y - u * 22, p.z + (c - 0.5) * 3], i * 3);
          }
        }
        geo.attributes.position.needsUpdate = true;
      });
    }
  }

  // relics: floating crystals over pedestals, each with a column of light you can see from afar
  interface RelicView { id: string; room: string; pos: THREE.Vector3; gem: THREE.Mesh; beam: THREE.Mesh; ring: THREE.Mesh; seen: boolean; col: THREE.Color }
  const relics: RelicView[] = [];
  const beamGeo = new THREE.CylinderGeometry(0.9, 1.6, 40, 8, 1, true);
  beamGeo.translate(0, 20, 0);
  for (const r of world.relics) {
    const col = new THREE.Color(r.color);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(3) }));
    gem.position.set(r.x, r.y, r.z);
    gem.scale.set(1, 1.5, 1);
    const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { col: { value: col.clone().multiplyScalar(0.9) }, a: { value: 1 } },
      vertexShader: 'varying float vY; void main(){ vY = position.y / 40.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vY; uniform vec3 col; uniform float a; void main(){ gl_FragColor = vec4(col * pow(1.0 - vY, 2.0) * 0.55 * a, 1.0); }',
    }));
    beam.position.set(r.x, r.y - 3, r.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.3, 24), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2), transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(r.x, r.y - 2.9, r.z);
    scene.add(gem, beam, ring);
    relics.push({ id: r.id, room: r.room, pos: new THREE.Vector3(r.x, r.y, r.z), gem, beam, ring, seen: false, col });
  }

  // dust motes drifting in the light around the hero
  const DN = mobile ? 160 : 360;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DN * 3);
  const dustSeed = Array.from({ length: DN }, () => [Math.random() * 60 - 30, Math.random() * 16, Math.random() * 60 - 30, Math.random()]);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#ffe2b0', size: 0.18, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  scene.add(dust);
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(80 * 3);
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const emberPts = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: new THREE.Color('#ffae55').multiplyScalar(3), size: 0.3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  emberPts.frustumCulled = false;
  scene.add(emberPts);

  // ---------------------------------------------------------- hero
  const hero = new Hero();
  hero.addTo(scene);
  hero.place(...world.spawn);
  hero.facing = Math.PI;

  // ---------------------------------------------------------- post
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.55, 0.92);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, fade: { value: 0 }, warm: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time, fade, warm; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.299,0.587,0.114));
        c = mix(c, c * mix(vec3(0.82,0.9,1.12), vec3(1.08,0.98,0.86), smoothstep(0.0, 0.7, l)), 0.5);
        vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.85;
        float n = fract(sin(dot(vUv * 913.0 + time, vec2(12.9898,78.233))) * 43758.5453);
        c += (n - 0.5) * 0.025;
        gl_FragColor = vec4(c * (1.0 - fade), 1.0); }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  const resize = () => {
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setPixelRatio(dpr);
    composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------- camera
  const cam = { yaw: Math.PI / 4, yawT: Math.PI / 4, dist: mobile ? 50 : 44, distT: mobile ? 50 : 44, pitch: 0.84, target: new THREE.Vector3() };
  cam.target.copy(hero.pos);
  const placeCamera = (snap = false, dt = 1 / 60) => {
    const k = snap ? 1 : 1 - Math.exp(-dt * 5);
    cam.yaw += (cam.yawT - cam.yaw) * (snap ? 1 : 1 - Math.exp(-dt * 6));
    cam.dist += (cam.distT - cam.dist) * (snap ? 1 : 1 - Math.exp(-dt * 6));
    const ahead = new THREE.Vector3(hero.vel.x, 0, hero.vel.z).multiplyScalar(0.35);
    const want = hero.pos.clone().add(new THREE.Vector3(0, 2, 0)).add(ahead);
    cam.target.lerp(want, k);
    const portrait = innerHeight > innerWidth ? 1.35 : 1;
    const d = cam.dist * portrait;
    camera.position.set(cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * d, cam.target.y + Math.sin(cam.pitch) * d, cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * d);
    camera.lookAt(cam.target);
  };
  placeCamera(true);

  // ---------------------------------------------------------- input
  const keys = new Set<string>();
  let jumpQ = false;
  let moveTo: THREE.Vector3 | null = null;
  const joy = new THREE.Vector2();
  let paused = false;
  addEventListener('keydown', (e) => {
    if (ui.modalOpen || ui.introOpen) return;
    const k = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    keys.add(k);
    if (k === ' ') jumpQ = true;
    if (k === 'q') cam.yawT += Math.PI / 2;
    if (k === 'e') cam.yawT -= Math.PI / 2;
    if (k === 'enter' || k === 'f') ui.openActive();
    if (k === 'm') ui.toggleMap();
    moveTo = null;
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.distT = Math.max(34, Math.min(110, cam.distT * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });

  const ray = new THREE.Raycaster();
  const pick = (cx: number, cy: number) => {
    const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // a relic under the pointer opens it when you are close, otherwise walks there
    for (const r of relics) {
      const sp = r.pos.clone().project(camera);
      if (Math.hypot((sp.x - ndc.x) * innerWidth, (sp.y - ndc.y) * innerHeight) < 70) return r.pos.clone().setY(r.pos.y - 3);
    }
    const hits = ray.intersectObjects(chunks, false);
    return hits.length ? hits[0].point : null;
  };
  // pointer: tap or click to walk there; on touch, drag on the left half to steer
  let touchId: number | null = null, touchStart = new THREE.Vector2(), touchMoved = false, downAt = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (ui.introOpen) return;
    downAt = performance.now();
    touchMoved = false;
    if (e.pointerType === 'touch') { touchId = e.pointerId; touchStart.set(e.clientX, e.clientY); ui.joystick(e.clientX, e.clientY, 0, 0, true); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== touchId) return;
    const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
    if (Math.hypot(dx, dy) > 12) touchMoved = true;
    const m = Math.min(1, Math.hypot(dx, dy) / 60);
    const a = Math.atan2(dy, dx);
    joy.set(Math.cos(a) * m, Math.sin(a) * m);
    ui.joystick(touchStart.x, touchStart.y, Math.cos(a) * m * 40, Math.sin(a) * m * 40, true);
    moveTo = null;
  });
  const endTouch = (e: PointerEvent) => {
    if (e.pointerId === touchId) { touchId = null; joy.set(0, 0); ui.joystick(0, 0, 0, 0, false); }
    if (!touchMoved && performance.now() - downAt < 350 && !ui.introOpen) {
      const p = pick(e.clientX, e.clientY);
      if (p) { moveTo = p; ui.marker(true); }
    }
  };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);

  // ---------------------------------------------------------- sound and UI
  const sound = new Sound();
  const ui = new UI({
    rooms: world.rooms.map((r) => ({ id: r.id, name: r.name })),
    onEnter: (withSound) => { if (withSound) { sound.start(); sound.setEnabled(true); } },
    onSound: (on) => { if (on) sound.start(); sound.setEnabled(on); },
    onTravel: (id) => travel(id),
    onJump: () => { jumpQ = true; },
    pause: (p) => { paused = p; },
  });
  hero.stepped = () => sound.step(Math.min(1, hero.speed / 9), g.get(Math.floor(hero.pos.x), Math.floor(hero.pos.y - 0.5), Math.floor(hero.pos.z)) !== 1);
  hero.landed = (v) => sound.land(v);

  let fade = 1, fading: null | { to: [number, number, number]; t: number } = null;
  const travel = (id: string) => {
    const r = world.rooms.find((x) => x.id === id);
    if (!r) return;
    fading = { to: r.spawn, t: 0 };
  };

  // ---------------------------------------------------------- loop
  const clock = new THREE.Clock();
  let t = 0;
  let activeRelic: RelicView | null = null;
  let progress = 0;
  const skyNow = { sun: new THREE.Color(), sky: new THREE.Color(), ground: new THREE.Color(), fog: new THREE.Color(), top: new THREE.Color() };
  const ca = new THREE.Color(), cb = new THREE.Color();
  const lerpSky = (p: number) => {
    const f = Math.max(0, Math.min(SKIES.length - 1.0001, p * (SKIES.length - 1)));
    const i = Math.floor(f), u = f - i, A = SKIES[i], B = SKIES[i + 1];
    const n = (a: number, b: number) => a + (b - a) * u;
    const c = (a: string, b: string, out: THREE.Color) => out.copy(ca.set(a)).lerp(cb.set(b), u);
    c(A.sun, B.sun, skyNow.sun); c(A.sky, B.sky, skyNow.sky); c(A.ground, B.ground, skyNow.ground); c(A.fog, B.fog, skyNow.fog); c(A.top, B.top, skyNow.top);
    return { el: n(A.sunEl, B.sunEl), az: n(A.sunAz, B.sunAz), sunI: n(A.sunI, B.sunI), hemiI: n(A.hemiI, B.hemiI), fogD: n(A.fogD, B.fogD), torch: n(A.torch, B.torch) };
  };
  let frames = 0, slowT = 0;
  let stillP = +(params.get('p') ?? 0);

  const frame = () => {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, clock.getDelta());
    if (still) dt = 1 / 60;
    t += dt;

    // input to a world-space direction
    const fwd = new THREE.Vector2(-Math.sin(cam.yaw), -Math.cos(cam.yaw));
    const right = new THREE.Vector2(Math.cos(cam.yaw), -Math.sin(cam.yaw));
    const inp = new THREE.Vector2();
    if (!paused && !ui.introOpen) {
      if (keys.has('w') || keys.has('arrowup')) inp.add(fwd);
      if (keys.has('s') || keys.has('arrowdown')) inp.sub(fwd);
      if (keys.has('d') || keys.has('arrowright')) inp.add(right);
      if (keys.has('a') || keys.has('arrowleft')) inp.sub(right);
      if (joy.lengthSq() > 0.01) inp.addScaledVector(right, joy.x).addScaledVector(fwd, -joy.y);
      if (moveTo) {
        const d = new THREE.Vector2(moveTo.x - hero.pos.x, moveTo.z - hero.pos.z);
        if (d.length() < 1.2 || (hero.speed < 0.2 && t % 1 < dt && d.length() < 4)) { moveTo = null; ui.marker(false); }
        else inp.copy(d.normalize());
      }
      if (inp.lengthSq() > 1) inp.normalize();
      if (inp.lengthSq() > 0.01) ui.hintDone();
    }
    const run = keys.has('shift') || joy.length() > 0.92 || (moveTo !== null && hero.pos.distanceTo(moveTo) > 18);
    hero.update(paused ? 0 : dt, g, inp, run, jumpQ, t);
    jumpQ = false;

    // fade travel
    if (fading) {
      fading.t += dt;
      fade = Math.min(1, fading.t / 0.45);
      if (fading.t >= 0.45 && fading.t - dt < 0.45) { hero.place(fading.to[0] + 0.5, fading.to[1], fading.to[2] + 0.5); placeCamera(true); moveTo = null; }
      if (fading.t > 0.5) { fade = Math.max(0, 1 - (fading.t - 0.5) / 0.5); if (fading.t > 1) fading = null; }
    } else fade = Math.max(0, fade - dt * 1.2);

    placeCamera(false, dt);
    cut.hero.value.copy(hero.pos);
    cut.cam.value.copy(camera.position);

    // which room are we in, and how far along the route
    let here = world.rooms.find((r) => hero.pos.x >= r.x0 && hero.pos.x <= r.x1 && hero.pos.z >= r.z0 && hero.pos.z <= r.z1);
    if (here) {
      const idx = ROUTE.indexOf(here.id);
      if (idx >= 0) progress += (idx / (ROUTE.length - 1) - progress) * (1 - Math.exp(-dt * 0.6));
    }
    ui.setPlace(here?.name ?? '');

    // light for this point in the day
    const L = lerpSky(still ? stillP : progress);
    const el = THREE.MathUtils.degToRad(L.el), az = THREE.MathUtils.degToRad(L.az);
    const sd = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    sun.color.copy(skyNow.sun); sun.intensity = L.sunI;
    renderer.toneMappingExposure = 0.92 + (still ? stillP : progress) * 0.3;
    sun.position.copy(hero.pos).addScaledVector(sd, 120);
    sun.target.position.copy(hero.pos);
    hemi.color.copy(skyNow.sky); hemi.groundColor.copy(skyNow.ground); hemi.intensity = L.hemiI;
    (scene.fog as THREE.FogExp2).color.copy(skyNow.fog); (scene.fog as THREE.FogExp2).density = L.fogD * (still && params.has('fog') ? +params.get('fog')! : 1);
    skyU.top.value.copy(skyNow.top); skyU.hor.value.copy(skyNow.fog); skyU.sunDir.value.copy(sd); skyU.sunCol.value.copy(skyNow.sun);
    sky.position.copy(camera.position);

    // torches near the hero get real lights
    const near = world.lights.map((l, i) => ({ i, d: (l.x - hero.pos.x) ** 2 + (l.z - hero.pos.z) ** 2 + (l.y - hero.pos.y) ** 2 * 4 })).sort((a, b) => a.d - b.d);
    for (let k = 0; k < POOL; k++) {
      const n = near[k];
      const l = pool[k];
      if (!n || n.d > 70 * 70) { l.intensity = 0; continue; }
      const src = world.lights[n.i];
      const flick = 0.85 + Math.sin(t * 13 + n.i) * 0.08 + Math.sin(t * 29 + n.i * 3) * 0.06;
      l.position.set(src.x, src.y, src.z);
      l.intensity = (src.big ? 90 : 38) * L.torch * flick;
      l.distance = src.big ? 26 : 17;
    }
    // flames
    for (let i = 0; i < FL; i++) {
      const s = world.lights[i];
      if (s.noFlame) { for (let k = 0; k < 3; k++) flames.setMatrixAt(i * 3 + k, tmpM.makeScale(0, 0, 0)); continue; }
      for (let k = 0; k < 3; k++) {
        const big = s.big ? 1.8 : 1;
        const sz = (0.62 - k * 0.16) * big * (0.85 + Math.sin(t * (11 + k * 5) + i * 1.7) * 0.15);
        tmpP.set(s.x + Math.sin(t * 7 + i + k) * 0.06 * big, s.y - 1.1 * big + (0.25 + k * 0.42) * big + Math.sin(t * 9 + i * 2 + k) * 0.05, s.z);
        tmpQ.setFromEuler(new THREE.Euler(0, t * (k % 2 ? 1 : -1) + i, 0.2 * k));
        tmpS.setScalar(sz);
        flames.setMatrixAt(i * 3 + k, tmpM.compose(tmpP, tmpQ, tmpS));
      }
    }
    flames.instanceMatrix.needsUpdate = true;

    // the last fire
    let fireDist = 1e9;
    if (fireAt) {
      fireDist = hero.pos.distanceTo(fireAt);
      if (embers.length < 80 && Math.random() < 0.6) embers.push({ p: fireAt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2)), v: new THREE.Vector3((Math.random() - 0.5) * 0.8, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 0.8), life: 1 + Math.random() * 1.5 });
      for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i]; e.life -= dt; e.p.addScaledVector(e.v, dt); e.v.x += Math.sin(t * 3 + i) * dt; if (e.life <= 0) embers.splice(i, 1); }
      for (let i = 0; i < 80; i++) { const e = embers[i]; if (e) emberPos.set([e.p.x, e.p.y, e.p.z], i * 3); else emberPos.set([0, -100, 0], i * 3); }
      emberGeo.attributes.position.needsUpdate = true;
    }

    // dust
    for (let i = 0; i < DN; i++) {
      const s = dustSeed[i];
      const x = ((s[0] + t * 0.6 + Math.sin(t * 0.3 + i) * 0.6 - hero.pos.x) % 60 + 90) % 60 - 30;
      const z = ((s[2] + t * 0.2 - hero.pos.z) % 60 + 90) % 60 - 30;
      dustPos.set([hero.pos.x + x, hero.pos.y + s[1] + Math.sin(t * 0.5 + s[3] * 9) * 0.6, hero.pos.z + z], i * 3);
    }
    dustGeo.attributes.position.needsUpdate = true;

    // relics
    let best: RelicView | null = null, bestD = 7.5;
    for (const r of relics) {
      const d = Math.hypot(r.pos.x - hero.pos.x, r.pos.z - hero.pos.z);
      const dy = Math.abs(r.pos.y - 4 - hero.pos.y);
      if (d < bestD && dy < 4) { best = r; bestD = d; }
      const on = r === activeRelic ? 1 : 0;
      r.gem.rotation.y = t * (0.8 + on * 2);
      r.gem.position.y = r.pos.y + Math.sin(t * 1.6 + r.pos.x) * 0.3 + on * 0.8;
      (r.beam.material as THREE.ShaderMaterial).uniforms.a.value = r.seen ? 0.35 : 1;
      r.ring.scale.setScalar(1 + Math.sin(t * 2) * 0.06 + on * 0.25);
    }
    if (best !== activeRelic) {
      activeRelic = best;
      if (best) { best.seen = true; ui.showEntry(best.id, best.room); sound.station(best.id); }
      else ui.hideEntry();
    }

    for (const a of animated) a(t, dt);
    waterU.time.value = t;
    grade.uniforms.time.value = t % 10;
    grade.uniforms.fade.value = Math.max(fade, ui.introOpen ? 0.25 : 0);

    sound.update(dt, 0.6 + progress * 0.3, hero.speed / 10, Math.min(fireDist, nearestFlame(near)) * 30, hero.pos.distanceTo(new THREE.Vector3(81, G, 209)) * 25);

    composer.render(dt);

    // adapt resolution if frames are slow
    frames++; slowT += dt;
    if (slowT > 2 && !still) {
      const fps = frames / slowT;
      if (fps < 40 && dpr > 0.85) { dpr = Math.max(0.85, dpr - 0.25); resize(); }
      frames = 0; slowT = 0;
    }
  };
  const nearestFlame = (near: { d: number }[]) => (near[0] ? Math.sqrt(near[0].d) * 1.8 : 1e9);

  // stills for screenshots: ?still&x=&z=&yaw=&dist=&p=
  if (still) {
    ui.skipIntro();
    document.body.classList.add('still');
    const x = +(params.get('x') ?? world.spawn[0]), z = +(params.get('z') ?? world.spawn[2]);
    hero.place(x, g.top(Math.floor(x), Math.floor(z), +(params.get('y') ?? 60)), z);
    hero.facing = +(params.get('face') ?? Math.PI);
    if (params.has('yaw')) cam.yaw = cam.yawT = +params.get('yaw')!;
    if (params.has('dist')) cam.dist = cam.distT = +params.get('dist')!;
    if (params.has('pitch')) cam.pitch = +params.get('pitch')!;
    progress = +(params.get('p') ?? 0);
    fade = 0;
    placeCamera(true);
  }
  (window as unknown as { __game: unknown }).__game = {
    hero, travel, rooms: world.rooms, cam, grid: g, THREE, info: () => ({ ...renderer.info.render, geos: renderer.info.memory.geometries }), setP: (p: number) => { stillP = p; },
    snap: (x: number, z: number, y = 60) => { hero.place(x, g.top(Math.floor(x), Math.floor(z), y), z); placeCamera(true); fade = 0; },
  };
  frame();
}
