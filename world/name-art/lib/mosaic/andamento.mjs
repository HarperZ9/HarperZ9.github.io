// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// andamento.mjs: where every tessera goes. A mosaicist lays tiles in courses (rows) that follow the form; that flow
// is the andamento. Here, as in Roman and Byzantine floors:
//   letter   opus vermiculatum inside the letters: courses parallel to each stroke's centre line, the middle course
//            on the axis, tiles cut along the course; round stroke ends turn the courses into concentric arcs
//   halo     a few courses of the same flow continued outside the letter edge (the outline rows that make a letter
//            stand off its ground), in the field's material
//   field    opus tessellatum: straight courses of near-square tiles, laid by hand (a slow wobble, staggered joints)
// The letter edge, every course boundary and every cut is a joint; the grout lines that result are the drawing.
//
// Input: a setName result with sdf (lib/name.mjs) and its centre lines (lib/strokes.mjs strokesOf), or any mask
// and polylines of the same shape. Output: a per-pixel tile id, zone, distance to the nearest joint, the course
// frame (along s, across o) for pieces that write into tiles, and one record per tile.
// Pure; node or browser.
import { edt } from '../../../glass/lib/body.js';

const ZONE = { field: 0, halo: 1, letter: 2 };
export { ZONE };

/**
 * Nearest-stroke frame: for every pixel within `reach` px of a centre line, the distance to it, the signed side,
 * the arc position along it, and the stroke index. Past a stroke's end the arc keeps growing with the angle around
 * the end point (s = end + angle x distance), so courses wrap the round terminal instead of stopping.
 * Joins follow the setter's rule: where two strokes overlap, the longer one keeps its courses and the shorter one's
 * courses stop against it (a butt joint), instead of meeting on a mitre. `halves` gives each stroke's half width
 * (px); without it every pixel takes its nearest stroke.
 */
export function strokeFrame(w, h, strokes, reach, halves = null) {
  const dist = new Float32Array(w * h).fill(Infinity), s = new Float32Array(w * h), side = new Int8Array(w * h), id = new Int32Array(w * h).fill(-1);
  const past = new Int8Array(w * h), ang = new Float32Array(w * h), base = new Float32Array(w * h);
  const lens = strokes.map(st => { let t = 0; for (let i = 1; i < st.pts.length; i++) t += Math.hypot(st.pts[i][0] - st.pts[i - 1][0], st.pts[i][1] - st.pts[i - 1][1]); return t; });
  const wins = (k, d, j) => {
    const c = id[j]; if (c < 0) return true; if (c === k) return d < dist[j];
    if (!halves) return d < dist[j];
    const inK = d <= halves[k] + 0.5, inC = dist[j] <= halves[c] + 0.5;
    if (inK && inC) return lens[k] > lens[c] || (lens[k] === lens[c] && d < dist[j]);
    if (inK !== inC) return inK;
    return d < dist[j];
  };
  strokes.forEach((st, k) => {
    const P = st.pts, A = [0]; for (let i = 1; i < P.length; i++) A.push(A[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const total = A[A.length - 1];
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - reach)), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0]) + reach));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - reach)), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1]) + reach));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - a[0], py = y + 0.5 - a[1], uu = (px * dx + py * dy) / (L * L), u = Math.max(0, Math.min(1, uu));
        const qx = px - u * dx, qy = py - u * dy, d = Math.hypot(qx, qy), j = y * w + x;
        if (!wins(k, d, j)) continue;
        let arc = A[i] + u * L, pa = 0, an = 0, b0 = arc;
        const cr = dx * py - dy * px;
        if (uu < 0 && i === 0) { pa = -1; an = Math.acos(Math.max(-1, Math.min(1, -(px * dx + py * dy) / (L * (d || 1e-9))))); b0 = 0; arc = -an * d; }   // around the start
        if (uu > 1 && i === P.length - 2) { const ex = x + 0.5 - b[0], ey = y + 0.5 - b[1]; pa = 1; an = Math.acos(Math.max(-1, Math.min(1, (ex * dx + ey * dy) / (L * (d || 1e-9))))); b0 = total; arc = total + an * d; }
        past[j] = pa; ang[j] = an; base[j] = b0;
        dist[j] = d; s[j] = arc; side[j] = cr >= 0 ? 1 : -1; id[j] = k;
      }
    }
  });
  return { dist, s, side, id, past, ang, base };
}

/**
 * Lay the tiles.
 *   sdf       Float32Array, signed distance to the letter edge in px (negative inside)
 *   strokes   centre lines [{ pts }]
 *   tile      nominal tile size in px (letter courses); field tiles are `fieldScale` x that
 *   halo      outline courses outside the letters (0..4)
 *   ratio     tile length along a course / course width (1 to 1.6)
 *   grout     joint width in px
 *   field     'tessellatum' (straight courses) | 'echo' (every field course follows the letters, as in Ravenna)
 *   seed
 * -> { key: Int32Array tile index per pixel, zone: Uint8Array, joint: Float32Array distance to the nearest joint (px),
 *      grout: Float32Array coverage of grout 0..1, tiles: [{ zone, band (course index), seq (echo tiles: reading order), cx, cy, n, h1, h2, h3 }],
 *      frame: { flow (1 where courses follow the letters), s (px along the stroke), o (px across it), course,
 *               stroke, fu (field tiles: 0..1 along the tile's reading direction; o holds 0..1 across it) } }
 */
export function layTiles(w, h, { sdf, strokes, tile = 14, halo = 2, ratio = 1.25, grout = 1.4, field = 'tessellatum', fieldScale = 1.15, fieldRatio = 1, seed = 1 }) {
  let deep = 0; for (let i = 0; i < w * h; i++) if (-sdf[i] > deep) deep = -sdf[i];
  const reach = deep + tile * (halo + 1.5);
  const halves = strokes.map(st => { const v = st.pts.map(([x, y]) => -sdf[Math.max(0, Math.min(h - 1, y | 0)) * w + Math.max(0, Math.min(w - 1, x | 0))]).sort((a, b) => a - b); return Math.max(1, v[v.length >> 1]); });
  const F = strokeFrame(w, h, strokes, reach, halves), key = new Int32Array(w * h).fill(-1), zone = new Uint8Array(w * h);
  const o = new Float32Array(w * h), course = new Int32Array(w * h), flow = new Uint8Array(w * h), fu = new Float32Array(w * h), ids = new Map(), tiles = [];
  const T = tile, Tf = tile * fieldScale;
  const echo = field === 'echo' ? echoSeeds(w, h, sdf, Tf, Tf * ratio, seed) : null;
  // Neighbours never share outline courses: a halo tile is laid only where the nearest OTHER letter's edge is at
  // least one tessera further away than this letter's own edge, so between two letters the outlines stop with a
  // full tile of field between them, however large the type or tight the tracking (short words at room size).
  const gOf = (k) => (k >= 0 ? strokes[k].glyph ?? k : -1), cellB = Math.max(4, Math.ceil(tile * (halo + 2.5))), bw = Math.ceil(w / cellB), bins = new Map();
  for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) {
    const i = y * w + x; if (!(sdf[i] < 0) || (sdf[i - 1] < 0 && sdf[i + 1] < 0 && sdf[i - w] < 0 && sdf[i + w] < 0 && sdf[i] < -1.5)) continue;
    if (sdf[i] < -2.5) continue;
    if (F.id[i] < 0) continue;   // an edge pixel no stroke frame claims cannot be told apart by letter, so it does not count
    const k = (y / cellB | 0) * bw + (x / cellB | 0); if (!bins.has(k)) bins.set(k, []); bins.get(k).push(x, y, gOf(F.id[i]));
  }
  const otherEdge = (x, y, g) => {
    let best = Infinity; const cx = x / cellB | 0, cy = y / cellB | 0;
    for (let j = -1; j <= 1; j++) for (let q = -1; q <= 1; q++) { const B = bins.get((cy + j) * bw + cx + q); if (!B) continue; for (let n = 0; n < B.length; n += 3) if (B[n + 2] !== g) { const dd = (B[n] - x) ** 2 + (B[n + 1] - y) ** 2; if (dd < best) best = dd; } }
    return Math.sqrt(best);
  };
  const idOf = (str, z, band) => { let k = ids.get(str); if (k === undefined) { k = tiles.length; ids.set(str, k); tiles.push({ zone: z, band, cx: 0, cy: 0, n: 0, h1: hash(str, seed, 1), h2: hash(str, seed, 2), h3: hash(str, seed, 3) }); } return k; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, d = sdf[i];
    // the outline courses end on a course boundary (so the halo's outer edge is a clean joint, as laid), not on a
    // distance from the letter edge, which would cut the outer course into teeth
    const kk = F.id[i], cOff = kk >= 0 ? F.side[i] * F.dist[i] : 0, cIdx = Math.floor(cOff / T + 0.5);
    let flowing = kk >= 0 && (d < 0 || (d < (halo + 1.5) * T && Math.abs(cIdx) <= Math.ceil(halves[kk] / T - 0.5) + halo));
    if (flowing && d >= 0 && otherEdge(x, y, gOf(kk)) - d < 1.5 * T) flowing = false;
    let str, z, echoQ = -1;
    if (flowing) {
      const off = cOff, c = cIdx;
      z = d < 0 ? ZONE.letter : ZONE.halo;
      // round ends: the arc is measured at the course's own radius, so every course of the cap is cut by radial
      // joints into keystone tiles of about the same length (no fan of slivers toward the end point)
      if (F.past[i]) F.s[i] = F.base[i] + F.past[i] * F.ang[i] * Math.max(0.5 * T, Math.abs(c) * T);
      const along = Math.floor((F.s[i] + (c & 1) * T * ratio * 0.5) / (T * ratio));
      str = `${z}/${F.id[i]}/${c}/${along}`; o[i] = off; course[i] = c; flow[i] = 1;
    } else if (field === 'echo') {
      // Ravenna's echo: every field course runs parallel to the letters' outline, rippling out to the frame edge.
      // Tiles are the cells of seed points spaced evenly along each course's middle line (Poisson spacing), so
      // joints fall across the course wherever it bends, with no seam of slivers
      const r = Math.floor(d / Tf), c = echo.nearest(x, y, r); echoQ = c;
      z = ZONE.field; str = c >= 0 ? `e/${r}/${c}` : `e/${r}/x`; o[i] = c >= 0 ? echo.v(x, y, c) : 0.5; fu[i] = c >= 0 ? echo.u(x, y, c) : 0.5; course[i] = r;
    } else {
      // tessellatum: straight courses with a hand-laid wobble and staggered joints
      const wob = Math.sin(x / (Tf * 9.3) + seed) * 0.35 * Tf + Math.sin(x / (Tf * 3.1) + 2 * seed) * 0.12 * Tf;
      const Tw = Tf * fieldRatio, fy = (y + wob) / Tf, r = Math.floor(fy), fx = (x + (r & 1) * Tw * 0.5 + Math.sin(y / (Tf * 7)) * 0.2 * Tf) / Tw, cc = Math.floor(fx);
      z = ZONE.field; str = `0/${r}/${cc}`; o[i] = fy - r; fu[i] = fx - cc; course[i] = r;
    }
    const k = idOf(str, z, course[i]); key[i] = k;
    if (echoQ >= 0 && tiles[k].seq === undefined) tiles[k].seq = echo.seq(echoQ); zone[i] = z;
    const t = tiles[k]; t.cx += x; t.cy += y; t.n++;
  }
  for (const t of tiles) if (t.n) { t.cx /= t.n; t.cy /= t.n; }
  // joints: wherever the tile changes (course, cut, letter edge); distance to the nearest joint gives the grout and
  // the dome of each tile
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, k = key[i];
    solid[i] = (x + 1 < w && key[i + 1] !== k) || (y + 1 < h && key[i + w] !== k) || (sdf[i] < 0) !== (x + 1 < w ? sdf[i + 1] < 0 : sdf[i] < 0) ? 0 : 1;
  }
  const joint = edt(solid, w, h), gr = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gr[i] = Math.max(0, Math.min(1, grout / 2 - joint[i] + 0.5));
  // tiny slivers (a course clipped by the letter edge to a few pixels) read as grout, as a mosaicist would fill them
  for (let i = 0; i < w * h; i++) if (tiles[key[i]].n < T * T * 0.12) gr[i] = 1;
  return { key, zone, joint, grout: gr, frame: { s: F.s, o, course, stroke: F.id, flow, fu }, tiles, tile: T, fieldTile: Tf };
}

// Seeds for the echo field: points on each course's middle line (|d / Tf - r - 0.5| small), accepted in a seeded
// random order only when no seed of the same course lies closer than `gap`. nearest() finds a pixel's seed in its
// own course; u() gives the pixel's position across the tile (0..1) along the course direction.
function echoSeeds(w, h, sdf, Tf, gap, seed) {
  const cand = [];
  for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) { const d = sdf[y * w + x]; if (d <= 0) continue; const f = d / Tf, r = Math.floor(f); if (Math.abs(f - r - 0.5) < 0.12) cand.push([x, y, r]); }
  let st = (seed * 2654435761) >>> 0; const rnd = () => ((st = (Math.imul(st, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const cs = gap, gw = Math.ceil(w / cs) + 1, grid = new Map(), pts = [];
  const cellOf = (x, y) => Math.floor(y / cs) * gw + Math.floor(x / cs);
  for (const [x, y, r] of cand) {
    const gx = Math.floor(x / cs), gy = Math.floor(y / cs); let ok = true;
    for (let j = -1; j <= 1 && ok; j++) for (let k = -1; k <= 1 && ok; k++) for (const q of grid.get((gy + j) * gw + gx + k) ?? []) { const P = pts[q]; if (P[2] === r && Math.hypot(P[0] - x, P[1] - y) < gap * 0.95) { ok = false; break; } }
    if (!ok) continue;
    // the course's reading direction at the seed: along the outline (perpendicular to the distance gradient),
    // turned to run left to right (or up a vertical course), so anything written in the tile reads
    const i = y * w + x, sx = sdf[i + 1] - sdf[i - 1], sy = sdf[i + w] - sdf[i - w], gl = Math.hypot(sx, sy) || 1;
    let tx = -sy / gl, ty = sx / gl; if (tx < -0.35 || (Math.abs(tx) <= 0.35 && ty > 0)) { tx = -tx; ty = -ty; }
    const id = pts.length; pts.push([x, y, r, tx, ty]); const c = cellOf(x, y); if (!grid.has(c)) grid.set(c, []); grid.get(c).push(id);
  }
  // reading order: within each course, seeds sorted clockwise around the middle of the frame, so text written into
  // consecutive tiles runs along the course
  const byCourse = new Map(); pts.forEach((P, q) => { if (!byCourse.has(P[2])) byCourse.set(P[2], []); byCourse.get(P[2]).push(q); });
  const seq = new Int32Array(pts.length);
  for (const [r, qs] of byCourse) { qs.sort((a, b) => Math.atan2(pts[a][1] - h / 2, pts[a][0] - w / 2) - Math.atan2(pts[b][1] - h / 2, pts[b][0] - w / 2)); qs.forEach((q, k) => { seq[q] = r * 100003 + k; }); }
  return {
    seq: (q) => seq[q],
    nearest(x, y, r) {
      const gx = Math.floor(x / cs), gy = Math.floor(y / cs); let best = -1, bd = Infinity;
      for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) for (const q of grid.get((gy + j) * gw + gx + k) ?? []) { const P = pts[q]; if (P[2] !== r) continue; const dd = (P[0] - x) ** 2 + (P[1] - y) ** 2; if (dd < bd) { bd = dd; best = q; } }
      return best;
    },
    u(x, y, q) { const P = pts[q]; return Math.max(0, Math.min(1, 0.5 + ((x - P[0]) * P[3] + (y - P[1]) * P[4]) / gap)); },
    v(x, y, q) { const P = pts[q]; return Math.max(0, Math.min(1, 0.5 + (-(x - P[0]) * P[4] + (y - P[1]) * P[3]) / Tf)); },
  };
}

function hash(str, seed, salt) {
  let h = 2166136261 ^ (seed * 16777619) ^ (salt * 374761393);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
