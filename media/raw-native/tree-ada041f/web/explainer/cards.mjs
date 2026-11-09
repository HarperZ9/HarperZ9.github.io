// Data cards, bars and image grids: drawn marks for numbers that come from a data bundle.
// A card never takes a typed number; it takes a value and a format, and shows its source row.
//
//   items.push(...dataCard(T, {
//     x: 1180, y: 300, w: 520, title: "Repeat accuracy",
//     rows: [{ label: "inside the repeat", value: d.accuracy.repeat, format: "pct", bar: 1, mark: "verified" },
//            { label: "elsewhere (chance 1.6%)", value: d.accuracy.elsewhere, format: "pct", bar: 1 }],
//     source: "data.json · accuracy", reveal: u, ground: "night" }));
import { rect, line } from "../motion/path.mjs";
import { clamp01 } from "../motion/timeline.mjs";
import { GROUNDS } from "./style.mjs";
import { show } from "./data.mjs";

const hair = (x0, y0, x1, y1, color, opacity, width = 1) => ({ shape: line(x0, y0, x1, y1), stroke: color, width, opacity, hairline: true });

// A horizontal bar: track hairline plus a filled bar to value (0..1 of max). The fill is the
// verdict colour named by `mark`, or ink.
export function bar({ x, y, w, h = 10, value, max = 1, reveal = 1, mark = null, ground = "night", opacity = 1 }) {
  const g = GROUNDS[ground], f = clamp01(value / max) * clamp01(reveal);
  const out = [hair(x, y + h / 2, x + w, y + h / 2, g.rule, opacity)];
  if (f > 0) out.push({ shape: rect(x, y, w * f, h, 1), fill: mark ? g[mark] : g.ink, opacity });
  return out;
}

export function dataCard(T, { x, y, w = 520, title, rows = [], source = null, reveal = 1, ground = "night", opacity = 1, rowH = 74 }) {
  const g = GROUNDS[ground], out = [], r = clamp01(reveal);
  if (r <= 0) return out;
  const h = 70 + rows.length * rowH + (source ? 40 : 0);
  out.push({ shape: rect(x, y, w, h, 2), stroke: g.rule, width: 1, hairline: true, opacity: opacity * r });
  // Corner ticks: the card's drawn mark (no pill, no shadow).
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    out.push(hair(cx, cy, cx + 14 * sx, cy, g.ink, opacity * r), hair(cx, cy, cx, cy + 14 * sy, g.ink, opacity * r));
  }
  out.push(...T.body(title, { x: x + 24, y: y + 46, size: 28, ground, opacity: opacity * r, reveal: clamp01(r * 1.6) }));
  rows.forEach((row, i) => {
    const ry = y + 70 + i * rowH, rr = clamp01(r * 1.4 - i * 0.15);
    const v = row.value * rr;
    out.push(...T.meta(row.label, { x: x + 24, y: ry + 22, size: 18, ground, opacity: opacity * rr }));
    out.push(...T.mono(show(v, row.format || "f2"), { x: x + w - 24, y: ry + 24, size: 24, anchor: "right", ground,
      color: row.mark ? g[row.mark] : g.ink, opacity: opacity * rr }));
    if (row.bar !== undefined) out.push(...bar({ x: x + 24, y: ry + 38, w: w - 48, value: row.value, max: row.bar, reveal: rr, mark: row.mark, ground, opacity }));
  });
  if (source) out.push(...T.meta(source, { x: x + 24, y: y + h - 18, size: 16, ground, opacity: opacity * r }));
  return out;
}

// An attention matrix as a grid of cells (query rows, key columns), ink by weight. `rows` is an
// array of arrays; `focus` highlights one query row; `mark` paints cells above `markAt`.
export function matrix({ x, y, size, rows, reveal = 1, focus = -1, ground = "night", opacity = 1, mark = null, markAt = 0.5 }) {
  const g = GROUNDS[ground], n = rows.length, c = size / n, out = [];
  const shown = Math.round(clamp01(reveal) * n);
  out.push({ shape: rect(x, y, size, size), stroke: g.rule, width: 1, hairline: true, opacity });
  for (let i = 0; i < shown; i++) for (let j = 0; j <= i && j < rows[i].length; j++) {
    const w = rows[i][j];
    if (w < 0.02) continue;
    const hot = mark && w >= markAt;
    out.push({ shape: rect(x + j * c, y + i * c, c * 0.92, c * 0.92), fill: hot ? g[mark] : g.ink,
      opacity: opacity * Math.min(1, 0.15 + w) * (i === focus || focus < 0 ? 1 : 0.35) });
  }
  return out;
}

// A grid of images (atlas names from motion.image()), each with an optional mono caption.
export function imageGrid(T, { x, y, cols, cell, gap = 12, images, captions = [], reveal = 1, ground = "night", opacity = 1 }) {
  const out = [], n = images.length;
  images.forEach((name, i) => {
    const rr = clamp01(reveal * n - i);
    if (rr <= 0) return;
    const cx = x + (i % cols) * (cell + gap), cy = y + Math.floor(i / cols) * (cell + gap + (captions.length ? 24 : 0));
    out.push({ shape: rect(cx, cy, cell, cell), fill: { image: name, rect: [cx, cy, cell, cell] }, opacity: opacity * rr });
    if (captions[i]) out.push(...T.meta(captions[i], { x: cx, y: cy + cell + 18, size: 13, ground, opacity: opacity * rr }));
  });
  return out;
}

// Luminous columns: one per value (0..1 of max), rising from a baseline. Each column is drawn
// twice, blurred and added for the glow, then sharp; colour runs from `low` to `high` by value.
// `values` may be a function of the column index for animated morphs between two data rows.
export function columns({ x0, x1, y, h, values, gap = 0.28, reveal = 1, low = [0.55, 0.22, 0.10], high = [1, 0.86, 0.62], glow = 10, opacity = 1 }) {
  const n = values.length, w = (x1 - x0) / n, out = [];
  for (let i = 0; i < n; i++) {
    const v = clamp01(values[i]) * clamp01((reveal - (i / n) * 0.4) / 0.6);   // left to right stagger
    if (v <= 0.002) continue;
    const c = low.map((a, k) => a + (high[k] - a) * v), x = x0 + i * w + (w * gap) / 2, bw = w * (1 - gap), bh = h * v;
    out.push({ shape: rect(x, y - bh, bw, bh), fill: c, opacity: opacity * 0.55, blur: glow, blend: "add" });
    out.push({ shape: rect(x, y - bh, bw, bh), fill: c, opacity, blend: "add" });
  }
  return out;
}
