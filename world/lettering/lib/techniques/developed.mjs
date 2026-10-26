// Developed: the word is a latent image on silver paper and comes up where attention rests, as a print does in the
// developer tray. Density follows the Hurter and Driffield curve in techniques/lib/develop.js, so the darkest parts
// (the letter cores) arrive first and the halation at the edges last. Nothing un-develops. If the reader does nothing,
// a slow reading sweep develops the line on its own, left to right: attention is offered, never required.
// While any grain is still coming up the sheet sits under the red safelight; once the print is fixed the light changes.
import { densityInf, attention, HD } from '../../../techniques/lib/develop.js';
import { canvas, rng, fbm, clamp } from '../paint.mjs';
import { bilinear } from '../fields.mjs';

export const meta = {
  id: 'developed', title: 'Developed', renderer: '2d', ground: 'own', weight: 800, workScale: 1,
  lineage: 'The silver gelatin print in the developer tray; Hurter and Driffield\'s characteristic curve (1890).',
  does: 'A latent word develops where you dwell. Left alone, a slow sweep develops it for you.',
  params: { sweep: 'seconds for the unattended sweep, 3.5 to 7 (default width / 160 px)', tau: 'development time constant, 1.6 s (H and D model in develop.js)' },
};

// Exposure: the letter, a soft halation around it (light scattered in the emulsion), and a little grain.
export function exposure(g, seed = 1) {
  const { w, h, sdf } = g, E = new Float32Array(w * h), R = rng(seed), hal = Math.max(1, g.half * 0.35);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, d = sdf[i], core = clamp(0.5 + d * 0.9), glow = d < 0 ? 0.16 * Math.exp(d / hal) : 0;
    E[i] = clamp(core * 0.9 + glow + (fbm(x / 1.7, y / 1.7, seed, 2) - 0.5) * 0.05 + (R() - 0.5) * 0.025);
  }
  return E;
}

export async function create(g, env) {
  const { w, h } = g, E = exposure(g, env.seed % 53), Ei = Uint8Array.from(E, v => Math.round(v * 255));
  const lutInf = new Float32Array(256); for (let i = 0; i < 256; i++) lutInf[i] = densityInf(i / 255);
  const refl = new Float32Array(1024); for (let i = 0; i < 1024; i++) refl[i] = Math.pow(10, -(i / 1023) * HD.dmax);
  const gw = Math.max(16, Math.round(w / 10)), gh = Math.max(6, Math.round(h / 10)), att = attention(gw, gh), kGrid = new Float32Array(gw * gh);
  const off = canvas(w, h), ox = off.getContext('2d'), img = ox.createImageData(w, h), D = img.data;
  const sweep = env.opts.sweep ?? Math.max(3.5, Math.min(7, w / 160)), q = 1023 / HD.dmax;
  const st = { ptr: null, last: null, fixed: false, dirty: true, auto: 0 };
  function render() {
    let done = true;
    for (let i = 0; i < kGrid.length; i++) { kGrid[i] = 1 - Math.exp(-att.t[i] / HD.tau); if (kGrid[i] < 0.985) done = false; }
    const sx = (gw - 1) / (w - 1), sy = (gh - 1) / (h - 1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, Dn = lutInf[Ei[i]] * bilinear(kGrid, gw, gh, x * sx, y * sy), r = refl[Math.min(1023, (Dn * q) | 0)], j = i * 4;
      D[j] = 246 * r; D[j + 1] = 241 * r; D[j + 2] = 230 * r; D[j + 3] = 255;
    }
    ox.putImageData(img, 0, 0); st.fixed = done;
  }
  return {
    get fixed() { return st.fixed; },
    draw(ctx, t) {
      const dt = st.last === null ? 0.016 : Math.min(0.05, Math.max(0, t - st.last)); st.last = t;
      // the unattended sweep: a soft brush that reads along the line, a little above the baseline
      if (t < sweep * 1.25) { const u = Math.min(1, t / sweep); att.deposit(u, 0.52, dt * 4.2, 0.16); att.deposit(Math.max(0, u - 0.08), 0.35, dt * 2.2, 0.18); att.deposit(Math.max(0, u - 0.08), 0.7, dt * 2.2, 0.18); st.dirty = true; }
      else if (!st.fixed) { att.all(dt * 0.8); st.dirty = true; }
      if (st.ptr) { att.deposit(st.ptr[0], st.ptr[1], dt * 3, 0.12); st.dirty = true; }
      if (st.dirty) { render(); st.dirty = false; }
      ctx.clearRect(0, 0, w, h); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(off, 0, 0, w, h);
      if (!st.fixed) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#b4503f'; ctx.fillRect(0, 0, w, h); ctx.restore(); }
      return !st.fixed || !!st.ptr;
    },
    pointer(x, y, inside) { st.ptr = inside ? [clamp(x / w), clamp(y / h)] : null; },
    finish() { att.all(40); st.dirty = true; },
    replay() { att.t.fill(0); st.last = null; st.dirty = true; },
  };
}
