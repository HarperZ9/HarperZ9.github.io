// Direction A: the painted coast. Each earlier word is a cottage on the shore road; the word
// doing the reading is the lighthouse at the near end, and Tallow on its gallery turns the lamp.
// Beams fan back along the road with strength equal to the attention weight; the brightest
// cottage sends its cargo back up the beam. Oil-grotesque paint pass.
import { rect, circle, polyline } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { text } from "../../../raw-native/tree-c6b114d/web/motion/text.mjs";
import { rng } from "../../../raw-native/tree-c6b114d/web/motion/timeline.mjs";
import { pose, lin, rad } from "../../../raw-native/tree-c6b114d/templates/guides/rig.mjs";
import { GUIDES } from "../../../raw-native/tree-c6b114d/templates/guides/guides.mjs";
import { WORDS, QUERY, WEIGHTS, smooth, loadAtlas } from "./common.mjs";

const LAMP = [1500, 400];
// Cottages along a road that recedes to the left: far ones small and high, near ones large.
const HOUSES = WORDS.slice(0, QUERY).map((w, i) => {
  const u = i / (QUERY - 1), s = 0.42 + 0.7 * u * u;
  return { w, i, x: 120 + 1080 * Math.pow(u, 1.25), y: 640 + 300 * u * u, s };
});

function sky(r) {
  const out = [{ shape: rect(0, 0, 1920, 1080), fill: lin(0, 0, 0, 760, [0, "#03050c"], [0.7, "#0b1428"], [1, "#1a2238"]) }];
  for (let i = 0; i < 90; i++) out.push({ shape: circle(r() * 1920, r() * 480, 1.2 + r() * 1.8, 8), fill: [0.92, 0.88, 0.78, 0.35 + 0.5 * r()] });
  // Far headland and the sea.
  out.push({ shape: polyline([0, 600, 260, 560, 520, 585, 760, 548, 1100, 590, 1920, 610, 1920, 1080, 0, 1080], true), fill: "#070a12" });
  out.push({ shape: rect(0, 620, 1920, 460), fill: lin(0, 620, 0, 1080, [0, "#0d1626"], [1, "#04060b"]) });
  for (let i = 0; i < 70; i++) { const y = 630 + r() * 440, x = r() * 1920; out.push({ shape: rect(x, y, 40 + r() * 160, 3 + r() * 3, 2), fill: [0.25, 0.32, 0.45, 0.25 + 0.3 * r()] }); }
  // The shore road.
  const road = HOUSES.flatMap((h) => [h.x - 40 * h.s, h.y + 18 * h.s]);
  out.push({ shape: polyline([...road, 1620, 1080, 0, 1080, 0, 700], true), fill: lin(0, 640, 0, 1080, [0, "#151820"], [1, "#0a0b10"]) });
  return out;
}

function house(h, lit, A) {
  const { x, y, s } = h, w = 120 * s, hh = 90 * s;
  return [
    { shape: rect(x - w / 2, y - hh, w, hh, 2), fill: lin(x - w / 2, 0, x + w / 2, 0, [0, "#3b3530"], [1, "#221e1c"]), stroke: "#0b0a0c", width: 3 * s },
    { shape: polyline([x - w / 2 - 10 * s, y - hh, x, y - hh - 60 * s, x + w / 2 + 10 * s, y - hh], true), fill: "#5a2a22", stroke: "#0b0a0c", width: 3 * s },
    { shape: rect(x - 18 * s, y - hh + 22 * s, 36 * s, 30 * s, 2), fill: [1, 0.78 * (0.4 + 0.6 * lit), 0.42 * lit, 0.25 + 0.75 * lit] },
    { shape: text(h.w, { atlas: A.atlas, size: Math.max(26, 44 * s), x, y: y + 52 * s + 10, anchor: "center" }).shape, fill: [0.95, 0.9, 0.8, 0.55 + 0.45 * lit] },
  ];
}

function lighthouse(t) {
  const [lx, ly] = LAMP, out = [];
  out.push({ shape: polyline([lx - 70, 1080, lx - 46, ly + 60, lx + 46, ly + 60, lx + 70, 1080], true), fill: lin(lx - 70, 0, lx + 70, 0, [0, "#d9cdb0"], [0.6, "#a99a80"], [1, "#5e5446"]), stroke: "#0b0a0c", width: 4 });
  for (const y of [560, 720, 880]) out.push({ shape: polyline([lx - 64 + (y - 400) * 0.0, y, lx + 64, y, lx + 66, y + 60, lx - 66, y + 60], true), fill: "#7a2620", opacity: 0.9 });
  out.push({ shape: rect(lx - 80, ly + 50, 160, 14, 2), fill: "#1a1714" });
  out.push({ shape: rect(lx - 44, ly - 40, 88, 90, 6), fill: [1, 0.86, 0.55, 0.9] });
  out.push({ shape: polyline([lx - 56, ly - 40, lx, ly - 96, lx + 56, ly - 40], true), fill: "#20201e", stroke: "#0b0a0c", width: 3 });
  const g = GUIDES.tallow, flame = 0.9 + 0.1 * Math.sin(t * 11);
  out.push(...pose(g.parts({ armR: 120 - 40 * smooth(0.2, 1.6, t), elbR: 40, prop: null, lid: 0.4, look: [-8, -2], flame, lean: -14 }), { x: lx + 118, y: ly + 52, s: 0.2, shear: g.shear }));
  return out;
}

// A beam from the lamp to a cottage: a wedge, additive, fading toward the far end.
function beam(h, k, A0 = 0.6) {
  const [lx, ly] = LAMP, dx = h.x - lx, dy = h.y - 40 * h.s - ly, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, half = 26 + 70 * h.s;
  const ex = lx + dx, ey = ly + dy;
  return { shape: polyline([lx + nx * 8, ly + ny * 8, ex + nx * half, ey + ny * half, ex - nx * half, ey - ny * half, lx - nx * 8, ly - ny * 8], true),
    blend: "add", fill: lin(lx, ly, ex, ey, [0, [1, 0.85, 0.55, A0 * k]], [1, [1, 0.7, 0.35, 0.15 * k]]) };
}

export default {
  title: "Attention proof A: painted coast", duration: 6, fps: 30,
  async load(ctx) { return loadAtlas(ctx); },
  frame(t, ctx) {
    const A = ctx.assets, r = rng(7), items = [...sky(r)];
    // 0 to 1.6 s: one beam sweeps along the road, looking. Then it splits into a beam per word.
    const sweep = smooth(0, 1.6, t), split = smooth(1.6, 3.0, t), carry = smooth(3.4, 5.0, t);
    const sweepAt = (1 - sweep) * (QUERY - 1);
    HOUSES.forEach((h) => {
      const near = Math.max(0, 1 - Math.abs(h.i - sweepAt) / 1.2) * (1 - split);
      const lit = Math.min(1, near + split * WEIGHTS[h.i] * 1.6);
      if (lit > 0.01) items.push(beam(h, near * 0.8 + split * WEIGHTS[h.i] * 1.5));
      items.push(...house(h, lit, A));
    });
    items.push(...lighthouse(t));
    // The cargo: the most attended cottage's word travels up its beam to the lamp.
    const best = HOUSES[WEIGHTS.slice(0, QUERY).indexOf(Math.max(...WEIGHTS.slice(0, QUERY)))];
    if (carry > 0 && carry < 1) {
      const x = best.x + (LAMP[0] - best.x) * carry, y = best.y - 60 * best.s + (LAMP[1] - best.y + 60 * best.s) * carry;
      items.push({ shape: rect(x - 22, y - 16, 44, 32, 3), fill: "#c08a4a", stroke: "#0b0a0c", width: 3 });
    }
    items.push({ shape: circle(LAMP[0], LAMP[1], 160, 64), blend: "add", fill: rad(LAMP[0], LAMP[1], 160, [0, [1, 0.8, 0.5, 0.5]], [1, [1, 0.6, 0.3, 0]]) });
    const hud = [{ shape: text("the  ->  " + (carry >= 1 ? best.w : "?"), { atlas: A.atlas, size: 56, x: LAMP[0], y: 200, anchor: "center" }).shape, fill: "#f1e4c8", screen: true },
      { shape: text("Each word looks back at the words before it.", { atlas: A.atlas, size: 34, x: 80, y: 1030 }).shape, fill: "#f1e4c8", screen: true },
      { shape: text("illustration: hand-set scores", { atlas: A.atlas, size: 22, x: 80, y: 70 }).shape, fill: "#b29d7e", screen: true }];
    return { background: [0.02, 0.022, 0.03], camera: { x: 960 + 40 * smooth(0, 6, t), y: 540, zoom: 1 + 0.06 * smooth(0, 6, t) }, items: [...items, ...hud],
      post: { bloom: 0.08, threshold: 1.0, vignette: 0.3, grain: 0, passes: [{ pass: "paint", preset: "oil-grotesque" }] } };
  },
};
