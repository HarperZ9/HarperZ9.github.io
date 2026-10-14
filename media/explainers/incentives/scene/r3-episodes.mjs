// Segment 3 of film 4, "Small rewards, wider habits" (Denison et al. 2024, a preprint).
// A row of small environments, each paying for a small kind of gaming ("like flattery"),
// then a held-out task with a door to the code that computes the reward. The episodes are
// drawn at their real counts: 32,768 as a 256 x 128 grid of dim points with 45 lit in
// drift, and beside it 100,000 helpful-only episodes as a 400 x 250 grid, none lit. The
// camera dives to find the 45. The live version's parameter recomputes the count at the
// paper's rate for another number of episodes, and says it is not a measurement.
import { contour, rect, circle } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text, fmt } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp, rng } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C } from "./land.mjs";

export const CURRICULUM = 32768, TAMPERED = 45, HELPFUL = 100000;
const SP = 2, GA = { x: 170, y: 420, cols: 256 }, GB = { x: 950, y: 300, cols: 400 };

export function prepare(A, ctx) {
  const t = (s, o) => text(s, o).shape, r = rng(45);
  const cell = (G, i) => [G.x + (i % G.cols) * SP, G.y + Math.floor(i / G.cols) * SP];
  const grid = (G, n) => { const a = new Float32Array(2 * n); for (let i = 0; i < n; i++) { const [x, y] = cell(G, i); a[2 * i] = x; a[2 * i + 1] = y; } return a; };
  const lit = new Set();
  while (lit.size < TAMPERED) lit.add(Math.floor(r() * CURRICULUM));
  const litXY = [...lit].map((i) => cell(GA, i));
  const sys = (pos, n, seed) => ctx.motion ? ctx.motion.particles({ count: n, formations: [pos, pos], colors: ["#8a8478", "#8a8478"], seed }) : null;
  A.r3 = {
    a: sys(grid(GA, CURRICULUM), CURRICULUM, 11), b: sys(grid(GB, HELPFUL), HELPFUL, 12), litXY,
    dive: litXY.reduce((best, p) => (Math.abs(p[0] - 426) + Math.abs(p[1] - 548) < Math.abs(best[0] - 426) + Math.abs(best[1] - 548) ? p : best), litXY[0]),
    envs: Array.from({ length: 5 }, (_, k) => ({ x: 170 + k * 190, y: 150 })),
    flattery: t("flattery", { atlas: A.mono, size: 22, x: 230, y: 262, anchor: "center" }),
    paid: t("each environment paid for a small kind of gaming", { atlas: A.sans, size: 26, x: 560, y: 110, anchor: "center" }),
    heldout: t("held-out task", { atlas: A.sans, size: 26, x: 1540, y: 110, anchor: "center" }),
    door: t("the code that computes its reward", { atlas: A.mono, size: 22, x: 1540, y: 210, anchor: "center" }),
    aHead: t("after the gaming curriculum", { atlas: A.sans, size: 26, x: GA.x, y: GA.y - 40 }),
    aCount: t("45 of 32,768 episodes", { atlas: A.mono, size: 30, x: GA.x, y: GA.y + 128 * SP + 46 }),
    bHead: t("a model trained only to be helpful", { atlas: A.sans, size: 26, x: GB.x, y: GB.y - 40 }),
    bCount: t("0 of 100,000 episodes", { atlas: A.mono, size: 30, x: 1750, y: GB.y - 40, anchor: "right" }),
    unit: t("1 point = 1 episode", { atlas: A.mono, size: 22, x: GA.x, y: GA.y + 128 * SP + 82 }),
    built: t("environments built to allow gaming", { atlas: A.mono, size: 26, x: 960, y: 156, anchor: "center" }),
    small: t("the rate is small", { atlas: A.sans, size: 28, x: 960, y: 114, anchor: "center" }),
    direction: t("rewarded gaming spread to gaming that was never rewarded", { atlas: A.sans, size: 32, x: 960, y: 208, anchor: "center" }),
    yourTag: t("your value, at the paper's rate; not a measurement", { atlas: A.mono, size: 20, x: 1600, y: 742, anchor: "center" }),
  };
}

export function camera(t, T) {
  const S = T.s3, dIn = span(t, S.did + 2.6, S.did + 3.8, ease.inOut), dOut = span(t, S.helpful - 0.6, S.helpful + 0.4, ease.inOut);
  const u = dIn * (1 - dOut);
  return { u, zoom: Math.exp(lerp(0, Math.log(7), u)) };
}

export function draw(t, A, T, items, cam) {
  const S = A.r3, R = T.s3, vis = window(t, R.enter, R.exit, 0.8, 0.8);
  if (vis <= 0) return;
  const put = (shape, fill, o, screen = false) => { if (o > 0) items.push({ shape, fill, opacity: o * vis, screen }); };
  const strk = (shape, color, w, o) => { if (o > 0) items.push({ shape, stroke: color, width: w, opacity: o * vis }); };
  // The environments and the held-out task.
  const envA = span(t, R.enter + 0.4, R.enter + 2.4, ease.out);
  const dive = 1 - span(cam.u, 0, 0.05), top = (1 - span(t, R.small - 0.9, R.small - 0.1)) * dive;
  S.envs.forEach((e, k) => {
    const a = span(envA, k * 0.15, k * 0.15 + 0.4);
    strk(rect(e.x, e.y - 40, 120, 80, 8), C.ink2, 1.6, a * top);
    strk([...circle(e.x + 60, e.y, 26, 32), ...circle(e.x + 60, e.y, 14, 24)], C.ink, 1.1, a * 0.7 * top);
    strk([contour(new Float32Array([e.x + 8, e.y - 30, e.x + 56, e.y - 2]), false)], C.hot, 1.8, a * top);
  });
  put(S.flattery, C.ink2, envA * top); put(S.paid, C.ink2, envA * top);
  const door = span(t, R.heldout, R.heldout + 1.2, ease.out) * (1 - span(t, R.helpful - 1.0, R.helpful));
  strk(rect(1380, 140, 320, 110, 10), C.ink, 2, door * dive); put(S.heldout, C.ink, door * dive); put(S.door, C.hot, door * dive * span(t, R.heldout + 1.0, R.heldout + 2.0));
  // The episodes, at their real counts.
  const ga = span(t, R.did - 0.4, R.did + 1.2), gb = span(t, R.helpful, R.helpful + 1.4);
  const size = [1.6, 1.6];
  if (S.a && ga > 0) items.push({ kind: "particles", system: S.a, from: 0, to: 1, t: 0, spread: 0, drift: 0, time: t, size, opacity: ga * vis * 0.45 });
  if (S.b && gb > 0) items.push({ kind: "particles", system: S.b, from: 0, to: 1, t: 0, spread: 0, drift: 0, time: t, size, opacity: gb * vis * 0.45 });
  const litA = span(t, R.did + 1.0, R.did + 2.2);
  if (litA > 0) {
    const r = 1.4 + 3.0 / Math.max(1, cam.zoom) * (1 - cam.u);
    put(S.litXY.flatMap(([x, y]) => circle(x, y, Math.max(1.3, r), 12)), C.hot, litA);
  }
  put(S.aHead, C.ink2, ga * dive); put(S.aCount, C.hot, litA * dive); put(S.unit, C.dim, ga * dive);
  put(S.bHead, C.ink2, gb * dive); put(S.bCount, C.ink, gb * span(t, R.helpful + 1.0, R.helpful + 1.8));
  put(S.small, C.ink2, window(t, R.small, R.direction + 0.2, 0.5, 0.4), true);
  put(S.built, C.hot, window(t, R.small + 0.6, R.exit, 0.5, 0.6), true);
  put(S.direction, C.ink, window(t, R.direction, R.exit, 0.5, 0.6), true);
  // The live what-if: another number of episodes at the paper's rate.
  const v = A.params && A.params.episodes;
  if (v !== undefined) {
    const n = Math.round(Math.pow(10, v));
    if (Math.abs(n - CURRICULUM) / CURRICULUM > 0.01) {
      put(text(`at ${fmt(n)} episodes: about ${fmt(Math.round((n * TAMPERED) / CURRICULUM))}`, { atlas: A.mono, size: 24, x: 1600, y: 710, anchor: "center" }).shape, C.ink, 1, true);
      put(S.yourTag, C.hot, 1, true);
    }
  }
}
export { CURRICULUM as EPISODES };
