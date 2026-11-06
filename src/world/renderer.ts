import { FLOATS, Mesh } from './mesh';
import { blurFS, brightFS, finalFS, fullVS, raysFS, sceneFS, sceneVS, skyFS } from './shaders';
import type { Light } from './palette';

type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): Prog {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
    }
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)!;
    u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

/** A static or dynamic batch of world geometry on the GPU. */
export class GPUMesh {
  vao: WebGLVertexArrayObject;
  buf: WebGLBuffer;
  count = 0;
  minX = 0;
  maxX = 0;
  constructor(private gl: WebGL2RenderingContext, mesh?: Mesh, dynamic = false) {
    this.vao = gl.createVertexArray()!;
    this.buf = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const stride = FLOATS * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 20);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 32);
    gl.bindVertexArray(null);
    if (mesh) this.upload(mesh, dynamic);
  }
  upload(mesh: Mesh, dynamic = false) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data.subarray(0, mesh.count * FLOATS), dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    this.count = mesh.count;
    this.minX = mesh.minX;
    this.maxX = mesh.maxX;
  }
}

export interface LayerDraw {
  mesh: GPUMesh;
  par: number; // parallax
  fog: number;
  darken: number;
  hazeY: number;
  offset?: [number, number];
  flip?: boolean;
}

export interface Frame {
  camX: number;
  camY: number;
  viewH: number;
  time: number;
  wind: number;
  light: Light;
  horizonY: number; // 0..1 from bottom, where the far horizon sits on screen
  heat: number;
  fade: number;
  fire: [number, number, number];
}

export class Renderer {
  gl: WebGL2RenderingContext;
  scene: Prog;
  sky: Prog;
  bright: Prog;
  blur: Prog;
  rays: Prog;
  final: Prog;
  w = 0;
  h = 0;
  dpr = 1;
  msaaFb: WebGLFramebuffer | null = null;
  msaaRb: WebGLRenderbuffer | null = null;
  sceneT!: Target;
  halfA!: Target;
  quarterA!: Target;
  quarterB!: Target;
  raysT!: Target;
  samples = 4;
  floatOK = false;
  emptyVao: WebGLVertexArrayObject;
  quality: 'high' | 'low' = 'high';

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', premultipliedAlpha: false });
    if (!gl) throw new Error('webgl2');
    this.gl = gl;
    this.floatOK = !!gl.getExtension('EXT_color_buffer_half_float') || !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_color_buffer_float');
    this.scene = compile(gl, sceneVS, sceneFS);
    this.sky = compile(gl, fullVS, skyFS);
    this.bright = compile(gl, fullVS, brightFS);
    this.blur = compile(gl, fullVS, blurFS);
    this.rays = compile(gl, fullVS, raysFS);
    this.final = compile(gl, fullVS, finalFS);
    this.emptyVao = gl.createVertexArray()!;
    const maxS = gl.getParameter(gl.MAX_SAMPLES) as number;
    this.samples = Math.min(4, maxS || 0);
  }

  private target(w: number, h: number, old?: Target): Target {
    const gl = this.gl;
    if (old) {
      gl.deleteFramebuffer(old.fb);
      gl.deleteTexture(old.tex);
    }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.floatOK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex, w, h };
  }

  resize(cssW: number, cssH: number, dpr: number) {
    const gl = this.gl;
    this.dpr = dpr;
    const w = Math.max(2, Math.round(cssW * dpr));
    const h = Math.max(2, Math.round(cssH * dpr));
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.sceneT = this.target(w, h, this.sceneT);
    this.halfA = this.target(w >> 1, h >> 1, this.halfA);
    this.quarterA = this.target(Math.max(1, w >> 2), Math.max(1, h >> 2), this.quarterA);
    this.quarterB = this.target(Math.max(1, w >> 2), Math.max(1, h >> 2), this.quarterB);
    this.raysT = this.target(Math.max(1, w >> 2), Math.max(1, h >> 2), this.raysT);
    if (this.msaaFb) gl.deleteFramebuffer(this.msaaFb);
    if (this.msaaRb) gl.deleteRenderbuffer(this.msaaRb);
    this.msaaFb = null;
    if (this.samples > 1) {
      this.msaaRb = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.msaaRb);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.samples, this.floatOK ? gl.RGBA16F : gl.RGBA8, w, h);
      this.msaaFb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.msaaFb);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.msaaRb);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        this.msaaFb = null;
      }
    }
  }

  private use(pr: Prog) {
    this.gl.useProgram(pr.p);
    return pr.u;
  }

  private full(t: Target | null) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
    gl.viewport(0, 0, t ? t.w : this.w, t ? t.h : this.h);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  sunUV(f: Frame): [number, number] {
    const L = f.light;
    return [L.sunScreen[0], f.horizonY + L.sunScreen[1] * (1 - f.horizonY) * 0.82];
  }

  render(f: Frame, layers: LayerDraw[]) {
    const gl = this.gl;
    const L = f.light;
    const aspect = this.w / this.h;
    const viewW = f.viewH * aspect;
    const sun = this.sunUV(f);
    const moon: [number, number] = [L.moonScreen[0], f.horizonY + L.moonScreen[1] * (1 - f.horizonY) * 0.85];

    // ---- scene ----
    const sceneFb = this.msaaFb ?? this.sceneT.fb;
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFb);
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.BLEND);

    let u = this.use(this.sky);
    gl.uniform2f(u.uRes, this.w, this.h);
    gl.uniform3fv(u.uZenith, L.zenith);
    gl.uniform3fv(u.uMid, L.mid);
    gl.uniform3fv(u.uHorizon, L.horizon);
    gl.uniform3fv(u.uSunCol, L.sun);
    gl.uniform2f(u.uSun, sun[0], sun[1]);
    gl.uniform1f(u.uSunVis, L.sunVisible);
    gl.uniform1f(u.uStars, L.stars);
    gl.uniform2f(u.uMoon, moon[0], moon[1]);
    gl.uniform1f(u.uMoonI, L.moonI);
    gl.uniform1f(u.uHorizonY, f.horizonY);
    gl.uniform1f(u.uTime, f.time);
    gl.uniform1f(u.uScroll, f.camX);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    u = this.use(this.scene);
    gl.uniform2f(u.uCam, f.camX, f.camY);
    gl.uniform2f(u.uView, viewW, f.viewH);
    gl.uniform1f(u.uTime, f.time);
    gl.uniform1f(u.uWind, f.wind);
    gl.uniform3fv(u.uSunDir, L.sunDir);
    gl.uniform3fv(u.uSunCol, L.sun);
    gl.uniform3fv(u.uAmbSky, L.ambSky);
    gl.uniform3fv(u.uAmbGround, L.ambGround);
    gl.uniform3fv(u.uMoonDir, L.moonDir);
    gl.uniform1f(u.uMoonI, L.moonI);
    gl.uniform1f(u.uLamps, L.lamps);
    for (const ly of layers) {
      if (!ly.mesh.count) continue;
      // cull by x extent in layer space
      const cx = f.camX * ly.par + (ly.offset ? 0 : 0);
      const half = viewW * 0.5 + 200;
      const ox = ly.offset ? ly.offset[0] : 0;
      if (!ly.flip && (ly.mesh.maxX + ox < cx - half || ly.mesh.minX + ox > cx + half)) continue;
      gl.uniform1f(u.uPar, ly.par);
      gl.uniform1f(u.uFog, ly.fog);
      gl.uniform1f(u.uDarken, ly.darken);
      gl.uniform1f(u.uHazeY, ly.hazeY);
      gl.uniform2f(u.uOffset, ox, ly.offset ? ly.offset[1] : 0);
      gl.uniform1f(u.uFlip, ly.flip ? -1 : 1);
      gl.uniform3f(u.uFire, f.fire[0], f.fire[1], ly.par === 1 ? f.fire[2] : 0);
      // fog colour leans toward the sun's colour on the sun side
      gl.uniform3fv(u.uFogCol, L.fog);
      gl.bindVertexArray(ly.mesh.vao);
      gl.drawArrays(gl.TRIANGLES, 0, ly.mesh.count);
    }

    if (this.msaaFb) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msaaFb);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.sceneT.fb);
      gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }

    // ---- bloom ----
    gl.activeTexture(gl.TEXTURE0);
    u = this.use(this.bright);
    gl.uniform1i(u.uTex, 0);
    gl.uniform1f(u.uThreshold, 1.05);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneT.tex);
    this.full(this.halfA);
    u = this.use(this.blur);
    gl.uniform1i(u.uTex, 0);
    let src = this.halfA;
    const passes = this.quality === 'high' ? 3 : 2;
    for (let i = 0; i < passes; i++) {
      const r = 1 + i * 1.5;
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(u.uDir, r / this.quarterA.w, 0);
      this.full(this.quarterA);
      gl.bindTexture(gl.TEXTURE_2D, this.quarterA.tex);
      gl.uniform2f(u.uDir, 0, r / this.quarterA.h);
      this.full(this.quarterB);
      src = this.quarterB;
    }

    // ---- light shafts ----
    u = this.use(this.rays);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uSun, sun[0], sun[1]);
    const lowSun = 1 - Math.min(1, Math.max(0, L.sunScreen[1] / 0.7));
    gl.uniform1f(u.uStrength, L.sunVisible * Math.pow(lowSun, 1.6) * 2.4);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneT.tex);
    this.full(this.raysT);

    // ---- final ----
    u = this.use(this.final);
    gl.uniform1i(u.uScene, 0);
    gl.uniform1i(u.uBloom, 1);
    gl.uniform1i(u.uRays, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneT.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.quarterB.tex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.raysT.tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(u.uRes, this.w, this.h);
    gl.uniform1f(u.uBloomI, L.bloom * 0.55);
    gl.uniform3f(u.uRayCol, L.sun[0] * 0.9, L.sun[1] * 0.85, L.sun[2] * 0.75);
    gl.uniform1f(u.uExposure, L.exposure);
    gl.uniform3fv(u.uGrade, L.grade);
    gl.uniform1f(u.uTime, f.time);
    gl.uniform1f(u.uHeat, f.heat);
    gl.uniform1f(u.uHorizonY, f.horizonY);
    gl.uniform1f(u.uFade, f.fade);
    gl.uniform1f(u.uVignette, 0.55);
    this.full(null);
  }
}
