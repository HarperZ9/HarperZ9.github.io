// Overprint glass: flat inks as thin tinted glass layers, rendered per wavelength.
// Each layer is a shape with a rounded edge (its thickness rises from zero at the rim). Where layers overlap,
// the light passes through both, so their absorbances add per wavelength (Beer-Lambert) and the mixed colour is
// computed, not chosen. The surface returns Fresnel reflection (index 1.5: 4% head-on, more at the sloped rims),
// refracts what lies beneath, and focuses light under its edges (caustics from the curvature of the surface).
// One layer per view may carry a thin oil film, whose interference colour changes with its thickness.
// Inks and paper come from tables.js, recovered from a measured Olivetti print (tools/crossover/).
// Lighting "reflect" is ink on paper (day); "backlit" is the same glass lit from behind in a dark wall (night).
import { XYZ, XYZ_TO_RGB, PAPER, INKS, F0, MIE } from "./tables.js";
import { KEYS, keySpectrum } from "./keyboard.js";

// the measured inks, then the colour keyboard's keys, each a mix of measured inks (keyboard.js)
const INK_NAMES = ["red", "cyan", "yellow", "green", "black", "clear", "oil", ...Object.keys(KEYS)];
const TYPES = { disc: 0, ring: 1, bar: 2, box: 3, pie: 4, lobe: 5, mask: 6, link: 7 };
const MAXG = 24;

const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;

const FS = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uShapes; uniform int uN;
uniform sampler2D uMie; uniform sampler2D uMask;
uniform vec4 uG0[${MAXG}]; // ink, density, height scale, edge width (scene units)
uniform vec4 uG1[${MAXG}]; // smooth-union k, flags (1 oil, 2 lobe, 4 mask), mask channel, lobe size param at 550 nm
uniform int uNG; uniform int uHasLobe;
uniform vec4 uInk[${INK_NAMES.length * 4}];
uniform vec4 uPaper[4];
uniform vec3 uW[16];
uniform mat3 uM;
uniform vec2 uRes; uniform vec4 uView; // scene x0, y0, units per pixel, unused
uniform vec2 uJit; uniform float uMode; // 0 reflect on paper, 1 backlit, 2 ratio for a multiply blend
uniform float uRefr, uCaus, uF0, uTime, uLift, uFilmTop, uFilmMM, uFilmT;
uniform vec3 uGround; // backlit wall colour, linear sRGB
uniform float uLogX0, uLogX1, uDec;
out vec4 o;

const float BIN[16] = float[16](409.38,428.12,446.88,465.62,484.38,503.12,521.88,540.62,559.38,578.12,596.88,615.62,634.38,653.12,671.88,690.62);

vec4 sh(int i, int k){ return texelFetch(uShapes, ivec2(i * 3 + k, 0), 0); }
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
vec2 rot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x + s * p.y, -s * p.x + c * p.y); }
float sdPie(vec2 p, float r, float ap){ vec2 c = vec2(sin(ap), cos(ap)); p.x = abs(p.x); float l = length(p) - r;
  float m = length(p - c * clamp(dot(p, c), 0., r)); return max(l, m * sign(c.y * p.x - c.x * p.y)); }

// distance to a shape that does not depend on wavelength
float sdS(int i, vec2 p, out int g){
  vec4 A = sh(i, 0), B = sh(i, 1), C = sh(i, 2); int t = int(A.x); g = int(A.y);
  vec2 c = A.zw;
  if (t == 0) return length(p - c) - B.x;
  if (t == 1) return abs(length(p - c) - B.x) - B.y;
  if (t == 2) return sdSeg(p, c, B.xy) - B.z;
  if (t == 3) { vec2 q = abs(rot(p - c, B.z)) - B.xy + C.x; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - C.x; }
  if (t == 4) return sdPie(rot(p - c, B.y), B.x, B.z);
  if (t == 7) return abs(sdSeg(p, c, B.xy) - B.z) - B.w;
  return 1e5;
}
// the Mie lobe: polar radius from the phase function on a log scale, for a size parameter x
float lobeR(vec2 q, float x){
  float th = acos(clamp(q.x / max(length(q), 1e-5), -1., 1.));
  float v = (log(x) - uLogX0) / (uLogX1 - uLogX0);
  float l = texture(uMie, vec2(th / 3.14159265 * (360. / 361.) + .5 / 361., clamp(v, 0., 1.))).r; // log10(p/max) over 6 decades
  return clamp((l - 1. + uDec / 6.) / (uDec / 6.), 0., 1.);
}
float prof(float d, float e){ float u = clamp(-d / e, 0., 1.); return u * u * (3. - 2. * u); } // a bead: flat top, rounded rim

// group distances at p; lobes are evaluated at bin b (or 550 nm when b < 0)
void groups(vec2 p, int b, out float gd[${MAXG}]){
  for (int g = 0; g < ${MAXG}; g++) gd[g] = 1e5;
  for (int i = 0; i < 512; i++) { if (i >= uN) break;
    vec4 A = sh(i, 0); int t = int(A.x); int g = int(A.y); float d;
    if (t == 5) { vec4 B = sh(i, 1); vec2 q = rot(p - A.zw, B.z); float lam = b < 0 ? 550. : BIN[b];
      float x = uG1[g].w * 550. / lam * B.y; d = length(q) - B.x * lobeR(q, x); }
    else if (t == 6) { vec4 B = sh(i, 1); vec2 uv = (p - A.zw) / (B.xy - A.zw);
      float m = (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) ? 0. : texture(uMask, uv)[int(uG1[g].z)];
      d = (.5 - m) * uG0[g].w * 2.; }
    else { int gg; d = sdS(i, p, gg); }
    float k = uG1[g].x; gd[g] = k > 0. ? smin(gd[g], d, k) : min(gd[g], d);
  }
}
float height(vec2 p){ float gd[${MAXG}]; groups(p, -1, gd); float H = 0.;
  for (int g = 0; g < ${MAXG}; g++) { if (g >= uNG) break; H += prof(gd[g], uG0[g].w) * uG0[g].z; } return H; }

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= .5; } return s; }

// the room the glass reflects, lit like a copy stand: two lamps at 45 degrees, upper left and lower right, a dark
// ceiling straight above (so flat glass shows almost no mirror light, as a scan of print does) and a dim surround
float env(vec3 r, float night){
  vec3 k1 = normalize(vec3(-.6, -.6, .75)), k2 = normalize(vec3(.6, .6, .75));
  float lamps = smoothstep(.965, .992, dot(r, k1)) * 3. + smoothstep(.975, .995, dot(r, k2)) * 1.4;
  float room = .16 * (1. - smoothstep(.2, .9, r.z)) + .35 * smoothstep(.5, 1., r.z); // a light tent overhead
  return night > .5 ? .01 + lamps * .8 + room * .3 : room + lamps;
}
// a free thin film (n 1.38, like a soap or oil skin with air on both sides), Airy reflectance
float film(float lam, float dnm, float ct){
  float n1 = 1., n2 = 1.38, n3 = 1.; float r1 = (n1 - n2) / (n1 + n2), r2 = (n2 - n3) / (n2 + n3);
  float del = 4. * 3.14159265 * n2 * dnm * ct / lam;
  float num = r1 * r1 + r2 * r2 + 2. * r1 * r2 * cos(del), den = 1. + r1 * r1 * r2 * r2 + 2. * r1 * r2 * cos(del);
  return num / den;
}

void main(){
  vec2 px = gl_FragCoord.xy + uJit; px.y = uRes.y - px.y;
  float u = uView.z; vec2 p = uView.xy + px * u;
  float e = u * .75;
  float Hc = height(p), Hx1 = height(p + vec2(e, 0)), Hx0 = height(p - vec2(e, 0)), Hy1 = height(p + vec2(0, e)), Hy0 = height(p - vec2(0, e));
  vec2 grad = vec2(Hx1 - Hx0, Hy1 - Hy0) / (2. * e);
  float lap = (Hx1 + Hx0 + Hy1 + Hy0 - 4. * Hc) / (e * e);
  vec3 n = normalize(vec3(-grad, 1.));
  vec2 pr = p - grad * Hc * uRefr;                  // refraction: what lies beneath shifts by thickness x slope x (n - 1) / n
  float E = clamp(1. - uCaus * lap, .35, 3.);       // caustics: curvature focuses the light that reaches the paper
  float cosv = n.z;
  float F = uF0 + (1. - uF0) * pow(1. - cosv, 5.);
  vec3 r = vec3(2. * cosv * n.xy, 2. * cosv * n.z - 1.);
  float night = uMode == 1. ? 1. : 0.;
  float Ev = env(r, night);
  // absorbance per bin, from the groups at the refracted point, and at the point the key light crossed the glass
  // (the glass sits uLift above the paper; with no lift the two coincide and the result is ink on paper)
  float A[16], Ak[16]; for (int b = 0; b < 16; b++) { A[b] = 0.; Ak[b] = 0.; }
  float gk[${MAXG}]; groups(pr - vec2(.8, .8) * uLift, -1, gk);
  for (int g = 0; g < ${MAXG}; g++) { if (g >= uNG) break; if ((int(uG1[g].y) & 2) != 0) continue;
    float h = prof(gk[g], uG0[g].w) * uG0[g].y; for (int b = 0; b < 16; b++) Ak[b] += h * uInk[int(uG0[g].x) * 4 + b / 4][b % 4]; }
  float gd[${MAXG}]; groups(pr, -1, gd);
  float oil = 0., cover = 0.;
  float bire = 0., gam = 0., phi = 0.; // a radially ordered sphere between crossed polarisers (flag 8)
  for (int g = 0; g < ${MAXG}; g++) { if (g >= uNG) break;
    int ink = int(uG0[g].x); float dens = uG0[g].y; int fl = int(uG1[g].y);
    if ((fl & 2) != 0) continue; // lobes are added per bin below
    float h = prof(gd[g], uG0[g].w);
    cover = max(cover, h);
    if ((fl & 1) != 0) oil = max(oil, h);
    if ((fl & 8) != 0 && h > 0.) { // find the sphere this pixel lies in: the nearest disc of the group
      for (int i = 0; i < 512; i++) { if (i >= uN) break; vec4 S0 = sh(i, 0); if (int(S0.y) != g || int(S0.x) != 0) continue;
        vec2 q = pr - S0.zw; float R = sh(i, 1).x; float rr = length(q) / R; if (rr >= 1.) continue;
        bire = h; gam = uG1[g].w * sqrt(1. - rr * rr); phi = atan(q.y, q.x); } continue; }
    for (int b = 0; b < 16; b++) A[b] += h * dens * uInk[ink * 4 + b / 4][b % 4];
  }
  if (uHasLobe > 0) { // a lobe's outline moves with wavelength, so each bin gets its own geometry
    for (int b = 0; b < 16; b++) { float gb[${MAXG}]; groups(pr, b, gb);
      for (int g = 0; g < ${MAXG}; g++) { if (g >= uNG) break; if ((int(uG1[g].y) & 2) == 0) continue;
        float h = prof(gb[g], uG0[g].w); cover = max(cover, h); float a = h * uG0[g].y * uInk[int(uG0[g].x) * 4 + b / 4][b % 4]; A[b] += a; Ak[b] += a; } } }
  float fib = 1. +.014 * (fbm(p * .9) - .5) + .01 * (noise(p * 6.) - .5);
  // the film drains under gravity: for a vertical film with rigid surfaces, h = sqrt(mu x / (rho g t)) at depth x
  // below its top after time t (water, mu 1e-3 Pa s, rho 1000 kg/m3); a faint ripple stands in for Marangoni flow
  float xm = max(pr.y - uFilmTop, 0.) * uFilmMM * 1e-3 * (1. + .06 * (fbm(pr * .01 + vec2(0., uTime * .05)) - .5));
  float dfilm = 1e9 * sqrt(1e-3 * xm / (1000. * 9.81 * uFilmT));
  vec3 XYZc = vec3(0);
  for (int b = 0; b < 16; b++) {
    float T = exp(-A[b]);
    // Michel-Levy: crossed polarisers with a 530 nm plate at 45 degrees; the sphere's radial slow axis adds to the
    // plate in two quadrants and subtracts in the other two, and its own retardance is zero along the polariser arms
    if (bire > 0.) { float G = 530. + gam * cos(2. * (phi - .7853982)); float t = sin(3.14159265 * G / BIN[b]); T = mix(T, t * t, bire); }
    // single passes: light in (60% from the key lamp through the lifted glass, 40% diffuse), light out at p
    float Tin = .4 * exp(-A[b] * .5) + .6 * exp(-Ak[b] * .5), Tout = exp(-A[b] * .5);
    float paper = uPaper[b / 4][b % 4];
    float Rs = mix(F, film(BIN[b], dfilm, cosv), oil);
    float v;
    if (uMode == 1.) v = .85 * T * (1. - F) * (1. - F) * smoothstep(0., .02, cover) + Rs * Ev * smoothstep(0., .5, cover);
    else if (uMode == 2.) v = T * E * (1. - F) / (1. - uF0);
    else v = Rs * Ev + (1. - Rs) * paper * Tin * Tout * E * fib;
    XYZc += v * uW[b];
  }
  vec3 rgb = uM * XYZc;
  if (uMode == 1.) rgb += uGround * (1. - smoothstep(0., .02, cover));
  o = vec4(max(rgb, 0.), 1.);
}`;

const FS_OUT = `#version 300 es
precision highp float; uniform sampler2D uAcc; uniform float uN; uniform vec2 uRes; out vec4 o;
float enc(float c){ c = clamp(c, 0., 1.); return c <= .0031308 ? c * 12.92 : 1.055 * pow(c, 1. / 2.4) - .055; }
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){ vec3 c = texelFetch(uAcc, ivec2(gl_FragCoord.xy), 0).rgb / uN;
  vec3 m = max(c - .9, 0.); // highlights above 0.9 roll off instead of clipping c = min(c, .9) + .1 * (1. - exp(-m * 10.));
  float d = (h(gl_FragCoord.xy) - .5) / 255.;
  o = vec4(enc(c.r) + d, enc(c.g) + d, enc(c.b) + d, 1.); }`;

function compile(gl, vs, fs) {
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("crossover glass shader: " + gl.getShaderInfoLog(sh)); return sh; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "a"); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("crossover glass link: " + gl.getProgramInfoLog(p));
  return p;
}
const loadImage = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("crossover glass: could not load " + src)); i.src = src; });

// pack shapes into rows of three RGBA texels
function packShapes(shapes) {
  const d = new Float32Array(Math.max(shapes.length, 1) * 12);
  shapes.forEach((s, i) => {
    const o = i * 12, t = TYPES[s.t];
    d[o] = t; d[o + 1] = s.g;
    if (s.t === "bar" || s.t === "link") { d[o + 2] = s.a[0]; d[o + 3] = s.a[1]; d[o + 4] = s.b[0]; d[o + 5] = s.b[1]; d[o + 6] = s.r; d[o + 7] = s.w || 0; }
    else if (s.t === "mask") { d[o + 2] = s.x0; d[o + 3] = s.y0; d[o + 4] = s.x1; d[o + 5] = s.y1; }
    else {
      d[o + 2] = s.c[0]; d[o + 3] = s.c[1];
      if (s.t === "disc") d[o + 4] = s.r;
      if (s.t === "ring") { d[o + 4] = s.r; d[o + 5] = s.w; }
      if (s.t === "box") { d[o + 4] = s.hw[0]; d[o + 5] = s.hw[1]; d[o + 6] = s.ang || 0; d[o + 8] = s.rr || 0; }
      if (s.t === "pie") { d[o + 4] = s.r; d[o + 5] = s.ang || 0; d[o + 6] = s.ap; }
      if (s.t === "lobe") { d[o + 4] = s.R; d[o + 5] = s.size || 1; d[o + 6] = s.ang || 0; }
    }
  });
  return d;
}

export async function createGlass(canvas, { base = new URL(".", import.meta.url).href } = {}) {
  const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) throw new Error("crossover glass: WebGL2 is not available");
  if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("crossover glass: float render targets are not available");
  const prog = compile(gl, VS, FS), out = compile(gl, VS, FS_OUT);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t; };
  const shapesT = tex(0), mieT = tex(1), maskT = tex(2), accT = tex(3);
  gl.activeTexture(gl.TEXTURE1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]));
  const mie = await loadImage(new URL(MIE.src, base).href);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.activeTexture(gl.TEXTURE1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, MIE.nt, MIE.nx, 0, gl.RED, gl.UNSIGNED_BYTE, mie);
  gl.activeTexture(gl.TEXTURE2); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  const fb = gl.createFramebuffer();
  const U = (p, n) => gl.getUniformLocation(p, n);
  gl.useProgram(prog);
  const inks = new Float32Array(INK_NAMES.length * 16);
  INK_NAMES.forEach((k, i) => {
    const a = k === "clear" ? new Array(16).fill(0.02) : k === "oil" ? new Array(16).fill(0.0) : KEYS[k] ? keySpectrum(k) : INKS[k];
    a.forEach((v, b) => { inks[i * 16 + b] = v; });
  });
  gl.uniform4fv(U(prog, "uInk"), inks);
  gl.uniform4fv(U(prog, "uPaper"), new Float32Array(PAPER));
  gl.uniform3fv(U(prog, "uW"), new Float32Array(XYZ.flat()));
  gl.uniformMatrix3fv(U(prog, "uM"), true, new Float32Array(XYZ_TO_RGB.flat()));
  gl.uniform1f(U(prog, "uLogX0"), Math.log(MIE.x0)); gl.uniform1f(U(prog, "uLogX1"), Math.log(MIE.x1));
  gl.uniform1i(U(prog, "uShapes"), 0); gl.uniform1i(U(prog, "uMie"), 1); gl.uniform1i(U(prog, "uMask"), 2);

  function setScene(scene) {
    gl.useProgram(prog);
    const d = packShapes(scene.shapes);
    gl.activeTexture(gl.TEXTURE0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, scene.shapes.length * 3 || 3, 1, 0, gl.RGBA, gl.FLOAT, d);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.uniform1i(U(prog, "uN"), scene.shapes.length);
    const g0 = new Float32Array(MAXG * 4), g1 = new Float32Array(MAXG * 4);
    scene.groups.forEach((g, i) => {
      const edge = g.edge ?? 6;
      g0.set([INK_NAMES.indexOf(g.ink), g.dens ?? 1, (g.z ?? 0.6) * edge, edge], i * 4); // height in scene units: a bead as tall as 0.6 of its bevel
      g1.set([g.k || 0, (g.oil ? 1 : 0) | (g.lobe ? 2 : 0) | (g.mask != null ? 4 : 0) | (g.retard != null ? 8 : 0), g.mask ?? 0, g.retard ?? g.x550 ?? 1], i * 4);
    });
    if (scene.groups.some((g) => INK_NAMES.indexOf(g.ink) < 0)) throw new Error("crossover glass: unknown ink in scene");
    gl.uniform4fv(U(prog, "uG0"), g0); gl.uniform4fv(U(prog, "uG1"), g1); gl.uniform1i(U(prog, "uNG"), scene.groups.length);
    gl.uniform1i(U(prog, "uHasLobe"), scene.groups.some((g) => g.lobe) ? 1 : 0);
    if (scene.mask) { gl.activeTexture(gl.TEXTURE2); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, scene.mask); }
    gl.uniform1f(U(prog, "uRefr"), scene.refract ?? (1.5 - 1) / 1.5); gl.uniform1f(U(prog, "uCaus"), scene.caustic ?? 6.0);
    gl.uniform1f(U(prog, "uDec"), scene.decades ?? 6); gl.uniform1f(U(prog, "uF0"), scene.f0 ?? F0); gl.uniform1f(U(prog, "uLift"), scene.lift ?? 24);
    const film = scene.film || {}; gl.uniform1f(U(prog, "uFilmTop"), film.top ?? 0); gl.uniform1f(U(prog, "uFilmMM"), film.mmPerUnit ?? 0.1); gl.uniform1f(U(prog, "uFilmT"), film.seconds ?? 3600); gl.uniform1f(U(prog, "uTime"), scene.time || 0);
    gl.uniform1f(U(prog, "uMode"), { reflect: 0, backlit: 1, ratio: 2 }[scene.lighting || "reflect"]);
    gl.uniform3fv(U(prog, "uGround"), scene.ground || [0.004, 0.006, 0.01]);
    gl.uniform4f(U(prog, "uView"), scene.view[0], scene.view[1], scene.view[2], 0);
  }

  // render n jittered samples into a float target and resolve to the canvas
  function render(n = 1, onProgress) {
    const W = canvas.width, H = canvas.height;
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, accT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, accT, 0);
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const blendable = !!gl.getExtension("EXT_float_blend");
    if (!blendable) throw new Error("crossover glass: float blending is not available");
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(prog); gl.uniform2f(U(prog, "uRes"), W, H);
    let i = 0;
    const step = () => {
      // a rotated grid of sample offsets inside the pixel
      const a = (i + 0.5) / n, r = Math.sqrt(a) * 0.5, t = i * 2.39996;
      gl.uniform2f(U(prog, "uJit"), n > 1 ? r * Math.cos(t) : 0, n > 1 ? r * Math.sin(t) : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3); i++;
      gl.finish();
      if (onProgress) onProgress(i, n);
    };
    return new Promise((ok) => {
      const loop = () => { step(); if (i < n) setTimeout(loop, 0); else resolve(); };
      const resolve = () => {
        gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(out);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, accT);
        gl.uniform1i(U(out, "uAcc"), 3); gl.uniform1f(U(out, "uN"), n); gl.uniform2f(U(out, "uRes"), W, H);
        gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish(); ok();
      };
      loop();
    });
  }
  return { setScene, render, gl };
}
