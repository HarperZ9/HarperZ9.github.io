// web/living-worker.mjs: the CPU half of living type, off the main thread. It owns one createLiving per passage and
// answers two requests, posting textures ready to upload (sRGB8 images, half-float fields; buffers transferred):
//   { id, op: 'init', w, h, stops, seed }    { id, op: 'stop', i }    { id, op: 'move', i }
import { srgb8 } from '../lib/living/fields.mjs';
import { sameMaterial } from '../lib/living/compose.mjs';
// The library is loaded lazily so this handler exists before any message arrives: the library has a top-level await,
// and a message posted while a module worker is still evaluating would reach a worker with no handler yet.
const lib = import('../lib/living/index.mjs');

const passages = new Map();
const rgba = (img, n) => { const o = new Uint8Array(n * 4); for (let k = 0; k < n; k++) { o[k * 4] = srgb8(img[k * 3]); o[k * 4 + 1] = srgb8(img[k * 3 + 1]); o[k * 4 + 2] = srgb8(img[k * 3 + 2]); o[k * 4 + 3] = 255; } return o; };
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
function half(v) {
  f32[0] = v; const x = u32[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff;
  if (e <= 0) return s; if (e >= 31) return s | 0x7c00; return s | (e << 10) | (m >>> 13);
}
// a baked state image (PNG, sRGB) resampled to the passage size, in linear light
async function bake(url, w, h) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob()), c = new OffscreenCanvas(w, h), x = c.getContext('2d');
  x.drawImage(bmp, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data, o = new Float32Array(w * h * 3);
  for (let k = 0; k < w * h; k++) for (let ch = 0; ch < 3; ch++) { const v = d[k * 4 + ch] / 255; o[k * 3 + ch] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
  return o;
}
self.onmessage = async (ev) => {
  const q = ev.data;
  try {
    if (q.op === 'init') { const { createLiving } = await lib; const baked = {}; for (const b of q.bake ?? []) baked[`${b.text}|${b.state}`] = await bake(b.url, q.w, q.h); const L = createLiving({ w: q.w, h: q.h, stops: q.stops, seed: q.seed ?? 1, baked, size: q.size ?? null }); passages.set(q.id, L); self.postMessage({ id: q.id, op: 'init', stops: L.stops.map((s) => ({ ...s, layout: L.layout(s.text) })) }); return; }
    const L = passages.get(q.id), n = L.w * L.h;
    if (q.op === 'stop') { const a = rgba(L.settled(q.i), n); self.postMessage({ id: q.id, op: 'stop', i: q.i, part: { w: L.w, h: L.h, rgba: a, breath: L.breath(q.i) } }, [a.buffer]); return; }
    if (q.op === 'move') {
      const m = L.move(q.i), sim = m.sim, keys = sim.frames.length, cells = sim.nx * sim.ny, F = new Uint16Array(cells * keys * 4);
      sim.frames.forEach((fr, k) => { for (let c = 0; c < cells; c++) { const o = (k * cells + c) * 4; F[o] = half(fr.px[c]); F[o + 1] = half(fr.py[c]); F[o + 2] = half(fr.W[c]); F[o + 3] = half(fr.R[c]); } });
      const a = rgba(m.kind === 'reveal' ? m.top : m.A, n), b = rgba(m.kind === 'reveal' ? m.under : m.B, n);
      self.postMessage({ id: q.id, op: 'move', i: q.i, part: { kind: m.kind, law: m.law, seconds: m.seconds, w: L.w, h: L.h, a, b, fields: F, nx: sim.nx, ny: sim.ny, keys, sx: sim.sx, sy: sim.sy, paper: m.paper ?? [0.83, 0.79, 0.69], breath: L.breath(q.i), breath2: L.breath(q.i + 1), dark: !!m.dark, same: m.kind === 'change' && sameMaterial(m.A, m.B) } }, [a.buffer, b.buffer, F.buffer]);
    }
  } catch (e) { console.error('[living-worker]', q.op, e); self.postMessage({ id: q.id, op: 'error', message: String(e?.stack ?? e) }); }
};
