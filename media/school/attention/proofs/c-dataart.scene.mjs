// Direction C: dense data art under Rerun's prism. Every word is a column of 24 dots, one dot
// per number in its vector. The reading word sends 600 fine threads back; each thread lands on
// an earlier word with probability equal to that word's attention weight, so the density of
// light is the weight. The bundle passes through the prism and splits into two heads; the
// spectrum appears only at the prism's exit edge (the art's one hot mark).
import { rect, circle, polyline } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { text } from "../../../raw-native/tree-c6b114d/web/motion/text.mjs";
import { rng } from "../../../raw-native/tree-c6b114d/web/motion/timeline.mjs";
import { pose } from "../../../raw-native/tree-c6b114d/templates/guides/rig.mjs";
import { GUIDES } from "../../../raw-native/tree-c6b114d/templates/guides/guides.mjs";
import { WORDS, QUERY, WEIGHTS, WEIGHTS2, smooth, loadAtlas } from "./common.mjs";

const D = 24, X0 = 150, DX = 150, Y0 = 640, DY = 13, PRISM = [960, 250];
const colX = (i) => X0 + i * DX;
// Seeded vector values per word, so the columns look like data and stay fixed.
const VEC = WORDS.map((_, i) => { const r = rng(100 + i); return Array.from({ length: D }, () => r() * 2 - 1); });
const SPECTRUM = [[1, 0.25, 0.2], [1, 0.6, 0.15], [0.95, 0.95, 0.3], [0.3, 0.95, 0.5], [0.25, 0.7, 1], [0.6, 0.35, 1]];

function columns(A, t, wa) {
  const out = [];
  WORDS.forEach((w, i) => {
    const appear = smooth(0.1 * i, 0.1 * i + 0.6, t), q = i === QUERY, lit = q ? 1 : wa[i];
    VEC[i].forEach((v, k) => out.push({ shape: circle(colX(i), Y0 + k * DY, (1.2 + 3.6 * Math.abs(v)) * appear, 10),
      fill: q ? [0.89, 0.58, 0.45, 0.95] : [0.93, 0.9, 0.84, 0.25 + 0.75 * Math.min(1, lit * 2.2)], blend: "add" }));
    out.push({ shape: text(w, { atlas: A.atlas, size: 30, x: colX(i), y: Y0 + D * DY + 44, anchor: "center" }).shape, fill: q ? "#e29472" : "#ece5d6", opacity: appear });
    if (!q) out.push({ shape: text(`${Math.round(wa[i] * 100)}%`, { atlas: A.atlas, size: 22, x: colX(i), y: Y0 - 26, anchor: "center" }).shape, fill: "#958e80", opacity: smooth(3.8, 4.6, t) });
  });
  return out;
}

// A thread: from the query column up through the prism and down to its key column.
function thread(r, j, key, head, grow) {
  const qx = colX(QUERY), qy = Y0 - 10, kx = colX(key) + (r() - 0.5) * 18, ky = Y0 - 10;
  const px = PRISM[0] + (r() - 0.5) * 40, py = PRISM[1] + 60 + (r() - 0.5) * 30, lift = 120 + 60 * head + r() * 60;
  const pts = [], n = 28;
  for (let s = 0; s <= n * grow; s++) {
    const u = s / n;
    // Two quadratic legs joined at the prism.
    const [ax, ay, cx, cy, bx, by] = u < 0.5 ? [qx, qy, qx - 80, py - lift, px, py] : [px, py, kx + 40, py - lift * 0.4, kx, ky], v = u < 0.5 ? u * 2 : u * 2 - 1;
    pts.push((1 - v) * (1 - v) * ax + 2 * v * (1 - v) * cx + v * v * bx, (1 - v) * (1 - v) * ay + 2 * v * (1 - v) * cy + v * v * by);
  }
  return pts.length >= 4 ? { shape: polyline(pts), fill: null, stroke: head ? [0.55, 0.85, 1, 0.07] : [1, 0.9, 0.75, 0.07], width: 1.0, blend: "add" } : null;
}
// Pick a key word for a thread by its weight (inverse of the cumulative sum).
const pick = (w, u) => { let s = 0; for (let i = 0; i < QUERY; i++) { s += w[i]; if (u < s) return i; } return QUERY - 1; };

function prism(t) {
  const [x, y] = PRISM, out = [{ shape: polyline([x - 90, y + 80, x, y - 80, x + 90, y + 80], true), fill: [0.6, 0.7, 0.8, 0.08], stroke: [0.9, 0.95, 1, 0.7], width: 2 }];
  const k = smooth(2.6, 3.6, t);
  SPECTRUM.forEach((c, i) => out.push({ shape: polyline([x + 46 + i * 4, y + 2 - i * 2, x + 70 + i * 6, y + 40 + i * 3]), fill: null, stroke: [...c, 0.8 * k], width: 3, blend: "add" }));
  return out;
}

export function dataItems(A, t, { threads = 1400 } = {}) {
    const items = [], split = smooth(2.6, 3.8, t), grow = smooth(1.0, 2.8, t);
    items.push(...columns(A, t, WEIGHTS));
    const r = rng(42);
    for (let j = 0; j < threads; j++) {
      const head = split > r() * 1.0001 && j % 2 ? 1 : 0, key = pick(head ? WEIGHTS2 : WEIGHTS, r());
      const th = thread(r, j, key, head, grow);
      if (th) items.push(th);
    }
    items.push(...prism(t));
    const g = GUIDES.rerun;
    items.push(...pose(g.parts({ stalk: 1.3, look: [-6, -2], flare: 0.9, clawR: 40 }), { x: PRISM[0] + 150, y: PRISM[1] + 96, s: 0.2 }));
    return { items, split };
}

export default {
  title: "Attention proof C: data art under the prism", duration: 6, fps: 30,
  async load(ctx) { return loadAtlas(ctx); },
  frame(t, ctx) {
    const A = ctx.assets, { items, split } = dataItems(A, t);
    items.push({ shape: text("1 dot = 1 number in the word's vector", { atlas: A.atlas, size: 22, x: 80, y: 1050 }).shape, fill: "#958e80", screen: true },
      { shape: text("illustration: hand-set scores", { atlas: A.atlas, size: 22, x: 80, y: 70 }).shape, fill: "#958e80", screen: true },
      { shape: text(split > 0.5 ? "two heads read two different things" : "one word reads the words before it", { atlas: A.atlas, size: 40, x: 960, y: 110, anchor: "center" }).shape, fill: "#ece5d6", screen: true });
    return { background: [0, 0, 0], camera: { x: 960, y: 540, zoom: 1 + 0.05 * smooth(0, 6, t) }, items, post: { bloom: 0.3, threshold: 1.0, vignette: 0.35, grain: 0.05, passes: [] } };
  },
};
