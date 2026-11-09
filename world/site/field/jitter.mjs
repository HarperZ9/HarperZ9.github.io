// jitter.mjs: the reference for the field's sample-jitter kernel (ign and jit in scene.glsl.js).
//
// Contract
//   ign(x, y)            pixel centre (x + 0.5, y + 0.5) -> a value in [0, 1). Interleaved gradient noise
//                        (Jimenez, "Next Generation Post Processing in Call of Duty: Advanced Warfare", 2014).
//   jit(x, y, seq, dim)  -> a value in [0, 1). seq is the frame or sample index, dim the use inside a frame.
//                        One pixel walks seq by the golden ratio, so n samples of one dim are spread evenly in
//                        [0, 1) with a largest gap under 3 / n, and dims are offset by the plastic number.
//   Tolerance            float32 arithmetic, the same operation order as the shader. The test holds this file to
//                        fixed vectors and to the constants in the shader source. Equality with a GPU is not
//                        tested here: drivers may fuse or reorder float operations.
const f = Math.fround;
const fract = (v) => f(v - Math.floor(v));
export const IGN = { scale: 52.9829189, kx: 0.06711056, ky: 0.00583715 }, GOLDEN = 0.61803399, PLASTIC = 0.75487767;
export function ign(x, y) {
  const px = f(x + 0.5), py = f(y + 0.5), d = f(f(px * f(IGN.kx)) + f(py * f(IGN.ky)));
  return fract(f(f(IGN.scale) * fract(d)));
}
export function jit(x, y, seq, dim) {
  return fract(f(f(ign(x, y) + f(f(GOLDEN) * f(seq))) + f(f(PLASTIC) * f(dim))));
}
