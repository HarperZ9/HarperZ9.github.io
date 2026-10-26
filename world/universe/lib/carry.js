// carry.js: moving between places is a transfer, never a cut (BLEED.md sections 10 and 13). The element on screen
// is a grid of ticks, each carrying a weight vector over two elements: the place it leaves and the next one. As the
// visitor walks, the weights shift tick by tick, as a front grown by a threshold automaton (lib/ticks.mjs), and
// each tick moves, changes form (FORMS) and recombines its colour (subtractive law) by its own weight. The page's
// flow medium is the transfer surface: its current bends every moving tick, the element pours current into it as
// it goes, and it leaves ink where it lands.
//
//   const c = carrier(canvas);
//   c.draw(t, { key, from, to, fromForm, toForm, flow, px, medium, clocks });   // t 0 lifting off .. 1 landed
//     from / to: { canvas, rect }   each element's picture (read once per key) and its live box on screen
//     flow(x, y) -> [vx, vy]        normalised current at a viewport point, or null
//     clocks: [fromClock, toClock]  the two elements' timing laws, combined as a weighted timing layer
//   c.stats() -> { mean, sd, n, t }  the weights' mean and spatial spread on the last frame (the front check)
// A weight depends only on t (flip times are computed once per transfer), so walking back carries the element back.
import { growFront, weightAt, spread, timing, recombine } from "./ticks.mjs";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, k) => a + (b - a) * k;

// What a tick looks like in each element's medium, in CSS px: size, aspect (long over short), corner roundness
// 0..1, and how much it turns to follow its path.
export const FORMS = Object.freeze({
  drop:   { size: 7.0, aspect: 1.0, round: 1, follow: 0 },
  tile:   { size: 10.0, aspect: 1.0, round: 0, follow: 0 },
  stroke: { size: 11.0, aspect: 5.0, round: 1, follow: 1 },
  grain:  { size: 4.0, aspect: 1.0, round: 1, follow: 0 },
  glyph:  { size: 10.0, aspect: 4.0, round: 0.6, follow: 0.25 },
});

// The element as a grid of ticks: each cell's colour and ink (dark, opaque pixels count as ink).
function cells(canvas, cols, rows) {
  const o = new OffscreenCanvas(cols, rows), x = o.getContext("2d", { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, cols, rows); const d = x.getImageData(0, 0, cols, rows).data;
  const col = [], ink = new Float32Array(cols * rows);
  for (let k = 0; k < cols * rows; k++) {
    const a = d[4 * k + 3] / 255, lum = (0.2126 * d[4 * k] + 0.7152 * d[4 * k + 1] + 0.0722 * d[4 * k + 2]) / 255;
    col.push([d[4 * k], d[4 * k + 1], d[4 * k + 2]]); ink[k] = clamp(a * (0.15 + 0.85 * (1 - lum)) * 1.6);
  }
  return { col, ink };
}

// A smooth, divergence-free wander (curl of two sines) so paths bend organically even where the water is still.
function curl(x, y, s) {
  const a = Math.cos(y * 0.006 + s) * Math.cos(x * 0.004 - s * 0.7), b = Math.sin(x * 0.005 + s * 1.3) * Math.sin(y * 0.007 - s);
  return [a, -b];
}

// One grid of ticks per transfer. The front (growFront, seeded on the edge nearest the next place, thick ink
// holding out) sets when each tick's weight shifts; position, form, colour and ink all follow that tick's weight.
export function carrier(canvas, { cols = 72, rows = 45, width = 0.3, span = 0.6 } = {}) {
  let key = null, T = null, landed = false, pourAt = 0, last = { mean: 0, sd: 0, n: 0, t: 0 };
  return {
    reset() { key = null; T = null; },
    stats() { return last; },
    draw(t, { key: k, from, to, fromForm = "drop", toForm = "drop", flow = null, px = 1, medium = null, clocks = null }) {
      const x = canvas.getContext("2d", { colorSpace: "display-p3" }); x.clearRect(0, 0, canvas.width, canvas.height);
      if (t <= 0 || t >= 1 || !from?.canvas || !to?.canvas) {
        if (t >= 1) landed = true; if (t <= 0) landed = false; last = { mean: t >= 1 ? 1 : 0, sd: 0, n: 0, t }; return;
      }
      if (k !== key) {  // one grid per pair: the element as it was when it lifted off, and where it will land
        key = k; landed = false; const A = cells(from.canvas, cols, rows), B = cells(to.canvas, cols, rows);
        const mask = Uint8Array.from(A.ink, (v) => (v > 0.1 ? 1 : 0));  // the ticks are the leaving element's ink
        let best = -1e9, seedAt = null;  // the front starts from the element's own ink nearest the road (low, then left)
        for (let k2 = 0; k2 < mask.length; k2++) if (mask[k2]) { const i = k2 % cols, j = (k2 / cols) | 0, v = j - 0.3 * i; if (v > best) { best = v; seedAt = [i, j]; } }
        T = { A, B, mask, front: growFront(cols, rows, { ink: A.ink, seedAt, seed: 17, span }) };
      }
      const tt = clocks ? timing(t, clocks, [1, 1]) : t;  // the timing layer: both elements' clocks, weighted
      const F0 = FORMS[fromForm] || FORMS.drop, F1 = FORMS[toForm] || FORMS.drop, poured = [], tau = T.front.tau;
      const cw = from.rect.width / cols, ch = from.rect.height / rows, dw = to.rect.width / cols, dh = to.rect.height / rows;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const kk = j * cols + i; if (!T.mask[kk]) continue;
        const w = weightAt(tau, kk, tt, width), arc = 4 * w * (1 - w);  // arc: 1 while the tick is mid-flip, 0 at both ends
        const a = Math.max(0.3, mix(T.A.ink[kk], T.B.ink[kk], w)), alpha = a * clamp(arc * 5);
        if (alpha < 0.02) continue;  // a tick at rest is drawn by its place itself, so nothing doubles
        const jx = ((kk * 7919) % 101) / 101 - 0.5, jy = ((kk * 104729) % 103) / 103 - 0.5;  // off the lattice: a tick sits anywhere in its cell
        const ax = from.rect.left + (i + 0.5 + jx) * cw, ay = from.rect.top + (j + 0.5 + jy) * ch, bx = to.rect.left + (i + 0.5 + jx) * dw, by = to.rect.top + (j + 0.5 + jy) * dh;
        let X = mix(ax, bx, w), Y = mix(ay, by, w);
        const f = flow?.(X, Y) || [0, 0], c = curl(X, Y, (kk % 97) * 0.07);  // carried by the water, and by its own wander
        X += (f[0] * 90 + c[0] * 30) * arc; Y += (f[1] * 90 + c[1] * 30) * arc;
        const size = mix(F0.size, F1.size, w) * px * 0.9, aspect = mix(F0.aspect, F1.aspect, w), round = mix(F0.round, F1.round, w);
        const ang = mix(F0.follow, F1.follow, w) * Math.atan2((by - ay) + f[1] * 200, (bx - ax) + f[0] * 200);
        const col = recombine(T.A.col[kk], T.B.col[kk], w), sw = size * Math.sqrt(aspect), sh = size / Math.sqrt(aspect);
        x.globalAlpha = alpha; x.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        x.save(); x.translate(X * px, Y * px); x.rotate(ang); x.beginPath(); x.roundRect(-sw / 2, -sh / 2, sw, sh, round * Math.min(sw, sh) / 2); x.fill(); x.restore();
        if (poured.length < 6 && arc > 0.9 && kk % 13 === 0) poured.push([X, Y, bx - ax, by - ay]);
      }
      x.globalAlpha = 1;
      last = { ...spread(tau, tt, { mask: T.mask, width }), t };
      // the element moves the water as it goes (a few pushes a second), and leaves ink where it lands
      const now = performance.now();
      if (medium && now - pourAt > 180) {
        pourAt = now;
        for (const [X, Y, dx, dy] of poured) medium.add("current", { x: X / innerWidth, y: Y / innerHeight, r: 0.03, vx: clamp(dx * 0.01, -6, 6), vy: clamp(dy * 0.01, -6, 6) });
      }
      if (medium && tt > 0.92 && !landed) {
        landed = true;
        for (let kk = 0; kk < tau.length; kk += 211) if (T.mask[kk]) medium.add("ink", { x: (to.rect.left + ((kk % cols) + 0.5) * dw) / innerWidth, y: (to.rect.top + (((kk / cols) | 0) + 0.5) * dh) / innerHeight, r: 0.02, amount: 0.12 });
      }
    },
  };
}

// The water's current at a viewport point, from a medium export (FLOW medium export().velocity), normalised by its
// peak so a still day and a stormy one both carry visibly. Returns a function, or null with no field.
export function flowFrom(velocity) {
  if (!velocity) return null; const { w, h, vx, vy } = velocity; let peak = 1e-6;
  for (let k = 0; k < vx.length; k++) peak = Math.max(peak, Math.hypot(vx[k], vy[k]));
  return (X, Y) => { const i = clamp(Math.floor(X / innerWidth * w), 0, w - 1), j = clamp(Math.floor(Y / innerHeight * h), 0, h - 1), k = j * w + i; return [vx[k] / peak, vy[k] / peak]; };
}
