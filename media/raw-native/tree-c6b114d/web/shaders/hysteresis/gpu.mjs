// Hysteresis quantisation on the GPU: the pass of hysteresis.mjs, one dispatch per frame, with the
// decision state in two ping-pong buffers.
//   const q = await createGpuHysteresis(host, "bands6", {}, { w, h });
//   q.frame(sceneRGBA, motion /* {mv, dA} or null */, dist);  await q.read() -> { packed, idx }
import { resolveHysteresis } from "./hysteresis.mjs";
import { gpuKit } from "../lab/gpu-kit.mjs";
import { HYST_WGSL } from "./hysteresis.wgsl.mjs";

export function packMotion(n, motion, dist) {
  const a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a[i * 4] = motion ? motion.mv[i * 2] : 0; a[i * 4 + 1] = motion ? motion.mv[i * 2 + 1] : 0; a[i * 4 + 2] = motion ? motion.dA[i] : dist[i]; a[i * 4 + 3] = dist[i]; }
  return a;
}
export async function createGpuHysteresis(host, preset, overrides, size, { hysteresis = true } = {}) {
  const plan = resolveHysteresis(preset, overrides, size), n = size.w * size.h, p = plan.p;
  const pipe = await host.compute("hysteresis", HYST_WGSL), kit = gpuKit(host);
  const pal = new Float32Array(Math.max(1, plan.pal.length) * 4); plan.pal.forEach((q, k) => pal.set([q[0], q[1], q[2], 0], k * 4));
  const B = { P: kit.st(4 * 12, "hyst params"), pal: kit.st(pal.byteLength, "hyst palette", pal), img: kit.st(16 * n, "hyst frame"), mo: kit.st(16 * n, "hyst motion"),
    s0: kit.st(16 * n, "hyst state 0"), s1: kit.st(16 * n, "hyst state 1"), out8: kit.st(4 * n, "hyst packed") };
  let frameNo = 0, cur = B.s1;
  const params = (hasState, hasMotion) => Float32Array.from([size.w, size.h, p.mode === "bands" ? 0 : 1, p.N || 0, p.margin, p.gain, p.depthTol, plan.K, plan.pal.length, hasState ? 1 : 0, hasMotion ? 1 : 0, hysteresis ? 1 : 0]);
  return {
    plan, packed: B.out8,
    get state() { return cur; },
    frame(sceneRGBA, motion, dist) {
      const prev = frameNo % 2 === 0 ? B.s1 : B.s0; cur = frameNo % 2 === 0 ? B.s0 : B.s1;
      host.write(B.P, params(frameNo > 0, !!motion)); host.write(B.img, sceneRGBA); host.write(B.mo, packMotion(n, motion, dist));
      kit.run([[pipe, [B.P, B.pal, B.img, B.mo, prev, cur, B.out8], Math.ceil(size.w / 8), Math.ceil(size.h / 8)]]);
      frameNo++;
    },
    async read() {
      const packed = new Uint8Array(await kit.read(B.out8, 4 * n)), st = new Float32Array(await kit.read(cur, 16 * n)), idx = new Int32Array(n);
      for (let i = 0; i < n; i++) idx[i] = Math.round(st[i * 4]);
      return { packed, idx };
    },
    destroy() { kit.destroy(); },
  };
}
