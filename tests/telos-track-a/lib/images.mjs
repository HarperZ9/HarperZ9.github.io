// images.mjs: the 1,000 seeded random images of Track A step T3 (pre-registered spec: xorshift32,
// seed 20261002, sizes 1 to 64 per side, noise / blocks / ramps / grey). py/images.py is the twin;
// both must produce identical bytes, which the conformance test checks by SHA-256 before comparing text.
import { xorshift32, randInt } from "./rng.mjs";

const fd = (a, b) => Math.floor(a / b); // operands here are small integers, so this is exact

export function* randomImages(count, seed = 20261002) {
  const next = xorshift32(seed);
  for (let k = 0; k < count; k++) {
    const w = randInt(next, 1, 64), h = randInt(next, 1, 64), kind = next() % 4;
    const px = new Uint8Array(w * h * 4);
    const put = (x, y, r, g, b) => { const i = (y * w + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; };
    if (kind === 0) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, next() & 255, next() & 255, next() & 255);
    } else if (kind === 1) {
      const base = [next() & 255, next() & 255, next() & 255];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, base[0], base[1], base[2]);
      const nRect = randInt(next, 1, 6);
      for (let q = 0; q < nRect; q++) {
        const x0 = randInt(next, 0, w - 1), y0 = randInt(next, 0, h - 1);
        const x1 = randInt(next, x0, w - 1), y1 = randInt(next, y0, h - 1);
        const c = [next() & 255, next() & 255, next() & 255];
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c[0], c[1], c[2]);
      }
    } else if (kind === 2) {
      const c0 = [next() & 255, next() & 255, next() & 255], c1 = [next() & 255, next() & 255, next() & 255];
      const horizontal = next() % 2 === 0;
      const span = Math.max(1, (horizontal ? w : h) - 1);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const t = horizontal ? x : y;
        put(x, y, ...[0, 1, 2].map((i) => c0[i] + fd((c1[i] - c0[i]) * t, span)));
      }
    } else {
      const base = next() & 255;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = Math.max(0, Math.min(255, base + (next() % 9) - 4));
        put(x, y, v, v, v);
      }
    }
    yield { name: `random-${String(k).padStart(4, "0")}`, w, h, px };
  }
}
