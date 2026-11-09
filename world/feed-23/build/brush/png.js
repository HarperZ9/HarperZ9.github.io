// brush/png.js: a lossless PNG writer, 8 or 16 bits per channel, RGBA. No dependency: the caller hands in a
// zlib deflate (browser: CompressionStream('deflate'); node: zlib.deflateSync). 16-bit is the master format,
// since an 8-bit export of a long glaze shows steps that the float surface never had.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

// Standard CRC-32 (ISO 3309), as PNG chunks store it.
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

// Raw scanlines with filter type 0 (none) or 2 (up, compresses smooth paint better), per row.
export function scanlines(w, h, pixels, depth) {
  const bpp = depth === 16 ? 8 : 4, stride = w * bpp, raw = new Uint8Array(h * (stride + 1));
  const row = new Uint8Array(stride), prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    if (depth === 16) for (let i = 0; i < w * 4; i++) { const v = pixels[y * w * 4 + i]; row[i * 2] = v >> 8; row[i * 2 + 1] = v & 255; }
    else row.set(pixels.subarray(y * stride, (y + 1) * stride));
    const o = y * (stride + 1);
    raw[o] = y ? 2 : 0;
    for (let i = 0; i < stride; i++) raw[o + 1 + i] = y ? (row[i] - prev[i]) & 255 : row[i];
    prev.set(row);
  }
  return raw;
}

// encodePNG(w, h, Uint8ClampedArray | Uint16Array RGBA, deflate) -> Promise<Uint8Array>
export async function encodePNG(w, h, pixels, deflate) {
  const depth = pixels instanceof Uint16Array ? 16 : 8;
  if (pixels.length !== w * h * 4) throw new RangeError(`png: expected ${w * h * 4} samples, got ${pixels.length}`);
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = depth; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = await deflate(scanlines(w, h, pixels, depth));
  // sRGB chunk (perceptual intent) so viewers do not reinterpret the colour
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('sRGB', new Uint8Array([0])), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Browser deflate through the Compression Streams API (zlib format, which is what IDAT wants).
export async function browserDeflate(bytes) {
  const cs = new CompressionStream('deflate'), stream = new Blob([bytes]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
