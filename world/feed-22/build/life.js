// Demo wiring for the ecosystem room: simulate, splat, colour, and let a viewer drop food.
import { World, splat } from './swimmers.js';

// Our own two-ink ramp: heat runs from the ground through a deep blue to ember and bone; cool is a pale cyan line.
const STOPS = [[0, [5, 5, 8]], [0.18, [22, 26, 64]], [0.42, [126, 52, 92]], [0.7, [236, 120, 58]], [1, [248, 238, 214]]];
const LUT = new Uint8ClampedArray(256 * 3);
for (let i = 0; i < 256; i++) {
  const t = i / 255; let k = 0; while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
  const [t0, a] = STOPS[k], [t1, b] = STOPS[k + 1], u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  for (let c = 0; c < 3; c++) LUT[i * 3 + c] = a[c] + (b[c] - a[c]) * u;
}
const COOL = [150, 220, 235];

export function startLife(reduce) {
  const cv = document.getElementById('life'), out = document.getElementById('life-readout');
  if (!cv) { console.warn('life room missing'); return; }
  let g; try { g = cv.getContext('2d', { colorSpace: 'display-p3' }); } catch (e) { console.warn('life: no display-p3 canvas', e); g = cv.getContext('2d'); }  // drawImage is colour-managed into P3 (R5)
  const OPTS = { W: 560, H: 360, swimmers: 34, pellets: 6 };
  let w = new World({ seed: 22, ...OPTS });
  // Backing store at the device pixel ratio; the field is splatted at half that and smoothed up, with TPDF
  // dither on the colour ramp so the glows do not band (quality pass, 2026-10-23).
  const fit = () => { const dpr = Math.min(devicePixelRatio || 1, 2.5); const W = Math.min(2800, Math.round(cv.clientWidth * dpr)); if (W && cv.width !== W) { cv.width = W; cv.height = Math.round(W * w.o.H / w.o.W); } };
  fit(); addEventListener('resize', fit);
  const GW = Math.max(300, Math.min(560, Math.round(cv.width / 3))), GH = Math.round((GW * w.o.H) / w.o.W), off = new OffscreenCanvas(GW, GH), og = off.getContext('2d'), img = og.createImageData(GW, GH);
  // TPDF dither table, cycled with a per-frame offset (cheaper than two random draws per pixel)
  const DT = new Float32Array(4093); { let s = 1; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; for (let i = 0; i < DT.length; i++) DT[i] = r() - r(); }
  let frameNo = 0, visible = true;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; last = 0; }).observe(cv);
  let pecks = 0, absorbed = 0;

  function render() {
    const f = splat(w, GW), d = img.data, off0 = (frameNo++ * 977) % DT.length;
    for (let p = 0; p < GW * GH; p++) {
      const hf = 255 * (1 - Math.exp(-f.heat[p] * 1.4)), h = Math.min(255, hf | 0), u = Math.min(1, hf - h), h2 = Math.min(255, h + 1), c = Math.min(1, f.cool[p] * 0.9), o = p * 4;
      const n = DT[(p + off0) % DT.length], k = c * (1 - hf / 255);
      for (let ch = 0; ch < 3; ch++) { const base = LUT[h * 3 + ch] + (LUT[h2 * 3 + ch] - LUT[h * 3 + ch]) * u; d[o + ch] = base + (COOL[ch] - base) * k + n; }
      d[o + 3] = 255;
    }
    og.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(off, 0, 0, cv.width, cv.height);
    const big = w.swimmers.filter((s) => s.dir < 0).length;
    out.textContent = `swimmers ${w.swimmers.length} (${big} grown) · pellets ${w.pellets.length} · pool ${w.pool.toFixed(1)} · pecks ${pecks} · taken in ${absorbed}`;
  }
  function advance(n) { for (let i = 0; i < n; i++) { w.step(1 / 60); for (const e of w.events) { if (e.kind === 'peck') pecks++; if (e.kind === 'absorb') absorbed++; } } }
  let acc = 0; var last = 0; // fixed 60 Hz simulation clock, independent of the display rate
  function loop(now) { if (!visible) { requestAnimationFrame(loop); return; } const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60; last = now; acc += dt; let n = 0; while (acc >= 1 / 60 && n < 6) { advance(1); acc -= 1 / 60; n++; } if (n === 6) acc = 0; if (n) render(); requestAnimationFrame(loop); }

  const drop = (x, y) => { const p = w.addPellet(x, y, 6); if (!p) out.textContent = 'the pool is too low to pay for more food'; else if (reduce) { advance(30); render(); } };
  cv.addEventListener('click', (e) => { const r = cv.getBoundingClientRect(); drop(((e.clientX - r.left) / r.width) * w.o.W, ((e.clientY - r.top) / r.height) * w.o.H); });
  cv.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(w.o.W / 2, w.o.H / 2); } });
  document.getElementById('life-step').addEventListener('click', () => { advance(60); render(); });
  document.getElementById('life-reset').addEventListener('click', () => { w = new World({ ...OPTS, seed: 22 + Math.floor(Math.random() * 1000) }); pecks = absorbed = 0; if (reduce) { advance(1200); } render(); });

  advance(reduce ? 1200 : 240); render();
  if (!reduce) requestAnimationFrame(loop);
}
