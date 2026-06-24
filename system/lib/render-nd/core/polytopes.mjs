// polytopes.mjs — pure n-dimensional polytope vertex/edge generators. Zero DOM, node-testable.

function popcount(x) { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }

export function nCubeVertices(n) {
  if (n < 1) throw new RangeError("n must be >= 1");
  if (n > 30) throw new RangeError("n > 30 exceeds safe bit-shift range");
  const out = [];
  for (let i = 0; i < (1 << n); i++) {
    const v = new Float64Array(n);
    for (let d = 0; d < n; d++) v[d] = (i >> d) & 1 ? 1 : -1;
    out.push(v);
  }
  return out;
}
export function nCubeEdges(n) {
  if (n < 1) throw new RangeError("n must be >= 1");
  if (n > 30) throw new RangeError("n > 30 exceeds safe bit-shift range");
  const edges = [], count = 1 << n;
  for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) if (popcount(i ^ j) === 1) edges.push([i, j]);
  return edges;
}

// Regular n-simplex: n+1 equidistant vertices in R^n, via the Helmert (zero-sum) orthonormal basis
// of the standard simplex {e_0..e_n} ⊂ R^(n+1). Vertex i = column i of the (n × n+1) Helmert sub-matrix,
// scaled so the circumradius is 1 (matches the cube's framing).
export function nSimplexVertices(n) {
  if (n < 1) throw new RangeError("n must be >= 1");
  const m = n + 1;
  // Helmert sub-matrix H (n rows × m cols): row k (1-based) = [1..1 (k entries), -k, 0..0] / sqrt(k(k+1)).
  const verts = Array.from({ length: m }, () => new Float64Array(n));
  for (let k = 1; k <= n; k++) {
    const norm = Math.sqrt(k * (k + 1));
    for (let col = 0; col < m; col++) {
      let val = 0;
      if (col < k) val = 1 / norm;
      else if (col === k) val = -k / norm;
      verts[col][k - 1] = val;
    }
  }
  // Scale to circumradius 1: each column currently has norm sqrt(k/(k+1)) summed → normalize by |verts[0]|.
  const r = Math.hypot(...verts[0]) || 1;
  for (const v of verts) for (let d = 0; d < n; d++) v[d] /= r;
  return verts;
}
export function nSimplexEdges(n) {
  const m = n + 1, edges = [];
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) edges.push([i, j]);
  return edges;
}

// n-orthoplex (cross-polytope): vertices ±e_i. Edges connect every pair except the antipodal (±same axis).
export function nOrthoplexVertices(n) {
  if (n < 1) throw new RangeError("n must be >= 1");
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = new Float64Array(n), q = new Float64Array(n);
    p[i] = 1; q[i] = -1; out.push(p, q); // index 2i = +e_i, 2i+1 = -e_i
  }
  return out;
}
export function nOrthoplexEdges(n) {
  const edges = [], count = 2 * n;
  for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
    if ((i >> 1) === (j >> 1)) continue; // same axis → antipodal, no edge
    edges.push([i, j]);
  }
  return edges;
}

// 24-cell (4-D regular): 24 vertices = all permutations of (±1,±1,0,0); edges between vertices at
// minimal squared distance 2 (each vertex has 8 neighbours → 96 edges).
export function cell24Vertices() {
  const out = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++)
    for (const sa of [1, -1]) for (const sb of [1, -1]) {
      const v = new Float64Array(4); v[a] = sa; v[b] = sb; out.push(v);
    }
  return out;
}
export function cell24Edges() {
  const V = cell24Vertices(), edges = [];
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
    let d2 = 0; for (let k = 0; k < 4; k++) { const d = V[i][k] - V[j][k]; d2 += d * d; }
    if (Math.abs(d2 - 2) < 1e-9) edges.push([i, j]);
  }
  return edges;
}

export function polytope(kind, n) {
  switch (kind) {
    case "cube": return { kind, n, verts: nCubeVertices(n), edges: nCubeEdges(n) };
    case "simplex": return { kind, n, verts: nSimplexVertices(n), edges: nSimplexEdges(n) };
    case "orthoplex": return { kind, n, verts: nOrthoplexVertices(n), edges: nOrthoplexEdges(n) };
    case "24cell": return { kind: "24cell", n: 4, verts: cell24Vertices(), edges: cell24Edges() };
    default: throw new RangeError(`unknown polytope kind: ${kind}`);
  }
}
