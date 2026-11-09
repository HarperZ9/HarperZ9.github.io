// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// substrate/motion: one motion vocabulary for DOM, canvas and offline film, and an auditor that
// scores CSS against the house rules. Same token, same curve, in every renderer.
//
// The idea of scoring motion and gating on it comes from studying transitions.dev; nothing of its
// code or catalogue is used. The rules are ours: motion serves orientation and never holds
// attention, every animation has a reduced-motion path, and UI motion stays short. Easing and
// spring maths are written from first principles (cubic Bezier solved by Newton with bisection
// fallback; a damped harmonic oscillator in closed form).

// Easing tokens as cubic-bezier control points (x1, y1, x2, y2).
export const EASE = Object.freeze({
  linear: [0, 0, 1, 1],
  standard: [0.2, 0, 0, 1],     // most UI movement: quick start, long settle
  enter: [0, 0, 0.2, 1],        // things arriving: decelerate only
  exit: [0.4, 0, 1, 1],         // things leaving: accelerate only
  film: [0.65, 0, 0.35, 1],     // symmetric, for scene moves in films and lessons
});

// Durations in milliseconds. UI motion should sit at or under `ceiling`.
export const DURATION = Object.freeze({ instant: 0, quick: 120, base: 200, slow: 320, scene: 900, ceiling: 500 });

export function cssEase(name) {
  const p = EASE[name];
  if (!p) throw new RangeError("motion: unknown easing token: " + name);
  return `cubic-bezier(${p.join(", ")})`;
}

// A cubic Bezier easing as a function of progress 0..1.
export function bezier(x1, y1, x2, y2) {
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) throw new RangeError("motion: bezier x values must be in 0..1");
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = X(t) - x, d = dX(t);
      if (Math.abs(err) < 1e-7) return Y(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = X(t);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return Y(t);
  };
}

export const ease = (name) => bezier(...(EASE[name] || EASE.standard));

// A spring from 0 to 1 at rest. Returns position(t seconds) and the settle time, the first time
// after which the spring stays within `rest` of 1.
export function spring({ stiffness = 170, damping = 26, mass = 1, rest = 0.001 } = {}) {
  if (!(stiffness > 0 && mass > 0 && damping >= 0)) throw new RangeError("motion: spring needs stiffness > 0, mass > 0, damping >= 0");
  const w0 = Math.sqrt(stiffness / mass), zeta = damping / (2 * Math.sqrt(stiffness * mass));
  let x;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    x = (t) => 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  } else if (zeta === 1) {
    x = (t) => 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  } else {
    const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1)), r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
    const c2 = r1 / (r2 - r1), c1 = -1 - c2;
    x = (t) => 1 + c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  }
  const dt = 1 / 600;
  let settle = 0;
  for (let t = 0; t < 10; t += dt) if (Math.abs(x(t) - 1) > rest) settle = t + dt;
  return { position: x, settle: Math.min(settle, 10), zeta };
}

// A spring as a CSS linear() easing plus its duration, so CSS and canvas share one curve.
export function springCss(opts = {}, samples = 32) {
  const s = spring(opts);
  const pts = [];
  for (let i = 0; i <= samples; i++) pts.push(+s.position((s.settle * i) / samples).toFixed(4));
  pts[samples] = 1;
  return { easing: `linear(${pts.join(", ")})`, durationMs: Math.round(s.settle * 1000) };
}

// Back-out: overshoots past 1 by an amount set by `s`, then settles. s = 0 is a cubic ease-out.
export const backOut = (s = 1.70158) => (t) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};

// The `s` whose back-out peaks at 1 + overshoot (for example 0.02 for a 2% overshoot).
export function backOutFor(overshoot) {
  if (!(overshoot >= 0 && overshoot < 1)) throw new RangeError("motion: overshoot must be in 0..1");
  // The peak is where the derivative vanishes: u = t - 1 = -2s / (3(s + 1)).
  const peak = (s) => { const u = (-2 * s) / (3 * (s + 1)); return (s + 1) * u * u * u + s * u * u; };
  let lo = 0, hi = 10;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (peak(mid) < overshoot) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// Exponential ease-out, normalised to reach exactly 1 at t = 1. Larger k is a sharper attack.
export const expoOut = (k = 6) => (t) => (t <= 0 ? 0 : t >= 1 ? 1 : (1 - Math.exp(-k * t)) / (1 - Math.exp(-k)));

// A timing curve from measured (seconds, progress) samples: monotone in time, linear between
// samples. Returns the function of seconds, a CSS linear() easing with stops, and the duration.
export function curveFromSamples(samples) {
  const pts = samples.map(([t, v]) => [Number(t), Number(v)]);
  if (pts.length < 2 || pts[0][0] !== 0) throw new RangeError("motion: samples need at least two points, starting at t = 0");
  for (let i = 1; i < pts.length; i++) if (!(pts[i][0] > pts[i - 1][0])) throw new RangeError("motion: sample times must increase");
  const T = pts.at(-1)[0];
  const fn = (t) => {
    if (t <= 0) return pts[0][1];
    if (t >= T) return pts.at(-1)[1];
    let i = 1;
    while (pts[i][0] < t) i++;
    const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
    return v0 + ((t - t0) / (t1 - t0)) * (v1 - v0);
  };
  const stops = pts.map(([t, v]) => `${+v.toFixed(4)} ${+((t / T) * 100).toFixed(2)}%`);
  return { fn, easing: `linear(${stops.join(", ")})`, durationMs: Math.round(T * 1000) };
}

// Timing measured from reference clips (feed-test-20 CLAIMS.md, frame-flow measurements by
// another session). The first and last points are as measured; points marked in comments are
// inferred to close the curve. Use them as targets for feel, not as anyone's design tokens.
export const MEASURED = Object.freeze({
  // glyph-cell build: 10/50/90% at 0.53/1.13/1.40 s, peak 1.018 at 1.5 s; settle at 1.8 s inferred
  glyphCascade: Object.freeze([[0, 0], [0.53, 0.1], [1.13, 0.5], [1.4, 0.9], [1.5, 1.018], [1.8, 1]]),
  // engraving reveal: 10/50/90% at 0.25/0.38/0.62 s, complete by 0.9 s; the start at 0.15 s is inferred
  engravingReveal: Object.freeze([[0, 0], [0.15, 0], [0.25, 0.1], [0.38, 0.5], [0.62, 0.9], [0.9, 1]]),
  groupDelaySeconds: 0.5,     // two glyph groups, 0.5 s apart
  whipDecaySeconds: 0.75,     // whip transitions: attack under 0.25 s, decay about 0.75 s
});

// Start times for a staggered build: items sorted by rank, `stagger` seconds apart, plus a
// per-item group delay. Ties in rank start together.
export function cascade(ranks, { stagger = 0.02, groupOf = () => 0, groupDelay = MEASURED.groupDelaySeconds } = {}) {
  const order = [...new Set(ranks)].sort((a, b) => a - b);
  const slot = new Map(order.map((r, i) => [r, i]));
  return ranks.map((r, i) => slot.get(r) * stagger + groupOf(i) * groupDelay);
}

// The token sheet as CSS custom properties. Under reduced motion every duration becomes 0ms.
export function tokensCss(scope = ":root") {
  const e = Object.keys(EASE).map((k) => `--ease-${k}:${cssEase(k)};`).join("");
  const d = Object.entries(DURATION).filter(([k]) => k !== "ceiling").map(([k, v]) => `--dur-${k}:${v}ms;`).join("");
  const z = Object.keys(DURATION).filter((k) => k !== "ceiling").map((k) => `--dur-${k}:0ms;`).join("");
  return `${scope}{${e}${d}}@media (prefers-reduced-motion: reduce){${scope}{${z}}}`;
}

// ---------------------------------------------------------------- audit

const LAYOUT_PROPS = ["width", "height", "top", "left", "right", "bottom", "margin", "padding", "font-size"];
const PENALTY = { high: 30, elevated: 15, moderate: 8, low: 0 };

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}
const lineOf = (css, index) => css.slice(0, index).split("\n").length;
const toMs = (num, unit) => (unit === "s" ? parseFloat(num) * 1000 : parseFloat(num));

// Score CSS motion out of 100 and list findings. scope "ui" (default) applies every rule;
// scope "art" records findings for duration, loops and layout but scores only accessibility,
// because generative art may loop by design while a vestibular trigger is never acceptable.
export function auditMotion(cssText, { scope = "ui", ceiling = DURATION.ceiling } = {}) {
  const css = stripComments(String(cssText));
  const findings = [];
  const add = (rule, level, index, text, fix) => findings.push({ rule, level, line: lineOf(css, index), text: text.trim().slice(0, 120), fix });
  const decl = /(^|[;{\s])(transition|transition-property|transition-duration|animation|animation-duration|animation-iteration-count)\s*:\s*([^;}]*)/g;
  let animates = false, m;
  while ((m = decl.exec(css))) {
    const prop = m[2], value = m[3], at = m.index + m[1].length;
    if (/^(none|0s|0ms)$/i.test(value.trim())) continue;
    animates = true;
    if (/\binfinite\b/i.test(value)) add("M2-infinite-loop", "elevated", at, `${prop}: ${value}`, "Run a fixed number of times, or stop when the content is understood.");
    if (/^transition(-property)?$/.test(prop) && /(^|[\s,])all\b/i.test(value)) add("M4-transition-all", "moderate", at, `${prop}: ${value}`, "Name the properties that move.");
    for (const d of value.matchAll(/(\d*\.?\d+)(ms|s)\b/g)) {
      if (toMs(d[1], d[2]) > ceiling) { add("M3-long-duration", "moderate", at, `${prop}: ${value}`, `Keep UI motion at or under ${ceiling}ms.`); break; }
    }
    if (/^transition(-property)?$/.test(prop)) {
      const hit = LAYOUT_PROPS.find((p) => new RegExp(`(^|[\\s,])${p}\\b`).test(value));
      if (hit) add("M5-layout-property", "moderate", at, `${prop}: ${value}`, "Move with transform and opacity, not layout properties.");
    }
  }
  for (const k of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    animates = true;
    let depth = 1, i = k.index + k[0].length;
    while (i < css.length && depth) { if (css[i] === "{") depth++; else if (css[i] === "}") depth--; i++; }
    const body = css.slice(k.index + k[0].length, i);
    const hit = LAYOUT_PROPS.find((p) => new RegExp(`(^|[;{\\s])${p}\\s*:`).test(body));
    if (hit) add("M5-layout-property", "moderate", k.index, `@keyframes ${k[1]} animates ${hit}`, "Move with transform and opacity, not layout properties.");
  }
  if (animates && !/prefers-reduced-motion/i.test(css)) {
    add("M1-no-reduced-motion", "high", 0, "Motion found and no prefers-reduced-motion rule", "Add @media (prefers-reduced-motion: reduce) that removes or shortens the motion.");
  }
  const counted = scope === "art" ? findings.filter((f) => f.rule === "M1-no-reduced-motion") : findings;
  const score = Math.max(0, 100 - counted.reduce((s, f) => s + PENALTY[f.level], 0));
  return { score, scope, animates, findings: findings.sort((a, b) => a.line - b.line) };
}
