// The lens suite on the GPU: the two passes of lens.mjs (core, gather).
//   const g = await createGpuLens(host, plan);  g.frame(frame, srcs, keep);  await g.read() -> { packed: Uint8Array RGBA8, linear: Float32Array }
// srcs come from prepareSources (CPU), keep from extractSources or null.
import { COMMON_WGSL } from "../common.mjs";
import { gpuKit, ENCODE_WGSL } from "../lab/gpu-kit.mjs";
import { LENS_CORE_WGSL, LENS_GATHER_WGSL, LENS_P, LENS_SRC } from "./lens.wgsl.mjs";

export function packParams(plan, nSrc, gain) {
  const { p } = plan, P = new Float32Array(LENS_P);
  P.set([plan.W, plan.H, plan.cx, plan.cy, p.squeeze, p.iris.blades, p.iris.roundness, Math.cos(p.streakAngle), Math.sin(p.streakAngle), p.streakLenPx, p.streakThickPx,
    plan.starCell, p.starGain, nSrc, plan.ghosts.length, plan.star.M, p.threshold, p.tile, Math.ceil(plan.W / p.tile), gain], 0);
  P.set(plan.binRgb.flat(), 20); P.set(plan.caScale, 44); P.set(plan.halo.flat(), 52); P.set(plan.phi, 68);
  return P;
}
export const packGhosts = (plan) => Float32Array.from(plan.ghosts.flatMap((g) => g.flat()));
export function packSources(srcs, max) {
  const o = new Float32Array(Math.max(1, max) * LENS_SRC);
  srcs.forEach((s, k) => o.set([s.x, s.y, ...s.E, ...s.ghost, ...s.streak], k * LENS_SRC));
  return o;
}
export function packFrame(f) { const o = new Float32Array(f.width * f.height * 4); for (let i = 0; i < o.length; i++) o[i] = f.data[i]; return o; }

export async function createGpuLens(host, plan, { gain = 2.4 } = {}) {
  const core = await host.compute("lens core", LENS_CORE_WGSL), gather = await host.compute("lens gather", COMMON_WGSL + ENCODE_WGSL + LENS_GATHER_WGSL);
  const kit = gpuKit(host), n = plan.W * plan.H, tw = Math.ceil(plan.W / plan.p.tile), th = Math.ceil(plan.H / plan.p.tile), max = plan.p.maxSources;
  const gh = packGhosts(plan), st = Float32Array.from(plan.star.data);
  const B = { P: kit.st(4 * LENS_P, "lens params"), img: kit.st(16 * n, "lens in"), keep: kit.st(4 * tw * th, "lens keep"), core: kit.st(16 * n, "lens core"), gh: kit.st(4 * gh.length, "lens ghosts", gh),
    src: kit.st(4 * LENS_SRC * Math.max(1, max), "lens sources"), star: kit.st(4 * st.length, "lens star", st), outF: kit.st(16 * n, "lens out"), out8: kit.st(4 * n, "lens out8") };
  const wx = Math.ceil(plan.W / 8), wy = Math.ceil(plan.H / 8);
  const list = [[core, [B.P, B.img, B.keep, B.core], wx, wy], [gather, [B.P, B.core, B.gh, B.src, B.star, B.outF, B.out8], wx, wy]];
  return {
    upload(frame, srcs, keep) {
      host.write(B.P, packParams(plan, Math.min(srcs.length, max), gain)); host.write(B.src, packSources(srcs.slice(0, max), max));
      host.write(B.img, packFrame(frame)); host.write(B.keep, keep ? Uint32Array.from(keep) : new Uint32Array(tw * th));
    },
    record(enc) { kit.record(enc, list.slice(0, 1)); kit.record(enc, list.slice(1)); },
    frame(frame, srcs, keep) { this.upload(frame, srcs, keep); kit.run(list.slice(0, 1)); kit.run(list.slice(1)); },
    async read() { return { packed: new Uint8Array(await kit.read(B.out8, 4 * n)), linear: new Float32Array(await kit.read(B.outF, 16 * n)) }; },
    destroy() { kit.destroy(); },
  };
}
