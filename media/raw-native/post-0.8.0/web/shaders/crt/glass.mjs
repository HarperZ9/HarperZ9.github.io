// The faceplate (CPU reference of the halo and compose passes in crt.wgsl): the halo
// from light trapped in the glass, then the colour of the phosphors, the room reflected
// in the curved glass, the black level the room lights up, and the bezel.
import { apply3 } from "../spectral.mjs";
import { faceAt, footprint, roomEnv } from "./geometry.mjs";

export function haloSize(plan) { const q = plan.halo.q; return [Math.ceil(plan.out.w / q), Math.ceil(plan.out.h / q)]; }

// Box-average the emission into the halo grid.
export function haloDown(plan, em) {
  const { q } = plan.halo, [gw, gh] = haloSize(plan), W = plan.out.w, H = plan.out.h, g = new Float32Array(gw * gh * 4);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = gy * q; y < Math.min(H, gy * q + q); y++) for (let x = gx * q; x < Math.min(W, gx * q + q); x++) {
      const i = (y * W + x) * 4; r += em[i]; gg += em[i + 1]; b += em[i + 2]; n++;
    }
    const o = (gy * gw + gx) * 4; g[o] = r / n; g[o + 1] = gg / n; g[o + 2] = b / n;
  }
  return g;
}
// Convolve the grid with the derived kernel (zero outside the frame).
export function haloConv(plan, g) {
  const { R, weights } = plan.halo, S = 2 * R + 1, [gw, gh] = haloSize(plan), o = new Float32Array(gw * gh * 4);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let r = 0, gg = 0, b = 0;
    for (let dy = -R; dy <= R; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= gh) continue;
      for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= gw) continue;
        const w = weights[(dy + R) * S + dx + R], i = (yy * gw + xx) * 4;
        r += w * g[i]; gg += w * g[i + 1]; b += w * g[i + 2];
      }
    }
    const i = (y * gw + x) * 4; o[i] = r; o[i + 1] = gg; o[i + 2] = b;
  }
  return o;
}
function haloAt(plan, h, px, py) {
  const q = plan.halo.q, [gw, gh] = haloSize(plan);
  const fx = Math.min(gw - 1, Math.max(0, (px + 0.5) / q - 0.5)), fy = Math.min(gh - 1, Math.max(0, (py + 0.5) / q - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
  const at = (x, y, c) => h[(y * gw + x) * 4 + c];
  return [0, 1, 2].map((c) => (at(x0, y0, c) * (1 - tx) + at(x1, y0, c) * tx) * (1 - ty) + (at(x0, y1, c) * (1 - tx) + at(x1, y1, c) * tx) * ty);
}

// Glass normal and the viewer's ray at a face position; returns the specular reflection.
export function glassReflection(plan, sx, sy) {
  const { rx, ry } = plan.p.curvature, D = plan.distance, sz = (sx * sx) / (2 * rx) + (sy * sy) / (2 * ry);
  let ix = sx, iy = sy, iz = sz + D;
  const il = Math.hypot(ix, iy, iz); ix /= il; iy /= il; iz /= il;
  let nx = sx / rx, ny = sy / ry, nz = -1;
  const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
  const d = ix * nx + iy * ny + iz * nz;
  const fr = fresnelAir(plan.p.glass.n, Math.acos(Math.min(1, Math.abs(d))));
  return fr * roomEnv(ix - 2 * d * nx, iy - 2 * d * ny, iz - 2 * d * nz);
}
// Reflection at an air-to-glass surface, unpolarised.
export function fresnelAir(n, theta) {
  const s = Math.sin(theta) / n, ci = Math.cos(theta), ct = Math.sqrt(1 - s * s);
  const rs = (ci - n * ct) / (ci + n * ct), rp = (ct - n * ci) / (ct + n * ci);
  return 0.5 * (rs * rs + rp * rp);
}

// A phosphor outside the output gamut (a narrow blue band in Rec.709, say) gives a
// negative component; desaturate toward its own luminance until the smallest is zero.
export const LUMA = { rec709: [0.2126, 0.7152, 0.0722], rec2020: [0.2627, 0.678, 0.0593] };
export function gamutFit(rgb, output) {
  const L = LUMA[output], Y = Math.max(0, L[0] * rgb[0] + L[1] * rgb[1] + L[2] * rgb[2]);
  const m = Math.min(rgb[0], rgb[1], rgb[2]);
  if (m >= 0) return rgb;
  const t = Y / (Y - m);
  return rgb.map((v) => Y + t * (v - Y));
}

// The compose pass: linear output RGB (1 = the tube's calibrated peak white).
export function compose(plan, em, halo) {
  const { out, screen, halo: hk } = plan, room = plan.p.room, T = plan.p.glass.transmission;
  const img = new Float32Array(out.w * out.h * 4);
  for (let py = 0; py < out.h; py++) for (let px = 0; px < out.w; px++) {
    const i = (py * out.w + px) * 4, a = em[i + 3], [sx, sy] = footprint(plan, px, py);
    const hl = haloAt(plan, halo, px, py);
    const gun = [0, 1, 2].map((c) => hk.direct * em[i + c] + hl[c]);
    const rgb = gamutFit(apply3(screen.matrix, gun), plan.p.phosphor.output);
    const black = room.ambient * T, spec = room.reflection * glassReflection(plan, sx, sy);
    for (let c = 0; c < 3; c++) img[i + c] = a * (rgb[c] + black + spec) + (1 - a) * room.bezel[c];
    img[i + 3] = 1;
  }
  return img;
}

// Display encode: exposure, a soft shoulder that keeps a masked stripe's peak from
// clipping hard, and sRGB, to 8 bits. The same function runs on the GPU.
export function shoulder(x, k = 0.8) { return x <= k ? x : k + (1 - k) * Math.tanh((x - k) / (1 - k)); }
export function encode8(img, w, h, exposure = 1) {
  const o = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < o.length; i += 4) for (let c = 0; c < 4; c++) {
    if (c === 3) { o[i + 3] = 255; continue; }
    const l = shoulder(Math.max(0, img[i + c] * exposure));
    o[i + c] = Math.round((l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055) * 255);
  }
  return o;
}
export { faceAt };
