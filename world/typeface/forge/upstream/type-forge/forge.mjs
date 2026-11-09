// system/type-forge/forge.mjs
// Parametric type under witness: the Zain Mint engine in the browser. A port of Flywheel's
// harness/typeface_forge.py. Fixed skeletons (the alphabet's topology) are traced by a pen whose
// width follows the stroke direction; legibility rules can REFUSE a mint by name; spacing comes from
// measured ink and kerning from measured white. The same parameters always mint the same outlines,
// and forge.test.mjs holds this port to the Python engine's font bytes.

import { build } from "./skeletons.mjs";
import { mulberry32 } from "../media-engine/seed.mjs";
import { pyRound } from "./pyround.mjs";

export const EM = 1000.0;

export const DEFAULTS = Object.freeze({
  x_height: 0.50,    // of the em
  ascender: 1.5,     // in x-heights
  weight: 0.085,     // stem width, of the em
  contrast: 0.82,    // horizontal/vertical stroke ratio (1 = monolinear)
  width: 1.0,        // condensed .. extended
  roundness: 2.4,    // superellipse exponent for bowls
  aperture: 0.6,     // 0 closed .. 1 open terminals
  overshoot: 0.015,  // of the x-height, on round extremes
});

export const RULES = Object.freeze(["overshoot", "contrast-floor", "counter-minimum", "tracy-spacing", "geometric-kern"]);
export const ENGINE = "zain-mint-forge.js/1";

const KERN_BANDS = 8;

function profiles(glyphs, xh) {
  const out = {};
  for (const [name, g] of Object.entries(glyphs)) {
    const left = new Array(KERN_BANDS).fill(null), right = new Array(KERN_BANDS).fill(null);
    for (const ring of g.contours) for (const [x, y] of ring) {
      const b = Math.trunc(Math.min(Math.max(y / xh, 0.0), 0.999) * KERN_BANDS);
      if (left[b] === null || x < left[b]) left[b] = x;
      if (right[b] === null || x > right[b]) right[b] = x;
    }
    out[name] = [left, right];
  }
  return out;
}

// Pair adjustments from measured white, pulled or pushed toward the face's own rhythm.
function kerning(glyphs, xh, target) {
  const prof = profiles(glyphs, xh), pairs = {}, cap = 0.14 * xh;
  for (const [a, ga] of Object.entries(glyphs)) {
    const ra = prof[a][1];
    for (const b of Object.keys(glyphs)) {
      const lb = prof[b][0];
      let gap = null;
      for (let i = 0; i < KERN_BANDS; i++) {
        if (ra[i] === null || lb[i] === null) continue;
        const white = (ga.advance - ra[i]) + lb[i];
        if (gap === null || white < gap) gap = white;
      }
      if (gap === null) continue;
      const adj = Math.max(-cap, Math.min(cap, target - gap));
      if (Math.abs(adj) >= 6) pairs[a + b] = pyRound(adj);
    }
  }
  return pairs;
}

function penWidth(dx, dy, wv, contrast) {
  const L = Math.hypot(dx, dy) || 1.0;
  return wv * (contrast + (1.0 - contrast) * (Math.abs(dy) / L));
}

// Centerline to closed ink ring(s) by normal offset.
function expand(pts, closed, wv, contrast) {
  const n = pts.length;
  const ringIn = closed && pts[0][0] === pts[n - 1][0] && pts[0][1] === pts[n - 1][1];
  const mod = (k, m) => ((k % m) + m) % m;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    let x0, y0, x1, y1;
    if (ringIn) { [x0, y0] = pts[mod(i - 1, n - 1)]; [x1, y1] = pts[mod(i + 1, n - 1)]; }
    else { [x0, y0] = pts[Math.max(0, i - 1)]; [x1, y1] = pts[Math.min(n - 1, i + 1)]; }
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1.0;
    const nx = -dy / L, ny = dx / L, w = penWidth(dx, dy, wv, contrast) / 2.0;
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
  }
  if (closed) return [left.concat([left[0]]), right.slice().reverse().concat([right[right.length - 1]])];
  const ring = left.concat(right.slice().reverse());
  ring.push(ring[0]);
  return [ring];
}

const round2 = (pts) => pts.map(([x, y]) => [pyRound(x, 2), pyRound(y, 2)]);
const area = (r) => { let s = 0; for (let i = 0; i + 1 < r.length; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(s); };

export function mint(params = {}, seed = 0) {
  const p = { ...DEFAULTS, ...params };
  const rnd = mulberry32(Math.trunc(seed));
  // Seeded micro-variation inside legibility bounds. The skeletons do not read these yet, so today
  // the seed changes the receipt and not the outlines (the Python engine behaves the same way).
  p._shoulder_jitter = pyRound((rnd() - 0.5) * 0.02, 5);
  p._terminal_jitter = pyRound((rnd() - 0.5) * 0.06, 5);
  const xh = p.x_height * EM, wv = p.weight * EM, wh = wv * p.contrast;
  const skeletons = build(p);

  const refusals = [];
  const counterW = 2.0 * (0.52 * p.width * xh - wv);
  if (counterW < 0.30 * xh) {
    refusals.push(`counter-minimum: bowl counter ${counterW.toFixed(0)} under ${(0.30 * xh).toFixed(0)} em-units; lighten the weight or raise the x-height`);
  }
  if (p.contrast < 0.45) refusals.push("contrast-floor: horizontals thinner than 0.45 of the stem blind the eye at text sizes");

  const receipt = { schema: "zain-mint.typeface-mint/v1", engine: ENGINE, seed: Math.trunc(seed),
    params: Object.fromEntries(Object.entries(p).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    rules_applied: [...RULES], charset: Object.keys(skeletons).sort() };
  if (refusals.length) return { refused: true, refusals, receipt, glyphs: {}, kerning: {}, metrics: { em: EM, x_height: xh } };

  const glyphs = {};
  for (const [name, spec] of Object.entries(skeletons)) {
    let contours = [];
    for (const st of spec.strokes) {
      let pts = st.pts.map(([x, y]) => [x * xh, y * xh]);
      if (st.role === "bowl" || st.role === "dot" || st.role === "spine") pts = pts.map(([x, y]) => [x, y * (1.0 + p.overshoot)]);
      let rings = expand(pts, st.closed, wv, p.contrast);
      if (st.role === "dot") rings = [rings.reduce((a, b) => (area(b) > area(a) ? b : a))];
      for (const ring of rings) contours.push(round2(ring));
    }
    let top = -Infinity, inkMin = Infinity, inkMax = -Infinity;
    for (const c of contours) for (const [x, y] of c) { if (y > top) top = y; if (x < inkMin) inkMin = x; if (x > inkMax) inkMax = x; }
    const straight = spec.strokes.some((s) => s.role === "stem");
    const baseLsb = 0.22 * wv + 0.05 * xh;
    const lsb = pyRound(straight ? baseLsb : baseLsb * 0.82, 2);
    const shift = lsb - inkMin;
    contours = contours.map((c) => c.map(([x, y]) => [pyRound(x + shift, 2), y]));
    glyphs[name] = { contours, advance: pyRound((inkMax - inkMin) + 2 * lsb, 2), lsb, top: pyRound(top, 2),
      v_stroke: pyRound(wv, 2), h_stroke: pyRound(wh, 2) };
  }
  const straightLsb = 0.22 * wv + 0.05 * xh;
  return { refused: false, refusals: [], receipt, glyphs, kerning: kerning(glyphs, xh, 2.0 * straightLsb), metrics: { em: EM, x_height: xh } };
}

// SVG of any text set in the minted outlines, kerned. Characters outside the charset are skipped
// and reported, so a missing glyph is visible rather than silently dropped.
export function setText(face, text, { size = 1 } = {}) {
  const xh = face.metrics.x_height, H = 2.2 * xh;
  let x = 40.0, prev = null;
  const parts = [], missing = new Set();
  for (const ch of String(text)) {
    if (ch === " ") { x += 250; prev = null; continue; }
    const g = face.glyphs[ch];
    if (!g) { missing.add(ch); continue; }
    if (prev && face.kerning) x += face.kerning[prev + ch] || 0;
    prev = ch;
    const sub = g.contours.map((ring) => "M " + ring.map(([px, py]) => `${(x + px).toFixed(1)} ${(H - py).toFixed(1)}`).join(" L ") + " Z");
    parts.push(`<path d="${sub.join(" ")}" fill="currentColor" fill-rule="nonzero"/>`);
    x += g.advance;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(x + 40).toFixed(0)} ${(H + 60).toFixed(0)}" width="${((x + 40) * size).toFixed(0)}" height="${((H + 60) * size).toFixed(0)}">${parts.join("")}</svg>`;
  return { svg, width: x + 40, height: H + 60, missing: [...missing] };
}
