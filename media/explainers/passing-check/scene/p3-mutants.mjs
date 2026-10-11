// Segment 3, "Check the check" (Just et al. 2014). Back to one program. Mutants are
// deliberate breaks, drawn as cracks with a dashed edge in ink. Then 357 real bugs as
// dots: 73% (261) gain a ghost ring, coupled to a mutant; 17% (61) stay alone in drift,
// coupled to none; the other 35 are in neither share in the passage read, so they stay
// unmarked and say so. Counts are the shares rounded to whole dots.
import { contour, circle } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp, rng } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, N, BROKEN, lineShape, grid } from "./world.mjs";
import { ring, dashed } from "../../checking-cost/scene/lib.mjs";

export const BUGS = 357, COUPLED = 261, NONE = 61;
const COLS = 21, GAP = 26, GX = 1480, GY = 545 - (17 * GAP) / 2, R = 8;

export function prepare(A) {
  const P = A.prog, r = rng(357);
  const t = (s, o) => text(s, o).shape;
  // Six mutants on lines the tests run, spread down the program.
  const picks = [6, 15, 24, 31, 44, 53].map((i) => (i === BROKEN ? i + 2 : i));
  const mutants = picks.map((i) => {
    const L = P.lines[i], x = L.x + L.len * (0.3 + 0.4 * r());
    return { i, x, y: L.y, shape: dashed(x - 1, L.y - 6, x + 1.4, L.y + 6, 2.2, 1.6) };
  });
  A.p3 = {
    mutants,
    named: t("mutant: a deliberate break", { atlas: A.sans, size: 30, x: 960, y: 960, anchor: "center" }),
    cells: grid(BUGS, COLS, GX, GY, GAP),
    dot: circle(0, 0, R, 24),
    ghost: ring(0, 0, R + 4.5, 1.2),
    title: t("357 real bugs, fixed by developers", { atlas: A.sans, size: 26, x: GX - R, y: GY - 30 }),
    unit: t("1 dot = 1 real bug", { atlas: A.mono, size: 22, x: GX - R, y: GY + 17 * GAP + 18 }),
    coupled: t("73% coupled to a mutant", { atlas: A.mono, size: 24, x: GX + COLS * GAP + 10, y: GY + 60 }),
    none: t("17% coupled to none", { atlas: A.mono, size: 24, x: GX + COLS * GAP + 10, y: GY + 12.6 * GAP }),
    rest: t("35 (dim): in neither share in the passage read", { atlas: A.mono, size: 20, x: GX - R, y: GY + 17 * GAP + 74 }),
    rounded: t("rounded to whole dots", { atlas: A.mono, size: 20, x: GX - R, y: GY + 17 * GAP + 46 }),
  };
}

export function camera(t, T) {
  const back = span(t, T.enter, T.enter + 2.0, ease.inOut), side = span(t, T.just, T.just + 1.6, ease.inOut);
  return { x: lerp(960, 1440, side), y: 545, zoom: Math.exp(lerp(Math.log(0.3), 0, back)) };
}

const at = (shape, x, y) => shape.map((c) => { const p = c.pts, o = new Float32Array(p.length); for (let k = 0; k < p.length; k += 2) { o[k] = p[k] + x; o[k + 1] = p[k + 1] + y; } return contour(o, c.closed); });

export function draw(t, A, T, items) {
  const S = A.p3, P = A.prog;
  const vis = window(t, T.enter + 0.3, T.exit, 1.0, 0.8);
  if (vis <= 0) return;
  const lines = [];
  for (let i = 0; i < N; i++) lines.push(...lineShape(P.lines[i]));
  items.push({ shape: lines, stroke: C.ink, width: 1.5, opacity: 0.5 * vis });
  S.mutants.forEach((m, k) => {
    const a = span(t, T.enter + 1.4 + k * 0.45, T.enter + 1.9 + k * 0.45, ease.out);
    if (a > 0) items.push({ shape: m.shape, stroke: C.ink, width: 1.6, opacity: a * vis });
  });
  if (t >= T.named) items.push({ shape: S.named, fill: C.ink2, opacity: window(t, T.named, T.just + 0.5, 0.5, 0.5) * vis, screen: true });
  const dotsOn = span(t, T.just + 1.0, T.just + 3.0, ease.out);
  if (dotsOn <= 0) return;
  const cpl = span(t, T.coupled, T.coupled + 2.0, ease.out), non = span(t, T.none, T.none + 1.6, ease.out);
  const plain = [], coupled = [], ghosts = [], alone = [], rest = [];
  for (let i = 0; i < BUGS; i++) {
    const [x, y] = S.cells[i], on = span(dotsOn, (i / BUGS) * 0.6, (i / BUGS) * 0.6 + 0.4);
    if (on <= 0) continue;
    const d = at(S.dot, x, y);
    if (i < COUPLED && cpl > i / COUPLED) { coupled.push(...d); ghosts.push(...at(S.ghost, x, y)); }
    else if (i >= COUPLED && i < COUPLED + NONE && non > (i - COUPLED) / NONE) alone.push(...d);
    else if (i >= COUPLED + NONE && non > 0) rest.push(...d);
    else plain.push(...d);
  }
  const put = (shape, fill, o) => { if (shape.length && o > 0) items.push({ shape, fill, opacity: o * vis }); };
  put(plain, C.ink, 0.8 * dotsOn); put(coupled, C.ink, 0.95); put(alone, C.hot, 1); put(rest, C.dim, 0.7);
  if (ghosts.length) items.push({ shape: ghosts, fill: C.ink2, opacity: 0.6 * vis });
  put(S.title, C.ink2, dotsOn); put(S.unit, C.dim, dotsOn);
  put(S.coupled, C.ink, cpl); put(S.none, C.hot, non); put(S.rest, C.dim, non * span(t, T.none + 1.2, T.none + 2.0));
  put(S.rounded, C.hot, Math.max(cpl, non) * 0.9);
}
