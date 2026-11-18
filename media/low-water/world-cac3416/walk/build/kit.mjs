// Parts for whatever is built: walls, boxes, pipes, lathed shapes and cards, written into one
// mesh in the form built.wgsl reads (place, normal, uv in metres, material and three numbers).
// A frame places a part: an origin and a turn about the vertical, so a house is described facing
// its own front and then set down on its lane.
import { Mesh } from "../flora/grow.mjs";
import { cellUV } from "../flora/atlas.mjs";

export const frame = (x, y, z, turn = 0) => ({ o: [x, y, z], c: Math.cos(turn), s: Math.sin(turn), turn });
export const put = (f, p) => [f.o[0] + p[0] * f.c + p[2] * f.s, f.o[1] + p[1], f.o[2] - p[0] * f.s + p[2] * f.c];
export const dir = (f, d) => [d[0] * f.c + d[2] * f.s, d[1], -d[0] * f.s + d[2] * f.c];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export class Kit extends Mesh {
  // a flat four-sided face in a frame; corners run round it, the first edge is its width. uv is in
  // metres from the first corner unless `unit` (then 0..1 across and up, as a window wants)
  face(f, a, b, c, d, m, unit = false) {
    const A = put(f, a), B = put(f, b), C = put(f, c), D = put(f, d), n = norm(cross(sub(B, A), sub(D, A)));
    const w = unit ? 1 : Math.hypot(...sub(B, A)), h = unit ? 1 : Math.hypot(...sub(D, A)), q = [[A, 0, 0], [B, w, 0], [C, w, h], [D, 0, h]];
    for (const i of [0, 1, 2, 0, 2, 3]) this.v(q[i][0], n, q[i][1], q[i][2], m);
  }
  tri(f, a, b, c, m) { const A = put(f, a), B = put(f, b), C = put(f, c), n = norm(cross(sub(B, A), sub(C, A))); this.v(A, n, 0, 0, m); this.v(B, n, Math.hypot(...sub(B, A)), 0, m); this.v(C, n, 0, Math.hypot(...sub(C, A)), m); }
  // a box from (x0, y0, z0) to (x1, y1, z1) in a frame; faces outward; top and bottom optional
  box(f, x0, y0, z0, x1, y1, z1, m, top = true, bottom = false) {
    this.face(f, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], m); this.face(f, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], m);
    this.face(f, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], m); this.face(f, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], m);
    if (top) this.face(f, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], m);
    if (bottom) this.face(f, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], m);
  }
  // a pipe or column through world points; uv runs round it and along it in metres
  pipe(points, r, sides, m) {
    const path = points.map((p, i) => ({ p, r: Array.isArray(r) ? r[i] : r })), girth = (Array.isArray(r) ? r[0] : r) * 6.283, start = this.a.length;
    this.tube(path, sides, m);
    for (let i = start; i < this.a.length; i += 12) { this.a[i + 6] *= girth; this.a[i + 8] = m[0]; this.a[i + 9] = m[1]; this.a[i + 10] = m[2]; this.a[i + 11] = m[3]; }
  }
  // a shape turned on a lathe about a vertical axis through (x, z): profile is [[radius, height], ...]
  lathe(x, y, z, profile, sides, m) {
    for (let i = 0; i + 1 < profile.length; i++) for (let k = 0; k < sides; k++) {
      const a0 = k / sides * 6.2832, a1 = (k + 1) / sides * 6.2832, [r0, h0] = profile[i], [r1, h1] = profile[i + 1], sl = Math.atan2(r0 - r1, h1 - h0);
      const P = (r, h, a) => [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r], N = (a) => [Math.cos(a) * Math.cos(sl), Math.sin(sl), Math.sin(a) * Math.cos(sl)];
      const q = [[P(r0, h0, a0), N(a0), a0 * r0, h0], [P(r0, h0, a1), N(a1), a1 * r0, h0], [P(r1, h1, a1), N(a1), a1 * r0, h1], [P(r1, h1, a0), N(a0), a0 * r0, h1]];
      for (const j of [0, 1, 2, 0, 2, 3]) this.v(q[j][0], q[j][1], q[j][2], q[j][3], m);
    }
  }
  // an atlas card between four world corners, the cell repeated `reps` times across
  cardAt(p00, p10, p11, p01, cell, m, reps = 1) {
    const [u0, v0, u1, v1] = cellUV(cell), n = norm(cross(sub(p10, p00), sub(p01, p00)));
    for (let r = 0; r < reps; r++) {
      const t0 = r / reps, t1 = (r + 1) / reps, L = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const q = [[L(p00, p10, t0), u0, v0], [L(p00, p10, t1), u1, v0], [L(p01, p11, t1), u1, v1], [L(p01, p11, t0), u0, v1]];
      for (const i of [0, 1, 2, 0, 2, 3]) this.v(q[i][0], n, q[i][1], q[i][2], m);
    }
  }
}
