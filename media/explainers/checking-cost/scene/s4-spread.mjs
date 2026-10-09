// Segment 4, "Faster than the check" (Vosoughi, Roy and Aral 2018).
// The square of hours collapses to a point and bursts into 126,000 points, one
// per rumor cascade the study followed. Two cascades then grow side by side:
// the false one reaches 1,500 people, and the true one keeps growing for six
// times as long, in real time on screen, before it gets there. Bots sit in both
// trees at the same rate. Then the adage is drawn as an outline and set aside.
// The trees are drawn for illustration; their sizes and the 1x to 6x timing
// follow the paper's figures, their shapes do not.
import { contour, trim } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text, fmt } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, rng, lerp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, rect, line, scrim } from "./lib.mjs";

const N = 126000, PEOPLE = 1500, AX0 = 360, AX1 = 1560, AXY = 940;
const ROOTS = [[640, 520], [1280, 520]];

function tree(seed, rootX, rootY) {
  const r = rng(seed), px = new Float32Array(2 * PEOPLE), ang = new Float32Array(PEOPLE), parent = new Int32Array(PEOPLE), depth = new Int32Array(PEOPLE);
  px[0] = rootX; px[1] = rootY; parent[0] = -1;
  for (let i = 1; i < PEOPLE; i++) {
    const p = Math.floor(Math.pow(r(), 1.8) * i);
    parent[i] = p; depth[i] = depth[p] + 1;
    const a = (p === 0 ? r() * Math.PI * 2 : ang[p] + (r() - 0.5) * 1.5);
    ang[i] = a;
    const len = 34 / Math.sqrt(1 + depth[i] * 0.9) * (0.6 + 0.8 * r());
    px[2 * i] = px[2 * p] + Math.cos(a) * len; px[2 * i + 1] = px[2 * p + 1] + Math.sin(a) * len;
  }
  // Fit inside a radius of 250 around the root.
  let m = 1;
  for (let i = 0; i < PEOPLE; i++) m = Math.max(m, Math.hypot(px[2 * i] - rootX, px[2 * i + 1] - rootY));
  for (let i = 0; i < PEOPLE; i++) { px[2 * i] = rootX + (px[2 * i] - rootX) * 250 / m; px[2 * i + 1] = rootY + (px[2 * i + 1] - rootY) * 250 / m; }
  return { px, parent };
}

export function prepare(A, ctx) {
  const r = rng(126000);
  A.s4 = {
    trees: [tree(11, ...ROOTS[0]), tree(29, ...ROOTS[1])],
    cascades: text("about 126,000 rumor cascades on Twitter, 2006 to 2017", { atlas: A.sans, size: 30, x: 960, y: 1000, anchor: "center" }).shape,
    falseL: text("false", { atlas: A.head, size: 34, x: ROOTS[0][0], y: 200, anchor: "center" }).shape,
    trueL: text("true", { atlas: A.head, size: 34, x: ROOTS[1][0], y: 200, anchor: "center" }).shape,
    retweet: text("false stories: 70% more likely to be retweeted", { atlas: A.sans, size: 28, x: 960, y: 120, anchor: "center" }).shape,
    bots: text("bots (squares) spread true and false at the same rate", { atlas: A.sans, size: 28, x: 960, y: 120, anchor: "center" }).shape,
    axis: text("time to reach 1,500 people", { atlas: A.sans, size: 26, x: AX0, y: AXY + 44 }).shape,
    one: text("1x", { atlas: A.mono, size: 26, x: lerp(AX0, AX1, 1 / 6), y: AXY - 18, anchor: "center" }).shape,
    six: text("about 6x as long", { atlas: A.mono, size: 26, x: AX1, y: AXY - 18, anchor: "right" }).shape,
    illus: text("trees drawn for illustration", { atlas: A.sans, size: 22, x: AX1, y: AXY + 44, anchor: "right" }).shape,
    spread: text("That study measures spread, not cost.", { atlas: A.sans, size: 34, x: 960, y: 120, anchor: "center" }).shape,
    adage: text("refuting = 10 × making", { atlas: A.head, size: 96, x: 960, y: 560, anchor: "center" }).shape,
    adageTag: text("an adage", { atlas: A.sans, size: 30, x: 960, y: 640, anchor: "center" }).shape,
    never: text("never measured", { atlas: A.sans, size: 30, x: 960, y: 690, anchor: "center" }).shape,
  };
  if (!ctx.motion) return;
  // The cascade field: a burst from a point to a disc with faint spiral arms.
  const a = new Float32Array(2 * N), b = new Float32Array(2 * N), delay = new Float32Array(N), size = new Float32Array(N);
  const col = new Uint32Array(N);
  for (let i = 0; i < N; i++) {
    const rad = Math.pow(r(), 0.62) * 470, arm = Math.floor(r() * 3), th = r() * Math.PI * 2 * 0.35 + arm * 2.094 + rad * 0.006 + (r() - 0.5) * 0.9;
    a[2 * i] = 960 + (r() - 0.5) * 2; a[2 * i + 1] = 540 + (r() - 0.5) * 2;
    b[2 * i] = 960 + Math.cos(th) * rad * 1.45; b[2 * i + 1] = 540 + Math.sin(th) * rad * 0.82;
    delay[i] = r(); size[i] = 0.7 + 0.6 * r();
    const g = 0.55 + 0.45 * r();
    col[i] = packInk(g, 1);
  }
  A.s4.field = ctx.motion.particles({ count: N, formations: [a, b], colors: [col, col], delay, size, seed: 4 });
  // Tree nodes as particles: each grows out of its parent when it is born.
  A.s4.nodes = A.s4.trees.map((T, k) => {
    const pa = new Float32Array(2 * PEOPLE), d = new Float32Array(PEOPLE);
    for (let i = 0; i < PEOPLE; i++) {
      const p = Math.max(0, T.parent[i]);
      pa[2 * i] = T.px[2 * p]; pa[2 * i + 1] = T.px[2 * p + 1];
      d[i] = born(i) / 0.96;           // spread 0.04: start = k (1 - 0.04)
    }
    const c = k === 0 ? "#e29472" : "#ece5d6";
    return ctx.motion.particles({ count: PEOPLE, formations: [pa, T.px], colors: [c, c], delay: d, seed: 7 + k });
  });
}
function packInk(g, a) {
  const b = (x) => Math.max(0, Math.min(255, Math.round(x * 255)));
  return (b(0.925 * g) | (b(0.898 * g) << 8) | (b(0.839 * g) << 16) | (b(a) << 24)) >>> 0;
}
// When node i is born, as a fraction of the time to reach 1,500 (growth is exponential).
const born = (i) => Math.log(i + 1) / Math.log(PEOPLE);

export function draw(t, A, T, items) {
  const S = A.s4;
  const vis = window(t, T.enter, T.exit, 0.3, 1.0);
  if (vis <= 0) return;
  const scr = (shape, color, o, plate = false) => {
    if (o <= 0) return;
    if (plate) items.push({ ...scrim(shape), opacity: 0.7 * o * vis });
    items.push({ shape, fill: color, opacity: o * vis, screen: true });
  };
  const burst = span(t, T.enter + 0.2, T.enter + 4.8, ease.linear), dimU = span(t, T.race - 0.6, T.race + 0.8, ease.inOut);
  if (S.field) items.push({ kind: "particles", system: S.field, from: 0, to: 1, t: burst, spread: 0.55, drift: 3, time: t, size: [0.9, 1.5], blend: "add",
    opacity: vis * lerp(0.6, 0.12, dimU) * (1 - 0.6 * span(t, T.adage - 0.6, T.adage + 0.6)) });
  const count = Math.round(N * span(t, T.cascades, T.cascades + 3.5, ease.out));
  if (count > 0) scr(text(`${fmt(count)} cascades`, { atlas: A.mono, size: 40, x: 960, y: 140, anchor: "center" }).shape, C.ink, window(t, T.cascades, T.race - 0.2, 0.3, 0.5));
  scr(S.cascades, C.ink2, window(t, T.cascades, T.race - 0.2, 0.6, 0.5));
  // The race: progress of each tree toward 1,500 people.
  const grow = (k) => span(t, T.race + 0.6, T.race + 0.6 + (k === 0 ? 1 : 6) * 2.45, ease.linear);
  const raceA = window(t, T.race, T.exit, 0.6, 0.8) * (1 - 0.55 * span(t, T.spread, T.spread + 1.2)) * (1 - 0.6 * span(t, T.adage - 0.6, T.adage + 0.6));
  if (raceA > 0) {
    for (let k = 0; k < 2; k++) {
      const u = grow(k), n = Math.min(PEOPLE, Math.floor(Math.pow(PEOPLE, u)));
      const tr = S.trees[k], col = k === 0 ? C.hot : C.ink, edges = [], bots = [];
      for (let i = 1; i < n; i++) {
        const p = tr.parent[i], f = Math.min(1, (u - born(i)) / 0.04);
        const x = lerp(tr.px[2 * p], tr.px[2 * i], f), y = lerp(tr.px[2 * p + 1], tr.px[2 * i + 1], f);
        edges.push(contour([tr.px[2 * p], tr.px[2 * p + 1], x, y], false));
        if (i % 11 === 5 && f >= 1) bots.push(...rect(x - 3.5, y - 3.5, 7, 7));
      }
      if (edges.length) items.push({ shape: edges, stroke: col, width: 0.9, opacity: raceA * 0.55 });
      if (S.nodes) items.push({ kind: "particles", system: S.nodes[k], from: 0, to: 1, t: u, spread: 0.04, drift: 0, time: t, size: [0, 4.2], blend: "add", opacity: raceA * vis });
      const botA = span(t, T.bots, T.bots + 1.0) * raceA;
      if (botA > 0 && bots.length) items.push({ shape: bots, stroke: C.ink, width: 1.4, opacity: botA });
      scr(text(`${fmt(n)} people`, { atlas: A.mono, size: 30, x: ROOTS[k][0], y: 840, anchor: "center" }).shape, k === 0 ? C.hot : C.ink, raceA);
    }
    scr(S.falseL, C.hot, raceA); scr(S.trueL, C.ink, raceA);
    // The time axis: a marker per tree runs until its tree reaches 1,500.
    items.push({ shape: line(AX0, AXY, AX1, AXY), stroke: C.ink2, width: 1.5, opacity: raceA * vis, screen: true });
    for (let k = 0; k < 2; k++) {
      const u = grow(k), x = lerp(AX0, AX1, (k === 0 ? 1 / 6 : 1) * u);
      items.push({ shape: rect(x - 5, AXY - 5, 10, 10, 5), fill: k === 0 ? C.hot : C.ink, opacity: raceA * vis, screen: true });
    }
    scr(S.one, C.hot, raceA * span(grow(0), 0.98, 1));
    scr(S.six, C.ink, raceA * span(grow(1), 0.98, 1));
    scr(S.axis, C.ink2, raceA);
    scr(S.illus, C.dim, raceA);
  }
  scr(S.retweet, C.ink, window(t, T.race + 0.4, T.bots - 0.1, 0.5, 0.4), true);
  scr(S.bots, C.ink, window(t, T.bots, T.spread - 0.1, 0.5, 0.4), true);
  scr(S.spread, C.ink, window(t, T.spread, T.exit, 0.5, 0.6), true);
  // The adage: an outline only, then taken apart.
  const ad = span(t, T.adage, T.adage + 2.0, ease.inOut), gone = span(t, T.never + 0.9, T.never + 2.2, ease.inOut);
  if (ad > 0) items.push({ ...scrim(S.adage, 0.6, 30), opacity: 0.6 * vis * Math.min(ad, 1 - gone) }, { shape: trim(S.adage, gone, ad), stroke: C.ink, width: 2, opacity: vis, screen: true });
  scr(S.adageTag, C.ink2, window(t, T.adage + 1.0, T.exit, 0.5, 0.6), true);
  scr(S.never, C.unv, window(t, T.never, T.exit, 0.5, 0.6), true);
}
