// Tallow's brass wheel (PROGRESS.md, step 24), shared by lessons L9 and L15: one slot per word,
// each slot's angle its share of the model's belief, so a guess is legible in one still and the
// thin slivers of unlikely words are visible as a tail. The pointer sits at the wheel's right; a
// spin turns the wheel so the pointer lands inside a chosen slot. Rings outside the wheel carry a
// second spread (the rules' own odds) for comparison. Every share drawn comes from facts.json.
import { rect, circle, polyline, words, ease } from "../../shared/lib.mjs";

export const WHEEL = { x: 1160, y: 540, r: 330 };
const TAU = Math.PI * 2;
export const INK = { night: "#ece5d6", dim: "#958e80", ember: "#e29472", paper: "#e3d6b5", paper2: "#cdbb92", ink: "#1d1812" };
export const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
export const even = (n) => new Array(n).fill(1 / n);

// The slot centres (radians from the wheel's zero) for shares s.
export function centres(s) {
  const out = [];
  let a = 0;
  for (const p of s) { out.push(a + (p * TAU) / 2); a += p * TAU; }
  return out;
}
// The turn that puts the pointer (angle 0) in the middle of slot k, after `laps` full turns.
export const landOn = (s, k, laps = 2) => -centres(s)[k] - laps * TAU;
// Turn at time t for a spin from `from` to `to` over [t0, t0 + d], easing out like a real wheel.
export function spin(t, t0, d, from, to) {
  const u = Math.max(0, Math.min(1, (t - t0) / d));
  return from + (to - from) * (1 - (1 - u) ** 3);
}

function sector(cx, cy, r0, r1, a0, a1) {
  const n = Math.max(2, Math.ceil(((a1 - a0) / TAU) * 96)), pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); }
  for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; pts.push(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); }
  return polyline(pts, true);
}

// The wheel. s: shares (sum 1), names: one word per slot. hot(k): slot in ember. tail(k): slot
// marked as part of the tail. pct(k): print the share beside the word. a: opacity.
export function wheel(A, s, names, { turn = 0, at = WHEEL, hot = () => false, tail = () => false, pct = () => false, a = 1, minLabel = 0.028, size = 27 } = {}) {
  const { x, y, r } = at, out = [{ shape: circle(x + 10, y + 14, r + 30, 128), fill: [0, 0, 0, 0.45 * a], blur: 14 }, { shape: circle(x, y, r + 26, 128), fill: "#3a2c18", stroke: "#0b0a0c", width: 6, opacity: a }];
  let a0 = turn;
  s.forEach((p, k) => {
    const da = p * TAU;
    if (da > 1e-4) {
      const h = hot(k), tl = tail(k);
      out.push({ shape: sector(x, y, 0, r, a0, a0 + da), fill: h ? [0.89, 0.58, 0.45, a] : tl ? [0.62, 0.36, 0.28, a] : k % 2 ? INK.paper2 : INK.paper, stroke: "#2a2219", width: da > 0.02 ? 1.5 : 0.6, opacity: a });
      if (p >= minLabel) {
        const c = a0 + da / 2, rx = x + Math.cos(c) * r * 0.66, ry = y + Math.sin(c) * r * 0.66;
        out.push({ shape: words(names[k], A.sans, size, rx, ry + size * 0.3, "center"), fill: INK.ink, opacity: a });
        if (pct(k)) out.push({ shape: words(`${Math.round(p * 100)}%`, A.mono, size - 2, rx, ry + size * 1.3, "center"), fill: "#3a2a1a", opacity: a });
      }
    }
    a0 += da;
  });
  for (let k = 0; k < 16; k++) { const b = (k / 16) * TAU; out.push({ shape: circle(x + Math.cos(b) * (r + 13), y + Math.sin(b) * (r + 13), 4, 8), fill: "#b8892e", opacity: a }); }
  out.push({ shape: circle(x, y, 22, 32), fill: "#4a3a22", stroke: "#0b0a0c", width: 3, opacity: a });
  return out;
}
// The pointer at the wheel's right edge.
export const pointer = (at = WHEEL, a = 1) => [{ shape: polyline([at.x + at.r + 70, at.y, at.x + at.r + 8, at.y - 22, at.x + at.r + 8, at.y + 22], true), fill: "#b8892e", stroke: "#0b0a0c", width: 3, opacity: a }];
// A ring outside the wheel with a second spread (fixed, untouched by the turn of the wheel).
export function ring(A, s, names, { at = WHEEL, a = 1, label = "" } = {}) {
  const { x, y, r } = at, r0 = r + 44, r1 = r + 78, out = [];
  let a0 = -Math.PI / 2;
  s.forEach((p, k) => {
    const da = p * TAU;
    if (da > 1e-4) {
      out.push({ shape: sector(x, y, r0, r1, a0, a0 + da), fill: [0.55, 0.7, 0.85, (k % 2 ? 0.5 : 0.7) * a], stroke: [0.05, 0.06, 0.08, a], width: 1 });
      if (p >= 0.04) { const c = a0 + da / 2; out.push({ shape: words(names[k], A.sans, 18, x + Math.cos(c) * (r1 + 34), y + Math.sin(c) * (r1 + 34) + 6, "center"), fill: [0.7, 0.82, 0.95, a] }); }
    }
    a0 += da;
  });
  if (label) out.push({ shape: words(label, A.mono, 22, x, y - r1 - 70, "center"), fill: [0.7, 0.82, 0.95, a] });
  return out;
}
// A ribbon of word cards written one by one from t0 (rate words a second), wrapping in rows.
export function ribbon(A, list, t, t0, { x = 640, y = 900, w = 1220, rate = 3, hot = () => false, a = 1, size = 22 } = {}) {
  const n = Math.max(0, Math.min(list.length, Math.floor((t - t0) * rate))), out = [];
  let cx = x, cy = y;
  for (let i = 0; i < n; i++) {
    const s = list[i], wd = s.length * size * 0.56 + 22;
    if (cx + wd > x + w) { cx = x; cy += size + 22; }
    const k = ease.out(Math.max(0, Math.min(1, (t - t0 - i / rate) * 4)));
    out.push({ shape: rect(cx, cy - size + 2 - (1 - k) * 12, wd - 6, size + 12, 3), fill: hot(i) ? [0.89, 0.58, 0.45, a * k] : [0.89, 0.84, 0.71, a * k], stroke: "#2a2219", width: 1 },
      { shape: words(s, A.sans, size, cx + (wd - 6) / 2, cy + 4 - (1 - k) * 12, "center"), fill: INK.ink, opacity: a * k });
    cx += wd;
  }
  return out;
}
// A plain caption line in the mono face, on screen space.
export const lab = (A, s, size, x, y, fill = INK.night, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
export const plateRect = (x, y, w, h, a = 0.8) => ({ shape: rect(x, y, w, h, 10), fill: [0.03, 0.03, 0.04, a], screen: true });
