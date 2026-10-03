// system/media-engine/page.mjs
// One engine per page. Every surface that mounts a plugin asks for pageEngine() instead of creating
// its own scheduler, so a page with a hero aperture and a Retro stage runs one requestAnimationFrame
// and one off-screen, hidden-tab and reduced-motion policy.
//
// Plugins load on first use: usePlugin("retro") imports plugins/retro.mjs only when a page needs it.

import { createEngine } from "./core.mjs";

const LOADERS = {
  aperture: () => import("./plugins/aperture.mjs").then((m) => m.aperture),
  retro: () => import("./plugins/retro.mjs").then((m) => m.retro),
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

// Plugin ids the page engine can load, for the Studio's plugin list.
export function knownPlugins() { return Object.keys(LOADERS); }
