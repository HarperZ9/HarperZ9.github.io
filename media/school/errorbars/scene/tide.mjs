// Rerun's place for the evaluation track (PROGRESS.md, step 46): the tide line at night, the prism on
// the wet sand, Rerun beside it. Shared by lessons E23 and E24. The spectrum appears only in rays
// leaving the prism, where one number becomes several.
import { rect, circle, polyline, words, darkness, pose, GUIDES, SPECTRUM, span } from "../../shared/lib.mjs";
import { night } from "../../attention/scene/room.mjs";
import { prism } from "../../attention/scene/data.mjs";

export const INK = { night: "#ece5d6", dim: "#958e80", ember: "#e29472", sand: [0.16, 0.13, 0.1, 1], paper: [0.9, 0.86, 0.75, 1] };
export const PRISM = { x: 520, y: 470, s: 1.4 };
export const RERUN = { x: 210, y: 990, s: 0.46 };
export const lab = (A, s, size, x, y, fill = INK.night, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
export const plate = (x, y, w, h, a = 0.7) => ({ shape: rect(x, y, w, h, 10), fill: [0.03, 0.03, 0.04, a], screen: true });
export const shore = () => [{ shape: rect(0, 820, 1920, 260), fill: INK.sand }, { shape: rect(0, 810, 1920, 14), fill: [0.5, 0.55, 0.6, 0.25] }];
export const beach = (t) => [...night(t, { moon: false }), ...shore()];
// Rerun knocks twice at t0 (claw swings), stalks up while reading.
export function rerun(t, { knock = -9, read = 0 } = {}) {
  const k = (t0) => Math.max(0, 1 - Math.abs(t - t0) / 0.15);
  return pose(GUIDES.rerun.parts({ clawR: -4 + 100 * Math.max(k(knock), k(knock + 0.45)), stalk: 1.2 + 0.4 * read, look: [-6 + 8 * read, -4], flare: 0.9 }), RERUN);
}
export const scene = (t, A, items, extra = {}) => ({ items: [...items, darkness(300, 900, 900, 0.3), ...rerun(t, extra)], camera: { x: 960, y: 540, zoom: 1 } });
export const thePrism = (flare = 1) => prism(PRISM.x, PRISM.y, flare, PRISM.s);

// A histogram of resample counts as beads on the sand, filled to share u, with rays from the prism
// to the newest beads. counts: per bin; X(bin) gives the bin's centre; per: resamples per bead.
export function beads(counts, X, u, { per: per0 = 10, base = 790, r = 5, rays = true, ink = INK.paper, maxH = 480 } = {}) {
  // At least per0 resamples a bead, more if the tallest column would rise above maxH.
  const per = Math.max(per0, Math.ceil((Math.max(...counts) * (2 * r + 1)) / maxH));
  const out = [], total = counts.reduce((a, b) => a + b, 0), shown = Math.floor(total * u), order = [];
  counts.forEach((c, b) => { for (let i = 0; i < c; i++) order.push(b); });
  // Spread the resamples over the bins in a fixed interleaved order, so the shape grows evenly.
  const seq = order.map((b, i) => [b, (i * 7919) % order.length]).sort((a, c) => a[1] - c[1]).map(([b]) => b);
  const h = new Array(counts.length).fill(0);
  for (let i = 0; i < shown; i++) {
    const b = seq[i]; h[b] += 1;
    if (h[b] % per !== 0) continue;
    const y = base - (h[b] / per) * (2 * r + 1), x = X(b), fresh = shown - i < 40;
    out.push({ shape: circle(x, y, r, 10), fill: ink });
    if (rays && fresh) { const c = SPECTRUM[b % SPECTRUM.length]; out.push({ shape: polyline([PRISM.x + 70, PRISM.y + 20, x, y]), fill: null, stroke: [...c, 0.35], width: 1.5, blend: "add" }); }
  }
  return out;
}
// An interval as a bracket on the sand under the beads.
export function bracket(A, X, lo, hi, text, a = 1, y = 820) {
  return [{ shape: rect(X(lo), y, X(hi) - X(lo), 6, 2), fill: [0.89, 0.58, 0.45, a], screen: true }, { shape: rect(X(lo) - 2, y - 30, 4, 36), fill: [0.89, 0.58, 0.45, a], screen: true },
    { shape: rect(X(hi) - 2, y - 30, 4, 36), fill: [0.89, 0.58, 0.45, a], screen: true }, lab(A, text, 26, (X(lo) + X(hi)) / 2, y + 50, INK.night, "center", a)];
}
export { span };
