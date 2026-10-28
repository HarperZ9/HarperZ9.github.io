// Caustic: light through a moving surface of dense flint, on a two-clock cadence: the surface re-poses on twos at 24.
import { surface, field, splat, peak, render, GLASS } from '../caustic.js';
import { createCausticGL } from '../lib/caustic-gl.js';
import { clock } from '../cadence.js';
import { reducedMotion } from '../lib/util.js';
import { fitCanvas } from '../../substrate/lib/raster.mjs';
import { toCanvas } from '../lib/raster.js';

const stage = document.getElementById('stage'); let cv = document.getElementById('cv'); const RM = reducedMotion(), SEED = 3, ck = clock('twos-24', { seed: SEED });
const tilt = { x: 0, y: 0, tx: 0, ty: 0 }, budget = { left: 4 };
let gl = null, last = -1, raf = 0, t0 = performance.now();
try { gl = createCausticGL(cv, { glass: GLASS.flint }); } catch (e) { console.info('caustic: CPU path,', e.message); const c = cv.cloneNode(); cv.replaceWith(c); cv = c; } // a canvas that once held a WebGL context cannot give a 2D one

const light = () => { const v = [-tilt.x * 0.35, -tilt.y * 0.35, -1], m = Math.hypot(...v); return v.map((x) => x / m); };
// The flare's home: the brightest caustic, found on a coarse CPU trace of the same surface (cheap, once per pose).
function home(surf, L) {
  const w = 64, h = Math.max(16, Math.round((64 * cv.height) / cv.width)), b = splat(field(surf), { w, h, n: 72, M: 2, L, seed: 9 }), [px, py] = peak(b);
  return [((px + 0.5) / w) * cv.width, ((py + 0.5) / h) * cv.height];
}
const FULL = 896; let pose = null;
function draw(t, index, fresh) {
  if (!gl) { const surf = surface(SEED, t, 1.6), w = Math.min(480, cv.width), h = Math.round((w * cv.height) / cv.width), c = document.createElement('canvas'); toCanvas(render({ w, h, n: 300, M: 8, t, L: light() }), c); cv.getContext('2d').drawImage(c, 0, 0, cv.width, cv.height); return true; }
  if (fresh) { const surf = surface(SEED, t, 1.6), L = light(); pose = { surf, L, peak: home(surf, L), seed: index * 2654435761 }; }
  const q = performance.now(); gl.draw(pose.surf, { ...pose, accumulate: !fresh, full: FULL });
  if (budget.left > 0) { gl.gl.finish(); const ms = performance.now() - q; budget.left--; if (ms > 14) { gl.photons *= Math.sqrt(14 / ms); budget.left = 2; } } // fit one batch to this GPU's frame budget
  return gl.done >= FULL * FULL; // converged: the pose may move on
}
function size() { fitCanvas(cv, { maxDpr: 2.5, maxPx: 4096 }); last = -1; kick(); }
let converged = true;
function frame(now) {
  raf = 0; const t = RM ? 2 : (now - t0) / 1000, st = ck.at(t);
  tilt.x += (tilt.tx - tilt.x) * 0.2; tilt.y += (tilt.ty - tilt.y) * 0.2;
  const moving = Math.abs(tilt.tx - tilt.x) + Math.abs(tilt.ty - tilt.y) > 1e-3;
  // a new pose waits for the last one to converge, so a slow GPU slows the motion, never the picture
  if ((st.index !== last || moving) && converged) { last = st.index; converged = draw(st.start, st.index, true); }
  else if (!converged) converged = draw(st.start, st.index, false);
  if (!RM || moving || !converged) raf = requestAnimationFrame(frame);
}
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
stage.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); tilt.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; tilt.ty = ((e.clientY - r.top) / r.height - 0.5) * 2; kick(); });
stage.addEventListener('keydown', (e) => { const d = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2] }[e.key]; if (!d) return; e.preventDefault(); tilt.tx = Math.max(-1, Math.min(1, tilt.tx + d[0])); tilt.ty = Math.max(-1, Math.min(1, tilt.ty + d[1])); kick(); });
new ResizeObserver(size).observe(stage);
