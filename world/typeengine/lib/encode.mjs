// lib/encode.mjs: linear raster to 8-bit sRGB with a seeded TPDF dither (so goldens are exact), and PNG bytes through
// the feed-23 encoder. encodePNG needs a deflate: node passes zlib's, the browser passes browserDeflate.
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { rngFrom } from '../../superframe/lib/seed.mjs';

const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);
export function toSRGB8(R, seed = 'typeengine') {
  const r = rngFrom(seed), out = new Uint8ClampedArray(R.w * R.h * 4);
  for (let i = 0; i < R.w * R.h; i++) {
    for (let c = 0; c < 3; c++) { const v = Math.min(1, Math.max(0, R.data[i * 4 + c])); out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(enc(v) * 255 + (r() - r())))); }
    out[i * 4 + 3] = 255;
  }
  return out;
}
export const pngOf = (R, deflate, seed) => encodePNG(R.w, R.h, toSRGB8(R, seed), deflate);
