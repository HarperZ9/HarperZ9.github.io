// ndim.js — pure n-dimensional geometry + projection; zero DOM, node-testable.
// Exported functions are side-effect-free (no globals, no canvas).

/**
 * nCubeVertices(n) — generate the 2^n vertices of an n-dimensional hypercube.
 * Each vertex is an n-length Float64Array with coords ∈ {-1, +1}.
 * Bit k of the vertex index controls coord k: bit set → +1, unset → -1.
 */
export function nCubeVertices(n) {
  if (n < 1) throw new RangeError("n must be >= 1");
  const count = 1 << n;   // 2^n
  const verts = [];
  for (let i = 0; i < count; i++) {
    const v = new Float64Array(n);
    for (let d = 0; d < n; d++) {
      v[d] = (i >> d) & 1 ? 1.0 : -1.0;
    }
    verts.push(v);
  }
  return verts;
}

/**
 * popcount(x) — number of set bits (Hamming weight) of a non-negative integer.
 * Used to test the Hamming distance of two vertex indices.
 */
function popcount(x) {
  let c = 0;
  while (x) { c += x & 1; x >>>= 1; }
  return c;
}

/**
 * nCubeEdges(n) — generate the n * 2^(n-1) edges of the n-hypercube.
 * Returns an array of [i, j] pairs (i < j) where i XOR j has exactly one bit set
 * (i.e. the vertices differ in exactly one dimension — they are adjacent).
 */
export function nCubeEdges(n) {
  if (n < 1) throw new RangeError("n must be >= 1");
  const count = 1 << n;
  const edges = [];
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      if (popcount(i ^ j) === 1) edges.push([i, j]);
    }
  }
  return edges;
}

/**
 * rotateND(verts, planes) — apply a sequence of Givens (planar) rotations to each vertex.
 * planes: Array of {a, b, angle} — rotate in the (a, b) plane by angle radians.
 * Returns NEW Float64Array vertices; does not mutate input.
 */
export function rotateND(verts, planes) {
  return verts.map(v => {
    const w = new Float64Array(v);
    for (const { a, b, angle } of planes) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = w[a], y = w[b];
      w[a] = x * cos - y * sin;
      w[b] = x * sin + y * cos;
    }
    return w;
  });
}

/**
 * projectTo2D(vert, dist) — perspective-project an n-vector to [x, y] + depth.
 * Collapses dimensions from the highest down to 2, one at a time.
 * dist: the projection distance (camera distance from origin); default 3.
 * Returns { x, y, depth } where depth is the product of scale factors (larger = closer).
 */
export function projectTo2D(vert, dist = 3.0) {
  const n = vert.length;
  const coord = new Float64Array(vert);   // working copy
  let depthProduct = 1.0;
  // Collapse each dimension from the highest down to 2 (leave [0] and [1] as x, y).
  for (let k = n - 1; k >= 2; k--) {
    const denom = dist - coord[k];
    // Guard against singularity (camera coincides with a hyperplane)
    const f = Math.abs(denom) < 1e-9 ? 1.0 : dist / denom;
    depthProduct *= f;
    for (let j = 0; j < k; j++) {
      coord[j] *= f;
    }
  }
  return { x: coord[0], y: coord[1], depth: depthProduct };
}
