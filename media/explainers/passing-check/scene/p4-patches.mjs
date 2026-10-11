// Segment 4, "When AI writes the patch" (Wang et al. 2025; Aleithan et al. 2024, both
// preprints). Patches counted solved are drawn as a bar, twice: on one, the 7.8% that
// failed the developers' own tests peels away; on the other, the 29.6% that behaved
// unlike the real fix. They sit on separate bars because the sources do not say how the
// two sets overlap. Then 251 passing patches as dots: about a third had the fix in the
// task text (32.67%, 82 dots) and about another third passed weak tests (31.08%, 78).
import { contour, rect, circle } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, lerp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C, grid } from "./world.mjs";
import { ring } from "../../checking-cost/scene/lib.mjs";

const BX = 460, BW = 1000, PATCHES = 251, LEAK = 82, WEAK = 78, COLS = 21, GAP = 26;

export function prepare(A) {
  const t = (s, o) => text(s, o).shape;
  A.p4 = {
    head: t("patches counted solved: they pass the task's tests", { atlas: A.sans, size: 32, x: 960, y: 250, anchor: "center" }),
    rows: [
      { y: 360, share: 0.078, label: t("7.8%: failed the developers' own tests", { atlas: A.mono, size: 26, x: BX, y: 450 }), hot: true },
      { y: 520, share: 0.296, label: t("29.6%: behaved unlike the real fix", { atlas: A.mono, size: 26, x: BX, y: 610 }), hot: false },
    ],
    tagA: t("preprint", { atlas: A.mono, size: 24, x: BX + BW, y: 300, anchor: "right" }),
    cells: grid(PATCHES, COLS, 960 - ((COLS - 1) * GAP) / 2, 560, GAP),
    dot: circle(0, 0, 8, 24),
    card: rect(-6, -8, 12, 16, 2),
    weak: ring(0, 0, 9, 1.4),
    head2: t("251 passing patches from one agent, checked by hand", { atlas: A.sans, size: 30, x: 960, y: 520, anchor: "center" }),
    unit: t("1 dot = 1 patch", { atlas: A.mono, size: 22, x: 960 - ((COLS - 1) * GAP) / 2 - 8, y: 560 + 12 * GAP + 10 }),
    leak: t("about a third: the fix was in the task text (32.67%)", { atlas: A.mono, size: 24, x: 960, y: 930, anchor: "center" }),
    weakL: t("about another third: passed weak tests (31.08%)", { atlas: A.mono, size: 24, x: 960, y: 966, anchor: "center" }),
    tagB: t("preprint", { atlas: A.mono, size: 24, x: 960 + ((COLS - 1) * GAP) / 2 + 30, y: 590 }),
    far: t("how far a pass can sit from a fix, on these benchmarks", { atlas: A.sans, size: 32, x: 960, y: 1004, anchor: "center" }),
  };
}

const at = (shape, x, y) => shape.map((c) => { const p = c.pts, o = new Float32Array(p.length); for (let k = 0; k < p.length; k += 2) { o[k] = p[k] + x; o[k + 1] = p[k + 1] + y; } return contour(o, c.closed); });

export function draw(t, A, T, items) {
  const S = A.p4;
  const vis = window(t, T.enter, T.exit, 0.8, 0.8);
  if (vis <= 0) return;
  const put = (shape, fill, o) => { if (o > 0) items.push({ shape, fill, opacity: o * vis, screen: true }); };
  const bars = 1 - span(t, T.earlier - 0.4, T.earlier + 0.6);
  const barY = 0;
  put(S.head, C.ink2, span(t, T.enter + 0.3, T.enter + 1.2) * bars);
  const pre = 1 + 0.6 * window(t, T.preprints, T.preprints + 1.4, 0.3, 0.6);
  S.rows.forEach((row, k) => {
    const on = span(t, T.study + k * 0.4, T.study + 1.0 + k * 0.4, ease.out);
    const peel = span(t, T.shares + (k ? 3.6 : 0.6), T.shares + (k ? 5.0 : 2.0), ease.inOut);
    const y = row.y + barY, w = BW * row.share, x1 = BX + BW - w;
    put(rect(BX, y, (BW - w) * on, 28, 3), C.ink, 0.85 * on * bars);
    if (on > 0) put(rect(x1 + 34 * peel, y + 46 * peel, w, 28, 3), row.hot ? C.hot : C.ink2, on * bars);
    put(row.label, row.hot ? C.hot : C.ink2, peel * bars);
  });
  put(S.tagA, C.hot, Math.min(1, span(t, T.study + 0.6, T.study + 1.4) * bars * pre));
  // 251 patches.
  const g = span(t, T.earlier + 0.6, T.earlier + 2.4, ease.out);
  if (g <= 0) return;
  put(S.head2, C.ink2, g); put(S.unit, C.dim, g);
  const leak = span(t, T.third, T.third + 2.2, ease.out), weak = span(t, T.third + 2.6, T.third + 4.4, ease.out);
  const dots = [], cards = [], weaks = [];
  for (let i = 0; i < PATCHES; i++) {
    const [x, y] = S.cells[i];
    if (i < LEAK && leak > i / LEAK) cards.push(...at(S.card, x, y));
    else if (i >= LEAK && i < LEAK + WEAK && weak > (i - LEAK) / WEAK) { dots.push(...at(circle(0, 0, 4, 16), x, y)); weaks.push(...at(S.weak, x, y)); }
    else if (g > i / PATCHES) dots.push(...at(S.dot, x, y));
  }
  put(dots, C.ink, 0.85); put(cards, C.ink, 1);
  if (weaks.length) items.push({ shape: weaks, fill: C.ink2, opacity: vis, screen: true });
  put(S.leak, C.ink, leak); put(S.weakL, C.ink2, weak);
  put(S.tagB, C.hot, Math.min(1, g * pre));
  put(S.far, C.ink, window(t, T.far, T.exit, 0.6, 0.6));
}
