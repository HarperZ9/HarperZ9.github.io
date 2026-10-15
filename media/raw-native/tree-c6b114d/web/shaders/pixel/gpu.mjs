// Perspective-stable pixel art on the GPU: the frame loop of pixel.mjs with two probe slots.
//   const px = await createGpuPixel(host, { N: 192, cell: 0.5 }, { w, h });
//   px.frame({ eye, target, fovy });  px.packed: sRGB RGBA8;  await px.read()
import { COMMON_WGSL } from "../common.mjs";
import { SCENE_WGSL } from "./scene.wgsl.mjs";
import { PIXEL_HEAD, PIXEL_FIELDS, CAPTURE_WGSL, SHADE_WGSL, SPLATZ_WGSL, SPLATID_WGSL, CLEAR_WGSL, RESOLVE_WGSL } from "./pixel.wgsl.mjs";
import { PIXEL_DEFAULTS, fadeStep } from "./pixel.mjs";
import { snapOrigin } from "./probe.mjs";
import { camera } from "./splat.mjs";

const head = COMMON_WGSL + "\n" + SCENE_WGSL + "\n" + PIXEL_HEAD + "\n";
export const PIXEL_PASSES = { capture: CAPTURE_WGSL, shade: SHADE_WGSL, splatz: SPLATZ_WGSL, splatid: SPLATID_WGSL, clear: CLEAR_WGSL, resolve: RESOLVE_WGSL };

export async function createGpuPixel(host, options, size) {
  const o = { ...PIXEL_DEFAULTS, ...options }, { w, h } = size, T = 6 * o.N * o.N, pipes = {};
  await Promise.all(Object.entries(PIXEL_PASSES).map(async ([k, code]) => { pipes[k] = await host.compute("pixel." + k, head + code); }));
  const st = (bytes, label) => host.buffer({ size: bytes, usage: ["storage", "copy-dst", "copy-src"], label });
  const slot = () => ({ P: st(4 * PIXEL_FIELDS.length, "pixel slot params"), geo: st(16 * T, "probe geo"), nrm: st(16 * T, "probe normals"), col: st(16 * T, "probe colour"),
    zb: st(4 * w * h, "splat depth"), idb: st(4 * w * h, "splat ids"), origin: null });
  let S = [slot(), slot()], fade = 1, hasPrev = false, lastEye = null;
  const B = { P: st(4 * PIXEL_FIELDS.length, "pixel params"), img: st(16 * w * h, "pixel image"), out8: st(4 * w * h, "pixel packed") };
  const params = (origin, cam) => {
    const v = { w, h, n: o.N, ox: origin[0], oy: origin[1], oz: origin[2], bands: o.bands, outline: o.outline, crease: o.crease, expand: o.expand,
      ex: cam.eye[0], ey: cam.eye[1], ez: cam.eye[2], fx: cam.f[0], fy: cam.f[1], fz: cam.f[2], rx: cam.r[0], ry: cam.r[1], rz: cam.r[2],
      ux: cam.u[0], uy: cam.u[1], uz: cam.u[2], ty: cam.ty, blend: fade, hasPrev: hasPrev ? 1 : 0 };
    return Float32Array.from(PIXEL_FIELDS.map((k) => v[k]));
  };
  const run = (cp, pipe, list, x, y = 1, z = 1) => { cp.setPipeline(pipe); cp.setBindGroup(0, host.bind(pipe, list)); cp.dispatchWorkgroups(x, y, z); };
  return {
    options: o, packed: B.out8, image: B.img,
    frame({ eye, target, fovy = 0.75 }) {
      const origin = snapOrigin(eye, o.cell), cam = camera(eye, target, fovy, w, h), enc = host.device.createCommandEncoder();
      const fresh = !S[0].origin || origin.some((v, i) => v !== S[0].origin[i]);
      if (fresh) { hasPrev = !!S[0].origin; S = [S[1], S[0]]; S[0].origin = origin; fade = hasPrev ? 0 : 1; }
      fade = Math.min(1, fade + fadeStep(o, lastEye, eye)); lastEye = eye.slice();
      const live = hasPrev && fade < 1 ? [S[0], S[1]] : [S[0]];
      for (const s of live) host.write(s.P, params(s.origin, cam));
      host.write(B.P, params(S[0].origin, cam));
      let cp = enc.beginComputePass();
      if (fresh) { const n8 = Math.ceil(o.N / 8); run(cp, pipes.capture, [S[0].P, S[0].geo, S[0].nrm], n8, n8, 6); run(cp, pipes.shade, [S[0].P, S[0].geo, S[0].nrm, S[0].col], n8, n8, 6); }
      for (const s of live) {
        run(cp, pipes.clear, [s.P, s.zb], Math.ceil((w * h) / 64)); run(cp, pipes.clear, [s.P, s.idb], Math.ceil((w * h) / 64));
        run(cp, pipes.splatz, [s.P, s.geo, s.zb], Math.ceil(T / 64)); run(cp, pipes.splatid, [s.P, s.geo, s.zb, s.idb], Math.ceil(T / 64));
      }
      const other = live[1] || S[0];
      run(cp, pipes.resolve, [B.P, S[0].col, other.col, S[0].idb, other.idb, B.img, B.out8], Math.ceil(w / 8), Math.ceil(h / 8));
      cp.end(); host.device.queue.submit([enc.finish()]);
      return { origin, blend: fade };
    },
    async read() {
      const s = host.buffer({ size: 4 * w * h, usage: ["map-read", "copy-dst"] }), enc = host.device.createCommandEncoder();
      enc.copyBufferToBuffer(B.out8, 0, s, 0, 4 * w * h); host.device.queue.submit([enc.finish()]);
      await s.mapAsync(1); const out = new Uint8Array(s.getMappedRange().slice(0)); s.unmap(); s.destroy(); return { packed: out };
    },
    destroy() { for (const s of S) for (const b of Object.values(s)) if (b && b.destroy) b.destroy(); for (const b of Object.values(B)) b.destroy(); },
  };
}
