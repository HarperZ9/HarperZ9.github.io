// lib/inputs.mjs: the outside material a family can be fed: a data series or a sound. A recipe stores the values it
// used (a series inline, a sound by its generator and parameters), so a family re-renders anywhere with no file I/O.
import { make } from './props.mjs';
import { phrase } from '../../sound/sound/motifs/memory.js';
import { groove } from '../../sound/sound/motifs/trauma.js';

const SOUNDS = { phrase: (o) => phrase(o.seconds ?? 3.2), groove: (o) => groove(o.bars ?? 2, o.bpm ?? 84) };
export const SOUND_SOURCES = Object.freeze(Object.keys(SOUNDS));

/** inputs spec -> { 'data.series'?, 'sound.pcm'? } as tagged property values. */
export function resolveInputs(spec = {}) {
  const out = {};
  const s = spec['data.series'];
  if (s) { if (!Array.isArray(s.values) || s.values.length < 2) throw new Error('inputs: data.series needs values (two or more)'); out['data.series'] = make.series(s.values, { label: s.label ?? '', unit: s.unit ?? '' }); }
  const a = spec['sound.pcm'];
  if (a) { const f = SOUNDS[a.source]; if (!f) throw new Error(`inputs: unknown sound "${a.source}" (one of ${SOUND_SOURCES.join(', ')})`); const x = f(a); out['sound.pcm'] = make.pcm(22050, [x instanceof Float32Array ? x : Float32Array.from(x)]); }
  return out;
}
