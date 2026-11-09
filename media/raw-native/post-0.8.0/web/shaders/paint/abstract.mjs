// The painterly abstraction passes (CPU reference of paint.wgsl.mjs):
//   prep     scene light to a display-referred colour, its sRGB encoding and its pigment latent
//   tensor   the smoothed structure tensor (Sobel, then a gaussian), giving flow and anisotropy
//   akf      anisotropic Kuwahara (Kyprianidis, Kang, Doellner, CGF 2009, with the polynomial
//            sector weights of their NPAR 2010 follow-up), averaging pigment latents, so the
//            filter mixes paint
//   stroke   brush relief and stroke identity: noise integrated along the flow (line integral
//            convolution); identity gives each stroke its own pigment jitter (broken colour)
import { linearToSrgb } from "../common.mjs";
import { lutConc, kmDecode } from "./pigments.mjs";
import { bristle, strokeId } from "./noise.mjs";

// Scene light to display light: a soft shoulder (1 - exp(-k x)) a painter's eye would see.
export const shoulderExp = (x, k) => 1 - Math.exp(-Math.max(0, x) * k);
// The shoulder on the largest channel, the others scaled with it, so a bright colour keeps its
// hue and saturation (a per-channel shoulder turns bright orange toward yellow and grey).
// Below m k = 1e-3 the gain is its series, where 1 - exp(-m k) cancels in f32.
export function shoulderRGB(x, k) {
  const r = Math.max(0, x[0]), g = Math.max(0, x[1]), b = Math.max(0, x[2]), m = Math.max(r, g, b), t = m * k;
  const gain = t < 1e-3 ? k * (1 - t / 2 + (t * t) / 6) : (1 - Math.exp(-t)) / m;
  return [r * gain, g * gain, b * gain];
}

export function prep(plan, scene) {
  const { w, h } = plan.out, n = w * h, s = new Float32Array(n * 4), lat = new Float32Array(n * 8);
  for (let i = 0; i < n; i++) {
    const D = shoulderRGB([scene.data[i * 4], scene.data[i * 4 + 1], scene.data[i * 4 + 2]], plan.p.exposure);
    const enc = D.map(linearToSrgb), c = lutConc(enc), dec = kmDecode(c);
    s.set([enc[0], enc[1], enc[2], 0.2126 * D[0] + 0.7152 * D[1] + 0.0722 * D[2]], i * 4);
    lat.set([c[0], c[1], c[2], c[3], D[0] - dec[0], D[1] - dec[1], D[2] - dec[2], 0], i * 8);
  }
  return { s, lat };
}

export function tensor(plan, s) {
  const { w, h } = plan.out, T = new Float32Array(w * h * 4), at = (x, y, c) => s[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let E = 0, F = 0, G = 0;
    for (let c = 0; c < 3; c++) {
      const gx = (at(x + 1, y - 1, c) + 2 * at(x + 1, y, c) + at(x + 1, y + 1, c) - at(x - 1, y - 1, c) - 2 * at(x - 1, y, c) - at(x - 1, y + 1, c)) / 4;
      const gy = (at(x - 1, y + 1, c) + 2 * at(x, y + 1, c) + at(x + 1, y + 1, c) - at(x - 1, y - 1, c) - 2 * at(x, y - 1, c) - at(x + 1, y - 1, c)) / 4;
      E += gx * gx; F += gx * gy; G += gy * gy;
    }
    T.set([E, F, G, 0], (y * w + x) * 4);
  }
  return T;
}
export function gaussWeights(sigma) {
  const r = Math.max(1, Math.ceil(2.5 * sigma)), w = new Float32Array(2 * r + 1); let s = 0;
  for (let i = -r; i <= r; i++) { w[i + r] = Math.exp(-0.5 * (i / sigma) ** 2); s += w[i + r]; }
  return w.map((v) => v / s);
}
export function blur4(plan, a, wts, alongY) {
  const { w, h } = plan.out, r = (wts.length - 1) / 2, o = new Float32Array(a.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
    let s = 0;
    for (let k = -r; k <= r; k++) { const xx = alongY ? x : Math.min(w - 1, Math.max(0, x + k)), yy = alongY ? Math.min(h - 1, Math.max(0, y + k)) : y; s += wts[k + r] * a[(yy * w + xx) * 4 + c]; }
    o[(y * w + x) * 4 + c] = s;
  }
  return o;
}
// Orientation along the edge (unit vector) and anisotropy in [0, 1] from a smoothed tensor.
// The gradient eigenvector is taken from whichever of (F, l1 - E) and (l1 - G, F) is longer, so an
// axis-aligned gradient (F = 0) is exact; the old single formula collapsed to zero for a horizontal
// gradient and fell back to an arbitrary direction, which f32 and f64 resolved differently.
// Anisotropy is scaled down where the gradient is far below one 8-bit code (a vanishing tensor is
// exactly 0 in f64 and about 1e-15 of rounding in f32), and where the structure is near isotropic
// the direction eases toward a fixed one (sign-aligned first, so the blend is continuous).
export const FLOW_FALLBACK = [0.7071067811865476, 0.7071067811865476];
// Major eigenvector of a symmetric 2 x 2 [[e, f], [f, g]], from the better-conditioned of the two
// candidate forms; its sign is arbitrary, which strokes and Kuwahara sectors do not mind.
function majorVec(e, f, g) {
  const tr = e + g, l1 = (tr + Math.sqrt((e - g) * (e - g) + 4 * f * f)) / 2;
  const ax = f, ay = l1 - e, bx = l1 - g, by = f, na = Math.hypot(ax, ay), nb = Math.hypot(bx, by);
  return na >= nb ? [ax, ay, na] : [bx, by, nb];
}
export function flow(E, F, G) {
  const tr = E + G, dsc = Math.sqrt((E - G) * (E - G) + 4 * F * F), l1 = (tr + dsc) / 2, l2 = (tr - dsc) / 2;
  const sharp = Math.min(1, Math.max(0, (tr - 1e-7) / 9e-7)), A = tr > 1e-12 ? ((l1 - l2) / (l1 + l2)) * sharp * sharp * (3 - 2 * sharp) : 0;
  // Blend in the tensor domain, which has no sign: the unit-trace structure tensor toward the
  // tensor of the fallback's gradient (perpendicular to the fallback tangent), by anisotropy.
  const t = Math.min(1, Math.max(0, (A - 0.02) / 0.08)), k = t * t * (3 - 2 * t), inv = tr > 1e-12 ? 1 / tr : 0;
  const e = k * E * inv + (1 - k) * 0.5, f = k * F * inv - (1 - k) * 0.5, g = k * G * inv + (1 - k) * 0.5;
  const [gx, gy, ng] = majorVec(e, f, g);
  if (ng <= 1e-12) return [FLOW_FALLBACK[0], FLOW_FALLBACK[1], A];
  return [-gy / ng, gx / ng, A];
}

export function akf(plan, s, lat, T) {
  const { w, h } = plan.out, { radius: r, q, zeta } = plan.p, N = 8, eta = (zeta + Math.cos(Math.PI / N)) / Math.sin(Math.PI / N) ** 2;
  const outLat = new Float32Array(w * h * 8), outS = new Float32Array(w * h * 4), acc = new Float64Array(N * 14);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, [tx, ty, A] = flow(T[p * 4], T[p * 4 + 1], T[p * 4 + 2]);
    const a = r * (1 + A), b = r / (1 + A), ex = Math.ceil(Math.sqrt(a * a * tx * tx + b * b * ty * ty)), ey = Math.ceil(Math.sqrt(a * a * ty * ty + b * b * tx * tx));
    acc.fill(0);
    for (let dy = -ey; dy <= ey; dy++) for (let dx = -ex; dx <= ex; dx++) {
      const u = (tx * dx + ty * dy) / a, v = (-ty * dx + tx * dy) / b, rr = u * u + v * v;
      if (rr > 1) continue;
      const qx = Math.min(w - 1, Math.max(0, x + dx)), qy = Math.min(h - 1, Math.max(0, y + dy)), qi = qy * w + qx, g = Math.exp(-2 * rr);
      for (let k = 0; k < N; k++) {
        const ang = (-2 * Math.PI * k) / N, xk = u * Math.cos(ang) - v * Math.sin(ang), yk = u * Math.sin(ang) + v * Math.cos(ang);
        const z = xk + zeta - eta * yk * yk; if (z <= 0) continue;
        const wk = z * z * g, o = k * 14;
        acc[o] += wk;
        for (let c = 0; c < 7; c++) acc[o + 1 + c] += wk * lat[qi * 8 + c];
        for (let c = 0; c < 3; c++) { const sv = s[qi * 4 + c]; acc[o + 8 + c] += wk * sv; acc[o + 11 + c] += wk * sv * sv; }
      }
    }
    let wsum = 0; const L = new Float64Array(7), S3 = [0, 0, 0];
    for (let k = 0; k < N; k++) {
      const o = k * 14, W = acc[o]; if (W <= 0) continue;
      let v2 = 0; for (let c = 0; c < 3; c++) { const m = acc[o + 8 + c] / W; v2 += Math.max(0, acc[o + 11 + c] / W - m * m); }
      const sd = Math.sqrt(v2) * 255, alpha = 1 / (1 + Math.pow(sd, q));
      wsum += alpha;
      for (let c = 0; c < 7; c++) L[c] += (alpha * acc[o + 1 + c]) / W;
      for (let c = 0; c < 3; c++) S3[c] += (alpha * acc[o + 8 + c]) / W;
    }
    for (let c = 0; c < 7; c++) outLat[p * 8 + c] = L[c] / wsum;
    for (let c = 0; c < 3; c++) outS[p * 4 + c] = S3[c] / wsum;
    outS[p * 4 + 3] = A;
  }
  return { lat: outLat, s: outS };
}

// Brush relief: bristle noise averaged along the flow, a triangle-weighted line integral.
export function stroke(plan, T, cv) {
  const { w, h } = plan.out, { strokeLen: L } = plan.p, H = new Float32Array(w * h * 2);
  // The tensor read bilinearly at the stroke's continuous position: a nearest-pixel read made the
  // direction field step at half pixels, where f32 and f64 paths could part.
  const dirAt = (px, py) => {
    const fx = Math.min(w - 1, Math.max(0, px)), fy = Math.min(h - 1, Math.max(0, py)), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const t = [0, 1, 2].map((c) => (T[(y0 * w + x0) * 4 + c] * (1 - tx) + T[(y0 * w + x1) * 4 + c] * tx) * (1 - ty) + (T[(y1 * w + x0) * 4 + c] * (1 - tx) + T[(y1 * w + x1) * 4 + c] * tx) * ty);
    return flow(t[0], t[1], t[2]);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let acc = cv.n(bristle, x, y) * (L + 1), ids = cv.n(strokeId, x, y) * (L + 1), ws = L + 1;
    for (const sgn of [1, -1]) {
      let px = x, py = y, [tx, ty] = dirAt(x, y), cont = 1; tx *= sgn; ty *= sgn;
      for (let k = 1; k <= L; k++) {
        px += tx; py += ty;
        const [nx, ny] = dirAt(px, py), d = nx * tx + ny * ty; tx = d < 0 ? -nx : nx; ty = d < 0 ? -ny : ny;
        // A turn near 90 degrees makes the sign choice above a coin toss; fade the stroke out
        // there so whichever way it goes contributes almost nothing (and f32 and f64 agree).
        const a = Math.min(1, Math.max(0, (Math.abs(d) - 0.05) / 0.25)); cont *= a * a * (3 - 2 * a);
        const wk = (L + 1 - k) * cont; acc += wk * cv.n(bristle, px, py); ids += wk * cv.n(strokeId, px, py); ws += wk;
      }
    }
    H[(y * w + x) * 2] = acc / ws; H[(y * w + x) * 2 + 1] = ids / ws;
  }
  return H;
}
