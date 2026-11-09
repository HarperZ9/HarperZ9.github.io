// VHS on the GPU: the passes of vhs.mjs.
//   const v = await createGpuVhs(host, "thriller", {}, { w: srcW, h: srcH }, { w: outW, h: outH });
//   v.frame(srcRGBA /* R'G'B'A signal values */, frameNo);
//   v.signal: lines x N R'G'B'A (feed the CRT);  v.packed: display RGBA8
import { COMMON_WGSL } from "../common.mjs";
import { resolveVhs } from "./vhs.mjs";
import { YIQ, YIQ_INV } from "../crt/signal.mjs";
import { VHS_HEAD, SAMPLE_WGSL, TAPE_WGSL, PLAY_WGSL, SHOW_WGSL } from "./vhs.wgsl.mjs";

export function packVhs(plan, f, out) {
  const p = plan.p, t = plan.taps, half = (a) => (a.length - 1) / 2;
  return Float32Array.from([plan.N, plan.lines, plan.src.w, plan.src.h, f, p.seed, p.jitter, p.headSwitchLines, p.headSkew, p.tracking,
    plan.lumaNoise, plan.chromaNoise, p.peaking, plan.delay, plan.phaseNoise, p.dropouts * plan.g, half(t.luma), half(t.peak), half(t.chroma), out.w, out.h, ...YIQ, ...YIQ_INV]);
}

export async function createGpuVhs(host, preset, overrides, src, out) {
  const plan = resolveVhs(preset, overrides, src), n = plan.N * plan.lines, head = COMMON_WGSL + VHS_HEAD;
  const pipes = { sample: await host.compute("vhs.sample", head + SAMPLE_WGSL), tape: await host.compute("vhs.tape", head + TAPE_WGSL), play: await host.compute("vhs.play", head + PLAY_WGSL), show: await host.compute("vhs.show", head + SHOW_WGSL) };
  const st = (bytes, label, data) => host.buffer({ size: bytes, usage: ["storage", "copy-dst", "copy-src"], label, data });
  const taps = Float32Array.from([...plan.taps.luma, ...plan.taps.peak, ...plan.taps.chroma]);
  const B = { V: st(4 * 40, "vhs params"), taps: st(taps.byteLength, "vhs taps", taps), src: st(16 * src.w * src.h, "vhs source"),
    sm: st(16 * n, "vhs sampled"), tp: st(16 * n, "vhs tape"), sig: st(16 * n, "vhs signal"), out8: st(4 * out.w * out.h, "vhs display") };
  return {
    plan, signal: B.sig, packed: B.out8,
    frame(srcRGBA, f = 0) {
      host.write(B.V, packVhs(plan, f, out)); if (srcRGBA) host.write(B.src, srcRGBA);
      const enc = host.device.createCommandEncoder(), cp = enc.beginComputePass();
      const run = (pipe, list, x, y) => { cp.setPipeline(pipe); cp.setBindGroup(0, host.bind(pipe, list)); cp.dispatchWorkgroups(x, y); };
      run(pipes.sample, [B.V, B.src, B.sm], Math.ceil(plan.N / 64), plan.lines);
      run(pipes.tape, [B.V, B.taps, B.sm, B.tp], Math.ceil(plan.N / 64), plan.lines);
      run(pipes.play, [B.V, B.tp, B.sig], Math.ceil(plan.N / 64), plan.lines);
      run(pipes.show, [B.V, B.sig, B.out8], Math.ceil(out.w / 8), Math.ceil(out.h / 8));
      cp.end(); host.device.queue.submit([enc.finish()]);
    },
    async read() {
      const s = host.buffer({ size: 4 * out.w * out.h, usage: ["map-read", "copy-dst"] }), enc = host.device.createCommandEncoder();
      enc.copyBufferToBuffer(B.out8, 0, s, 0, 4 * out.w * out.h); host.device.queue.submit([enc.finish()]);
      await s.mapAsync(1); const o = new Uint8Array(s.getMappedRange().slice(0)); s.unmap(); s.destroy(); return { packed: o };
    },
    destroy() { for (const b of Object.values(B)) b.destroy(); },
  };
}
