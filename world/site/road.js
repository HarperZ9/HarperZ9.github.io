// road.js: the home's road on the one stage. The same road as world/universe/proto/path.js (the seven districts, the
// stop grammar on each stop's clock, the carried element between stops, Lift and Listen), with its 140 canvases
// folded into the stage: each sheet is a box in the page with an offscreen surface behind it, and the road, the
// strata and the transfer are small surfaces the stage scales up. Only the stops beside the walker draw; when the
// visitor is still, the road's drift steps at 12 frames a second, like the pixel road it is.
import { makeRoad } from "/world/universe/lib/road.mjs";
import { grammar, sheetOffset, clockOf, humClock } from "/world/universe/lib/stop.mjs";
import { roadPainter } from "/world/universe/lib/path-render.js";
import { walk } from "/world/universe/lib/walk.js";
import { ROOT } from "/world/universe/lib/data.js";
import { indexWorld, enrichRoad, depthAt } from "/world/universe/lib/world.mjs";
import { strataPainter } from "/world/universe/lib/strata.js";
import { carrier, flowFrom } from "/world/universe/lib/carry.js";
import { makeStops } from "/world/universe/proto/path-stops.js";
import { startGround } from "/world/universe/lib/ground-start.js";
import { stage, isDark, isStill as still } from "/world/site/stage.js";
import { surface, sheetsLayer, surfaceLayer, sizeTo } from "/world/site/road-layers.js";

const root = document.documentElement;
const road = makeRoad(), sections = [...document.querySelectorAll(".stop")];
const dpr = () => stage.px();
const medium = () => window.__medium || null;
const getJSON = async (u) => (await fetch(u)).json();
if (root.dataset.ground !== "off") startGround();

let world = null, hum = null;
const [wj, hj] = await Promise.allSettled([getJSON("/world/universe/proto/world.json"), getJSON(ROOT + "sound/theme/assets/hum4-theme-hits.json")]);
if (wj.status === "fulfilled") { world = indexWorld(wj.value); enrichRoad(road, world); } else console.error("road: world.json failed to load; the strata and rules are off", wj.reason);
if (hj.status === "fulfilled") hum = hj.value; else console.warn("road: the Hum v4 score did not load; places on its clock walk evenly", hj.reason);
const CLOCK_EXTRA = hum ? { hum: humClock(hum) } : {};

for (const sec of sections) sec.__canvasSheets = [...sec.querySelectorAll('.sheet[data-sheet]:not(.content)')];
// a plate arrives decoded and already scaled (to cover 960 by 600) off the main thread, so the mosaic that reads it
// back costs a small copy rather than a full-size decode in the middle of a scroll
async function loadImg(p) {
  const i = new Image(); i.src = ROOT + p;
  try { await i.decode(); } catch (e) { console.warn("road: plate missing", p); return null; }
  const k = Math.min(1, Math.max(960 / i.naturalWidth, 600 / i.naturalHeight));
  try { return await createImageBitmap(i, { resizeWidth: Math.ceil(i.naturalWidth * k), resizeHeight: Math.ceil(i.naturalHeight * k), resizeQuality: "high" }); }
  catch (e) { console.info("road: plate kept full size", p, e.message); return i; }
}

// the superframe's worker starts when a stop first asks it for a picture, never with the first screen
let worker = null; const pending = new Map();
function nodeWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("/world/universe/lib/node-worker.js", location.href), { type: "module" });
  worker.onmessage = (e) => { const p = pending.get(e.data.key); if (!p) return; pending.delete(e.data.key); e.data.error ? (console.warn("road: node failed", e.data.error), p(null)) : p(e.data.bitmap); };
  return worker;
}
function nodeFrame(key, msg) { return new Promise((res) => { pending.set(key, res); nodeWorker().postMessage({ key, ...msg }); }); }

// the stops ahead warm (their plates, the worker's pictures) from the visitor's first act on, not before
let acted = !!window.__siteActed, lastWarm = -1;  // the home loads the road at the first act (boot.js)
const ACTS = ["scroll", "wheel", "pointerdown", "keydown", "touchstart"];
const act = () => { if (acted) return; acted = true; for (const ev of ACTS) removeEventListener(ev, act); lastWarm = -1; stage.invalidate(); };
for (const ev of ACTS) addEventListener(ev, act, { passive: true });

const state = sections.map(() => ({ approach: -1, lifted: false }));
function dirtyAll() { state.forEach((s) => { s.approach = -1; }); stage.invalidate(); }
const stops = makeStops({ dpr, medium, world, isDark, loadImg, nodeFrame, dirtyAll, road, get hum() { return hum; } });
const themed = (d) => (isDark() ? { ...d, ink: d.wall, wall: "#10171c" } : d);

// ---------- the surfaces and the stage's layers ----------
const roadSurf = new OffscreenCanvas(352, 220), strataSurf = new OffscreenCanvas(2, 2), carrySurf = new OffscreenCanvas(2, 2);
const painter = roadPainter(roadSurf), strata = world ? strataPainter(strataSurf, world.strata) : null, carry = carrier(carrySurf);
let at = road.at(0);
const onRoad = () => !document.body.classList.contains("past-road");
const near = () => { const out = []; for (let i = Math.max(0, at.index - 1); i <= Math.min(sections.length - 1, at.index + 1); i++) out.push(i); return out; };
stage.add(surfaceLayer("strata", 0, strataSurf, { on: onRoad, blend: (v) => (v.dark ? "screen" : "multiply") }));
stage.add(surfaceLayer("road", 1, roadSurf, { smooth: false, on: onRoad, alpha: (v) => (v.dark ? 0.45 : 0.8), blend: (v) => (v.dark ? "screen" : "multiply") }));
stage.add(sheetsLayer(sections, near));
stage.add(surfaceLayer("carry", 3, carrySurf, { on: onRoad }));

// ---------- the transfer between stops ----------
let flowFn = null, lastCarry = "";
const records = window.__transfers = {};
function elementOf(sec) {  // the stop's element as one picture: its drawn sheets and its plate, overprinted
  const box = sec.querySelector(".sheets"), o = new OffscreenCanvas(Math.max(1, box.offsetWidth), Math.max(1, box.offsetHeight)), x = o.getContext("2d", { willReadFrequently: true });
  x.globalCompositeOperation = "multiply";
  for (const el of sec.__canvasSheets) if (el.__surf && (el.dataset.sheet !== "ground" || el.__stones)) x.drawImage(el.__surf, el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight);
  for (const img of sec.querySelectorAll("img.plate")) if (img.complete && img.naturalWidth) { const r = img.getBoundingClientRect(), b = box.getBoundingClientRect(); x.drawImage(img, r.left - b.left, r.top - b.top, r.width, r.height); }
  return o;
}
function lift(i, m) {
  sections.forEach((sec, k) => { const v = still() || k !== i ? 1 : 1 - 0.85 * Math.min(1, Math.max(0, m));
    for (const el of sec.__canvasSheets) if (el.dataset.sheet === "motion") el.__alpha = v;
    for (const img of sec.querySelectorAll("img.plate")) img.style.opacity = v === 1 ? "" : String(v); });
}
function carryAt(s) {
  const i = Math.floor(s - 0.72), t = (s - (i + 0.72)) / 0.75;
  if (still() || i < 0 || i >= sections.length - 1 || t <= 0 || t >= 1) { if (lastCarry) { carry.draw(t >= 1 ? 1 : 0, {}); lift(-1, 0); lastCarry = ""; } return; }
  const key = `${i}:${carrySurf.width}x${carrySurf.height}`, mark = `${key}:${s.toFixed(4)}`; if (mark === lastCarry) return;
  // reading the water back stalls the GPU queue, so the current that bends the ticks is read once per transfer
  if (!lastCarry.startsWith(key + ":")) { try { flowFn = flowFrom(medium()?.export?.()?.velocity); } catch (e) { console.warn("road: flow export failed", e); flowFn = null; } }
  lastCarry = mark;
  const a = sections[i], b = sections[i + 1], A = road.stops[i], B = road.stops[i + 1];
  if (!a.__el || a.__elKey !== key) { a.__el = elementOf(a); a.__elKey = key; }
  if (!b.__el || b.__elKey !== key) { b.__el = elementOf(b); b.__elKey = key; }
  carry.draw(t, { key, from: { canvas: a.__el, rect: a.querySelector(".sheets").getBoundingClientRect() }, to: { canvas: b.__el, rect: b.querySelector(".sheets").getBoundingClientRect() },
    fromForm: A.form, toForm: B.form, flow: flowFn, px: 1, medium: medium() });
  const st = carry.stats(); lift(i, st.mean); window.__carryStats = { ...st, pair: i };
  const rec = carry.record(key); if (rec) records[i] = { from: A.id, to: B.id, ...rec };
}

// the next transfer's grid, built in an idle moment once the walker settles on a stop
function prepareNext(i) {
  if (i >= sections.length - 1 || still()) return;
  const run = () => {
    if (at.index !== i || !carrySurf.width || carrySurf.width < 4) return;
    const a = sections[i], b = sections[i + 1], key = `${i}:${carrySurf.width}x${carrySurf.height}`;
    if (!a.__el || a.__elKey !== key) { a.__el = elementOf(a); a.__elKey = key; }
    if (!b.__el || b.__elKey !== key) { b.__el = elementOf(b); b.__elKey = key; }
    carry.prepare(key, a.__el, b.__el);
  };
  "requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 2500 }) : setTimeout(run, 600);
}

// ---------- the stops ----------
function drawStop(i) {
  const sec = sections[i], st = road.stops[i], d = themed(road.districts[st.district]);
  const local = i === at.index ? at.approach : i < at.index ? 1 : 0, s = state[i];
  const g = grammar(local, { reduced: still(), clock: st.clock, steps: st.steps, clocks: CLOCK_EXTRA });
  const content = sec.querySelector(".sheet.content"), all = [...sec.querySelectorAll(".sheet")];
  all.forEach((el, k) => { const o = sheetOffset(k, all.length, g.fan, s.lifted); if (el === content) el.style.transform = `translate(${o.x}px, ${o.y}px) rotate(${o.rotate}deg) scale(${o.scale})`; else el.__o = o; });
  if (g.approach === s.approach) return;
  s.approach = g.approach;
  const box = sec.querySelector(".sheets").getBoundingClientRect();
  for (const el of sec.__canvasSheets) {
    const c = surface(el); c.box = { left: box.left + el.offsetLeft, top: box.top + el.offsetTop, width: c.cw, height: c.ch };
    el.__stones = st.move === "bridge" || st.id === "tide-line";
    stops.draw(i, el.dataset.sheet, c, g, d);
  }
}

let idleN = 0;
const w = walk({ road, sections, say: document.getElementById("say"), band: null, onMove(s, a, idle) {
  if (idle && (still() || ++idleN % 5)) return;  // nothing moved: the drift steps at a fifth of the frame rate
  at = a;
  if (acted && a.index !== lastWarm) { lastWarm = a.index; stops.warm(a.index); prepareNext(a.index); }
  if (onRoad()) {
    sizeTo(roadSurf, 0.25); if (sizeTo(carrySurf, 1)) carry.reset();
    painter.draw(road, s, themed(a.district), { still: still(), drift: still() ? 0 : 0.002 });
    if (strata) { sizeTo(strataSurf, 0.25); strata.draw(depthAt(road, s), { s, dark: isDark() }); }
    for (const i of near()) drawStop(i);
    carryAt(s);
  }
  stage.flush();
} });

// ---------- Lift and Listen ----------
let ear = null;  // the auditory view loads on the first Listen
const listen = async () => ear || (ear = (await import("/world/universe/lib/listen.js")).listener());
for (const [i, sec] of sections.entries()) {
  const b = sec.querySelector(".lift");
  b?.addEventListener("click", () => { state[i].lifted = !state[i].lifted; b.setAttribute("aria-pressed", String(state[i].lifted)); sec.classList.toggle("lifted", state[i].lifted); state[i].approach = -1; stage.invalidate(); });
  const l = sec.querySelector(".listen");
  l?.addEventListener("click", async () => {
    const on = l.getAttribute("aria-pressed") === "true";
    for (const o of document.querySelectorAll(".listen[aria-pressed=true]")) o.setAttribute("aria-pressed", "false");
    if (on) { ear?.stop(); return; }
    l.setAttribute("aria-pressed", "true");
    try { await (await listen()).play(elementOf(sec), { clock: clockOf(road.stops[i].clock, CLOCK_EXTRA), seconds: 6 }); } catch (e) { console.warn("road: listen failed", e); }
    l.setAttribute("aria-pressed", "false");
  });
}
const shared = window.UIShell?.clock;
if (shared) { shared.subscribe(() => w.tick()); const fb = () => { if (shared.running === false && !document.hidden) w.tick(); requestAnimationFrame(fb); }; requestAnimationFrame(fb); }
else { const loop = () => { if (!document.hidden) w.tick(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
addEventListener("resize", dirtyAll);
root.classList.add("ready");
