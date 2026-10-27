// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// name.mjs: set any text in the Accession family (the house type forge) as real outlines, fitted into a box,
// in one or more lines. Returns the coverage mask, the outline polylines, the per-glyph spans, the stroke
// skeletons (the forge's own centre lines) in px, and a signed distance field on request.
// The text is always returned with the art, so every piece keeps its real-text equivalent.
import { mintMaster } from '../../typeface/forge/family/family.mjs';
import { flatten } from '../../typeface/forge/family/svg.mjs';
import { contourToPolyline } from '../../superframe/lib/fill.mjs';
import { edt } from '../../glass/lib/body.js';

export const NAME = 'Zain Dana Harper';
const masters = new Map();
export function master(style = 'display', weight = 700, cut = undefined) {
  const k = `${style}/${weight}/${cut ?? ''}`;
  if (!masters.has(k)) masters.set(k, mintMaster(style, weight, cut ? { cut } : {}));
  return masters.get(k);
}

// Lay one line out in em units: [{ name, ch, dx, adv }], width.
function layoutLine(m, text, tracking) {
  const byChar = new Map();
  for (const [n, g] of Object.entries(m.glyphs)) if (g.unicode && !byChar.has(g.unicode)) byChar.set(g.unicode, n);
  let x = 0, prev = null; const out = [];
  for (const ch of text) {
    const name = byChar.get(ch.codePointAt(0));
    if (!name) throw new Error(`name: no glyph for "${ch}" in ${m.style}`);
    if (prev) x += m.kerning[`${prev} ${name}`] ?? 0;
    const g = m.glyphs[name];
    out.push({ name, ch, dx: x, adv: g.advance });
    x += g.advance + (ch === ' ' ? 0 : tracking);
    prev = name;
  }
  return { glyphs: out, width: x - tracking };
}

/**
 * setName(text, w, h, opts)
 *   text      string; '\n' splits lines (the real text joins them with spaces)
 *   box       [x0, y0, x1, y1] as shares of the frame (default [0.08, 0.3, 0.92, 0.7])
 *   style     'display' | 'text' | 'mono' | 'textItalic'
 *   weight    300..900 (wght)
 *   tracking  em units added between letters (-60..200)
 *   leading   line pitch as a share of the cap height (0.9..1.6)
 *   align     'left' | 'center' | 'right'
 *   fit       'contain' (whole block inside the box) | 'width' (fill the box width; may overflow vertically)
 *   close     closing radius as a share of cap height (default 0.016) that fills ink-trap notches
 *   sy        vertical stretch (1 = as drawn; 2 doubles the height)
 *   sdf       true adds a signed distance field (px; negative inside)
 */
export function setName(text = NAME, w, h, o = {}) {
  const { box = [0.08, 0.3, 0.92, 0.7], style = 'display', weight = 700, tracking = 0, leading = 1.18, align = 'center',
    fit = 'contain', cut, sdf = false, sub = 4, sy = 1 } = o;
  const m = master(style, weight, cut), cap = m.k.cap;
  const lines = text.split('\n').map(t => layoutLine(m, t, tracking));
  const blockW = Math.max(...lines.map(l => l.width)), pitch = cap * leading, blockH = cap + pitch * (lines.length - 1);
  const bw = (box[2] - box[0]) * w, bh = (box[3] - box[1]) * h;
  const s = fit === 'width' ? bw / blockW : Math.min(bw / blockW, bh / (blockH * sy));
  const top = box[1] * h + (bh - blockH * s * sy) / 2;
  const polys = [], spans = [], skel = [], glyphGroups = [];
  const nName = [...Object.entries(m.glyphs)].find(([, g]) => g.unicode === 110)?.[0];
  lines.forEach((L, li) => {
    const ox = box[0] * w + (align === 'left' ? 0 : align === 'right' ? bw - L.width * s : (bw - L.width * s) / 2);
    const base = top + (cap + li * pitch) * s * sy;
    for (const g of L.glyphs) {
      if (g.ch === ' ') continue;
      // the r is drawn from the n's shoulder (see R_FROM_N); every other letter as the forge draws it
      const fromN = g.ch === 'r' && o.r !== 'face' && nName, src = fromN ? nName : g.name;
      const kx = fromN ? Math.min(1, (g.adv * 1.08) / m.glyphs[nName].advance) : 1;
      const T = ([x, y]) => [ox + (g.dx + x * kx) * s, base - y * s * sy];
      const yCut = base - m.k.xh * (1 - R_FROM_N.drop) * s * sy;
      const gq = []; for (const c of flatten(m.glyphs, src)) { const q = contourToPolyline(c, T); if (q.length > 2) gq.push(q); }
      polys.push(...gq); for (const G of clusterPieces(groupContours(gq))) { G.ch = g.ch; if (fromN) G.cut = yCut; glyphGroups.push(G); }
      const sks = (m.glyphs[src].skeleton ?? []).map(st => st.map(T)), xs = sks.flat().map(p => p[0]);
      const stemX = Math.min(...xs) + 0.3 * (Math.max(...xs) - Math.min(...xs));
      for (let pts of sks) {
        if (fromN) pts = pts.filter(p => p[1] <= yCut || p[0] < stemX);
        if (pts.length >= 2) skel.push({ ch: g.ch, line: li, pts });
      }
      spans.push({ ch: g.ch, line: li, x0: ox + g.dx * s, x1: ox + (g.dx + g.adv) * s, base, top: base - cap * s * sy, xh: base - m.k.xh * s * sy });
    }
  });
  // fill glyph by glyph in its own box, so a closing never fuses neighbours
  const mask = new Float32Array(w * h), rc = (o.close ?? 0.016) * cap * s * sy;
  for (const G of glyphGroups) {
    if (!G.length) continue;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const g of G) for (const q of g) for (const [x, y] of q) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
    const pad = Math.ceil(rc) + 3, x0 = Math.max(0, Math.floor(bx0) - pad), y0 = Math.max(0, Math.floor(by0) - pad), x1 = Math.min(w, Math.ceil(bx1) + pad), y1 = Math.min(h, Math.ceil(by1) + pad);
    const cw = x1 - x0, chh = y1 - y0; if (cw <= 0 || chh <= 0) continue;
    let local = new Float32Array(cw * chh);
    for (const g of G) fillGroup(local, g.map(q => q.map(([x, y]) => [x - x0, y - y0])), cw, chh, sub);
    if (G.cut !== undefined) cutLeg(local, cw, chh, G.cut - y0);
    if (rc > 0.5) local = closeMask(local, cw, chh, rc);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) { const v = local[y * cw + x], i = (y + y0) * w + x + x0; if (v > mask[i]) mask[i] = v; }
  }
  const out = { text: text.replace(/\n/g, ' '), w, h, scale: s, capPx: cap * s * sy, polys, spans, skel, mask };
  if (sdf) out.sdf = signedDistance(mask, w, h);
  return out;
}

// Break words into n lines with the most even character counts (any text, so the generator takes any name).
export function breakLines(text, n = 2) {
  const words = text.trim().split(/\s+/);
  if (n <= 1 || words.length <= 1) return words.join(' ');
  if (n >= words.length) return words.join('\n');
  let best = null;
  const rec = (start, left, acc) => {
    if (left === 1) { const all = [...acc, words.slice(start).join(' ')], cost = Math.max(...all.map(l => l.length)); if (!best || cost < best.cost) best = { cost, all }; return; }
    for (let k = start + 1; k <= words.length - left + 1; k++) rec(k, left - 1, [...acc, words.slice(start, k).join(' ')]);
  };
  rec(0, n, []);
  return best.all.join('\n');
}

// The forge draws some letters as overlapping stroke rings, and a few overlaps run in opposite directions (the
// r's arm, a's bowl join), which a plain nonzero fill turns into slivers of paper. So each glyph's contours are
// grouped: a contour is a hole when another contour of opposite direction holds its whole box; every other
// contour is a piece. Each piece is filled with its holes (orientation normalised) and pieces union by max.
const area = q => { let a = 0; for (let i = 0; i < q.length; i++) { const [x0, y0] = q[i], [x1, y1] = q[(i + 1) % q.length]; a += x0 * y1 - x1 * y0; } return a / 2; };
const bbox = q => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of q) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; };
function groupContours(qs) {
  const info = qs.map(q => ({ q, a: area(q), b: bbox(q) })), inside = (s, o) => s.b[0] >= o.b[0] && s.b[1] >= o.b[1] && s.b[2] <= o.b[2] && s.b[3] <= o.b[3] && Math.abs(s.a) < Math.abs(o.a);
  const pieces = info.filter(c => !info.some(o => o !== c && Math.sign(o.a) !== Math.sign(c.a) && inside(c, o)));
  return pieces.map(p => {
    const holes = info.filter(c => c !== p && Math.sign(c.a) !== Math.sign(p.a) && inside(c, p) && !pieces.includes(c));
    const fix = (q, want) => (Math.sign(area(q)) === want ? q : q.slice().reverse());
    return [fix(p.q, 1), ...holes.map(hh => fix(hh.q, -1))];
  });
}
// Pieces whose boxes touch close together (an r's arm on its stem); a separate piece, such as the dot of an i,
// closes alone, so the closing never bridges a gap the letter means to keep.
function clusterPieces(pieces) {
  const bb = pieces.map(p => bbox(p[0])), parent = pieces.map((_, i) => i), find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = bb[i], b = bb[j]; if (a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]) parent[find(i)] = find(j);
  }
  const out = new Map(); pieces.forEach((p, i) => { const r = find(i); if (!out.has(r)) out.set(r, []); out.get(r).push(p); });
  return [...out.values()];
}
function fillGroup(out, polys, w, h, sub) {
  const edges = [];
  for (const P of polys) for (let i = 0; i < P.length; i++) { const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length]; if (y0 !== y1) edges.push(y0 < y1 ? [x0, y0, x1, y1, 1] : [x1, y1, x0, y0, -1]); }
  let ymin = h, ymax = 0; for (const e of edges) { ymin = Math.min(ymin, e[1]); ymax = Math.max(ymax, e[3]); }
  const ya = Math.max(0, Math.floor(ymin)), yb = Math.min(h - 1, Math.ceil(ymax)), wt = 1 / sub, row = new Float32Array(w);
  for (let y = ya; y <= yb; y++) {
    row.fill(0);
    for (let s = 0; s < sub; s++) {
      const sy = y + (s + 0.5) / sub, xs = [];
      for (const [x0, y0, x1, y1, d] of edges) if (sy >= y0 && sy < y1) xs.push([x0 + (x1 - x0) * (sy - y0) / (y1 - y0), d]);
      xs.sort((a, b) => a[0] - b[0]); let wind = 0;
      for (let k = 0; k < xs.length - 1; k++) { wind += xs[k][1]; if (wind === 0) continue; span(row, w, Math.max(0, xs[k][0]), Math.min(w, xs[k + 1][0]), wt); }
    }
    for (let x = 0; x < w; x++) { const v = row[x] > 1 ? 1 : row[x], i = y * w + x; if (v > out[i]) out[i] = v; }
  }
}
function span(row, w, a, b, wt) {
  if (b <= a) return; const ia = Math.floor(a), ib = Math.floor(b);
  if (ia === ib) { if (ia < w) row[ia] += (b - a) * wt; return; }
  row[ia] += (ia + 1 - a) * wt; for (let x = ia + 1; x < ib && x < w; x++) row[x] += wt; if (ib < w) row[ib] += (b - ib) * wt;
}

// The house r is a stem and a short cut flag with a deep wedge between them; at display size it reads as an I and
// a slash (the blind read and the coordinator both saw it). So the r is drawn the way type designers derive it:
// the n's shoulder, narrowed to the r's advance, with the right leg cut away below `drop` of the x-height.
// o.r = 'face' keeps the forge's own r.
const R_FROM_N = { drop: 0.3 };
function cutLeg(local, w, h, yCut) {
  for (let y = Math.max(0, Math.ceil(yCut)); y < h; y++) {
    let x = 0; while (x < w && local[y * w + x] < 0.02) x++;
    while (x < w && local[y * w + x] >= 0.02) x++;
    for (; x < w; x++) local[y * w + x] = 0;
  }
}

export function closeMask(mask, w, h, r) {
  const inside = new Uint8Array(w * h), outside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { inside[i] = mask[i] >= 0.5; outside[i] = !inside[i]; }
  const dout = edt(outside, w, h), grown = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) grown[i] = inside[i] || dout[i] - 0.5 <= r ? 1 : 0;
  const d2 = edt(grown, w, h), out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.max(mask[i], grown[i] ? clamp01(d2[i] - 0.5 - r + 0.5) : 0);
  return out;
}
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);

// Signed distance in px from a coverage mask: negative inside, positive outside, sub-pixel from coverage.
export function signedDistance(mask, w, h) {
  const inside = new Uint8Array(w * h), outside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { inside[i] = mask[i] >= 0.5; outside[i] = !inside[i]; }
  const din = edt(inside, w, h), dout = edt(outside, w, h), d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = (inside[i] ? -din[i] : dout[i]) + (0.5 - mask[i]) * (mask[i] > 0 && mask[i] < 1 ? 1 : 0);
  return d;
}

// Index of the glyph (letter) under each pixel, -1 outside: used by pieces that give each letter its own life.
export function letterIndex(N) {
  const { w, h, spans, mask } = N, idx = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (mask[i] < 0.02) continue;
    let best = -1, bd = Infinity;
    spans.forEach((s, k) => { const cx = (s.x0 + s.x1) / 2, cy = (s.top + s.base) / 2, d = Math.abs(x - cx) + 0.3 * Math.abs(y - cy); if (d < bd) { bd = d; best = k; } });
    idx[i] = best;
  }
  return idx;
}
