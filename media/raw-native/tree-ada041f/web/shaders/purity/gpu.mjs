// CRT purity and degauss on the GPU: the pass of purity.mjs.
//   const q = await createGpuPurity(host, "degauss", {}, { w, h });
//   q.frame(displayLinearRGBA, t /* seconds since degauss */);  q.image (display-linear f32), q.packed (RGBA8)
import { COMMON_WGSL } from "../common.mjs";
import { resolvePurity } from "./purity.mjs";
import { gpuKit } from "../lab/gpu-kit.mjs";
import { PURITY_WGSL } from "./purity.wgsl.mjs";

export const packPurity = (plan, size, t) => { const p = plan.p; return Float32Array.from([size.w, size.h, p.s, p.w, p.mag, p.magScale, p.earth, p.degauss, p.tau, p.mains, p.field, p.blank, p.wobble, t, p.spread]); };
export async function createGpuPurity(host, preset, overrides, size) {
  const plan = resolvePurity(preset, overrides), n = size.w * size.h, kit = gpuKit(host), pipe = await host.compute("purity", COMMON_WGSL + PURITY_WGSL);
  const B = { P: kit.st(4 * 16, "purity params"), src: kit.st(16 * n, "purity source"), img: kit.st(16 * n, "purity image"), out8: kit.st(4 * n, "purity packed") };
  const list = [[pipe, [B.P, B.src, B.img, B.out8], Math.ceil(size.w / 8), Math.ceil(size.h / 8)]];
  return {
    plan, image: B.img, packed: B.out8,
    upload(data) { host.write(B.src, data); },
    record(enc, t = 0) { host.write(B.P, packPurity(plan, size, t)); kit.record(enc, list); },
    frame(data, t = 0) { if (data) this.upload(data); host.write(B.P, packPurity(plan, size, t)); kit.run(list); },
    async read() { return { packed: new Uint8Array(await kit.read(B.out8, 4 * n)) }; },
    destroy() { kit.destroy(); },
  };
}
