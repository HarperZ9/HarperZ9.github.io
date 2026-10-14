// Palette quantisation and dither: the CPU reference (the author's retro-dither.js, vendored
// unchanged, plus a blue-noise mode on its orderedPick) and the GPU runner.
//   const q = await createGpuDither(host, { palette: "pico8", mode: "bayer8", strength: 1 }, { w, h });   // mode is required
//   q.frame(rgba8 /* Uint8Array of the plate */);  await q.read() -> { idx: Uint32Array, rgba: Uint8Array }
import { ditherPlate, orderedPick, BAYER, BAYER_MAX } from "../reference/retro-dither.mjs";
import { mixPalette, mixPick } from "./mix.mjs";
import { labPalette, nearestIndex, SRGB8_TO_LINEAR, linearToOklab, srgbToOklab, RETRO_PALETTES } from "../reference/retro-palettes.mjs";
import { blueNoise64 } from "./bluenoise.mjs";
import { dsSplit, DS_WGSL } from "./ds.wgsl.mjs";
import { DITHER_WGSL } from "./dither.wgsl.mjs";

export const MODES = { none: 0, bayer2: 1, bayer4: 2, bayer8: 3, noise: 4, blue: 5, "mix-bayer4": 6, "mix-bayer8": 7, "mix-blue": 8 };
// The mix modes (mix.mjs) and the threshold source each one uses.
const MIX = { "mix-bayer4": 4, "mix-bayer8": 8, "mix-blue": "blue" };
// No default mode (author direction, 2026-10-11): bayer4 lost a blind model-judge panel to a
// plain per-channel Bayer dither on EGA (0 of 12), and mix-bayer4, though closer to the source
// (evidence/shaders-dither-mix-runs.json), lost too (2 of 12). A caller names the mode.
function needMode(mode) {
  if (mode === undefined) throw new Error(`dither: name a mode (${Object.keys(MODES).join(", ")})`);
  if (!(mode in MODES)) throw new Error(`dither: unknown mode ${mode}`);
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// A palette spec to OKLab entries ({ lab, rgb }), the form every mode takes. A spec is a
// palette name, or a fixed palette of its own: an array of "#rrggbb" strings or [r, g, b]
// bytes, at least two. An unknown name throws; the vendored labPalette falls back to the
// Game Boy colours instead, which turned a typo into a silent change of look.
export function resolvePalette(palette = "pico8") {
  if (typeof palette === "string") {
    if (!Object.prototype.hasOwnProperty.call(RETRO_PALETTES, palette)) throw new Error(`dither: unknown palette ${palette} (${Object.keys(RETRO_PALETTES).join(", ")}, or an array of colours)`);
    return labPalette(palette);
  }
  if (!Array.isArray(palette) || palette.length < 2) throw new Error("dither: a palette is a name or an array of at least two colours");
  if (palette.every((e) => e && Array.isArray(e.lab) && Array.isArray(e.rgb))) return palette;
  return palette.map((c, i) => {
    let rgb = c;
    if (typeof c === "string") {
      const m = /^#([0-9a-f]{6})$/i.exec(c);
      if (!m) throw new Error(`dither: palette colour ${i} is ${c.slice(0, 20)}, expected #rrggbb`);
      rgb = [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16));
    }
    if (!Array.isArray(rgb) || rgb.length !== 3 || !rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) throw new Error(`dither: palette colour ${i} must be #rrggbb or three integers 0..255`);
    return { lab: srgbToOklab(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255), rgb: [...rgb] };
  });
}

// Plate bytes to OKLab, as retro-engine's quantizeGrid does with gamma 1.
export function plateLab(bytes, w, h, brightness = 0) {
  const lab = new Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4, [L, a, b] = linearToOklab(SRGB8_TO_LINEAR[bytes[i]], SRGB8_TO_LINEAR[bytes[i + 1]], SRGB8_TO_LINEAR[bytes[i + 2]]);
    lab[p] = [clamp01(L + brightness), a, b];
  }
  return lab;
}

// CPU reference: palette indices for a plate.
export function ditherRef(bytes, w, h, { palette = "pico8", mode, strength = 1, brightness = 0 } = {}) {
  needMode(mode);
  const pal = resolvePalette(palette);
  if (MIX[mode]) return mixRef(bytes, w, h, pal, mode, strength, brightness);
  const lab = plateLab(bytes, w, h, brightness);
  if (mode !== "blue") return ditherPlate(lab, w, h, pal, mode, strength);
  const s = clamp01(+strength || 0), bn = blueNoise64(), out = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, c = lab[p];
    out[p] = s > 0 ? orderedPick(c[0], c[1], c[2], pal, (bn[(y % 64) * 64 + (x % 64)] + 0.5) / 4096, s) : nearestIndex(c[0], c[1], c[2], pal);
  }
  return out;
}

function mixRef(bytes, w, h, pal, mode, strength, brightness) {
  if (brightness !== 0) throw new Error(`dither: ${mode} takes brightness 0 only`);
  const s = clamp01(+strength || 0), mp = mixPalette(pal), src = MIX[mode], bn = src === "blue" ? blueNoise64() : null, out = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, i = p * 4;
    const t = bn ? (bn[(y % 64) * 64 + (x % 64)] + 0.5) / 4096 : (BAYER[src][y % src][x % src] + 0.5) / BAYER_MAX[src];
    out[p] = mixPick(SRGB8_TO_LINEAR[bytes[i]], SRGB8_TO_LINEAR[bytes[i + 1]], SRGB8_TO_LINEAR[bytes[i + 2]], mp, t, s);
  }
  return out;
}

// Constants buffer: sRGB-to-linear table, the two OKLab matrices, epsilon, the pair penalty,
// the IGN constants, brightness and strength, each as a (hi, lo) f32 pair.
const M1 = [0.4122214708, 0.5363325363, 0.0514459929, 0.2119034982, 0.6806995451, 0.1073969566, 0.0883024619, 0.2817188376, 0.6299787005];
const M2 = [0.2104542553, 0.7936177850, -0.0040720468, 1.9779984951, -2.4285922050, 0.4505937099, 0.0259040371, 0.7827717662, -0.8086757660];
export function packConstants(brightness, strength) {
  const v = [...SRGB8_TO_LINEAR, ...M1, ...M2, 1e-9, 0.12, 0.06711056, 0.00583715, 52.9829189, brightness, clamp01(+strength || 0)];
  return Float32Array.from(v.flatMap(dsSplit));
}
export function packPalette(pal) {
  return { lab: Float32Array.from(pal.flatMap((e) => e.lab.flatMap(dsSplit))),
    rgb: Uint32Array.from(pal.map((e) => (e.rgb[0] | (e.rgb[1] << 8) | (e.rgb[2] << 16) | (255 << 24)) >>> 0)) };
}
export const DITHER_PASS = DS_WGSL + DITHER_WGSL;

export async function createGpuDither(host, { palette = "pico8", mode, strength = 1, brightness = 0 } = {}, size) {
  needMode(mode);
  if (MIX[mode] && brightness !== 0) throw new Error(`dither: ${mode} takes brightness 0 only`);
  const pal = resolvePalette(palette), pp = packPalette(pal), n = size.w * size.h;
  const pipe = await host.compute("dither", DITHER_PASS);
  const st = (bytes, label, data) => host.buffer({ size: bytes, usage: ["storage", "copy-dst", "copy-src"], label, data });
  const B = {
    P: st(16, "dither params", new Float32Array([size.w, size.h, pal.length, MODES[mode]])),
    K: st(4 * 2 * 281, "dither constants", packConstants(brightness, strength)),
    pal: st(pp.lab.byteLength, "dither palette", pp.lab), palrgb: st(pp.rgb.byteLength, "dither palette rgb", pp.rgb),
    bn: st(4096 * 4, "blue noise", Uint32Array.from(blueNoise64())),
    src: st(4 * n, "dither plate"), idx: st(4 * n, "dither indices"), out8: st(4 * n, "dither rgba"),
  };
  const list = [B.P, B.K, B.pal, B.palrgb, B.bn, B.src, B.idx, B.out8];
  return {
    buffers: B, packed: B.out8, palette: pal,
    frame(rgba8) {
      if (rgba8) host.write(B.src, rgba8);
      const enc = host.device.createCommandEncoder();
      this.record(enc);
      host.device.queue.submit([enc.finish()]);
    },
    // Record into an encoder the caller owns (the Motion post stack), plate already in buffers.src.
    record(enc) {
      const cp = enc.beginComputePass();
      cp.setPipeline(pipe); cp.setBindGroup(0, host.bind(pipe, list)); cp.dispatchWorkgroups(Math.ceil(size.w / 8), Math.ceil(size.h / 8)); cp.end();
    },
    async read() {
      const rd = async (buf) => {
        const s = host.buffer({ size: 4 * n, usage: ["map-read", "copy-dst"] }), enc = host.device.createCommandEncoder();
        enc.copyBufferToBuffer(buf, 0, s, 0, 4 * n); host.device.queue.submit([enc.finish()]);
        await s.mapAsync(1); const o = s.getMappedRange().slice(0); s.unmap(); s.destroy(); return o;
      };
      return { idx: new Uint32Array(await rd(B.idx)), rgba: new Uint8Array(await rd(B.out8)) };
    },
    destroy() { for (const b of Object.values(B)) b.destroy(); },
  };
}
