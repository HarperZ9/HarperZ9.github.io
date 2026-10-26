// living/living.mjs: the living type specimen. Each passage is one word walked through its stops; the visitor's
// scroll is the road position s, the shell's clock is t. The worker paints and simulates; the GPU composites.
// The word is real text in the DOM, laid exactly over the canvas, and changes when a reveal brings up the next word.
import { createLivingGL } from '../web/living-gl.mjs';
import { PASSAGE_BAKES } from './bakes.mjs';

import { PASSAGES } from './passages.mjs';
export { PASSAGES };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const main = document.getElementById('main'), say = document.getElementById('say');
const worker = new Worker(new URL('../web/living-worker.mjs', import.meta.url), { type: 'module' });
const live = new Map(), pending = new Set();
const ask = (P, op, i) => { const k = `${P.id}/${op}/${i}`; if (pending.has(k) || P.g?.has(op, i)) return; pending.add(k); worker.postMessage({ id: P.id, op, i }); };

worker.onerror = (e) => console.error('[living] worker failed to load:', e.message, e.filename, e.lineno);
worker.onmessage = (ev) => {
  const m = ev.data, P = live.get(m.id); if (!P) return;
  if (m.op === 'error') { console.error('[living] worker:', m.message); return; }
  if (m.op === 'init') { P.stops = m.stops; P.ready = true; place(P, 0); return; }
  pending.delete(`${m.id}/${m.op}/${m.i}`);
  if (m.op === 'stop') P.g.stop(m.i, m.part); else { P.g.move(m.i, m.part); P.seconds[m.i] = m.part.seconds; (P.moves ??= {})[m.i] = { breath: m.part.breath, breath2: m.part.breath2 }; }
  P.dirty = true;
};

function build(spec) {
  const sec = document.createElement('section'); sec.className = 'passage'; sec.setAttribute('aria-label', spec.title);
  sec.style.height = `${spec.stops.length * 70 + 40}vh`;
  const stage = document.createElement('div'); stage.className = 'stage';
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.dataset.art = '';
  const word = document.createElement('p'); word.className = 'word';
  stage.append(canvas, word); sec.append(stage); main.append(sec);
  const css = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.min(2400, Math.round(css.width * dpr)), h = Math.round(w * 380 / 1120);
  canvas.width = w; canvas.height = h;
  let g = null; try { g = createLivingGL(canvas); } catch (e) { console.error('[living] WebGL2 failed:', e); }
  const P = { ...spec, sec, stage, canvas, word, g, w, h, seconds: {}, s: 0, shown: -1, dirty: true, near: false };
  live.set(spec.id, P);
  if (!g) { word.style.color = 'var(--ink)'; return P; }
  const bake = PASSAGE_BAKES.filter((b) => b.id === spec.id).map((b) => ({ ...b, url: new URL(`baked/${b.id}-${b.state}.png`, import.meta.url).href }));
  // one display size for every word (a hierarchy of one display level); a long name is fitted to the stage instead
  const size = spec.fit ? null : Math.round(Math.min(0.2 * w, 0.46 * h));
  worker.postMessage({ id: spec.id, op: 'init', w, h, stops: spec.stops, seed: 1, bake, size });
  new IntersectionObserver(([e]) => { P.near = e.isIntersecting; }, { rootMargin: '100% 0px' }).observe(sec);
  return P;
}

// the real text, over the painted word: same face, size and baseline as the canvas layout
function place(P, i) {
  if (i === P.shown || !P.stops) return; P.shown = i;
  const st = P.stops[i], k = P.stage.clientWidth / P.w, L = st.layout;
  P.word.textContent = st.text; P.word.lang = st.lang ?? 'en';
  P.word.style.fontSize = `${L.size * k}px`; P.word.style.left = `${L.x * k}px`; P.word.style.top = `${(L.baseline - L.size * 0.8) * k}px`;
  if (i > 0 && st.text !== P.stops[i - 1].text) say.textContent = `${st.text}${st.note ? `, ${st.note}` : ''}`;
}

function frame(t) {
  for (const P of live.values()) {
    if (!P.g || !P.ready || !P.near) continue;
    const r = P.sec.getBoundingClientRect(), q = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    const n = P.stops.length, s = reduced ? Math.round(q * (n - 1)) : q * (n - 1), i = Math.min(n - 1, Math.floor(s)), local = s - i, lead = 0.35;
    ask(P, 'stop', i); if (i + 1 < n) { ask(P, 'move', i); ask(P, 'stop', i + 1); }
    let drawn;
    if (reduced || i === n - 1 || local <= lead) { drawn = P.g.draw({ i, mode: 'stop', t: reduced ? 0 : t }); place(P, i); }
    else { const p = (local - lead) / (1 - lead); drawn = P.g.draw({ i, p, mode: 'move', t, breath: P.moves?.[i]?.breath, breath2: P.moves?.[i]?.breath2 }) || P.g.draw({ i, mode: 'stop', t }); place(P, p > 0.5 && P.stops[i + 1].text !== P.stops[i].text ? i + 1 : i); }
    if (!drawn) P.g.draw({ i, mode: 'stop', t });
  }
}

for (const spec of PASSAGES) build(spec);
const t0 = performance.now(), tick = () => frame((performance.now() - t0) / 1000);
if (window.UIShell?.clock) window.UIShell.clock.subscribe(tick); else { const loop = () => { tick(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
addEventListener('resize', () => { for (const P of live.values()) { P.shown = -1; place(P, Math.max(0, P.shown)); } });
window.__living = live; // inspection hook for tests
