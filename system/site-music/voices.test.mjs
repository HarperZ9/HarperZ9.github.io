// The voices built for the site music, each tested for what it claims.
//   node --test system/site-music/voices.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { tine, softBass, brush, TINE } from './voices.js';
import { sax } from './sax.js';
import { bassGuitar, sub, stringFor } from './bassguitar.js';
import { spectrum, pitch } from '../ear/index.js';
import * as engineKeys from '../../world/sound/sound/v3/instruments/keys.js';
import * as engineReed from '../../world/sound/sound/v3/instruments/reed.js';

const SR = 48000, mean = (x) => x.reduce((a, b) => a + b, 0) / x.length, rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
function centroid(x, a = 0, b = x.length) { const sp = spectrum.averageSpectrum([x.subarray(a, b)], SR, { n: 4096 }); let num = 0, den = 0; for (let k = 1; k < sp.power.length; k++) { num += k * sp.binHz * sp.power[k]; den += sp.power[k]; } return num / den; }
const band = (x, lo, hi, a = 0, b = x.length) => spectrum.bandPower(spectrum.averageSpectrum([x.subarray(a, b)], SR, { n: 4096 }), lo, hi);
const cents = (x, m, fmin = 38) => { const pf = pitch.partialFrames(x, SR, { fmin, max: 4 }), want = spectrum.mtof(m), pk = pf.frames[2][0], c = 1200 * Math.log2(pk.f / want); return c - 1200 * Math.round(c / 1200); };   // the strongest partial, folded to the octave
// levels of the first eight harmonics in dB, from a settled stretch of a note
function harmonics(x, f, from = 0.4) { const pf = pitch.partialFrames(x.subarray(Math.round(from * SR)), SR, { fmin: 30, fmax: 5500, max: 24 }).frames[2]; return Array.from({ length: 8 }, (_, k) => { const p = pf.find((q) => Math.abs(q.f / ((k + 1) * f) - 1) < 0.03); return p ? { db: 20 * Math.log10(p.a), f: p.f } : { db: -120, f: 0 }; }); }
// pitch of a short stretch by autocorrelation, for bends and slides that are over before a spectrum frame is
function shortPitch(x, t0, t1, guess) { const a = Math.round(t0 * SR), n = Math.round((t1 - t0) * SR), lo = Math.floor(SR / (guess * 1.5)), hi = Math.ceil(SR / (guess / 1.5)); let best = lo, bv = -Infinity; const ac = [];
  for (let lag = lo; lag <= hi; lag++) { let s = 0; for (let i = a; i + lag < a + n; i++) s += x[i] * x[i + lag]; s /= n - lag; ac[lag] = s; if (s > bv) { bv = s; best = lag; } }
  const den = (ac[best - 1] ?? bv) - 2 * bv + (ac[best + 1] ?? bv); return SR / (best + (den < 0 ? 0.5 * ((ac[best - 1] ?? bv) - (ac[best + 1] ?? bv)) / den : 0)); }

test('tine: in tune, fundamental leads, the bell grows with velocity and fades, centred on zero, a damper with its own small noise', () => {
  const soft = tine(60, 0.3, 1.5, TINE, SR), hard = tine(60, 0.9, 1.5, TINE, SR);
  assert.ok(Math.abs(cents(hard, 60)) < 4, `tuning ${cents(hard, 60)} cents`);
  const pf = pitch.partialFrames(tine(60, 0.5, 1.5, TINE, SR), SR, { max: 4 }).frames[3]; assert.ok(Math.abs(pf[0].f - spectrum.mtof(60)) < 3, `at playing strength the fundamental is the strongest partial (found ${pf[0].f} Hz)`);
  assert.ok(centroid(hard, 0, 7200) > 1.15 * centroid(soft, 0, 7200), 'a hard note strikes brighter'); assert.ok(centroid(hard, 0, 7200) > 1.25 * centroid(hard, 28800, 43200), 'the strike is brighter than the sustain');
  const bell = (x) => band(x, 2500, 6000, 0, 9600) / band(x, 100, 1000, 0, 9600); assert.ok(bell(hard) > 4 * bell(soft), `bell share, hard over soft: ${bell(hard) / bell(soft)}`);
  assert.ok(Math.abs(mean(hard)) < 2e-4, `mean ${mean(hard)}`);
  const old = engineKeys.note(60, 0.9, 1.5, { bell: 0.5, bark: 0.3, decay: 1.4, drive: 0.25, tone: 5000 }, SR); assert.ok(Math.abs(mean(old.subarray(0, 24000))) > 5 * Math.abs(mean(hard.subarray(0, 24000))), 'the engine voice sits off zero; this one does not');
  assert.ok(rms(hard, Math.round(1.9 * SR), hard.length) < 0.02 * rms(hard, 0, SR), 'the damper stops the note');
  const withNoise = tine(60, 0.9, 0.5, TINE, SR), without = tine(60, 0.9, 0.5, { ...TINE, release: 0 }, SR), a = Math.round(0.5 * SR), b = a + 1440; let diff = 0; for (let i = a; i < b; i++) diff += (withNoise[i] - without[i]) ** 2;
  assert.ok(Math.sqrt(diff / 1440) > 1e-4 && rms(withNoise, 0, a - 10) === rms(without, 0, a - 10), 'the release noise starts at the release and nowhere else');
});

test('soft bass: in tune, and the upper partials die before the fundamental', () => {
  const x = softBass(45, 0.7, 2, SR); assert.ok(Math.abs(cents(x.subarray(4800), 45, 60)) < 5, `tuning ${cents(x.subarray(4800), 45, 60)} cents`);
  assert.ok(centroid(x, 0, 9600) > 1.2 * centroid(x, 48000, 86400), 'the note darkens as it rings'); assert.ok(Math.abs(mean(x)) < 3e-3, `mean ${mean(x)}`);
  const y = softBass(45, 0.7, 2, SR, 2); let dot = 0; for (let i = 0; i < 9600; i++) dot += x[i] * y[i]; assert.ok(dot / (9600 * rms(x, 0, 9600) * rms(y, 0, 9600)) < 0.98, 'two plucks of one note are not the same wave');
});

test('brushes: the sweep swells in, the tap is short, and no two ride strokes are the same wave', () => {
  const sweep = brush.sweep(1.6, 0.5, SR), tap = brush.tap(0.5, SR), a = brush.ride(0.5, SR, 1), b = brush.ride(0.5, SR, 2);
  assert.ok(rms(sweep, 0, 2400) < 0.25 * rms(sweep, 24000, 36000), 'the sweep swells in'); assert.ok(rms(tap, 7200, tap.length) < 0.05 * rms(tap, 0, 2400), 'tap decays within 150 ms');
  let dot = 0; for (let i = 4800; i < 24000; i++) dot += a[i] * b[i]; assert.ok(Math.abs(dot / (19200 * rms(a, 4800, 24000) * rms(b, 4800, 24000))) < 0.3, 'ride strokes differ');
  assert.ok(centroid(a) > 1500 && centroid(a) < 9000, `ride centroid ${centroid(a)} Hz`);
});

test('sax: in tune over its range at soft, medium and loud', () => {
  for (const vel of [0.3, 0.6, 0.9]) for (const m of [50, 55, 58, 62, 65, 69, 72, 76, 79]) {
    const h = harmonics(sax(m, vel, 1.3, { vibrato: 0, scoop: 0, noise: 0 }, SR), spectrum.mtof(m)); assert.ok(h[0].f > 0, `note ${m} at ${vel} has no fundamental`);
    const c = 1200 * Math.log2(h[0].f / spectrum.mtof(m)); assert.ok(Math.abs(c) < 6, `note ${m} at velocity ${vel}: ${c.toFixed(1)} cents`);
  }
});

test('sax: a cone sounds odd and even harmonics; the clarinet-like reed beside it sounds the odd ones', () => {
  for (const m of [55, 62, 69]) {
    const f = spectrum.mtof(m), s = harmonics(sax(m, 0.6, 1.3, { vibrato: 0, scoop: 0, noise: 0 }, SR), f), c = harmonics(engineReed.note(m, 0.6, 1.3, { model: 'reed', breath: 0.6, noise: 0, vibrato: 0, vibRate: 5, vibDelay: 0.4, reedStiff: 0.3, tone: 3800, scoop: 0 }, SR), f);
    assert.ok(s[0].db >= Math.max(...s.slice(1).map((q) => q.db)), `note ${m}: the fundamental is the strongest partial`);
    assert.ok(s[1].db > s[0].db - 12 && s[2].db > s[0].db - 28 && s[3].db > s[0].db - 28, `note ${m}: sax harmonics 2, 3, 4 at ${s.slice(1, 4).map((q) => (q.db - s[0].db).toFixed(0))} dB`);
    assert.ok(c[1].db < c[0].db - 25 && c[2].db > c[0].db - 20, `note ${m}: the cylinder's second harmonic at ${(c[1].db - c[0].db).toFixed(0)} dB and third at ${(c[2].db - c[0].db).toFixed(0)} dB`);
  }
});

test('sax: scoops into the note, vibrato arrives late, breath adds noise, louder is brighter, no DC', () => {
  const f = spectrum.mtof(62), scooped = sax(62, 0.6, 1.2, { vibrato: 0, noise: 0, scoop: 1 }, SR), early = shortPitch(scooped, 0.06, 0.12, f), late = shortPitch(scooped, 0.6, 0.7, f);
  assert.ok(1200 * Math.log2(early / late) < -12, `the start is ${(1200 * Math.log2(early / late)).toFixed(0)} cents under the settled pitch`); assert.ok(Math.abs(1200 * Math.log2(late / f)) < 6);
  const v = sax(62, 0.6, 3, { vibrato: 0.012, vibDelay: 0.5, noise: 0, scoop: 0 }, SR), spread = (t0, t1) => { const p = []; for (let t = t0; t + 0.05 <= t1; t += 0.05) p.push(1200 * Math.log2(shortPitch(v, t, t + 0.05, f) / f)); const m = mean(p); return Math.sqrt(mean(p.map((q) => (q - m) ** 2))); };
  assert.ok(spread(1.6, 2.6) > 3 * spread(0.15, 0.5) && spread(1.6, 2.6) > 6, `pitch spread ${spread(0.15, 0.5).toFixed(1)} cents early, ${spread(1.6, 2.6).toFixed(1)} cents late`);
  const hiss = (n) => band(sax(62, 0.6, 1.2, { vibrato: 0, scoop: 0, noise: n, tone: 9000 }, SR), 6000, 10000, 24000, 52800);   const two = (n) => { const o = { noise: n, drift: 0, vibrato: 0, keys: 0 }, a = sax(62, 0.6, 1, o, SR, 3), b = sax(62, 0.6, 1, o, SR, 4); let d = 0; for (let i = 0; i < a.length; i++) d += (a[i] - b[i]) ** 2; return Math.sqrt(d / a.length); }; assert.ok(two(0) < 1e-9 && two(0.2) > 1e-3, 'with breath noise no two notes are the same wave; without it they are');
  const edge = (v) => { const x = sax(62, v, 1.2, { noise: 0 }, SR); return band(x, 1500, 6000, 24000, 52800) / band(x, 100, 6000, 24000, 52800); }; assert.ok(edge(0.9) > 1.4 * edge(0.3), `share of energy above 1.5 kHz, loud over soft: ${(edge(0.9) / edge(0.3)).toFixed(1)}`);
  assert.ok(Math.abs(mean(sax(62, 0.6, 2, {}, SR))) < 5e-4, 'no DC');
});

test('bass guitar: in tune, stiff-string partials, and four ways to play that sound different', () => {
  for (const m of [33, 40, 45, 52]) { const h = harmonics(bassGuitar(m, 0.7, 1.5, {}, SR), spectrum.mtof(m), 0.2); assert.ok(Math.abs(1200 * Math.log2(h[0].f / spectrum.mtof(m))) < 5, `note ${m}`); }
  const f = spectrum.mtof(40), finger = bassGuitar(40, 0.7, 1, {}, SR), ghost = bassGuitar(40, 0.7, 1, { style: 'ghost' }, SR), pop = bassGuitar(40, 0.7, 1, { style: 'pop' }, SR), slap = bassGuitar(40, 0.7, 1, { style: 'slap' }, SR);
  const h = harmonics(finger, f, 0.1); assert.ok(1200 * Math.log2(h[7].f / (8 * h[0].f)) > 2, `the eighth partial is ${(1200 * Math.log2(h[7].f / (8 * h[0].f))).toFixed(1)} cents sharp of a whole multiple`);
  assert.ok(ghost.length < 0.4 * SR && rms(ghost, Math.round(0.14 * SR), ghost.length) < 0.03 * rms(ghost, 0, Math.round(0.05 * SR)), 'a ghost note is gone in a tenth of a second');
  assert.ok(centroid(pop, 0, 24000) > 1.5 * centroid(finger, 0, 24000), 'a pop is brighter than a fingered note'); assert.ok(band(slap, 1500, 5000, 0, 4096) > 1.5 * band(finger, 1500, 5000, 0, 4096), 'a slap starts with a click');
  const hammer = bassGuitar(40, 0.7, 1, { style: 'hammer' }, SR); assert.ok(band(hammer, 1500, 5000, 0, 4096) < 0.5 * band(finger, 1500, 5000, 0, 4096), 'a hammer-on has no new attack');
  assert.deepEqual([stringFor(28), stringFor(33), stringFor(36), stringFor(47)], [{ string: 0, fret: 0 }, { string: 0, fret: 5 }, { string: 1, fret: 3 }, { string: 3, fret: 4 }], 'notes are played low on the neck, on the lowest string that reaches');
  const hard = bassGuitar(40, 0.95, 1, {}, SR); assert.ok(1200 * Math.log2(shortPitch(hard, 0.005, 0.07, f) / shortPitch(hard, 0.3, 0.4, f)) > 2.5, 'a hard pluck is sharp for a moment');
  const again = bassGuitar(40, 0.7, 1, {}, SR, 2); let dot = 0; for (let i = 0; i < 7200; i++) dot += finger[i] * again[i]; assert.ok(dot / (7200 * rms(finger, 0, 7200) * rms(again, 0, 7200)) < 0.97, 'two plucks of one note are not the same wave');
  assert.ok(band(finger, 6000, 12000, 0, 24000) < 2e-3 * band(finger, 40, 6000, 0, 24000), 'the cabinet rolls the top off'); assert.ok(band(finger, 100, 200, 0, 24000) > band(finger, 300, 600, 0, 24000), 'and has its body between 100 and 200 Hz');
  const slid = bassGuitar(40, 0.7, 1, { slideFrom: 38 }, SR); assert.ok(1200 * Math.log2(shortPitch(slid, 0.004, 0.03, f * 0.92) / f) < -60, 'a slide starts on the note it comes from'); assert.ok(Math.abs(1200 * Math.log2(shortPitch(slid, 0.3, 0.4, f) / f)) < 8, 'and lands on the note');
  assert.ok(Math.abs(mean(finger)) < 3e-3, `mean ${mean(finger)}`);
});

test('sub: one clean low tone that starts and stops slowly', () => {
  const x = sub(36, 0.7, 1.5, {}, SR), h = harmonics(x, spectrum.mtof(36), 0.3); assert.ok(Math.abs(1200 * Math.log2(h[0].f / spectrum.mtof(36))) < 5); assert.ok(h[1].db < h[0].db - 14 && h[2].db < h[0].db - 14, 'the fundamental carries it');
  assert.ok(rms(x, 0, 240) < 0.3 * rms(x, 4800, 9600), 'no click at the start'); assert.ok(Math.abs(x[x.length - 1]) < 1e-4);
});
