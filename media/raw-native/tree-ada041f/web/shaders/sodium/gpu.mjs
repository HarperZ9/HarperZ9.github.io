// Spectral sodium shading on the GPU (sodium.wgsl.mjs).
//   const s = await createGpuSodium(host, plan, g, { gain });  s.frame(g, time);  await s.read() -> RGBA8 bytes
import { COMMON_WGSL } from "../common.mjs";
import { gpuKit, ENCODE_WGSL } from "../lab/gpu-kit.mjs";
import { SODIUM_WGSL, SODIUM_P, SODIUM_LIGHT } from "./sodium.wgsl.mjs";

export function packLights(lights) {
  const o = new Float32Array(Math.max(1, lights.length) * SODIUM_LIGHT);
  lights.forEach((L, j) => o.set([...L.pos, L.type, L.I, ...L.cone, L.mode], j * SODIUM_LIGHT));
  return o;
}
export const packTable = (plan) => Float32Array.from(plan.table.rgb.flat(2));
export const packWhite = (plan) => Float32Array.from(plan.table.white.flat());
export function packParams(plan, g, time, gain) {
  const P = new Float32Array(SODIUM_P);
  P.set([g.w, g.h, g.lights.length, plan.table.rgb[0].length, plan.sky, plan.ambient, plan.mist, plan.extinct, plan.rain, time, ...g.cam.pos, gain]);
  return P;
}
export async function createGpuSodium(host, plan, g, { gain = 2 } = {}) {
  const pipe = await host.compute("sodium", COMMON_WGSL + ENCODE_WGSL + SODIUM_WGSL), kit = gpuKit(host), n = g.w * g.h;
  const tbl = packTable(plan), wh = packWhite(plan), lts = packLights(g.lights);
  const B = { P: kit.st(4 * SODIUM_P, "na params"), gb: kit.st(4 * n * 40, "na gbuffer"), lt: kit.st(4 * lts.length, "na lights"), rgb: kit.st(4 * tbl.length, "na table", tbl), wh: kit.st(4 * wh.length, "na white", wh), out8: kit.st(4 * n, "na out8") };
  const list = [[pipe, [B.P, B.gb, B.lt, B.rgb, B.wh, B.out8], Math.ceil(g.w / 8), Math.ceil(g.h / 8)]];
  return {
    frame(gg, time) { host.write(B.P, packParams(plan, gg, time, gain)); host.write(B.gb, Float32Array.from(gg.data)); host.write(B.lt, packLights(gg.lights)); kit.run(list); },
    async read() { return new Uint8Array(await kit.read(B.out8, 4 * n)); },
    destroy() { kit.destroy(); },
  };
}
