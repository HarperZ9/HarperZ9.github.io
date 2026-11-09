// tools/timebands.mjs: a still and the exact loop. node tools/timebands.mjs [--w 1280] [--fps 24] [--still-only]
import { frame, waveSet } from '../timebands.mjs';
import { writePNG, writeVideo } from '../../../feed-29/build/lib/io.mjs';
import { encode } from '../../../feed-29/build/lib/field.mjs';
import { writeFileSync } from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
const w = arg('--w', 1280), h = Math.round(w * 0.75), fps = arg('--fps', 24), loop = 6, W = waveSet({ loop });
const t0 = performance.now(), S = frame(1.3, { w, h, W }); console.log('still', Math.round(performance.now() - t0), 'ms');
await writePNG(`out/timebands-${w}.png`, S, { seed: 'tb', grainSd: 1.2 });
writeFileSync(`out/timebands-${w}.json`, JSON.stringify(S.bands, null, 1));
if (!process.argv.includes('--still-only')) await writeVideo(`out/timebands-loop-${w}.mp4`, w, h, fps, loop * fps, i => encode(frame(i / fps, { w, h, W }), { seed: 'tb', grainSd: 1.2 }));
