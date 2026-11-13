// node --test world/site/surfaces/take-brush.test.mjs
// The plot files' own header, and the two brush fixes: a soft brush's paint is not gated by the tooth, and a wet brush
// picks up the wash under it as well as brushed paint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFile, headerLines } from './take-files.mjs';
import { createLayer, beginStroke, catchOf, held, CW, CH, FX, FY } from './brush-field.mjs';
import { createSim, NX, NY } from './well-sim.mjs';

const w = 160, h = 120, pic = { data: new Uint8Array(w * h * 4).fill(60), w, h }, about = { recipe: 'water 2, ink 1, on paper', graph: 'ab12cd34' };

test('the plot and G-code files say what made them, from which recipe, in which units, and name no other tool', () => {
  const g = makeFile('plot-gcode', pic, [], 'water-ink', about).body, s = makeFile('plot-svg', pic, [], 'water-ink', about).body;
  for (const body of [g, s]) { assert.ok(!/telos/i.test(body), 'no line names the writer\'s old tool'); assert.match(body, /made by the element bench/); assert.match(body, /recipe: water 2, ink 1, on paper, graph ab12cd34/); }
  assert.match(g, /^; units: millimetres \(G21\), absolute moves \(G90\), 190 mm wide/m); assert.match(g, /^G21$/m); assert.match(g, /^G90$/m);
  assert.equal(g.split('\n').filter((l) => l.startsWith(';')).length, 5, 'four lines of the bench and the writer\'s own size line');
  assert.match(s, /^<\?xml[^\n]*\n<!-- made by the element bench[^\n]*-->\n<svg /); assert.ok(!/--[^>]/.test(s.slice(s.indexOf('<!--') + 4, s.indexOf('-->'))), 'the comment holds no double dash');
  assert.equal(headerLines('plot-svg', {})[1], 'recipe: not given');
});

test('soft brushes are not gated by the tooth; dry ones are', () => {
  assert.deepEqual([catchOf('dry-brush'), catchOf('bristle'), catchOf('haze'), catchOf('sponge'), catchOf('wisp'), catchOf('nothing')], [1, 0.5, 0, 0, 0, 0]);
  const L = createLayer(), st = beginStroke(L, 0, 'dry-brush', 1); for (let i = 0; i <= 10; i++) st.add(0.2 + 0.06 * i, 0.5, null, i * 0.02);
  assert.equal(L.catch[Math.round(0.5 * CH) * CW + Math.round(0.5 * CW)], 255, 'a dry stroke stamps full catch where it passed'); assert.ok(L.caught, 'and marks the rows to send');
  const H = createLayer(), hz = beginStroke(H, 0, 'haze', 1); for (let i = 0; i <= 10; i++) hz.add(0.2 + 0.06 * i, 0.5, null, i * 0.02);
  assert.equal(H.catch[Math.round(0.5 * CH) * CW + Math.round(0.5 * CW)], 0, 'a haze stroke stamps none'); assert.ok(held(H)[0] > 0, 'and still lays paint');
});

test('a wet brush picks up the wash under it, and the wash gives up what the brush takes', () => {
  const sim = createSim(); sim.set([0, 1].map(() => ({ weight: 1, drive: { speed: 0, curl: 0, coherence: 0, bleed: 0.5, scale: 0.5 }, links: [0, 0] }))); sim.seed(); sim.clear();
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) sim.lay(1, y * NX + x, 0.8);   // a flat wash of the second pigment
  const before = sim.amounts()[1], stroke = (s) => { const L = createLayer(), b = beginStroke(L, 0, 'bristle', 3, s); for (let i = 0; i <= 30; i++) b.add(0.15 + 0.02 * i, 0.5, null, i * 0.02); return held(L); };
  const dry = stroke(null), wet = stroke(sim);
  assert.equal(dry[1], 0, 'without the wash the stroke holds only its own pigment');
  assert.ok(wet[1] > 1e-4, `with the wash under it the stroke carries some of the wash (${wet[1].toExponential(2)} of the well)`);
  assert.ok(sim.amounts()[1] < before, `and the wash under the stroke is thinner (${before.toFixed(4)} to ${sim.amounts()[1].toFixed(4)})`);
  assert.ok(FX === NX * 10 && FY === NY * 10);
});
