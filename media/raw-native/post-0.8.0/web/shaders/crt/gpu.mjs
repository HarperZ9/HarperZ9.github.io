// The physical CRT on the GPU: the passes of crt.mjs as WGSL compute through the web
// host's frame graph, with per-pass GPU time where the adapter has timestamps.
//
//   const crt = await createGpuCrt(host, "pvm-20", overrides, { w: 256, h: 224 }, { w: 1920, h: 1440 });
//   crt.frame(srcRGBA /* Float32Array of R'G'B'A, src.w x src.h */);  // records and submits one frame
//   crt.image        // GPUBuffer of linear RGBA f32 (vec4 per pixel), 1 = tube peak white
//   crt.packed       // GPUBuffer of sRGB RGBA8 (u32 per pixel) after the display encode
//   await crt.read() // { image: Float32Array, packed: Uint8Array }
import { Access } from "../../frame-graph.mjs";
import { COMMON_WGSL } from "../common.mjs";
import { resolve } from "./params.mjs";
import { packTaps } from "./signal.mjs";
import { packParams, LAYOUT_WGSL } from "./layout.mjs";
import { SIGNAL_PRELUDE, ENCODE_WGSL, SEPARATE_WGSL, DEMOD_WGSL } from "./signal.wgsl.mjs";
import { GEOMETRY_WGSL, BEAM_WGSL } from "./beam.wgsl.mjs";
import { HALO_DOWN_WGSL, HALO_CONV_WGSL, COMPOSE_WGSL, ENCODE8_WGSL } from "./glass.wgsl.mjs";

const head = COMMON_WGSL + "\n" + LAYOUT_WGSL + "\n";
export const CRT_PASSES = {
  encode: head + SIGNAL_PRELUDE + ENCODE_WGSL,
  separate: head + SIGNAL_PRELUDE + SEPARATE_WGSL,
  demod: head + SIGNAL_PRELUDE + DEMOD_WGSL,
  beam: head + GEOMETRY_WGSL + BEAM_WGSL,
  haloDown: head + HALO_DOWN_WGSL,
  haloConv: head + HALO_CONV_WGSL,
  compose: head + GEOMETRY_WGSL + COMPOSE_WGSL,
  encode8: head + ENCODE8_WGSL,
};

export async function createGpuCrt(host, preset, overrides, src, out, { exposure = 1 } = {}) {
  const plan = resolve(preset, overrides, src, out), taps = packTaps(plan.taps);
  const pipes = {};
  await Promise.all(Object.entries(CRT_PASSES).map(async ([k, code]) => { pipes[k] = await host.compute("crt." + k, code); }));
  const v4 = (n) => n * 16, [gw, gh] = [Math.ceil(out.w / plan.halo.q), Math.ceil(out.h / plan.halo.q)];
  const st = (size, label, extra = []) => host.buffer({ size, usage: ["storage", "copy-dst", "copy-src", ...extra], label });
  const B = {
    P: st(4 * packParams(plan, taps, 0).length, "crt params"), taps: st(4 * taps.data.length, "crt taps"),
    kern: st(4 * plan.halo.weights.length, "crt halo kernel"), src: st(v4(src.w * src.h), "crt source"),
    enc: st(v4(plan.N * plan.lines), "crt enc"), sep: st(v4(plan.N * plan.lines), "crt sep"), sig: st(v4(plan.N * plan.lines), "crt sig"),
    hist: st(v4(2 * out.w * out.h), "crt history"), em: st(v4(out.w * out.h), "crt emission"),
    hd: st(v4(gw * gh), "crt halo down"), hc: st(v4(gw * gh), "crt halo"), img: st(v4(out.w * out.h), "crt image"),
    out8: st(4 * out.w * out.h, "crt packed"),
  };
  host.write(B.taps, taps.data); host.write(B.kern, plan.halo.weights);
  const g = host.graph(), r = {};
  for (const k of Object.keys(B)) r[k] = g.importBuffer(k, B[k]);
  const R = Access.StorageRead, W = Access.StorageWrite, wg = (n) => Math.ceil(n / 8);
  const sigOut = plan.mode === 0 ? "enc" : "sig";
  g.addPass("signal.encode", [[r.P, R], [r.taps, R], [r.src, R], [r.enc, W]], (c) => c.dispatch(pipes.encode, [B.P, B.taps, B.src, B.enc], wg(plan.N), wg(plan.lines)));
  if (plan.mode !== 0) {
    g.addPass("signal.separate", [[r.P, R], [r.taps, R], [r.enc, R], [r.sep, W]], (c) => c.dispatch(pipes.separate, [B.P, B.taps, B.enc, B.sep], wg(plan.N), wg(plan.lines)));
    g.addPass("signal.demod", [[r.P, R], [r.taps, R], [r.sep, R], [r.sig, W]], (c) => c.dispatch(pipes.demod, [B.P, B.taps, B.sep, B.sig], wg(plan.N), wg(plan.lines)));
  }
  g.addPass("beam", [[r.P, R], [r[sigOut], R], [r.hist, W], [r.em, W]], (c) => c.dispatch(pipes.beam, [B.P, B[sigOut], B.hist, B.em], wg(out.w), wg(out.h)));
  g.addPass("halo.down", [[r.P, R], [r.em, R], [r.hd, W]], (c) => c.dispatch(pipes.haloDown, [B.P, B.em, B.hd], wg(gw), wg(gh)));
  g.addPass("halo.conv", [[r.P, R], [r.kern, R], [r.hd, R], [r.hc, W]], (c) => c.dispatch(pipes.haloConv, [B.P, B.kern, B.hd, B.hc], wg(gw), wg(gh)));
  g.addPass("compose", [[r.P, R], [r.em, R], [r.hc, R], [r.img, W]], (c) => c.dispatch(pipes.compose, [B.P, B.em, B.hc, B.img], wg(out.w), wg(out.h)));
  g.addPass("encode8", [[r.P, R], [r.img, R], [r.out8, W]], (c) => c.dispatch(pipes.encode8, [B.P, B.img, B.out8], wg(out.w), wg(out.h)));
  g.markOutput(r.out8); g.markOutput(r.img); g.markOutput(r.hist);
  g.compile();
  let frameNo = 0;
  return {
    plan, buffers: B, image: B.img, packed: B.out8,
    frame(srcRGBA, f = frameNo) {
      host.write(B.P, packParams(plan, taps, f, exposure));
      if (srcRGBA) host.write(B.src, srcRGBA);
      host.frame(g); frameNo = f + 1;
    },
    // Record the frame into an encoder the caller owns (the Motion post stack), with the
    // source already in buffers.src. No timestamps, so the caller's timing stays its own.
    record(enc, f = frameNo) {
      host.write(B.P, packParams(plan, taps, f, exposure));
      host.record(g, enc, false); frameNo = f + 1;
    },
    async read() {
      const rd = async (buf, n) => {
        const s = host.buffer({ size: n, usage: ["map-read", "copy-dst"] }), enc = host.device.createCommandEncoder();
        enc.copyBufferToBuffer(buf, 0, s, 0, n); host.device.queue.submit([enc.finish()]);
        await s.mapAsync(1); const o = s.getMappedRange().slice(0); s.unmap(); s.destroy(); return o;
      };
      return { image: new Float32Array(await rd(B.img, v4(out.w * out.h))), packed: new Uint8Array(await rd(B.out8, 4 * out.w * out.h)) };
    },
    destroy() { for (const b of Object.values(B)) b.destroy(); },
  };
}
