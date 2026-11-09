// The paint-over projection material on the GPU: the pass of projector.mjs.
//   const pass = await createGpuPaintover(host, projectors, { w, h });
//   pass.frame(gbuffer, viewCam);  await pass.read() -> Uint8Array RGBA8 (alpha 0 where uncovered or no surface)
import { gpuKit } from "../lab/gpu-kit.mjs";
import { KEYFRAME, reaches } from "./projector.mjs";
import { PAINTOVER_WGSL } from "./projector.wgsl.mjs";

export const MAX_PROJECTORS = 4;
const camFloats = (c) => [c.ortho ? 1 : 0, ...c.pos, ...c.fwd, ...c.right, ...c.up, c.scale, c.fovY];
export function packParams(projectors, viewCam, size, opt = KEYFRAME) {
  const P = new Float32Array(24 + 24 * MAX_PROJECTORS), reach = reaches(projectors, opt);
  P.set([size.w, size.h, projectors.length, opt.facingPow, opt.fMin, opt.floor, opt.tolBase, opt.tolGrazing], 0); P.set(camFloats(viewCam), 8);
  let io = 0, dof = 0;
  projectors.forEach((p, k) => { const b = 24 + 24 * k; P.set(camFloats(p.cam), b); P.set([p.w, p.h, reach[k], io, dof], b + 15); io += p.w * p.h; dof += p.w * p.h; });
  return P;
}
export function packGbuffer(g) {
  const n = g.w * g.h, o = new Float32Array(n * 8);
  for (let i = 0; i < n; i++) { o[i * 8] = g.P[i * 3]; o[i * 8 + 1] = g.P[i * 3 + 1]; o[i * 8 + 2] = g.P[i * 3 + 2]; o[i * 8 + 3] = g.hit[i]; o[i * 8 + 4] = g.N[i * 3]; o[i * 8 + 5] = g.N[i * 3 + 1]; o[i * 8 + 6] = g.N[i * 3 + 2]; }
  return o;
}
export async function createGpuPaintover(host, projectors, size, opt = KEYFRAME) {
  if (projectors.length > MAX_PROJECTORS) throw new Error(`paintover: at most ${MAX_PROJECTORS} projectors`);
  const pipe = await host.compute("paintover", PAINTOVER_WGSL), kit = gpuKit(host), n = size.w * size.h;
  const words = projectors.reduce((s, p) => s + p.w * p.h, 0), img = new Uint32Array(words), dep = new Float32Array(words);
  let o = 0; for (const p of projectors) { img.set(new Uint32Array(p.rgba.buffer.slice(p.rgba.byteOffset, p.rgba.byteOffset + p.w * p.h * 4)), o); dep.set(p.depth, o); o += p.w * p.h; }
  const B = { P: kit.st(4 * (24 + 24 * MAX_PROJECTORS), "po params"), gb: kit.st(32 * n, "po gbuffer"), img: kit.st(4 * words, "po paintings", img), dep: kit.st(4 * words, "po depth", dep), out8: kit.st(4 * n, "po packed") };
  const list = [[pipe, [B.P, B.gb, B.img, B.dep, B.out8], Math.ceil(size.w / 8), Math.ceil(size.h / 8)]];
  return {
    upload(g, viewCam) { host.write(B.P, packParams(projectors, viewCam, size, opt)); host.write(B.gb, packGbuffer(g)); },
    record(enc) { kit.record(enc, list); },
    frame(g, viewCam) { if (g) this.upload(g, viewCam); kit.run(list); },
    async read() { return new Uint8Array(await kit.read(B.out8, 4 * n)); },
    destroy() { kit.destroy(); },
  };
}
