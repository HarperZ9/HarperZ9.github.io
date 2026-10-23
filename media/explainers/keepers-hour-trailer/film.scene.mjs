// The Keeper's Hour trailer, Motion layer (84 s: 21 lamp sweeps). Every word on screen is one of the game's own lines
// (film.json, from night.txt, CC BY 4.0), one card per shot, cut to the lamp: one sweep is
// four seconds (kh_world.c). The game's frames are not drawn here; they come from the game's
// fixed-step recorder and trailer.py lays this layer over them. In the footage sweeps this scene
// draws only the cards' words, in bone on black, so assemble.py can read their coverage
// exactly. The last two sweeps are full frames: the title with one beam in the dark, then the end
// card, where Tallow, the host, appears once.
import { text } from "../../raw-native/tree-c6b114d/web/motion/text.mjs";
import { rect, contour } from "../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { span, window, ease, lerp } from "../../raw-native/tree-c6b114d/web/motion/timeline.mjs";
import { GUIDES, pose } from "../../raw-native/tree-c6b114d/templates/guides/guides.mjs";
import { clipBeat, CLIPS } from "../../raw-native/tree-c6b114d/templates/guides/motion.mjs";

export const BONE = "#ece5d6", DIM = "#b8b0a0";
const SWEEP = 4, X = 120, MAXW = 1180;

// Greedy word wrap with the atlas's own advances.
function wrap(str, atlas, size, maxw) {
  const words = str.split(" "), lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (cur && text(next, { atlas, size }).width > maxw) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export default {
  title: "The Keeper's Hour trailer",
  duration: 84,   // replaced in load() by film.json's duration (sweeps x 4 s)
  fps: 30,
  design: [1920, 1080],
  chapters: [],
  params: [],
  async load(ctx) {
    const [sans, head, mono, film] = await Promise.all([ctx.json("../motion/hanken-500.json"), ctx.json("../motion/hanken-650.json"),
      ctx.json("../motion/conso-400.json"), ctx.json("film.json")]);
    const cards = film.segments.filter((s) => s.lines.length).map((s) => {
      // A card may set its own wrap width (film.json segment card.maxw) to keep clear of a bright
      // part of its shot; PROGRESS.md records each choice.
      const size = 50, lines = wrap(s.lines[0], sans, size, (s.card && s.card.maxw) || MAXW);
      return { t0: (s.sweeps[0] - 1) * SWEEP, t1: s.sweeps[1] * SWEEP, speaker: text(s.speaker, { atlas: mono, size: 32, x: X, y: 150 }).shape,
        lines: lines.map((l, k) => text(l, { atlas: sans, size, x: X, y: 226 + k * 66 }).shape), text: lines };
    });
    const check = film.segments.find((s) => s.speaker === "UI");
    const end = film.segments.find((s) => s.key === "end-card");
    const titleSeg = film.segments.find((s) => s.key === "title");
    this.duration = film.duration;
    const credit = end.card.slice(1, 3).flatMap((c) => wrap(c, sans, 30, 1100));
    return {
      cards,
      // The dialogue-box sweep may carry a kind label like the cards' speaker names (film.json card.kind), or none.
      checkTag: { t0: (check.sweeps[0] - 1) * SWEEP, t1: check.sweeps[1] * SWEEP, shape: check.card && check.card.kind ? text(check.card.kind, { atlas: mono, size: 32, x: X, y: 150 }).shape : null },
      title: text("The Keeper's Hour", { atlas: head, size: 104, x: 960, y: 500, anchor: "center" }).shape,
      facts: text(end.card[0], { atlas: head, size: 48, x: X, y: 200 }).shape,
      credit: credit.map((l, k) => text(l, { atlas: sans, size: 30, x: X, y: 290 + k * 44 }).shape),
      link: text(end.card[3], { atlas: mono, size: 30, x: X, y: 290 + credit.length * 44 + 40 }).shape,
      note: text("Moving frames recorded from the game at a fixed step, on BRender's software rasteriser.", { atlas: sans, size: 26, x: X, y: 290 + credit.length * 44 + 104 }).shape,
      cardText: cards.map((c) => c.text.join(" ")), endText: end.card,
      T0: (titleSeg.sweeps[0] - 1) * SWEEP, E0: (end.sweeps[0] - 1) * SWEEP, END: film.duration,
    };
  },
  frame(t, ctx) {
    const A = ctx.assets, items = [];
    const put = (shape, fill, o) => { if (o > 0.004) items.push({ shape, fill, opacity: Math.min(1, o), screen: true }); };
    for (const c of A.cards) {
      const a = window(t, c.t0, c.t1, 0.35, 0.3);
      if (a <= 0) continue;
      put(c.speaker, DIM, a);
      c.lines.forEach((s) => put(s, BONE, a));
    }
    if (A.checkTag.shape) put(A.checkTag.shape, DIM, window(t, A.checkTag.t0 + 0.35, A.checkTag.t1 - 0.25, 0.5, 0.45));
    // The title sweep: black, the beam crosses once (the trailer's one warm-white), the title lands.
    const T0 = A.T0, E0 = A.E0, END = A.END;
    if (t >= T0 && t < T0 + SWEEP) {
      const u = (t - T0) / SWEEP, a = -1.2 + u * 2.4, cx = 960, cy = 1400;
      const ray = (w) => contour([cx, cy, cx + Math.sin(a - w) * 2600, cy - Math.cos(a - w) * 2600, cx + Math.sin(a + w) * 2600, cy - Math.cos(a + w) * 2600], true);
      items.push({ shape: [ray(0.06)], fill: { radial: [cx, cy, 2400], stops: [[0, [1, 0.93, 0.78, 0.5]], [1, [1, 0.93, 0.78, 0]]] }, blend: "add", screen: true, blur: 30 });
      put(A.title, BONE, span(t, T0 + 1.0, T0 + 2.2) * (1 - span(t, T0 + 3.6, T0 + 4)));
    }
    // The last sweep: the end card. Tallow holds his flame up to the credit line, then lets you go.
    if (t >= E0) {
      const a = span(t, E0 + 0.1, E0 + 0.8) * (1 - span(t, END - 0.6, END));
      put(A.facts, BONE, a);
      A.credit.forEach((s) => put(s, DIM, a));
      put(A.link, BONE, a);
      put(A.note, DIM, a * 0.9);
      const g = GUIDES.tallow, b = { x: 1600, y: 1020, s: 0.62 };
      const beat = clipBeat("tallow", "idle", { ...b, o: { prop: null, armR: 150, elbR: 30, lid: 0.3, look: [-8, -4], lean: -14 } }, (t - E0) % CLIPS.idle);
      const x = b.x + beat.offset[0], y = b.y + beat.offset[1];
      for (const it of [...g.under(x, y, b.s, "thriller"), ...pose(g.parts(beat.o), { x, y, s: b.s, shear: g.shear }), ...g.light("painted", { x: 960, y: 540, zoom: 1 }, { x, y, s: b.s, o: beat.o })])
        items.push({ ...it, opacity: (it.opacity ?? 1) * a, screen: true });
    }
    return { background: [0, 0, 0], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0, vignette: 0, grain: 0 } };
  },
};
