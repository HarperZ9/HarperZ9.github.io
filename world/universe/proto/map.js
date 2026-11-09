// The universe: a curated host. Seven places, one per region, each a window onto its region's material.
// Layering and motion do the decluttering: the place in focus comes forward, its neighbours one step away
// stay, and everything else folds back to almost nothing. Entering a place is one continuous zoom: the window
// grows until it is the page (a shared-element transition), and the seam converts the medium on the way in.
// One clock drives everything (the render loop steps the camera, the tweens and the seams' timers).
import { load, trail, seamFor } from "../lib/data.js";
import { camera, WORLD } from "../lib/camera.js";
import { drawEdge } from "../lib/materials.js";
import { aperture, grainPattern, preload, prewarm, setSurvey } from "../lib/regions.js";
import { here } from "../lib/here.js";
import { card, initFind, initKeys } from "../lib/card.js";
import { initNav } from "../lib/nav.js";
import { enterRoom, leaveRoom, roomOpen, roomTick, openNow, prepare } from "../lib/room.js";
import { prepareSeam } from "../lib/seams.js";

// transition log for measurement: { kind, id, start, end } in ms (performance.now)
const log = (window.__trans = []);
const begin = (kind, id) => { const r = { kind, id, start: performance.now(), end: null }; log.push(r); return r; };

const root = document.documentElement, stage = document.getElementById("stage"), cv = document.getElementById("art");
const ctx = cv.getContext("2d", { colorSpace: "display-p3" });  // CSS colours and images are colour-managed into P3
const reducedQ = matchMedia("(prefers-reduced-motion: reduce)");
const still = () => reducedQ.matches || root.classList.contains("plain");
const S = { u: null, focus: null, ink: "#16130f", wall: "#e8e3d9", lamp: "", grain: null, mode: "", seq: 0, vis: new Map() };
let cam;
const css = (v) => getComputedStyle(root).getPropertyValue(v).trim();
export const A_WORLD = 92;  // a window's radius in world units

// revealOut, measured (techniques/lib/timing.js): delay 0.224 s, cubic ease-out over 0.758 s
const revealOut = (t) => { const u = Math.min(1, Math.max(0, (t - 0.224) / 0.758)); return 1 - (1 - u) ** 3; };
// Each window tweens its scale and alpha from wherever it is toward its target, so a new choice redirects it.
function target(id) {
  if (!S.focus) return { s: 1, a: 0.5 };
  if (id === S.focus) return { s: 1.22, a: 0.78 };
  return linksOf(S.focus).some((l) => l.a === id || l.b === id) ? { s: 0.8, a: 0.32 } : { s: 0.5, a: 0.05 };
}
function retarget(now) { for (const n of featured()) { const v = S.vis.get(n.id) || { s: 1, a: 0.5 }, to = target(n.id); S.vis.set(n.id, { s: v.s, a: v.a, from: { s: v.s, a: v.a }, to, t0: now }); } }
function stepVis(now) {
  let any = false;
  for (const v of S.vis.values()) { if (!v.to) continue; any = true; const e = still() ? 1 : revealOut((now - v.t0) / 1000); v.s = v.from.s + (v.to.s - v.from.s) * e; v.a = v.from.a + (v.to.a - v.from.a) * e; if (e >= 1) v.to = null; }
  return any;
}

function theme() {
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const mode = dark ? "dark" : "light"; if (mode === S.mode) return;
  S.mode = mode; S.ink = css("--ink") || S.ink; S.wall = css("--wall") || S.wall; S.lamp = css("--lamp-pool") || "rgba(255,250,238,.6)";
  S.grain = grainPattern(ctx, dark ? "light" : "dark");
}
function size() { cv.width = Math.max(1, Math.round(cam.w * cam.dpr)); cv.height = Math.max(1, Math.round(cam.h * cam.dpr)); cv.style.width = cam.w + "px"; cv.style.height = cam.h + "px"; }
const featured = () => S.u.nodes.filter((n) => n.featured);
const linksOf = (id) => S.u.featured_links.filter((l) => l.a === id || l.b === id);

function frame(t) {
  const { u } = S, calm = still(), focus = S.focus, C = { grounds: 0, threads: 0, marks: 0, trail: 0, cell: focus ? 1 : 0 };
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  ctx.fillStyle = S.wall; ctx.fillRect(0, 0, cam.w, cam.h);
  // the lamp: one soft pool of light wandering the wall on a slow Lissajous path (period about 50 s)
  const lx = cam.w * (0.5 + 0.32 * Math.sin(t * 0.13)), ly = cam.h * (0.5 + 0.26 * Math.sin(t * 0.09 + 1.3)), R = Math.max(cam.w, cam.h) * 0.55;
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R); g.addColorStop(0, S.lamp); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, cam.w, cam.h);
  ctx.fillStyle = S.grain; ctx.fillRect(0, 0, cam.w, cam.h);
  if (focus) for (const l of linksOf(focus)) {  // the focused place's threads, each in its own material
    const A = u.byId.get(l.a), B = u.byId.get(l.b), va = S.vis.get(l.a), vb = S.vis.get(l.b), sway = calm ? 0 : Math.sin(t * 0.5 + A.x * 0.01) * 3;
    const a = cam.toScreen(A.x, A.y), b = cam.toScreen(B.x, B.y), d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d;
    const ra = A_WORLD * cam.k * va.s * 1.06, rb = A_WORLD * cam.k * vb.s * 1.06;  // rim to rim, never across a window
    if (d < ra + rb + 12) continue;
    ctx.globalAlpha = 0.8 * Math.min(va.a, vb.a) / 0.32; ctx.strokeStyle = ctx.fillStyle = S.ink; ctx.lineWidth = 1.2; ctx.lineCap = "round";
    drawEdge(ctx, l.type, [a[0] + ux * ra, a[1] + uy * ra + sway], [b[0] - ux * rb, b[1] - uy * rb - sway], 1); C.threads++;
  }
  for (const n of featured()) {
    const v = S.vis.get(n.id); if (v.a < 0.02) continue;
    const [x, y] = cam.toScreen(n.x, n.y), A = A_WORLD * cam.k * v.s * (calm ? 1 : 1 + 0.025 * Math.sin(t * 0.7 + n.x * 0.01));
    if (x + A < 0 || y + A < 0 || x - A > cam.w || y - A > cam.h) continue;
    aperture(ctx, u.region.get(n.region), x, y, A, S.ink, t, calm, v.a); C.grounds++;
    ctx.globalAlpha = Math.min(1, v.a * 1.8); ctx.strokeStyle = S.ink; ctx.lineWidth = n.id === focus ? 2 : 1;
    ctx.beginPath(); ctx.arc(x, y, A, 0, 6.2832); ctx.stroke(); C.marks++;
  }
  ctx.globalAlpha = 1;
  window.__frame = C; window.__grounds = C.grounds;
}

const btn = new Map();
function buildDom() {
  const box = document.getElementById("nodes");
  for (const n of featured()) {
    const b = document.createElement("button");
    b.type = "button"; b.className = `node feat r-${n.region}`; b.tabIndex = -1; b.dataset.id = n.id;
    b.innerHTML = `<span class="t"></span>`; b.firstChild.textContent = n.title;
    b.addEventListener("click", () => { if (cam.dragged()) return; if (S.focus === n.id) enter(n.id); else focus(n.id); });
    box.append(b); btn.set(n.id, b);
  }
  (btn.get("flywheel") || btn.values().next().value).tabIndex = 0;  // the map is one tab stop; arrows move within it
}
function place() {
  if (!S.u || !btn.size || !S.here) return;
  for (const [id, b] of btn) {
    const n = S.u.byId.get(id), [x, y] = cam.toScreen(n.x, n.y), v = S.vis.get(id), t = target(id);
    b.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    b.style.setProperty("--a", `${Math.round(A_WORLD * cam.k * (v?.s ?? 1))}px`);
    b.classList.add("named"); b.classList.toggle("is-here", id === S.focus);
    b.dataset.layer = t.a > 0.4 ? "front" : t.a > 0.1 ? "near" : S.focus ? "back" : "rest";
  }
  if (!S.focus) S.here.focus(null);
}

export async function focus(id, { via = null, fromId = null, quiet = false, push = true } = {}) {
  const n = S.u.byId.get(id); if (!n) return;
  if (!n.featured) { location.href = `place.html?n=${encodeURIComponent(id)}`; return; }  // the rest is met in its own place
  const my = ++S.seq, rec = begin(via ? "drift" : "focus", id);
  S.focus = id; retarget(performance.now()); trail.push(id); S.here.focus(id); place();
  if (!quiet) card(S.u, n, { onDrift: (to, e) => focus(to, { via: e, fromId: id }), onEnter: () => enter(id) });
  root.classList.remove("opening");
  S.tau = S.tourIndex ? S.tourIndex(id) : S.tau; S.here.progress?.((S.tau + 1) / 7);
  if (push && !quiet && new URLSearchParams(location.search).get("n") !== id) history.pushState({ n: id }, "", `?n=${encodeURIComponent(id)}`);
  if (!quiet) S.announce?.(S.where(id));
  const k = Math.max(cam.fit * 1.15, Math.min(cam.k, cam.fit * 2));
  if (via && fromId) { const A = S.u.byId.get(fromId); await cam.go(n.x, n.y, k, 1100, [[A.x, A.y], [(A.x + n.x) / 2 + (n.y - A.y) * 0.12, (A.y + n.y) / 2 - (n.x - A.x) * 0.12], [n.x, n.y]]); }
  else await cam.go(n.x, n.y, k, 900);
  if (my !== S.seq) return;  // a newer choice took over mid-flight
  rec.end = performance.now() + (still() ? 0 : 982);  // the camera has landed; the layer tween (0.224 + 0.758 s) is the tail
  prepare(n);  // one step away: the page loads while the card is read, so entering costs no stall
  const before = S.u.byId.get(trail.get().slice(-2, -1)[0]);  // and the seam that will carry the visitor in
  if (before) prepareSeam(seamFor(before, n, S.u), before, n, S.u);
  for (const b of btn.values()) b.tabIndex = -1;
  btn.get(id).tabIndex = 0;
  if (document.activeElement?.closest?.("#stage")) btn.get(id).focus({ preventScroll: true });
}
export function unfocus() { S.seq++; S.focus = null; retarget(performance.now()); card(S.u, null); place(); }
// a scroll that passes a place: the place comes forward and its card opens, the camera stays with the wheel
function quietFocus(id) {
  const n = S.u.byId.get(id); S.focus = id; retarget(performance.now()); trail.push(id); S.here.focus(id); place();
  card(S.u, n, { onDrift: (to, e) => focus(to, { via: e, fromId: id }), onEnter: () => enter(id) });
  clearTimeout(S.prep); S.prep = setTimeout(() => { if (S.focus !== id) return; prepare(n); const b = S.u.byId.get(trail.get().slice(-2, -1)[0]); if (b) prepareSeam(seamFor(b, n, S.u), b, n, S.u); }, 900);  // load the page only once the scroll rests here
}

// Enter: the window grows until it is the page. Leave: the page shrinks back into its window.
export async function enter(id, { push = true } = {}) {
  const n = S.u.byId.get(id), my = ++S.seq, prev = trail.get().slice(-2, -1)[0], rec = begin("enter", id);
  if (S.focus !== id) { S.focus = id; retarget(performance.now()); }
  card(S.u, null);
  if (push) history.pushState({ in: id }, "", `?n=${encodeURIComponent(id)}&in=1`);
  const kIn = Math.hypot(cam.w, cam.h) / 2 / (A_WORLD * 1.22) * 1.02;
  const ring = () => { const [x, y] = cam.toScreen(n.x, n.y); return { x, y, r: A_WORLD * cam.k * (S.vis.get(id)?.s ?? 1) }; };
  enterRoom(n, { ring, seam: seamFor(S.u.byId.get(prev), n, S.u), from: S.u.byId.get(prev), u: S.u });
  await cam.go(n.x, n.y, kIn, 1200);
  if (my !== S.seq) return;
  openNow(); rec.end = performance.now(); S.announce?.(`Inside ${n.title}. Escape returns to the map.`);
  document.getElementById("main").classList.add("inside");
}
export async function leave({ push = true } = {}) {
  if (!roomOpen()) return;
  const id = S.focus, n = S.u.byId.get(id), my = ++S.seq, rec = begin("leave", id);
  document.getElementById("main").classList.remove("inside");
  if (push) history.pushState({}, "", `?n=${encodeURIComponent(id)}`);
  leaveRoom();
  btn.get(id)?.focus({ preventScroll: true });  // keyboard focus comes back out of the page with the visitor
  await cam.go(n.x, n.y, cam.fit * 1.15, 1000);
  if (my !== S.seq) return;
  rec.end = performance.now(); S.announce?.(`Back on the map. ${S.where(id)}`);
  card(S.u, n, { onDrift: (to, e) => focus(to, { via: e, fromId: id }), onEnter: () => enter(id) });
}

async function main() {
  cam = camera(stage, () => { if (cv.width !== Math.max(1, Math.round(cam.w * cam.dpr)) || cv.height !== Math.max(1, Math.round(cam.h * cam.dpr))) size(); place(); });
  S.u = await load();
  cam.resize(); cam.x = WORLD.w / 2; cam.y = WORLD.h / 2; cam.k = cam.fit;
  const fly = S.u.nodes.find((n) => n.featured && n.region === "grid"), bands = {};
  for (const e of S.u.adj.get(fly.id)) bands[e.type] = (bands[e.type] || 0) + 1;
  setSurvey(Object.entries(bands).sort((a, b) => b[1] - a[1]));
  S.here = here(document.querySelector('[data-o="band"]'), S.u, { owner: "map", onWhole: () => { leave(); unfocus(); cam.fitAll(); },
    onPick: (to) => { const from = S.focus; if (roomOpen()) leave(); focus(to, from ? { via: true, fromId: from } : {}); } });
  for (const n of featured()) S.vis.set(n.id, { s: 1, a: 0.5 });
  buildDom(); size(); theme(); await preload();
  const jobs = [];  // the windows at rest, in focus and one step away, at the depths the camera visits
  for (const n of featured()) for (const s of [1, 1.22, 0.8, 0.5]) for (const k of [cam.fit, cam.fit * 1.15, cam.fit * 2]) jobs.push({ region: S.u.region.get(n.region), A: A_WORLD * k * s, ink: S.ink });
  prewarm(jobs);
  new MutationObserver(theme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", theme);
  initFind(S.u, { focus }); initKeys(S.u, cam, { focus, unfocus, leave, btn, S });
  S.onCam = place;
  initNav({ u: S.u, cam, S, focus, unfocus, enter, leave, quietFocus, here: S.here, WORLD });
  // the browser's history mirrors every move: a place, inside a place, or the whole map
  addEventListener("popstate", () => {
    const q = new URLSearchParams(location.search), id = q.get("n");
    if (q.has("in") && id) enter(id, { push: false });
    else if (id) { if (roomOpen()) leave({ push: false }); else focus(id, { push: false }); }
    else { if (roomOpen()) leave({ push: false }); unfocus(); cam.fitAll(); }
  });
  let vis = true; new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(stage);
  let lastDraw = 0;
  const tick = (now) => {
    const moving = cam.tick(now), tw = stepVis(now); if (moving || tw) place(); roomTick(now);
    if (vis && !roomOpen(true) && (!still() || moving || tw || now - lastDraw > 500)) { frame(now / 1000); lastDraw = now; }
  };
  // One clock for the page: the shell's shared clock (the alive layer runs on it too). It stops when the tab is
  // hidden and never starts under reduced motion, so a light fallback keeps instant moves and still frames drawn.
  const shared = window.UIShell?.clock;
  if (shared) {
    shared.subscribe((s) => tick(s * 1000));
    const fallback = (now) => { if (shared.running === false) tick(now); requestAnimationFrame(fallback); };
    requestAnimationFrame(fallback);
  } else { const loop = (now) => { tick(now); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  // the clock runs before any move is asked of it
  const q = new URLSearchParams(location.search), id = q.get("n");
  if (id && S.u.byId.has(id)) { if (q.has("in")) { await focus(id, { quiet: true }); enter(id, { push: false }); } else await focus(id); } else place();
  root.classList.add("ready");
}
main().catch((e) => { console.error("universe: failed to start", e); stage.dataset.failed = ""; });
