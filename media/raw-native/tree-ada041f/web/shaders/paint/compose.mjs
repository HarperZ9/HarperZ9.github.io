// The painterly compose pass (CPU reference of paint.wgsl.mjs, compose):
//   warp      the expressive presets sample the abstraction through a slow noise warp
//   pigment   a temperature push in pigment space: shadows take phthalo, lights take hansa
//   decode    Kubelka-Munk back to colour, plus the residual
//   medium    oil and gouache: the stroke relief lit from the upper left, with a sheen for oil;
//             watercolour: a Kubelka-Munk glaze of finite thickness over paper, thicker in the
//             paper's valleys (granulation) and at region edges (the wet edge), applied as a
//             ratio to the unmodified glaze so the colour stays the target's on average
//   lines     XDoG (Winnemoeller, Kyprianidis, Olsen, 2012) on the abstracted luminance
import { kmDecode, K_TAB, S_TAB, W_TAB, LAMBDA } from "./pigments.mjs";
import { paperHeight, canvasHeight, warpX, warpY, paperHalf } from "./noise.mjs";

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function sample(buf, ch, w, h, x, y, stride) {
  const fx = clamp(x, 0, w - 1), fy = clamp(y, 0, h - 1), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
  const o = new Float64Array(ch);
  for (let c = 0; c < ch; c++) {
    const a = buf[(y0 * w + x0) * stride + c], b = buf[(y0 * w + x1) * stride + c], cc = buf[(y1 * w + x0) * stride + c], d = buf[(y1 * w + x1) * stride + c];
    o[c] = (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
  }
  return o;
}
// Glaze of thickness X over a ground of reflectance Rg, as linear RGB (Kubelka-Munk layer).
export function glaze(c, X, Rg) {
  const out = [0, 0, 0];
  for (let wl = 0; wl < LAMBDA.length; wl++) {
    let K = 0, S = 0;
    for (let i = 0; i < 4; i++) { K += c[i] * K_TAB[wl][i]; S += c[i] * S_TAB[wl][i]; }
    S = Math.max(S, 1e-6);
    const a = 1 + K / S, b = Math.sqrt(a * a - 1), z = Math.min(b * S * X, 30), sh = Math.sinh(z), chh = Math.cosh(z), den = a * sh + b * chh;
    const R = sh / den, T = b / den, Rt = R + (T * T * Rg) / (1 - R * Rg);
    for (let k = 0; k < 3; k++) out[k] += W_TAB[wl][k] * Rt;
  }
  return out;
}
function xdog(plan, s, x, y) {
  const { w, h } = plan.out, { lineSigma: sg } = plan.p, k = 1.6, R = Math.ceil(3 * sg * k);
  let a = 0, b = 0, wa = 0, wb = 0;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const xx = clamp(x + dx, 0, w - 1), yy = clamp(y + dy, 0, h - 1), i = (yy * w + xx) * 4;
    const l = 0.2126 * s[i] + 0.7152 * s[i + 1] + 0.0722 * s[i + 2], r2 = dx * dx + dy * dy;
    const g1 = Math.exp(-r2 / (2 * sg * sg)), g2 = Math.exp(-r2 / (2 * sg * sg * k * k));
    a += g1 * l; wa += g1; b += g2 * l; wb += g2;
  }
  const D = a / wa - 0.985 * (b / wb);
  return D >= -0.004 ? 1 : 1 + Math.tanh(plan.p.lineSharp * (D + 0.004));
}

// Relief, per unwarped pixel: the XDoG line, the lit impasto (shade and sheen) and the
// watercolour wet edge. Compose samples it bilinearly at the warped position, so a warp never
// snaps to a pixel (which would alias the lines and differ between f32 and f64 at half pixels).
export function relief(plan, ak, H, T, cv) {
  const { w, h } = plan.out, p = plan.p, out = new Float32Array(w * h * 4), lc = [-0.5, -0.6, 0.62], ll = Math.hypot(...lc), L = lc.map((v) => v / ll);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, line = p.lines > 0 ? xdog(plan, ak.s, x, y) : 1;
    const hs = (dx, dy) => { const xx = clamp(x + dx, 0, w - 1), yy = clamp(y + dy, 0, h - 1); return p.impasto * H[(yy * w + xx) * 2] + 0.12 * cv.n(canvasHeight, xx, yy); };
    const nx = -(hs(1, 0) - hs(-1, 0)) * 2.5, ny = -(hs(0, 1) - hs(0, -1)) * 2.5, nl = Math.hypot(nx, ny, 1), n = [nx / nl, ny / nl, 1 / nl];
    const ndl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2], rz = 2 * ndl * n[2] - L[2];
    out.set([line, 1 + 0.9 * (ndl - L[2]), p.gloss * Math.pow(Math.max(0, rz), 24) * 0.35, smooth(0.012, 0.05, Math.sqrt(T[i * 4] + T[i * 4 + 2]))], i * 4);
  }
  return out;
}

export function compose(plan, ak, H, Rl, cv) {
  const { w, h } = plan.out, p = plan.p, img = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [wx, wy] = p.warp > 0 ? [cv.n(warpX, x, y, 0), cv.n(warpY, x, y, 0)] : [0, 0], sx = x + wx * p.warp, sy = y + wy * p.warp;
    const lat = sample(ak.lat, 7, w, h, sx, sy, 8), c = [lat[0], lat[1], lat[2], lat[3]], res = [lat[4], lat[5], lat[6]];
    const dec0 = kmDecode(c), D = dec0.map((d, k) => Math.max(0, d + res[k])), v = clamp(0.2126 * D[0] + 0.7152 * D[1] + 0.0722 * D[2], 0, 1);
    // Saturated colours keep their identity: the push and broken colour act mostly on neutrals
    // (in Kubelka-Munk a tenth of phthalo turns an orange to mud).
    const keep = smooth(0.15, 0.6, (Math.max(...D) - Math.min(...D)) / Math.max(Math.max(...D), 1e-3));
    // Complementary temperature: violet (phthalo and magenta) into the shadows, hansa into the lights.
    const pk = p.push * (1 - 0.85 * keep);
    c[3] += pk * (1 - v) * (1 - v); c[2] += 0.6 * pk * (1 - v) * (1 - v); c[1] += pk * 0.08 * v * v;
    // Broken colour: each stroke carries its own extra pigment, warm or cool.
    const jit = (sample(H, 2, w, h, sx, sy, 2)[1] - 0.5) * 2, rel = sample(Rl, 4, w, h, sx, sy, 4);
    const bk = p.broken * (1 - 0.85 * v * v) * (1 - 0.7 * keep);   // highlights and saturated colours stay clean
    c[1] += bk * Math.max(jit, 0); c[3] += bk * Math.max(-jit, 0); c[2] += 0.5 * bk * Math.abs(jit) * (1 - v);
    const cs = c[0] + c[1] + c[2] + c[3]; for (let i = 0; i < 4; i++) c[i] /= cs;
    // The pigment change reaches the colour as a ratio of the decoded paints, so a colour outside
    // the pigments' gamut (near-black) changes in proportion and cannot leave it.
    let rgb = kmDecode(c).map((d, k) => D[k] * Math.min(4, (d + 0.01) / (dec0[k] + 0.01)));
    // Value massing: a painter's few soft value bands. Values under 0.02 keep their own, and a
    // saturated colour moves only part of the way (a full band step would grey it).
    if (p.valueBands > 0) {
      const vy = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2], f = Math.min(vy, 1) * p.valueBands, fl = Math.floor(f);
      const vq = Math.max(Math.min(vy, 0.02), (fl + smooth(0.3, 0.7, f - fl)) / p.valueBands);
      const g = 1 + (vq / Math.max(vy, 1e-6) - 1) * (1 - 0.6 * keep);
      rgb = rgb.map((q) => q * g);
    }
    const paper = cv.n(paperHeight, x, y);
    if (p.medium === "water") {
      // The wet edge: pigment carried to the boundary of a wash; rel[3] is that edge (relief pass).
      // Pigment settles in the paper's broader valleys (half the tooth frequency).
      const valley = cv.n(paperHalf, x, y), Rg = 0.86 * (0.93 + 0.07 * paper);
      const X0 = 1.5, X = X0 * (1 + p.granulation * (0.5 - valley) * 2) * (1 + p.edge * rel[3]);
      const g0 = glaze(c, X0, 0.86), g1 = glaze(c, X, Rg);
      // The thickness change as a ratio: its luminance for neutrals, per channel only for
      // saturated colours (an out-of-gamut pigment mix would otherwise tint a grey wash).
      const lum = (q) => 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2], sr = lum(g1) / Math.max(lum(g0), 1e-4);
      const ratio = [0, 1, 2].map((k) => clamp(sr + (g1[k] / Math.max(g0[k], 1e-4) - sr) * keep, 0.5, 2));
      // A thinner wash than the target lets the paper through: a thinner layer transmits
      // T^dilution of what the full one does (Beer-Lambert), so the colour rises as a power.
      rgb = rgb.map((v2, k) => Math.pow(clamp(v2 * ratio[k], 0, 1), p.dilution));
    } else rgb = rgb.map((v2) => v2 * rel[1] + rel[2]);
    const t = 1 - p.lines * (1 - rel[0]);
    img.set([Math.max(0, rgb[0] * t), Math.max(0, rgb[1] * t), Math.max(0, rgb[2] * t), 1], (y * w + x) * 4);
  }
  return img;
}
