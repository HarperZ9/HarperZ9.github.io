// Curvature hatching on the GPU: the pass of hatch.mjs over the owned SDF still life.
//   const g = await createGpuHatch(host, "engraving", {}, { w, h });  g.frame();  g.packed (RGBA8)
import { resolveHatch } from "./hatch.mjs";
import { gpuKit } from "../lab/gpu-kit.mjs";
import { HATCH_WGSL } from "./hatch.wgsl.mjs";

export const packHatch = (plan) => { const p = plan.p; return Float32Array.from([plan.w, plan.h, p.freq, p.width, p.layers, p.umb, p.contour, ...p.ink, ...p.paper]); };
export async function createGpuHatch(host, preset, overrides, size) {
  const plan = resolveHatch(preset, overrides, size), n = size.w * size.h, kit = gpuKit(host), pipe = await host.compute("hatch", HATCH_WGSL);
  const B = { P: kit.st(4 * 16, "hatch params", packHatch(plan)), img: kit.st(16 * n, "hatch image"), out8: kit.st(4 * n, "hatch packed") };
  const list = [[pipe, [B.P, B.img, B.out8], Math.ceil(size.w / 8), Math.ceil(size.h / 8)]];
  return {
    plan, image: B.img, packed: B.out8,
    record(enc) { kit.record(enc, list); },
    frame() { kit.run(list); },
    async read() { return { packed: new Uint8Array(await kit.read(B.out8, 4 * n)) }; },
    destroy() { kit.destroy(); },
  };
}
