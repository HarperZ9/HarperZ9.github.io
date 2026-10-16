// The facts.json sections of lesson S19 ("LoRA and fine-tuning"), built from
// the runs of tools/school/fill_lora.mjs. Split out to keep each file short.
import { decode } from "../../system/school/corpus.mjs";
import { taskHeld, FILLERS } from "../../system/school/lora-task.mjs";
import { singularValues } from "../../system/school/lora-measure.mjs";

const stat = (spread, vals) => { const s = spread(vals); return { values: vals, mean: s.mean, sd: s.sd, min: s.min, max: s.max }; };

function methodRow(c, m) {
  const rs = c.runs(m), st = (f) => stat(c.spread, rs.map(f));
  return {
    method: c.METHODS[m], lr: c.chosen[m], lrAtGridEdge: c.chosen[m] === c.LRS[0] || c.chosen[m] === c.LRS.at(-1), validLossByLr: Object.fromEntries(c.LRS.map((lr) => [lr, c.sweep[`${m}|${lr}|1`].valid])),
    trained: rs[0].trained, shareOfFull: rs[0].trained / c.M.nParams,
    taskLoss: st((r) => r.end.task.loss), taskExcess: st((r) => r.end.task.excess), taskAccuracy: st((r) => r.end.task.accuracy),
    answer: st((r) => r.end.task.answer), repeatThing: st((r) => r.end.task.repeatThing),
    origLoss: st((r) => r.end.orig.loss), origCopy: st((r) => r.end.orig.copyAccuracy),
    curveSeed1: rs[0].curve.map((p) => ({ step: p.step, taskLoss: p.task.loss, answer: p.task.answer, origLoss: p.orig.loss, origCopy: p.orig.copyAccuracy })),
  };
}

function spectraBlock(c) {
  const full = c.runs("full");
  return c.ALL_MATS.map((name, i) => {
    const per = full.map((r) => r.spectra[i]), st = (f) => stat(c.spread, per.map(f));
    return { name, shape: c.shape(name), frobenius: st((p) => p.frobenius), top1: st((p) => p.top[1]), top2: st((p) => p.top[2]), top4: st((p) => p.top[4]), top8: st((p) => p.top[8]), for90: per.map((p) => p.for90), singularSeed1: per[0].singular };
  });
}

export function sections(c) {
  const { extras: x, STEPS, SEEDS, ROWS } = c, b = x.refs.base, t = b.task, rows = Object.keys(c.METHODS).map((m) => [m, methodRow(c, m)]);
  const R = Object.fromEntries(rows), full = c.runs("full"), example = taskHeld(1, c.C.ctx);
  const trunc = [1, 2, 4, 8].map((k, i) => ({ rank: k, taskLoss: stat(c.spread, full.map((r) => r.truncated[i].task.loss)), answer: stat(c.spread, full.map((r) => r.truncated[i].task.answer)) }));
  return {
    recipe: { steps: STEPS, seeds: SEEDS, batch: c.M.batch, lrs: c.LRS, alpha: c.ALPHA, weightDecay: 0, taskRows: ROWS, origRows: c.M.heldOutRows, checkpoints: [0, ...c.AT, STEPS], lora: "W_eff = W + (alpha / r) A B, A [inputs, r] uniform in +-1/sqrt(inputs), B [r, outputs] zero" },
    task: { about: `The new task, "things keep their look": "the <thing> was <adjective> .", then 0 to 2 of the corpus's short guide sentences (${FILLERS.map((f) => f.join(" ")).join("; ")}), then the thing named again with the same adjective. The corpus's own distractor sentence draws a fresh adjective every time, so the base model has never seen a look kept. Every next word has exact odds by construction; floor is their loss on the task's own ${ROWS} held-out rows (${ROWS * c.C.ctx} targets), idealAccuracy what the exact odds would score (a word with 10 equal choices counts a tenth). answer is the repeated adjective (certain once the thing is named again); repeatThing is the repeated thing. A first design with two things described and one asked about was dropped: no method, full fine-tuning included, learned to tell the two apart in 5,000 steps (all stalled at half right on the answer), so it could not compare methods.`,
      floor: t.all.floor, idealAccuracy: t.all.idealAccuracy, rows: ROWS, exampleRow: decode(example.x.subarray(0, c.C.ctx)).join(" ") },
    base: { about: `The base model on the new task before any fine-tuning, and on the original ${c.M.heldOutRows} held-out rows of the corpus (origFloor is the corpus generator's own loss there). byRole splits the task score by word role.`,
      task: { loss: t.all.loss, excess: t.all.excess, accuracy: t.all.accuracy, answer: t.answer.accuracy, answerLoss: t.answer.loss, repeatThing: t.repeatThing.accuracy },
      byRole: t, orig: { loss: b.orig.loss, copyAccuracy: b.orig.copyAccuracy, accuracy: b.orig.accuracy }, origFloor: x.refs.origFloor },
    methods: { about: `Every method fine-tunes a copy of the base on fresh task rows (data seed 300 + seed) for ${STEPS} steps, batch ${c.M.batch}, AdamW with the lab's warmup and clipping and no weight decay (decay would add a full-rank shrink to the change measured in rank). lr was picked per method from ${c.LRS.join(", ")} on seed 1 by the task loss on 256 separate validation rows (validLossByLr); seeds 2 and 3 then ran at that rate. lrAtGridEdge marks a pick at the smallest or largest rate tried, where a better rate may lie outside the grid. Seeds change the data stream and, for LoRA, the random A. trained counts the numbers each method changes (the base has ${c.M.nParams}). lora.attn adapts the 4 attention projections, lora.all every dense matrix (attention, feed-forward, readout); both leave the embedding tables, biases and norms frozen. lastLayer trains layer 2's whole block, the final norm and the readout. Scored at the end on the task's held-out rows and the original held-out rows; mean, sd and range over ${SEEDS.length} seeds.`,
      runs: R },
    forgetting: { about: `What fine-tuning on the new task alone cost on the original corpus: loss and look-back (copy) accuracy on the ${c.M.heldOutRows} original held-out rows, before (the base) and after each method, mean over ${SEEDS.length} seeds. Training saw only task rows, so this is the worst case; mixing original rows into training was not tried.`,
      base: { loss: b.orig.loss, copyAccuracy: b.orig.copyAccuracy }, origFloor: x.refs.origFloor,
      methods: Object.fromEntries(rows.map(([m, r]) => [m, { origLoss: r.origLoss.mean, origCopy: r.origCopy.mean, lossRise: r.origLoss.mean - b.orig.loss }])) },
    rank: { about: `Hu et al.'s claim that the change a fine-tune makes has a low intrinsic rank, tested on the full fine-tune's change (fine-tuned minus base) of each dense matrix, ${SEEDS.length} seeds. topK is the share of the change's squared size (sum of squared singular values) held by its top K directions; for90 is how many directions hold 90 percent. randomBaseline is the same for a matrix of independent random entries of that shape: the shares a change with no low-rank structure would show. truncated scores the full fine-tune with each dense matrix's change cut to its best rank-K version (other numbers kept), on the task. summary sets each LoRA rank's task loss beside it. This tests the claim for this model and this task only.`,
      matrices: spectraBlock(c), randomBaseline: x.controls.randomBaseline, truncated: trunc,
      summary: [1, 2, 4, 8].map((k) => ({ rank: k, loraAttn: R[`lora.attn.r${k}`].taskLoss.mean, loraAll: R[`lora.all.r${k}`].taskLoss.mean, truncatedFull: trunc[k === 1 ? 0 : k === 2 ? 1 : k === 4 ? 2 : 3].taskLoss.mean, full: R.full.taskLoss.mean })) },
    controls: { about: `Controls. stepZero: with B zero the adapted model's logits on all ${ROWS} task rows equal the base's bit for bit, for attention and every-matrix adapters at rank 1 and 8. gradCheck: central finite differences of the loss in every entry of all ${x.controls.gradCheck.adapters} adapter tensors (every dense matrix, rank 2, a small float64 model with large random weights and a nonzero B), worst tensor-level relative error; broken reads B with the wrong transpose in dA, which the check must catch. rank0: an adapter with rank 0 has no numbers to train; 50 steps leave the task loss where it was.`,
      ...x.controls },
    speed: { about: "Milliseconds per fine-tuning step in Node (V8), one process, nothing else running, 40 steps after 5 warm-up. Every method runs the model's full backward pass (the adapter gradient is read off the full weight gradient), so LoRA saves optimiser memory and trained numbers here, not step time. inPool is the mean per-step time inside the fill's runs (4 processes at once). A browser lab running 40 ms slices fits about 40 / ms steps per slice.",
      msPerStep: x.speed, stepsPer40ms: Object.fromEntries(Object.entries(x.speed).map(([k, v]) => [k, Math.floor(40 / v)])), inPool: Object.fromEntries(Object.keys(c.METHODS).map((m) => [m, c.spread(c.runs(m).map((r) => r.msPerStep)).mean])) },
  };
}

// The film's planks: one attention matrix, picked as the one whose full
// fine-tune change (seed 1) is largest, with the base values, the change,
// the rank-1 adapter's vectors and the change's singular values.
export function film(c) {
  const f1 = c.runs("full")[0], r1 = c.runs("lora.attn.r1")[0];
  const size = (n) => Math.sqrt(f1.deltas[n].reduce((a, v) => a + v * v, 0));
  const pick = c.ATTN_MATS.reduce((b, n) => (size(n) > size(b) ? n : b), c.ATTN_MATS[0]), [K, Mm] = c.shape(pick);
  const spec = f1.spectra.find((s) => s.name === pick), ad = r1.rank1.mats[pick];
  return {
    about: `One matrix for the film: ${pick} (${K} inputs by ${Mm} outputs, stored row-major as [input][output]), the attention matrix whose change under full fine-tuning (seed 1) is largest by Frobenius norm (changeNorms lists all four). base is the pretrained matrix; fullChange is fine-tuned minus base; rank1 is the rank-1 adapter (lora.attn.r1, seed 1, lr ${c.chosen["lora.attn.r1"]}) on that matrix: A has one number per input, B one per output, and its change is s times A B (s = alpha / r = ${r1.rank1.s}). singular are all ${spec.dims} singular values of fullChange, largest first.`,
    matrix: pick, shape: [K, Mm], changeNorms: Object.fromEntries(c.ATTN_MATS.map((n) => [n, size(n)])),
    base: Array.from(c.BASE.params[pick]), fullChange: f1.deltas[pick], rank1: { s: r1.rank1.s, A: ad.A, B: ad.B },
    singular: fullSingular(f1.deltas[pick], K, Mm),
  };
}

const fullSingular = (d, K, M) => singularValues(Float64Array.from(d), K, M);
