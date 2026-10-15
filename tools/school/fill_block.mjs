// Fill lesson L11's numbers ("The transformer block") so no number in the
// film or lab is typed by hand. Writes media/school/block/facts.json.
//
//   node tools/school/fill_block.mjs [media/school/attention/model.json] [media/school/block]
//
// Reads the attention lab's trained model, re-runs its forward pass with
// hooks (system/school/block.mjs) on the corpus's held-out rows, and scores
// knockouts of every attention layer, head and MLP. The same network at its
// starting weights is the control. About 10 seconds on one core.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { paramCounts, streamStats, logitLens, ablations, knockoutList } from "../../system/school/block.mjs";
import { fromJSON, createModel, evaluate } from "../../system/school/tinyformer.mjs";
import { heldOut } from "../../system/school/corpus.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const t0 = Date.now();
const modelPath = process.argv[2] || "media/school/attention/model.json";
const outDir = process.argv[3] || "media/school/block";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8"));
const round = (v, k = 4) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 10 ** k) / 10 ** k : v);
const r = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v)]));

const model = fromJSON(M.weights), untrained = createModel(M.weights.config, M.seed);
const held = heldOut(M.heldOutRows, M.config.ctx), N = held.y.length;
const ev = evaluate(model, held), nCopy = ev.nCopy, nLocal = ev.nLocal;
const c = model.config;
const HELD = `${held.batch} held-out rows of ${held.ctx} positions (${N} next-word targets: ${nCopy} look-back 'copy' targets, ${nLocal} 'local' targets), drawn from the corpus generator with the held-out seed, a separate stream from training`;

// ---- parameters ----
const counts = paramCounts(model);
const params = {
  about: `Parameter counts by part, read off the weight tensors. embeddings: word table (${c.vocab} x ${c.dModel}) plus position table (${c.ctx} x ${c.dModel}). attention: per layer the query, key and value matrix (${c.dModel} x ${3 * c.dModel}) with its bias and the output projection (${c.dModel} x ${c.dModel}) with its bias. mlp: per layer ${c.dModel} to ${c.dFF} and back, with biases, GELU in between. norms: gain and bias of two layer norms per layer plus the final one. output: the readout matrix (${c.dModel} x ${c.vocab}), not tied to the word table. A count of parameters says nothing about which ones matter; the knockouts measure that.`,
  counts, shares: Object.fromEntries(Object.entries(counts).filter(([k]) => k !== "total").map(([k, v]) => [k, round(v / counts.total)])),
  config: { dModel: c.dModel, nHeads: c.nHeads, headDim: c.dModel / c.nHeads, nLayers: c.nLayers, dFF: c.dFF, ctx: c.ctx, vocab: c.vocab },
};

// ---- the stream ----
const statsOf = (m) => { const s = streamStats(m, held); return { steps: s.steps.map(r), adds: s.adds.map(r) }; };
const stream = {
  about: `The residual stream is a ${c.dModel}-number vector per position that every sub-layer reads (through its own layer norm) and adds to. steps: mean over the ${N} held-out positions of the stream's L2 norm after the embedding and after each sub-layer's add. adds: for each sub-layer, the mean L2 norm of what it added, the mean per-position ratio of that norm to the norm of the stream it was added to, and the mean cosine between the two (0: a new direction; 1: the same direction, only longer). untrained is the same network at its starting weights (seed ${M.seed}), the control. One trained model and one held-out set: norms show where the stream grows in this network, not a law of transformers.`,
  trained: statsOf(model), untrained: statsOf(untrained),
};

// ---- logit lens ----
const lensOf = (m, o) => logitLens(m, held, o).map(r);
const lens = {
  about: `Logit lens (nostalgebraist 2020, a blog post, not a peer-reviewed paper): apply the model's final layer norm and output matrix to the stream after each sub-step, as if the network ended there, and score those predictions on the ${N} held-out targets. loss in nats; top1 is the share of targets that are the first choice; copy and local split the targets as the corpus labels them. The last row is the model's real output (equal to its evaluated loss, ${round(ev.loss, 6)}). normOnly skips the final norm's learned gain and bias. untrained is the control. The readout was trained only on the last stream, so an early row measures what that readout can decode from an earlier stream; a poor score there does not prove the information is absent.`,
  trained: lensOf(model), normOnly: lensOf(model, { normOnly: true }), untrained: lensOf(untrained),
};

// ---- knockouts ----
const tableOf = (m, list) => { const a = ablations(m, held, list); return { base: r(a.base), rows: a.rows.map(r) }; };
const listAll = knockoutList(model);
const abl = tableOf(model, listAll.filter((k) => k.mode !== "replace"));
const ablU = tableOf(untrained, listAll.filter((k) => k.mode !== "replace"));
const ablations_ = {
  about: `Knockouts on ${HELD}. Each row removes one part and scores the whole network: l<L>.attn is layer L's attention sub-layer output, l<L>.h<H> is one head's ${c.dModel / c.nHeads}-number slice of the attention output before the output projection, l<L>.mlp is layer L's MLP output, all.attn and all.mlp remove that sub-layer in every layer. Modes: zero replaces it with zeros; mean with its average over all held-out positions; shuffle with the value the same part produced at the same position of the next held-out row (real activations, wrong context). dLoss is the change in held-out loss. Zero knockouts are checked in the tests against zeroing the matching weights. The untrained network is the control: its knockouts should move nothing. Single knockouts on one model: a part whose removal costs little may still matter when another part is also gone, and these numbers do not show how a part does its job.`,
  trained: abl, untrained: ablU,
};

// ---- the residual connection ----
const repl = (m) => tableOf(m, listAll.filter((k) => k.mode === "replace"));
const residual = {
  about: `What the residual add does, measured: each row runs the network with one sub-layer's output replacing the stream instead of being added to it (no residual connection around that one sub-layer, everything else intact), on ${HELD}. Compare with the zero knockout of the same sub-layer (no output, residual kept). Where a sub-layer's output is much larger than the stream it joins (see the stream section), replacing and adding give nearly the same stream, so dropping that one residual connection costs little. Trained once with the residual connections in place: this does not show how a network trained without them would do.`,
  trained: repl(model), untrained: repl(untrained),
  zeroForComparison: abl.rows.filter((x) => x.mode === "zero" && !x.name.startsWith("all") && !/h\d$/.test(x.name)),
};

const cites = {
  about: "What the code does, checked against the papers. The block follows the GPT-2 arrangement, not the original: Vaswani et al. 2017 (arXiv 1706.03762) put the layer norm after the residual add, LayerNorm(x + Sublayer(x)); Radford et al. 2019 (GPT-2 report) moved layer norm to the input of each sub-block and added one after the final block, which is what this model does (h + Sublayer(LN(h)), then a final LN). Other differences from Vaswani et al.: GELU in place of ReLU, an MLP width of 2 x dModel (theirs is 4 x, 2048 for 512), learned position embeddings (they used sines and cosines, and report learned ones gave nearly identical results), and an output matrix not shared with the word table (they share it). Residual output projections start smaller by 1/sqrt(2 x layers), the GPT-2 report's 1/sqrt(N) with N residual layers.",
  vaswani2017: "arXiv 1706.03762", radford2019: "Language Models are Unsupervised Multitask Learners (OpenAI report)", nostalgebraist2020: "interpreting GPT: the logit lens (LessWrong blog post, 31 August 2020)",
};

const facts = {
  about: "Lesson L11, the transformer block. Computed by tools/school/fill_block.mjs from system/school/block.mjs and the attention lab's trained model. Do not edit by hand. Losses are in nats (natural log).",
  modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
  model: { seed: M.seed, dataSeed: M.dataSeed, steps: M.steps, heldOutSeed: M.heldOutSeed, heldOutRows: M.heldOutRows, positions: N, nCopy, nLocal, evaluateLoss: round(ev.loss, 6) },
  baselines: M.baselines, params, stream, lens, ablations: ablations_, residual, cites, seconds: 0,
};
facts.seconds = round((Date.now() - t0) / 1000, 2);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
const line = (x) => `${x.name.padEnd(9)} ${x.mode.padEnd(8)} loss ${x.loss} copy ${x.copyAccuracy} local ${x.localAccuracy}`;
console.log(JSON.stringify({ counts, stream: stream.trained, lens: lens.trained.map((x) => `${x.at} ${x.loss} t1 ${x.top1} copy ${x.copyAccuracy}`), seconds: facts.seconds }, null, 1));
console.log([`base ${JSON.stringify(abl.base)}`, ...abl.rows.map(line), ...residual.trained.rows.map(line)].join("\n"));
