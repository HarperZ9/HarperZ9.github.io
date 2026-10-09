// Segment 5, "Where the gap can close" (Hardwicke et al. 2018).
// A time axis on a log scale. Claiming sits under a second and one peer review
// at about six hours; nothing is said about the ratio. When the data travel
// with the claim, a check is a rerun: the 35 papers that shared their data,
// with the authors' own estimates of the hours a check took drawn as bands on
// the same axis, and the 13 papers with a number nobody could reproduce.
import { contour, trim } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, rect, line, arc, arrow, dashed } from "./lib.mjs";

// Log axis: 0.1 s to about 3 months.
const X0 = 180, X1 = 1740, L0 = -1, L1 = 6.9, Y = 400;
export const X = (sec) => X0 + (X1 - X0) * ((Math.log10(sec) - L0) / (L1 - L0));
const H = 3600;
const TICKS = [[1, "1 s"], [60, "1 min"], [H, "1 hour"], [24 * H, "1 day"], [7 * 24 * H, "1 week"], [30 * 24 * H, "1 month"]];
const GRID = { x: 1240, y: 720, s: 46, cols: 7 };

export function prepare(A) {
  const lab = (s, x, y, o = {}) => text(s, { atlas: A.sans, size: 28, x, y, anchor: "center", ...o }).shape;
  A.s5 = {
    ticks: TICKS.map(([s, l]) => ({ x: X(s), shape: lab(l, X(s), Y + 44) })),
    minor: [],
    claim: lab("claiming: under a second", X(0.8), Y - 112, { size: 32 }),
    review: lab("one peer review: about 6 hours", X(6 * H), Y - 112, { size: 32 }),
    gap: lab("the gap closes from the checking side", (X(0.8) + X(6 * H)) / 2, Y - 196, { size: 34 }),
    rerun: text("data travels with the claim: a check becomes a rerun", { atlas: A.sans, size: 32, x: X0, y: 600 }).shape,
    papers: text("35 psychology papers that shared their data", { atlas: A.sans, size: 28, x: GRID.x - 14, y: GRID.y - 30 }).shape,
    reproduced: text("reproduced: 2 to 4 person hours", { atlas: A.sans, size: 28, x: X(2 * H), y: Y + 120 }).shape,
    helped: text("with the authors' help: 5 to 25, and weeks of waiting", { atlas: A.sans, size: 28, x: X(5 * H), y: Y + 182 }).shape,
    missed: text("13 of 35: a number not reproduced", { atlas: A.sans, size: 28, x: GRID.x - 14, y: GRID.y + 5 * GRID.s + 30 }).shape,
    none: text("none of those misses clearly changed a conclusion", { atlas: A.sans, size: 30, x: 960, y: 1010, anchor: "center" }).shape,
    est: text("hours: the authors' estimates, not measurements", { atlas: A.sans, size: 22, x: X0, y: Y + 232 }).shape,
  };
  for (let d = L0; d < L1; d++) for (let k = 2; k < 10; k++) { const x = X(k * Math.pow(10, d)); if (x < X1) A.s5.minor.push(contour([x, Y - 6, x, Y + 6], false)); }
}

// The claim card with its data attached, and the rerun loop around them.
function icon(x, y, u) {
  const card = rect(x - 70, y - 40, 120, 80, 6);
  const bars = [0.8, 0.65, 0.75].flatMap((w, k) => rect(x - 58, y - 24 + k * 20, 96 * w, 8, 3));
  const data = [...rect(x + 58, y - 30, 40, 60, 4), contour([x + 58, y - 12, x + 98, y - 12], false), contour([x + 58, y + 6, x + 98, y + 6], false)];
  return { card, bars, data, loop: arc(x + 10, y, 110, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u * 0.92, 96) };
}
export { icon };

export function draw(t, A, T, items) {
  const S = A.s5;
  const vis = window(t, T.enter, T.exit, 0.8, 1.0);
  if (vis <= 0) return;
  const put = (shape, color, o, extra = {}) => { if (o > 0) items.push({ shape, fill: color, opacity: o * vis, screen: true, ...extra }); };
  const st = (shape, color, w, o) => { if (o > 0) items.push({ shape, stroke: color, width: w, opacity: o * vis, screen: true }); };
  // The axis draws on, then its ticks.
  const ax = span(t, T.enter, T.enter + 1.6, ease.inOut);
  st(trim([contour([X0, Y, X1, Y], false)], 0, ax), C.ink2, 1.6, 1);
  st(S.minor, C.faint, 1.2, span(t, T.enter + 0.8, T.enter + 1.8));
  S.ticks.forEach((k, i) => { const o = span(t, T.enter + 0.6 + i * 0.12, T.enter + 1.2 + i * 0.12); st([contour([k.x, Y - 14, k.x, Y + 14], false)], C.ink2, 1.6, o); put(k.shape, C.ink2, o); });
  // Two marks: claiming and one review.
  const marks = span(t, T.enter + 1.4, T.enter + 2.4, ease.out);
  for (const [sec, shape] of [[0.8, S.claim], [6 * H, S.review]]) {
    st([contour([X(sec), Y - 80, X(sec), Y], false)], C.ink, 2, marks);
    put(rect(X(sec) - 7, Y - 7, 14, 14, 7), C.ink, marks);
    put(shape, C.ink, marks);
  }
  const gapA = window(t, T.enter + 2.6, T.rerun - 0.1, 0.6, 0.5);
  if (gapA > 0) {
    st(arrow(X(6 * H) - 20, Y - 150, X(6 * H) - 20 - 520 * span(t, T.enter + 2.6, T.enter + 4.2, ease.inOut) - 1, Y - 150, 14), C.ink, 2, gapA);
    put(S.gap, C.ink, gapA);
  }
  // The rerun: card and data, and a loop that keeps turning.
  const ic = span(t, T.rerun, T.rerun + 1.0, ease.out);
  if (ic > 0) {
    const g = icon(360, 820, (t - T.rerun) * 0.45 % 1);
    st(g.card, C.ink2, 1.8, ic); put(g.bars, C.dim, ic * 0.8); st(g.data, C.ok, 1.8, ic);
    st(g.loop, C.ink2, 2, ic * window(t, T.rerun + 0.6, T.exit, 0.4, 0.4) * (1 + 0.6 * window(t, T.none, T.exit, 0.4, 0.4)));
    put(S.rerun, C.ink, window(t, T.rerun, T.papers + 0.2, 0.5, 0.5));
  }
  // The 35 papers, filled as the voice reaches each group.
  const pA = span(t, T.papers, T.papers + 1.2, ease.out);
  if (pA > 0) {
    put(S.papers, C.ink2, pA);
    for (let i = 0; i < 35; i++) {
      const x = GRID.x + (i % GRID.cols) * GRID.s, y = GRID.y + Math.floor(i / GRID.cols) * GRID.s;
      const grp = i < 11 ? 0 : i < 22 ? 1 : 2, at = [T.quick, T.help, T.missed][grp] + 0.4 + (i % 11) * 0.05;
      const f = span(t, at, at + 0.5, ease.out), col = [C.ok, C.ink2, C.hot][grp];
      st(rect(x, y, 36, 36, 4), C.ink2, 1.6, pA * span(t, T.papers + i * 0.02, T.papers + 0.4 + i * 0.02));
      if (f > 0) put(rect(x + 4, y + 4, 28, 28, 3), col, f);
    }
    put(S.missed, C.hot, span(t, T.missed + 0.8, T.missed + 1.6));
  }
  // The authors' hour estimates as bands on the same axis.
  const band = (a, b, y, col, o) => { put(rect(X(a), y - 10, Math.max(2, X(b) - X(a)), 20, 4), col, o * 0.9); };
  const q = span(t, T.quick, T.quick + 1.0, ease.out), hlp = span(t, T.help, T.help + 1.0, ease.out);
  band(2 * H, 4 * H, Y + 84, C.ok, q); put(S.reproduced, C.ok, q);
  band(5 * H, 25 * H, Y + 146, C.ink2, hlp); put(S.helped, C.ink2, hlp);
  st(dashed(X(25 * H) + 6, Y + 146, lerp(X(25 * H) + 6, X(21 * 24 * H), hlp), Y + 146, 8, 8), C.ink2, 2, hlp * 0.8);
  put(S.est, C.dim, Math.max(q, hlp) * 0.9);
  put(S.none, C.ink, window(t, T.none, T.exit, 0.6, 0.6));
}
