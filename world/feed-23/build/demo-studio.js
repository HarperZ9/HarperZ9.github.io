// demo-studio.js: the painting room. Pen, finger or mouse paints live on a float surface; strokes are recorded
// in canvas-width units so the 4K export re-paints them rather than enlarging the screen.
import { Surface, liveStroke, preset, PRESETS, SCENES, linear } from './brush/index.js';
import { ctx2d, srgbImage } from './demo-canvas.js';
import { renderOff } from './demo-worker.js';

const BRUSHES = ['billow', 'wisp', 'haze', 'smear', 'blend', 'halo', 'filament', 'flare', 'sponge', 'rim'];
const INKS = ['#e9e8f4', '#9a9dc4', '#5b5f86', '#262a3a', '#0e0f15', '#c43a36', '#d9b46a'];
const GROUND = ['#0d0e14', '#15161f'];
const tick = () => new Promise((r) => setTimeout(r, 0));

export function studio(root, { dpr, reduced }) {
  const cv = root.querySelector('#paint'), ctx = ctx2d(cv), read = root.querySelector('#readout');
  const bar = root.querySelector('#progress'), barFill = bar.querySelector('span');
  const state = { brush: 'billow', ink: INKS[0], size: 1, ops: [], study: null, busy: false };
  let surf, W, H, live = null, op = null, seed = 1, raf = 0;

  function size() {
    W = Math.max(300, Math.round(cv.clientWidth * dpr)); H = Math.round(W * 4 / 3);
    cv.width = W; cv.height = H;
  }
  function blitAll() { const img = srgbImage(surf.toRGBA8(), W, H); ctx.putImageData(img, 0, 0); surf.takeDirty(); }
  function blitDirty() {
    raf = 0; const d = surf.takeDirty(); if (!d) return;
    const w = d.x1 - d.x0 + 1, h = d.y1 - d.y0 + 1;
    ctx.putImageData(srgbImage(surf.toRGBA8({ rect: d }), w, h), d.x0, d.y0);
  }
  const queue = () => { if (!raf) raf = requestAnimationFrame(blitDirty); };

  // studies paint in the worker; the float surface comes back so hand strokes keep painting on it
  async function repaint(name) {
    state.busy = true; setBusy(true);
    try {
      const r = await renderOff({ scene: name, width: W, out: 'float' }, (f) => { barFill.style.width = `${f * 100}%`; });
      surf = new Surface(r.w, r.h); surf.px = new Float32Array(r.buffer);
      ctx.putImageData(srgbImage(new Uint8ClampedArray(r.rgba), r.w, r.h), 0, 0); surf.takeDirty(); // converted in the worker
    } catch (err) { console.error('studio: study failed', err); read.textContent = `study failed: ${err.message}`; }
    finally { setBusy(false); state.busy = false; }
  }
  function setBusy(on) { bar.hidden = !on; root.querySelectorAll('.actions button').forEach((b) => { b.disabled = on; }); }

  function clear() {
    surf = new Surface(W, H).fill(linear(GROUND[0]), linear(GROUND[1])); state.ops = []; state.study = null; blitAll();
    read.textContent = 'draw here';
  }

  // brush buttons and ink chips
  const bwrap = root.querySelector('#brushes');
  for (const name of BRUSHES) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = name; b.setAttribute('aria-pressed', String(name === state.brush));
    b.addEventListener('click', () => { state.brush = name; bwrap.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
    bwrap.append(b);
  }
  const iwrap = root.querySelector('#inks');
  for (const ink of INKS) {
    const b = document.createElement('button'); b.type = 'button'; b.style.background = ink; b.setAttribute('aria-label', `ink ${ink}`); b.setAttribute('aria-pressed', String(ink === state.ink));
    b.addEventListener('click', () => { state.ink = ink; iwrap.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
    iwrap.append(b);
  }
  root.querySelector('#size').addEventListener('input', (e) => { state.size = Number(e.target.value); });

  // pointer painting: pressure and tilt from a pen; a mouse reports none, so pressure comes from speed
  const sample = (e) => {
    const r = cv.getBoundingClientRect(), k = W / r.width;
    const pen = e.pointerType === 'pen' || (e.pointerType === 'touch' && e.pressure > 0 && e.pressure !== 0.5);
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, p: pen ? e.pressure : undefined, tiltX: e.tiltX || 0, tiltY: e.tiltY || 0, t: e.timeStamp / 1000 };
  };
  cv.addEventListener('pointerdown', (e) => {
    if (state.busy) return;
    try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointers cannot be captured; painting still works */ }
    const b = PRESETS[state.brush], over = { size: b.size * state.size };
    live = liveStroke(surf, preset(state.brush, over), { unit: W, seed: ++seed, color: state.ink });
    op = { b: state.brush, c: state.ink, over, seed, live: true, pts: [] };
    add(e);
  });
  function add(e) {
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of list.length ? list : [e]) { const s = sample(ev); live.add(s); op.pts.push({ ...s, x: s.x / W, y: s.y / W }); }
    const s = sample(e);
    read.textContent = `${state.brush} · pressure ${s.p === undefined ? 'from speed' : s.p.toFixed(2)} · tilt ${s.tiltX}°, ${s.tiltY}° · ${surf.dabs} dabs`;
    queue();
  }
  cv.addEventListener('pointermove', (e) => { if (live) add(e); });
  const end = () => { if (live) { state.ops.push(op); live = null; op = null; } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

  root.querySelector('#clear').addEventListener('click', clear);
  root.querySelector('#study-a').addEventListener('click', () => { state.study = 'nocturne'; state.ops = []; repaint('nocturne'); });
  root.querySelector('#study-b').addEventListener('click', () => { state.study = 'starcloud'; state.ops = []; repaint('starcloud'); });

  // Export: re-paint the study and every hand stroke at 2880 x 3840 (3840 on the long side). Two files: the
  // 16-bit master for further work, and an 8-bit copy with TPDF dither for viewing, since a viewer that drops a
  // 16-bit file to 8 bits without dither shows steps the master does not have.
  async function exportPng(bits) {
    if (state.busy) return;
    state.busy = true; setBusy(true);
    try {
      const base = state.study ? SCENES[state.study]() : { ground: GROUND, ops: [] };
      const scene = { aspect: 4 / 3, ground: base.ground, ops: [...base.ops, ...state.ops] };
      // painted and encoded in the worker, so the page stays responsive through a 2880 x 3840 render
      const r = await renderOff({ scene, width: 2880, out: bits === 16 ? 'png16' : 'png8' }, (f) => { barFill.style.width = `${f * 100}%`; read.textContent = `painting at 2880 x 3840: ${Math.round(f * 100)}%`; });
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.buffer], { type: 'image/png' }));
      a.download = `${state.study ?? 'painting'}-2880x3840-${bits === 16 ? '16bit-master' : '8bit-view'}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      read.textContent = `exported ${r.w} x ${r.h}, ${bits} bits per channel, sRGB, ${(r.buffer.byteLength / 1e6).toFixed(1)} MB`;
    } catch (err) {
      console.error('studio: export failed', err); read.textContent = `export failed: ${err.message}`;
    } finally { setBusy(false); state.busy = false; }
  }
  root.querySelector('#export').addEventListener('click', () => exportPng(16));
  root.querySelector('#export-view').addEventListener('click', () => exportPng(8));

  size(); clear();
  // open on the nocturne study (the hero already shows the star cloud); a still painting, so reduced motion is unaffected
  state.study = 'nocturne'; repaint('nocturne');
  return { state };
}
