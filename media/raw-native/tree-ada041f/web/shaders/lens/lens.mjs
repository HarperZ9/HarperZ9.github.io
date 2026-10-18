// The lens suite, CPU reference (float64). One HDR frame in, one out.
//   const plan = resolveLens(params, { width, height });
//   const src = extractSources(plan, frame);             // or a list from the scene (RT mode)
//   const out = runLens(plan, frame, prepareSources(plan, src.list), src.keep);
// Two passes, mirrored by the GPU:
//   core: each pixel of a kept tile gives up phi (per channel) of its over-threshold light;
//   gather: lateral dispersion resamples the core per wavelength bin, then every source adds its
//     ghosts, anamorphic streak, starburst and halation. With keep = null nothing is removed
//     (a source list from the scene adds light on top, as a sprite pass would).
import { BINS } from "./spectrum.mjs";
import { overOf } from "./plan.mjs";
export { resolveLens, prepareSources, extractSources } from "./plan.mjs";

export function coreOf(plan, frame, keep) {
  const { W, H, p, phi } = plan, out = new Float64Array(W * H * 4), d = frame.data, tw = Math.ceil(W / p.tile);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, k = keep && keep[Math.floor(y / p.tile) * tw + Math.floor(x / p.tile)] ? overOf(d[i], d[i + 1], d[i + 2], p.threshold) : 0;
    for (let c = 0; c < 3; c++) out[i + c] = d[i + c] * (1 - phi[c] * k);
    out[i + 3] = 1;
  }
  return out;
}
// Bilinear sample of channel c at continuous pixel position (px, py), clamped to the edge.
function sample(core, W, H, px, py, c) {
  const x = Math.min(W - 1, Math.max(0, px - 0.5)), y = Math.min(H - 1, Math.max(0, py - 0.5));
  const x0 = Math.min(W - 2, Math.floor(x)), y0 = Math.min(H - 2, Math.floor(y)), fx = x - x0, fy = y - y0, i = (y0 * W + x0) * 4 + c;
  return (core[i] * (1 - fx) + core[i + 4] * fx) * (1 - fy) + (core[i + W * 4] * (1 - fx) + core[i + W * 4 + 4] * fx) * fy;
}
export function edgeRot(phi, N, round, rot) {
  const seg = (2 * Math.PI) / N; let a = (phi - rot) % seg; if (a < 0) a += seg;
  const poly = Math.cos(Math.PI / N) / Math.cos(a - Math.PI / N);
  return poly + (1 - poly) * round;
}
function starAt(st, u, v, k) {
  const M = st.M; if (u < 0 || v < 0 || u > M - 1 || v > M - 1) return 0;
  const x0 = Math.min(M - 2, Math.floor(u)), y0 = Math.min(M - 2, Math.floor(v)), fx = u - x0, fy = v - y0, i = (y0 * M + x0) * 3 + k, d = st.data;
  return (d[i] * (1 - fx) + d[i + 3] * fx) * (1 - fy) + (d[i + M * 3] * (1 - fx) + d[i + M * 3 + 3] * fx) * fy;
}

// One output pixel (x, y integer): RGB as a 3-array.
export function shadePixel(plan, core, srcs, x, y) {
  const { W, H, p, cx, cy, binRgb, caScale, ghosts, halo, star, starCell } = plan, qx = x + 0.5, qy = y + 0.5, o = [0, 0, 0];
  for (let l = 0; l < BINS; l++) {
    const s = caScale[l], sx = cx + (qx - cx) / s, sy = cy + (qy - cy) / s;
    for (let c = 0; c < 3; c++) o[c] += binRgb[l][c] * sample(core, W, H, sx, sy, c);
  }
  const N = p.iris.blades, rnd = p.iris.roundness, hM = (star.M - 1) / 2, ca = Math.cos(p.streakAngle), sa = Math.sin(p.streakAngle);
  const L = p.streakLenPx, sg = p.streakThickPx, sInv = 1 / (starCell * starCell);
  for (const s of srcs) {
    const dx = qx - s.x, dy = qy - s.y, E = s.E;
    // starburst
    for (let c = 0; c < 3; c++) o[c] += E[c] * p.starGain * starAt(star, dx / starCell + hM, dy / starCell + hM, c) * sInv;
    // anamorphic streak: exponential along the axis, gaussian across
    const a = ca * dx + sa * dy, b = -sa * dx + ca * dy, k = (Math.exp(-Math.abs(a) / L) / (2 * L)) * (Math.exp((-b * b) / (2 * sg * sg)) / (sg * 2.5066282746310002));
    const r = Math.hypot(dx, dy);
    for (let l = 0; l < BINS; l++) {
      const hk = (halo[l][0] * Math.exp(-r / halo[l][1])) / (6.283185307179586 * halo[l][1] * halo[l][1]);
      const f = s.streak[l] * k + hk;
      for (let c = 0; c < 3; c++) o[c] += E[c] * binRgb[l][c] * f;
    }
    // ghosts
    for (const g of ghosts) for (let l = 0; l < BINS; l++) {
      const [m, rad, rot, inv] = g[l], gx = cx + m * (s.x - cx), gy = cy + m * (s.y - cy);
      const vx = (qx - gx) * p.squeeze, vy = qy - gy, rr = Math.hypot(vx, vy);
      if (rr > rad + 1) continue;
      const cov = Math.min(1, Math.max(0, rad * edgeRot(Math.atan2(vy, vx), N, rnd, rot) - rr + 0.5));
      if (cov <= 0) continue;
      const f = s.ghost[l] * cov * inv;
      for (let c = 0; c < 3; c++) o[c] += E[c] * binRgb[l][c] * f;
    }
  }
  return o;
}

// The whole frame: { width, height, data: Float64Array RGBA }.
export function runLens(plan, frame, srcs, keep = null, rows = null) {
  const { W, H } = plan, core = coreOf(plan, frame, keep), out = new Float64Array(W * H * 4);
  const [y0, y1] = rows || [0, H];
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const o = shadePixel(plan, core, srcs, x, y), i = (y * W + x) * 4;
    out[i] = o[0]; out[i + 1] = o[1]; out[i + 2] = o[2]; out[i + 3] = 1;
  }
  return { width: W, height: H, data: out };
}
