// Interference glazes on the GPU: the pass of glaze.mjs.
//   const g = await createGpuGlaze(host, "beetle", {}, { w, h });
//   g.frame(streetLikeSource /* albedo, light, fogT, kind, normals, camera, fogColor */);
import { COMMON_WGSL } from "../common.mjs";
import { resolveGlaze } from "./glaze.mjs";
import { packPigments } from "../paint/gpu.mjs";
import { packAux } from "../lightpaint/gpu.mjs";
import { gpuKit, ENCODE_WGSL } from "../lab/gpu-kit.mjs";
import { GLAZE_WGSL } from "./glaze.wgsl.mjs";

export function packGlaze(plan, size, cam, fogColor, gain = 2.4) {
  const p = plan.p;
  return Float32Array.from([size.w, size.h, p.d0, p.dVar, p.noiseScale, p.coverage, p.n0, p.n2, p.A, p.B, p.dispersion ? 1 : 0, p.filmN,
    ...cam.fwd, ...cam.right, ...cam.up, cam.aspect, cam.tan, ...fogColor, gain, ...cam.eye]);
}
export async function createGpuGlaze(host, preset, overrides, size, { gain = 2.4 } = {}) {
  const plan = resolveGlaze(preset, overrides), n = size.w * size.h;
  const pipe = await host.compute("glaze", COMMON_WGSL + ENCODE_WGSL + GLAZE_WGSL), kit = gpuKit(host), pig = packPigments();
  const B = { P: kit.st(4 * 32, "glaze params"), pig: kit.st(pig.byteLength, "glaze pigments", pig), alb: kit.st(16 * n, "glaze albedo"), light: kit.st(16 * n, "glaze irradiance"),
    aux: kit.st(16 * n, "glaze fog and kind"), nrm: kit.st(16 * n, "glaze normals"), img: kit.st(16 * n, "glaze image"), out8: kit.st(4 * n, "glaze packed") };
  const list = [[pipe, [B.P, B.pig, B.alb, B.light, B.aux, B.nrm, B.img, B.out8], Math.ceil(size.w / 8), Math.ceil(size.h / 8)]];
  return {
    plan, image: B.img, packed: B.out8,
    upload(src) { host.write(B.P, packGlaze(plan, size, src.camera, src.fogColor, gain)); host.write(B.alb, src.albedo); host.write(B.light, src.light); host.write(B.aux, packAux(src)); host.write(B.nrm, src.normals); },
    record(enc) { kit.record(enc, list); },
    frame(src) { if (src) this.upload(src); kit.run(list); },
    async read() { return { packed: new Uint8Array(await kit.read(B.out8, 4 * n)) }; },
    destroy() { kit.destroy(); },
  };
}
