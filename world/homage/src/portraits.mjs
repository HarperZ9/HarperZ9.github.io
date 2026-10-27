// src/portraits.mjs: which technique draws which sitter, and why. One entry per likeness descriptor.
//
// SPEC (QUALITY-SPEC S1 to S6)
//   inputs   descriptors/<key>.json (homage.likeness/1); plate width W in px (height = 1.25 W).
//   params   per technique, in px at the plate size unless stated; every default scales with W.
//   output   { ink, spot } Plates (coverage 0..1), and stats.
//   determinism  same key, W and seed give byte-identical separations (tests/determinism.test.mjs).
//   budget   W = 1200 renders each plate in under 60 s on one CPU core (tools/render_all.mjs logs the time).
//   export   tools/render_all.mjs writes separations and a proof at W = 1600 (2000 px tall); the 4K collage still
//            places plates at most 900 px tall, so no plate is ever upscaled.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toneField } from './tonefield.mjs';
import { tree, stream, refute, wave } from './tech/lines.mjs';
import { woodcut, chance, stamp, system } from './tech/print.mjs';

export const PORTRAITS = {
  darwin: { tech: tree, seed: 1859, field: { contrast: 1.3, vignette: 1.3 }, params: { rootX: 0.16 }, why: 'Branching from one root: the tree of life sketched in his 1837 notebook.' },
  marx: { tech: woodcut, seed: 1867, field: { contrast: 1.35, vignette: 1.3 }, why: 'Relief block and halftone: the print shop and the poster, where his ideas reached workers.' },
  james: { tech: stream, seed: 1890, field: { contrast: 1.2, lift: -0.03 }, why: 'Unbroken streamlines: the stream of thought, and truth as something that happens to an idea.' },
  peirce: { tech: chance, seed: 1878, field: { contrast: 1.15 }, why: 'Random dots relaxing into order: chance growing into habit and law.' },
  dewey: { tech: stamp, seed: 1934, field: { contrast: 1.2 }, why: 'A hand stamp brush: learning by doing, art as experience.' },
  bertalanffy: { tech: system, seed: 1968, field: { contrast: 1.6, lift: 0.06 }, why: 'Linked nodes with feedback loops: the open system of general systems theory.' },
  popper: { tech: refute, seed: 1963, field: { contrast: 1.4 }, why: 'Conjectures tested against the tone, refutations kept on the record: falsification.' },
  lateef: { tech: wave, seed: 1961, field: { contrast: 1.15, lift: 0.02 }, why: 'Scan lines drawn as sound: his reeds and flutes as waveforms.' },
};

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const descriptor = (key) => JSON.parse(readFileSync(ROOT + 'descriptors/' + key + '.json', 'utf8'));

export function renderPortrait(key, W, o = {}) {
  const e = PORTRAITS[key]; if (!e) throw new Error('no portrait entry for ' + key);
  const H = Math.round(W * 1.25), F = toneField(descriptor(key), W, H, { seed: o.seed ?? e.seed, ...e.field });
  return e.tech(F, { seed: o.seed ?? e.seed, ...(e.params || {}), ...(o.params || {}) });
}
