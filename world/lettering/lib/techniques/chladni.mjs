// Chladni: sand on a vibrating plate gathers where the plate stands still. The plate starts in a real mode of a free
// square plate, solved by Rayleigh-Ritz in feed set 22 (build/chladni.js); the default is mode 17, the free-plate mode
// that best fitted the reference clip there (chladni_modefit.json, t = 1.8 s, r = 0.351). The plate is tiled in
// squares of the frame's height across the word. Grains walk with a hop that grows with amplitude squared and no pull,
// so the first pattern is the plate's own. Then the drive moves
// to a field whose nodal set is the word's centre lines (the distance to the skeleton, zero on the stroke). That second
// field is drawn by the letter, not by physics, and the wall label says so. Grains jump in proportion to the local
// amplitude, so they run off the antinodes and settle on the nodal lines.
import { rng, clamp, smoothstep, canvas, parseColor } from '../paint.mjs';
import { solvePlate, modeAmplitude, sampleAmp } from '../../../feed-22/build/chladni.js';

// The free square plate (Kirchhoff, Poisson ratio 0.3) solved once per page by Rayleigh-Ritz in feed set 22's build.
let PLATE = null;
const plateModes = () => PLATE || (PLATE = solvePlate({ N: 14, nu: 0.3, edge: 'free' }));

export const meta = {
  id: 'chladni', title: 'Chladni', renderer: '2d', ground: 'own', weight: 600,
  lineage: 'Ernst Chladni, Entdeckungen uber die Theorie des Klanges (1787); the membrane mode fit in feed set 22.',
  does: 'Sand settles on a real plate mode, then the drive moves and the nodal lines become the word.',
  params: { mode: 'free-plate mode index, integer 1 to 40 (default 17)', grains: 'count, 3,000 to 90,000 (default one per 7 work px2 of the word box plus a margin)', morph: 'seconds, 1 to 8 (default 2.6)' },
};

// Membrane mode amplitude in [0,1] at (u, v) in plate units.
export function mode(u, v, n = 3, m = 3, sign = 1) {
  const a = Math.sin(n * Math.PI * u) * Math.sin(m * Math.PI * v) + sign * Math.sin(m * Math.PI * u) * Math.sin(n * Math.PI * v);
  return Math.abs(a) / 2;
}
export { plateModes };

export async function create(g, env) {
  const { w, h } = g, o = env.opts; let R = rng(env.seed);
  const field = modeAmplitude(plateModes(), (o.mode ?? 17) - 1, 96);
  // amplitude grids at work resolution: the plate mode (tiled in squares of the frame height) and the letter field
  const plate = new Float32Array(w * h), word = new Float32Array(w * h), A = g.arc.dist, reach = g.half * 2.4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; plate[i] = sampleAmp(field, ((x / h) % 1) * 2 - 1, (y / h) * 2 - 1);
    // zero on the centre line, steep within a stroke and with a long shallow slope so far grains still drift in;
    // the plate's own nodal lines keep a floor of 0.85, so a few grains linger on them as a ghost of the first mode
    word[i] = Math.min(0.62 * (1 - Math.exp(-A[i] / (g.half * 0.9))) + 0.38 * clamp(A[i] / (g.half * 22)), 0.85 + 0.15 * plate[i]);
  }
  const N = o.grains ?? Math.round(Math.min(90000, Math.max(3000, ((g.bbox.x1 - g.bbox.x0 + g.half * 8) * (g.bbox.y1 - g.bbox.y0 + g.half * 8)) / 7))), px = new Float32Array(N), py = new Float32Array(N);
  // sand is poured over the word's own plate area (its box plus a margin), not the whole band
  const b = g.bbox, m = g.half * 4, sx0 = Math.max(0, b.x0 - m), sx1 = Math.min(w - 1, b.x1 + m), sy0 = Math.max(0, b.y0 - m), sy1 = Math.min(h - 1, b.y1 + m);
  const seedGrains = () => { const r = rng(env.seed + 1); for (let i = 0; i < N; i++) { px[i] = sx0 + r() * (sx1 - sx0); py[i] = sy0 + r() * (sy1 - sy0); } };
  seedGrains();
  const morph = o.morph ?? 2.6, jump = Math.max(1.2, g.half * 0.55), step = 1 / 60;
  // the driven field, blended from plate to word; rebuilt only when the blend weight moves
  const cur = Float32Array.from(plate); let curW = 0;
  const blend = wgt => { if (Math.abs(wgt - curW) < 0.004) return; curW = wgt; for (let i = 0; i < cur.length; i++) cur[i] = plate[i] + (word[i] - plate[i]) * wgt; };
  const amp = (x, y) => cur[(y | 0) * w + (x | 0)];
  function sim(wgt) {
    blend(wgt);
    for (let i = 0; i < N; i++) {
      let x = px[i], y = py[i];
      const a = amp(x, y), s = a * a * jump * 2.6 + 0.03;
      // a grain hops a distance set by the local amplitude; a slight pull down the amplitude slope speeds settling
      const th = R() * 6.2832, gx = amp(Math.min(w - 1, x + 1), y) - amp(Math.max(0, x - 1), y), gy = amp(x, Math.min(h - 1, y + 1)) - amp(x, Math.max(0, y - 1));
      // the slope pull belongs to the letter's field only (weighted by wgt); the plate phase is a pure walk
      x += Math.cos(th) * s - gx * jump * 3 * wgt; y += Math.sin(th) * s - gy * jump * 3 * wgt;
      px[i] = x < 0 ? -x : x >= w ? 2 * w - x - 1 : x; py[i] = y < 0 ? -y : y >= h ? 2 * h - y - 1 : y;
    }
  }
  // render buffer at up to 1.5 device pixels per work pixel: one grain is one pixel there
  const kb = Math.min(env.k, 1.5), bw = Math.round(w * kb), bh = Math.round(h * kb), buf = canvas(bw, bh), bx = buf.getContext('2d'), img = bx.createImageData(bw, bh), u32 = new Uint32Array(img.data.buffer);
  const [gr, gg, gb] = parseColor(env.opts.ground ?? '#0c0b0e'), [sr, sg, sb] = parseColor(env.opts.sand ?? '#efe6d2');
  const groundPx = (255 << 24) | (gb << 16) | (gg << 8) | gr;
  const shade = new Uint32Array(4); for (let k = 0; k < 4; k++) { const t = 0.55 + 0.15 * k; shade[k] = (255 << 24) | (Math.round(gb + (sb - gb) * t) << 16) | (Math.round(gg + (sg - gg) * t) << 8) | Math.round(gr + (sr - gr) * t); }
  function paint(ctx) {
    u32.fill(groundPx);
    for (let i = 0; i < N; i++) { const x = (px[i] * kb) | 0, y = (py[i] * kb) | 0; if (x >= 0 && y >= 0 && x < bw && y < bh) u32[y * bw + x] = shade[i & 3]; }
    bx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(buf, 0, 0, w, h);
  }
  let last = null, acc = 0, done = false, simT = 0;
  const settle = () => { for (let k = 0; k < 600; k++) sim(1); done = true; };
  return {
    grains: N,
    draw(ctx, t) {
      if (!done) {
        const dt = last === null ? step : Math.min(0.1, Math.max(0, t - last)); last = t; acc += dt;
        let k = 0; while (acc >= step && k < 3) { simT += step; sim(smoothstep(0.9, 0.9 + morph, simT)); acc -= step; k++; }
        if (simT > morph + 8) done = true;
      }
      paint(ctx);
      return !done;
    },
    finish() { if (!done) settle(); },
    replay() { R = rng(env.seed); seedGrains(); cur.set(plate); curW = 0; done = false; last = null; acc = 0; simT = 0; },
  };
}
