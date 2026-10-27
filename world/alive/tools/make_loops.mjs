// tools/make_loops.mjs: build the loops the integration pages play, with our own code end to end.
//   disc    the 1901 Columbia disc turning once per half bar (3.2 s), 32 frames at 10 fps, GIF (64 colours, Bayer:
//           ordered dither stays put from frame to frame, so it neither shimmers nor bloats the file)
//           and APNG; the GIF is what the page plays through the gif life on the shared clock.
//   bird    Muybridge's Plate 758, first row: sliced, loop length measured, seam closed by flow, GIF and APNG.
// Run: node tools/make_loops.mjs   (writes integrate/ui/assets/alive/ and prints sizes and seam numbers)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fixture } from '../tests/helpers.js';
import { image, sample, resize } from '../lib/img.js';
import { encodeGIF, encodeAPNG, decodeGif } from '../gif.js';
import { sliceGrid, crop, proxyOf, bestLoop, closeLoop, seamRatio } from '../loop.js';

const OUT = new URL('../integrate/ui/assets/alive/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function disc() {
  const src = fixture('columbia-disc'), cx = 178.5, cy = 133, R = 129, n = 32, frames = [];
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n, ca = Math.cos(a), sa = Math.sin(a), o = image(src.w, src.h), p = [0, 0, 0, 0];
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy), w = Math.min(1, Math.max(0, R + 0.5 - r));
      if (w <= 0) { o.data.set(src.data.subarray((y * src.w + x) * 4, (y * src.w + x) * 4 + 4), (y * src.w + x) * 4); continue; }
      sample(src, cx + dx * ca + dy * sa - 0.5, cy - dx * sa + dy * ca - 0.5, p);
      const q = (y * src.w + x) * 4; for (let c = 0; c < 4; c++) o.data[q + c] = p[c] * w + src.data[q + c] * (1 - w);
    }
    frames.push(o);
  }
  return frames;
}

function bird() {
  const sheet = fixture('muybridge-758'), cells = sliceGrid(sheet, 8, 3).slice(0, 8), frames = cells.map((c) => resize(crop(sheet, c), 174, 259));
  // the whole row is kept when its own last-to-first join is within 1.5 steps; otherwise the measured loop is closed
  const whole = seamRatio(frames), r = bestLoop(frames.map((f) => proxyOf(f, 40)), { minLen: 4 });
  const out = whole <= 1.5 ? frames : closeLoop(frames, r.start, r.end, { method: 'flow', blend: Math.min(2, r.start) });
  return { frames: out, r, whole, seamCut: seamRatio(frames.slice(r.start, r.end)), seamClosed: seamRatio(out) };
}

const d = disc(), dg = encodeGIF(d[0].w, d[0].h, d.map((f) => ({ data: f.data, delayMs: 100 })), { colors: 64, dither: 'bayer', strength: 0.9 });
const da = await encodeAPNG(d[0].w, d[0].h, d.map((f) => ({ data: f.data, delayMs: 100 })));
writeFileSync(new URL('disc-loop.gif', OUT), dg); writeFileSync(new URL('disc-loop.png', OUT), da);
const b = bird(), bg = encodeGIF(b.frames[0].w, b.frames[0].h, b.frames.map((f) => ({ data: f.data, delayMs: 1000 / 12 })), { colors: 48, dither: 'fs' });
const ba = await encodeAPNG(b.frames[0].w, b.frames[0].h, b.frames.map((f) => ({ data: f.data, delayMs: 1000 / 12 })));
writeFileSync(new URL('bird-loop.gif', OUT), bg); writeFileSync(new URL('bird-loop.png', OUT), ba);
const back = decodeGif(dg);
console.log(JSON.stringify({
  disc: { frames: d.length, gifBytes: dg.length, apngBytes: da.length, decodedFrames: back.frames.length, loopMs: back.frames.reduce((a, f) => a + f.delayMs, 0) },
  bird: { cells: 8, loop: { start: b.r.start, end: b.r.end, length: b.r.length }, wholeRowSeam: +b.whole.toFixed(2), playedFrames: b.frames.length, seamCut: +b.seamCut.toFixed(2), seamClosed: +b.seamClosed.toFixed(2), gifBytes: bg.length, apngBytes: ba.length },
}, null, 1));
