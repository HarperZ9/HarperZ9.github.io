// The ear's timbre features, its identity judge and its moment-by-moment likeness, each tested on signals whose answer
// is known, and the judge tested on its own book of real instrument notes before it is trusted with ours.
//   node --test system/ear/identity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyse, FEATURES, pitchOf } from './timbre.js';
import { leaveOut, identify, judge, scoreAs } from './identity.js';
import { likeness } from './likeness.js';
import { tone } from './tools/identity.mjs';

const SR = 48000, book = JSON.parse(readFileSync(new URL('./identity-refs.json', import.meta.url), 'utf8'));
// a test note: partials [{ k, a }] of f, a linear rise over `attack` seconds, an exponential decay of `tau` seconds (0: held)
function note(f, partials, { attack = 0.01, tau = 0, dur = 1.5, noise = 0 } = {}) { const x = new Float32Array(Math.round((dur + 0.2) * SR)), at = Math.round(0.1 * SR); let s = 12345;
  for (let i = 0; i < Math.round(dur * SR); i++) { const t = i / SR, e = Math.min(1, t / attack) * (tau ? Math.exp(-t / tau) : 1) * Math.min(1, (dur - t) / 0.02); let y = 0; for (const p of partials) y += p.a * Math.sin(2 * Math.PI * p.k * f * t); s = (s * 1664525 + 1013904223) >>> 0; x[at + i] = 0.3 * e * (y + noise * (s / 2147483648 - 1)); } return x; }

test('timbre: known tones read back as built', () => {
  const f = 220, saw = analyse(tone('saw', 57), SR, { m: 57 }), square = analyse(note(f, [1, 3, 5, 7, 9, 11].map((k) => ({ k, a: 1 / k }))), SR, { m: 57 });
  assert.ok(Math.abs(saw.values.oddEven - -2.87) < 0.4, `a sawtooth's odd harmonics 3 to 9 sit 2.87 dB under its even ones 2 to 8: read ${saw.values.oddEven.toFixed(2)}`);
  assert.ok(square.values.oddEven > 30, `a square wave has no even harmonics: read ${square.values.oddEven.toFixed(1)} dB`);
  assert.ok(Math.abs(saw.harmDb[1] - saw.harmDb[0] + 6.02) < 0.5 && Math.abs(saw.harmDb[3] - saw.harmDb[0] + 12.04) < 0.5, 'a sawtooth falls 6 dB per doubling of harmonic number');
  assert.ok(Math.abs(1200 * Math.log2(pitchOf(tone('saw', 45).subarray(6000), SR) / 110)) < 5, 'pitch by autocorrelation finds 110 Hz');
  const slow = analyse(note(f, [{ k: 1, a: 1 }, { k: 2, a: 0.5 }], { attack: 0.1 }), SR, { m: 57 }), fast = analyse(note(f, [{ k: 1, a: 1 }, { k: 2, a: 0.5 }], { attack: 0.005 }), SR, { m: 57 });
  assert.ok(Math.abs(slow.attackSec - 0.08) < 0.012, `a 100 ms linear rise takes 80 ms from 10 to 90 percent: read ${(slow.attackSec * 1000).toFixed(0)} ms`); assert.ok(fast.attackSec < 0.012);
  const pluck = analyse(note(f, [{ k: 1, a: 1 }, { k: 2, a: 0.5 }], { attack: 0.002, tau: 0.3 }), SR, { m: 57 }); assert.ok(Math.abs(pluck.values.decay - -8.686 / 0.3) < 3, `a 0.3 s exponential decay falls 29 dB per second: read ${pluck.values.decay.toFixed(1)}`); assert.ok(pluck.values.overshoot > 3 && slow.values.overshoot < 0, `a plucked note starts loud (${pluck.values.overshoot.toFixed(1)} dB over its level 150 ms in) and a slow one does not (${slow.values.overshoot.toFixed(1)} dB)`);
  const B = 3e-4, stiff = analyse(note(110, Array.from({ length: 12 }, (_, i) => ({ k: (i + 1) * Math.sqrt(1 + B * (i + 1) ** 2), a: 1 / (i + 1) }))), SR, { m: 45 }); assert.ok(Math.abs(stiff.B - B) < 0.6e-4, `inharmonicity ${B} read as ${stiff.B.toExponential(2)}`);
  const clean = analyse(note(f, [{ k: 1, a: 1 }, { k: 2, a: 0.5 }]), SR, { m: 57 }), airy = analyse(note(f, [{ k: 1, a: 1 }, { k: 2, a: 0.5 }], { noise: 0.3 }), SR, { m: 57 }); assert.ok(airy.values.noise > clean.values.noise + 15, `noise between the harmonics: ${clean.values.noise.toFixed(0)} dB clean, ${airy.values.noise.toFixed(0)} dB with noise added`);
  assert.equal(saw.vector.length, FEATURES.length); assert.ok(saw.vector.every(Number.isFinite));
});

test('identity: the judge tells real instruments apart before it judges ours', () => {
  const r = leaveOut(book), count = (a, b) => r.table[a]?.[b] || 0, total = (a) => Object.values(r.table[a]).reduce((s, v) => s + v, 0);
  assert.ok(r.accuracy >= 0.8, `leave one note out: ${r.right} of ${r.total} reference notes named as their own instrument`);
  const wrong = r.rows.filter((q) => q.heard !== q.cls && q.heard !== 'none').length; assert.ok(wrong / r.total <= 0.12, `a note of one instrument is given another instrument's name in ${wrong} of ${r.total} cases`);
  assert.ok(count('sax', 'clarinet') <= 0.08 * total('sax') && count('clarinet', 'sax') <= 0.12 * total('clarinet'), `saxophone heard as clarinet ${count('sax', 'clarinet')} of ${total('sax')}; clarinet heard as saxophone ${count('clarinet', 'sax')} of ${total('clarinet')}`);
  assert.equal(count('bassguitar', 'upright') + count('upright', 'bassguitar'), 0, 'bass guitar and upright bass are never taken for each other');
  const s = leaveOut(book, { by: 'source', classes: ['sax'] }); assert.ok(s.accuracy >= 0.7, `saxophone from a source held back whole: ${s.right} of ${s.total} still named saxophone`);
});

test('identity: a sine and a sawtooth resemble no instrument, at any pitch; a wrong claim scores worse than the right one', () => {
  for (const kind of ['sine', 'saw']) for (const m of [36, 43, 50, 57, 62, 67, 72, 79]) { const v = identify(tone(kind, m), SR, book, { m }); assert.equal(v.heard, 'none', `${kind} at MIDI ${m} was heard as ${v.heard}: ${v.reason}`); }
  let better = 0, n = 0; for (const r of book.refs) { if (r.cls !== 'clarinet') continue; const skip = (q) => q === r, own = scoreAs(r.v, r.m, book, 'clarinet', { skip }), other = scoreAs(r.v, r.m, book, 'sax', { skip }); if (!Number.isFinite(other)) continue; n++; if (own < other) better++; }
  assert.ok(better / n >= 0.75, `a clarinet note scores nearer to clarinet than to saxophone in ${better} of ${n} cases`);
  assert.equal(judge(book.refs[0].v, 150, book).heard, 'none', 'a pitch with no reference note near it is not judged');
});

test('likeness: zero for a note against itself, level does not count, a different tone is far', () => {
  const a = tone('saw', 57), quiet = a.map((v) => v * 0.2), sine = tone('sine', 57);
  assert.ok(likeness(a, SR, a, SR) < 1e-6); assert.ok(likeness(a, SR, quiet, SR) < 0.2, 'the same note 14 dB down is the same picture'); assert.ok(likeness(a, SR, sine, SR) > 10, `sawtooth against sine: ${likeness(a, SR, sine, SR).toFixed(1)} dB`);
  const late = new Float32Array(a.length + 4800); late.set(a, 4800); assert.ok(likeness(a, SR, late, SR) < 1.5, 'the notes are lined up at their onsets');
});
