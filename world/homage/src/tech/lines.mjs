// src/tech/lines.mjs: four line techniques, each chosen to echo its sitter's idea. Input is a tone field from
// src/tonefield.mjs; output is { ink, spot } separations (src/raster.mjs Plate). No photo pixel reaches this file.
//
//   tree     Darwin. Space colonisation (Runions et al. 2007): attractor points scattered by darkness pull a tree up
//            from one root at the foot of the plate. Branch widths follow the pipe model (w^2 = sum of children w^2),
//            so the face appears as the density of one branching lineage. Spot: the single path from the root to
//            the eye, the one line of descent.
//   stream   William James. Evenly spaced streamlines along the form (techniques/lib/burin.js), long and unbroken,
//            line width from tone: the "stream of thought" as a burin engraving. Spot: the longest stream.
//   refute   Karl Popper. Conjectures and refutations: thousands of straight hatch lines are proposed at random;
//            each segment is tested against the tone and only survivors print in ink. A sample of refuted segments
//            stays visible in the spot colour, thin, so the errors that shaped the picture remain on the record.
//   wave     Yusef Lateef. Horizontal scan lines drawn as sound: amplitude and pitch rise with darkness, like a
//            groove or a scope trace. Spot: one line, the melody, where the reed meets the mouth.
import { Plate } from '../raster.mjs';
import { sampleF, fbm } from '../tonefield.mjs';
import { streamlines } from '../../../techniques/lib/burin.js';

const dark = (F, x, y) => 1 - sampleF(F, F.tone, x, y);

// Uniform grid hash for nearest-node queries.
function hashGrid(cell) {
  const m = new Map(), key = (x, y) => ((x / cell) | 0) * 73856093 ^ ((y / cell) | 0) * 19349663;
  return {
    add(x, y, id) { const k = key(x, y); (m.get(k) || m.set(k, []).get(k)).push(id); },
    near(x, y, r, fn) {
      const c0 = Math.floor((x - r) / cell), c1 = Math.floor((x + r) / cell), r0 = Math.floor((y - r) / cell), r1 = Math.floor((y + r) / cell);
      for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) { const a = m.get((cx * 73856093) ^ (cy * 19349663)); if (a) for (const id of a) fn(id); }
    },
  };
}

export function tree(F, p = {}) {
  const { w, h } = F, R = F.rand, ink = new Plate(w, h), spot = new Plate(w, h);
  const N = p.attractors ?? Math.round(w * h / 16), D = p.step ?? w / 400, di = p.influence ?? w / 16, dk = p.kill ?? w / 220;
  const A = [];
  while (A.length < N) { const x = R() * w, y = R() * h, d = dark(F, x, y); if (R() < Math.pow(d, p.gamma ?? 3)) A.push([x, y]); }
  const nx = [w * (p.rootX ?? 0.5)], ny = [h - 1], par = [-1], ng = hashGrid(di);
  ng.add(nx[0], ny[0], 0);
  // trunk: grow straight up until the first attractors are in reach
  let alive = A.map(() => true), left = A.length;
  for (let it = 0; it < (p.iterations ?? Math.round(6000 * Math.max(1, w / 500))) && left > 0; it++) {
    const acc = new Map();
    for (let a = 0; a < A.length; a++) {
      if (!alive[a]) continue;
      const [ax, ay] = A[a]; let best = -1, bd = di * di;
      ng.near(ax, ay, di, (id) => { const d2 = (nx[id] - ax) ** 2 + (ny[id] - ay) ** 2; if (d2 < bd) { bd = d2; best = id; } });
      if (best < 0) continue;
      if (bd < dk * dk) { alive[a] = false; left--; continue; }
      const l = Math.sqrt(bd), v = acc.get(best) || [0, 0, 0]; v[0] += (ax - nx[best]) / l; v[1] += (ay - ny[best]) / l; v[2]++; acc.set(best, v);
    }
    if (!acc.size) { // nothing in reach: bridge. Of a few live attractors, the one closest to the tree pulls its
      // nearest node toward it, with a little wander, so new lineages start at the nearest edge of the old one
      const live = []; for (let i = 0; i < A.length; i++) if (alive[i]) live.push(i);
      if (!live.length) break;
      let a = -1, b = 0, bd = Infinity;
      for (let tries = 0; tries < Math.min(16, live.length); tries++) {
        const c = live[(R() * live.length) | 0];
        for (let i = 0; i < nx.length; i++) { const d2 = (nx[i] - A[c][0]) ** 2 + (ny[i] - A[c][1]) ** 2; if (d2 < bd) { bd = d2; b = i; a = c; } }
      }
      for (let k = 0; k < 900 && (nx[b] - A[a][0]) ** 2 + (ny[b] - A[a][1]) ** 2 > di * di * 0.8; k++) {
        const l = Math.hypot(A[a][0] - nx[b], A[a][1] - ny[b]), ux = (A[a][0] - nx[b]) / l, uy = (A[a][1] - ny[b]) / l;
        const wv = (fbm(nx[b] / (w * 0.06), ny[b] / (w * 0.06), 31, 2) - 0.5) * 2.4; // a smooth meander, not a ruler line
        const vx = ux - uy * wv, vy = uy + ux * wv, vl = Math.hypot(vx, vy);
        nx.push(nx[b] + (vx / vl) * D); ny.push(ny[b] + (vy / vl) * D);
        par.push(b); b = nx.length - 1; ng.add(nx[b], ny[b], b);
      }
      continue;
    }
    for (const [id, [vx, vy]] of acc) {
      const l = Math.hypot(vx, vy) || 1, x = nx[id] + (vx / l) * D + (R() - 0.5) * D * 0.25, y = ny[id] + (vy / l) * D + (R() - 0.5) * D * 0.25;
      nx.push(x); ny.push(y); par.push(id); ng.add(x, y, nx.length - 1);
    }
  }
  // pipe model widths, tips first
  const n = nx.length, wsq = new Float32Array(n).fill(0), kids = new Int32Array(n);
  for (let i = 1; i < n; i++) kids[par[i]]++;
  const tip = (p.tipWidth ?? (0.6 + w / 1600)) ** 2;
  for (let i = n - 1; i > 0; i--) { if (!kids[i]) wsq[i] += tip; wsq[par[i]] += wsq[i]; }
  // width: the pipe model capped, then scaled by the tone under the branch, so the lineage thins to a hair where
  // the face is light and thickens where it is dark; the likeness lives in the twigs, the history in the trunk
  const wmax = p.maxWidth ?? w / 160, rad = (i) => Math.min(wmax, Math.sqrt(wsq[i])) * 0.5 * (0.35 + 0.65 * Math.pow(dark(F, nx[i], ny[i]), 1.1));
  for (let i = 1; i < n; i++) { const j = par[i]; ink.seg(nx[j], ny[j], nx[i], ny[i], rad(j), rad(i), 0.95); }
  // spot: the line of descent from the root to the node nearest the left eye
  const [ex, ey] = F.marks.eyeL; let best = 0, bd = Infinity;
  for (let i = 0; i < n; i++) { const d = (nx[i] - ex) ** 2 + (ny[i] - ey) ** 2; if (d < bd) { bd = d; best = i; } }
  for (let i = best; par[i] >= 0; i = par[i]) spot.seg(nx[par[i]], ny[par[i]], nx[i], ny[i], Math.max(1.1, w / 500));
  return { ink, spot, stats: { attractors: N, nodes: n } };
}

export function stream(F, p = {}) {
  const { w, h } = F, ink = new Plate(w, h), spot = new Plate(w, h), dsep = p.dsep ?? w / 150;
  const field = { w, h, tx: F.tx, ty: F.ty };
  const lines = streamlines(field, { dsep, seed: p.seed ?? 7, maxSteps: 4000, minLen: 10, test: 0.5 });
  const maxW = dsep * (p.maxW ?? 0.48), gamma = p.gamma ?? 1.3;
  let longest = null;
  for (const L of lines) {
    const r = (k) => { const d = dark(F, L[2 * k], L[2 * k + 1]); return d < 0.06 ? 0 : maxW * Math.pow((d - 0.06) / 0.94, gamma); };
    for (let k = 0; k + 1 < L.length / 2; k++) { const r0 = r(k), r1 = r(k + 1); if (r0 + r1 > 0.05) ink.seg(L[2 * k], L[2 * k + 1], L[2 * k + 2], L[2 * k + 3], r0, r1); }
    if (!longest || L.length > longest.length) longest = L;
  }
  if (longest) spot.poly(longest, Math.max(0.9, maxW * 0.55));
  return { ink, spot, stats: { lines: lines.length } };
}

export function refute(F, p = {}) {
  const { w, h } = F, R = F.rand, ink = new Plate(w, h), spot = new Plate(w, h);
  const M = p.conjectures ?? Math.round(w * 70), step = 1.5, r = p.width ?? w / 2400 + 0.3;
  let kept = 0, refuted = 0;
  for (let k = 0; k < M; k++) {
    const ang = (p.angles ?? [0.5, -0.65, 1.35])[k % 3] + (R() - 0.5) * 0.22, len = w * (0.006 + R() * 0.022);
    const cx = R() * w, cy = R() * h, dx = Math.cos(ang), dy = Math.sin(ang), level = 0.2 + 0.75 * R(); // each conjecture claims "darker than level here"
    for (let s = -len / 2; s < len / 2; s += step) {
      const x0 = cx + dx * s, y0 = cy + dy * s, x1 = x0 + dx * step, y1 = y0 + dy * step;
      if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) continue;
      if (dark(F, x0, y0) > level) { ink.seg(x0, y0, x1, y1, r, r, 0.85); kept++; }
      else { refuted++; if (R() < (p.ghost ?? 0.004) && F.mask[(y0 | 0) * w + (x0 | 0)] > 0.3) spot.seg(x0, y0, x1, y1, 0.5, 0.5, 0.8); }
    }
  }
  return { ink, spot, stats: { conjectures: M, kept, refuted } };
}

export function wave(F, p = {}) {
  const { w, h } = F, ink = new Plate(w, h), spot = new Plate(w, h), gap = p.gap ?? h / 120, amp = gap * (p.amp ?? 0.62);
  const melodyY = F.marks.mouth[1];
  let phase = 0;
  for (let y0 = gap / 2; y0 < h; y0 += gap) {
    const pts = [], rs = []; phase = 0;
    for (let x = 0; x <= w; x += 1) {
      const d = dark(F, x, y0); phase += 0.05 + 0.55 * d * d;
      pts.push(x, y0 + Math.sin(phase) * amp * d); rs.push(0.35 + d * gap * 0.16);
    }
    const target = Math.abs(y0 - melodyY) < gap / 2 ? spot : ink, inFig = (x) => F.mask[(y0 | 0) * w + Math.min(w - 1, x | 0)] > 0.5;
    for (let k = 0; k + 3 < pts.length; k += 2) {
      if (rs[k / 2] > 0.4) ink.seg(pts[k], pts[k + 1], pts[k + 2], pts[k + 3], rs[k / 2], rs[k / 2 + 1], Math.min(1, (rs[k / 2] - 0.3) * 3));
      if (target === spot && inFig(pts[k])) spot.seg(pts[k], pts[k + 1], pts[k + 2], pts[k + 3], rs[k / 2] + 0.6, rs[k / 2 + 1] + 0.6, 1); // the melody overprints its own line
    }
  }
  return { ink, spot, stats: { lines: Math.round(h / gap) } };
}
