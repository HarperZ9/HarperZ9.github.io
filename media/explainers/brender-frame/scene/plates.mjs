// Segments 3 and 4: the plates pinned outside the tower wall beside each rung. Each one draws
// the mechanism of its rung (projection, scene graph, scanline fill, depth test, Gouraud), and
// then the rung's frame fills with its real output. Drawn for explanation: the shapes are
// illustrations; only the frames inside the rungs are period output.
import { C, put, putL, stroke, image, box, contour, rect, circle, trim, text, tex, span, window, ease, lerp, clamp01 } from "./lib.mjs";
import { frameBox, rungY } from "./world.mjs";

// A cube, rotated and projected with a perspective divide, into a box (x, y, w, h).
function cube(bx, by, bw, bh, yaw = 0.62, pitch = 0.42) {
  const P = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const x1 = x * Math.cos(yaw) - z * Math.sin(yaw), z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
    const y1 = y * Math.cos(pitch) - z1 * Math.sin(pitch), z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
    const d = 4.2 + z2, f = 3.0;
    P.push([bx + bw / 2 + (x1 * f / d) * bh * 0.42, by + bh / 2 - (y1 * f / d) * bh * 0.42]);
  }
  const E = [];
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) if ([1, 2, 4].includes(a ^ b)) E.push([a, b]);
  return { P, E };
}

export function prepare(A) {
  const L = {};
  // Rung 2: the perspective matrix, entry by entry, beside the wireframe frame.
  const f2 = frameBox(2), mx = f2.x + f2.w + 260, my = rungY(2) - 92;
  const M = [["f/a", "0", "0", "0"], ["0", "f", "0", "0"], ["0", "0", "A", "B"], ["0", "0", "-1", "0"]];
  L.matrix = M.flat().map((s, k) => text(s, { atlas: A.mono, size: 26, x: mx + 40 + (k % 4) * 78, y: my + 34 + Math.floor(k / 4) * 46, anchor: "center" }).shape);
  L.brackets = [contour([mx + 6, my, mx - 6, my, mx - 6, my + 190, mx + 6, my + 190], false), contour([mx + 300, my, mx + 312, my, mx + 312, my + 190, mx + 300, my + 190], false)];
  L.matrixName = text("BrMatrix4Perspective", { atlas: A.mono, size: 26, x: mx + 150, y: my - 22, anchor: "center" }).shape;
  L.cube = cube(f2.x, f2.y, f2.w, f2.h);
  L.matrixAt = [mx + 150, my + 95];
  // Rung 3: a scene graph, world > actor > three models.
  const f3 = frameBox(3), gx = f3.x - 470, gy = rungY(3) - 110;
  L.nodes = [["world", gx + 160, gy], ["actor", gx + 160, gy + 86], ["model", gx + 40, gy + 172], ["model", gx + 160, gy + 172], ["model", gx + 280, gy + 172]]
    .map(([s, x, y]) => ({ x, y, box: box(x - 52, y - 22, 104, 40), name: text(s, { atlas: A.mono, size: 22, x, y: y + 7, anchor: "center" }).shape }));
  L.edges = [[0, 1], [1, 2], [1, 3], [1, 4]].map(([a, b]) => [contour([L.nodes[a].x, L.nodes[a].y + 18, L.nodes[b].x, L.nodes[b].y - 22], false)]);
  // Rung 4: one triangle filled a row of pixels at a time, lit by how much it faces the light.
  const f4 = frameBox(4), tx = f4.x + f4.w + 230, ty = rungY(4) - 120;
  L.tri = [[tx + 40, ty + 230], [tx + 200, ty], [tx + 400, ty + 200]];
  L.triEdge = [contour([...L.tri.flat(), ...L.tri[0]], true)];
  L.rows = [];
  for (let y = ty + 2; y < ty + 230; y += 6) {
    const xs = [];
    for (let k = 0; k < 3; k++) {
      const [a, b] = [L.tri[k], L.tri[(k + 1) % 3]];
      if ((y - a[1]) * (y - b[1]) <= 0 && a[1] !== b[1]) xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
    }
    if (xs.length >= 2) L.rows.push(rect(Math.min(...xs), y, Math.max(...xs) - Math.min(...xs), 5));
  }
  L.light = [contour([tx + 470, ty - 60, tx + 330, ty + 60], false), contour([tx + 346, ty + 38, tx + 330, ty + 60, tx + 356, ty + 56], false)];
  // Rung 5: two overlapping shapes, a depth per pixel (lighter is nearer); the nearer wins.
  const f5 = frameBox(5), dx = f5.x - 500, dy = rungY(5) - 110;
  L.depth = { far: { x: dx, y: dy, w: 260, h: 170, z: 0.3 }, near: { x: dx + 150, y: dy + 60, w: 240, h: 160, z: 0.75 }, cell: 10 };
  // Rung 10: a faceted sphere becomes smooth; three vertex colours blend across one triangle.
  const f10 = frameBox(10), sx = f10.x + f10.w + 300, sy = rungY(10);
  L.sphere = { x: sx, y: sy, r: 120, facets: [] };
  const ring = 8, seg = 14;
  for (let i = 0; i < ring; i++) for (let j = 0; j < seg; j++) {
    const a0 = (j / seg) * Math.PI * 2, a1 = ((j + 1) / seg) * Math.PI * 2, r0 = (i / ring) * 120, r1 = ((i + 1) / ring) * 120;
    const pts = [sx + Math.cos(a0) * r0, sy + Math.sin(a0) * r0, sx + Math.cos(a1) * r0, sy + Math.sin(a1) * r0, sx + Math.cos(a1) * r1, sy + Math.sin(a1) * r1, sx + Math.cos(a0) * r1, sy + Math.sin(a0) * r1];
    const am = (a0 + a1) / 2, rm = (r0 + r1) / 2 / 120, nz = Math.sqrt(Math.max(0, 1 - rm * rm));
    const lit = clamp01(0.25 + 0.75 * (nz * 0.7 + rm * (Math.cos(am) * -0.5 + Math.sin(am) * -0.5)));
    L.facets = L.facets || [];
    L.sphere.facets.push({ shape: [contour(pts, true)], lit });
  }
  L.gouraud = text("Gouraud 1971", { atlas: A.sans, size: 26, x: sx, y: sy + 170, anchor: "center" }).shape;
  A.plates = L;
}

const grey = (v) => [v, v, v, 1];

export function draw(t, A, T, items) {
  const L = A.plates;
  // Rung 2: matrix, then the eight points travel from it into the frame, then the edges join.
  const m = window(t, T.matrix, T.s4 + 2, 0.8, 1.2);
  if (m > 0) {
    stroke(items, L.brackets, C.ink, 3, m);
    L.matrix.forEach((s, k) => putL(items, s, C.ink, m * span(t, T.matrix + k * 0.12, T.matrix + k * 0.12 + 0.5)));
    putL(items, L.matrixName, C.ink2, m);
    const fly = span(t, T.project, T.project + 1.6, ease.smooth), join = span(t, T.cube, T.cube + 1.4);
    L.cube.P.forEach(([x, y], k) => {
      const u = clamp01(fly * 1.3 - k * 0.04), px = lerp(L.matrixAt[0], x, u), py = lerp(L.matrixAt[1], y, u);
      if (fly > 0) put(items, circle(px, py, 5, 16), C.ink, m * (1 - span(t, T.cubeImg, T.cubeImg + 1.0)));
    });
    if (join > 0) stroke(items, trim(L.cube.E.map(([a, b]) => contour([...L.cube.P[a], ...L.cube.P[b]], false)), 0, join), C.ink, 2.4, m * (1 - span(t, T.cubeImg, T.cubeImg + 1.0)));
  }
  // Rung 3: the scene graph; the actor turns and its models move as one.
  const g = window(t, T.graph, T.s4 + 1, 0.8, 1.0);
  if (g > 0) {
    L.edges.forEach((e, k) => stroke(items, e, C.dim, 2, g * span(t, T.graph + 0.2 * k, T.graph + 0.2 * k + 0.6)));
    L.nodes.forEach((n, k) => { const hot = k >= 1 ? 0.6 + 0.4 * window(t, T.asOne, T.asOne + 2.4, 0.4, 0.6) : 0.6; stroke(items, n.box, C.ink, 2, g * hot); putL(items, n.name, C.ink, g * hot); });
  }
  // Rung 4: rows fill one per frame at first, then faster; the face takes one shade.
  const r = window(t, T.rows, T.depth + 1.2, 0.6, 1.0);
  if (r > 0) {
    stroke(items, L.triEdge, C.ink, 2.4, r);
    const slow = Math.max(0, (t - T.rows - 0.4) * 30), n = Math.min(L.rows.length, slow < 8 ? slow : 8 + (slow - 8) * 4);
    for (let k = 0; k < Math.floor(n); k++) items.push({ shape: L.rows[k], fill: grey(0.62), opacity: r });
    stroke(items, L.light, C.ink2, 2.4, r * span(t, T.rows, T.rows + 0.8));
  }
  // Rung 5: the far shape, then the near one column by column; in the overlap the nearer wins.
  const d = window(t, T.depth, T.gouraud + 1.2, 0.6, 1.0);
  if (d > 0) {
    const D = L.depth, c = D.cell;
    for (const [s, at] of [[D.far, T.depth], [D.near, T.depth + 1.2]]) {
      const cols = Math.ceil(s.w / c), shown = Math.floor(span(t, at, at + 1.6, ease.linear) * cols);
      for (let i = 0; i < shown; i++) items.push({ shape: rect(s.x + i * c, s.y, Math.min(c, s.w - i * c), s.h), fill: grey(0.18 + 0.7 * s.z), opacity: d });
    }
    stroke(items, box(D.near.x, D.near.y, D.near.w, D.near.h), C.ink, 2, d * span(t, T.depth + 2.8, T.depth + 3.4));
  }
  // Rung 10: facets, then the smooth sphere as the narration reaches "round".
  const s = window(t, T.gouraud, T.s5 + 1, 0.6, 1.0);
  if (s > 0) {
    const smooth = span(t, T.round, T.round + 2.0, ease.smooth), S = L.sphere;
    S.facets.forEach((f) => items.push({ shape: f.shape, fill: grey(0.08 + 0.7 * f.lit), stroke: [0, 0, 0, 1], width: 1.2, opacity: s * (1 - smooth) }));
    items.push({ shape: circle(S.x, S.y, S.r, 96), fill: { radial: [S.x - 40, S.y - 44, S.r * 1.25], stops: [[0, "#dcd6c8"], [0.55, "#6e6a62"], [1, "#141416"]] }, opacity: s * smooth });
    putL(items, L.gouraud, C.ink2, s);
  }
}
