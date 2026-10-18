// The lens plan: every constant table the CPU reference and the GPU pass share, resolved once
// from the parameters and the output size. Pure f64 arithmetic; the GPU reads f32 copies.
import { BINS, BIN_NM, BIN_RGB, GLASS, cauchy, LAMBDA_D } from "./spectrum.mjs";
import { filmReflectance } from "./coating.mjs";
import { shapeArea, starburstTable } from "./aperture.mjs";
import { ghostTable, LENS } from "./prescription.mjs";
import { DEFAULT_LENS } from "./params.mjs";

let ghostCache = null; const starCache = new Map();
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export { lum };

export function resolveLens(params = {}, size) {
  const p = { ...DEFAULT_LENS, ...params, coating: { ...DEFAULT_LENS.coating, ...(params.coating || {}) }, iris: { ...DEFAULT_LENS.iris, ...(params.iris || {}) } };
  const W = size.width, H = size.height, D = Math.hypot(W, H) / 2, cx = W / 2, cy = H / 2, k = H / p.refHeight;
  // Lengths given in px are px at refHeight lines; they scale with the frame.
  for (const n of ["streakLenPx", "streakThickPx", "starCellPxPerStop", "haloRadiusPx", "minGhostPx"]) p[n] *= k;
  p.streakThickPx = Math.max(0.7, p.streakThickPx); // a thinner gaussian aliases on the pixel grid
  const gt = (ghostCache ||= ghostTable(LENS)), tanHalf = p.sensorHalfDiagMm / gt.f;
  const pxPerRho = D / (2 * p.fNumber * tanHalf), area1 = shapeArea(p.iris);
  // Ghosts: per pair and bin, [m, radius px, rotation, 1 / area].
  const ghosts = gt.ghosts.map((g) => Array.from({ length: BINS }, (_, l) => {
    const r = Math.max(p.minGhostPx, Math.abs(g.rho[l]) * pxPerRho);
    return [g.m[l], r, p.iris.rotation + (g.rho[l] < 0 ? Math.PI : 0), p.squeeze / (area1 * r * r)];
  }));
  const R0 = BIN_NM.map((nm) => filmReflectance(nm, 0, p.coating)), Rbar = R0.reduce((a, b) => a + b, 0) / BINS;
  // Halation: red reaches the film base and back; depth rises through the red end.
  const depth = BIN_NM.map((nm) => 1 / (1 + Math.exp(-(nm - 600) / 25)));
  const halo = depth.map((d) => [p.haloGain * d, p.haloRadiusPx * (0.5 + d)]);
  const nd = cauchy(GLASS.crown, LAMBDA_D), caScale = BIN_NM.map((nm) => 1 + (p.caAmount * (cauchy(GLASS.crown, nm) - nd)) / (nd - 1));
  const key = JSON.stringify(p.iris); if (!starCache.has(key)) starCache.set(key, starburstTable({ iris: p.iris }));
  const star = starCache.get(key), starCell = p.starCellPxPerStop * p.fNumber;
  // Fraction of over-threshold light each channel hands to the lens terms (normal incidence).
  const phi = [0, 1, 2].map((k) => {
    let s = p.starGain;
    for (let l = 0; l < BINS; l++) {
      const w = BIN_RGB[l][k];
      s += w * (gt.ghosts.length * p.ghostGain * R0[l] * R0[l] + (p.streakGain * R0[l]) / Rbar + halo[l][0]);
    }
    return s;
  });
  return { p, W, H, D, cx, cy, tanHalf, ghosts, R0, Rbar, halo, caScale, star, starCell, phi, binRgb: BIN_RGB };
}

// Per-source factors that depend on the source's field angle (the coating sees light at that
// angle): ghost factor ghostGain R^2 and streak factor streakGain R / Rbar, per bin.
export function prepareSources(plan, list) {
  const { p } = plan;
  return list.slice(0, p.maxSources).map((s) => {
    const theta = Math.atan((Math.hypot(s.x - plan.cx, s.y - plan.cy) / plan.D) * plan.tanHalf);
    const R = BIN_NM.map((nm) => filmReflectance(nm, theta, p.coating));
    return { x: s.x, y: s.y, E: s.E, theta, ghost: R.map((r) => p.ghostGain * r * r), streak: R.map((r) => (p.streakGain * r) / plan.Rbar) };
  });
}

// Over-threshold light of one pixel: the part of its colour above the threshold, hue kept.
export function overOf(r, g, b, thr) {
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (!(Y > thr)) return 0;
  return (Y - thr) / Y;
}

// Sources from an HDR frame: per tile the over-threshold energy and its luminance-weighted
// centroid; the brightest maxSources tiles are kept. keep[t] = 1 marks a kept tile (only kept
// tiles lose light to the lens terms, so energy is redistributed and not created or lost).
export function extractSources(plan, frame) {
  const { p, W, H } = plan, T = p.tile, tw = Math.ceil(W / T), th = Math.ceil(H / T), tiles = [];
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const E = [0, 0, 0]; let sw = 0, sx = 0, sy = 0;
    for (let y = ty * T; y < Math.min(H, ty * T + T); y++) for (let x = tx * T; x < Math.min(W, tx * T + T); x++) {
      const i = (y * W + x) * 4, d = frame.data, f = overOf(d[i], d[i + 1], d[i + 2], p.threshold);
      if (f <= 0) continue;
      const e = [d[i] * f, d[i + 1] * f, d[i + 2] * f], y0 = lum(e);
      E[0] += e[0]; E[1] += e[1]; E[2] += e[2]; sw += y0; sx += (x + 0.5) * y0; sy += (y + 0.5) * y0;
    }
    if (sw > 0) tiles.push({ t: ty * tw + tx, x: sx / sw, y: sy / sw, E, Y: sw });
  }
  tiles.sort((a, b) => b.Y - a.Y || a.t - b.t);
  const kept = tiles.slice(0, p.maxSources), keep = new Uint8Array(tw * th);
  for (const k of kept) keep[k.t] = 1;
  return { list: kept.map(({ x, y, E }) => ({ x, y, E })), keep, tw, th };
}
