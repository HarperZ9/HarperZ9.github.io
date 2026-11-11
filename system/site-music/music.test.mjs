// The lounge voices, the composer and the renderer.
//   node --test system/site-music/music.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { tine, softBass, brush, TINE } from './voices.js';
import { parse, voice, TYPES } from './chords.js';
import { PIECES, PIECE_IDS } from './pieces.js';
import { compose, composer } from './score.js';
import { renderBars, mixStems, swung, timeline, TAIL } from './render.js';
import { createAmbience } from './ambience.js';
import { limit } from './piece.js';
import { spectrum, pitch } from '../ear/index.js';
import * as engineKeys from '../../world/sound/sound/v3/instruments/keys.js';

const SR = 48000, mean = (x) => x.reduce((a, b) => a + b, 0) / x.length, rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
function centroid(x, a = 0, b = x.length) { const sp = spectrum.averageSpectrum([x.subarray(a, b)], SR, { n: 4096 }); let num = 0, den = 0; for (let k = 1; k < sp.power.length; k++) { num += k * sp.binHz * sp.power[k]; den += sp.power[k]; } return num / den; }
const cents = (x, m, fmin = 38) => { const pf = pitch.partialFrames(x, SR, { fmin, max: 4 }), want = spectrum.mtof(m), pk = pf.frames[2][0], c = 1200 * Math.log2(pk.f / want); return c - 1200 * Math.round(c / 1200); };   // the strongest partial, folded to the octave

test('tine: in tune, brighter when struck harder, bell fades after the strike, centred on zero, damped on release', () => {
  const soft = tine(60, 0.3, 1.5, TINE, SR), hard = tine(60, 0.9, 1.5, TINE, SR);
  assert.ok(Math.abs(cents(hard, 60)) < 4, `tuning ${cents(hard, 60)} cents`);
  const pf = pitch.partialFrames(tine(60, 0.5, 1.5, TINE, SR), SR, { max: 4 }).frames[3]; assert.ok(Math.abs(pf[0].f - spectrum.mtof(60)) < 3, `at playing strength the fundamental is the strongest partial (found ${pf[0].f} Hz)`);
  assert.ok(centroid(hard, 0, 7200) > 1.15 * centroid(soft, 0, 7200), `strike of a hard note ${centroid(hard, 0, 7200)} Hz against a soft one ${centroid(soft, 0, 7200)} Hz`);
  assert.ok(centroid(hard, 0, 7200) > 1.25 * centroid(hard, 28800, 43200), 'the strike is brighter than the sustain');
  assert.ok(Math.abs(mean(hard)) < 2e-4, `mean ${mean(hard)}`);
  const old = engineKeys.note(60, 0.9, 1.5, { bell: 0.5, bark: 0.3, decay: 1.4, drive: 0.25, tone: 5000 }, SR);
  assert.ok(Math.abs(mean(old.subarray(0, 24000))) > 5 * Math.abs(mean(hard.subarray(0, 24000))), 'the engine voice it replaces sits off zero; this one does not');
  assert.ok(rms(hard, Math.round(1.9 * SR), hard.length) < 0.02 * rms(hard, 0, SR), 'the damper stops the note');
});

test('soft bass: in tune, and the upper partials die before the fundamental', () => {
  const x = softBass(45, 0.7, 2, SR); assert.ok(Math.abs(cents(x.subarray(4800), 45, 60)) < 5, `tuning ${cents(x.subarray(4800), 45, 60)} cents`);
  assert.ok(centroid(x, 0, 9600) > 1.2 * centroid(x, 48000, 86400), 'the note darkens as it rings'); assert.ok(Math.abs(mean(x)) < 1e-3);
});

test('brushes: the sweep has no hard edge, the tap is short, and no two ride strokes are the same wave', () => {
  const sweep = brush.sweep(1.6, 0.5, SR), tap = brush.tap(0.5, SR), a = brush.ride(0.5, SR, 1), b = brush.ride(0.5, SR, 2);
  assert.ok(rms(sweep, 0, 2400) < 0.25 * rms(sweep, 24000, 36000), 'the sweep swells in');
  assert.ok(rms(tap, 7200, tap.length) < 0.05 * rms(tap, 0, 2400), 'tap decays within 150 ms');
  let dot = 0; for (let i = 4800; i < 24000; i++) dot += a[i] * b[i]; assert.ok(Math.abs(dot / (19200 * rms(a, 4800, 24000) * rms(b, 4800, 24000))) < 0.3, 'ride strokes differ');
  assert.ok(centroid(a) > 1500 && centroid(a) < 9000, `ride centroid ${centroid(a)} Hz`);
});

test('chords: every symbol in every piece parses, and voice leading keeps the hand still', () => {
  for (const id of PIECE_IDS) for (const sec of Object.values(PIECES[id].sections)) { let prev = null, moved = 0, n = 0;
    for (const bar of sec) for (const sym of bar.split(' ')) { const c = parse(sym), v = voice(sym, prev); assert.ok(TYPES[c.type]); assert.equal(v.length, 4); assert.ok(v[0] >= 52 && v[3] <= 75, `${sym} voiced ${v}`);
      for (const m of v) assert.ok(TYPES[c.type].voice.map((i) => (c.root + i) % 12).includes(m % 12)); if (prev) { moved += v.reduce((s, x, i) => s + Math.abs(x - prev[i]), 0); n++; } prev = v; }
    assert.ok(moved / n / 4 < 3, `${id}: mean motion per voice ${moved / n / 4} semitones`); }
  assert.throws(() => parse('Hm9'));
});

test('composer: same seed same score, another seed another score, no eight-bar loop, sparse lead on chord tones', () => {
  for (const id of PIECE_IDS) {
    const a = compose(id, { seed: 3, bars: 64 }), b = compose(id, { seed: 3, bars: 64 }), c = compose(id, { seed: 4, bars: 64 }), P = PIECES[id];
    assert.deepEqual(a.bars, b.bars); assert.notDeepEqual(a.bars.map((x) => x.keys), c.bars.map((x) => x.keys));
    const syms = a.bars.map((x) => x.chords.map((q) => q.sym).join(' ')), win = (k) => syms.slice(k, k + 8).join('|'), keysOf = (k) => JSON.stringify(a.bars.slice(k, k + 8).map((x) => x.keys.map((e) => [e.beat, e.notes])));
    assert.ok(new Set([8, 16, 24, 32, 40, 48].map(win)).size >= 2, `${id}: the sections change`); assert.ok(new Set([8, 16, 24, 32, 40, 48].map(keysOf)).size === 6, `${id}: no two eight-bar stretches are played the same`);
    const withLead = a.bars.filter((x) => x.lead.length).length; assert.ok(withLead > 6 && withLead < 0.6 * 64, `${id}: lead in ${withLead} of 64 bars`);
    for (const bar of a.bars) { for (const k of ['keys', 'bass', 'drums', 'lead', 'pad']) for (const e of bar[k]) assert.ok(e.beat >= 0 && e.beat < 4, `${id} bar ${bar.index} ${k} at beat ${e.beat}`);
      for (const n of bar.lead) { assert.ok(n.m >= P.lead.range[0] && n.m <= P.lead.range[1]); if (n.beats > 1) { const ch = bar.chords.filter((q) => q.beat <= n.beat).pop(); assert.ok(ch.pcs.includes(n.m % 12), `${id} bar ${bar.index + 1}: long lead note ${n.m} over ${ch.sym}`); } } }
    assert.equal(a.bars[63].chords[0].sym, P.tonic); assert.equal(a.bars[0].bass.length + a.bars[0].drums.length, 0, 'the first bar is pad alone');
  }
  const lt = compose('low-tide', { seed: 1, bars: 32 }).bars.flatMap((b) => b.chords), fam = (c) => (c.type.startsWith('m') && c.type !== 'maj9' && !c.type.startsWith('maj') ? 'm' : ['13', '9', 'sus13', '7alt'].includes(c.type) ? 'V' : 'I');
  assert.ok(lt.some((c, i) => i + 2 < lt.length && fam(c) === 'm' && fam(lt[i + 1]) === 'V' && fam(lt[i + 2]) === 'I' && (lt[i + 1].root - c.root + 12) % 12 === 5 && (lt[i + 2].root - lt[i + 1].root + 12) % 12 === 5), 'Low Tide contains a ii-V-I');
  const live = composer('night-school', { seed: 9 }); for (let i = 0; i < 200; i++) live.next(); assert.equal(live.next().index, 200, 'the endless form keeps going');
});

test('swing places the off-beat eighth, and the timeline gives the ear the written chords in seconds', () => {
  assert.equal(swung(1.5, 0.62), 1.62); assert.equal(swung(2, 0.62), 2); assert.equal(swung(0.25, 0.6), 0.3);
  const s = compose('low-tide', { seed: 1, bars: 4 }), tl = timeline(s.bars, s.piece, { t0: 3 }), beat = 60 / 66;
  assert.equal(tl.chords[0].t0, 3); assert.ok(Math.abs(tl.chords[1].t0 - (3 + 4 * beat)) < 2e-5, 'bars start on whole samples'); assert.equal(tl.bpm, 66);
});

test('a piece rendered in two chunks and overlapped is the same sound as one render', () => {
  const s = compose('glass-hour', { seed: 2, bars: 12 }), P = s.piece, sr = 24000;
  const whole = mixStems(renderBars(s.bars.slice(8, 12), P, { sr, seed: 2 }).stems, P), a = renderBars(s.bars.slice(8, 10), P, { sr, seed: 2 }), b = renderBars(s.bars.slice(10, 12), P, { sr, seed: 2, origin: a.n / sr, defects: { leadOffset: a.leadCount } });
  const ma = mixStems(a.stems, P), mb = mixStems(b.stems, P), sum = new Float32Array(whole.L.length); sum.set(ma.L.subarray(0, Math.min(ma.L.length, sum.length))); for (let i = 0; i < mb.L.length && a.n + i < sum.length; i++) sum[a.n + i] += mb.L[i];
  let worst = 0; for (let i = 0; i < a.pre + a.n + b.n; i++) worst = Math.max(worst, Math.abs(sum[i] - whole.L[i])); assert.ok(worst < 2e-4, `largest difference ${worst}`);
  assert.equal(whole.L.length, a.pre + a.n + b.n + Math.round(TAIL * sr));
});

test('ambience: continuous across calls, never silent, waves slow and irregular, sea darker than air', () => {
  const sr = 12000, one = createAmbience({ seed: 5, sr }).render(sr * 4), g = createAmbience({ seed: 5, sr }), p1 = g.render(sr * 2), p2 = g.render(sr * 2);
  for (let i = 0; i < sr * 2; i++) { assert.equal(p1.L[i], one.L[i]); assert.equal(p2.R[i], one.R[i + sr * 2]); }
  const long = createAmbience({ seed: 7, sr, sea: 1, wind: 0, air: 0 }).render(sr * 120), env = []; for (let s = 0; s + sr / 2 <= long.L.length; s += sr / 2) env.push(rms(long.L, s, s + sr / 2));
  assert.ok(Math.min(...env) > 1e-4, 'the sea never stops');
  const top = Math.max(...env), peaks = []; for (let i = 2; i < env.length - 2; i++) if (env[i] > 0.45 * top && env[i] >= env[i - 1] && env[i] > env[i + 1] && env[i] >= env[i - 2] && env[i] > env[i + 2] && (!peaks.length || i - peaks[peaks.length - 1] > 6)) peaks.push(i);
  const gaps = peaks.slice(1).map((p, i) => (p - peaks[i]) / 2), m = mean(gaps), sd = Math.sqrt(mean(gaps.map((v) => (v - m) ** 2)));
  assert.ok(peaks.length >= 7 && m > 6 && m < 16, `${peaks.length} waves, mean period ${m} s`); assert.ok(sd > 0.8, `period spread ${sd} s`);
  const slope = (o) => { const x = createAmbience({ seed: 3, sr: SR, ...o }).render(SR * 20); return spectrum.slopePerOctave(spectrum.octaveBands(spectrum.averageSpectrum([x.L], SR)), 125, 8000); };
  assert.ok(slope({ sea: 1, wind: 0, air: 0 }) < slope({ sea: 0, wind: 0, air: 1 }) - 3, 'the sea sits lower than the air');
});

test('the limiter holds every sample under its ceiling and leaves quiet audio alone', () => {
  const n = 48000, L = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin(i / 20) + (i % 9000 === 4000 ? 1.5 : 0)), R = L.slice(), q = L.slice(0, 3000), info = limit(L, R, SR, { ceilingDb: -2 });
  let pk = 0; for (const v of L) pk = Math.max(pk, Math.abs(v)); assert.ok(pk <= Math.pow(10, -2 / 20) + 1e-6, `peak ${pk}`); assert.ok(info.maxReductionDb > 5);
  for (let i = 0; i < 3000; i++) assert.equal(L[i], q[i]);
});
