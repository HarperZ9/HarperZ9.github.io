// Causal multi-head self-attention, forward and backward, by hand.
//
// qkv holds, for every position, the query, key and value vectors side by
// side: [N, 3D] with N = B * T and D = dModel, heads split each D-wide block
// into H slices of width hd = D / H.
//
// att and scores are [B, H, T, T]. Row i of a head is where position i looks.
// Entries above the diagonal (future positions) are exactly 0 in both arrays;
// in scores that 0 means "masked", not a score of zero.
//
// mode selects the lesson's control conditions:
//   "normal"  softmax(q.k / sqrt(hd)) over positions j <= i
//   "self"    every position attends only to itself (no word can read another)
//   "uniform" every position spreads weight 1/(i+1) over its past (a bag of
//             words: the model knows which words came before, not where)
// In "self" and "uniform" the queries and keys receive no gradient.

export function attnForward(ao, att, scores, qkv, B, T, D, H, mode) {
  const hd = D / H, scale = 1 / Math.sqrt(hd);
  att.fill(0);
  scores.fill(0);
  for (let b = 0; b < B; b++) {
    for (let h = 0; h < H; h++) {
      for (let i = 0; i < T; i++) {
        const row = ((b * H + h) * T + i) * T;
        if (mode === "normal") softmaxRow(att, scores, row, qkv, b, h, i, T, D, hd, scale);
        else if (mode === "self") att[row + i] = 1;
        else for (let j = 0; j <= i; j++) att[row + j] = 1 / (i + 1);
        mixValues(ao, att, row, qkv, b, h, i, T, D, hd);
      }
    }
  }
}

// Scores for query i against keys 0..i, then a max-shifted softmax.
function softmaxRow(att, scores, row, qkv, b, h, i, T, D, hd, scale) {
  const D3 = 3 * D;
  const qi = (b * T + i) * D3 + h * hd;
  let mx = -Infinity;
  for (let j = 0; j <= i; j++) {
    const kj = (b * T + j) * D3 + D + h * hd;
    let s = 0;
    for (let d = 0; d < hd; d++) s += qkv[qi + d] * qkv[kj + d];
    s *= scale;
    scores[row + j] = s;
    if (s > mx) mx = s;
  }
  let sum = 0;
  for (let j = 0; j <= i; j++) { const e = Math.exp(scores[row + j] - mx); att[row + j] = e; sum += e; }
  for (let j = 0; j <= i; j++) att[row + j] /= sum;
}

// ao[i, head slice] = sum_j att[i, j] * v_j
function mixValues(ao, att, row, qkv, b, h, i, T, D, hd) {
  const D3 = 3 * D;
  const oi = (b * T + i) * D + h * hd;
  for (let d = 0; d < hd; d++) ao[oi + d] = 0;
  for (let j = 0; j <= i; j++) {
    const a = att[row + j];
    if (a === 0) continue;
    const vj = (b * T + j) * D3 + 2 * D + h * hd;
    for (let d = 0; d < hd; d++) ao[oi + d] += a * qkv[vj + d];
  }
}

// Backward. dqkv is overwritten. `tmp` is scratch of length >= T.
// brokenSoftmax drops the "- sum_k a_k * datt_k" term of the softmax
// Jacobian; it exists only so the gradient check can prove it catches a
// plausible-looking but wrong backward pass.
export function attnBackward(dqkv, dao, att, qkv, B, T, D, H, mode, tmp, brokenSoftmax = false) {
  const hd = D / H, scale = 1 / Math.sqrt(hd), D3 = 3 * D;
  dqkv.fill(0);
  for (let b = 0; b < B; b++) {
    for (let h = 0; h < H; h++) {
      for (let i = 0; i < T; i++) {
        const row = ((b * H + h) * T + i) * T;
        const oi = (b * T + i) * D + h * hd;
        // d att[i, j] = dao_i . v_j, and v_j collects att[i, j] * dao_i.
        for (let j = 0; j <= i; j++) {
          const vj = (b * T + j) * D3 + 2 * D + h * hd;
          const a = att[row + j];
          let s = 0;
          for (let d = 0; d < hd; d++) {
            s += dao[oi + d] * qkv[vj + d];
            dqkv[vj + d] += a * dao[oi + d];
          }
          tmp[j] = s;
        }
        if (mode !== "normal") continue;
        scoreBackward(dqkv, att, qkv, tmp, row, b, h, i, T, D, hd, scale, brokenSoftmax);
      }
    }
  }
}

// Through the softmax and the scaled dot product into q_i and every k_j.
function scoreBackward(dqkv, att, qkv, datt, row, b, h, i, T, D, hd, scale, broken) {
  const D3 = 3 * D;
  let dot = 0;
  for (let j = 0; j <= i; j++) dot += att[row + j] * datt[j];
  if (broken) dot = 0;
  const qi = (b * T + i) * D3 + h * hd;
  for (let j = 0; j <= i; j++) {
    const ds = att[row + j] * (datt[j] - dot) * scale;
    if (ds === 0) continue;
    const kj = (b * T + j) * D3 + D + h * hd;
    for (let d = 0; d < hd; d++) {
      dqkv[qi + d] += ds * qkv[kj + d];
      dqkv[kj + d] += ds * qkv[qi + d];
    }
  }
}
