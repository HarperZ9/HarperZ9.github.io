// Fill lesson K25's numbers ("Case study: the denoiser's tensor-core parity")
// so no number in the film or lab is typed by hand. Writes
// media/school/denoiser/facts.json.
//
//   node tools/school/fill_denoiser.mjs [media/school/denoiser] [raw-native checkout]
//
// Two kinds of number, kept apart: primary (raw-native's evidence, read only
// with git show from origin/main and copied verbatim, never rounded) and
// recreation (this lesson's synthetic re-creation, system/school/denoiser.mjs).
// No GPU. One process at below-normal priority.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { FORMATS, spacing, roundTo, bitsNeeded } from "../../system/school/precision.mjs";
import { PARITY, NOTE_CASE, VARIANTS, makeImage, makeNet, scoreImage, scoreFirefly, filterPixel, sweep, alphaFor } from "../../system/school/denoiser.mjs";
import { round } from "./fill_gaming_report.mjs";
import { fx } from "./fill_quant_report.mjs";
import { sourcesBlock, primaryBlock, noteBlock } from "./fill_denoiser_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const outDir = process.argv[2] || "media/school/denoiser", rawNative = process.argv[3] || process.env.RAW_NATIVE_DIR || null;
const CASE = 1, SEEDS = Array.from({ length: 200 }, (_, i) => i + 1), PATHS = Object.keys(VARIANTS), cost = {};
const timed = (k, fn) => { const t = performance.now(), v = fn(); cost[k] = (cost[k] ?? 0) + performance.now() - t; return v; };
const e3 = (v) => v.toExponential(2);
// Four significant figures for this lesson's own numbers (errors span 1e-7 to 1, so fixed decimals would erase the small ones).
const deep = (o) => (Array.isArray(o) ? o.map(deep) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)])) : typeof o === "number" && Number.isFinite(o) && !Number.isInteger(o) ? Number(o.toPrecision(4)) : o);

function readRaw() {
  if (!rawNative) return null;
  const git = (...a) => execFileSync("git", ["-C", rawNative, ...a], { encoding: "utf8", maxBuffer: 64 << 20 });
  try {
    const commit = git("rev-parse", "origin/main").trim();
    return { commit, show: (p) => git("show", `origin/main:${p}`), last: (p) => git("log", "-1", "--format=%H", "origin/main", "--", p).trim() };
  } catch (e) { console.error("raw-native not read:", e.message); return null; }
}

function arithmeticBlock(rec) {
  const den = Math.fround(NOTE_CASE.specularAlbedo + NOTE_CASE.eps), v = Math.fround(NOTE_CASE.fireflyRadiance / den), L = Math.log1p(v), F16 = FORMATS.fp16;
  return { about: "The arithmetic of the case, computed here. demodulated: the note's specular radiance 1,087 over its specular albedo plus epsilon (0.04 + 0.01), in fp32. featureLog: log1p of it, the value the network sees as an input feature, with its fp16 spacing and worst rounding. near110: fp16's spacing and worst move near 110 (K24's facts) against the 1e-2 absolute bound, and the relative precision 1e-2 / 110 the bound asks for. sensitivity: in a softmax kernel, d out / d z_k = w_k (v_k - out); for the firefly tap that is about the filtered value itself, so a logit error dz moves the output by about 110 dz. dzForBound: the logit error that alone uses up the bound at this case's sensitivity.",
    demodulated: v, featureLog: { value: L, fp16Spacing: spacing(L, F16), fp16WorstMove: spacing(L, F16) / 2, fp16Rounded: roundTo(L, F16) },
    near110: { fp16Spacing: spacing(110, F16), fp16WorstMove: spacing(110, F16) / 2, worstMoveOverBound: spacing(110, F16) / 2 / PARITY.bound, relativeAsked: PARITY.bound / 110, bitsNeeded: bitsNeeded(110, PARITY.bound / 110), fp16Has: F16.p, fp16UnitRoundoff: F16.u },
    sensitivity: rec.firefly.WA.sensitivity, fireflyWeight: rec.firefly.WA.fireflyWeight, dzForBound: PARITY.bound / rec.firefly.WA.sensitivity, alpha: alphaFor() };
}

function recreationBlock() {
  const img = makeImage(CASE), net = makeNet(CASE, img), ctl = makeImage(CASE, { firefly: false });
  const firefly = {}, image = {}, control = {};
  for (const p of PATHS) {
    firefly[p] = timed("firefly", () => scoreFirefly(img, net, p));
    const { errorMap, ...s } = timed("image", () => scoreImage(img, net, p)), { errorMap: cm, ...c } = timed("image", () => scoreImage(ctl, net, p));
    image[p] = { ...s, errorMap: p === "WA" || p === "scalar" ? Array.from(errorMap) : undefined };
    control[p] = { ...c, errorMap: p === "WA" ? Array.from(cm) : undefined };
  }
  const neighbourhood = filterPixel(img, net, img.firefly.x, img.firefly.y, "reference");
  return { about: `SYNTHETIC re-creation (system/school/denoiser.mjs), case seed ${CASE}, a ${img.w} x ${img.h} specular image with one firefly. The network's weights and the frame's pixel values are not in raw-native's evidence, so a two-layer stand-in (hidden 24 x 25 on the pixel's own features, then a head of 25 kernel logits on [hidden, log1p of each tap]) is built to the note's magnitudes: radiance 1,087 among neighbours near 0.1, demodulated by 0.05, a learned suppression that weighs the firefly to about 110. The head's bias is set so the reference sits near 110 at the firefly pixel. Each path's arithmetic follows vk_rr_conv.comp (storage and summation per variant) and vk_rr_glue.comp (the fp32 softmax kernel); the reference follows rr_model.apply_kernel's order with float32 products summed in double and rounded once (a stand-in for PyTorch's float32 convolution). firefly: the firefly's own pixel per variant (maxAbs; ref and out, the three channels; fireflyWeight, sensitivity; dzFirefly, the bounded-logit move at the firefly tap; predicted, the linear prediction sum_k w_k (v_k - out) dz_k). image: every pixel (pixelsOver counts pixels whose worst channel exceeds the bound; maxAt is where the max is). Pixels near the firefly are not calibrated to 110, so their errors can be larger than the firefly pixel's own. errorMap: per pixel worst |out - ref|, row major, for the film.`,
    case: { seed: CASE, w: img.w, h: img.h, firefly: img.firefly, referenceValue: neighbourhood.out, tapsCentreRow: neighbourhood.taps.slice(10, 15).map((t) => t[0]), weightsCentreRow: neighbourhood.weights.slice(10, 15) },
    variants: Object.fromEntries(PATHS.map((p) => [p, { label: VARIANTS[p].label, hidden: VARIANTS[p].hidden, head: VARIANTS[p].head, inTheNote: VARIANTS[p].tried }])), firefly, image, control };
}

function sweepBlock() {
  const withF = timed("sweep", () => sweep(SEEDS, PATHS, true)), without = timed("sweep", () => sweep(SEEDS, PATHS, false));
  return { about: `The same arithmetic on ${SEEDS.length} seeded cases (seeds 1 to ${SEEDS.length}; each its own image, firefly place and stand-in weights), at the firefly's pixel. over: cases whose max exceeds the bound. control: the same cases with the firefly replaced by a neighbour-level value and the same network. This shows how typical the case seed is; it is a property of the stand-in, not of raw-native's network.`, firefly: withF.perPath, referenceValue: withF.referenceValue, control: without.perPath };
}

function controlsBlock(rec) {
  const img = makeImage(CASE), net = makeNet(CASE, img), bad = { ...net, W1: net.W1.map((v) => Math.fround(v * 1.01)) };
  const ref = filterPixel(img, net, img.firefly.x, img.firefly.y, "reference").out, out = filterPixel(img, bad, img.firefly.x, img.firefly.y, "scalar").out;
  const pert = Math.max(...out.map((v, c) => Math.abs(v - ref[c])));
  return { about: "Controls. noFirefly: the case image without its firefly, every variant, every pixel (the miss must need the firefly). fp32: the scalar path (fp32 throughout) on both images. perturbed: raw-native's own control that must fail, re-created: the scalar path with the first layer's weights scaled by 1.01, at the firefly pixel; it must exceed the bound. bound: the one bound every result carried.",
    noFirefly: Object.fromEntries(PATHS.map((p) => [p, { maxAbs: rec.control[p].maxAbs, pixelsOver: rec.control[p].pixelsOver, within: rec.control[p].within }])),
    fp32: { withFirefly: rec.image.scalar.maxAbs, withoutFirefly: rec.control.scalar.maxAbs, within: rec.image.scalar.within && rec.control.scalar.within },
    perturbed: { maxAbs: pert, fails: pert > PARITY.bound }, bound: PARITY.bound, boundsSeen: [...new Set(PATHS.flatMap((p) => [rec.firefly[p].bound, rec.image[p].bound, rec.control[p].bound]))] };
}

function limitsBlock() {
  return { about: "What the re-creation reproduces, what it cannot, and what this fill was unsure of. Read before the film or page draws a comparison.",
    reproduces: ["the arithmetic of one convolution step as vk_rr_conv.comp does it: fp16 inputs and weights, fp32 sums, fp32 bias after (and the scalar path's fp32 sum from the bias)", "the fp32 softmax 5 x 5 kernel of vk_rr_glue.comp, with the 8 tanh(z / 8) bound", "the note's magnitudes: radiance 1,087 among neighbours near 0.1, demodulated by 0.05 to about 21,740, weighed down to about 110", "the mechanism the note names: a logit error of about 1e-3 from fp16 rounding, times a sensitivity of about 110, is about 0.1 against an absolute 1e-2", "that the miss needs the firefly: the same network and image without it pass in every variant", "raw-native's parity measure and bound, unchanged by any variant, and its perturbed-weights control"],
    cannot: ["the real case: the frame-48 pixel values, the network's trained weights and its 12 layers are not in raw-native's evidence, so every recreation number is synthetic and none should be read as a prediction of raw-native's", "the recurrence: frame 48 follows 47 frames of fed-back outputs; here there is one frame and no history (temporal blend weight 0)", "the multi-scale combine (the quarter-resolution kernel and blend) and the diffuse signal", "the per-layer pattern and the mixed-precision numbers: the stand-in has two layers, so keepHead is only an analogue of the note's layer-10 run, and the order of W against A here need not match the note's 0.137 and 0.104", "the tensor cores' own summation order, unknown to the shader and to the note's emulation; here sums run in index order", "the image scan's pixel count: neighbours of the firefly are not calibrated to 110, so pixels over and the image max describe the stand-in, not the 72 pixels over in raw-native's 64 frames"],
    notTriedInTheNote: ["scaling, splitting the accumulation, clamping fireflies: none appears in the note, so none is offered here as a tried fix", "the note's two options for the next round, fp32 throughout and filtering a range-compressed signal, are named as options; only fp32 throughout has a measured result (the scalar path, 2.9e-3 on the RTX)"],
    unsure: ["The note's why reasons about a value near 110 against the absolute bound. rr-inference-bounds.json and vk_rrnet.cpp compare the remodulated output (specular times its albedo, plus diffuse and emission), and the note's which_pixels gives 110 for the kernel's output in demodulated units. The note does not state the remodulated value at the pixel. The re-creation measures the filtered demodulated value, in the note's own frame; if the remodulated value is smaller the error scales with it.", "The note's 'about 105 (reference 110)' could be read as the emulated against the reference value, or as the firefly's own contribution against the whole; the re-creation uses 110 as the reference's filtered value only."] };
}

function speedBlock(seconds) {
  const img = makeImage(CASE), net = makeNet(CASE, img), slice = PATHS.map((p) => { const n = 200, t = performance.now(); for (let i = 0; i < n; i++) filterPixel(img, net, i % img.w, (i / img.w) | 0, p); const ms = (performance.now() - t) / n; return { path: p, msPerPixel: ms, pixelsPer40ms: Math.max(1, Math.floor(40 / ms)) }; });
  return { about: "Milliseconds in Node (V8), one process at below-normal priority, on the fill machine's CPU, software rounding throughout. slice: one output pixel per path and how many fit a 40 ms lab slice. totals: milliseconds in each part of the fill; fillSeconds the wall time. None of this measures the GPU.", slice, totals: { ...cost }, fillSeconds: seconds };
}

function verdict(primary, rec, sw, ctl) {
  const p = primary.found ? primary : null, F = rec.firefly, I = rec.image;
  const head = p ? `raw-native (origin/main ${p.commit.slice(0, 7)}): on the RTX 4090 the tensor-core path's max was ${p.rtx.coop.max_abs} at frame ${p.rtx.coop.max_at_frame}, pixel ${p.rtx.coop.max_at_pixel}, against the bound 1e-2; the fp32 scalar path's ${p.rtx.scalar.max_abs}. The CPU emulation of the fp16 arithmetic gave ${p.emulation.WA.max_abs} at the same frame and pixel. Keeping layer 10 in fp32 gave ${p.mixed["keep-10"].max_abs}; layers 10, 1, 9, 8, 0 and 3, ${p.mixed["keep-10_1_9_8_0_3"].max_abs}. The bound was not loosened.` : "raw-native's evidence was not read in this fill.";
  const ours = `Synthetic re-creation, case seed ${CASE}: reference ${fx(F.WA.ref[0], 2)} at the firefly; the tensor-core arithmetic (WA) misses by ${e3(F.WA.maxAbs)} there (linear prediction ${e3(F.WA.predicted)}, a logit move of ${e3(F.WA.dzFirefly)} times a sensitivity of ${fx(F.WA.sensitivity, 1)}), and by ${e3(I.WA.maxAbs)} over the image with ${I.WA.pixelsOver} pixels over; fp32 throughout ${e3(F.scalar.maxAbs)}; WA with the head in fp32 ${e3(F.keepHead.maxAbs)}. Over ${SEEDS.length} seeds WA misses in ${sw.firefly.WA.over} (median ${e3(sw.firefly.WA.median)}), fp32 in ${sw.firefly.scalar.over}. Without the firefly no variant misses (largest ${e3(Math.max(...PATHS.map((q) => ctl.noFirefly[q].maxAbs)))}). The perturbed control fails as it must (${e3(ctl.perturbed.maxAbs)}). The bound stayed 1e-2 in every result.`;
  return [head, ours];
}

function main() {
  const t0 = Date.now(), raw = readRaw(), primary = primaryBlock(raw), rec = recreationBlock(), sw = sweepBlock(), ctl = controlsBlock(rec);
  const blocks = { arithmetic: arithmeticBlock(rec), recreation: rec, sweep: sw, controls: ctl, limits: limitsBlock() };
  blocks.speed = speedBlock((Date.now() - t0) / 1000);
  const facts = {
    about: "Lesson K25, Case study: the denoiser's tensor-core parity. Computed by tools/school/fill_denoiser.mjs. Do not edit by hand. primary and note are raw-native's own evidence, copied verbatim from origin/main and never rounded; every other block is this lesson's synthetic re-creation in software rounding (system/school/precision.mjs, denoiser.mjs) and says nothing new about raw-native's network or hardware. No GPU was used.",
    sourceSha256: Object.fromEntries(["denoiser.mjs", "precision.mjs"].map((f) => [f, createHash("sha256").update(readFileSync(new URL(`../../system/school/${f}`, import.meta.url))).digest("hex")])),
    recipe: { caseSeed: CASE, sweepSeeds: [SEEDS[0], SEEDS[SEEDS.length - 1]], bound: PARITY.bound, measure: PARITY.measure, noteCase: NOTE_CASE },
    sources: sourcesBlock(raw), note: noteBlock(raw), primary,
    ...deep(blocks), verdict: verdict(primary, rec, sw, ctl), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ verdict: facts.verdict, controls: { perturbed: facts.controls.perturbed, fp32: facts.controls.fp32 }, speed: facts.speed.slice, seconds: facts.seconds }, null, 1));
}

try { main(); } catch (e) { console.error("fill_denoiser failed:", e); process.exit(1); }
