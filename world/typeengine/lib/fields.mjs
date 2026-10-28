// lib/fields.mjs: pattern fields in font units (1000 per em, y up, glyph-local x). Each field has two forms that
// must agree: polys(p, box) -> closed polygons for the font builder (skia-pathops intersects the glyph with them),
// and at(x, y, p, aa) -> coverage 0..1 for the live and CPU renderers (analytic, so a word renders in one pass).
// tests/fields.test.mjs rasterises both and checks they match.
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const LO = -300, HI = 1000;
const tAt = (y) => clamp((y - LO) / (HI - LO));
const rect = (x0, y0, x1, y1) => [[x0, y0], [x0, y1], [x1, y1], [x1, y0]];
const disc = (cx, cy, r, n = 12) => [...Array(n).keys()].map((i) => { const a = -2 * Math.PI * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
const hash = (i, j, s) => { let h = (i * 374761393 + j * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// Value at u in 0..1 of a normalised series (linear between points).
export function seriesAt(y, u) {
  if (!y?.length) return 0.5;
  const f = clamp(u) * (y.length - 1), i = Math.floor(f), k = f - i;
  return y[i] * (1 - k) + y[Math.min(y.length - 1, i + 1)] * k;
}
export function normalise(y) { const a = Array.from(y), lo = Math.min(...a), hi = Math.max(...a); return a.map((v) => (hi > lo ? (v - lo) / (hi - lo) : 0.5)); }

export const FIELDS = {
  // Dot screen on a hex grid; dot radius follows a tone ramp from the descender (heavy) to the ascender (light).
  halftone: {
    polys(p, box) {
      const out = [], P = p.pitch;
      for (let y = LO, row = 0; y < HI; y += P * 0.866, row++) for (let x = box.x0 - P + (row % 2 ? P / 2 : 0); x < box.x1 + P; x += P) {
        const r = P * (p.heavy - (p.heavy - p.light) * tAt(y)); if (r > 1) out.push(disc(x, y, r));
      }
      return out;
    },
    at(x, y, p, aa) {
      const P = p.pitch, rh = P * 0.866, row = Math.round((y - LO) / rh), best = [row - 1, row, row + 1].reduce((m, r) => {
        const cy = LO + r * rh, off = r % 2 ? P / 2 : 0, cx = Math.round((x - off) / P) * P + off, rr = P * (p.heavy - (p.heavy - p.light) * tAt(cy));
        return Math.max(m, clamp((rr - Math.hypot(x - cx, y - cy)) / aa + 0.5));
      }, 0);
      return best;
    },
  },
  // Burin rules whose thickness swells toward the baseline: tone from line weight.
  engraved: {
    polys(p, box) { const out = []; for (let y = LO; y < HI; y += p.pitch) { const th = p.pitch * (p.heavy - (p.heavy - p.light) * tAt(y)); out.push(rect(box.x0 - 50, y, box.x1 + 50, y + th)); } return out; },
    at(x, y, p, aa) { const k = Math.floor((y - LO) / p.pitch), y0 = LO + k * p.pitch, th = p.pitch * (p.heavy - (p.heavy - p.light) * tAt(y0)), d = y - y0; return clamp(Math.min(d, th - d) / aa + 0.5); },
  },
  // Raster scanlines at a fixed duty: the phosphor rows of a tube, frozen.
  scanline: {
    polys(p, box) { const out = []; for (let y = LO; y < HI; y += p.pitch) out.push(rect(box.x0 - 50, y, box.x1 + 50, y + p.pitch * p.duty)); return out; },
    at(x, y, p, aa) { const d = ((y - LO) % p.pitch + p.pitch) % p.pitch, th = p.pitch * p.duty; return clamp(Math.min(d, th - d) / aa + 0.5); },
  },
  // A ledger: vertical bars across the glyph's advance, each as tall as the series value at its place.
  ledger: {
    polys(p, box) {
      const out = [], n = Math.max(2, Math.round((box.x1 - box.x0) / p.pitch)), y = p.series;
      for (let i = 0; i < n; i++) { const x0 = box.x0 + i * p.pitch, v = seriesAt(y, (i + 0.5) / n), top = p.floor + v * (p.ceil - p.floor); out.push(rect(x0 + p.pitch * p.gap / 2, LO, x0 + p.pitch * (1 - p.gap / 2), top)); }
      return out;
    },
    at(x, y, p, aa, box) {
      const n = Math.max(2, Math.round((box.x1 - box.x0) / p.pitch)), i = Math.floor((x - box.x0) / p.pitch); if (i < 0 || i >= n) return 0;
      const x0 = box.x0 + i * p.pitch, v = seriesAt(p.series, (i + 0.5) / n), top = p.floor + v * (p.ceil - p.floor);
      const dx = Math.min(x - (x0 + p.pitch * p.gap / 2), x0 + p.pitch * (1 - p.gap / 2) - x);
      return clamp(Math.min(dx, top - y) / aa + 0.5);
    },
  },
  // Ridgelines: rows of a trace lifted by an envelope (a sound's loudness, a series), as in a pulsar plot.
  ridgeline: {
    polys(p, box) {
      const out = [], step = 12;
      for (let yr = LO + p.pitch; yr < HI; yr += p.pitch) {
        const top = [], bot = [];
        for (let x = box.x0 - 40; x <= box.x1 + 40; x += step) { const c = yr + this.lift(x, yr, p, box); top.push([x, c + p.weight / 2]); bot.push([x, c - p.weight / 2]); }
        out.push([...bot, ...top.reverse()]);
      }
      return out;
    },
    lift(x, yr, p, box) { const u = (x - box.x0) / Math.max(1, box.x1 - box.x0), e = seriesAt(p.series, u), wob = Math.sin((x * 0.021) + yr * 0.13) * 0.5 + 0.5; return p.amp * e * (0.55 + 0.45 * wob); },
    at(x, y, p, aa, box) {
      const k = Math.round((y - LO) / p.pitch); let best = 0;
      for (let r = k - 2; r <= k + 1; r++) { const yr = LO + r * p.pitch; if (yr <= LO || yr >= HI) continue; const c = yr + this.lift(x, yr, p, box); best = Math.max(best, clamp((p.weight / 2 - Math.abs(y - c)) / aa + 0.5)); }
      return best;
    },
  },
  // Sand: one grain per jittered cell, the jitter seeded per cell so the font and the canvas place the same grains.
  sand: {
    polys(p, box) { const out = []; for (let j = Math.floor(LO / p.pitch); j * p.pitch < HI; j++) for (let i = Math.floor((box.x0 - 50) / p.pitch); i * p.pitch < box.x1 + 50; i++) { const [cx, cy] = this.grain(i, j, p); out.push(disc(cx, cy, p.grain, 8)); } return out; },
    grain(i, j, p) { return [(i + 0.15 + 0.7 * hash(i, j, p.seed)) * p.pitch, (j + 0.15 + 0.7 * hash(j, i, p.seed + 7)) * p.pitch]; },
    at(x, y, p, aa) { const i0 = Math.floor(x / p.pitch), j0 = Math.floor(y / p.pitch); let best = 0; for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) { const [cx, cy] = this.grain(i, j, p); best = Math.max(best, clamp((p.grain - Math.hypot(x - cx, y - cy)) / aa + 0.5)); } return best; },
  },
};

export const FIELD_NAMES = Object.freeze(Object.keys(FIELDS));
