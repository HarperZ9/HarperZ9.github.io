// Development adjacency on the GPU: the passes of adjacency.mjs.
//   const a = await createGpuAdjacency(host, "eberhard", {}, { w, h });
//   a.frame(sceneLinearRGBA /* Float32Array */);  a.image: scene-linear RGBA f32;  a.packed: RGBA8
import { COMMON_WGSL } from "../common.mjs";
import { resolveAdjacency } from "./adjacency.mjs";
import { gpuKit, ENCODE_WGSL } from "../lab/gpu-kit.mjs";
import { ADJ_HEAD, ADJ_PREP_WGSL, ADJ_DEVELOP_WGSL, ADJ_CHEM_WGSL, ADJ_OUT_WGSL } from "./adjacency.wgsl.mjs";

export function packAdjacency(plan, gain = 2.4) {
  const p = plan.p;
  return Float32Array.from([plan.w, plan.h, plan.s, plan.cw, plan.ch, plan.Dc, plan.Db, plan.dt, p.k, p.eta, p.r, p.beta, p.etaB, p.rB, p.gamma, p.H0, p.exposure, plan.decay, gain]);
}

export async function createGpuAdjacency(host, preset, overrides, size, { gain = 2.4 } = {}) {
  const plan = resolveAdjacency(preset, overrides, size), n = size.w * size.h, m = plan.cw * plan.ch, head = COMMON_WGSL + ENCODE_WGSL + ADJ_HEAD;
  const pipes = { prep: await host.compute("adj.prep", head + ADJ_PREP_WGSL), dev: await host.compute("adj.develop", head + ADJ_DEVELOP_WGSL),
    chem: await host.compute("adj.chem", head + ADJ_CHEM_WGSL), out: await host.compute("adj.out", head + ADJ_OUT_WGSL) };
  const kit = gpuKit(host), init = new Float32Array(m * 4); for (let i = 0; i < m; i++) init[i * 4] = 1;
  const B = { P: kit.st(4 * 20, "adj params", packAdjacency(plan, gain)), scene: kit.st(16 * n, "adj scene"), A: kit.st(16 * n, "adj developable"), D: kit.st(16 * n, "adj density"),
    F0: kit.st(16 * m, "adj chemistry 0"), F1: kit.st(16 * m, "adj chemistry 1"), img: kit.st(16 * n, "adj image"), out8: kit.st(4 * n, "adj packed") };
  const wx = Math.ceil(size.w / 8), wy = Math.ceil(size.h / 8), cx = Math.ceil(plan.cw / 8), cy = Math.ceil(plan.ch / 8);
  const list = () => {
    const L = [[pipes.prep, [B.P, B.scene, B.A, B.D], wx, wy]];
    let F = B.F0, G = B.F1;
    for (let it = 0; it < plan.steps; it++) { L.push([pipes.dev, [B.P, B.A, F, B.D], wx, wy], [pipes.chem, [B.P, B.D, F, G], cx, cy]); [F, G] = [G, F]; }
    L.push([pipes.out, [B.P, B.scene, B.A, B.D, B.img, B.out8], wx, wy]);
    return L;
  };
  return {
    plan, image: B.img, packed: B.out8,
    upload(sceneRGBA) { host.write(B.scene, sceneRGBA); host.write(B.F0, init); },
    record(enc) { kit.record(enc, list()); },
    frame(sceneRGBA) { if (sceneRGBA) this.upload(sceneRGBA); kit.run(list()); },
    async read() { return { packed: new Uint8Array(await kit.read(B.out8, 4 * n)) }; },
    destroy() { kit.destroy(); },
  };
}
