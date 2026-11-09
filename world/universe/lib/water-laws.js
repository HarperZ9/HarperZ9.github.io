// water-laws.js: the water region's rules drawn in force. Each function draws one law from world.json onto a 2D
// context at a grammar state g (lib/stop.mjs), so the rule is seen working rather than stated. Pure drawing: no
// page state, no timers. Sizes are in backing pixels; pass the device ratio as px.
//
//   diffusionRings(x, g, { w, h, cx, cy, ink, px })        law-diffusion: rings at r ~ sqrt(t), one per beat
//   courses(w, h) / coursesRank(courses) / drawCourses(...) rule-andamento-follows-form: tiles turn course by course
//   coffeeDrop(x, g, { w, h, pigment, px })                law-coffee-ring: a drop dries, its pigment goes to the rim
//   coffeeProfile(x, g, { ..., ink })                      the same law as a profile, centre to rim
//   stones(x, g, { w, h, stones, ink, px })                a bridge's places as stepping stones, lit as the walk crosses
//   weberSteps(x, g, { w, h, ink, px })                     law-weber-fechner: each added layer reads as a smaller step
import { coffeeRing, diffusionRadius } from "./world.mjs";

const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const STEPS = 6;
const reached = (g) => Math.round(g.approach * STEPS);

export function diffusionRings(x, g, { w, h, cx, cy, ink, px = 1 }) {
  x.clearRect(0, 0, w, h); const n = reached(g), R = Math.min(w, h) * 0.34 / diffusionRadius(STEPS);
  x.strokeStyle = ink; x.lineWidth = px;
  for (let t = 1; t <= n; t++) { x.globalAlpha = 0.25 + 0.5 * (t / STEPS); x.beginPath(); x.arc(cx, cy, R * diffusionRadius(t), 0, Math.PI * 2); x.stroke(); }
  x.globalAlpha = 1;
}

// Courses: gently bending lines across the picture, the way tesserae are laid along a form's contour. Course k
// sits at height (k + 0.5) / n, displaced by two slow waves.
export function courses(n = 9) {
  return { n, y: (k, u) => (k + 0.5) / n + 0.035 * Math.sin(u * Math.PI * 2 * 1.3 + k * 0.6) + 0.012 * Math.sin(u * Math.PI * 2 * 3.1 + k) };
}
// Tiles turn course by course from the road's side (bottom course first), and along each course left to right.
export function coursesRank(c) {
  return (i, j, cols, rows) => {
    const u = (i + 0.5) / cols, v = (j + 0.5) / rows; let k = 0, best = 9;
    for (let q = 0; q < c.n; q++) { const d = Math.abs(c.y(q, u) - v); if (d < best) { best = d; k = q; } }
    return Math.min(1, ((c.n - 1 - k) + u * 0.9) / c.n);
  };
}
export function drawCourses(x, g, c, { w, h, ink, px = 1 }) {
  x.clearRect(0, 0, w, h); if (g.settled) return;
  x.strokeStyle = ink; x.lineWidth = px; const shown = Math.ceil(g.reveal * c.n * 1.25);
  for (let k = c.n - 1; k >= Math.max(0, c.n - shown); k--) {
    x.globalAlpha = 0.45; x.beginPath();
    for (let s = 0; s <= 48; s++) { const u = s / 48, X = u * w, Y = c.y(k, u) * h; s ? x.lineTo(X, Y) : x.moveTo(X, Y); }
    x.stroke();
  }
  x.globalAlpha = 1;
}

// A drop of pigment on paper, drying over the stop. Its edge is pinned and slightly irregular (paper fibre).
const dropCache = new Map();
export function coffeeDrop(x, g, { w, h, pigment, wall, px = 1, cells = 360 }) {
  const dry = g.approach, key = `${cells}:${dry.toFixed(3)}:${pigment}`;
  let o = dropCache.get(key);
  if (!o) {
    const W = cells, H = Math.round(cells * h / w), img = new ImageData(W, H), [r, gg, b] = hexRGB(pigment), R0 = Math.min(W, H) * 0.36;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const dx = i - W / 2, dy = j - H / 2, th = Math.atan2(dy, dx);
      const R = R0 * (1 + 0.05 * Math.sin(th * 3 + 0.4) + 0.025 * Math.sin(th * 7 + 1.3) + 0.012 * Math.sin(th * 17));
      const rho = Math.hypot(dx, dy) / R, fibre = 0.9 + 0.2 * (((i * 7919 + j * 104729) % 97) / 97);
      const d = Math.min(1, coffeeRing(rho, dry) * fibre), k = 4 * (j * W + i);
      img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = Math.round(255 * d);
    }
    o = new OffscreenCanvas(W, H); o.getContext("2d").putImageData(img, 0, 0);
    if (dropCache.size > 16) dropCache.clear(); dropCache.set(key, o);
  }
  x.clearRect(0, 0, w, h); if (wall) { x.fillStyle = wall; x.fillRect(0, 0, w, h); }
  x.imageSmoothingEnabled = true; x.drawImage(o, 0, 0, w, h);
}

export function coffeeProfile(x, g, { w, h, ink, px = 1 }) {
  x.clearRect(0, 0, w, h);
  const bx = w - 190 * px, by = h * 0.62, bw = 150 * px, bh = 56 * px;
  x.strokeStyle = ink; x.lineWidth = px; x.globalAlpha = 0.35; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + bw, by); x.stroke();
  x.globalAlpha = 0.9; x.beginPath();
  for (let s = 0; s <= 60; s++) { const rho = s / 60, v = coffeeRing(rho, g.approach), X = bx + rho * bw, Y = by - v * bh; s ? x.lineTo(X, Y) : x.moveTo(X, Y); }
  x.stroke(); x.globalAlpha = 1;
}

export function stones(x, g, { w, h, stones: list, ink, wall, px = 1 }) {
  x.clearRect(0, 0, w, h); if (wall) { x.fillStyle = wall; x.fillRect(0, 0, w, h); }
  const n = list.length, lit = Math.round(g.approach * n), y = 30 * px, x0 = w * 0.08, x1 = w * 0.6;
  x.strokeStyle = ink; x.lineWidth = px; x.globalAlpha = 0.3; x.beginPath(); x.moveTo(x0, y); x.lineTo(x1, y); x.stroke();
  list.forEach((st, k) => {
    const X = x0 + (k / Math.max(1, n - 1)) * (x1 - x0), on = k < lit;
    x.globalAlpha = on ? 0.95 : 0.3; x.fillStyle = st.tuned || st.colour;  // its stratum's colour: a bridge visibly crosses strata
    x.beginPath(); x.arc(X, y, (on ? 9 : 6) * px, 0, Math.PI * 2); x.fill();
  });
  x.globalAlpha = 1;
}

export function weberSteps(x, g, { w, h, ink, px = 1 }) {
  x.clearRect(0, 0, w, h); const n = reached(g), x0 = 16 * px, y = h - 12 * px, step = 26 * px;
  // layer k transmits 0.8^k: the perceived step is the ratio, so each added layer darkens the stack by less
  for (let k = 0; k < n; k++) { x.fillStyle = ink; x.globalAlpha = 0.85 * (1 - 0.8 ** (k + 1)); x.fillRect(x0 + k * step, y - 14 * px, step - 3 * px, 14 * px); }
  x.globalAlpha = 1;
}
