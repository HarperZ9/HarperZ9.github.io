// Salience caricature warp on the GPU: the passes of caricature.mjs.
//   const c = await createGpuCaricature(host, "grotesque", {}, { w, h });
//   c.frame(sceneLinearRGBA, materialIds /* Int32Array, -1 for sky */);  c.image, c.packed
import { COMMON_WGSL } from "../common.mjs";
import { resolveCaricature } from "./caricature.mjs";
import { gpuKit, ENCODE_WGSL } from "../lab/gpu-kit.mjs";
import { CARI_HEAD, CARI_SAL_WGSL, CARI_BLUR_WGSL, CARI_GRAD_WGSL, CARI_LAMBDA_WGSL, CARI_WARP_WGSL } from "./caricature.wgsl.mjs";

export function packCaricature(plan, gain = 2.4) {
  const p = plan.p, wts = Array.from({ length: 10 }, (_, m) => p.weights[m] || 0);
  return Float32Array.from([plan.w, plan.h, plan.R, p.lambda, p.gain, p.steps || 1, ...wts, gain]);
}
export async function createGpuCaricature(host, preset, overrides, size, { gain = 2.4 } = {}) {
  const plan = resolveCaricature(preset, overrides, size), n = size.w * size.h, kit = gpuKit(host), head = COMMON_WGSL + ENCODE_WGSL + CARI_HEAD;
  const pipes = {};
  for (const [k, c] of Object.entries({ sal: CARI_SAL_WGSL, blur: CARI_BLUR_WGSL, grad: CARI_GRAD_WGSL, lam: CARI_LAMBDA_WGSL, warp: CARI_WARP_WGSL })) pipes[k] = await host.compute("caricature." + k, head + c);
  const taps = Float32Array.from(plan.taps);
  const B = { P: kit.st(4 * 20, "cari params", packCaricature(plan, gain)), taps: kit.st(taps.byteLength, "cari taps", taps), mat: kit.st(4 * n, "cari materials"), src: kit.st(16 * n, "cari source"),
    s: kit.st(4 * n, "cari salience"), t: kit.st(4 * n, "cari blur tmp"), S: kit.st(4 * n, "cari smoothed"), g: kit.st(8 * n, "cari gradient"), L: kit.st(16, "cari lambda"),
    dh: kit.st(16, "cari dir h", new Float32Array([0, 0, 0, 0])), dv: kit.st(16, "cari dir v", new Float32Array([1, 0, 0, 0])), img: kit.st(16 * n, "cari image"), out8: kit.st(4 * n, "cari packed") };
  const wx = Math.ceil(size.w / 8), wy = Math.ceil(size.h / 8);
  const list = [[pipes.sal, [B.P, B.mat, B.s], wx, wy], [pipes.blur, [B.P, B.taps, B.s, B.t, B.dh], wx, wy], [pipes.blur, [B.P, B.taps, B.t, B.S, B.dv], wx, wy],
    [pipes.grad, [B.P, B.S, B.g], wx, wy], [pipes.lam, [B.P, B.g, B.L], 1, 1], [pipes.warp, [B.P, B.src, B.g, B.L, B.img, B.out8], wx, wy]];
  return {
    plan, image: B.img, packed: B.out8,
    upload(rgba, mat) { host.write(B.src, rgba); host.write(B.mat, Int32Array.from(mat)); },
    record(enc) { kit.record(enc, list); },
    frame(rgba, mat) { if (rgba) this.upload(rgba, mat); kit.run(list); },
    async read() { return { packed: new Uint8Array(await kit.read(B.out8, 4 * n)) }; },
    destroy() { kit.destroy(); },
  };
}
