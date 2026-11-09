// props.mjs: the bridge to the type engine's property types (typeengine/lib/props.mjs). The type engine
// names properties of a panel of light (coverage, field.sdf, surface.albedo, structure.strokes, sound.spectrum, ...)
// and maps each to a superframe port type in its `sf` field. fromProp() turns a type-engine value into a port value;
// toProp() goes the other way. Properties with no port (surface.normal, light.dispersion, structure.cells) and the
// data-only provenance property are refused by name, so a mismatch fails loudly instead of passing a wrong shape.
import { PROPS, checkProp } from '../../typeengine/lib/props.mjs';
import { make, checkValue } from './types.mjs';

export { PROPS };

export function fromProp(prop, v) {
  const P = PROPS[prop];
  if (!P) throw new Error(`props: unknown property "${prop}"`);
  if (P.dataOnly) throw new Error(`props: ${prop} is data only and never becomes a port value`);
  if (!P.sf) throw new Error(`props: ${prop} has no superframe port yet`);
  const err = checkProp(prop, v); if (err) throw new Error(`props: ${prop}: ${err}`);
  switch (prop) {
    case 'structure.strokes': return make.vector(v.w, v.h, v.strokes.map(s => ({ pts: s.pts, width: s.width, closed: !!s.closed })));
    case 'structure.graph': return make.vector(v.w, v.h, v.edges.map(([i, j]) => ({ pts: [v.nodes[i], v.nodes[j]], width: 1 })));
    case 'sound.spectrum': return make.field(v.cols, v.rows, Float32Array.from(v.data));
    case 'sound.onsets': return make.events(Array.from(v.t, (t, i) => ({ t, voice: 'pluck', role: 'onset', args: { note: 60, dur: 0.1, vel: v.s[i] } })), v.duration);
    case 'light.refraction': case 'motion.velocity': return make.field(v.w, v.h, Float32Array.from(v.data), 2);
    case 'surface.albedo': case 'light.emission': return make.raster(v.w, v.h, Float32Array.from(v.data));
    case 'motion.clock': return make.time(v.t, v.duration, v.fps);
    case 'field.sdf': { const m = Math.max(1e-6, ...Array.from(v.data, Math.abs)); return make.field(v.w, v.h, Float32Array.from(v.data, d => 0.5 - 0.5 * d / m)); }
    default: return { ...v }; // coverage, field.scalar, surface.height, structure.particles, sound.pcm, data.series share the shape
  }
}

export function toProp(type, v, prop = null) {
  const err = checkValue(type, v); if (err) throw new Error(`props: ${err}`);
  const target = prop ?? { field: 'field.scalar', raster: 'surface.albedo', vector: 'structure.strokes', particles: 'structure.particles', audio: 'sound.pcm', series: 'data.series', time: 'motion.clock' }[type];
  if (!target || PROPS[target]?.sf !== type) throw new Error(`props: no property for port type ${type}${prop ? ` as ${prop}` : ''}`);
  if (target === 'structure.strokes') return { w: v.w, h: v.h, strokes: v.paths.filter(p => p.pts.length).map(p => ({ pts: p.pts, width: p.width ?? (p.widths ? Math.max(...p.widths) : 1), closed: !!p.closed })) };
  if (target === 'motion.clock') return { t: v.t, duration: v.duration, fps: v.fps };
  const { channels, ...rest } = v; return type === 'field' ? { w: v.w, h: v.h, data: v.data } : type === 'audio' ? v : rest.data ? { w: v.w, h: v.h, ...rest } : v;
}
