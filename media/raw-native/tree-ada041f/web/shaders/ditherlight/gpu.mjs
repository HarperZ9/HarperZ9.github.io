// Dither-quantised lighting on the GPU: the pass of ditherlight.mjs.
//   const d = await createGpuDitherlight(host, "ink", { anchor: "screen" }, { w, h });
//   d.frame(gbuffer, lights);  await d.read() -> { level: Uint32Array, packed: Uint8Array RGBA8 }
import { COMMON_WGSL } from "../common.mjs";
import { resolveDitherlight } from "./ditherlight.mjs";
import { SOURCES, ANCHORS } from "./thresholds.mjs";
import { blueNoise64 } from "../dither/bluenoise.mjs";
import { gpuKit } from "../lab/gpu-kit.mjs";
import { DITHERLIGHT_WGSL } from "./ditherlight.wgsl.mjs";

export function packParams(plan, size, nLights) {
  return Float32Array.from([size.w, size.h, plan.levels, SOURCES[plan.source], ANCHORS[plan.anchor], plan.cell, plan.px, plan.pa, plan.gamma, plan.dark, plan.hemi, plan.fogDist, plan.fogMax, nLights, ...plan.ink, ...plan.paper]);
}
// Six vec4f per pixel: (albedo, kind, depth, haze), wpos, nrm, apos, anrm, vis.
export function packGbuffer(g) {
  const n = g.width * g.height, o = new Float32Array(n * 24);
  for (let i = 0; i < n; i++) {
    const b = i * 24;
    o[b] = g.albedo[i]; o[b + 1] = g.kind[i]; o[b + 2] = g.depth[i]; o[b + 3] = g.haze ? g.haze[i] : 0;
    for (let c = 0; c < 3; c++) { o[b + 4 + c] = g.wpos[i * 3 + c]; o[b + 8 + c] = g.nrm[i * 3 + c]; o[b + 12 + c] = g.apos[i * 3 + c]; o[b + 16 + c] = g.anrm[i * 3 + c]; }
    for (let c = 0; c < 4; c++) o[b + 20 + c] = g.vis[i * 4 + c];
  }
  return o;
}
export function packLights(lights) {
  const o = new Float32Array(Math.max(1, lights.length) * 24);
  lights.forEach((L, i) => {
    const b = i * 24, beam = L.kind === "beam";
    o.set([beam ? 1 : 0, L.intensity, beam ? L.range : L.radius, beam ? L.outer : L.core], b);
    o.set([...L.pos, L.wrap], b + 4);
    if (beam) { o.set([...L.dir, L.inner], b + 8); o.set([...L.tan, L.slats], b + 12); o.set([...L.bit, L.duty], b + 16); o.set([L.phase, 0, 0, 0], b + 20); }
  });
  return o;
}
export async function createGpuDitherlight(host, preset, overrides, size, { fov } = {}) {
  const plan = resolveDitherlight(preset, overrides, { height: size.h, ...(fov ? { fov } : {}) }), n = size.w * size.h;
  const pipe = await host.compute("ditherlight", COMMON_WGSL + DITHERLIGHT_WGSL), kit = gpuKit(host), bn = Uint32Array.from(blueNoise64());
  const B = { P: kit.st(4 * 20, "dl params"), gb: kit.st(96 * n, "dl gbuffer"), lights: kit.st(4 * 24 * 8, "dl lights"), bn: kit.st(4 * 4096, "dl blue noise", bn), lvl: kit.st(4 * n, "dl levels"), out8: kit.st(4 * n, "dl packed") };
  const list = [[pipe, [B.P, B.gb, B.lights, B.bn, B.lvl, B.out8], Math.ceil(size.w / 8), Math.ceil(size.h / 8)]];
  return {
    plan,
    upload(g, lights) { if (lights.length > 8) throw new Error("ditherlight: at most 8 lights"); host.write(B.P, packParams(plan, size, lights.length)); host.write(B.gb, packGbuffer(g)); host.write(B.lights, packLights(lights)); },
    record(enc) { kit.record(enc, list); },
    frame(g, lights) { if (g) this.upload(g, lights); kit.run(list); },
    async read() { return { level: new Uint32Array(await kit.read(B.lvl, 4 * n)), packed: new Uint8Array(await kit.read(B.out8, 4 * n)) }; },
    destroy() { kit.destroy(); },
  };
}
