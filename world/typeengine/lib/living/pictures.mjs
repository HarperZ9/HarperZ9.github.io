// lib/living/pictures.mjs: what a word means, drawn as hatching behind it (the illustration state).
// A picture is a plugin keyed by meaning: registerPicture(['leaf', 'plant', ...], (C, box) -> mask) returns a shape
// mask in the canvas; it is then hatched like a plate (outline plus parallel lines whose spacing follows tone).
// Words with no picture fall back to the letters alone (honest: this is a small vocabulary, not image generation).
import { clamp, blur, noise } from './fields.mjs';

const PICTURES = new Map();
export function registerPicture(words, draw) { for (const w of words) PICTURES.set(w.toLowerCase(), draw); }
export const hasPicture = (word) => PICTURES.has(String(word).toLowerCase().trim());

function hatch(C, mask, { pitch, angle = 0.8, tone = null }) {
  const { w, h } = C, edge = blur(mask, w, h, 1.2), out = new Float32Array(w * h), ca = Math.cos(angle), sa = Math.sin(angle);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (edge[i] <= 0.02) continue;
    const ring = clamp(1 - Math.abs(edge[i] - 0.5) * 4) * 0.9, t = tone ? tone[i] : 0.5;
    const v = (x * sa + y * ca) / pitch, f = Math.abs(v - Math.round(v)) * pitch, line = clamp(pitch * (0.12 + 0.3 * t) - f + 0.5) * mask[i];
    out[i] = Math.max(ring, line);
  }
  return out;
}
const box = (C) => { const W = C.w, H = C.h, cx = W / 2, cy = C.G.baseline - C.size * 0.35; return { cx, cy, R: Math.min(H * 0.48, W * 0.3), W, H }; };

registerPicture(['leaf', 'plant', 'green', 'grow', 'growth', 'chlorophyll'], (C, b) => {
  const { w, h } = C, m = new Float32Array(w * h), tone = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x - b.cx) / (b.R * 2.2), v = (y - b.cy) / b.R, rot = u * 0.94 + v * 0.34, q = -u * 0.34 + v * 0.94;
    const half = 0.42 * Math.sqrt(clamp(1 - rot * rot)) * (1 - 0.25 * rot), i = y * w + x;
    if (Math.abs(q) < half && Math.abs(rot) < 1) { m[i] = 1; const vein = Math.abs(q) < 0.02 || Math.abs((rot * 6 + Math.abs(q) * 9) % 1 - 0.5) < 0.05; tone[i] = vein ? 1 : 0.3 + 0.4 * Math.abs(q) / half; }
  }
  return hatch(C, m, { pitch: Math.max(3, C.size / 16), angle: 0.6, tone });
});

registerPicture(['water', 'wave', 'waves', 'sea', 'river', 'pour', 'wæter', 'agua', 'eau'], (C, b) => {
  const { w, h } = C, m = new Float32Array(w * h), tone = new Float32Array(w * h), n = noise(w, h, b.R * 0.4, C.seed + 5, 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const band = Math.sin(x / (b.R * 0.35) + Math.floor((y - b.cy) / (b.R * 0.28)) * 1.7) * b.R * 0.07, yy = ((y - b.cy + band) / (b.R * 0.28)) % 1;
    const i = y * w + x; if (Math.abs(y - b.cy) < b.R * 1.1) { m[i] = yy < 0.55 && yy > -0.45 ? 1 : 0; tone[i] = 0.25 + 0.5 * n[i]; }
  }
  return hatch(C, m, { pitch: Math.max(3, C.size / 18), angle: 0.0, tone });
});

registerPicture(['sun', 'light', 'day', 'daylight'], (C, b) => {
  const { w, h } = C, m = new Float32Array(w * h), tone = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - b.cx, dy = y - b.cy, r = Math.hypot(dx, dy) / b.R, a = Math.atan2(dy, dx), i = y * w + x;
    if (r < 0.55) { m[i] = 1; tone[i] = 0.2 + 0.5 * r; } else if (r < 1.05 && Math.abs(((a / (Math.PI * 2)) * 16) % 1 - 0.5) < 0.12 * (1.1 - r)) { m[i] = 1; tone[i] = 0.8; }
  }
  return hatch(C, m, { pitch: Math.max(3, C.size / 16), angle: 1.0, tone });
});

/** The picture for the context's word, or null; held inside an oval around the word, fading at its rim. */
export function picture(C) {
  const draw = PICTURES.get(String(C.G.text).toLowerCase().trim()); if (!draw) return null;
  const b = box(C), m = draw(C, b), rx = Math.max(b.R * 1.4, C.G.width * 0.62), ry = b.R * 1.05;
  for (let y = 0; y < C.h; y++) for (let x = 0; x < C.w; x++) { const d = Math.hypot((x - b.cx) / rx, (y - b.cy) / ry); m[y * C.w + x] *= clamp((1 - d) * 5); }
  return m;
}
