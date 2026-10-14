// A side-by-side compare on the GPU: the left part of the frame from one packed RGBA8 buffer, the
// right part from another, with a one-pixel divider. Used by the lab gallery.
//   const s = await createSplit(host, { w, h });  s.run(left, right, at /* 0..1 */);  s.packed
import { gpuKit } from "./gpu-kit.mjs";

const SPLIT_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> a: array<u32>;
@group(0) @binding(2) var<storage, read> b: array<u32>;
@group(0) @binding(3) var<storage, read_write> o: array<u32>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = i32(P[0]); let h = i32(P[1]); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let i = y * w + x; let cut = i32(P[2] * f32(w));
  if (x == cut) { o[i] = 0xff5aa3e8u; return; }
  o[i] = select(b[i], a[i], x < cut);
}
`;
export async function createSplit(host, size) {
  const pipe = await host.compute("lab.split", SPLIT_WGSL), kit = gpuKit(host), n = size.w * size.h;
  const P = kit.st(16, "split params"), out = kit.st(4 * n, "split packed");
  return {
    packed: out,
    run(left, right, at = 0.5) { host.write(P, new Float32Array([size.w, size.h, at, 0])); kit.run([[pipe, [P, left, right, out], Math.ceil(size.w / 8), Math.ceil(size.h / 8)]]); },
    destroy() { kit.destroy(); },
  };
}
// Upload CPU RGBA8 bytes into a storage buffer the split can read.
export function uploadBytes(host, buf, bytes) { host.write(buf, new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)); }
