// Scan-causal EHT sag on the GPU: the passes of sag.mjs.
//   const s = await createGpuSag(host, "thriller", {}, { w, h });
//   s.frame(signalRGBA /* R'G'B'A f32 */);  s.signal: R'G'B'A f32 (feed the CRT);  s.packed: RGBA8
import { resolveSag } from "./sag.mjs";
import { gpuKit } from "../lab/gpu-kit.mjs";
import { SAG_HEAD, SAG_CURRENT_WGSL, SAG_SCAN_WGSL, SAG_RESAMPLE_WGSL } from "./sag.wgsl.mjs";

export function packSag(plan) {
  const p = plan.p;
  return Float32Array.from([plan.w, plan.h, p.S, plan.alpha, p.focus, p.sigma0, p.bright, p.gamma, plan.blank, p.settle ? 1 : 0, p.initial, plan.R]);
}
export async function createGpuSag(host, preset, overrides, size) {
  const plan = resolveSag(preset, overrides, size), n = size.w * size.h;
  const pipes = { cur: await host.compute("sag.current", SAG_HEAD + SAG_CURRENT_WGSL), scan: await host.compute("sag.scan", SAG_HEAD + SAG_SCAN_WGSL),
    res: await host.compute("sag.resample", SAG_HEAD + SAG_RESAMPLE_WGSL) };
  const kit = gpuKit(host);
  const B = { P: kit.st(4 * 12, "sag params", packSag(plan)), src: kit.st(16 * n, "sag source"), I: kit.st(4 * size.h, "sag currents"),
    L: kit.st(16 * size.h, "sag lines"), out: kit.st(16 * n, "sag signal"), out8: kit.st(4 * n, "sag packed") };
  const list = [[pipes.cur, [B.P, B.src, B.I], size.h, 1], [pipes.scan, [B.P, B.I, B.L], 1, 1],
    [pipes.res, [B.P, B.src, B.L, B.out, B.out8], Math.ceil(size.w / 8), Math.ceil(size.h / 8)]];
  return {
    plan, signal: B.out, packed: B.out8, lines: B.L,
    upload(sig) { host.write(B.src, sig); },
    record(enc) { kit.record(enc, list); },
    frame(sig) { if (sig) this.upload(sig); kit.run(list); },
    async read() { return { packed: new Uint8Array(await kit.read(B.out8, 4 * n)) }; },
    destroy() { kit.destroy(); },
  };
}
