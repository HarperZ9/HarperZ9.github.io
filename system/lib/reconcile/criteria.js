// Criteria -- each scores an artifact's features (+ its params) in 0..1 against a property the
// generator did NOT author. Cohesion is the harmonic mean: a candidate must be good on EVERY axis
// (imbalance is punished) -- CORRECT, not good-on-average. Ported from studio-engine criteria.py.
export const GOLDEN_ANGLE = 137.50776405003785;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const CRIT = {
  // objective (structural): judged on a parameter vs an unauthored constant
  golden_angle: (f, p) => { const a = p?.angle ?? GOLDEN_ANGLE; const d = Math.abs(((a - GOLDEN_ANGLE + 180) % 360) - 180); return clamp(1 - d / 15, 0, 1); },
  clean_freq: (f, p) => { const v = p?.freq ?? 6; return clamp(1 - Math.min(0.5, Math.abs(v - Math.round(v))) / 0.5, 0, 1); },
  fivefold: (f, p) => { const w = Math.round(p?.waves ?? 5); return clamp(1 - Math.abs(w - 5) * 0.2, 0, 1); },
  // subjective (aesthetic): judged on measured features of the output
  balance: (f) => clamp(1 - (f.centroid_offset ?? 1), 0, 1),
  coverage: (f) => clamp(f.coverage ?? 0, 0, 1),
  contrast: (f) => clamp(f.contrast ?? 0, 0, 1),
  complexity: (f) => clamp(1 - Math.abs((f.entropy ?? 0) - 0.8) / 0.8, 0, 1),
};

export const KIND = {
  golden_angle: "objective", clean_freq: "objective", fivefold: "objective",
  balance: "subjective", coverage: "subjective", contrast: "subjective", complexity: "subjective",
};

export function score(axis, f, p) { const fn = CRIT[axis]; return fn ? clamp(fn(f, p), 0, 1) : 0; }

export function cohesion(scores) {
  if (!scores.length) return 0;
  let s = 0; for (const x of scores) s += 1 / clamp(x, 1e-6, 1);
  return scores.length / s;
}

export function tag(s, target = 0.9, floor = 0.6) {
  return s >= target ? "verified" : s >= floor ? "unverifiable" : "refuted";
}
