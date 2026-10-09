// Segment 2, "One study's worth of references" (Walters and Wilder 2023).
// 636 references as two grids of dots: 222 from GPT-3.5, 414 from GPT-4. The
// fabricated ones turn into hollow rings, the real ones with wrong details
// dim, then each grid sorts itself so the shares read as areas. When the voice
// says the invented and the real look the same, the marks and the order
// dissolve; a search beam brings them back.
// Counts are the paper's shares of each group, rounded to whole references:
// 55% of 222 = 122, 18% of 414 = 75; of the real ones, 43% of 100 = 43 and
// 24% of 339 = 81 (the same rounding as the film's earlier dot grid).
import { circle, contour } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { morph } from "../../../raw-native/web-23ec93f/motion/morph.mjs";
import { span, window, ease, rng, lerp, countUp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { text, fmt } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { C, ring, line } from "./lib.mjs";

export const SPACING = 30, R = 10.5;
export const GROUPS = [
  { name: "GPT-3.5", n: 222, cols: 15, cx: 560, fab: 122, wrong: 43, share: "55%", wshare: "43%" },
  { name: "GPT-4", n: 414, cols: 23, cx: 1330, fab: 75, wrong: 81, share: "18%", wshare: "24%" },
];
export const TOP = 290;
// Cell centre for index i of group g in reading order.
export function cell(g, i) {
  const G = GROUPS[g], w = (G.cols - 1) * SPACING;
  return [G.cx - w / 2 + (i % G.cols) * SPACING, TOP + Math.floor(i / G.cols) * SPACING];
}
// The reference of segment 1 sits in this cell of the GPT-3.5 grid.
export const HOME = { g: 0, i: 7 * 15 + 7 };

export function prepare(A) {
  const r = rng(20261004);
  A.groups = GROUPS.map((G, g) => {
    // A seeded draw of which references were fabricated and which real ones had wrong details.
    const idx = [...Array(G.n).keys()];
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const kind = new Array(G.n).fill(0);            // 0 real and right, 1 fabricated, 2 real with wrong details
    idx.slice(0, G.fab).forEach((k) => { kind[k] = 1; });
    idx.slice(G.fab, G.fab + G.wrong).forEach((k) => { kind[k] = 2; });
    if (g === HOME.g) { const k = kind[HOME.i]; if (k !== 1) { const s = kind.findIndex((v, i) => v === 1 && i !== HOME.i); kind[s] = k; kind[HOME.i] = 1; } }
    // Sorted place: fabricated first, then wrong details, then the rest.
    const order = [...Array(G.n).keys()].sort((a, b) => ([1, 2, 0].indexOf(kind[a]) - [1, 2, 0].indexOf(kind[b])) || a - b);
    const sorted = new Array(G.n);
    order.forEach((k, pos) => { sorted[k] = pos; });
    const delay = Array.from({ length: G.n }, () => r());
    return { kind, sorted, delay };
  });
  A.s2 = {
    title: GROUPS.map((G, g) => text(`${G.name}: ${G.n} references`, { atlas: A.sans, size: 30, x: cell(g, 0)[0] - R, y: TOP - 40 })),
    fab: GROUPS.map((G, g) => text(`did not exist: ${G.share}`, { atlas: A.sans, size: 28, x: cell(g, 0)[0] - R, y: 0 })),
    wrong: GROUPS.map((G, g) => text(`real, wrong details: ${G.wshare}`, { atlas: A.sans, size: 28, x: cell(g, 0)[0] - R, y: 0 })),
    look: text("On the page, they look the same.", { atlas: A.sans, size: 36, x: 960, y: 960, anchor: "center" }),
    search: text("Only the search tells them apart.", { atlas: A.sans, size: 36, x: 960, y: 960, anchor: "center" }),
    dot: circle(0, 0, R, 36),
    hollow: ring(0, 0, R, 2.6),
  };
  A.s2.toHollow = morph(A.s2.dot, A.s2.hollow);
}

// t: time; T: cue times for this segment. Returns items.
export function draw(t, A, T, items, zoom) {
  const S = A.s2, sans = A.sans;
  const vis = window(t, T.enter, T.exit, 0.01, 1.2);
  if (vis <= 0) return;
  const mark3 = span(t, T.fab3, T.fab3 + 2.2, ease.out), mark4 = span(t, T.fab4, T.fab4 + 2.0, ease.out);
  const wrongOn = span(t, T.wrong, T.wrong + 2.5, ease.out);
  const sort3 = span(t, T.fab3 + 2.6, T.fab3 + 4.6, ease.inOut), sort4 = span(t, T.fab4 + 1.6, T.fab4 + 3.4, ease.inOut);
  const sortW = span(t, T.wrong + 3, T.wrong + 5.5, ease.inOut);
  const same = span(t, T.same, T.same + 1.6, ease.inOut);
  // Search beams: the first is the authors' search; the second gives the marks back.
  const beam1 = span(t, T.search, T.search + 4.2, ease.linear), beam2 = span(t, T.apart, T.apart + 1.8, ease.inOut);
  const x0 = 340, x1 = 1640;
  const bx1 = lerp(x0, x1, beam1), bx2 = lerp(x0, x1, beam2);
  GROUPS.forEach((G, g) => {
    const st = A.groups[g], mark = g === 0 ? mark3 : mark4, srt = g === 0 ? sort3 : sort4;
    const appear = vis * (t < T.cardGone + 1 ? span(A.cardToDotU(zoom), 0.45, 1, ease.out) : 1);
    for (let i = 0; i < G.n; i++) {
      if (g === HOME.g && (i === HOME.i || A.s1cells.has(i)) && t < T.cardGone) continue;   // segment 1 still draws these
      const k = st.kind[i], d = st.delay[i];
      // Marks come on staggered, go off together when they "look the same", and come back behind beam 2.
      const back = beam2 > 0 ? (cell(g, i)[0] < bx2 ? 1 : 0) : 0;
      let m = k === 1 ? span(mark, d * 0.6, d * 0.6 + 0.4, ease.out) : 0;
      let w = k === 2 ? span(wrongOn, d * 0.6, d * 0.6 + 0.4, ease.out) : 0;
      m = Math.max(m * (1 - same), k === 1 ? back : 0); w = Math.max(w * (1 - same), k === 2 ? back : 0);
      // Position: home cell, or sorted cell; sorting undoes itself when they look the same.
      const sortU = Math.max(0, Math.min(1, (k === 0 ? Math.max(srt, sortW) : k === 1 ? srt : sortW))) * (1 - same);
      const a = cell(g, i), b = cell(g, st.sorted[i]);
      const px = lerp(a[0], b[0], ease.inOut(sortU)), py = lerp(a[1], b[1], ease.inOut(sortU));
      const shape = m > 0 ? S.toHollow(m) : S.dot;
      const lit = beam1 > 0 && beam1 < 1 ? Math.max(0, 1 - Math.abs(a[0] - bx1) / 40) : 0;
      const fill = k === 1 && m > 0 ? C.hot : w > 0.5 ? C.dim : C.ink;
      items.push({ shape: translateShape(shape, px, py), fill, opacity: appear * (0.92 + 0.08 * lit) * (k === 2 ? 1 - 0.35 * w : 1), stroke: lit > 0 ? C.ok : null, width: 2, z: 0 });
    }
    items.push({ shape: S.title[g].shape, fill: C.ink, opacity: vis * span(t, T.enter + 1.6, T.enter + 2.8) });
    const rows = (n) => Math.ceil(n / G.cols);
    const yFab = TOP + rows(G.n) * SPACING + 26, yWrong = yFab + 40;
    if (mark > 0) items.push({ shape: shiftY(S.fab[g].shape, yFab), fill: C.hot, opacity: vis * mark * (1 - 0.6 * same) });
    if (wrongOn > 0) items.push({ shape: shiftY(S.wrong[g].shape, yWrong), fill: C.ink2, opacity: vis * wrongOn * (1 - 0.6 * same) });
  });
  // The count of references searched, and the beams.
  if (beam1 > 0 && beam1 < 1) items.push({ shape: line(bx1, TOP - 70, bx1, 900), stroke: C.ok, width: 2, opacity: vis * 0.7, blend: "add" });
  if (beam2 > 0 && beam2 < 1) items.push({ shape: line(bx2, TOP - 70, bx2, 900), stroke: C.ok, width: 2, opacity: vis * 0.8, blend: "add" });
  const searched = beam1 > 0 ? countUp(t, T.search, T.search + 4.2, 1, 636, ease.linear, false) : 0;
  if (beam1 > 0) items.push({ shape: text(`searched: ${fmt(searched)} of 636`, { atlas: A.mono, size: 30, x: 1680, y: TOP - 84, anchor: "right" }).shape, fill: C.ink2, opacity: vis * (1 - span(t, T.fab3 - 0.5, T.fab3 + 0.5)) });
  const lookA = window(t, T.same, T.apart - 0.1, 0.5, 0.4), apartA = window(t, T.apart, T.exit, 0.5, 0.8);
  if (lookA > 0) items.push({ shape: S.look.shape, fill: C.ink, opacity: vis * lookA });
  if (apartA > 0) items.push({ shape: S.search.shape, fill: C.ink, opacity: vis * apartA });
}

function translateShape(shape, x, y) {
  return shape.map((c) => {
    const p = c.pts, o = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 2) { o[i] = p[i] + x; o[i + 1] = p[i + 1] + y; }
    return contour(o, c.closed);
  });
}
function shiftY(shape, y) { return translateShape(shape, 0, y); }
export { translateShape };
