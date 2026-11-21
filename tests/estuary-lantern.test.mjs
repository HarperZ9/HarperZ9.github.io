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
const HTML_URL = new URL('../estuary.html', import.meta.url);
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

test('estuary.html and estuary-lantern.mjs satisfy accessibility, import, and hygiene invariants', () => {
  const html = readFileSync(HTML_URL, 'utf8');
  const mod = readFileSync(MODULE_URL, 'utf8');

  // Module size and hygiene
  assert.ok(mod.split('\n').length <= 300, 'estuary-lantern.mjs must stay at or under 300 lines');
  assert.equal(mod.includes('\u2014'), false, 'module must contain zero em dashes');
  assert.equal(html.includes('\u2014'), false, 'estuary.html must contain zero em dashes');
  assert.equal(LOCAL_PATH_RE.test(mod), false, 'module must contain zero local paths');
  assert.equal(LOCAL_PATH_RE.test(html), false, 'estuary.html must contain zero local paths');

  // Valid relative module import
  const importMatch = html.match(/from\s+['"](\.\/world\/site\/surfaces\/estuary-lantern\.mjs)['"]/);
  assert.ok(importMatch, 'estuary.html must import ./world/site/surfaces/estuary-lantern.mjs');
  assert.equal(existsSync(new URL(`../${importMatch[1].replace(/^\.\//, '')}`, import.meta.url)), true);

  // No autoplaying audio
  assert.equal(/\bautoplay\b/i.test(html), false, 'page must not autoplay audio or media');
  assert.ok(html.includes('id="ctrl-audio"') && html.includes('aria-pressed="false"'));
  assert.ok(html.includes('Listen to harmonic metamer'));

  // Accessible landmarks and controls
  assert.ok(html.includes('<a class="skip-link" href="#main">'));
  assert.ok(html.includes('<main id="main"'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes('id="ctrl-mix"'));
  for (const prop of ESTUARY_PROPERTIES) {
    assert.ok(html.includes(`id="ctrl-${prop}"`), `missing slider for ${prop}`);
  }
  for (const lens of OBSERVER_LENSES) {
    assert.ok(html.includes(`value="${lens}"`), `missing observer lens option ${lens}`);
  }

  // Noscript fallback with required links
  const noscriptMatch = html.match(/<noscript>([\s\S]*?)<\/noscript>/i);
  assert.ok(noscriptMatch, '<noscript> fallback must be present');
  for (const href of ['index.html', 'playground/', 'hire.html', 'findings/']) {
    assert.ok(noscriptMatch[1].includes(`href="${href}"`), `<noscript> must link to ${href}`);
  }

  // Architecture & Findings protocols and Verified line
  for (const id of ['topo-beta0', 'topo-beta1', 'topo-winding']) {
    assert.ok(html.includes(`id="${id}"`), `missing homology readout ${id}`);
  }
  for (const title of [
    'Estuary Metamer Compiler',
    'Reseating-Valve Protocol',
    'Symmetry-Manifold Witnessed Memory',
    'Certified Bit-Exact Kernels',
    'Topology, Homology &amp; Monodromy',
    'Biology, Stress-Rest &amp; Looped Compute',
    'Sociology, Economy &amp; Reseating-Valve Ethics',
  ]) {
    assert.ok(html.includes(title), `missing protocol summary: ${title}`);
  }
  assert.ok(html.includes('<strong>Verified:</strong>'));
  assert.ok(html.includes('tests/estuary-homology.test.mjs'));
  assert.ok(html.includes('tests/estuary-field.test.mjs'));
  assert.ok(html.includes('tests/estuary-recombination.test.mjs'));
  assert.ok(html.includes('tests/estuary-lantern.test.mjs'));
});
