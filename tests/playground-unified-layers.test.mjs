// unified-layers.test.mjs: Unit, physics, bidirectional Patchbay DAG, and planted-tamper
// tests for Wave 33A-1 consolidated Unified /playground/ Studio layer modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as patchbayCore from '../world/site/surfaces/patchbay-core.mjs';
import * as patchbayEngines from '../world/site/surfaces/patchbay-engines.mjs';

import { GLASSES, channelIor, fresnel, refractBuffer } from '../world/site/surfaces/layer-glass-water.mjs';
import { computeLowWaterLight, terrainHeight } from '../world/site/surfaces/layer-low-water-world.mjs';
import { generateWordContour, computeEpicycles, evalEpicycles, audioToHarmonics, harmonicsToAudioFeatures } from '../world/site/surfaces/layer-fourier-spectral.mjs';
import { hexToOklab, oklabToHex, kmGlaze, hexToLin, buildMaterialPalette, gradeRgbaWithPalette } from '../world/site/surfaces/layer-elements-palette.mjs';
import { dissectBytesLayer0, shannonEntropy64, distillToPatchbayOutputs } from '../world/site/surfaces/layer-distill-ingest.mjs';
import { project3D, buildMesh, shadeMeshFaces } from '../world/site/surfaces/layer-3d-mesh.mjs';
import { STUDIO_LAYERS, STACK_PRESETS, createLayerStack, createConsolidatedPatchbay } from '../world/site/surfaces/unified-layer-registry.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SURF = path.resolve(HERE, '../world/site/surfaces');
const MODULE_FILES = [
  'layer-glass-water.mjs',
  'layer-low-water-world.mjs',
  'layer-fourier-spectral.mjs',
  'layer-elements-palette.mjs',
  'layer-distill-ingest.mjs',
  'layer-3d-mesh.mjs',
  'unified-layer-registry.mjs',
];

function makeSyntheticPng(extraTrailBytes = 0) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const chunk = (tag, data) => {
    const n = data.length;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255, ...[...tag].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
  };
  const body = [...sig, ...chunk('IHDR', new Array(13).fill(1)), ...chunk('IDAT', [12, 34, 56, 78, 90, 112]), ...chunk('IEND', [])];
  for (let i = 0; i < extraTrailBytes; i++) body.push((i * 19 + 7) & 255);
  return new Uint8Array(body);
}

function makeSyntheticWav(extraTrailBytes = 0) {
  const dataLen = 32;
  const riffSize = 4 + 24 + 8 + dataLen;
  const b = new Uint8Array(8 + riffSize + extraTrailBytes);
  const dv = new DataView(b.buffer);
  const putStr = (o, s) => [...s].forEach((c, i) => { b[o + i] = c.charCodeAt(0); });
  putStr(0, 'RIFF'); dv.setUint32(4, riffSize, true); putStr(8, 'WAVE');
  putStr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, 48000, true); dv.setUint32(28, 192000, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true);
  putStr(36, 'data'); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < dataLen; i++) b[44 + i] = (i * 11) & 255;
  for (let i = 0; i < extraTrailBytes; i++) b[44 + dataLen + i] = 0xaa;
  return b;
}

test('hygiene: all 7 modules stay <= 280 LOC, 0 em/en dashes, 0 forbidden legacy names', () => {
  const forbidden = ['iso', 'morph'].join('');
  for (const name of MODULE_FILES) {
    const src = fs.readFileSync(path.join(SURF, name), 'utf8');
    const lines = src.split(/\r?\n/).length;
    assert.ok(lines <= 280, `${name} has ${lines} lines (> 280)`);
    assert.equal(src.includes('\u2014'), false, `em dash in ${name}`);
    assert.equal(src.includes('\u2013'), false, `en dash in ${name}`);
    assert.equal(src.toLowerCase().includes(forbidden), false, `forbidden name in ${name}`);
  }
});

test('layer-glass-water: Cauchy dispersion (nB > nG > nR), Fresnel monotonicity, chromatic edge fringing', () => {
  for (const kind of Object.keys(GLASSES)) {
    const [nR, nG, nB] = channelIor(kind, 1.0);
    assert.ok(nB > nG && nG > nR, `${kind}: expected nB > nG > nR, got ${[nR, nG, nB]}`);
  }
  assert.ok(fresnel(0.1, 1, 1.517) > fresnel(0.95, 1, 1.517), 'grazing Fresnel > normal incidence');
  assert.equal(fresnel(0.2, 1.517, 1.0), 1, 'total internal reflection returns 1');

  // High-contrast vertical edge should show chromatic R != B separation after Cauchy refraction
  const w = 48, h = 32, src = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = x < 24 ? 10 : 245, o = (y * w + x) * 4;
    src[o] = v; src[o + 1] = v; src[o + 2] = v; src[o + 3] = 255;
  }
  const r1 = refractBuffer(src, w, h, { time: 0.6, stirX: 0.5, stirY: 0.5 }, { glass: 'dense', spread: 2.5, gap: 14 });
  const r2 = refractBuffer(src, w, h, { time: 0.6, stirX: 0.5, stirY: 0.5 }, { glass: 'dense', spread: 2.5, gap: 14 });
  assert.deepEqual(r1.rgba, r2.rgba, 'refractBuffer must be bit-deterministic');
  let chromaDiff = 0;
  for (let i = 0; i < w * h; i++) chromaDiff += Math.abs(r1.rgba[i * 4] - r1.rgba[i * 4 + 2]);
  assert.ok(chromaDiff > 100, `expected chromatic R/B dispersion fringing, got sum=${chromaDiff}`);
});

test('layer-low-water-world: exact sun-elevation atmospheric shift & deterministic ridged shoreline', () => {
  const night = computeLowWaterLight({ sunElevation: -14 });
  const golden = computeLowWaterLight({ sunElevation: 4 });
  const noon = computeLowWaterLight({ sunElevation: 36 });
  assert.ok(night.night > 0.9 && noon.night === 0);
  assert.ok(golden.horizon[0] > golden.horizon[2], 'golden hour horizon is warmer (R > B)');
  assert.ok(noon.zenith[2] > noon.zenith[0], 'midday zenith is cooler blue (B > R)');
  assert.ok(golden.keyPower > night.keyPower);
  assert.equal(terrainHeight(0.37, 1, 3301), terrainHeight(0.37, 1, 3301));
});

test('layer-fourier-spectral: DFT epicycle round-trip accuracy and bidirectional audio_features coupling', () => {
  const N = 32;
  const circle = Array.from({ length: N }, (_, i) => [Math.cos((i / N) * Math.PI * 2), Math.sin((i / N) * Math.PI * 2)]);
  const terms = computeEpicycles(circle, 8);
  const pt = evalEpicycles(terms, Math.PI / 3);
  assert.ok(Math.hypot(pt.x - Math.cos(Math.PI / 3), pt.y - Math.sin(Math.PI / 3)) < 1e-3);

  const wordTerms = computeEpicycles(generateWordContour('ESTUARY', 64), 16);
  const feat = patchbayEngines.makeAudioFeatures({ rms: 0.68, bands8: [0.9, 0.7, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15] });
  const mod = audioToHarmonics(feat, wordTerms);
  const rev = harmonicsToAudioFeatures(mod, { bpm: 140, beatPhase: 0.5 });
  assert.equal(patchbayCore.validatePortPayload('audio_features', rev), null);
  assert.ok(rev.rms > 0.05 && rev.spectralCentroidHz >= 80);
});

test('layer-elements-palette: OKLab round-trip, Kubelka-Munk order sensitivity, and LUT grading', () => {
  const hex = '#2b5f73';
  const round = oklabToHex(hexToOklab(hex));
  const diff = [1, 3, 5].map((o) => Math.abs(parseInt(hex.slice(o, o + 2), 16) - parseInt(round.slice(o, o + 2), 16)));
  assert.ok(Math.max(...diff) <= 2, `OKLab round-trip drift too large: ${hex} vs ${round}`);

  const a = hexToLin('#d79e35'), b = hexToLin('#132a3a');
  const ab = kmGlaze(a, b, 0.62, 0.48), ba = kmGlaze(b, a, 0.48, 0.62);
  const glazeOrderDelta = Math.hypot(ab[0] - ba[0], ab[1] - ba[1], ab[2] - ba[2]);
  assert.ok(glazeOrderDelta > 0.02, 'Kubelka-Munk glaze order must matter for scattering pigments');

  const pal = buildMaterialPalette();
  const neutral = new Uint8ClampedArray([120, 120, 120, 255, 200, 200, 200, 255]);
  const graded = gradeRgbaWithPalette(neutral, pal, 0.8);
  assert.notDeepEqual(Array.from(graded.slice(0, 3)), [120, 120, 120]);
});

test('layer-distill-ingest: clean PNG/WAV coverage=1.0, planted 24B trailing residual caught, entropy discriminates', () => {
  const cleanPng = dissectBytesLayer0(makeSyntheticPng(0), 'clean.png');
  assert.equal(cleanPng.format, 'png');
  assert.equal(cleanPng.coverage.residualBytes, 0);
  assert.equal(cleanPng.coverage.share, 1);

  const dirtyPng = dissectBytesLayer0(makeSyntheticPng(24), 'planted-hidden.png');
  assert.equal(dirtyPng.coverage.residualBytes, 24);
  assert.ok(dirtyPng.coverage.share < 1);

  const cleanWav = dissectBytesLayer0(makeSyntheticWav(0), 'clean.wav');
  assert.equal(cleanWav.format, 'wav');
  assert.equal(cleanWav.coverage.residualBytes, 0);

  const dirtyWav = dissectBytesLayer0(makeSyntheticWav(16), 'trail.wav');
  assert.equal(dirtyWav.coverage.residualBytes, 16);

  const flatEnt = shannonEntropy64(new Uint8Array(512).fill(42), 64);
  assert.equal(Math.max(...flatEnt), 0);
  const randBytes = new Uint8Array(4096);
  let s = 0x13579bdf;
  for (let i = 0; i < randBytes.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; randBytes[i] = (s >>> 24) & 255; }
  const hiEnt = shannonEntropy64(randBytes, 64);
  assert.ok(hiEnt[0] > 5.0, `expected high entropy on PRNG bytes, got ${hiEnt[0]}`);
});

test('layer-3d-mesh: projection modes, back-face culling, and Low Water sun lighting response', () => {
  const pPersp = project3D([0.5, 0.2, 1.0], { mode: 'perspective', dist: 3.0 });
  const pOrtho = project3D([0.5, 0.2, 1.0], { mode: 'orthographic' });
  assert.ok(pPersp.x > pOrtho.x, 'perspective foreshortens nearer vertex outward');

  const mesh = buildMesh('octahedron', { rms: 0.5, bands8: Array(8).fill(0.5) }, 0.4);
  const fNight = shadeMeshFaces(mesh, { sunLight: computeLowWaterLight({ sunElevation: -14 }) });
  const fNoon = shadeMeshFaces(mesh, { sunLight: computeLowWaterLight({ sunElevation: 36 }) });
  assert.ok(fNoon.length > 0 && fNoon.length < mesh.faces.length, 'back-face culling removes hidden faces');
  const meanShade = (fs) => fs.reduce((s, f) => s + f.shade, 0) / fs.length;
  assert.ok(meanShade(fNoon) > meanShade(fNight), 'midday Low Water sun lights 3D mesh brighter than night');
});

test('unified-layer-registry: 11 layers, 4 presets, stack add/remove/reorder, 6-hop live Patchbay + tamper/cycle guards', () => {
  assert.equal(STUDIO_LAYERS.length, 11);
  assert.equal(Object.keys(STACK_PRESETS).length, 4);

  const stack = createLayerStack('multimedia-master');
  assert.equal(stack.list().length, 11);
  stack.removeLayer('distill');
  assert.equal(stack.list().length, 10);
  stack.addLayer('distill', { on: true, index: 0 });
  assert.equal(stack.list()[0].id, 'distill');
  stack.reorderLayer('distill', 3);
  assert.equal(stack.list()[3].id, 'distill');

  // Full live 6-hop chain: Distill -> Elements -> Low Water -> Glass & Water -> Fourier -> Loom -> Poster Plotter
  const pb = createConsolidatedPatchbay(patchbayCore, patchbayEngines, 'multimedia-master');
  const pngBytes = makeSyntheticPng(0);
  const initOut = distillToPatchbayOutputs(pngBytes, 'studio.png', patchbayCore.digestPayload);
  const res = pb.dispatch('distill', 'palette', initOut.palette, { tSeconds: 1.25 });
  assert.equal(res.ok, true, `dispatch failed: ${res.error}`);
  assert.equal(res.chain.length, 6, `expected 6 chained hops, got ${res.chain.length}`);
  assert.equal(res.chain[0].fromEngine, 'distill');
  assert.equal(res.chain[5].toEngine, 'poster-plotter');
  assert.ok(res.outputs['loom:cloth_wif'].wifText.includes('[WEAVING]'));
  assert.ok(res.outputs['poster-plotter:vector'].svg.includes('<svg'));

  const verified = patchbayCore.verifyHopChain(res.chain);
  assert.deepEqual(verified, { ok: true, errors: [] });

  // Planted tamper control: corrupt hop #2 outputSha256 -> fail-closed rejection
  const tampered = res.chain.map((h, i) => (i === 2 ? { ...h, outputSha256: 'sha256:0000tampered' } : h));
  const tamperCheck = patchbayCore.verifyHopChain(tampered);
  assert.equal(tamperCheck.ok, false);
  assert.ok(tamperCheck.errors.includes('TAMPERED_RECEIPT_SHA256'));

  // Planted cycle control: attempt closing a loop fourier -> low-water -> fail-closed CYCLE_DETECTED
  const cyc = pb.connect('fourier', 'audio_features', 'low-water');
  assert.equal(cyc.ok, false);
  assert.equal(cyc.error, 'CYCLE_DETECTED');
});

test('all 4 studio presets dispatch end-to-end with verified SHA-256 hop chains', () => {
  const pal = buildMaterialPalette();
  const pbCinema = createConsolidatedPatchbay(patchbayCore, patchbayEngines, 'low-water-glass-cinema');
  const rCinema = pbCinema.dispatch('elements', 'palette', pal, { tSeconds: 0.5 });
  assert.equal(rCinema.ok, true);
  assert.equal(rCinema.chain.length, 4);
  assert.deepEqual(patchbayCore.verifyHopChain(rCinema.chain), { ok: true, errors: [] });

  const pbAudio = createConsolidatedPatchbay(patchbayCore, patchbayEngines, 'audio-fourier-lab');
  const rAudio = pbAudio.dispatch('daw', 'audio_features', patchbayEngines.makeAudioFeatures(), { tSeconds: 0.5 });
  assert.equal(rAudio.ok, true);
  assert.equal(rAudio.chain.length, 3);
  assert.deepEqual(patchbayCore.verifyHopChain(rAudio.chain), { ok: true, errors: [] });

  const pbDistill = createConsolidatedPatchbay(patchbayCore, patchbayEngines, 'distill-loom-plotter');
  const initOut = distillToPatchbayOutputs(makeSyntheticWav(0), 'drop.wav', patchbayCore.digestPayload);
  const rDistill = pbDistill.dispatch('distill', 'palette', initOut.palette, { tSeconds: 0.5 });
  assert.equal(rDistill.ok, true);
  assert.equal(rDistill.chain.length, 3);
  assert.deepEqual(patchbayCore.verifyHopChain(rDistill.chain), { ok: true, errors: [] });
});
