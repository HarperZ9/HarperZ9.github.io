// orbital-room.js: the orbital room. Physics runs in orbital-worker.js, painting in
// orbital-paint-worker.js; this file keeps the display clock, the controls and the notation.
// Frames are painted 12 per second (24 on twos, QUALITY-SPEC M5), near the 12.5 on-twos cadence measured in this set;
// the clock stalls rather than skips when the physics falls behind.
import { makeState, stateName, energy } from './orbital.js';
import { saveCanvas } from './demo.js';

const SPACE = 'display-p3';   // QUALITY-SPEC R5, see demo.js
const RM = matchMedia('(prefers-reduced-motion: reduce)'), root = document.documentElement;
const AU_AS = 24.188843;    // one atomic unit of time in attoseconds
const STATES = {
  '1s2p': { terms: [{ n: 1, l: 0, m: 0, c: 1 }, { n: 2, l: 1, m: 0, c: 1, group: 1 }] },
  '2s3d': { terms: [{ n: 2, l: 0, m: 0, c: 1 }, { n: 3, l: 2, m: 0, c: 1, group: 1 }] },
  '3s4f': { terms: [{ n: 3, l: 0, m: 0, c: Math.SQRT2 }, { n: 4, l: 3, m: 2, c: 1, group: 1 }, { n: 4, l: 3, m: -2, c: -1, group: 1 }] },
  '4f5g': { terms: [{ n: 4, l: 3, m: -3, c: 1 }, { n: 5, l: 4, m: -3, c: 1, group: 1 }] },
  '5g6g': { terms: [{ n: 5, l: 4, m: 4, c: 1 }, { n: 5, l: 4, m: -4, c: 1 }, { n: 6, l: 4, m: 4, c: 1, group: 1 }, { n: 6, l: 4, m: -4, c: 1, group: 1 }] },
};

function frac(c) {
  const table = [[1, '1'], [Math.SQRT1_2, '1/√2'], [0.5, '1/2'], [Math.sqrt(1 / 3), '1/√3'], [Math.sqrt(2 / 3), '√(2/3)']];
  for (const [v, s] of table) if (Math.abs(c - v) < 1e-9) return s;
  return c.toFixed(3);
}

// |Psi(t)> as HTML from the state itself: coefficient, phase e^{-i E_n t}, and the ket |n, l, m>.
function ketHTML(S) {
  return '<span class="ket">|Ψ(t)⟩</span> = ' + S.terms.map((k, i) => {
    const c = Math.hypot(k.cr, k.ci), sign = k.cr < 0 ? '−' : (i ? '+' : '');
    return `${sign ? `<span class="op">${sign}</span>` : ''}<span class="term g${k.group}"><span class="c">${frac(c)}</span> e<sup>−iE<sub>${k.n}</sub>t</sup> <span class="ket">|${k.n}, ${k.l}, ${k.m < 0 ? '−' + -k.m : k.m}⟩</span></span>`;
  }).join(' ');
}

export function orbitalRoom() {
  const cv = document.getElementById('orb'); if (!cv) return;
  const ket = document.getElementById('orb-ket'), beatEl = document.getElementById('orb-beat');
  const phys = new Worker(new URL('./orbital-worker.js', import.meta.url), { type: 'module' });
  const paint = new Worker(new URL('./orbital-paint-worker.js', import.meta.url), { type: 'module' });
  for (const w of [phys, paint]) {
    w.onerror = e => { console.error('orbital worker failed', e.message || e); ket.textContent = 'The orbital could not run in this browser.'; };
    w.onmessageerror = e => console.error('orbital worker message could not be read', e);
  }
  let job = 0, tau = 0, last = performance.now(), period = 1, have = -1, waiting = false, visible = true, name = '2s3d', stillTau = 0, accum = 0;
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; })).observe(cv);
  const count = () => (matchMedia('(max-width: 700px)').matches ? 22000 : 42000);
  function size() {
    // animated frames cap the backing store at 2x (paint time grows with pixels); stills use the full ratio
    const dpr = Math.min(RM.matches ? 3 : 2, window.devicePixelRatio || 1), r = cv.getBoundingClientRect(), W = Math.round(r.width * dpr), H = Math.round(r.width * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    // dot size scales with the frame, not only the pixel ratio: 42k points were tuned on a 600 px frame
    paint.postMessage({ type: 'size', W, H, dpr: Math.max(dpr, W / 600) * (count() < 30000 ? 1.25 : 1), bg: [5, 6, 8] });
  }
  function start(id) {
    name = id; const st = STATES[id], S = makeState(st.terms); job++; tau = RM.matches ? stillTau : 0; have = -1; waiting = false;
    ket.innerHTML = ketHTML(S); ket.setAttribute('aria-label', `${stateName(S)}: ${ket.textContent}`);
    const dE = Math.abs(energy(Math.max(...S.terms.map(k => k.n))) - energy(Math.min(...S.terms.map(k => k.n))));
    beatEl.textContent = `${(2 * Math.PI / dE * AU_AS / 1000).toFixed(2)} femtoseconds`;
    for (const b of document.querySelectorAll('[data-orb]')) b.setAttribute('aria-pressed', String(b.dataset.orb === id));
    size();
    phys.postMessage({ type: 'state', terms: st.terms, count: count(), seed: 24, still: RM.matches, tau });
  }
  phys.onmessage = e => {
    const m = e.data; if (m.job !== job) return;
    if (m.type === 'init') { period = m.period; paint.postMessage({ type: 'reset', job, extent: m.extent * 0.8, step: m.step }); return; }
    if (m.type === 'snap') { have = Math.max(have, m.k); paint.postMessage({ ...m, type: 'snap' }, [m.pos.buffer, m.w.buffer, m.d.buffer, m.vis.buffer]); if (RM.matches) request(); }
  };
  paint.onmessage = e => {
    const m = e.data;
    if (m.type === 'export') {
      const btn = document.getElementById('orb-save'); btn.disabled = false; btn.textContent = 'Save a 3840 px still';
      if (!m.rgba) { console.error('orbital export: no snapshot yet'); return; }
      const big = document.createElement('canvas'); big.width = m.W; big.height = m.H;
      big.getContext('2d', { colorSpace: SPACE }).putImageData(new ImageData(m.rgba, m.W, m.H, { colorSpace: 'srgb' }), 0, 0);
      saveCanvas(big, `orbital-${name}-3840.png`).catch(err => console.error('orbital export failed', err));
      return;
    }
    waiting = false;
    if (!m.ready) return;
    if (cv.width !== m.W || cv.height !== m.H) return;
    cv.getContext('2d', { colorSpace: SPACE }).putImageData(new ImageData(m.rgba, m.W, m.H, { colorSpace: 'srgb' }), 0, 0);
    phys.postMessage({ type: 'ack', job, k: m.k });
  };
  const request = () => { if (waiting) return; waiting = true; paint.postMessage({ type: 'frame', tau: RM.matches ? 0 : tau, id: performance.now(), spin: 0 }); };
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000)   // dt clamp: a stalled tab never jumps the clock; last = now;
    const run = !RM.matches && visible && !document.hidden && !root.classList.contains('plain');
    if (run) {
      // advance only while the next snapshot exists, so a slow machine slows the film instead of skipping
      if (tau + dt < (have + 0) * 0.2) tau += dt;
      accum += dt; if (accum >= 1 / 12) { accum -= 1 / 12; request(); }   // QUALITY-SPEC M5: declared cadence 12 (24 on twos)
    }
    requestAnimationFrame(loop);
  }
  document.getElementById('orb-save')?.addEventListener('click', e => { e.currentTarget.disabled = true; e.currentTarget.textContent = 'Rendering 3840 px'; paint.postMessage({ type: 'export', W: 3840, tau: RM.matches ? 0 : tau }); });
  for (const b of document.querySelectorAll('[data-orb]')) b.addEventListener('click', () => start(b.dataset.orb));
  for (const b of document.querySelectorAll('[data-orb-still]')) b.addEventListener('click', () => {
    stillTau = +b.dataset.orbStill; document.querySelectorAll('[data-orb-still]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); start(name);
  });
  let rt = 0; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { size(); request(); }, 150); }).observe(cv.parentElement);
  start('2s3d'); requestAnimationFrame(loop);
}

orbitalRoom();
