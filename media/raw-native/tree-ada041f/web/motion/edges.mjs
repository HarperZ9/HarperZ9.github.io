// Exact edges for contours that cross or overlap (a self-intersecting fill, a
// stroke's pieces, a clip). Segments are split where they cross or run along each
// other, and each piece is classed by the fill on its two sides: a boundary has
// coverage on one side only; an internal edge has it on both (or neither). The
// shader counts every segment for the winding number but measures distance only to
// boundaries, so overlaps leave no seams, and it knows which side of a boundary is
// inside, for corners. Pure: runs in Node.
//
//   const E = exactEdges(contours, "nonzero");
//   // E.segs: Float32Array [x0, y0, x1, y1, ...]; E.kind: Uint8Array, 0 internal,
//   // 1 boundary with the inside on the left of travel (y down), 2 on the right;
//   // E.contour: Uint32Array, the contour each piece came from.

const CELL = 32;
const EPS = 1e-3;

function gridOf(segs, n) {
  const g = new Map();
  for (let s = 0; s < n; s++) {
    const ya = Math.floor(Math.min(segs[4 * s + 1], segs[4 * s + 3]) / CELL), yb = Math.floor(Math.max(segs[4 * s + 1], segs[4 * s + 3]) / CELL);
    const xa = Math.floor(Math.min(segs[4 * s], segs[4 * s + 2]) / CELL), xb = Math.floor(Math.max(segs[4 * s], segs[4 * s + 2]) / CELL);
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const k = y * 65536 + x;
      let l = g.get(k);
      if (!l) g.set(k, (l = []));
      l.push(s);
    }
  }
  return g;
}

// Split points (parameters along a) where segment b crosses or overlaps it.
function splits(S, a, b, out) {
  const ax = S[4 * a], ay = S[4 * a + 1], ex = S[4 * a + 2] - ax, ey = S[4 * a + 3] - ay;
  const bx = S[4 * b], by = S[4 * b + 1], fx = S[4 * b + 2] - bx, fy = S[4 * b + 3] - by;
  const den = ex * fy - ey * fx, ee = ex * ex + ey * ey;
  if (ee === 0) return;
  if (Math.abs(den) > 1e-9 * Math.sqrt(ee * (fx * fx + fy * fy))) {
    const t = ((bx - ax) * fy - (by - ay) * fx) / den, u = ((bx - ax) * ey - (by - ay) * ex) / den;
    if (t > 1e-6 && t < 1 - 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) out.push(t);
    return;
  }
  // Parallel: if collinear, b's ends split a.
  const off = Math.abs((bx - ax) * ey - (by - ay) * ex) / Math.sqrt(ee);
  if (off > 1e-4) return;
  for (const [px, py] of [[bx, by], [bx + fx, by + fy]]) {
    const t = ((px - ax) * ex + (py - ay) * ey) / ee;
    if (t > 1e-6 && t < 1 - 1e-6) out.push(t);
  }
}

function inside(S, n, rows, x, y, rule) {
  let w = 0, c = 0;
  const list = rows.get(Math.floor(y / CELL)) || [];
  for (const s of list) {
    const ay = S[4 * s + 1], by = S[4 * s + 3];
    if ((ay <= y) !== (by <= y)) {
      const ax = S[4 * s], bx = S[4 * s + 2];
      if (ax + ((y - ay) * (bx - ax)) / (by - ay) > x) { w += by > ay ? 1 : -1; c++; }
    }
  }
  return rule === "evenodd" ? (c & 1) === 1 : w !== 0;
}

function exactGroup(shape, rule) {
  // All segments, closing every contour.
  const raw = [], owner = [];
  shape.forEach((c, ci) => {
    const p = c.pts, n = p.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (p[2 * i] === p[2 * j] && p[2 * i + 1] === p[2 * j + 1]) continue;
      raw.push(p[2 * i], p[2 * i + 1], p[2 * j], p[2 * j + 1]); owner.push(ci);
    }
  });
  const S = Float64Array.from(raw), n = owner.length, g = gridOf(S, n);
  const ts = Array.from({ length: n }, () => []);
  for (const list of g.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    splits(S, list[i], list[j], ts[list[i]]); splits(S, list[j], list[i], ts[list[j]]);
  }
  // Rows of the original segments, for winding tests.
  const rows = new Map();
  for (let s = 0; s < n; s++) {
    const ya = Math.floor(Math.min(S[4 * s + 1], S[4 * s + 3]) / CELL), yb = Math.floor(Math.max(S[4 * s + 1], S[4 * s + 3]) / CELL);
    for (let y = ya; y <= yb; y++) { let l = rows.get(y); if (!l) rows.set(y, (l = [])); l.push(s); }
  }
  const out = [], kind = [], contour = [];
  for (let s = 0; s < n; s++) {
    const t = [0, ...new Set(ts[s]), 1].sort((a, b) => a - b);
    const ax = S[4 * s], ay = S[4 * s + 1], ex = S[4 * s + 2] - ax, ey = S[4 * s + 3] - ay, len = Math.hypot(ex, ey);
    for (let k = 0; k + 1 < t.length; k++) {
      if (t[k + 1] - t[k] < 1e-9) continue;
      const x0 = ax + ex * t[k], y0 = ay + ey * t[k], x1 = ax + ex * t[k + 1], y1 = ay + ey * t[k + 1];
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = (-ey / len) * EPS, ny = (ex / len) * EPS;
      // Left of travel in y-down space is (ey, -ex); the normal (-ey, ex) points right.
      const right = inside(S, n, rows, mx + nx, my + ny, rule), left = inside(S, n, rows, mx - nx, my - ny, rule);
      out.push(x0, y0, x1, y1); kind.push(right === left ? 0 : left ? 1 : 2); contour.push(owner[s]);
    }
  }
  return { segs: Float32Array.from(out), kind: Uint8Array.from(kind), contour: Uint32Array.from(contour) };
}

// Contours whose boxes do not overlap cannot change each other's winding, so they
// are classed in separate groups (a line of text is a group per glyph).
// Results are cached by the contours' coordinates: a still title is classed once.
const cache = new Map();
export function exactEdges(shape, rule = "nonzero") {
  // Two independent 32-bit hashes over the coordinate bits, plus the counts.
  let h = 2166136261 ^ (rule === "evenodd" ? 1 : 0), k = 0x9e3779b9, n = 0;
  for (const c of shape) {
    const u = new Uint32Array(Float32Array.from(c.pts).buffer);
    for (let i = 0; i < u.length; i++) { h = Math.imul(h ^ u[i], 16777619); k = Math.imul(k + u[i], 0x85ebca6b) ^ (k >>> 13); }
    h = Math.imul(h ^ (c.closed ? 7 : 3), 16777619);
    n += u.length;
  }
  const key = `${h >>> 0}:${k >>> 0}:${shape.length}:${n}`;
  let r = cache.get(key);
  if (!r) {
    r = groupedEdges(shape, rule);
    if (cache.size >= 1024) cache.delete(cache.keys().next().value);
  } else cache.delete(key);
  cache.set(key, r);
  return r;
}

function groupedEdges(shape, rule) {
  const n = shape.length, parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const box = shape.map((c) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < c.pts.length; i += 2) { x0 = Math.min(x0, c.pts[i]); x1 = Math.max(x1, c.pts[i]); y0 = Math.min(y0, c.pts[i + 1]); y1 = Math.max(y1, c.pts[i + 1]); }
    return [x0, y0, x1, y1];
  });
  const order = box.map((_, i) => i).sort((a, b) => box[a][0] - box[b][0]);
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const A = box[order[a]], B = box[order[b]];
    if (B[0] > A[2]) break;
    if (B[1] <= A[3] && B[3] >= A[1]) parent[find(order[a])] = find(order[b]);
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  const segs = [], kind = [], contour = [];
  for (const members of groups.values()) {
    const E = exactGroup(members.map((i) => shape[i]), rule);
    for (let i = 0; i < E.kind.length; i++) {
      segs.push(E.segs[4 * i], E.segs[4 * i + 1], E.segs[4 * i + 2], E.segs[4 * i + 3]);
      kind.push(E.kind[i]); contour.push(members[E.contour[i]]);
    }
  }
  return { segs: Float32Array.from(segs), kind: Uint8Array.from(kind), contour: Uint32Array.from(contour) };
}

// Do any two segments of g cross (other than neighbours meeting at an end)? Contours
// that cross or overlap need the exact edge test in the shader; others keep the
// single-edge ramp, which is cheaper. Segments are bucketed in a 32 px grid.
export function crosses(S, s0, n) {
  if (n < 3) return false;
  const cell = 32, grid = new Map();
  for (let s = s0; s < s0 + n; s++) {
    const xa = Math.floor(Math.min(S[4 * s], S[4 * s + 2]) / cell), xb = Math.floor(Math.max(S[4 * s], S[4 * s + 2]) / cell);
    const ya = Math.floor(Math.min(S[4 * s + 1], S[4 * s + 3]) / cell), yb = Math.floor(Math.max(S[4 * s + 1], S[4 * s + 3]) / cell);
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const key = y * 65536 + x;
      let list = grid.get(key);
      if (!list) grid.set(key, (list = []));
      for (const t of list) if (segsCross(S, s, t)) return true;
      list.push(s);
    }
  }
  return false;
}
function segsCross(S, a, b) {
  const ax = S[4 * a], ay = S[4 * a + 1], bx = S[4 * a + 2], by = S[4 * a + 3];
  const cx = S[4 * b], cy = S[4 * b + 1], dx = S[4 * b + 2], dy = S[4 * b + 3];
  const shared = (ax === cx && ay === cy) || (ax === dx && ay === dy) || (bx === cx && by === cy) || (bx === dx && by === dy);
  const o = (px, py, qx, qy, rx, ry) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  const o1 = o(ax, ay, bx, by, cx, cy), o2 = o(ax, ay, bx, by, dx, dy), o3 = o(cx, cy, dx, dy, ax, ay), o4 = o(cx, cy, dx, dy, bx, by);
  if (shared) return o1 === 0 && o2 === 0;       // neighbours: only a fold back along the same line counts
  return o1 !== o2 && o3 !== o4;
}
