// The ear: measurement that stands in for listening. listen() takes rendered audio (and, when there is one, the score that
// wrote it and the separate layers) and returns numbers plus a list of flags, one for each number outside its target.
// It can say a render is clean, in key, in time and balanced. It cannot say the music is beautiful. See README.md.
import { averageSpectrum, octaveBands, bandPower, slopePerOctave, db } from './spectrum.js';
import { level } from './level.js';
import { harmony, tuning } from './pitch.js';
import { timing } from './time.js';
import { roughness } from './rough.js';
import { stereo, gaps } from './stereo.js';
import { masking } from './mask.js';

// House targets. Loudness and true peak are the site's stated master target (world/studio/lib/loudness.mjs). The balance
// curve is our own choice for warm, quiet music over sea and wind: octave-band levels in dB relative to the whole, falling
// toward the top, with a tolerance either side. The rest are limits found by planting defects in a clean render
// (controls.test.mjs) and placing the limit between the clean reading and the defective one.
export const TARGETS = {
  lufs: -14, lufsTol: 1, truePeakMax: -1, dcMax: 0.002, crestMin: 8, lraMax: 14,
  balance: { centers: [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], db: [-22, -9, -5, -5, -7, -11, -15, -19, -25, -36], tol: 7 },
  harshMax: -5, presencePeakMax: 5, fitMin: 0.8, fitMeanMin: 0.75, rootMatchMin: 0.85, stemFitMin: 0.72,
  bpmTolPct: 1.5, driftMaxPct: 0.8, regularityMaxMs: 20, swingTol: 0.06, roughMax: 0.13,
  correlationMin: 0.1, monoLossMin: -3.5, leadOverMin: 6, musicOverMin: 0, leadCentsMax: 25,
};

// Spectral balance of the full mix, and harshness: the level of 2 to 5 kHz (where hearing is most sensitive and a hard
// edge is most tiring) relative to the 250 Hz to 2 kHz body, in dB.
export function balance(channels, sr, target = TARGETS.balance) {
  const spec = averageSpectrum(channels, sr), bands = octaveBands(spec, target.centers), dev = bands.db.map((v, i) => v - target.db[i]);
  return { centers: bands.centers, db: bands.db, target: target.db, deviation: dev, worst: dev.reduce((m, v, i) => (Math.abs(v) > Math.abs(dev[m]) ? i : m), 0),
    slope: slopePerOctave(bands), harshDb: db(bandPower(spec, 2000, 5000) / (bandPower(spec, 250, 2000) || 1e-20)), ...presencePeak(spec) };
}

// A resonance in the presence region: for each third-octave band from 2 to 5 kHz, its level minus the mean of the bands one
// octave below and one octave above. A smooth spectrum reads near 0 whatever its tilt; a narrow boost stands up as a peak.
export function presencePeak(spec) {
  const third = (fc) => db(bandPower(spec, fc / Math.pow(2, 1 / 6), fc * Math.pow(2, 1 / 6)) || 1e-20); let best = -Infinity, at = 0;
  for (let k = 3; k <= 7; k++) { const fc = 1000 * Math.pow(2, k / 3), v = third(fc) - 0.5 * (third(fc / 2) + third(fc * 2)); if (v > best) { best = v; at = fc; } }
  return { presencePeakDb: best, presencePeakHz: Math.round(at) };
}

const flag = (flags, id, measure, value, limit, message) => flags.push({ id, measure, value, limit, message });

// audio: { channels: [L, R], sr }
// score (optional): { bpm, swing, chords: [{ t0, t1, bar, sym, root, pcs }], lead: [{ t0, t1, m }] }, times in seconds
// stems (optional): { music, ambience, lead, keys, bass, pad } as channel arrays the same length as the mix
export function listen({ channels, sr }, { score = null, stems = null, targets = TARGETS } = {}) {
  const T = { ...TARGETS, ...targets }, flags = [], r = { sr, seconds: channels[0].length / sr };
  r.level = level(channels, sr); r.balance = balance(channels, sr, T.balance); r.stereo = stereo(channels, sr); r.gaps = gaps(channels, sr);
  const music = stems?.music || channels;
  r.time = timing(stems?.drums || music, sr, { bpm: score?.bpm });   // the drummer's time when the kit is given on its own, the whole music otherwise
  // roughness is read on the pitched layers when they are given: brushes and cymbals are noise, and noise always reads rough
  const tuned = ['keys', 'bass', 'pad', 'lead'].filter((k) => stems?.[k]).map((k) => stems[k]);
  const pitched = tuned.length ? [0, 1].map((c) => { const o = new Float32Array(channels[0].length); for (const st of tuned) { const x = st[c] || st[0]; for (let i = 0; i < o.length; i++) o[i] += x[i]; } return o; }) : music;
  r.roughness = roughness(pitched, sr, score?.chords || null);
  if (score?.chords) { r.harmony = harmony(music, sr, score.chords); r.stems = {};
    for (const k of ['keys', 'bass', 'pad', 'lead']) if (stems?.[k]) { const h = harmony(stems[k], sr, score.chords); r.stems[k] = { meanFit: h.meanFit, minFit: h.minFit, worstBar: h.worstBar }; } }
  if (stems?.ambience && stems?.music) { r.masking = { music: masking(stems.music, stems.ambience, sr) }; if (stems.lead) r.masking.lead = masking(stems.lead, stems.ambience, sr); }
  if (stems?.lead && score?.lead?.length) r.leadTuning = tuning(stems.lead[0], sr, score.lead);

  const L = r.level;
  if (Math.abs(L.integratedLufs - T.lufs) > T.lufsTol) flag(flags, 'loudness', 'integrated loudness, LUFS', L.integratedLufs, `${T.lufs} +/- ${T.lufsTol}`, 'Loudness is off the house target.');
  if (L.truePeakDb > T.truePeakMax) flag(flags, 'true-peak', 'true peak, dBTP', L.truePeakDb, `<= ${T.truePeakMax}`, 'True peak is over the ceiling.');
  if (L.clippedRuns > 0) flag(flags, 'clipping', 'runs of 3 or more samples at full scale', L.clippedRuns, '0', 'The waveform has flat tops.');
  if (L.dcMax > T.dcMax) flag(flags, 'dc-offset', 'largest channel mean', L.dcMax, `<= ${T.dcMax}`, 'The waveform is not centred on zero.');
  if (L.crestDb < T.crestMin) flag(flags, 'crest', 'crest factor, dB', L.crestDb, `>= ${T.crestMin}`, 'Peaks are squashed against the level.');
  if (L.lra > T.lraMax) flag(flags, 'range', 'loudness range, LU', L.lra, `<= ${T.lraMax}`, 'Quiet and loud parts are too far apart for background listening.');
  const B = r.balance; if (Math.abs(B.deviation[B.worst]) > T.balance.tol) flag(flags, 'balance', `octave band ${B.centers[B.worst]} Hz against target, dB`, B.deviation[B.worst], `+/- ${T.balance.tol}`, 'Spectral balance leaves the target curve.');
  if (B.presencePeakDb > T.presencePeakMax) flag(flags, 'harshness', `third-octave band at ${B.presencePeakHz} Hz over its neighbours an octave away, dB`, B.presencePeakDb, `<= ${T.presencePeakMax}`, 'A narrow peak stands up where hearing is most sensitive.');
  else if (B.harshDb > T.harshMax) flag(flags, 'harshness', '2 to 5 kHz over 250 Hz to 2 kHz, dB', B.harshDb, `<= ${T.harshMax}`, 'Too much energy where hearing is most sensitive.');
  if (r.stereo.correlation < T.correlationMin) flag(flags, 'correlation', 'left-right correlation', r.stereo.correlation, `>= ${T.correlationMin}`, 'The channels work against each other.');
  if (r.stereo.monoLossDb < T.monoLossMin) flag(flags, 'mono', 'level change when summed to mono, dB', r.stereo.monoLossDb, `>= ${T.monoLossMin}`, 'The mix cancels on a single speaker.');
  if (r.gaps.dropouts.length) flag(flags, 'dropout', 'gaps inside the programme', r.gaps.dropouts.length, '0', `Sound drops out at ${r.gaps.dropouts[0].t.toFixed(2)} s for ${r.gaps.dropouts[0].ms} ms.`);
  if (score?.bpm) {
    const t = r.time, off = (t.bpm / score.bpm - 1) * 100;
    if (Math.abs(off) > T.bpmTolPct) flag(flags, 'tempo', 'tempo against the score, percent', off, `+/- ${T.bpmTolPct}`, 'Tempo is not the tempo written.');
    if (t.driftMaxPct > T.driftMaxPct) flag(flags, 'tempo-drift', 'largest 16-beat tempo departure, percent', t.driftMaxPct, `<= ${T.driftMaxPct}`, 'Tempo wanders.');
    if (t.regularityMs > T.regularityMaxMs) flag(flags, 'beat', 'spread of onsets around the beat, ms', t.regularityMs, `<= ${T.regularityMaxMs}`, 'Onsets do not sit on a steady beat.');
    if (score.swing && t.swing !== null && Math.abs(t.swing - score.swing) > T.swingTol) flag(flags, 'swing', 'off-beat eighth position in the beat', t.swing, `${score.swing} +/- ${T.swingTol}`, 'Swing differs from the score.');
  }
  if (r.harmony) {
    const h = r.harmony;
    if (h.minFit < T.fitMin) flag(flags, 'chord', `share of energy on the written chord, bar ${h.worstBar + 1}`, h.minFit, `>= ${T.fitMin}`, 'A bar does not sound the chord the score wrote.');
    if (h.meanFit < T.fitMeanMin) flag(flags, 'key', 'mean share of energy on the written chords', h.meanFit, `>= ${T.fitMeanMin}`, 'The harmony as a whole is off the score.');
    if (h.rootMatchRate < T.rootMatchMin) flag(flags, 'roots', 'share of chords with the written root in the bass', h.rootMatchRate, `>= ${T.rootMatchMin}`, 'The bass does not state the written roots.');
    for (const [k, s] of Object.entries(r.stems)) if (s.meanFit < T.stemFitMin) flag(flags, `stem-${k}`, `${k}: mean share of energy on the written chords`, s.meanFit, `>= ${T.stemFitMin}`, `The ${k} layer is in the wrong key.`);
  }
  if (r.roughness.mean > T.roughMax) flag(flags, 'roughness', 'mean sensory roughness (Sethares)', r.roughness.mean, `<= ${T.roughMax}`, 'Partials beat against each other more than this idiom allows.');
  if (r.masking) {
    const m = r.masking.music, mid = m.bands.map((c, i) => (c >= 250 && c <= 2000 ? m.over[i] : Infinity)), low = Math.min(...mid);
    if (low < T.musicOverMin) flag(flags, 'masking-music', 'music over ambience, weakest band from 250 Hz to 2 kHz, dB', low, `>= ${T.musicOverMin}`, 'The ambience covers the music.');
    if (r.masking.lead && r.masking.lead.leadOver < T.leadOverMin) flag(flags, 'masking-lead', 'lead over ambience in the lead\'s own bands, dB', r.masking.lead.leadOver, `>= ${T.leadOverMin}`, 'The ambience covers the lead.');
  }
  if (r.leadTuning?.worst && Math.abs(r.leadTuning.worst.cents) > T.leadCentsMax) flag(flags, 'tuning', `lead note at ${r.leadTuning.worst.t0.toFixed(2)} s, cents from tempered pitch`, r.leadTuning.worst.cents, `+/- ${T.leadCentsMax}`, 'A lead note is out of tune.');
  r.flags = flags; r.clean = flags.length === 0; return r;
}

// A short plain-text report for notes and logs.
export function summary(r) {
  const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : String(v)), L = r.level, out = [];
  out.push(`length ${f(r.seconds)} s | loudness ${f(L.integratedLufs)} LUFS, range ${f(L.lra)} LU | true peak ${f(L.truePeakDb)} dBTP | crest ${f(L.crestDb)} dB | clipped runs ${L.clippedRuns} | DC ${L.dcMax.toExponential(1)}`);
  out.push(`balance dB by octave ${r.balance.centers.map((c, i) => `${c}:${f(r.balance.db[i], 0)}`).join(' ')} | slope ${f(r.balance.slope)} dB/oct | harshness ${f(r.balance.harshDb)} dB, presence peak ${f(r.balance.presencePeakDb)} dB at ${r.balance.presencePeakHz} Hz`);
  out.push(`tempo ${f(r.time.bpm, 2)} BPM (unhinted ${f(r.time.bpmUnhinted, 2)}) | drift ${f(r.time.driftMaxPct, 2)} % | beat spread ${f(r.time.regularityMs)} ms | swing ${r.time.swing === null ? 'n/a' : f(r.time.swing, 3)} | onsets ${f(r.time.onsetsPerSecond, 2)}/s`);
  if (r.harmony) out.push(`harmony: mean fit ${f(r.harmony.meanFit, 2)}, min ${f(r.harmony.minFit, 2)} (bar ${r.harmony.worstBar + 1}), roots ${f(r.harmony.rootMatchRate * 100, 0)} % | stems ${Object.entries(r.stems).map(([k, s]) => `${k} ${f(s.meanFit, 2)}`).join(', ')}`);
  out.push(`roughness mean ${f(r.roughness.mean, 4)}, p95 ${f(r.roughness.p95, 4)} | correlation ${f(r.stereo.correlation, 2)}, width ${f(r.stereo.widthDb)} dB, mono loss ${f(r.stereo.monoLossDb, 2)} dB | dropouts ${r.gaps.dropouts.length}`);
  if (r.masking) out.push(`music over ambience dB ${r.masking.music.bands.map((c, i) => `${c}:${f(r.masking.music.over[i], 0)}`).join(' ')}${r.masking.lead ? ` | lead over ambience ${f(r.masking.lead.leadOver)} dB` : ''}`);
  if (r.leadTuning?.worst) out.push(`lead tuning: mean ${f(r.leadTuning.meanAbs)} cents, worst ${f(r.leadTuning.worst.cents)} cents at ${f(r.leadTuning.worst.t0, 2)} s`);
  out.push(r.clean ? 'flags: none' : `flags: ${r.flags.map((x) => `${x.id} (${x.measure}: ${f(x.value, 3)}, limit ${x.limit})`).join('; ')}`);
  return out.join('\n');
}

export * as spectrum from './spectrum.js';
export * as levels from './level.js';
export * as pitch from './pitch.js';
export * as time from './time.js';
export * as rough from './rough.js';
export * as stereoField from './stereo.js';
export * as mask from './mask.js';
export * as pictures from './pictures.js';
export { encodePng, Canvas } from './png.js';
