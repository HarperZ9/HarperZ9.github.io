// Segment 4, "Where provenance gets lost" (shots 4.0 to 4.5). One dataset card, held for the
// predict beat, with its thread back to where it was made. A log-zoom out to all 1,858 datasets,
// one mark each. On GitHub 72% lose their thread and go grey (rounded to 1,338 marks; the hot
// mark). The 29% "looser than the author's terms" is a separate share in the paper's table, so
// it is drawn as its own bar, not on the marks. Tracing re-grows threads in verified lime until
// 30% (557 marks) stay grey. Last, a web corpus as a fine texture, with a gate over about 5%.
import { C, words, drawLens, lensShape, contour, circle, rect, span, window, ease, lerp, rng } from "./world.mjs";

export const N = 1858, COLS = 62, PITCH = 22, GX = 960 - (COLS - 1) * PITCH / 2, GY = 196;
export const GREY_GITHUB = Math.round(0.72 * N), GREY_TRACED = Math.round(0.30 * N);   // 1,338 and 557
const HERO = 31 + 14 * COLS;   // the card the camera starts on, near the middle of the grid

export function prepare(A) {
  const r = rng(2023);
  const order = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  // rank[i]: where card i falls in a seeded shuffle. The first 1,338 lose their licence on GitHub;
  // tracing restores all but the first 557. The arrangement is ours; only the shares are data.
  const rank = new Int32Array(N);
  order.forEach((card, k) => { rank[card] = k; });
  const pos = Array.from({ length: N }, (_, i) => [GX + (i % COLS) * PITCH, GY + Math.floor(i / COLS) * PITCH]);
  // The web corpus: a fine halftone of dots, 140 by 52.
  const corpus = [], gate = [];
  for (let j = 0; j < 52; j++) for (let i = 0; i < 140; i++) {
    const x = 330 + i * 9 + (j % 2) * 4.5, y = 250 + j * 9, rr = 1.7 + 1.2 * r();
    (i >= 133 ? gate : corpus).push(...circle(x, y, rr, 6));
  }
  const bars = []; for (let k = 0; k <= 6; k++) bars.push(contour(new Float32Array([330 + 133 * 9 + k * 10.5 - 4, 236, 330 + 133 * 9 + k * 10.5 - 4, 726]), false));
  const t = (s, size, x, y, atlas = A.sans, anchor = "center") => words(s, atlas, size, x, y, anchor).shape;
  A.s4 = {
    rank, pos,
    card: [...rect(-130, -85, 260, 170, 8)], cardRows: [-40, -10, 20, 50].map((y, k) => contour(new Float32Array([-100, y, -100 + [190, 150, 170, 90][k], y]), false)),
    tag: rect(40, 36, 70, 30, 4), corpus, gate, bars,
    perMark: t("1 mark = 1 dataset . 1,858", 36, 960, 150, A.mono),
    preprint: t("preprint", 28, 1640, 150, A.mono, "right"),
    no72: t("GitHub: 72% with no licence", 44, 960, 112),
    rounded: t("shares rounded to whole marks", 28, 960, 150, A.mono),
    loose: t("GitHub: 29% looser than the author's terms", 44, 960, 400),
    sep: t("its own share in the paper's table, not of the marks", 28, 960, 560, A.mono),
    traced: t("traced: 30% still unspecified", 44, 960, 112),
    c4: t("about 5% of C4 tokens fully restricted in one year", 40, 960, 160),
    high: t("may be slightly high", 28, 1630, 756, A.mono, "right"),
  };
}

// T: { open, held, zoom, gh, loose, trace, c4, exit }
export function draw(t, A, T, items) {
  const S = A.s4;
  if (t < T.open - 0.6 || t > T.exit + 1.2) return;
  const o = span(t, T.open - 0.6, T.open + 0.6, ease.out) * (1 - span(t, T.exit, T.exit + 1.0, ease.inOut));
  drawLens(items, 960, 470, 700 * span(t, T.open - 0.6, T.open + 0.9, ease.out) * (1 - 0.95 * span(t, T.exit, T.exit + 1.0, ease.inOut)), o);
  // Everything in the knot is clipped to its lens, so the zoomed cards never spill over the net.
  const clip = lensShape(960, 470, Math.max(1, 700 * span(t, T.open - 0.6, T.open + 0.9, ease.out) * (1 - 0.95 * span(t, T.exit, T.exit + 1.0, ease.inOut)) - 2));
  const put = (shape, fill, a, c = null) => { if (a * o > 0.003 && shape.length) items.push({ shape, fill, opacity: a * o, screen: true, ...(c ? { clip: c } : {}) }); };
  const line = (shape, stroke, a, width = 1.2, c = null) => { if (a * o > 0.003 && shape.length) items.push({ shape, stroke, width, opacity: a * o, screen: true, ...(c ? { clip: c } : {}) }); };
  // Log-zoom: scale s from 16 (one card) to 1 (the field), each doubling taking the same time.
  const z = span(t, T.zoom, T.zoom + 4.0, ease.inOut), s = Math.exp(Math.log(16) * (1 - z));
  const [hx, hy] = S.pos[HERO], cx = lerp(960, hx, z), cy = lerp(450, hy, z);
  const field = 1 - span(t, T.c4 - 0.4, T.c4 + 1.0, ease.inOut);
  const ghost = 1 - 0.7 * window(t, T.loose, T.trace, 0.6, 0.6);
  // State per card: grey after the GitHub count; lime when tracing restores it.
  const gh = span(t, T.gh, T.gh + 1.4), tr = span(t, T.trace, T.trace + 2.0);
  const ink = [], grey = [], lime = [], threadsInk = [], threadsLime = [], cut = [], far = [];
  for (let i = 0; i < N; i++) {
    const [x, y] = S.pos[i], sx = cx + (x - hx) * s, sy = cy + (y - hy) * s;
    if (sx < -40 || sx > 1960 || sy < -40 || sy > 1120) continue;
    const k = S.rank[i], lost = k < GREY_GITHUB && gh * GREY_GITHUB > k, back = lost && k >= GREY_TRACED && tr * (GREY_GITHUB - GREY_TRACED) > k - GREY_TRACED;
    const cw = Math.min(260, 16 * s), ch = cw * 0.66;
    const box = rect(sx - cw / 2, sy - ch / 2, cw, ch, Math.max(1, cw * 0.03));
    // While one card fills the view the others stay as outlines, so the held card reads as one.
    if (i !== HERO && z < 0.3) { far.push(...box); continue; }
    (back ? lime : lost ? grey : ink).push(...box);
    const tail = contour(new Float32Array([sx, sy - ch / 2, sx + cw * 0.12, sy - ch / 2 - cw * 0.35]), false);
    if (back) threadsLime.push(tail); else if (!lost) threadsInk.push(tail); else if (gh < 1 && k > (gh - 0.15) * GREY_GITHUB) cut.push(tail);
  }
  line(far, C.dim, 0.6 * field, 1.4, clip);
  put(ink, C.ink, 0.85 * field * ghost, clip);
  put(grey, C.grey, 0.9 * field * ghost, clip);
  put(lime, C.lime, 0.9 * field * ghost, clip);
  line(threadsInk, C.ink2, 0.8 * field * ghost, 1.2, clip);
  line(threadsLime, C.lime, 0.9 * field * ghost, 1.2, clip);
  line(cut, C.hot, field * ghost, 1.6, clip);
  // The held card's own detail while it fills the view.
  const near = 1 - span(t, T.zoom, T.zoom + 1.6);
  if (near > 0) {
    const m = (shape) => shape.map((c) => { const p = new Float32Array(c.pts); for (let i = 0; i < p.length; i += 2) { p[i] = 960 + p[i]; p[i + 1] = 450 + p[i + 1]; } return contour(p, c.closed); });
    line(m(S.cardRows), C.void, near, 3);
    line(m([...S.tag]), C.void, near, 2);
  }
  put(S.perMark, C.ink, window(t, T.zoom + 2.4, T.gh, 0.6, 0.6));
  put(S.preprint, C.hot, window(t, T.zoom + 2.4, T.c4, 0.6, 0.6));
  put(S.no72, C.hot, window(t, T.gh, T.loose, 0.6, 0.6));
  put(S.rounded, C.dim, window(t, T.gh + 0.6, T.loose, 0.6, 0.6) * 0.9);
  // The separate 29% share, over the dimmed marks.
  const lo = window(t, T.loose, T.trace, 0.6, 0.6);
  if (lo > 0) {
    put(rect(400, 330, 1120, 280, 24), C.void, lo * 0.92);
    put(S.loose, C.ink, lo);
    line(rect(510, 450, 900, 40, 3), C.ink2, lo, 1.4);
    put(rect(510, 450, 900 * 0.29 * span(t, T.loose + 0.3, T.loose + 1.3, ease.out), 40, 3), C.ink, lo);
    put(S.sep, C.dim, lo);
  }
  put(S.traced, C.lime, window(t, T.trace + 0.8, T.c4, 0.6, 0.6));
  // The web corpus: a texture; a gate closes over about 5% of it.
  const c4 = window(t, T.c4 - 0.2, T.exit, 0.8, 0.8);
  if (c4 > 0) {
    const gate = span(t, T.c4word, T.c4word + 1.4, ease.inOut);
    put(S.corpus, C.ink, c4 * 0.75);
    put(S.gate, C.ink, c4 * 0.75 * (1 - 0.75 * gate));
    line(S.bars.slice(0, Math.ceil(gate * S.bars.length)), C.ink, c4, 2);
    put(S.c4, C.ink, c4 * span(t, T.c4word, T.c4word + 0.8));
    put(S.high, C.hot, c4 * gate);
  }
}
