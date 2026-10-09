// Set up everything a scene needs on one canvas: the raw-native host, the
// Motion renderer, the scene's assets and the engine layers it asks for
// (Threads, Worlds). Shared by the live player and the offline capture page.
//
//   const eng = await createEngine({ canvas, sceneUrl, shaders: "../src/renderer/gpu/shaders/" });
//   eng.resize(1920, 1080); eng.draw(12.5);  await eng.capture(375);   // frame 375
import { createHost } from "../raw-gpu.mjs";
import { createMotion } from "./renderer.mjs";
import { sceneContext, loadScene, evaluate } from "./scene.mjs";

export async function createEngine({ canvas, sceneUrl, scene = null, shaders, reduced = false, timing = true }) {
  const host = await createHost({ canvas, timing });
  const motion = await createMotion(host);
  if (!scene) scene = (await import(sceneUrl)).default;
  const ctx = sceneContext(scene, { baseUrl: sceneUrl, motion, reduced });
  const layers = scene.layers || {};
  const shaderUrl = (f) => new URL(f, shaders || new URL("../../src/renderer/gpu/shaders/", import.meta.url)).href;
  const text = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.text(); };
  if (layers.threads) {
    const { createThreads } = await import("../threads.mjs");
    const th = await createThreads(host, { wgsl: await text(shaderUrl("threads.wgsl")), world: layers.threads.world ?? 0, present: false });
    th.set({ tour: false, ...layers.threads, world: layers.threads.world ?? 0 });
    motion.useThreads(th);
    ctx.threads = th;
  }
  if (layers.worlds) {
    const { createWorlds } = await import("../worlds.mjs");
    const wo = await createWorlds(host, { wgsl: await text(shaderUrl("worlds.wgsl")), world: layers.worlds.world || "eye" });
    wo.set({ tour: false, playing: false });
    motion.useWorlds(wo);
    ctx.worlds = wo;
  }
  await loadScene(scene, ctx);
  const eng = {
    host, motion, scene, ctx,
    size: [0, 0],
    resize(w, h) {
      motion.resize(w, h);
      eng.size = [motion.w, motion.h];
      // History layers draw at a fraction of the frame; they are soft light, not detail.
      if (ctx.threads) {
        ctx.threads.resize(Math.round(motion.w * (layers.threads.scale ?? 0.5)), Math.round(motion.h * (layers.threads.scale ?? 0.5)));
        // layers.threads.warm: frames run once, at a fixed step, so the field has formed by the first frame.
        if (!eng.warmed) { eng.warmed = true; for (let i = 0; i < (layers.threads.warm || 0); i++) ctx.threads.frame(1 / (scene.fps || 30)); }
      }
    },
    list(t) {
      const l = evaluate(scene, ctx, t);
      for (const it of l.items) if (it.kind === "threads" && it.dt === undefined) it.dt = ctx.dt;
      return l;
    },
    draw(t, frame = 0) { motion.draw(eng.list(t), { frame, time: t }); },
    async capture(index, fps = scene.fps || 30) {
      ctx.dt = 1 / fps;
      const t = index / fps;
      return motion.capture(eng.list(t), { frame: index, time: t });
    },
  };
  return eng;
}
