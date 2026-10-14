// Segment 1, "The shortcut and the check". The box, plain; then the engine's own two AO
// images of the ao-check view, read from the release's facts.json (64 x 64 cells, each the mean
// of its pixels): the screen-space shortcut on the left and the ray-traced reference on the
// right, resolving as its samples count up; then the two fold into one difference image, the
// cells over the tolerance light in the drift ink, and the gauge gives the certificate's verdict.
import { rect } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { rng, countUp } from "../../../raw-native/tree-c6b114d/web/motion/timeline.mjs";
import { C, box, view, inFacet, put, T, tab, tag, span, window, ease, lerp } from "./world.mjs";

const N = 64, CELL = 8.6, LEVELS = 20, Y = 452;
const X = { left: 560, right: 1360, mid: 960 };

export function prepare(A, facts, c) {
  const F = facts.facts, rt = F.ao_rt.value.flat(), ss = F.ao_ss.value.flat();
  const tol = F.tolerance.value, rmse = F.rmse.value;
  const r = rng(64), noise = Float32Array.from({ length: N * N }, () => r() * 2 - 1);
  A.s1 = { rt, ss, tol, rmse, verdict: F.verdict.value, noise, diff: rt.map((x, i) => Math.abs(x - ss[i])), samples: F.rt.value,
    box: box(view({ yaw: 34, pitch: 22, dist: 9.5 })) };
  const L = A.s1.L = {
    ss: T(A, "screen-space shortcut", { size: 34, x: X.left, y: 172 }),
    rt: T(A, `ray-traced reference . ${F.rt.value} samples`, { size: 34, x: X.right, y: 172 }),
    cells: T(A, `${N} x ${N} cells, each the mean of its pixels`, { size: 28, x: X.mid, y: 760, atlas: "mono" }),
    rmse: T(A, `rmse ${rmse.toFixed(3)}`, { size: 36, x: 1300, y: 330, anchor: "left", atlas: "mono" }),
    tol: T(A, `tolerance ${tol.toFixed(3)}`, { size: 36, x: 1300, y: 450, anchor: "left", atlas: "mono" }),
    verdict: T(A, F.verdict.value, { size: 64, x: 1300, y: 620, anchor: "left", atlas: "head" }),
    view: tag(A, "for this view"),
    question: T(A, A.film.segments[1].predict[0].question, { size: 44, x: X.mid, y: 172 }),
    draw: T(A, "convergence drawn, samples counted", { size: 28, x: X.right, y: 214, atlas: "mono" }),
  };
  L.tab = tab(A, A.ev, "rn-cert");
  A.T1 = {
    enter: c.at(1, 0, 0), creases: c.word(1, 0, 1, "creases"), trick: c.at(1, 1, 0), tracing: c.word(1, 1, 0, "tracing"),
    ask: c.ask(1, 0).start, gap: c.at(1, 2, 0), refuted: c.word(1, 2, 1, "refuted"), exit: c.at(2, 0, 0),
  };
}

// AO as a print on the void: unoccluded paper sits at a soft grey, so the image never glares.
const grey = (v) => { const g = Math.max(0, Math.min(1, v)); return [0.04 + 0.56 * g, 0.04 + 0.54 * g, 0.04 + 0.5 * g]; };

// One mosaic: cells bucketed by value into LEVELS fills (one item each), at centre (cx, cy).
function mosaic(vals, cx, cy, colourOf, o, hotOf = null) {
  const buckets = new Map();
  for (let i = 0; i < N * N; i++) {
    const v = vals[i], hot = hotOf && hotOf(i);
    const key = hot ? "hot" : Math.round(Math.max(0, Math.min(1, v)) * (LEVELS - 1));
    if (!hot && key === LEVELS - 1) continue;   // unoccluded cells are the ground
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = []));
    const x = cx + ((i % N) - N / 2) * CELL, y = cy + (Math.floor(i / N) - N / 2) * CELL;
    b.push(rect(x + 0.6, y + 0.6, CELL - 1.2, CELL - 1.2)[0]);
  }
  const frame = rect(cx - (N / 2) * CELL, cy - (N / 2) * CELL, N * CELL, N * CELL);
  const out = [{ shape: frame, fill: colourOf(1), opacity: o }];
  for (const [key, shape] of buckets) out.push({ shape, fill: key === "hot" ? C.hot : colourOf(key / (LEVELS - 1)), opacity: o });
  out.push({ shape: frame, stroke: C.ink2, width: 2, opacity: o });
  return out;
}

export const stops = (c) => [["check", c.at(1, 0, 0)]];

export function draw(t, A, items) {
  const S = A.s1, T1 = A.T1;
  if (t < T1.enter - 4 || t > T1.exit + 1) return;
  const content = [];
  // The plain box, until the shortcut's image takes its place.
  const boxA = 1 - span(t, T1.creases, T1.creases + 1.4);
  if (boxA > 0) for (const it of S.box) content.push({ ...it, opacity: (it.opacity ?? 1) * boxA });
  // Positions: both images start at the centre; at "tracing" they split; at "the gap" they fold together.
  const split = span(t, T1.tracing - 0.4, T1.tracing + 1.2), fold = span(t, T1.gap, T1.gap + 1.8);
  const xs = lerp(X.mid, X.left, split) * (1 - fold) + X.mid * fold;
  const xr = lerp(X.mid, X.right, split) * (1 - fold) + X.mid * fold;
  const ssA = span(t, T1.creases, T1.creases + 1.4) * (1 - span(t, T1.gap + 1.0, T1.gap + 1.8));
  if (ssA > 0) content.push(...mosaic(S.ss, xs, Y, grey, ssA));
  // The reference resolves as its samples count up: noise falls as one over the root of the count.
  const n = countUp(t, T1.tracing, T1.tracing + 3.2, 1, S.samples, ease.inOut, true);
  const rtA = split * (1 - span(t, T1.gap + 1.0, T1.gap + 1.8));
  if (rtA > 0) {
    const vals = S.rt.map((v, i) => (v >= 0.999 ? 1 : v + S.noise[i] * 0.35 / Math.sqrt(n)));
    content.push(...mosaic(vals, xr, Y, grey, rtA));
  }
  // The difference: each cell |rt - ss|, drift where it is over the tolerance.
  const dA = span(t, T1.gap + 1.0, T1.gap + 1.8);
  if (dA > 0) content.push(...mosaic(S.diff.map((d) => 1 - Math.min(1, d * 3)), X.mid - 160 * span(t, T1.gap + 1.8, T1.gap + 3), Y, grey, dA, (i) => S.diff[i] > S.tol && t > T1.gap + 1.4));
  items.push(...inFacet(content, "check"));
  const L = S.L, hold = window(t, T1.enter, T1.exit + 0.4, 0.8, 0.8);
  put(items, L.tab, C.ink2, hold * span(t, T1.creases - 0.5, T1.creases + 0.5) * 0.85);
  // The image labels give their line to the question while it is asked and held.
  const asking = window(t, T1.ask - 0.3, T1.gap - 0.1, 0.3, 0.4);
  put(items, L.ss, C.ink, window(t, T1.creases + 0.6, T1.gap + 1.0, 0.6, 0.5) * (1 - asking));
  put(items, L.rt, C.ink, window(t, T1.tracing + 0.6, T1.gap + 1.0, 0.6, 0.5) * (1 - asking));
  put(items, L.draw, C.dim, window(t, T1.tracing + 0.9, T1.tracing + 5.2, 0.6, 0.8));
  // The prediction pause: the question lands with the voice and stays through the held silence.
  put(items, L.question, C.ink, window(t, T1.ask, T1.gap - 0.1, 0.4, 0.4));
  put(items, L.cells, C.dim, window(t, T1.tracing + 1.2, T1.exit, 0.6, 0.6));
  gauge(t, A, T1, items, hold);
}

// The comparison: the error and the tolerance as bars on one scale, then the verdict word.
function gauge(t, A, T1, items, hold) {
  const S = A.s1, L = S.L, g = window(t, T1.gap + 1.6, T1.exit + 0.4, 0.6, 0.8);
  if (g <= 0) return;
  const x0 = 1300, w = 460 / 0.16, grow = span(t, T1.gap + 1.6, T1.gap + 3.0, ease.out);
  put(items, L.rmse, C.ink, g);
  items.push({ shape: rect(x0, 350, Math.max(2, S.rmse * w * grow), 26, 3), fill: C.ink, opacity: g, screen: true });
  put(items, L.tol, C.ink2, g);
  items.push({ shape: rect(x0, 470, Math.max(2, S.tol * w * grow), 26, 3), fill: C.dim, opacity: g, screen: true });
  items.push({ shape: rect(x0 + S.tol * w - 1, 340, 2, 166), fill: C.ink2, opacity: g * 0.8, screen: true });
  put(items, L.verdict, S.verdict === "refuted" ? C.hot : C.ok, g * span(t, T1.refuted, T1.refuted + 0.5));
  put(items, L.view, C.hot, g * span(t, T1.refuted + 0.4, T1.refuted + 1.0) * hold);
}
