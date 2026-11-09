// tools/ink.mjs: render the street in both spot-ink modes. node tools/ink.mjs [--size 1024]
import { illustrate } from '../spotink.mjs';
import { writePNG } from '../lib/io.mjs';
const i = process.argv.indexOf('--size'), W = i > 0 ? +process.argv[i + 1] : 1024, H = Math.round(W * 0.75);
for (const [mode, spot, paper, ink] of [['marker', '#2f6bd8', '#f3efe6', '#16151a'], ['marker', '#d8402f', '#f3efe6', '#16151a'], ['twotone', '#f2b230', '#e9e2d0', '#1b1d33']]) {
  const t0 = performance.now(), R = illustrate({ w: W, h: H, mode, spot, paper, ink }), ms = performance.now() - t0;
  const f = `out/ink-${mode}-${spot.slice(1)}-${W}.png`; await writePNG(f, R, { grainSd: mode === 'marker' ? 1.5 : 1, seed: f }); console.log(f, Math.round(ms), 'ms');
}
