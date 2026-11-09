// The electron beams and the phosphor (CPU reference of the beam pass in crt.wgsl).
//
// Each gun's current follows the tube's power law, I = max(contrast V + brightness, 0)^gamma
// (BT.1886 is a description of exactly this). The beam sweeps each line continuously;
// at every signal sample it deposits its current times its dwell, spread by a round
// gaussian spot whose width grows with the current (space charge and lens aberration),
// so bright lines swell and close the gaps between them while dark lines stay thin.
// Each deposit is integrated exactly over the output pixel's footprint (erf), so the
// light of a line is conserved however the spot size and the output resolution compare.
// The mask then decides which phosphor the light lands on, and each phosphor glows on
// with its own decay: light this frame is what decays inside this frame's window, the
// rest is carried in a history buffer to the frames after it.
import { gaussMass } from "../common.mjs";
import { footprint, maskCover, faceAlpha } from "./geometry.mjs";

export function gunCurrent(plan, v) {
  const t = plan.p.tube, x = Math.max(t.contrast * v + t.brightness, 0);
  return Math.pow(x, t.gamma);
}
export const spotSigma = (plan, I) => { const s = plan.p.spot; return plan.lineMm * (s.lo + (s.hi - s.lo) * Math.pow(Math.min(I, 1.5), s.exponent)); };

// The convergence offset of gun c at face position (sx, sy), in mm.
export function convergence(plan, c, sx, sy) {
  const cv = plan.p.convergence, k = cv.radial / (plan.faceW / 2);
  if (c === 0) return [cv.r[0] + k * sx, cv.r[1] + k * sy];
  if (c === 2) return [cv.b[0] - k * sx, cv.b[1] - k * sy];
  return [0, 0];
}

// Signal value driving component c at line j, sample k.
function drive(plan, sig, c, j, k) {
  const i = (j * plan.N + k) * 4;
  if (plan.screen.mono) return 0.299 * sig[i] + 0.587 * sig[i + 1] + 0.114 * sig[i + 2];
  return sig[i + c];
}

// Light deposited by gun c over the footprint, normalised so a full-white field is 1.
export function deposit(plan, sig, c, rx, ry, hx, hy, field) {
  const { N, lines, lineMm, rasterW, rasterH } = plan, dx = rasterW / N;
  const smax = spotSigma(plan, 1.5), reachY = 3 * smax + hy, reachX = 3 * smax + hx;
  const yl = (ry + rasterH / 2) / lineMm - 0.5;
  const j0 = Math.max(0, Math.floor(yl - reachY / lineMm)), j1 = Math.min(lines - 1, Math.ceil(yl + reachY / lineMm));
  const kc = (rx + rasterW / 2) / dx - 0.5;
  const k0 = Math.max(0, Math.floor(kc - reachX / dx)), k1 = Math.min(N - 1, Math.ceil(kc + reachX / dx));
  let e = 0;
  for (let j = j0; j <= j1; j++) {
    if (plan.p.interlace && (j & 1) !== (field & 1)) continue;
    const yj = -rasterH / 2 + (j + 0.5) * lineMm;
    for (let k = k0; k <= k1; k++) {
      const I = gunCurrent(plan, drive(plan, sig, c, j, k));
      if (I <= 0) continue;
      const s = spotSigma(plan, I), xk = -rasterW / 2 + (k + 0.5) * dx;
      e += I * gaussMass(rx - hx, rx + hx, xk, s) * gaussMass(ry - hy, ry + hy, yj, s);
    }
  }
  return (e * dx * lineMm) / (4 * hx * hy);
}

// The beam pass for one frame. sig: the decoded signal (lines x N x 4). hist: the
// persistence state (out.w x out.h x 8, two decay terms of three components), updated
// in place. Returns emission (out.w x out.h x 4): light per component, and face alpha in w.
export function beamPass(plan, sig, hist, field) {
  const { out } = plan, em = new Float32Array(out.w * out.h * 4), T = plan.field;
  for (let py = 0; py < out.h; py++) for (let px = 0; px < out.w; px++) {
    const [sx, sy, hx, hy] = footprint(plan, px, py), i = (py * out.w + px) * 4, h = (py * out.w + px) * 8;
    const alpha = faceAlpha(plan, sx, sy, hx, hy);
    em[i + 3] = alpha;
    const cover = maskCover(plan, sx, sy, hx, hy);
    const t0 = Math.min(1, Math.max(0, (sy + plan.rasterH / 2) / plan.rasterH)) * T;
    const lit = alpha > 0 && Math.abs(sx) < plan.rasterW / 2 + 3 * hx && Math.abs(sy) < plan.rasterH / 2 + 3 * hy;
    const mono = plan.screen.mono && lit ? deposit(plan, sig, 0, sx, sy, hx, hy, field) : 0;
    for (let c = 0; c < 3; c++) {
      let E = 0;
      if (lit && plan.screen.mono) E = mono * cover[c];
      else if (lit) {
        const [ox, oy] = convergence(plan, c, sx, sy);
        E = deposit(plan, sig, c, sx - ox, sy - oy, hx, hy, field) * cover[c];
      }
      const [w, e1, e2, t1, t2] = plan.decay[c];
      const n1 = Math.exp(-(T - t0) / t1), n2 = Math.exp(-(T - t0) / t2);
      const R1 = hist[h + c], R2 = hist[h + 4 + c];
      em[i + c] = R1 * (1 - e1) + R2 * (1 - e2) + E * (w * (1 - n1) + (1 - w) * (1 - n2));
      hist[h + c] = R1 * e1 + E * w * n1; hist[h + 4 + c] = R2 * e2 + E * (1 - w) * n2;
    }
  }
  return em;
}
