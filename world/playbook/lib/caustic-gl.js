// lib/caustic-gl.js: the WebGL2 path of caustic.js. Same physics and colour as the CPU reference:
// photons are GL points whose landing spot is traced in the vertex shader from gl_VertexID (lens cell, wavelength),
// summed additively into a half-float target, then developed (shoulder, ceiling, ground, one flare, grain, TPDF dither)
// in a full-screen pass. Needs EXT_color_buffer_float; createCausticGL throws without it so the page can fall back.
import { cauchy, spectrum, cie, xyzToLinear, GLASS } from '../caustic.js';
import { filmLinear } from '../../substrate/lib/thinfilm.mjs';

const PHOTON_VS = `#version 300 es
precision highp float; precision highp int;
uniform vec4 u_wa[6]; uniform vec2 u_wb[6]; uniform vec4 u_ra[2]; uniform vec2 u_rb[2];
uniform float u_t, u_n, u_M, u_T, u_D, u_E0; uniform vec2 u_lens, u_scale, u_cy; uniform vec3 u_L, u_norm; uniform uint u_seed;
out vec3 v_c;
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float h01(uint a){ return float(pcg(a ^ u_seed)) / 4294967296.0; }
float g(float l, float m, float s1, float s2){ float t = (l - m) / (l < m ? s1 : s2); return exp(-0.5 * t * t); }
vec3 spec(float l){
  vec3 xyz = vec3(1.056*g(l,599.8,37.9,31.0)+0.362*g(l,442.0,16.0,26.7)-0.065*g(l,501.1,20.4,26.2), 0.821*g(l,568.8,46.9,40.5)+0.286*g(l,530.9,16.3,31.1), 1.217*g(l,437.0,11.8,36.0)+0.681*g(l,459.0,26.0,13.8));
  return mat3(3.2406,-0.9689,0.0557, -1.5372,1.8758,-0.2040, -0.4986,0.0415,1.0570) * xyz; }
float H(vec2 p){ float v = 0.0; for (int i = 0; i < 6; i++) v += u_wa[i].w * sin(dot(u_wa[i].xy, p) * u_wa[i].z - u_wb[i].x * u_t + u_wb[i].y);
  for (int i = 0; i < 2; i++) v += u_ra[i].w * sin(length(p - u_ra[i].xy) * u_ra[i].z - u_rb[i].x * u_t + u_rb[i].y); return v; }
vec2 G(vec2 p){ vec2 gr = vec2(0.0);
  for (int i = 0; i < 6; i++) gr += u_wa[i].xy * u_wa[i].w * u_wa[i].z * cos(dot(u_wa[i].xy, p) * u_wa[i].z - u_wb[i].x * u_t + u_wb[i].y);
  for (int i = 0; i < 2; i++) { vec2 d = p - u_ra[i].xy; float r = max(length(d), 1e-6); gr += d / r * u_ra[i].w * u_ra[i].z * cos(r * u_ra[i].z - u_rb[i].x * u_t + u_rb[i].y); }
  return gr; }
void main(){
  uint id = uint(gl_VertexID), M = uint(u_M), cell = id / M, m = id - cell * M, N = uint(u_n);
  float i = float(cell % N), j = float(cell / N), lam = 400.0 + (float(m) + h01(id * 3u + 1u)) * 300.0 / u_M;
  vec2 p = u_lens * (-1.0 + 2.0 * (vec2(i, j) + vec2(h01(id * 3u + 2u), h01(id * 3u + 3u))) / u_n);
  float n = u_cy.x + u_cy.y / (lam * lam); vec2 gr = G(p); vec3 Nn = normalize(vec3(-gr, 1.0));
  vec3 d1 = refract(u_L, Nn, 1.0 / n); vec3 d2 = refract(d1, vec3(0.0, 0.0, 1.0), n);
  gl_PointSize = 1.0;
  if (dot(d1, d1) < 0.5 || dot(d2, d2) < 0.5 || d2.z >= 0.0) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); v_c = vec3(0.0); return; }
  vec2 b = p + d1.xy * (u_T + H(p)) / -d1.z; vec2 q = b + d2.xy * u_D / -d2.z;
  gl_Position = vec4(q * u_scale, 0.0, 1.0); v_c = spec(lam) * u_norm / u_E0;
}`;
const PHOTON_FS = `#version 300 es
precision highp float; in vec3 v_c; out vec4 o; void main(){ o = vec4(v_c, 1.0); }`;
const QUAD_VS = `#version 300 es
out vec2 v_uv; void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); v_uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const DEVELOP_FS = `#version 300 es
precision highp float; precision highp int;
in vec2 v_uv; out vec4 o; uniform sampler2D u_acc; uniform vec2 u_res, u_peak; uniform float u_exp, u_inv, u_white, u_S, u_gain, u_ghost, u_grain; uniform vec3 u_ground;
uniform vec4 u_sp[8]; uniform vec3 u_film[8]; uniform uint u_seed;
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hp(ivec2 c, uint k){ return float(pcg(uint(c.x) * 1973u + uint(c.y) * 9277u + k * 26699u + u_seed)) / 4294967296.0; }
float vnoise(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); ivec2 c = ivec2(i);
  return mix(mix(hp(c, 7u), hp(c + ivec2(1, 0), 7u), f.x), mix(hp(c + ivec2(0, 1), 7u), hp(c + ivec2(1, 1), 7u), f.x), f.y) - 0.5; }
float toS(float v){ return v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1.0 / 2.4) - 0.055; }
void main(){
  vec2 px = v_uv * u_res, e = 0.75 / vec2(textureSize(u_acc, 0)); // a light tent over the photon target tames shot noise
  vec3 c = u_inv * (0.5 * texture(u_acc, v_uv).rgb + 0.125 * (texture(u_acc, v_uv + vec2(e.x, 0.0)).rgb + texture(u_acc, v_uv - vec2(e.x, 0.0)).rgb + texture(u_acc, v_uv + vec2(0.0, e.y)).rgb + texture(u_acc, v_uv - vec2(0.0, e.y)).rgb));
  vec2 d = px - u_peak; // the star's arm width follows the canvas scale
  for (int si = 0; si < 8; si++) { float len = u_S * u_sp[si].w / 550.0; float aw = 1.2 * max(1.0, u_S / 99.0); float a = exp(-abs(d.x) / len) * exp(-d.y * d.y / aw) + exp(-abs(d.y) / len) * exp(-d.x * d.x / aw); c += u_sp[si].rgb * u_gain * a / 8.0; }
  float rr = length(d), core = u_gain * (0.7 * exp(-rr * rr / (2.0 * pow(u_S * 0.035, 2.0))) + 0.12 * exp(-rr / (u_S * 0.45))); c += core * vec3(1.0, 0.86, 0.66);
  vec2 gd = px - (u_res - u_peak); float r = length(gd) / (u_S * 0.55), ring = exp(-(r - 1.0) * (r - 1.0) / 0.012) + 0.25 * exp(-r * r * 3.0);
  float fi = clamp(r, 0.0, 1.0) * 7.0; int f0 = int(floor(fi)); vec3 film = mix(u_film[f0], u_film[min(f0 + 1, 7)], fract(fi)); c += u_ghost * ring * film;
  c *= u_exp * vec3(1.0, 0.97, 0.92); float L0 = max(1e-6, dot(c, vec3(0.2126, 0.7152, 0.0722))); float L1 = L0 * (1.0 + L0 / (u_white * u_white)) / (1.0 + L0);
  c = max(c * (L1 / L0), 0.0) + u_ground; float m = max(c.r, max(c.g, c.b)); if (m > 0.94) c *= 0.94 / m;
  vec3 sc = vec3(toS(c.r), toS(c.g), toS(c.b));
  float gr = vnoise(px / 2.3) * u_grain / 255.0 * 3.4; float tp = (hp(ivec2(px), 3u) - hp(ivec2(px), 5u)) / 255.0;
  o = vec4(sc + gr + tp, 1.0);
}`;

function program(gl, vs, fs) {
  const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('caustic-gl: ' + gl.getShaderInfoLog(o)); return o; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('caustic-gl: ' + gl.getProgramInfoLog(p));
  const U = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (o[k] = gl.getUniformLocation(p, k))) }); return { p, U };
}

export function createCausticGL(canvas, { glass = GLASS.flint, T = 0.2, D = 1.6, n: n0 = 896, M = 12, scale = 0.4, exposure = 0.1, coatNm = [96, 138] } = {}) {
  let n = n0;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('caustic-gl: no webgl2');
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('caustic-gl: no float render target');
  const P = program(gl, PHOTON_VS, PHOTON_FS), Dv = program(gl, QUAD_VS, DEVELOP_FS), vao = gl.createVertexArray(), tex = gl.createTexture(), fb = gl.createFramebuffer();
  const cy = cauchy(glass), spec8 = spectrum(8), film = Array.from({ length: 8 }, (_, i) => filmLinear(coatNm[0] + ((coatNm[1] - coatNm[0]) * i) / 7, { n: 1.38, flip: false }));
  // the shader's spec() is the unnormalised CIE to sRGB; these factors make the band sum to white, as on the CPU
  const un = [0, 1, 2].map((c) => { let s = 0; for (let m = 0; m < M; m++) s += xyzToLinear(cie(400 + ((m + 0.5) * 300) / M))[c]; return M / s; });
  let aw = 0, ah = 0;
  function target(w, h) {
    if (w === aw && h === ah) return; aw = w; ah = h; gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    for (const [a, b] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, a, b);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('caustic-gl: half-float target incomplete');
  }
  // surf: surface() output; L: incoming light; peak: [x, y] in canvas px; seed: grain seed for this texture tick
  // each batch lands at flat level 1, so the develop pass divides the running sum by the batch count
  // accumulate: add another photon batch to the held pose (progressive: a slow GPU converges over frames, the pose waits)
  let batches = 0;
  function draw(surf, { L = [0, 0, -1], peak = [canvas.width / 2, canvas.height / 2], seed = 1, grainSd = 1.6, accumulate = false, full = n } = {}) {
    // the photon target is sized for the full photon count of a converged pose: about 14 photons a texel
    const W = canvas.width, H = canvas.height, k = Math.min(scale, Math.sqrt((full * full * M) / (14 * W * H))), w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k)); target(w, h);
    const sx = w / (2 * (w / h > 1 ? w / h : 1)), lx = (w / sx / 2) * 1.3, ly = (h / sx / 2) * 1.3, E0 = (n * n * M) / (4 * lx * ly) / (sx * sx);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h); if (!accumulate || !batches) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); batches = 0; } batches++;
    gl.useProgram(P.p); gl.bindVertexArray(vao); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const wa = new Float32Array(24), wb = new Float32Array(12), ra = new Float32Array(8), rb = new Float32Array(4);
    surf.waves.slice(0, 6).forEach((v, i) => { wa.set([v.dx, v.dy, v.k, v.a], i * 4); wb.set([v.w, v.phi], i * 2); });
    surf.rings.slice(0, 2).forEach((v, i) => { ra.set([v.cx, v.cy, v.k, v.a], i * 4); rb.set([v.w, v.phi], i * 2); });
    gl.uniform4fv(P.U.u_wa, wa); gl.uniform2fv(P.U.u_wb, wb); gl.uniform4fv(P.U.u_ra, ra); gl.uniform2fv(P.U.u_rb, rb);
    gl.uniform1f(P.U.u_t, surf.t); gl.uniform1f(P.U.u_n, n); gl.uniform1f(P.U.u_M, M); gl.uniform1f(P.U.u_T, T); gl.uniform1f(P.U.u_D, D); gl.uniform1f(P.U.u_E0, E0);
    gl.uniform2f(P.U.u_lens, lx, ly); gl.uniform2f(P.U.u_scale, (2 * sx) / w, (2 * sx) / h); gl.uniform2f(P.U.u_cy, cy.A, cy.B); gl.uniform3fv(P.U.u_L, L); gl.uniform3fv(P.U.u_norm, un); gl.uniform1ui(P.U.u_seed, 12345 + batches * 7919);
    gl.drawArrays(gl.POINTS, 0, n * n * M); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(Dv.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(Dv.U.u_acc, 0);
    gl.uniform2f(Dv.U.u_res, W, H); gl.uniform2f(Dv.U.u_peak, peak[0], H - peak[1]); gl.uniform1f(Dv.U.u_exp, exposure); gl.uniform1f(Dv.U.u_inv, 1 / batches); gl.uniform1f(Dv.U.u_white, 6); gl.uniform1f(Dv.U.u_S, 0.11 * Math.min(W, H));
    gl.uniform1f(Dv.U.u_gain, 24.0); gl.uniform1f(Dv.U.u_ghost, 1.2); gl.uniform1f(Dv.U.u_grain, grainSd); gl.uniform3f(Dv.U.u_ground, 0.012, 0.012, 0.011); gl.uniform1ui(Dv.U.u_seed, seed >>> 0);
    gl.uniform4fv(Dv.U.u_sp, new Float32Array(spec8.flatMap((s) => [...s.rgb, s.l]))); gl.uniform3fv(Dv.U.u_film, new Float32Array(film.flat()));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return { draw, gl, get done() { return batches * n * n; }, get photons() { return n; }, set photons(v) { n = Math.max(128, Math.round(v)); } };
}
