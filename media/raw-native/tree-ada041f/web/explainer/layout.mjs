// Layouts for network pictures, in scene units, double precision, and their inverses so a click
// can name the number under it. Pure; runs in Node.
//
//   const g = tensorGrid({ shape: [256, 64, 64], x: 160, y: 140, w: 1600, h: 800 });
//   g.positions(values)          // Float32Array [x, y, value, flat index] per element, for points()
//   g.at(x, y)                   // { index, coords: [seq, pos, dim] } or null
//   tokenRow(n, { x0, x1, y })   // centres of n token slots
//   ellipseLattice(n, cx, cy, rx, ry)   // n points on a hex lattice inside an ellipse

// A 3-axis tensor as tiles: axis 0 tiles in a grid of `cols` columns; inside a tile, axis 1 runs
// down and axis 2 across. Each element is one point.
export function tensorGrid({ shape, x = 0, y = 0, w = 1600, h = 800, cols = 0, gap = 0.12 }) {
  const [A, B, C] = shape;
  const tilesX = cols || Math.ceil(Math.sqrt((A * w * B) / (h * C)));
  const tilesY = Math.ceil(A / tilesX);
  const tw = w / tilesX, th = h / tilesY;
  const cw = (tw * (1 - gap)) / C, ch = (th * (1 - gap)) / B;
  const cell = Math.min(cw, ch);
  const tile = (a) => [x + (a % tilesX) * tw, y + Math.floor(a / tilesX) * th];
  const pos = (a, b, c) => { const [tx, ty] = tile(a); return [tx + (c + 0.5) * cell, ty + (b + 0.5) * cell]; };
  return {
    shape, tilesX, tilesY, cell, tileW: tw, tileH: th, area: A * B * C * cell * cell,
    pos,
    tileRect: (a) => { const [tx, ty] = tile(a); return [tx, ty, C * cell, B * cell]; },
    positions(values, scale = 1) {
      const n = A * B * C, out = new Float32Array(4 * n);
      let i = 0;
      for (let a = 0; a < A; a++) for (let b = 0; b < B; b++) for (let c = 0; c < C; c++, i++) {
        const [px, py] = pos(a, b, c);
        out[4 * i] = px; out[4 * i + 1] = py; out[4 * i + 2] = values ? values[i] * scale : 0; out[4 * i + 3] = i;
      }
      return out;
    },
    // snap: a point in the gap between tiles names the nearest element of its tile.
    at(px, py, { snap = false } = {}) {
      const tx = Math.floor((px - x) / tw), ty = Math.floor((py - y) / th);
      if (tx < 0 || ty < 0 || tx >= tilesX) return null;
      const a = ty * tilesX + tx;
      if (a >= A) return null;
      const [ox, oy] = tile(a);
      let c = Math.floor((px - ox) / cell), b = Math.floor((py - oy) / cell);
      if (snap) { c = Math.max(0, Math.min(C - 1, c)); b = Math.max(0, Math.min(B - 1, b)); }
      if (c < 0 || b < 0 || c >= C || b >= B) return null;
      return { index: (a * B + b) * C + c, coords: [a, b, c] };
    },
  };
}

export function tokenRow(n, { x0 = 160, x1 = 1760, y = 540 } = {}) {
  const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
  return Array.from({ length: n }, (_, i) => [x0 + i * step, y]);
}

// n points on a hex lattice clipped to an ellipse, filled from the centre out (deterministic).
export function ellipseLattice(n, cx, cy, rx, ry) {
  const area = Math.PI * rx * ry, s = Math.sqrt((2 * area) / (Math.sqrt(3) * n * 1.05));
  const pts = [];
  const rows = Math.ceil(ry / ((s * Math.sqrt(3)) / 2)) + 1, cols = Math.ceil(rx / s) + 1;
  for (let j = -rows; j <= rows; j++) for (let i = -cols; i <= cols; i++) {
    const px = (i + (j & 1 ? 0.5 : 0)) * s, py = (j * s * Math.sqrt(3)) / 2;
    const q = (px / rx) ** 2 + (py / ry) ** 2;
    if (q <= 1) pts.push([cx + px, cy + py, q]);
  }
  pts.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  return pts.slice(0, n).map(([px, py]) => [px, py]);
}
