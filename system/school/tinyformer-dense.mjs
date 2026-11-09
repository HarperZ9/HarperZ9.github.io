// Dense layer kernels, the hot spot of training (about 80% of a step).
//
// Two choices make these several times faster than the textbook triple loop
// in a JavaScript engine:
//  - sums are kept in local variables (registers) and written once, instead
//    of read-modify-writing a typed array element on every multiply-add;
//  - four outputs are computed together, so each loaded input is reused
//    four times.
// The weight gradient works on transposed copies of the inputs held in
// Float64Array scratch, so its inner loop is a contiguous dot product.
// Summation order is fixed, so results are identical on every engine.
//
// Layout: a weight is [K, M] row-major (inputs by outputs).

let scratchA = new Float64Array(0), scratchB = new Float64Array(0);

function transposeInto(dst, src, R, C) {
  for (let r = 0; r < R; r++) {
    const o = r * C;
    for (let c = 0; c < C; c++) dst[c * R + r] = src[o + c];
  }
}

// out[N,M] = a[N,K] . w[K,M] + b[M] (b may be null). Overwrites out.
// Two rows by four columns per block: each weight load feeds two sums.
export function matmul(out, a, w, b, N, K, M) {
  let n = 0;
  for (; n + 1 < N; n += 2) rowPairForward(out, a, w, b, n, K, M);
  if (n < N) rowForward(out, a, w, b, n, K, M);
}

function rowPairForward(out, a, w, b, n, K, M) {
  const M4 = M - (M % 4), o = n * M, p = o + M, ai = n * K, aj = ai + K;
  for (let m = 0; m < M4; m += 4) {
    const b0 = b ? b[m] : 0, b1 = b ? b[m + 1] : 0, b2 = b ? b[m + 2] : 0, b3 = b ? b[m + 3] : 0;
    let s0 = b0, s1 = b1, s2 = b2, s3 = b3, t0 = b0, t1 = b1, t2 = b2, t3 = b3;
    for (let k = 0, wk = m; k < K; k++, wk += M) {
      const x = a[ai + k], y = a[aj + k];
      const w0 = w[wk], w1 = w[wk + 1], w2 = w[wk + 2], w3 = w[wk + 3];
      s0 += x * w0; s1 += x * w1; s2 += x * w2; s3 += x * w3;
      t0 += y * w0; t1 += y * w1; t2 += y * w2; t3 += y * w3;
    }
    out[o + m] = s0; out[o + m + 1] = s1; out[o + m + 2] = s2; out[o + m + 3] = s3;
    out[p + m] = t0; out[p + m + 1] = t1; out[p + m + 2] = t2; out[p + m + 3] = t3;
  }
  for (let m = M4; m < M; m++) {
    let s = b ? b[m] : 0, t = s;
    for (let k = 0; k < K; k++) { const wv = w[k * M + m]; s += a[ai + k] * wv; t += a[aj + k] * wv; }
    out[o + m] = s; out[p + m] = t;
  }
}

function rowForward(out, a, w, b, n, K, M) {
  const o = n * M, ai = n * K;
  for (let m = 0; m < M; m++) {
    let s = b ? b[m] : 0;
    for (let k = 0; k < K; k++) s += a[ai + k] * w[k * M + m];
    out[o + m] = s;
  }
}

// da[N,K] = dout[N,M] . w^T, overwritten. Four rows of w at a time.
function inputGrad(da, dout, w, N, K, M) {
  const K4 = K - (K % 4);
  for (let n = 0; n < N; n++) {
    const o = n * M, ai = n * K;
    for (let k = 0; k < K4; k += 4) {
      const w0 = k * M, w1 = w0 + M, w2 = w1 + M, w3 = w2 + M;
      let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
      for (let m = 0; m < M; m++) {
        const g = dout[o + m];
        s0 += g * w[w0 + m]; s1 += g * w[w1 + m]; s2 += g * w[w2 + m]; s3 += g * w[w3 + m];
      }
      da[ai + k] = s0; da[ai + k + 1] = s1; da[ai + k + 2] = s2; da[ai + k + 3] = s3;
    }
    for (let k = K4; k < K; k++) {
      let s = 0;
      for (let m = 0; m < M; m++) s += dout[o + m] * w[k * M + m];
      da[ai + k] = s;
    }
  }
}

// dw[K,M] += a^T . dout, via aT [K,N] and gT [M,N] so each sum is contiguous.
function weightGrad(dw, dout, a, N, K, M) {
  if (scratchA.length < K * N) scratchA = new Float64Array(K * N);
  if (scratchB.length < M * N) scratchB = new Float64Array(M * N);
  const aT = scratchA, gT = scratchB, M4 = M - (M % 4);
  transposeInto(aT, a, N, K);
  transposeInto(gT, dout, N, M);
  for (let k = 0; k < K; k++) {
    const ak = k * N, wk = k * M;
    for (let m = 0; m < M4; m += 4) {
      const g0 = m * N, g1 = g0 + N, g2 = g1 + N, g3 = g2 + N;
      let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
      for (let n = 0; n < N; n++) {
        const av = aT[ak + n];
        s0 += av * gT[g0 + n]; s1 += av * gT[g1 + n]; s2 += av * gT[g2 + n]; s3 += av * gT[g3 + n];
      }
      dw[wk + m] += s0; dw[wk + m + 1] += s1; dw[wk + m + 2] += s2; dw[wk + m + 3] += s3;
    }
    for (let m = M4; m < M; m++) {
      let s = 0;
      for (let n = 0; n < N; n++) s += aT[ak + n] * gT[m * N + n];
      dw[wk + m] += s;
    }
  }
}

// Backward of matmul. da (may be null) is overwritten; dw and db (may be
// null) are accumulated, so gradients from several uses of a weight add up.
export function matmulBackward(da, dw, db, dout, a, w, N, K, M) {
  if (da) inputGrad(da, dout, w, N, K, M);
  if (db) {
    for (let m = 0; m < M; m++) {
      let s = 0;
      for (let n = 0; n < N; n++) s += dout[n * M + m];
      db[m] += s;
    }
  }
  weightGrad(dw, dout, a, N, K, M);
}
