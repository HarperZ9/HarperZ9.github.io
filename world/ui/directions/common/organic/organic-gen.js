// organic-gen: UI components powered by our own generators. Each one calls the original module (no copied
// code) and keeps a real control underneath. If a generator cannot load, the component keeps the procedural
// shape from organic.js and logs why. Reduced motion and plain view get the generator's finished, still state.
//
//   focus rings      thin-film light           substrate/lib/thinfilm.mjs   filmRgb8
//   panel grounds    stamp brush engine        feed-23/build/brush     Surface, paintStroke, preset
//   menu ground      Chladni sand settling     feed-22/build/chladni.js Sand, membraneAmplitude
//   switch           silver print developing   techniques/lib/develop.js    density, reflect
//   range (slider)   laid three-strand rope    techniques/lib/rope.js       drawRope
//   hover ripple     water surface             glass/liquid.js              Water
//   any ground       any super-framework node  superframe/lib/graph.mjs     evaluate (data-o-node)
//   loading, labels  lettering library         lettering (through shell display slots)
const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const still = () => reduced.matches || root.classList.contains("plain");
import { workspaceRoot } from "./root.js";
const WS = (() => { try { return new URL(workspaceRoot()); } catch (e) { console.info(e.message); return null; } })();
const load = (p) => (WS ? import(new URL(p, WS).href) : Promise.reject(new Error("workspace root unknown, " + p + " skipped")));
const clock = (f) => window.UIShell?.clock?.subscribe?.(f) ?? (() => {});
const DPR = () => Math.min(devicePixelRatio || 1, 2);
const css = (el, k) => getComputedStyle(el).getPropertyValue(k).trim();
const hexRgb = (h) => { const c = document.createElement("canvas").getContext("2d"); c.fillStyle = h; const v = c.fillStyle; return v.startsWith("#") ? [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) : (v.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number); };
function canvasIn(el, cls) {
  let cv = el.querySelector(`:scope > canvas.${cls}`);
  if (!cv) { cv = document.createElement("canvas"); cv.className = cls; cv.setAttribute("aria-hidden", "true"); cv.dataset.art = ""; el.prepend(cv); }
  return cv;
}

// ---- focus rings in thin-film light. The film thickness drifts slowly while something has focus.
async function focusFilm() {
  const { filmRgb8, hex } = await load("substrate/lib/thinfilm.mjs");
  let d = 420, off = null;
  const set = () => {
    root.style.setProperty("--o-film-a", hex(filmRgb8(d)));
    root.style.setProperty("--o-film-b", hex(filmRgb8(d + 140)));
  };
  set();
  document.addEventListener("focusin", () => { if (off || still()) return; off = clock((t) => { d = 380 + 160 * (0.5 + 0.5 * Math.sin(t * 0.7)); set(); }); });
  document.addEventListener("focusout", () => { setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) { off?.(); off = null; } }, 0); });
}

// ---- panel grounds painted with the brush engine, in the region's material colour.
async function brushPanels(els) {
  if (!els.length) return;
  const B = await load("feed-23/build/brush/index.js");
  for (const el of els) {
    const paint = () => {
      // QUALITY-SPEC R1: back the panel at device pixels; capped at 1600 px wide (a sponge pass at 1600 x 400 paints in about 40 ms here)
      const r = el.getBoundingClientRect(), k = Math.min(DPR(), 1600 / Math.max(1, r.width));
      const w = Math.max(8, Math.round(r.width * k)), h = Math.max(8, Math.round(r.height * k));
      const surf = new B.Surface(w, h);
      const probe = getComputedStyle(el).backgroundColor, k255 = probe.startsWith("color(") ? 255 : 1, rgb = (probe.match(/\d*\.?\d+/g) || [232, 226, 212]).slice(0, 3).map((v) => Number(v) * k255);
      const col = "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
      const brush = B.preset(el.dataset.brush || "sponge", { size: 0.16, flow: 0.55, spacing: 0.12 });
      const rows = Math.max(3, Math.round(h / (w * 0.08)));
      for (let i = 0; i <= rows; i++) {
        const y = (i / rows) * h, j = (s) => (Math.sin(i * 12.9898 + s) * 43758.5453) % 1;
        const samples = [{ x: -w * 0.02 + Math.abs(j(1)) * w * 0.04, y, p: 0.9 }, { x: w * 0.5, y: y + (j(2) - 0.5) * 6, p: 1 }, { x: w * 1.02 - Math.abs(j(3)) * w * 0.04, y, p: 0.85 }];
        B.paintStroke(surf, brush, samples, { seed: 11 + i, color: col });
      }
      const cv = canvasIn(el, "o-brush");
      cv.width = w; cv.height = h;
      const img = new ImageData(surf.toRGBA8(), w, h);
      (cv.getContext("2d", { colorSpace: "display-p3" }) || cv.getContext("2d")).putImageData(img, 0, 0);
      el.classList.add("o-brushed");
    };
    try { paint(); } catch (e) { console.warn("organic: brush panel failed; procedural edge kept", e); }
  }
}

// ---- the menu ground: sand thrown onto a plate settles into its nodal lines when the menu opens.
async function sandMenu(dlg) {
  const C = await load("feed-22/build/chladni.js");
  const cv = canvasIn(dlg, "o-sand"), g = cv.getContext("2d", { colorSpace: "display-p3" });
  let field = null, sand = null, off = null;
  const draw = () => {
    const w = cv.width, h = cv.height, s = DPR();
    g.clearRect(0, 0, w, h); g.fillStyle = getComputedStyle(dlg).color;
    for (let i = 0; i < sand.n; i++) { const x = (sand.x[i] + 1) / 2 * w, y = (sand.y[i] + 1) / 2 * h; g.globalAlpha = 0.35 + 0.5 * sand.tone[i]; g.fillRect(x, y, s * sand.size[i] * 1.4, s * sand.size[i] * 1.4); }
    g.globalAlpha = 1;
  };
  dlg.addEventListener("toggle", () => {
    if (!dlg.open) { off?.(); off = null; return; }
    const r = dlg.getBoundingClientRect(); cv.width = Math.round(r.width * DPR()); cv.height = Math.round(r.height * DPR());
    field = C.membraneAmplitude(3, 5, 40, 96); sand = new C.Sand(2600, { seed: 9 });
    if (still()) { for (let i = 0; i < 260; i++) sand.step(field); draw(); return; }
    let n = 0;
    off = clock(() => { for (let k = 0; k < 3; k++) sand.step(field); draw(); if (++n > 120) { off?.(); off = null; } });
  });
}

// ---- switch: the "on" state develops like a print in the tray (H and D density over time).
async function developSwitches(els) {
  if (!els.length) return;
  const D = await load("techniques/lib/develop.js");
  for (const b of els) {
    let off = null;
    const run = () => {
      off?.(); off = null;
      const on = b.getAttribute("aria-checked") === "true";
      if (!on) { b.style.setProperty("--o-dev", "0"); return; }
      const full = 1 - D.reflect(D.densityInf(1));
      if (still()) { b.style.setProperty("--o-dev", "1"); return; }
      const t0 = performance.now();
      off = clock(() => { const t = (performance.now() - t0) / 1000 * 2.5; const v = (1 - D.reflect(D.density(1, t))) / full; b.style.setProperty("--o-dev", v.toFixed(3)); if (v > 0.995) { off?.(); off = null; } });
    };
    b.addEventListener("click", () => setTimeout(run, 0));
    run();
  }
}

// ---- range: the slider is a rope, taut up to the value and slack after it.
async function ropeRanges(els) {
  if (!els.length) return;
  const R = await load("techniques/lib/rope.js");
  for (const input of els) {
    const wrap = input.parentElement; wrap.classList.add("o-range-wrap");
    const cv = canvasIn(wrap, "o-rope");
    const draw = () => {
      const r = input.getBoundingClientRect(), s = DPR(); cv.width = Math.round(r.width * s); cv.height = Math.round(28 * s);
      const g = cv.getContext("2d", { colorSpace: "display-p3" }), v = (input.value - input.min) / (input.max - input.min), x = 12 * s + v * (cv.width - 24 * s), y = cv.height / 2;
      const ink = getComputedStyle(input).color, hi = css(input, "--m-accent") || "#d8c9a8";
      g.clearRect(0, 0, cv.width, cv.height);
      const slack = []; for (let i = 0; i <= 16; i++) { const u = i / 16, xx = x + u * (cv.width - 12 * s - x); slack.push([xx, y + Math.sin(u * Math.PI) * 4 * s]); }
      g.globalAlpha = 0.45; R.drawRope(g, slack, { radius: 2.2 * s, ink, highlight: hi }); g.globalAlpha = 1;
      R.drawRope(g, [[12 * s, y], [x, y]], { radius: 3.4 * s, ink, highlight: hi });
    };
    input.addEventListener("input", draw);
    new ResizeObserver(draw).observe(input);
    draw();
  }
}

// ---- hover ripple: the pointer touches water laid over a frame; touch and keyboard focus ripple it too.
async function ripples(els) {
  if (!els.length) return;
  const { Water } = await load("glass/liquid.js");
  for (const el of els) {
    const sea = new Water({ nx: 64, ny: 40, courant: 0.45, damping: 0.03, edge: "absorb", seed: 4 });
    const cv = canvasIn(el, "o-ripple"), sim = document.createElement("canvas"); sim.width = 64; sim.height = 40;
    const sg = sim.getContext("2d"), img = sg.createImageData(64, 40), g = cv.getContext("2d", { colorSpace: "display-p3" });
    const fit = () => { const r = el.getBoundingClientRect(); cv.width = Math.round(r.width * DPR()); cv.height = Math.round(r.height * DPR()); };
    fit(); new ResizeObserver(fit).observe(el);
    let off = null, quiet = 0;
    const render = () => {
      for (let i = 0; i < 64 * 40; i++) { const v = sea.u[i], a = Math.min(255, Math.abs(v) * 900); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v > 0 ? 255 : 0; img.data[i * 4 + 3] = a; }
      sg.putImageData(img, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingQuality = "high"; g.drawImage(sim, 0, 0, cv.width, cv.height);
    };
    const wake = () => { if (off || still()) return; off = clock(() => { sea.step(2); render(); let e = 0; for (let i = 0; i < sea.u.length; i += 7) e += Math.abs(sea.u[i]); if (e < 0.02 && ++quiet > 30) { off?.(); off = null; quiet = 0; } }); };
    const touch = (x, y) => { const r = el.getBoundingClientRect(); sea.drop(((x - r.left) / r.width) * 64, ((y - r.top) / r.height) * 40, 2.5, -0.6); quiet = 0; wake(); };
    let last = 0;
    el.addEventListener("pointermove", (e) => { const n = performance.now(); if (n - last > 70) { last = n; touch(e.clientX, e.clientY); } });
    el.addEventListener("focusin", () => { const r = el.getBoundingClientRect(); touch(r.left + r.width / 2, r.top + r.height / 2); });
  }
}

// ---- any super-framework node as a component's ground: <div data-o-node="compose.film" data-o-params='{...}'>
async function nodeGrounds(els) {
  if (!els.length) return;
  // The full registry pulls Node-only adapters (core, site, studio read files), so the browser builds its own
  // from the browser-safe families. Any node added to these adapters becomes a UI ground with no change here.
  const fams = ["image", "print", "matter", "type"];
  const [{ evaluate }, { CONVERTERS }, ...ad] = await Promise.all([load("superframe/lib/graph.mjs"), load("superframe/lib/convert.mjs"),
    ...fams.map((f) => load(`superframe/adapters/${f}.mjs`))]);
  const registry = new Map([...ad.flatMap((m) => m.NODES), ...CONVERTERS].map((n) => [n.id, n]));
  for (const el of els) {
    try {
      // R1: device pixels, capped at 1200 px wide; node cost grows with area and the ground is painted once
      const r = el.getBoundingClientRect(), k = Math.min(DPR(), 1200 / Math.max(1, r.width));
      const w = Math.max(16, Math.round(r.width * k)), h = Math.max(16, Math.round(r.height * k));
      const pal = { ground: css(el, "--m-ground") || "#ebe5d8", ink: css(el, "--m-ink") || "#15130f", accent: css(el, "--m-accent") || "#c4632b" };
      const recipe = { schema: "superframe.recipe/1", seed: el.id || el.dataset.oNode, size: [w, h], palette: pal,
        nodes: [{ id: "a", node: el.dataset.oNode, params: JSON.parse(el.dataset.oParams || "{}") }], out: { image: "a" } };
      const { outputs } = await evaluate(recipe, registry);
      let ras = outputs.image;
      // a field (one channel) is shown as the material's ground-to-ink ramp; a raster is shown as is
      if (ras?.channels === 1 && ras.data.length === w * h) {
        const lin = (hx) => hexRgb(hx).map((v) => ((v / 255) <= 0.04045 ? v / 255 / 12.92 : (((v / 255) + 0.055) / 1.055) ** 2.4));
        const g0 = lin(pal.ground), g1 = lin(pal.ink), d = new Float32Array(w * h * 4);
        for (let i = 0; i < w * h; i++) { const t = Math.min(1, Math.max(0, ras.data[i])); for (let c = 0; c < 3; c++) d[i * 4 + c] = g0[c] + (g1[c] - g0[c]) * t; d[i * 4 + 3] = 1; }
        ras = { w, h, data: d };
      }
      if (!ras?.data || ras.data.length !== w * h * 4) throw new Error("node did not return a raster or field of the slot's size");
      const cv = canvasIn(el, "o-node"); cv.width = w; cv.height = h;
      const id = new ImageData(w, h), enc = (c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
      for (let i = 0; i < w * h; i++) { id.data[i * 4] = enc(ras.data[i * 4]); id.data[i * 4 + 1] = enc(ras.data[i * 4 + 1]); id.data[i * 4 + 2] = enc(ras.data[i * 4 + 2]); id.data[i * 4 + 3] = Math.round(255 * Math.min(1, ras.data[i * 4 + 3])); }
      (cv.getContext("2d", { colorSpace: "display-p3" }) || cv.getContext("2d")).putImageData(id, 0, 0);
    } catch (e) { console.warn("organic: node ground failed", el.dataset.oNode, e); }
  }
}

export async function initGenerators() {
  const q = (s) => [...document.querySelectorAll(s)];
  const jobs = [
    focusFilm(),
    brushPanels(q('[data-o="panel"][data-brush], [data-o="panel"][data-material="ink-brush"]')),
    ...q('dialog[data-o="menu"]').map(sandMenu),
    developSwitches(q('[data-o="switch"]')),
    ropeRanges(q('input[type="range"][data-o="range"]')),
    ripples(q('[data-o="ripple"], [data-o-ripple]')),
    nodeGrounds(q("[data-o-node]")),
  ];
  const res = await Promise.allSettled(jobs);
  res.forEach((r) => r.status === "rejected" && console.warn("organic: a generator did not load; the procedural form stays", r.reason));
}
