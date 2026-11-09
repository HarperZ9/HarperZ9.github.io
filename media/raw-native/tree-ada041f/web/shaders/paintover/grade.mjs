// Time-of-day grade for a painted, projected surface. The painting is baked, so this does not
// relight it: it applies exposure, a tint, saturation and a lamp glow, each term read from the look
// keys (web/look/keys.mjs) at the current hour. Original code.
import { createLookKeys } from "../../look/keys.mjs";

// Eight slots (midnight, predawn, dawn, morning, noon, golden, dusk, night).
export const DEMO_TERMS = {
  exposure: { values: [0.3, 0.38, 0.78, 1.0, 1.08, 0.95, 0.58, 0.34], min: 0.05, max: 2 },
  tint: [[0.55, 0.66, 1.12], [0.72, 0.78, 1.06], [1.1, 0.9, 0.86], [1.0, 0.98, 0.95], [1.0, 1.0, 1.0], [1.15, 0.95, 0.76], [0.97, 0.78, 0.96], [0.6, 0.72, 1.1]],
  saturation: { values: [0.72, 0.78, 0.96, 1.0, 1.0, 1.05, 0.92, 0.76], min: 0, max: 2 },
  lampGlow: { values: [1.0, 0.9, 0.45, 0.08, 0.0, 0.4, 0.9, 1.0], min: 0, max: 1 },
  fill: { values: [0.8, 0.85, 1.0, 1.0, 1.0, 1.0, 0.95, 0.85], min: 0, max: 1 },
};
export const demoLook = (slots = 8) => createLookKeys({ slots, params: DEMO_TERMS });

function blurPlane(src, w, h, sigma) {
  const r = Math.max(1, Math.ceil(3 * sigma)), k = new Float32Array(2 * r + 1);
  let s = 0; for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-0.5 * (i / sigma) ** 2); s += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * src[y * w + Math.min(w - 1, Math.max(0, x + i))]; t[y * w + x] = a; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * t[Math.min(h - 1, Math.max(0, y + i)) * w + x]; o[y * w + x] = a; }
  return o;
}
// lampMask: Float32 (1 on lamp and lantern pixels). Returns the blurred glow planes once per frame.
export function glowOf(lampMask, w, h) { return { tight: blurPlane(lampMask, w, h, 5), wide: blurPlane(lampMask, w, h, 26) }; }

// Grade one frame. rgb: Float32 (3 per pixel); returns RGBA8.
export function gradeFrame(rgb, w, h, t, glow) {
  const out = new Uint8ClampedArray(w * h * 4), e = t.exposure, sat = t.saturation, tint = t.tint;
  for (let i = 0; i < w * h; i++) {
    let r = rgb[i * 3] * tint[0], g = rgb[i * 3 + 1] * tint[1], b = rgb[i * 3 + 2] * tint[2];
    const l = 0.3 * r + 0.59 * g + 0.11 * b; r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
    // the baked painting is dimmed with the sun; lamp light is added back as a warm glow
    r *= e; g *= e; b *= e;
    const gl = t.lampGlow; if (gl > 0) { const a = 0.55 * glow.tight[i] + 0.9 * glow.wide[i]; r += gl * a * 1.0; g += gl * a * 0.72; b += gl * a * 0.38; }
    out[i * 4] = Math.round(Math.min(1, Math.max(0, r)) * 255); out[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, g)) * 255); out[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255); out[i * 4 + 3] = 255;
  }
  return out;
}
