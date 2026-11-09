// crt-classic: the Studio's tube stage (retro-crt.js) on the GPU, for M1 criterion 9.
//   const t = await createGpuClassic(host, opts /* the retro-crt.js options */, { w, h });
//   t.frame(rgba8);  await t.read() -> Uint8Array RGBA
// The CPU reference is reference/retro-crt.mjs itself; classicRef() runs it on a byte array.
import { crtStage, beamTable, maskTable } from "../reference/retro-crt.mjs";
import { PHOSPHOR_WGSL, GLOW_DOWN_WGSL, BOX_WGSL, GLOW_ADD_WGSL, TUBE_WGSL } from "./classic.wgsl.mjs";

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const fixed = (t) => Int32Array.from(t, (v) => (v * 256 + 0.5) | 0);

export function classicRef(bytes, w, h, o) {
  const data = new Uint8ClampedArray(bytes);
  crtStage({ getImageData: () => ({ data }), putImageData: () => {} }, w, h, o);
  return data;
}

// The reference's own transfer tables, rebuilt with its arithmetic.
function tables() {
  const toLin = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; toLin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const toSrgb = new Uint32Array(4097);
  for (let i = 0; i <= 4096; i++) { const l = i / 4096; toSrgb[i] = Math.min(255, Math.max(0, Math.round((l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055) * 255))); }
  return { toLin, toSrgb };
}
const boxRadius = (sigma) => Math.max(1, Math.round(Math.sqrt(sigma * sigma * 4 + 1) / 2 - 0.5));

export function classicParams(o, w, h) {
  const cell = Math.max(1, o.cell | 0), scan = !!o.scanlines, s = clamp(+o.scanStrength || 0, 0, 1);
  const maskOn = !!(o.mask && o.mask !== "none" && o.maskStrength > 0), q = Math.min(w, h) < 320 ? 2 : 4;
  const beam = fixed(scan && cell >= 2 ? beamTable(cell, s, o.beam) : new Float32Array(16 * cell).fill(1));
  const mt = fixed(maskOn ? maskTable(o.mask, o.maskStrength) : new Float32Array(54).fill(1));
  const P = new Float32Array(20);
  P.set([w, h, cell, scan || maskOn ? 1 : 0, scan && cell < 2 ? 1 : 0, ((1 - s) * 256) | 0, (1.1 * 256) | 0, q, Math.ceil(w / q), Math.ceil(h / q),
    boxRadius(8 / q), boxRadius(28 / q), Math.max(0, +o.bloom || 0), Math.max(0, +o.halation || 0),
    Math.max(0, +o.curvature || 0), Math.max(0, +o.aberration || 0), Math.max(0, +o.vignette || 0)]);
  return { P, beam, mt };
}

export async function createGpuClassic(host, o, size) {
  const { w, h } = size, { P, beam, mt } = classicParams(o, w, h), { toLin, toSrgb } = tables();
  const lw = P[8], lh = P[9], st = (n, label, data) => host.buffer({ size: n, usage: ["storage", "copy-dst", "copy-src"], label, data });
  const variant = (dir, r) => { const v = P.slice(); v[17] = dir; v[18] = r; return st(80, "classic box params", v); };
  const B = {
    P: st(80, "classic params", P), beam: st(4 * beam.length, "beam", beam), mt: st(4 * mt.length, "mask", mt),
    toLin: st(1024, "toLin", toLin), toSrgb: st(4 * 4097, "toSrgb", toSrgb),
    src: st(4 * w * h, "classic in"), a: st(4 * w * h, "classic a"), b: st(4 * w * h, "classic b"), c: st(4 * w * h, "classic out"),
    lin: st(12 * lw * lh, "lin"), bright: st(12 * lw * lh, "bright"), tmp: st(12 * lw * lh, "tmp"),
    bx: variant(0, P[10]), by: variant(1, P[10]), hx: variant(0, P[11]), hy: variant(1, P[11]),
  };
  const pipes = {};
  for (const [k, code] of Object.entries({ phosphor: PHOSPHOR_WGSL, down: GLOW_DOWN_WGSL, box: BOX_WGSL, add: GLOW_ADD_WGSL, tube: TUBE_WGSL })) pipes[k] = await host.compute("classic." + k, code);
  const glow = P[12] > 0 || P[13] > 0;
  return {
    packed: B.c, src: B.src,
    frame(rgba8) {
      if (rgba8) host.write(B.src, rgba8);
      const enc = host.device.createCommandEncoder();
      this.record(enc);
      host.device.queue.submit([enc.finish()]);
    },
    // Record into an encoder the caller owns (the Motion post stack), plate already in src.
    record(enc) {
      const cp = enc.beginComputePass();
      const run = (pipe, list, x, y) => { cp.setPipeline(pipe); cp.setBindGroup(0, host.bind(pipe, list)); cp.dispatchWorkgroups(Math.ceil(x / 8), Math.ceil(y / 8)); };
      run(pipes.phosphor, [B.P, B.beam, B.mt, B.src, B.a], w, h);
      if (glow) {
        run(pipes.down, [B.P, B.toLin, B.a, B.lin, B.bright], lw, lh);
        for (const [buf, px, py, on] of [[B.bright, B.bx, B.by, P[12] > 0], [B.lin, B.hx, B.hy, P[13] > 0]]) {
          if (!on) continue;
          for (let k = 0; k < 3; k++) { run(pipes.box, [px, buf, B.tmp], lw, lh); run(pipes.box, [py, B.tmp, buf], lw, lh); }
        }
      }
      run(pipes.add, [B.P, B.toLin, B.toSrgb, B.bright, B.lin, B.a, B.b], w, h);
      run(pipes.tube, [B.P, B.b, B.c], w, h);
      cp.end();
    },
    async read() {
      const s = host.buffer({ size: 4 * w * h, usage: ["map-read", "copy-dst"] }), enc = host.device.createCommandEncoder();
      enc.copyBufferToBuffer(B.c, 0, s, 0, 4 * w * h); host.device.queue.submit([enc.finish()]);
      await s.mapAsync(1); const o2 = new Uint8Array(s.getMappedRange().slice(0)); s.unmap(); s.destroy(); return o2;
    },
    destroy() { for (const b of Object.values(B)) b.destroy(); },
  };
}
