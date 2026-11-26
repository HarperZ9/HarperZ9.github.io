// playground-studio-patchbay.test.mjs: Unit & contract tests for Wave 31A Unified Live Multimedia Studio
// + Wave 29B Patchbay Core & Engine Adapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRIDGE_PROTOCOL,
  PATCHBAY_RECEIPT_SCHEMA,
  PORT_TYPES,
  createStageBridge,
  digestPayload,
  verifyHopChain,
} from '../world/site/surfaces/patchbay-core.mjs';
import { createDefaultStudioPatchbay, makeAudioFeatures } from '../world/site/surfaces/patchbay-engines.mjs';
import { DAW_SCALES, DEFAULT_PATTERNS } from '../world/site/surfaces/studio-daw.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('all 7 typed signal ports + 7 disciplines + 1-click compatibleTargets discovery', () => {
  assert.deepEqual([...PORT_TYPES], [
    'frame', 'palette', 'audio_features', 'vector', 'cloth_wif', 'type_field', 'receipt',
  ]);
  const pb = createDefaultStudioPatchbay();
  assert.equal(pb.engines().length, 7);
  const audioTargets = pb.compatibleTargets('daw', 'audio_features').map((t) => t.id).sort();
  assert.deepEqual(audioTargets, ['estuary', 'living-type', 'retro-fx', 'studio-3d']);
  const frameTargets = pb.compatibleTargets('retro-fx', 'frame').map((t) => t.id).sort();
  assert.deepEqual(frameTargets, ['loom', 'poster-plotter', 'studio-3d']);
});

test('5-stage multi-hop pipeline: DAW -> Estuary -> Retro 46 FX -> Loom -> Plotter with verified SHA-256 receipts', () => {
  const pb = createDefaultStudioPatchbay();
  assert.equal(pb.connect('daw', 'audio_features', 'estuary').ok, true);
  assert.equal(pb.connect('estuary', 'frame', 'retro-fx').ok, true);
  assert.equal(pb.connect('retro-fx', 'frame', 'loom').ok, true);
  assert.equal(pb.connect('loom', 'cloth_wif', 'poster-plotter').ok, true);

  const seenHops = [];
  pb.onHop((hop) => seenHops.push(hop.toEngine));

  const features = makeAudioFeatures({ rms: 0.68, onset: true, bpm: 166, lufs: -13.9 });
  const res = pb.dispatch('daw', 'audio_features', features, { tSeconds: 1.5 });
  assert.equal(res.ok, true);
  assert.equal(res.chain.length, 4);
  assert.deepEqual(seenHops, ['estuary', 'retro-fx', 'loom', 'poster-plotter']);

  assert.equal(res.outputs['estuary:frame'].width, 8);
  assert.equal(res.outputs['retro-fx:frame'].ditherMode, 'bayer-4x4-crt');
  assert.match(res.outputs['loom:cloth_wif'].wifText, /\[WEAVING\]/);
  assert.match(res.outputs['poster-plotter:vector'].svg, /^<svg[\s\S]*<path d="M [\s\S]*<\/svg>$/);

  const check = verifyHopChain(res.chain);
  assert.equal(check.ok, true);
  assert.deepEqual(check.errors, []);

  // Deterministic replay yields bit-identical receipt SHA-256.
  const replay = pb.dispatch('daw', 'audio_features', features, { tSeconds: 1.5 });
  assert.equal(replay.chain.at(-1).receiptSha256, res.chain.at(-1).receiptSha256);
});

test('audio-envelope-to-visual and living typography modulation changes outputs deterministically', () => {
  const pb = createDefaultStudioPatchbay();
  pb.connect('daw', 'audio_features', 'estuary');
  pb.connect('daw', 'audio_features', 'living-type');
  pb.connect('estuary', 'frame', 'retro-fx');

  const quiet = pb.dispatch('daw', 'audio_features', makeAudioFeatures({ rms: 0.08, onset: false, bands8: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1] }));
  const peak = pb.dispatch('daw', 'audio_features', makeAudioFeatures({ rms: 0.92, onset: true, bands8: [0.95, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5, 0.4] }));

  assert.equal(quiet.ok, true);
  assert.equal(peak.ok, true);
  assert.notEqual(quiet.outputs['estuary:frame'].pixelsSha256, peak.outputs['estuary:frame'].pixelsSha256);
  assert.ok(peak.outputs['retro-fx:frame'].bloom > quiet.outputs['retro-fx:frame'].bloom);
  assert.ok(peak.outputs['living-type:type_field'].axes.weight > quiet.outputs['living-type:type_field'].axes.weight);
});

test('planted cycle, self-loop, and port mismatch fail closed', () => {
  const pb = createDefaultStudioPatchbay();
  assert.equal(pb.connect('daw', 'audio_features', 'estuary').ok, true);
  assert.equal(pb.connect('estuary', 'frame', 'retro-fx').ok, true);
  assert.equal(pb.connect('retro-fx', 'frame', 'loom').ok, true);

  assert.equal(pb.connect('loom', 'cloth_wif', 'daw').error, 'CYCLE_DETECTED');
  assert.equal(pb.connect('retro-fx', 'frame', 'retro-fx').error, 'CYCLE_DETECTED');
  assert.equal(pb.connect('loom', 'cloth_wif', 'retro-fx', 'frame').error, 'PORT_TYPE_MISMATCH');
});

test('planted tampered receipt and broken parent chain fail closed', () => {
  const pb = createDefaultStudioPatchbay();
  pb.connect('daw', 'audio_features', 'estuary');
  pb.connect('estuary', 'frame', 'retro-fx');
  pb.connect('retro-fx', 'frame', 'loom');
  const { chain } = pb.dispatch('daw', 'audio_features', makeAudioFeatures());
  assert.equal(verifyHopChain(chain).ok, true);

  const tampered = chain.map((h) => ({ ...h }));
  tampered[1].outputSha256 = 'sha256:' + 'f'.repeat(64);
  const tCheck = verifyHopChain(tampered);
  assert.equal(tCheck.ok, false);
  assert.ok(tCheck.errors.includes('TAMPERED_RECEIPT_SHA256'));

  const dropped = [chain[0], chain[2]];
  const dCheck = verifyHopChain(dropped);
  assert.equal(dCheck.ok, false);
  assert.ok(dCheck.errors.includes('BROKEN_PARENT_CHAIN'));
  assert.ok(dCheck.errors.includes('HOP_INDEX_MISMATCH'));
});

test('origin-pinned stage bridge routes live and blocks foreign-origin spoofing', () => {
  const pb = createDefaultStudioPatchbay();
  pb.connect('daw', 'audio_features', 'estuary');
  pb.connect('estuary', 'frame', 'loom');

  const sent = [];
  const bridge = createStageBridge(pb, {
    allowedOrigin: 'https://harperz9.github.io',
    postOut: (msg, origin) => sent.push({ msg, origin }),
  });

  const spoof = bridge.handleIncoming({
    origin: 'https://evil.example',
    data: { protocol: BRIDGE_PROTOCOL, kind: 'dispatch', engineId: 'daw', portType: 'audio_features', payload: makeAudioFeatures() },
  });
  assert.equal(spoof.ok, false);
  assert.equal(spoof.error, 'ORIGIN_MISMATCH');
  assert.equal(sent.length, 0);

  const good = bridge.handleIncoming({
    origin: 'https://harperz9.github.io',
    data: { protocol: BRIDGE_PROTOCOL, kind: 'dispatch', engineId: 'daw', portType: 'audio_features', payload: makeAudioFeatures({ rms: 0.77 }) },
  });
  assert.equal(good.ok, true);
  assert.equal(good.chain.length, 2);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].msg.chain[0].schema, PATCHBAY_RECEIPT_SCHEMA);
});

test('DAW modal scales and 4-lane 16-step patterns are cleanly defined', () => {
  assert.deepEqual(Object.keys(DAW_SCALES).sort(), ['dorian', 'lydian', 'phrygian']);
  for (const lane of ['kick', 'snare', 'hat', 'chord']) {
    assert.equal(DEFAULT_PATTERNS[lane].length, 16);
  }
});

test('Wave 31A studio assets pass hygiene guard (zero em dashes, zero excluded words, zero local paths)', () => {
  const files = [
    'world/site/surfaces/patchbay-core.mjs',
    'world/site/surfaces/patchbay-engines.mjs',
    'world/site/surfaces/studio-daw.mjs',
    'world/site/surfaces/studio-patchbay-bridge.mjs',
    'world/site/surfaces/studio-compositor.mjs',
    'world/site/surfaces/studio-compositor.css',
  ];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!text.includes('\u2014'), `em dash found in ${rel}`);
    assert.ok(!/isomorph/i.test(text), `excluded word found in ${rel}`);
    assert.ok(!/[A-Z]:\\|\/Users\//.test(text), `local path found in ${rel}`);
  }
  const compBytes = fs.statSync(path.join(ROOT, 'world/site/surfaces/studio-compositor.mjs')).size;
  assert.ok(compBytes <= 22000, `studio-compositor.mjs (${compBytes} B) should stay sleek for eager network budget`);
});
