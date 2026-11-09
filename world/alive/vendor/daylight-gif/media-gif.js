// Copied unmodified below this header from CMMNS, formerly Daylight Commons (HarperZ9/cmmns, branch feat/media-toolkit,
// commit 37b80eef14ca1f13e888749f0049437e2b647966, src/core/media-gif.js). Same author; licence AGPL-3.0-only, as in the source.
// Used read-only by the alive layer's gif.js for decoding. Fix bugs upstream, then copy again.
// Decodes GIF87a and GIF89a files into fully composited RGBA frames: global and local colour
// tables, interlacing, transparency and delays from the Graphic Control Extension, disposal
// methods 0 to 3, and the NETSCAPE2.0 loop count. A truncated file keeps the frames before the cut.

import { gifLzwDecode } from "./media-gif-lzw.js";

const TRUNCATED = "decodeGif: truncated";

export function isGif(bytes) {
  if (!bytes || bytes.length < 6) return false;
  const sig = String.fromCharCode(...bytes.subarray(0, 6));
  return sig === "GIF87a" || sig === "GIF89a";
}

function gifReader(bytes) {
  let pos = 0;
  const need = (n) => {
    if (pos + n > bytes.length) {
      const err = new Error(TRUNCATED);
      err.gifTruncated = true;
      throw err;
    }
  };
  return {
    get pos() { return pos; },
    u8() { need(1); return bytes[pos++]; },
    u16() { need(2); const v = bytes[pos] | (bytes[pos + 1] << 8); pos += 2; return v; },
    take(n) { need(n); const v = bytes.subarray(pos, pos + n); pos += n; return v; },
  };
}

// Sub-blocks: a length byte, that many bytes, repeated until a zero length.
function subBlocks(r) {
  const list = [];
  for (let n = r.u8(); n !== 0; n = r.u8()) list.push(r.take(n));
  return list;
}

function joinBlocks(list) {
  let total = 0;
  for (const b of list) total += b.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const b of list) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}

function readExtension(r, state) {
  const label = r.u8();
  const blocks = subBlocks(r);
  if (label === 0xf9 && blocks[0] && blocks[0].length >= 4) {
    const b = blocks[0];
    state.gce = { disposal: (b[0] >> 2) & 7, transparent: b[0] & 1 ? b[3] : -1, delayCs: b[1] | (b[2] << 8) };
  } else if (label === 0xff && blocks.length >= 2) {
    const id = String.fromCharCode(...blocks[0]);
    const sub = blocks[1];
    if ((id === "NETSCAPE2.0" || id === "ANIMEXTS1.0") && sub.length >= 3 && sub[0] === 1) {
      state.loop = sub[1] | (sub[2] << 8);
    }
  }
}

// Interlaced rows are stored in four passes: every 8th row from 0, from 4, every 4th from 2,
// every 2nd from 1.
function deinterlace(indices, w, h) {
  const out = new Uint8Array(indices.length);
  let src = 0;
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
    for (let y = start; y < h; y += step) {
      out.set(indices.subarray(src * w, src * w + w), y * w);
      src++;
    }
  }
  return out;
}

function applyDisposal(state) {
  const p = state.prev;
  if (!p) return;
  if (p.disposal === 2) {
    for (let y = Math.max(0, p.y); y < Math.min(state.height, p.y + p.h); y++) {
      const row = y * state.width;
      const x0 = Math.max(0, p.x), x1 = Math.min(state.width, p.x + p.w);
      if (x1 > x0) state.canvas.fill(0, (row + x0) * 4, (row + x1) * 4);
    }
  } else if (p.disposal === 3 && state.saved) {
    state.canvas.set(state.saved);
  }
}

function drawFrame(state, f, indices, palette, transparent) {
  const { canvas, width, height } = state;
  const colours = palette ? palette.length / 3 : 0;
  for (let j = 0; j < f.h; j++) {
    const y = f.y + j;
    if (y >= height) break;
    for (let i = 0; i < f.w; i++) {
      const x = f.x + i;
      if (x >= width) break;
      const idx = indices[j * f.w + i];
      if (idx === transparent || idx >= colours) continue;
      const o = (y * width + x) * 4;
      canvas[o] = palette[idx * 3];
      canvas[o + 1] = palette[idx * 3 + 1];
      canvas[o + 2] = palette[idx * 3 + 2];
      canvas[o + 3] = 255;
    }
  }
}

function readImage(r, state, globalTable) {
  const f = { x: r.u16(), y: r.u16(), w: r.u16(), h: r.u16() };
  const packed = r.u8();
  const local = packed & 0x80 ? r.take(3 * (2 << (packed & 7))) : null;
  const minCode = r.u8();
  const data = joinBlocks(subBlocks(r));
  let indices = gifLzwDecode(data, minCode, f.w * f.h);
  if (packed & 0x40) indices = deinterlace(indices, f.w, f.h);
  const gce = state.gce || { disposal: 0, transparent: -1, delayCs: 0 };
  applyDisposal(state);
  state.saved = gce.disposal === 3 ? state.canvas.slice() : null;
  drawFrame(state, f, indices, local || globalTable, gce.transparent);
  const delayMs = gce.delayCs * 10 <= 10 ? 100 : gce.delayCs * 10;
  state.frames.push({ rgba: state.canvas.slice(), delayMs, x: f.x, y: f.y, w: f.w, h: f.h, disposal: gce.disposal });
  state.prev = { ...f, disposal: gce.disposal };
  state.gce = null;
}

export function decodeGif(bytes) {
  if (!isGif(bytes)) throw new Error("decodeGif: not a GIF file");
  const r = gifReader(bytes);
  r.take(6);
  const width = r.u16();
  const height = r.u16();
  const packed = r.u8();
  r.u8();
  r.u8();
  const globalTable = packed & 0x80 ? r.take(3 * (2 << (packed & 7))) : null;
  const state = {
    width, height, canvas: new Uint8ClampedArray(width * height * 4),
    saved: null, prev: null, gce: null, loop: null, frames: [],
  };
  try {
    for (;;) {
      const b = r.u8();
      if (b === 0x2c) readImage(r, state, globalTable);
      else if (b === 0x21) readExtension(r, state);
      else break;
    }
  } catch (err) {
    if (!err.gifTruncated) throw err;
  }
  return { width, height, loop: state.loop, frames: state.frames };
}
