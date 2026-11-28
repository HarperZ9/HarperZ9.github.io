// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
//
// system/studio-state-bus.js
// Single shared reactive state bus uniting all 10 studio domains (Tools, Engine, Exhibit,
// Motion & Film, Data & Visualizer, Sound, Ink & Water, Mosaic, Type & Lettering,
// Light & Glass) across /floor.html, /studio.html, all 7 BuildLang WASM kernels, and the
// 13-format SHA-256 Unified Export Hub.

export const TEN_DOMAINS = Object.freeze([
  Object.freeze({
    index: 1,
    id: "tools",
    label: "1. Tools",
    shortLabel: "Tools",
    kernels: Object.freeze(["supertool_kernel", "estuary_kernel", "plotter_loom_kernel", "type_forge_kernel", "glass_optics_kernel", "fluid_well_kernel", "daw_synth_kernel"]),
    studioSource: "superframe",
    siteHref: "/tools.html",
  }),
  Object.freeze({
    index: 2,
    id: "engine",
    label: "2. Engine",
    shortLabel: "Engine",
    kernels: Object.freeze(["supertool_kernel", "glass_optics_kernel", "fluid_well_kernel"]),
    studioSource: "superframe",
    siteHref: "/studio.html",
  }),
  Object.freeze({
    index: 3,
    id: "exhibit",
    label: "3. Exhibit",
    shortLabel: "Exhibit",
    kernels: Object.freeze(["estuary_kernel", "supertool_kernel"]),
    studioSource: "estuary",
    siteHref: "/world/exhibit/index.html",
  }),
  Object.freeze({
    index: 4,
    id: "motion",
    label: "4. Motion & Film",
    shortLabel: "Motion & Film",
    kernels: Object.freeze(["estuary_kernel", "fluid_well_kernel"]),
    studioSource: "shaders",
    siteHref: "/explainers.html",
  }),
  Object.freeze({
    index: 5,
    id: "data",
    label: "5. Data & Visualizer",
    shortLabel: "Data & Visualizer",
    kernels: Object.freeze(["supertool_kernel", "daw_synth_kernel", "estuary_kernel"]),
    studioSource: "estuary",
    siteHref: "/world/visualizer/web/index.html",
  }),
  Object.freeze({
    index: 6,
    id: "sound",
    label: "6. Sound",
    shortLabel: "Sound",
    kernels: Object.freeze(["daw_synth_kernel", "supertool_kernel"]),
    studioSource: "daw",
    siteHref: "/world/sound/theme/index.html",
  }),
  Object.freeze({
    index: 7,
    id: "ink-water",
    label: "7. Ink & Water",
    shortLabel: "Ink & Water",
    kernels: Object.freeze(["fluid_well_kernel", "supertool_kernel"]),
    studioSource: "sand",
    siteHref: "/world/universe/proto/path.html#s-ink-in-water",
  }),
  Object.freeze({
    index: 8,
    id: "mosaic",
    label: "8. Mosaic",
    shortLabel: "Mosaic",
    kernels: Object.freeze(["plotter_loom_kernel", "supertool_kernel"]),
    studioSource: "shaders",
    siteHref: "/world/playbook/examples/mosaic.html",
  }),
  Object.freeze({
    index: 9,
    id: "type",
    label: "9. Type & Lettering",
    shortLabel: "Type & Lettering",
    kernels: Object.freeze(["type_forge_kernel", "plotter_loom_kernel"]),
    studioSource: "superframe",
    siteHref: "/accession.html",
  }),
  Object.freeze({
    index: 10,
    id: "light-glass",
    label: "10. Light & Glass",
    shortLabel: "Light & Glass",
    kernels: Object.freeze(["glass_optics_kernel", "supertool_kernel"]),
    studioSource: "elements",
    siteHref: "/elements.html",
  }),
]);

export function defaultUnifiedState() {
  return {
    activeDomain: "tools",
    seed: "harperz9-unified-01",
    palette: ["#09131d", "#d79e35", "#58b7f0", "#76d18a", "#f26b5b", "#e3c584"],
    elements: { mix: 0.5, density: 0.62, thermal: 0.35 },
    audio: { mode: 0, cutoff: 1800, resonance: 0.35, damp: 0.965, rms: 0.02, lufs: -34.0 },
    optics: { iorA: 1.5046, kmK: 0.25, angleDeg: 32, filmNm: 380, lensR: 0.5 },
    fluid: { curlFreq: 1.6, wetness: 0.45, vorticity: 0.8, div: 0.0 },
    typeText: "Accession",
    mosaicMix: 0.5,
    motionPhase: 0.35,
    receiptSha256: "0000000000000000",
  };
}

function fnv1a32(str, seed = 2166136261) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function computeStateDigestHex(state, wasm = null) {
  const canonical = JSON.stringify({
    d: state.activeDomain,
    s: state.seed,
    p: state.palette,
    e: state.elements,
    a: { mode: state.audio?.mode, cutoff: state.audio?.cutoff, res: state.audio?.resonance, damp: state.audio?.damp },
    o: state.optics,
    f: { curlFreq: state.fluid?.curlFreq, wetness: state.fluid?.wetness, vorticity: state.fluid?.vorticity },
    t: state.typeText,
    m: state.mosaicMix,
    ph: state.motionPhase,
  });
  const h1 = fnv1a32(canonical, 2166136261);
  const h2 = fnv1a32(canonical, 0x9e3779b9);
  if (wasm && typeof wasm.scene_fnv1a === "function" && typeof wasm.merkle_combine === "function") {
    const w1 = wasm.scene_fnv1a(h1, canonical.length, 10, 1) >>> 0;
    const w2 = wasm.merkle_combine(w1, h2) >>> 0;
    return w1.toString(16).padStart(8, "0") + w2.toString(16).padStart(8, "0");
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function cloneState(s) {
  return {
    ...s,
    palette: Array.isArray(s.palette) ? s.palette.slice() : [],
    elements: { ...s.elements },
    audio: { ...s.audio },
    optics: { ...s.optics },
    fluid: { ...s.fluid },
  };
}

export function createUnifiedStateBus(initial = {}, wasm = null) {
  let activeWasm = wasm;
  let state = cloneState({
    ...defaultUnifiedState(),
    ...initial,
    elements: { ...defaultUnifiedState().elements, ...(initial.elements || {}) },
    audio: { ...defaultUnifiedState().audio, ...(initial.audio || {}) },
    optics: { ...defaultUnifiedState().optics, ...(initial.optics || {}) },
    fluid: { ...defaultUnifiedState().fluid, ...(initial.fluid || {}) },
  });
  state.receiptSha256 = computeStateDigestHex(state, activeWasm);

  const listeners = new Set();

  const notify = (origin) => {
    const snap = cloneState(state);
    for (const fn of listeners) {
      try {
        fn(snap, origin);
      } catch (_) {}
    }
  };

  return {
    getState() {
      return cloneState(state);
    },
    setWasm(wasmExports) {
      activeWasm = wasmExports || null;
      state.receiptSha256 = computeStateDigestHex(state, activeWasm);
      notify("wasm");
      return cloneState(state);
    },
    update(patch = {}, origin = "user") {
      if (!patch || typeof patch !== "object") return cloneState(state);
      const next = cloneState(state);
      if (typeof patch.activeDomain === "string") next.activeDomain = patch.activeDomain;
      if (typeof patch.seed === "string") next.seed = patch.seed;
      if (Array.isArray(patch.palette) && patch.palette.length > 0) next.palette = patch.palette.slice(0, 8);
      if (patch.elements && typeof patch.elements === "object") next.elements = { ...next.elements, ...patch.elements };
      if (patch.audio && typeof patch.audio === "object") next.audio = { ...next.audio, ...patch.audio };
      if (patch.optics && typeof patch.optics === "object") next.optics = { ...next.optics, ...patch.optics };
      if (patch.fluid && typeof patch.fluid === "object") next.fluid = { ...next.fluid, ...patch.fluid };
      if (typeof patch.typeText === "string") next.typeText = patch.typeText;
      if (typeof patch.mosaicMix === "number" && Number.isFinite(patch.mosaicMix)) next.mosaicMix = Math.max(0, Math.min(1, patch.mosaicMix));
      if (typeof patch.motionPhase === "number" && Number.isFinite(patch.motionPhase)) next.motionPhase = patch.motionPhase;
      next.receiptSha256 = computeStateDigestHex(next, activeWasm);
      state = next;
      notify(origin);
      return cloneState(state);
    },
    subscribe(fn) {
      if (typeof fn !== "function") return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    domainById(id) {
      return TEN_DOMAINS.find((d) => d.id === id) || TEN_DOMAINS[0];
    },
  };
}

export function getSharedStudioBus() {
  const key = "__HARPERZ9_UNIFIED_STATE_BUS__";
  if (!globalThis[key]) {
    globalThis[key] = createUnifiedStateBus();
  }
  return globalThis[key];
}
