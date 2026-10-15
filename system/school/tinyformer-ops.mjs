// Numeric kernels for the tiny transformer: seeded random numbers, dense
// layers, layer norm, GELU, softmax cross-entropy, and their backward passes.
// Plain loops over typed arrays with a fixed loop order (no SIMD, no
// threads), so a run is bit-reproducible on a given engine, and Node and
// Chrome share V8. Math.exp and Math.tanh are not required to be correctly
// rounded, so another engine may differ in the last bit and drift from there.
//
// Layout: every matrix is row-major. A dense layer stores its weight as
// [K, M] (inputs by outputs).

// mulberry32: small, fast, and identical in every JavaScript engine.
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal draw by Box-Muller. Uses two uniforms per call and
// discards the second normal, which keeps the stream easy to reason about.
export function gauss(r) {
  const u = Math.max(r(), 1e-12), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Dense layers live in their own module (they are the hot spot).
export { matmul, matmulBackward } from "./tinyformer-dense.mjs";

const LN_EPS = 1e-5;

// Layer norm over the last axis. Keeps the normalised input (xhat) and the
// reciprocal standard deviation per row, which is all the backward needs.
export function layerNorm(out, xhat, rstd, x, g, b, N, D) {
  for (let n = 0; n < N; n++) {
    const o = n * D;
    let mean = 0;
    for (let i = 0; i < D; i++) mean += x[o + i];
    mean /= D;
    let v = 0;
    for (let i = 0; i < D; i++) { const d = x[o + i] - mean; v += d * d; }
    const r = 1 / Math.sqrt(v / D + LN_EPS);
    rstd[n] = r;
    for (let i = 0; i < D; i++) {
      const xh = (x[o + i] - mean) * r;
      xhat[o + i] = xh;
      out[o + i] = xh * g[i] + b[i];
    }
  }
}

// Backward of layer norm. ADDS into dx (the residual stream gradient already
// sits there, and the norm branch joins it), accumulates dg and db.
export function layerNormBackward(dx, dg, db, dout, xhat, rstd, g, N, D) {
  for (let n = 0; n < N; n++) {
    const o = n * D;
    let s1 = 0, s2 = 0;
    for (let i = 0; i < D; i++) {
      const go = dout[o + i], xh = xhat[o + i];
      dg[i] += go * xh;
      db[i] += go;
      const dxh = go * g[i];
      s1 += dxh;
      s2 += dxh * xh;
    }
    s1 /= D; s2 /= D;
    const r = rstd[n];
    for (let i = 0; i < D; i++) {
      const dxh = dout[o + i] * g[i];
      dx[o + i] += r * (dxh - s1 - xhat[o + i] * s2);
    }
  }
}

// GELU, tanh approximation. Chosen over ReLU because it is smooth: the
// finite-difference gradient check has no kinks to trip on.
const GC = Math.sqrt(2 / Math.PI), GA = 0.044715;
export function gelu(out, x, n) {
  for (let i = 0; i < n; i++) {
    const v = x[i];
    out[i] = 0.5 * v * (1 + Math.tanh(GC * (v + GA * v * v * v)));
  }
}

export function geluBackward(dx, dout, x, n) {
  for (let i = 0; i < n; i++) {
    const v = x[i];
    const th = Math.tanh(GC * (v + GA * v * v * v));
    const d = 0.5 * (1 + th) + 0.5 * v * (1 - th * th) * GC * (1 + 3 * GA * v * v);
    dx[i] = dout[i] * d;
  }
}

// Row softmax of logits into probs, mean cross-entropy against targets y.
// When dlogits is given it receives d(mean loss)/d(logits) = (p - onehot)/N.
export function softmaxXent(probs, dlogits, logits, y, N, V) {
  let loss = 0;
  for (let n = 0; n < N; n++) {
    const o = n * V;
    let mx = -Infinity;
    for (let v = 0; v < V; v++) if (logits[o + v] > mx) mx = logits[o + v];
    let s = 0;
    for (let v = 0; v < V; v++) { const e = Math.exp(logits[o + v] - mx); probs[o + v] = e; s += e; }
    for (let v = 0; v < V; v++) probs[o + v] /= s;
    loss -= Math.log(Math.max(probs[o + y[n]], 1e-30));
    if (dlogits) {
      for (let v = 0; v < V; v++) dlogits[o + v] = probs[o + v] / N;
      dlogits[o + y[n]] -= 1 / N;
    }
  }
  return loss / N;
}

// Base64 without Buffer or btoa, so weights serialise the same way in Node,
// a browser page and a worker.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function bytesToBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    s += b === undefined ? "=" : B64[(n >> 6) & 63];
    s += c === undefined ? "=" : B64[n & 63];
  }
  return s;
}

export function base64ToBytes(s) {
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let j = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12)
      | ((B64.indexOf(s[i + 2]) & 63) << 6) | (B64.indexOf(s[i + 3]) & 63);
    if (j < out.length) out[j++] = (n >> 16) & 255;
    if (j < out.length) out[j++] = (n >> 8) & 255;
    if (j < out.length) out[j++] = n & 255;
  }
  return out;
}
