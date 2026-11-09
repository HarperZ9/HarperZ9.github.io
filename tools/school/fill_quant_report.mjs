// Report helpers for lesson S18: what the cited papers claim, and the
// verdict lines, written from the numbers.
import { round } from "./fill_gaming_report.mjs";

export const fx = (v, k = 3) => (Number.isFinite(v) ? String(round(v, k)) : "n/a");
export const iv = (s, k = 4) => `${fx(s.value, k)} [${fx(s.lo, k)}, ${fx(s.hi, k)}]`;
export const dv = (s, k = 4) => `${s.diff >= 0 ? "+" : ""}${fx(s.diff, k)} [${fx(s.diffLo, k)}, ${fx(s.diffHi, k)}]`;
export const resolved = (s) => s.diffLo > 0 || s.diffHi < 0;

export function sourcesBlock() {
  return {
    about: "What the cited papers claim, read for this lesson, and how this lesson differs. Every number in the other blocks is this lesson's own measurement on a 20,864-number model; none of it says anything about the papers' models.",
    jacob2018: {
      cite: "Jacob and others, Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference, CVPR 2018, arXiv:1712.05877",
      claims: ["section 2.1: an affine map r = S(q - Z) from integers q to reals r, with scale S and zero point Z", "one set of quantisation parameters per weights array and per activations array", "Z is the integer for the real 0, so 0 is exactly representable (needed for zero padding)", "8-bit weights and activations with a 32-bit integer accumulator; biases as 32-bit integers (section 2.4)", "inference in integer-only arithmetic, plus training that simulates quantisation"],
      here: "Symmetric codes (Z = 0, so 0 is exact here too) and float arithmetic after dequantising; per-tensor scale is the paper's granularity. No integer-only inference, no activation quantisation, no quantisation-aware training.",
    },
    dettmers2022: {
      cite: "Dettmers and others, LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale, NeurIPS 2022, arXiv:2208.07339",
      claims: ["outliers are in the hidden states (activations) that enter the matrix multiplications, not in the weights", "outlier features with magnitudes up to 20x larger than other dimensions first appear in about 25 percent of transformer layers and, around 6.7B parameters, in all layers", "an outlier is a feature of magnitude at least 6.0 that affects at least 25 percent of layers and 6 percent of sequence positions", "vector-wise quantisation (one scale per row of the input and per column of the weight) plus a 16-bit matrix multiply for the outlier dimensions (about 0.1 percent of feature dimensions); more than 99.9 percent of values are multiplied in 8 bits"],
      here: "Activations stay float32, so the paper's mechanism is not exercised. damage.activations reports the same magnitude test (|x| >= 6) on this model's matrix inputs as a reading, and damage.tensors reports the weight-side analogue (largest weight over the tensor's root mean square).",
    },
    frantar2023: {
      cite: "Frantar, Ashkboos, Hoefler and Alistarh, GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers, ICLR 2023, arXiv:2210.17323",
      claims: ["Algorithm 1: quantise the weight columns (inputs) in a fixed order, after each one update the not-yet-quantised weights with the inverse-Hessian information, H = 2 X X^T", "dampening of 1 percent of the average diagonal of H; the Cholesky form of H^-1 for numerical stability", "lazy batch updates in blocks of B = 128 columns, a speed device", "calibration: 128 random 2048-token segments of C4; layers quantised in sequence on the inputs of the partially quantised model", "RTN baseline: asymmetric per-row grid; at 4 bits GPTQ loses 0.03 perplexity on OPT-175B where RTN loses 2.2; at 3 bits RTN collapses", "grouping combines well with GPTQ: group parameters set from the current updated weights; 175B models quantised in about four GPU hours"],
      here: "Implemented: Algorithm 1 with the 1 percent dampening and the Cholesky factor, layers in forward order on the partially quantised model, groups set from the updated weights. Every matrix here has at most 64 inputs, so one 128-wide block holds a whole matrix and lazy batching changes nothing. Differences: a symmetric grid (the paper's is asymmetric), 128 calibration rows of 24 words from the training generator, the embeddings by RTN (they are looked up, not multiplied).",
    },
  };
}

export function schemeVerdicts(rows, float) {
  const at = (method, bits, scheme) => rows.find((r) => r.method === method && r.bits === bits && r.scheme === scheme);
  const line = (method, scheme) => `${method} ${scheme}: ${[8, 6, 4, 3, 2].map((b) => `${b} bits ${fx(at(method, b, scheme).loss.value)}`).join(", ")}`;
  const lost = rows.filter((r) => r.method === "rtn" && resolved(r.loss) && r.loss.diff > 0).map((r) => `${r.bits}/${r.scheme}`);
  const g4 = at("gptq", 4, "channel"), r4 = at("rtn", 4, "channel"), g2 = at("gptq", 2, "tensor"), r2 = at("rtn", 2, "tensor");
  return [
    `Float32 held-out loss ${iv(float.loss)} nats, look-back accuracy ${iv(float.lookback)}; ${float.bytes} bytes.`,
    `Loss by bits: ${line("rtn", "tensor")}; ${line("rtn", "channel")}; ${line("rtn", "group32")}; ${line("gptq", "channel")}.`,
    `At 8 bits every scheme is within ${fx(Math.max(...rows.filter((r) => r.bits === 8).map((r) => Math.abs(r.loss.diff))), 4)} nats of float (RTN per tensor, ${fx(at("rtn", 8, "tensor").bytes.ratio)} of the float32 bytes). RTN cells whose loss rise is resolved (interval above 0): ${lost.join(", ")}.`,
    `At 4 bits per channel: RTN ${dv(r4.loss)}, GPTQ ${dv(g4.loss)} nats over float, ${fx(g4.bytes.ratio)} of the bytes; look-back accuracy RTN ${iv(r4.lookback)}, GPTQ ${iv(g4.lookback)}.`,
    `GPTQ is not always better: at 2 bits per tensor RTN ${fx(r2.loss.value)} and GPTQ ${fx(g2.loss.value)}; both are broken.`,
  ];
}

export function sensitivityVerdict(rows) {
  const by = (bits) => rows.filter((r) => r.bits === bits).sort((a, b) => b.loss.diff - a.loss.diff);
  const top = (bits) => by(bits).slice(0, 3).map((r) => `${r.name} ${dv(r.loss)}`).join(", ");
  const unresolved = by(4).filter((r) => !resolved(r.loss)).map((r) => r.name);
  return [`One tensor at 4 bits per tensor, the rest float: the largest loss rises are ${top(4)}; ${unresolved.length} of ${by(4).length} are not resolved from zero (${unresolved.join(", ") || "none"}).`, `At 3 bits: ${top(3)}.`];
}
