// Segments 5 to 7 (shots 5.1 to 7.2). Back in the xz knot: the release and its source, joined
// by a chain of three links (where, when, how), the provenance record, in verified lime. The
// chain is drawn as it would have been; the scene says it is an illustration. Then the three
// limits, one per sentence, in drift, over the net. Then the close: the whole net, every thread
// intact, the two things to keep, and the voice line.
import { C, words, drawLens, contour, rect, circle, span, window, ease, lerp, rng, trim, plotter, scrim } from "./world.mjs";

export function prepare(A) {
  const r = rng(12);
  const t = (s, size, x, y, atlas = A.sans, anchor = "center") => words(s, atlas, size, x, y, anchor).shape;
  // The release (a box) on the left; the source tree on the right; three links between them.
  const tree = Array.from({ length: 9 }, (_, i) => plotter(1290 + (i % 3) * 18, 330 + i * 26, 120 + r() * 110, r));
  const links = [0, 1, 2].map((k) => { const x = 690 + k * 190; return rect(x, 410, 150, 64, 32); });
  A.s5 = {
    box: rect(440, 400, 150, 96, 6), tree, links,
    joins: [contour(new Float32Array([590, 442, 690, 442]), false), contour(new Float32Array([840, 442, 880, 442]), false),
      contour(new Float32Array([1030, 442, 1070, 442]), false), contour(new Float32Array([1220, 442, 1280, 442]), false)],
    where: t("where", 30, 765, 452, A.mono), when: t("when", 30, 955, 452, A.mono), how: t("how", 30, 1145, 452, A.mono),
    slsa: t("SLSA build provenance", 44, 960, 150, A.head),
    rel: t("release", 30, 515, 540, A.mono), src: t("source", 30, 1370, 600, A.mono),
    anyone: t("a check anyone can run", 40, 960, 712),
    illus: t("illustrative", 28, 960, 260, A.mono),
    lim1: t("Fisheries and forests: to code and data, our inference", 46, 960, 330),
    lim2: t("The audit counts missing records, not harm", 46, 960, 450),
    lim3: t("A record alone would not have stopped xz", 46, 960, 570),
    keep1: t("Record where a thing came from, when it is made.", 44, 960, 400, A.head),
    keep2: t("Let the people who depend on it make the rules.", 44, 960, 480, A.head),
    voice: t("The voice is synthesized . Sources under the video", 30, 960, 600, A.mono),
  };
  A.s5.scrims = [A.s5.lim1, A.s5.lim2, A.s5.lim3].map((s) => scrim(s));
  A.s5.keepScrim = scrim([...A.s5.keep1, ...A.s5.keep2], 26);
}

// T5: { open, chain, check, exit }; T6: { one, two, three, exit }; T7: { one, two, voice, end }
export function draw(t, A, T5, T6, T7, items) {
  const S = A.s5;
  // Segment 5 in the xz knot's lens.
  if (t > T5.open - 0.6 && t < T5.exit + 1.2) {
    const o = span(t, T5.open - 0.6, T5.open + 0.6, ease.out) * (1 - span(t, T5.exit, T5.exit + 1.0, ease.inOut));
    drawLens(items, 960, 450, 660 * span(t, T5.open - 0.6, T5.open + 0.9, ease.out) * (1 - 0.95 * span(t, T5.exit, T5.exit + 1.0, ease.inOut)), o);
    const put = (shape, fill, a) => { if (a * o > 0.003) items.push({ shape, fill, opacity: a * o, screen: true }); };
    const line = (shape, stroke, a, width = 1.6) => { if (a * o > 0.003 && shape.length) items.push({ shape, stroke, width, opacity: a * o, screen: true }); };
    line(S.box, C.ink, 1, 1.8); put(S.rel, C.ink2, 1);
    line(S.tree, C.ink, 0.85); put(S.src, C.ink2, 1);
    put(S.slsa, C.ink, span(t, T5.open + 0.6, T5.open + 1.4));
    // The links grow one per word: where, when, how.
    [[S.links[0], S.where, T5.where], [S.links[1], S.when, T5.when], [S.links[2], S.how, T5.how]].forEach(([lk, lab, at], k) => {
      const g = span(t, at, at + 0.8, ease.out);
      line(trim(lk, 0, g), C.lime, 1, 2.2);
      line(S.joins.slice(k, k + 1), C.lime, g, 2);
      put(lab, C.lime, g);
    });
    line(S.joins.slice(3), C.lime, span(t, T5.how + 0.6, T5.how + 1.2), 2);
    const chk = span(t, T5.check, T5.check + 1.0);
    put(S.anyone, C.ink, window(t, T5.check, T5.exit + 0.4, 0.6, 0.6));
    put(S.illus, C.hot, chk);
    // The check runs along the chain: a small bead travels from the release to the source.
    const b = span(t, T5.check + 0.4, T5.check + 2.4, ease.inOut);
    if (b > 0 && b < 1) put(circle(lerp(590, 1280, b), 442, 7, 16), C.lime, 1);
  }
  // Segment 6: the three limits, each landing on its sentence.
  const lim = [[S.lim1, T6.one], [S.lim2, T6.two], [S.lim3, T6.three]];
  lim.forEach(([sh, at], k) => {
    const a = window(t, at, T6.exit, 0.6, 0.8);
    if (a <= 0) return;
    items.push({ ...S.scrims[k], opacity: 0.7 * a });
    items.push({ shape: sh, fill: C.hot, opacity: a, screen: true });
  });
  // Segment 7: the two things to keep, then the voice line.
  const k7 = window(t, T7.one, T7.end, 0.8, 0.8);
  if (k7 > 0) {
    items.push({ ...S.keepScrim, opacity: 0.65 * k7 });
    items.push({ shape: S.keep1, fill: C.ink, opacity: k7, screen: true });
    const k2 = span(t, T7.two, T7.two + 0.8);
    if (k2 > 0) items.push({ shape: S.keep2, fill: C.ink, opacity: k7 * k2, screen: true });
    const v = span(t, T7.voice, T7.voice + 0.8);
    if (v > 0) items.push({ shape: S.voice, fill: C.ink2, opacity: k7 * v * 0.9, screen: true });
  }
}
