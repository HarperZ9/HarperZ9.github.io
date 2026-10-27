// sources.mjs: layers made by our generators. Each returns a Layer; several also return what they
// computed in layer.meta, so a HUD mark can point at a real feature (a nodal crossing, a colony centre).
import { Layer } from './layer.mjs';
import { colour, toLin, hash, bilinear, rng } from './px.mjs';
import { membraneAmplitude, sampleAmp } from '../../feed-22/build/chladni.js';
import { World, splat } from '../../feed-22/build/swimmers.js';
import { field as hammingField } from '../../feed-24/build/hamming.js';
import { filmLinear } from '../../substrate/lib/thinfilm.mjs';
import { fbm } from '../../feed-23/build/brush/core.js';

export function solid(w, h, c, { seed = 1 } = {}) { return new Layer(w, h, { seed }).fill(c); }

// Scalar field (0..1 per pixel) into a grey layer, linear-light from an sRGB-encoded value.
export function fromField(w, h, f, { seed = 1 } = {}) {
  const L = new Layer(w, h, { seed });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = toLin(Math.min(1, Math.max(0, f(x / w, y / h)))), k = 3 * (y * w + x); L.px[k] = L.px[k + 1] = L.px[k + 2] = v; }
  return L;
}

export function noise(w, h, { scale = 4, octaves = 4, seed = 1 } = {}) {
  return fromField(w, h, (u, v) => 0.5 + (fbm(u * scale, v * scale * (h / w), seed, octaves) - 0.5) * 1.8, { seed });
}

// The signed membrane field from chladni.js's formula, for finding crossings (where f = 0 and grad f = 0).
export function membrane(n, m, mixDeg, u, v) {
  const a = (mixDeg * Math.PI) / 180, P = Math.PI;
  return Math.cos(a) * Math.sin(n * P * u) * Math.sin(m * P * v) + Math.sin(a) * Math.sin(m * P * u) * Math.sin(n * P * v);
}
// Merge candidates closer than d (grid ties make one feature two adjacent extrema); keep the first.
function merge(pts, d) { const out = []; for (const p of pts) if (out.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > d)) out.push(p); return out; }

// Crossings of any field f(u, v): local minima of |f| + |grad f| / k below 0.06, k the field's wavenumber.
export function crossingsOf(f, k, R = 192) {
  const s = new Float32Array(R * R), out = [], h = 1 / (R - 1);
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
    const u = i * h, v = j * h, gx = (f(u + h, v) - f(u - h, v)) / (2 * h), gy = (f(u, v + h) - f(u, v - h)) / (2 * h);
    s[j * R + i] = Math.abs(f(u, v)) + Math.hypot(gx, gy) / k;
  }
  for (let j = 2; j < R - 2; j++) for (let i = 2; i < R - 2; i++) {
    const v = s[j * R + i]; if (v > 0.06) continue;
    let min = true; for (let b = -2; b <= 2 && min; b++) for (let a = -2; a <= 2; a++) if ((a || b) && s[(j + b) * R + i + a] < v) { min = false; break; }
    if (min) out.push([i / (R - 1), j / (R - 1)]);
  }
  return merge(out, 1.5 / k);
}
export const crossings = (n, m, mixDeg, R = 192) => crossingsOf((u, v) => membrane(n, m, mixDeg, u, v), Math.PI * Math.max(n, m), R);

// Antinodes: local maxima of |f| above `floor` (where the plate moves most and sand leaves).
export function antinodes(n, m, mixDeg, R = 160, floor = 0.6) {
  const a = new Float32Array(R * R), out = [];
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) a[j * R + i] = Math.abs(membrane(n, m, mixDeg, i / (R - 1), j / (R - 1)));
  let mx = 0; for (const v of a) mx = Math.max(mx, v);
  for (let j = 1; j < R - 1; j++) for (let i = 1; i < R - 1; i++) {
    const v = a[j * R + i]; if (v < floor * mx) continue;
    let top = true; for (let b = -1; b <= 1 && top; b++) for (let c = -1; c <= 1; c++) if ((b || c) && a[(j + b) * R + i + c] > v) { top = false; break; }
    if (top) out.push([i / (R - 1), j / (R - 1)]);
  }
  return merge(out, 0.3 / Math.max(n, m));
}

// Chladni membrane tile. Nodal lines bright where the amplitude from chladni.js is near zero. With
// sand > 0 the lines are drawn as sand: each pixel is a grain with probability sand x nodal^1.5, the way
// grains collect where the plate stands still (a stipple, seeded).
export function chladni(w, h, { n = 3, m = 5, mix = 30, width = 0.08, R = 256, sand = 0, seed = 1 } = {}) {
  const amp = membraneAmplitude(n, m, mix, R), r = sand ? rng(hash(seed, 77)) : null;
  const L = fromField(w, h, (u, v) => {
    const k = Math.exp(-((sampleAmp(amp, u * 2 - 1, v * 2 - 1) / width) ** 2));
    return sand ? (r() < sand * k ** 1.5 ? 0.75 + 0.25 * r() : 0.04 * k) : k;
  }, { seed });
  if (sand) L.blur({ r: 1 }); // a grain is a soft dot, not a hard pixel
  L.meta.chladni = { n, m, mix, crossings: crossings(n, m, mix), antinodes: antinodes(n, m, mix) }; return L;
}

// Hamming-distance field (popcount of x xor y, mod m) from feed set 24, as grey levels.
export function hamming(w, h, { mod = 8, x0 = 288, y0 = 65, scale = 4, seed = 1 } = {}) {
  const f = hammingField({ w, h, x0, y0, mod, scale });
  return fromField(w, h, (u, v) => f[Math.min(h - 1, (v * h) | 0) * w + Math.min(w - 1, (u * w) | 0)] / (mod - 1), { seed });
}

// Thin-film light material: thickness from fbm, colour from the two-beam film in the substrate lib.
export function film(w, h, { dMin = 180, dMax = 760, scale = 2.2, seed = 1 } = {}) {
  const L = new Layer(w, h, { seed });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = Math.min(1, Math.max(0, 0.5 + (fbm((x / w) * scale, (y / w) * scale, seed, 5) - 0.5) * 1.8)), c = filmLinear(dMin + (dMax - dMin) * t);
    L.px.set(c, 3 * (y * w + x));
  }
  L.meta.film = { dMin, dMax }; return L;
}

// The swimmer colony from feed set 22, run for `steps`, splatted to heat and cool channels and mapped
// to ink on a ground. meta.colony carries swimmer positions (layer px) and the centre of mass.
export function swimmers(w, h, { seed = 3, count = 70, pellets = 7, steps = 900, ground = '#0f0e0f', heat = '#d79e35', cool = '#7383a7', gain = 2.5 } = {}) {
  const world = new World({ W: 1000, H: Math.round((1000 * h) / w), seed, swimmers: count, pellets });
  for (let i = 0; i < steps; i++) world.step(1 / 30);
  const S = splat(world, w), G = colour(ground), Hc = colour(heat), Cc = colour(cool), L = new Layer(w, h, { seed }), sh = S.h ?? Math.round((w * world.o.H) / world.o.W);
  const HF = S.heat, CF = S.cool;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sy = Math.min(sh - 1, Math.round((y * sh) / h)), i = sy * w + x, a = Math.min(1, HF[i] * gain), b = Math.min(1, CF[i] * gain * 0.9), k = 3 * (y * w + x);
    for (let c = 0; c < 3; c++) L.px[k + c] = G[c] + (Cc[c] - G[c]) * b + (Hc[c] - G[c]) * a * (1 - 0.5 * b);
  }
  const sx = w / world.o.W, sy = h / world.o.H, pts = world.swimmers.map((s) => [s.x * sx, s.y * sy]);
  const cx = pts.reduce((a, p) => a + p[0], 0) / (pts.length || 1), cy = pts.reduce((a, p) => a + p[1], 0) / (pts.length || 1);
  L.meta.colony = { points: pts, centre: [cx, cy], swimmers: world.swimmers.length, pellets: world.pellets.length, steps, mass: world.totalMass() };
  return L;
}

// A plate image ({ w, h, data: Uint8 RGB sRGB }) fitted to w x h by cover-crop, focus in 0..1.
export function plate(img, w, h, { focus = [0.5, 0.5], zoom = 1, seed = 1 } = {}) {
  const src = new Float32Array(img.w * img.h * 3); for (let i = 0; i < src.length; i++) src[i] = toLin(img.data[i] / 255);
  const s = Math.max(w / img.w, h / img.h) * zoom, vw = w / s, vh = h / s, ox = (img.w - vw) * focus[0], oy = (img.h - vh) * focus[1];
  const L = new Layer(w, h, { seed: hash(seed, img.w * 31 + img.h) }), c = [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { bilinear(src, img.w, img.h, ox + (x + 0.5) / s - 0.5, oy + (y + 0.5) / s - 0.5, c); L.px.set(c, 3 * (y * w + x)); }
  L.meta.plate = { title: img.title ?? null, year: img.year ?? null }; return L;
}

// Binary PPM (P6, 8-bit) reader: the format tools/plates.py writes, so node reads plates with no decoder.
export function readPPM(bytes, extra = {}) {
  let o = 0; const tok = () => {
    while (o < bytes.length) { if (bytes[o] === 35) { while (bytes[o] !== 10) o++; } else if (bytes[o] <= 32) o++; else break; }
    let s = ''; while (o < bytes.length && bytes[o] > 32) s += String.fromCharCode(bytes[o++]); return s;
  };
  if (tok() !== 'P6') throw new Error('readPPM: not a binary P6 file');
  const w = +tok(), h = +tok(), max = +tok(); o++;
  if (max !== 255) throw new Error('readPPM: only 8-bit PPM is supported');
  return { w, h, data: bytes.subarray(o, o + w * h * 3), ...extra };
}
