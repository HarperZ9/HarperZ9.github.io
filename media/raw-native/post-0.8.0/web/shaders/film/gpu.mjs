// The spectral film shader on the GPU: the passes of run.mjs through the host's frame graph.
//   const film = await createGpuFilm(host, "500t-print", { ev: 0 }, { w, h }, { w, h });
//   film.frame(sceneRGBA /* Float32Array, linear Rec.709, input size */, frameNo);
//   await film.read()  // { image: Float32Array, packed: Uint8Array }
import { Access } from "../../frame-graph.mjs";
import { COMMON_WGSL } from "../common.mjs";
import { resolveFilm } from "./film.mjs";
import { FILM_LAYOUT_WGSL, TAB_WGSL, packFilmParams, packTables, FILM_PARAM_COUNT, FILM_INDEX } from "./layout.mjs";
import { FILM_HEAD, EXPOSE_WGSL, DEVELOP_WGSL, MTF_WGSL } from "./film.wgsl.mjs";
import { PRINT_WGSL, ENCODE_FILM8_WGSL } from "./print.wgsl.mjs";
import { HALO_DOWN_WGSL, HALO_CONV_WGSL } from "../crt/glass.wgsl.mjs";
import { poissonTable } from "./grain.mjs";

const head = COMMON_WGSL + "\n" + FILM_LAYOUT_WGSL + "\n" + TAB_WGSL + "\n";
export const FILM_PASSES = {
  expose: head + FILM_HEAD + EXPOSE_WGSL, mtf: head + FILM_HEAD + MTF_WGSL, haloDown: head + HALO_DOWN_WGSL, haloConv: head + HALO_CONV_WGSL,
  develop: head + FILM_HEAD + DEVELOP_WGSL, print: head + FILM_HEAD + PRINT_WGSL, encode8: head + FILM_HEAD + ENCODE_FILM8_WGSL,
};

export async function createGpuFilm(host, preset, overrides, input, out) {
  const plan = resolveFilm(preset, overrides, input, out), pipes = {};
  await Promise.all(Object.entries(FILM_PASSES).map(async ([k, code]) => { pipes[k] = await host.compute("film." + k, code); }));
  const q = plan.halo.q, gw = Math.ceil(out.w / q), gh = Math.ceil(out.h / q), v4 = (n) => n * 16, tabs = packTables(plan);
  const st = (size, label) => host.buffer({ size, usage: ["storage", "copy-dst", "copy-src"], label });
  const B = {
    P: st(4 * FILM_PARAM_COUNT, "film params"), tab: st(4 * tabs.length, "film tables"), kern: st(4 * plan.halo.weights.length, "film halo kernel"),
    scene: st(v4(input.w * input.h), "film scene"), H: st(v4(out.w * out.h), "film exposure"), Hb: st(v4(out.w * out.h), "film exposure blur"),
    mw: st(4 * plan.mtf.length, "film mtf weights"), Px: st(4 * FILM_PARAM_COUNT, "film params x"), Py: st(4 * FILM_PARAM_COUNT, "film params y"), hd: st(v4(gw * gh), "film halo down"),
    hc: st(v4(gw * gh), "film halo"), pois: st(4 * poissonTable().length, "film poisson thresholds"), F: st(v4(out.w * out.h), "film developed"), img: st(v4(out.w * out.h), "film image"), out8: st(4 * out.w * out.h, "film packed"),
  };
  host.write(B.tab, tabs); host.write(B.mw, plan.mtf); host.write(B.pois, poissonTable()); host.write(B.kern, Float32Array.from(plan.halo.weights));
  const g = host.graph(), r = {};
  for (const k of Object.keys(B)) r[k] = g.importBuffer(k, B[k]);
  const R = Access.StorageRead, W = Access.StorageWrite, wg = (n) => Math.ceil(n / 8);
  g.addPass("expose", [[r.P, R], [r.scene, R], [r.H, W]], (c) => c.dispatch(pipes.expose, [B.P, B.scene, B.H], wg(out.w), wg(out.h)));
  if (plan.mtf.length > 1) {
    g.addPass("mtf.x", [[r.Px, R], [r.mw, R], [r.H, R], [r.Hb, W]], (c) => c.dispatch(pipes.mtf, [B.Px, B.mw, B.H, B.Hb], wg(out.w), wg(out.h)));
    g.addPass("mtf.y", [[r.Py, R], [r.mw, R], [r.Hb, R], [r.H, W]], (c) => c.dispatch(pipes.mtf, [B.Py, B.mw, B.Hb, B.H], wg(out.w), wg(out.h)));
  }
  g.addPass("halo.down", [[r.P, R], [r.H, R], [r.hd, W]], (c) => c.dispatch(pipes.haloDown, [B.P, B.H, B.hd], wg(gw), wg(gh)));
  g.addPass("halo.conv", [[r.P, R], [r.kern, R], [r.hd, R], [r.hc, W]], (c) => c.dispatch(pipes.haloConv, [B.P, B.kern, B.hd, B.hc], wg(gw), wg(gh)));
  g.addPass("develop", [[r.P, R], [r.H, R], [r.hc, R], [r.F, W]], (c) => c.dispatch(pipes.develop, [B.P, B.H, B.hc, B.F], wg(out.w), wg(out.h)));
  g.addPass("print", [[r.P, R], [r.tab, R], [r.F, R], [r.img, W], [r.pois, R]], (c) => c.dispatch(pipes.print, [B.P, B.tab, B.F, B.img, B.pois], wg(out.w), wg(out.h)));
  g.addPass("encode8", [[r.P, R], [r.img, R], [r.out8, W]], (c) => c.dispatch(pipes.encode8, [B.P, B.img, B.out8], wg(out.w), wg(out.h)));
  g.markOutput(r.out8); g.markOutput(r.img); g.compile();
  let frameNo = 0;
  const params = (f) => {
    const pp = packFilmParams(plan, f); host.write(B.P, pp);
    const ix = FILM_INDEX.mtfDir; pp[ix] = 0; host.write(B.Px, pp); const py = pp.slice(); py[ix] = 1; host.write(B.Py, py);
  };
  return {
    plan, buffers: B, image: B.img, packed: B.out8,
    frame(sceneRGBA, f = frameNo) { params(f); if (sceneRGBA) host.write(B.scene, sceneRGBA); host.frame(g); frameNo = f + 1; },
    // Record into an encoder the caller owns (the Motion post stack), scene already in buffers.scene.
    record(enc, f = frameNo) { params(f); host.record(g, enc, false); frameNo = f + 1; },
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
