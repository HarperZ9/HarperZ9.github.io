// Report helpers for lesson K24: what the sources state, and the reading of
// the raw-native evidence note that lesson K25's arithmetic starts from.
import { FORMATS, precisionNear, bitsNeeded, roundTo } from "../../system/school/precision.mjs";

export function sourcesBlock() {
  return {
    about: "What the sources state, read for this lesson, and where each was read. Every number in the other blocks is this lesson's own computation on its own code and on the attention lab's 20,864-number model; none of it says anything about the sources' models or hardware.",
    ieee754: {
      cite: "IEEE Std 754-2019, IEEE Standard for Floating-Point Arithmetic",
      read: "Not read: the standard is paywalled. The binary16 parameters used here (p 11, emax 15, emin -14, bias 15, a 5-bit exponent field) were checked against the binary interchange format parameters in ISO/IEC TS 18661-3 (WG14 draft N2342, section X.2.1), against Micikevicius and others section 3.2 (normalised fp16 exponents in [-14, 15]), and against Math.f16round (ECMAScript 2025) on 200,000 random float32 values and on every one of the 65,536 fp16 bit patterns (precision.test.mjs). No table or clause number of the standard is cited.",
      uses: ["binary16 (fp16) and binary32 (fp32) interchange formats", "round to nearest, ties to even, as the default rounding", "gradual underflow (subnormals) and overflow to infinity"],
    },
    bfloat16: {
      cite: "Google Cloud blog, BFloat16: The secret to high performance on Cloud TPUs (23 August 2019); Intel, BFLOAT16 Hardware Numerics Definition, white paper 338302-001US rev 1.0 (November 2018)",
      claims: ["Google: one sign bit, eight exponent bits and seven mantissa bits; the dynamic range is that of fp32; bfloat16 for the multiplication and fp32 for accumulation (read as a page summary, moderate confidence)", "Intel section 1.1: a short version of fp32 that skips the 16 least significant mantissa bits; FP32 accumulation after the multiply is essential", "Intel section 1.2.2: most of their numerical experiments converted fp32 to bf16 by truncation; round to nearest even can be slightly better. So round to nearest even, used here, is a choice the sources recommend, not one they mandate"],
    },
    micikevicius2018: {
      cite: "Micikevicius and others, Mixed Precision Training, ICLR 2018, arXiv:1710.03740",
      claims: ["section 3.1: an fp32 master copy of the weights is updated by the optimiser; an fp16 copy is used in the forward and backward passes; values below 2^-24 become zero in fp16, and about 5 percent of one speech model's weight gradients are that small (Figure 2b)", "section 3.2: scale the loss before back-propagation and unscale the weight gradients before the update; Figure 3 (activation gradients of Multibox SSD, from fp32 training): 67 percent of values are zero", "section 3.3: some networks need fp16 dot products to accumulate partial products into an fp32 value, converted to fp16 before writing to memory; without it some fp16 models did not match the baseline", "section 3.3: large reductions (batch normalisation, softmax) in fp32; Tensor Cores multiply fp16 matrices and accumulate into fp16 or fp32 outputs"],
      here: "Inference only: no training, no loss scaling, no master weights. The model's weights and activations are rounded to fp16 or bf16 and the accumulators are fp32 or the narrow format.",
    },
    nvidia: {
      cudaGuide: { cite: "NVIDIA CUDA Programming Guide 13.4.2 (page updated 10 September 2026), section 5.4.11 Warp Matrix Functions", claims: ["5.4.11.1: Tensor Cores accelerate D = A * B + C", "5.4.11.6 Element Types and Matrix Sizes: __half inputs with a float (or __half) accumulator; __nv_bfloat16 inputs with a float accumulator, 16 x 16 x 16", "5.4.11.2 Alternate Floating Point: __nv_bfloat16 fragments must be composed with float accumulators; bf16 has the range of f32 with 7 bits of precision; compute capability 8.0 and higher"] },
      v100: { cite: "NVIDIA Tesla V100 GPU Architecture whitepaper WP-08608-001 v1.1 (August 2017), section Tensor Cores (read from a mirror, not NVIDIA's host)", claims: ["each Tensor Core performs D = A x B + C on 4 x 4 matrices", "A and B are fp16; C and D may be fp16 or fp32", "the fp16 multiply gives a full-precision product that is accumulated with fp32 addition; 64 fp16 FMA operations per clock per Tensor Core"] },
      mixedPrecisionGuide: { cite: "NVIDIA Deep Learning Performance, Train With Mixed Precision (updated 1 February 2023), section 2.2 Tensor Core Math", claims: ["Tensor Core math can accumulate half precision products into either single or half precision outputs (read as a page summary, moderate confidence)"] },
      here: "The emulation's fp32-accumulate mode follows the V100 whitepaper's description: products of two fp16 (or bf16) numbers are exact, and each is added with one fp32 rounding. The order of additions inside a real Tensor Core is not documented in these sources, so bit-for-bit agreement with hardware is not claimed.",
    },
  };
}

// The raw-native note, read from git (raw-native main, where it is public), and the
// arithmetic K25 needs, computed here.
export function near110Block(note) {
  const x = 110, rel = 1e-4, fmts = ["fp16", "bf16", "fp32"], at = Object.fromEntries(fmts.map((f) => [f, precisionNear(x, FORMATS[f])]));
  const absBound = 1e-2;
  return {
    about: "The arithmetic lesson K25 starts from, computed here (the case study itself is not this lesson's). A value near 110 lies in [64, 128), where fp16's spacing is 2^(6 - 10) = 2^-4 = 0.0625, bf16's 2^(6 - 7) = 0.5 and fp32's 2^(6 - 23). spacingRel is the spacing over 110; worstRel is half the spacing over 110, the most one rounding to nearest can move it, relative. bitsNeeded: the smallest significand width p (hidden bit included) whose worst rounding near 110 is at most 1e-4 of the value. absolute: one rounding's worst move against the note's absolute bound of 1e-2. note: what the raw-native evidence note states, quoted from its own fields; it is read only, and nothing here re-runs or extends it.",
    value: x, requiredRel: rel, ...at, bitsNeeded: bitsNeeded(x, rel), fp16Has: FORMATS.fp16.p, roundedTo: Object.fromEntries(fmts.map((f) => [f, roundTo(x, FORMATS[f])])),
    absolute: { bound: absBound, fp16WorstMove: at.fp16.spacing / 2, overBound: at.fp16.spacing / 2 / absBound, bf16WorstMove: at.bf16.spacing / 2, fp32WorstMove: at.fp32.spacing / 2 },
    note,
    verdict: `Near 110, fp16's spacing is ${at.fp16.spacing} (${at.fp16.spacingRel.toExponential(3)} of the value) and one rounding moves a value by at most ${at.fp16.spacing / 2} (${at.fp16.worstRel.toExponential(3)}): ${(at.fp16.worstRel / rel).toFixed(2)} times the 1e-4 the note asks for, and ${(at.fp16.spacing / 2 / absBound).toFixed(3)} times its absolute bound of 1e-2. A ${bitsNeeded(x, rel)}-bit significand is the first that meets 1e-4 near 110; fp16 has ${FORMATS.fp16.p}, bf16 ${FORMATS.bf16.p}, fp32 ${FORMATS.fp32.p}. bf16's worst move near 110 is ${at.bf16.spacing / 2}. The note's "about 1e-3" for fp16 near 110 is an order of magnitude: the exact figures are ${at.fp16.spacingRel.toExponential(2)} (spacing) and ${at.fp16.worstRel.toExponential(2)} (worst rounding), and fp16's unit roundoff, the worst relative rounding error, reached just above a power of two, is 2^-11 = ${FORMATS.fp16.u.toExponential(2)}.`,
  };
}

// The fields of the evidence note this lesson relies on, verbatim.
export function readNote(json, where) {
  if (!json) return { found: false, where, about: "The note was not readable when this fill ran; nothing from it is used." };
  const n = JSON.parse(json);
  return { found: true, where, schema: n.schema, written: n.written, about: n.about, what_the_path_does: n.what_the_path_does, why: n.results?.why, agreement_with_the_gpu: n.results?.agreement_with_the_gpu, hypothesis: n.results?.hypothesis, does_not_prove: n.does_not_prove,
    notClaimedHere: "This lesson checks only the rounding arithmetic near 110. Whether fp16 rounding explains the hardware miss is the note's finding, made with PyTorch on a CPU against its own GPU run; this lesson neither repeats nor extends it." };
}
