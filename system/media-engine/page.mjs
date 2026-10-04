// system/media-engine/page.mjs
// One engine per page. Every surface that mounts a plugin asks for pageEngine() instead of creating
// its own scheduler, so a page with a hero aperture and a Retro stage runs one requestAnimationFrame
// and one off-screen, hidden-tab and reduced-motion policy.
//
// Plugins load on first use: usePlugin("retro") imports plugins/retro.mjs only when a page needs it.

import { createEngine } from "./core.mjs";

// Mutable on purpose: registerPlugin() adds a loader at run time (the RAW slot is filled this way).
const LOADERS = {
  aperture: () => import("./plugins/aperture.mjs").then((m) => m.aperture),
  retro: () => import("./plugins/retro.mjs").then((m) => m.retro),
  "retro-2d": () => import("./plugins/retro.mjs").then((m) => m.retro2d),
  plate: () => import("./plugins/plate.mjs").then((m) => m.plate),
  ambient: () => import("./plugins/ambient.mjs").then((m) => m.ambient),
  loom: () => import("./plugins/loom.mjs").then((m) => m.loom),
  evidence: () => import("./plugins/evidence.mjs").then((m) => m.evidence),
  "slot-card": () => import("./plugins/slots.mjs").then((m) => m.slotCard),
  type: () => import("./plugins/type.mjs").then((m) => m.type),
  sketch: () => import("./plugins/sketch.mjs").then((m) => m.sketch),
  plotmap: () => import("./plugins/plotmap.mjs").then((m) => m.plotmap),
  voxels: () => import("./plugins/voxels.mjs").then((m) => m.voxels),
  showcase: () => import("./plugins/showcase.mjs").then((m) => m.showcase),
  // The sound family: each renders an offline reference and plays its samples (plugins/sound.mjs).
  "sound-seed": () => import("./plugins/sound.mjs").then((m) => m.soundSeed),
  "sound-music": () => import("./plugins/sound.mjs").then((m) => m.soundMusic),
  "sound-scan": () => import("./plugins/sound.mjs").then((m) => m.soundScan),
  "sound-figure": () => import("./plugins/sound.mjs").then((m) => m.soundFigure),
};

let engine = null;
const loading = new Map();

export function pageEngine() {
  if (!engine) {
    engine = createEngine();
    if (typeof window !== "undefined") window.__mediaEngine = engine;
  }
  return engine;
}

// Register a plugin by id (lazily imported) or pass a plugin object. Resolves to the page engine.
export async function usePlugin(idOrPlugin) {
  const e = pageEngine();
  if (typeof idOrPlugin === "object") { e.register(idOrPlugin); return e; }
  if (e.plugins().includes(idOrPlugin)) return e;
  if (!loading.has(idOrPlugin)) {
    const load = LOADERS[idOrPlugin];
    if (!load) throw new Error("media-engine: no loader for plugin " + idOrPlugin);
    loading.set(idOrPlugin, load().then((p) => { e.register(p); return e; }));
  }
  return loading.get(idOrPlugin);
}

// Add a plugin loader at run time. A slot in plugins/slots.mjs (raw, revival) becomes live the
// moment a loader is registered under its pluginId, e.g.
//   registerPlugin("raw", () => import("./plugins/raw.mjs").then((m) => m.raw));
export function registerPlugin(id, loader) {
  if (typeof loader !== "function") throw new Error("media-engine: registerPlugin needs a loader function");
  LOADERS[id] = loader;
  loading.delete(id);
}

// Plugin ids the page engine can load, for the Studio's plugin list.
export function knownPlugins() { return Object.keys(LOADERS); }
