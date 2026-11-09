// lib/render.mjs: the CPU reference renderer. A family plus a word becomes a linear raster (and PCM when a binding
// sounds). The Canvas 2D fallback draws exactly this; the WebGL2 path (web/gl.mjs) draws the same layers with
// material shaders and is checked against it. Pure; runs in node and the browser.
import { make } from './props.mjs';
import { convert, route } from './adapters.mjs';
import { runMaterial, hex, clamp } from './material.mjs';
import { material } from './materials.mjs';
import { instance, faceOf, merge } from './program.mjs';
import { glyphContext } from './setline.mjs';
import { resolveInputs } from './inputs.mjs';

export const ORDER = Object.freeze(['shadow', 'fill', 'interior', 'stroke', 'edge']);

// The region a slot draws in, as coverage (stroke slots also carry the skeleton strokes).
function region(slot, g, R) {
  const { w, h } = g, cov = g.coverage.data;
  if (slot === 'fill') return { coverage: g.coverage };
  if (slot === 'interior') { const d = g.sdf.data, inset = R.interior.inset * g.size, o = new Float32Array(w * h); for (let i = 0; i < w * h; i++) o[i] = clamp(-d[i] - inset + 0.5); return { coverage: make.coverage(w, h, o) }; }
  if (slot === 'edge') { const d = g.sdf.data, hw = (R.edge.width * g.size) / 2, o = new Float32Array(w * h); for (let i = 0; i < w * h; i++) o[i] = clamp(hw - Math.abs(d[i]) + 0.5); return { coverage: make.coverage(w, h, o) }; }
  if (slot === 'shadow') { const dx = Math.round(R.shadow.dx * g.size), dy = Math.round(R.shadow.dy * g.size), o = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = x - dx, sy = y - dy; if (sx >= 0 && sy >= 0 && sx < w && sy < h) o[y * w + x] = cov[sy * w + sx]; } return { coverage: make.coverage(w, h, o) }; }
  if (slot === 'stroke') { const k = R.stroke.width, strokes = make.strokes(w, h, g.strokes.strokes.map((s) => ({ ...s, width: Math.max(0.8, s.width * k) }))); return { 'structure.strokes': strokes, coverage: convert(strokes, 'coverage') }; }
  return { coverage: g.coverage };
}

// Supply each consumed property: a binding's feed first (another property, or another material's output), then the
// region, the context and the inputs, then the cheapest adapter chain from anything present.
function supply(m, have, ctx, feed = {}, run = null) {
  const inputs = {};
  for (const { prop, optional } of m.consumes) {
    const f = feed[prop];
    if (typeof f === 'string') { if (!have[f]) throw new Error(`${m.id}: feed ${prop} from ${f}, which this binding does not have`); inputs[prop] = f === prop ? have[f] : convert(have[f], prop, ctx); continue; }
    if (f && typeof f === 'object') { const got = run(f); const k = Object.keys(got)[0]; inputs[prop] = k === prop ? got[k] : convert(got[k], prop, ctx); continue; }
    if (have[prop]) { inputs[prop] = have[prop]; continue; }
    if (optional) continue;
    const from = Object.keys(have).find((p) => have[p] && route(p, prop));
    if (!from) throw new Error(`${m.id} consumes ${prop}, and nothing in this binding reaches it (have ${Object.keys(have).join(', ')})`);
    inputs[prop] = convert(have[from], prop, ctx);
  }
  return inputs;
}

// The glyph context moved with the shadow, so a pattern field travels with the shadow as it does in the font layer.
function shifted(g, sh) {
  const dx = Math.round(sh.dx * g.size), dy = Math.round(sh.dy * g.size);
  return { ...g, lay: { ...g.lay, placed: g.lay.placed.map((p) => ({ ...p, x: p.x + dx, baseline: p.baseline + dy })) } };
}

function over(dst, A) { const s = A.data, d = dst.data; for (let i = 0; i < d.length; i += 4) { const a = s[i + 3]; if (a <= 0) continue; for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - a) + s[i + c] * a; d[i + 3] = Math.max(d[i + 3], a); } }
function add(dst, E) { const s = E.data, d = dst.data; for (let i = 0; i < d.length; i += 4) { for (let c = 0; c < 3; c++) d[i + c] += s[i + c]; d[i + 3] = Math.max(d[i + 3], clamp(s[i + 3])); } }

// Motion: sample the composite back along the flow by an amount that swings with phase and time.
function warp(R, mo, t, amp = 0.12) {
  const { w, h } = R, src = Float32Array.from(R.data), v = mo['motion.velocity'].data, ph = mo['motion.phase'].data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, k = amp * Math.sin(2 * Math.PI * (ph[i] + t * 0.5)), sx = Math.round(x - v[i * 2] * k), sy = Math.round(y - v[i * 2 + 1] * k);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
    for (let c = 0; c < 4; c++) R.data[i * 4 + c] = src[(sy * w + sx) * 4 + c];
  }
}

/**
 * renderWord(family, text, w, h, { loc, t, seed, fill, size, inputs }) ->
 *   { raster (linear RGBA), pcm?, layers: { slot: { material, prop, font } }, glyph, missing, location }
 */
export function renderWord(family, text, w, h, opt = {}) {
  const inst = instance(family, opt.loc), fc = faceOf(inst);
  if (fc.refused) throw new Error(`skeleton refused: ${fc.refusals.join(' ')}`);
  const g = glyphContext(fc, text, w, h, { fill: opt.fill ?? 0.82, size: opt.size ?? null, tracking: opt.tracking ?? 0 });
  const ext = { ...resolveInputs(inst.inputs), ...(opt.inputs ?? {}) }, clock = make.clock(opt.t ?? 0, 4, 24), seed = opt.seed ?? inst.recipe?.seed ?? 1;
  const out = make.albedo(w, h), ground = hex(inst.ground ?? '#ebe5d8');
  for (let i = 0; i < w * h; i++) { out.data.set(ground, i * 4); out.data[i * 4 + 3] = 1; }
  const layers = {}, slots = ORDER.filter((s) => inst.bindings[s]);
  const owner = slots.find((s) => material(inst.bindings[s].material).ownsGround);
  if (owner) slots.splice(slots.indexOf(owner), 1), slots.unshift(owner);
  for (const slot of slots) {
    const b = inst.bindings[slot], m = material(b.material), reg = region(slot, g, inst.regions);
    const have = { ...ext, 'structure.strokes': g.strokes, ...reg, 'motion.clock': clock, ...(reg.coverage === g.coverage || slot === 'edge' ? { 'field.sdf': g.sdf } : {}) };
    if (m.consumes.some((c) => c.prop === 'field.sdf') && !have['field.sdf']) have['field.sdf'] = convert(reg.coverage, 'field.sdf');
    const run = (fb) => { const fm = material(fb.material); return runMaterial(fm, { inputs: supply(fm, have, { seed, w, h }), params: fb.params, w, h, seed, clock, glyph: g }); };
    const gs = slot === 'shadow' ? shifted(g, inst.regions.shadow) : g;
    const res = runMaterial(m, { inputs: supply(m, have, { seed, w, h }, b.feed, run), params: b.params, w, h, seed, clock, glyph: gs });
    if (res['surface.albedo']) { if (slot === owner) out.data.set(res['surface.albedo'].data); else over(out, res['surface.albedo']); layers[slot] = { material: m.id, prop: 'surface.albedo' }; }
    if (res['light.emission']) { if (slot === owner) out.data.set(res['light.emission'].data); else add(out, res['light.emission']); layers[slot] = { material: m.id, prop: 'light.emission' }; }
    layers[slot].font = m.font(b.params ?? {});
  }
  let pcm = null;
  if (inst.bindings.motion) { const m = material(inst.bindings.motion.material); const mo = runMaterial(m, { inputs: supply(m, { 'field.sdf': g.sdf, coverage: g.coverage }, { w, h }), params: inst.bindings.motion.params, w, h, glyph: g }); if (opt.t) warp(out, mo, opt.t); layers.motion = { material: m.id, prop: 'motion.velocity', font: m.font({}) }; }
  if (inst.bindings.sound) {
    const m = material(inst.bindings.sound.material), have = { coverage: g.coverage, ...ext };
    if (inst.bindings.sound.from === 'input' && ext['sound.pcm']) have['sound.spectrum'] = convert(ext['sound.pcm'], 'sound.spectrum');
    pcm = runMaterial(m, { inputs: supply(m, have, { w, h, seed }), params: inst.bindings.sound.params, w, h, glyph: g })['sound.pcm'];
    layers.sound = { material: m.id, prop: 'sound.pcm', font: m.font({}) };
  }
  return { raster: { w, h, data: out.data }, pcm, layers, glyph: g, missing: g.missing, location: inst.location, text };
}

export { merge };
