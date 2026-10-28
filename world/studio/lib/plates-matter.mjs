// plates-matter.mjs: plates made of stuff: paper fibre, rope, deco rays, glitch blocks, brush paint, liquid, code.
// Same contract as plates-surface.mjs: (w, h, material, ctx) -> Layer.
import { Layer, colour, hamming } from '../../feed-25/build/compose.mjs';
import { Surface, paintStroke } from '../../feed-23/build/brush/index.js';
import { curlPath } from '../../feed-23/build/brush/paths.js';
import { Fluid, toGrid } from './fluid.mjs';
import { codeCells } from './drivers.mjs';

// The code plate's own text when no code is driven in: the plate function, read as code.
const SAMPLE = ['export function codecells(w, h, m, ctx) {', '  const cells = ctx.drive?.cells;', '  for (const t of cells.tone) if (t > 0) ink(t);', '  return L;', '}'].join(String.fromCharCode(10));
import { field, ramp, noiseField, boxBlur, clamp, smooth, band, rng, fbm } from './field.mjs';

const RAD = Math.PI / 180;

// Torn paper: a top sheet torn away where the word is (or along a diagonal), fibre fringe on every torn edge.
export function fibre(w, h, m, ctx) {
  const c = m.core, u = ctx.u, M = ctx.mask;
  const N = noiseField(w, h, 26 * u, ctx.seed + 2, 5), hair = noiseField(w, h, 1.6 * u, ctx.seed + 6, 2);
  const open = M ? boxBlur(boxBlur(M, w, h, Math.max(2, Math.round(5 * u))), w, h, Math.max(2, Math.round(5 * u))) : field(w, h, (x, y) => smooth(-0.02, 0.02, (y / h) - 0.55 - 0.18 * (x / w - 0.5)));
  // the sheet underneath is printed matter: ink-dark, with a fine screen, so the tear reads as an opening
  const L = new Layer(w, h, { seed: ctx.seed }), p = L.px, top = colour(m.palette.accent), g = colour(m.palette.ground), ink = colour(m.palette.ink);
  const under = g.map((v, ch) => v + (ink[ch] - v) * 0.62), screen = field(w, h, (x, y) => 0.5 + 0.5 * Math.sin(x * 0.9 / u) * Math.sin(y * 0.9 / u));
  for (let i = 0; i < w * h; i++) {
    const edge = open[i] + (N[i] - 0.5) * 0.8 + (hair[i] - 0.5) * 0.2, d = (edge - 0.5) / Math.max(0.02, 0.05 * c.fibre + 0.02);
    const torn = clamp(0.5 + d), fringe = clamp(Math.exp(-((d + 1.6) ** 2) * 0.22) * c.fibre * (0.45 + 1.2 * (hair[i] - 0.35))), shadow = clamp(1 - 0.35 * Math.exp(-((d + 1.5) ** 2)));
    for (let ch = 0; ch < 3; ch++) {
      const paper = top[ch] * (0.92 + 0.12 * (N[i] - 0.5)), base = under[ch] * shadow * (0.9 + 0.16 * screen[i] + 0.1 * (hair[i] - 0.5));
      const v = paper * (1 - torn) + base * torn;
      p[3 * i + ch] = v + ((top[ch] + (0.93 - top[ch]) * 0.7) - v) * fringe;
    }
  }
  L.a = new Float32Array(w * h).fill(1);
  return L;
}

// Rope: rows of laid three-strand rope at the material's angle; the word's rows sit raised and lit.
export function strands(w, h, m, ctx) {
  const c = m.core, u = ctx.u, R = (22 + 16 * (1 - c.order)) * u, lay = R * 3.2, M = ctx.mask;
  const a = c.lineDeg * RAD, ax = Math.cos(a), ay = Math.sin(a), N = noiseField(w, h, 3 * u, ctx.seed + 4, 2);
  const L = new Layer(w, h, { seed: ctx.seed }), p = L.px, ink = colour(m.palette.ink), hi = colour(m.palette.accent), g = colour(m.palette.ground);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const s = x * ax + y * ay, t = -x * ay + y * ax, row = Math.round(t / (2 * R)), tc = (t - row * 2 * R) / R;
    let best = -1, crest = 0;
    for (let k = 0; k < 3; k++) {
      const ph = (s / lay) * 2 * Math.PI + (k * 2 * Math.PI) / 3 + row * 1.7, off = 0.62 * Math.sin(ph), z = Math.cos(ph);
      const d = Math.abs(tc - off); if (d < 0.42 && z > best) { best = z; crest = 1 - d / 0.42; }
    }
    // the word is rope; outside it the rows are only a ghost of the lay, so the letters stand out of the coil
    const q = M ? M[i] : 1, edge = clamp((0.95 - Math.abs(tc)) * R), inRope = edge * (M ? 0.18 + 0.82 * q : 1);
    const lum = best < -0.5 ? 0.08 : (0.25 + 0.75 * crest * crest) * (0.55 + 0.45 * (best + 1) / 2) * (0.85 + 0.3 * N[i]);
    for (let ch = 0; ch < 3; ch++) { const fibreCol = ink[ch] + (hi[ch] - ink[ch]) * lum; p[3 * i + ch] = g[ch] + (fibreCol - g[ch]) * inRope; }
  }
  return L;
}

// Art deco: a sunburst of rays and hairlines from a vanishing point under a stepped setback skyline.
export function sunburst(w, h, m, ctx) {
  const c = m.core, u = ctx.u, cx = w / 2, cy = h * 1.02, rays = Math.round(18 + 30 * c.order), M = ctx.mask;
  const ink = colour(m.palette.ink), acc = colour(m.palette.accent), g = colour(m.palette.ground);
  const steps = 5, L = new Layer(w, h, { seed: ctx.seed }), p = L.px, inner = M ? boxBlur(M, w, h, Math.max(2, Math.round(9 * u))) : null;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const ang = Math.atan2(cy - y, x - cx), r = Math.hypot(x - cx, cy - y), f = (ang / Math.PI) * rays;
    const dRay = (f - Math.round(f)) * r * Math.PI / rays, fan = Math.round(f) % 2 === 0 ? 1 : 0;
    const hair = band(dRay, 0.55 * u), ring = band(((r / (38 * u)) % 1 - 0.5) * 38 * u, 0.5 * u) * smooth(0.2, 0.6, r / h);
    // the setback: each step narrower and taller, centred
    let sky = 0;
    for (let k = 0; k < steps; k++) { const hw = (0.42 - k * 0.075) * w, top = h * (0.92 - k * 0.13); if (Math.abs(x - cx) < hw && y > top) sky = Math.max(sky, clamp(Math.min(hw - Math.abs(x - cx), y - top) + 0.5)); }
    const glow = Math.exp(-r / (h * 0.9)), word = M ? M[i] : 0;
    for (let ch = 0; ch < 3; ch++) {
      let v = g[ch] + (acc[ch] - g[ch]) * (0.18 * fan + 0.25 * glow * c.sheen * 2);
      v += (acc[ch] - v) * Math.max(hair * 0.8, ring * 0.35);
      v = v + (g[ch] * 0.6 - v) * sky;
      v = v + (ink[ch] - v) * word;
      // deco inline: a hairline of the ground run inside each letter, where the blurred coverage crosses 0.8
      if (inner) v += (acc[ch] * 0.45 - v) * word * band((inner[i] - 0.82) * 40 * u, 0.6 * u);
      p[3 * i + ch] = v;
    }
  }
  return L;
}

// DMV glitch: the Hamming field posterised, duotoned, block-corrupted and scan-waved on the beat grid.
export function blocks(w, h, m, ctx) {
  const c = m.core, L = hamming(w, h, { mod: 4 + Math.round(8 * c.order), scale: Math.max(1, Math.round(ctx.u * 3)), seed: ctx.seed });
  L.posterize({ levels: 3 + Math.round(3 * c.order) }).duotone(m.palette.ground, m.palette.accent);
  if (ctx.mask) { const ink = new Layer(w, h).fill(m.palette.ink); L.place(ink, 0, 0, { mask: ctx.mask }); }
  L.blocks({ count: Math.round(40 + 160 * c.transient), palette: [m.palette.accent, m.palette.ink, m.palette.ground] });
  L.scanwave({ wavelength: 60 * ctx.u * 4, amp: 3 * ctx.u * 2, band: Math.max(2, Math.round(6 * ctx.u)), dim: 0.8 });
  return L;
}

// Brush: strokes from the drive (data series, sound onsets) or, without one, strokes that fill the word,
// painted by the feed set 23 stamp engine in linear float and laid over the ground.
export const INK_BRUSH = { tip: ['bristle', { seed: 5 }], size: 0.014, spacing: 0.05, flow: 0.5, angle: 'stroke', aspect: 1.5,
  pressure: { size: [0.3, 1], flow: [0.45, 1], gamma: 1.2 }, taper: { start: 0.12, end: 0.35 }, grain: { kind: 'paper', period: 0.0047, depth: 0.28 }, wet: { mix: 0.25, pickup: 0.15 } };
export function brush(w, h, m, ctx) {
  const c = m.core, S = new Surface(w, h), ds = ctx.drive?.strokes ?? [];
  const strokes = ctx.overlay ? ds : (ds.length && !ctx.mask ? ds : [...defaultStrokes(w, h, m, ctx), ...ds]);
  const b = { ...INK_BRUSH, size: INK_BRUSH.size * (0.6 + 0.8 * c.flow), wet: { mix: 0.15 + 0.5 * c.flow, pickup: 0.1 + 0.3 * c.flow } };
  strokes.forEach((s, k) => paintStroke(S, { ...b, size: b.size * (s.size ?? 1) }, s.pts.map(q => ({ x: q.x * w, y: q.y * w, p: q.p })), { unit: w, seed: ctx.seed * 97 + k, color: s.color ?? m.palette.ink }));
  const L = new Layer(w, h, { seed: ctx.seed }).fill(m.palette.ground), p = L.px, q = S.px;
  if (ctx.overlay) {
    L.a = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { const a = q[4 * i + 3]; L.a[i] = Math.min(1, a); if (a > 1e-5) for (let ch = 0; ch < 3; ch++) p[3 * i + ch] = q[4 * i + ch] / a; }
    return L;
  }
  for (let i = 0; i < w * h; i++) { const a = q[4 * i + 3]; for (let ch = 0; ch < 3; ch++) p[3 * i + ch] = p[3 * i + ch] * (1 - a) + q[4 * i + ch]; }
  return L;
}
function defaultStrokes(w, h, m, ctx) {
  if (ctx.mask) return maskStrokes(w, h, m, ctx);
  const R = rng(ctx.seed * 7 + 1), out = [], M = null, n = 26;
  for (let k = 0; k < n * 4 && out.length < n; k++) {
    const x = R(), y = R() * (h / w);
    if (M && M[Math.min(h - 1, (y * w) | 0) * w + Math.min(w - 1, (x * w) | 0)] < 0.6) continue;
    const pts = curlPath(ctx.seed + k, x, y, { steps: M ? 10 : 36, step: M ? 0.004 : 0.012, scale: 3, drift: [Math.cos(m.core.lineDeg * RAD), Math.sin(m.core.lineDeg * RAD) * 0.4] });
    out.push({ pts, size: M ? 0.55 : 1.6 });
  }
  return out;
}

// Strokes that paint the word: one stroke per run of covered pixels on rows a brush width apart, with a
// wobble, pressure swelling through the run, and a few vertical pulls so stems carry the bristle direction.
function maskStrokes(w, h, m, ctx) {
  const M = ctx.mask, R = rng(ctx.seed * 11 + 3), out = [], d = Math.max(3, w * INK_BRUSH.size * (0.6 + 0.8 * m.core.flow) * 0.55);
  for (let y = d / 2; y < h; y += d * (0.8 + 0.3 * R())) {
    const row = Math.round(y) * w; let x0 = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && M[row + x] > 0.5;
      if (on && x0 < 0) x0 = x;
      if (!on && x0 >= 0) {
        if (x - x0 > d * 0.6) {
          const n = Math.max(3, Math.round((x - x0) / (d * 0.5))), pts = [];
          for (let k = 0; k <= n; k++) { const f = k / n; pts.push({ x: (x0 + (x - x0) * f) / w, y: (y + Math.sin(f * 3 + y) * d * 0.12) / w, p: 0.45 + 0.55 * Math.sin(Math.PI * f) }); }
          out.push({ pts, size: 1 });
        }
        x0 = -1;
      }
    }
  }
  return out;
}

// Liquid: the payload as dye in a stable-fluids tank, run to the material's duration, lit like a meniscus.
export function liquid(w, h, m, ctx) {
  const c = m.core, nx = 160, ny = Math.max(16, Math.round(160 * h / w)), F = new Fluid(nx, ny, { seed: ctx.seed });
  const src = ctx.drive?.dye ?? ctx.mask ?? field(w, h, (x, y) => (fbm(x / (w * 0.12), y / (w * 0.12), ctx.seed, 3) > 0.55 ? 1 : 0));
  F.dye.set(toGrid(src, w, h, nx, ny));
  F.swirl(6 + 30 * c.flow, 0.05);
  for (const imp of ctx.drive?.impulses ?? []) F.impulse(imp.x * nx, imp.y * ny, imp.vx, imp.vy, imp.r ?? 6);
  F.run((ctx.time ?? 1) * c.durationS * 0.5);
  const D = field(w, h, (x, y) => F.sample(x / (w - 1), y / (h - 1)));
  const sm = boxBlur(D, w, h, Math.max(1, Math.round(ctx.u)));
  const ink = colour(m.palette.ink), acc = colour(m.palette.accent), g = colour(m.palette.ground), L = new Layer(w, h, { seed: ctx.seed }), p = L.px;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const gx = sm[Math.min(w * h - 1, i + 1)] - sm[Math.max(0, i - 1)], gy = sm[Math.min(w * h - 1, i + w)] - sm[Math.max(0, i - w)];
    const spec = Math.pow(clamp(0.5 - (gx - gy) * 6 * w / 1000), 6) * c.sheen * 2, d = clamp(sm[i] * 1.4);
    for (let ch = 0; ch < 3; ch++) { const dye = acc[ch] + (ink[ch] - acc[ch]) * smooth(0.5, 1, d); p[3 * i + ch] = clamp(g[ch] + (dye - g[ch]) * smooth(0.05, 0.6, d) + spec * 0.6, 0, 0.98); }
  }
  L.meta.energy = F.energy();
  return L;
}

// Code: one cell per character, tone by token class, on a glyph-cell grid (feed set 20 family B).
export function codecells(w, h, m, ctx) {
  const cells = ctx.drive?.cells ?? codeCells(SAMPLE);
  const pitch = Math.min(w / cells.cols, h / cells.rows), ox = (w - pitch * cells.cols) / 2, oy = (h - pitch * cells.rows) / 2, gap = Math.max(0.6, pitch * 0.14);
  const ink = colour(m.palette.ink), acc = colour(m.palette.accent), g = colour(m.palette.ground), L = new Layer(w, h, { seed: ctx.seed }).fill(m.palette.ground), p = L.px;
  const alpha = ctx.overlay ? (L.a = new Float32Array(w * h)) : null;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const cx = Math.floor((x - ox) / pitch), cy = Math.floor((y - oy) / pitch);
    if (cx < 0 || cy < 0 || cx >= cells.cols || cy >= cells.rows) continue;
    const t = cells.tone[cy * cells.cols + cx]; if (!(t > 0)) continue;
    const lx = x - ox - cx * pitch, ly = y - oy - cy * pitch, half = (pitch - gap) / 2 * Math.sqrt(t);
    const cov = clamp(half - Math.abs(lx - pitch / 2) + 0.5) * clamp(half - Math.abs(ly - pitch / 2) + 0.5);
    const hot = cells.kind?.[cy * cells.cols + cx] === 2;
    for (let ch = 0; ch < 3; ch++) p[3 * i + ch] = ctx.overlay ? (hot ? acc[ch] : ink[ch]) : g[ch] + ((hot ? acc[ch] : ink[ch]) - g[ch]) * cov;
    if (alpha) alpha[i] = cov;
  }
  return L;
}
