// tools/render.mjs: render the gradient-field posters. node tools/render.mjs [--size 1024] [--master] [--only motif]
// Previews: out/<motif>-<seed>.png (8-bit, long side = size). --master adds a 3840 px 16-bit PNG per poster (O1).
import { poster } from '../gradfield.mjs';
import { writePNG } from '../lib/io.mjs';
import { writeFileSync } from 'node:fs';
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const size = +(arg('--size') ?? 1024), only = arg('--only'), master = process.argv.includes('--master');
export const PLATES = [
  { motif: 'capsules', seed: 'c1', palette: 'film', capsules: { orient: 'v', cols: 6, rows: 1 } },
  { motif: 'capsules', seed: 'c2', palette: 'spectral', capsules: { orient: 'h', cols: 4, rows: 7, wave: 0.6 } },
  { motif: 'spheres', seed: 's1', palette: 'film', spheres: { n: 3 } },
  { motif: 'spheres', seed: 's2', palette: 'film', ground: '#18161a', spheres: { n: 5 } },
  { motif: 'wedges', seed: 'w1', palette: 'spectral', wedges: { n: 5, reveal: 0.6 } },
  { motif: 'metaballs', seed: 'm1', palette: 'film', metaballs: { grid: 4 } },
  { motif: 'subdivide', seed: 'd1', palette: 'spectral' },
  { motif: 'steps', seed: 'p1', palette: 'ink', ground: '#120c16', aberration: 3 },
];
const meta = [];
for (const P of PLATES.filter(p => !only || p.motif === only)) {
  const W = Math.round(size * 0.8), H = size, t0 = performance.now(), R = poster({ ...P, w: W, h: H }), ms = performance.now() - t0;
  const f = `out/${P.motif}-${P.seed}.png`; await writePNG(f, R, { grainSd: R.grainSd, grainSigma: R.grainSigma, seed: P.seed });
  const row = { file: f, w: W, h: H, ms: Math.round(ms), ...P };
  if (master) { const M = poster({ ...P, w: 3072, h: 3840 }); const fm = `out/master/${P.motif}-${P.seed}-3840.png`; await writePNG(fm, M, { grainSd: M.grainSd, grainSigma: M.grainSigma, seed: P.seed, depth: 16 }); row.master = fm; }
  meta.push(row); console.log(f, `${Math.round(ms)} ms`);
}
writeFileSync(`out/posters${only ? '-' + only : ''}.json`, JSON.stringify(meta, null, 1));
