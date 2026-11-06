// GLSL for the world. Kept in one file so the lighting model reads top to bottom.

const NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

export const sceneVS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
layout(location=3) in vec4 aParams;
uniform vec2 uCam;
uniform float uPar;
uniform vec2 uView;
uniform float uTime;
uniform float uWind;
uniform vec2 uOffset;
uniform float uFlip;
out vec2 vWorld;
out vec3 vN;
out vec3 vCol;
out vec4 vP;
void main(){
  vec2 p = aPos;
  if (uFlip < 0.0) p.x = -p.x;
  p += uOffset;
  float sw = aParams.w;
  if (sw != 0.0) {
    float ph = uTime * 1.6 + p.x * 0.021 + p.y * 0.017;
    p.x += (sin(ph) * 0.55 + sin(ph * 2.3 + 1.0) * 0.3 + uWind) * sw;
    p.y += cos(ph * 1.3) * 0.25 * sw;
  }
  vec2 rel = p - uCam * uPar;
  gl_Position = vec4(rel / (uView * 0.5), 0.0, 1.0);
  vWorld = p;
  vec3 n = aNormal;
  if (uFlip < 0.0) n.x = -n.x;
  vN = n;
  vCol = aColor;
  vP = aParams;
}`;

export const sceneFS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vWorld;
in vec3 vN;
in vec3 vCol;
in vec4 vP;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform vec3 uFogCol;
uniform vec3 uMoonDir;
uniform float uMoonI;
uniform float uFog;
uniform float uLamps;
uniform float uTime;
uniform float uDarken;
uniform float uHazeY;
uniform vec3 uFire;
uniform float uTimeF;
out vec4 o;
${NOISE}
void main(){
  vec3 n = normalize(vN);
  float mat = vP.z;
  vec3 alb = vCol;
  float ao = vP.x;
  if (mat < 0.5) {
    // ashlar sandstone: staggered courses, a little grain and per-block tone
    float cy = vWorld.y / 9.0; float row = floor(cy); float fy = fract(cy);
    float cx = (vWorld.x + mod(row, 2.0) * 11.0) / 22.0; float fx = fract(cx);
    float joint = smoothstep(0.0, 0.08, fy) * smoothstep(1.0, 0.92, fy) * smoothstep(0.0, 0.04, fx) * smoothstep(1.0, 0.96, fx);
    float g = vnoise(vWorld * 0.4) * 0.5 + vnoise(vWorld * 2.1) * 0.5;
    alb *= mix(0.84, 1.0, joint) * (0.9 + 0.18 * g) * (0.93 + 0.14 * hash12(vec2(row, floor(cx))));
  } else if (mat < 1.5) {
    // wind ripples on sand, bent by low-frequency noise
    float w = vnoise(vWorld * vec2(0.008, 0.03)) * 7.0;
    float r = sin(vWorld.x * 0.32 + vWorld.y * 0.6 + w) * smoothstep(0.2, 0.8, vnoise(vWorld * 0.01));
    n = normalize(n + vec3(r * 0.07, 0.0, r * 0.02));
    alb *= 0.94 + 0.1 * vnoise(vWorld * 0.7) + 0.05 * hash12(floor(vWorld * 1.5));
  } else if (mat > 5.5 && mat < 6.5) {
    alb *= 0.8 + 0.4 * vnoise(vWorld * 0.25);
  }
  float ndl = max(dot(n, uSunDir), 0.0);
  if (mat > 2.5 && mat < 3.5) ndl = ndl * 0.75 + max(dot(-n, uSunDir), 0.0) * 0.45 + 0.08;
  vec3 amb = mix(uAmbGround, uAmbSky, clamp(n.y * 0.5 + 0.5, 0.0, 1.0));
  vec3 col = alb * (amb + uSunCol * ndl) * ao;
  col += alb * vec3(0.5, 0.62, 1.0) * uMoonI * 0.45 * max(dot(n, uMoonDir), 0.0) * ao;
  if (uFire.z > 0.0) {
    vec2 fd = vWorld - uFire.xy;
    vec3 L = normalize(vec3(-fd, 40.0));
    float flick = 0.85 + 0.15 * sin(uTime * 9.0) * sin(uTime * 5.3 + 1.0);
    float att = uFire.z * flick / (1.0 + dot(fd, fd) / (85.0 * 85.0)) * 0.7;
    col += alb * vec3(1.0, 0.5, 0.18) * att * (0.35 + 0.65 * max(dot(n, L), 0.0)) * 2.2;
  }

  float em = vP.y;
  if (mat > 3.5 && mat < 4.5) {
    float fl = 0.75 + 0.25 * sin(uTime * 11.0 + vWorld.x * 0.7 + vWorld.y * 0.3) * vnoise(vec2(uTime * 5.0, vWorld.y * 0.15));
    col = vCol * (1.5 + em * 3.0) * fl;
  } else if (em > 0.0) {
    float flick = 0.9 + 0.1 * sin(uTime * 2.7 + vWorld.x * 0.13);
    col += em * uLamps * vec3(1.0, 0.55, 0.2) * 2.2 * flick;
  }
  if (mat > 4.5 && mat < 5.5) {
    float rip = vnoise(vec2(vWorld.x * 0.05 + uTime * 0.3, vWorld.y * 0.6 - uTime * 0.2));
    col = mix(col, uAmbSky * 1.4, 0.45) + uSunCol * smoothstep(0.72, 0.95, rip) * 0.5;
  }
  col *= uDarken;
  float haze = clamp(uFog, 0.0, 1.0);
  // low ground haze thickens toward the horizon of each layer
  haze = max(haze, clamp(exp(-(vWorld.y - uHazeY) * 0.012) * uFog * 1.1, 0.0, min(0.7, uFog * 1.5)));
  col = mix(col, uFogCol, haze);
  o = vec4(col, 0.0);
}`;

export const fullVS = /* glsl */ `#version 300 es
out vec2 vUv;
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const skyFS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes;
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSunCol;
uniform vec2 uSun;
uniform float uSunVis;
uniform float uStars;
uniform vec2 uMoon;
uniform float uMoonI;
uniform float uHorizonY;
uniform float uTime;
uniform float uScroll;
out vec4 o;
${NOISE}
void main(){
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  float h = (uv.y - uHorizonY) / max(0.0001, 1.0 - uHorizonY);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.45, h));
  col = mix(col, uZenith, smoothstep(0.35, 1.05, h));
  col = mix(col, uHorizon * 1.05, smoothstep(0.0, -0.3, h));

  // sun: wide warm scattering, a tighter halo and the disc
  vec2 d = (uv - uSun) * vec2(aspect, 1.0);
  float r = length(d);
  float lowSun = 1.0 - smoothstep(0.0, 0.5, uSun.y - uHorizonY);
  col += uSunCol * uSunVis * (exp(-r * 2.6) * (0.08 + 0.55 * lowSun) + exp(-r * 10.0) * 0.45);
  // horizon glow spreads sideways when the sun is low
  col += uSunCol * uSunVis * lowSun * exp(-abs(uv.y - uHorizonY) * 9.0) * exp(-abs(d.x) * 1.4) * 0.5;
  float disc = smoothstep(0.034, 0.030, r);
  col = mix(col, uSunCol * 5.0 + vec3(1.2, 1.1, 0.9), disc * uSunVis * step(uHorizonY - 0.02, uv.y));

  // a few high streaks of cloud, lit from below near the sun
  vec2 cp = vec2(uv.x * aspect * 1.4 + uScroll * 0.00004 + uTime * 0.004, uv.y * 7.0);
  float cl = fbm(cp * vec2(1.0, 1.0) + vec2(0.0, fbm(cp * 0.6) * 1.5));
  float band = smoothstep(0.25, 0.5, h) * smoothstep(1.0, 0.6, h);
  float cloud = smoothstep(0.55, 0.85, cl) * band * 0.55;
  vec3 cloudCol = mix(uMid * 1.1, uSunCol * 1.4 + uHorizon * 0.6, exp(-r * 1.5) * uSunVis + lowSun * 0.4);
  col = mix(col, cloudCol, cloud * (1.0 - uStars * 0.7));

  // stars, the Milky Way, and the moon
  if (uStars > 0.001) {
    float px = 1.0 / uRes.y;
    vec2 sp = vec2(uv.x * aspect + uScroll * 0.00002, uv.y) * 140.0;
    vec2 cell = floor(sp);
    float rnd = hash12(cell);
    vec2 off = vec2(hash12(cell + 3.1), hash12(cell + 7.7)) - 0.5;
    float dist = length(fract(sp) - 0.5 - off * 0.7) / 140.0;
    float tw = 0.55 + 0.45 * sin(uTime * (0.7 + rnd * 2.5) + rnd * 40.0);
    float rad = px * (0.6 + 1.4 * fract(rnd * 91.0));
    float star = smoothstep(rad * 1.6, rad * 0.3, dist) * step(0.955, rnd) * tw * (0.35 + 1.6 * fract(rnd * 57.0));
    vec2 sp2 = vec2(uv.x * aspect + uScroll * 0.00001, uv.y) * 46.0;
    vec2 c2 = floor(sp2); float r2 = hash12(c2 + 11.0);
    vec2 o2 = vec2(hash12(c2 + 1.3), hash12(c2 + 5.9)) - 0.5;
    float d2 = length(fract(sp2) - 0.5 - o2 * 0.6) / 46.0;
    float star2 = (smoothstep(px * 2.4, px * 0.5, d2) * 1.6 + exp(-d2 / (px * 4.0)) * 0.22 * smoothstep(0.35 / 46.0, 0.1 / 46.0, d2)) * step(0.975, r2);
    // Milky Way: a diagonal band of glow with dark dust lanes
    vec2 mp = vec2(uv.x * aspect, uv.y);
    float along = dot(mp, normalize(vec2(0.55, 1.0)));
    float across = dot(mp, normalize(vec2(1.0, -0.55))) - 0.35 - uScroll * 0.000006;
    float bandMW = exp(-pow(across * 3.2, 2.0));
    float dust = fbm(vec2(along * 6.0, across * 14.0) + 3.0);
    float mw = bandMW * (0.35 + 0.65 * fbm(vec2(along * 3.0, across * 8.0))) * smoothstep(0.35, 0.75, dust + 0.2);
    vec3 mwCol = mix(vec3(0.25, 0.3, 0.55), vec3(0.7, 0.55, 0.6), fbm(mp * 4.0));
    float above = smoothstep(-0.02, 0.15, h);
    col += (vec3(star + star2) * vec3(1.0, 0.95, 0.85) + mwCol * mw * 0.32 + vec3(star * 0.0)) * uStars * above;
    // dense faint star dust inside the band
    col += vec3(0.85, 0.85, 1.0) * fbm(mp * 60.0) * bandMW * 0.08 * uStars * above;
  }
  if (uMoonI > 0.001) {
    vec2 md = (uv - uMoon) * vec2(aspect, 1.0);
    float mr = length(md);
    float moon = smoothstep(0.022, 0.019, mr);
    // a crescent: subtract a shifted disc
    float shadow = smoothstep(0.019, 0.016, length(md - vec2(0.008, 0.004)));
    vec3 mc = vec3(1.0, 0.96, 0.86) * (0.85 + 0.15 * vnoise(md * 300.0));
    col += mc * moon * (1.0 - shadow * 0.92) * uMoonI * 1.6;
    col += vec3(0.5, 0.6, 0.9) * exp(-mr * 18.0) * 0.12 * uMoonI;
  }
  o = vec4(col, 1.0);
}`;

export const brightFS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uThreshold;
out vec4 o;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThreshold, 0.0) / max(l, 0.0001);
  o = vec4(c * k, 1.0);
}`;

export const blurFS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 o;
void main(){
  vec3 c = texture(uTex, vUv).rgb * 0.227027;
  c += texture(uTex, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture(uTex, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  o = vec4(c, 1.0);
}`;

export const raysFS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uSun;
uniform float uStrength;
out vec4 o;
${NOISE}
void main(){
  vec2 dir = (uSun - vUv);
  float dist = length(dir);
  vec2 st = dir / 48.0;
  vec2 uv = vUv + st * hash12(gl_FragCoord.xy);
  float acc = 0.0, w = 1.0;
  for (int i = 0; i < 48; i++) {
    vec4 s = texture(uTex, uv);
    float lum = dot(s.rgb, vec3(0.3, 0.5, 0.2));
    acc += s.a * smoothstep(0.25, 1.6, lum) * w;
    w *= 0.965;
    uv += st;
  }
  acc /= 48.0;
  o = vec4(vec3(acc * uStrength * exp(-dist * 2.2)), 1.0);
}`;

export const finalFS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uRays;
uniform vec2 uRes;
uniform float uBloomI;
uniform vec3 uRayCol;
uniform float uExposure;
uniform vec3 uGrade;
uniform float uTime;
uniform float uHeat;
uniform float uHorizonY;
uniform float uFade;
uniform float uVignette;
out vec4 o;
${NOISE}
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
void main(){
  vec2 uv = vUv;
  // heat shimmer, strongest just above the far horizon at midday
  float band = exp(-pow((uv.y - uHorizonY) * 9.0, 2.0));
  uv.x += (vnoise(vec2(uv.y * 160.0, uTime * 3.0)) - 0.5) * 0.0022 * uHeat * band;
  // gentle chromatic fringe toward the edges
  vec2 cc = uv - 0.5;
  float ca = dot(cc, cc) * 0.0035;
  vec3 col;
  col.r = texture(uScene, uv + cc * ca).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - cc * ca).b;
  col += texture(uBloom, uv).rgb * uBloomI;
  col += texture(uRays, uv).rgb * uRayCol;
  col *= uExposure;
  col = aces(col);
  // tint shadows toward the hour's colour, lift nothing
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, col * 0.6 + pow(uGrade, vec3(0.4545)) * 0.55, (1.0 - smoothstep(0.0, 0.5, lum)) * 0.35);
  col = pow(col, vec3(0.4545));
  // vignette and grain
  float v = smoothstep(1.25, 0.35, length(cc * vec2(uRes.x / uRes.y * 0.85, 1.0)));
  col *= mix(1.0, v, uVignette);
  float g = hash12(gl_FragCoord.xy + fract(uTime * 7.13) * 100.0) - 0.5;
  col += g * 0.035;
  col *= uFade;
  o = vec4(col, 1.0);
}`;
