// Which terrain nodes to draw, by CDLOD selection (Strugar 2009). The island is a quadtree of
// square nodes from 32.8 km down to 32 m, whose vertices stand 1 m apart under the walker. A node is drawn at level L when it lies inside level L's
// range and outside level L-1's; a child that falls outside the finer range is drawn at its
// parent's density: it is sent with its own level, and the vertex shader has already slid every
// vertex that far out onto the coarser grid.
export const RANGE0 = 62.5, LEAF = 32, LEVELS = 11;
export const rangeOf = (level) => RANGE0 * 2 ** level;

// six planes from a column-major view-projection matrix with reversed infinite depth
// (left, right, bottom, top, near); each is [a, b, c, d] with a*x + b*y + c*z + d >= 0 inside
export function frustumPlanes(m) {
  const row = (i) => [m[i], m[4 + i], m[8 + i], m[12 + i]], r0 = row(0), r1 = row(1), r3 = row(3);
  const add = (a, b, s) => a.map((v, i) => v + s * b[i]);
  return [add(r3, r0, 1), add(r3, r0, -1), add(r3, r1, 1), add(r3, r1, -1), r3].map((p) => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return p.map((v) => v / l); });
}
function boxOutside(planes, x0, y0, z0, x1, y1, z1) {
  for (const p of planes) {
    const x = p[0] >= 0 ? x1 : x0, y = p[1] >= 0 ? y1 : y0, z = p[2] >= 0 ? z1 : z0;
    if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0) return true;
  }
  return false;
}
// squared distance from a point to a box
function boxDist2(c, x0, y0, z0, x1, y1, z1) {
  const dx = Math.max(x0 - c[0], 0, c[0] - x1), dy = Math.max(y0 - c[1], 0, c[1] - y1), dz = Math.max(z0 - c[2], 0, c[2] - z1);
  return dx * dx + dy * dy + dz * dz;
}

// Fills out (x, z, size, level per node) and returns the node count.
export function selectNodes(pyramid, cam, planes, out, { cull = true } = {}) {
  let count = 0;
  const top = LEVELS - 1;
  const add = (x, z, size, level) => { if (count * 4 + 4 <= out.length) { out[count * 4] = x; out[count * 4 + 1] = z; out[count * 4 + 2] = size; out[count * 4 + 3] = level; count++; } };
  const visit = (ix, iz, level) => {
    const P = pyramid[level], k = iz * P.w + ix, size = LEAF * 2 ** level, x0 = ix * size, z0 = iz * size, lo = Math.min(P.lo[k], 0), hi = Math.max(P.hi[k], 0);
    if (cull && boxOutside(planes, x0, lo - 5, z0, x0 + size, hi + 5, z0 + size)) return true;   // nothing to draw, and handled
    const d2 = boxDist2(cam, x0, lo, z0, x0 + size, hi, z0 + size);
    if (level < top && d2 > rangeOf(level) ** 2) return false;                                    // the parent draws this ground
    if (level === 0 || d2 > rangeOf(level - 1) ** 2) { add(x0, z0, size, level); return true; }
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      if (!visit(ix * 2 + i, iz * 2 + j, level - 1)) add((ix * 2 + i) * size / 2, (iz * 2 + j) * size / 2, size / 2, level - 1);
    }
    return true;
  };
  const R = pyramid[top];
  for (let iz = 0; iz < R.h; iz++) for (let ix = 0; ix < R.w; ix++) visit(ix, iz, top);
  // an apron of open sea three roots wide round the map, so the water runs to the horizon
  const S = LEAF * 2 ** top;
  for (let iz = -3; iz < R.h + 3; iz++) for (let ix = -3; ix < R.w + 3; ix++) {
    if (ix >= 0 && iz >= 0 && ix < R.w && iz < R.h) continue;
    if (!cull || !boxOutside(planes, ix * S, -450, iz * S, ix * S + S, 5, iz * S + S)) add(ix * S, iz * S, S, top);
  }
  return count;
}
