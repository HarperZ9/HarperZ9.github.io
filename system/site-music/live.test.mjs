// live.test.mjs: what a listener changes while a piece plays (live.js), through the live worker (worker.js).
//   node --test system/site-music/live.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { begin, chunk, set } from './worker.js';
import { GROUPS, settle, tuned, thin, notesIn, isPlain } from './live.js';
import { PIECES } from './pieces.js';
import { compose } from './score.js';
import { renderPiece } from './piece.js';

const sum = (c, ch) => { const n = Math.max(...Object.values(c.parts.main).map((g) => g[ch].length), c.sea[ch].length), out = new Float32Array(n);
  for (const g of Object.values(c.parts.main)) for (let i = 0; i < g[ch].length; i++) out[i] += g[ch][i];
  for (let i = 0; i < c.sea[ch].length; i++) out[i] += c.sea[ch][i] * c.k.main; return out; };

test('the parts of a chunk add up to the mix the page played before', () => {
  begin({ piece: 'glass-hour', seed: 3, sr: 16000 }); const a = [chunk({ bars: 1 }), chunk({ bars: 2 })];
  begin({ piece: 'glass-hour', seed: 3, sr: 16000, parts: true }); const b = [chunk({ bars: 1 }), chunk({ bars: 2 })];
  for (let k = 0; k < 2; k++) {
    assert.deepEqual(Object.keys(b[k].parts.main), GROUPS); assert.equal(b[k].parts.alt, undefined, 'one band unless the blend asks for both');
    const L = sum(b[k], 'L'); let worst = 0; for (let i = 0; i < a[k].L.length; i++) worst = Math.max(worst, Math.abs((L[i] || 0) - a[k].L[i]));
    assert.ok(worst < 5e-4, `chunk ${k}: the parts differ from the mix by ${worst}`);   // each part's tail is cut under -80 dB
    assert.ok(Object.values(b[k].parts.main).every((g) => g.L.length >= b[k].pre + b[k].n), 'no part is cut inside its bars');
    assert.ok(b[k].notes.every((n) => n.t >= 0 && n.t < b[k].n / 16000 + 0.01));
  }
  assert.ok(b[1].notes.length > 0, 'the bars after the first one list their notes');
});

test('tempo, key and density each change what the next bars play', () => {
  begin({ piece: 'low-tide', seed: 9, sr: 12000, parts: true }); const base = chunk({ bars: 1 }); chunk({ bars: 2 });
  const asWritten = chunk({ bars: 2 });
  assert.ok(Math.abs(asWritten.n / 12000 - 2 * 240 / 72) < 0.01);
  // render bars again from the first bar of the last chunk, faster, a fourth up and thinner
  const r = set({ params: { bpm: 90, semis: 5, density: 0.3 }, from: asWritten.firstBar });
  assert.equal(r.from, asWritten.firstBar);
  const changed = chunk({ bars: 2 });
  assert.equal(changed.firstBar, asWritten.firstBar, 'the same bars render again');
  assert.ok(Math.abs(changed.n / 12000 - 2 * 240 / 90) < 0.01, `two bars at 90 beats a minute last ${changed.n / 12000} s`);
  assert.deepEqual(changed.bars.map((b) => b.chords[0]), asWritten.bars.map((b) => { const NOTE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], m = b.chords[0].match(/^([A-G][#b]?)(.*)$/), at = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 }[m[1]]; return NOTE[(at + 5) % 12] + m[2]; }), 'the chords move up a fourth');
  const pitched = (c) => c.notes.filter((n) => n.part === 'bass').map((n) => n.m);
  assert.ok(changed.notes.length < asWritten.notes.length, `density 0.3 plays ${changed.notes.length} notes against ${asWritten.notes.length}`);
  assert.ok(pitched(changed).every((m, i) => pitched(asWritten).includes(m - 5)), 'each bass note left is a written one, a fourth up');
  assert.equal(base.params.bpm, 72); assert.equal(changed.params.bpm, 90);
});

test('rendering bars again with nothing changed gives the same bars, and the second band can join', () => {
  begin({ piece: 'night-school', seed: 4, sr: 12000, parts: true }); chunk({ bars: 1 }); const first = chunk({ bars: 2 });
  set({ from: first.firstBar }); const again = chunk({ bars: 2 });
  assert.equal(again.firstBar, first.firstBar);
  for (const g of ['drums', 'bass', 'keys', 'lead']) { const a = first.parts.main[g].L, b = again.parts.main[g].L; let worst = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) worst = Math.max(worst, Math.abs(a[i] - b[i])); assert.ok(worst < 1e-6, `${g} differs by ${worst}`); }
  set({ bands: ['main', 'alt'], from: first.firstBar }); const both = chunk({ bars: 2 });
  assert.deepEqual(Object.keys(both.parts), ['main', 'alt']); assert.ok(both.k.alt > 0);
  let diff = 0; for (const g of ['keys', 'bass', 'lead']) for (let i = 0; i < 4000; i++) diff += Math.abs(both.parts.main[g].L[both.pre + i] - both.parts.alt[g].L[both.pre + i]);
  assert.ok(diff > 0, 'the second band plays the same bars with other voices');
  set({ bands: ['alt'], from: first.firstBar }); const alt = chunk({ bars: 2 });
  assert.deepEqual(Object.keys(alt.parts), ['alt'], 'the second band alone renders only the second band');
  let same = 0; for (let i = 0; i < 4000; i++) same = Math.max(same, Math.abs(alt.parts.alt.keys.L[alt.pre + i] - both.parts.alt.keys.L[both.pre + i]));
  assert.ok(same < 1e-6, `the second band alone is the same sound as in the blend (${same})`);
});

test('thinning: density 1 is the bar as written, less keeps the downbeat and only drops notes', () => {
  const s = compose('deep-current', { seed: 2, bars: 24 });
  for (const b of s.bars) {
    assert.equal(thin(b, 1, 2), b);
    const t = thin(b, 0.2, 2); assert.ok(notesIn(t) <= notesIn(b));
    assert.deepEqual(t.drums.filter((e) => e.beat === 0), b.drums.filter((e) => e.beat === 0));
    assert.deepEqual(thin(b, 0.2, 2), t, 'the same seed thins the same way');
  }
  const total = (d) => s.bars.reduce((n, b) => n + notesIn(thin(b, d, 2)), 0);
  assert.ok(total(0.2) < total(0.6) && total(0.6) < total(1), `notes at 0.2, 0.6, 1: ${total(0.2)}, ${total(0.6)}, ${total(1)}`);
});

test('settings stay in their ranges, and the plain settings are the piece as written', () => {
  const P = PIECES['clear-line'], s = settle(P, { bpm: 9999, semis: -40, density: 7, gains: { drums: -1, lead: 9 } });
  assert.deepEqual([s.bpm, s.semis, s.density, s.gains.drums, s.gains.lead, s.gains.bass], [180, -6, 1, 0, 1.5, 1]);
  assert.ok(isPlain(P, {})); assert.ok(!isPlain(P, { gains: { keys: 0.5 } }));
  assert.deepEqual(tuned(P, {}).mix, P.mix);
  assert.equal(tuned(P, { gains: { drums: 0 } }).mix.drums, P.mix.drums - 120);
  assert.ok(Math.abs(tuned(P, { gains: { space: 0.5 } }).mix.ambience - (P.mix.ambience - 6.02)) < 0.01, 'the sea follows the space');
});

test('the file renders what was set: the tempo sets its length, fewer notes and a silent group change the sound', () => {
  const sr = 8000, bars = 12, plain = renderPiece('glass-hour', { seed: 6, bars, sr }), fast = renderPiece('glass-hour', { seed: 6, bars, sr, live: { bpm: 125 } });
  const len = (bpm) => Math.round(3 * sr) + bars * Math.round(240 / bpm * sr) + Math.round(12 * sr);
  assert.equal(plain.channels[0].length, len(100)); assert.equal(fast.channels[0].length, len(125));
  const few = renderPiece('glass-hour', { seed: 6, bars, sr, live: { density: 0.2 } }), quiet = renderPiece('glass-hour', { seed: 6, bars, sr, live: { gains: { drums: 0 } } });
  assert.ok(few.bars.reduce((n, b) => n + notesIn(b), 0) < plain.bars.reduce((n, b) => n + notesIn(b), 0));
  const energy = (r) => { let e = 0; const x = r.stems.drums[0]; for (let i = 0; i < x.length; i++) e += x[i] * x[i]; return e; };
  assert.ok(energy(plain) > 0 && energy(quiet) < energy(plain) * 1e-6, 'with the drums at zero the file has no drums');
  assert.ok(Math.abs(quiet.master.lufs + 14) < 0.6, `the file is still brought to the house loudness (${quiet.master.lufs.toFixed(2)} LUFS)`);
});
