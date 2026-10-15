// The matrices lab, drawn: the crane cab (the reader's matrix, or two cranes in an order, moving the
// tracing sheet over Pylon's chart), or the attention question (every earlier word's score q . k / 4
// and its share, computed from the trained weights). A Motion display list; pure in (state, time).
import { rect, circle, words, label } from "../../media/school/shared/lib.mjs";
import { K, desk, paper, pylon } from "../../media/school/vectors/scene/chart.mjs";
import { sheet, steps, block, pin, crateOn, det, f2 } from "../../media/school/matrices/scene/sheet.mjs";

const CRATES = [[1, 1], [3, 0.5], [2, 2.5], [0.5, 3]];

function cab(s, A, t) {
  const M = s.total, items = [...desk(t), ...paper(A), ...sheet(M), ...CRATES.flatMap((p) => crateOn(M, p)), ...steps(M), ...pin()];
  if (s.two) {
    items.push(...block(A, s.first, 360, 40, { size: 26, name: "first crane" }), ...block(A, s.second, 640, 40, { size: 26, name: "then" }), ...block(A, M, 920, 40, { size: 26, name: "together: one matrix" }));
  } else items.push(...block(A, M, 380, 50, { size: 34, name: "your matrix" }));
  const d = det(M);
  items.push({ shape: rect(1230, 50, 330, 96, 10), fill: [0.06, 0.045, 0.03, 0.88], screen: true },
    label(A, `determinant ${f2(d)}`, 30, 1395, 92, K.ember, "center", 1, "mono"),
    label(A, Math.abs(d) < 0.005 ? "flattened onto a line" : d < 0 ? "flipped over" : "area scale", 22, 1395, 128, K.nightDim, "center"));
  items.push(...pylon(t, 1745, 1015, 0.52, { look: [-8, -3] }));
  return items;
}

function question(s, A) {
  const items = [{ shape: rect(0, 0, 1920, 1080), screen: true, fill: [0.01, 0.01, 0.014, 1] }], W = s.words, n = W.length, q = s.query, gap = Math.min(150, 1600 / n);
  const x = (i) => 960 + (i - (n - 1) / 2) * gap, maxS = Math.max(...s.scores.map(Math.abs), 1e-6);
  W.forEach((w, i) => {
    const hot = i === q, live = i <= q;
    items.push(label(A, w, 32, x(i), 820, hot ? K.ember : live ? K.night : K.nightDim, "center"));
    if (!live) return;
    const sh = s.shares[i], h = 520 * sh;
    items.push({ shape: rect(x(i) - gap * 0.3, 760 - h, gap * 0.6, h + 1, 4), fill: [1, 0.85, 0.6, 0.25 + 0.7 * sh], blend: "add" });
    items.push(label(A, `${Math.round(sh * 100)}%`, 24, x(i), 745 - h, K.night, "center", 1, "mono"), label(A, f2(s.scores[i]), 22, x(i), 870, s.scores[i] >= 0 ? K.nightDim : [0.6, 0.7, 0.85, 1], "center", 1, "mono"));
    items.push({ shape: circle(x(i), 900, 2 + 8 * Math.abs(s.scores[i]) / maxS, 10), fill: [0.6, 0.7, 0.85, 0.6] });
  });
  items.push(label(A, `'${W[q]}' asks; each earlier word's score is q . k / ${Math.sqrt(s.dHead)}; the shares are their softmax`, 26, 960, 120, K.nightDim, "center", 1, "mono"));
  items.push(label(A, s.zeroQ ? "query matrix set to zero: only its bias is left" : `layer ${s.layer + 1}, head ${s.head + 1}: the trained query and key matrices`, 30, 960, 70, s.zeroQ ? K.ember : K.night, "center"));
  items.push(label(A, "bars: each word's share of the light; numbers under the words: its score", 22, 960, 160, K.nightDim, "center", 1, "mono"));
  return items;
}

export function frame(s, A, t) {
  return { background: [0.02, 0.016, 0.012], camera: { x: 960, y: 540, zoom: 1 }, items: s.mode === "question" ? question(s, A) : cab(s, A, t),
    post: { bloom: s.mode === "question" ? 0.3 : 0.12, threshold: 1.0, vignette: 0.35, grain: 0, passes: [] } };
}
