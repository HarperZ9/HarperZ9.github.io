// hero.js: the arrival's name in glass over water, rendered live from measured optics. N-BK7's n(lambda) bends each
// wavelength bin by its own amount, water's k(lambda) absorbs (alpha = 4 pi k / lambda), the lamp is a spectral
// source (high-pressure sodium at night, a low sun by day, a 2700 K filament with ?lamp=filament), and the frame is
// graded through bloom, red-first halation and the film print curve (post.js).
//   Plain view or no WebGL2          the rendered loop's poster, as before
//   reduced motion                   one still frame, redrawn only when the lamp or the size changes
//   slow device                      a measured ladder: render scale, then 8 to 3 wavelength bins, then a still
// window.__hero reports the tier, the bins, the measured frame time and the ladder's steps.
import { SPECTRA } from "./spectra.js";
import { sceneFS } from "./scene.js";
import { VS, SIM, BRIGHT, BLUR, COMPOSITE } from "./post.js";
import { buildGlyphs } from "./glyphs.js";
import { program, quad, target, texture, gpuTimer } from "./gl.js";

const root = document.documentElement, fig = document.querySelector(".arrival-art"), video = fig?.querySelector("video");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const plain = () => root.classList.contains("plain");
const isDark = () => { const t = root.dataset.theme; return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
const TIERS = [{ scale: 2, N: 8 }, { scale: 1.5, N: 8 }, { scale: 1, N: 8 }, { scale: 1.5, N: 3 }, { scale: 1, N: 3 }, { scale: 0.6, N: 3 }];
const CAM = { h: 1.0, zg: 12, f: 1.6, s0: 0.42 }, SIMN = 256;
const stat = (window.__hero = { state: "boot", tier: null, N: null, scale: null, frameMs: null, gpuMs: null, ladder: [] });

function fallback(why) {
  stat.state = "poster: " + why; fig?.classList.remove("gl-on");
  if (video && innerWidth > 860 && video.dataset.heroPoster) video.poster = video.dataset.heroPoster;
  if (video && !reduced() && !plain() && why === "no-gl") video.play().catch(() => {});
}

function lightsFor(N, dark) {
  const L = SPECTRA.layouts[N], q = new URLSearchParams(location.search).get("lamp");
  const lamp = dark ? (q === "filament" ? "filament" : "sodium") : (q === "filament" ? "filament" : "sun");
  const norm = (a) => { const Y = a.reduce((s, v, i) => s + v * L.W[i][1], 0); return a.map((v) => v / Y); };
  const rayleigh = (S) => norm(S.map((v, i) => v * (L.lambda[i] / 550) ** -4));
  const zen = dark ? rayleigh(L.S.moon).map((v) => v * 0.05) : rayleigh(L.S.daylight);
  const hor = dark ? L.S.sodium.map((v) => v * 0.16) : L.S.sun;
  return { lamp, L, SL: L.S[lamp], SZ: zen, SH: hor, M: SPECTRA.lights[lamp].to_srgb,
    size: dark ? [0.006, 700, 5, 0.86] : [0.007, 700, 12, 0.8], exposure: dark ? 1.25 : 0.8,
    fill: dark ? [-0.45, 0.55, -0.7, 2.5] : [-0.45, 0.6, -0.66, 1.2] };
}

async function boot() {
  if (!fig || plain()) return fallback("plain");
  const canvas = document.createElement("canvas"); canvas.className = "hero-physical"; canvas.setAttribute("aria-hidden", "true"); canvas.dataset.art = "";
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: "high-performance" });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return fallback("no-gl");
  gl.getExtension("OES_texture_float_linear");
  fig.prepend(canvas);
  const draw = quad(gl), timer = gpuTimer(gl), progs = {};
  let P, tierIdx = (matchMedia("(pointer: coarse)").matches || innerWidth <= 860) ? 3 : 1;
  if (root.classList.contains("weak")) tierIdx = 4;
  const sceneProg = (N) => (progs[N] ||= program(gl, VS, sceneFS(N)));
  const sim = program(gl, VS, SIM), bright = program(gl, VS, BRIGHT), blur = program(gl, VS, BLUR), comp = program(gl, VS, COMPOSITE);
  const simT = [0, 1].map(() => target(gl, SIMN, SIMN, { internal: gl.RG16F, format: gl.RG, wrap: gl.REPEAT }));
  let simI = 0, glyphTex = null, glyph = null, targets = null, light = null, lampDir = [0, 0, 1], cw = 0, ch = 0;
  const face = getComputedStyle(document.getElementById("h-name")).fontFamily || "sans-serif";
  await document.fonts?.ready;

  function layout() {
    const r = fig.getBoundingClientRect(), narrow = innerWidth <= 860;
    const k = narrow ? 0.75 : 0.5625; cw = Math.round(Math.min(r.width, 1280, innerHeight * 0.86 / k)); ch = Math.round(cw * k);
    canvas.style.width = cw + "px"; canvas.style.height = ch + "px";
    const gw = narrow ? 768 : 1280, gh = Math.round(gw * ch / cw), waterUV = CAM.s0 - CAM.h * CAM.f / CAM.zg;
    glyph = buildGlyphs({ w: gw, h: gh, face, lines: ["Zain Dana", "Harper"], waterUV });
    if (glyphTex) gl.deleteTexture(glyphTex);
    glyphTex = texture(gl, gw, gh, { internal: gl.RG16F, format: gl.RG, data: glyph.data });
    glyph.texel = [1 / gw, 1 / gh];
    const ly = CAM.s0 + 0.018, d = [(glyph.lampX - 0.5) * (cw / ch), ly - CAM.s0, CAM.f], n = Math.hypot(...d); lampDir = d.map((v) => v / n);
    resize();
  }
  function resize() {
    const t = TIERS[tierIdx], s = Math.min(t.scale, devicePixelRatio || 1);
    const w = Math.min(2560, Math.round(cw * s)), h = Math.round(w * ch / cw);
    targets?.forEach((x) => x.free());
    targets = [target(gl, w, h), target(gl, w >> 2, h >> 2), target(gl, w >> 2, h >> 2), target(gl, w >> 4, h >> 4), target(gl, w >> 4, h >> 4)];
    canvas.width = w; canvas.height = h; P = sceneProg(t.N); light = lightsFor(t.N, isDark());
    Object.assign(stat, { tier: tierIdx, N: t.N, scale: s, size: [w, h], lamp: light.lamp });
  }
  function pass(pr, tgt, setup) { gl.useProgram(pr.p); gl.bindFramebuffer(gl.FRAMEBUFFER, tgt ? tgt.fb : null); gl.viewport(0, 0, tgt ? tgt.w : canvas.width, tgt ? tgt.h : canvas.height); setup(pr.u); draw(); }
  const bind = (u, name, tex, unit) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u(name), unit); };
  let drop = null;
  function stepSim(n) {
    for (let k = 0; k < n; k++) {
      const src = simT[simI], dst = simT[1 - simI], d = k === 0 ? drop : null;
      pass(sim, dst, (u) => { bind(u, "uPrev", src.tex, 0); gl.uniform2f(u("uTexel"), 1 / SIMN, 1 / SIMN); gl.uniform4f(u("uDrop"), d ? d[0] : 0, d ? d[1] : 0, d ? d[2] : 0.01, d ? d[3] : 0); });
      simI = 1 - simI;
    }
    drop = null;
  }
  function frame(t, fade = 1) {
    const q = timer?.begin(), [hdr, b1, b1b, b2, b2b] = targets, N = TIERS[tierIdx].N, Lt = light;
    pass(P, hdr, (u) => {
      gl.uniform2f(u("uRes"), hdr.w, hdr.h); gl.uniform1f(u("uTime"), t); gl.uniform1f(u("uAspect"), cw / ch); gl.uniform1f(u("uExposure"), Lt.exposure);
      bind(u, "uGlyph", glyphTex, 0); bind(u, "uSim", simT[simI].tex, 1); gl.uniform2fv(u("uGlyphTexel"), glyph.texel); gl.uniform1f(u("uRod"), glyph.rod);
      gl.uniform4f(u("uCam"), CAM.h, CAM.zg, CAM.f, CAM.s0); gl.uniform3fv(u("uLampDir"), lampDir); gl.uniform4fv(u("uLampSize"), Lt.size); { const f = Lt.fill, n = Math.hypot(f[0], f[1], f[2]); gl.uniform4f(u("uFill"), f[0] / n, f[1] / n, f[2] / n, f[3]); }
      for (const [n, a] of [["uLam", Lt.L.lambda], ["uNg", Lt.L.n_bk7], ["uNw", Lt.L.n_water], ["uAw", Lt.L.alpha_water], ["uAg", Lt.L.alpha_bk7], ["uSL", Lt.SL], ["uSZ", Lt.SZ], ["uSH", Lt.SH]]) gl.uniform1fv(u(n + "[0]"), a);
      gl.uniform3fv(u("uW[0]"), Lt.L.W.flat()); gl.uniformMatrix3fv(u("uToRGB"), true, Lt.M.flat());
      gl.uniform4f(u("uWave"), 24, 0.9, 0.012, 0.32); gl.uniform1f(u("uNight"), isDark() ? 1 : 0);
    });
    pass(bright, b1, (u) => { bind(u, "uSrc", hdr.tex, 0); gl.uniform2f(u("uTexel"), 1 / hdr.w, 1 / hdr.h); gl.uniform1f(u("uKnee"), 0.5); gl.uniform1f(u("uThresh"), 0.9); });
    pass(blur, b1b, (u) => { bind(u, "uSrc", b1.tex, 0); gl.uniform2f(u("uDir"), 1.5 / b1.w, 0); });
    pass(blur, b1, (u) => { bind(u, "uSrc", b1b.tex, 0); gl.uniform2f(u("uDir"), 0, 1.5 / b1.h); });
    pass(blur, b2, (u) => { bind(u, "uSrc", b1.tex, 0); gl.uniform2f(u("uDir"), 2 / b2.w, 0); });
    pass(blur, b2b, (u) => { bind(u, "uSrc", b2.tex, 0); gl.uniform2f(u("uDir"), 0, 2 / b2.h); });
    pass(comp, null, (u) => { bind(u, "uHdr", hdr.tex, 0); bind(u, "uB1", b1.tex, 1); bind(u, "uB2", b2b.tex, 2);
      gl.uniform1f(u("uBloom"), isDark() ? 0.16 : 0.2); gl.uniform1f(u("uHalation"), N === 8 ? 0.35 : 0.25); gl.uniform1f(u("uTime"), t); gl.uniform1f(u("uFade"), fade); });
    timer?.end(q); stat.gpuMs = timer?.poll() ?? null; stat.firstFrameMs ??= Math.round(performance.now());
  }
  // pointer and rain: a drop where the ray from the eye meets the sea
  function dropAt(u, v, strength) {
    const d = [(u - 0.5) * (cw / ch), v - CAM.s0, CAM.f]; if (d[1] >= -1e-3) return;
    const t = CAM.h / -d[1], x = d[0] * t, z = d[2] * t; drop = [x / 24 + 0.5, (z / 24) % 1, 0.006, strength];
  }
  let lastMove = 0;
  fig.parentElement.addEventListener("pointermove", (e) => {
    const now = performance.now(); if (now - lastMove < 40 || reduced()) return; lastMove = now;
    const r = canvas.getBoundingClientRect(); dropAt((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, -0.05);
  }, { passive: true });
  layout();
  for (let k = 0; k < 14; k++) { dropAt(0.2 + 0.6 * ((k * 0.618) % 1), 0.05 + 0.25 * ((k * 0.381) % 1), -0.08); stepSim(9); }
  fig.classList.add("gl-on"); video?.pause();
  let visible = true, running = false, t0 = performance.now(), last = 0, times = [], gpu = [], warm = 0, nextRain = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }, { threshold: 0.01 }).observe(canvas);
  const still = () => { stepSim(2); frame(2.0); stat.state = reduced() ? "still: reduced motion" : stat.state; };
  function tick(now) {
    running = false;
    if (!visible || document.hidden || plain()) return;
    if (reduced()) { still(); return; }
    const t = (now - t0) / 1000;
    if (t > nextRain) { nextRain = t + 0.35 + Math.random() * 0.6; dropAt(0.1 + 0.8 * Math.random(), 0.02 + 0.3 * Math.random(), -0.03 - 0.04 * Math.random()); }
    stepSim(2); frame(t, Math.min(1, t * 2));
    if (last) { const dt = now - last; if (++warm > 20) { times.push(dt); if (stat.gpuMs != null) gpu.push(stat.gpuMs); } }
    last = now;
    if (times.length >= 60) ladder();
    running = true; requestAnimationFrame(tick);
  }
  function ladder() {
    const mid = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
    const med = mid(times), g = mid(gpu); times = []; gpu = [];
    stat.frameMs = +med.toFixed(2); stat.fps = +(1000 / med).toFixed(1); stat.gpuMedianMs = +g.toFixed(3);
    if (med > 18.5 || g > 12) {   // rAF time, or GPU time where the timer query exists (rAF alone misses a queued GPU)
      stat.ladder.push({ from: tierIdx, frameMs: stat.frameMs, gpuMs: stat.gpuMedianMs });
      if (tierIdx + 1 < TIERS.length) { tierIdx++; resize(); warm = 0; last = 0; }
      else { stat.state = "still: slow device"; frame(2.0); visible = false; return; }
    }
    stat.state = "live";
  }
  function start() { if (!running && !plain()) { running = true; last = 0; requestAnimationFrame(tick); } }
  const relight = () => { light = lightsFor(TIERS[tierIdx].N, isDark()); stat.lamp = light.lamp; if (reduced() || !running) still(); };
  new MutationObserver(() => { if (plain()) { fig.classList.remove("gl-on"); return; } fig.classList.add("gl-on"); relight(); start(); })
    .observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", relight);
  addEventListener("resize", () => { layout(); if (reduced()) still(); });
  stat.state = "live"; reduced() ? still() : start();
}
boot().catch((e) => { console.error("hero: physical render failed, the poster stays", e); fallback("error"); });
