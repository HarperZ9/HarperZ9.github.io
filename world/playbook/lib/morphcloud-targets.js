// lib/morphcloud-targets.js: target shapes for morphcloud.js, each sampled to exactly n points in frame pixels.
// Every target returns { pts, near(x, y, tol), label } so a test can check where points came to rest.
// Real equations drive three of them: the nodal lines of a vibrating square plate, the phyllotaxis spiral at a
// printed divergence angle, and a hydrogen orbital's probability density in a plane slice. The others take any
// mask (a glyph from the lettering lib), any signed distance function, polylines (mesh edges) or a data series.
import { rng } from './util.js';

const fitBox = (w, h, fit) => { const s = Math.min(w, h) * fit; return { s, x0: (w - s) / 2, y0: (h - s) / 2 }; };

// Rejection sampling of an acceptance test over a box, deterministic per seed; never loops forever.
function rejection(n, seed, box, accept, maxTries = 400) {
  const r = rng(seed), pts = new Float32Array(2 * n); let k = 0, tries = 0;
  while (k < n && tries < n * maxTries) { tries++; const x = box.x0 + r() * box.s, y = box.y0 + r() * box.s; if (accept(x, y, r)) { pts[2 * k] = x; pts[2 * k + 1] = y; k++; } }
  if (k < n) throw new Error(`morphcloud: target accepted only ${k} of ${n} samples`);
  return pts;
}

// Square plate with free edges, the classic Chladni approximation: f = cos(n pi u) cos(m pi v) - cos(m pi u) cos(n pi v).
// Sand gathers on the nodal set f = 0; distance to it is estimated as |f| / |grad f|.
export function plate({ m = 3, n: k = 5, fit = 0.82 } = {}) {
  return (N, { w, h, seed, cell }) => {
    const b = fitBox(w, h, fit), P = Math.PI;
    const f = (x, y) => { const u = (x - b.x0) / b.s, v = (y - b.y0) / b.s; return Math.cos(k * P * u) * Math.cos(m * P * v) - Math.cos(m * P * u) * Math.cos(k * P * v); };
    const dist = (x, y) => { const e = 0.5, gx = (f(x + e, y) - f(x - e, y)) / (2 * e), gy = (f(x, y + e) - f(x, y - e)) / (2 * e); return Math.abs(f(x, y)) / (Math.hypot(gx, gy) + 1e-9); };
    const pts = rejection(N, seed, b, (x, y, r) => dist(x, y) < cell * 0.5 * r());
    return { pts, near: (x, y, tol) => x >= b.x0 - tol && x <= b.x0 + b.s + tol && y >= b.y0 - tol && y <= b.y0 + b.s + tol && dist(x, y) <= tol, label: `cos ${k}πx cos ${m}πy − cos ${m}πx cos ${k}πy = 0` };
  };
}

// Phyllotaxis: point j at radius c sqrt(j) and angle j x divergence. 137.508 degrees is the golden angle.
export function phyllotaxis({ angleDeg = 137.508, fit = 0.86 } = {}) {
  return (N, { w, h }) => {
    const R = (Math.min(w, h) * fit) / 2, c = R / Math.sqrt(N), a = (angleDeg * Math.PI) / 180, pts = new Float32Array(2 * N);
    for (let j = 0; j < N; j++) { const r = c * Math.sqrt(j + 0.5); pts[2 * j] = w / 2 + r * Math.cos(j * a); pts[2 * j + 1] = h / 2 + r * Math.sin(j * a); }
    return { pts, near: (x, y, tol) => Math.hypot(x - w / 2, y - h / 2) <= R + tol, label: `φ = ${angleDeg}°` };
  };
}

// Generalized Laguerre L_k^a(x) and associated Legendre P_l^m(x) by their recurrences.
function laguerre(k, a, x) { let L0 = 1, L1 = 1 + a - x; if (k === 0) return L0; for (let i = 1; i < k; i++) { const L2 = ((2 * i + 1 + a - x) * L1 - (i + a) * L0) / (i + 1); L0 = L1; L1 = L2; } return L1; }
function legendre(l, m, x) {
  let pmm = 1; const s = Math.sqrt(Math.max(0, 1 - x * x)); for (let i = 1; i <= m; i++) pmm *= -(2 * i - 1) * s;
  if (l === m) return pmm; let pm1 = x * (2 * m + 1) * pmm; if (l === m + 1) return pm1;
  for (let ll = m + 2; ll <= l; ll++) { const p = (x * (2 * ll - 1) * pm1 - (ll + m - 1) * pmm) / (ll - m); pmm = pm1; pm1 = p; }
  return pm1;
}
// Hydrogen orbital density |psi|^2 in the xz plane (Bohr radii), real form with cos(m phi).
export function orbitalDensity(nq, l, m, x, z) {
  const r = Math.hypot(x, z), rho = (2 * r) / nq, R = Math.pow(rho, l) * Math.exp(-rho / 2) * laguerre(nq - l - 1, 2 * l + 1, rho);
  const ct = r > 0 ? z / r : 1, Y = legendre(l, m, ct) * (x < 0 && m % 2 ? -1 : 1);
  return R * R * Y * Y;
}
export function orbital({ n: nq = 3, l = 2, m = 1, fit = 0.9, extent = null } = {}) {
  return (N, { w, h, seed }) => {
    const b = fitBox(w, h, fit), E = extent ?? 2.6 * nq * nq + 4, toA = (x) => ((x - b.x0) / b.s - 0.5) * 2 * E;
    let max = 0; for (let j = 0; j < 160; j++) for (let i = 0; i < 160; i++) max = Math.max(max, orbitalDensity(nq, l, m, ((i + 0.5) / 80 - 1) * E, ((j + 0.5) / 80 - 1) * E));
    const dens = (x, y) => orbitalDensity(nq, l, m, toA(x), -toA(y + b.x0 - b.y0)) / (max * 1.15);
    const pts = rejection(N, seed, b, (x, y, r) => r() < dens(x, y), 2000);
    const sub = ['s', 'p', 'd', 'f', 'g'][l] || `l${l}`;
    return { pts, near: (x, y) => dens(x, y) > 1e-4, label: `ψ ${nq}${sub}  n ${nq}  l ${l}  m ${m}` };
  };
}

// Any coverage mask (for example a glyph from lettering/lib/glyph.mjs rasterText), fitted into the frame.
// Samples are stratified over the inside pixels in raster order, so coverage is even. place { x, y, s } puts the
// mask at an exact spot (frame px of its top left, frame px per mask px), so the cloud lands under real DOM text.
export function mask({ data, mw, mh, fit = 0.8, place = null, label = '' } = {}) {
  return (N, { w, h, seed }) => {
    const s = place ? place.s : Math.min((w * fit) / mw, (h * fit) / mh), ox = place ? place.x : (w - mw * s) / 2, oy = place ? place.y : (h - mh * s) / 2, inside = [];
    for (let i = 0; i < mw * mh; i++) if (data[i] > 0.5) inside.push(i);
    if (!inside.length) throw new Error('morphcloud: empty mask');
    const r = rng(seed), pts = new Float32Array(2 * N);
    for (let j = 0; j < N; j++) { const p = inside[Math.min(inside.length - 1, Math.floor(((j + r()) / N) * inside.length))]; pts[2 * j] = ox + ((p % mw) + r()) * s; pts[2 * j + 1] = oy + (Math.floor(p / mw) + r()) * s; }
    const at = (x, y) => { const u = Math.floor((x - ox) / s), v = Math.floor((y - oy) / s); return u >= 0 && v >= 0 && u < mw && v < mh && data[v * mw + u] > 0.5; };
    return { pts, near: (x, y, tol) => at(x, y) || at(x - tol, y) || at(x + tol, y) || at(x, y - tol) || at(x, y + tol), label };
  };
}

// Points on a band around the zero set of a signed distance function f(x, y) in frame pixels.
export function sdf({ f, fit = 1, label = '' } = {}) {
  return (N, { w, h, seed, cell }) => ({ pts: rejection(N, seed, { x0: 0, y0: 0, s: Math.max(w, h) * fit }, (x, y) => x < w && y < h && Math.abs(f(x, y)) < cell * 0.5), near: (x, y, tol) => Math.abs(f(x, y)) <= tol, label });
}

// Points along polylines (mesh edges in frame pixels), spaced by arc length, with a jitter under half a cell.
export function polylines({ lines, label = '' } = {}) {
  return (N, { seed, cell }) => {
    const segs = []; let total = 0;
    for (const L of lines) for (let i = 2; i < L.length; i += 2) { const len = Math.hypot(L[i] - L[i - 2], L[i + 1] - L[i - 1]); segs.push([L[i - 2], L[i - 1], L[i], L[i + 1], total, len]); total += len; }
    const r = rng(seed), pts = new Float32Array(2 * N); let s = 0;
    for (let j = 0; j < N; j++) {
      const at = ((j + r()) / N) * total; while (s < segs.length - 1 && segs[s][4] + segs[s][5] < at) s++;
      const [x0, y0, x1, y1, a, len] = segs[s], t = (at - a) / (len || 1), nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1), o = (r() - 0.5) * cell * 0.8;
      pts[2 * j] = x0 + (x1 - x0) * t + nx * o; pts[2 * j + 1] = y0 + (y1 - y0) * t + ny * o;
    }
    const d = (x, y) => Math.min(...segs.map(([x0, y0, x1, y1, , len]) => { const t = Math.max(0, Math.min(1, ((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / (len * len || 1))); return Math.hypot(x - x0 - (x1 - x0) * t, y - y0 - (y1 - y0) * t); }));
    return { pts, near: (x, y, tol) => d(x, y) <= tol, label };
  };
}

// A data series as its line graph, fitted to the frame with a margin.
export function series({ values, fit = 0.8, label = '' } = {}) {
  return (N, opts) => {
    const { w, h } = opts, lo = Math.min(...values), hi = Math.max(...values), mx = (w * (1 - fit)) / 2, my = (h * (1 - fit)) / 2, line = [];
    values.forEach((v, i) => line.push(mx + (i / (values.length - 1)) * w * fit, h - my - ((v - lo) / (hi - lo || 1)) * h * fit));
    return polylines({ lines: [line], label })(N, opts);
  };
}
