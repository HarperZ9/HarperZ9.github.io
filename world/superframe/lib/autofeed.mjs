// autofeed.mjs: a default source for each port type, so any node can run alone (tests, docs, the CLI 'try').
// Each source is a small, fast node whose output converts cleanly.
export const FEED = {
  field: { node: 'chladni.membrane', params: { n: 2, m: 5, mix: 40 } },
  raster: { node: 'compose.film', params: {} },
  vector: { node: 'golden.construction', params: {} },
  glyphs: { node: 'type.forge', params: { text: 'ROPE' } },
  particles: { node: 'chladni.membrane', params: { n: 3, m: 4 } },
  audio: { node: 'sound.phrase', params: {} },
  events: { node: 'sound.falsescale', params: {} },
  series: { node: 'data.series', params: { name: 'cpi-inflation' } },
  material: { node: 'studio.material', params: {} },
  time: { node: 'time.clock', params: {} },
  distribution: { node: 'dist.make', params: {} },
  text: { node: 'core.text', params: { text: 'I like the sea. Do you?' } },
  motion: { node: 'story.mosaic', params: { text: 'I like the sea', framesPerBeat: 1, maxBeats: 2 } },
  score: null,
};

import { convertible } from './graph.mjs';

// A recipe that runs one node with every input (optional ones too, when feedable) fed by FEED.
export function soloRecipe(def, { size = [128, 128], seed = 'solo', optional = false, params = {}, media = true } = {}) {
  const nodes = [], inn = {};
  for (const [port, spec] of Object.entries(def.inputs)) {
    if (spec.optional && !optional) continue;
    const f = FEED[spec.type]; if (!f) continue;
    const id = `feed_${port}`; nodes.push({ id, node: f.node, params: f.params }); inn[port] = id;
  }
  nodes.push({ id: 'n', node: def.id, params, in: inn });
  const first = Object.entries(def.outputs)[0];
  const out = {}; for (const [p, t] of Object.entries(def.outputs)) out[p] = `n.${p}`;
  if (media && !Object.values(def.outputs).includes('raster') && convertible(first[1], 'raster')) out.image = `n.${first[0]}`;
  return { schema: 'superframe.recipe/1', seed, size, nodes, out };
}
