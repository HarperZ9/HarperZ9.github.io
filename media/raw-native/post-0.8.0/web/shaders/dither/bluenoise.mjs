// A blue-noise threshold mask by the void-and-cluster method (Ulichney, "The void-and-cluster
// method for dither array generation", SPIE 1913, 1993), written from the paper. Deterministic:
// the initial pattern comes from a hash, and ties go to the lowest index, so every build makes
// the same mask. Returns ranks 0 .. N*N-1 in row-major order; the threshold of a cell is
// (rank + 0.5) / (N * N).
import { pcg } from "../common.mjs";

function kernel(N, sigma) {
  const k = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = Math.min(x, N - x), dy = Math.min(y, N - y);
    k[y * N + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
  }
  return k;
}
// Add (sign +1) or remove (-1) a point's contribution to the toroidal energy field.
function splat(E, K, N, p, sign) {
  const px = p % N, py = (p / N) | 0;
  for (let y = 0; y < N; y++) {
    const ky = ((y - py + N) % N) * N, row = y * N;
    for (let x = 0; x < N; x++) E[row + x] += sign * K[ky + ((x - px + N) % N)];
  }
}
// Tightest cluster: the set cell (bits[p] === want) with the highest energy; largest void: the
// cell with bits[p] === want and the lowest energy. Lowest index wins ties.
function extreme(E, bits, want, max) {
  let best = -1, v = max ? -Infinity : Infinity;
  for (let p = 0; p < E.length; p++) if (bits[p] === want && (max ? E[p] > v : E[p] < v)) { v = E[p]; best = p; }
  return best;
}

export function voidAndCluster(N = 64, { sigma = 1.5, density = 0.1, seed = 20261010 } = {}) {
  const K = kernel(N, sigma), size = N * N, bits = new Uint8Array(size), E = new Float64Array(size);
  for (let p = 0; p < size; p++) if (pcg(p ^ pcg(seed)) / 4294967296 < density) { bits[p] = 1; splat(E, K, N, p, 1); }
  // 1. Relax the initial pattern: move the tightest cluster into the largest void until stable.
  for (let guard = 0; guard < size * 4; guard++) {
    const c = extreme(E, bits, 1, true); bits[c] = 0; splat(E, K, N, c, -1);
    const v = extreme(E, bits, 0, false);
    bits[v] = 1; splat(E, K, N, v, 1);
    if (v === c) break;
  }
  const proto = bits.slice(), protoE = E.slice(), ones = proto.reduce((a, b) => a + b, 0), rank = new Int32Array(size).fill(-1);
  // 2. Ranks below the prototype: remove tightest clusters.
  for (let r = ones - 1; r >= 0; r--) { const c = extreme(E, bits, 1, true); bits[c] = 0; splat(E, K, N, c, -1); rank[c] = r; }
  // 3. Ranks from the prototype to half: fill the largest voids.
  bits.set(proto); E.set(protoE);
  let r = ones;
  for (; r < size / 2; r++) { const v = extreme(E, bits, 0, false); bits[v] = 1; splat(E, K, N, v, 1); rank[v] = r; }
  // 4. Ranks above half: the zeros are now the minority; fill their tightest clusters. Energy
  // of the zeros is recomputed from scratch once.
  E.fill(0);
  for (let p = 0; p < size; p++) if (!bits[p]) splat(E, K, N, p, 1);
  for (; r < size; r++) { const c = extreme(E, bits, 0, true); bits[c] = 1; splat(E, K, N, c, -1); rank[c] = r; }
  return rank;
}

let cached = null;
export function blueNoise64() { if (!cached) cached = voidAndCluster(64); return cached; }
