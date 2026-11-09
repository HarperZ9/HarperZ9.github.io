// Lesson K23, "Fused attention". Pure ES module, no DOM and no dependencies:
// the lab page, a worker and the Node fill script share it.
//
// Attention for one head: O = softmax(scale * Q K^T) V, Q, K, V of N rows by
// d columns, scale = 1 / sqrt(d). The standard way writes the N x N score
// matrix S to memory, softmaxes it into P, then multiplies P by V. The fused
// way (FlashAttention, Dao and others 2022, arXiv:2205.14135, Algorithm 1)
// walks the keys in tiles and keeps, per query row, a running max m, a
// running sum l and an unnormalised output; when a tile raises the max, l
// and the output are rescaled by exp(m_old - m_new) (the online normaliser,
// Milakov and Gimelshein 2018, arXiv:1805.02867, Algorithm 3), so S never
// exists in full. The broken variant forgets to rescale l: the control.
//
// Error bound (derived here, first order in u; not quoted from a source).
// For query row i, with u = 2^-24 and gamma_n = n u / (1 - n u) (Higham,
// Accuracy and Stability of Numerical Algorithms, equation 3.5):
//   delta_i = max_j gamma_(d+1) scale sum_t |q_it k_jt|   (score error)
//   e_i     = max_j (3 + 2 |s_ij - m_i|) 2^-23           (exp, at WGSL's f32
//             accuracy for exp, 3 + 2|x| ULP, so a GPU is held to it too)
//   bound   = 2 (exp(2 delta_i + 2 e_i) - 1 + gamma_K) sum_j p_ij |v_jc|
//             + N 2^-149 max |v|, with K = N + 2 ceil(N / Bc) + 2.
// Each weight p_ij is off by at most a factor exp(+-(2 delta + 2 e)) from the
// score and exp errors of numerator and sum; the rescale factors multiply the
// output and l alike and cancel; the sums add gamma_K. The tests show float32
// passes, a zero tolerance fails, and the broken variant fails.

import { forward } from "./tinyformer-model.mjs";
import { encode } from "./corpus.mjs";
import { rng } from "./tinyformer-ops.mjs";

export const U32 = 2 ** -24, ULP32 = 2 ** -23, M_INIT = Math.fround(-3e38);
export const gamma = (n) => (n * U32) / (1 - n * U32);
const fr = Math.fround, id = (x) => x;

export function makeQKV(N, d, seed = 1, spread = 1) {
  const r = rng(seed), mk = () => Float32Array.from({ length: N * d }, () => spread * (2 * r() - 1));
  return { q: mk(), k: mk(), v: mk() };
}

// ---- softmax, three ways, on one vector ----

export function naiveSoftmax(x, R = id) {
  const e = x.map((v) => R(Math.exp(v)));
  let l = 0;
  for (const v of e) l = R(l + v);
  return { l, p: e.map((v) => R(v / l)) };
}

export function safeSoftmax(x, R = id) {
  const m = Math.max(...x), e = x.map((v) => R(Math.exp(R(v - m))));
  let l = 0;
  for (const v of e) l = R(l + v);
  return { m, l, p: e.map((v) => R(v / l)) };
}

// Milakov and Gimelshein's Algorithm 3: one pass for m and l.
export function onlineSoftmax(x, { R = id, broken = false } = {}) {
  let m = -Infinity, l = 0, changes = 0;
  const trace = [];
  for (const v of x) {
    const mNew = Math.max(m, v);
    if (mNew > m && m > -Infinity) changes++;
    l = R((broken ? l : R(l * R(Math.exp(R(m - mNew))))) + R(Math.exp(R(v - mNew))));
    m = mNew;
    trace.push({ m, l });
  }
  return { m, l, changes, trace, p: x.map((v) => R(R(Math.exp(R(v - m))) / l)) };
}

// ---- tiled attention ----

// One key tile for one query row, in the order the fused WGSL kernel uses.
// st = { m, l, acc }; q is the row's query, Ks and Vs the tile (cnt rows).
export function tileUpdate(st, q, Ks, Vs, cnt, d, scale, R = fr, broken = false, sc = new Float64Array(cnt)) {
  let mt = st.m;
  for (let j = 0; j < cnt; j++) {
    let s = 0;
    for (let c = 0; c < d; c++) s = R(s + R(q[c] * Ks[j * d + c]));
    s = R(s * scale);
    sc[j] = s;
    if (s > mt) mt = s;
  }
  const alpha = R(Math.exp(R(st.m - mt)));
  for (let c = 0; c < d; c++) st.acc[c] = R(st.acc[c] * alpha);
  let ps = 0;
  for (let j = 0; j < cnt; j++) {
    const e = R(Math.exp(R(sc[j] - mt)));
    ps = R(ps + e);
    for (let c = 0; c < d; c++) st.acc[c] = R(st.acc[c] + R(e * Vs[j * d + c]));
  }
  if (mt > st.m && st.m > M_INIT) st.changes++;
  st.l = broken ? R(st.l + ps) : R(R(st.l * alpha) + ps);
  st.m = mt;
}

// O for every query row, keys in tiles of Bc. causal: row i sees keys <= i.
// R = Math.fround emulates float32; R = identity runs in float64.
export function tiledAttention(q, k, v, N, d, { Bc = 16, causal = false, broken = false, R = fr, scale = fr(1 / Math.sqrt(d)), traceRow = -1 } = {}) {
  const o = new Float32Array(N * d), o64 = new Float64Array(N * d), changes = new Int32Array(N), sc = new Float64Array(Bc);
  let trace = null;
  for (let i = 0; i < N; i++) {
    const st = { m: M_INIT, l: 0, acc: new Float64Array(d), changes: 0 }, qi = q.subarray(i * d, i * d + d), keys = causal ? i + 1 : N;
    if (i === traceRow) trace = [];
    for (let t = 0; t * Bc < keys; t++) {
      const cnt = Math.min(Bc, keys - t * Bc);
      tileUpdate(st, qi, k.subarray(t * Bc * d), v.subarray(t * Bc * d), cnt, d, scale, R, broken, sc);
      if (trace) trace.push({ tile: t, keys: [t * Bc, t * Bc + cnt - 1], m: st.m, l: st.l });
    }
    for (let c = 0; c < d; c++) { o64[i * d + c] = st.acc[c] / st.l; o[i * d + c] = R(st.acc[c] / st.l); }
    changes[i] = st.changes;
    if (i === traceRow) trace = { row: i, tiles: trace };
  }
  return { o: R === fr ? o : o64, changes, trace };
}

// ---- reference, bound and checker ----

// Float64 standard attention: S, softmax with the max subtracted, P V. Also
// sum_j p |v| per output (mag), the bound per output, and each row's max.
// rows < N computes only the first rows (a spot check of a large N).
export function reference(q, k, v, N, d, { causal = false, scale = fr(1 / Math.sqrt(d)), Bc = 16, rows = N } = {}) {
  const o = new Float64Array(rows * d), mag = new Float64Array(rows * d), bound = new Float64Array(rows * d), rowMax = new Float64Array(rows), s = new Float64Array(N), dl = new Float64Array(N);
  let vmax = 0;
  for (const x of v) vmax = Math.max(vmax, Math.abs(x));
  const K = N + 2 * Math.ceil(N / Bc) + 2, gk = gamma(K), floor = N * 2 ** -149 * vmax;
  for (let i = 0; i < rows; i++) {
    const keys = causal ? i + 1 : N;
    let m = -Infinity, delta = 0, l = 0, ex = 0;
    for (let j = 0; j < keys; j++) {
      let t = 0, a = 0;
      for (let c = 0; c < d; c++) { t += q[i * d + c] * k[j * d + c]; a += Math.abs(q[i * d + c] * k[j * d + c]); }
      s[j] = t * scale; dl[j] = gamma(d + 1) * scale * a;
      m = Math.max(m, s[j]); delta = Math.max(delta, dl[j]);
    }
    for (let j = 0; j < keys; j++) { ex = Math.max(ex, (3 + 2 * Math.min(104, m - s[j])) * ULP32); s[j] = Math.exp(s[j] - m); l += s[j]; }
    const f = 2 * (Math.expm1(2 * delta + 2 * ex) + gk);
    for (let c = 0; c < d; c++) {
      let acc = 0, mg = 0;
      for (let j = 0; j < keys; j++) { acc += s[j] * v[j * d + c]; mg += s[j] * Math.abs(v[j * d + c]); }
      o[i * d + c] = acc / l; mag[i * d + c] = mg / l; bound[i * d + c] = f * (mg / l) + floor + 1e-300;
    }
    rowMax[i] = m;
  }
  return { o, mag, bound, rowMax };
}

export function checkAttention(got, ref) {
  let bad = 0, first = -1, maxErr = 0, maxRatio = 0;
  for (let i = 0; i < ref.o.length; i++) {
    const e = Math.abs(got[i] - ref.o[i]), r = e / ref.bound[i];
    if (!(e <= ref.bound[i])) { bad++; if (first < 0) first = i; }
    if (e > maxErr) maxErr = e;
    if (r > maxRatio) maxRatio = r;
  }
  return { ok: bad === 0, mismatches: bad, first, maxErr, maxRatio };
}

// ---- the attention model's own Q, K, V ----

// Q, K, V of one head at one layer for a sentence (float32, T x hd), the
// model's own scores [T, T] (scaled, causal, 0 above the diagonal) and its
// attention output for that head.
export function probeQKV(model, words, layer, head) {
  const x = encode(words), T = x.length, c = model.config, D = c.dModel, hd = D / c.nHeads;
  const fw = forward(model, x, 1, T, { keep: true }), L = fw.work.layers[layer], take = () => new Float32Array(T * hd);
  const q = take(), k = take(), v = take(), ao = new Float32Array(T * hd);
  for (let i = 0; i < T; i++) for (let t = 0; t < hd; t++) {
    const b = i * 3 * D + head * hd + t;
    q[i * hd + t] = L.qkv[b]; k[i * hd + t] = L.qkv[b + D]; v[i * hd + t] = L.qkv[b + 2 * D]; ao[i * hd + t] = L.ao[i * D + head * hd + t];
  }
  const scores = Float32Array.from(L.scores.subarray(head * T * T, (head + 1) * T * T));
  return { T, hd, q, k, v, scores, ao };
}

// Largest scaled score anywhere in a forward pass of a batch: per layer and
// head, and how many scores reach the fp16 exp overflow threshold.
export const FP16_EXP_OVERFLOW = Math.log(65520);
export function scoreRange(model, x, B, T) {
  const fw = forward(model, x, B, T, { keep: true }), H = model.config.nHeads, out = [];
  fw.scores.forEach((S, layer) => {
    for (let h = 0; h < H; h++) {
      let mx = -Infinity, mn = Infinity, over = 0, count = 0;
      for (let b = 0; b < B; b++) for (let i = 0; i < T; i++) for (let j = 0; j <= i; j++) {
        const s = S[((b * H + h) * T + i) * T + j];
        mx = Math.max(mx, s); mn = Math.min(mn, s); count++;
        if (s >= FP16_EXP_OVERFLOW) over++;
      }
      out.push({ layer, head: h, max: mx, min: mn, count, atOrOverFp16Overflow: over });
    }
  });
  return out;
}
