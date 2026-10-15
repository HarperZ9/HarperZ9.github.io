// The painterly shader on the GPU: the passes of paint.mjs through the host's frame graph.
//   const p = await createGpuPaint(host, "oil-grotesque", { canvasOffset: [panX, panY] }, { w, h });
//   p.frame(sceneLinearRGBA /* Float32Array */);   p.packed: sRGB RGBA8;  await p.read()
import { Access } from "../../frame-graph.mjs";
import { COMMON_WGSL } from "../common.mjs";
import { resolvePaint } from "./paint.mjs";
import { K_TAB, S_TAB, W_TAB, latentLut } from "./pigments.mjs";
import { PAINT_COMMON_WGSL, PAINT_INDEX, PAINT_FIELDS } from "./common.wgsl.mjs";
import { PREP_WGSL, TENSOR_WGSL, BLUR4_WGSL, AKF_WGSL, STROKE_WGSL } from "./passes.wgsl.mjs";
import { COMPOSE_WGSL, RELIEF_WGSL, PAINT_ENCODE_WGSL } from "./compose.wgsl.mjs";
import { DECIDE_WGSL, ADVECT_WGSL, DISTORT_WGSL } from "./canvas.wgsl.mjs";

const head = COMMON_WGSL + "\n" + PAINT_COMMON_WGSL + "\n";
export const PAINT_PASSES = { prep: PREP_WGSL, tensor: TENSOR_WGSL, blur: BLUR4_WGSL, akf: AKF_WGSL, stroke: STROKE_WGSL, relief: RELIEF_WGSL, compose: COMPOSE_WGSL, encode8: PAINT_ENCODE_WGSL };
const MEDIA = { oil: 0, matte: 1, water: 2 };

export function packPaintParams(plan, dir = 0, canvasMode = 0) {
  const p = plan.p, a = new Float32Array(PAINT_FIELDS.length), N = 8;
  const v = { w: plan.out.w, h: plan.out.h, exposure: p.exposure, radius: p.radius, q: p.q, zeta: p.zeta, eta: (p.zeta + Math.cos(Math.PI / N)) / Math.sin(Math.PI / N) ** 2,
    strokeLen: p.strokeLen, ox: p.canvasOffset[0], oy: p.canvasOffset[1], medium: MEDIA[p.medium], impasto: p.impasto, gloss: p.gloss, push: p.push, broken: p.broken,
    valueBands: p.valueBands, lines: p.lines, lineSigma: p.lineSigma, lineSharp: p.lineSharp, warp: p.warp, granulation: p.granulation, edge: p.edge, dilution: p.dilution, dir, canvasMode };
  for (const [k, i] of Object.entries(PAINT_INDEX)) a[i] = v[k];
  return a;
}
export function packPigments() {
  return Float32Array.from([...K_TAB.flat(), ...S_TAB.flat(), ...W_TAB.flat(), ...latentLut()]);
}

export async function createGpuPaint(host, preset, overrides, size) {
  const plan = resolvePaint(preset, overrides, size), { w, h } = size, n = w * h, pipes = {};
  await Promise.all(Object.entries(PAINT_PASSES).map(async ([k, code]) => { pipes[k] = await host.compute("paint." + k, head + code); }));
  for (const [k, code] of Object.entries({ decide: DECIDE_WGSL, advect: ADVECT_WGSL, distort: DISTORT_WGSL })) pipes[k] = await host.compute("canvas." + k, COMMON_WGSL + code);
  const st = (bytes, label, data) => host.buffer({ size: bytes, usage: ["storage", "copy-dst", "copy-src"], label, data });
  const pig = packPigments();
  const B = {
    P: st(4 * PAINT_FIELDS.length, "paint params"), Px: st(4 * PAINT_FIELDS.length, "paint params x"), Py: st(4 * PAINT_FIELDS.length, "paint params y"),
    pig: st(pig.byteLength, "paint pigments", pig), tw: st(plan.tw.byteLength, "paint tensor weights", plan.tw),
    scene: st(16 * n, "paint scene"), s: st(16 * n, "paint s"), lat: st(32 * n, "paint latent"), T0: st(16 * n, "paint tensor"), T1: st(16 * n, "paint tensor tmp"),
    Cv: st(16 * n, "canvas coords"), Cprev: st(16 * n, "canvas coords prev"), K: st(64, "canvas layers", new Float32Array([-1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
    S: st(16, "canvas stats"), Pa: st(16, "canvas size", new Float32Array([w, h, 0, 0])), mv: st(8 * n, "motion"), dd: st(8 * n, "dist and dist prev"),
    pdIn: st(4 * n, "prev dist in", new Float32Array(n).fill(-1)), pdOut: st(4 * n, "prev dist out"),
    olat: st(32 * n, "paint akf latent"), os: st(16 * n, "paint akf s"), H: st(8 * n, "paint stroke"), Rl: st(16 * n, "paint relief"), img: st(16 * n, "paint image"), out8: st(4 * n, "paint packed"),
  };
  const g = host.graph(), r = {};
  for (const k of Object.keys(B)) r[k] = g.importBuffer(k, B[k]);
  const R = Access.StorageRead, Wr = Access.StorageWrite, wg = (x) => Math.ceil(x / 8);
  const pass = (name, pipe, uses, list) => g.addPass(name, uses, (c) => c.dispatch(pipe, list, wg(w), wg(h)));
  pass("prep", pipes.prep, [[r.P, R], [r.pig, R], [r.scene, R], [r.s, Wr], [r.lat, Wr]], [B.P, B.pig, B.scene, B.s, B.lat]);
  pass("tensor", pipes.tensor, [[r.P, R], [r.pig, R], [r.s, R], [r.T0, Wr]], [B.P, B.pig, B.s, B.T0]);
  pass("tensor.x", pipes.blur, [[r.Px, R], [r.pig, R], [r.tw, R], [r.T0, R], [r.T1, Wr]], [B.Px, B.pig, B.tw, B.T0, B.T1]);
  pass("tensor.y", pipes.blur, [[r.Py, R], [r.pig, R], [r.tw, R], [r.T1, R], [r.T0, Wr]], [B.Py, B.pig, B.tw, B.T1, B.T0]);
  pass("akf", pipes.akf, [[r.P, R], [r.pig, R], [r.s, R], [r.lat, R], [r.T0, R], [r.olat, Wr], [r.os, Wr]], [B.P, B.pig, B.s, B.lat, B.T0, B.olat, B.os]);
  pass("stroke", pipes.stroke, [[r.P, R], [r.pig, R], [r.T0, R], [r.H, Wr], [r.Cv, R], [r.K, R]], [B.P, B.pig, B.T0, B.H, B.Cv, B.K]);
  pass("relief", pipes.relief, [[r.P, R], [r.pig, R], [r.os, R], [r.H, R], [r.T0, R], [r.Rl, Wr], [r.Cv, R], [r.K, R]], [B.P, B.pig, B.os, B.H, B.T0, B.Rl, B.Cv, B.K]);
  pass("compose", pipes.compose, [[r.P, R], [r.pig, R], [r.olat, R], [r.H, R], [r.Rl, R], [r.img, Wr], [r.Cv, R], [r.K, R]], [B.P, B.pig, B.olat, B.H, B.Rl, B.img, B.Cv, B.K]);
  pass("encode8", pipes.encode8, [[r.P, R], [r.pig, R], [r.img, R], [r.out8, Wr]], [B.P, B.pig, B.img, B.out8]);
  g.markOutput(r.out8); g.markOutput(r.img); g.compile();
  // The still-image parameters (mode 0, no motion), for record().
  const params = (offset) => {
    if (offset) plan.p.canvasOffset = offset;
    host.write(B.P, packPaintParams(plan, 0, 0)); host.write(B.Px, packPaintParams(plan, 0, 0)); host.write(B.Py, packPaintParams(plan, 1, 0));
  };
  return {
    plan, packed: B.out8, image: B.img, scene: B.scene, buffers: B,
    // offset: a 2D pan offset; motion (optional): { mv, dist, distPrev } for rotation, zoom, parallax.
    frame(sceneRGBA, offset = null, motion = null) {
      if (offset) plan.p.canvasOffset = offset;
      const mode = motion ? 1 : 0;
      host.write(B.P, packPaintParams(plan, 0, mode)); host.write(B.Px, packPaintParams(plan, 0, mode)); host.write(B.Py, packPaintParams(plan, 1, mode));
      if (motion) {
        host.write(B.mv, motion.mv);
        const dd = new Float32Array(2 * n); for (let i = 0; i < n; i++) { dd[2 * i] = motion.dist[i]; dd[2 * i + 1] = motion.distPrev[i]; } host.write(B.dd, dd);
        const enc = host.device.createCommandEncoder(), cp = enc.beginComputePass(), run = (pipe, list, x, y = 1) => { cp.setPipeline(pipe); cp.setBindGroup(0, host.bind(pipe, list)); cp.dispatchWorkgroups(x, y); };
        run(pipes.decide, [B.K, B.S], 1);
        run(pipes.advect, [B.Pa, B.K, B.Cprev, B.Cv, B.mv, B.dd, B.pdIn, B.pdOut], Math.ceil(w / 8), Math.ceil(h / 8));
        run(pipes.distort, [B.Pa, B.Cv, B.S], Math.ceil(w / 8), Math.ceil(h / 8));
        cp.end(); enc.copyBufferToBuffer(B.Cv, 0, B.Cprev, 0, 16 * n); enc.copyBufferToBuffer(B.pdOut, 0, B.pdIn, 0, 4 * n);
        host.device.queue.submit([enc.finish()]);
      }
      if (sceneRGBA) host.write(B.scene, sceneRGBA);
      host.frame(g);
    },
    // Record into an encoder the caller owns (the Motion post stack), scene already in B.scene.
    record(enc, offset = null) { params(offset); host.record(g, enc, false); },
    async read() {
      const rd = async (buf, bytes) => {
        const s = host.buffer({ size: bytes, usage: ["map-read", "copy-dst"] }), enc = host.device.createCommandEncoder();
        enc.copyBufferToBuffer(buf, 0, s, 0, bytes); host.device.queue.submit([enc.finish()]);
        await s.mapAsync(1); const o = s.getMappedRange().slice(0); s.unmap(); s.destroy(); return o;
      };
      return { image: new Float32Array(await rd(B.img, 16 * n)), packed: new Uint8Array(await rd(B.out8, 4 * n)) };
    },
    destroy() { for (const b of Object.values(B)) b.destroy(); },
  };
}
