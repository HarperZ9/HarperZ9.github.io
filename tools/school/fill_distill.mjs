// Fill lesson S17's numbers ("Distillation: a big teacher, a small student")
// so no number in the film or lab is typed by hand. Writes
// media/school/distill/facts.json.
//
//   node tools/school/fill_distill.mjs [media/school/attention/model.json] [media/school/distill]
//
// The teacher is the attention lab's trained model. Students of the same
// architecture at a smaller size train on the same rows for the same steps
// under each arm (hard labels, the teacher's argmax, the teacher's soft
// targets at T 1, 2, 4, 8, a half-and-half mix, the generator's exact odds,
// and an untrained teacher as a control), with full data and with a small
// fixed pool of rows, three student seeds each. Each run is a child process
// (at most 4 at once, below-normal priority).
//   node tools/school/fill_distill.mjs --job <name>    one run, JSON to stdout
// FILL_STEPS=<n> shortens every run for a smoke test.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { STUDENTS, studentSize, distillRun, heldReference, createDistiller, oddsAfter, tornShare, softmaxT, kdHead, kdGradCheck as kdGradCheckFn } from "../../system/school/distill.mjs";
import { createModel, fromJSON, forward, lossAndGrad, rng } from "../../system/school/tinyformer.mjs";
import { gauss } from "../../system/school/tinyformer-ops.mjs";
import { VOCAB, heldOut, makeBatch, encode, unigramCrossEntropy } from "../../system/school/corpus.mjs";
import { freshSource, poolSource } from "../../system/school/data.mjs";
import { paramCounts, spread } from "../../system/school/scaling.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const SELF = fileURLToPath(import.meta.url);
const jobAt = process.argv.indexOf("--job");
const modelPath = (jobAt < 0 && process.argv[2]) || "media/school/attention/model.json";
const outDir = (jobAt < 0 && process.argv[3]) || "media/school/distill";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8"));
const TEACHER = fromJSON(M.weights), V = M.config.vocab, CTX = M.config.ctx;
// 4 decimal places; a nonzero value under 1e-4 (a gradient-check error) keeps
// 3 significant digits instead of rounding to 0.
const round = (v, k = 4) => (typeof v !== "number" || Number.isInteger(v) ? v : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toPrecision(3)) : Math.round(v * 10 ** k) / 10 ** k);
const deep = (o) => (Array.isArray(o) ? o.map(deep) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)])) : round(o));

const STEPS = Number(process.env.FILL_STEPS) || M.steps, SEEDS = [1, 2, 3], MAIN = "d16x1", POOL_SMALL = 32, POOL_MID = 256;
const AT = [100, 250, 500, 1000, 1500].filter((s) => s < STEPS);
const PROBES = [["tallow", "found", "a"], ["rerun", "knocked"]];
// The film's main temperature. Set to 2, the middle of the sweep, after a
// first full run showed the sweep does not single one out: in the 32-row
// regime T 1, 2, 4 and 8 sit within each other's seed spread, and at full
// data none of T 1, 2, 4 differs from hard labels by more than the noise.
const MAIN_T = 2;
const ARMS = {
  hard: { kind: "hard" }, argmax: { kind: "argmax" },
  soft1: { kind: "soft", T: 1 }, soft2: { kind: "soft", T: 2 }, soft4: { kind: "soft", T: 4 }, soft8: { kind: "soft", T: 8 },
  mix2: { kind: "soft", T: 2, alpha: 0.5 }, oracle1: { kind: "oracle", T: 1 }, oracle2: { kind: "oracle", T: 2 },
  untrained2: { kind: "soft", T: 2, untrained: true },
};
const PLAN = [
  ["full", MAIN, ["hard", "argmax", "soft1", "soft2", "soft4", "soft8", "mix2", "oracle1", "oracle2", "untrained2"]],
  [`pool${POOL_SMALL}`, MAIN, ["hard", "argmax", "soft1", "soft2", "soft4", "soft8", "mix2", "oracle1", "oracle2"]],
  [`pool${POOL_MID}`, MAIN, ["hard", "argmax", "soft2", "oracle1"]],
  ["full", "d16x2", ["hard", "soft2"]], [`pool${POOL_SMALL}`, "d16x2", ["hard", "soft2"]],
];
const JOBS = [];
for (const [regime, student, arms] of PLAN) for (const arm of arms) for (const seed of SEEDS) JOBS.push(`${regime}.${student}.${arm}.${seed}`);

function sourceFor(regime, seed) {
  const base = { seed: 100 + seed, batch: M.batch, ctx: CTX };
  return regime === "full" ? freshSource(base) : poolSource({ ...base, seed: 200 + seed, rows: Number(regime.slice(4)) });
}

// The student's shares (T 1) after the probe contexts.
const sharesAfter = (model, words) => {
  const ids = encode(words), { logits } = forward(model, ids, 1, ids.length);
  return Array.from(softmaxT(new Float64Array(V), logits.subarray((ids.length - 1) * V), 1, V, 1));
};

function runJob(name) {
  const [regime, student, armName, seedS] = name.split("."), seed = Number(seedS), arm = ARMS[armName], t0 = Date.now();
  const teacher = arm.untrained ? createModel(M.config, M.seed) : TEACHER;
  const ref = heldReference(TEACHER, heldOut(M.heldOutRows, CTX));
  const r = distillRun({ config: STUDENTS[student], seed, teacher, arm, source: sourceFor(regime, seed), ref, steps: STEPS, at: AT, batch: M.batch, lr: M.lr });
  let best = r.curve[0];
  for (const p of r.curve) if (p.heldOut < best.heldOut) best = p;
  return { name, regime, student, arm: armName, seed, end: r.end, best: { step: best.step, heldOut: best.heldOut }, curve: r.curve, msPerStep: r.msPerStep, seconds: (Date.now() - t0) / 1000, shares: PROBES.map((w) => sharesAfter(r.student, w)) };
}

function child(name) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [SELF, "--job", name], { stdio: ["ignore", "pipe", "inherit"] });
    let s = "";
    p.stdout.on("data", (d) => { s += d; });
    p.on("close", (code) => (code === 0 ? resolve(JSON.parse(s)) : reject(new Error(`job ${name} exited ${code}`))));
  });
}

async function pool(names, limit) {
  const out = {}, queue = names.slice();
  const worker = async () => { while (queue.length) { const n = queue.shift(); out[n] = await child(n); console.error(`done ${n} in ${out[n].seconds.toFixed(1)} s`); } };
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

// Mean, sd and range over seeds, and paired differences against hard labels.
// "resolved": every seed's difference has the same sign and the mean is more
// than two standard errors of the paired differences away from zero.
const stat = (vals) => { const s = spread(vals); return { values: vals, mean: s.mean, sd: s.sd, min: s.min, max: s.max }; };
function paired(a, b) {
  const d = a.map((v, i) => v - b[i]), s = spread(d), se = s.sd / Math.sqrt(d.length);
  return { diffs: d, mean: s.mean, sd: s.sd, resolved: (d.every((v) => v > 0) || d.every((v) => v < 0)) && Math.abs(s.mean) > 2 * se };
}

function armSummary(J, regime, student, arm) {
  const runs = SEEDS.map((s) => J[`${regime}.${student}.${arm}.${s}`]), hard = SEEDS.map((s) => J[`${regime}.${student}.hard.${s}`]);
  const key = (rs, f) => rs.map(f);
  const out = { arm, ...ARMS[arm], seeds: SEEDS };
  for (const k of ["heldOut", "excess", "copyAccuracy", "agreement"]) out[k] = stat(key(runs, (r) => r.end[k]));
  out.bestHeldOut = stat(key(runs, (r) => r.best.heldOut));
  out.bestStep = key(runs, (r) => r.best.step);
  if (arm !== "hard") {
    out.vsHard = { heldOut: paired(key(runs, (r) => r.end.heldOut), key(hard, (r) => r.end.heldOut)), copyAccuracy: paired(key(runs, (r) => r.end.copyAccuracy), key(hard, (r) => r.end.copyAccuracy)), agreement: paired(key(runs, (r) => r.end.agreement), key(hard, (r) => r.end.agreement)), bestHeldOut: paired(key(runs, (r) => r.best.heldOut), key(hard, (r) => r.best.heldOut)) };
  }
  out.curveSeed1 = runs[0].curve.map((p) => ({ step: p.step, heldOut: p.heldOut, copyAccuracy: p.copyAccuracy, agreement: p.agreement }));
  return out;
}

const regimeBlock = (J, regime, student, arms) => Object.fromEntries(arms.map((a) => [a, armSummary(J, regime, student, a)]));

// Gradient check of the soft-target loss on a small float64 model with large
// random weights, the honest backward against the one missing the 1/T.
function gradControls() {
  const cfg = { dModel: 8, nHeads: 2, nLayers: 2, dFF: 16, ctx: 6, float64: true }, B = 2, T = cfg.ctx, N = B * T;
  const scrambled = (seed) => { const m = createModel(cfg, seed), r = rng(seed + 1000); for (const n of m.names) { const p = m.params[n], g = /_g$/.test(n); for (let i = 0; i < p.length; i++) p[i] = (g ? 1 : 0) + 0.4 * gauss(r); } return m; };
  const r = rng(3), target = new Float64Array(N * V);
  for (let n = 0; n < N; n++) { let s = 0; for (let v = 0; v < V; v++) { target[n * V + v] = r() ** 3; s += target[n * V + v]; } for (let v = 0; v < V; v++) target[n * V + v] /= s; }
  const { x, y } = makeBatch(rng(5), B, T), worst = (e) => Math.max(...Object.values(e));
  const ok = kdGradCheckFn(scrambled(3), kdHead(target, { T: 2, alpha: 0.7 }), x, y, B, T);
  const bad = kdGradCheckFn(scrambled(3), kdHead(target, { T: 2, alpha: 0.7, broken: true }), x, y, B, T);
  return { ok: worst(ok), broken: worst(bad), tensors: Object.keys(ok).length };
}

// Step times with nothing else running: hard labels, soft targets (a teacher
// forward pass plus the student step) and oracle targets, 40 steps each.
function speed() {
  const out = {};
  for (const [label, arm] of [["hard", ARMS.hard], ["soft", ARMS.soft2], ["oracle", ARMS.oracle1]]) {
    const d = createDistiller(createModel(STUDENTS[MAIN], 1), TEACHER, arm, freshSource({ seed: 101 }), { batch: M.batch });
    for (let i = 0; i < 5; i++) d.step();
    let ms = 0;
    for (let i = 0; i < 40; i++) ms += d.step().ms;
    out[label] = ms / 40;
  }
  return out;
}

function film(J, mainT) {
  const at = (w) => (T) => { const ids = encode(w), { logits } = forward(TEACHER, ids, 1, ids.length); return Array.from(softmaxT(new Float64Array(V), logits.subarray((ids.length - 1) * V), 1, V, T)); };
  return {
    about: `Share arrays for the film's wheels: for each context, 46 shares in vocabulary order (vocab). teacher.T1, T2 and T4 are the teacher's shares softened at that temperature; generator is the corpus generator's exact odds; studentHard and studentSoft are the main student (${MAIN}, seed 1, full data, ${STEPS} steps) after training on hard labels and on the teacher's soft targets at T ${mainT} (the main temperature, the middle of the sweep; the sweep does not single out one temperature, see temperature.vsT2).`,
    vocab: VOCAB, mainT,
    contexts: PROBES.map((w, i) => {
      const gen = new Array(V).fill(0);
      for (const o of oddsAfter(TEACHER, w, { minP: 0 })) gen[VOCAB.indexOf(o.word)] = o.generator;
      return { words: w, teacher: { T1: at(w)(1), T2: at(w)(2), T4: at(w)(4) }, generator: gen, studentHard: J[`full.${MAIN}.hard.1`].shares[i], studentSoft: J[`full.${MAIN}.soft${mainT}.1`].shares[i] };
    }),
  };
}

// One line per comparison, written from the numbers (no hand-typed verdicts).
function verdict(label, s) {
  const v = s.vsHard.heldOut, dir = v.mean < 0 ? "lower" : "higher";
  return `${label}: held-out loss ${round(s.heldOut.mean)} (sd ${round(s.heldOut.sd)}) against hard labels' ${round(s.heldOut.mean - v.mean)}; ${dir} by ${round(Math.abs(v.mean))} nats on average over ${SEEDS.length} paired seeds, ${v.resolved ? "resolved (every seed agrees in sign and the mean is over two standard errors)" : "not resolved (the seeds disagree in sign or the mean is within two standard errors)"}.`;
}

function sections(J, ref, extras) {
  const full = regimeBlock(J, "full", MAIN, PLAN[0][2]), small = regimeBlock(J, `pool${POOL_SMALL}`, MAIN, PLAN[1][2]), mid = regimeBlock(J, `pool${POOL_MID}`, MAIN, PLAN[2][2]);
  const temps = [1, 2, 4, 8], mainT = MAIN_T;
  const size = (k) => ({ config: STUDENTS[k], nParams: studentSize(STUDENTS[k]), nonEmbedding: paramCounts(STUDENTS[k]).nonEmbedding, shareOfTeacher: studentSize(STUDENTS[k]) / M.nParams });
  const torn = tornShare(ref.held, V), unigram = unigramCrossEntropy(makeBatch(rng(3), 1024, CTX), ref.held);
  const ho = (b, t) => b[`soft${t}`].heldOut.values;
  const tsec = (b) => temps.map((t) => ({ T: t, heldOut: b[`soft${t}`].heldOut, copyAccuracy: b[`soft${t}`].copyAccuracy, agreement: b[`soft${t}`].agreement, vsHard: b[`soft${t}`].vsHard.heldOut, vsT2: t === 2 ? null : paired(ho(b, t), ho(b, 2)) }));
  return [mainT, {
    teacher: { about: `The teacher is the attention lab's trained model (seed ${M.seed}, ${M.steps} steps), scored on the standard ${M.heldOutRows} held-out rows (${M.heldOutRows * CTX} next-word targets, seed ${M.heldOutSeed}). floor is the corpus generator's own loss on those rows (no model can beat it on average); excess is loss minus floor. unigramLoss is a word-count model fitted on 1,024 training rows: a model that ignores context.`,
      nParams: M.nParams, config: M.config, heldOut: ref.teacherScore.loss, floor: ref.floor, excess: ref.teacherScore.loss - ref.floor, copyAccuracy: ref.teacherScore.copyAccuracy, accuracy: ref.teacherScore.accuracy, unigramLoss: unigram },
    students: { about: `Students are the same architecture, smaller (feed-forward twice the width, two heads). The main student is ${MAIN}: the smallest tried, about a fifth of the teacher, and still able to learn the look-back skill, which leaves the most room between student and teacher. d16x2 (two layers) was run for hard labels and T 2 only, full data and the ${POOL_SMALL}-row pool, three seeds, as a check that the picture holds at another size. Same ${STEPS} steps, batch ${M.batch}, learning rate ${M.lr} with the lab's warmup, for every arm.`,
      main: MAIN, sizes: { d16x1: size("d16x1"), d16x2: size("d16x2") },
      d16x2: { full: regimeBlock(J, "full", "d16x2", ["hard", "soft2"]), [`pool${POOL_SMALL}`]: regimeBlock(J, `pool${POOL_SMALL}`, "d16x2", ["hard", "soft2"]) } },
    darkKnowledge: { about: "What a soft target carries that a hard label drops. The generator often leaves the next word open: on the held-out rows, torn is the share of positions where its most likely word has at most 0.75 of the probability, entropy its mean next-word entropy in nats. A hard label names one word; the soft target keeps the split. Probes: the generator's exact odds after a few contexts and the teacher's shares at T 1 (words above 0.02 in either).",
      positions: torn.positions, torn: torn.torn, entropy: torn.entropy,
      probes: [["rerun", "knocked"], ["tallow", "found", "a"], ["tallow"], ["the"], ["rerun", "found", "a", "kettle", "."]].map((w) => ({ words: w, odds: oddsAfter(TEACHER, w) })) },
    fullData: { about: `Fresh rows every step (data seed 100 + student seed), ${STEPS} steps, student seeds ${SEEDS.join(", ")}, scored at the end on the ${M.heldOutRows} held-out rows. heldOut and excess in nats; copyAccuracy is top-1 accuracy on look-back targets; agreement is the share of all held-out positions where the student's top word is the teacher's top word (on a 50/50 split the teacher's pick is arbitrary, so agreement there measures imitation, not skill). vsHard is the paired difference (arm minus hard labels, same seed and rows). mix2 is half soft (T 2) and half hard. oracle uses the generator's exact odds as the soft target. argmax trains on the teacher's single top word as if it were certain: on the many positions where the next word is open (darkKnowledge.torn) the student becomes sure of one word and pays a large loss whenever the text picks another, so its loss is high while its look-back accuracy and agreement with the teacher are high. This shows the effect for this teacher, this student and this data; it does not show what happens with a larger gap between teacher and student.`,
      arms: full, verdicts: ["soft1", "soft2", "soft4", "soft8", "mix2", "argmax", "oracle1"].map((a) => verdict(`full data, ${a}`, full[a])) },
    temperature: { about: `The temperature sweep (pure soft targets, alpha 1) side by side for full data and the ${POOL_SMALL}-row pool, three seeds each; vsHard is the paired difference in held-out loss. vsT2 is each temperature's paired difference from T 2 (same seeds and rows), with the same resolved rule. The film's main temperature is 2, the middle of the sweep: a first full run of this fill showed no temperature that stands clear of the others.`,
      mainT, full: tsec(full), [`pool${POOL_SMALL}`]: tsec(small) },
    lowData: { about: `Hinton and colleagues' strongest claim: soft targets carry generalisation from little data. Every arm trains on the same small fixed pool (${POOL_SMALL} or ${POOL_MID} rows of ${CTX} words, pool seed 200 + student seed, served in shuffled passes) for ${STEPS} steps; the teacher's soft targets are computed on those same pool rows. bestHeldOut is the lowest held-out loss at the checkpoints (${[0, ...AT, STEPS].join(", ")}): what stopping early at the best checkpoint would give, read off the held-out rows themselves, so it flatters every arm equally. The teacher itself was trained on fresh rows, so its soft targets carry what it learned from far more data than the pool: this measures transfer through soft targets, not learning from ${POOL_SMALL} rows alone.`,
      pool: { small: POOL_SMALL, mid: POOL_MID, words: CTX, passesSmall: (STEPS * M.batch) / POOL_SMALL, passesMid: (STEPS * M.batch) / POOL_MID },
      [`pool${POOL_SMALL}`]: small, [`pool${POOL_MID}`]: mid,
      verdicts: [...["soft2", "soft4", "mix2", "argmax", "oracle1"].map((a) => verdict(`${POOL_SMALL} rows, ${a}`, small[a])), ...["soft2", "argmax", "oracle1"].map((a) => verdict(`${POOL_MID} rows, ${a}`, mid[a]))] },
    controls: { about: `Controls that must fail. untrainedTeacher: soft targets at T 2 from a teacher with the same config and seed but no training (its shares are near uniform), full data, three seeds; it must not teach past word counts (unigramLoss). gradCheck: central finite differences of the soft-target loss (T 2, alpha 0.7) for every entry of all ${extras.grad.tensors} tensors of a small float64 model, worst tensor-level relative error; broken is the same check on a backward pass that drops the 1/T of the softened softmax, which the check must catch.`,
      unigramLoss: unigram, untrainedTeacher: full.untrained2, gradCheck: extras.grad },
    speed: { about: "Milliseconds per training step of the main student in Node (V8), one process, nothing else running, 40 steps after 5 warm-up steps: hard labels, soft targets (includes the teacher's forward pass) and oracle targets (includes the generator's exact odds for the batch). inPool is the mean per-step time inside the fill's runs, with 4 processes at once. A browser lab running 40 ms slices fits about 40 / ms steps per slice.",
      msPerStep: extras.speed, inPool: Object.fromEntries(["hard", "soft2", "oracle1"].map((a) => [a, spread(SEEDS.map((s) => J[`full.${MAIN}.${a}.${s}`].msPerStep)).mean])), stepsPer40ms: Object.fromEntries(Object.entries(extras.speed).map(([k, v]) => [k, Math.floor(40 / v)])) },
  }];
}

async function main() {
  if (jobAt >= 0) { process.stdout.write(JSON.stringify(runJob(process.argv[jobAt + 1]))); return; }
  const t0 = Date.now(), extras = { speed: speed(), grad: gradControls() };
  const J = await pool(JOBS, 4), ref = heldReference(TEACHER, heldOut(M.heldOutRows, CTX));
  const [mainT, secs] = sections(J, ref, extras);
  const facts = {
    about: "Lesson S17, distillation. Computed by tools/school/fill_distill.mjs from system/school/distill.mjs and the attention lab's own model, trainer and corpus generator. Do not edit by hand. Losses are in nats (natural log). Every student arm uses the same rows for the same steps; only the training target differs.",
    modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
    recipe: { steps: STEPS, batch: M.batch, lr: M.lr, seeds: SEEDS, heldOutRows: M.heldOutRows, checkpoints: [0, ...AT, STEPS], loss: "alpha * T^2 * KL(softmax(teacher/T) || softmax(student/T)) + (1 - alpha) * CE(label, softmax(student))" },
    ...deep(secs), film: deep(film(J, mainT)),
    runSeconds: Object.fromEntries(Object.values(J).map((j) => [j.name, round(j.seconds, 1)])), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  const line = (b) => Object.entries(b).map(([k, s]) => `${k.padEnd(10)} held ${round(s.heldOut.mean)}+-${round(s.heldOut.sd)} best ${round(s.bestHeldOut.mean)} copy ${round(s.copyAccuracy.mean)} agree ${round(s.agreement.mean)}`);
  console.log(JSON.stringify({ teacher: facts.teacher, full: line(secs.fullData.arms), pool32: line(secs.lowData.pool32), pool256: line(secs.lowData.pool256), verdicts: [...facts.fullData.verdicts, ...facts.lowData.verdicts], mainT, controls: { untrained: facts.controls.untrainedTeacher.heldOut, grad: facts.controls.gradCheck }, speed: facts.speed, seconds: facts.seconds }, null, 1));
}

main().catch((e) => { console.error("fill_distill failed:", e); process.exit(1); });
