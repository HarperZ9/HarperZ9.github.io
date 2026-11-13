// node --test world/site/surfaces/grounds-more.test.mjs
// The woven ground and the three grounds after it, without a browser: each keeps its stated rule, and each is the
// site's own model, called and not copied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURES, computeDraft } from '../../../system/weave-engine.js';
import { negDensities, printPixel } from '../../../media/raw-native/tree-ada041f/web/shaders/film/stocks.mjs';
import { resolveFilm } from '../../../media/raw-native/tree-ada041f/web/shaders/film/film.mjs';
import { draftOf, clothPixels, clothLinks, warpShare, threadSlot, cleanLoom, ENDS, PICKS, TPX } from './cloth.mjs';
import { bias } from './spread.mjs';
import { GROUNDS, RULES, mixOn, behaviour } from './grounds.mjs';
import { filmLook, filmTable, exposure, soundMix, level, spectrogram, temperature, glowLook, SOUND, FILM } from './grounds-more.mjs';
import { pigment, apart, dyed } from './km.mjs';
import { createSim, STEP, NX, NY } from './well-sim.mjs';
import { tones } from './signal.mjs';

const red = [0.6, 0.04, 0.03], green = [0.04, 0.45, 0.05], P = [red, green].map((lin) => ({ lin, pig: pigment(lin, 0.4) })), Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

test('the cloth is the loom engine draft: the texture and the spreading follow which thread is on top', () => {
  const tw = draftOf('twill22'), sat = draftOf('satin5'), pl = draftOf('plain'), px = clothPixels(tw);
  const same = computeDraft(new Float32Array(ENDS * PICKS).fill(0.5), ENDS, PICKS, 'twill22', { toneDrive: 0 });
  for (let p = 0; p < PICKS; p++) for (let e = 0; e < ENDS; e++) { assert.equal(tw.liftAt(e, p), same.liftAt(e, p)); assert.equal(px.data[((p * TPX + 4) * px.w + e * TPX + 4) * 4] > 127, tw.liftAt(e, p), `crossing ${e}, ${p}`); }
  assert.equal(warpShare(pl), 0.5); assert.equal(warpShare(tw), 0.5); assert.ok(warpShare(sat) < 0.25, `the satin shows mostly weft (${warpShare(sat)})`);
  assert.ok(STRUCTURES.satin5.shafts === 5 && px.w === ENDS * TPX);
  // a float on the satin's face runs five crossings, so its texture says so; plain never floats past one
  const longest = (d) => { const q = clothPixels(d); let m = 0; for (let i = 3; i < q.data.length; i += 4) m = Math.max(m, q.data[i]); return m / 32; };
  assert.equal(longest(pl), 1); assert.ok(longest(sat) >= 4, `satin floats run ${longest(sat)} crossings`);
  // spreading: weft on top carries a wash along x, warp along y; a weft-faced satin spreads it sideways, plain does not
  const [sx, sy] = bias(clothLinks(sat)), [px2, py2] = bias(clothLinks(pl)); assert.ok(sx > 2.5 * sy, `satin: ${sx.toFixed(2)} along the weft, ${sy.toFixed(2)} along the warp`); assert.ok(Math.abs(px2 - py2) < 0.05, 'plain weave: even');
  const grow = (w) => { const s = createSim(); s.set([{ weight: 1, drive: { speed: 0, curl: 0, coherence: 0, bleed: 0.5, scale: 0.5 }, links: [0] }]); s.seed(); s.clear(); s.pour(0, 0.5, 0.5, 0.9); s.setMedium(behaviour('thread-textile', { weave: w }));
    const at = () => { let m = 0, vx = 0, vy = 0; const F = s.dye[0]; for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const v = F[y * NX + x]; m += v; vx += v * (x - NX / 2 + 0.5) ** 2; vy += v * (y - NY / 2 + 0.5) ** 2; } return [vx / m, vy / m]; };
    const a = at(); for (let i = 0; i < 200; i++) s.step(STEP, false); const b = at(); return (b[0] - a[0]) / (b[1] - a[1]); };
  assert.ok(grow('satin5') > 2, `on satin a dye runs along the weft (${grow('satin5').toFixed(2)} times as fast across as down)`); assert.ok(Math.abs(grow('plain') - 1) < 0.2, `on plain weave evenly (${grow('plain').toFixed(2)})`);
  assert.deepEqual(cleanLoom({ weave: 'nothing', woven: 'yes' }), { weave: 'twill22', woven: false }); assert.deepEqual([threadSlot(0, 1), threadSlot(0, 3), threadSlot(1, 3), threadSlot(2, 3)], [0, 1, 2, 1]);
});

test('dye on cloth: the thread keeps its colour, dyes add band by band, order does not matter', () => {
  const g = GROUNDS['thread-textile'], none = mixOn('thread-textile', []), one = mixOn('thread-textile', [P[0]]), both = mixOn('thread-textile', P), swap = mixOn('thread-textile', [P[1], P[0]]);
  assert.equal(RULES[g.rule].ordered, false); assert.ok(apart(none, g.base) < 0.5, 'no dye: the thread as it is'); assert.ok(apart(both, swap) < 0.01, 'order does not matter');
  assert.ok(Y(both) < Y(one) && Y(one) < Y(g.base), 'each dye darkens through the thread'); assert.ok(one[0] > 2 * one[1], 'and a red dye turns it red');
  assert.ok(apart(dyed(g.base, [red], [0.2]), g.base) < apart(dyed(g.base, [red], [1]), g.base), 'more dye, more change');
});

test('film stock: the table is the spectral film model, light adds on the negative, and the curves bend', () => {
  const t = resolveFilm(FILM.preset, {}, { w: 900, h: 675 }, { w: 900, h: 675 }).t; let worst = 0;
  for (const e of [0.004, 0.03, 0.11, 0.18, 0.4, 1.3, 3.1]) for (const k of [[1, 1, 1], [1, 0.3, 0.1], [0.2, 0.5, 1]]) { const E = k.map((x) => x * e), want = printPixel(t, negDensities(t, E)).map((x) => Math.min(1, Math.max(0, x))); worst = Math.max(worst, apart(filmLook(E), want)); }
  assert.ok(worst <= 6, `the 17-cube table stays within ${worst.toFixed(1)} of 255 of the full film path`); assert.equal(filmTable().data.length, 17 ** 3 * 4);
  const one = mixOn('film-stock', [P[0]]), both = mixOn('film-stock', P), lin = (x) => filmLook(exposure(GROUNDS['film-stock'].base, [[0.5, 0.5, 0.5]], [x]));
  assert.ok(apart(both, mixOn('film-stock', [P[1], P[0]])) < 0.01, 'order does not matter'); assert.ok(Y(both) > Y(one), 'two lights expose more than one');
  assert.ok(Y(lin(2)) < 1.9 * Y(lin(1)), `twice the light is less than twice as bright on the print (${(Y(lin(2)) / Y(lin(1))).toFixed(2)})`);
});

test('sound: powers add and read in decibels; the ground is a spectrogram made by the sound engine', () => {
  assert.ok(Math.abs(level(2e-2) - level(1e-2) - 10 * Math.log10(2) / SOUND.rangeDb) < 1e-9, 'twice the power reads 3 decibels up');
  const a = soundMix([0.1, 0.12, 0.2], [red], [0.4]), b = soundMix([0.1, 0.12, 0.2], [red, red], [0.2, 0.2]), c = soundMix([0.1, 0.12, 0.2], [red, green], [0.3, 0.1]), d = soundMix([0.1, 0.12, 0.2], [green, red], [0.1, 0.3]);
  assert.ok(apart(a, b) < 0.01, 'two halves are the whole'); assert.ok(apart(c, d) < 0.01, 'order does not matter'); assert.ok(Y(mixOn('sound', P)) > Y(mixOn('sound', [P[0]])), 'more sound is brighter');
  const s = spectrogram(tones([261.63, 329.63, 392.0], 1.2)), row = (hz) => s.h - 1 - Math.round(hz / s.binHz), mean = (r) => { let m = 0; for (let t = 4; t < s.w - 4; t++) m += s.data[(r * s.w + t) * 4]; return m / (s.w - 8); };
  for (const hz of [261.63, 329.63, 392.0]) assert.ok(mean(row(hz)) > mean(row(700)) + 60, `the chord shows at ${hz} hertz`);
  assert.ok(s.w > 100 && s.h === SOUND.n / 2, 'time across, pitch up');
});

test('fire heat: dark pigment burns hotter (Kirchhoff), heat adds, and the glow is a blackbody (Planck)', () => {
  const dark = [0.03, 0.03, 0.03], pale = [0.8, 0.8, 0.8];
  assert.ok(temperature([dark], [1]) > temperature([pale], [1]) + 300, 'a dark pigment takes up more heat than a pale one');
  assert.ok(Math.abs(temperature([dark, dark], [0.5, 0.5]) - temperature([dark], [1])) < 1e-9, 'heat adds');
  const warm = glowLook(1600), hot = glowLook(2400); assert.ok(Y(hot) > Y(warm) && hot[1] / hot[0] > warm[1] / warm[0], 'hotter is brighter and yellower');
  assert.ok(apart(mixOn('fire-heat', P), mixOn('fire-heat', [P[1], P[0]])) < 0.01, 'order does not matter');
});
