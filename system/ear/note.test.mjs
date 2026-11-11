// Known signals for the note measures: is a line played, or stamped out.
//   node --test system/ear/note.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { noteStats, inharmonicity } from './note.js';

const SR = 48000, TAU = 2 * Math.PI, near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: got ${a}, want ${b} +/- ${tol}`);
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// one synthetic note: eight partials, an attack ramp, optional vibrato; `bright` sets the level of the upper partials
function tone(f, dur, { amp = 0.3, attack = 0.01, bright = 0.5, vibrato = 0, phases = null, B = 0 } = {}) {
  const n = Math.round(dur * SR), x = new Float32Array(n), ph = phases || Array(8).fill(0);
  for (let i = 0; i < n; i++) { const t = i / SR, env = Math.min(1, t / attack) * Math.min(1, (dur - t) / 0.03), v = vibrato * Math.sin(TAU * 5.5 * t) / (TAU * 5.5); let y = 0;
    for (let h = 1; h <= 8; h++) y += Math.pow(bright, h - 1) * Math.sin(TAU * f * h * Math.sqrt(1 + B * h * h) * (t + v) + ph[h - 1]); x[i] = amp * env * y; }
  return x;
}
function lay(list, gap = 0.15) { let t = 0.2; const notes = [], total = list.reduce((s, q) => s + q.x.length / SR + gap, 0.5), x = new Float32Array(Math.round(total * SR)); for (const q of list) { x.set(q.x, Math.round(t * SR)); notes.push({ t0: t, t1: t + q.x.length / SR, m: q.m }); t += q.x.length / SR + gap; } return { x, notes }; }

test('a note copied six times reads as copies; six plucks with their own phases and levels do not', () => {
  const copy = lay(Array.from({ length: 6 }, () => ({ m: 57, x: tone(220, 0.5) }))), r = rng(4), played = lay(Array.from({ length: 6 }, () => ({ m: 57, x: tone(220 * (1 + 0.002 * (r() - 0.5)), 0.5, { phases: Array.from({ length: 8 }, () => r() * TAU), bright: 0.35 + 0.3 * r() }) })));
  const a = noteStats(copy.x, SR, copy.notes), b = noteStats(played.x, SR, played.notes);
  assert.equal(a.repeatPairs, 5); assert.ok(a.repeatMean > 0.995 && a.copyShare === 1, `copies: ${a.repeatMean}`); assert.equal(b.copyShare, 0); assert.ok(b.repeatMean < 0.85, `played: ${b.repeatMean}`);
});

test('attack time, flux inside a note, and brightness against level are read back', () => {
  const slow = lay([0, 1, 2, 3].map(() => ({ m: 57, x: tone(220, 0.6, { attack: 0.05 }) }))), fast = lay([0, 1, 2, 3].map(() => ({ m: 57, x: tone(220, 0.6, { attack: 0.004 }) })));
  near(noteStats(slow.x, SR, slow.notes).attackMs, 40, 8, 'a 50 ms ramp, 10 to 90 percent'); assert.ok(noteStats(fast.x, SR, fast.notes).attackMs < 8, 'a 4 ms ramp');
  const still = lay([0, 1, 2].map(() => ({ m: 57, x: tone(220, 1) }))), moving = lay([0, 1, 2].map(() => ({ m: 57, x: tone(220, 1, { vibrato: 0.02 }) })));
  const fs = noteStats(still.x, SR, still.notes).flux, fm = noteStats(moving.x, SR, moving.notes).flux; assert.ok(fs < 2e-4 && fm > 10 * fs && fm > 1e-3, `flux: frozen ${fs}, with vibrato ${fm}`);
  const levels = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4], flat = lay(levels.map((a) => ({ m: 57, x: tone(220, 0.5, { amp: a }) }))), alive = lay(levels.map((a) => ({ m: 57, x: tone(220, 0.5, { amp: a, bright: 0.2 + 1.2 * a }) })));
  near(noteStats(flat.x, SR, flat.notes).levelSlope, 0, 0.03, 'the same tone at six levels'); assert.ok(noteStats(alive.x, SR, alive.notes).levelSlope > 0.15, 'a tone that brightens as it gets louder');
});

test('inharmonicity of a stiff string is recovered from its partials', () => {
  const B = 2e-4, x = tone(82.4, 1.4, { B, bright: 0.8 }); near(inharmonicity(x.subarray(2400), SR, 82.4), B, 0.4e-4, 'B'); near(inharmonicity(tone(82.4, 1.4, { bright: 0.8 }).subarray(2400), SR, 82.4), 0, 0.3e-4, 'an ideal string');
});
