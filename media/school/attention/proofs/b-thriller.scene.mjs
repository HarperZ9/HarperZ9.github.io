// Direction B: the lamp room, retro thriller. The earlier words are cards pinned around the
// curved glass of the lantern; the great lens turns, and its light pools on each card in
// proportion to the attention weight. Tallow stands at the lens. Film stock and the soft tube.
import { rect, circle, polyline } from "../../../raw-native/tree-ada041f/web/motion/path.mjs";
import { text } from "../../../raw-native/tree-ada041f/web/motion/text.mjs";
import { pose, lin, rad } from "../../../raw-native/tree-ada041f/templates/guides/rig.mjs";
import { GUIDES } from "../../../raw-native/tree-ada041f/templates/guides/guides.mjs";
import { LOOKS, darkness, glow } from "../../../raw-native/tree-ada041f/templates/guides/look.mjs";
import { WORDS, QUERY, WEIGHTS, smooth, loadAtlas } from "./common.mjs";

export const LENS = [1120, 470];
// Cards on an arc of the lantern glass, left to right in sentence order.
const CARDS = WORDS.slice(0, QUERY).map((w, i) => {
  const a = Math.PI * (1.08 - 0.9 * (i / (QUERY - 1)));
  return { w, i, x: LENS[0] + Math.cos(a) * 760, y: LENS[1] - Math.sin(a) * 300 + 120, rot: (a - Math.PI / 2) * 0.25 };
});

export function room() {
  const out = [{ shape: rect(0, 0, 1920, 1080), fill: rad(1100, 420, 1300, [0, "#1a1714"], [1, "#030304"]) }];
  // The lantern's glazing bars and the floor.
  for (let k = 0; k < 9; k++) { const x = 120 + k * 220; out.push({ shape: rect(x, 0, 10, 900), fill: "#0f0d0c" }); }
  out.push({ shape: rect(0, 880, 1920, 200), fill: lin(0, 880, 0, 1080, [0, "#16120f"], [1, "#060505"]) });
  return out;
}

// The Fresnel lens: brass frame, concentric glass rings, one bright bar that turns.
export function lens(t) {
  const [x, y] = LENS, out = [{ shape: circle(x, y, 230, 96), fill: "#4a3a22", stroke: "#0b0a0c", width: 6 }];
  for (let k = 0; k < 9; k++) out.push({ shape: circle(x, y, 210 - k * 22, 96), fill: null, stroke: [0.85, 0.8, 0.65, 0.18 + 0.04 * k], width: 5 });
  const a = t * 1.3;
  out.push({ shape: polyline([x + Math.cos(a) * 210, y + Math.sin(a) * 210, x + Math.cos(a + 0.25) * 210, y + Math.sin(a + 0.25) * 210, x, y], true), blend: "add", fill: [1, 0.85, 0.55, 0.25] });
  out.push({ shape: circle(x, y, 40, 48), blend: "add", fill: rad(x, y, 40, [0, [1, 0.95, 0.8, 1]], [1, [1, 0.7, 0.3, 0]]) });
  return out;
}

function card(c, lit, A) {
  const w = 190, h = 112, { x, y } = c;
  return [
    { shape: rect(x - w / 2 + 8, y - h / 2 + 10, w, h, 3), fill: [0, 0, 0, 0.5], blur: 8 },
    { shape: rect(x - w / 2, y - h / 2, w, h, 3), fill: lin(x, y - h / 2, x, y + h / 2, [0, "#e3d6b5"], [1, "#b9a985"]), stroke: "#2a2219", width: 3 },
    { shape: circle(x, y - h / 2 + 6, 6, 16), fill: "#7a2620" },
    { shape: text(c.w, { atlas: A.atlas, size: 38, x, y: y + 12, anchor: "center" }).shape, fill: "#1d1812" },
    // The light pool on the card.
    ...(lit > 0.01 ? [{ shape: circle(x, y, 150, 64), blend: "add", fill: rad(x, y, 150, [0, [1, 0.72, 0.38, 0.9 * lit]], [1, [1, 0.6, 0.3, 0]]) }] : []),
  ];
}

const beam = (c, k) => {
  const [lx, ly] = LENS, dx = c.x - lx, dy = c.y - ly, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  return { shape: polyline([lx + nx * 30, ly + ny * 30, c.x + nx * 90, c.y + ny * 90, c.x - nx * 90, c.y - ny * 90, lx - nx * 30, ly - ny * 30], true),
    blend: "add", fill: lin(lx, ly, c.x, c.y, [0, [1, 0.8, 0.5, 0.5 * k]], [1, [1, 0.65, 0.3, 0.12 * k]]) };
};

export default {
  title: "Attention proof B: lamp room, retro thriller", duration: 6, fps: 30,
  async load(ctx) { return loadAtlas(ctx); },
  frame(t, ctx) {
    const A = ctx.assets, items = [...room()];
    const sweep = smooth(0, 1.8, t), split = smooth(1.8, 3.2, t), carry = smooth(3.6, 5.2, t), at = sweep * (QUERY - 1);
    CARDS.forEach((c) => {
      const near = Math.max(0, 1 - Math.abs(c.i - at) / 1.1) * (1 - split), lit = Math.min(1, near + split * WEIGHTS[c.i] * 1.7);
      if (lit > 0.02) items.push(beam(c, near + split * WEIGHTS[c.i] * 1.7));
      items.push(...card(c, lit, A));
    });
    items.push(...lens(t));
    // Tallow at the lens, the query card in his hand.
    const g = GUIDES.tallow, T = { x: 640, y: 1010, s: 0.62 }, flame = 0.9 + 0.1 * Math.sin(t * 9);
    const o = { armR: 150 - 30 * split, elbR: 30, prop: "card", lid: 0.5 - 0.2 * split, look: [9, -6], flame, lean: 16 * split };
    items.push(...g.under(T.x, T.y, T.s, "thriller"), ...pose(g.parts(o), { ...T, shear: g.shear }));
    const best = CARDS[WEIGHTS.indexOf(Math.max(...WEIGHTS.slice(0, QUERY)))];
    if (carry > 0) {
      const x = best.x + (LENS[0] - best.x) * carry, y = best.y + (LENS[1] + 260 - best.y) * carry;
      items.push({ shape: text(best.w, { atlas: A.atlas, size: 44, x, y, anchor: "center" }).shape, fill: "#ffe3b0" });
    }
    items.push(darkness(LENS[0] - 200, LENS[1] + 80, 1250, 0.6), glow(LENS[0], LENS[1], 520, [1, 0.62, 0.28], 0.35));
    items.push({ shape: text("the  ...  " + (carry >= 1 ? best.w : "?"), { atlas: A.atlas, size: 52, x: 960, y: 980, anchor: "center" }).shape, fill: "#d9cdb4", screen: true },
      { shape: text("illustration: hand-set scores", { atlas: A.atlas, size: 22, x: 80, y: 70 }).shape, fill: "#8a8070", screen: true });
    const L = LOOKS.thriller;
    return { background: L.ground, camera: { x: 960, y: 540 - 20 * smooth(0, 6, t), zoom: 1 + 0.08 * smooth(0, 6, t) }, items, post: L.post };
  },
};
