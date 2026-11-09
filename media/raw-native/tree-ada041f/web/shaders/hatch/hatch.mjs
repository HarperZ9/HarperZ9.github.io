// Curvature hatching from the SDF Hessian, in a ray-marched scene.
//
// An engraver lays lines around a form, across its strongest bend: around a column, along the
// meridians of nothing at all on a sphere (it bends the same everywhere), and across the saddle of
// a torus's inner edge. In a scene made of signed distance functions the bend is in the field
// itself: at a hit point the Hessian of the SDF, restricted to the tangent plane and divided by
// the gradient's length, is the shape operator. Its eigenvectors are the principal directions and
// its eigenvalues the principal curvatures. Lines run along the direction of strongest curvature;
// a second layer, for darker tones, runs along the other one. Where the two curvatures are nearly
// equal (umbilics: spheres, planes) the directions are undefined, so the pass falls back to a fixed
// field (world up projected into the tangent plane) and says so. Line spacing is in world units,
// width in screen pixels, antialiased analytically. Prior work: Interrante 1997, Hertzmann and Zorin
// 2000 (meshes), Broske's CurvatureDirectedRendering (SDF principal directions with sampled
// streamlines); this pass hatches per pixel inside the ray march.
import { stillSdf, STILL } from "../fixtures/stilllife.mjs";

export const HATCH_PRESETS = {
  engraving: { freq: 34, width: 0.55, layers: 1, umb: 0.12, contour: 0, ink: [0.12, 0.1, 0.11], paper: [0.95, 0.93, 0.88] },
  crosshatch: { freq: 26, width: 0.6, layers: 2, umb: 0.12, contour: 0, ink: [0.1, 0.09, 0.12], paper: [0.96, 0.94, 0.9] },
  ink: { freq: 22, width: 0.8, layers: 2, umb: 0.12, contour: 0.25, ink: [0.05, 0.05, 0.07], paper: [0.93, 0.9, 0.84] },
};
export const resolveHatch = (preset, overrides = {}, size) => ({ p: { ...HATCH_PRESETS[preset], ...overrides }, w: size.w, h: size.h });

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.sqrt(dot(a, a)), norm = (a) => mul(a, 1 / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const E = 0.01;
const AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// Principal curvatures and directions of the level set of f at p.
export function curvature(f, p, umb = 0.12) {
  const f0 = f(p), g = AX.map((e) => (f(add(p, mul(e, E))) - f(sub(p, mul(e, E)))) / (2 * E)), gl = len(g), n = mul(g, 1 / gl);
  const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) H[i][i] = (f(add(p, mul(AX[i], E))) - 2 * f0 + f(sub(p, mul(AX[i], E)))) / (E * E);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const ei = mul(AX[i], E), ej = mul(AX[j], E);
    H[i][j] = H[j][i] = (f(add(add(p, ei), ej)) - f(sub(add(p, ei), ej)) - f(add(sub(p, ei), ej)) + f(sub(sub(p, ei), ej))) / (4 * E * E);
  }
  const t1 = norm(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), t2 = cross(n, t1);
  const Hv = (v) => [dot(H[0], v), dot(H[1], v), dot(H[2], v)];
  const a = dot(t1, Hv(t1)) / gl, b = dot(t1, Hv(t2)) / gl, d = dot(t2, Hv(t2)) / gl;
  const m = 0.5 * (a + d), r = Math.sqrt(0.25 * (a - d) ** 2 + b * b), k1 = m + r, k2 = m - r;
  // Eigenvector of the larger-magnitude eigenvalue, by the better-conditioned of two forms.
  const kmax = Math.abs(k1) >= Math.abs(k2) ? k1 : k2, kmin = kmax === k1 ? k2 : k1;
  let ex = b, ey = kmax - a; if (Math.abs(kmax - d) > Math.abs(kmax - a)) { ex = kmax - d; ey = b; }
  const el = Math.hypot(ex, ey), umbilic = r < umb * Math.max(Math.abs(k1), Math.abs(k2), 0.05) || el < 1e-12;
  let dir = el > 0 ? norm(add(mul(t1, ex / el), mul(t2, ey / el))) : t1;
  if (umbilic) { const up = sub([0, 1, 0], mul(n, n[1])); dir = len(up) > 1e-6 ? norm(up) : t1; }
  return { n, kmax, kmin, dir, other: cross(n, dir), umbilic };
}

export function camRay(plan, x, y) {
  const c = STILL.camera, fwd = norm(sub(c.target, c.eye)), right = norm([-fwd[2], 0, fwd[0]]), up = cross(right, fwd);
  const sx = ((x + 0.5) / plan.w - 0.5) * 2 * (plan.w / plan.h) * c.tan, sy = (0.5 - (y + 0.5) / plan.h) * 2 * c.tan;
  return norm(add(add(fwd, mul(right, sx)), mul(up, sy)));
}
export function march(ro, rd) {
  let t = 0;
  for (let i = 0; i < 160; i++) { const d = stillSdf(add(ro, mul(rd, t))); if (d < 1e-4 * (1 + t)) return t; t += d; if (t > 30) break; }
  return -1;
}
// Coverage of the nearest line at a pixel: a one-pixel ramp at the line's edge, so lines thinner than
// a pixel fade instead of breaking into dots.
const lineCov = (s, freq, halfW, px) => { const u = s * freq, fr = u - Math.floor(u), dist = Math.min(fr, 1 - fr) / freq; return Math.max(0, Math.min(1, (halfW - dist) / px + 0.5)) * Math.min(1, (2 * halfW) / px); };
// Lines at a density that stays put on screen: the world frequency halves each time a line spacing
// would fall under 4 pixels (px: one pixel in world units), crossfading between the two nested
// levels (every line of level l + 1 is a line of level l). A first version used one world
// frequency and the distant ground dissolved into moire.
export function hatchLines(s, freq, px, halfW) {
  const lev = Math.max(0, Math.log2((px * freq) / 0.25)), l0 = Math.floor(lev), t = lev - l0, f0 = freq / 2 ** l0;
  return lineCov(s, f0, halfW, px) * (1 - t) + lineCov(s, f0 / 2, halfW, px) * t;
}
// Line coordinates. Curved, non-umbilic: across the strong direction (lines run along it). At
// umbilics and on flat ground the direction field is undefined, so the lines become planar slices,
// as engravers cut cross-contours: horizontal slices (q.y) on upright surfaces, a fixed slant on
// near-horizontal ones. (A first version kept the dot product with a projected up vector there,
// which swirled on the sphere.)
export const SLANT = [0.9578262852211514, 0, 0.28734788556634544], SLANT2 = [-0.28734788556634544, 0, 0.9578262852211514];
// The second (cross-hatch) layer is always a planar slice at a slant: a dot product with the
// varying direction field zigzagged on the column in the first version.
export const CROSS = [0.6246950475544243, 0.4685212856658182, -0.6246950475544243];
export function coords(q, cv) {
  const second = dot(q, CROSS);
  if (!cv.umbilic) return [dot(q, cv.other), second];
  if (Math.abs(cv.n[1]) > 0.95) return [dot(q, SLANT), dot(q, SLANT2)];
  return [q[1], second];
}

// A frame: returns display-linear RGBA, and per pixel whether the fallback direction was used.
export function runHatch(plan) {
  const p = plan.p, { w, h } = plan, out = new Float32Array(w * h * 4), fallback = new Uint8Array(w * h), eye = STILL.camera.eye, L = norm(STILL.light);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, rd = camRay(plan, x, y), t = march(eye, rd);
    let col = p.paper;
    if (t > 0) {
      const q = add(eye, mul(rd, t)), cv = curvature(stillSdf, q, p.umb), tone = 0.12 + 0.88 * Math.max(0, dot(cv.n, L));
      fallback[y * w + x] = cv.umbilic ? 1 : 0;
      const px = (t * 2 * STILL.camera.tan) / h, halfW = 0.5 * p.width * px;
      // Darkness in [0, 1]: layer 1 starts at 0, layer 2 below tone 0.5; line width grows with darkness.
      const dark = 1 - tone, [s1, s2] = coords(q, cv);
      let ink = hatchLines(s1, p.freq, px, halfW * (0.4 + 1.6 * dark));
      if (p.layers > 1 && tone < 0.5) ink = 1 - (1 - ink) * (1 - hatchLines(s2, p.freq, px, halfW * (0.4 + 2 * (0.5 - tone))));
      if (p.contour > 0) { const nv = Math.abs(dot(cv.n, rd)); if (nv < p.contour) ink = Math.max(ink, Math.min(1, (p.contour - nv) / (0.5 * p.contour))); }
      col = [0, 1, 2].map((k) => p.paper[k] * (1 - ink) + p.ink[k] * ink);
    }
    out.set([col[0], col[1], col[2], 1], o);
  }
  return { width: w, height: h, data: out, fallback };
}
