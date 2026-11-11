// piece.js: a whole piece, offline. The score is composed, the stems are rendered, the ambience runs under all of it, and
// the mix is brought to the house loudness (-14 LUFS integrated, true peak at most -1 dBTP; world/studio/lib/loudness.mjs).
import { integratedLufs, truePeakDb } from '../../world/studio/lib/loudness.mjs';
import { compose } from './score.js';
import { renderBars, mixStems, timeline, STEMS } from './render.js';
import { createAmbience } from './ambience.js';
import { PIECES } from './pieces.js';

export const LEAD_IN = 3;   // seconds of sea and wind before the first chord

// A look-ahead peak limiter: gain falls before a peak arrives and recovers after it, so no sample passes the ceiling and
// nothing clips. The gain curve is the lowest gain any sample in the next `look` seconds needs, averaged over the same
// window, which keeps it at or under what each sample needs.
export function limit(L, R, sr, { ceilingDb = -1.8, look = 0.006 } = {}) {
  const n = L.length, c = Math.pow(10, ceilingDb / 20), W = Math.max(1, Math.round(look * sr)), need = new Float32Array(n), low = new Float32Array(n);
  let touched = 0, deepest = 1;
  for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); need[i] = a > c ? c / a : 1; if (a > c) touched++; }
  const dq = new Int32Array(n); let h = 0, t = 0;   // sliding minimum over [i, i + W]
  for (let i = 0, j = 0; i < n; i++) { for (; j < n && j <= i + W; j++) { while (t > h && need[dq[t - 1]] >= need[j]) t--; dq[t++] = j; } while (dq[h] < i) h++; low[i] = need[dq[h]]; }
  let acc = 0; for (let i = 0; i < n; i++) { acc += low[i]; if (i >= W) acc -= low[i - W]; const g = Math.min(low[i], acc / Math.min(i + 1, W)); if (g < deepest) deepest = g; L[i] *= g; R[i] *= g; }
  return { limitedShare: touched / n, maxReductionDb: -20 * Math.log10(deepest) };
}

// Gain to the target loudness, limit, measure again, correct once more. Returns what was done.
export function master(L, R, sr, { target = -14, ceilingDb = -1.8, gainDb = null } = {}) {
  const info = { passes: [] }; let total = 0;
  for (let pass = 0; pass < (gainDb === null ? 3 : 1); pass++) {
    const g = gainDb === null ? target - integratedLufs([L, R], sr) : gainDb, k = Math.pow(10, g / 20); total += g;
    for (let i = 0; i < L.length; i++) { L[i] *= k; R[i] *= k; }
    info.passes.push({ gainDb: g, ...limit(L, R, sr, { ceilingDb }) });
    if (Math.abs(g) < 0.05) break;
  }
  return { ...info, gainDb: total, lufs: integratedLufs([L, R], sr), truePeakDb: truePeakDb([L, R]) };
}

// Render a piece. Returns the mastered mix, the layers at the same gain (for the ear), and the score in seconds.
export function renderPiece(id, { seed = 1, bars = 48, sr = 48000, defects = {}, masterOpts = {}, ambienceDb = 0, responsive = true } = {}) {
  const P0 = PIECES[id], piece = defects.mix ? { ...P0, mix: { ...P0.mix, ...Object.fromEntries(Object.entries(defects.mix).map(([k, v]) => [k, P0.mix[k] + v])) } } : P0, score = compose(id, { seed, bars, staged: defects.staged !== false, loop: !!defects.loop }), r = renderBars(score.bars, piece, { sr, seed, origin: LEAD_IN, defects }), lead = Math.round(LEAD_IN * sr) - r.pre, total = lead + r.length;
  const place = (x) => { const L = new Float32Array(total), R = new Float32Array(total); L.set(x.L, lead); R.set(x.R, lead); return [L, R]; };
  const tl = timeline(score.bars, piece, { t0: LEAD_IN, drift: defects.drift || 0, sr }), sea = createAmbience({ seed, sr, ...piece.ambience, responsive });
  sea.cue({ rests: tl.rests, lead: tl.lead.map((n) => [n.t0 - 0.09, n.t1]) });
  const amb = sea.render(total), ag = Math.pow(10, (piece.mix.ambience + ambienceDb) / 20), fin = Math.round(2.5 * sr), fout = Math.round(5 * sr);
  for (let i = 0; i < total; i++) { const g = ag * Math.min(1, i / fin); amb.L[i] *= g; amb.R[i] *= g; }
  const stems = { music: place(mixStems(r.stems, piece)), ambience: [amb.L, amb.R] };
  for (const k of STEMS) stems[k] = place(mixStems(r.stems, piece, { only: [k] }));
  const fade = (ch) => { for (const c of ch) for (let i = 0; i < fout; i++) c[total - 1 - i] *= i / fout; };
  Object.values(stems).forEach(fade);
  const L = new Float32Array(total), R = new Float32Array(total); for (let i = 0; i < total; i++) { L[i] = stems.music[0][i] + stems.ambience[0][i]; R[i] = stems.music[1][i] + stems.ambience[1][i]; }
  const m = master(L, R, sr, masterOpts), k = Math.pow(10, m.gainDb / 20); for (const ch of Object.values(stems)) for (const c of ch) for (let i = 0; i < total; i++) c[i] *= k;
  return { id, piece, seed, sr, channels: [L, R], stems, score: tl, bars: score.bars, shape: score.shape, kinds: score.kinds, breaks: sea.breaks, master: m, seconds: total / sr };
}
