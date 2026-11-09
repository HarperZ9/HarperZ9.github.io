// Pixel-perfect scaling (roadmap S3), CPU reference of SCALE_WGSL.
//   integerUpscale(src, k)                 nearest neighbour by an integer factor, exact
//   sharpBilinear(src, w, h, offX, offY)   any size: texel interiors stay exact and each texel
//                                          seam gets a transition one output pixel wide, so a
//                                          low-resolution render with a snapped camera can be
//                                          shown at any size and panned by the subpixel residual
//                                          (offX, offY in source texels) without crawling edges.
// Images are RGBA8 { width, height, data }.
export function integerUpscale(src, k) {
  const w = src.width * k, h = src.height * k, o = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.set(src.data.subarray(((((y / k) | 0) * src.width) + ((x / k) | 0)) * 4, ((((y / k) | 0) * src.width) + ((x / k) | 0)) * 4 + 4), (y * w + x) * 4);
  return { width: w, height: h, data: o };
}
// One axis: the sample coordinate (texel centres at integers) for output pixel i.
export function sharpCoord(i, scale, off) {
  const u = (i + 0.5) / scale + off, seam = Math.floor(u + 0.5) - 0.5;   // u in texel-edge units; seams at integers
  const d = Math.min(0.5, Math.max(-0.5, (u - (seam + 0.5)) * scale));
  return seam + 0.5 + d - 0.5;
}
export function sharpBilinear(src, w, h, offX = 0, offY = 0) {
  const sx = w / src.width, sy = h / src.height, o = new Uint8Array(w * h * 4), W = src.width, H = src.height;
  const at = (x, y, c) => src.data[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4 + c];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = sharpCoord(x, sx, offX), v = sharpCoord(y, sy, offY), x0 = Math.floor(u), y0 = Math.floor(v), tx = u - x0, ty = v - y0;
    for (let c = 0; c < 4; c++) {
      const val = (at(x0, y0, c) * (1 - tx) + at(x0 + 1, y0, c) * tx) * (1 - ty) + (at(x0, y0 + 1, c) * (1 - tx) + at(x0 + 1, y0 + 1, c) * tx) * ty;
      o[(y * w + x) * 4 + c] = Math.floor(val + 0.5);
    }
  }
  return { width: w, height: h, data: o };
}
export const SCALE_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> S: array<f32>;      // srcW, srcH, outW, outH, offX, offY, mode (0 integer, 1 sharp)
@group(0) @binding(1) var<storage, read> src: array<u32>;
@group(0) @binding(2) var<storage, read_write> dst: array<u32>;
fn texel(x: i32, y: i32) -> vec4f { let W = i32(S[0]); let H = i32(S[1]); return unpack4x8unorm(src[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)]) * 255.0; }
fn sharp_coord(i: u32, scale: f32, off: f32) -> f32 {
  let u = (f32(i) + 0.5) / scale + off; let seam = floor(u + 0.5) - 0.5;
  let d = clamp((u - (seam + 0.5)) * scale, -0.5, 0.5);
  return seam + 0.5 + d - 0.5;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = u32(S[2]); let h = u32(S[3]); if (id.x >= w || id.y >= h) { return; }
  if (S[6] < 0.5) { let k = w / u32(S[0]); dst[id.y * w + id.x] = src[(id.y / k) * u32(S[0]) + id.x / k]; return; }
  let u = sharp_coord(id.x, S[2] / S[0], S[4]); let v = sharp_coord(id.y, S[3] / S[1], S[5]);
  let x0 = i32(floor(u)); let y0 = i32(floor(v)); let tx = u - f32(x0); let ty = v - f32(y0);
  let c = (texel(x0, y0) * (1.0 - tx) + texel(x0 + 1, y0) * tx) * (1.0 - ty) + (texel(x0, y0 + 1) * (1.0 - tx) + texel(x0 + 1, y0 + 1) * tx) * ty;
  let q = vec4u(floor(c + 0.5));
  dst[id.y * w + id.x] = q.x | (q.y << 8u) | (q.z << 16u) | (q.w << 24u);
}`;
