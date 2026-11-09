// nodes.mjs: the studio's materials and drivers as nodes with typed ports, ready for the super framework in
// ../../superframe/ (not on disk when this was written; this file is the provisional interface and
// will be adapted to its PROGRESS.md when it lands). A node: { id, kind, inputs, outputs, params, run }.
// Port media: 'material', 'text', 'numbers', 'code', 'score', 'image', 'motion', 'type', 'drive'.
// run(inputs, params) is pure and seeded: params.seed is the only randomness.
import { MATERIALS } from './materials.mjs';
import { CORE } from './schema.mjs';
import { blend } from './blend.mjs';
import { renderImage, toRGBA } from './lanes/image.mjs';
import { score } from './lanes/sound.mjs';
import { motion } from './lanes/motion.mjs';
import { typeSpec } from './lanes/type.mjs';
import { transition, payloadDrive } from './transition.mjs';
import { perceive } from './recipients.mjs';

const coreParams = Object.fromEntries(Object.entries(CORE).map(([k, [lo, hi, unit]]) => [k, { min: lo, max: hi, unit }]));

export const NODES = Object.freeze([
  ...MATERIALS.map(m => ({ id: `material.${m.id}`, kind: 'source', inputs: {}, outputs: { material: 'material' }, params: coreParams, run: (_, p = {}) => ({ material: { ...m, core: { ...m.core, ...pick(p) } } }) })),
  { id: 'blend', kind: 'combine', inputs: { a: 'material', b: 'material' }, outputs: { material: 'material' }, params: { t: { min: 0, max: 1, unit: 'share of b' } }, run: ({ a, b }, { t = 0.5 } = {}) => ({ material: blend([a, b], [1 - t, t]) }) },
  { id: 'drive', kind: 'convert', inputs: { material: 'material', payload: 'text|numbers|code|score' }, outputs: { drive: 'drive' }, params: {}, run: ({ material, payload }) => ({ drive: payloadDrive(payload, material) }) },
  { id: 'lane.image', kind: 'render', inputs: { material: 'material', drive: 'drive?' }, outputs: { image: 'image' }, params: { w: { min: 8, max: 7680, unit: 'px' }, h: { min: 8, max: 4320, unit: 'px' }, seed: { min: 0, max: 2 ** 31, unit: 'seed' } },
    run: ({ material, drive }, { w = 640, h = 400, seed = 1, dpr = 1 } = {}) => { const L = renderImage(material, { w, h, seed, drive: drive?.image }); return { image: { w, h, rgba: toRGBA(L, material, { dpr }) } }; } },
  { id: 'lane.sound', kind: 'render', inputs: { material: 'material', drive: 'drive?' }, outputs: { score: 'score' }, params: { seed: { min: 0, max: 2 ** 31, unit: 'seed' } }, run: ({ material, drive }, { seed = 1 } = {}) => ({ score: score(material, { seed, drive: drive?.sound }) }) },
  { id: 'lane.motion', kind: 'render', inputs: { material: 'material' }, outputs: { motion: 'motion' }, params: {}, run: ({ material }) => { const mo = motion(material); return { motion: { curve: mo.curve, durationS: mo.durationS, fps: mo.fps, on: mo.on, samples: mo.samples(64) } }; } },
  { id: 'lane.type', kind: 'render', inputs: { material: 'material' }, outputs: { type: 'type' }, params: { seed: { min: 0, max: 2 ** 31, unit: 'seed' } }, run: ({ material }, { seed = 1 } = {}) => ({ type: typeSpec(material, { seed }) }) },
  { id: 'perceive', kind: 'render', inputs: { material: 'material' }, outputs: { eye: 'data', ear: 'data', language: 'text', agent: 'data' }, params: { seed: { min: 0, max: 2 ** 31, unit: 'seed' } }, run: ({ material }, { seed = 1, word = null } = {}) => perceive(material, { seed, word }) },
  { id: 'transition', kind: 'combine', inputs: { from: 'material', to: 'material', payload: 'text|numbers|code|score?' }, outputs: { material: 'material', drive: 'drive' }, params: { t: { min: 0, max: 1, unit: 'progress' } },
    run: ({ from, to, payload }, { t = 0 } = {}) => { const f = transition(from, to, payload, t); return { material: f.material, drive: f.drive }; } },
]);
function pick(p) { const o = {}; for (const k of Object.keys(CORE)) if (typeof p[k] === 'number') o[k] = p[k]; return o; }
export const node = id => NODES.find(n => n.id === id) ?? null;
