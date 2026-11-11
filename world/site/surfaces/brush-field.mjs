// brush-field.mjs: the site's own brush engine (world/feed-23/build/brush) painting in the well, at the engine's own
// resolution. The engine is used as it is: its Surface (float, linear light), its Stroker, tips, dynamics, spacing,
// jitter, grain, tapers, wet pickup and smudge finger. Nothing of the engine is rewritten here.
//
// THE LAYER. Brushed paint lies in one engine Surface, FS times finer than the well's solver each way (960 by 720
// against 96 by 72), so a bristle tip leaves separate hairs. The Surface's colour channels are used as a count of
// pigments: slot 0 paints red, 1 green, 2 blue, and slot 3 paints alpha alone. The engine's own alpha-over rule
// then keeps, per pixel, how much of each pigment shows (paint over paint covers what is under it), its wet brushes
// pick up the pigment under them, and its smudge finger drags it. coverage() reads the four amounts back.
// The well's shader lays each amount as one more paint layer by the ground's own rule (well-shader.mjs), thin paint
// catching only on the high points of the ground's tooth.
//
//   createLayer()                          { surface, box }: an empty layer
//   beginStroke(layer, slot, brush, seed)  a live stroke: add(x, y, pressure or null, seconds); done() gives its record
//   replay(layer, strokes, slots)          paints recorded strokes again, the same way, dab for dab
//   coverage(layer, rect, out)             the four pigments' amounts in a rectangle, as bytes for a texture
//   dissolve(layer, sim, share, slots)     moves a share of the brushed paint into the solver's carried field: a liquid
//                                          or a gas takes paint off the brush's mark and carries it; a powder takes it whole
//   cleanStrokes(list)                     a recipe's strokes, checked
//
// Coordinates are fractions of the well. BRISTLE and DRY are the bench's two brushes; both are the studio's ink brush
// (INK_BRUSH in world/studio/lib/plates-matter.mjs: a bristle tip turned along the stroke) at a size for the well.
// The engine sets a bristle tip's hairs across the stroke; the bench hands the engine a surface that turns each dab a
// quarter turn (turn), so the hairs trail along the stroke and leave streaks. A test holds their shared numbers to that brush. LIMIT: paint in the layer is not part of the solver's conserved
// amount until it dissolves; on a solid ground it stays where the brush left it.
import { Surface } from '../../feed-23/build/brush/surface.js';
import { liveStroke } from '../../feed-23/build/brush/stroke.js';
import { PRESETS, PRESET_NAMES } from '../../feed-23/build/brush/presets.js';
import { NX, NY } from './well-sim.mjs';

export const FS = 10, FX = NX * FS, FY = NY * FS, MAX_STROKES = 80, MAX_POINTS = 400;
const TURN = Math.PI / 2, INK = { tip: ['bristle', { seed: 5 }], spacing: 0.05, angle: 'stroke', aspect: 1.5, pressure: { size: [0.3, 1], flow: [0.45, 1], gamma: 1.2 }, taper: { start: 0.12, end: 0.35 } };
export const OWN = Object.freeze({
  // a loaded bristle brush: the hairs show as streaks along the stroke
  bristle: { ...INK, turn: TURN, size: 0.085, flow: 0.5, grain: { kind: 'paper', period: 0.0047, depth: 0.28 }, wet: { mix: 0.25, pickup: 0.15 } },
  // the same brush nearly dry: little paint, so it catches on the high points of the ground and leaves the low ones bare
  'dry-brush': { ...INK, turn: TURN, size: 0.1, flow: 0.05, grain: { kind: 'paper', period: 0.0047, depth: 0.5 } },
});
export const BRUSHES = [...Object.keys(OWN), ...PRESET_NAMES];
export const brushDef = (id) => OWN[id] || PRESETS[id] || null;
export const brushName = (id) => id.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase();
const SLOT = ['#ff0000', '#00ff00', '#0000ff', '#000000'], r4 = (x) => Math.round(x * 1e4) / 1e4;

export const createLayer = () => ({ surface: new Surface(FX, FY), box: null });
export function clearLayer(layer) { layer.surface.px.fill(0); layer.surface.dirty = { x0: 0, y0: 0, x1: FX - 1, y1: FY - 1 }; layer.box = null; return layer; }
const grow = (layer) => { const d = layer.surface.dirty, b = layer.box; if (d) layer.box = b ? { x0: Math.min(b.x0, d.x0), y0: Math.min(b.y0, d.y0), x1: Math.max(b.x1, d.x1), y1: Math.max(b.y1, d.y1) } : { ...d }; };

export function beginStroke(layer, slot, brush, seed = 1) {
  const def = brushDef(brush); if (!def || !(slot >= 0 && slot < 4)) return null;
  const S = layer.surface, on = def.turn ? { w: S.w, h: S.h, dab: (tip, x, y, p) => S.dab(tip, x, y, { ...p, angle: (p.angle || 0) + def.turn }), pick: (x, y, r) => S.pick(x, y, r) } : S;
  const st = liveStroke(on, def, { unit: FX, seed, color: SLOT[slot] }), pts = [];
  return { surface: layer.surface,
    // the sample is rounded first and painted from the rounded numbers, so a replay lays exactly the same dabs
    add(x, y, p = null, t = 0) { if (pts.length >= MAX_POINTS) return; const q = [r4(x), r4(y), p == null ? null : r4(p), r4(t)]; pts.push(q);
      const s = { x: q[0] * FX, y: q[1] * FY, t: q[3] }; if (q[2] !== null) s.p = q[2]; st.add(s); grow(layer); },
    get dabs() { return st.placed; },
    done: () => ({ brush, slot, seed, pts }) };
}
export function replay(layer, strokes, slots = 4) {
  let dabs = 0;
  for (const s of strokes) { if (s.slot >= slots) continue; const b = beginStroke(layer, s.slot, s.brush, s.seed); if (!b) continue; for (const [x, y, p, t] of s.pts) b.add(x, y, p, t); dabs += b.dabs; }
  return dabs;
}
// The four amounts at one pixel of the Surface: red, green, blue, and what alpha holds beyond them.
const four = (px, i, o) => { const r = Math.max(0, px[i]), g = Math.max(0, px[i + 1]), b = Math.max(0, px[i + 2]); o[0] = r; o[1] = g; o[2] = b; o[3] = Math.max(0, px[i + 3] - r - g - b); return o; };
export function coverage(layer, rect = { x0: 0, y0: 0, x1: FX - 1, y1: FY - 1 }, out = new Uint8Array((rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1) * 4)) {
  const px = layer.surface.px, w = rect.x1 - rect.x0 + 1, o = [0, 0, 0, 0];
  for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0, k = (y - rect.y0) * w * 4; x <= rect.x1; x++, k += 4) { four(px, (y * FX + x) * 4, o); for (let c = 0; c < 4; c++) out[k + c] = o[c] >= 1 ? 255 : o[c] * 255; }
  return out;
}
// How much of each pigment the layer holds, as a mean over the well (the unit the solver's amounts() uses).
export function held(layer) { const s = [0, 0, 0, 0], o = [0, 0, 0, 0], px = layer.surface.px, b = layer.box; if (!b) return s;
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { four(px, (y * FX + x) * 4, o); for (let c = 0; c < 4; c++) s[c] += o[c]; }
  return s.map((v) => v / (FX * FY)); }
// A share of the paint leaves the layer and enters the solver's field, cell by cell: what the layer loses the field gains.
export function dissolve(layer, sim, share = 1, slots = 4) {
  const b = layer.box; if (!b) return 0;
  const px = layer.surface.px, keep = 1 - Math.min(1, share), o = [0, 0, 0, 0], sum = [0, 0, 0, 0]; let moved = 0, left = 0;
  for (let cy = Math.floor(b.y0 / FS); cy <= Math.floor(b.y1 / FS); cy++) for (let cx = Math.floor(b.x0 / FS); cx <= Math.floor(b.x1 / FS); cx++) {
    sum.fill(0);
    for (let y = cy * FS; y < cy * FS + FS; y++) for (let x = cx * FS, i = (y * FX + x) * 4; x < cx * FS + FS; x++, i += 4) { if (px[i + 3] <= 1e-6) continue; four(px, i, o); for (let c = 0; c < 4; c++) sum[c] += o[c]; px[i] *= keep; px[i + 1] *= keep; px[i + 2] *= keep; px[i + 3] *= keep; }
    for (let c = 0; c < slots; c++) if (sum[c] > 0) { moved += sim.lay(c, cy * NX + cx, (1 - keep) * sum[c] / (FS * FS)); left += keep * sum[c]; }
  }
  layer.surface.dirty = { ...b }; if (left / (FX * FY) < 1e-6) { for (let y = b.y0; y <= b.y1; y++) px.fill(0, (y * FX + b.x0) * 4, (y * FX + b.x1 + 1) * 4); layer.box = null; }
  return moved;
}
const num = (x) => typeof x === 'number' && Number.isFinite(x);
export function cleanStrokes(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((s) => s && brushDef(s.brush) && Number.isInteger(s.slot) && s.slot >= 0 && s.slot < 4 && Array.isArray(s.pts) && s.pts.length).slice(0, MAX_STROKES).map((s) => ({ brush: s.brush, slot: s.slot, seed: Number.isInteger(s.seed) ? s.seed : 1,
    pts: s.pts.filter((q) => Array.isArray(q) && num(q[0]) && num(q[1])).slice(0, MAX_POINTS).map((q) => [r4(Math.min(1, Math.max(0, q[0]))), r4(Math.min(1, Math.max(0, q[1]))), num(q[2]) ? r4(Math.min(1, Math.max(0, q[2]))) : null, num(q[3]) ? r4(q[3]) : 0]) })).filter((s) => s.pts.length);
}
