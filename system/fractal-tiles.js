// fractal-tiles.js: stills larger than any canvas, rendered in strips and streamed into a PNG.
//
// A browser canvas tops out near 16,384 pixels a side and a few hundred million pixels in all, and
// a 16K frame held whole is 1 GB of RGBA. So a still is drawn one horizontal strip at a time: each
// strip is its own view (the same centre arithmetic as panning, so deep views stay exact), drawn
// by the same renderer, read back, filtered into PNG scanlines and pushed through a zlib
// CompressionStream. Only one strip is ever in memory. The PNG is assembled per the specification
// (W3C PNG, 3rd edition): signature, IHDR, IDAT chunks, IEND, each with its CRC-32.

import { shiftView } from "./fractal-hp.js";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes, crc = 0xffffffff) {
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return crc;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length)) ^ 0xffffffff;
  dv.setUint32(8 + data.length, crc >>> 0);
  return out;
}

/** The sub-view a strip of rows [y0, y1) of a W x H still covers. */
export function stripView(view, W, H, y0, y1) {
  // The width (scale) is the frame's, so a strip W pixels wide keeps the frame's pixel size; only
  // its centre moves. Rows go down the image, and the larger imaginary part is at the top (the
  // Burning Ship reflected).
  const aspect = H / W;
  const flipY = view.type === "burningship" ? -1 : 1;
  const mid = (y0 + y1) / 2 / H - 0.5;            // strip centre, in frames down from the centre
  return shiftView({ ...view }, 0, -flipY * mid * view.scale * aspect);
}

/**
 * Render a W x H still in strips and return a PNG Blob. draw(view, canvas) draws one view into a
 * canvas of the strip's size (the Studio passes its renderer); onProgress(done, total) reports.
 */
export async function renderTiledPNG({ view, W, H, draw, stripRows = 256, onProgress = () => {} }) {
  if (typeof CompressionStream === "undefined") throw new Error("this browser has no CompressionStream, which the large PNG needs");
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  const parts = [];
  const reader = cs.readable.getReader();
  const pump = (async () => { for (;;) { const { value, done } = await reader.read(); if (done) break; parts.push(value); } })();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  const total = Math.ceil(H / stripRows);
  for (let s = 0; s < total; s++) {
    const y0 = s * stripRows, y1 = Math.min(H, y0 + stripRows), rows = y1 - y0;
    if (canvas.height !== rows) canvas.height = rows;
    const sv = stripView(view, W, H, y0, y1);
    draw(sv, canvas);
    const px = readRGBA(canvas);
    // Filter type 0 per row, rows top to bottom.
    const raw = new Uint8Array(rows * (W * 3 + 1));
    for (let r = 0; r < rows; r++) {
      const o = r * (W * 3 + 1);
      raw[o] = 0;
      const src = r * W * 4;
      for (let x = 0; x < W; x++) { raw[o + 1 + x * 3] = px[src + x * 4]; raw[o + 2 + x * 3] = px[src + x * 4 + 1]; raw[o + 3 + x * 3] = px[src + x * 4 + 2]; }
    }
    await writer.write(raw);
    onProgress(s + 1, total);
    await new Promise((r) => setTimeout(r, 0));   // let the page breathe between strips
  }
  await writer.close();
  await pump;
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit RGB, no interlace
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  // IDAT in chunks of at most 8 MB each.
  const idat = [];
  const zl = new Blob(parts);
  const zbytes = new Uint8Array(await zl.arrayBuffer());
  for (let o = 0; o < zbytes.length; o += 8 << 20) idat.push(chunk("IDAT", zbytes.subarray(o, Math.min(zbytes.length, o + (8 << 20)))));
  return new Blob([sig, chunk("IHDR", ihdr), ...idat, chunk("IEND", new Uint8Array(0))], { type: "image/png" });
}

// Pixels of a canvas, top row first, from either a WebGL or a 2D context.
function readRGBA(canvas) {
  const gl = canvas.__fractalGLContext;
  const W = canvas.width, H = canvas.height;
  if (gl) {
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const out = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) out.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return out;
  }
  return canvas.getContext("2d").getImageData(0, 0, W, H).data;
}
