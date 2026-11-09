// Visual-direction proofs for lesson F2 (matrices): one beat, a matrix moving the whole chart.
// The shear [[1, 1], [0, 1]] then the quarter turn, applied to a grid and two unit steps, two ways:
// ?dir=E (Pylon's printed chart stays put; a sheet of tracing paper with its own grid is what the
// crane moves) or ?dir=B (the grid as fine line-work in the dark). Labels are scene items.
import { rect, circle, polyline, words, lin, rad } from "../../shared/lib.mjs";
import { K, P, desk, paper, arrow, pylon } from "../../vectors/scene/chart.mjs";
import { GUIDES } from "../../shared/lib.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "E";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const lerpM = (A, B, u) => A.map((r, i) => r.map((v, k) => v + (B[i][k] - v) * u));
const apply = (M, [x, y]) => [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y];
const I = [[1, 0], [0, 1]], SHEAR = [[1, 1], [0, 1]], TURN = [[0, -1], [1, 0]];
const matAt = (t) => (t < 3 ? lerpM(I, SHEAR, sm(0.5, 2.5, t)) : lerpM(SHEAR, [[0, -1], [1, 1]], sm(3.2, 5.2, t)));

function gridLines(M, colour, w) {
  const out = [];
  for (let k = -2; k <= 4; k++) {
    out.push({ shape: polyline([...P(apply(M, [k, -1])), ...P(apply(M, [k, 4]))]), fill: null, stroke: colour, width: w });
    out.push({ shape: polyline([...P(apply(M, [-2, k])), ...P(apply(M, [5, k]))]), fill: null, stroke: colour, width: w });
  }
  return out;
}
const mtext = (M) => `[ ${M[0][0].toFixed(2)}  ${M[0][1].toFixed(2)} ]   [ ${M[1][0].toFixed(2)}  ${M[1][1].toFixed(2)} ]`;

export default {
  title: `Matrices proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono };
  },
  frame(t, ctx) {
    const A = ctx.assets, M = matAt(t), e = apply(M, [1, 0]), n = apply(M, [0, 1]), items = [];
    if (DIR === "E") {
      items.push(...desk(t), ...paper(A));
      // The tracing sheet: a translucent quad (the moved square of the chart) with its own grid.
      const c = [[-2, -1], [5, -1], [5, 4], [-2, 4]].map((p) => P(apply(M, p)));
      items.push({ shape: polyline(c.flat(), true), fill: [0.97, 0.97, 1, 0.28], stroke: [0.2, 0.25, 0.35, 0.6], width: 2 });
      items.push(...gridLines(M, [0.2, 0.3, 0.5, 0.55], 2), ...arrow(P([0, 0]), P(e), K.ink, 8), ...arrow(P([0, 0]), P(n), K.rust, 8));
      items.push({ shape: rect(360, 40, 900, 110, 10), fill: [0.06, 0.045, 0.03, 0.88], screen: true }, { shape: words(mtext(M), A.mono, 34, 390, 108), fill: K.night, screen: true });
      items.push(...pylon(t, 1745, 1015, 0.52));
      return { background: [0.02, 0.016, 0.012], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.12, threshold: 1.0, vignette: 0.4, grain: 0.06, passes: [] } };
    }
    items.push({ shape: rect(0, 0, 1920, 1080), fill: [0.01, 0.01, 0.014, 1], screen: true });
    items.push(...gridLines(I, [0.6, 0.7, 0.85, 0.12], 1), ...gridLines(M, [0.93, 0.9, 0.84, 0.5], 1.5));
    for (let x = -2; x <= 5; x += 0.25) for (let y = -1; y <= 4; y += 0.25) items.push({ shape: circle(...P(apply(M, [x, y])), 1.6, 6), fill: [0.93, 0.9, 0.84, 0.5], blend: "add" });
    items.push(...arrow(P([0, 0]), P(e), "#ece5d6", 6), ...arrow(P([0, 0]), P(n), "#e29472", 6));
    items.push({ shape: words(mtext(M), A.mono, 34, 390, 108), fill: "#ece5d6", screen: true });
    items.push(...pylon(t, 1745, 1015, 0.45));
    return { background: [0, 0, 0], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.3, threshold: 1.0, vignette: 0.3, grain: 0.05, passes: [] } };
  },
};
