// Setback: the 1916 setback law built lot by lot and seen from six cameras, one per step.
import { camera, transition, project, placeLabels, toCanvas } from '../projector.js';
import { setbackCity } from '../lib/projector-scene.js';
import { reducedMotion } from '../lib/util.js';
import { grainTile, applyGrain, context2d, fitCanvas } from '../../substrate/lib/raster.mjs';

const LINES = [
  'Four lots joined into one, 120 feet by 60, on a street 60 feet wide.',
  'The street wall may rise to one and a half times the street.',
  'Above it, the mass steps back behind an inclined plane.',
  'Over a quarter of the lot, a tower may rise without limit.',
  'At street level the law reads as a skyline.',
  'Applied to every lot, the rule draws the city.',
];
const HOLD = 4.6; // s per step: reading holds of at least 4 s (QUALITY-SPEC M7)
const stage = document.getElementById('stage'), cv = document.getElementById('cv'), lab = document.getElementById('labels');
const line = document.getElementById('line'), nav = document.getElementById('steps'), RM = reducedMotion();
const { items } = setbackCity({ blocks: 2 });
const ctx = context2d(cv, { alpha: false }), tile = grainTile({ size: 256, sd: 1.4, clump: 2, seed: 19 });

function cams(w, h) {
  const s = Math.min(w, h * 1.1) / 900, port = w < 600, up = port ? -h * 0.06 : 0;
  return [
    camera('plan', { zoom: 34 * s * (port ? 1.5 : 1), yaw: -84, target: [0, 1, 0], offset: [0, up] }), // the plan turned 6 deg, as a sheet sits on the table
    camera('front', { zoom: 24 * s * (port ? 1.3 : 1), target: [0, 0, 11], offset: [0, up] }),
    camera('side', { zoom: 24 * s * (port ? 1.3 : 1), target: [0, 0, 11], offset: [0, up] }),
    camera('iso', { zoom: 19 * s * (port ? 1.25 : 1), target: [0, 2, 11], offset: [0, up] }),
    camera('persp', { zoom: 21 * s * (port ? 1.2 : 1), yaw: -72, pitch: 9, persp: 1, dist: 34, target: [-1.5, 1.5, 12], offset: [0, up] }),
    camera('iso', { zoom: 5.2 * s * (port ? 1.5 : 1), yaw: -38, pitch: 32, target: [0, 0, 4], offset: [0, up] }),
  ];
}

const spans = new Map();
for (const it of items) if (it.type === 'label') { const s = document.createElement('span'); s.textContent = it.text; if (it.color !== '#eee9df') s.className = 'hot'; lab.append(s); spans.set(it.id, s); }
const buttons = LINES.map((_, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = String(i + 1).padStart(2, '0'); b.setAttribute('aria-label', `Step ${i + 1}: ${LINES[i]}`); b.onclick = () => go(i, true); nav.append(b); return b; });

let sv0 = 0, dirty = true, W = 0, H = 0, C = [], k = RM ? 5 : 0, from = 0, tr = null, t0 = 0, stageV = RM ? 6 : 0, auto = !RM, state = new Map(), raf = 0, clockT = 0;
function size() {
  const r = stage.getBoundingClientRect(); W = r.width; H = r.height; fitCanvas(cv, { maxDpr: 2.5, maxPx: 4096, cssWidth: W, cssHeight: H }); C = cams(W, H);
  tr = { duration: 0, at: () => C[k] }; dirty = true; kick();
}
function go(i, user) {
  if (user) auto = false;
  from = k; k = i; tr = RM ? { duration: 0, at: () => C[k] } : transition(C[from], C[k], { scene: items, w: W, h: H }); t0 = performance.now() / 1000; if (i === 0 && !user && !RM) stageV = 0; sv0 = stageV;
  buttons.forEach((b, j) => (j === k ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
  line.textContent = LINES[k]; if (RM) stageV = 6; dirty = true; kick();
}
function draw(t) {
  const e = t - t0, cam = tr.at(Math.min(e, tr.duration)), dpr = cv.width / W;
  if (!RM) stageV = Math.min(k + 1, Math.max(stageV, sv0 + e / 1.2)); // each step's build rises over about 1.2 s
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#141412'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const list = project(items, cam, W, H, stageV); placeLabels(list, W, H, state); toCanvas(list.filter((x) => x.type !== 'label'), ctx);
  for (const l of list) if (l.type === 'label') { const [x, y] = l.q[0]; ctx.globalAlpha = l.alpha; ctx.strokeStyle = ctx.fillStyle = l.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(l.lx, l.ly + 3); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1; if (!/nograin/.test(location.search)) applyGrain(ctx, cv.width, cv.height, tile);
  const shown = new Set();
  for (const l of list) if (l.type === 'label') { const s = spans.get(l.id), wd = s.offsetWidth; shown.add(l.id); s.style.opacity = l.alpha.toFixed(3); s.style.transform = `translate(${(l.anchor === 'end' ? l.lx - wd : l.anchor === 'middle' ? l.lx - wd / 2 : l.lx).toFixed(1)}px,${(l.ly - 11).toFixed(1)}px)`; }
  for (const [id, s] of spans) if (!shown.has(id)) s.style.opacity = '0';
  return e < tr.duration || stageV < k + 1;
}
function frame(now) {
  raf = 0; clockT = now / 1000;
  const moving = dirty || clockT - t0 < tr.duration + 0.05 || stageV < k + 1; dirty = false;
  if (moving) { const q = performance.now(); draw(clockT); if (window.__perf) window.__perf.push(performance.now() - q); } // a held step costs nothing: the picture only redraws while something moves
  if (auto && clockT - t0 > tr.duration + HOLD) go((k + 1) % LINES.length);
  if (moving) raf = requestAnimationFrame(frame); else if (auto) setTimeout(kick, Math.max(16, (t0 + tr.duration + HOLD - clockT) * 1000));
}
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
new ResizeObserver(size).observe(stage);
document.fonts.ready.then(() => { size(); go(k); });
