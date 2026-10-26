import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, inflateSync } from 'node:zlib';
import { toRGB16, encodePNG16, crc32 } from './png16.js';
import { surface, toRGBA } from './raster.js';

// Parse our own PNG back: chunk list, CRCs, IHDR fields, and the unfiltered samples.
function parse(png) {
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const dv = new DataView(png.buffer, png.byteOffset), chunks = [];
  for (let o = 8; o < png.length;) {
    const len = dv.getUint32(o), type = String.fromCharCode(...png.subarray(o + 4, o + 8)), data = png.subarray(o + 8, o + 8 + len);
    assert.equal(dv.getUint32(o + 8 + len), crc32(png.subarray(o + 4, o + 8 + len)), `${type} CRC`);
    chunks.push({ type, data }); o += 12 + len;
  }
  return chunks;
}

test('CRC-32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('16-bit PNG round-trips every sample, names sRGB, and keeps precision 8-bit throws away', async () => {
  const w = 64, h = 4, S = surface(w, h, [0, 0, 0]);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { const v = 0.001 + 0.002 * x / w; S.px.set([v, v, v], 3 * (y * w + x)); }  // a deep-shadow ramp
  const rgb = toRGB16(S), png = await encodePNG16(rgb, w, h, deflateSync), ch = parse(png);
  assert.deepEqual(ch.map((c) => c.type), ['IHDR', 'sRGB', 'IDAT', 'IEND']);
  const ih = new DataView(ch[0].data.buffer, ch[0].data.byteOffset);
  assert.equal(ih.getUint32(0), w); assert.equal(ih.getUint32(4), h); assert.equal(ch[0].data[8], 16); assert.equal(ch[0].data[9], 2);
  const raw = inflateSync(ch[2].data), row = w * 6 + 1;
  for (let y = 0; y < h; y++) { assert.equal(raw[y * row], 0); for (let i = 0; i < w * 3; i++) assert.equal((raw[y * row + 1 + 2 * i] << 8) | raw[y * row + 2 + 2 * i], rgb[y * w * 3 + i]); }
  // the ramp spans a handful of 8-bit codes but hundreds of 16-bit codes: that is the reason for the format
  const u16 = new Set(Array.from(rgb).filter((_, i) => i % 3 === 0)).size;
  const u8 = new Set(Array.from(toRGBA(S, { dither: false })).filter((_, i) => i % 4 === 0)).size;
  assert.ok(u16 >= 60 && u8 <= 10, `distinct levels: 16-bit ${u16}, 8-bit ${u8}`);
});

test('sample count mismatch fails loudly', async () => {
  await assert.rejects(() => encodePNG16(new Uint16Array(5), 2, 2, deflateSync), /samples/);
});
