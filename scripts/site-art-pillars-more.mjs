// site-art-pillars-more.mjs: the security and systems pillars and the resume cover for
// render-site-art.mjs. Each draw function takes the Doc and the shared kit of line-work
// helpers (circle, arc, ticks, hatch, core, flare, veil and the rest) from the renderer,
// so the vocabulary stays one family. Deterministic like the rest of the art.

// Marching squares over a sampled grid, with segments joined into polylines by their
// shared edge points, so a contour is written as one path instead of many short ones.
export function isolines(grid, nx, ny, x0, y0, step, level) {
  const W = nx + 1, at = (i, j) => grid[j * W + i], pt = new Map(), adj = new Map();
  const P = (i, j, h) => {
    const k = (h ? 0 : 1) + 2 * (j * W + i);
    if (!pt.has(k)) {
      const a = at(i, j), b = h ? at(i + 1, j) : at(i, j + 1), t = (level - a) / (b - a);
      pt.set(k, h ? [x0 + (i + t) * step, y0 + j * step] : [x0 + i * step, y0 + (j + t) * step]);
    }
    return k;
  };
  const link = (p, q) => { for (const [a, b] of [[p, q], [q, p]]) { if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); } };
  const PAIRS = { 1: "LB", 2: "BR", 3: "LR", 4: "TR", 5: "LTBR", 6: "TB", 7: "LT", 8: "LT", 9: "TB", 10: "TRLB", 11: "TR", 12: "LR", 13: "BR", 14: "LB" };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = (at(i, j) > level) * 8 + (at(i + 1, j) > level) * 4 + (at(i + 1, j + 1) > level) * 2 + (at(i, j + 1) > level);
    const s = PAIRS[c];
    if (!s) continue;
    const E = { T: () => P(i, j, true), B: () => P(i, j + 1, true), L: () => P(i, j, false), R: () => P(i + 1, j, false) };
    for (let k = 0; k < s.length; k += 2) link(E[s[k]](), E[s[k + 1]]());
  }
  const seen = new Set(), out = [];
  const walk = (start) => {
    const line = [pt.get(start)]; seen.add(start);
    for (let k = start; ;) {
      const next = adj.get(k).find((n) => !seen.has(n));
      if (next === undefined) { if (adj.get(k).includes(start) && line.length > 2) line.push(pt.get(start)); break; }
      seen.add(next); line.push(pt.get(next)); k = next;
    }
    out.push(line);
  };
  for (const [k, v] of adj) if (v.length === 1 && !seen.has(k)) walk(k);
  for (const k of adj.keys()) if (!seen.has(k)) walk(k);
  return out;
}

export function sampleField(field, x0, y0, x1, y1, step) {
  const nx = Math.ceil((x1 - x0) / step), ny = Math.ceil((y1 - y0) / step), grid = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) grid[j * (nx + 1) + i] = field(x0 + i * step, y0 + j * step);
  return { grid, nx, ny };
}

function crosses(d, K, pts, s = 14) {
  const reg = d.pen(d.P.pen2, 1, 0.7);
  pts.forEach(([x, y]) => { reg.line([[x - s, y], [x + s, y]]); reg.line([[x, y - s], [x, y + s]]); reg.line(K.circle(x, y, s * 0.55, null, 16)); });
}

// Security: an iris diaphragm stopped down to a pinhole. Nine hatched blades seal the
// aperture, and the only light in the plate leaks through the small hole they leave.
function security(d, K) {
  const { W, H, P } = d, { TAU, circle, arc, ticks, hatch, lw } = K, cx = 600, cy = 450, a = 44, Rb = 330, n = 9;
  K.lift(d, cx, cy, 640);
  const seg = TAU / n, twist = (r) => 1.3 * Math.pow(Math.max(0, (r - a) / (Rb - a)), 0.62);
  const hole = (phi) => a * Math.cos(Math.PI / n) / Math.cos((((phi % seg) + seg) % seg) - Math.PI / n);
  const owner = (x, y) => {
    const r = Math.hypot(x - cx, y - cy), phi = Math.atan2(y - cy, x - cx);
    if (r > Rb || r < hole(phi)) return -1;
    return Math.floor((((phi - twist(r)) % TAU) + TAU) % TAU / seg);
  };
  const box = [cx - Rb, cy - Rb, cx + Rb, cy + Rb];
  for (let i = 0; i < n; i++) {
    // Three tones of blade, dense to open, so the overlapping plates read as a shutter.
    const tone = i % 3, pen = d.pen(P.ink, [1.1, 0.9, 0.8][tone], lw(d, [0.72, 0.55, 0.42][tone], [0.78, 0.6, 0.45][tone]));
    hatch(pen, (x, y) => owner(x, y) === i, box, i * seg + 1.2, [3.4, 5.6, 9][tone], d.N, 0, 4);
  }
  const seam = d.pen(P.ink, 1.4, lw(d, 0.85, 0.85), "", 10);
  for (let i = 0; i < n; i++) {
    const pts = [];
    for (let r = a; r <= Rb + 0.1; r += 4) { const t = i * seg + twist(r); pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    seam.line(pts);
  }
  seam.line(Array.from({ length: n + 1 }, (_, i) => [cx + a * Math.cos(i * seg), cy + a * Math.sin(i * seg)]));
  const housing = d.pen(P.ink, 1.2, lw(d, 0.8, 0.8), "", 10);
  [Rb, Rb + 5, Rb + 44, Rb + 50].forEach((r) => housing.line(circle(cx, cy, r)));
  ticks(d.pen(P.ink, 1, lw(d, 0.6, 0.65)), cx, cy, Rb + 10, 240, 14);
  for (let k = 0; k < 6; k++) {
    const t = k / 6 * TAU + 0.3;
    housing.line([...arc(cx, cy, Rb + 26, t - 0.06, t + 0.06, 8), ...arc(cx, cy, Rb + 38, t + 0.06, t - 0.06, 8)], true);
  }
  crosses(d, K, [[90, 90], [W - 90, 90], [90, H - 90], [W - 90, H - 90]]);
  K.core(d, cx, cy, 64, 1.2);
  K.flare(d, cx, cy, Rb + 47, -2.3, 0.5, 2.2, 2);
  K.veil(d);
}

// Systems: a die at the center with its pins fanned out as routed traces, straight,
// then a forty-five degree jog, then straight to a pad, on all four sides.
function systems(d, K) {
  const { W, H, P, R } = d, { circle, lw } = K, cx = 600, cy = 450, s = 84, pitch = 11, half = 7;
  K.lift(d, cx, cy, 640);
  const vias = d.pen(P.pen2, 0.9, 0.45, "", 10);
  for (let y = 30; y < H; y += 30) for (let x = 30; x < W; x += 30) {
    if (Math.abs(x - cx) < 260 && Math.abs(y - cy) < 260) continue;
    if (R() < 0.08) vias.line(circle(x, y, 3.2, null, 10));
  }
  const trace = d.pen(P.ink, 1.1, lw(d, 0.7, 0.75)), strong = d.pen(P.ink, 1.8, lw(d, 0.85, 0.85)), pad = d.pen(P.ink, 1.2, lw(d, 0.85, 0.85), "", 10);
  const reach = [W / 2 - 40, H / 2 - 40];
  for (let side = 0; side < 4; side++) {
    const c = Math.cos(side * Math.PI / 2), sn = Math.sin(side * Math.PI / 2), map = ([u, v]) => [cx + u * c - v * sn, cy + u * sn + v * c];
    const lim = reach[side % 2];
    for (let k = -half; k <= half; k++) {
      const v = k * pitch, out1 = s + 26 + (half - Math.abs(k)) * 9, jog = Math.abs(k) * 16, v2 = v + Math.sign(k) * jog;
      const u2 = out1 + jog, u3 = Math.min(lim - 12, u2 + 50 + R() * (lim - u2 - 60));
      const pts = [[s, v], [out1, v], [u2, v2], [u3, v2]].map(map);
      (k === 0 || Math.abs(k) === half ? strong : trace).line(pts);
      const [ex, ey] = pts[3];
      pad.line(circle(ex, ey, 5, null, 12));
      if (R() < 0.4) pad.line(circle(ex, ey, 1.6, null, 8));
    }
  }
  const chip = d.pen(P.ink, 1.3, lw(d, 0.9, 0.88), "", 10), sq = (h) => [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]];
  [s, s - 7].forEach((h) => chip.line(sq(h), true));
  const die = d.pen(P.pen2, 0.8, 0.55);
  K.hatch(die, (x, y) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) > s - 44 && Math.max(Math.abs(x - cx), Math.abs(y - cy)) < s - 12, [cx - s, cy - s, cx + s, cy + s], Math.PI / 4, 4, d.N);
  chip.line(sq(s - 44), true);
  K.core(d, cx, cy, 78, 1.1);
  K.flare(d, cx, cy, s + 4, -2.5, 0.5, 2, 1.8);
  K.veil(d);
}

// Resume cover: a contour map of two summits, a dotted route climbing across it from
// the lower left, and the lit core at the higher summit where the route ends.
function resume(d, K) {
  const { W, H, P, N } = d, { circle, lw, fbm } = K, sx = 1150, sy = 330;
  K.lift(d, sx, sy, 700);
  const g = (x, y, cx, cy, r) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r));
  const field = (x, y) => g(x, y, sx, sy, 250) + 0.5 * g(x, y, 470, 560, 210) + 0.2 * fbm(N, x * 0.004, y * 0.004);
  const { grid, nx, ny } = sampleField(field, -10, -10, W + 10, H + 10, 8);
  const thin = d.pen(P.ink, 1, lw(d, 0.58, 0.56)), index = d.pen(P.ink, 1.5, lw(d, 0.86, 0.82));
  for (let k = 0; k < 26; k++) {
    const level = -0.1 + k * 0.045, pen = k % 5 === 0 ? index : thin;
    isolines(grid, nx, ny, -10, -10, 8, level).forEach((line) => { if (line.length > 3) pen.line(line); });
  }
  const way = [[80, 770], [300, 690], [470, 560], [700, 600], [900, 470], [1040, 390], [sx, sy]];
  const route = d.dots(P.ink, 3.4, lw(d, 0.9, 0.88)), mark = d.pen(P.ink, 1.4, 0.9, "", 10);
  for (let i = 0; i < way.length - 1; i++) {
    const [ax, ay] = way[i], [bx, by] = way[i + 1], L = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t < L; t += 11) {
      const f = t / L, wob = 14 * N(i * 3 + f * 2, 0.7) * Math.sin(Math.PI * f);
      route.dot(ax + (bx - ax) * f - (by - ay) / L * wob, ay + (by - ay) * f + (bx - ax) / L * wob);
    }
    if (i > 0) { mark.line(circle(ax, ay, 8, null, 16)); mark.line(circle(ax, ay, 2, null, 8)); }
  }
  const bar = d.pen(P.ink, 1.2, 0.85);
  bar.line([[90, 60], [410, 60]]);
  for (let i = 0; i <= 8; i++) bar.line([[90 + i * 40, 60], [90 + i * 40, 60 + (i % 4 === 0 ? 16 : 8)]]);
  crosses(d, K, [[W - 90, H - 80]], 12);
  K.core(d, sx, sy, 92, 1.1);
  K.flare(d, sx, sy, 70, -2.4, 0.7, 2.2, 2);
  K.veil(d);
}

// Frontier safety cover: the recurring edition as a dial. Fifty-two dated ticks ring the
// core, one per week of a year, with a longer tick at each month. One tick is lit and runs
// out past the rings: the current edition. A dated axis crosses the plate behind the dial.
function edition(d, K) {
  const { W, P, N } = d, { TAU, circle, arc, lw } = K, cx = 800, cy = 400, lit = 37;
  K.lift(d, cx, cy, 700);
  const hair = d.pen(P.pen2, 1, lw(d, 0.55, 0.6)), ink = d.pen(P.ink, 1.1, lw(d, 0.75, 0.78));
  const axis = d.pen(P.pen2, 1, 0.55, ` stroke-dasharray="3 9"`);
  axis.line([[60, cy], [cx - 390, cy]]); axis.line([[cx + 390, cy], [W - 60, cy]]);
  for (let x = 80; x < W - 60; x += 40) if (Math.abs(x - cx) > 400) hair.line([[x, cy - (x % 200 === 0 ? 12 : 5)], [x, cy + (x % 200 === 0 ? 12 : 5)]]);
  [150, 232, 236, 330].forEach((r) => (r === 236 ? hair : ink).line(circle(cx, cy, r)));
  d.pen(P.pen2, 1, 0.5, ` stroke-dasharray="2 7"`).line(circle(cx, cy, 372));
  const at = (i) => -Math.PI / 2 + (i / 52) * TAU;
  for (let i = 0; i < 52; i++) {
    if (i === lit) continue;
    const t = at(i), month = i % 4 === 0, L = (month ? 46 : 22) * (0.75 + 0.25 * (N(i * 0.37, 2.1) + 1));
    (month ? ink : hair).line([[cx + 240 * Math.cos(t), cy + 240 * Math.sin(t)], [cx + (240 + L) * Math.cos(t), cy + (240 + L) * Math.sin(t)]]);
  }
  K.corona(d.pen(P.ink, 0.9, lw(d, 0.5, 0.55)), cx, cy, 64, 80, 200, N, 1.4);
  const t = at(lit), beam = d.pen(P.ink, 2.4, 0.95);
  beam.line([[cx + 150 * Math.cos(t), cy + 150 * Math.sin(t)], [cx + 430 * Math.cos(t), cy + 430 * Math.sin(t)]]);
  const ex = cx + 430 * Math.cos(t), ey = cy + 430 * Math.sin(t), mark = d.pen(P.ink, 1.4, 0.9, "", 10);
  mark.line(circle(ex, ey, 9, null, 18)); mark.line(circle(ex, ey, 2.5, null, 8));
  hair.line(arc(cx, cy, 300, t - 0.5, t + 0.5));
  crosses(d, K, [[90, 90], [W - 90, 710]], 12);
  K.core(d, cx, cy, 86, 1.1);
  K.flare(d, cx, cy, 236, t - 0.28, 0.56, 2, 1.8);
  K.veil(d);
}

export function morePieces(K) {
  return [
    { slug: "pillar-security", page: "security.html", w: 1200, h: 900, seed: 70331, draw: (d) => security(d, K) },
    { slug: "pillar-systems", page: "catalog.html", w: 1200, h: 900, seed: 70332, draw: (d) => systems(d, K) },
    { slug: "cover-resume", page: "resume.html", w: 1600, h: 800, seed: 11820, draw: (d) => resume(d, K) },
    { slug: "cover-frontier-safety", page: "frontier-safety.html", w: 1600, h: 800, seed: 11819, draw: (d) => edition(d, K) },
  ];
}
