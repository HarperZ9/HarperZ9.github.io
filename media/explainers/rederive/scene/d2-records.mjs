// Film 3, segment 3 "Asking for the data" (Stodden, Seiler and Ma 2018), segment 4 "A
// check that anyone can run" (Kumar et al. 2018), and the close. 204 papers, one card each:
// an envelope leaves every card; envelopes come back for 44% (90 cards), unanswered ones
// stay in the margin, and a negative exposes over about 26% of the 204 (53 cards), tagged
// as an estimate. Then one certificate, and the camera pulls back to a field of 2^18
// points standing for 240 million certificates (1 point is about 900). In 2012 more than
// 12% of the field is lit in drift; by 2017, 0.02%: 52 points, which the camera must dive
// to find. The close returns to the first page with a negative registered over it.
import { rect, contour } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp, rng } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, at, card, grid, spread } from "./print.mjs";

const PAPERS = 204, GOT = 90, REPRO = 53, FIELD = 1 << 18, LIT12 = Math.round(FIELD * 0.12), LIT17 = Math.round(FIELD * 0.0002);

export function prepare(A, ctx) {
  const t = (s, o) => text(s, o).shape, r = rng(240);
  const env = [...rect(0, 0, 22, 15, 2), contour(new Float32Array([0, 0, 11, 8, 22, 0]), false)];
  // The field: 2^18 points in a soft rectangle; the lit subsets are drawn as their own systems.
  const pts = new Float32Array(2 * FIELD);
  // The field sits between the lines at the top and the note under it, above the captions (tests/explainer-film-labels.mjs).
  for (let i = 0; i < FIELD; i++) { pts[2 * i] = 160 + r() * 1600; pts[2 * i + 1] = 250 + r() * 470; }
  const pick = (n) => { const a = new Float32Array(2 * n); for (let i = 0; i < n; i++) { const j = Math.floor(r() * FIELD); a[2 * i] = pts[2 * j]; a[2 * i + 1] = pts[2 * j + 1]; } return a; };
  const lit17 = pick(LIT17);
  const sys = (p, n, col, seed) => ctx.motion ? ctx.motion.particles({ count: n, formations: [p, p], colors: [col, col], seed }) : null;
  A.d2 = {
    cells: grid(PAPERS, 17, 433, 104, 62, 42), c: card(52, 36), env, got: spread(GOT, PAPERS), repro: null,
    unit: t("1 card = 1 paper . 204 papers in Science", { atlas: A.mono, size: 22, x: 433, y: 634 }),
    gotL: t("materials obtained: 44%", { atlas: A.mono, size: 26, x: 433, y: 672 }),
    reproL: t("about 26% estimated to reproduce", { atlas: A.mono, size: 26, x: 433, y: 710 }),
    est: t("estimate", { atlas: A.mono, size: 22, x: 900, y: 710 }),
    rule: t("A rule that relies on the author answering checks only the authors who answer.", { atlas: A.sans, size: 30, x: 960, y: 754, anchor: "center" }),
    cert: card(120, 80, [0.9, 0.6, 0.75]),
    public: t("a public record: anyone can check it", { atlas: A.sans, size: 30, x: 960, y: 110, anchor: "center" }),
    field: sys(pts, FIELD, "#3a3833", 21), f12: sys(pick(LIT12), LIT12, "#b8482b", 22), f17: sys(lit17, LIT17, "#b8482b", 23),
    dive: [lit17[0], lit17[1]],
    fieldTag: t("field drawn at 2^18 points; 1 point is about 900 certificates", { atlas: A.mono, size: 22, x: 160, y: 752 }),
    checks: t("220 checks over 240 million certificates", { atlas: A.mono, size: 28, x: 960, y: 110, anchor: "center" }),
    y2012: t("2012: more than 12% with errors", { atlas: A.mono, size: 30, x: 960, y: 164, anchor: "center" }),
    y2017: t("2017: 0.02%, too few to see from here", { atlas: A.mono, size: 30, x: 960, y: 164, anchor: "center" }),
    caused: t("the paper does not show the checks caused the fall", { atlas: A.mono, size: 26, x: 960, y: 210, anchor: "center" }),
    closeA: t("A result you can re-derive", { atlas: A.head, size: 50, x: 1300, y: 480, anchor: "center" }),
    closeB: t("does not need your trust.", { atlas: A.head, size: 50, x: 1300, y: 546, anchor: "center" }),
    ask: t("Ask for the data, the code and a check you can run yourself.", { atlas: A.sans, size: 28, x: 1300, y: 620, anchor: "center" }),
    voice: t("The voice is a synthesized version of the author's.", { atlas: A.sans, size: 26, x: 1300, y: 690, anchor: "center" }),
    sources: t("Every number on screen links to its source under the video.", { atlas: A.sans, size: 26, x: 1300, y: 728, anchor: "center" }),
  };
  const gotIdx = [...A.d2.got].sort((a, b) => a - b), keep = spread(REPRO, GOT);
  A.d2.repro = new Set(gotIdx.filter((_, k) => keep.has(k)));
}

export function camera(t, T, A) {
  const S4 = T.s4, pull = span(t, S4.enter + 0.6, S4.checks + 2.0, ease.inOut);
  const dIn = span(t, S4.y2017 + 0.8, S4.y2017 + 2.4, ease.inOut), dOut = span(t, S4.caused - 0.4, S4.caused + 0.8, ease.inOut), d = dIn * (1 - dOut);
  let zoom = Math.exp(lerp(Math.log(8), 0, pull)), x = 960, y = 540;
  if (d > 0) { zoom = Math.exp(lerp(0, Math.log(10), d)); x = lerp(960, A.d2.dive[0], d); y = lerp(540, A.d2.dive[1], d); }
  return { x, y, zoom };
}

export function draw(t, A, T, items, zoom) {
  const S = A.d2, put = (shape, fill, o, screen = false) => { if (o > 0 && shape.length) items.push({ shape, fill, opacity: o, screen }); };
  const strk = (shape, color, w, o) => { if (o > 0 && shape.length) items.push({ shape, stroke: color, width: w, opacity: o }); };
  // Segment 3: 204 papers and their envelopes.
  const s3 = window(t, T.s3.enter, T.s4.enter, 0.8, 0.8);
  if (s3 > 0) {
    const out = span(t, T.s3.stodden + 2.0, T.s3.stodden + 5.0, ease.inOut), back = span(t, T.s3.got, T.s3.got + 2.2, ease.inOut);
    const neg = span(t, T.s3.got + 3.0, T.s3.got + 5.0, ease.inOut);
    const edges = [], bars = [], envs = [], negs = [];
    S.cells.forEach(([x, y], i) => {
      edges.push(...at(S.c.edge, x, y)); bars.push(...at(S.c.bars, x, y));
      if (out <= 0) return;
      const mx = 1640 + (i % 6) * 26, my = 150 + Math.floor(i / 6) * 17, returned = S.got.has(i);
      const u = returned ? out * (1 - back) : out;
      envs.push(...at(S.env, lerp(x + 15, mx, u), lerp(y + 10, my, u)));
      if (S.repro.has(i) && neg > 0) negs.push(...at(S.c.bars, x + 3, y + 2));
    });
    strk(edges, C.ink2, 1.1, s3); put(bars, C.ink2, s3 * 0.8);
    strk(envs, C.ink, 1.2, s3); put(negs, C.cyan, s3 * 0.75 * neg);
    put(S.unit, C.dim, s3); put(S.gotL, C.ink, s3 * back); put(S.reproL, C.cyan, s3 * neg); put(S.est, C.hot, s3 * neg);
    put(S.rule, C.ink2, window(t, T.s3.rule, T.s4.enter, 0.6, 0.6), true);
  }
  // Segment 4: one certificate, then the field.
  const s4 = window(t, T.s4.enter, T.s5.close, 0.8, 0.8);
  if (s4 > 0) {
    const cw = 1 - span(t, T.s4.checks, T.s4.checks + 1.5);
    strk(at(S.cert.edge, 900, 500), C.ink, 1.2 / Math.max(zoom, 1) * 3, s4 * cw); put(at(S.cert.bars, 900, 500), C.ink2, s4 * cw);
    put(S.public, C.ink2, window(t, T.s4.enter + 0.4, T.s4.checks, 0.6, 0.4), true);
    const fieldA = span(t, T.s4.enter + 1.5, T.s4.checks + 1.0);
    const k = 2.2 / Math.sqrt(Math.max(1, zoom)), sz = [k, k];   // points stay points when the camera dives
    if (S.field && fieldA > 0) items.push({ kind: "particles", system: S.field, from: 0, to: 1, t: 0, spread: 0, drift: 0, time: t, size: sz, blend: "over", opacity: s4 * fieldA * 0.8 });
    const l12 = window(t, T.s4.y2012, T.s4.y2017, 0.6, 0.8), l17 = span(t, T.s4.y2017 + 0.4, T.s4.y2017 + 1.0);
    if (S.f12 && l12 > 0) items.push({ kind: "particles", system: S.f12, from: 0, to: 1, t: 0, spread: 0, drift: 0, time: t, size: sz, blend: "over", opacity: s4 * l12 });
    if (S.f17 && l17 > 0) items.push({ kind: "particles", system: S.f17, from: 0, to: 1, t: 0, spread: 0, drift: 0, time: t, size: [k * 1.3, k * 1.3], blend: "over", opacity: s4 * l17 });
    put(S.checks, C.ink, s4 * span(t, T.s4.checks, T.s4.checks + 1.0), true);
    put(S.fieldTag, C.hot, s4 * fieldA * span(t, T.s4.checks + 1.0, T.s4.checks + 2.0), true);
    put(S.y2012, C.hot, window(t, T.s4.y2012, T.s4.y2017 - 0.1, 0.5, 0.3), true);
    put(S.y2017, C.ink, window(t, T.s4.y2017, T.s5.close, 0.5, 0.6), true);
    put(S.caused, C.hot, window(t, T.s4.caused, T.s5.close, 0.5, 0.6), true);
  }
  // The close: the first page, with a negative registered over it.
  const cl = span(t, T.s5.close - 0.2, T.s5.close + 1.2) * (1 - span(t, T.s5.end - 1.2, T.s5.end));
  if (cl > 0) {
    const P = A.d1.page, reg = span(t, T.s5.close + 0.6, T.s5.close + 2.6, ease.inOut), off = lerp(12, 0, reg);
    strk(P.edge, C.ink2, 1.6, cl); put(P.bars, C.ink2, cl * 0.8); put(A.d1.effect, C.ink, cl);
    const nA = lerp(0.45, 0.2, reg);
    put(at(P.bars, off, off * 0.6), C.cyan, cl * nA); put(at(A.d1.effect, off, off * 0.6), C.cyan, cl * nA);
    put(S.closeA, C.ink, span(t, T.s5.close + 1.2, T.s5.close + 2.2), true); put(S.closeB, C.ink, span(t, T.s5.close + 1.6, T.s5.close + 2.6), true);
    put(S.ask, C.ink2, span(t, T.s5.ask, T.s5.ask + 0.8), true);
    put(S.voice, C.ink2, span(t, T.s5.voice, T.s5.voice + 0.8), true); put(S.sources, C.ink2, span(t, T.s5.sources, T.s5.sources + 0.8), true);
  }
}
