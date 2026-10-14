// The thriller set: the night desk of the claims office, seen front on, for guides who stand
// in it. The template's look (colour negative film, a soft tube, one practical light) comes
// from look.mjs; the room is drawn here. Coordinates are the 1920 x 1080 design frame.
import { P, ellipse, hatch, seeded, lin, rad, INK } from "./rig.mjs";
import { rect } from "../../web/motion/path.mjs";
import { text } from "../../web/motion/text.mjs";

const HORIZON = 640, VP = [960, 260];

// Floor cards lie flat: a card is a quad squashed by its depth on the floor.
export function floorCards(n, seed, { x0 = 80, x1 = 1840, y0 = 680, y1 = 1060, lit = () => 1, size = 2.4 } = {}) {
  const r = seeded(seed), out = [];
  for (let i = 0; i < n; i++) {
    const y = y0 + r() * (y1 - y0), d = (y - HORIZON + 60) / (1080 - HORIZON + 60), x = x0 + r() * (x1 - x0), a = (r() - 0.5) * 1.4;
    const w = 52 * d * size, h = 34 * d * size, sq = 0.38, c = Math.cos(a), s = Math.sin(a), k = lit(i);
    const pt = (u, v) => `${(x + u * c - v * s).toFixed(1)} ${(y + (u * s + v * c) * sq).toFixed(1)}`;
    out.push({ shape: P(`M ${pt(-w / 2, -h / 2)} L ${pt(w / 2, -h / 2)} L ${pt(w / 2, h / 2)} L ${pt(-w / 2, h / 2)} Z`), fill: [0.82 * k, 0.77 * k, 0.66 * k, 1], stroke: INK, width: 1.5 });
    out.push({ shape: P(`M ${pt(-w / 3, -h / 6)} L ${pt(w / 3, -h / 6)} M ${pt(-w / 3, h / 6)} L ${pt(w / 6, h / 6)}`), fill: null, stroke: [0.28 * k, 0.24 * k, 0.18 * k, 1], width: 1.5 });
  }
  return out;
}

function cabinet(A, x, y, w, h) {
  const out = [{ shape: rect(x, y, w, h), fill: lin(x, 0, x + w, 0, [0, "#3b3a33"], [1, "#24231f"]), stroke: INK, width: 3 }];
  const dh = h / 4;
  for (let i = 0; i < 4; i++) {
    const yy = y + i * dh;
    out.push({ shape: rect(x + 12, yy + 10, w - 24, dh - 18, 3), fill: i === 2 ? "#1a1916" : "#33322c", stroke: INK, width: 2 });
    out.push({ shape: rect(x + w / 2 - 24, yy + dh / 2 - 6, 48, 10, 3), fill: "#a8823a", stroke: INK, width: 1.5 });
    out.push({ shape: rect(x + w / 2 - 30, yy + 18, 60, 18), fill: "#cfc4a4", stroke: INK, width: 1 });
  }
  // The open drawer: candle stubs with name tags, earlier versions of the clerk.
  const oy = y + 2 * dh;
  out.push({ shape: P(`M ${x - 30} ${oy + dh - 6} L ${x + w + 30} ${oy + dh - 6} L ${x + w + 14} ${oy + dh + 30} L ${x - 14} ${oy + dh + 30} Z`), fill: "#2b2a25", stroke: INK, width: 2.5 });
  for (let i = 0; i < 6; i++) {
    const sx = x + 8 + i * (w / 6), hgt = 18 + ((i * 37) % 23);
    out.push({ shape: rect(sx, oy + dh - 6 - hgt, 16, hgt), fill: "#d9caa5", stroke: INK, width: 1.5 });
  }
  return out;
}

function door(A, x, y, w, h) {
  const out = [
    { shape: rect(x - 14, y - 14, w + 28, h + 14), fill: "#1a1310", stroke: INK, width: 3 },
    { shape: rect(x, y, w, h), fill: lin(x, 0, x + w, 0, [0, "#3a281d"], [1, "#24180f"]), stroke: INK, width: 3 },
    { shape: rect(x + 26, y + 34, w - 52, 210), fill: rad(x + w / 2, y + 140, 220, [0, "#d8cfa8"], [1, "#7d7658"]), stroke: INK, width: 3 },
    { shape: P(ellipse(x + w - 30, y + h / 2 + 30, 9, 9)), fill: "#a8823a", stroke: INK, width: 2 },
  ];
  if (A && A.atlas) {
    out.push({ shape: text("CLAIMS", { atlas: A.atlas, size: 30, x: x + w / 2, y: y + 120, anchor: "center" }).shape, fill: "#2a2418" });
    out.push({ shape: text("night desk", { atlas: A.atlas, size: 22, x: x + w / 2, y: y + 156, anchor: "center" }).shape, fill: "#2a2418" });
  }
  return out;
}

export function thrillerSet(A) {
  const items = [
    { shape: rect(-800, -400, 3520, HORIZON + 400), fill: lin(0, 0, 0, HORIZON, [0, "#121716"], [1, "#1f2522"]) },
    { shape: P(hatch(-800, -400, 2720, HORIZON, { gap: 22, angle: 90, wobble: 1.5, seed: "wallpaper", step: 40 })), fill: null, stroke: [0.55, 0.6, 0.5, 0.08], width: 2 },
    { shape: rect(-800, 470, 3520, HORIZON - 470), fill: "#17110e" },
    { shape: rect(-800, 462, 3520, 12), fill: "#2c2119", stroke: INK, width: 2 },
    { shape: rect(-800, HORIZON, 3520, 1080 - HORIZON + 400), fill: lin(0, HORIZON, 0, 1080, [0, "#2a241f"], [1, "#100d0b"]) },
  ];
  for (let i = -20; i <= 20; i++) {
    const xb = 960 + i * 150, t = (HORIZON - 1080) / (VP[1] - 1080), xh = xb + (VP[0] - xb) * t;
    items.push({ shape: P(`M ${xb} 1080 L ${xh.toFixed(1)} ${HORIZON}`), fill: null, stroke: [0, 0, 0, 0.55], width: 2.5 });
  }
  items.push({ shape: rect(-800, HORIZON - 2, 3520, 6), fill: "#0c0907" });
  items.push(...cabinet(A, 170, 300, 230, 340), ...door(A, 1360, 150, 250, 490));
  // A wall clock past three, a framed notice.
  items.push({ shape: P(ellipse(960, 190, 46, 46)), fill: "#6f6a5c", stroke: INK, width: 4 },
    { shape: P("M 960 190 L 960 160 M 960 190 L 982 200"), fill: null, stroke: INK, width: 4 });
  return items;
}
