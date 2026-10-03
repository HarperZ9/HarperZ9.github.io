// system/media-engine/plugins/retro.mjs
// The Retro Engine pipeline as an engine plugin, with two backends that take the same request:
//
//   "canvas2d"  today's path, unchanged: renderRetro() from retro-engine.js runs every stage on the
//               CPU, including the tube stage in retro-crt.js (scanlines, phosphor mask, bloom and
//               halation, barrel warp, bezel, colour separation, vignette) over the 960 x 600 frame.
//   "webgl2"    the front half stays on the CPU (pixelate, palette, dither on the 240-wide grid, the
//               same renderRetro call with the tube stage switched off), and the tube stage runs as
//               five GPU passes over that grid. The math is a line-for-line port of retro-crt.js,
//               including its 8.8 fixed-point phosphor arithmetic; the blur uses a true gaussian at
//               the variance of retro-crt's three box passes, so bloom and halation differ slightly.
//
// The source is the Retro Engine's own default live shader (shader-runner.js DEFAULT_FRAG) at the
// page's 1024 x 640 source size, so the comparison against retro.html is like for like.

// Same versioned URL retro-studio.js imports, so the page holds one copy of the engine.
import { renderRetro, RETRO_DEFAULT_OPTS as RETRO_ENGINE_DEFAULTS } from "../../retro-engine.js?v=20261003-worker";
import { crtActive, crtStage } from "../../retro-crt.js";
import { createShaderRunner, DEFAULT_FRAG } from "../../shader-runner.js?v=20260805-react";
import { getGL2, program, fullscreenTriangle, texture, target, sharedGL2, releaseContext } from "../gl2.mjs";

// renderRetro's own defaults for the tube fields, so a caller that omits one (retro-studio.js
// passes no beam) gets the same tube on both backends.
const TUBE_DEFAULTS = Object.freeze({ scanlines: true, scanStrength: 0.35, beam: 0.5, mask: "none", maskStrength: 0.35,
  bloom: 0, halation: 0, curvature: 0, aberration: 0, vignette: 0, upscale: 4 });

// retro.html defaults, read from the live page on 3 October 2026 (opts() in retro-studio.js).
export const RETRO_DEFAULTS = Object.freeze({
  palette: "outrun", targetWidth: 240, dither: "bayer8", ditherStrength: 0.8, gamma: 1, sdfShade: false,
  scanlines: true, scanStrength: 0.35, beam: 0.5, mask: "grille", maskStrength: 0.3,
  bloom: 0.18, halation: 0.2, curvature: 0.12, aberration: 0.1, vignette: 0.25,
});

const TUBE_OFF = { scanlines: false, mask: "none", bloom: 0, halation: 0, curvature: 0, aberration: 0, vignette: 0, upscale: 1 };
const MASKS = { none: 0, grille: 1, slot: 2, dot: 3 };
const H = `#version 300 es
precision highp float; precision highp int;
out vec4 o;
vec3 toLin(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 toSrgb(vec3 l){ l=clamp(l,0.0,1.0); return mix(l*12.92, 1.055*pow(l, vec3(1.0/2.4))-0.055, step(vec3(0.0031308), l)); }
`;

// Pass 1: nearest upscale of the grid, beam scanlines and phosphor mask (retro-crt.js phosphorPass).
const FS_PHOSPHOR = H + `
uniform sampler2D grid; uniform int cell; uniform int scanOn; uniform float scanS; uniform float beam;
uniform int maskMode; uniform float maskM;
float beamF(int k, int row){
  float s = scanS, mean = 1.05 - s*0.5; int up = max(1, cell); int centre = up/2;
  float sigma = 0.17 + clamp(beam,0.0,1.0)*0.2*(float(k)/15.0);
  float sum = 0.0, gr = 0.0;
  for (int r = 0; r < 32; r++){ if (r >= up) break;
    float v = float(r - centre)/float(up); float g = exp(-0.5*(v/sigma)*(v/sigma)); sum += g; if (r == row) gr = g; }
  return min(1.4, mean*(1.0 - s + s*(gr*float(up)/sum)));
}
vec3 maskW(int x, int y){
  float m = maskM; int chan = x; float rowDark = 1.0;
  if (maskMode == 2){ if (y == 5) rowDark = 1.0 - m*0.75; }
  else if (maskMode == 3){ chan = (x + ((y/3) & 1)*2) % 3; if (y % 3 == 2) rowDark = 1.0 - m*0.5; }
  float gain = (1.0 + m*0.45)*rowDark, off = (1.0 - m)*gain;
  return vec3(chan==0?gain:off, chan==1?gain:off, chan==2?gain:off);
}
void main(){
  ivec2 px = ivec2(gl_FragCoord.xy);
  uvec3 c = uvec3(floor(texelFetch(grid, px / cell, 0).rgb*255.0 + 0.5));
  float f = 1.0;
  if (scanOn == 1){
    if (cell >= 2){ int k = int(max(c.r, max(c.g, c.b))) >> 4; f = beamF(k, px.y % cell); }
    else f = (px.y % 2 == 0) ? 1.0 - scanS : 1.1;
  }
  vec3 mw = (maskMode > 0 && maskM > 0.0) ? maskW(px.x % 3, px.y % 6) : vec3(1.0);
  uint fi = uint(floor(f*256.0 + 0.5)); uvec3 mi = uvec3(floor(mw*256.0 + 0.5));
  uvec3 r = min((c*fi*mi + 32768u) >> 16u, uvec3(255u));
  o = vec4(vec3(r)/255.0, 1.0);
}`;

// Pass 2: box-downsample into linear light at 1/q; mode 1 keeps the soft-knee bright part.
const FS_DOWN = H + `
uniform sampler2D A; uniform int q; uniform ivec2 size; uniform int mode;
void main(){
  ivec2 lp = ivec2(gl_FragCoord.xy); vec3 s = vec3(0.0); float n = 0.0;
  for (int dy = 0; dy < 4; dy++) for (int dx = 0; dx < 4; dx++){
    if (dx >= q || dy >= q) continue;
    ivec2 p = lp*q + ivec2(dx, dy); if (p.x >= size.x || p.y >= size.y) continue;
    s += toLin(texelFetch(A, p, 0).rgb); n += 1.0; }
  vec3 lin = s / max(n, 1.0);
  if (mode == 1){ float t = clamp((dot(lin, vec3(0.2126, 0.7152, 0.0722)) - 0.18)/0.3, 0.0, 1.0); lin *= t*t*(3.0 - 2.0*t); }
  o = vec4(lin, 1.0);
}`;

// Pass 3: separable gaussian with clamped ends.
const FS_BLUR = H + `
uniform sampler2D S; uniform ivec2 dir; uniform ivec2 size; uniform float sigma;
void main(){
  ivec2 lp = ivec2(gl_FragCoord.xy); int R = int(ceil(sigma*3.0)); vec3 s = vec3(0.0); float ws = 0.0;
  for (int i = -32; i <= 32; i++){ if (i < -R || i > R) continue;
    float w = exp(-0.5*float(i*i)/(sigma*sigma)); s += texelFetch(S, clamp(lp + dir*i, ivec2(0), size - 1), 0).rgb*w; ws += w; }
  o = vec4(s/ws, 1.0);
}`;

// Pass 4: add the glow back through a bilinear upsample, in linear light (glowPass).
const FS_GLOW = H + `
uniform sampler2D A; uniform sampler2D BL; uniform sampler2D HL; uniform float bloom; uniform float halation;
uniform int q; uniform ivec2 lsize;
void main(){
  ivec2 px = ivec2(gl_FragCoord.xy); vec3 c = texelFetch(A, px, 0).rgb;
  vec2 f = clamp((vec2(px) + 0.5)/float(q) - 0.5, vec2(0.0), vec2(lsize - 1));
  vec2 uv = (f + 0.5)/vec2(lsize);
  vec3 g = texture(BL, uv).rgb*bloom*0.9 + texture(HL, uv).rgb*halation*0.3;
  o = vec4((g.r + g.g + g.b < 0.0015) ? c : toSrgb(toLin(c) + g), 1.0);
}`;

// Pass 5: barrel warp, feathered rounded bezel, radial colour separation, vignette (tubePass).
const FS_TUBE = H + `
uniform sampler2D B; uniform vec2 size; uniform float curv; uniform float abr; uniform float vig;
vec3 tapc(vec2 s){ vec2 sx = clamp((s + 1.0)*(size - 1.0)*0.5, vec2(0.0), size - 1.0); return texture(B, (sx + 0.5)/size).rgb; }
float bezel(float asu, float asv, float rc, float feather){
  if (rc <= 0.0) return (asu <= 1.0 && asv <= 1.0) ? 1.0 : 0.0;
  float qx = asu - (1.0 - rc), qy = asv - (1.0 - rc);
  float d = length(vec2(max(qx,0.0), max(qy,0.0))) + min(max(qx,qy), 0.0) - rc;
  return clamp(-d/feather, 0.0, 1.0);
}
void main(){
  float w = size.x, h = size.y; float x = floor(gl_FragCoord.x), y = h - 1.0 - floor(gl_FragCoord.y);
  float W2 = (w-1.0)*(w-1.0), H2 = (h-1.0)*(h-1.0), nv = 1.0/(W2 + H2);
  float u = x/(w-1.0)*2.0 - 1.0, v = y/(h-1.0)*2.0 - 1.0, vxy = u*u*W2*nv + v*v*H2*nv, vg = vig*256.0;
  if (curv <= 0.0 && abr <= 0.0){
    vec3 c = texelFetch(B, ivec2(x, y), 0).rgb; o = vec4(floor(c*255.0*floor(256.0 - vg*vxy)/256.0)/255.0, 1.0); return; }
  float k = curv*0.35, dab = abr*0.012;
  float rc = curv > 0.0 ? 0.02 + 0.08*min(1.0, curv) : 0.0, feather = 1.5/((w + h)/4.0), safe = 1.0 - rc - feather*2.0;
  float f = 1.0 + k*(u*u + v*v); vec2 s = vec2(u, v)*f; float asu = abs(s.x), asv = abs(s.y);
  float a = (asu <= safe && asv <= safe) ? 1.0 : bezel(asu, asv, rc, feather);
  if (a <= 0.0){ o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float vf = floor(a*(256.0 - vg*vxy));
  vec3 c = vec3(tapc(s*(1.0 - dab)).r, tapc(s).g, tapc(s*(1.0 + dab)).b);
  o = vec4(floor(floor(c*255.0 + 0.5)*vf/256.0)/255.0, 1.0);
}`;

// The source is the default live shader, or any frame handed in as params.source (a canvas or image
// from another plugin: a Gallery plate, Loom cloth, font glyphs). A handed-in frame is copied once,
// so the sender can keep drawing on its own canvas.
function makeSource(params) {
  if (params.source) {
    const c = document.createElement("canvas");
    c.width = params.source.width || 1024; c.height = params.source.height || 640;
    c.getContext("2d").drawImage(params.source, 0, 0);
    return { canvas: c, still: true, frame() {}, dispose() {} };
  }
  const c = document.createElement("canvas"); c.width = 1024; c.height = 640;
  const runner = createShaderRunner(c, params.frag || DEFAULT_FRAG);
  if (!runner.ok) throw new Error("retro source shader: " + runner.error);
  return { canvas: c, frame(t) { runner.renderFrame(t); }, dispose() { if (runner.dispose) runner.dispose(); } };
}

function cpuBackend(canvas, params) {
  const src = makeSource(params);
  let p = { ...RETRO_DEFAULTS, ...params };
  return {
    backend: "canvas2d",
    frame(t) {
      src.frame(t);
      // retro-studio.js opts(): scanlines switch off below 2 percent strength.
      const opts = { ...p, scanlines: p.scanlines && p.scanStrength > 0.02, upscale: Math.max(2, Math.min(12, Math.round(900 / p.targetWidth))) };
      this.lastMeasure = renderRetro(src.canvas, canvas, opts);
    },
    setParams(n) { p = { ...RETRO_DEFAULTS, ...n }; },
    readPixels() { return new Uint8Array(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data.buffer); },
    dispose() { src.dispose(); },
  };
}

// The five tube passes on one WebGL2 context. render() takes the CPU grid and draws the frame.
function makeTube(gl) {
  const half = !!gl.getExtension("EXT_color_buffer_float");
  const lfmt = half ? { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT } : {};
  const P = { ph: program(gl, FS_PHOSPHOR), dn: program(gl, FS_DOWN), bl: program(gl, FS_BLUR), gw: program(gl, FS_GLOW), tb: program(gl, FS_TUBE) };
  const tri = fullscreenTriangle(gl), gridTex = texture(gl, 0, 0);
  let T = null, dims = "";
  const targets = (w, h) => {
    if (w + "x" + h === dims) return; dims = w + "x" + h;
    if (T) Object.values(T).forEach((x) => x.dispose && x.dispose());
    const q = Math.min(w, h) < 320 ? 2 : 4, lw = Math.ceil(w / q), lh = Math.ceil(h / q), lin = { filter: gl.LINEAR, ...lfmt };
    T = { q, lw, lh, A: target(gl, w, h), B: target(gl, w, h, { filter: gl.LINEAR }),
      L: target(gl, lw, lh, lin), Br: target(gl, lw, lh, lin), t2: target(gl, lw, lh, lin) };
  };
  const pass = (pr, fb, w, h, set) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb ? fb.fb : null); gl.viewport(0, 0, w, h);
    gl.useProgram(pr.prog); set(pr.loc); tri.draw();
  };
  const bind = (unit, tex, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); };
  // blur3 in retro-crt.js is three box passes of radius r; match its variance with one gaussian.
  const boxSigma = (sigma) => { const r = Math.max(1, Math.round(Math.sqrt(sigma * sigma * 4 + 1) / 2 - 0.5)); return Math.sqrt(3 * ((2 * r + 1) ** 2 - 1) / 12); };
  const blur = (io, sigma) => {
    const { lw, lh } = T, s = boxSigma(sigma);
    for (const [src, dst, dx, dy] of [[io, T.t2, 1, 0], [T.t2, io, 0, 1]]) {
      pass(P.bl, dst, lw, lh, (l) => { bind(0, src.tex, l.S); gl.uniform2i(l.dir, dx, dy); gl.uniform2i(l.size, lw, lh); gl.uniform1f(l.sigma, s); });
    }
  };
  return { half, render(grid, up, p) { renderTube({ gl, grid, up, p, gridTex, targets, pass, bind, blur, P, getT: () => T }); },
    dispose() { tri.dispose(); gl.deleteTexture(gridTex); if (T) Object.values(T).forEach((x) => x.dispose && x.dispose()); Object.values(P).forEach((x) => gl.deleteProgram(x.prog)); } };
}

function renderTube({ gl, grid, up, p, gridTex, targets, pass, bind, blur, P, getT }) {
  const w = grid.width * up, h = grid.height * up;
  targets(w, h);
  const T = getT(), { q, lw, lh } = T;   // read after targets(), which may rebuild them
  gl.bindTexture(gl.TEXTURE_2D, gridTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, grid);
  pass(P.ph, T.A, w, h, (l) => {
    bind(0, gridTex, l.grid); gl.uniform1i(l.cell, up); gl.uniform1i(l.scanOn, p.scanlines && p.scanStrength > 0.02 ? 1 : 0);
    gl.uniform1f(l.scanS, p.scanStrength); gl.uniform1f(l.beam, p.beam);
    gl.uniform1i(l.maskMode, MASKS[p.mask] || 0); gl.uniform1f(l.maskM, p.maskStrength);
  });
  const glow = p.bloom > 0 || p.halation > 0;
  if (glow) {
    for (const [dst, mode] of [[T.L, 0], [T.Br, 1]]) {
      pass(P.dn, dst, lw, lh, (l) => { bind(0, T.A.tex, l.A); gl.uniform1i(l.q, q); gl.uniform2i(l.size, w, h); gl.uniform1i(l.mode, mode); });
    }
    if (p.bloom > 0) blur(T.Br, 8 / q);
    if (p.halation > 0) blur(T.L, 28 / q);
  }
  pass(P.gw, T.B, w, h, (l) => {
    bind(0, T.A.tex, l.A); bind(1, T.Br.tex, l.BL); bind(2, T.L.tex, l.HL);
    gl.uniform1f(l.bloom, glow ? p.bloom : 0); gl.uniform1f(l.halation, glow ? p.halation : 0);
    gl.uniform1i(l.q, q); gl.uniform2i(l.lsize, lw, lh);
  });
  pass(P.tb, null, w, h, (l) => {
    bind(0, T.B.tex, l.B); gl.uniform2f(l.size, w, h);
    gl.uniform1f(l.curv, p.curvature); gl.uniform1f(l.abr, p.aberration); gl.uniform1f(l.vig, p.vignette);
  });
}

function gpuBackend(canvas, params) {
  const gl = getGL2(canvas);
  if (!gl) return null;
  const src = makeSource(params), grid = document.createElement("canvas"), tube = makeTube(gl);
  let p = { ...RETRO_DEFAULTS, ...params };
  return {
    backend: "webgl2",
    halfFloat: tube.half,
    frame(t) {
      src.frame(t);
      this.lastMeasure = renderRetro(src.canvas, grid, { ...p, ...TUBE_OFF });   // CPU front half, 240-wide grid
      const up = Math.max(2, Math.min(12, Math.round(900 / p.targetWidth)));
      if (canvas.width !== grid.width * up || canvas.height !== grid.height * up) { canvas.width = grid.width * up; canvas.height = grid.height * up; }
      tube.render(grid, up, p);
    },
    setParams(n) { p = { ...RETRO_DEFAULTS, ...n }; },
    // Top-down RGBA, the same row order as getImageData, so the two backends compare byte for byte.
    readPixels() {
      const w = canvas.width, h = canvas.height, raw = new Uint8Array(w * h * 4), out = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      for (let y = 0; y < h; y++) out.set(raw.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      return out;
    },
    dispose() {
      src.dispose(); tube.dispose();
      releaseContext(gl);
    },
  };
}

// A drop-in for renderRetro(src, dst, opts) that runs the tube stage on the GPU. The caller keeps
// its 2D output canvas (retro-studio.js reads it back for effects, feedback, sonification and
// export): the front half draws the grid on the CPU, the five tube passes draw into a private
// WebGL2 canvas, and one drawImage copies the result into dst. Without WebGL2, after a lost
// context, or when no tube effect is on, it is renderRetro itself.
//
// renderLive(src, dst, opts, done) is the animation path. It snapshots the source, hands the front
// half to a worker (retro-worker.mjs runs the same quantizeGrid on the same bytes), and finishes
// the frame when the grid comes back, calling done(measure). One frame is in flight at a time; a
// call while one is in flight returns false and draws nothing. Stills, exports and captures keep
// using render(), which is synchronous, and any render() call retires a frame still in flight.
export function createRetroRenderer() {
  // The tube draws on the page's shared WebGL2 context (gl2.mjs sharedGL2) and copies its region out.
  const shared = sharedGL2();
  const gl = shared ? shared.gl : null;
  let tube = null;
  try { tube = gl ? makeTube(gl) : null; } catch (e) { console.error("[media-engine] retro tube unavailable:", e); tube = null; }
  const grid = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const tubeOn = (o) => tube && !gl.isContextLost() && crtActive(o);

  // Upscale the finished grid into dst: through the GPU tube, or nearest-neighbour as renderRetro
  // does when no tube effect is on.
  const finish = (dst, o, m) => {
    const up = Math.max(1, Math.floor(o.upscale));
    const w = grid.width * up, h = grid.height * up;
    if (dst.width !== w || dst.height !== h) { dst.width = w; dst.height = h; }
    const ctx = dst.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (tubeOn(o)) {
      shared.fit(w, h);
      tube.render(grid, up, o);
      shared.blit(ctx, w, h);
    } else {
      ctx.drawImage(grid, 0, 0, w, h);
      if (crtActive(o)) crtStage(ctx, w, h, { ...o, cell: up });
    }
    return { ...m, w, h };
  };

  let worker = null, workerFailed = false, inFlight = null, epoch = 0, verified = false, workerMs = 0;
  const sameBytes = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  const workerReady = () => {
    if (workerFailed) return false;
    if (worker) return true;
    if (typeof Worker !== "function" || typeof OffscreenCanvas !== "function" || typeof createImageBitmap !== "function") { workerFailed = true; return false; }
    try {
      worker = new Worker(new URL("../retro-worker.mjs", import.meta.url), { type: "module" });
    } catch (e) { console.error("[media-engine] retro worker unavailable, front half stays on the main thread:", e); workerFailed = true; return false; }
    worker.onerror = (e) => { console.error("[media-engine] retro worker failed, front half back on the main thread:", e.message || e); retire(true); };
    worker.onmessage = ({ data }) => {
      const job = inFlight;
      if (!job || job.id !== data.id) return;
      inFlight = null;
      if (job.epoch !== epoch) return;          // a synchronous render() drew since; this frame is stale
      if (data.error) { console.error("[media-engine] retro worker frame failed:", data.error); retire(true); job.done(api.render(job.src, job.dst, job.opts)); return; }
      const bytes = new Uint8ClampedArray(data.bytes);
      if (job.reference && !sameBytes(job.reference, bytes)) {
        // The worker's grid must be the page's grid, byte for byte. If this device downscales or
        // rounds differently off the main thread, the worker is retired and the reference is kept.
        console.error("[media-engine] retro worker grid differs from the main-thread grid; front half stays on the main thread");
        retire(true);
        job.done(finish(job.dst, job.o, job.referenceMeasure));
        return;
      }
      verified = verified || !!job.reference;
      workerMs = workerMs ? workerMs * 0.9 + data.ms * 0.1 : data.ms;
      if (grid.width !== data.tw) grid.width = data.tw;
      if (grid.height !== data.th) grid.height = data.th;
      grid.getContext("2d").putImageData(new ImageData(bytes, data.tw, data.th), 0, 0);
      job.done(finish(job.dst, job.o, { palette: job.o.palette, cells: data.tw * data.th, colors: data.colors, entries: data.entries }));
    };
    return true;
  };
  const retire = (failed) => {
    if (failed) { workerFailed = true; if (worker) worker.terminate(); worker = null; }
    inFlight = null;
  };

  const api = {
    get backend() { return tube && !gl.isContextLost() ? "webgl2" : "canvas2d"; },
    get worker() { return !!worker && !workerFailed; },
    get workerVerified() { return verified && !workerFailed; },
    // Mean worker time per frame (EMA, ms): the front half's cost, now off the main thread.
    get workerMs() { return +workerMs.toFixed(2); },
    render(src, dst, opts = {}) {
      epoch++;
      const o = { ...TUBE_DEFAULTS, ...opts };
      if (!tubeOn(o)) return renderRetro(src, dst, opts);
      const m = renderRetro(src, grid, { ...o, ...TUBE_OFF });
      if (!m || !m.w) return m;
      return finish(dst, o, m);
    },
    renderLive(src, dst, opts, done) {
      if (inFlight) return false;
      if (!grid || !workerReady()) { done(api.render(src, dst, opts)); return true; }
      const o = { ...RETRO_ENGINE_DEFAULTS, ...TUBE_DEFAULTS, ...opts };
      const job = { id: Math.random(), epoch, src, dst, opts, o, done };
      if (!verified) {
        // The first live frame also runs on the main thread, as the reference the worker must match.
        job.referenceMeasure = renderRetro(src, grid, { ...o, ...TUBE_OFF });
        job.reference = grid.getContext("2d").getImageData(0, 0, grid.width, grid.height).data;
      }
      inFlight = job;
      createImageBitmap(src).then((bitmap) => {
        if (inFlight !== job) { bitmap.close(); return; }
        worker.postMessage({ id: job.id, bitmap, opts: o }, [bitmap]);
      }).catch((e) => {
        console.error("[media-engine] retro source snapshot failed, drawing on the main thread:", e);
        if (inFlight === job) { retire(true); done(api.render(src, dst, opts)); }
      });
      return true;
    },
    dispose() {
      retire(false);
      if (worker) worker.terminate();
      if (tube) tube.dispose();
      const ext = gl && gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext();
    },
  };
  return api;
}

export const retro = {
  id: "retro",
  version: "0.2.0",
  backends: ["webgl2", "canvas2d"],
  create({ canvas, params, backend }) {
    if (backend !== "canvas2d") { const g = gpuBackend(canvas, params); if (g) return g; }
    return cpuBackend(canvas, params);
  },
};

// The Retro pipeline drawing into a 2D canvas the host already owns (the Studio's stage), with the
// tube on the GPU behind createRetroRenderer(). The host keeps reading, measuring and exporting its
// canvas as before.
export const retro2d = {
  id: "retro-2d",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params, reduced }) {
    const src = makeSource(params), renderer = createRetroRenderer();
    let p = { ...RETRO_DEFAULTS, ...params };
    return {
      // A handed-in still frame needs one draw per change, not an animation loop.
      static: !!src.still,
      get backend() { return renderer.backend === "webgl2" ? "canvas2d+webgl2-tube" : "canvas2d"; },
      lastMeasure: null,
      frame(t) {
        const upscale = Math.max(2, Math.min(12, Math.round(900 / p.targetWidth)));
        const o = { ...p, scanlines: p.scanlines && p.scanStrength > 0.02, upscale };
        // An animated source takes the worker path (the snapshot is taken right after the source
        // draws, in the same task). A handed-in still, or any frame under reduced motion, draws
        // synchronously so the host can read the canvas the moment the draw returns.
        src.frame(t);
        if (!src.still && !reduced) { renderer.renderLive(src.canvas, canvas, o, (m) => { this.lastMeasure = m; }); return; }
        this.lastMeasure = renderer.render(src.canvas, canvas, o);
      },
      setParams(n) { p = { ...RETRO_DEFAULTS, ...n }; },
      readPixels() { return new Uint8Array(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data.buffer); },
      dispose() { src.dispose(); renderer.dispose(); },
    };
  },
};
