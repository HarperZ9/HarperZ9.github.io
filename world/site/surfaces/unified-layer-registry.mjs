// unified-layer-registry.mjs: Consolidated 11-layer Registry, Layer Stack Presets,
// stack manager (add/remove/reorder), and Patchbay DAG wiring for Unified /playground/ Studio (Wave 33A-1).
// Pure ESM, zero external deps; drop-in compatible with world/site/surfaces/patchbay-core.mjs.
import { LAYER_META as GLASS_META, glassWaterTransform, renderGlassWaterLayer } from './layer-glass-water.mjs';
import { LAYER_META as LOW_WATER_META, lowWaterTransform, renderLowWaterLayer } from './layer-low-water-world.mjs';
import { LAYER_META as FOURIER_META, fourierTransform, renderFourierLayer } from './layer-fourier-spectral.mjs';
import { LAYER_META as ELEMENTS_META, elementsPaletteTransform, renderElementsPaletteLayer } from './layer-elements-palette.mjs';
import { LAYER_META as DISTILL_META, distillToPatchbayOutputs, renderDistillOverlayLayer } from './layer-distill-ingest.mjs';
import { LAYER_META as MESH3D_META, mesh3dTransform, render3DMeshLayer } from './layer-3d-mesh.mjs';

export const BLEND_MODES = Object.freeze(['normal', 'screen', 'multiply', 'overlay', 'difference']);

const CORE_FIVE = Object.freeze([
  {
    id: 'estuary', name: 'Physics / Estuary Field', discipline: 'Native Engine, Living World & Inspection',
    route: 'DAW -> Estuary', takes: ['audio_features', 'palette'], gives: ['frame', 'palette'],
    defaultOn: true, defaultOpacity: 1.0, defaultBlend: 'normal', builtin: true,
  },
  {
    id: 'type', name: 'Living Type Field', discipline: 'Type, Lettering & Epicycles',
    route: 'DAW -> Type', takes: ['audio_features', 'palette'], gives: ['type_field', 'vector'],
    defaultOn: true, defaultOpacity: 0.92, defaultBlend: 'screen', builtin: true,
  },
  {
    id: 'retro', name: 'Retro 46 FX & Grade', discipline: 'Paint, Pigment, Glass, Film & Shaders',
    route: 'Composite -> Retro FX', takes: ['frame', 'audio_features', 'palette'], gives: ['frame', 'palette'],
    defaultOn: true, defaultOpacity: 0.54, defaultBlend: 'overlay', builtin: true,
  },
  {
    id: 'loom', name: 'Loom Jacquard Thread', discipline: 'Weave, Loom & Textile',
    route: 'Frame -> Loom WIF', takes: ['frame', 'palette'], gives: ['cloth_wif', 'frame'],
    defaultOn: true, defaultOpacity: 0.44, defaultBlend: 'screen', builtin: true,
  },
  {
    id: 'plotter', name: 'Plotter Vector Contours', discipline: 'Posters, Print, Plotter & Fabrication',
    route: 'Loom -> Plotter SVG', takes: ['cloth_wif', 'frame', 'palette', 'type_field'], gives: ['vector'],
    defaultOn: true, defaultOpacity: 0.86, defaultBlend: 'normal', builtin: true,
  },
]);

export const STUDIO_LAYERS = Object.freeze([
  CORE_FIVE[0],
  LOW_WATER_META,
  MESH3D_META,
  CORE_FIVE[1],
  FOURIER_META,
  GLASS_META,
  ELEMENTS_META,
  CORE_FIVE[2],
  CORE_FIVE[3],
  CORE_FIVE[4],
  DISTILL_META,
]);

export const LAYER_RENDERERS = Object.freeze({
  'low-water': renderLowWaterLayer,
  'mesh-3d': render3DMeshLayer,
  'fourier': renderFourierLayer,
  'glass-water': renderGlassWaterLayer,
  'elements': renderElementsPaletteLayer,
  'distill': renderDistillOverlayLayer,
});

export const STACK_PRESETS = Object.freeze({
  'multimedia-master': {
    id: 'multimedia-master',
    label: 'Multimedia Master',
    description: 'Estuary + Low Water + Glass + Fourier + Living Type + Loom + Plotter on one shared canvas.',
    active: ['low-water', 'estuary', 'type', 'fourier', 'glass-water', 'elements', 'loom', 'plotter'],
    order: ['low-water', 'estuary', 'mesh-3d', 'type', 'fourier', 'glass-water', 'elements', 'retro', 'loom', 'plotter', 'distill'],
    wires: [
      ['distill', 'palette', 'elements'],
      ['elements', 'palette', 'low-water'],
      ['low-water', 'frame', 'glass-water'],
      ['glass-water', 'frame', 'fourier'],
      ['fourier', 'frame', 'loom'],
      ['loom', 'cloth_wif', 'poster-plotter'],
    ],
  },
  'low-water-glass-cinema': {
    id: 'low-water-glass-cinema',
    label: 'Low Water + Glass Cinema',
    description: 'Atmospheric Low Water sky & shoreline refracted through Cauchy crown glass with 3D sun-lit mesh.',
    active: ['low-water', 'mesh-3d', 'glass-water', 'elements', 'retro'],
    order: ['low-water', 'mesh-3d', 'glass-water', 'elements', 'retro', 'estuary', 'type', 'fourier', 'loom', 'plotter', 'distill'],
    wires: [
      ['elements', 'palette', 'low-water'],
      ['low-water', 'frame', 'mesh-3d'],
      ['mesh-3d', 'frame', 'glass-water'],
      ['glass-water', 'frame', 'retro-fx'],
    ],
  },
  'audio-fourier-lab': {
    id: 'audio-fourier-lab',
    label: 'Audio-Fourier Lab',
    description: 'DAW audio features driving live Fourier epicycles, Living Type, and Estuary harmonic rings.',
    active: ['estuary', 'type', 'fourier', 'plotter'],
    order: ['estuary', 'fourier', 'type', 'plotter', 'low-water', 'mesh-3d', 'glass-water', 'elements', 'retro', 'loom', 'distill'],
    wires: [
      ['daw', 'audio_features', 'fourier'],
      ['fourier', 'audio_features', 'estuary'],
      ['estuary', 'frame', 'poster-plotter'],
    ],
  },
  'distill-loom-plotter': {
    id: 'distill-loom-plotter',
    label: 'Distill -> Loom -> Plotter',
    description: 'Drop any local file to extract distill/1 byte anatomy, OKLab palette, Jacquard WIF cloth, and plotter SVG.',
    active: ['distill', 'elements', 'loom', 'plotter'],
    order: ['distill', 'elements', 'loom', 'plotter', 'low-water', 'estuary', 'glass-water', 'fourier', 'type', 'retro', 'mesh-3d'],
    wires: [
      ['distill', 'palette', 'elements'],
      ['elements', 'frame', 'loom'],
      ['loom', 'cloth_wif', 'poster-plotter'],
    ],
  },
});

const metaById = new Map(STUDIO_LAYERS.map((l) => [l.id, l]));

export function createLayerStack(presetId = 'multimedia-master') {
  const mkItem = (id, onOverride = null) => {
    const m = metaById.get(id);
    if (!m) throw new RangeError(`unknown layer id: ${id}`);
    return {
      id: m.id, name: m.name, discipline: m.discipline, route: m.route,
      on: onOverride === null ? Boolean(m.defaultOn) : Boolean(onOverride),
      opacity: m.defaultOpacity, blend: m.defaultBlend,
    };
  };

  let stack = [];

  function applyPreset(id) {
    const p = STACK_PRESETS[id];
    if (!p) throw new RangeError(`unknown studio preset: ${id}`);
    const activeSet = new Set(p.active);
    stack = p.order.map((lid) => mkItem(lid, activeSet.has(lid)));
    return list();
  }

  function list() {
    return stack.map((item) => ({ ...item }));
  }

  function addLayer(id, opts = {}) {
    if (!metaById.has(id)) throw new RangeError(`unknown layer id: ${id}`);
    if (stack.some((x) => x.id === id)) return list();
    const item = mkItem(id, opts.on ?? true);
    if (opts.opacity != null) item.opacity = Math.max(0, Math.min(1, Number(opts.opacity)));
    if (opts.blend && BLEND_MODES.includes(opts.blend)) item.blend = opts.blend;
    const idx = opts.index != null ? Math.max(0, Math.min(stack.length, opts.index)) : stack.length;
    stack.splice(idx, 0, item);
    return list();
  }

  function removeLayer(id) {
    stack = stack.filter((x) => x.id !== id);
    return list();
  }

  function reorderLayer(id, newIndex) {
    const cur = stack.findIndex((x) => x.id === id);
    if (cur < 0) return list();
    const [item] = stack.splice(cur, 1);
    const dst = Math.max(0, Math.min(stack.length, newIndex));
    stack.splice(dst, 0, item);
    return list();
  }

  function toggleLayer(id, on = null) {
    const item = stack.find((x) => x.id === id);
    if (!item) return null;
    item.on = on === null ? !item.on : Boolean(on);
    return { ...item };
  }

  function setOpacity(id, opacity) {
    const item = stack.find((x) => x.id === id);
    if (!item) return null;
    item.opacity = Math.max(0, Math.min(1, Number(opacity) || 0));
    return { ...item };
  }

  function setBlend(id, blend) {
    const item = stack.find((x) => x.id === id);
    if (!item || !BLEND_MODES.includes(blend)) return null;
    item.blend = blend;
    return { ...item };
  }

  applyPreset(presetId);
  return { list, applyPreset, addLayer, removeLayer, reorderLayer, toggleLayer, setOpacity, setBlend };
}

// Register all 11 consolidated engines into a live patchbay-core instance
export function createConsolidatedPatchbay(patchbayCore, patchbayEngines, presetId = 'multimedia-master') {
  const pb = patchbayEngines.createDefaultStudioPatchbay();
  const digest = patchbayCore.digestPayload;

  pb.register({
    id: 'distill', name: DISTILL_META.name, discipline: DISTILL_META.discipline,
    takes: ['frame'], gives: ['palette', 'frame', 'audio_features', 'receipt'],
    transform: (input) => {
      const raw = input?.rawBytes instanceof Uint8Array ? input.rawBytes : new Uint8Array(input?.lumaGrid || [137, 80, 78, 71]);
      const out = distillToPatchbayOutputs(raw, input?.filename || 'studio-drop.bin', digest);
      return { palette: out.palette, frame: out.frame, audio_features: out.audio_features, receipt: out.receipt };
    },
  });
  pb.register({
    id: 'elements', name: ELEMENTS_META.name, discipline: ELEMENTS_META.discipline,
    takes: ['palette', 'frame', 'audio_features'], gives: ['palette', 'frame'],
    transform: (input, ctx) => elementsPaletteTransform(input, ctx, digest),
  });
  pb.register({
    id: 'low-water', name: LOW_WATER_META.name, discipline: LOW_WATER_META.discipline,
    takes: ['palette', 'audio_features'], gives: ['frame', 'palette'],
    transform: (input, ctx) => lowWaterTransform(input, ctx, digest),
  });
  pb.register({
    id: 'glass-water', name: GLASS_META.name, discipline: GLASS_META.discipline,
    takes: ['frame', 'audio_features', 'palette'], gives: ['frame'],
    transform: (input, ctx) => glassWaterTransform(input, ctx, digest),
  });
  pb.register({
    id: 'fourier', name: FOURIER_META.name, discipline: FOURIER_META.discipline,
    takes: ['audio_features', 'type_field', 'frame'], gives: ['vector', 'frame', 'audio_features'],
    transform: (input, ctx) => fourierTransform(input, ctx, digest),
  });
  pb.register({
    id: 'mesh-3d', name: MESH3D_META.name, discipline: MESH3D_META.discipline,
    takes: ['audio_features', 'palette', 'frame'], gives: ['frame', 'vector'],
    transform: (input, ctx) => mesh3dTransform(input, ctx, digest),
  });

  const preset = STACK_PRESETS[presetId];
  if (preset) {
    for (const [from, port, to] of preset.wires) {
      const r = pb.connect(from, port, to);
      if (!r.ok) throw new Error(`preset ${presetId} wire failed (${from}:${port}->${to}): ${r.error}`);
    }
  }
  return pb;
}
