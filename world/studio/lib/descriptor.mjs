// descriptor.mjs: a reference's decomposed style as a starting material. Reads the descriptor JSON written by
// ../../2026-10-23-decompose (one file per kind: palette.json, grain.json, texture.json, motion.json, layers.json,
// brush.json, each with a `descriptor` field) or the combined per-image files of feed set 25 (descriptors/NN.json).
// Only measurements cross over: colours, grain numbers, orientation, cadence, layer evidence. No pixels.
// The similarity gate runs on the rendered result (tools/gate.mjs); a material that fails it is never offered.
import { normalize, CORE } from './schema.mjs';
import { hexToOk } from './blend.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r3 = x => +x.toFixed(4);

// Accept { palette: {descriptor|...}, grain: ..., ... } in either layout and return plain descriptor bodies.
export function unwrap(d) { const o = {}; for (const k of ['palette', 'grain', 'texture', 'motion', 'layers', 'brush', 'composition', 'audio']) if (d[k]) o[k] = d[k].descriptor ?? d[k]; return o; }

// Palette: the heaviest cluster is the ground; the cluster farthest from it in lightness is the ink;
// the most chromatic cluster with at least 2% weight is the accent (falls back to a mid cluster).
export function paletteFrom(p) {
  const cl = [...(p?.clusters ?? [])].sort((a, b) => b.weight - a.weight);
  if (cl.length < 2) return null;
  const ok = c => hexToOk(c.hex), ground = cl[0], g = ok(ground);
  const ink = cl.slice(1).reduce((a, b) => (Math.abs(ok(b)[0] - g[0]) > Math.abs(ok(a)[0] - g[0]) ? b : a));
  const chroma = c => Math.hypot(ok(c)[1], ok(c)[2]);
  const rest = cl.filter(c => c !== ground && c !== ink && c.weight >= 0.02);
  const accent = rest.length ? rest.reduce((a, b) => (chroma(b) > chroma(a) ? b : a)) : cl[Math.min(2, cl.length - 1)];
  return { ground: ground.hex, ink: ink.hex, accent: accent.hex };
}

export function fromDescriptors(raw, { id = 'reference', name = 'From a reference', base = null } = {}) {
  const d = unwrap(raw), core = { ...(base ? normalize(base).core : {}) }, notes = [];
  if (d.grain) {
    core.grainStd = r3(clamp(d.grain.amplitude ?? 0.008, 0.002, 0.03));
    core.grainPx = r3(clamp(1 / Math.max(0.05, d.grain.spectral_centroid_cycles_per_px ?? 0.21) * 0.45, 1.9, 3.1));
    notes.push('grain');
  }
  if (d.texture?.orientation) {
    const pk = d.texture.orientation.peaks?.[0];
    if (pk) core.lineDeg = r3(clamp(pk.angle_deg, 0, 180));
    core.order = r3(clamp(d.texture.orientation.coherence ?? 0.3, 0, 1));
    core.line = r3(clamp((pk?.weight ?? 0) * 6, 0, 1));
    notes.push('texture');
  }
  if (d.motion?.cadence) {
    const on = clamp(Math.round(d.motion.cadence.on ?? 1), 1, 3), fps = clamp(Math.round((d.motion.fps ?? 24) / 1), 8, 60);
    Object.assign(core, { on, fps: fps > 40 ? 60 : fps > 26 ? 30 : 24 });
    if (d.motion.cuts?.shot_mean_s) core.durationS = r3(clamp(d.motion.cuts.shot_mean_s, 0.25, 8));
    if (d.motion.cuts?.per_minute) core.tempo = Math.round(clamp(d.motion.cuts.per_minute * 2, 50, 180));
    notes.push('motion');
  }
  const stack = d.layers?.stack ?? [], light = stack.find(s => s.name === 'light'), tex = stack.find(s => s.name === 'texture');
  if (light?.present) { core.sheen = r3(clamp((light.share ?? 0) * 6, 0, 1)); notes.push('light layer'); }
  if (tex?.present) core.particles = r3(clamp((tex.fine_share ?? tex.energy_share ?? 0.2) * 1.2, 0, 1));
  if (d.brush?.size) { core.flow = r3(clamp(1 - (d.brush.spacing?.step_over_diameter ?? 1) / 2, 0, 1)); core.fibre = r3(clamp(d.brush.jitter?.scatter ?? 0.3, 0, 1)); notes.push('brush'); }
  if (d.palette?.lightness_mean !== undefined) core.brightness = r3(clamp(d.palette.lightness_mean / 100, 0, 1));
  for (const k of Object.keys(core)) if (!(k in CORE)) delete core[k];
  const pal = paletteFrom(d.palette) ?? normalize(base ?? {}).palette;
  const plates = [];
  if (core.line > 0.4) plates.push({ kind: 'hatch' });
  if (core.particles > 0.4) plates.push({ kind: 'droplets', opacity: 0.6 });
  if (core.sheen > 0.3) plates.push({ kind: 'film', mode: 'screen', opacity: 0.7 });
  if (d.brush?.size) plates.push({ kind: 'brush' });
  if (!plates.length) plates.push({ kind: 'noise' });
  const b = base ? normalize(base) : null;
  return normalize({
    id, name, genre: ['from-reference'], palette: pal, core,
    hints: b ? { ...b.hints, image: { plates: [...b.hints.image.plates, ...plates.map(p => ({ ...p, opacity: (p.opacity ?? 1) * 0.6 }))] } }
      : { type: { technique: core.line > 0.4 ? 'engraved' : 'glyphcell' }, image: { plates }, motion: { curve: (core.on ?? 1) > 1 ? 'stepped' : 'revealOut' }, sound: { voices: [{ voice: 'pluck', role: 'tone' }, { voice: 'noise', role: 'grain', gain: 0.3 }] } },
    from: { descriptors: notes },
  });
}
