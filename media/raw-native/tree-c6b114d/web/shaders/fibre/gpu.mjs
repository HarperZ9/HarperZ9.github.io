// Fibre-network watercolour on the GPU: the passes of fibre.mjs.
//   const f = await createGpuFibre(host, "cold-press", {}, { w, h });
//   f.frame(displayLinearRGBA);  f.image (display-linear f32), f.packed (RGBA8)
import { COMMON_WGSL } from "../common.mjs";
import { resolveFibre } from "./fibre.mjs";
import { gpuKit } from "../lab/gpu-kit.mjs";
import { FIBRE_HEAD, FIBRE_FIELD_WGSL, FIBRE_TENSOR_WGSL, FIBRE_INIT_WGSL, FIBRE_STEP_WGSL, FIBRE_OUT_WGSL } from "./fibre.wgsl.mjs";

export function packFibre(plan) {
  const p = plan.p;
  return Float32Array.from([plan.w, plan.h, plan.C, plan.L, p.perCell, p.width, p.md, p.spread, p.k0, p.k1, p.rate, p.floc, p.evap, plan.dt, p.strength, ...p.paper, p.edgeDry || 0]);
}
export async function createGpuFibre(host, preset, overrides, size) {
  const plan = resolveFibre(preset, overrides, size), n = size.w * size.h, kit = gpuKit(host), head = COMMON_WGSL + FIBRE_HEAD;
  const pipes = {};
  for (const [k, c] of Object.entries({ field: FIBRE_FIELD_WGSL, tensor: FIBRE_TENSOR_WGSL, init: FIBRE_INIT_WGSL, step: FIBRE_STEP_WGSL, out: FIBRE_OUT_WGSL })) pipes[k] = await host.compute("fibre." + k, head + c);
  const B = { P: kit.st(4 * 20, "fibre params", packFibre(plan)), src: kit.st(16 * n, "fibre source"), F: kit.st(16 * n, "fibre field"), X: kit.st(4 * n, "fibre crossings"), K: kit.st(16 * n, "fibre tensor"),
    S0: kit.st(16 * n, "fibre wash 0"), S1: kit.st(16 * n, "fibre wash 1"), D: kit.st(16 * n, "fibre deposit"), img: kit.st(16 * n, "fibre image"), out8: kit.st(4 * n, "fibre packed") };
  const wx = Math.ceil(size.w / 8), wy = Math.ceil(size.h / 8);
  const list = () => {
    const L = [[pipes.field, [B.P, B.F, B.X], wx, wy], [pipes.tensor, [B.P, B.F, B.K], wx, wy], [pipes.init, [B.P, B.src, B.S0, B.D], wx, wy]];
    let a = B.S0, b = B.S1;
    for (let it = 0; it < plan.p.steps; it++) { L.push([pipes.step, [B.P, B.K, B.X, a, b, B.D], wx, wy]); [a, b] = [b, a]; }
    L.push([pipes.out, [B.P, a, B.D, B.img, B.out8], wx, wy]);
    return L;
  };
  return {
    plan, image: B.img, packed: B.out8,
    upload(data) { host.write(B.src, data); },
    record(enc) { kit.record(enc, list()); },
    frame(data) { if (data) this.upload(data); kit.run(list()); },
    async read() { return { packed: new Uint8Array(await kit.read(B.out8, 4 * n)) }; },
    destroy() { kit.destroy(); },
  };
}
