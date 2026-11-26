// estuary-lantern.test.mjs: unit tests for Saint-Joseph lantern geometry,
// spectral apertures, canvas renderer, and estuary.html static invariants.
// Run: node --test tests/estuary-lantern.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ESTUARY_PROPERTIES, measureContinuity } from '../world/site/surfaces/estuary-field.mjs';
import {
  LANTERN_PRESETS,
  OBSERVER_LENSES,
  computeApertureSpectrum,
  computeLanternFrame,
  createHarmonicSynth,
  createLanternLattice,
  renderLanternCanvas,
} from '../world/site/surfaces/estuary-lantern.mjs';

const MODULE_URL = new URL('../world/site/surfaces/estuary-lantern.mjs', import.meta.url);
const ROOM_URL = new URL('../world/site/surfaces/room-estuary.mjs', import.meta.url);
const HTML_URL = new URL('../playground/index.html', import.meta.url);
const LOCAL_PATH_RE = /(?:[A-Za-z]:\\|\/Users\/|\/home\/|file:\/\/)/;

test('createLanternLattice builds valid bounded apertures and scales mullions with cad weight', () => {
  const lightCad = createLanternLattice({ cols: 10, rows: 6, cadWeight: 0.1 });
  const heavyCad = createLanternLattice({ cols: 10, rows: 6, cadWeight: 0.9 });

  assert.equal(lightCad.apertures.length, 60);
  assert.equal(heavyCad.apertures.length, 60);
  assert.ok(heavyCad.mullionFrac > lightCad.mullionFrac, 'mullions thicken as cad weight increases');
  assert.ok(heavyCad.frameMargin > lightCad.frameMargin, 'outer frame thickens with cad weight');
  assert.ok(heavyCad.apertures[0].w < lightCad.apertures[0].w, 'apertures narrow as concrete skeleton thickens');

  for (const ap of heavyCad.apertures) {
    assert.ok(ap.x > 0 && ap.y > 0 && ap.w > 0 && ap.h > 0);
    assert.ok(ap.x + ap.w < 1 && ap.y + ap.h < 1, 'aperture stays inside normalized lantern bounds');
    assert.ok(ap.u > 0 && ap.u < 1 && ap.v > 0 && ap.v < 1);
  }
  assert.ok(heavyCad.apertures.some((ap) => ap.isPrimaryBay));
  assert.ok(heavyCad.apertures.some((ap) => !ap.isPrimaryBay));
});

test('computeApertureSpectrum blends continuously and freezes deterministically under reducedMotion', () => {
  const weights = { refraction: 0.85, fluid: 0.65, measure: 0.4, cad: 0.5, sound: 0.7 };
  const s0 = computeApertureSpectrum(weights, 0.35, 0.6, 0.0, true);
  const s9 = computeApertureSpectrum(weights, 0.35, 0.6, 9.7, true);
  assert.deepEqual(s0, s9, 'reducedMotion must ignore time and produce a settled still');

  for (const ch of [s0.r, s0.g, s0.b]) {
    assert.ok(Number.isInteger(ch) && ch >= 0 && ch <= 255);
  }
  assert.ok(s0.alpha >= 0 && s0.alpha <= 1);
  assert.ok(s0.glowRadius > 0);

  const contAlpha = measureContinuity((t) => computeApertureSpectrum({ refraction: t, fluid: 1 - t }, 0.5, 0.5, 0, true).alpha, { steps: 32 });
  const contGlow = measureContinuity((t) => computeApertureSpectrum({ refraction: t, fluid: 1 - t }, 0.5, 0.5, 0, true).glowRadius, { steps: 32 });
  assert.equal(contAlpha.continuous, true, 'spectral alpha must blend continuously');
  assert.equal(contGlow.continuous, true, 'spectral glowRadius must blend continuously');
  const lowRef = computeApertureSpectrum({ refraction: 0.1, fluid: 0.5 }, 0.5, 0.5, 0, true);
  const highRef = computeApertureSpectrum({ refraction: 0.9, fluid: 0.5 }, 0.5, 0.5, 0, true);
  assert.ok(highRef.r > lowRef.r, 'refraction weight warms red spectral channel');
});

test('computeLanternFrame integrates field, topology, metamers, and deterministic receipts', () => {
  assert.deepEqual(OBSERVER_LENSES, ['visual-luminance', 'temporal-cadence', 'structural-density']);

  const settled = computeLanternFrame({ ...LANTERN_PRESETS.estuary, seed: 42, time: 3.5, reducedMotion: true });
  const repeat = computeLanternFrame({ ...LANTERN_PRESETS.estuary, seed: 42, time: 99.1, reducedMotion: true });
  assert.deepEqual(settled, repeat);
  assert.equal(settled.phenotype.mode, 'settled');
  assert.match(settled.receipt.digest, /^fnv1a64:[0-9a-f]{16}$/);
  assert.equal(settled.apertures.length, 60);
  assert.ok(Number.isInteger(settled.homology.beta0) && settled.homology.beta0 >= 0);
  assert.ok(Number.isInteger(settled.homology.beta1) && settled.homology.beta1 >= 0);
  assert.ok(Number.isInteger(settled.homology.winding));

  const cadence = computeLanternFrame({ ...LANTERN_PRESETS.cadenceMetamer, seed: 42, reducedMotion: true });
  assert.equal(cadence.metamer.observer, 'temporal-cadence');
  assert.equal(cadence.metamer.isMetamer, true, 'cadenceMetamer preset must trigger a true metamer');

  const density = computeLanternFrame({ ...LANTERN_PRESETS.densityMetamer, seed: 42, reducedMotion: true });
  assert.equal(density.metamer.observer, 'structural-density');
  assert.equal(density.metamer.isMetamer, true, 'densityMetamer preset must trigger a true metamer');
});

test('renderLanternCanvas draws concrete lattice and glass apertures on a 2D context', () => {
  const calls = { fillRect: 0, strokeRect: 0, arc: 0, radial: 0 };
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillRect() { calls.fillRect++; },
    strokeRect() { calls.strokeRect++; },
    arc() { calls.arc++; },
    createRadialGradient() {
      calls.radial++;
      return { addColorStop() {} };
    },
  };
  const frame = computeLanternFrame({ ...LANTERN_PRESETS.estuary, seed: 42, reducedMotion: true });
  renderLanternCanvas(ctx, 720, 430, frame);

  assert.equal(calls.radial, 60, 'one diffused radial glow per aperture');
  assert.ok(calls.fillRect >= 121, 'background plus glow and pane fills');
  assert.ok(calls.strokeRect >= 61, 'outer concrete frame plus 60 aperture mullions');
});

test('createHarmonicSynth stays idle until explicitly started by user click', () => {
  const synth = createHarmonicSynth();
  assert.equal(synth.isPlaying(), false);
  synth.stop();
  assert.equal(synth.isPlaying(), false);
});

test('playground/index.html, room-estuary.mjs, and estuary-lantern.mjs satisfy accessibility, import, and hygiene invariants', () => {
  const html = readFileSync(HTML_URL, 'utf8');
  const mod = readFileSync(MODULE_URL, 'utf8');
  const roomMod = readFileSync(ROOM_URL, 'utf8');

  // Module size and hygiene
  assert.ok(mod.split('\n').length <= 300, 'estuary-lantern.mjs must stay at or under 300 lines');
  assert.equal(mod.includes('\u2014'), false, 'module must contain zero em dashes');
  assert.equal(roomMod.includes('\u2014'), false, 'room-estuary.mjs must contain zero em dashes');
  assert.equal(html.includes('\u2014'), false, 'playground/index.html must contain zero em dashes');
  assert.equal(LOCAL_PATH_RE.test(mod), false, 'module must contain zero local paths');
  assert.equal(LOCAL_PATH_RE.test(roomMod), false, 'room-estuary.mjs must contain zero local paths');
  assert.equal(LOCAL_PATH_RE.test(html), false, 'playground/index.html must contain zero local paths');

  // Unified Playground integrates Estuary room with luminous build-time still and zero autoplay
  assert.ok(html.includes('id="estuary"'), 'playground/index.html must host #estuary');
  assert.ok(html.includes('class="est-still-svg"'), 'playground/index.html must render non-black Perret lantern still');
  assert.equal(/\bautoplay\b/i.test(html), false, 'page must not autoplay audio or media');
  assert.ok(roomMod.includes('id="ctrl-audio"') && roomMod.includes('aria-pressed="false"'));
  assert.ok(roomMod.includes('Listen to harmonic metamer'));
  assert.ok(roomMod.includes('renderLanternCanvas'));

  // Accessible landmarks and controls
  assert.ok(html.includes('<main id="main"'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(roomMod.includes('id="ctrl-mix"'));
  for (const prop of ESTUARY_PROPERTIES) {
    assert.ok(roomMod.includes('id="ctrl-${prop}"') || roomMod.includes(`ctrl-${prop}`), `missing slider for ${prop}`);
  }
  assert.ok(roomMod.includes('OBSERVER_LENSES'));
  assert.ok(html.includes('<b>Verified</b>'));
});
