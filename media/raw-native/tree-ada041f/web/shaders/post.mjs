// The shader library in the Motion post stack (web/motion/post.mjs): importing this
// module registers its looks as passes a display list can name in post.passes.
//
//   "crt"   display stage: the finished frame is the tube's R'G'B' signal at the source
//           resolution spec.source ([320, 240] by default, the frame box-filtered down);
//           the tube is drawn at the frame's size and encoded to display values.
//           spec: { preset: "pvm-20" | ..., source: [w, h], exposure, ...overrides }
//   "film"  scene stage: scene-linear light in, the print out as display values (the film
//           is its own tone mapper, so use it without post.colour; a list that sets both is
//           refused). On display-encoded colours the stack decodes sRGB first (motion/post.mjs).
//           spec: { preset: "500t-print" | ..., ev, ...overrides }
//   "crt-classic"  display stage: the Studio's tube (retro-crt.js) on the GPU: scanlines,
//           masks, bloom, halation, curvature, chromatic aberration, vignette.
//           spec: the retro-crt.js options ({ cell, scanlines, mask, aberration, ... })
//   "dither"  display stage: palette quantisation with ordered, noise or blue-noise dither.
//           spec: { palette: "pico8" | ..., mode (required): "bayer4" | "mix-bayer4" | ..., strength, brightness }
//   "paint"  scene stage: the painterly shader (structure tensor, anisotropic Kuwahara,
//           Kubelka-Munk pigment, strokes and medium); scene light in, display values out.
//           spec: { preset: "oil-grotesque" | "oil" | "gouache" | "watercolour", ...overrides }
// crt-classic and dither work on 8-bit plates, as their references do: the frame is rounded to
// bytes going in, and their bytes come back out.
// Each pass carries the library's CPU reference, run the way the stack feeds the GPU, so
// tests/web/post_passes.py holds the GPU to it.
import { registerPass } from "../motion/post.mjs";
import { Access } from "../frame-graph.mjs";
import { createGpuCrt } from "./crt/gpu.mjs";
import { createCrt } from "./crt/crt.mjs";
import { shoulder } from "./crt/glass.mjs";
import { createGpuFilm } from "./film/gpu.mjs";
import { createFilm } from "./film/run.mjs";
import { createGpuClassic, classicRef } from "./crt-classic/classic.mjs";
import { createGpuDither, ditherRef, resolvePalette } from "./dither/dither.mjs";
import { createGpuPaint } from "./paint/gpu.mjs";
import { createPaint } from "./paint/paint.mjs";

const srgb = (l) => (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055);
const SPLIT = (spec, keys) => Object.fromEntries(Object.entries(spec).filter(([k]) => k !== "pass" && !keys.includes(k)));

// A pass over n pixels in 64-wide workgroups, folded into two dimensions: a 4K frame needs
// 129,600 groups, over WebGPU's 65,535 a dimension, which refuses the dispatch and leaves the frame
// black (tests/web/post_4k.py). Rows of 32,768 groups; the shader's index is gid.x + gid.y * 2,097,152.
export const groups64 = (n) => { const g = Math.ceil(n / 64); return [Math.min(g, 32768), Math.ceil(g / 32768)]; };

// Encode a linear vec4 image buffer to display values in another buffer, after the effect.
const ENCODE_WGSL = (tube) => /* wgsl */ `
@group(0) @binding(0) var<storage, read> img: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> out: array<vec4f>;
@group(0) @binding(2) var<uniform> k: vec4f;   // exposure
fn shoulder(x: f32) -> f32 { let s = 0.8; if (x <= s) { return x; } return s + (1.0 - s) * tanh((x - s) / (1.0 - s)); }
fn enc(v: f32) -> f32 {
  let l = ${tube ? "shoulder(max(0.0, v * k.x))" : "clamp(v * k.x, 0.0, 1.0)"};
  if (l <= 0.0031308) { return l * 12.92; }
  return 1.055 * pow(l, 1.0 / 2.4) - 0.055;
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x + gid.y * 2097152u;
  if (i >= arrayLength(&out)) { return; }
  let c = img[i];
  out[i] = vec4f(enc(c.x), enc(c.y), enc(c.z), 1.0);
}`;

async function encoder(host, tube, n, img, exposure) {
  const out = host.buffer({ size: 16 * n, usage: ["storage", "copy-src", "copy-dst"], label: "shader post out" });
  const k = host.buffer({ size: 16, usage: ["uniform", "copy-dst"], label: "shader post exposure" });
  host.write(k, new Float32Array([exposure, 0, 0, 0]));
  const pipe = await host.compute(tube ? "crt encode" : "film encode", ENCODE_WGSL(tube));
  const g = host.graph(), ri = g.importBuffer("img", img), ro = g.importBuffer("out", out), rk = g.importBuffer("k", k);
  g.addPass("encode", [[ri, Access.StorageRead], [rk, Access.StorageRead], [ro, Access.StorageWrite]], (c) => c.dispatch(pipe, [img, out, k], ...groups64(n)));
  g.markOutput(ro); g.compile();
  return { out, record: (enc) => host.record(g, enc, false), destroy() { out.destroy(); k.destroy(); } };
}

// The stack's box filter (post_run.mjs TO_BUF), on the CPU: input pixel (x, y) is the
// mean of the frame pixels from floor(x * W / w) to max(that + 1, floor((x + 1) * W / w)).
function boxDown(input, W, H, w, h) {
  const out = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ax = Math.floor((x * W) / w), ay = Math.floor((y * H) / h);
    const bx = Math.max(ax + 1, Math.floor(((x + 1) * W) / w)), by = Math.max(ay + 1, Math.floor(((y + 1) * H) / h));
    for (let k = 0; k < 4; k++) {
      let s = 0;
      for (let yy = ay; yy < by; yy++) for (let xx = ax; xx < bx; xx++) s += input[4 * (yy * W + xx) + k];
      out[4 * (y * w + x) + k] = s / ((bx - ax) * (by - ay));
    }
  }
  return out;
}

// CPU references keep their state (persistence, frame number) per test spec.
const cpuState = new WeakMap();

registerPass("crt", {
  stage: "display",
  tests: [{ preset: "pvm-20", source: [320, 200] }],
  effect: async (host, { width, height, spec }) => {
    const [sw, sh] = spec.source || [320, 240], exposure = spec.exposure ?? 1;
    const crt = await createGpuCrt(host, spec.preset || "pvm-20", SPLIT(spec, ["preset", "source", "exposure"]), { w: sw, h: sh }, { w: width, h: height }, { exposure });
    const e = await encoder(host, true, width * height, crt.image, exposure);
    return { input: crt.buffers.src, inputSize: [sw, sh], output: e.out,
      record(enc, f) { crt.record(enc, f); e.record(enc); }, destroy() { crt.destroy(); e.destroy(); } };
  },
  cpu: (input, W, H, spec) => {
    const [sw, sh] = spec.source || [320, 240], exposure = spec.exposure ?? 1;
    let st = cpuState.get(spec);
    if (!st) cpuState.set(spec, (st = { crt: createCrt(spec.preset || "pvm-20", SPLIT(spec, ["preset", "source", "exposure"]), { w: sw, h: sh }, { w: W, h: H }), f: 0 }));
    const { img } = st.crt.frame({ width: sw, height: sh, data: boxDown(input, W, H, sw, sh) }, st.f++);
    const out = new Float32Array(W * H * 4);
    for (let i = 0; i < out.length; i += 4) {
      for (let c = 0; c < 3; c++) out[i + c] = srgb(shoulder(Math.max(0, img[i + c] * exposure)));
      out[i + 3] = 1;
    }
    return out;
  },
});

registerPass("film", {
  stage: "scene",
  // Reads scene-linear light, writes the print as display values. Without post.colour the
  // stack inserts the sRGB decode first; with post.colour the list is refused (two tone mappers).
  input: "linear",
  output: "display",
  tests: [{ preset: "500t-print" }],
  effect: async (host, { width, height, spec }) => {
    const film = await createGpuFilm(host, spec.preset || "500t-print", SPLIT(spec, ["preset"]), { w: width, h: height }, { w: width, h: height });
    const e = await encoder(host, false, width * height, film.image, 1);
    return { input: film.buffers.scene, output: e.out,
      record(enc, f) { film.record(enc, f); e.record(enc); }, destroy() { film.destroy(); e.destroy(); } };
  },
  cpu: (input, W, H, spec) => {
    let st = cpuState.get(spec);
    if (!st) cpuState.set(spec, (st = { film: createFilm(spec.preset || "500t-print", SPLIT(spec, ["preset"]), { w: W, h: H }, { w: W, h: H }), f: 0 }));
    const { img } = st.film.frame({ width: W, height: H, data: input }, st.f++);
    const out = new Float32Array(W * H * 4);
    for (let i = 0; i < out.length; i += 4) {
      for (let c = 0; c < 3; c++) out[i + c] = srgb(Math.min(1, Math.max(0, img[i + c])));
      out[i + 3] = 1;
    }
    return out;
  },
});

// Byte-plate effects: pack the frame's display values to RGBA8 words, run the plate
// effect, unpack its RGBA8 words to values.
const PACK_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> a: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> b: array<u32>;
fn q(v: f32) -> u32 { return u32(floor(clamp(v, 0.0, 1.0) * 255.0 + 0.5)); }
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x + gid.y * 2097152u;
  if (i >= arrayLength(&b)) { return; }
  let c = a[i];
  b[i] = q(c.x) | (q(c.y) << 8u) | (q(c.z) << 16u) | (q(c.w) << 24u);
}`;
const UNPACK_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> a: array<u32>;
@group(0) @binding(1) var<storage, read_write> b: array<vec4f>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x + gid.y * 2097152u;
  if (i >= arrayLength(&b)) { return; }
  let w = a[i];
  b[i] = vec4f(f32(w & 255u), f32((w >> 8u) & 255u), f32((w >> 16u) & 255u), 255.0) / 255.0;
}`;
async function plateEffect(host, width, height, inner) {
  const n = width * height, st = (bytes, label) => host.buffer({ size: bytes, usage: ["storage", "copy-src", "copy-dst"], label });
  const input = st(16 * n, "plate in"), output = st(16 * n, "plate out");
  const [pack, unpack] = await Promise.all([host.compute("plate pack", PACK_WGSL), host.compute("plate unpack", UNPACK_WGSL)]);
  const g = host.graph(), ri = g.importBuffer("in", input), rs = g.importBuffer("src", inner.src);
  g.addPass("pack", [[ri, Access.StorageRead], [rs, Access.StorageWrite]], (c) => c.dispatch(pack, [input, inner.src], ...groups64(n)));
  g.markOutput(rs); g.compile();
  const g2 = host.graph(), rp2 = g2.importBuffer("packed", inner.packed), ro2 = g2.importBuffer("out", output);
  g2.addPass("unpack", [[rp2, Access.StorageRead], [ro2, Access.StorageWrite]], (c) => c.dispatch(unpack, [inner.packed, output], ...groups64(n)));
  g2.markOutput(ro2); g2.compile();
  return { input, output, record(enc) { host.record(g, enc, false); inner.record(enc); host.record(g2, enc, false); },
    destroy() { input.destroy(); output.destroy(); inner.destroy(); } };
}
const toBytes = (input) => { const b = new Uint8Array(input.length); for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.min(1, Math.max(0, input[i])) * 255 + 0.5); return b; };
const fromBytes = (bytes) => { const o = new Float32Array(bytes.length); for (let i = 0; i < o.length; i++) o[i] = (i & 3) === 3 ? 1 : bytes[i] / 255; return o; };
const optsOf = (spec) => Object.fromEntries(Object.entries(spec).filter(([k]) => k !== "pass"));

registerPass("crt-classic", {
  stage: "display",
  tests: [{ cell: 4, scanlines: true, scanStrength: 0.35, beam: 0.5, mask: "grille", maskStrength: 0.3, bloom: 0.18, halation: 0.2, curvature: 0.12, aberration: 0.1, vignette: 0.25 },
    { cell: 3, scanlines: true, scanStrength: 0.6, beam: 1, mask: "slot", maskStrength: 0.8 }],
  effect: async (host, { width, height, spec }) => {
    const t = await createGpuClassic(host, optsOf(spec), { w: width, h: height });
    return plateEffect(host, width, height, { src: t.src, packed: t.packed, record: (enc) => t.record(enc), destroy: () => t.destroy() });
  },
  cpu: (input, W, H, spec) => fromBytes(classicRef(toBytes(input), W, H, optsOf(spec))),
});

registerPass("dither", {
  stage: "display",
  tests: [{ palette: "pico8", mode: "bayer4" }, { palette: "gameboy", mode: "bayer8" }, { palette: "ega", mode: "blue" }, { palette: "nes", mode: "noise", strength: 0.7, brightness: 0.05 },
    { palette: ["#141018", "#3a4a5c", "#8aa39b", "#e8dcc0", "#d9622b"], mode: "bayer4" }],
  effect: async (host, { width, height, spec }) => {
    const d = await createGpuDither(host, optsOf(spec), { w: width, h: height });
    return plateEffect(host, width, height, { src: d.buffers.src, packed: d.packed, record: (enc) => d.record(enc), destroy: () => d.destroy() });
  },
  cpu: (input, W, H, spec) => {
    const bytes = toBytes(input), idx = ditherRef(bytes, W, H, optsOf(spec));
    const d = resolvePalette(spec.palette || "pico8").map((e) => e.rgb), out = new Float32Array(W * H * 4);
    for (let p = 0; p < W * H; p++) { const c = d[idx[p]]; out[4 * p] = c[0] / 255; out[4 * p + 1] = c[1] / 255; out[4 * p + 2] = c[2] / 255; out[4 * p + 3] = 1; }
    return out;
  },
});

registerPass("paint", {
  stage: "scene",
  // Scene-linear light in, display values out, like film: on display-encoded colours the stack
  // decodes sRGB first, and a list that also sets post.colour is refused.
  input: "linear",
  output: "display",
  // One preset in the gate: paint's CPU reference is slow on CI runners, and two presets over
  // the four frames passed the job's time. The shader library's own parity tests cover the rest.
  tests: [{ preset: "oil-grotesque" }],
  effect: async (host, { width, height, spec }) => {
    const p = await createGpuPaint(host, spec.preset || "oil", SPLIT(spec, ["preset"]), { w: width, h: height });
    const e = await encoder(host, false, width * height, p.image, 1);
    return { input: p.scene, output: e.out, record(enc) { p.record(enc); e.record(enc); }, destroy() { p.destroy(); e.destroy(); } };
  },
  cpu: (input, W, H, spec) => {
    const { img } = createPaint(spec.preset || "oil", SPLIT(spec, ["preset"]), { w: W, h: H }).frame({ width: W, height: H, data: input });
    const out = new Float32Array(W * H * 4);
    for (let i = 0; i < out.length; i += 4) { for (let c = 0; c < 3; c++) out[i + c] = srgb(Math.min(1, Math.max(0, img[i + c]))); out[i + 3] = 1; }
    return out;
  },
});
