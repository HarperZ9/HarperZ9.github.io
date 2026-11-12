// pluck.js: what a plucked or struck note does in its first few hundred milliseconds, which a table of steady harmonic
// levels cannot hold. Three measures, each on one note with a little silence before it:
//   settle       the pitch just after the pluck against the pitch it settles to, in cents, and how fast it settles. A
//                string pulled sideways is stretched, so it starts sharp and falls back as the swing dies. Read from the
//                instantaneous frequency of harmonics 3 to 8 (the phase advance of each harmonic between two windows a
//                few samples apart), so the reading does not wait for a whole period of a low fundamental
//   excess       the finger or hammer itself: in seven octave bands from 100 Hz to 12.8 kHz, the power in the first
//                30 ms above what the band's decay from 35 to 100 ms predicts when it is drawn back to the onset (a
//                short reach, so the fast early decay of the harmonics is not counted as thump), in dB against
//                the whole note's power 60 to 100 ms in. A soft, wide-band thump shows as excess in every band
//   twoStage     how fast each harmonic dies in the first 150 ms against how fast it dies later, in dB per second. A
//                plucked string loses its upper harmonics quickly at first while the fundamental rings on
// Pure functions over PCM. Times are from the onset (the first 4 ms frame at 10 percent of the note's peak).
import { fft } from '../../world/sound/sound/dsp.js';
import { hann, decimate } from './spectrum.js';

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
export function onsetOf(x, sr) {
  const F = Math.round(0.004 * sr); let pk = 0; const env = []; for (let s = 0; s + F <= x.length; s += F) { let e = 0; for (let i = s; i < s + F; i++) e += x[i] * x[i]; env.push(Math.sqrt(e / F)); pk = Math.max(pk, env[env.length - 1]); }
  let i = 0; while (i < env.length && env[i] < 0.1 * pk) i++; return i * F;
}
const fitLine = (ts, ys) => { const mx = mean(ts), my = mean(ys); let n = 0, d = 0; for (let i = 0; i < ts.length; i++) { n += (ts[i] - mx) * (ys[i] - my); d += (ts[i] - mx) ** 2; } const s = d ? n / d : 0; return { slope: s, at: (t) => my + s * (t - mx) }; };

// Pitch after the pluck, in cents against the pitch from 300 to 600 ms in. Returns { cents0 (at 20 ms), tau (s), curve }.
export function settle(x0, sr0, f0, { until = 0.6 } = {}) {
  let x = x0, sr = sr0; if (sr > 30000) { const k = Math.floor(sr / 22050); x = decimate(x0, k); sr = sr0 / k; }
  const n = f0 < 60 ? 2048 : 1024, padded = new Float32Array(x.length + 2 * n); padded.set(x, n); x = padded;   // silence either side, so a window can sit on the onset
  const on = onsetOf(x, sr), w = hann(n), H = 4, binHz = sr / n, curve = [];
  const spec = (s) => { const re = new Float64Array(n), im = new Float64Array(n); for (let i = 0; i < n; i++) { const v = x[s + i] || 0; re[i] = v * w[i]; } fft(re, im); return [re, im]; };
  for (let t = 0.0; t <= until; t += 0.01) {
    const s = on + Math.round(t * sr) - n / 2; if (s < 0 || s + n + H >= x.length) continue; const [ar, ai] = spec(s), [br, bi] = spec(s + H); let num = 0, den = 0;
    for (let k = 3; k <= 8; k++) { const c = Math.round(k * f0 / binHz), wd = Math.max(1, Math.round(0.4 * f0 / binHz)); let bb = c, bv = 0; for (let b = Math.max(1, c - wd); b <= c + wd && b < n / 2; b++) { const p = ar[b] * ar[b] + ai[b] * ai[b]; if (p > bv) { bv = p; bb = b; } }
      if (!bv) continue; let d = Math.atan2(bi[bb], br[bb]) - Math.atan2(ai[bb], ar[bb]) - 2 * Math.PI * bb * H / n; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); const f = (bb + d * n / (2 * Math.PI * H)) * binHz;
      if (Math.abs(f / (k * f0) - 1) < 0.03) { num += bv * f / k; den += bv; } }
    if (den) curve.push([t, num / den]);
  }
  const ref = mean(curve.filter(([t]) => t >= 0.3).map(([, f]) => f)); if (!ref || curve.length < 8) return null;
  const c = curve.map(([t, f]) => [t, 1200 * Math.log2(f / ref)]), c20 = mean(c.filter(([t]) => t >= 0.02 && t <= 0.04).map(([, v]) => v)), half = c.find(([t, v]) => t > 0.02 && Math.abs(v) <= Math.abs(c20) / Math.E);
  return { cents0: c20, tau: half ? Math.max(0.005, half[0] - 0.02) : until, curve: c };
}

export const EDGES = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
// Excess power at the attack, per octave band. Returns { db: [7 values, dB against the note 60 to 100 ms in], tau (s) }.
export function excess(x, sr) {
  const on = onsetOf(x, sr), n = 512, hop = 128, w = hann(n), binHz = sr / n, rows = [], times = [];
  for (let t = -0.01; t <= 0.4; t += hop / sr) { const s = on + Math.round(t * sr) - n / 2; if (s < 0 || s + n > x.length) continue; const re = new Float64Array(n), im = new Float64Array(n); for (let i = 0; i < n; i++) re[i] = x[s + i] * w[i]; fft(re, im);
    rows.push(EDGES.slice(0, -1).map((lo, b) => { let e = 1e-20; for (let k = Math.max(1, Math.ceil(lo / binHz)); k * binHz < EDGES[b + 1] && k < n / 2; k++) e += re[k] * re[k] + im[k] * im[k]; return e; })); times.push(t); }
  const ref = mean(rows.filter((_, j) => times[j] >= 0.06 && times[j] <= 0.1).map((r) => r.reduce((s, v) => s + v, 0))); if (!ref) return null;
  const db = [], taus = [];
  for (let b = 0; b < 7; b++) { const late = rows.map((r, j) => [times[j], 10 * Math.log10(r[b])]).filter(([t]) => t >= 0.035 && t <= 0.1), L = fitLine(late.map((q) => q[0]), late.map((q) => q[1]));
    const ex = rows.map((r, j) => [times[j], r[b] - Math.pow(10, L.at(times[j]) / 10)]), early = ex.filter(([t]) => t >= 0 && t <= 0.03), e0 = Math.max(0, mean(early.map((q) => q[1])));
    db.push(e0 > 0 ? Math.max(-80, 10 * Math.log10(e0 / ref)) : -80);
    const top = Math.max(...ex.filter(([t]) => t >= 0 && t <= 0.03).map((q) => q[1])); const fall = ex.find(([t, v]) => t > 0.005 && v < top / Math.E); if (top > 0 && fall) taus.push(fall[0]); }
  return { db, tau: taus.length ? Math.min(0.06, Math.max(0.003, mean(taus))) : 0.01 };
}

// Early and late decay of each harmonic from the tracks timbre.analyse() returns. Returns { early: [dB/s], late: [dB/s] }.
export function twoStage(a, K, knee = 0.15) {
  const early = [], late = [], hop = a.hopSec;
  for (let k = 0; k < K; k++) { let pj = 0; for (let j = 0; j < Math.min(a.tracks.length, Math.round(0.1 / hop) + 2); j++) if (a.tracks[j][k] > a.tracks[pj][k]) pj = j;
    const pts = (from, to) => { const ts = [], ys = []; for (let j = pj; j < a.tracks.length; j++) { const t = (j - pj) * hop; if (t < from || t > to) continue; const v = a.tracks[j][k]; if (v <= 0) continue; ts.push(t); ys.push(10 * Math.log10(v)); } return [ts, ys]; };
    const [t1, y1] = pts(0, knee), [t2, y2] = pts(knee, 2.5); early.push(t1.length >= 3 ? Math.max(0.5, Math.min(400, -fitLine(t1, y1).slope)) : null); late.push(t2.length >= 4 ? Math.max(0.5, Math.min(300, -fitLine(t2, y2).slope)) : null); }
  return { early, late };
}
