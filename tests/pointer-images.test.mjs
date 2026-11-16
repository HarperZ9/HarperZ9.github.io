// The drawn pointer's images: every state at both scales, its hot spot on the nib's tip, its edge readable on any
// ground, and the colour routines it is shaded with held to known answers.
//
//   node --test tests/pointer-images.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DIR = path.join(ROOT, 'world/ui/shell/pointer');
const PNG = require(path.join(ROOT, 'scripts/pointer/png.cjs'));
const S = require(path.join(ROOT, 'scripts/pointer/spectral.cjs'));
const record = JSON.parse(fs.readFileSync(path.join(DIR, 'pointer.json'), 'utf8'));

const images = [];
for (const [setting, { states }] of Object.entries(record.settings)) for (const st of states) {
  const frames = record.states[st].frames;
  for (let f = 0; f < (frames || 1); f++) for (const scale of [1, 2]) images.push({ name: `${setting}-${st}${frames ? `-${f}` : ''}${scale === 2 ? '@2x' : ''}.png`, scale, hot: record.states[st].hot });
}

// the five grounds the pointer was judged on: light wall, deep water, lit water, cream, red
const GROUNDS = { 'light wall': [0xe8, 0xe3, 0xd9], 'deep water': [0x0c, 0x16, 0x20], 'lit water': [0x3a, 0x6f, 0xb5], cream: [0xf9, 0xf4, 0xe8], red: [0xe2, 0x4f, 0x32] };
const lum = (c) => { const [r, g, b] = c.map((v) => S.decode(v / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

test('every state and setting has its image at 32 and 64 pixels', () => {
  assert.ok(images.length >= 90, `only ${images.length} images listed`);
  for (const im of images) {
    const { w, h } = PNG.decode(fs.readFileSync(path.join(DIR, im.name)));
    assert.equal(w, 32 * im.scale, im.name); assert.equal(h, 32 * im.scale, im.name);
  }
});

test('the hot spot sits on the form, and the form reaches no further up and left than it (the nib tip)', () => {
  for (const im of images) {
    const { w, rgba } = PNG.decode(fs.readFileSync(path.join(DIR, im.name)));
    const A = (x, y) => rgba[(y * w + x) * 4 + 3];
    const [hx, hy] = im.hot.map((v) => v * im.scale);
    assert.ok(A(hx, hy) >= 128, `${im.name}: no form under the hot spot (${hx}, ${hy})`);
    if (/-(give|pressed)/.test(im.name)) {   // the lit ring lies round the tip, centred on it
      assert.ok(A(hx, hy - Math.round(3.4 * im.scale)) >= 128 || /pressed/.test(im.name), `${im.name}: the ring is not round the hot spot`);
    } else if (im.hot[0] !== 16) {   // the stylus states: nothing solid lies beyond the tip toward the upper left
      const margin = 2 * im.scale;
      for (let y = 0; y < hy - margin; y++) for (let x = 0; x < hx - margin; x++) assert.ok(A(x, y) < 128, `${im.name}: solid at (${x}, ${y}) beyond the tip`);
    }
  }
});

test('the edge holds 3 to 1 against each of the five grounds all the way round', () => {
  const worst = {}, fails = [];
  for (const im of images) {
    const { w, rgba } = PNG.decode(fs.readFileSync(path.join(DIR, im.name)));
    const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= w ? 0 : rgba[(y * w + x) * 4 + 3]);
    for (const [gname, g] of Object.entries(GROUNDS)) {
      const lg = lum(g);
      const over = (x, y) => { const o = (y * w + x) * 4, a = rgba[o + 3] / 255; return lum([0, 1, 2].map((c) => rgba[o + c] * a + g[c] * (1 - a))); };
      let edge = 0, held = 0;
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
        if (A(x, y) < 128 || (A(x - 1, y) >= 128 && A(x + 1, y) >= 128 && A(x, y - 1) >= 128 && A(x, y + 1) >= 128)) continue;
        edge++;
        // the edge is the key line and the rim inside it: the outermost solid pixel or one of the next two inward
        let best = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (A(x + dx, y + dy) >= 128) best = Math.max(best, ratio(over(x + dx, y + dy), lg));
        if (best >= 3) held++;
      }
      const share = held / edge;
      const k = `${im.name} on ${gname}`;
      worst[k] = share;
      if (share < 1) fails.push(`${k}: ${edge - held} of ${edge} edge pixels under 3 to 1`);
    }
  }
  assert.deepEqual(fails, []);
});

test('the colour routines give the known answers', () => {
  assert.ok(Math.abs(S.fresnel(1.5, 0, 1) - 0.04) < 1e-12, 'glass at n = 1.5 reflects 4 percent at normal incidence');
  assert.ok(S.fresnel(1.5, 0, 0) > 0.999, 'every surface is a mirror at grazing incidence');
  const gold = S.byId.gold, i550 = S.GRID.indexOf(550), i450 = S.GRID.indexOf(450);
  assert.ok(S.fresnel(gold.n.value[i550 + 20], gold.k.value[i550 + 20], 1) > S.fresnel(gold.n.value[i450], gold.k.value[i450], 1) + 0.3, 'gold reflects red far more than blue');
  const white = S.xyz(new Array(S.GRID.length).fill(1), S.LIGHTS.D65);
  assert.ok(Math.abs(white[1] - 1) < 1e-12 && Math.abs(white[0] - 0.9505) < 2e-3 && Math.abs(white[2] - 1.089) < 2e-3, `D65 white ${white}`);
  assert.ok(Math.abs(S.decode(0.5) - 0.2140411404822) < 1e-9, 'colour.srgb_transfer/1: decode 0.5');
  assert.ok(Math.abs(S.encode(S.decode(0.73)) - 0.73) < 1e-12);
});

test('the build names the record behind every surface, and marks the platform lacquers as not measured', () => {
  for (const [setting, { made_of }] of Object.entries(record.settings)) {
    for (const part of ['nib', 'ferrule', 'tip', 'barrel']) assert.ok(made_of[part], `${setting}: no record for its ${part}`);
    if (['day', 'night', 'sky'].includes(setting)) assert.match(made_of.barrel, /dye layer .* under a pmma coat/);
    else assert.match(made_of.barrel, /not a measured dye/);
  }
  assert.match(record.records.commit, /^[0-9a-f]{40}$/);
});
