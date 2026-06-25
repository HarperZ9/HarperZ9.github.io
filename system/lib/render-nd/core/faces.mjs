// faces.mjs - pure 2-face (triangulated) generators for the render-nd polytopes.
//
// The shipped polytopes.mjs gives vertices + edges (a wireframe). To render a real solid volume
// we also need the 2-faces, triangulated into [i, j, k] index triples over the SAME vertex order
// polytopes.mjs produces. Pure: no DOM, no randomness. ASCII only (no em-dashes).
//
// Faces let the WebGL backend draw shaded, depth-tested surfaces (solid mode) and let the picker
// hit a face by ray. Edges/vertices are still available for wireframe and vertex picking.

function popcount(x) { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }

// ---- n-cube square faces -> two triangles each --------------------------------------------
// A 2-face of the n-cube fixes (n-2) coordinates and lets 2 axes (a < b) vary over {-1,+1}.
// Vertex index encoding in polytopes.mjs: bit d of i is (coord d == +1). So a square face is
// chosen by a pair of free axes (a,b) and a fixed bit pattern on the other axes. The four corners
// are the base pattern XORed with {0, 1<<a, 1<<b, (1<<a)|(1<<b)}. Triangulate as (00,10,11)+(00,11,01).
export function nCubeFaces(n) {
  if (n < 2) return [];
  const faces = [];
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const amask = 1 << a, bmask = 1 << b;
      const free = amask | bmask;
      // iterate over every assignment of the OTHER (n-2) axes
      for (let base = 0; base < (1 << n); base++) {
        if (base & free) continue;             // only patterns with the 2 free axes cleared
        const v00 = base;
        const v10 = base | amask;
        const v01 = base | bmask;
        const v11 = base | amask | bmask;
        faces.push([v00, v10, v11]);
        faces.push([v00, v11, v01]);
      }
    }
  }
  return faces;
}

// ---- n-simplex faces: every 3-subset of the (n+1) vertices is a triangular 2-face --------
// (A simplex is the convex hull of n+1 affinely independent points; all its 2-faces are triangles.)
export function nSimplexFaces(n) {
  if (n < 2) return [];
  const m = n + 1, faces = [];
  for (let i = 0; i < m; i++)
    for (let j = i + 1; j < m; j++)
      for (let k = j + 1; k < m; k++)
        faces.push([i, j, k]);
  return faces;
}

// ---- n-orthoplex faces: triangles among non-antipodal vertex triples ----------------------
// Vertices are +/-e_i (index 2i = +e_i, 2i+1 = -e_i). A 2-face is any triple of vertices from
// THREE DIFFERENT axes (no two antipodal). That is the cross-polytope's triangular facet set.
export function nOrthoplexFaces(n) {
  if (n < 2) return [];
  const faces = [];
  const count = 2 * n;
  for (let i = 0; i < count; i++)
    for (let j = i + 1; j < count; j++) {
      if ((i >> 1) === (j >> 1)) continue;     // same axis -> antipodal, skip
      for (let k = j + 1; k < count; k++) {
        if ((k >> 1) === (i >> 1) || (k >> 1) === (j >> 1)) continue;
        faces.push([i, j, k]);
      }
    }
  return faces;
}

// ---- 24-cell faces: triangles between mutually adjacent vertices (each edge has len^2 = 2) --
// The 24-cell's 2-faces are triangles. Build them as triples that are pairwise at squared
// distance 2 (the edge length), over the same vertex order cell24Vertices produces.
export function cell24Faces(verts) {
  const V = verts;
  const adj = (i, j) => {
    let d2 = 0;
    for (let k = 0; k < 4; k++) { const d = V[i][k] - V[j][k]; d2 += d * d; }
    return Math.abs(d2 - 2) < 1e-9;
  };
  const faces = [];
  const N = V.length;
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) {
      if (!adj(i, j)) continue;
      for (let k = j + 1; k < N; k++) {
        if (adj(i, k) && adj(j, k)) faces.push([i, j, k]);
      }
    }
  return faces;
}

// Dispatch by kind. `verts` only required for 24cell (its faces need the coordinates).
export function polytopeFaces(kind, n, verts) {
  switch (kind) {
    case "cube": return nCubeFaces(n);
    case "simplex": return nSimplexFaces(n);
    case "orthoplex": return nOrthoplexFaces(n);
    case "24cell": return cell24Faces(verts || []);
    default: return [];
  }
}

// (exported for tests)
export const _popcount = popcount;
