// chart-describe-sound.mjs: what a sound chart's data does, from the data: spectra and spectrograms. Built on
// chart-describe.mjs, whose describeCurve gives the shape words, so a spectrum and a curve read the same way.
//   describeSpectrum(levels, freqOf) where a spectrum is loudest, where half its energy lies, its shape by octave group
//   column(m, binHz), describeColumns(cols, o), describeSpectrogram(frames, o)
//                                    how loudness moves over time and where the loudest frequency goes
import { describeCurve, sig } from "./chart-describe.mjs";

const fmtOf = (o) => (o && o.fmt) || sig;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const secs = { fmt: (s) => `${Number(s.toFixed(1))} s` };

// Hertz in words: whole hertz below 1 kHz, kilohertz to three figures above.
export const hz = (v) => (v >= 1000 ? `${Number((v / 1000).toPrecision(3))} kHz` : `${Math.round(v)} Hz`);

// A spectrum: levels[i] at frequency freqOf(i). Linear levels (0..1) by default; opts.db for decibels. Says where
// it is loudest, the frequency with half the energy below it, and the shape across up to 8 log-spaced groups.
export function describeSpectrum(levels, freqOf, opts = {}) {
  const fy = fmtOf(opts.y), name = cap(opts.name || "the spectrum"), quiet = opts.quiet ?? (opts.db ? -80 : 0.02);
  const P = Array.from(levels, (v, i) => [freqOf(i), Number(v)]).filter(([f, v]) => f > 0 && Number.isFinite(v));
  const top = P.reduce((m, p) => (p[1] > m[1] ? p : m), [0, -Infinity]);
  if (!P.length || top[1] <= quiet) return { text: `${name} is flat near silence: its highest band is ${P.length ? fy(top[1]) : "absent"}, under ${fy(quiet)}.`, facts: { kind: "spectrum", trend: "flat", dirs: [], silent: true } };
  const pow = P.map(([, v]) => (opts.db ? 10 ** (v / 10) : v * v)), total = pow.reduce((a, b) => a + b, 0);
  let acc = 0, k = 0; while (k < P.length - 1 && (acc += pow[k]) < total / 2) k++;
  const l0 = Math.log2(P[0][0]), l1 = Math.log2(P[P.length - 1][0]), G = Math.min(8, P.length), groups = Array.from({ length: G }, () => [0, 0, 0]);
  for (const [f, v] of P) { const g = Math.min(G - 1, Math.floor(((Math.log2(f) - l0) / (l1 - l0 || 1)) * G)); groups[g][0] += v; groups[g][1]++; groups[g][2] += Math.log2(f); }
  // each group sits at the mean log frequency of its own bands, so a group of one band is said at that band
  const pts = groups.filter(([, n]) => n).map(([s, n, lf]) => [lf / n, s / n]);
  const shape = describeCurve(pts, { name: "Across frequency the level", x: { fmt: (x) => hz(2 ** x) }, y: opts.y });
  const text = `${name} is loudest at ${hz(top[0])}, ${fy(top[1])}; half its energy lies below ${hz(P[k][0])}. ${shape.text}`;
  return { text, facts: { ...shape.facts, kind: "spectrum", peakHz: top[0], peak: top[1], medianHz: P[k][0] } };
}

// A spectrogram, read one column at a time: column(m, binHz, fMin, fMax) is the summary of one frame (total level
// in dB, the loudest bin's level and frequency); describeColumns(cols, opts) says how loudness moves over time and
// where the loudest frequency goes. opts.x formats time (seconds from the start by default; a live view passes its
// own "s ago" form). describeSpectrogram(frames, o) is both over a whole signal, from at most 200 columns.
export function column(m, binHz, fMin = 0, fMax = Infinity) {
  const b0 = Math.max(1, Math.ceil(fMin / binHz)), b1 = Math.min(m.length - 1, Math.floor(fMax / binHz));
  let s = 0, best = -Infinity, bi = b0;
  for (let b = b0; b <= b1; b++) { s += 10 ** (m[b] / 10); if (m[b] > best) { best = m[b]; bi = b; } }
  return { db: 10 * Math.log10(s + 1e-12), best, peakHz: bi * binHz };
}

export function describeColumns(cols, { stepS, x = secs, quiet = -80, t0 = 0 } = {}) {
  const db = { fmt: (v) => `${sig(v)} dB` }, at = (i) => t0 + i * stepS;
  const loud = cols.map((c, i) => [at(i), c.db]), peak = cols.flatMap((c, i) => (c.best > quiet ? [[at(i), c.peakHz]] : []));
  if (!peak.length) {
    const top = cols.reduce((m, c) => Math.max(m, c.best), -Infinity);
    return { text: `The spectrogram is flat near silence over ${secs.fmt(cols.length * stepS)}: its highest level is ${Number.isFinite(top) ? db.fmt(top) : "absent"}, under ${db.fmt(quiet)}.`, facts: { kind: "spectrogram", trend: "flat", dirs: [], silent: true } };
  }
  const L = describeCurve(loud, { name: "loudness", x, y: db }), F = describeCurve(peak, { name: "the loudest frequency", x, y: { fmt: hz } });
  return { text: `${L.text} ${F.text}`, facts: { kind: "spectrogram", trend: L.facts.trend, dirs: [...(L.facts.dirs || []), ...(F.facts.dirs || [])], loudness: L.facts, peak: F.facts } };
}

export function describeSpectrogram(frames, { binHz, hopS, fMin = 0, fMax = Infinity, quiet = -80 } = {}) {
  const step = Math.max(1, Math.ceil(frames.length / 200)), cols = [];
  for (let t = 0; t < frames.length; t += step) cols.push(column(frames[t], binHz, fMin, fMax));
  return describeColumns(cols, { stepS: hopS * step, quiet });
}
