// tools/translate.mjs: paint our own valley, then translate it to pixel art; writes the two mediums and a diptych.
// node tools/translate.mjs [--size 960] [--cell 6] [--colors 14]
import { paint } from '../painting.mjs';
import { pixelate } from '../pixelart.mjs';
import { writePNG } from '../lib/io.mjs';
import { raster } from '../lib/field.mjs';
import { writeFileSync } from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
const W = arg('--size', 960), H = Math.round(W * 0.75), cell = arg('--cell', 5), colors = arg('--colors', 16);
let t = performance.now(); const P = paint({ w: W, h: H, seed: 'valley' }); const tPaint = performance.now() - t;
t = performance.now(); const X = pixelate(P, { cell, colors, dither: 0.4, cleanup: 2, outline: 1, accent: 0.35, seed: 'valley' }); const tPix = performance.now() - t;
await writePNG(`out/painting-valley-${W}.png`, P, { grainSd: 2.5, seed: 'paint' });
await writePNG(`out/pixel-valley-${W}.png`, X.R, { seed: 'pix' });
const gap = Math.round(W * 0.02), D = raster(W * 2 + gap, H, [0.86, 0.84, 0.8]);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { D.px.set(P.px.subarray(3 * (y * W + x), 3 * (y * W + x) + 3), 3 * (y * D.w + x)); if (x < X.R.w && y < X.R.h) D.px.set(X.R.px.subarray(3 * (y * X.R.w + x), 3 * (y * X.R.w + x) + 3), 3 * (y * D.w + x + W + gap)); }
await writePNG(`out/diptych-valley-${W}.png`, D, { seed: 'dip' });
const meta = { w: W, h: H, cell, colors, grid: [X.gw, X.gh], paintMs: Math.round(tPaint), pixelMs: Math.round(tPix), kmeansTrace: X.trace.map(v => +v.toFixed(4)), palette: X.palette.map(c => c.map(v => +v.toFixed(4))) };
writeFileSync(`out/translate-${W}.json`, JSON.stringify(meta, null, 1)); console.log(meta.grid, meta.paintMs, meta.pixelMs);
