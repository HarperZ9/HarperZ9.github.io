// Lesson F2, "Matrices move space". A 2 x 2 matrix applied to points and to
// a grid, composition, the determinant as area scale, columns as the images
// of the unit arrows, and the finale: the attention film's query and key
// computed as one matrix times one vector, from the trained model.
//
// Plain ES module, no dependencies, Node and browser. Nothing here reads
// files: callers pass the parsed media/school/attention/model.json object.
//
// Convention: a 2 x 2 matrix is [[a, b], [c, d]] (rows), a point is [x, y],
// and M v = [a x + b y, c x + d y].

import { fromJSON, forward, attentionOn } from "./tinyformer.mjs";
import { encode, PROBES } from "./corpus.mjs";

export const apply = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1], M[1][0] * v[0] + M[1][1] * v[1]];
export const applyAll = (M, pts) => pts.map((p) => apply(M, p));

// (A B) v = A (B v): B acts first. Entry (i, j) is row i of A dot column j of B.
export function compose(A, B) {
  return [0, 1].map((i) => [0, 1].map((j) => A[i][0] * B[0][j] + A[i][1] * B[1][j]));
}

export const det = (M) => M[0][0] * M[1][1] - M[0][1] * M[1][0];

// The columns of M are where the unit arrows land: M [1,0] and M [0,1].
export const columns = (M) => [[M[0][0], M[1][0]], [M[0][1], M[1][1]]];

export const IDENTITY = Object.freeze([[1, 0], [0, 1]]);
export const QUARTER_TURN = Object.freeze([[0, -1], [1, 0]]);    // 90 degrees counter-clockwise
export const STRETCH_X = Object.freeze([[2, 0], [0, 1]]);       // doubles every x
export const SHEAR_X = Object.freeze([[1, 1], [0, 1]]);

// Grid lines from -n to n in both directions, each sampled at `steps` + 1
// points, then moved by M. Returns { lines: [[ [x,y], ... ], ...] }; the
// first 2n+1 lines are vertical (constant x), the rest horizontal.
export function grid(n = 3, steps = 12) {
  const lines = [];
  for (const vertical of [true, false]) {
    for (let g = -n; g <= n; g++) {
      const line = [];
      for (let s = 0; s <= steps; s++) {
        const t = -n + (2 * n * s) / steps;
        line.push(vertical ? [g, t] : [t, g]);
      }
      lines.push(line);
    }
  }
  return lines;
}
export const moveGrid = (M, lines) => lines.map((l) => applyAll(M, l));

// Signed area of a polygon (shoelace). The unit square has area 1; after M
// it has area det(M), which is what "determinant = area scale" means.
export function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}
export const UNIT_SQUARE = Object.freeze([[0, 0], [1, 0], [1, 1], [0, 1]]);

// The order demo: a quarter turn and a horizontal stretch do not commute.
// AB stretches first then turns; BA turns first then stretches.
export function orderDemo(A = QUARTER_TURN, B = STRETCH_X) {
  const AB = compose(A, B), BA = compose(B, A);
  const same = AB.every((r, i) => r.every((v, j) => v === BA[i][j]));
  return { A, B, AB, BA, commute: same, onArrow: { AB: apply(AB, [1, 0]), BA: apply(BA, [1, 0]) } };
}

// General matrix (rows x cols, row-major nested arrays) times vector.
export function matVec(W, v) {
  return W.map((row) => row.reduce((s, w, i) => s + w * v[i], 0));
}

// ---- the finale -----------------------------------------------------------

// The head whose reading word puts the most attention on the answer's source,
// the same rule tools/school/fill_film.mjs uses to pick the film's head.
function bestHead(model, probe) {
  const att = attentionOn(model, probe.words);
  let best = { layer: 0, head: 0, weight: -1 };
  att.layers.forEach((heads, l) => heads.forEach((rows, h) => {
    const w = rows[probe.query][probe.answerFrom];
    if (w > best.weight) best = { layer: l, head: h, weight: w };
  }));
  return best;
}

// The attention film's score as one matrix product. For the probe (default
// the film's, PROBES[0]) the existing forward pass gives the input to the
// chosen layer's attention after its first layer norm (ln1). That 32-number
// row, times the head's 32 x 16 slice of wqkv plus the bias slice, is the
// query (at the reading word) or the key (at the answer's source word).
//
// wqkv is [d, 3d] row-major (inputs by outputs, see tinyformer-dense.mjs);
// output columns are [queries | keys | values], each split by head, so head
// h's query is columns h*hd .. (h+1)*hd and its key is d + h*hd onward.
// Sums start at the bias and run k = 0..d-1 in double precision, then round
// to float32: the same arithmetic as matmul, so q and k match the forward
// pass's own buffer bit for bit.
export function attentionFinale(modelJson, { probe = PROBES[0], layer, head } = {}) {
  const model = fromJSON(modelJson.weights ?? modelJson);
  const D = model.config.dModel, H = model.config.nHeads, hd = D / H;
  const pick = layer === undefined || head === undefined ? bestHead(model, probe) : { layer, head };
  const { layer: l, head: h } = pick;
  const T = probe.words.length;
  const fw = forward(model, encode(probe.words), 1, T, { keep: true });
  const L = fw.work.layers[l], W = model.params[`l${l}.wqkv`], bias = model.params[`l${l}.bqkv`];
  const row = (pos) => Array.from(L.ln1.subarray(pos * D, (pos + 1) * D));
  const slice = (off) => Array.from({ length: D }, (_, k) => Array.from({ length: hd }, (_, j) => W[k * 3 * D + off + j]));
  const project = (x, Wm, off) => Array.from({ length: hd }, (_, j) => {
    let s = bias[off + j];
    for (let k = 0; k < D; k++) s += x[k] * Wm[k][j];
    return Math.fround(s);
  });
  const qOff = h * hd, kOff = D + h * hd;
  const xq = row(probe.query), xk = row(probe.answerFrom);
  const Wq = slice(qOff), Wk = slice(kOff);
  const q = project(xq, Wq, qOff), k = project(xk, Wk, kOff);
  let qk = 0;
  for (let j = 0; j < hd; j++) qk += q[j] * k[j];
  // Cross-check against the forward pass's own q/k buffer and its pre-softmax score.
  const qkv = L.qkv, sc = fw.scores[l];
  let maxDiff = 0;
  for (let j = 0; j < hd; j++) {
    maxDiff = Math.max(maxDiff, Math.abs(q[j] - qkv[probe.query * 3 * D + qOff + j]), Math.abs(k[j] - qkv[probe.answerFrom * 3 * D + kOff + j]));
  }
  const forwardScore = sc[(h * T + probe.query) * T + probe.answerFrom];
  return {
    layer: l, head: h, dModel: D, dHead: hd,
    readingWord: probe.words[probe.query], answerWord: probe.words[probe.answerFrom],
    query: probe.query, answerFrom: probe.answerFrom,
    xQuery: xq, xKey: xk, Wq, Wk, bq: Array.from(bias.subarray(qOff, qOff + hd)), bk: Array.from(bias.subarray(kOff, kOff + hd)),
    q, k, qkRaw: qk, scaled: qk / Math.sqrt(hd), forwardScore, maxDiffFromForward: maxDiff,
  };
}
