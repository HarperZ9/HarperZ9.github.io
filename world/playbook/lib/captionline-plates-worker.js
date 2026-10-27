// lib/captionline-plates-worker.js: renders a studio material plate off the main thread (module worker), so a full
// DPR plate (2967 x 1854 for 1440 CSS px at DPR 2: 1.2 to 6 s per material on one desktop core in node, measured 2026-10-23) never costs a display frame (M1, M2).
// The studio's renderImage and toRGBA are imported unchanged. A veil darkens the plate where type will sit,
// computed in float and dithered (TPDF, 1 code value) so the ramp does not band (R2).
// Message in:  { id, material, w, h, seed, veil: { x, y, r, k } or a list of them }  (x, y, r as shares of the plate; k the depth 0..1)
// Message out: { id, w, h, buf } (RGBA bytes, transferred) or { id, error }.
import { MATERIALS, CODE_MATERIAL } from '../../studio/lib/materials.mjs';
import { renderImage, toRGBA } from '../../studio/lib/lanes/image.mjs';

const find = (id) => (id === CODE_MATERIAL.id ? CODE_MATERIAL : MATERIALS.find((m) => m.id === id));

function veil(px, w, h, { x = 0.3, y = 0.5, r = 0.7, k = 0.55 } = {}, seed = 1) {
  let s = seed >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const R = r * Math.max(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const d = Math.hypot(i - x * w, j - y * h) / R, m = 1 - k * Math.max(0, 1 - d * d) ** 1.5, o = (j * w + i) * 4;
    for (let c = 0; c < 3; c++) px[o + c] = Math.max(0, Math.min(255, Math.round(px[o + c] * m + rnd() - rnd())));
  }
}

self.onmessage = (e) => {
  const { id, material, w, h, seed = 1, veil: v = null } = e.data;
  try {
    const m = find(material); if (!m) throw new Error(`plates: unknown material ${material}`);
    const L = renderImage(m, { w, h, seed }), px = toRGBA(L, m, { dpr: Math.max(1, w / 1440) });
    for (const one of v ? [].concat(v) : []) veil(px, w, h, one, seed);
    self.postMessage({ id, w, h, buf: px.buffer }, [px.buffer]);
  } catch (err) { self.postMessage({ id, error: String(err && err.stack || err) }); }
};
