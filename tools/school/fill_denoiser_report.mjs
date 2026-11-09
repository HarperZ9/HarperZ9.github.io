// Lesson K25's primary-source blocks: raw-native's evidence, read only with
// git show from origin/main and copied verbatim (no rounding). Used by
// tools/school/fill_denoiser.mjs.
const NOTE = "evidence/rr-tc-note-2026-10-15.json", RTX = "evidence/rr-h2-v4/rtx4090/v4-parity-raw_hero-validation.json", EMU = "evidence/rr-tc-2026-10-15/";
const BOUNDS = "evidence/rr-inference-bounds.json", CONV = "src/rhi/vulkan/shaders/vk_rr_conv.comp", GLUE = "src/rhi/vulkan/shaders/vk_rr_glue.comp", HOST = "src/rhi/vulkan/vk_rrnet.cpp";
const EMULATE = "scripts/rr_tc_emulate.py", MODEL = "scripts/rr_model.py", EXPORT = "scripts/rr_export.py";
const MIXED = ["keep-10", "keep-10_1_9", "keep-10_1_9_8_0_3"];

const SOURCES = [
  [NOTE, "The diagnosis: written before the emulation with its predictions, then its results: the emulated tensor-core arithmetic gives 0.1085 at frame 48, pixel 64,580, the RTX's own worst place; fp16 weights alone and fp16 inputs alone each miss; the worst pixels are single-sample specular fireflies; no small mixed-precision change meets 1e-2; the decision not to change the path and not to loosen the bound.", "That the CPU emulation reproduces the tensor cores' accumulation order (the note says so itself). It gives no pixel values, radiance per channel or weights, so the re-creation cannot use the real case."],
  [RTX, "The hardware result on the RTX 4090 (raw_hero_p7, 64 frames, 24,883,200 values): cooperative-matrix max 0.106689 at frame 48, pixel 64580, not within 1e-2; scalar max 0.00290298, within; the perturbed control 4.32419, fails as it must.", "Why the cooperative-matrix path misses; that is the note's work."],
  [EMU, "The emulation's numbers per mode (W, A, WA), the mixed-precision runs (keep-*) and the per-layer ablation (layer-0 to layer-11): max, mean, 99.99th percentile, frames and pixels over 1e-2, and the worst places.", "Anything about the GPU on its own; these are PyTorch on a CPU."],
  [BOUNDS, "The parity bound, written 2026-10-13 before the kernels: max absolute difference in linear radiance at most 1e-2 on every pixel of every test frame, for each path, against the PyTorch forward pass run the same way in float32; the perturbed-weights control that must fail.", "Image quality, or speed on other GPUs (its own does-not-prove)."],
  [CONV, "The arithmetic at issue: with COOP=1 every im2col activation is rounded to fp16 (As[e] = float16_t(v)), weights are an fp16 table, coopMatMulAdd accumulates in fp32, and the fp32 bias is added after; with COOP=0 the scalar path starts each sum at the bias and stays fp32.", "The tensor cores' internal summation order, which the shader does not set."],
  [GLUE, "The non-convolution steps in fp32 for both paths, including KAPPLY: the per-pixel softmax 5 x 5 kernel (8 tanh(z / 8) bound, max subtracted, sum of e v then divide, replicate padding).", "Nothing about rounding in the convolutions."],
  [HOST, "The parity measure: |out - ref| per value in double from float32 outputs, the max over every value of every frame, pass when max <= 1e-2; the frame and pixel of the max.", "Anything about why a path misses."],
  [EMULATE, "How the emulation rounds: W rounds weights with .half().float(), A rounds every convolution's input the same way, the bias and accumulation stay fp32; --fp32-layers keeps listed layers in fp32.", "That PyTorch's CPU summation order matches the GPU's."],
  [MODEL, "The network (version 4): the 25 features, the U-Net, the full-resolution head on [u0, features] predicting two 5 x 5 kernels and blends, specular demodulated by its albedo plus epsilon, filtered, remodulated.", "Anything about the trained weights' values."],
  [EXPORT, "The layer order (LAYERS) that names layer 10 as the full-resolution head.", ""],
];

export function sourcesBlock(raw) {
  return { about: "raw-native's files this lesson relies on, all read only with git show from origin/main. commit: origin/main when the fill ran; lastCommit: the last commit on origin/main that touched each path. proves and doesNotProve say what each file can carry for the film and the page.",
    repository: "HarperZ9/raw-native", branch: "origin/main", commit: raw ? raw.commit : null, read: !!raw,
    files: SOURCES.map(([path, proves, doesNotProve]) => ({ path, lastCommit: raw ? raw.last(path) : null, proves, doesNotProve: doesNotProve || null })) };
}

export function noteBlock(raw) {
  if (!raw) return { found: false, path: NOTE, about: "Not read in this fill; nothing from it is used." };
  return { found: true, path: NOTE, commit: raw.commit, lastCommit: raw.last(NOTE), about: "The evidence note, verbatim, every field as committed.", json: JSON.parse(raw.show(NOTE)) };
}

const pick = (j) => ({ frames: j.frames, max_abs: j.max_abs, mean_abs: j.mean_abs, p99_99: j.p99_99, "frames_over_1e-2": j["frames_over_1e-2"], "pixels_over_1e-2": j["pixels_over_1e-2"], worst: j.worst.slice(0, 5) });

export function primaryBlock(raw) {
  if (!raw) return { found: false, about: "raw-native was not read in this fill; no primary number is available." };
  const J = (p) => JSON.parse(raw.show(p)), rtx = J(RTX), bounds = J(BOUNDS);
  const layers = JSON.parse(raw.show(EXPORT).match(/^LAYERS = (\[.*\])$/m)[1].replace(/'/g, '"'));
  const emulation = Object.fromEntries(["W", "A", "WA"].map((m) => [m, { path: `${EMU}emu-${m}.json`, ...pick(J(`${EMU}emu-${m}.json`)) }]));
  const mixed = Object.fromEntries(MIXED.map((k) => { const j = J(`${EMU}${k}.json`); return [k, { path: `${EMU}${k}.json`, fp32_layers: j.fp32_layers, fp32LayerNames: j.fp32_layers.map((i) => layers[i]), ...pick(j) }]; }));
  const perLayer = layers.map((name, i) => { const j = J(`${EMU}layer-${i}.json`); return { layer: i, name, path: `${EMU}layer-${i}.json`, frames: j.frames, max_abs: j.max_abs, "pixels_over_1e-2": j["pixels_over_1e-2"], worst: j.worst[0] }; });
  const w = emulation.WA.worst[0];
  return { found: true, commit: raw.commit,
    about: "raw-native's numbers, verbatim from the files named in each path field (none rounded). rtx: the RTX 4090 validation run of model v4 on raw_hero_p7. emulation: the CPU emulation per mode, max over 64 frames, with the first five worst places. mixed: WA with the listed layers kept in fp32. perLayer: only one layer rounded (frames 0 to 48), names from rr_export.LAYERS. bound: the parity bound as written. pixel: the worst place as x and y from the emulation files; the frame width 480 is derived here from pixel = y * width + x (64,580 = 134 x 480 + 260) and 270 rows from 24,883,200 values / 64 frames / 3 channels / 480.",
    rtx: { path: RTX, device: rtx.device, sequence: rtx.sequence, frames: rtx.frames, coop: rtx.coop.parity, scalar: rtx.scalar.parity, control_perturbed: rtx.control_perturbed, pass: rtx.pass },
    emulation, mixed, perLayer, bound: { path: BOUNDS, written: bounds.written, parity: bounds.parity, controls: bounds.controls_that_must_fail },
    pixel: { frame: w.frame, pixel: w.pixel, x: w.x, y: w.y, widthDerived: (w.pixel - w.x) / w.y, heightDerived: rtx.coop.parity.values / rtx.frames / 3 / ((w.pixel - w.x) / w.y) } };
}
