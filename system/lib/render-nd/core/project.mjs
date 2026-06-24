// project.mjs — nD→2D projection chain. Each mode collapses dimensions from the highest down to 2.

// Parity with shipped ndim.js: iterated perspective, depth = product of scale factors.
export function projectTo2D(vert, dist = 3.0) {
  const n = vert.length, coord = new Float64Array(vert);
  let depth = 1.0;
  for (let k = n - 1; k >= 2; k--) {
    const denom = dist - coord[k];
    const f = Math.abs(denom) < 1e-9 ? 1.0 : dist / denom;
    depth *= f;
    for (let j = 0; j < k; j++) coord[j] *= f;
  }
  return { x: coord[0], y: coord[1], depth };
}

export function project(vert, opts = {}) {
  const mode = opts.mode || "perspective";
  const dist = opts.dist == null ? 3.0 : opts.dist;
  const n = vert.length;
  if (n <= 2) return { x: vert[0] ?? 0, y: vert.length > 1 ? vert[1] : 0, depth: 1 };
  if (mode === "perspective") return projectTo2D(vert, dist);

  if (mode === "orthographic") {
    // Drop dims >=2; depth from the mean of collapsed coords (higher = nearer).
    // Offset by 2 so depth is strictly positive and monotonic in the collapsed coordinates
    // (renderScene normalizes per-scene anyway).
    let sum = 0; for (let k = 2; k < n; k++) sum += vert[k];
    return { x: vert[0], y: vert[1], depth: 2 + sum / (n - 2) };
  }

  if (mode === "stereographic") {
    // Stereographic-style projection from the pole at +dist on each successive axis.
    // DISTINCT from perspective: each extra dimension's scale factor uses the ORIGINAL
    // coordinate (no cumulative scaling of intermediate axes), so dimensions contribute
    // independently — a conformal-style map rather than iterated central projection.
    let f = 1.0, depth = 1.0;
    for (let k = n - 1; k >= 2; k--) {
      const denom = dist - vert[k];
      const fk = Math.abs(denom) < 1e-9 ? 1.0 : dist / denom;
      f *= fk; depth *= fk;
    }
    return { x: vert[0] * f, y: vert[1] * f, depth };
  }
  throw new RangeError(`unknown projection mode: ${mode}`);
}
