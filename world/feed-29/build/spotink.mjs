// spotink.mjs: limited-palette illustration, after two families in feed set 29 (b): marker sketches with one spot
// colour on white (Chris Doretz), and two-tone ink scenes with one spot (Ailanto). Both reduce to rules, and the rules
// are what we build:
//   - Line weight by kind: silhouettes (one object against another or the sky) heaviest, creases (two faces of one
//     object) lighter, windows lightest. Weights are ink radii in px at 1x; lines are anti-aliased from a supersampled
//     face-id buffer through a chamfer distance, so a weight is a real width, not a blur.
//   - Marker mode: tone by face class laid as marker passes. Each pass is a band of nib width; neighbouring bands
//     overlap a little, so overlaps take a second multiply, as alcohol marker does; a few bands skip and leave paper.
//     Bands run vertical on fronts and along each side face's own vanishing direction.
//   - Two-tone mode: paper and ink only, plus hatching for the middle tone, so every pixel is paper, ink, spot or an
//     anti-aliased blend of two of them (tests check this).
//   - One spot colour, only on what is lit (windows, the tram band, the lamp).
//   - Construction lines (marker mode): roof edges run on past their corners, the draughtsman's overshoot.
// Input is our own scene (scene.mjs); no reference image is read.
import { raster, clamp, rng } from './lib/field.mjs';
import { hexLin } from './lib/color.mjs';
import { fbm } from '../../techniques/lib/util.js';
import { street, rasterize } from './scene.mjs';

export const SPEC = {
  id: 'ink.spot',
  params: {
    w: { min: 64, max: 4096, default: 1024, unit: 'px' }, h: { min: 64, max: 4096, default: 768, unit: 'px' }, mode: { options: ['marker', 'twotone'], default: 'marker' },
    spot: { default: '#2f6bd8', unit: 'hex' }, ink: { default: '#16151a', unit: 'hex' }, paper: { default: '#f3efe6', unit: 'hex' },
    weights: { default: [2.2, 1.1, 0.6], unit: 'ink radius px at 1024 wide: silhouette, crease, window' }, nib: { min: 4, max: 40, default: 16, unit: 'marker band px at 1024 wide' },
    ss: { min: 2, max: 4, default: 3, unit: 'samples per px per axis' }, seed: { default: 'street', unit: 'string' },
  },
  determinism: 'same seed and params give the same raster (tests/spotink.test.mjs)',
};

// Two-pass chamfer (3, 4) distance from marked samples, in samples.
function chamfer(mask, W, H) {
  const D = new Float32Array(W * H).fill(1e9);
  for (let i = 0; i < W * H; i++) if (mask[i]) D[i] = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; let d = D[i]; if (x) d = Math.min(d, D[i - 1] + 3); if (y) { d = Math.min(d, D[i - W] + 3); if (x) d = Math.min(d, D[i - W - 1] + 4); if (x < W - 1) d = Math.min(d, D[i - W + 1] + 4); } D[i] = d; }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; let d = D[i]; if (x < W - 1) d = Math.min(d, D[i + 1] + 3); if (y < H - 1) { d = Math.min(d, D[i + W] + 3); if (x < W - 1) d = Math.min(d, D[i + W + 1] + 4); if (x) d = Math.min(d, D[i + W - 1] + 4); } D[i] = d; }
  for (let i = 0; i < D.length; i++) D[i] /= 3;
  return D;
}

const TONE = { marker: [0.2, 0.46, 0.1, 0, 0.62], twotone: [0.3, 1, 0, 0.35, 1] }; // by class: front, side, top, ground, window

export function illustrate(o = {}) {
  const p = { w: 1024, h: 768, mode: 'marker', spot: '#2f6bd8', ink: '#16151a', paper: '#f3efe6', weights: [2.2, 1.1, 0.6], nib: 16, ss: 3, seed: 'street', ...o };
  const { w, h, ss } = p, k1 = w / 1024, quads = street(p.seed), S = rasterize(quads, w, h, { ss }), { ids, W, H, proj } = S;
  const PAPER = hexLin(p.paper), INK = hexLin(p.ink), SPOT = hexLin(p.spot), r = rng(p.seed + ':ink');
  // line masks per weight class, on the sample grid
  const masks = [0, 1, 2].map(() => new Uint8Array(W * H));
  const kind = (a, b) => { if (a === b) return -1; const A = a < 0 ? null : quads[a], B = b < 0 ? null : quads[b]; if (!A || !B || A.obj !== B.obj) return (A?.cls === 4 || B?.cls === 4) && A?.obj === B?.obj ? 2 : (A?.cls === 3 && B?.cls === 3 ? -1 : 0); return A.cls === 4 || B.cls === 4 ? 2 : 1; };
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const i = y * W + x; for (const j of [i + 1, i + W]) { const c = kind(ids[i], ids[j]); if (c >= 0) masks[c][i] = 1; } }
  const dist = masks.map(m => chamfer(m, W, H)), rad = p.weights.map(v => v * k1 * ss);
  // marker band parameters per quad: direction and per-band jitter
  // Side faces: bands are rays from the street's vanishing point, so strokes follow the perspective as a draughtsman's
  // do; s is the angle about the VP times the face centre's distance from it (nib constant at the face centre).
  const VP = proj([0, 0, 1e7]).map(v => v), vpD = quads.map(q => { if (q.cls !== 1) return 0; const c = q.pts.reduce((a, pt) => { const v = proj(pt); return [a[0] + v[0] / 4, a[1] + v[1] / 4]; }, [0, 0]); return Math.hypot(c[0] - VP[0], c[1] - VP[1]); });
  const qdir = quads.map(q => (q.cls === 3 ? Math.PI / 2 : 0));
  const nib = p.nib * k1 * ss, pitch = nib * 0.9, hatch = 6 * k1 * ss;
  // marker passes covering band coordinate s on quad qi: each band has its own width (0.95 to 1.3 nib), offset and
  // tone (0.85 to 1.15); 6 percent of bands are skipped. A sample can sit in its own band and the previous one.
  const H01 = (k, qi, m) => { const v = Math.sin(k * 12.9898 + qi * 78.233 + m * 37.719) * 43758.5453; return v - Math.floor(v); };
  const passes = (qi, s) => { const k = Math.floor(s / pitch), out = []; for (const b of [k, k - 1]) { if (H01(b, qi, 0) < 0.06) continue; const st = b * pitch + (H01(b, qi, 1) - 0.5) * 0.2 * pitch, wd = nib * (0.95 + 0.35 * H01(b, qi, 2)); if (s >= st && s - st < wd) out.push(0.85 + 0.3 * H01(b, qi, 3)); } return out; };
  const R = raster(w, h), tone = TONE[p.mode], spotCov = new Float32Array(w * h), lineCov = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const acc = [0, 0, 0]; let sc = 0, lc = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const X = x * ss + sx, Y = y * ss + sy, i = Y * W + X, qi = ids[i], q = qi >= 0 ? quads[qi] : null;
      let c = PAPER.slice();
      if (q) {
        // the left-hand blocks throw a shadow band 3.5 m across the street (low sun from the left of the viewer)
        const g = q.cls === 3 ? proj.ground(X, Y) : null, shade = g && g[0] > -7.5 && g[0] < -4 + 0.6 * Math.sin(g[2] * 0.21) && g[2] > 4 ? 1 : 0;
        const isSpot = q.cls === 4 && q.lit, t = isSpot ? 0.85 : q.cls === 3 ? (shade ? (p.mode === 'marker' ? 0.34 : 1) : tone[3]) : tone[q.cls];
        if (p.mode === 'marker' && t > 0) {
          const a = qdir[qi], along = q.cls === 1 ? Math.hypot(X - VP[0], Y - VP[1]) : -X * Math.sin(a) + Y * Math.cos(a), s0 = q.cls === 1 ? Math.atan2(Y - VP[1], X - VP[0]) * vpD[qi] : X * Math.cos(a) + Y * Math.sin(a);
          const s = s0 + 1e4 + 0.12 * nib * Math.sin(along / (9 * nib) + qi), ps = passes(qi, s), streak = 0.92 + 0.08 * Math.sin(along * 0.05 + qi);
          // one marker pass transmits mix(1, marker / paper, tone); n passes multiply (overlaps go darker)
          const m = isSpot ? SPOT : [0.34, 0.35, 0.39]; // a cool grey marker, or the spot
          for (const tf of ps) for (let ch = 0; ch < 3; ch++) c[ch] *= 1 - Math.min(0.97, t * tf * streak) * (1 - Math.min(1, m[ch] / PAPER[ch]));
        } else if (p.mode === 'twotone') {
          if (isSpot) c = SPOT.slice(); else if (t >= 0.99) c = INK.slice(); else if (t > 0) { const s = (X * 0.7 + Y * 0.7 * (q.cls === 3 ? 1 : 0)) % hatch; if (q.cls === 3 ? (Y % hatch) < hatch * t : s < hatch * t) c = INK.slice(); }
        }
        if (isSpot) sc++;
      }
      let line = 0; for (let k = 0; k < 3; k++) if (dist[k][i] <= rad[k]) line = 1;
      if (line) { c = INK.slice(); lc++; }
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    const n = ss * ss, o3 = 3 * (y * w + x), paperTex = p.mode === 'marker' ? 1 + 0.025 * (fbm(x / 90, y / 90, 3, 3) - 0.5) : 1;
    R.px[o3] = acc[0] / n * paperTex; R.px[o3 + 1] = acc[1] / n * paperTex; R.px[o3 + 2] = acc[2] / n * paperTex;
    spotCov[y * w + x] = sc / n; lineCov[y * w + x] = lc / n;
  }
  if (p.mode === 'marker') constructionLines(R, quads, proj, ss, k1, INK, r);
  R.spotCov = spotCov; R.lineCov = lineCov; R.palette = { paper: PAPER, ink: INK, spot: SPOT };
  return R;
}

// Roof edges extended past both corners by 6 to 14 percent, as hairlines at 45 percent ink.
function constructionLines(R, quads, proj, ss, k1, INK, r) {
  const { w, h, px } = R;
  for (const q of quads) {
    if (q.cls !== 2) continue;
    const P = q.pts.map(pt => proj.toCam(pt)); if (P.some(p => p[2] < 0.5)) continue;
    const S = P.map(p => proj.project(p).map(v => v / ss));
    for (let e = 0; e < 4; e++) {
      if (Math.abs(q.pts[e][2] - q.pts[(e + 1) % 4][2]) < 1e-6) continue; // only edges that run down the street, toward the VP
      const a = S[e], b = S[(e + 1) % 4], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 8 * k1) continue;
      const over = 0.06 + 0.08 * r(), ax = a[0] - dx * over, ay = a[1] - dy * over, bx = b[0] + dx * over, by = b[1] + dy * over;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - 2)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + 2)), y0 = Math.max(0, Math.floor(Math.min(ay, by) - 2)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + 2));
      const LL = (bx - ax) ** 2 + (by - ay) ** 2;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = clamp(((x + 0.5 - ax) * (bx - ax) + (y + 0.5 - ay) * (by - ay)) / LL), d = Math.hypot(x + 0.5 - ax - t * (bx - ax), y + 0.5 - ay - t * (by - ay));
        const a2 = 0.45 * clamp(1 - d / (0.6 * k1 + 0.5)); if (a2 <= 0) continue;
        const k = 3 * (y * w + x); for (let c = 0; c < 3; c++) px[k + c] += (INK[c] - px[k + c]) * a2;
      }
    }
  }
}
