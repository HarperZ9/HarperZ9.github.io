// field.js: the glass-and-water field, live in WebGL2. A space is a set of parameters (light, camera, wind, the
// word in the glass); moving between spaces eases them all along one path. createField renders live frames, or
// accumulates jittered frames into one still (renderStill) for the 4K plates the reduced-motion tier shows.
import { TRANS_FRAG, MS_FRAG, SKY_FRAG } from "./atmosphere.glsl.js";
import { WAVE_FRAG, SCENE_FRAG, POST_FRAG, VERT } from "./scene.glsl.js";
import { cascadeWaves, glyphField, sellmeier, N_BK7, swellWaves, swellHeight } from "./ocean.js";
import { effectiveFetch } from "../sky/weather.mjs";

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
for (const sp of Object.values(SPACES)) { sp.night = sp.moon ? 1 : 0; sp.phase = sp.moon?.phase ?? 0; sp.lightScale = 1; }
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
// weather the scene draws (sky.js): cloud cover, storm darkness, rain rate (mm/h), a rainbow's and a halo's strength
const WX = ["cloud", "storm", "rain", "rainbow", "halo", "haze"];
const lerp = (a, b, k) => a + (b - a) * k, ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function mixSpace(a, b, k) {
  const m = (x, y) => (typeof x === "number" ? lerp(x, y, k) : Object.fromEntries(Object.keys(x).map((key) => [key, m(x[key], y[key] ?? x[key])])));
  return { light: m(a.light, b.light), cam: m(a.cam, b.cam), glass: m(a.glass, b.glass), wind: lerp(a.wind, b.wind, k), expo: lerp(a.expo, b.expo, k), night: lerp(a.night, b.night, k), phase: lerp(a.phase, b.phase, k), lightScale: lerp(a.lightScale ?? 1, b.lightScale ?? 1, k),
    windAngle: lerp(a.windAngle ?? 0.35, b.windAngle ?? 0.35, k), wx: Object.fromEntries(WX.map((key) => [key, lerp(a.wx?.[key] ?? 0, b.wx?.[key] ?? 0, k)])) };
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
  let windNow = -1, angleNow = 0.35, swell = { waves: new Float32Array(32), Q: 0 }, hmax = 0, sigma = 0, breakH = 1e9, windDir = [1, 0];
  // the standard normal quantile (Acklam's rational approximation, relative error below 1.2e-9)
  function probit(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const q = Math.min(p, 1 - p), r = Math.sqrt(-2 * Math.log(q));
    const x = p < 0.02425 || p > 0.97575 ? (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1) : (() => { const t = p - 0.5, u = t * t; return (((((a[0] * u + a[1]) * u + a[2]) * u + a[3]) * u + a[4]) * u + a[5]) * t / (((((b[0] * u + b[1]) * u + b[2]) * u + b[3]) * u + b[4]) * u + 1); })();
    return p > 0.97575 ? -x : x;
  }
  // the sea for a wind: U10 in m/s and the direction the waves run, radians from east toward north; open
  // ocean fetch, capped where the sea is fully developed (sky/weather.mjs)
  let nearNow = false;
  function setWind(U10, angle = 0.35, near = false) {
    if (Math.abs(U10 - windNow) < 0.05 && Math.abs(angle - angleNow) < 0.02 && near === nearNow) return; windNow = U10; angleNow = angle; nearNow = near;
    // the long waves near the peak are raised geometry (the swell); the cascades carry the shorter waves as slope
    swell = swellWaves({ U10, fetch: effectiveFetch(U10), windAngle: angle, storm: near });
    hmax = 0; for (let i = 0; i < 8; i++) hmax += swell.waves[i * 4 + 2];
    hmax *= 1.05;
    // the swell's height distribution (Gaussian, sigma = sqrt(sum a^2 / 2)) and the whitecap coverage the wind gives
    // (Monahan and O'Muircheartaigh 1980); the crests above the (1 - W) quantile break
    let m0 = 0; for (let i = 0; i < 8; i++) m0 += swell.waves[i * 4 + 2] ** 2 / 2;
    sigma = Math.sqrt(m0); const W = Math.min(0.3, 3.84e-6 * Math.pow(U10, 3.41));
    breakH = sigma * probit(1 - Math.max(W, 1e-4)); windDir = [Math.cos(angle), Math.sin(angle)];
    CASCADES.forEach((c, i) => { const w = cascadeWaves({ ...c, kmin: i === 0 ? Math.min(Math.max(c.kmin, 2.5 * swell.kp), 0.9 * c.kmax) : c.kmin, n: 96, U10, fetch: effectiveFetch(U10), windAngle: angle, seed: 11 + i * 7 });
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
  function frame({ t = clock, jitter = [0, 0], blendWeight = 1, seq = 0 } = {}) {
    const s = state();
    // the word re-forms halfway along the path, while the camera is between framings
    setWind(s.wind, s.windAngle, !!to.near); setWord(progress() < 0.5 ? word : to.word); if (progress() >= 1) word = to.word;
    const night = s.night > 0.5, el = s.light.el * D, az = s.light.az * D;
    // the eye rides the swell, as from a boat's deck: it rises and falls with the water under it, never below it
    const bob = hmax > 0.01 ? swellHeight(swell, 0, 0, t) : 0, camY = to.near ? bob + s.cam.h : Math.max(s.cam.h + 0.9 * bob, bob + 0.9);
    // in the near field the deck pitches and rolls with the water's slope under it (damped to 60 percent, as a hull
    // averages the surface over its length)
    let dPitch = 0, roll = 0;
    if (to.near && hmax > 0.01) {
      const yw = s.cam.yaw * D, fx = Math.sin(yw), fz = Math.cos(yw), e = 3;
      const along = (swellHeight(swell, fx * e, fz * e, t) - swellHeight(swell, -fx * e, -fz * e, t)) / (2 * e);
      const across = (swellHeight(swell, fz * e, -fx * e, t) - swellHeight(swell, -fz * e, fx * e, t)) / (2 * e);
      dPitch = Math.atan(along) * 0.6 / D; roll = Math.atan(across) * 0.6;
    }
    const ladder = to.quality ?? 1;
    const L = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    // the light is normalised to unit illuminance; night differs by exposure and by the eye's blue shift (post)
    // moonlight is set to 1/60 of the day light so night reads as night; the Moon's true illuminance is near 2.5e-6 of
    // the Sun's (0.25 lx against 1e5 lx), which the display could only show black, so this keeps night visible
    const lightCol = lerp(1, 1 / 60, s.night) * (s.lightScale ?? 1), phase = s.phase * D;
    CASCADES.forEach((c, i) => draw(P.wave, T.waves[i], (u) => { bind(0, waveTex[i], u.uWaves); gl.uniform1i(u.uN, 96); gl.uniform1f(u.uTile, c.tile); gl.uniform1f(u.uT, t); gl.uniform1f(u.uChop, 1.1 + 0.6 * Math.min(1, Math.max(0, (s.wind - 6) / 14))); }));
    for (const w of T.waves) { gl.bindTexture(gl.TEXTURE_2D, w.t); gl.generateMipmap(gl.TEXTURE_2D); }
    draw(P.sky, T.sky, (u) => { bind(0, T.trans.t, u.uTrans); bind(1, T.ms.t, u.uMS); gl.uniform3fv(u.uL, L); gl.uniform1f(u.uViewH, Math.max(0.0005, s.cam.h / 1000)); });
    gl.enable(gl.BLEND); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA); gl.blendColor(0, 0, 0, blendWeight);
    draw(P.scene, hdr, (u) => {
      bind(0, T.trans.t, u.uTrans); bind(1, T.sky.t, u.uSky); T.waves.forEach((w, i) => bind(2 + i, w.t, u[`uW${i}`])); bind(5, glyphTex, u.uGlyph);
      gl.uniform2f(u.uRes, hdr.w, hdr.h); gl.uniform2fv(u.uJitter, jitter); gl.uniform1f(u.uSeq, seq); gl.uniform3fv(u.uL, L); gl.uniform3f(u.uCam, 0, camY, 0);
      gl.uniform3fv(u.uIor, IOR); gl.uniform3fv(u.uAbs, ABS); gl.uniform3f(u.uLightCol, lightCol, lightCol, lightCol); gl.uniform3f(u.uTiles, ...CASCADES.map((c) => c.tile));
      gl.uniform1f(u.uPitch, (s.cam.pitch + dPitch) * D); gl.uniform1f(u.uRoll, roll); gl.uniform1f(u.uYaw, s.cam.yaw * D); gl.uniform1f(u.uFocal, s.cam.focal); gl.uniform1f(u.uT, t);
      gl.uniform1f(u.uMoon, night ? 1 : 0); gl.uniform1f(u.uMoonPhaseAngle, phase); gl.uniform1f(u.uExpo, s.expo); gl.uniform1f(u.uStars, night ? 0.004 : 0);
      // a real sky turns its stars with sidereal time (latitude, local sidereal time, radians); x > 9 keeps them fixed
      // weather: clouds marched only when there are clouds and the device can afford it (quality ladder, sky.js)
      gl.uniform1f(u.uCloud, s.wx.cloud); gl.uniform1f(u.uStorm, s.wx.storm); gl.uniform1f(u.uRain, s.wx.rain); gl.uniform1f(u.uRainbow, s.wx.rainbow); gl.uniform1f(u.uHalo, s.wx.halo); gl.uniform1f(u.uHaze, s.wx.haze);
      gl.uniform1f(u.uFlash, flash); gl.uniform1i(u.uCloudSteps, s.wx.cloud > 0.01 ? (to.cloudSteps ?? 24) : 0);
      gl.uniform4fv(u.uSwell, swell.waves); gl.uniform1f(u.uSwellQ, swell.Q); gl.uniform1f(u.uHmax, hmax); gl.uniform1f(u.uBreakH, breakH); gl.uniform1f(u.uSig, sigma); gl.uniform2fv(u.uWindDir, windDir); gl.uniform1f(u.uDrift, 0.03 * s.wind); gl.uniform1i(u.uSprayN, s.wind > 12 ? (ladder > 0.5 ? 20 : 6) : 0);
      gl.uniform3fv(u.uBolt, bolt);
      gl.uniform1f(u.uSpray, Math.min(1, Math.max(0, (s.wind - 12) / 10))); gl.uniform1i(u.uMarch, ladder > 0.5 ? 72 : 28);
      gl.uniform2f(u.uSid, to.sid ? to.sid.lat * D : 10, to.sid ? to.sid.lst * D : 0);
      gl.uniform1f(u.uGX, s.glass.x ?? 0); gl.uniform1f(u.uGZ, s.glass.z); gl.uniform1f(u.uGH, s.glass.cap); gl.uniform1f(u.uGT, s.glass.thick); gl.uniform1f(u.uGR, Math.min(0.35, s.glass.thick * 0.3));
      gl.uniform1f(u.uGBase, glyphMeta.baseV); gl.uniform1f(u.uGCap, glyphMeta.capV); gl.uniform1f(u.uHasGlyph, glyphNow ? 1 : 0); gl.uniform1f(u.uFoam, Math.min(1, 3.84e-6 * Math.pow(s.wind, 3.41) * 100));
    });
    gl.disable(gl.BLEND);
    // where the light falls on the screen (the inverse of the scene's ray()), for rays and ghosts
    const cp = Math.cos((s.cam.pitch + dPitch) * D), spt = Math.sin(s.cam.pitch * D), cy = Math.cos(s.cam.yaw * D), sy = Math.sin(s.cam.yaw * D);
    const f = [sy * cp, spt, cy * cp], rt = [cy, 0, -sy], up = [-sy * spt, cp, -cy * spt], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const asp = canvas.width / canvas.height, zf = dot(L, f), sc = Math.max(1, 1.25 / asp) / s.cam.focal;
    const sun = zf > 0.05 ? [0.5 + dot(L, rt) / zf / (asp * sc), 0.5 + dot(L, up) / zf / sc] : [-9, -9];
    const onScreen = zf > 0.05 && sun[0] > -0.1 && sun[0] < 1.1 && sun[1] > -0.1 && sun[1] < 1.1 && L[1] > -0.01;
    draw(P.post, null, (u) => { bind(0, hdr.t, u.uImg);
      gl.uniform2f(u.uSunUV, sun[0], sun[1]); gl.uniform1f(u.uSunOn, onScreen ? 1 : 0); gl.uniform1f(u.uQuality, ladder);
      // rays need broken cloud and a low light; ghosts a clear line to it; mist blooms in haze; night halates
      gl.uniform1f(u.uRays, night ? 0.3 * s.wx.cloud : Math.min(1, s.wx.cloud * 1.6) * (1 - s.wx.storm) * Math.max(0.3, 1 - s.light.el / 40));
      gl.uniform1f(u.uGhost, night ? 0.3 : (1 - s.wx.cloud) * 0.8); gl.uniform1f(u.uBloom, 0.12 + Math.min(1, s.wx.haze / 3)); gl.uniform1f(u.uHalation, night ? 1 : 0);
      gl.uniform1f(u.uRainP, s.wx.rain); gl.uniform1f(u.uTilt, -0.25 * Math.min(1, s.wind / 20)); gl.uniform1f(u.uFrame, (t * 60) % 97); gl.uniform1f(u.uSeq, seq); gl.uniform1f(u.uNight, s.night); gl.uniform1f(u.uLensRain, Math.min(1, Math.max(0, s.wx.rain - 3) / 8)); gl.uniform1f(u.uT, t); gl.uniform2f(u.uRes, canvas.width, canvas.height); });
  }

  // lightning: a flash the scene adds to its light for a few frames; sky.js fires it and schedules the thunder
  // a flash is three or four return strokes 40 to 80 ms apart, each falling off in a few tens of milliseconds (Uman,
  // "The Lightning Discharge", 1987); hold keeps one stroke lit, for a still
  let flash = 0, strokes = [], held = 0, bolt = [3, 0.5, 6];
  const flashAt = (now) => held || strokes.reduce((m, k) => (now >= k.t ? Math.max(m, k.s * Math.exp(-(now - k.t) / 45)) : m), 0);
  let running = false, last = 0, visible = true, tick = 0;
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts; clock += dt;
    const dpr = Math.min(devicePixelRatio || 1, dprCap), r = canvas.getBoundingClientRect(), w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    flash = flashAt(performance.now()); strokes = strokes.filter((k) => performance.now() - k.t < 400);
    size(w, h); frame({ t: clock, seq: (tick = (tick + 1) % 64) });
    if (visible) requestAnimationFrame(loop);
  }
  const api = {
    spaces: Object.keys(SPACES),
    // a sky that is not one of the named spaces (the visitor's real sky, sky.js): angles move along the short way
    sky(sp, ms = 2600) {
      const now = state(), wrap = (a, b) => b + Math.round((a - b) / 360) * 360;
      const next = { word: "", lightScale: 1, ...sp, cam: { ...sp.cam }, light: { ...sp.light }, glass: { x: 9, z: 30, cap: 3.6, thick: 1.3, ...(sp.glass || {}) } };
      next.cam.yaw = wrap(now.cam.yaw, next.cam.yaw); next.light.az = wrap(now.light.az, next.light.az); next.cam.focal ??= 1.35;
      word = progress() < 0.5 ? word : to.word; from = now; to = next; t0 = performance.now(); dur = reduced ? 1 : ms; if (reduced) api.still();
    },
    lightning(strength = 1, { hold = false } = {}) {
      const s0 = state();
      // where the stroke stands: 2 to 9 km off, inside the frame's half of the sky, in km from the eye
      const a = (s0.cam.yaw + (Math.random() - 0.5) * 24) * D, r = 1.5 + Math.random() * 3; bolt = [Math.sin(a) * r, 0.4, Math.cos(a) * r];
      if (hold) { held = strength; return; }
      const t0 = performance.now(), n = 3 + Math.floor(Math.random() * 2);
      for (let i = 0, t = t0; i < n; i++, t += 40 + Math.random() * 40) strokes.push({ t, s: strength * (i ? 0.6 + 0.4 * Math.random() : 1) });
    },
    go(id, ms = 2600) { if (!SPACES[id]) return; word = progress() < 0.5 ? word : to.word; from = state(); to = SPACES[id]; t0 = performance.now(); dur = reduced ? 1 : ms; if (reduced) api.still(); },
    start() { if (reduced) return api.still(); running = true; last = performance.now(); requestAnimationFrame(loop); },
    stop() { running = false; },
    setVisible(v) { visible = v; if (v && running) { last = performance.now(); requestAnimationFrame(loop); } },
    // one settled still: n jittered frames averaged at a fixed time (subpixel antialiasing for the glass edges)
    still({ n = 16, w = canvas.width, h = canvas.height, t = 7.0 } = {}) {
      canvas.width = w; canvas.height = h; size(w, h); t0 = 0;
      for (let i = 0; i < n; i++) frame({ t, jitter: [((i * 0.618034) % 1) - 0.5, ((i * 0.754878) % 1) - 0.5], blendWeight: 1 / (i + 1), seq: i });
    },
  };
  return api;
}
