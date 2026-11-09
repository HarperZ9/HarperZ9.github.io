// Fill lesson S19's numbers ("LoRA and fine-tuning") so no number in the
// film or lab is typed by hand. Writes media/school/lora/facts.json.
//
//   node tools/school/fill_lora.mjs [media/school/attention/model.json] [media/school/lora]
//
// The attention lab's trained model is the base. Each method fine-tunes a copy
// of it on the "things keep their look" task (lora-task.mjs) for the same
// steps on the same rows: full fine-tuning, the readout only, the last layer,
// and LoRA at ranks 1, 2, 4, 8 on the attention projections and on every
// dense matrix. Each method's learning rate is picked from 1e-3, 3e-3, 1e-2, 3e-2
// on seed 1 by the loss on separate validation task rows; seeds 2 and 3 then
// run at that rate. Each run is a child process (at most 4 at once,
// below-normal priority).
//   node tools/school/fill_lora.mjs --job <name>    one run, JSON to stdout
// FILL_STEPS=<n> shortens every run for a smoke test.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createLora, createFinetuner, targetSet, shapeOf, cloneModel, adapterGradError } from "../../system/school/lora.mjs";
import { taskBatch, taskHeld, taskSource, TASK_HELD_SEED } from "../../system/school/lora-task.mjs";
import { scoreTask, changeSpectra, randomShares, truncate } from "../../system/school/lora-measure.mjs";
import { createModel, forward, fromJSON, evaluate, rng } from "../../system/school/tinyformer.mjs";
import { gauss } from "../../system/school/tinyformer-ops.mjs";
import { heldOut } from "../../system/school/corpus.mjs";
import { trueTable } from "../../system/school/corpus-grammar.mjs";
import { spread } from "../../system/school/scaling.mjs";
import { sections, film } from "./fill_lora_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const SELF = fileURLToPath(import.meta.url);
const jobAt = process.argv.indexOf("--job");
const modelPath = (jobAt < 0 && process.argv[2]) || "media/school/attention/model.json";
const outDir = (jobAt < 0 && process.argv[3]) || "media/school/lora";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8"));
const BASE = fromJSON(M.weights), C = BASE.config, CTX = C.ctx;
// 4 decimal places; a nonzero value under 1e-4 (a gradient-check error) keeps
// 3 significant digits instead of rounding to 0.
const round = (v, k = 4) => (typeof v !== "number" || Number.isInteger(v) ? v : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toPrecision(3)) : Math.round(v * 10 ** k) / 10 ** k);
const deep = (o) => (Array.isArray(o) ? o.map(deep) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)])) : round(o));

const STEPS = Number(process.env.FILL_STEPS) || 1500, SEEDS = [1, 2, 3], LRS = [1e-3, 3e-3, 1e-2, 3e-2], ROWS = 256, ALPHA = 8;
const AT = [50, 100, 250, 500, 750, 1000].filter((s) => s < STEPS);
const METHODS = { full: { kind: "full" }, readout: { kind: "readout" }, lastLayer: { kind: "lastLayer" } };
for (const t of ["attn", "all"]) for (const r of [1, 2, 4, 8]) METHODS[`lora.${t}.r${r}`] = { kind: "lora", targets: t, rank: r, alpha: ALPHA };
const ALL_MATS = targetSet(C, "all"), ATTN_MATS = targetSet(C, "attn"), shape = (n) => shapeOf(C, n);
const TASK = () => taskHeld(ROWS, CTX), VALID = () => taskBatch(rng(TASK_HELD_SEED + 1), ROWS, CTX, { withOdds: true }), ORIG = () => heldOut(M.heldOutRows, CTX);

function scoreAll(model, task, orig) {
  const t = scoreTask(model, task), e = evaluate(model, orig);
  return { task: { loss: t.all.loss, excess: t.all.excess, accuracy: t.all.accuracy, answer: t.answer.accuracy, answerLoss: t.answer.loss, repeatThing: t.repeatThing.accuracy }, orig: { loss: e.loss, copyAccuracy: e.copyAccuracy, accuracy: e.accuracy } };
}

// The full fine-tune's change truncated to rank k in every dense matrix (the
// other numbers keep their fine-tuned values), scored on the task.
function truncatedScores(base, tuned, task, orig) {
  return [1, 2, 4, 8].map((k) => {
    const m = cloneModel(tuned);
    for (const name of ALL_MATS) {
      const [K, Mm] = shape(name), D = new Float64Array(K * Mm), a = base.params[name], b = tuned.params[name];
      for (let i = 0; i < D.length; i++) D[i] = b[i] - a[i];
      const Dk = truncate(D, K, Mm, k), p = m.params[name];
      for (let i = 0; i < D.length; i++) p[i] = a[i] + Dk[i];
    }
    return { rank: k, ...scoreAll(m, task, orig) };
  });
}

function runJob(name) {
  const [method, lrS, seedS] = name.split("|"), seed = Number(seedS), lr = Number(lrS), t0 = Date.now();
  const spec = { ...METHODS[method], seed: 50 + seed }, task = TASK(), orig = ORIG(), valid = VALID();
  const ft = createFinetuner(BASE, spec, taskSource({ seed: 300 + seed, batch: M.batch, ctx: CTX }), { lr, batch: M.batch });
  const curve = [{ step: 0, ...scoreAll(ft.model, task, orig) }], marks = new Set([...AT, STEPS]);
  let ms = 0;
  for (let s = 1; s <= STEPS; s++) { ms += ft.step().ms; if (marks.has(s)) curve.push({ step: s, ...scoreAll(ft.model, task, orig) }); }
  const out = { name, method, lr, seed, trained: ft.trained, end: curve.at(-1), curve, valid: scoreTask(ft.model, valid).all.loss, msPerStep: ms / STEPS, seconds: 0 };
  if (method === "full") {
    out.spectra = changeSpectra(BASE, ft.model, ALL_MATS, shape);
    out.truncated = truncatedScores(BASE, ft.model, task, orig);
    if (seed === 1) out.deltas = Object.fromEntries(ATTN_MATS.map((n) => [n, Array.from(ft.model.params[n], (v, i) => v - BASE.params[n][i])]));
  }
  if (ft.adapter && ft.adapter.rank === 1 && spec.targets === "attn" && seed === 1) out.rank1 = { s: ft.adapter.s, mats: Object.fromEntries(ft.adapter.mats.map((m) => [m.name, { A: Array.from(m.A), B: Array.from(m.B) }])) };
  out.seconds = (Date.now() - t0) / 1000;
  return out;
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

// Controls computed in the parent: step-zero equality, the gradient check
// with and without the transpose fault, rank 0, and random-matrix shares.
function controls() {
  const task = TASK(), base = forward(cloneModel(BASE), task.x, ROWS, CTX).logits.slice();
  const bitEqual = ["attn", "all"].every((t) => [1, 8].every((r) => { const ad = createLora(BASE, { targets: t, rank: r, seed: 3 }), o = forward(ad.model, task.x, ROWS, CTX).logits; return o.every((v, i) => v === base[i]); }));
  const cfg = { dModel: 8, nHeads: 2, nLayers: 2, dFF: 16, ctx: 6, float64: true }, scr = createModel(cfg, 3), r = rng(1003);
  for (const n of scr.names) { const p = scr.params[n], g = /_g$/.test(n); for (let i = 0; i < p.length; i++) p[i] = (g ? 1 : 0) + 0.4 * gauss(r); }
  const mk = () => { const ad = createLora(scr, { targets: "all", rank: 2, alpha: 4, seed: 5 }), q = rng(8); for (const m of ad.mats) for (let i = 0; i < m.B.length; i++) m.B[i] = 0.3 * gauss(q); return ad; };
  const { x, y } = taskBatch(rng(4), 2, 6);
  const gradCheck = { ok: adapterGradError(mk(), x, y, 2, 6), broken: adapterGradError(mk(), x, y, 2, 6, { brokenTranspose: true }), adapters: mk().view.names.length };
  const z = createFinetuner(BASE, { kind: "lora", targets: "attn", rank: 0 }, taskSource({ seed: 301, batch: M.batch, ctx: CTX }), { lr: 1e-2, batch: M.batch });
  const before = scoreTask(z.model, task).all.loss;
  for (let s = 0; s < 50; s++) z.step();
  const rq = rng(77), randomBaseline = Object.fromEntries([...new Set(ALL_MATS.map((n) => shape(n).join("x")))].map((k) => { const [K, Mm] = k.split("x").map(Number); return [k, randomShares(K, Mm, rq)]; }));
  return { stepZero: { bitEqual, rows: ROWS }, gradCheck, rank0: { trained: z.trained, before, after: scoreTask(z.model, task).all.loss }, randomBaseline };
}

// Step times with nothing else running, 40 steps after 5 warm-up steps.
function speed() {
  const out = {};
  for (const name of ["full", "readout", "lora.attn.r4", "lora.all.r8"]) {
    const ft = createFinetuner(BASE, { ...METHODS[name], seed: 1 }, taskSource({ seed: 301, batch: M.batch, ctx: CTX }), { lr: 3e-3, batch: M.batch });
    for (let i = 0; i < 5; i++) ft.step();
    let ms = 0;
    for (let i = 0; i < 40; i++) ms += ft.step().ms;
    out[name] = ms / 40;
  }
  return out;
}

function references() {
  const task = TASK(), orig = ORIG(), V = C.vocab, P = trueTable(orig, V);
  let origFloor = 0;
  for (let n = 0; n < orig.y.length; n++) origFloor -= Math.log(P[n * V + orig.y[n]]);
  const t = scoreTask(BASE, task);
  return { base: { task: t, orig: evaluate(BASE, orig) }, origFloor: origFloor / orig.y.length, taskRows: ROWS };
}

async function main() {
  if (jobAt >= 0) { process.stdout.write(JSON.stringify(runJob(process.argv[jobAt + 1]))); return; }
  const t0 = Date.now(), extras = { speed: speed(), controls: controls(), refs: references() };
  const sweep = await pool(Object.keys(METHODS).flatMap((m) => LRS.map((lr) => `${m}|${lr}|1`)), 4);
  const chosen = Object.fromEntries(Object.keys(METHODS).map((m) => [m, LRS.reduce((b, lr) => (sweep[`${m}|${lr}|1`].valid < sweep[`${m}|${b}|1`].valid ? lr : b), LRS[0])]));
  const rest = await pool(Object.keys(METHODS).flatMap((m) => SEEDS.slice(1).map((s) => `${m}|${chosen[m]}|${s}`)), 4);
  const J = { ...sweep, ...rest }, runs = (m) => SEEDS.map((s) => J[`${m}|${chosen[m]}|${s}`]);
  const ctx = { M, C, STEPS, SEEDS, LRS, ROWS, ALPHA, AT, METHODS, ALL_MATS, ATTN_MATS, BASE, shape, chosen, runs, sweep, extras, spread };
  const facts = {
    about: "Lesson S19, LoRA and fine-tuning. Computed by tools/school/fill_lora.mjs from system/school/lora.mjs, lora-task.mjs and lora-measure.mjs and the attention lab's own model and trainer. Do not edit by hand. Losses are in nats (natural log). Every method starts from the same base weights and trains on the same task rows for the same steps.",
    modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
    ...deep(sections(ctx)), film: deep(film(ctx)),
    runSeconds: Object.fromEntries(Object.values(J).map((j) => [j.name, round(j.seconds, 1)])), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  const line = (m) => `${m.padEnd(14)} lr ${chosen[m]} trained ${facts.methods.runs[m].trained} task ${facts.methods.runs[m].taskLoss.mean}+-${round(facts.methods.runs[m].taskLoss.sd)} answer ${facts.methods.runs[m].answer.mean} orig ${facts.methods.runs[m].origLoss.mean} copy ${facts.methods.runs[m].origCopy.mean}`;
  console.log(JSON.stringify({ base: facts.base, methods: Object.keys(METHODS).map(line), rank: facts.rank.summary, truncated: facts.rank.truncated, controls: facts.controls, speed: facts.speed, seconds: facts.seconds }, null, 1));
}

main().catch((e) => { console.error("fill_lora failed:", e); process.exit(1); });
