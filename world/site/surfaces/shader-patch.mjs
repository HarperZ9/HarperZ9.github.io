// shader-patch.mjs: the shader room's whole setup as one value, and back. A patch holds the shader (as written, or the
// start or preset it came from), the knobs, the layers, the picture rack and the source with its settings. The keep rack
// (shader-keep.mjs) saves, lists, undoes and restores them; Start fresh applies none, which is the room as first opened.
import { encodeLayers, decodeLayers } from './shader-layers.mjs';
import { defaultPost, mergePost } from './shader-post.mjs';
import { defaultSource, SOURCES, PLATES, SYMMETRY } from './shader-sources.mjs';

const FIELDS = ['sh', 'shp', 'k', 'ly', 'rp', 'src', 'seed', 'plate', 'import'];
// whether the address already asks for a setup, in which case a kept session does not override it
export const asked = (q) => FIELDS.some((f) => q.has(f));
export function patchOf(state, P) {
  return { v: 1, glsl: state.source, start: state.start, edited: state.edited, preset: state.preset, knobs: [...state.knobs], ly: encodeLayers(state.layers) || '', post: JSON.parse(JSON.stringify(P)), from: { ...state.from } };
}
function sourceOf(got) {
  const S = defaultSource(); if (!got || typeof got !== 'object') return S;
  const one = (list, v) => list.some(([id]) => id === v);
  if (one(SOURCES, got.mode)) S.mode = got.mode; if (one(PLATES, got.plate)) S.plate = got.plate; if (one(SYMMETRY, got.sym)) S.sym = got.sym;
  if (typeof got.seed === 'string') S.seed = got.seed.slice(0, 40); if (/^#[0-9a-f]{6}$/i.test(got.ink)) S.ink = got.ink;
  if (Number.isFinite(+got.brush)) S.brush = Math.max(2, Math.min(60, +got.brush)); if (Number.isFinite(+got.persist)) S.persist = Math.max(0, Math.min(100, +got.persist));
  if (got.brushMode === 'wet' || got.brushMode === 'round') S.brushMode = got.brushMode; S.erase = !!got.erase; S.beam = !!got.beam;
  return S;
}
// p: a patch, or null for a fresh start. R: the room's parts (room-shader.mjs roomParts).
export function applyPatch(p, R) {
  const d = p && typeof p === 'object' ? p : {}, { state, P } = R;
  state.knobs = Array.isArray(d.knobs) && d.knobs.length === 3 && d.knobs.every((v) => v >= 0 && v <= 1) ? d.knobs.map(Number) : [0.5, 0.5, 0.5];
  state.knobs.forEach((v, i) => R.setKnob(i, v)); R.paintKnobs();
  state.layers = decodeLayers(typeof d.ly === 'string' ? d.ly : '');
  const next = mergePost(defaultPost(), d.post); for (const k of Object.keys(P)) delete P[k]; Object.assign(P, next);   // the same object: the racks hold it
  R.rack.sync(); R.sound.sync();
  Object.assign(state.from, sourceOf(d.from)); R.sources.sync();
  if (typeof d.glsl === 'string' && d.glsl.trim()) { R.src.value = d.glsl; state.edited = !!d.edited; state.preset = typeof d.preset === 'string' ? d.preset : ''; if (R.startOf(d.start)) state.start = d.start; R.build(); }
  else R.load(R.startOf(R.first).glsl, { start: R.first });
  R.paintLayers(); R.sources.choose(state.from.mode); R.writeAddress();
}
