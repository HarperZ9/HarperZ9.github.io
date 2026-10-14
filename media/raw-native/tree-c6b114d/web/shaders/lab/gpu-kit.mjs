// Small helpers shared by the lab 2 GPU paths: storage buffers, a run of compute dispatches in one
// pass, the 8-bit display encode in WGSL, and a read-back.
//   const kit = gpuKit(host);  const b = kit.st(bytes, "label", data);
//   kit.run([[pipe, [buffers...], wx, wy], ...]);  const bytes = await kit.read(b, n);
export function gpuKit(host) {
  const owned = [];
  return {
    st(bytes, label, data = null) { const b = host.buffer({ size: bytes, usage: ["storage", "copy-dst", "copy-src"], label, data }); owned.push(b); return b; },
    // Record dispatches into an encoder (for a post stack), or submit them on their own.
    record(enc, list) {
      const cp = enc.beginComputePass();
      for (const [pipe, bufs, x, y] of list) { cp.setPipeline(pipe); cp.setBindGroup(0, host.bind(pipe, bufs)); cp.dispatchWorkgroups(x, y || 1); }
      cp.end();
    },
    run(list) { const enc = host.device.createCommandEncoder(); this.record(enc, list); host.device.queue.submit([enc.finish()]); },
    async read(buf, bytes) {
      const s = host.buffer({ size: bytes, usage: ["map-read", "copy-dst"] }), enc = host.device.createCommandEncoder();
      enc.copyBufferToBuffer(buf, 0, s, 0, bytes); host.device.queue.submit([enc.finish()]);
      await s.mapAsync(1); const o = s.getMappedRange().slice(0); s.unmap(); s.destroy(); return o;
    },
    destroy() { for (const b of owned) b.destroy(); owned.length = 0; },
  };
}

// The display encode every lab 2 parity page compares: a soft shoulder 1 - exp(-gain v), then
// sRGB, then round half up to 8 bits (the CPU side uses Math.round on the same value).
export const ENCODE_WGSL = /* wgsl */ `
fn lab_shoulder(v: f32, gain: f32) -> f32 { return 1.0 - exp(-max(0.0, v) * gain); }
fn lab_pack(c: vec3f, gain: f32) -> u32 {
  let r = u32(floor(linear_to_srgb(lab_shoulder(c.x, gain)) * 255.0 + 0.5));
  let g = u32(floor(linear_to_srgb(lab_shoulder(c.y, gain)) * 255.0 + 0.5));
  let b = u32(floor(linear_to_srgb(lab_shoulder(c.z, gain)) * 255.0 + 0.5));
  return r | (g << 8u) | (b << 16u) | (255u << 24u);
}
`;
export function labEncode8(f, gain = 2.4) {
  const o = new Uint8ClampedArray(f.width * f.height * 4);
  const enc = (v) => { const l = Math.min(1, 1 - Math.exp(-Math.max(0, v) * gain)); return l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; };
  for (let i = 0; i < o.length; i += 4) { for (let k = 0; k < 3; k++) o[i + k] = Math.round(enc(f.data[i + k]) * 255); o[i + 3] = 255; }
  return o;
}

// Statistics of two RGBA8 images, alpha ignored: max, p99.9 and mean absolute code difference.
export function codeStats(a, b) {
  const hist = new Uint32Array(256); let sum = 0, n = 0, max = 0;
  for (let i = 0; i < a.length; i++) { if ((i & 3) === 3) continue; const d = Math.abs(a[i] - b[i]); hist[d]++; sum += d; n++; if (d > max) max = d; }
  let acc = 0, p999 = 0; for (let d = 0; d < 256; d++) { acc += hist[d]; if (acc >= n * 0.999) { p999 = d; break; } }
  return { max, p999, mean: sum / n, over1: n - hist[0] - hist[1], over2: n - hist[0] - hist[1] - hist[2], n };
}
