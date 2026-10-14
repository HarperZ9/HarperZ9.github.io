// Time for Motion scenes. A scene is a pure function of time and parameters,
// frame(t, params) -> display list, so playing, scrubbing, a dragged parameter
// and an offline render at a fixed frame rate all give the same picture for the
// same inputs. This module is the vocabulary for writing that function: easing,
// spans between cues, keyframe tracks and springs. Pure; runs in Node.
//
//   const tl = timeline({ intro: 0, reveal: 4.5, out: 9 });
//   const u = tl.span(t, "intro", "reveal", ease.inOut);    // 0..1 between two cues
//   const x = track([[0, 100], [2, 400, ease.out], [5, 400], [6, 900, ease.inOut]])(t);

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, u) => a + (b - a) * u;
export const mix = lerp;
// Interpolate in log space: for zooms and quantities across orders of magnitude.
export const lerpLog = (a, b, u) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * u);

export const ease = Object.freeze({
  linear: (u) => clamp01(u),
  in: (u) => { u = clamp01(u); return u * u * u; },
  out: (u) => { u = 1 - clamp01(u); return 1 - u * u * u; },
  inOut: (u) => { u = clamp01(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; },
  smooth: (u) => { u = clamp01(u); return u * u * u * (u * (u * 6 - 15) + 10); },
  expoOut: (u) => { u = clamp01(u); return u === 1 ? 1 : 1 - Math.pow(2, -10 * u); },
  expoInOut: (u) => { u = clamp01(u); if (u === 0 || u === 1) return u; return u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2; },
  backOut: (u) => { u = clamp01(u); const c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },
  // A critically damped spring settling from 0 to 1 over the span.
  spring: (u) => { u = clamp01(u); const w = 9; return 1 - (1 + w * u) * Math.exp(-w * u); },
});

// Progress 0..1 of t through [a, b], eased.
export function span(t, a, b, e = ease.inOut) {
  if (b <= a) return t >= b ? 1 : 0;
  return e((t - a) / (b - a));
}
// Rise over [a, a + up], hold, fall over [b - down, b]: a fade window.
export function window(t, a, b, up = 0.6, down = 0.6, e = ease.inOut) {
  return Math.min(span(t, a, a + up, e), 1 - span(t, b - down, b, e));
}
// Stagger: item i of n starts at a fraction of the span; each move takes `each` of it.
export function stagger(t, a, b, i, n, each = 0.4, e = ease.out) {
  const len = b - a, start = a + (n > 1 ? (i / (n - 1)) * (1 - each) * len : 0);
  return span(t, start, start + each * len, e);
}

// A keyframe track: [[time, value, easeInto?], ...]; values are numbers or
// arrays of numbers. Before the first key it holds the first value, after the
// last it holds the last.
export function track(keys) {
  const ks = [...keys].sort((x, y) => x[0] - y[0]);
  return (t) => {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) {
        const [t0, v0] = ks[i - 1], [t1, v1, e = ease.inOut] = ks[i];
        const u = e((t - t0) / Math.max(1e-9, t1 - t0));
        return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], u)) : lerp(v0, v1, u);
      }
    }
    return ks[ks.length - 1][1];
  };
}

// Named cue times. tl.at("name") gives the time; tl.span and tl.window take names or numbers.
export function timeline(cues = {}) {
  const at = (c) => (typeof c === "number" ? c : (c in cues ? cues[c] : NaN));
  const check = (c) => { const v = at(c); if (Number.isNaN(v)) throw new Error("timeline: no cue " + c); return v; };
  return {
    cues, at: check,
    span: (t, a, b, e) => span(t, check(a), check(b), e),
    window: (t, a, b, up, down, e) => window(t, check(a), check(b), up, down, e),
    since: (t, c) => t - check(c),
    stagger: (t, a, b, i, n, each, e) => stagger(t, check(a), check(b), i, n, each, e),
  };
}

// Cues from narration timing rows ({ segment, line, sentence, start, end }),
// named "s<segment>.l<line>.<sentence>" for the start and ".end" for the end.
export function narrationCues(rows) {
  const out = {};
  for (const r of rows) {
    const k = `s${r.segment}.l${r.line}.${r.sentence ?? 0}`;
    out[k] = r.start; out[k + ".end"] = r.end;
  }
  return out;
}

// A small seeded generator (mulberry32) so scenes can scatter things repeatably.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A count that animates through orders of magnitude: shows n(t) rounded.
export function countUp(t, a, b, from, to, e = ease.inOut, log = true) {
  const u = span(t, a, b, e);
  if (u >= 1) return to;
  return Math.round(log && from > 0 ? lerpLog(from, to, u) : lerp(from, to, u));
}
