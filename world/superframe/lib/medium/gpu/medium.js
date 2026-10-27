// lib/medium/gpu/medium.js: the medium's top view, on the GPU. Adopted on 2026-10-26 from the UI agent's
// ui/directions/common/flow/medium.js (with shaders.js and display.js), as the lead decided: one
// engine, two views. lib/medium keeps its CPU side view (the tank); this is the top-down field behind the same
// add(kind, where, amount, props) (FLOW.md section 12). Callers import it from here, or as topView from lib/medium.
// The UI agent's original header follows.
// medium.js: a thin local stand-in for the superframe's fluid medium, with the same interface it will expose:
//   const m = createMedium(canvas, opts); m.add(kind, {x, y, r, amount, vx, vy, aspect}); m.region(rects);
//   m.view({ mosaic, layers }); m.shift(dy); m.stats; m.destroy();
// Coordinates are viewport fractions, y down. Kinds: ink, warmth, current, sediment, ripple.
// Water and air: the field is a low-resolution stable-fluid grid (velocity, temperature, ink, sediment);
// anything added changes its properties locally. Under reduced motion it settles once and holds a still.
import { VERT, ADVECT, SPLAT, DIVERGENCE, JACOBI, GRADIENT } from "./shaders.js";
import { DISPLAY } from "./display.js";
import { ADVECT_SPEC, SPLAT_SPEC, bandMatrices, absorbS, isPigment } from "./pigment.js";
const BANDM = bandMatrices("D65");

// The laws' constants are the superframe's (lib/medium/sheets.mjs: DENSITY_W for ink over ink, fitted on Olivetti's
// overlaps; WEBER from Albers XX-1). They are read from there when the superframe is served beside this file; a page
// served alone (the site) keeps a copy of the same numbers, and stats.sheetRule says which. TRAP stays only as the
// law it replaced, for comparison.
const SHEET = { trap: 0.947, weber: 29.75, dw: 0.243, from: "copy" };
// Each layer of the ground declares its own law and weight (BLEED.md sections 9 and 11). Nothing composites them
// from above: each applies its law to the colour it finds. opts.layers overrides any entry.
export const LAYERS = Object.freeze({
  pourA: { law: "density_add", weight: 1, night: "negative" }, // printing ink over ink (sheets.mjs DENSITY_W)
  pourB: { law: "weber", weight: 1, night: "negative" },       // a transparent wash stacks
  tide: { law: "density_add", weight: 0.9, night: "negative" }, // dried pigment at the front
  sediment: { law: "weber", weight: 0.8, night: "negative" },  // reading's marks, laid in strata
  light: { law: "screen", weight: 1, night: "positive" },      // caustics and the highlight
  grid: { law: "refraction", weight: 1, night: "positive" },   // the page's rules, bent by the water
});
const LAW_ID = { trap: 0, weber: 1, add: 2, multiply: 3, refraction: 3, density_add: 4, screen: 5 };
// inside lib/medium the sheet constants come from their own module, always (no copy can drift)
import { DENSITY_W, WEBER } from "../sheets.mjs";
SHEET.dw = DENSITY_W; SHEET.weber = WEBER; SHEET.from = "superframe";

const KIND = { ink: 0, warmth: 1, current: 2, sediment: 3, ripple: 4, wash: 5, pigment: 6 };
const STEP = 1 / 60, JACOBI_ITERS = 12, IDLE_MS = 14000;

function compile(gl, src, type) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("medium shader: " + gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fsSrc) {
  const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, compile(gl, fsSrc, gl.FRAGMENT_SHADER));
  gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("medium link: " + gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ""); u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}
function target(gl, w, h, full = false) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, full ? gl.RGBA32F : gl.RGBA16F, w, h, 0, gl.RGBA, full ? gl.FLOAT : gl.HALF_FLOAT, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f, w, h };
}
const pair = (gl, w, h, full = false) => { const a = target(gl, w, h, full), b = target(gl, w, h, full); return { r: a, w: b, swap() { [this.r, this.w] = [this.w, this.r]; } }; };
const rgb = (css) => { const m = css.match(/[\d.]+/g); return m ? m.slice(0, 3).map((x) => x / 255) : [0.9, 0.88, 0.84]; };
const rgba = (css) => { const m = css.match(/[\d.]+/g); return m ? [...m.slice(0, 3).map((x) => x / 255), m.length > 3 ? +m[3] : 1] : [1, 1, 1, 0]; };

export function createMedium(canvas, opts = {}) {
  // opts.element: the medium fills its own canvas box (a demo well) instead of the viewport
  const VW = () => (opts.element ? canvas.clientWidth || 1 : innerWidth), VH = () => (opts.element ? canvas.clientHeight || 1 : innerHeight);
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return null;
  const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  // pigment is held in 32-bit floats where they can be filtered: half floats lose small changes on every step,
  // and the soak's pigment leaked away (measured 2026-10-26). Without the extension the dye stays half float.
  const fullDye = !!gl.getExtension("OES_texture_float_linear");
  const still = opts.reducedMotion ?? matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vs = compile(gl, VERT, gl.VERTEX_SHADER);
  const P = { adv: program(gl, vs, ADVECT), splat: program(gl, vs, SPLAT), div: program(gl, vs, DIVERGENCE),
    jac: program(gl, vs, JACOBI), grad: program(gl, vs, GRADIENT), show: program(gl, vs, DISPLAY),
    advS: program(gl, vs, ADVECT_SPEC), splS: program(gl, vs, SPLAT_SPEC) };
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  let sim, vel, dye, div, pr, spec = [], specOn = 0, W = 0, H = 0;
  const queue = [], st = { dyeFloat: fullDye ? 32 : 16, get sheetRule() { return SHEET.from; }, get layers() { return layers; }, frames: 0, gpuMs: [], cpuMs: [], gaps: [], running: false, mode: 0, cells: 0 };
  let rects = [], clears = [], lamps = [], lampC = [1, 1, 1, 0], grids = [], gridC = [0, 0, 0, 0], t0 = performance.now(), baseVisc = opts.viscosity ?? 0.9, shiftPx = 0, wall = [0.9, 0.88, 0.84], ink = [0.1, 0.1, 0.1], dark = 0;
  let rinseUntil = 0, rinseRate = 0;
  const layers = { ...LAYERS, ...(opts.layers || {}) };
  const lawArray = () => new Float32Array(["pourA", "pourB", "tide", "sediment", "light", "grid"].flatMap((k) => { const l = layers[k]; return [LAW_ID[l.law] ?? 3, l.weight, l.night === "negative" ? 1 : 0, 0]; }));
  let quality = 1; // drops only if the GPU timer shows the 4 ms budget broken (see budget())
  let raf = 0, last = 0, acc = 0, lastAdd = performance.now(), dead = false, query = null, mode = 0, cells = 0;

  function size() {
    // backing store at the device ratio, capped at 2.5x (QUALITY-SPEC R1). Measured 2026-10-25 at 1440 x 900 x 2:
    // see FLOW-SITE.md for the frame times. The simulation grid stays 176 cells on its long side on any screen.
    const cw = VW(), ch = VH(), scale = Math.min(devicePixelRatio || 1, 2.5) * quality;
    W = Math.max(2, Math.round(cw * scale)); H = Math.max(2, Math.round(ch * scale));
    canvas.width = W; canvas.height = H;
    const long = 176, sw = cw >= ch ? long : Math.round(long * cw / ch), sh = cw >= ch ? Math.round(long * ch / cw) : long;
    sim = [sw, sh]; vel = pair(gl, sw, sh); dye = pair(gl, sw * 2, sh * 2, fullDye); div = target(gl, sw, sh); pr = pair(gl, sw, sh);
    spec = [0, 1, 2, 3].map(() => pair(gl, sw * 2, sh * 2, fullDye));   // the coloured pours' 16 bands, four per texture
    for (const t of [vel.r, vel.w, dye.r, dye.w, div, pr.r, pr.w, ...spec.flatMap((q) => [q.r, q.w])]) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }
  function tokens() {
    const cs = getComputedStyle(document.documentElement);
    const probe = (v) => { const e = document.createElement("i"); e.style.color = `var(${v})`; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; };
    wall = rgb(probe("--wall")); ink = rgb(probe("--ink")); lampC = rgba(probe("--lamp")); gridC = rgba(probe("--grid-col")); dark = (wall[0] + wall[1] + wall[2]) / 3 < 0.5 ? 1 : 0;
    void cs;
  }
  const tex = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.t); return unit; };
  function pass(prog, out, set) { gl.useProgram(prog.p); set(prog.u); gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.f : null); gl.viewport(0, 0, out ? out.w : W, out ? out.h : H); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  function splats() {
    if (!queue.length) return;
    const batch = queue.splice(0, 16), Pp = new Float32Array(64), Vv = new Float32Array(64);
    batch.forEach((s, i) => { Pp.set([s.x, 1 - s.y, s.r, KIND[s.kind]], i * 4); Vv.set([s.vx || 0, -(s.vy || 0), s.amount ?? 0.5, s.aspect || 1], i * 4); });
    for (const [fld, tgt] of [[vel, 0], [dye, 1]]) {
      pass(P.splat, fld.w, (u) => { gl.uniform1i(u.uSrc, tex(0, fld.r)); gl.uniform1i(u.uN, batch.length); gl.uniform1i(u.uTarget, tgt);
        gl.uniform4fv(u.uP, Pp); gl.uniform4fv(u.uV, Vv); gl.uniform1f(u.uAspect, VW() / VH()); }); fld.swap();
    }
    if (!batch.some((s) => s.kind === "pigment")) return;
    specOn = 1;
    for (let g = 0; g < 4; g++) {   // each band group takes its four absorbances from every pigment splat
      const Ss = new Float32Array(64); batch.forEach((s, i) => { if (s.abs) Ss.set(s.abs.subarray(4 * g, 4 * g + 4), i * 4); });
      pass(P.splS, spec[g].w, (u) => { gl.uniform1i(u.uSrc, tex(0, spec[g].r)); gl.uniform1i(u.uN, batch.length);
        gl.uniform4fv(u.uP, Pp); gl.uniform4fv(u.uV, Vv); gl.uniform4fv(u.uS, Ss); gl.uniform1f(u.uAspect, VW() / VH()); }); spec[g].swap();
    }
  }
  function step(dt) {
    splats();
    const texel = [1 / sim[0], 1 / sim[1]], shift = shiftPx / VH(); shiftPx = 0;
    const R = new Float32Array(24), V = new Float32Array(6);
    rects.slice(0, 6).forEach((r, i) => { R.set([r.x0, 1 - r.y1, r.x1, 1 - r.y0], i * 4); V[i] = r.viscosity; });
    const adv = (fld, isVel) => { pass(P.adv, fld.w, (u) => { gl.uniform1i(u.uVel, tex(0, vel.r)); gl.uniform1i(u.uSrc, tex(1, fld.r));
      gl.uniform2fv(u.uSimTexel, texel); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uRinse, rinseUntil > performance.now() ? rinseRate : 0); gl.uniform1f(u.uSpread, Math.exp(-(performance.now() - lastAdd) / 2500)); gl.uniform1f(u.uShift, shift); gl.uniform1i(u.uIsVel, isVel); // drying: capillary spread fades after the last pour
      gl.uniform4fv(u.uRect, R); gl.uniform1fv(u.uVisc, V); gl.uniform1i(u.uNR, Math.min(6, rects.length)); gl.uniform1f(u.uBaseVisc, baseVisc);
      const Hm = new Float32Array(16); lamps.slice(0, 4).forEach((l, i) => Hm.set([l.cx / VW(), 1 - l.cy / VH(), l.rx / VW(), l.ry / VH()], i * 4));
      gl.uniform4fv(u.uHeat, Hm); gl.uniform1i(u.uNH, Math.min(4, lamps.length)); gl.uniform1f(u.uHeatK, lampC[3] > 0 ? 0.35 : 0); }); };
    if (specOn) for (const q of spec) { pass(P.advS, q.w, (u) => { gl.uniform1i(u.uVel, tex(0, vel.r)); gl.uniform1i(u.uSrc, tex(1, q.r)); gl.uniform2fv(u.uSimTexel, texel);
      gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uRinse, rinseUntil > performance.now() ? rinseRate : 0); gl.uniform1f(u.uSpread, Math.exp(-(performance.now() - lastAdd) / 2500)); gl.uniform1f(u.uShift, shift); }); q.swap(); }
    adv(dye, 0); adv(vel, 1); dye.swap(); vel.swap();
    pass(P.div, div, (u) => { gl.uniform1i(u.uVel, tex(0, vel.r)); gl.uniform2fv(u.uSimTexel, texel); });
    // each step solves pressure from zero: a pressure left over from the last step kept pushing the water, so it
    // never calmed (measured 2026-10-26: 2% a second instead of the viscosity's 60%)
    gl.bindFramebuffer(gl.FRAMEBUFFER, pr.r.f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    for (let i = 0; i < JACOBI_ITERS; i++) { pass(P.jac, pr.w, (u) => { gl.uniform1i(u.uP, tex(0, pr.r)); gl.uniform1i(u.uDiv, tex(1, div)); gl.uniform2fv(u.uSimTexel, texel); }); pr.swap(); }
    pass(P.grad, vel.w, (u) => { gl.uniform1i(u.uP, tex(0, pr.r)); gl.uniform1i(u.uVel, tex(1, vel.r)); gl.uniform2fv(u.uSimTexel, texel); gl.uniform4fv(u.uWalls, opts.element ? [1, 1, 1, 1] : [1, 1, 0, 0]); }); vel.swap(); // a well is closed; the page is open above and below, where it scrolls
  }
  function draw() {
    pass(P.show, null, (u) => { const sx = W / VW(), sy = H / VH(); gl.uniform1i(u.uDye, tex(0, dye.r)); gl.uniform1i(u.uVel, tex(1, vel.r));
      spec.forEach((q, g) => gl.uniform1i(u["uS" + g], tex(2 + g, q.r))); gl.uniform1i(u.uSpecOn, specOn); gl.uniform1f(u.uGrainS, opts.grain ?? 1); gl.uniform3fv(u.uPM, BANDM.PM); gl.uniform3fv(u.uBM, BANDM.BM);
      gl.uniform3fv(u.uWall, wall); gl.uniform3fv(u.uInk, ink); gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uDark, dark);
      gl.uniform1f(u.uCap, opts.cap ?? (dark ? 0.3 : 0.26)); gl.uniform1i(u.uMode, mode); gl.uniform1f(u.uCells, cells || 7); gl.uniform1f(u.uTrap, SHEET.trap); gl.uniform1f(u.uWeber, SHEET.weber); gl.uniform1f(u.uDW, SHEET.dw); gl.uniform4fv(u.uLaw, lawArray()); gl.uniform1f(u.uTime, still ? 40 : (performance.now() - t0) / 1000);
      const Gm = new Float32Array(16), Gp = new Float32Array(4); grids.slice(0, 4).forEach((g, i) => { Gm.set([g.left * sx, (VH() - g.bottom) * sy, g.right * sx, (VH() - g.top) * sy], i * 4); Gp[i] = g.period * sx; });
      gl.uniform4fv(u.uGrid, Gm); gl.uniform1fv(u.uGridP, Gp); gl.uniform1i(u.uNG, Math.min(4, grids.length)); gl.uniform4fv(u.uGridC, gridC);
      const C = new Float32Array(32);
      clears.slice(0, 8).forEach((r, i) => C.set([r.left * sx, (VH() - r.bottom) * sy, r.right * sx, (VH() - r.top) * sy], i * 4));
      gl.uniform4fv(u.uClear, C); gl.uniform1i(u.uNC, Math.min(8, clears.length)); gl.uniform1f(u.uFeather, 56 * sx); gl.uniform1f(u.uPx, sx);
      const Lm = new Float32Array(16); lamps.slice(0, 4).forEach((l, i) => Lm.set([l.cx * sx, (VH() - l.cy) * sy, l.rx * sx, l.ry * sy], i * 4));
      gl.uniform4fv(u.uLamp, Lm); gl.uniform1i(u.uNL, Math.min(4, lamps.length)); gl.uniform4fv(u.uLampC, lampC); });
  }
  function frame(now) {
    raf = 0; if (dead) return;
    const t0 = performance.now();
    if (timer && !query) { query = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, query); }
    if (last) { st.gaps.push(now - last); if (st.gaps.length > 240) st.gaps.shift(); }
    acc = Math.min(acc + Math.min(0.1, (now - (last || now)) / 1000), 0.1); last = now;
    let n = 0; while (acc >= STEP && n++ < 2) { step(STEP); acc -= STEP; } if (acc >= STEP) acc = 0; // at most two steps a frame: a slow device runs the water slower, never over budget
    draw();
    if (query) {
      gl.endQuery(timer.TIME_ELAPSED_EXT); const q = query; query = null;
      setTimeout(function poll() { if (dead) return; if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return setTimeout(poll, 16);
        if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) st.gpuMs.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); if (st.gpuMs.length > 240) st.gpuMs.shift(); budget(); }, 16);
    }
    st.cpuMs.push(performance.now() - t0); if (st.cpuMs.length > 240) st.cpuMs.shift(); st.frames++;
    if (performance.now() - lastAdd > IDLE_MS || document.hidden) { st.running = false; last = 0; return; } // settled: hold the still
    raf = requestAnimationFrame(frame);
  }
  // frame budget: GPU time at most 4 ms. The timer counts time other GPU work holds the queue too, so a busy
  // machine reads high in bursts. The guard therefore uses the 25th percentile of 60 timed frames, and only
  // after two windows in a row read over 3 ms while the page is also missing frames (median frame gap over 18 ms) does the display backing step down by a quarter (never below
  // 1x CSS pixels). The simulation is already a fixed small grid.
  let over = 0, seen = 0;
  function budget() {
    if (++seen < 60) return; seen = 0;
    const p25 = st.gpuMs.slice(-60).sort((x, y) => x - y)[15];
    const gap = st.gaps.slice(-60).sort((x, y) => x - y)[30] || 0;  // frames are being missed, not only timed high
    over = p25 > 3 && gap > 18 ? over + 1 : 0;
    if (over >= 2 && Math.min(devicePixelRatio || 1, 2.5) * quality * 0.75 >= 1) {
      over = 0; quality *= 0.75; st.quality = quality;
      const sc = Math.min(devicePixelRatio || 1, 2.5) * quality; W = canvas.width = Math.round(VW() * sc); H = canvas.height = Math.round(VH() * sc);
    }
  }
  function wake() { if (still || dead || raf || document.hidden) return; st.running = true; raf = requestAnimationFrame(frame); }

  // lib/medium's call shape, agreed with the superframe (FLOW.md section 12, 2026-10-26): add(kind, where, amount, props).
  // where: fractions of this view's frame, x right, y down, or a named region ('surface' is the whole frame; 'air' and
  // 'bottom' are side-view regions, read here as the whole frame with a one-time note). amount: the total poured over
  // props.for seconds (none: once). props.at: seconds before it starts. Kinds: lib/medium's names are canonical;
  // heat is this view's warmth, tiles its sediment, ink with props.spread of 10 or more its second pigment (wash).
  // Side-view-only kinds are ignored here, each logged once so the gap stays visible.
  const LIB_KIND = { heat: "warmth", cold: "warmth", tiles: "sediment", ink: "ink", current: "current", ripple: "ripple", sediment: "sediment" };
  const noted = new Set();
  const note = (msg) => { if (!noted.has(msg)) { noted.add(msg); console.info("medium (top view):", msg); } };
  function addLib(kind, where, amount, p) {
    let k = LIB_KIND[kind];
    if (kind === "ink" && ((p.spread ?? 0) >= 10 || p.pour === "B")) k = "wash";
    if (kind === "ink" && isPigment(p)) k = "pigment";   // a coloured pour mixes as spectra (pigment.js)
    if (!k) { note(`kind "${kind}" belongs to the side view; ignored here`); return api; }
    let w = where;
    if (typeof where === "string") {
      if (where !== "surface") note(`region "${where}" is side-view only; read as the whole frame`);
      w = { x: 0.5, y: 0.5, r: 0.6 };
    }
    const one = (amt) => ({ x: w.x ?? 0.5, y: w.y ?? 0.5, r: w.r ?? 0.05, amount: kind === "cold" ? -amt : amt,
      vx: p.vx, vy: p.vy, aspect: p.aspect, always: p.always, color: p.color, absorbS: p.absorbS });
    const fire = () => {
      if (!(p.for > 0)) { api.add(k, one(amount)); return; }
      const n = Math.max(1, Math.round(p.for * 10)); let i = 0;  // the total, poured in tenths of a second
      const t = setInterval(() => { if (dead || ++i > n) { clearInterval(t); return; } api.add(k, one(amount / n)); }, 100);
    };
    if (p.at > 0) setTimeout(fire, p.at * 1000); else fire();
    return api;
  }
  function settle(steps = 360) { for (let i = 0; i < steps; i++) step(STEP); draw(); }
  // the dye field's weights at the dye grid size, y down: A (pour A), B (pour B), S (sediment); for checks, not frames
  function readWeights() {
    const t = dye.r, px = new Float32Array(t.w * t.h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.f); gl.readPixels(0, 0, t.w, t.h, gl.RGBA, gl.FLOAT, px);
    const n = t.w * t.h, A = new Float32Array(n), B = new Float32Array(n), S = new Float32Array(n), Pg = new Float32Array(n);
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) { const j = ((t.h - 1 - y) * t.w + x), i = (y * t.w + x) * 4; A[j] = px[i]; S[j] = px[i + 1]; B[j] = px[i + 2]; Pg[j] = px[i + 3]; }
    const v = vel.r, pv = new Float32Array(v.w * v.h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, v.f); gl.readPixels(0, 0, v.w, v.h, gl.RGBA, gl.FLOAT, pv);
    let sp = 0; for (let i = 0; i < v.w * v.h; i++) sp += Math.hypot(pv[4 * i], pv[4 * i + 1]);
    return { w: t.w, h: t.h, A, B, S, P: Pg, speed: sp / (v.w * v.h) };
  }

  const api = {
    still, stats: st,
    // Two call shapes. This file's own: add(kind, { x, y, r, amount, vx, vy, aspect, always }). And lib/medium's
    // (superframe Medium.add): add(kind, where, amount, props), so the top view can sit behind that API unchanged.
    // lib/medium kind names map onto this view's: heat is warmth, cold is negative warmth, an ink with
    // props.pour "B" is the second pigment (wash); props.vx / vy carry a current's velocity.
    add(kind, s, amount, props) {
      if (typeof amount === "number") return addLib(kind, s, amount, props || {});
      if (!(kind in KIND)) throw new Error("medium.add: unknown additive " + kind + " (this view has " + Object.keys(KIND).join(", ") + ")");
      if (still && !s.always) return api; // a settled medium takes no motion; the page stays readable and calm
      if (kind === "pigment") { const abs = absorbS(s); if (!abs) throw new Error("medium.add: a pigment needs color (hex or 16-band reflectance) or absorbS"); s = { ...s, abs }; }
      queue.push({ kind, ...s }); lastAdd = performance.now(); wake(); return api;
    },
    run(seconds) { const n = Math.round(seconds / STEP); for (let i = 0; i < n; i++) step(STEP); draw(); return api; }, // lib/medium's run(seconds), fixed steps
    weights() { return readWeights(); }, // per-cell weights for the motion check: ink A, ink B, sediment, warmth
    region(list) { rects = list; return api; },
    viscosity(v) { baseVisc = v; return api; },
    rinse(rate = 1.4, ms = 1400) { rinseRate = rate; rinseUntil = performance.now() + ms; lastAdd = performance.now(); wake(); return api; },
    reset() { queue.length = 0; for (const t of [vel.r, vel.w, dye.r, dye.w, div, pr.r, pr.w, ...spec.flatMap((q) => [q.r, q.w])]) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } draw(); return api; },
    grid(list) { grids = list; if (!raf) draw(); return api; }, // viewport px {left, top, right, bottom, period}: the column rules the water bends
    lamp(list) { lamps = list; if (!raf) draw(); return api; }, // viewport px {cx, cy, rx, ry}: light pools that also heat the water
    // seam hand-off: the field as grids at the simulation size. tone() matches seam-cores toneGrid ({w, h, L, C}).
    export() {
      const read = (t) => { const out = new Float32Array(t.w * t.h * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, t.f); gl.readPixels(0, 0, t.w, t.h, gl.RGBA, gl.FLOAT, out); return out; };
      const d = read(dye.r), v = read(vel.r), w = dye.r.w, h = dye.r.h, sw = vel.r.w, sh = vel.r.h;
      const L = new Float32Array(w * h), C = new Uint8Array(w * h * 3), lum = 0.2126 * wall[0] + 0.7152 * wall[1] + 0.0722 * wall[2], il = 0.2126 * ink[0] + 0.7152 * ink[1] + 0.0722 * ink[2];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (h - 1 - y) * w + x, a = 1 - Math.exp(-d[((y * w) + x) * 4] * 1.6);
        L[k] = lum + (il - lum) * a; for (let c = 0; c < 3; c++) C[k * 3 + c] = Math.round(255 * (wall[c] + (ink[c] - wall[c]) * a)); }
      const vx = new Float32Array(sw * sh), vy = new Float32Array(sw * sh), temp = new Float32Array(sw * sh);
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const k = (sh - 1 - y) * sw + x, j = (y * sw + x) * 4; vx[k] = v[j]; vy[k] = -v[j + 1]; temp[k] = v[j + 2]; }
      return { tone: { w, h, L, C }, velocity: { w: sw, h: sh, vx, vy, temp } };
    },
    clear(list) { clears = list; if (!raf) draw(); return api; }, // viewport px rects of reading blocks
    shift(dy) { if (!still) { shiftPx += dy; lastAdd = performance.now(); wake(); } return api; },
    view({ mosaic = false, layers = null } = {}) {
      mode = mosaic ? 1 : ({ ink: 2, warmth: 3, current: 4, sediment: 5 }[layers?.solo] ?? 0); cells = typeof mosaic === "number" ? mosaic : 7; // tile size in CSS px
      st.mode = mode; if (raf) return api; draw(); return api;
    },
    retheme() { tokens(); if (!raf) draw(); return api; },
    seed(drops) { for (const d of drops) queue.push({ ...d }); if (still) settle(); else { lastAdd = performance.now(); wake(); } return api; },
    destroy() { dead = true; cancelAnimationFrame(raf); removeEventListener("resize", onResize); ro?.disconnect(); document.removeEventListener("visibilitychange", onVis); },
  };
  let rz = 0, ro = null, lastSize = ""; const onResize = () => { const k = VW() + "x" + VH(); if (k === lastSize) return; lastSize = k; clearTimeout(rz); rz = setTimeout(() => { size(); if (still) settle(); else wake(); draw(); }, 150); };
  const onVis = () => { if (!document.hidden) wake(); };
  size(); tokens(); draw(); lastSize = VW() + "x" + VH();
  if (opts.element) { ro = new ResizeObserver(onResize); ro.observe(canvas); } else addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVis);
  return api;
}
