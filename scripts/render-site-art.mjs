#!/usr/bin/env node
// render-site-art.mjs: renders the site's aperture art family into art/aperture/.
//
// One recurring form (the aperture, a luminous core with line-work resolving around it) drawn
// with the techniques of the design canon: plotter line fields, density built by repetition,
// halftone dot screens, hidden-line ridge plots, crosshatch, outrun horizons, Molnar squares,
// op-art zigzags, flow fields and one spectral flare per piece. Every piece renders twice, once
// for a dark ground and once for a bone paper ground, as static SVG.
//
// Deterministic: every piece draws from its own fixed seed, and all coordinates are rounded
// before they are written, so a rerun writes identical bytes. No network, no dependencies.
//
//   node scripts/render-site-art.mjs           write every asset
//   node scripts/render-site-art.mjs --check   exit 1 if any asset is stale or over budget
//   node scripts/render-site-art.mjs --only hero,pillar-flywheel
//
// Placement lives in system/art.css. The page for each asset is in the PIECES table below.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "art", "aperture");
const BUDGET = 150 * 1024;
const TAU = Math.PI * 2;

const PAL = {
  dark: {
    name: "dark", dark: true, bg: "#040405", lift: "#0d0f18", ink: "#e6e1d6", pen2: "#8f8b84",
    warm: "#ffab52", honey: "#ffd592", core: "#fff7e8", rust: "#c9744a", blend: "screen",
    flare: ["#ff3d6e", "#ff8f3a", "#ffe04a", "#5dff8f", "#3fd8ff", "#5b6bff", "#c35cff"],
  },
  light: {
    name: "light", dark: false, bg: "#f1ece1", lift: "#e6dfd0", ink: "#1a1712", pen2: "#5f584d",
    warm: "#c4621d", honey: "#e7a653", core: "#fffdf7", rust: "#8a4526", blend: "multiply",
    flare: ["#d4144a", "#e3620b", "#c79b00", "#1f9a4c", "#0a86c0", "#3345d6", "#8b33cf"],
  },
};

// ---------- randomness ----------
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function perlin(rng) {
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const g = (h, x, y) => [x + y, -x + y, x - y, -x - y, x, -x, y, -y][h & 7];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y) => {
    const fx = Math.floor(x), fy = Math.floor(y), X = fx & 255, Y = fy & 255;
    x -= fx; y -= fy;
    const u = fade(x), v = fade(y), a = p[X] + Y, b = p[X + 1] + Y;
    return lerp(lerp(g(p[a], x, y), g(p[b], x - 1, y), u), lerp(g(p[a + 1], x, y - 1), g(p[b + 1], x - 1, y - 1), u), v);
  };
}
const fbm = (N, x, y, o = 3) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * N(x * f, y * f); a *= 0.5; f *= 2; } return s; };

// ---------- path encoding ----------
function simplify(pts, eps) {
  if (pts.length < 3 || !eps) return pts;
  const [fx, fy] = pts[0], [lx, ly] = pts[pts.length - 1];
  if (Math.hypot(lx - fx, ly - fy) < 1e-6) {
    // A closed ring: split it at the point farthest from its start so neither half degenerates.
    let far = 1, best = -1;
    pts.forEach(([x, y], k) => { const q = Math.hypot(x - fx, y - fy); if (q > best) { best = q; far = k; } });
    if (far === 0 || far === pts.length - 1) return pts.slice(0, 1);
    return [...simplify(pts.slice(0, far + 1), eps), ...simplify(pts.slice(far), eps).slice(1)];
  }
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const [ax, ay] = pts[i], [bx, by] = pts[j], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let best = -1, bi = -1;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((pts[k][0] - ax) * dy - (pts[k][1] - ay) * dx) / L; if (d > best) { best = d; bi = k; } }
    if (best > eps) { keep[bi] = 1; stack.push([i, bi], [bi, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}
const num = (v, q) => { let s = q === 1 ? String(v) : String(Math.round(v) / q); s = s.replace(/^(-?)0\./, "$1."); return s === "-0" ? "0" : s; };
function join2(out, a, b) { for (const t of [a, b]) out.push(t); }

class Pen {
  constructor(attrs, q = 1, eps = 0.35) { this.attrs = attrs; this.q = q; this.eps = eps; this.tok = []; this.cx = 0; this.cy = 0; }
  line(pts, closed = false) {
    pts = simplify(pts, this.eps);
    if (pts.length < 2) return;
    const q = this.q;
    let first = true, sx = 0, sy = 0;
    for (const [px, py] of pts) {
      const x = Math.round(px * q), y = Math.round(py * q);
      if (first) { this.tok.push("m"); join2(this.tok, num(x - this.cx, q), num(y - this.cy, q)); sx = x; sy = y; first = false; }
      else { const dx = x - this.cx, dy = y - this.cy; if (!dx && !dy) continue; join2(this.tok, num(dx, q), num(dy, q)); }
      this.cx = x; this.cy = y;
    }
    if (closed) { this.tok.push("z"); this.cx = sx; this.cy = sy; }
  }
  dot(px, py) {
    const x = Math.round(px * this.q), y = Math.round(py * this.q);
    this.tok.push("m"); join2(this.tok, num(x - this.cx, this.q), num(y - this.cy, this.q)); this.tok.push("h0");
    this.cx = x; this.cy = y;
  }
  svg() {
    if (!this.tok.length) return "";
    let d = "";
    for (const t of this.tok) {
      const letter = /^[a-z]/i.test(t), prev = d[d.length - 1];
      if (!d || letter || t[0] === "-" || /[a-z]/i.test(prev)) d += t; else d += " " + t;
    }
    return `<path ${this.attrs} d="${d}"/>`;
  }
}

// ---------- document ----------
class Doc {
  constructor(piece, P) {
    this.W = piece.w; this.H = piece.h; this.P = P; this.seed = piece.seed;
    this.R = mulberry(piece.seed); this.N = perlin(mulberry(piece.seed ^ 0x9e3779b9));
    this.defs = []; this.body = []; this.n = 0;
  }
  id(p) { return p + (this.n++).toString(36); }
  raw(s) { this.body.push(s); }
  pen(color, width, opacity = 1, extra = "", q = 1) {
    const o = opacity < 1 ? ` stroke-opacity="${+opacity.toFixed(2)}"` : "";
    const p = new Pen(`fill="none" stroke="${color}" stroke-width="${width}"${o} stroke-linecap="round" stroke-linejoin="round"${extra}`, q);
    this.body.push(p); return p;
  }
  fill(color, opacity = 1, extra = "") {
    const o = opacity < 1 ? ` fill-opacity="${+opacity.toFixed(2)}"` : "";
    const p = new Pen(`fill="${color}"${o}${extra}`, 1, 0.2); this.body.push(p); return p;
  }
  dots(color, size, opacity = 1) { const p = this.pen(color, +size.toFixed(1), opacity, "", 2); p.eps = 0; return p; }
  glow(cx, cy, r, stops) {
    const id = this.id("g");
    this.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</radialGradient>`);
    this.raw(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`);
  }
  render() {
    const { W, H, P } = this;
    const body = this.body.map((b) => (typeof b === "string" ? b : b.svg())).join("");
    // Everything is clipped to the canvas, so no line reaches past the frame whatever box the image sits in.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`
      + `<defs><clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath>${this.defs.join("")}</defs>`
      + `<g clip-path="url(#frame)"><rect width="${W}" height="${H}" fill="${P.bg}"/>${body}</g></svg>\n`;
  }
}

// ---------- shared vocabulary ----------
const circle = (cx, cy, r, wob = null, n = Math.max(28, Math.round(r * 0.45))) => {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = (i % n) / n * TAU, rr = r + (wob ? wob(t) : 0); pts.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t)]); }
  return pts;
};
const arc = (cx, cy, r, a0, a1, n = Math.max(8, Math.round(Math.abs(a1 - a0) * r * 0.45))) =>
  Array.from({ length: n + 1 }, (_, i) => { const t = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
function runs(pts, pred) {
  const out = []; let cur = [];
  for (const p of pts) { if (pred(p[0], p[1])) cur.push(p); else { if (cur.length > 1) out.push(cur); cur = []; } }
  if (cur.length > 1) out.push(cur);
  return out;
}
const seg = (x0, y0, x1, y1, n = 2) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
const clipLine = (pen, pts, pred) => runs(pts, pred).forEach((r) => pen.line(r));

function lift(d, cx, cy, r) { if (d.P.dark) d.glow(cx, cy, r, [[0, d.P.lift, 0.75], [1, d.P.lift, 0]]); }
function core(d, cx, cy, r, k = 1) {
  const P = d.P;
  if (P.dark) {
    d.glow(cx, cy, Math.min(r * 3, r + 260), [[0, P.warm, 0.16 * k], [0.45, P.warm, 0.05 * k], [1, P.warm, 0]]);
    d.glow(cx, cy, r, [[0, P.core, 1], [0.16, P.honey, 0.95], [0.42, P.warm, 0.5], [1, P.warm, 0]]);
  } else {
    d.glow(cx, cy, Math.min(r * 2.6, r + 240), [[0, P.honey, 0.26 * k], [1, P.honey, 0]]);
    d.glow(cx, cy, r, [[0, P.core, 1], [0.55, P.core, 0.92], [1, P.core, 0]]);
  }
}
// The one spectral flare: a short run of hue-stepped arcs where the rim refracts.
function flare(d, cx, cy, r, a0, span, gap = 2.6, w = 2.2) {
  const P = d.P, extra = ` style="mix-blend-mode:${P.blend}"`;
  P.flare.forEach((c, k) => {
    const rr = r + (k - 3) * gap, pen = d.pen(c, w, P.dark ? 0.9 : 0.85, extra, 10);
    pen.line(arc(cx, cy, rr, a0, a0 + span));
    pen.line(arc(cx, cy, rr, a0 + span * 0.3, a0 + span * 0.7));
  });
}
function blades(pen, cx, cy, r0, r1, n, twist, R, pred = null) {
  for (let i = 0; i < n; i++) {
    const t0 = i / n * TAU + R() * 0.02, pts = [];
    for (let s = 0; s <= 1.0001; s += 1 / 20) { const r = r0 + (r1 - r0) * s, t = t0 + twist * s; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    pred ? clipLine(pen, pts, pred) : pen.line(pts);
  }
}
function corona(pen, cx, cy, r0, len, n, N, f = 1.6, pred = null, expo = 2.4) {
  for (let i = 0; i < n; i++) {
    const t = i / n * TAU, v = (N(Math.cos(t) * f + 7, Math.sin(t) * f + 3) + N(Math.cos(t) * f * 4, Math.sin(t) * f * 4 + 9) * 0.6 + 1) / 2;
    const l = len * (0.08 + 0.92 * Math.pow(Math.max(0, v), expo) * (0.35 + 0.65 * ((i * 7919) % 101) / 100));
    const pts = seg(cx + r0 * Math.cos(t), cy + r0 * Math.sin(t), cx + (r0 + l) * Math.cos(t), cy + (r0 + l) * Math.sin(t), 6);
    pred ? clipLine(pen, pts, pred) : pen.line(pts);
  }
}
function ticks(pen, cx, cy, r, n, L, a0 = 0, a1 = TAU) {
  for (let i = 0; i <= n; i++) {
    if (a1 - a0 >= TAU - 1e-6 && i === n) break;
    const t = a0 + (a1 - a0) * i / n, l = i % 10 === 0 ? L : i % 5 === 0 ? L * 0.62 : L * 0.36;
    pen.line([[cx + r * Math.cos(t), cy + r * Math.sin(t)], [cx + (r + l) * Math.cos(t), cy + (r + l) * Math.sin(t)]]);
  }
}
function hatch(pen, inside, box, ang, sp, N, wob = 0, step = 4) {
  const [x0, y0, x1, y1] = box, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const cs = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
  const ss = cs.map(([x, y]) => x * nx + y * ny), ts = cs.map(([x, y]) => x * dx + y * dy);
  const tmin = Math.min(...ts), tmax = Math.max(...ts);
  for (let s = Math.min(...ss) + sp / 2; s < Math.max(...ss); s += sp) {
    let run = [];
    for (let t = tmin; t <= tmax + step; t += step) {
      let x = nx * s + dx * t, y = ny * s + dy * t;
      if (wob) { const w = wob * N(x * 0.011, y * 0.011 + s * 0.007); x += nx * w; y += ny * w; }
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && inside(x, y)) run.push([x, y]);
      else { if (run.length > 1) pen.line(run); run = []; }
    }
    if (run.length > 1) pen.line(run);
  }
}
// Hidden-line ridge plot: lines drawn front to back, each hidden where a nearer line rises above it.
function ridges(count, x0, x1, step, base, height, penFor, keep = () => () => true) {
  const cols = Math.ceil((x1 - x0) / step) + 1, horizon = new Float64Array(cols).fill(Infinity);
  for (let i = count - 1; i >= 0; i--) {
    let run = []; const pen = penFor(i), draw = keep(i);
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * step, y = base(i) - height(i, x), vis = y < horizon[c] - 0.6;
      if (vis && draw(x)) run.push([x, y]); else { if (run.length > 1) pen.line(run); run = []; }
      if (vis) horizon[c] = y;
    }
    if (run.length > 1) pen.line(run);
  }
}
function halftone(d, cx, cy, r, step, levels, light, pred = () => true, color = null, ang = 0.26) {
  const P = d.P, pens = [];
  for (let l = 1; l <= levels; l++) pens.push(d.dots(color || P.ink, step * 0.92 * Math.sqrt(l / levels), P.dark ? 0.85 : 0.8));
  const [lx, ly, lz] = light, c = Math.cos(ang), s = Math.sin(ang), n = Math.ceil(r / step) + 1;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const x = cx + (i * c - j * s) * step, y = cy + (i * s + j * c) * step, dx = (x - cx) / r, dy = (y - cy) / r, q = dx * dx + dy * dy;
    if (q >= 1 || !pred(x, y)) continue;
    const nz = Math.sqrt(1 - q), lum = Math.max(0, dx * lx + dy * ly + nz * lz), v = P.dark ? lum : 1 - lum * 0.92;
    const lvl = Math.round(v * levels);
    if (lvl > 0) pens[Math.min(levels, lvl) - 1].dot(x, y);
  }
}
function fog(d, x0, x1, y0, y1, n, opacity) {
  const pen = d.pen(d.P.pen2, 1, opacity);
  for (let i = 0; i < n; i++) {
    const t = Math.pow(d.R(), 2.2), y = y1 - (y1 - y0) * t, a = x0 + d.R() * (x1 - x0), l = 80 + d.R() * 520;
    pen.line(seg(a, y, Math.min(x1, a + l), y, 1));
  }
}
function monolith(d, x, base, w, h, ink, N, broken = 0.3) {
  const top = (u) => base - h + (u < broken ? 0 : 14 + 22 * Math.abs(N(u * 3 + x, 1.7)));
  const outline = [[x - w / 2, base]];
  for (let u = 0; u <= 1.0001; u += 0.1) outline.push([x - w / 2 + u * w, top(u)]);
  outline.push([x + w / 2, base]);
  d.fill(d.P.bg).line(outline, true);
  const pen = d.pen(...ink);
  const inside = (px, py) => { const u = (px - (x - w / 2)) / w; return u >= 0 && u <= 1 && py >= top(u) && py <= base; };
  const shade = (px, py) => { const u = (px - (x - w / 2)) / w, f = (py - (base - h)) / h; return 0.35 + 0.55 * u - 0.45 * Math.pow(Math.max(0, f - 0.55) / 0.45, 1.4); };
  [[Math.PI / 2, 5, 0.12], [Math.PI / 2 + 0.5, 7, 0.4], [Math.PI / 2 - 0.9, 8, 0.62]].forEach(([a, sp, thr]) =>
    hatch(pen, (px, py) => inside(px, py) && shade(px, py) > thr, [x - w / 2, base - h, x + w / 2, base], a, sp, N, 1.6, 5));
  pen.line(outline.slice(1, -1));
}
function veil(d) {
  const { P, W, H } = d, id = d.id("n"), rgb = P.dark ? "1 1 1" : ".09 .1 .16";
  const [r, g, b] = rgb.split(" ");
  d.defs.push(`<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="1" seed="${d.seed % 997}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 3.2 0 0 0 -1.45"/></filter>`);
  d.raw(`<rect width="${W}" height="${H}" filter="url(#${id})" opacity="${P.dark ? 0.12 : 0.1}"/>`);
  if (P.dark) {
    const sid = d.id("s");
    d.defs.push(`<pattern id="${sid}" width="8" height="3" patternUnits="userSpaceOnUse"><rect width="8" height="1" fill="#000"/></pattern>`);
    d.raw(`<rect width="${W}" height="${H}" fill="url(#${sid})" opacity=".32"/>`);
  }
}
const inDisk = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const outDisk = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 > r * r;
const lw = (d, a, b) => (d.P.dark ? a : b);

// ---------- the home hero: the mark over an outrun horizon ----------
function hero(d) {
  const { W, H, P, R, N } = d, cx = 600, cy = 520, r = 300, hy = 820;
  lift(d, cx, cy, 760);
  const above = (x, y) => y < hy - 3;
  corona(d.pen(P.ink, 1, lw(d, 0.4, 0.5)), cx, cy, r + 30, 250, 640, N, 1.7, above);
  ticks(d.pen(P.ink, 1.1, lw(d, 0.55, 0.65)), cx, cy, r + 12, 200, 12);
  blades(d.pen(P.ink, 0.9, lw(d, 0.5, 0.55)), cx, cy, 60, r - 4, 150, 1.25, R, above);
  blades(d.pen(P.pen2, 0.8, 0.45), cx, cy, 110, r - 4, 90, -0.8, R, above);
  const rim = d.pen(P.ink, 1.3, lw(d, 0.85, 0.8), "", 10);
  for (let k = 0; k < 4; k++) clipLine(rim, circle(cx, cy, r + k * 2.4, (t) => 1.2 * N(Math.cos(t) * 2 + k, Math.sin(t) * 2)), above);
  // Horizontal cutouts across the lower sun, widening toward the horizon.
  const cut = d.fill(P.bg);
  for (let k = 0, y = cy + r * 0.18; y < hy; k++) {
    const t = 3 + k * 2.2, h = Math.min(hy, y + t), half = Math.sqrt(Math.max(0, (r + 14) ** 2 - (y - cy) ** 2));
    if (half > 0) cut.line([[cx - half - 2, y], [cx + half + 2, y], [cx + half + 2, h], [cx - half - 2, h]], true);
    y = h + 14 - k * 0.7;
  }
  // The grid below the horizon.
  const near = d.pen(P.ink, 1.1, lw(d, 0.55, 0.6)), far = d.pen(P.pen2, 0.9, 0.32);
  for (let i = -26; i <= 26; i++) {
    const xb = cx + i * 90, f = (t) => [cx + (xb - cx) * t, hy + (H - hy) * t];
    near.line([[xb, H], f(0.34)]);
    if (i % 2 === 0) far.line([f(0.34), f(0.1)]);
  }
  for (let k = 0, y = hy + 9; y < H; k++, y = hy + 9 * Math.pow(1.3, k)) (y - hy > 60 ? near : far).line([[0, y], [W, y]]);
  // The sun's reflection, broken on the grid.
  const refl = d.pen(P.warm, 1.6, lw(d, 0.55, 0.7));
  for (let y = hy + 6; y < hy + 280; y += 4 + (y - hy) * 0.035) {
    const half = 150 * (1 - (y - hy) / 300) * (0.55 + 0.45 * R()), off = 20 * N(y * 0.02, 4);
    if (R() < 0.8) refl.line(seg(cx + off - half, y, cx + off + half, y, 1));
  }
  const mono = [lw(d, P.rust, P.ink), 0.9, lw(d, 0.8, 0.72)];
  monolith(d, 170, hy, 44, 280, mono, N, 0.45);
  monolith(d, 1030, hy, 30, 180, mono, N, 0.6);
  monolith(d, 1090, hy, 18, 110, mono, N, 0.2);
  fog(d, 0, W, hy - 90, hy, 160, lw(d, 0.22, 0.2));
  d.pen(P.ink, 1.4, lw(d, 0.8, 0.85)).line([[0, hy], [W, hy]]);
  core(d, cx, cy, 170);
  flare(d, cx, cy, r + 2, -1.25, 0.72);
  veil(d);
}

// ---------- pillar headers ----------
function flywheel(d) {
  const { P, R, N } = d, cx = 600, cy = 450;
  lift(d, cx, cy, 620);
  const spiral = (pen, n, r0, r1, turn) => {
    for (let i = 0; i < n; i++) {
      const t0 = i / n * TAU + R() * 0.01, pts = [], k = Math.log(r1 / r0);
      for (let s = 0; s <= 1.0001; s += 1 / 40) { const r = r0 * Math.exp(k * s), t = t0 + turn * s; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
      pen.line(pts);
    }
  };
  spiral(d.pen(P.ink, 0.9, lw(d, 0.5, 0.55)), 120, 34, 380, 2.4);
  spiral(d.pen(P.pen2, 0.8, 0.4), 72, 60, 380, -1.5);
  const rim = d.pen(P.ink, 1.2, lw(d, 0.75, 0.75), "", 10);
  [392, 398, 404, 424, 428].forEach((r) => rim.line(circle(cx, cy, r)));
  ticks(d.pen(P.ink, 1, lw(d, 0.6, 0.65)), cx, cy, 434, 240, 14);
  // Notches on the rim, repeated behind themselves as a motion trail.
  for (let k = 0; k < 7; k++) {
    const pen = d.pen(k ? P.pen2 : P.ink, 1.2, (k ? 0.5 : 0.9) * Math.pow(0.72, k), "", 10);
    for (let i = 0; i < 12; i++) {
      const t = i / 12 * TAU - k * 0.028, a = 0.05;
      pen.line([...arc(cx, cy, 404, t - a, t + a, 6), ...arc(cx, cy, 424, t + a, t - a, 6)], true);
    }
  }
  core(d, cx, cy, 130);
  flare(d, cx, cy, 396, 0.25, 0.6);
  veil(d);
}

function research(d) {
  const { W, H, P, N } = d, cx = 420, cy = 450, R0 = 150;
  lift(d, cx, cy, 500);
  // Potential flow past a sphere, with a wake that wavers behind it.
  const pen = d.pen(P.ink, 1, lw(d, 0.55, 0.6)), pen2 = d.pen(P.pen2, 0.9, 0.5);
  for (let y0 = 14, i = 0; y0 < H; y0 += 10.5, i++) {
    if (Math.abs(y0 - cy) < 4) continue;
    let x = -10, y = y0; const pts = [];
    for (let s = 0; s < 900 && x < W + 10; s++) {
      const X = x - cx, Y = y - cy, r2 = X * X + Y * Y, R2 = R0 * R0;
      const u = 1 - R2 * (X * X - Y * Y) / (r2 * r2), v = -2 * R2 * X * Y / (r2 * r2), m = Math.hypot(u, v) || 1;
      x += 4 * u / m; y += 4 * v / m;
      const wx = Math.max(0, x - cx) / (R0 * 3), A = 34 * Math.min(1, wx) * Math.exp(-(((y - cy) / (R0 * 1.25)) ** 2));
      pts.push([x, y + A * Math.sin((x - cx) * 0.03 - 1.2) + 6 * A / 34 * N(x * 0.01, y * 0.01)]);
    }
    (i % 3 ? pen2 : pen).line(pts);
  }
  d.fill(P.bg).line(circle(cx, cy, R0 + 3), true);
  halftone(d, cx, cy, R0, 7.5, 6, [-0.45, -0.55, 0.7]);
  const frame = d.pen(P.pen2, 1, 0.7);
  frame.line([[24, 24], [W - 24, 24], [W - 24, H - 24], [24, H - 24]], true);
  for (let x = 74; x < W - 30; x += 50) { frame.line([[x, 24], [x, x % 250 === 24 ? 38 : 31]]); frame.line([[x, H - 24], [x, H - 31]]); }
  for (let y = 74; y < H - 30; y += 50) { frame.line([[24, y], [31, y]]); frame.line([[W - 24, y], [W - 31, y]]); }
  core(d, cx - 36, cy - 44, 70, 0.8);
  flare(d, cx, cy, R0 + 6, -2.4, 0.6);
  veil(d);
}

function whoKnewFirst(d) {
  const { P, R, N } = d, sx = 210, sy = 460;
  lift(d, sx, sy, 560);
  const obs = [];
  for (let i = 0; i < 9; i++) obs.push([420 + R() * 720, 120 + R() * 640]);
  const dist = obs.map(([x, y]) => Math.hypot(x - sx, y - sy));
  const waves = d.pen(P.ink, 0.9, lw(d, 0.5, 0.55), "", 2), faint = d.pen(P.pen2, 0.8, 0.45, "", 2);
  for (let k = 0; k < 64; k++) {
    const r = 140 + k * 16, a = 1.3, keep = Math.max(0.12, 1 - k * 0.016);
    for (let t = -a; t < a; t += 0.05) if (R() < keep) (k % 3 ? faint : waves).line(arc(sx, sy, r, t, t + 0.05 * (0.4 + 0.6 * keep), 6));
  }
  const hit = d.pen(P.ink, 2.4, 0.95, "", 10), ob = d.pen(P.ink, 1.4, 0.9, "", 10);
  obs.forEach(([x, y], i) => {
    const t = Math.atan2(y - sy, x - sx);
    hit.line(arc(sx, sy, dist[i], t - 0.035, t + 0.035, 8));
    ob.line(circle(x, y, 8, null, 20));
    ob.line(circle(x, y, 2.5, null, 8));
    ob.line(seg(x, y + 12, x, y + 30, 1));
  });
  blades(d.pen(P.ink, 0.9, lw(d, 0.55, 0.6)), sx, sy, 30, 120, 90, 1.1, R);
  corona(d.pen(P.pen2, 0.8, 0.5), sx, sy, 126, 60, 200, N, 1.6);
  core(d, sx, sy, 110);
  flare(d, sx, sy, 124, -0.6, 0.55);
  veil(d);
}

function studio(d) {
  const { W, H, P, R, N } = d, cx = 600, cy = 420, R0 = 250;
  const ring = [];
  for (let i = 0; i < 88; i++) {
    const ph = R() * TAU, s = 0.4 + R() * 0.6, pts = [];
    for (let j = 0; j <= 80; j++) {
      const t = (j % 80) / 80 * TAU, r = R0 + 26 * s * Math.sin(3 * t + ph) + 16 * N(Math.cos(t) * 1.3 + i * 0.04, Math.sin(t) * 1.3);
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
    ring.push(pts);
  }
  const pen = new Pen(`fill="none" stroke="currentColor" stroke-width="1.1" stroke-opacity="${lw(d, 0.55, 0.3)}"`, 1);
  ring.forEach((p) => pen.line(p));
  // Pixel-sorted streaks falling from the lower rim.
  const streak = new Pen(`fill="none" stroke="currentColor" stroke-width="1" stroke-opacity=".35" stroke-linecap="round"`, 1);
  for (let i = 0; i < 180; i++) {
    const t = 0.35 + R() * (Math.PI - 0.7), x = cx + (R0 + 10) * Math.cos(t), y = cy + (R0 + 10) * Math.sin(t);
    const l = 30 + 260 * Math.pow((N(x * 0.02, 5) + 1) / 2, 2.2) * R();
    streak.line([[x, y], [x, Math.min(H - 10, y + l)]]);
  }
  const chans = P.dark ? [["#ff2a55", -5, 0], ["#2aff9a", 0, 0], ["#3d6bff", 5, 2]] : [["#00a3cf", -5, 0], ["#d61f7c", 0, 0], ["#e3b000", 5, 2]];
  const all = d.id("a");
  d.defs.push(`<g id="${all}"><g id="${all}r">${pen.svg()}</g>${chans.map(([c, x, y]) => `<use href="#${all}r" color="${c}" x="${x}" y="${y}" style="mix-blend-mode:${P.blend}"/>`).join("")}<g color="${P.ink}">${streak.svg()}</g></g>`);
  // Glitch: horizontal slices of the whole ring shifted sideways.
  const bands = [[210, 232, 38], [300, 311, -64], [455, 492, 22], [560, 568, -120], [598, 640, 54]];
  const rest = d.id("c");
  let restRects = "", y = 0;
  for (const [a, b] of bands) { restRects += `<rect x="0" y="${y}" width="${W}" height="${a - y}"/>`; y = b; }
  restRects += `<rect x="0" y="${y}" width="${W}" height="${H - y}"/>`;
  d.defs.push(`<clipPath id="${rest}">${restRects}</clipPath>`);
  lift(d, cx, cy, 560);
  d.raw(`<g clip-path="url(#${rest})"><use href="#${all}"/></g>`);
  for (const [a, b, dx] of bands) {
    const cid = d.id("c");
    d.defs.push(`<clipPath id="${cid}"><rect x="0" y="${a}" width="${W}" height="${b - a}"/></clipPath>`);
    d.raw(`<g clip-path="url(#${cid})"><use href="#${all}" transform="translate(${dx} 0)"/></g>`);
  }
  core(d, cx, cy, 60, 0.6);
  veil(d);
}

function fonts(d) {
  const { W, H, P, N } = d, cx = 600, cy = 470, base = cy + 250, xh = cy - 250;
  const guide = d.pen(P.pen2, 1, 0.6), dash = d.pen(P.pen2, 1, 0.55, ` stroke-dasharray="6 7"`);
  [base, xh].forEach((y) => guide.line([[40, y], [W - 40, y]]));
  [base + 12, xh - 12].forEach((y) => dash.line([[40, y], [W - 40, y]]));
  dash.line([[40, xh - 150], [W - 40, xh - 150]]);
  [cx - 330, cx + 330].forEach((x) => dash.line([[x, 30], [x, H - 30]]));
  // The letter o, drawn as nested contours between its outer edge and its counter.
  const ell = (rx, ry, rot, ox = 0) => { const pts = []; for (let i = 0; i <= 120; i++) { const t = (i % 120) / 120 * TAU, x = rx * Math.cos(t), y = ry * Math.sin(t); pts.push([cx + ox + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); } return pts; };
  const o = d.pen(P.ink, 1, lw(d, 0.6, 0.65), "", 10);
  for (let k = 0; k <= 22; k++) { const s = k / 22; o.line(ell(262 - 112 * s, 262 - 70 * s, -0.33 * s, 14 * s)); }
  const edge = d.pen(P.ink, 1.8, 0.9, "", 10);
  edge.line(ell(262, 262, 0)); edge.line(ell(150, 192, -0.33, 14));
  // Construction: stress axis, anchors and handles.
  const con = d.pen(P.ink, 1, lw(d, 0.7, 0.75), "", 10);
  con.line([[cx - 300 * Math.cos(1.24), cy + 300 * Math.sin(1.24)], [cx + 300 * Math.cos(1.24), cy - 300 * Math.sin(1.24)]]);
  [[0, -262, 1, 0], [262, 0, 0, 1], [0, 262, 1, 0], [-262, 0, 0, 1]].forEach(([x, y, hx, hy]) => {
    const px = cx + x, py = cy + y, h = 145;
    con.line([[px - hx * h, py - hy * h], [px + hx * h, py + hy * h]]);
    con.line([[px - 6, py - 6], [px + 6, py - 6], [px + 6, py + 6], [px - 6, py + 6]], true);
    [[-1], [1]].forEach(([sg]) => con.line(circle(px + sg * hx * h, py + sg * hy * h, 4, null, 12)));
  });
  const reg = d.pen(P.pen2, 1, 0.7);
  [[110, 110], [W - 110, 110], [110, H - 110], [W - 110, H - 110]].forEach(([x, y]) => { reg.line([[x - 16, y], [x + 16, y]]); reg.line([[x, y - 16], [x, y + 16]]); reg.line(circle(x, y, 9, null, 18)); });
  const q = d.pen(P.ink, 1, 0.5);
  for (let i = 0; i < 90; i++) {
    const x = 60 + (i % 6) * 22 + (i % 2) * 6, y = 180 + Math.floor(i / 6) * 34, a = Math.round((N(x * 0.05, y * 0.05) + 1) * 4) * Math.PI / 8;
    if (y > H - 170) break;
    q.line([[x, y], [x + 14 * Math.cos(a), y + 14 * Math.sin(a)]]);
    q.line([[W - x, y], [W - x - 14 * Math.cos(a), y + 14 * Math.sin(a)]]);
  }
  core(d, cx + 14, cy, 120, 0.8);
  flare(d, cx + 14, cy, 180, -2.2, 0.55, 2.4, 2);
  veil(d);
}

function work(d) {
  const { W, H, P, R, N } = d;
  const seam = d.pen(P.ink, 1.3, lw(d, 0.7, 0.75));
  seam.line([[40, 40], [W - 40, 40], [W - 40, H - 40], [40, H - 40]], true);
  seam.line([[650, 40], [650, H - 40]]); seam.line([[650, 330], [W - 40, 330]]); seam.line([[650, 600], [W - 40, 600]]);
  const screws = d.pen(P.pen2, 1, 0.8, "", 10);
  [[62, 62], [W - 62, 62], [62, H - 62], [W - 62, H - 62], [628, 62], [628, H - 62]].forEach(([x, y]) => { screws.line(circle(x, y, 7, null, 16)); screws.line([[x - 5, y - 5], [x + 5, y + 5]]); });
  // The main dial: a knurled knob, its sweep and its graduations.
  const cx = 345, cy = 460, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const dial = d.pen(P.ink, 1.1, lw(d, 0.75, 0.8), "", 10);
  dial.line(arc(cx, cy, 250, a0, a1)); dial.line(arc(cx, cy, 214, a0, a1));
  ticks(d.pen(P.ink, 1.2, lw(d, 0.8, 0.85)), cx, cy, 222, 60, 26, a0, a1);
  const knurl = d.pen(P.ink, 1, lw(d, 0.6, 0.65));
  for (let i = 0; i < 120; i++) { const t = i / 120 * TAU; knurl.line([[cx + 118 * Math.cos(t), cy + 118 * Math.sin(t)], [cx + 134 * Math.cos(t), cy + 134 * Math.sin(t)]]); }
  [100, 136, 176].forEach((r) => dial.line(circle(cx, cy, r)));
  blades(d.pen(P.pen2, 0.8, 0.5), cx, cy, 30, 98, 70, 1.3, R);
  const needle = d.pen(P.warm, 2.4, 0.95, "", 10), na = a0 + (a1 - a0) * 0.68;
  needle.line([[cx + 140 * Math.cos(na), cy + 140 * Math.sin(na)], [cx + 244 * Math.cos(na), cy + 244 * Math.sin(na)]]);
  // Meters.
  const meter = d.pen(P.ink, 1, lw(d, 0.7, 0.75), "", 10);
  [745, 905, 1065].forEach((mx, i) => {
    meter.line(arc(mx, 280, 88, Math.PI * 1.22, Math.PI * 1.78));
    ticks(meter, mx, 280, 90, 20, 12, Math.PI * 1.22, Math.PI * 1.78);
    const t = Math.PI * (1.3 + 0.4 * R());
    meter.line([[mx, 280], [mx + 96 * Math.cos(t), 280 + 96 * Math.sin(t)]]);
    meter.line(circle(mx, 280, 5, null, 12));
    meter.line([[mx - 58, 300], [mx + 58, 300]]);
    if (i === 1) needle.line(circle(mx, 312, 3, null, 10));
  });
  // Faders.
  const fader = d.pen(P.ink, 1.1, lw(d, 0.7, 0.75));
  for (let i = 0; i < 9; i++) {
    const x = 700 + i * 50, top = 370, bot = 570, v = top + 20 + (bot - top - 40) * (N(i * 0.7, 2.2) + 1) / 2;
    fader.line([[x, top], [x, bot]]);
    for (let y = top; y <= bot; y += 20) fader.line([[x + 8, y], [x + (y % 100 === 70 ? 18 : 13), y]]);
    fader.line([[x - 12, v - 7], [x + 12, v - 7], [x + 12, v + 7], [x - 12, v + 7]], true);
  }
  // Speaker grille as a dot screen.
  const grille = d.dots(P.ink, 5, lw(d, 0.7, 0.75));
  for (let y = 640; y <= 820; y += 12) for (let x = 690 + ((y / 12) % 2) * 6; x <= 1120; x += 12) {
    const f = Math.hypot((x - 905) / 230, (y - 730) / 100);
    if (f < 1) grille.dot(x, y);
  }
  core(d, cx, cy, 90, 0.7);
  flare(d, cx, cy, 250, a0 + 0.2, 0.5, 2.2, 2);
  veil(d);
}

// ---------- essay and dossier covers (1600 x 800) ----------
function witness(d) {
  const { W, P, R } = d, cx = 800, cy = 350, x0 = 400, x1 = 1200;
  lift(d, cx, cy, 620);
  const lid = (t, up) => cy + (up ? -205 : 170) * Math.pow(Math.sin(Math.PI * t), up ? 0.9 : 1.1);
  const inEye = (x, y) => { const t = (x - x0) / (x1 - x0); return t > 0 && t < 1 && y > lid(t, true) && y < lid(t, false); };
  const lids = d.pen(P.ink, 1.1, lw(d, 0.75, 0.78)), lash = d.pen(P.ink, 0.9, lw(d, 0.4, 0.45));
  for (let k = 0; k < 22; k++) {
    const a = k * 0.016, up = [], lo = [];
    for (let t = a; t <= 1 - a + 1e-6; t += 0.02) {
      const s = Math.sin(Math.PI * t);
      up.push([x0 + t * (x1 - x0), lid(t, true) - k * 3.4 * s]);
      if (k < 7) lo.push([x0 + t * (x1 - x0), lid(t, false) + k * 3.6 * s]);
    }
    (k < 5 ? lids : lash).line(up); if (lo.length) (k < 3 ? lids : lash).line(lo);
  }
  blades(d.pen(P.ink, 0.9, lw(d, 0.6, 0.6)), cx, cy, 48, 158, 150, 1.2, R, inEye);
  const rings = d.pen(P.ink, 1.2, lw(d, 0.8, 0.8), "", 10);
  [158, 162, 166].forEach((r) => clipLine(rings, circle(cx, cy, r), inEye));
  const rule = d.pen(P.ink, 1, lw(d, 0.7, 0.75)), y = 690;
  rule.line([[120, y], [W - 120, y]]);
  for (let i = 0, x = 120; x <= W - 120; i++, x += 12) rule.line([[x, y], [x, y + (i % 10 === 0 ? 26 : i % 5 === 0 ? 16 : 8)]]);
  core(d, cx, cy, 96);
  flare(d, cx, cy, 162, -2.3, 0.6);
  veil(d);
}

function reach(d) {
  const { P, R, N } = d, sx = 190, sy = 400;
  lift(d, sx, sy, 520);
  const solid = d.pen(P.ink, 1, lw(d, 0.62, 0.66)), dots = [2.2, 3.2, 4.4].map((s) => d.dots(P.ink, s, lw(d, 0.85, 0.82)));
  for (let i = 0; i < 120; i++) {
    const a = -0.5 + 1.0 * i / 119 + 0.004 * N(i, 2), d0 = 150 + 220 * (N(i * 0.15, 7) + 1) / 2, lam = 300 + 200 * R();
    const ca = Math.cos(a), sa = Math.sin(a);
    solid.line(seg(sx + 70 * ca, sy + 70 * sa, sx + d0 * ca, sy + d0 * sa, 1));
    for (let r = d0 + 8; r < 1500; r += 8) {
      const p = Math.exp(-(r - d0) / lam);
      if (R() < p) dots[p > 0.6 ? 2 : p > 0.25 ? 1 : 0].dot(sx + r * ca, sy + r * sa);
    }
  }
  d.pen(P.ink, 2, lw(d, 0.8, 0.8), ` stroke-dasharray="4 10"`).line([[1150, 60], [1150, 740]]);
  blades(d.pen(P.ink, 0.9, lw(d, 0.55, 0.6)), sx, sy, 24, 66, 70, 1.3, R);
  core(d, sx, sy, 100);
  flare(d, sx, sy, 68, -0.5, 0.9, 2.2, 2);
  veil(d);
}

function borrowedGround(d) {
  const { W, H, P, N } = d, hy = 560, ox = 1000, oy = 470;
  lift(d, ox, oy, 700);
  core(d, ox, oy, 260, 1.2);
  const halo = d.pen(P.ink, 1, lw(d, 0.45, 0.5), "", 10), above = (x, y) => y < hy;
  for (let k = 0; k < 16; k++) clipLine(halo, circle(ox, oy, 180 + k * 12, (t) => 3 * N(Math.cos(t) * 2 + k * 0.2, Math.sin(t) * 2)), above);
  const ground = d.pen(P.ink, 1, lw(d, 0.5, 0.55));
  for (let k = 0, y = hy + 4; y < H + 20; k++, y = hy + 4 * Math.pow(1.2, k)) {
    const pts = []; for (let x = 0; x <= W; x += 16) pts.push([x, y + (y - hy) * 0.08 * N(x * 0.004, k * 0.2)]);
    ground.line(pts);
  }
  const mono = [lw(d, P.rust, P.ink), 0.9, lw(d, 0.85, 0.75)];
  monolith(d, 380, hy, 92, 400, mono, N, 0.5);
  monolith(d, 560, hy, 46, 240, mono, N, 0.25);
  monolith(d, 1190, hy, 66, 310, mono, N, 0.7);
  fog(d, 0, W, hy - 120, hy, 220, lw(d, 0.2, 0.18));
  d.pen(P.ink, 1.4, 0.85).line([[0, hy], [W, hy]]);
  flare(d, ox, oy, 180, -2.0, 0.55);
  veil(d);
}

function machines(d) {
  const { P, R } = d, cols = 11, rows = 5, x0 = 110, y0 = 90, cw = 126, ch = 124, hot = [7, 2];
  const pen = d.pen(P.ink, 1, lw(d, 0.65, 0.7)), pen2 = d.pen(P.pen2, 0.9, 0.55);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const cx = x0 + i * cw + cw / 2, cy = y0 + j * ch + ch / 2;
    if (i === hot[0] && j === hot[1]) continue;
    const dis = Math.round(R() * 4) / 4 * 9, skip = R() * 0.3;
    for (let k = 1; k <= 8; k++) {
      if (R() < skip) continue;
      const s = k * 6.6, q = () => (R() - 0.5) * dis;
      (k % 3 ? pen : pen2).line([[cx - s + q(), cy - s + q()], [cx + s + q(), cy - s + q()], [cx + s + q(), cy + s + q()], [cx - s + q(), cy + s + q()]], true);
    }
  }
  const hx = x0 + hot[0] * cw + cw / 2, hy = y0 + hot[1] * ch + ch / 2;
  lift(d, hx, hy, 400);
  const ring = d.pen(P.ink, 1.2, lw(d, 0.85, 0.85), "", 10);
  [30, 38, 46, 54].forEach((r) => ring.line(circle(hx, hy, r)));
  ticks(d.pen(P.ink, 1, 0.8), hx, hy, 56, 60, 10);
  core(d, hx, hy, 60, 1.2);
  flare(d, hx, hy, 46, -0.9, 0.9, 2, 1.8);
  veil(d);
}

function incident(d) {
  const { W, P, N } = d, cx = 800, cy = 400, r = 290;
  lift(d, cx, cy, 620);
  const tears = [[180, 214, 70], [300, 318, -150], [430, 470, 46], [560, 574, -90]];
  const shift = (y) => { for (const [a, b, dx] of tears) if (y >= a && y < b) return dx; return 0; };
  const lines = d.pen(P.ink, 1.3, lw(d, 0.7, 0.72)), torn = d.pen(P.ink, 1.3, lw(d, 0.8, 0.8));
  const split = [0, 4].map((k) => d.pen(P.flare[k], 1.3, 0.7, ` style="mix-blend-mode:${P.blend}"`));
  for (let y = cy - r + 3; y < cy + r; y += 6) {
    const half = Math.sqrt(r * r - (y - cy) ** 2), dx = shift(y), wob = 3 * N(y * 0.05, 1);
    const pts = seg(cx - half + dx + wob, y, cx + half + dx + wob, y, 1);
    (dx ? torn : lines).line(pts);
    if (dx) { split[0].line(pts.map(([x, yy]) => [x - 7, yy])); split[1].line(pts.map(([x, yy]) => [x + 7, yy + 1])); }
  }
  const box = d.pen(P.pen2, 1.2, 0.8, ` stroke-dasharray="10 8"`);
  for (const [a, b] of [[60, 180], [214, 300], [318, 430], [470, 560], [574, 740]]) { box.line([[390, a], [390, b]]); box.line([[1210, a], [1210, b]]); }
  for (const [a, b, dx] of tears) { box.line([[390 + dx, a], [390 + dx, b]]); box.line([[1210 + dx, a], [1210 + dx, b]]); }
  box.line([[390, 60], [1210, 60]]); box.line([[390, 740], [1210, 740]]);
  core(d, cx, cy, 120, 0.9);
  veil(d);
}

function growth(d) {
  const { P, N } = d, cx = 820, cy = 372;
  lift(d, cx, cy, 560);
  const rays = d.pen(P.pen2, 0.8, 0.3);
  for (let i = 0; i < 90; i++) { const t = i / 90 * TAU + 0.02 * N(i, 3); rays.line(seg(cx + 24 * Math.cos(t), cy + 24 * Math.sin(t), cx + 300 * Math.cos(t), cy + 300 * Math.sin(t), 1)); }
  const ring = d.pen(P.ink, 1, lw(d, 0.65, 0.7), "", 2), hard = d.pen(P.ink, 1.2, lw(d, 0.85, 0.85), "", 2), radii = [];
  let r = 12;
  // The dent sits on the upper right and heals over later rings.
  const dent = (t) => Math.exp(-(((((t - 5.5) % TAU) + TAU + Math.PI) % TAU - Math.PI) ** 2) / 0.09);
  for (let k = 0; k < 40; k++) {
    const tight = k >= 15 && k <= 21;
    r += tight ? 2.4 : 4 + 8 * (N(k * 0.37, 0.5) + 1) / 2 * (k < 15 ? 1.2 : 0.85);
    radii.push(r);
    const scar = k < 15 ? 0 : k <= 21 ? 1 : Math.exp(-(k - 21) / 5);
    (tight ? hard : ring).line(circle(cx, cy, r, (t) => (2 + r * 0.02) * N(Math.cos(t) * 1.5 + k * 0.08, Math.sin(t) * 1.5) - 22 * scar * dent(t), Math.round(r * 0.7)));
  }
  const bark = d.pen(P.ink, 1.4, lw(d, 0.75, 0.8), "", 2);
  for (let k = 0; k < 4; k++) bark.line(circle(cx, cy, r + 8 + k * 5, (t) => 6 * N(Math.cos(t) * 4 + k, Math.sin(t) * 4) - 18 * dent(t) * Math.exp(-k), 260));
  const a = radii[8], b = radii[30], y = cy + r + 44, dim = d.pen(P.ink, 1.3, 0.9);
  dim.line([[cx - b, y], [cx - a, y]]);
  [cx - a, cx - b].forEach((x) => { dim.line([[x, y - 10], [x, y + 10]]); dim.line([[x, cy + 8], [x, y - 14]]); });
  dim.line([[cx - b + 12, y - 6], [cx - b, y], [cx - b + 12, y + 6]]);
  dim.line([[cx - a - 12, y - 6], [cx - a, y], [cx - a - 12, y + 6]]);
  core(d, cx, cy, 64);
  flare(d, cx, cy, radii[30], -2.3, 0.45, 2.2, 2);
  veil(d);
}

function atmosphere(d) {
  const { P, N } = d, n = 64;
  lift(d, 800, 240, 700);
  core(d, 800, 250, 240, 1.1);
  const pens = [d.pen(P.pen2, 0.9, 0.35), d.pen(P.pen2, 1, 0.55), d.pen(P.ink, 1, lw(d, 0.6, 0.62)), d.pen(P.ink, 1.1, lw(d, 0.8, 0.8))];
  ridges(n, 70, 1530, 4, (i) => 240 + i * 8.4, (i, x) => {
    const c = 800 + 260 * N(i * 0.05, 3.3), e = Math.exp(-(((x - c) / 460) ** 2)), depth = 0.45 + i / n;
    return depth * (e * (64 * Math.abs(N(x * 0.011, i * 0.11)) + 28 * Math.sin(x * 0.07 + i * 0.5) ** 2) + 10 * (N(x * 0.02, i * 0.3) + 1));
  }, (i) => pens[Math.min(3, Math.floor(i / n * 4))]);
  flare(d, 800, 250, 150, -2.6, 0.6, 2.4, 2);
  veil(d);
}

function propose(d) {
  const { W, P, R, N } = d, cx = 800, cy = 400;
  lift(d, cx, cy, 600);
  const scrib = d.pen(P.ink, 0.9, lw(d, 0.4, 0.45)), scrib2 = d.pen(P.pen2, 0.8, 0.4);
  for (let i = 0; i < 170; i++) {
    const x0 = 20 + R() * 380, y0 = 30 + R() * 740, amp = 40 + R() * 140, pts = [];
    for (let t = 0; t <= 1.0001; t += 1 / 60) {
      const x = x0 + (cx - x0) * t, y = y0 + (cy - y0) * t, w = amp * (1 - t) * Math.pow(t, 0.3) * N(i * 0.4 + t * 3, t * 2.5);
      const L = Math.hypot(cx - x0, cy - y0);
      pts.push([x - (cy - y0) / L * w, y + (cx - x0) / L * w]);
    }
    (i % 3 ? scrib2 : scrib).line(pts);
  }
  const ap = d.pen(P.ink, 1.6, 0.9, "", 10);
  [34, 40].forEach((r) => ap.line(circle(cx, cy, r)));
  const ray = d.pen(P.ink, 1.6, lw(d, 0.85, 0.85));
  for (let i = 0; i < 11; i++) { const a = -0.34 + 0.68 * i / 10; ray.line([[cx + 44 * Math.cos(a), cy + 44 * Math.sin(a)], [cx + 900 * Math.cos(a), cy + 900 * Math.sin(a)]]); }
  core(d, cx, cy, 90);
  flare(d, cx, cy, 40, -1.1, 1.1, 2, 1.8);
  veil(d);
}

function receipt(d) {
  const { P } = d, cx = 800, cy = 400, r = 310, sx0 = 690, sx1 = 910;
  lift(d, cx, cy, 620);
  const L = [-0.5, -0.55, 0.67];
  halftone(d, cx, cy, r, 11, 6, L, (x) => x < sx0 - 4 || x > sx1 + 4);
  // Inside the strip the same orb is printed as scanlines whose weight carries the tone.
  const scans = [0.8, 1.6, 2.6, 3.6].map((w) => d.pen(P.ink, w, lw(d, 0.85, 0.8), "", 2));
  for (let y = cy - r + 3; y < cy + r; y += 5) {
    let run = [], lv = -1;
    const flush = () => { if (run.length > 1 && lv >= 0) scans[lv].line(run); run = []; };
    for (let x = sx0 + 10; x <= sx1 - 10; x += 4) {
      const dx = (x - cx) / r, dy = (y - cy) / r, q = dx * dx + dy * dy;
      const lum = q < 1 ? Math.max(0, dx * L[0] + dy * L[1] + Math.sqrt(1 - q) * L[2]) : -1;
      const v = lum < 0 ? 0 : P.dark ? lum : 1 - lum * 0.92, l = v < 0.08 ? -1 : Math.min(3, Math.floor(v * 4));
      if (l !== lv) { const last = run[run.length - 1]; flush(); if (last && l >= 0) run.push(last); lv = l; }
      if (l >= 0) run.push([x, y]);
    }
    flush();
  }
  const edge = d.pen(P.ink, 1.3, 0.85), zig = (y, dir) => { const pts = []; for (let x = sx0, k = 0; x <= sx1 + 0.1; x += 10, k++) pts.push([x, y + (k % 2 ? 8 * dir : 0)]); return pts; };
  edge.line(zig(40, 1)); edge.line(zig(760, -1));
  edge.line([[sx0, 40], [sx0, 760]]); edge.line([[sx1, 40], [sx1, 760]]);
  const perf = d.dots(P.pen2, 3, 0.8);
  for (let y = 60; y < 750; y += 14) { perf.dot(sx0 + 5, y); perf.dot(sx1 - 5, y); }
  core(d, cx - 150, cy - 150, 70, 0.6);
  veil(d);
}

function strata(d, talk) {
  const { W, H, P, N } = d, kx = 800, ky = 360;
  const inKey = (x, y) => (x - kx) ** 2 + (y - ky) ** 2 < 82 * 82 || (y > ky && y < ky + 230 && Math.abs(x - kx) < 42 + (y - ky) * 0.2);
  lift(d, kx, ky, 600);
  core(d, kx, ky + 30, 230, 0.8);
  const bound = (k, x) => 40 + k * 34 + 60 * fbm(N, x * 0.0015, k * 0.11) + 0.1 * (x - 800) * Math.sin(k * 0.21) + (talk ? 9 * Math.sin(x * 0.05 + k) * Math.exp(-(((x - 800) / 500) ** 2)) : 0);
  const b = d.pen(P.ink, 1.1, lw(d, 0.7, 0.72)), hp = d.pen(P.ink, 0.9, lw(d, 0.45, 0.5)), hp2 = d.pen(P.pen2, 0.8, 0.5);
  for (let k = 0; k < 24; k++) {
    const pts = []; for (let x = 0; x <= W; x += 8) pts.push([x, bound(k, x)]);
    clipLine(b, pts, (x, y) => !inKey(x, y));
    const box = [0, Math.max(0, bound(k, 800) - 140), W, Math.min(H, bound(k + 1, 800) + 140)];
    const inside = (x, y) => y > bound(k, x) + 2 && y < bound(k + 1, x) - 2 && !inKey(x, y);
    if (talk) {
      if (k % 2) for (let x = 6; x < W; x += 7) { const y0 = bound(k, x) + 3, y1 = bound(k + 1, x) - 3, m = (y0 + y1) / 2, h = (y1 - y0) / 2 * (0.3 + 0.7 * Math.abs(N(x * 0.03, k))); if (h > 1) clipLine(hp, seg(x, m - h, x, m + h, 2), (xx, yy) => !inKey(xx, yy)); }
    } else if (k % 3 !== 2) hatch(k % 2 ? hp : hp2, inside, box, [0.35, -0.6, 1.1, 0.05][k % 4], 5 + (k % 5) * 2, N, 1.2, 6);
  }
  const key = d.pen(P.ink, 1.5, 0.9, "", 10), kp = [];
  const a = Math.asin(42 / 82);
  for (const [o] of [[0], [5], [10]]) {
    kp.length = 0;
    kp.push(...arc(kx, ky, 82 + o, Math.PI / 2 + a, Math.PI * 2.5 - a, 60));
    kp.push([kx + 42 + o + 46, ky + 230 + o], [kx - 42 - o - 46, ky + 230 + o]);
    key.line(kp, true);
  }
  flare(d, kx, ky, 92, -2.4, 0.7, 2.2, 2);
  veil(d);
}

function sandbox(d) {
  const { P, N } = d, cx = 800, cy = 400, s = 210, yaw = 0.62, pitch = 0.42;
  lift(d, cx, cy, 620);
  corona(d.pen(P.ink, 0.9, lw(d, 0.45, 0.5)), cx, cy, 20, 640, 360, N, 1.4, null, 0.9);
  const V = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const x1 = x * Math.cos(yaw) - z * Math.sin(yaw), z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
    const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch), z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    V.push([cx + x1 * s, cy + y2 * s, z2]);
  }
  const E = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if ([1, 2, 4].includes(i ^ j)) E.push([i, j, (V[i][2] + V[j][2]) / 2]);
  E.sort((a, b) => b[2] - a[2]);
  const bar = (i, j, t0 = 0, t1 = 1) => {
    const [ax, ay] = V[i], [bx, by] = V[j], L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
    const p = (t, o) => [ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o];
    d.fill(P.bg).line([p(t0, -11), p(t1, -11), p(t1, 11), p(t0, 11)], true);
    const pen = d.pen(P.ink, 1.1, lw(d, 0.85, 0.85));
    for (const o of [-11, -4, 4, 11]) pen.line([p(t0, o), p(t1, o)]);
  };
  E.forEach(([i, j]) => bar(i, j));
  // The impossible part: at the crossing of the deepest two edges that overlap on the page,
  // the far edge is drawn over the near one, so the box closes through itself.
  const cross = (a, b) => {
    const [p, q] = [V[a[0]], V[a[1]]], [r, u] = [V[b[0]], V[b[1]]];
    const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [u[0] - r[0], u[1] - r[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-9) return null;
    const t = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / den, v = ((r[0] - p[0]) * d1[1] - (r[1] - p[1]) * d1[0]) / den;
    return t > 0.08 && t < 0.92 && v > 0.08 && v < 0.92 ? t : null;
  };
  outer: for (let a = 0; a < E.length; a++) for (let b = E.length - 1; b > a; b--) {
    if (E[a][0] === E[b][0] || E[a][0] === E[b][1] || E[a][1] === E[b][0] || E[a][1] === E[b][1]) continue;
    const t = cross(E[a], E[b]);
    if (t !== null) { bar(E[a][0], E[a][1], t - 0.09, t + 0.09); break outer; }
  }
  core(d, cx, cy, 120);
  flare(d, cx, cy, 70, -0.8, 0.9, 2.2, 2);
  veil(d);
}

function hearing(d) {
  const { P } = d, ax = 748, bx = 852, cy = 400, R0 = 330, inside = inDisk(800, cy, R0);
  lift(d, 800, cy, 620);
  const p1 = d.pen(P.ink, 1.1, lw(d, 0.62, 0.64), "", 2), p2 = d.pen(P.pen2, 1.1, lw(d, 0.75, 0.72), "", 2);
  for (let r = 8; r < 420; r += 7) { clipLine(p1, circle(ax, cy, r, null, Math.round(r * 0.5)), inside); clipLine(p2, circle(bx, cy, r + 2, null, Math.round(r * 0.5)), inside); }
  d.pen(P.ink, 1.4, 0.85, "", 10).line(circle(800, cy, R0 + 6));
  core(d, ax, cy, 90);
  core(d, bx, cy, 50, 0.5);
  flare(d, 800, cy, R0 + 6, -0.5, 0.6);
  veil(d);
}

function summary(d) {
  const { P, N } = d, n = 72, seam = 1060;
  lift(d, 780, 330, 620);
  core(d, 780, 300, 200, 1);
  const pens = [d.pen(P.pen2, 0.9, 0.45), d.pen(P.ink, 1, lw(d, 0.6, 0.62)), d.pen(P.ink, 1.6, lw(d, 0.9, 0.9))];
  ridges(n, 60, 1540, 4, (i) => 170 + i * 8.4, (i, x) => 250 * Math.exp(-(((x - 780) / 250) ** 2)) * Math.exp(-(((i - 42) / 15) ** 2)) + 10 * N(x * 0.02, i * 0.2) + 6,
    (i) => (i % 8 === 0 ? pens[2] : i < n / 2 ? pens[0] : pens[1]), (i) => (x) => x < seam || i % 8 === 0);
  d.pen(P.ink, 1, 0.7, ` stroke-dasharray="4 8"`).line([[seam, 40], [seam, 760]]);
  flare(d, 780, 300, 120, -2.3, 0.6, 2.2, 2);
  veil(d);
}

function label(d) {
  const { W, H, P } = d, cx = 620, cy = 390, s = 230;
  const warp = (x, y) => { const dx = x - cx, dy = y - cy, g = 0.95 * Math.exp(-(dx * dx + dy * dy) / (s * s)); return [x + dx * g, y + dy * g]; };
  const amp = (x, y) => 11 * (1 - 0.85 * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (s * s * 0.6)));
  const zig = (y) => { const pts = []; for (let x = -24, k = 0; x <= W + 24; x += 7, k++) { const ph = ((x + 24) % 28) / 28, z = ph < 0.5 ? ph * 2 : 2 - ph * 2; pts.push(warp(x, y + amp(x, y) * z)); } return pts; };
  const band = d.fill(P.ink, lw(d, 0.7, 0.86));
  for (let k = 0, y = -16; y < H + 16; k++, y += 18) if (k % 2 === 0) { const top = zig(y), bot = zig(y + 9).reverse(); band.line([...top, ...bot], true); }
  core(d, cx, cy, 120, 0.9);
  const lx = 1080, ly = 510, lwid = 360, lh = 160;
  d.fill(P.bg).line([[lx - 14, ly - 14], [lx + lwid + 14, ly - 14], [lx + lwid + 14, ly + lh + 14], [lx - 14, ly + lh + 14]], true);
  const card = d.pen(P.ink, 1.4, 0.9);
  card.line([[lx, ly], [lx + lwid, ly], [lx + lwid, ly + lh], [lx, ly + lh]], true);
  const text = d.pen(P.pen2, 5, 0.6);
  [[34, 0.6], [70, 0.9], [96, 0.8], [122, 0.5]].forEach(([y, f]) => text.line([[lx + 30, ly + y], [lx + 30 + (lwid - 60) * f, ly + y]]));
  flare(d, cx, cy, 150, -1.0, 0.7, 2.4, 2);
  veil(d);
}

function briefing(d) {
  const { W, H, P, R, N } = d, sx = 600, sy = 410;
  lift(d, sx, sy, 600);
  const rects = [[260, 120, 1000, 690], [200, 80, 1100, 730], [140, 40, 1200, 770]];
  const inR = (x, y, [a, b, c, e]) => x > a && x < c && y > b && y < e;
  const gap = (x, y) => x > 980 && y > 330 && y < 500;
  const flow = d.pen(P.ink, 1, lw(d, 0.55, 0.6)), esc = d.pen(P.ink, 1.6, lw(d, 0.95, 0.95));
  for (let i = 0; i < 220; i++) {
    const t0 = i / 220 * TAU; let x = sx + 40 * Math.cos(t0), y = sy + 40 * Math.sin(t0), out = false; const pts = [[x, y]], tail = [];
    for (let k = 0; k < 500; k++) {
      const a = Math.atan2(y - sy, x - sx) + 0.8 * N(x * 0.0025, y * 0.0025);
      x += 4 * Math.cos(a); y += 4 * Math.sin(a);
      if (!out && !inR(x, y, rects[0])) { if (gap(x, y)) out = true; else break; }
      (out ? tail : pts).push([x, y]);
      if (x < 0 || x > W || y < 0 || y > H) break;
    }
    flow.line(pts);
    if (tail.length > 1) esc.line([pts[pts.length - 1], ...tail]);
  }
  const box = d.pen(P.ink, 1.3, lw(d, 0.75, 0.8), ` stroke-dasharray="12 7"`);
  rects.forEach(([a, b, c, e]) => box.line([[c, 330], [c, b], [a, b], [a, e], [c, e], [c, 500]]));
  blades(d.pen(P.ink, 0.9, lw(d, 0.6, 0.6)), sx, sy, 16, 40, 50, 1.3, R);
  core(d, sx, sy, 90);
  flare(d, sx, sy, 44, -1.4, 1, 2, 1.8);
  veil(d);
}

function crystal(d) {
  const { P, R } = d, cx = 800, cy = 400, segs = [];
  lift(d, cx, cy, 620);
  const grow = (x, y, a, len, depth) => {
    const x2 = x + len * Math.cos(a), y2 = y + len * Math.sin(a);
    segs.push([x, y, x2, y2, depth]);
    if (depth > 2) return;
    const nb = depth === 0 ? 7 : depth === 1 ? 4 : 2;
    for (let i = 1; i <= nb; i++) {
      const t = i / (nb + 1) + (R() - 0.5) * 0.05, bl = len * (0.46 - 0.32 * t) * (0.7 + 0.5 * R());
      if (bl > 7) grow(x + (x2 - x) * t, y + (y2 - y) * t, a + Math.PI / 3, bl, depth + 1);
    }
  };
  grow(60, 0, 0, 330, 0);
  const frost = d.pen(P.pen2, 0.8, 0.4, ` stroke-dasharray="2 6"`, 2);
  for (let r = 150; r < 390; r += 18) frost.line(Array.from({ length: 7 }, (_, i) => [cx + r * Math.cos(i * Math.PI / 3), cy + r * Math.sin(i * Math.PI / 3)]));
  const pens = [d.pen(P.ink, 1.2, 0.85, "", 10), d.pen(P.ink, 1, lw(d, 0.7, 0.72), "", 10), d.pen(P.pen2, 0.9, 0.7, "", 10), d.pen(P.pen2, 0.8, 0.55, "", 10)];
  for (const sc of [1, 0.985, 0.97]) for (let k = 0; k < 6; k++) for (const m of [1, -1]) {
    const c = Math.cos(k * Math.PI / 3) * sc, s = Math.sin(k * Math.PI / 3) * sc, tf = (x, y) => [cx + x * c - m * y * s, cy + x * s + m * y * c];
    for (const [x0, y0, x1, y1, dp] of segs) {
      if (sc !== 1 && dp > 1) continue;
      const w = [3.5, 2, 1, 0][dp];
      if (w) { pens[dp].line([tf(x0, y0 + w), tf(x1, y1 + w)]); }
      else if (m === 1) pens[dp].line([tf(x0, y0), tf(x1, y1)]);
    }
  }
  const hex = d.pen(P.ink, 1.2, lw(d, 0.8, 0.8), "", 10);
  [48, 56, 64, 130, 136].forEach((r) => hex.line(Array.from({ length: 7 }, (_, i) => [cx + r * Math.cos(i * Math.PI / 3 + Math.PI / 6), cy + r * Math.sin(i * Math.PI / 3 + Math.PI / 6)])));
  core(d, cx, cy, 86);
  flare(d, cx, cy, 134, -0.9, 0.5, 2.2, 2);
  veil(d);
}

// ---------- the table: every asset, its page, its canvas ----------
// Articulate: ruled lines of prose bow around a clear core, and one flagged span lifts out of its line.
function articulate(d) {
  const { W, H, P, R } = d, cx = 1010, cy = 400, r0 = 128, hotLine = 9, h0 = 330, h1 = 560;
  lift(d, cx, cy, 640);
  const bend = (x, y) => {
    const dy = y - cy, g = Math.exp(-(((x - cx) / 300) ** 2)) * Math.exp(-((dy / 230) ** 2));
    return [x, y + (dy >= 0 ? 1 : -1) * 150 * g];
  };
  const clear = outDisk(cx, cy, r0 + 26);
  const ink = d.pen(P.ink, 2.4, lw(d, 0.72, 0.78)), soft = d.pen(P.pen2, 2, lw(d, 0.55, 0.6));
  const hot = d.pen(P.warm, 3, 0.95), tick = d.pen(P.warm, 1.6, 0.9);
  const trace = (a, b, y, lift = 0) => {
    const pts = [];
    for (let t = a; t < b; t += 6) pts.push(bend(t, y));
    pts.push(bend(b, y));
    return lift ? pts.map(([px, py]) => [px, py - lift]) : pts;
  };
  for (let y = 58, k = 0; y <= H - 50; y += 29, k++) {
    const end = W - 90 - (k % 6 === 5 ? 520 + R() * 300 : R() * 160);
    for (let x = 90 + (k % 6 === 0 ? 48 : 0); x < end;) {
      const x1 = Math.min(end, x + 16 + Math.floor(R() * 5) * 14 + R() * 10), pen = R() < 0.3 ? soft : ink;
      if (k !== hotLine) clipLine(pen, trace(x, x1, y), clear);
      else {
        if (x < h0 - 8) clipLine(pen, trace(x, Math.min(x1, h0 - 8), y), clear);
        if (x1 > h1 + 8) clipLine(pen, trace(Math.max(x, h1 + 8), x1, y), clear);
        if (x1 > h0 && x < h1) hot.line(trace(Math.max(x, h0), Math.min(x1, h1), y, 12));
      }
      x = x1 + 9 + R() * 6;
    }
    if (k === hotLine) for (const bx of [h0 - 8, h1 + 8]) { const [px, py] = bend(bx, y); tick.line([[px, py - 24], [px, py + 6]]); }
  }
  const ring = d.pen(P.ink, 1.3, lw(d, 0.85, 0.85), "", 10);
  [r0 - 30, r0 - 18].forEach((r) => ring.line(circle(cx, cy, r)));
  core(d, cx, cy, r0 - 20, 1.1);
  flare(d, cx, cy, r0 - 24, -2.4, 0.9, 2, 1.8);
  veil(d);
}

// Writing and publications: a fan of ruled sheets, the top one carrying the lit core.
function sheets(d) {
  const { P } = d, cx = 560, cy = 500, w = 470, h = 560;
  lift(d, cx, cy, 720);
  const frame = d.pen(P.ink, 1.7, lw(d, 0.92, 0.9)), edge = d.pen(P.pen2, 1, lw(d, 0.6, 0.65));
  for (let k = 8; k >= 0; k--) {
    const a = -0.2 + k * 0.05, ox = cx - 30 + k * 24, oy = cy + 8 - k * 13;
    const rot = (x, y) => [ox + x * Math.cos(a) - y * Math.sin(a), oy + x * Math.sin(a) + y * Math.cos(a)];
    const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => rot(x, y));
    d.fill(P.bg).line(corners, true);
    (k === 0 ? frame : edge).line(corners, true);
    if (k > 0) { const e = d.pen(P.pen2, 0.8, lw(d, 0.35, 0.4)); for (let y = -h / 2 + 40; y < -h / 2 + 40 + 21 * 3; y += 21) e.line([rot(w / 2 - 60, y), rot(w / 2 - 12, y)]); }
    if (k === 0) {
      const rule = d.pen(P.ink, 1.1, lw(d, 0.62, 0.66));
      for (let y = -h / 2 + 64, i = 0; y < h / 2 - 48; y += 21, i++) {
        const x1 = w / 2 - 44 - (i % 5 === 4 ? 150 : 0);
        (i === 9 ? d.pen(P.warm, 2.2, 0.95) : rule).line([rot(-w / 2 + 44, y), rot(x1, y)]);
      }
      const [px, py] = rot(40, -60);
      core(d, px, py, 110, 1.1);
      flare(d, px, py, 34, -1.2, 1, 2, 1.6);
    }
  }
  veil(d);
}

const PIECES = [
  { slug: "home-hero", page: "index.html", w: 1200, h: 1200, seed: 71021, draw: hero },
  { slug: "pillar-flywheel", page: "flywheel.html", w: 1200, h: 900, seed: 30117, draw: flywheel },
  { slug: "pillar-research", page: "research.html", w: 1200, h: 900, seed: 51109, draw: research },
  { slug: "pillar-who-knew-first", page: "who-knew-first.html", w: 1200, h: 900, seed: 90412, draw: whoKnewFirst },
  { slug: "pillar-studio", page: "studio.html", w: 1200, h: 900, seed: 66013, draw: studio },
  { slug: "pillar-fonts", page: "fonts.html", w: 1200, h: 900, seed: 24071, draw: fonts },
  { slug: "pillar-work", page: "hire.html", w: 1200, h: 900, seed: 81903, draw: work },
  { slug: "cover-a-witness-should-not-become-a-ruler", page: "a-witness-should-not-become-a-ruler.html", w: 1600, h: 800, seed: 11801, draw: witness },
  { slug: "cover-availability-is-not-reach", page: "availability-is-not-reach.html", w: 1600, h: 800, seed: 11802, draw: reach },
  { slug: "cover-borrowed-ground", page: "borrowed-ground.html", w: 1600, h: 800, seed: 11803, draw: borrowedGround },
  { slug: "cover-checking-the-machines", page: "checking-the-machines.html", w: 1600, h: 800, seed: 11804, draw: machines },
  { slug: "cover-frontier-safety-openai-hugging-face-incident", page: "frontier-safety-openai-hugging-face-incident.html", w: 1600, h: 800, seed: 11805, draw: incident },
  { slug: "cover-growth-needs-a-before", page: "growth-needs-a-before.html", w: 1600, h: 800, seed: 11806, draw: growth },
  { slug: "cover-ltj-bukem-the-man-behind-the-atmosphere", page: "ltj-bukem-the-man-behind-the-atmosphere.html", w: 1600, h: 800, seed: 11807, draw: atmosphere },
  { slug: "cover-models-propose-oracles-dispose", page: "models-propose-oracles-dispose.html", w: 1600, h: 800, seed: 11808, draw: propose },
  { slug: "cover-no-receipt-no-accept", page: "no-receipt-no-accept.html", w: 1600, h: 800, seed: 11809, draw: receipt },
  { slug: "cover-pick-the-lock-for-everyone", page: "pick-the-lock-for-everyone.html", w: 1600, h: 800, seed: 11810, draw: (d) => strata(d, false) },
  { slug: "cover-pick-the-lock-for-everyone-talk", page: "pick-the-lock-for-everyone-talk.html", w: 1600, h: 800, seed: 11811, draw: (d) => strata(d, true) },
  { slug: "cover-the-sandbox-was-never-just-a-box", page: "the-sandbox-was-never-just-a-box.html", w: 1600, h: 800, seed: 11812, draw: sandbox },
  { slug: "cover-the-second-hearing", page: "the-second-hearing.html", w: 1600, h: 800, seed: 11813, draw: hearing },
  { slug: "cover-the-summary-is-not-the-record", page: "the-summary-is-not-the-record.html", w: 1600, h: 800, seed: 11814, draw: summary },
  { slug: "cover-what-the-label-changes", page: "what-the-label-changes.html", w: 1600, h: 800, seed: 11815, draw: label },
  { slug: "cover-briefing-openai-hugging-face-incident", page: "briefings/2026-08-26-openai-hugging-face-incident/index.html", w: 1600, h: 800, seed: 11816, draw: briefing },
  { slug: "cover-dossier", page: "dossier.html", w: 1600, h: 800, seed: 11817, draw: crystal },
  { slug: "cover-articulate", page: "articulate.html", w: 1600, h: 800, seed: 11818, draw: articulate },
  { slug: "cover-frontier-safety", page: "frontier-safety.html", w: 1600, h: 800, seed: 11819, draw: briefing },
  { slug: "pillar-writing", page: "writing.html", w: 1200, h: 900, seed: 40213, draw: sheets },
];

function main() {
  const args = process.argv.slice(2), check = args.includes("--check");
  const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
  mkdirSync(OUT, { recursive: true });
  let bad = 0;
  for (const piece of PIECES) {
    if (only && !only.has(piece.slug)) continue;
    for (const P of [PAL.dark, PAL.light]) {
      const doc = new Doc(piece, P);
      piece.draw(doc);
      const svg = doc.render(), file = join(OUT, `${piece.slug}-${P.name}.svg`), bytes = Buffer.byteLength(svg);
      const over = bytes > BUDGET;
      if (check) {
        const same = existsSync(file) && readFileSync(file, "utf8") === svg;
        if (!same || over) { bad++; console.error(`${!same ? "stale" : "over budget"}: ${file} (${bytes} bytes)`); }
      } else {
        writeFileSync(file, svg);
        if (over) { bad++; console.error(`over budget: ${file} (${bytes} bytes)`); }
        console.log(`${(bytes / 1024).toFixed(1).padStart(6)} KB  ${piece.slug}-${P.name}.svg`);
      }
    }
  }
  if (bad) process.exit(1);
}

main();
