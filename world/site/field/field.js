// field.js: the glass-and-water field, live in WebGL2. A space is a set of parameters (light, camera, wind, the
// word in the glass); moving between spaces eases them all along one path. createField renders live frames, or
// accumulates jittered frames into one still (renderStill) for the 4K plates the reduced-motion tier shows.
import { TRANS_FRAG, MS_FRAG, SKY_FRAG } from "./atmosphere.glsl.js";
import { WAVE_FRAG, SCENE_FRAG, POST_FRAG, VERT } from "./scene.glsl.js";
import { cascadeWaves, glyphField, sellmeier, N_BK7 } from "./ocean.js";

const D = Math.PI / 180;
// light: elevation and azimuth in degrees; moon: phase angle in degrees (0 full); wind U10 in m/s; camera height m,
// pitch and yaw in degrees; glass: the word, its distance, cap height, thickness (m); expo: exposure multiplier
export const SPACES = {
  "low-sun": { label: "Low sun", word: "Zain Dana Harper", light: { el: 2.2, az: 0 }, wind: 5, cam: { h: 2.2, pitch: 1.0, yaw: 0 }, glass: { z: 90, cap: 6.5, thick: 1.6 }, expo: 9 },
  "close": { label: "Close to the glass", word: "light", light: { el: 11, az: 24 }, wind: 4, cam: { h: 1.2, pitch: 2.5, yaw: 0 }, glass: { z: 22, cap: 4.2, thick: 1.4 }, expo: 7 },
  // the field behind the home and the reading pages carries no word: glass lettering stays where it means something
  // (the author, 2026-11-03, on the word "light" here: "I think it is decoration without meaning")
  "field-day": { label: "Behind the pages, day", word: "", light: { el: 11, az: 30 }, wind: 4, cam: { h: 1.4, pitch: 2.2, yaw: 0 }, glass: { x: 9, z: 30, cap: 3.6, thick: 1.3 }, expo: 7 },
  "field-night": { label: "Behind the pages, night", word: "", light: { el: 9, az: 24 }, moon: { phase: 38 }, wind: 4, cam: { h: 2.5, pitch: 3.2, yaw: 0, focal: 2.2 }, glass: { x: 38, z: 160, cap: 8, thick: 2.6 }, expo: 34 },
  "field-day-tall": { label: "Behind the pages, day, tall", word: "", light: { el: 11, az: 14 }, wind: 4, cam: { h: 1.4, pitch: 2.2, yaw: 0 }, glass: { x: 2.2, z: 30, cap: 3.0, thick: 1.3 }, expo: 7 },
  "field-night-tall": { label: "Behind the pages, night, tall", word: "", light: { el: 9, az: 8 }, moon: { phase: 38 }, wind: 4, cam: { h: 2.5, pitch: 3.2, yaw: 0, focal: 2.2 }, glass: { x: 9, z: 160, cap: 7, thick: 2.6 }, expo: 34 },
  "noon": { label: "Noon, from above", word: "water", light: { el: 58, az: 40 }, wind: 7, cam: { h: 28, pitch: -24, yaw: 0 }, glass: { z: 95, cap: 9, thick: 2.2 }, expo: 5.5 },
  "night": { label: "Night", word: "glass", light: { el: 9, az: -6 }, moon: { phase: 38 }, wind: 4, cam: { h: 2.5, pitch: 3.2, yaw: 0, focal: 4.2 }, glass: { z: 260, cap: 9, thick: 3 }, expo: 34 },
};
// the glass: N-BK7 at 680, 550 and 440 nm; absorption from its internal transmittance, about 0.997 over 25 mm in the
// red and green and 0.996 in the blue (SCHOTT N-BK7 data sheet), so alpha = -ln(tau) / 0.025 m
for (const sp of Object.values(SPACES)) { sp.night = sp.moon ? 1 : 0; sp.phase = sp.moon?.phase ?? 0; }
const IOR = [680, 550, 440].map((l) => sellmeier(l, N_BK7));
const ABS = [0.997, 0.997, 0.996].map((t) => -Math.log(t) / 0.025);
const CASCADES = [{ tile: 233, kmin: 0.027, kmax: 0.27 }, { tile: 37, kmin: 0.17, kmax: 1.7 }, { tile: 5.3, kmin: 1.2, kmax: 40 }];

function compile(gl, src, type) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function program(gl, frag) {
  const p = gl.createProgram(); gl.attachShader(p, compile(gl, VERT, gl.VERTEX_SHADER)); gl.attachShader(p, compile(gl, frag, gl.FRAGMENT_SHADER));
  gl.bindAttribLocation(p, 0, "a"); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = new Proxy({}, { get: (c, n) => (n in c ? c[n] : (c[n] = gl.getUniformLocation(p, n))) });
  return { p, u };
}
function target(gl, w, h, { mip = false, filter = true } = {}) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, mip ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1, gl.RGBA16F, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : filter ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter ? gl.LINEAR : gl.NEAREST);
  const wrap = mip ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f, w, h };
}
for (const sp of Object.values(SPACES)) { sp.cam.focal ??= 1.35; sp.glass.x ??= 0; }
const lerp = (a, b, k) => a + (b - a) * k, ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function mixSpace(a, b, k) {
  const m = (x, y) => (typeof x === "number" ? lerp(x, y, k) : Object.fromEntries(Object.keys(x).map((key) => [key, m(x[key], y[key] ?? x[key])])));
  return { light: m(a.light, b.light), cam: m(a.cam, b.cam), glass: m(a.glass, b.glass), wind: lerp(a.wind, b.wind, k), expo: lerp(a.expo, b.expo, k), night: lerp(a.night, b.night, k), phase: lerp(a.phase, b.phase, k) };
}

export function createField(canvas, { space = "close", dprCap = 1.5, reduced = false } = {}) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) throw new Error("glass-water field: WebGL2 with float targets is not available here");
  // a software rasteriser (SwiftShader, llvmpipe, WARP) runs this shader on the CPU and blocks the page; such a
  // device keeps the rendered plate. ?gpu=any lifts the check, for renders made on purpose (the 4K plates)
  const dbg = gl.getExtension("WEBGL_debug_renderer_info"), who = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
  if (/swiftshader|llvmpipe|softpipe|basic render|microsoft basic|warp/i.test(who) && new URLSearchParams(location.search).get("gpu") !== "any") throw new Error(`software renderer (${who})`);
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const P = { trans: program(gl, TRANS_FRAG), ms: program(gl, MS_FRAG), sky: program(gl, SKY_FRAG), wave: program(gl, WAVE_FRAG), scene: program(gl, SCENE_FRAG), post: program(gl, POST_FRAG) };
  const T = { trans: target(gl, 256, 64), ms: target(gl, 32, 32), sky: target(gl, 192, 108), waves: CASCADES.map(() => target(gl, 256, 256, { mip: true })) };
  if (aniso) for (const w of T.waves) { gl.bindTexture(gl.TEXTURE_2D, w.t); gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); }
  const draw = (prog, tgt, setup) => { gl.useProgram(prog.p); gl.bindFramebuffer(gl.FRAMEBUFFER, tgt ? tgt.f : null); gl.viewport(0, 0, tgt ? tgt.w : canvas.width, tgt ? tgt.h : canvas.height); setup?.(prog.u); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  const bind = (unit, tex, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); };
  draw(P.trans, T.trans);
  draw(P.ms, T.ms, (u) => bind(0, T.trans.t, u.uTrans));

  const waveTex = CASCADES.map(() => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; });
  let windNow = -1;
  function setWind(U10) {
    if (Math.abs(U10 - windNow) < 0.05) return; windNow = U10;
    CASCADES.forEach((c, i) => { const w = cascadeWaves({ ...c, n: 96, U10, fetch: 120000, windAngle: 0.35, seed: 11 + i * 7 });
      gl.bindTexture(gl.TEXTURE_2D, waveTex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 96, 1, 0, gl.RGBA, gl.FLOAT, w); });
  }
  const glyphTex = gl.createTexture(); let glyphNow = null, glyphMeta = null;
  function setWord(word) {
    if (word === glyphNow) return; glyphNow = word; glyphMeta = glyphField(word || " ");
    gl.bindTexture(gl.TEXTURE_2D, glyphTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, glyphMeta.w, glyphMeta.h, 0, gl.RED, gl.FLOAT, glyphMeta.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  let from = SPACES[space], to = from, word = to.word, t0 = 0, dur = 1, hdr = null, clock = 0;
  const progress = () => (reduced ? 1 : ease(Math.min(1, (performance.now() - t0) / dur)));
  const state = () => mixSpace(from, to, progress());
  function size(w, h) { if (!hdr || hdr.w !== w || hdr.h !== h) hdr = target(gl, w, h); }

  // one frame: the sea cascades at time t, the sky for this light, the scene (blended into the running mean when
  // accumulating), then the display pass
  function frame({ t = clock, jitter = [0, 0], blendWeight = 1 } = {}) {
    const s = state();
    // the word re-forms halfway along the path, while the camera is between framings
    setWind(s.wind); setWord(progress() < 0.5 ? word : to.word); if (progress() >= 1) word = to.word;
    const night = s.night > 0.5, el = s.light.el * D, az = s.light.az * D;
    const L = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    // the light is normalised to unit illuminance; night differs by exposure and by the eye's blue shift (post)
    // moonlight is set to 1/60 of the day light so night reads as night; the Moon's true illuminance is near 2.5e-6 of
    // the Sun's (0.25 lx against 1e5 lx), which the display could only show black, so this keeps night visible
    const lightCol = lerp(1, 1 / 60, s.night), phase = s.phase * D;
    CASCADES.forEach((c, i) => draw(P.wave, T.waves[i], (u) => { bind(0, waveTex[i], u.uWaves); gl.uniform1i(u.uN, 96); gl.uniform1f(u.uTile, c.tile); gl.uniform1f(u.uT, t); gl.uniform1f(u.uChop, 1.1); }));
    for (const w of T.waves) { gl.bindTexture(gl.TEXTURE_2D, w.t); gl.generateMipmap(gl.TEXTURE_2D); }
    draw(P.sky, T.sky, (u) => { bind(0, T.trans.t, u.uTrans); bind(1, T.ms.t, u.uMS); gl.uniform3fv(u.uL, L); gl.uniform1f(u.uViewH, Math.max(0.0005, s.cam.h / 1000)); });
    gl.enable(gl.BLEND); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA); gl.blendColor(0, 0, 0, blendWeight);
    draw(P.scene, hdr, (u) => {
      bind(0, T.trans.t, u.uTrans); bind(1, T.sky.t, u.uSky); T.waves.forEach((w, i) => bind(2 + i, w.t, u[`uW${i}`])); bind(5, glyphTex, u.uGlyph);
      gl.uniform2f(u.uRes, hdr.w, hdr.h); gl.uniform2fv(u.uJitter, jitter); gl.uniform3fv(u.uL, L); gl.uniform3f(u.uCam, 0, s.cam.h, 0);
      gl.uniform3fv(u.uIor, IOR); gl.uniform3fv(u.uAbs, ABS); gl.uniform3f(u.uLightCol, lightCol, lightCol, lightCol); gl.uniform3f(u.uTiles, ...CASCADES.map((c) => c.tile));
      gl.uniform1f(u.uPitch, s.cam.pitch * D); gl.uniform1f(u.uYaw, s.cam.yaw * D); gl.uniform1f(u.uFocal, s.cam.focal); gl.uniform1f(u.uT, t);
      gl.uniform1f(u.uMoon, night ? 1 : 0); gl.uniform1f(u.uMoonPhaseAngle, phase); gl.uniform1f(u.uExpo, s.expo); gl.uniform1f(u.uStars, night ? 0.004 : 0);
      gl.uniform1f(u.uGX, s.glass.x ?? 0); gl.uniform1f(u.uGZ, s.glass.z); gl.uniform1f(u.uGH, s.glass.cap); gl.uniform1f(u.uGT, s.glass.thick); gl.uniform1f(u.uGR, Math.min(0.35, s.glass.thick * 0.3));
      gl.uniform1f(u.uGBase, glyphMeta.baseV); gl.uniform1f(u.uGCap, glyphMeta.capV); gl.uniform1f(u.uHasGlyph, glyphNow ? 1 : 0); gl.uniform1f(u.uFoam, Math.min(1, 3.84e-6 * Math.pow(s.wind, 3.41) * 100));
    });
    gl.disable(gl.BLEND);
    draw(P.post, null, (u) => { bind(0, hdr.t, u.uImg); gl.uniform1f(u.uFrame, (t * 60) % 97); gl.uniform1f(u.uNight, s.night); });
  }

  let running = false, last = 0, visible = true;
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts; clock += dt;
    const dpr = Math.min(devicePixelRatio || 1, dprCap), r = canvas.getBoundingClientRect(), w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    size(w, h); frame({ t: clock });
    if (visible) requestAnimationFrame(loop);
  }
  const api = {
    spaces: Object.keys(SPACES),
    go(id, ms = 2600) { if (!SPACES[id]) return; word = progress() < 0.5 ? word : to.word; from = state(); to = SPACES[id]; t0 = performance.now(); dur = reduced ? 1 : ms; if (reduced) api.still(); },
    start() { if (reduced) return api.still(); running = true; last = performance.now(); requestAnimationFrame(loop); },
    stop() { running = false; },
    setVisible(v) { visible = v; if (v && running) { last = performance.now(); requestAnimationFrame(loop); } },
    // one settled still: n jittered frames averaged at a fixed time (subpixel antialiasing for the glass edges)
    still({ n = 16, w = canvas.width, h = canvas.height, t = 7.0 } = {}) {
      canvas.width = w; canvas.height = h; size(w, h); t0 = 0;
      for (let i = 0; i < n; i++) frame({ t, jitter: [((i * 0.618034) % 1) - 0.5, ((i * 0.754878) % 1) - 0.5], blendWeight: 1 / (i + 1) });
    },
  };
  return api;
}
