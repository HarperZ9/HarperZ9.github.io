// src/tech/print.mjs: four print-shop and drawing techniques, each chosen to echo its sitter's idea.
//
//   woodcut  Karl Marx. A relief block cut along curved gouge lines: ink stands where the line screen's phase sits
//            above the tone, so lines swell in shadow and vanish in light (a linocut or woodcut line screen). The
//            spot separation is the print-shop halftone of the period poster: an amplitude-modulated dot screen at
//            45 degrees under the figure, with the measured feed-29 two-tone-plus-spot treatment (black, cream, one red).
//   chance   C. S. Peirce. Tychism and synechism: dots fall at random where it is dark, then a few Lloyd-style
//            relaxation steps pull them toward even spacing, more steps toward the right edge. Chance hardens into
//            habit across the plate. Spot: Peirce's triad, three dots in the margin.
//   stamp    John Dewey. Learning by doing, art as experience: a hand-held stamp brush (bristle clusters with pressure
//            and drying) pulled in short strokes along the form, laid where the tone asks for ink. No spot.
//   system   Ludwig von Bertalanffy. An open system: nodes placed by darkness, each linked to its nearest neighbours,
//            line weight from the tone between them. Spot: feedback loops, closed cycles of three links.
import { Plate } from '../raster.mjs';
import { sampleF, fbm } from '../tonefield.mjs';

const dark = (F, x, y) => 1 - sampleF(F, F.tone, x, y);
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

export function woodcut(F, p = {}) {
  const { w, h } = F, ink = new Plate(w, h), spot = new Plate(w, h), period = p.period ?? w / 95, cell = p.cell ?? w / 70;
  const { cx } = F.head;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, d = 1 - F.tone[i];
    // gouge coordinate: near-horizontal cuts that arch over the head ellipse and wander a little with the knife,
    // the way a carver follows the skull and lets the beard fall in long strokes
    const ex = (x - cx) / F.head.rx, arch = Math.max(0, 1 - ex * ex) * F.head.ry * 0.28;
    const u = y - arch + (fbm(x / (w * 0.2), y / (w * 0.2), 9, 3) - 0.5) * period * 3 + d * period * 0.35;
    const s = 0.5 + 0.5 * Math.cos((2 * Math.PI * u) / period); // 1 on a ridge, 0 in a gouge
    // threshold so the inked share of each period equals the tone: share = acos(2t - 1) / pi
    const t = 0.5 + 0.5 * Math.cos(Math.PI * Math.pow(d, p.gamma ?? 1.7)), cov = clamp((s - t) / 0.12 + 0.5);
    ink.put(x, y, d < 0.04 ? 0 : cov);
    // halftone spot under the figure: dots at 45 degrees, radius from tone, only in the plate's lower half
    const rx = (x + y) / Math.SQRT2, ry = (x - y) / Math.SQRT2, gxp = ((rx % cell) + cell) % cell - cell / 2, gyp = ((ry % cell) + cell) % cell - cell / 2;
    // the poster block: a rectangle behind the head, offset like a mis-registered second pass
    const bx = x / w, by = y / h, inBlock = bx > 0.64 && bx < 0.93 && by > 0.1 && by < 0.56 ? 1 : 0;
    const band = inBlock * (1 - F.mask[i] * 0.9);
    const rad = cell * 0.5 * Math.sqrt(clamp(0.3 * band + 0.2 * band * fbm(x / 60, y / 60, 4)));
    if (band > 0) spot.put(x, y, clamp(rad - Math.hypot(gxp, gyp) + 0.5));
  }
  return { ink, spot, stats: { period, cell } };
}

export function chance(F, p = {}) {
  const { w, h } = F, R = F.rand, ink = new Plate(w, h), spot = new Plate(w, h);
  const N = p.dots ?? Math.round((w * h) / 26), pts = [];
  while (pts.length < N) { const x = R() * w, y = R() * h, d = dark(F, x, y); if (R() < d * d) pts.push([x, y]); }
  // relaxation: move each dot away from its nearest neighbours, more steps toward the right edge (habit)
  const cell = Math.sqrt((w * h) / N) * 1.4;
  for (let it = 0; it < (p.steps ?? 6); it++) {
    const g = new Map(), key = (x, y) => ((x / cell) | 0) + ',' + ((y / cell) | 0);
    pts.forEach((q, k) => { const kk = key(q[0], q[1]); (g.get(kk) || g.set(kk, []).get(kk)).push(k); });
    for (const q of pts) {
      const law = clamp((q[0] / w - 0.15) / 0.7); if (R() > law) continue;
      let fx = 0, fy = 0; const cx = (q[0] / cell) | 0, cy = (q[1] / cell) | 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const k of g.get(cx + i + ',' + (cy + j)) || []) {
        const o = pts[k]; if (o === q) continue; const dx = q[0] - o[0], dy = q[1] - o[1], d2 = dx * dx + dy * dy + 1e-3;
        if (d2 < cell * cell) { fx += dx / d2; fy += dy / d2; }
      }
      q[0] = clamp(q[0] + clamp(fx * cell * 0.35, -1.5, 1.5), 0, w - 1); q[1] = clamp(q[1] + clamp(fy * cell * 0.35, -1.5, 1.5), 0, h - 1);
    }
  }
  const rmax = p.radius ?? w / 680;
  for (const [x, y] of pts) ink.disc(x, y, rmax * (0.55 + 0.6 * dark(F, x, y)));
  const tx = w * 0.9, ty = h * 0.9, s = w * 0.018;
  for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) spot.disc(tx + Math.cos(a) * s, ty + Math.sin(a) * s, s * 0.32);
  return { ink, spot, stats: { dots: N } };
}

export function stamp(F, p = {}) {
  const { w, h } = F, R = F.rand, ink = new Plate(w, h), spot = new Plate(w, h);
  const size = p.size ?? w / 90, strokes = p.strokes ?? Math.round((w * h) / (size * size * 0.35));
  const bristles = Array.from({ length: p.bristles ?? 9 }, () => [(R() - 0.5) * size, (R() - 0.5) * size * 0.45, 0.25 + R() * 0.6]);
  let laid = 0;
  for (let k = 0; k < strokes; k++) {
    let x = R() * w, y = R() * h; const d0 = dark(F, x, y);
    if (R() > Math.pow(d0, 1.3) * 1.2) continue;
    const len = 4 + ((R() * 10) | 0), dir = R() < 0.5 ? 1 : -1;
    let load = 0.9 + 0.1 * R();
    for (let s = 0; s < len; s++) {
      const i = (clamp(y, 0, h - 1) | 0) * w + (clamp(x, 0, w - 1) | 0), tx = F.tx[i] * dir, ty = F.ty[i] * dir, nx = -ty, ny = tx;
      const pressure = Math.sin(Math.PI * (s + 0.5) / len) * load, d = dark(F, x, y);
      for (const [bu0, bv0, br] of bristles) {
        const bu = bu0 + (R() - 0.5) * size * 0.18, bv = bv0 + (R() - 0.5) * size * 0.3; // bristles splay a little each press
        const bx = x + nx * bu + tx * bv, by = y + ny * bu + ty * bv;
        if (R() < 0.12 * (1 - load)) continue; // dry-brush skips as the load runs out
        ink.disc(bx, by, br * (0.7 + pressure * 0.9) * (w / 900 + 0.4), clamp(0.15 + 0.7 * d) * pressure);
      }
      x += tx * size * 0.32; y += ty * size * 0.32; load *= 0.94; laid++;
    }
  }
  return { ink, spot, stats: { strokes, stamps: laid } };
}

export function system(F, p = {}) {
  const { w, h } = F, R = F.rand, ink = new Plate(w, h), spot = new Plate(w, h);
  const N = p.nodes ?? Math.round((w * h) / 40), P = [];
  let tries = 0;
  while (P.length < N && tries++ < N * 60) { const x = R() * w, y = R() * h, d = dark(F, x, y); if (R() < Math.pow(d, p.gamma ?? 2.2)) P.push([x, y, d]); }
  const cell = Math.sqrt((w * h) / N) * 3, g = new Map(), key = (i, j) => i * 100003 + j;
  P.forEach((q, k) => { const kk = key((q[0] / cell) | 0, (q[1] / cell) | 0); (g.get(kk) || g.set(kk, []).get(kk)).push(k); });
  const edges = new Set(), nbr = P.map(() => []);
  P.forEach((q, a) => {
    const cand = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const b of g.get(key(((q[0] / cell) | 0) + i, ((q[1] / cell) | 0) + j)) || []) if (b !== a) cand.push([(P[b][0] - q[0]) ** 2 + (P[b][1] - q[1]) ** 2, b]);
    cand.sort((u, v) => u[0] - v[0]);
    const maxL2 = (cell * 0.75) ** 2;
    for (const [l2, b] of cand.slice(0, p.k ?? 3)) { if (l2 > maxL2) continue; const e = a < b ? a + ':' + b : b + ':' + a; if (!edges.has(e)) { edges.add(e); nbr[a].push(b); nbr[b].push(a); } }
  });
  for (const e of edges) {
    const [a, b] = e.split(':').map(Number), d = dark(F, (P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2);
    ink.seg(P[a][0], P[a][1], P[b][0], P[b][1], 0.3 + d * (p.width ?? w / 1600), 0.3 + d * (p.width ?? w / 1600), clamp(0.25 + d * 0.75));
  }
  for (const [x, y, d] of P) ink.disc(x, y, 0.3 + d * w / 1700);
  // feedback loops: triangles in the graph, a sparse sample in the darkest regions
  let loops = 0;
  for (let a = 0; a < P.length && loops < (p.loops ?? 14); a++) {
    if (P[a][2] < 0.7 || R() > 0.08) continue;
    for (const b of nbr[a]) for (const c of nbr[b]) if (c !== a && nbr[c].includes(a)) {
      for (const [u, v] of [[a, b], [b, c], [c, a]]) spot.seg(P[u][0], P[u][1], P[v][0], P[v][1], 1.2, 1.2);
      loops++; break;
    }
  }
  return { ink, spot, stats: { nodes: P.length, links: edges.size, loops } };
}
