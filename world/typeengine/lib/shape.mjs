// lib/shape.mjs: skeleton modifiers. A material can change the letter's construction itself, not only paint it.
// They run in font units (1000 per em, y up) on the face's outlines and centre lines, so the room, the shader path,
// the exports and the font builder all see the same changed letter.
//
//   skeleton.modifiers: [
//     { kind: 'width-series', feed: 'data.series', target: 'wd', range: [0.85, 1.2], levels: 5 }
//         each letter is reminted with a construction number set by the series (sampled by the letter's place in
//         the alphabet, quantised to `levels` mints so it stays cheap); a real construction change, not a stretch
//     { kind: 'flow', amp: 40, scale: 520, seed: 1 }
//         every outline and centre-line point moves along a curl-noise field. Curl is divergence-free, so the bend
//         keeps each counter's area: strokes bend, bowls stay open
//     { kind: 'swash', amount: 0.5, length: 2.4, turns: 0.6, ball: 0.5, perGlyph: 1, at: 'extremes' | 'all', ends: 'vertical' | 'any', curl: 'backward' | 'clearance', skip }
//         the feed-30 swash generator (feed-30/build/lib/swash.mjs, read-only): free ends of the
//         centre lines grow Euler-spiral tails, added to the letter as outline contours
//   ]
import { terminals, spiral, tailWidths, distToPoly } from '../../feed-30/build/lib/swash.mjs';
import { face } from './faces.mjs';

export const MODIFIER_KINDS = Object.freeze(['width-series', 'flow', 'swash']);
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };

/** Curl of a sum of three plane waves: d = (dpsi/dy, -dpsi/dx). Smooth, deterministic, divergence-free. */
export function curl(x, y, { amp = 40, scale = 520, seed = 1 } = {}) {
  let dx = 0, dy = 0;
  for (let i = 0; i < 3; i++) {
    const a = 2 * Math.PI * hash(`${seed}a${i}`), k = (1 + i * 0.7) / scale, ph = 2 * Math.PI * hash(`${seed}p${i}`), w = 1 / (1 + i);
    const kx = Math.cos(a) * k, ky = Math.sin(a) * k, c = Math.cos(kx * x + ky * y + ph) * w;
    dx += c * ky; dy -= c * kx;
  }
  const norm = 1 / (1 / scale) / 1.83; // keep |d| near amp whatever the scale
  return [dx * amp * norm, dy * amp * norm];
}

function alphaIndex(ch) {
  const c = ch.toLowerCase();
  if (c >= 'a' && c <= 'z') return (c.charCodeAt(0) - 97) / 25;
  if (c >= '0' && c <= '9') return (c.charCodeAt(0) - 48) / 9;
  return hash(ch);
}
function sample(values, u) {
  const t = u * (values.length - 1), i = Math.min(values.length - 2, Math.floor(t)), f = t - i;
  return values[i] * (1 - f) + values[i + 1] * f;
}

function flowGlyph(g, m, ch) {
  const ph = hash(ch) * 4000, mv = ([x, y]) => { const [dx, dy] = curl(x + ph, y, m); return [x + dx, y + dy]; };
  return { ...g, contours: g.contours.map((c) => ({ ...c, pts: c.pts.map(mv) })), skeleton: g.skeleton.map((s) => s.map(mv)) };
}

const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

/** A tapered ribbon (centre points, widths) as one closed polygon. */
export function ribbon(pts, widths) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, h = widths[i] / 2;
    L.push([pts[i][0] - (dy / l) * h, pts[i][1] + (dx / l) * h]); R.push([pts[i][0] + (dy / l) * h, pts[i][1] - (dx / l) * h]);
  }
  return [...L, ...R.reverse()];
}

// Letters that a tail turns into another letter, and figures whose tails run into their neighbours (2026-10-25:
// a forward tail on t reads as f; digit tails collided in "0123456789"). Override with `skip`.
export const SWASH_SKIP = '0123456789tij';

function swashGlyph(g, m, ch, metrics, picks = null) {
  if (!g.skeleton.length || (m.skip ?? SWASH_SKIP).includes(ch)) return { ...g, picks: [] };
  // The generator works y-down in pixels; font units with y flipped are the same geometry.
  const strokes = g.skeleton.map((s) => ({ pts: s.map(([x, y]) => [x, -y]), width: g.stem, glyph: 0 }));
  let x0 = Infinity, x1 = -Infinity; for (const s of strokes) for (const [x] of s.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const sk = { strokes, glyphs: [{ x0, x1 }], size: metrics.xh * 2, h: metrics.cap * 2, zones: { baseline: 0, xh: metrics.xh, cap: metrics.cap } };
  // Default 'extremes': only ends past the x-height band (ascenders, caps) or below the baseline (descenders) grow
  // tails. Tails at the baseline or the x-height change what the letter is (OCR error 22% against 0%, 2026-10-25).
  const band = (t) => (m.at ?? 'extremes') === 'all' || t.p[1] < -metrics.xh * 1.12 || t.p[1] > metrics.xh * 0.12;
  let cx = 0, cy = 0, cn = 0; for (const st of strokes) for (const [x, y] of st.pts) { cx += x; cy += y; cn++; }
  const C = [cx / cn, cy / cn], far = (q) => Math.hypot(q[0] - C[0], q[1] - C[1]);
  // Outward only: an end whose tangent points back into the letter (the inside of a C's terminal) grows no tail.
  const outward = (t) => t.t[0] * (t.p[0] - C[0]) + t.t[1] * (t.p[1] - C[1]) > 0;
  // Default ends: 'vertical': only stem ends (ascenders, descenders) grow tails. A curved terminal (C, G, S, the
  // f's flag) given a tail reads as a stray hook (2026-10-25 review).
  const stem = (t) => (m.ends ?? 'vertical') !== 'vertical' || Math.abs(t.t[1]) > 0.6;
  const ends = terminals(sk).filter((t) => t.kind !== 'foot' && band(t) && outward(t) && stem(t)).map((t) => [Math.abs(t.t[1]) + (t.kind === 'free' ? 0.5 : 0) + hash(ch + t.stroke + t.end) * 0.4, t]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  const want = Math.min(m.perGlyph ?? 1, Math.round(ends.length * (m.amount ?? 0.5))), body = strokes.map((s) => s.pts);
  const outer = g.contours.reduce((best, c) => (Math.abs(area(c.pts)) > Math.abs(area(best)) ? c.pts : best), g.contours[0]?.pts ?? [[0, 0], [1, 0], [0, 1]]);
  const sign = Math.sign(area(outer)) || 1, added = [];
  const chosen = picks ? picks.map((k) => { const T = terminals(sk).find((t) => t.stroke === k.stroke && t.end === k.end); return T && { ...T, side: k.side, forced: true }; }).filter(Boolean) : ends.slice(0, want), used = [];
  for (const T of chosen) {
    const length = T.width * (m.length ?? 2.4), cands = [];
    // Vertical ends curl backward, against the reading direction: up-ends turn left over their own stem, so an l
    // never grows an f-like flag over the x-height; down-ends hook left like a j.
    const vert = (m.curl ?? 'backward') === 'backward' && Math.abs(T.t[1]) > 0.6 ? (T.t[1] < 0 ? -1 : 1) : 0;
    for (const side of T.forced ? [T.side] : vert ? [vert] : T.side ? [T.side] : [1, -1]) {
      const pts = spiral(T.p, T.t, { length, turns: (m.turns ?? 0.6) * (T.kind === 'free' ? 1 : 0.7), power: 1.6, side, step: length / 40 });
      // Clearance: how close the tail's back half comes to the rest of the letter (a buried counter scores low).
      const clear = Math.min(...pts.slice(pts.length >> 1).map((p) => Math.min(...body.map((b) => distToPoly(p, b)))));
      if (!T.forced && far(pts[pts.length - 1]) <= far(T.p)) continue; // the tip must end farther out than the root
      cands.push({ pts, clear, side });
    }
    cands.sort((a, b) => b.clear - a.clear);
    if (!cands.length || (!T.forced && cands[0].clear < T.width * 0.6)) continue;
    used.push({ stroke: T.stroke, end: T.end, side: cands[0].side });
    // The root starts half a stroke inside the stem, so the tail grows out of the stroke with no seam.
    const pts = [[T.p[0] - T.t[0] * T.width * 0.5, T.p[1] - T.t[1] * T.width * 0.5], ...cands[0].pts], poly = ribbon(pts, tailWidths(pts.length, T.width * 0.92, { hair: T.width * 0.12, ball: m.ball ?? 0.5 })).map(([x, y]) => [x, -y]);
    added.push({ pts: Math.sign(area(poly)) === sign ? poly : poly.reverse(), on: poly.map(() => true), swash: true });
  }
  const r = added.length ? { ...g, contours: [...g.contours, ...added], swashes: added.length } : { ...g };
  r.picks = used; return r;
}

/** Apply the skeleton's modifiers to its face. `inputs` are the family's resolved inputs (data.series and so on). */
export function shaped(ref, inputs = {}) {
  const base = face(ref), mods = ref.modifiers ?? [];
  if (!mods.length || base.refused) return base;
  for (const m of mods) if (!MODIFIER_KINDS.includes(m.kind)) throw new Error(`shape: unknown modifier "${m.kind}" (one of ${MODIFIER_KINDS.join(', ')})`);
  const ws = mods.find((m) => m.kind === 'width-series');
  if (ws && !inputs[ws.feed ?? 'data.series']) throw new Error(`shape: width-series needs input ${ws.feed ?? 'data.series'}`);
  const series = ws ? Array.from(inputs[ws.feed ?? 'data.series'].y) : null, lo = series ? Math.min(...series) : 0, hi = series ? Math.max(...series) : 1;
  const levelOf = (ch) => { const v = (sample(series, alphaIndex(ch)) - lo) / (hi - lo || 1), n = (ws.levels ?? 5) - 1; return Math.round(v * n) / n; };
  const faceAt = (lvl) => { const [a, b] = ws.range ?? [0.85, 1.2]; return face({ ...ref, extra: { ...(ref.extra ?? {}), [ws.target ?? 'wd']: +(a + (b - a) * lvl).toFixed(4) } }); };
  const memo = new Map();
  return {
    ...base, id: `${base.id}+${mods.map((m) => m.kind).join('+')}`, modifiers: mods,
    glyph(ch) {
      if (memo.has(ch)) return memo.get(ch);
      let g = (ws ? faceAt(levelOf(ch)) : base).glyph(ch);
      if (g) for (const m of mods) { if (m.kind === 'flow') g = flowGlyph(g, m, ch); if (m.kind === 'swash') g = swashGlyph(g, m, ch, base.metrics); }
      memo.set(ch, g); return g;
    },
  };
}

/**
 * The same modifiers on forge masters, for the font builder. masters[0] is the default; swash choices made there are
 * forced on the others and every tail has 41 points, so the masters stay point-compatible for the variable font.
 * mintAt(loc, extra) mints a master at a source location with extra construction numbers (for width-series).
 * Accented letters take their base through components, so they carry the base letter's change.
 */
export function shapeMasters(masters, sources, mods, inputs, mintAt) {
  const ws = mods.find((m) => m.kind === 'width-series'), picks = new Map();
  const series = ws ? Array.from(inputs[ws.feed ?? 'data.series'].y) : null, lo = series ? Math.min(...series) : 0, hi = series ? Math.max(...series) : 1;
  masters.forEach((M, mi) => {
    const levels = new Map(), k = M.k;
    for (const [name, g] of Object.entries(M.glyphs)) {
      if (!g.contours?.length || g.mark) continue;
      const ch = g.unicode ? String.fromCodePoint(g.unicode) : name;
      let G = { contours: g.contours, skeleton: g.skeleton ?? [], stem: k.V, advance: g.advance };
      if (ws && g.unicode) {
        const n = (ws.levels ?? 5) - 1, lvl = Math.round(((sample(series, alphaIndex(ch)) - lo) / (hi - lo || 1)) * n) / n, [a, b] = ws.range ?? [0.85, 1.2];
        if (!levels.has(lvl)) levels.set(lvl, mintAt(sources[mi], { [ws.target ?? 'wd']: +(a + (b - a) * lvl).toFixed(4) }));
        const L = levels.get(lvl).glyphs[name]; if (L) G = { ...G, contours: L.contours, skeleton: L.skeleton ?? [], advance: L.advance };
      }
      for (const m of mods) {
        if (m.kind === 'flow') G = flowGlyph(G, m, ch);
        if (m.kind === 'swash' && g.unicode && G.skeleton.length) { G = swashGlyph(G, m, ch, { xh: k.xh, cap: k.cap }, mi === 0 ? null : picks.get(name) ?? []); if (mi === 0) picks.set(name, G.picks); }
      }
      g.contours = G.contours.map((c) => ({ pts: c.pts, on: c.on })); g.advance = G.advance; if (G.skeleton) g.skeleton = G.skeleton;
    }
  });
}
