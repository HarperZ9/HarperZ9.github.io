// Scenes: one file gives both the live, interactive version and the offline
// frame-exact render. A scene module's default export:
//
//   export default {
//     title: "...", duration: 175.5, design: [1920, 1080], fps: 30,
//     params: [{ id: "share", label: "share fabricated", min: 0, max: 1, step: 0.01, value: 0.55 }],
//     layers: { threads: { world: 5 }, worlds: false },     // optional engine layers to create
//     chapters: [{ t: 0, title: "One reference" }, ...],
//     async load(ctx) { return { atlas: await ctx.json("hanken-500.json") }; },   // assets, particle systems
//     frame(t, ctx) { return { background, camera, items, post }; },             // pure in t and ctx.params
//   };
//
// ctx carries: assets (what load returned), params (current values), motion
// (the renderer, or null in Node), reduced (prefers-reduced-motion), dt (the
// frame step for history layers such as Threads), url(path) and json(path)
// relative to the scene file.

export function sceneContext(scene, { baseUrl, motion = null, reduced = false, fetcher = globalThis.fetch } = {}) {
  const url = (p) => new URL(p, baseUrl).href;
  const params = Object.fromEntries((scene.params || []).map((p) => [p.id, p.value]));
  return {
    scene, motion, reduced, params, assets: null, dt: 1 / (scene.fps || 30), time: 0,
    url,
    json: async (p) => { const r = await fetcher(url(p)); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); },
    text: async (p) => { const r = await fetcher(url(p)); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.text(); },
  };
}

export async function loadScene(scene, ctx) {
  ctx.assets = scene.load ? await scene.load(ctx) : {};
  return ctx;
}

// Evaluate a frame; clamps t to the scene and fills in defaults.
export function evaluate(scene, ctx, t) {
  t = Math.max(0, Math.min(scene.duration, t));
  ctx.time = t;
  const list = scene.frame(t, ctx) || {};
  list.items = (list.items || []).filter(Boolean);
  return list;
}

// Frame times for an offline render: frame i is drawn at exactly i / fps.
export function frameTimes(scene, fps = scene.fps || 30, from = 0, to = scene.duration) {
  const n0 = Math.round(from * fps), n1 = Math.ceil(to * fps - 1e-9);
  const out = [];
  for (let i = n0; i < n1; i++) out.push({ index: i, t: i / fps });
  return out;
}
