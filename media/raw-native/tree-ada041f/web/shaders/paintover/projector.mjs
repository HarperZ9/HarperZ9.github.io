// Paint-over projection: a painting made over a render from one camera is projected back onto
// the geometry it was painted over, and becomes the surface colour. CPU reference, float64.
//
// A projector is { cam, w, h, rgba (Uint8, the painting), depth (Float32, the depth of the
// block-out seen from the projector camera, row-major) }. A world point P with normal N is
// covered by a projector when it lands inside the painting, faces the projector (facing
// f = N . toProjector above fMin) and is not hidden from it: the block-out's depth at that pixel
// is not nearer than the point's depth by more than a tolerance that grows at grazing angles.
//
// Several projectors blend by view angle. The weight of projector k at a point is
//   w_k = f_k^p * window(angle_k / thetaMax),  window(a) = max(1 - a^2, 0)^2, floored at 1e-4,
// where angle_k is the angle between the direction to the projector and the direction to the
// viewer. Windows are compact: with the viewer at projector 0 and every other projector more than
// thetaMax away, the weight of the others is exactly the floor (1e-4 of a code), so the view from a
// projector shows its painting unchanged (the round trip). The floor keeps coverage independent
// of the window: a point any projector sees is never a hole.
import { project, toCamera, pixelWorld, dot } from "./camera.mjs";

export const DEFAULTS = { thetaMaxDeg: 40, facingPow: 2, fMin: 0.12, floor: 1e-4, tolBase: 2, tolGrazing: 6, reach: false };
// Keyframe weights (the default for new code): a projector's window reaches out to the nearest other
// projector's direction (and no further than thetaMax), so at every projector's own camera the others
// weigh the floor and the view is that painting unchanged, while between two projectors the weights
// cross-fade. DEFAULTS keeps the fixed thetaMax window used in the first measurement.
export const KEYFRAME = { ...DEFAULTS, reach: true };
const reachCache = new WeakMap();
// Angular reach of each projector in radians: the angle to the nearest other projector (between
// their view axes), at most thetaMax and at least 8 degrees.
export function reaches(projectors, opt) {
  const key = projectors; let hit = reachCache.get(key);
  if (hit && hit.opt === opt && hit.n === projectors.length) return hit.r;
  const tm = (opt.thetaMaxDeg * Math.PI) / 180, r = projectors.map((a, k) => {
    if (!opt.reach || projectors.length < 2) return tm;
    let m = Infinity;
    projectors.forEach((b, j) => { if (j !== k) m = Math.min(m, Math.acos(Math.min(1, Math.max(-1, dot(a.cam.fwd, b.cam.fwd))))); });
    return Math.min(tm, Math.max(m, (8 * Math.PI) / 180));
  });
  reachCache.set(key, { opt, n: projectors.length, r });
  return r;
}

export function makeProjector(cam, w, h, rgba, depth) { return { cam, w, h, rgba, depth }; }

// Bilinear sample of the painting at pixel coordinates (x, y), clamped. Returns [r, g, b] in 0..1.
export function sampleRgb(pr, x, y) {
  const { w, h, rgba } = pr, xc = Math.min(w - 1, Math.max(0, x)), yc = Math.min(h - 1, Math.max(0, y)), x0 = Math.floor(xc), y0 = Math.floor(yc), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = xc - x0, fy = yc - y0;
  const o = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = rgba[(y0 * w + x0) * 4 + c], b = rgba[(y0 * w + x1) * 4 + c], d = rgba[(y1 * w + x0) * 4 + c], e = rgba[(y1 * w + x1) * 4 + c];
    o[c] = ((a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy) / 255;
  }
  return o;
}

// Is P (normal N) seen by projector pr? Returns { px, py, f } or null.
export function covered(pr, P, N, opt = DEFAULTS) {
  const p = project(pr.cam, pr.w, pr.h, P);
  if (!(p[0] >= -0.5 && p[0] <= pr.w - 0.5 && p[1] >= -0.5 && p[1] <= pr.h - 0.5)) return null;
  const to = toCamera(pr.cam, P), f = dot(N, to);
  if (f < opt.fMin) return null;
  const ix = Math.min(pr.w - 1, Math.max(0, Math.round(p[0]))), iy = Math.min(pr.h - 1, Math.max(0, Math.round(p[1]))), dm = pr.depth[iy * pr.w + ix];
  const tol = pixelWorld(pr.cam, pr.h, p[2]) * (opt.tolBase + opt.tolGrazing * (1 - f));
  if (p[2] - dm > tol) return null;
  return { px: p[0], py: p[1], f };
}

const window2 = (a) => { const t = Math.max(0, 1 - a * a); return t * t; };
// The blended colour at P as seen from viewCam. Returns { rgb, wsum, hit: number of projectors that cover, weights }.
export function shadePoint(projectors, P, N, viewCam, opt = DEFAULTS) {
  const v = toCamera(viewCam, P), reach = reaches(projectors, opt);
  let wsum = 0, r = 0, g = 0, b = 0, hit = 0;
  const weights = new Array(projectors.length).fill(0);
  for (let k = 0; k < projectors.length; k++) {
    const pr = projectors[k], c = covered(pr, P, N, opt);
    if (!c) continue;
    hit++;
    const ang = Math.acos(Math.min(1, Math.max(-1, dot(toCamera(pr.cam, P), v)))), w = Math.pow(c.f, opt.facingPow) * Math.max(window2(ang / reach[k]), opt.floor);
    const col = sampleRgb(pr, c.px, c.py);
    wsum += w; r += w * col[0]; g += w * col[1]; b += w * col[2]; weights[k] = w;
  }
  return wsum > 0 ? { rgb: [r / wsum, g / wsum, b / wsum], wsum, hit, weights } : { rgb: null, wsum: 0, hit: 0, weights };
}

// Render the painted surface for a view: the G-buffer gives P, N per pixel (renderGbuf with
// shadeOn false is enough). Returns { rgb: Float32 (3 per pixel), covered: Uint8, hitCount: Uint8,
// nrm... } with holes filled by `fallback(i)` (a colour) when given.
export function renderProjected(projectors, g, viewCam, { fallback = null, opt = DEFAULTS } = {}) {
  const n = g.w * g.h, rgb = new Float32Array(n * 3), cov = new Uint8Array(n), hits = new Uint8Array(n), P = [0, 0, 0], N = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    if (!g.hit[i]) { for (let c = 0; c < 3; c++) rgb[i * 3 + c] = g.shade[i * 3 + c]; continue; }
    for (let c = 0; c < 3; c++) { P[c] = g.P[i * 3 + c]; N[c] = g.N[i * 3 + c]; }
    const s = shadePoint(projectors, P, N, viewCam, opt);
    if (s.rgb) { cov[i] = 1; hits[i] = s.hit; for (let c = 0; c < 3; c++) rgb[i * 3 + c] = s.rgb[c]; } else {
      const fb = fallback ? fallback(i) : [1, 0, 1];
      for (let c = 0; c < 3; c++) rgb[i * 3 + c] = fb[c];
    }
  }
  return { w: g.w, h: g.h, rgb, covered: cov, hits };
}

// Stretch of the primary projector's painting over the view: the 2 x 2 Jacobian of the map from
// view pixels to painting pixels, from neighbouring pixels that lie on one surface. Returns
// per-pixel { smax, smin } (NaN where undefined), in painting pixels per view pixel. To read it as
// blur, normalise by the resolution ratio: texel magnification = (view h / painting h) / smin.
export function stretchMap(pr, g, opt = DEFAULTS) {
  const { w, h } = g, smax = new Float32Array(w * h).fill(NaN), smin = new Float32Array(w * h).fill(NaN);
  const proj = (i) => project(pr.cam, pr.w, pr.h, [g.P[i * 3], g.P[i * 3 + 1], g.P[i * 3 + 2]]);
  const near = (i, j) => g.hit[j] && g.id[j] === g.id[i] && Math.abs(g.depth[j] - g.depth[i]) < 0.35;
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x, jx = i + 1, jy = i + w;
    if (!g.hit[i] || !near(i, jx) || !near(i, jy)) continue;
    const a = proj(i), bx = proj(jx), by = proj(jy), j00 = bx[0] - a[0], j10 = bx[1] - a[1], j01 = by[0] - a[0], j11 = by[1] - a[1];
    // singular values of [[j00, j01], [j10, j11]]
    const s1 = j00 * j00 + j01 * j01 + j10 * j10 + j11 * j11, det = j00 * j11 - j01 * j10, s2 = Math.sqrt(Math.max(0, s1 * s1 - 4 * det * det)), mx = Math.sqrt((s1 + s2) / 2), mn = Math.sqrt(Math.max(0, (s1 - s2) / 2));
    smax[i] = mx; smin[i] = mn;
  }
  return { smax, smin };
}
