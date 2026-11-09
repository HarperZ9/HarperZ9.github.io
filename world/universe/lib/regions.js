// Region grounds: each design philosophy draws its own ground from a cleared plate or its own rule
// (ground-draw.js). Grounds are painted in a worker, one per zoom bucket, and cached here as bitmaps; until a
// bucket arrives, the nearest bucket already painted stands in, so a window is never empty and the page
// thread never stalls. Without worker support the same code paints on the page.
import { ROOT } from "./data.js";
import { ENV, R, paint } from "./ground-draw.js";

const PLATES = {
  brut: "exhibit/assets/img/concrete-layers-s.webp",
  surreal: "ui/assets/goya-nobody-720.webp",
  archive: "exhibit/assets/img/palimpsest-c-s.webp",
  deco: "ui/assets/ferriss-zoning-1922-720.webp",
  glitch: "ui/assets/deep-field-720.webp",
  print: "exhibit/assets/img/riso-print-s.webp",
};
const cache = new Map(), pending = new Set();
let worker = null;

// The survey sheet's data: [type, count] pairs for the grid place's threads. Clears the cached grid grounds.
export function setSurvey(bands) { ENV.survey = bands; for (const k of [...cache.keys()]) if (k.startsWith("grid:")) cache.delete(k); }

export async function preload() {
  await Promise.all(Object.entries(PLATES).map(([k, p]) => new Promise((res) => {
    const i = new Image(); i.decoding = "async"; i.src = ROOT + p;
    i.onload = () => { ENV.img[k] = i; ENV.lum[k] = luminance(i, 180); res(); };
    i.onerror = () => { console.warn("universe: region plate missing", p); res(); };
  })));
  try {
    worker = new Worker(new URL("./ground-worker.js", import.meta.url), { type: "module" });
    const img = {};
    for (const [k, i] of Object.entries(ENV.img)) img[k] = await createImageBitmap(i);
    worker.postMessage({ init: { img, lum: ENV.lum, survey: ENV.survey } }, Object.values(img));
    worker.onmessage = (e) => { const { key, bitmap, error } = e.data; pending.delete(key); if (bitmap) cache.set(key, bitmap); else console.warn("universe: ground not painted", key, error); };
    worker.onerror = (e) => { console.warn("universe: ground worker failed, painting on the page", e.message); worker = null; };
  } catch (e) { console.warn("universe: no worker, painting on the page", e); worker = null; }
}

function luminance(i, w) {
  const h = Math.round((w * i.naturalHeight) / i.naturalWidth), c = new OffscreenCanvas(w, h), x = c.getContext("2d");
  x.drawImage(i, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, L = new Float32Array(w * h);
  for (let k = 0; k < L.length; k++) L[k] = (0.2126 * d[4 * k] + 0.7152 * d[4 * k + 1] + 0.0722 * d[4 * k + 2]) / 255;
  return { w, h, L };
}

// A ground for one region at a pixel scale, or the nearest painted one while it is being made.
export function ground(region, px, ink) {
  if (!(px > 0) || !Number.isFinite(px)) return null;  // a window with no size yet has no ground
  const key = region.id + ":" + px + ":" + ink;
  if (cache.has(key)) return cache.get(key);
  if (!worker) { const c = paint(region.id, px, ink); cache.set(key, c); return c; }
  if (!pending.has(key)) { pending.add(key); worker.postMessage({ key, region: region.id, px, ink, survey: region.id === "grid" ? ENV.survey : null }); }
  let best = null, bd = Infinity;
  for (const [k, v] of cache) { const [r, p, i] = k.split(":"); if (r === region.id && i === ink) { const d = Math.abs(Math.log(+p / px)); if (d < bd) { bd = d; best = v; } } }
  return best;
}

export const bucketFor = (A) => !(A > 0) ? 0 : Math.min(1200 / (2 * R), Math.pow(2, Math.round(Math.log2((2.6 * A * Math.min(devicePixelRatio || 1, 2.5)) / (2 * R)) * 2) / 2));

// An aperture: a round window onto a region's material, the way a lit window shows one room of a building.
// The material drifts slowly inside the window (alive), and the window breathes by a few percent.
export function aperture(ctx, region, cx, cy, A, ink, t, still, alpha = 0.5) {
  const g = ground(region, bucketFor(A), ink); if (!g) return;  // capped at 1200 px: a wider window is becoming the page
  const s = 2.8 * A, dx = still ? 0 : Math.sin(t * 0.07 + cx * 0.01) * A * 0.12, dy = still ? 0 : Math.cos(t * 0.05 + cy * 0.01) * A * 0.1;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, A, 0, 6.2832); ctx.clip();
  ctx.globalAlpha = alpha; ctx.drawImage(g, cx - s / 2 + dx, cy - s / 2 + dy, s, s);
  ctx.restore(); ctx.globalAlpha = 1;
}

// Build the grounds a session will need before it needs them (in the worker, so this costs the page nothing).
export function prewarm(jobs) { for (const j of jobs) if (j.A > 0) ground(j.region, bucketFor(j.A), j.ink); }

// Clumped monochrome grain (QUALITY-SPEC R4): noise at half resolution, upscaled smooth.
export function grainPattern(ctx, ink) {
  const n = new OffscreenCanvas(128, 128), x = n.getContext("2d"), d = x.createImageData(128, 128);
  let s = 5; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < d.data.length; i += 4) { const v = r(); d.data[i] = d.data[i + 1] = d.data[i + 2] = ink === "light" ? 255 : 0; d.data[i + 3] = Math.round(v * v * 34); }
  x.putImageData(d, 0, 0);
  const up = new OffscreenCanvas(256, 256), y = up.getContext("2d"); y.imageSmoothingQuality = "high"; y.drawImage(n, 0, 0, 256, 256);
  return ctx.createPattern(up, "repeat");
}
