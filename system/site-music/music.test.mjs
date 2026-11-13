// The composer, the renderer, the sea and the live renderer.
//   node --test system/site-music/music.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, voice, TYPES } from './chords.js';
import { PIECES, PIECE_IDS } from './pieces.js';
import { compose, composer, shapeOf } from './score.js';
import { HUMAN } from './parts.js';
import { renderBars, mixStems, swung, timeline, TAIL } from './render.js';
import { createAmbience, DUCK } from './ambience.js';
import { limit, renderPiece } from './piece.js';
import { begin, chunk, setLevel, LEVELS, BUDGET } from './worker.js';
import { barsFor } from './tools/render.mjs';
import { integratedLufs } from '../../world/studio/lib/loudness.mjs';
import { spectrum } from '../ear/index.js';

const mean = (x) => x.reduce((a, b) => a + b, 0) / x.length, rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };

test('chords: every symbol in every piece parses, and voice leading keeps the hand still', () => {
  for (const id of PIECE_IDS) for (const sec of Object.values(PIECES[id].sections)) { let prev = null, moved = 0, n = 0;
    for (const bar of sec) for (const sym of bar.split(' ')) { if (sym === '=') continue; const c = parse(sym), v = voice(sym, prev); assert.ok(TYPES[c.type]); assert.equal(v.length, 4); assert.ok(v[0] >= 52 && v[3] <= 75, `${sym} voiced ${v}`);
      for (const m of v) assert.ok(TYPES[c.type].voice.map((i) => (c.root + i) % 12).includes(m % 12)); if (prev) { moved += v.reduce((s, x, i) => s + Math.abs(x - prev[i]), 0); n++; } prev = v; }
    assert.ok(moved / n / 4 < 3.5, `${id}: mean motion per voice ${moved / n / 4} semitones`); parse(PIECES[id].tonic); PIECES[id].cadence.forEach(parse); }
  assert.throws(() => parse('Hm9'));
});

test('shape: every piece has an introduction, statements, a contrasting middle, a return and an ending that resolves', () => {
  for (const id of PIECE_IDS) {
    const P = PIECES[id], n = barsFor(id), s = compose(id, { seed: 2, bars: n }), roles = s.shape.map((x) => x.role);
    assert.equal(s.bars.length, n); assert.equal(s.shape.reduce((a, x) => a + x.bars, 0), n); assert.deepEqual(roles.slice(0, 3), ['intro', 'statement', 'statement']); assert.ok(roles.includes('middle') && roles[roles.length - 2] === 'return' && roles[roles.length - 1] === 'ending', `${id}: ${roles}`);
    const mid = s.bars.find((b) => b.role === 'middle'), ret = s.bars.find((b) => b.role === 'return'), first = s.bars.find((b) => b.role === 'statement');
    assert.equal(mid.section, P.middle); assert.equal(ret.section, 'A'); assert.equal(first.section, 'A'); const roots = (role) => s.bars.filter((b) => b.role === role).slice(0, 8).map((b) => b.chords[0].root).join(' '); assert.notEqual(roots('middle'), roots('statement'), 'the middle goes somewhere else');
    assert.deepEqual(s.bars.slice(-3).map((b) => parse(b.chords[0].sym).root), [...P.cadence.map((c) => parse(c).root), parse(P.tonic).root], `${id}: the ending is ii, V, home`);
    const last = s.bars[n - 1]; assert.equal(last.drums.length, 0); assert.ok(last.keys.length === 1 && last.keys[0].beats > 3 && last.bass.length + last.sub.length === 1, 'the home chord is held');
  }
  assert.deepEqual(shapeOf(PIECES['low-tide'], 52).map((x) => `${x.role}:${x.bars}`), ['intro:4', 'statement:8', 'statement:8', 'middle:8', 'return:8', 'return:8', 'ending:8']);
});

test('entries are staged: pad, piano, bass, a whisper of the kit, the light kit, the full kit, then the lead', () => {
  for (const id of PIECE_IDS) {
    const P = PIECES[id], s = compose(id, { seed: 5, bars: 60 }), i0 = P.intro, at = (k, f) => s.bars.findIndex((b) => f(b)), low = (b) => b.bass.length + b.sub.length;
    const order = [at(0, (b) => b.pad.length), at(0, (b) => b.keys.length), at(0, low), at(0, (b) => b.level === 'light'), at(0, (b) => b.level === 'full'), at(0, (b) => b.lead.length)];
    for (let k = 1; k < order.length; k++) assert.ok(order[k] > order[k - 1], `${id}: first bars of pad, keys, bass, light kit, full kit, lead are ${order}`);
    assert.equal(order[2], i0, 'the bass enters with the first statement'); assert.deepEqual(s.bars.slice(i0, i0 + 5).map((b) => b.level), ['none', 'whisper', 'light', 'light', 'full']); assert.ok(order[5] > i0 + 4, 'the lead waits for the full band');
    const all = compose(id, { seed: 5, bars: 60, staged: false }); assert.ok(all.bars[i0].drums.length > 3 && low(all.bars[i0]) > 0, 'unstaged (the planted defect) starts the band at once');
  }
});

test('no two eight-bar sections are played the same, each ends with a fill, and the planted loop does repeat', () => {
  for (const id of PIECE_IDS) {
    const P = PIECES[id], s = compose(id, { seed: 3, bars: barsFor(id) }), body = s.bars.slice(P.intro, s.bars.length - s.shape[s.shape.length - 1].bars), secs = []; for (let k = 0; k + 8 <= body.length; k += 8) secs.push(body.slice(k, k + 8));
    const sig = (sec) => JSON.stringify(sec.map((b) => [b.keys.map((e) => [e.beat, e.notes]), b.bass.map((e) => [e.beat, e.m]), b.sub.map((e) => [e.beat, e.m]), b.drums.map((e) => [e.beat, e.piece])]));
    assert.equal(new Set(secs.map(sig)).size, secs.length, `${id}: ${secs.length} sections, all different`);
    for (const sec of secs.slice(1)) if (sec[0].role !== 'breakdown') assert.ok(sec[7].drums.length > sec[5].drums.length || sec[7].keys.length > sec[5].keys.length || sec[7].bass.length > sec[5].bass.length, `${id}: the last bar of a section carries a fill`);
    const lp = compose(id, { seed: 3, bars: 44, loop: true }), a = lp.bars.slice(P.intro, P.intro + 8), b = lp.bars.slice(P.intro + 8, P.intro + 16); assert.equal(sig(a), sig(b), 'the loop defect repeats the statement');
  }
});

test('the lead develops one theme: stated, answered, varied, turned over in the middle, restated on the return, closed at home', () => {
  for (const id of PIECE_IDS) {
    const P = PIECES[id], s = compose(id, { seed: 4, bars: barsFor(id) }), notes = s.bars.flatMap((b) => b.lead.map((n) => ({ ...n, bar: b.index, role: b.role, abs: b.index * 4 + n.beat }))), phrases = []; for (const n of notes) { const p = phrases[phrases.length - 1]; if (p && p.kind === n.kind && n.abs - p.notes[p.notes.length - 1].abs < 4 * (P.lead.stretch || 1)) p.notes.push(n); else phrases.push({ kind: n.kind, role: n.role, notes: [n] }); }
    const kinds = phrases.map((p) => p.kind); assert.equal(kinds[0], 'theme'); assert.ok(kinds.includes('answer') && kinds.includes('reprise') && kinds[kinds.length - 1] === 'close', `${id}: ${kinds}`);
    assert.ok(phrases.filter((p) => p.role === 'middle').every((p) => ['sequence', 'inversion', 'augmented'].includes(p.kind)), 'the middle develops');
    const theme = phrases[0].notes, rep = phrases.find((p) => p.kind === 'reprise').notes, gaps = (ns) => ns.slice(1).map((n, i) => +(n.abs - ns[i].abs).toFixed(3));
    assert.deepEqual(gaps(rep), gaps(theme), `${id}: the reprise has the theme's rhythm`); assert.ok(Math.abs(rep[0].m - theme[0].m) <= 3, `and starts in the same place (${rep[0].m} against ${theme[0].m}; the chord under it may differ)`);
    const home = parse(P.tonic), end = phrases[phrases.length - 1].notes; assert.ok([home.pcs[0], home.pcs[1]].includes(end[end.length - 1].m % 12), `${id}: the last note is the root or third of the home chord`);
    const withLead = s.bars.filter((b) => b.lead.length).length; assert.ok(withLead > 5 && withLead < 0.62 * s.bars.length, `${id}: lead in ${withLead} of ${s.bars.length} bars`);
    for (const n of notes) { assert.ok(n.m >= P.lead.range[0] && n.m <= P.lead.range[1]); if (n.beats > 1) { const ch = s.bars[n.bar].chords.filter((q) => q.beat <= n.beat).pop(); assert.ok(ch.pcs.includes(n.m % 12) || home.pcs.includes(n.m % 12), `${id} bar ${n.bar + 1}: long lead note ${n.m} over ${ch.sym}`); } }
  }
});

test('humanised playing stays inside its stated bounds, and the same seed gives the same score', () => {
  for (const id of PIECE_IDS) {
    const P = PIECES[id], a = compose(id, { seed: 7, bars: 44 }), b = compose(id, { seed: 7, bars: 44 }), c = compose(id, { seed: 8, bars: 44 }), h = P.human; assert.deepEqual(a.bars, b.bars); assert.notDeepEqual(a.bars.map((x) => x.keys), c.bars.map((x) => x.keys));
    let moved = 0;
    for (const bar of a.bars) { for (const k of ['keys', 'bass', 'sub', 'drums', 'lead', 'pad']) for (const e of bar[k]) { assert.ok(e.beat >= 0 && e.beat < 4, `${id} bar ${bar.index} ${k} at beat ${e.beat}`); assert.ok(e.vel > 0 && e.vel <= 0.95); }
      for (const e of bar.keys) { assert.ok(Math.abs(e.j) <= HUMAN.keysMs * h / 1000 + 1e-9); moved += Math.abs(e.j); } for (const e of bar.bass) assert.ok(Math.abs(e.j) <= HUMAN.bassMs * h / 1000 + 1e-9);
      for (const e of bar.drums) assert.ok(Math.abs(e.j) <= (e.piece.endsWith('kick') ? HUMAN.kickMs : HUMAN.drumsMs) * h / 1000 + 1e-9); for (const e of bar.lead) assert.ok(e.j >= HUMAN.leadLateMs[0] * h / 1000 - 1e-9 && e.j <= HUMAN.leadLateMs[1] * h / 1000 + 1e-9, 'the lead is late, never early'); }
    assert.ok(moved > 0, 'timing is not mechanical');
  }
  const live = composer('night-school', { seed: 9 }); for (let i = 0; i < 300; i++) live.next(); assert.equal(live.next().index, 300, 'the endless form keeps going');
});

test('the bands: sub under the break, bass guitar with ghost notes and pops, the kick locked to the bass', () => {
  const d = compose('deep-current', { seed: 1, bars: 76 }), subs = d.bars.flatMap((b) => b.sub), fills = d.bars.flatMap((b) => b.bass);
  assert.ok(subs.length > 60 && subs.every((e) => e.m >= 31 && e.m <= 42), 'the sub stays between G1 and F-sharp 2'); assert.ok(fills.length > 6 && fills.every((e) => e.m >= 50 && e.voice === 'guitar'), 'the bass guitar sits an octave and more above it');
  const roles = d.bars.map((b) => b.role), bd = d.bars.filter((b) => b.role === 'breakdown'); assert.ok(roles.includes('breakdown') && roles.includes('build') && roles.includes('variation') && bd.every((b) => b.drums.length === 0 && b.pad.length + b.keys.length + b.sub.length > 0), 'a breakdown: the kit drops out and the pad, piano and sub carry');
  const whole = compose('deep-current', { seed: 1, bars: barsFor('deep-current') }), third = whole.bars.slice(Math.floor(whole.bars.length * 0.62)); assert.ok(third.some((b) => b.role === 'lift' && b.section === 'D') && !whole.bars.slice(0, 60).some((b) => b.role === 'lift'), 'a new idea arrives in the last third'); assert.ok(whole.kinds.includes('second'), 'with a second theme for the lead');
  assert.ok(d.bars.filter((b) => b.chords[0].held).every((b) => b.pad.length === 0), 'a held chord is not struck again'); assert.ok(d.bars.some((b) => b.drums.some((e) => e.piece === 'fk:snare' && e.vel < 0.2)), 'ghost notes in the break');
  const f = compose('clear-line', { seed: 1, bars: 60 }), bass = f.bars.flatMap((b) => b.bass), styles = new Set(bass.map((e) => e.style));
  assert.ok(styles.has('ghost') && styles.has('pop') && bass.some((e) => e.slideFrom !== undefined), `bass guitar styles ${[...styles]}`);
  const full = f.bars.filter((b) => b.level === 'full' && b.role !== 'ending'); let locked = 0, kicks = 0;
  for (const b of full) for (const k of b.drums.filter((e) => e.piece === 'fk:kick')) { kicks++; if (b.bass.some((e) => e.style !== 'ghost' && Math.abs(e.beat - k.beat) < 1e-9)) locked++; }
  assert.ok(locked / kicks > 0.85, `${locked} of ${kicks} kicks land with a bass note`);
  assert.ok(compose('glass-hour', { seed: 1, bars: 60 }).bars.flatMap((b) => b.bass).some((e) => e.style === 'pop'), 'the bossa has the bass guitar too');
});

test('swing places the off-beat eighth, and the timeline gives the ear the written chords in seconds', () => {
  assert.equal(swung(1.5, 0.62), 1.62); assert.equal(swung(2, 0.62), 2); assert.equal(swung(0.25, 0.6), 0.3);
  const s = compose('low-tide', { seed: 1, bars: 20 }), tl = timeline(s.bars, s.piece, { t0: 3 }), beat = 60 / s.piece.bpm;
  assert.equal(tl.chords[0].t0, 3); assert.ok(Math.abs(tl.chords[1].t0 - (3 + 4 * beat)) < 2e-5, 'bars start on whole samples'); assert.equal(tl.bpm, 72); assert.ok(tl.bass.length > 10, 'the bass notes are listed for the ear'); assert.equal(tl.phraseOffset, 4); assert.ok(tl.rests.length >= 1 && tl.lead.length >= 3);
});

test('a piece rendered in two chunks and overlapped is the same sound as one render', () => {
  for (const id of ['glass-hour', 'deep-current']) {
    const s = compose(id, { seed: 2, bars: 20 }), P = s.piece, sr = 24000, cut = 14;
    const whole = mixStems(renderBars(s.bars.slice(12, 16), P, { sr, seed: 2 }).stems, P), a = renderBars(s.bars.slice(12, cut), P, { sr, seed: 2 }), b = renderBars(s.bars.slice(cut, 16), P, { sr, seed: 2, origin: a.n / sr, defects: { leadOffset: a.leadCount } });
    const ma = mixStems(a.stems, P), mb = mixStems(b.stems, P), sum = new Float32Array(whole.L.length); sum.set(ma.L.subarray(0, Math.min(ma.L.length, sum.length))); for (let i = 0; i < mb.L.length && a.n + i < sum.length; i++) sum[a.n + i] += mb.L[i];
    let worst = 0; for (let i = 0; i < a.pre + a.n + b.n; i++) worst = Math.max(worst, Math.abs(sum[i] - whole.L[i])); assert.ok(worst < 3e-4, `${id}: largest difference ${worst}`);
    assert.equal(whole.L.length, a.pre + a.n + b.n + Math.round(TAIL * sr));
  }
});

test('the sea: continuous across calls, never silent, waves slow and irregular, sea darker than air', () => {
  const sr = 12000, one = createAmbience({ seed: 5, sr }).render(sr * 4), g = createAmbience({ seed: 5, sr }), p1 = g.render(sr * 2), p2 = g.render(sr * 2);
  for (let i = 0; i < sr * 2; i++) { assert.equal(p1.L[i], one.L[i]); assert.equal(p2.R[i], one.R[i + sr * 2]); }
  const amb = createAmbience({ seed: 7, sr, sea: 1, wind: 0, air: 0 }), long = amb.render(sr * 150), env = []; for (let s = 0; s + sr / 2 <= long.L.length; s += sr / 2) env.push(rms(long.L, s, s + sr / 2));
  assert.ok(Math.min(...env) > 1e-4, 'the sea never stops');
  const br = amb.breaks, gaps = br.slice(1).map((t, i) => t - br[i]), m = mean(gaps), sd = Math.sqrt(mean(gaps.map((v) => (v - m) ** 2)));
  assert.ok(br.length >= 9 && m > 6 && m < 16, `${br.length} waves, mean period ${m} s`); assert.ok(sd > 0.8, `period spread ${sd} s`);
  for (const t of br.slice(1, 6)) { const k = Math.round(t * 2); assert.ok(Math.max(...env.slice(k - 1, k + 3)) > 1.5 * Math.min(...env.slice(Math.max(0, k - 8), k - 4)), `the level peaks where a wave breaks (${t.toFixed(1)} s)`); }
  const blocks = [0, 1, 2, 3, 4].map((k) => rms(long.L, k * 30 * sr, (k + 1) * 30 * sr)); assert.ok(Math.max(...blocks) / Math.min(...blocks) > 1.12, 'the tide moves: half-minutes differ in level');
  const slope = (o) => { const x = createAmbience({ seed: 3, sr: 48000, ...o }).render(48000 * 20); return spectrum.slopePerOctave(spectrum.octaveBands(spectrum.averageSpectrum([x.L], 48000)), 125, 8000); };
  assert.ok(slope({ sea: 1, wind: 0, air: 0 }) < slope({ sea: 0, wind: 0, air: 1 }) - 3, 'the sea sits lower than the air');
  const resumed = createAmbience({ seed: 7, sr: 6000, sea: 1, wind: 0, air: 0, position: 60 }); resumed.render(6000 * 30); assert.ok(resumed.breaks.some((t) => t > 60) && Math.abs(resumed.position - 90) < 1e-6, 'a renderer that changes sample rate picks the sea up where it was');
});

test('the sea answers the music: waves break as the lead falls silent, and the level dips under the lead', () => {
  const sr = 8000, rests = [], lead = []; for (let t = 9; t < 290; t += 11.7) { lead.push([t - 5, t]); rests.push(t); }
  const run = (responsive) => { const a = createAmbience({ seed: 4, sr, responsive, wind: 0.5, air: 0.4 }); a.cue({ rests, lead }); const x = a.render(sr * 300); return { x, breaks: a.breaks }; }, on = run(true), off = run(false);
  const met = (br) => rests.filter((t) => br.some((b) => b >= t - 0.1 && b <= t + 1)).length / rests.length; assert.ok(met(on.breaks) > 0.6 && met(on.breaks) > met(off.breaks) + 0.35, `rests met by a breaking wave: ${met(on.breaks).toFixed(2)} with listening, ${met(off.breaks).toFixed(2)} without`);
  // the dip: wind and air alone (no waves to move), the same seed with and without listening, inside the lead and outside it
  const flat = (responsive) => { const a = createAmbience({ seed: 4, sr, responsive, sea: 0, wind: 0.6, air: 0.5 }); a.cue({ lead }); return a.render(sr * 120).L; }, A = flat(true), B = flat(false);
  const ratio = (t0, t1) => 20 * Math.log10(rms(A, Math.round(t0 * sr), Math.round(t1 * sr)) / rms(B, Math.round(t0 * sr), Math.round(t1 * sr)));
  const want = 20 * Math.log10(1 - DUCK); assert.ok(Math.abs(ratio(lead[2][0] + 1.5, lead[2][1]) - want) < 0.3, `under the lead ${ratio(lead[2][0] + 1.5, lead[2][1]).toFixed(2)} dB, want ${want.toFixed(2)}`); assert.ok(Math.abs(ratio(lead[2][1] + 4, lead[3][0] - 0.2)) < 0.1, 'and back to full between phrases');
});

test('the limiter holds every sample under its ceiling and leaves quiet audio alone', () => {
  const n = 48000, L = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin(i / 20) + (i % 9000 === 4000 ? 1.5 : 0)), R = L.slice(), q = L.slice(0, 3000), info = limit(L, R, 48000, { ceilingDb: -2 });
  let pk = 0; for (const v of L) pk = Math.max(pk, Math.abs(v)); assert.ok(pk <= Math.pow(10, -2 / 20) + 1e-6, `peak ${pk}`); assert.ok(info.maxReductionDb > 5);
  for (let i = 0; i < 3000; i++) assert.equal(L[i], q[i]);
});

test('the live renderer: continues bar by bar, steps down inside a measured budget, and each fixed gain lands near the house loudness', (t) => {
  begin({ piece: 'night-school', seed: 5, sr: 24000 }); const a = chunk({ bars: 1 }), b = chunk({ bars: 2 }), c = chunk({ bars: 2 });
  assert.deepEqual([a.firstBar, b.firstBar, c.firstBar], [0, 1, 3]); assert.equal(b.n, 2 * a.n); assert.equal(b.bars.length, 2); assert.equal(a.level, 'full');
  for (const x of [a, b, c]) { let pk = 0, e = 0; for (let i = 0; i < x.L.length; i++) { assert.ok(Number.isFinite(x.L[i]) && Number.isFinite(x.R[i])); pk = Math.max(pk, Math.abs(x.L[i])); } for (let i = x.pre; i < x.pre + x.n; i++) e += x.L[i] * x.L[i]; assert.ok(pk < 1.5, `peak ${pk}`); assert.ok(e / x.n > 1e-7, 'a chunk is never silent: the sea runs through it'); assert.ok(x.ratio > 0 && x.renderMs > 0); }
  assert.throws(() => begin({ piece: 'nope' }));
  // the budget: seconds of rendering per second of audio at each level, on this machine, for the heaviest piece
  const cost = {}; for (let level = 0; level < LEVELS.length; level++) { begin({ piece: 'deep-current', seed: 1, sr: 48000, level }); chunk({ bars: 8 }); let ms = 0, sec = 0; for (let k = 0; k < 4; k++) { const x = chunk({ bars: 4 }); ms += x.renderMs; sec += x.audioSec; assert.equal(x.level, LEVELS[level].name); assert.equal(x.sr, Math.round(48000 * LEVELS[level].rate)); } cost[LEVELS[level].name] = ms / 1000 / sec; }
  t.diagnostic(`render seconds per second of audio (budget ${BUDGET}): ${Object.entries(cost).map(([k, v]) => `${k} ${v.toFixed(3)}`).join(', ')}`);
  assert.ok(cost.full < BUDGET, `full render takes ${cost.full} of real time here`); assert.ok(cost.half < 0.75 * cost.full, `half ${cost.half} against full ${cost.full}`);
  begin({ piece: 'low-tide', seed: 1, sr: 48000 }); chunk({ bars: 2 }); assert.equal(setLevel(2), 'half'); const h = chunk({ bars: 2 }); assert.equal(h.sr, 24000); assert.equal(h.firstBar, 2); assert.ok(Math.abs(h.audioSec - 2 * 240 / 72) < 0.01, 'after a step down the music carries on from the next bar');
  // a device that cannot keep up: with an impossible budget the renderer waits out two warm-up chunks, then steps down twice and stops there
  begin({ piece: 'glass-hour', seed: 1, sr: 24000, budget: 1e-6 }); const seen = []; for (let k = 0; k < 9; k++) { const x = chunk({ bars: 1 }); seen.push(x.level + (x.stepped ? '!' : '')); }
  assert.deepEqual(seen, ['full', 'full', 'full', 'full!', 'lite', 'lite!', 'half', 'half', 'half'], `levels over nine chunks: ${seen}`);
  for (const id of PIECE_IDS) { const p = renderPiece(id, { bars: (PIECES[id].intro ?? 4) + 28, sr: 24000, masterOpts: { gainDb: PIECES[id].masterDb, ceilingDb: 6 } }), l = integratedLufs(p.channels, p.sr); assert.ok(Math.abs(l + 14) < 1.6, `${id}: ${l} LUFS at its fixed gain`); }
});
