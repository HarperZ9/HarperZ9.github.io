// Segment 2, "Lines run are not faults found" (Inozemtseva and Holmes 2014).
// Coverage is the share of lines the tests run. The camera pulls back from one program
// to five, and the programs dissolve into 31,000 points, one per test suite, laid out as
// an arrangement (the paper's per-suite values are not in our sources). A gauge in words
// shows the size-controlled relation, "low to moderate", and Joda Time's "essentially
// zero". No correlation number is drawn: the sources give words, so the film gives words.
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp, rng } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, N, lineShape, rect, line } from "./world.mjs";

const SUITES = 31000, PROGRAMS = 5, SPACING = 1250, ZOUT = 0.3;

export function prepare(A, ctx) {
  const P = A.prog, r = rng(31000);
  const t = (s, o) => text(s, o).shape;
  const a = new Float32Array(2 * SUITES), b = new Float32Array(2 * SUITES), delay = new Float32Array(SUITES);
  for (let i = 0; i < SUITES; i++) {
    const p = i % PROGRAMS, L = P.lines[Math.floor(r() * N)], dx = (p - 2) * SPACING;
    a[2 * i] = L.x + r() * L.len + dx; a[2 * i + 1] = L.y + (r() - 0.5) * 3;
    const th = r() * Math.PI * 2, rad = Math.sqrt(r());
    b[2 * i] = 960 + Math.cos(th) * rad * 2700; b[2 * i + 1] = 545 + Math.sin(th) * rad * 1500;
    delay[i] = r();
  }
  A.p2 = {
    field: ctx.motion ? ctx.motion.particles({ count: SUITES, formations: [a, b], colors: ["#e3e4d2", "#e3e4d2"], delay, seed: 9 }) : null,
    define: t("coverage: the share of the code the tests run", { atlas: A.sans, size: 34, x: 960, y: 960, anchor: "center" }),
    count: t("31,000 test suites . 5 Java programs", { atlas: A.mono, size: 34, x: 960, y: 120, anchor: "center" }),
    unit: t("1 point = 1 test suite", { atlas: A.mono, size: 26, x: 960, y: 166, anchor: "center" }),
    arrangement: t("arrangement, not data", { atlas: A.mono, size: 26, x: 960, y: 202, anchor: "center" }),
    gaugeTitle: t("coverage vs faults caught, suite size controlled", { atlas: A.sans, size: 32, x: 960, y: 760, anchor: "center" }),
    words: ["none", "low", "moderate", "strong"].map((w, k) => t(w, { atlas: A.sans, size: 26, x: 560 + k * 266.7, y: 878, anchor: "center" })),
    axis: line(560, 836, 1360, 836),
    ticks: [0, 1, 2, 3].flatMap((k) => line(560 + k * 266.7, 828, 560 + k * 266.7, 844)),
    band: rect(560 + 266.7 * 0.75, 826, 266.7 * 1.5, 20, 4),
    bandLabel: t("low to moderate", { atlas: A.mono, size: 28, x: 960, y: 812, anchor: "center" }),
    joda: rect(552, 826, 16, 20, 4),
    jodaLabel: t("Joda Time: essentially zero", { atlas: A.mono, size: 26, x: 560, y: 918, anchor: "center" }),
    advice: t("Their advice:", { atlas: A.sans, size: 30, x: 960, y: 470, anchor: "center" }),
    quote: t("\"should not be used as a quality target\"", { atlas: A.mono, size: 40, x: 960, y: 540, anchor: "center" }),
  };
}

export function camera(t, T) {
  const u = span(t, T.study, T.study + 3.2, ease.inOut);
  return { x: 960, y: 545, zoom: Math.exp(lerp(0, Math.log(ZOUT), u)) };
}

export function draw(t, A, T, items, zoom) {
  const S = A.p2, P = A.prog;
  const vis = window(t, T.enter - 0.3, T.exit, 0.4, 1.0);
  if (vis <= 0) return;
  const runAny = new Set([...P.runs[0], ...P.runs[1], ...P.runs[2]]);
  const dissolve = span(t, T.study + 3.0, T.study + 6.5, ease.inOut);
  // The programs: the first one, then four more as the camera pulls back.
  const more = span(t, T.study + 1.0, T.study + 2.6);
  for (let p = 0; p < PROGRAMS; p++) {
    const o = (p === 2 ? 1 : more) * (1 - dissolve) * vis;
    if (o <= 0) continue;
    const dx = (p - 2) * SPACING, lines = [], runs = [];
    for (let i = 0; i < N; i++) (p === 2 && runAny.has(i) ? runs : lines).push(...lineShape(P.lines[i], dx));
    items.push({ shape: lines, stroke: C.ink, width: 1.5 / Math.max(zoom, 0.3), opacity: (p === 2 ? 0.25 : 0.45) * o });
    if (runs.length) items.push({ shape: runs, stroke: C.ink, width: 1.5 / Math.max(zoom, 0.3), opacity: 0.95 * o });
  }
  // 31,000 suites as points.
  const gaugeOn = span(t, T.size, T.size + 0.8), quoteOn = span(t, T.advice, T.advice + 0.8);
  if (S.field && dissolve > 0) items.push({ kind: "particles", system: S.field, from: 0, to: 1, t: dissolve, spread: 0.5, drift: 1.5, time: t, size: [3.0, 4.5],   // world units: about 1 px at the pulled-back zoom
    blend: "add", opacity: vis * Math.min(1, dissolve * 2) * lerp(0.75, 0.22, Math.max(gaugeOn, quoteOn)) });
  const scr = (shape, color, o) => { if (o > 0) items.push({ shape, fill: color, opacity: o * vis, screen: true }); };
  const strokeScr = (shape, color, o, w = 2) => { if (o > 0) items.push({ shape, stroke: color, width: w, opacity: o * vis, screen: true }); };
  scr(S.define, C.ink2, window(t, T.enter + 0.4, T.study + 0.6, 0.6, 0.5));
  const countA = window(t, T.study + 3.4, T.exit, 0.6, 0.6);
  scr(S.count, C.ink, countA);
  scr(S.unit, C.dim, countA);
  scr(S.arrangement, C.hot, countA);
  // The gauge, in words.
  const g = window(t, T.size, T.advice - 0.2, 0.7, 0.5);
  scr(S.gaugeTitle, C.ink2, g);
  strokeScr(S.axis, C.ink2, g); strokeScr(S.ticks, C.ink2, g);
  S.words.forEach((w) => scr(w, C.dim, g));
  scr(S.band, C.ink, g * span(t, T.size + 1.0, T.size + 2.2, ease.out));
  scr(S.bandLabel, C.ink, g * span(t, T.size + 1.4, T.size + 2.4));
  const jo = g * span(t, T.zero, T.zero + 0.8);
  scr(S.joda, C.hot, jo); scr(S.jodaLabel, C.hot, jo);
  const q = window(t, T.advice, T.exit, 0.7, 0.6);
  scr(S.advice, C.ink2, q); scr(S.quote, C.ink, q);
}
