// relief-stl.js
// Watertight binary STL from a heightmap, lithophane practice.
// Units: millimeters. Corner at origin, all coordinates non negative, +Z up.
// Binary STL: 80 byte header (must not begin with "solid"), uint32 LE
// triangle count, then 50 bytes per facet, all floats float32 LE, attribute
// byte count 0. File size = 84 + 50 * n.
//
// Lithophane convention (invert true, the default): the print is backlit, so
// thin material transmits light and reads BRIGHT. Luma 1 maps to minMM of
// material, luma 0 to maxMM. invert false maps luma directly to thickness.
// Constraint: baseMM + minMM must be > 0 or wall triangles degenerate.
// Defaults per lithophane practice: minMM 0.8, maxMM 3.0, widthMM 100.

const HEADER_TEXT = "portfolio-site relief-stl heightmap exporter, units mm";

// Closed form facet count: 2 per top cell, 2 per boundary wall edge,
// 1 per boundary edge for the perimeter fan bottom.
export function stlTriangleCount(w, h) {
  const per = (w - 1) + (h - 1);
  return 2 * (w - 1) * (h - 1) + 6 * per;
}

// Pure grid build. heights: 0..1 row major, length w*h, row 0 = image top.
// Square cells: plate width widthMM, plate height widthMM * (h-1) / (w-1).
export function buildGrid(heights, w, h, opts = {}) {
  const { widthMM = 100, minMM = 0.8, maxMM = 3.0, baseMM = 0, invert = true } = opts;
  if (!(w >= 2 && h >= 2)) throw new Error("relief-stl: grid must be at least 2x2");
  if (heights.length !== w * h) throw new Error("relief-stl: heights length must equal w*h");
  const step = widthMM / (w - 1);
  const xs = new Float64Array(w);
  for (let i = 0; i < w; i++) xs[i] = i * step;
  // image row 0 is the top of the picture, +Y is up in model space
  const ys = new Float64Array(h);
  for (let j = 0; j < h; j++) ys[j] = (h - 1 - j) * step;
  const zs = new Float64Array(w * h);
  const span = maxMM - minMM;
  for (let k = 0; k < w * h; k++) {
    const L = Math.min(1, Math.max(0, heights[k]));
    const t = invert ? 1 - L : L;
    zs[k] = baseMM + minMM + t * span;
  }
  return { xs, ys, zs, step };
}

// Boundary vertices as [i, j] grid pairs, counterclockwise viewed from +Z.
export function boundaryLoop(w, h) {
  const loop = [];
  for (let i = 0; i < w - 1; i++) loop.push([i, h - 1]);
  for (let j = h - 1; j > 0; j--) loop.push([w - 1, j]);
  for (let i = w - 1; i > 0; i--) loop.push([i, 0]);
  for (let j = 0; j < h - 1; j++) loop.push([0, j]);
  return loop;
}

// One facet: normal from CCW winding (right hand rule), vertices, attr 0.
function writeTri(dv, off, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz);
  if (len > 0) { nx /= len; ny /= len; nz /= len; } else { nx = ny = nz = 0; }
  dv.setFloat32(off, nx, true);
  dv.setFloat32(off + 4, ny, true);
  dv.setFloat32(off + 8, nz, true);
  const vals = [ax, ay, az, bx, by, bz, cx, cy, cz];
  for (let k = 0; k < 9; k++) dv.setFloat32(off + 12 + 4 * k, vals[k], true);
  dv.setUint16(off + 48, 0, true);
  return off + 50;
}

// Top surface: two triangles per cell, CCW viewed from +Z (outside above).
function writeTop(dv, off, grid, w, h) {
  const { xs, ys, zs } = grid;
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1];
      const yA = ys[j], yD = ys[j + 1];
      const zA = zs[j * w + i], zB = zs[j * w + i + 1];
      const zC = zs[(j + 1) * w + i + 1], zD = zs[(j + 1) * w + i];
      off = writeTri(dv, off, x0, yD, zD, x1, yD, zC, x1, yA, zB);
      off = writeTri(dv, off, x0, yD, zD, x1, yA, zB, x0, yA, zA);
    }
  }
  return off;
}

// Side walls (outward normals) plus perimeter fan bottom at z = 0 (normal -Z).
// Wall bottoms reuse the exact boundary coordinates so slicers weld the edges.
function writeSkirt(dv, off, grid, w, h) {
  const { xs, ys, zs } = grid;
  const loop = boundaryLoop(w, h);
  const cx = xs[w - 1] / 2, cy = ys[0] / 2;
  for (let k = 0; k < loop.length; k++) {
    const [i0, j0] = loop[k];
    const [i1, j1] = loop[(k + 1) % loop.length];
    const x0 = xs[i0], y0 = ys[j0], z0 = zs[j0 * w + i0];
    const x1 = xs[i1], y1 = ys[j1], z1 = zs[j1 * w + i1];
    off = writeTri(dv, off, x0, y0, 0, x1, y1, 0, x1, y1, z1);
    off = writeTri(dv, off, x0, y0, 0, x1, y1, z1, x0, y0, z0);
    off = writeTri(dv, off, cx, cy, 0, x1, y1, 0, x0, y0, 0);
  }
  return off;
}

export function heightmapToSTL(heights, w, h, opts = {}) {
  const grid = buildGrid(heights, w, h, opts);
  const n = stlTriangleCount(w, h);
  const buf = new ArrayBuffer(84 + 50 * n);
  const dv = new DataView(buf);
  for (let k = 0; k < HEADER_TEXT.length && k < 80; k++) {
    dv.setUint8(k, HEADER_TEXT.charCodeAt(k));
  }
  dv.setUint32(80, n, true);
  let off = 84;
  off = writeTop(dv, off, grid, w, h);
  off = writeSkirt(dv, off, grid, w, h);
  if (off !== buf.byteLength) throw new Error("relief-stl: facet count mismatch");
  return buf;
}
