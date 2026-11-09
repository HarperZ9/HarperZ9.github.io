// png16.js: 16-bit-per-channel PNG from a float surface (QUALITY-SPEC O1: 16-bit where the tool renders in
// float). Canvas can only write 8-bit PNG, so this writes the file itself: IHDR (bit depth 16, colour type 2,
// RGB), an sRGB chunk naming the colour space, zlib IDAT with filter 0 per row, IEND. Pure; runs in node and
// the browser. deflate is injected: node passes zlib.deflateSync, the browser passes deflateBrowser below.
import { toSrgb } from './raster.js';

// Linear-light float surface (raster.js, { w, h, px: Float32Array RGB }) to sRGB-encoded 16-bit samples.
// shoulder: the same highlight roll-off toRGBA uses for 8-bit (linear to 0.8, exponential above), so the two
// exports match; no dither is needed at 16 bits (one code is 1/65535).
export function toRGB16(S, { shoulder = true } = {}) {
  const n = S.w * S.h, out = new Uint16Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    let v = S.px[i];
    if (shoulder && v > 0.8) v = 0.8 + 0.2 * (1 - Math.exp(-(v - 0.8) / 0.2));
    out[i] = Math.round(toSrgb(Math.max(0, Math.min(1, v))) * 65535);
  }
  return out;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

// rgb16: Uint16Array of w * h * 3 samples. deflate(Uint8Array) -> Uint8Array (zlib format) or a Promise of one.
export async function encodePNG16(rgb16, w, h, deflate) {
  if (rgb16.length !== w * h * 3) throw new RangeError(`png16: ${rgb16.length} samples for ${w} x ${h} RGB`);
  const row = w * 6 + 1, raw = new Uint8Array(row * h);
  for (let y = 0; y < h; y++) {
    raw[y * row] = 0;                                   // filter type 0 (none) per row
    for (let i = 0; i < w * 3; i++) { const v = rgb16[y * w * 3 + i], o = y * row + 1 + i * 2; raw[o] = v >>> 8; raw[o + 1] = v & 255; }  // big-endian
  }
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 16; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = await deflate(raw);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('sRGB', new Uint8Array([0])), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Browser zlib deflate through CompressionStream('deflate') (RFC 1950 framing, what PNG IDAT wants).
export async function deflateBrowser(bytes) {
  const cs = new CompressionStream('deflate'), w = cs.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
