// Pigment-space lighting on the GPU: the pass of lightpaint.mjs.
//   const l = await createGpuLightpaint(host, "disco", {}, { w, h });
//   l.frame({ albedo, light, fogT, kind, fogColor });  l.image: scene-linear RGBA f32;  l.packed: RGBA8
import { COMMON_WGSL } from "../common.mjs";
import { resolveLightpaint } from "./lightpaint.mjs";
import { packPigments } from "../paint/gpu.mjs";
import { gpuKit, ENCODE_WGSL } from "../lab/gpu-kit.mjs";
import { LP_WGSL } from "./lightpaint.wgsl.mjs";

export function packLightpaint(plan, size, fogColor, gain = 2.4) {
  const p = plan.p;
  return Float32Array.from([size.w, size.h, p.Emid, p.t0, p.strength, p.shape, p.complement ? 1 : 0, ...p.shadow, ...p.light, ...fogColor, gain]);
}
// aux per pixel: fog fraction, kind (0 sky, 1 emissive, 2 lit), view distance, 0.
export function packAux(src) {
  const n = src.width * src.height, a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a[i * 4] = src.fogT[i]; a[i * 4 + 1] = src.kind[i]; a[i * 4 + 2] = src.depth ? src.depth[i] : 0; }
  return a;
}
export async function createGpuLightpaint(host, preset, overrides, size, { gain = 2.4 } = {}) {
  const plan = resolveLightpaint(preset, overrides), n = size.w * size.h;
  const pipe = await host.compute("lightpaint", COMMON_WGSL + ENCODE_WGSL + LP_WGSL), kit = gpuKit(host), pig = packPigments();
  const B = { P: kit.st(4 * 20, "lp params"), pig: kit.st(pig.byteLength, "lp pigments", pig), alb: kit.st(16 * n, "lp albedo"), light: kit.st(16 * n, "lp irradiance"),
    aux: kit.st(16 * n, "lp fog and kind"), img: kit.st(16 * n, "lp image"), out8: kit.st(4 * n, "lp packed") };
  const list = [[pipe, [B.P, B.pig, B.alb, B.light, B.aux, B.img, B.out8], Math.ceil(size.w / 8), Math.ceil(size.h / 8)]];
  return {
    plan, image: B.img, packed: B.out8,
    upload(src) { host.write(B.P, packLightpaint(plan, size, src.fogColor, gain)); host.write(B.alb, src.albedo); host.write(B.light, src.light); host.write(B.aux, packAux(src)); },
    record(enc) { kit.record(enc, list); },
    frame(src) { if (src) this.upload(src); kit.run(list); },
    async read() { return { packed: new Uint8Array(await kit.read(B.out8, 4 * n)) }; },
    destroy() { kit.destroy(); },
  };
}
