// Fill lesson E24's numbers ("When the check can be fooled") so no number in
// the film or lab is typed by hand. Writes media/school/gaming/facts.json.
//
//   node tools/school/fill_gaming.mjs [media/school/attention/model.json] [media/school/gaming]
//
// The policy is the attention lab's model, either rebuilt at step 200 of its
// own training (before it learned to look back: near chance on who prompts
// that open with a decoy sentence) or as trained (step 2000). REINFORCE
// fine-tunes it against one checker; the truth is the corpus generator's
// exact answer. Every run is scored every 25 steps on the same 256 held-out
// prompts with the same sampling seed. Each run is a child process (at most 4
// at once, below-normal priority).
//   node tools/school/fill_gaming.mjs --job <name>    one run, JSON to stdout
// FILL_STEPS=<n> shortens every run for a smoke test.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makePrompts, createGamer, scorePolicy, exampleAnswers, checkpointAt } from "../../system/school/gaming.mjs";
import { fromJSON } from "../../system/school/tinyformer.mjs";
import { sections, round, deep } from "./fill_gaming_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const SELF = fileURLToPath(import.meta.url);
const jobAt = process.argv.indexOf("--job");
const modelPath = (jobAt < 0 && process.argv[2]) || "media/school/attention/model.json";
const outDir = (jobAt < 0 && process.argv[3]) || "media/school/gaming";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8"));

const STEPS = Number(process.env.FILL_STEPS) || 800, EVERY = 25, SEEDS = [1, 2, 3];
const RECIPE = { batch: 32, lr: 1e-3, evalPrompts: 256, evalSeed: 4242, evalSampleSeed: 99, examples: 6 };
const PLAN = [[200, ["gamed", "patched", "fixed", "exact"]], [2000, ["gamed", "patched"]]];
const JOBS = PLAN.flatMap(([start, cks]) => cks.flatMap((c) => SEEDS.map((s) => `run.${start}.${c}.${s}`)));

const startModel = (start) => (start === M.steps ? fromJSON(M.weights) : checkpointAt(M, start));

function runJob(name) {
  const [, startS, checker, seedS] = name.split("."), start = Number(startS), seed = Number(seedS), t0 = Date.now();
  const policy = startModel(start), evalSet = makePrompts(RECIPE.evalSeed, RECIPE.evalPrompts), shown = evalSet.slice(0, RECIPE.examples);
  const g = createGamer(policy, checker, { batch: RECIPE.batch, lr: RECIPE.lr, promptSeed: 10 + seed, sampleSeed: 20 + seed });
  const curve = [{ step: 0, ...scorePolicy(policy, evalSet, RECIPE.evalSampleSeed), trainReward: null, trainCorrect: null }];
  const before = exampleAnswers(policy, shown);
  let ms = 0, win = { r: 0, c: 0, n: 0 };
  for (let s = 1; s <= STEPS; s++) {
    const st = g.step();
    ms += st.ms; win.r += st.reward; win.c += st.correct; win.n += 1;
    if (s % EVERY === 0 || s === STEPS) {
      curve.push({ step: s, ...scorePolicy(policy, evalSet, RECIPE.evalSampleSeed), trainReward: win.r / win.n, trainCorrect: win.c / win.n });
      win = { r: 0, c: 0, n: 0 };
    }
  }
  return { name, start, checker, seed, curve, before, after: exampleAnswers(policy, shown), msPerStep: ms / STEPS, seconds: (Date.now() - t0) / 1000 };
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

// Step times with nothing else running, at the fill's batch and at a lab's.
function speed() {
  const policy = fromJSON(M.weights), out = {};
  for (const batch of [8, 32]) {
    const g = createGamer(policy, "fixed", { batch, lr: 0 });
    for (let i = 0; i < 3; i++) g.step();
    let ms = 0;
    for (let i = 0; i < 20; i++) ms += g.step().ms;
    out[`batch${batch}`] = ms / 20;
  }
  const evalSet = makePrompts(RECIPE.evalSeed, RECIPE.evalPrompts), t0 = performance.now();
  scorePolicy(policy, evalSet, RECIPE.evalSampleSeed);
  return { msPerStep: out, msPerEval: performance.now() - t0 };
}

async function main() {
  if (jobAt >= 0) { process.stdout.write(JSON.stringify(runJob(process.argv[jobAt + 1]))); return; }
  const t0 = Date.now(), sp = speed(), J = await pool(JOBS, 4);
  const ctx = { M, J, PLAN, SEEDS, STEPS, EVERY, RECIPE, speed: sp, evalSet: makePrompts(RECIPE.evalSeed, RECIPE.evalPrompts) };
  const facts = {
    about: "Lesson E24, specification gaming. Computed by tools/school/fill_gaming.mjs from system/school/gaming.mjs, the attention lab's own model, trainer and corpus generator. Do not edit by hand. Rewards and correctness are shares of the 256 held-out prompts; every checkpoint uses the same prompts and the same sampling seed, so two checkpoints differ only by the policy.",
    modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
    recipe: { ...RECIPE, steps: STEPS, every: EVERY, seeds: SEEDS, optimiser: "REINFORCE: advantage = reward - batch mean reward; loss = -(1/B) sum_b A_b sum_k log p(a_bk); Adam, no weight decay, gradient clip 1", maxAnswer: 3 },
    ...deep(sections(ctx)),
    runSeconds: Object.fromEntries(Object.values(J).map((j) => [j.name, round(j.seconds, 1)])), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ verdicts: facts.verdicts, correlation: facts.correlation.verdict, speed: facts.speed, seconds: facts.seconds }, null, 1));
}

main().catch((e) => { console.error("fill_gaming failed:", e); process.exit(1); });
