// The road: seven districts from the reference library's world (lib/districts.mjs), one forward walk. Every stop uses
// the whole stop grammar (lib/stop.mjs) on its own clock; moving between stops is a transfer of ticks whose weights
// shift as a front (lib/carry.js); each transfer keeps a transparency record (what of the source survived); each stop
// can be heard (lib/listen.js). Distance along the road is the only clock for reveals.
import { makeRoad } from "../lib/road.mjs";
import { grammar, sheetOffset, clockOf, humClock } from "../lib/stop.mjs";
import { roadPainter } from "../lib/path-render.js";
import { walk } from "../lib/walk.js";
import { here } from "../lib/here.js";
import { ROOT } from "../lib/data.js";
import { indexWorld, enrichRoad, depthAt } from "../lib/world.mjs";
import { strataPainter } from "../lib/strata.js";
import { carrier, flowFrom } from "../lib/carry.js";
import { listener } from "../lib/listen.js";
import { makeStops } from "./path-stops.js";
import { startGround } from "../lib/ground-start.js";

const root = document.documentElement, reducedQ = matchMedia("(prefers-reduced-motion: reduce)");
const still = () => reducedQ.matches || root.classList.contains("plain");
const road = makeRoad(), sections = [...document.querySelectorAll(".stop")];
const dpr = () => Math.min(devicePixelRatio || 1, 2);
const medium = () => window.__medium || null;
const isDark = () => root.dataset.theme === "dark" || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
const getJSON = async (u) => (await fetch(u)).json();
// the ground: the one medium engine's GPU top view (superframe lib/medium/topview.mjs), started before anything reads it
if (document.readyState === "loading") await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
startGround();

// the world (reference library, slimmed) and the sound theme's score (Hum v4), for the places that keep its time
let world = null, hum = null;
const [wj, hj] = await Promise.allSettled([getJSON(new URL("world.json", import.meta.url)), getJSON(ROOT + "sound/theme/assets/hum4-theme-hits.json")]);
if (wj.status === "fulfilled") { world = indexWorld(wj.value); enrichRoad(road, world); } else console.error("road: world.json failed to load; the strata and rules are off", wj.reason);
if (hj.status === "fulfilled") hum = hj.value; else console.warn("road: the Hum v4 score did not load; places on its clock walk evenly", hj.reason);
const CLOCK_EXTRA = hum ? { hum: humClock(hum) } : {};
const clockFor = (st) => clockOf(st.clock, CLOCK_EXTRA);

function fit(c) {  // a canvas's backing store at the device ratio, for its CSS box
  const r = c.getBoundingClientRect(), w = Math.max(1, Math.round(r.width * dpr())), h = Math.max(1, Math.round(r.height * dpr()));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; c.__dirty = true; }
  return { w, h, cw: r.width, ch: r.height, x: c.getContext("2d", { colorSpace: "display-p3" }) };
}
function loadImg(p) { return new Promise((res) => { const i = new Image(); i.src = ROOT + p; i.onload = () => res(i); i.onerror = () => { console.warn("road: plate missing", p); res(null); }; }); }

// the superframe in a worker: one stop's live picture, per beat
const worker = new Worker(new URL("../lib/node-worker.js", import.meta.url), { type: "module" }), pending = new Map();
worker.onmessage = (e) => { const p = pending.get(e.data.key); if (!p) return; pending.delete(e.data.key); e.data.error ? (console.warn("road: node failed", e.data.error), p(null)) : p(e.data.bitmap); };
function nodeFrame(key, msg) { return new Promise((res) => { pending.set(key, res); worker.postMessage({ key, ...msg }); }); }

const state = sections.map(() => ({ approach: -1, lifted: false }));
function dirtyAll() { state.forEach((s) => { s.approach = -1; }); }
const stops = makeStops({ dpr, medium, world, isDark, loadImg, nodeFrame, dirtyAll, road, get hum() { return hum; } });

// ---------- the transfer between places: ticks whose weights shift toward the next element as a front ----------
const carryCanvas = document.getElementById("carry"), carry = carrier(carryCanvas);
let flowFn = null, flowAge = 99, lastCarry = "";
const records = window.__transfers = {};  // the transparency record of every transfer walked, read by verify_path.py
function elementOf(sec) {  // the stop's element as one picture: its drawn sheets and its plate, overprinted
  const box = sec.querySelector(".sheets").getBoundingClientRect(), o = new OffscreenCanvas(Math.max(1, box.width | 0), Math.max(1, box.height | 0)), x = o.getContext("2d");
  x.globalCompositeOperation = "multiply";
  for (const el of sec.querySelectorAll("canvas.sheet, img.plate")) {
    if (el.dataset.sheet === "ground" && !el.__stones) continue;  // a plain ground is not the element
    const r = el.getBoundingClientRect(); if (r.width && r.height) x.drawImage(el, r.left - box.left, r.top - box.top, r.width, r.height);
  }
  return o;
}
// the element leaves its place as its ticks do: its drawn sheets thin by the share of weight that has shifted
function lift(i, m) {
  sections.forEach((sec, k) => { const v = still() || k !== i ? 1 : 1 - 0.85 * Math.min(1, Math.max(0, m)); for (const el of sec.querySelectorAll('canvas[data-sheet="motion"], img.plate')) el.style.opacity = v === 1 ? "" : String(v); });
}
const PROPS = [["lightness", "lightness"], ["chroma", "colour strength"], ["structure", "pattern"]];
function drawRecord(i) {  // on the arriving stop: what the last transfer carried, each property's clarity as opacity
  const sec = sections[i], c = sec.querySelector(".record"), rec = records[i - 1]?.landed; if (!c) return;
  const f = fit(c), d = themed(road.districts[road.stops[i].district]); f.x.clearRect(0, 0, f.w, f.h); if (!rec) return;
  PROPS.forEach(([k], n) => {
    const v = rec[k], s = f.h * 0.7, X = n * (s + 6 * dpr()) + 2 * dpr(), Y = (f.h - s) / 2; if (v == null) return;
    f.x.fillStyle = d.ink; f.x.globalAlpha = Math.min(1, Math.max(0.04, v)); f.x.fillRect(X, Y, s, s);
    if (v > 1) { f.x.globalAlpha = 1; f.x.strokeStyle = d.accent; f.x.lineWidth = 2 * dpr(); f.x.strokeRect(X - 2 * dpr(), Y - 2 * dpr(), s + 4 * dpr(), s + 4 * dpr()); }
  });
  f.x.globalAlpha = 1;
  const words = PROPS.map(([k, name]) => (rec[k] == null ? null : `${name} ${rec[k].toFixed(2)}`)).filter(Boolean).join(", ");
  c.setAttribute("aria-label", `Carried from ${road.stops[i - 1].title}: ${words}`);
}
function carryAt(s) {
  // the transfer starts as the stage begins to leave (0.72 into a stop) and lands as the next stage settles: the
  // fitted front blooms fast and then creeps (r ~ tau^0.176), so the window starts late enough that the bloom
  // meets the next stage coming into view
  const i = Math.floor(s - 0.72), t = (s - (i + 0.72)) / 0.75;
  if (still() || i < 0 || i >= sections.length - 1 || t <= 0 || t >= 1) { carry.draw(t >= 1 ? 1 : 0, {}); lift(-1, 0); lastCarry = ""; window.__carryStats = carry.stats(); return; }
  const W = Math.round(innerWidth * dpr()), H = Math.round(innerHeight * dpr());
  if (carryCanvas.width !== W || carryCanvas.height !== H) { carryCanvas.width = W; carryCanvas.height = H; carry.reset(); }
  if (++flowAge > 15) { flowAge = 0; try { flowFn = flowFrom(medium()?.export?.()?.velocity); } catch (e) { console.warn("road: flow export failed", e); flowFn = null; } }
  const key = `${i}:${W}x${H}`, at = `${key}:${s.toFixed(4)}:${flowAge === 0}`; if (at === lastCarry) return; lastCarry = at;
  const a = sections[i], b = sections[i + 1], A = road.stops[i], B = road.stops[i + 1];
  if (!a.__el || a.__elKey !== key) { a.__el = elementOf(a); a.__elKey = key; }
  if (!b.__el || b.__elKey !== key) { b.__el = elementOf(b); b.__elKey = key; }
  carry.draw(t, { key, from: { canvas: a.__el, rect: a.querySelector(".sheets").getBoundingClientRect() }, to: { canvas: b.__el, rect: b.querySelector(".sheets").getBoundingClientRect() },
    fromForm: A.form, toForm: B.form, flow: flowFn, px: dpr(), medium: medium() });  // the front's own fitted pace (ticks.mjs FRONT_FIT); the places' clocks time their own reveals
  const st = carry.stats(); lift(i, st.mean); window.__carryStats = { ...st, pair: i };  // read by build/verify_path.py
  const rec = carry.record(key); if (rec) { const had = records[i]?.landed; records[i] = { from: A.id, to: B.id, ...rec }; if (rec.landed && !had) drawRecord(i + 1); }
}

// ---------- the stops ----------
const roadCanvas = document.getElementById("road"), painter = roadPainter(roadCanvas);
const strataCanvas = document.getElementById("strata"), strata = world ? strataPainter(strataCanvas, world.strata) : null;
// in the dark the district's inks swap: the sheets screen over the page, so their ground must be dark
function themed(d) { return isDark() ? { ...d, ink: d.wall, wall: "#10171c" } : d; }
function drawStop(i, at) {
  const sec = sections[i], st = road.stops[i], d = themed(road.districts[st.district]);
  const local = i === at.index ? at.approach : i < at.index ? 1 : 0, g = grammar(local, { reduced: still(), clock: st.clock, steps: st.steps, clocks: CLOCK_EXTRA }), s = state[i];
  const sheets = [...sec.querySelectorAll(".sheet")];
  sheets.forEach((el, k) => { const o = sheetOffset(k, sheets.length, g.fan, s.lifted); el.style.transform = `translate(${o.x}px, ${o.y}px) rotate(${o.rotate}deg) scale(${o.scale})`; });
  if (g.approach === s.approach && !roadCanvas.__resized) return;
  s.approach = g.approach;
  for (const el of sec.querySelectorAll("canvas.sheet")) {
    const c = fit(el); c.box = el.getBoundingClientRect(); el.__stones = st.move === "bridge" || st.id === "tide-line";
    stops.draw(i, el.dataset.sheet, c, g, d);
  }
}
const band = (() => { const host = document.querySelector('[data-o="band"]'); if (!host) return null;
  return here(host, { nodes: [], featured_links: [] }, { owner: "map", tiles: road.stops.map((s, i) => ({ id: s.id, fill: world ? world.strata[s.depth].tuned : ["#3b7f8f", "#1f3d5c", "#6fa3ad", "#2c5c6e"][i % 4], num: s.builds.length })), onPick: (id) => w.go(road.stops.findIndex((s) => s.id === id)), onWhole: () => { location.href = "index.html"; } }); })();
let lastWarm = -1;
const w = walk({ road, sections, say: document.getElementById("say"), band, onMove(s, at) {
  const r = roadCanvas.getBoundingClientRect(), W = Math.round(r.width * dpr()), H = Math.round(r.height * dpr());
  if (roadCanvas.width !== W || roadCanvas.height !== H) { roadCanvas.width = W; roadCanvas.height = H; roadCanvas.__resized = true; }
  if (at.index !== lastWarm) { lastWarm = at.index; stops.warm(at.index); }
  painter.draw(road, s, at.district, { still: still(), drift: still() ? 0 : 0.002 });
  if (strata) {  // the shared space: no place's law applies here
    if (strataCanvas.width !== W || strataCanvas.height !== H) { strataCanvas.width = W; strataCanvas.height = H; }
    strata.draw(depthAt(road, s), { s, dark: isDark() });
  }
  for (let i = Math.max(0, at.index - 1); i <= Math.min(sections.length - 1, at.index + 1); i++) drawStop(i, at);
  carryAt(s);
  roadCanvas.__resized = false;
} });

// ---------- the stop's tools: Lift (its sheets apart) and Listen (its auditory view) ----------
const ear = listener();
for (const [i, sec] of sections.entries()) {
  const b = sec.querySelector(".lift");
  b.addEventListener("click", () => { state[i].lifted = !state[i].lifted; b.setAttribute("aria-pressed", String(state[i].lifted)); sec.classList.toggle("lifted", state[i].lifted); state[i].approach = -1; });
  const l = sec.querySelector(".listen");
  l?.addEventListener("click", async () => {
    const on = l.getAttribute("aria-pressed") === "true";
    for (const o of document.querySelectorAll(".listen[aria-pressed=true]")) o.setAttribute("aria-pressed", "false");
    if (on) { ear.stop(); return; }
    l.setAttribute("aria-pressed", "true");
    try { await ear.play(elementOf(sec), { clock: clockFor(road.stops[i]), seconds: 6 }); } catch (e) { console.warn("road: listen failed", e); }
    l.setAttribute("aria-pressed", "false");
  });
}
// one clock: the shell's shared clock, with a fallback for reduced motion (the shell's clock never starts then)
const shared = window.UIShell?.clock;
if (shared) { shared.subscribe(() => w.tick()); const fb = () => { if (shared.running === false) w.tick(); requestAnimationFrame(fb); }; requestAnimationFrame(fb); }
else { const loop = () => { w.tick(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
addEventListener("resize", dirtyAll);
stops.warm(0);
root.classList.add("ready");
