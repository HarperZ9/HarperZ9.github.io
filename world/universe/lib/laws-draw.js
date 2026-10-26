// laws-draw.js: the world's rules drawn in force, for every district past water (water's own are water-laws.js).
// Each entry draws one law, or one place's own behaviour, into a box on a 2D context at a grammar state g
// (lib/stop.mjs). A stop with no picture draws its law across the whole motion sheet; a stop with a picture draws it
// small on its annotation sheet. Drawing only: no page state, no timers. Second half: laws-draw2.js.
//
//   LAWS[name](x, g, box, s)   box { x, y, w, h } in backing px; s { ink, accent, wall, px, data }
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const steps = (g, n = 6) => Math.round(g.approach * n);
export const FACE = { grotesk: '"Hanken Grotesk", system-ui, sans-serif', mono: 'Conso, ui-monospace, monospace' };

// law-snell: rays from the whole sky bend at the surface into a cone of about 97 degrees (n = 1.33)
function snell(x, g, b, s) {
  const sy = b.y + b.h * 0.42, cx = b.x + b.w / 2, eyeY = b.y + b.h * 0.92, n = steps(g, 12);
  x.strokeStyle = s.ink; x.lineWidth = 2 * s.px; x.globalAlpha = 0.9; x.beginPath(); x.moveTo(b.x, sy); x.lineTo(b.x + b.w, sy); x.stroke(); x.lineWidth = 1.4 * s.px;
  for (let i = 0; i <= n; i++) {
    const th = (-85 + (170 * i) / 12) * Math.PI / 180, tw = Math.asin(Math.sin(th) / 1.33);
    const px = cx - Math.tan(tw) * (eyeY - sy); x.globalAlpha = 0.8;
    x.beginPath(); x.moveTo(px - Math.sin(th) * b.h * 0.4, sy - Math.cos(th) * b.h * 0.4); x.lineTo(px, sy); x.lineTo(cx, eyeY); x.stroke();
  }
  const half = Math.asin(1 / 1.33), r = (eyeY - sy) * Math.tan(half);
  x.globalAlpha = g.approach; x.strokeStyle = s.accent; x.lineWidth = 2 * s.px; x.beginPath(); x.moveTo(cx - r, sy); x.lineTo(cx, eyeY); x.lineTo(cx + r, sy); x.stroke();
  x.globalAlpha = 1;
}

// law-thin-film: the reflected colour of a draining soap film (n = 1.33), thickness falling from top to bottom.
// Reflectance sin^2(2 pi n d / lambda) (a half-wave flip at the front face only, so a very thin film goes black) is summed over 31 wavelengths from
// 400 to 700 nm through the CIE 1931 observer (Wyman, Sloan and Shirley's 2013 multi-lobe fit) and converted to sRGB.
const g1 = (x, mu, s1, s2) => Math.exp(-0.5 * ((x - mu) / (x < mu ? s1 : s2)) ** 2);
const CMF = (l) => [1.056 * g1(l, 599.8, 37.9, 31) + 0.362 * g1(l, 442, 16, 26.7) - 0.065 * g1(l, 501.1, 20.4, 26.2),
  0.821 * g1(l, 568.8, 46.9, 40.5) + 0.286 * g1(l, 530.9, 16.3, 31.1), 1.217 * g1(l, 437, 11.8, 36) + 0.681 * g1(l, 459, 26, 13.8)];
const LAMBDAS = Array.from({ length: 31 }, (_, i) => 400 + i * 10), NORM = LAMBDAS.reduce((a, l) => a + CMF(l)[1], 0);
const enc = (v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
export function filmColour(d) {
  let X = 0, Y = 0, Z = 0;
  for (const l of LAMBDAS) { const R = Math.sin((2 * Math.PI * 1.33 * d) / l) ** 2, c = CMF(l); X += R * c[0]; Y += R * c[1]; Z += R * c[2]; }
  X /= NORM; Y /= NORM; Z /= NORM;
  return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z].map(enc);
}
function thinFilm(x, g, b, s) {
  const rows = 120, top = 900 * (1 - 0.55 * g.approach);
  for (let j = 0; j < rows; j++) { const d = top * (1 - j / rows) + 20; x.fillStyle = `rgb(${filmColour(d).join(",")})`; x.fillRect(b.x, b.y + (j * b.h) / rows, b.w, b.h / rows + 1); }
}

// law-beer-absorption: transmission per channel against depth, red lost first
function beer(x, g, b, s) {
  const k = [0.45, 0.12, 0.05], cols = ["#b5523a", "#4f7f58", "#3f6f99"], dmax = 2 + 8 * g.approach;
  k.forEach((kc, i) => {
    x.strokeStyle = cols[i]; x.lineWidth = 2 * s.px; x.beginPath();
    for (let q = 0; q <= 60; q++) { const d = (q / 60) * dmax, X = b.x + (q / 60) * b.w, Y = b.y + b.h * (1 - Math.exp(-kc * d)); q ? x.lineTo(X, Y) : x.moveTo(X, Y); }
    x.stroke();
  });
}

// sun glitter: a wave surface of small facets; a facet flashes where its tilt sends the sun to the eye
function glint(x, g, b, s) {
  x.fillStyle = s.ink;
  const t = g.approach * 6;
  for (let j = 0; j < 90; j++) for (let i = 0; i < 160; i++) {
    const u = i / 160, v = j / 90, slope = Math.sin(u * 37 + t) * 0.5 + Math.sin(v * 23 - t * 0.7 + u * 9) * 0.35 + Math.sin(u * 91 + v * 57 + t * 1.3) * 0.15;
    const want = 0.62 - v * 0.5, hit = Math.abs(slope - want) < 0.07 * (0.4 + v);
    if (!hit) continue; const r = (0.6 + 1.6 * v) * s.px;
    x.globalAlpha = 0.5 + 0.5 * v; x.fillRect(b.x + u * b.w - r, b.y + v * b.h - r * 0.4, 2 * r, 0.8 * r);
  }
  x.globalAlpha = 1;
}

// rule-two-type-families: one grotesk, one mono; hierarchy from weight and size alone
function twoFamilies(x, g, b, s) {
  const n = steps(g, 6), sizes = [0.3, 0.2, 0.13], weights = [800, 600, 400];
  x.fillStyle = s.ink; x.textBaseline = "alphabetic";
  for (let i = 0; i < Math.min(3, n); i++) { x.font = `${weights[i]} ${b.h * sizes[i]}px ${FACE.grotesk}`; x.fillText("Aa Qq", b.x, b.y + b.h * (0.32 + i * 0.22)); }
  for (let i = 3; i < n; i++) { x.font = `400 ${b.h * 0.08}px ${FACE.mono}`; x.fillText("0123456789", b.x + b.w * 0.5, b.y + b.h * (0.3 + (i - 3) * 0.13)); }
}

// rule-burin-tone-by-line: tone from line density and width, never a flat fill
function burin(x, g, b, s) {
  const cells = 6, n = steps(g, 6); x.strokeStyle = s.ink;
  for (let c = 0; c < n; c++) {
    const cx = b.x + (c * b.w) / cells, gap = Math.max(2, 14 - c * 2) * s.px; x.lineWidth = (0.6 + c * 0.45) * s.px;
    for (let y = b.y; y < b.y + b.h; y += gap) { x.beginPath(); x.moveTo(cx + 2, y); x.lineTo(cx + b.w / cells - 2, y + gap * 0.3); x.stroke(); }
  }
}

// rule-erosion-follows-stroke-width: the same glyph worn two ways. Left: an even wear (hairlines vanish first).
// Right: wear in proportion to the local stroke width (thin parts survive). The left is the control.
const erosionCache = new Map();
function erosion(x, g, b, s) {
  const W = 160, H = 120, key = `${g.approach.toFixed(3)}`;
  let pair = erosionCache.get(key);
  if (!pair) {
    const o = new OffscreenCanvas(W, H), c = o.getContext("2d", { willReadFrequently: true });
    c.fillStyle = "#000"; c.font = `400 ${H * 0.95}px Georgia, "Times New Roman", serif`; c.textBaseline = "alphabetic"; c.fillText("Ra", 6, H * 0.84);
    const m = c.getImageData(0, 0, W, H).data, inside = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) inside[k] = m[4 * k + 3] > 128 ? 1 : 0;
    const dist = new Float32Array(W * H).fill(1e9); for (let k = 0; k < W * H; k++) if (!inside[k]) dist[k] = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (i) dist[k] = Math.min(dist[k], dist[k - 1] + 1); if (j) dist[k] = Math.min(dist[k], dist[k - W] + 1); if (i && j) dist[k] = Math.min(dist[k], dist[k - W - 1] + 1.414); if (j && i < W - 1) dist[k] = Math.min(dist[k], dist[k - W + 1] + 1.414); }
    for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) { const k = j * W + i; if (i < W - 1) dist[k] = Math.min(dist[k], dist[k + 1] + 1); if (j < H - 1) dist[k] = Math.min(dist[k], dist[k + W] + 1); if (i < W - 1 && j < H - 1) dist[k] = Math.min(dist[k], dist[k + W + 1] + 1.414); if (j < H - 1 && i) dist[k] = Math.min(dist[k], dist[k + W - 1] + 1.414); }
    const local = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let mx = 0; for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) { const y = j + dj, xx = i + di; if (y >= 0 && xx >= 0 && y < H && xx < W) mx = Math.max(mx, dist[y * W + xx]); } local[j * W + i] = mx; }
    const make = (keep) => { const im = new ImageData(W, H); for (let k = 0; k < W * H; k++) if (inside[k] && keep(k)) im.data[4 * k + 3] = 255; const out = new OffscreenCanvas(W, H); out.getContext("2d").putImageData(im, 0, 0); return out; };
    const a = g.approach;
    pair = [make((k) => dist[k] > a * 3.2), make((k) => dist[k] > a * 0.55 * local[k])];
    if (erosionCache.size > 12) erosionCache.clear(); erosionCache.set(key, pair);
  }
  const ww = b.w / 2 - 6 * s.px, hh = (ww * H) / W, y0 = b.y + (b.h - hh) / 2;
  x.save(); x.fillStyle = s.ink;
  pair.forEach((o, i) => { const X = b.x + i * (ww + 12 * s.px); x.globalAlpha = i ? 1 : 0.55; x.drawImage(o, X, y0, ww, hh); x.globalCompositeOperation = "source-atop"; x.fillRect(X, y0, ww, hh); x.globalCompositeOperation = "source-over"; });
  x.restore();
}

// law-yield-stress: a knife drags paint; where its push passes the yield value the ridges flatten, elsewhere they hold
function yieldStress(x, g, b, s) {
  const ridges = 14, knife = g.approach;
  for (let r = 0; r < ridges; r++) {
    const y = b.y + b.h * (0.2 + (0.6 * r) / ridges); x.strokeStyle = s.ink; x.lineWidth = 2 * s.px; x.beginPath();
    for (let q = 0; q <= 80; q++) {
      const u = q / 80, push = u < knife ? 0.5 + 0.5 * Math.sin(r * 0.7 + u * 3) : 0, flat = push > 0.55;
      const amp = flat ? 0.5 : 3.5 + 1.5 * Math.sin(u * 40 + r); const Y = y + Math.sin(u * 60 + r * 2) * amp * s.px;
      q ? x.lineTo(b.x + u * b.w, Y) : x.moveTo(b.x + u * b.w, Y);
    }
    x.globalAlpha = 0.75; x.stroke();
  }
  x.globalAlpha = 1; x.strokeStyle = s.accent; x.lineWidth = 3 * s.px; x.beginPath(); x.moveTo(b.x + knife * b.w, b.y + b.h * 0.12); x.lineTo(b.x + knife * b.w, b.y + b.h * 0.88); x.stroke();
}

// rule-imperfection-alive: two screens of one picture's tone; the second slips out of register as the visitor nears
function halftone(x, g, b, s) {
  const cell = 9 * s.px, slip = g.approach * cell * 0.9;
  const tone = (u, v) => clamp(0.5 + 0.45 * Math.sin(u * 5.5) * Math.cos(v * 4.2) - 0.25 * (v - 0.5));
  [[15, 0, s.ink], [75, slip, s.accent]].forEach(([deg, off, col]) => {
    const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a); x.fillStyle = col; x.globalAlpha = 0.75;
    for (let gy = -b.h; gy < b.h * 2; gy += cell) for (let gx = -b.w; gx < b.w * 2; gx += cell) {
      const X = b.x + gx * ca - gy * sa + off, Y = b.y + gx * sa + gy * ca; if (X < b.x || Y < b.y || X > b.x + b.w || Y > b.y + b.h) continue;
      const r = (cell / 2) * Math.sqrt(tone((X - b.x) / b.w * 6, (Y - b.y) / b.h)); x.beginPath(); x.arc(X, Y, r, 0, 6.283); x.fill();
    }
  });
  x.globalAlpha = 1;
}

// rule-recombine-not-copy: a picture cut along its joints and re-laid in a new order; the joints stay visible
function recombine(x, g, b, s) {
  const img = s.data?.img; if (!img) return; const cols = 4, rows = 3, n = Math.round(g.approach * cols * rows), tw = b.w / cols, th = b.h / rows;
  const order = [5, 2, 9, 0, 11, 7, 3, 10, 1, 8, 4, 6];
  for (let k = 0; k < cols * rows; k++) {
    const src = k < n ? order[k] : k, si = src % cols, sj = (src / cols) | 0, di = k % cols, dj = (k / cols) | 0;
    x.drawImage(img, (si * img.width) / cols, (sj * img.height) / rows, img.width / cols, img.height / rows, b.x + di * tw + s.px, b.y + dj * th + s.px, tw - 2 * s.px, th - 2 * s.px);
  }
}

// rule-one-hot-mark: every mark equal until one turns hot
function oneHot(x, g, b, s) {
  const cols = 10, rows = 6, hot = g.settled ? 23 : -1;
  for (let k = 0; k < cols * rows; k++) {
    const i = k % cols, j = (k / cols) | 0, X = b.x + (i + 0.5) * (b.w / cols), Y = b.y + (j + 0.5) * (b.h / rows), r = Math.min(b.w / cols, b.h / rows) * 0.22;
    x.fillStyle = k === hot ? s.accent : s.ink; x.globalAlpha = k === hot ? 1 : 0.35 + 0.3 * g.approach; x.beginPath(); x.arc(X, Y, r, 0, 6.283); x.fill();
  }
  x.globalAlpha = 1;
}

import { LAWS2 } from "./laws-draw2.js";
export const LAWS = { "law-snell": snell, snell, "law-thin-film": thinFilm, "law-beer-absorption": beer, glint, "rule-two-type-families": twoFamilies,
  "rule-burin-tone-by-line": burin, "rule-erosion-follows-stroke-width": erosion, "law-yield-stress": yieldStress, "rule-imperfection-alive": halftone,
  "rule-recombine-not-copy": recombine, "rule-one-hot-mark": oneHot, ...LAWS2 };
