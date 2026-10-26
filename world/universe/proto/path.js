// The road, first stretch: the water and fluids district. Four stops, each using the whole stop grammar
// (lib/stop.mjs): it unravels, uncovers through mosaic, fans its sheets, and steps on the district's beat.
// Each stop leads with one move: Ink unravels, Ink in water uncovers, Layers of water lifts apart, and
// Palimpsest is the junction where the road branches. Distance along the road is the only clock for reveals.
import { makeRoad } from "../lib/road.mjs";
import { grammar, sheetOffset, clockOf } from "../lib/stop.mjs";
import { roadPainter, drawRibbon, mosaicSource, drawMosaic } from "../lib/path-render.js";
import { walk } from "../lib/walk.js";
import { here } from "../lib/here.js";
import { ROOT } from "../lib/data.js";
import { indexWorld, enrichRoad, depthAt } from "../lib/world.mjs";
import { strataPainter } from "../lib/strata.js";
import { carrier, flowFrom } from "../lib/carry.js";
import { diffusionRings, courses, coursesRank, drawCourses, coffeeDrop, coffeeProfile, stones, weberSteps } from "../lib/water-laws.js";

const root = document.documentElement, reducedQ = matchMedia("(prefers-reduced-motion: reduce)");
const still = () => reducedQ.matches || root.classList.contains("plain");
const road = makeRoad(), sections = [...document.querySelectorAll(".stop")];
const dpr = () => Math.min(devicePixelRatio || 1, 2);
const medium = () => window.__medium || null;
const isDark = () => root.dataset.theme === "dark" || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);

// the world (reference library, slimmed): each stop stands on a place in a stratum, with a rule and a bridge
let world = null;
try { world = indexWorld(await (await fetch(new URL("world.json", import.meta.url))).json()); enrichRoad(road, world); }
catch (e) { console.error("road: world.json failed to load; the strata and rules are off", e); }
for (const [i, sec] of sections.entries()) {  // each annotation sheet carries the rule it draws, for a screen reader
  const r = road.stops[i]?.ruleRec, a = sec.querySelector('canvas[data-sheet="annotation"]'); if (r && a) a.setAttribute("aria-label", r.statement);
}
const water = courses(9), waterRank = coursesRank(water);

function fit(c) {  // a canvas's backing store at the device ratio, for its CSS box
  const r = c.getBoundingClientRect(), w = Math.max(1, Math.round(r.width * dpr())), h = Math.max(1, Math.round(r.height * dpr()));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; c.__dirty = true; }
  return { w, h, cw: r.width, ch: r.height, x: c.getContext("2d", { colorSpace: "display-p3" }) };
}
function loadImg(p) { return new Promise((res) => { const i = new Image(); i.src = ROOT + p; i.onload = () => res(i); i.onerror = () => { console.warn("road: plate missing", p); res(null); }; }); }

// ---------- the superframe in a worker: one stop's live picture, per beat ----------
const worker = new Worker(new URL("../lib/node-worker.js", import.meta.url), { type: "module" }), pending = new Map();
worker.onmessage = (e) => { const p = pending.get(e.data.key); if (!p) return; pending.delete(e.data.key); e.data.error ? (console.warn("road: node failed", e.data.error), p(null)) : p(e.data.bitmap); };
function nodeFrame(key, msg) { return new Promise((res) => { pending.set(key, res); worker.postMessage({ key, ...msg }); }); }

// ---------- per stop: what each sheet draws at a grammar state ----------
const STOPS = {
  ink: { dropped: new Set(),
    annotation(c, g, d) { diffusionRings(c.x, g, { w: c.w, h: c.h, cx: c.w * 0.8, cy: c.h * 0.32, ink: d.ink, px: dpr() }); },
    motion(c, g, d) {
      const digits = [3, 7, 4, 9, 2, 6, 5, 8, 1, 6, 4, 7];  // each tile's digit is the ink it drops, in tenths
      const landed = drawRibbon(c.x, { n: 12, u: g.unroll, digits, inks: [d.accent, "#c8322b", "#d79e35", "#1d2562"], ink: d.wall, w: c.w, h: c.h });
      const m = medium(), box = c.box;
      for (const t of landed) if (!this.dropped.has(t.i) && m) {  // where a tile lands, the ground takes its ink
        this.dropped.add(t.i);
        m.add("ink", { x: (box.left + t.x / dpr()) / innerWidth, y: (box.top + t.y / dpr() + t.side / dpr()) / innerHeight, r: 0.045, amount: digits[t.i] / 6, always: true });
      }
    },
  },
  "ink-in-water": { src: null, beat: -1,
    annotation(c, g, d) { drawCourses(c.x, g, water, { w: c.w, h: c.h, ink: d.ink, px: dpr() }); }, async picture(g) {
      if (g.approach === this.beat) return; this.beat = g.approach;
      if (!this.plate) { const p = await loadImg("exhibit/assets/img/marbled-a-s.webp"); this.plate = p ? await createImageBitmap(p) : null; }
      const plate = this.plate ? await createImageBitmap(this.plate) : null;
      const bm = await nodeFrame("iiw:" + g.approach, { id: "universe.seam-liquid", w: 480, h: 300, time: { t: 0.5 + g.approach * 1.5, duration: 2.2 }, inputs: plate ? { plate } : {} });
      if (bm) { this.src = mosaicSource(bm, 480, 300); dirtyAll(); }
    },
    motion(c, g, d) { this.picture(g); if (this.src) drawMosaicScaled(c, this.src, g, d, 2, waterRank); },
  },
  layers: { snap: null, beat: -1,
    take(g) { if (g.approach === this.beat) return; this.beat = g.approach; const m = medium(); try { this.snap = m?.export?.() || null; } catch (e) { console.warn("road: medium export failed", e); this.snap = null; } },
    ground(c, g, d) { this.take(g); const t = this.snap?.tone; if (!t) return plainGround(c, d); const img = new ImageData(t.w, t.h); for (let k = 0; k < t.w * t.h; k++) { img.data.set([t.C[3 * k], t.C[3 * k + 1], t.C[3 * k + 2], 255], 4 * k); } const o = new OffscreenCanvas(t.w, t.h); o.getContext("2d").putImageData(img, 0, 0); c.x.imageSmoothingEnabled = true; c.x.drawImage(o, 0, 0, c.w, c.h); },
    motion(c, g, d) {
      c.x.clearRect(0, 0, c.w, c.h); const v = this.snap?.velocity; if (!v) return;
      c.x.strokeStyle = d.accent; c.x.lineWidth = 1.2 * dpr(); const step = 6;
      for (let y = step / 2; y < v.h; y += step) for (let x = step / 2; x < v.w; x += step) {
        const k = (y | 0) * v.w + (x | 0), vx = v.vx[k], vy = v.vy[k], sp = Math.hypot(vx, vy); if (sp < 1e-4) continue;
        const px = (x / v.w) * c.w, py = (y / v.h) * c.h, L = Math.min(c.w, c.h) * Math.min(0.035, 0.008 + sp * 2);
        c.x.beginPath(); c.x.moveTo(px, py); c.x.lineTo(px + (vx / sp) * L, py + (vy / sp) * L); c.x.stroke();
      }
    },
    annotation(c, g, d) {  // three measures of the page's own water, each beside its mark
      c.x.clearRect(0, 0, c.w, c.h); const t = this.snap?.tone, v = this.snap?.velocity; if (!t || !v) return;
      let ink = 0; for (const L of t.L) ink += L; const wallL = t.L.reduce((a, b) => Math.max(a, b), 0); const meanInk = Math.round(100 * Math.max(0, 1 - ink / t.L.length / Math.max(1e-3, wallL)));
      let peak = 0; for (let k = 0; k < v.vx.length; k++) peak = Math.max(peak, Math.hypot(v.vx[k], v.vy[k]));
      const rows = [[`${t.w}×${t.h}`, "square"], [`${meanInk}%`, "disc"], [peak.toFixed(3), "stroke"]], f = 13 * dpr();
      c.x.font = `400 ${f}px Conso, ui-monospace, monospace`; c.x.fillStyle = d.ink; c.x.strokeStyle = d.ink; c.x.lineWidth = dpr();
      rows.forEach(([txt, mark], i) => { const x0 = c.w - 150 * dpr(), y0 = c.h * 0.5 + i * 24 * dpr(); if (mark === "square") c.x.strokeRect(x0, y0 - 8 * dpr(), 9 * dpr(), 9 * dpr()); else if (mark === "disc") { c.x.beginPath(); c.x.arc(x0 + 4.5 * dpr(), y0 - 3.5 * dpr(), 4.5 * dpr(), 0, 6.28); c.x.fill(); } else { c.x.beginPath(); c.x.moveTo(x0, y0); c.x.lineTo(x0 + 12 * dpr(), y0 - 8 * dpr()); c.x.stroke(); } c.x.fillText(txt, x0 + 20 * dpr(), y0); });
    },
  },
  "tide-line": {
    ground(c, g, d) { stones(c.x, g, { w: c.w, h: c.h, stones: world?.stones("tide-line") || [], ink: d.ink, wall: d.wall, px: dpr() }); },
    motion(c, g, d) { coffeeDrop(c.x, g, { w: c.w, h: c.h, pigment: isDark() ? "#9fc0d2" : world?.place("pigment")?.colour?.hex || d.accent, px: dpr() }); },
    annotation(c, g, d) { coffeeProfile(c.x, g, { w: c.w, h: c.h, ink: d.ink, px: dpr() }); },
  },
  palimpsest: { src: null,
    annotation(c, g, d) { weberSteps(c.x, g, { w: c.w, h: c.h, ink: d.ink, px: dpr() }); }, async load() { if (this.src || this.loading) return; this.loading = true; const p = await loadImg("exhibit/assets/img/palimpsest-c-s.webp"); if (p) { this.src = mosaicSource(p, 480, 300); dirtyAll(); } },
    motion(c, g, d) { this.load(); if (this.src) drawMosaicScaled(c, this.src, g, d, 3); },
  },
};
function plainGround(c, d) { c.x.fillStyle = d.wall; c.x.fillRect(0, 0, c.w, c.h); c.x.fillStyle = d.accent; c.x.globalAlpha = 0.08; for (let y = 0; y < c.h; y += 14 * dpr()) c.x.fillRect(0, y, c.w, dpr()); c.x.globalAlpha = 1; }
function beatRule(c, g, d) {  // the district's beat as a ruler: one tick per step, the reached ones inked
  c.x.clearRect(0, 0, c.w, c.h); const n = 6, y = c.h - 10 * dpr(), x0 = 16 * dpr(), x1 = c.w * 0.45;
  c.x.fillStyle = d.ink; for (let i = 0; i <= n; i++) { const x = x0 + (i / n) * (x1 - x0), on = i / n <= g.approach + 1e-6; c.x.globalAlpha = on ? 0.9 : 0.25; c.x.fillRect(x, y - (i % 3 ? 6 : 10) * dpr(), Math.max(1, dpr()), (i % 3 ? 6 : 10) * dpr()); }
  c.x.globalAlpha = 1;
}
function drawMosaicScaled(c, src, g, d, seed, rank = null) {
  const o = c.__mo || (c.__mo = new OffscreenCanvas(480, 300)), x = o.getContext("2d");
  drawMosaic(x, src, g, { w: 480, h: 300, ground: d.wall, seed, base: 64, rank });
  c.x.clearRect(0, 0, c.w, c.h); c.x.imageSmoothingEnabled = false;
  const s = Math.max(c.w / 480, c.h / 300); c.x.drawImage(o, (c.w - 480 * s) / 2, (c.h - 300 * s) / 2, 480 * s, 300 * s);
}

// ---------- the walk ----------
const roadCanvas = document.getElementById("road"), painter = roadPainter(roadCanvas);
// ---------- the transfer between places: the element travels across the surface and changes medium ----------
const carryCanvas = document.getElementById("carry"), carry = carrier(carryCanvas);
let flowFn = null, flowAge = 99, lastCarry = "";
function elementOf(sec) {  // the stop's element as one picture: its drawn sheets and its plate, overprinted
  const box = sec.querySelector(".sheets").getBoundingClientRect(), o = new OffscreenCanvas(Math.max(1, box.width | 0), Math.max(1, box.height | 0)), x = o.getContext("2d");
  x.globalCompositeOperation = "multiply";
  for (const el of sec.querySelectorAll("canvas.sheet, img.plate")) {
    if (el.dataset.sheet === "ground" && sec.dataset.stop !== "tide-line") continue;  // a plain ground is not the element
    const r = el.getBoundingClientRect(); if (r.width && r.height) x.drawImage(el, r.left - box.left, r.top - box.top, r.width, r.height);
  }
  return o;
}
// the element leaves its place as its ticks do: its drawn sheets thin by the share of weight that has shifted to
// the next element (the weights' mean), and come back when the visitor walks back. The arriving stop keeps its own
// reveal.
function lift(i, m) {
  sections.forEach((sec, k) => { const v = still() || k !== i ? 1 : 1 - 0.85 * Math.min(1, Math.max(0, m)); for (const el of sec.querySelectorAll('canvas[data-sheet="motion"], img.plate')) el.style.opacity = v === 1 ? "" : String(v); });
}
function carryAt(s) {
  const i = Math.floor(s - 0.6), t = (s - (i + 0.6)) / 0.75;
  if (still() || i < 0 || i >= sections.length - 1 || t <= 0 || t >= 1) { carry.draw(t >= 1 ? 1 : 0, {}); lift(-1, 0); lastCarry = ""; window.__carryStats = carry.stats(); return; }
  const W = Math.round(innerWidth * dpr()), H = Math.round(innerHeight * dpr());
  if (carryCanvas.width !== W || carryCanvas.height !== H) { carryCanvas.width = W; carryCanvas.height = H; carry.reset(); }
  if (++flowAge > 15) { flowAge = 0; try { flowFn = flowFrom(medium()?.export?.()?.velocity); } catch (e) { console.warn("road: flow export failed", e); flowFn = null; } }
  const key = `${i}:${W}x${H}`, at = `${key}:${s.toFixed(4)}:${flowAge === 0}`; if (at === lastCarry) return; lastCarry = at;
  const a = sections[i], b = sections[i + 1], A = road.stops[i], B = road.stops[i + 1];
  if (!a.__el || a.__elKey !== key) { a.__el = elementOf(a); a.__elKey = key; }
  if (!b.__el || b.__elKey !== key) { b.__el = elementOf(b); b.__elKey = key; }
  carry.draw(t, { key, from: { canvas: a.__el, rect: a.querySelector(".sheets").getBoundingClientRect() }, to: { canvas: b.__el, rect: b.querySelector(".sheets").getBoundingClientRect() },
    fromForm: A.form, toForm: B.form, flow: flowFn, px: dpr(), medium: medium(), clocks: [clockOf(A.clock), clockOf(B.clock)] });
  const st = carry.stats(); lift(i, st.mean); window.__carryStats = { ...st, pair: i };  // read by build/verify_path.py
}
const strataCanvas = document.getElementById("strata"), strata = world ? strataPainter(strataCanvas, world.strata) : null;
const state = sections.map(() => ({ approach: -1, lifted: false }));
function dirtyAll() { state.forEach((s) => { s.approach = -1; }); }
// in the dark the district's inks swap: the sheets screen over the page, so their ground must be dark, or every
// sheet washes out to white
function themed(d) { return isDark() ? { ...d, ink: d.wall, wall: "#10171c" } : d; }
function drawStop(i, at) {
  const sec = sections[i], id = sec.dataset.stop, impl = STOPS[id], d = themed(road.districts[road.stops[i].district]);
  const local = i === at.index ? at.approach : i < at.index ? 1 : 0, g = grammar(local, { reduced: still(), clock: road.stops[i].clock, steps: road.stops[i].steps }), st = state[i];
  const sheets = [...sec.querySelectorAll(".sheet")];
  sheets.forEach((el, k) => { const o = sheetOffset(k, sheets.length, g.fan, st.lifted); el.style.transform = `translate(${o.x}px, ${o.y}px) rotate(${o.rotate}deg) scale(${o.scale})`; });
  if (g.approach === st.approach && !roadCanvas.__resized) return;
  st.approach = g.approach;
  for (const el of sec.querySelectorAll("canvas.sheet")) {
    const c = fit(el); c.box = el.getBoundingClientRect(); const role = el.dataset.sheet;
    if (impl?.[role]) impl[role](c, g, d); else if (role === "ground") plainGround(c, d); else if (role === "annotation") beatRule(c, g, d); else c.x.clearRect(0, 0, c.w, c.h);
  }
}
const band = (() => { const host = document.querySelector('[data-o="band"]'); if (!host) return null;
  return here(host, { nodes: [], featured_links: [] }, { owner: "map", tiles: road.stops.map((s, i) => ({ id: s.id, fill: world ? world.strata[s.depth].tuned : ["#3b7f8f", "#1f3d5c", "#6fa3ad", "#2c5c6e"][i % 4], num: s.builds.length })), onPick: (id) => w.go(road.stops.findIndex((s) => s.id === id)), onWhole: () => { location.href = "index.html"; } }); })();
const w = walk({ road, sections, say: document.getElementById("say"), band, onMove(s, at) {
  const r = roadCanvas.getBoundingClientRect(), W = Math.round(r.width * dpr()), H = Math.round(r.height * dpr());
  if (roadCanvas.width !== W || roadCanvas.height !== H) { roadCanvas.width = W; roadCanvas.height = H; roadCanvas.__resized = true; }
  painter.draw(road, s, at.district, { still: still(), drift: still() ? 0 : 0.002 });
  if (strata) {  // at the device ratio like every canvas here; redrawn only when depth or distance changes
    if (strataCanvas.width !== W || strataCanvas.height !== H) { strataCanvas.width = W; strataCanvas.height = H; }
    strata.draw(depthAt(road, s), { s, dark: isDark() });  // the shared space: no place's law applies here
  }
  for (let i = Math.max(0, at.index - 1); i <= Math.min(sections.length - 1, at.index + 1); i++) drawStop(i, at);
  carryAt(s);
  roadCanvas.__resized = false;
} });
for (const [i, sec] of sections.entries()) {
  const b = sec.querySelector(".lift");
  b.addEventListener("click", () => { state[i].lifted = !state[i].lifted; b.setAttribute("aria-pressed", String(state[i].lifted)); sec.classList.toggle("lifted", state[i].lifted); state[i].approach = -1; });
}
// one clock: the shell's shared clock, with a fallback for reduced motion (the shell's clock never starts then)
const shared = window.UIShell?.clock;
if (shared) { shared.subscribe(() => w.tick()); const fb = () => { if (shared.running === false) w.tick(); requestAnimationFrame(fb); }; requestAnimationFrame(fb); }
else { const loop = () => { w.tick(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
addEventListener("resize", dirtyAll);
// the places' pictures load at the start, so an element arriving at them lands on the picture, not on grey
STOPS["ink-in-water"].picture({ approach: 0 }); STOPS.palimpsest.load();
root.classList.add("ready");
