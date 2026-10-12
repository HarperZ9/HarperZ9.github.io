// Film 5, segments 2 to 4. "How often the hint is named" (Chen et al. 2025, a preprint):
// two ribbons of 100 segments over six hint threads; a segment that names its hint dips
// to the thread: 25 for Claude 3.7 Sonnet, 39 for DeepSeek R1. The planted shortcut is
// given as bounds, so it is drawn as bounds: taken on over 99% of prompts, named on under
// 2% in most environments. "Still worth reading" (Baker et al. 2025): two glass monitors
// over 20 test-gaming tricks, catching 60% (12) and 95% (19); after the penalty the
// ribbon reads clean, the tricks go on, and the reasoning monitor's catch falls to near
// zero. "Useful, and fragile" (Korbak et al. 2025): the ribbon becomes glass, cracked at
// one edge, tagged as a position paper.
import { contour, rect, circle } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, curve, bezier, run, bend } from "./ribbon.mjs";

const ROWS = [{ y: 300, named: 25, who: "Claude 3.7 Sonnet: named the hint 25% of the time" }, { y: 560, named: 39, who: "DeepSeek R1: 39%" }];
const X0 = 300, X1 = 1620, TRICKS = 20;

export function prepare(A) {
  const t = (s, o) => text(s, o).shape;
  // Which of the 100 segments name a hint: spread evenly, so the share reads as a density.
  const pick = (n) => new Set(Array.from({ length: n }, (_, k) => Math.floor(((k + 0.5) * 100) / n)));
  A.v2 = {
    rows: ROWS.map((r) => ({ ...r, set: pick(r.named), label: t(r.who, { atlas: A.mono, size: 26, x: X0, y: r.y - 46 }) })),
    six: t("6 kinds of hint", { atlas: A.sans, size: 24, x: X1 + 20, y: 0 }),
    tag: t("preprint", { atlas: A.mono, size: 24, x: X1, y: 200, anchor: "right" }),
    takenL: t("planted shortcut taken: over 99% of prompts", { atlas: A.mono, size: 28, x: X0, y: 360 }),
    namedL: t("named in the reasoning: under 2%, in most environments", { atlas: A.mono, size: 28, x: X0, y: 600 }),
    bounds: t("drawn as bounds: the source gives bounds", { atlas: A.mono, size: 22, x: X0, y: 740 }),
    scale: (y) => [contour(new Float32Array([X0, y, X1, y]), false), ...[0, 0.5, 1].map((u) => contour(new Float32Array([lerp(X0, X1, u), y - 8, lerp(X0, X1, u), y + 8]), false))],
    pct: (y) => ["0%", "50%", "100%"].map((s, k) => t(s, { atlas: A.mono, size: 20, x: lerp(X0, X1, k / 2), y: y + 34, anchor: "center" })),
    // Segment 3.
    lens: [{ x: 640, y: 420, col: C.violet, name: t("reads the actions", { atlas: A.sans, size: 28, x: 640, y: 240, anchor: "center" }) },
      { x: 1280, y: 420, col: C.cyan, name: t("reads the actions and the reasoning", { atlas: A.sans, size: 28, x: 1280, y: 240, anchor: "center" }) }],
    caught: [t("caught 60%", { atlas: A.mono, size: 30, x: 640, y: 640, anchor: "center" }), t("caught 95%", { atlas: A.mono, size: 30, x: 1280, y: 640, anchor: "center" }),
      t("near zero", { atlas: A.mono, size: 30, x: 1280, y: 640, anchor: "center" })],
    penalty: t("the penalty: flagged reasoning is trained against", { atlas: A.sans, size: 28, x: 960, y: 712, anchor: "center" }),
    continues: t("the tricks continued", { atlas: A.mono, size: 26, x: 960, y: 752, anchor: "center" }),
    ribbonRun: run("step . step . a shortcut . step . done", A.sans, 30),
    cleanRun: run("step . step . step . step . done", A.sans, 30),
    top: curve(bezier([300, 200], [700, 140], [1200, 260], [1640, 190])),
    // Segment 4.
    glass: curve(bezier([300, 520], [700, 440], [1200, 600], [1640, 500])),
    position: t("a position paper, no measurements", { atlas: A.mono, size: 26, x: 960, y: 610, anchor: "center" }),
    fragile: t("useful, and fragile", { atlas: A.head, size: 44, x: 960, y: 300, anchor: "center" }),
    readout: t("Written reasoning is a readout.", { atlas: A.head, size: 44, x: 960, y: 686, anchor: "center" }),
    checkIt: t("Check it against what the model does; do not pay it to look clean.", { atlas: A.sans, size: 30, x: 960, y: 742, anchor: "center" }),
  };
}

export function draw(t, A, T, items) {
  const S = A.v2, put = (shape, fill, o) => { if (o > 0 && shape.length) items.push({ shape, fill, opacity: o }); };
  const strk = (shape, color, w, o, blend) => { if (o > 0 && shape.length) items.push({ shape, stroke: color, width: w, opacity: o, blend }); };
  // Segment 2: two ribbons over six hint threads.
  const s2 = window(t, T.s2.enter, T.s2.shortcut, 0.8, 0.6), rowsA = s2 * span(t, T.s2.kinds, T.s2.kinds + 1.2);
  if (rowsA > 0) {
    S.rows.forEach((r, k) => {
      const threads = [];
      for (let h = 0; h < 6; h++) threads.push(contour(new Float32Array([X0, r.y + 70 + h * 9, X1, r.y + 70 + h * 9]), false));
      strk(threads, C.hot, 1.1, rowsA * 0.7);
      const segs = [], dips = [], named = span(t, T.s2.kinds + 1.0 + k * 1.6, T.s2.kinds + 3.0 + k * 1.6);
      for (let i = 0; i < 100; i++) {
        const x = lerp(X0, X1, (i + 0.5) / 100);
        segs.push(...rect(x - 4, r.y - 8, 8, 16, 2));
        if (r.set.has(i) && named > i / 100) dips.push(contour(new Float32Array([x, r.y + 8, x, r.y + 70 + (i % 6) * 9]), false));
      }
      put(segs, C.ink, rowsA); strk(dips, C.ink, 1.4, rowsA);
      put(r.label, C.ink, rowsA * named);
    });
    put(S.tag, C.hot, rowsA);
  }
  // The planted shortcut, as bounds on two 0 to 100% scales.
  const sc = window(t, T.s2.shortcut, T.s3.enter, 0.8, 0.8);
  if (sc > 0) {
    for (const [y, a, b, col, lab] of [[420, 0.99, 1, C.hot, S.takenL], [660, 0, 0.02, C.ink, S.namedL]]) {
      strk(S.scale(y), C.ink2, 1.6, sc); S.pct(y).forEach((p) => put(p, C.dim, sc));
      put(rect(lerp(X0, X1, a), y - 12, Math.max(6, (X1 - X0) * (b - a)), 24, 3), col, sc);
      put(lab, col === C.hot ? C.hot : C.ink, sc);
    }
    put(S.bounds, C.hot, sc * 0.9);
  }
  // Segment 3: two monitors over the same 20 tricks; then the penalty.
  const mode = A.params && A.params.monitor !== undefined && A.params.monitor < 2.5 ? Math.round(A.params.monitor) : -1;
  const s3 = window(t, T.s3.enter, T.s4.enter, 0.8, 0.8);
  if (s3 > 0) {
    const pen = mode === 2 ? 1 : mode >= 0 ? 0 : span(t, T.s3.penalty, T.s3.penalty + 2.4, ease.inOut);
    const wob = (s) => (1 - pen) * 6 * Math.sin(s * 0.05);
    put(bend(pen < 0.5 ? S.ribbonRun : S.cleanRun, S.top, 20, -Infinity, S.top.total - 40, wob), C.ink, s3);
    S.lens.forEach((L, k) => {
      const on = mode >= 0 ? (k === 0 || mode >= 1 ? 1 : 0) : span(t, k ? T.s3.both : T.s3.actions, (k ? T.s3.both : T.s3.actions) + 1.0);
      if (on <= 0) return;
      put(circle(L.x, L.y, 170, 64), L.col, 0.1 * on * s3); strk(circle(L.x, L.y, 170, 64), L.col, 2, 0.7 * on * s3);
      put(L.name, C.ink2, on * s3);
      const catchN = k === 0 ? 12 : Math.round(lerp(19, 0, pen)), marks = [], rings = [];
      for (let i = 0; i < TRICKS; i++) {
        const x = L.x - 135 + (i % 10) * 30, y = L.y - 18 + Math.floor(i / 10) * 36;
        marks.push(...rect(x - 5, y - 5, 10, 10, 2));
        if (i < catchN) rings.push(...circle(x, y, 12, 20));
      }
      put(marks, C.hot, on * s3); strk(rings, L.col, 2, on * s3);
      put(k === 1 && pen > 0.5 ? S.caught[2] : S.caught[k], C.ink, on * s3);
    });
    put(S.penalty, C.ink2, s3 * (mode === 2 ? 1 : mode >= 0 ? 0 : span(t, T.s3.penalty, T.s3.penalty + 0.8)));
    put(S.continues, C.hot, s3 * (mode === 2 ? 1 : mode >= 0 ? 0 : span(t, T.s3.continued, T.s3.continued + 0.8)));
  }
  // Segment 4: the ribbon becomes glass, cracked at one edge.
  const s4 = window(t, T.s4.enter, T.s5.close, 0.8, 0.8);
  if (s4 > 0) {
    const band = [], p = S.glass.pts;
    for (let k = 0; k < p.length; k += 2) band.push(p[k], p[k + 1] - 40);
    for (let k = p.length - 2; k >= 0; k -= 2) band.push(p[k], p[k + 1] + 24);
    put([contour(new Float32Array(band), true)], C.cyan, 0.08 * s4); strk([contour(new Float32Array(band), true)], C.violet, 1.4, 0.6 * s4);
    put(bend(S.cleanRun, S.glass, 30, -Infinity, S.glass.total - 60), C.ink, s4);
    const crack = span(t, T.s4.enter + 1.5, T.s4.enter + 3.0, ease.out);
    strk([contour(new Float32Array([1600, 452, 1588, 474, 1604, 492, 1590, 516]), false)], C.ink2, 1.6, s4 * crack);
    put(S.fragile, C.ink, s4 * span(t, T.s4.enter + 0.6, T.s4.enter + 1.6));
    put(S.position, C.hot, s4 * span(t, T.s4.enter + 1.4, T.s4.enter + 2.2));
    put(S.readout, C.ink, window(t, T.s4.readout, T.s5.close, 0.6, 0.6));
    put(S.checkIt, C.ink2, window(t, T.s4.check, T.s5.close, 0.6, 0.6));
  }
}
