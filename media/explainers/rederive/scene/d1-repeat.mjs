// Film 3: the title, segment 1 "A result on the page", and segment 2 "A hundred studies,
// run again" (Open Science Collaboration 2015). The title prints, and a cyan negative of
// it slides in off-register and locks. One paper with one effect; "trust it" is a stamp,
// "run it again" is a negative exposing over two seconds. Then 100 cards, one per study:
// 97 carry a positive mark; a negative exposes over the 97; 35 come back as doubled lines
// and 62 fade to graphite with a drift edge. The effect sizes are means with one-SD bars,
// tagged as such: the sources give means and SDs, not distributions.
import { rect, circle, contour } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, at, card, grid, spread } from "./print.mjs";

const N = 100, POS = 97, BACK = 35, CW = 76, CH = 52, GX = 520, GY = 120;

export function prepare(A) {
  const t = (s, o) => text(s, o).shape;
  const page = { edge: rect(300, 170, 560, 720, 8), bars: [] };
  [0.9, 0.7].forEach((f, k) => page.bars.push(...rect(340, 220 + k * 34, 480 * f, 16, 3)));
  for (let k = 0; k < 11; k++) page.bars.push(...rect(340, 330 + k * 26, 480 * (0.6 + 0.4 * Math.abs(Math.sin(k * 1.7))), 8, 2));
  const back = spread(BACK, POS);
  A.d1 = {
    title: [t("Re-derive it.", { atlas: A.head, size: 72, x: 960, y: 500, anchor: "center" }), t("Don't take it on trust.", { atlas: A.head, size: 72, x: 960, y: 590, anchor: "center" })],
    page, effect: rect(340, 650, 380, 26, 4),
    effectL: t("the effect", { atlas: A.mono, size: 24, x: 734, y: 670 }),
    published: t("published", { atlas: A.mono, size: 22, x: 580, y: 860, anchor: "center" }),
    trust: t("trust it", { atlas: A.sans, size: 34, x: 1180, y: 330 }),
    rerun: t("run it again", { atlas: A.sans, size: 34, x: 1180, y: 600 }),
    fast: t("fast", { atlas: A.mono, size: 24, x: 1180, y: 372 }),
    slow: t("slow; the only one that can say no", { atlas: A.mono, size: 24, x: 1180, y: 642 }),
    stamp: rect(1420, 290, 200, 80, 12),
    mini: card(180, 130, [0.8, 0.7, 0.5]),
    cells: grid(N, 10, GX, GY, CW + 12, CH + 12), c: card(CW, CH), back,
    plus: (x, y) => [...rect(x - 7, y - 1.5, 14, 3, 1), ...rect(x - 1.5, y - 7, 3, 14, 1)],
    unit: t("1 card = 1 study", { atlas: A.mono, size: 22, x: GX, y: GY + 10 * (CH + 12) + 14 }),
    counts: t("97 positive originals . 35 came back significant", { atlas: A.mono, size: 26, x: GX + 10 * (CW + 12) - 12, y: GY + 10 * (CH + 12) + 14, anchor: "right" }),
    scale: (y) => [contour(new Float32Array([560, y, 1360, y]), false)],
    orig: t("originals: 0.403 (SD 0.188)", { atlas: A.mono, size: 24, x: 1380, y: 846 }),
    rep: t("repeats: 0.197 (SD 0.257)", { atlas: A.mono, size: 24, x: 1380, y: 896 }),
    sdTag: t("mean and one SD, not distributions", { atlas: A.mono, size: 22, x: 560, y: 940 }),
    miss: t("a single repeat can miss a real effect", { atlas: A.mono, size: 26, x: 960, y: 985, anchor: "center" }),
  };
}
const X = (v) => lerp(560, 1360, (v + 0.1) / 0.8);   // effect size axis, -0.1 to 0.7

export function draw(t, A, T, items) {
  const S = A.d1, put = (shape, fill, o) => { if (o > 0 && shape.length) items.push({ shape, fill, opacity: o }); };
  const strk = (shape, color, w, o) => { if (o > 0 && shape.length) items.push({ shape, stroke: color, width: w, opacity: o }); };
  // Title: printed, then a negative slides in off-register and locks.
  const tA = window(t, 0.3, T.s1.enter, 0.6, 0.6);
  if (tA > 0) {
    const reg = span(t, 1.6, 3.6, ease.inOut), off = lerp(14, 0, reg);
    S.title.forEach((sh) => { put(sh, C.ink, tA); put(at(sh, off, off * 0.6), C.cyan, tA * lerp(0.5, 0.22, reg) * span(t, 1.2, 1.8)); });
  }
  // Segment 1: one paper; trust it, or run it again.
  const s1 = window(t, T.s1.enter, T.s2.enter, 0.8, 0.8);
  if (s1 > 0) {
    strk(S.page.edge, C.ink2, 1.6, s1); put(S.page.bars, C.ink2, s1 * 0.8);
    put(S.effect, C.ink, s1 * span(t, T.s1.enter + 0.6, T.s1.enter + 1.4)); put(S.effectL, C.ink, s1 * span(t, T.s1.enter + 0.8, T.s1.enter + 1.6));
    put(S.published, C.ink2, s1 * span(t, T.s1.stats + 2.4, T.s1.stats + 3.2));
    const split = span(t, T.s1.either, T.s1.either + 1.0);
    put(S.trust, C.ink, s1 * split); put(S.rerun, C.ink, s1 * split);
    const stampA = span(t, T.s1.cheap, T.s1.cheap + 0.3, ease.out);
    strk(S.stamp, C.ink, 3, s1 * stampA); put(S.fast, C.ink2, s1 * stampA);
    const expose = span(t, T.s1.slow, T.s1.slow + 2.0, ease.linear);
    if (expose > 0) {
      strk(at(S.mini.edge, 1440, 520), C.ink2, 1.4, s1); put(at(S.mini.bars, 1440, 520), C.ink2, s1 * 0.8);
      put(at([...S.mini.edge], 1446, 524), C.cyan, s1 * 0.18 * expose); put(at(S.mini.bars, 1446, 524), C.cyan, s1 * 0.7 * expose);
    }
    put(S.slow, C.ink2, s1 * span(t, T.s1.slow + 1.0, T.s1.slow + 1.8));
  }
  // Segment 2: 100 studies.
  const s2 = window(t, T.s2.enter, T.s3.enter, 0.8, 0.8);
  if (s2 <= 0) return;
  const pos = span(t, T.s2.ninety7, T.s2.ninety7 + 1.6), neg = span(t, T.s2.came, T.s2.came + 2.4, ease.inOut);
  const edges = [], bars = [], pluses = [], faded = [], fadedEdge = [], negs = [];
  let k = 0;
  S.cells.forEach(([x, y], i) => {
    const on = span(t, T.s2.enter + 0.6 + (i / N) * 1.6, T.s2.enter + 1.0 + (i / N) * 1.6);
    if (on <= 0) return;
    const isPos = i < POS;
    const j = isPos ? k++ : -1, cameBack = isPos && S.back.has(j);
    if (isPos && neg > 0 && !cameBack) { faded.push(...at(S.c.bars, x, y)); fadedEdge.push(...at(S.c.edge, x, y)); }
    else { edges.push(...at(S.c.edge, x, y)); bars.push(...at(S.c.bars, x, y)); }
    if (isPos && pos > j / POS) pluses.push(...S.plus(x + CW - 12, y + CH - 12));
    if (cameBack && neg > 0) negs.push(...at(S.c.bars, x + 3, y + 2));
  });
  strk(edges, C.ink2, 1.2, s2); put(bars, C.ink2, s2 * 0.8); put(pluses, C.ink, s2);
  put(faded, C.faint, s2); strk(fadedEdge, C.hot, 1.2, s2 * neg);
  put(negs, C.cyan, s2 * 0.75 * neg);
  put(S.unit, C.dim, s2); put(S.counts, C.ink, s2 * span(t, T.s2.came + 1.4, T.s2.came + 2.4));
  // Effect sizes, means with one-SD bars.
  const es = window(t, T.s2.half, T.s3.enter, 0.6, 0.8);
  if (es > 0) {
    strk(S.scale(870), C.ink2, 1.4, es);
    for (const [m, sd, y, col, lab] of [[0.403, 0.188, 846, C.ink, S.orig], [0.197, 0.257, 896, C.cyan, S.rep]]) {
      put(rect(X(m - sd), y - 4, X(m + sd) - X(m - sd), 8, 3), col, es * 0.55);
      put(circle(X(m), y, 7, 20), col, es); put(lab, col, es);
    }
    put(S.sdTag, C.hot, es);
  }
  put(S.miss, C.hot, window(t, T.s2.miss, T.s3.enter, 0.6, 0.6));
}
