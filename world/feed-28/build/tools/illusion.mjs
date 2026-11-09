// tools/illusion.mjs: stills (ambiguous and cued) and the 8 s loop. node tools/illusion.mjs [--size 1080] [--fps 24] [--still-only]
import { frame, rings, solid } from '../illusion.mjs';
import { raster } from '../../../feed-29/build/lib/field.mjs';
import { writePNG, writeVideo } from '../../../feed-29/build/lib/io.mjs';
import { encode } from '../../../feed-29/build/lib/field.mjs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
const size = arg('--size', 1080), fps = arg('--fps', 24), period = 8, pts = solid(), base = rings(raster(size, size, [0.012, 0.011, 0.016]));
await writePNG(`out/illusion-ambiguous-${size}.png`, frame(1.1, { size, base, pts, cue: 0 }), { seed: 'ill' });
await writePNG(`out/illusion-cued-${size}.png`, frame(1.1, { size, base, pts, cue: 1 }), { seed: 'ill' });
if (!process.argv.includes('--still-only')) {
  const t0 = performance.now();
  await writeVideo(`out/illusion-loop-${size}.mp4`, size, size, fps, period * fps, i => encode(frame(i / fps, { size, base, pts, period }), { seed: 'ill' }));
  console.log('loop', Math.round(performance.now() - t0), 'ms');
}
