// Fill lesson E23's numbers ("Error bars: how sure is the number") so no
// number in the film or lab is typed by hand. Writes
// media/school/errorbars/facts.json.
//
//   node tools/school/fill_errorbars.mjs [media/school/attention/model.json] [media/school/errorbars]
//
// The attention lab's trained model is scored word by word on 1,024 held-out
// rows; bootstrap and normal intervals are built from rows and from single
// words at 16, 64, 256 and 1,024 rows. Two distillation students (lesson S17's
// recipe: hard labels, and the teacher's soft targets at T 1) are retrained
// at five seeds each for the paired comparison and the seed spread. The
// coverage check draws fresh sets from the corpus generator, whose expected
// loss is computed exactly. Each training run and coverage chunk is a child
// process (at most 4 at once, below-normal priority).
//   node tools/school/fill_errorbars.mjs --job <name> [--truth <x>]   one job, JSON to stdout
// FILL_STEPS=<n> shortens training and FILL_TRIALS=<n> the coverage, for a smoke test.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { scoreItems, unitsOf, createCoverage } from "../../system/school/errorbars.mjs";
import { generatorExpectedLoss } from "../../system/school/errorbars-truth.mjs";
import { STUDENTS, distillRun, heldReference } from "../../system/school/distill.mjs";
import { fromJSON } from "../../system/school/tinyformer.mjs";
import { heldOut } from "../../system/school/corpus.mjs";
import { freshSource } from "../../system/school/data.mjs";
import { sections, film, round, deep } from "./fill_errorbars_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const SELF = fileURLToPath(import.meta.url);
const jobAt = process.argv.indexOf("--job"), truthAt = process.argv.indexOf("--truth");
const modelPath = (jobAt < 0 && process.argv[2]) || "media/school/attention/model.json";
const outDir = (jobAt < 0 && process.argv[3]) || "media/school/errorbars";
const raw = readFileSync(modelPath), M = JSON.parse(raw.toString("utf8"));
const MODEL = fromJSON(M.weights), CTX = M.config.ctx;

const STEPS = Number(process.env.FILL_STEPS) || 2000, TRIALS = Number(process.env.FILL_TRIALS) || 1000;
const SEEDS = [1, 2, 3, 4, 5], ROWS = 1024, COV_RESAMPLES = 1000;
const ARMS = { hard: { kind: "hard" }, soft1: { kind: "soft", T: 1 } };
// [rows, copies, chunks]: each chunk runs TRIALS / chunks trials on its own data seed.
const COVERAGE = [[16, 1, 1], [64, 1, 1], [256, 1, 4], [16, 4, 1]];
const covJobs = () => COVERAGE.flatMap(([rows, copies, chunks]) => Array.from({ length: chunks }, (_, c) => `cov.${rows}.${copies}.${c}.${Math.round(TRIALS / chunks)}`));
const trainJobs = () => Object.keys(ARMS).flatMap((a) => SEEDS.map((s) => `train.${a}.${s}`));

// One student, the S17 recipe: d16x1, fresh rows (data seed 100 + seed), batch
// 16, learning rate 1e-2 with the lab's warmup. Per-row sums on 1,024 rows.
function trainJob(arm, seed) {
  const t0 = Date.now(), ref = heldReference(MODEL, heldOut(M.heldOutRows, CTX));
  const r = distillRun({ config: STUDENTS.d16x1, seed, teacher: MODEL, arm: ARMS[arm], source: freshSource({ seed: 100 + seed, batch: M.batch, ctx: CTX }), ref, steps: STEPS, batch: M.batch, lr: M.lr });
  const items = scoreItems(r.student, heldOut(ROWS, CTX)), lb = unitsOf(items, "lookback", "row");
  return { arm, seed, at256: r.end.heldOut, msPerStep: r.msPerStep, seconds: (Date.now() - t0) / 1000, loss: Array.from(unitsOf(items, "loss", "row").num), accuracy: Array.from(unitsOf(items, "accuracy", "row").num), lookback: { num: Array.from(lb.num), den: Array.from(lb.den) } };
}

function covJob(rows, copies, chunk, trials, truth) {
  const t0 = Date.now(), c = createCoverage({ rows, copies, truth, seed: 1000 * rows + 10 * copies + chunk, resamples: COV_RESAMPLES });
  for (let i = 0; i < trials; i++) c.step();
  return { rows, copies, chunk, trials: c.trials, seconds: (Date.now() - t0) / 1000 };
}

function runJob(name) {
  const p = name.split(".");
  if (p[0] === "truth") { const t0 = Date.now(), g = generatorExpectedLoss(CTX); return { ...g, seconds: (Date.now() - t0) / 1000 }; }
  if (p[0] === "train") return trainJob(p[1], Number(p[2]));
  return covJob(Number(p[1]), Number(p[2]), Number(p[3]), Number(p[4]), Number(process.argv[truthAt + 1]));
}

function child(name, truth) {
  return new Promise((resolve, reject) => {
    const args = [SELF, "--job", name, ...(truth === undefined ? [] : ["--truth", String(truth)])];
    const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "inherit"] });
    let s = "";
    p.stdout.on("data", (d) => { s += d; });
    p.on("close", (code) => (code === 0 ? resolve(JSON.parse(s)) : reject(new Error(`job ${name} exited ${code}`))));
  });
}

async function pool(names, limit, truth) {
  const out = {}, queue = names.slice();
  const worker = async () => { while (queue.length) { const n = queue.shift(); out[n] = await child(n, n.startsWith("cov") ? truth : undefined); console.error(`done ${n} in ${out[n].seconds.toFixed(1)} s`); } };
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

// Stored S17 numbers (read only), to check the retrained students reproduce.
function storedDistill() {
  try {
    const f = JSON.parse(readFileSync("media/school/distill/facts.json", "utf8"));
    return { hard: f.fullData.arms.hard.heldOut.values, soft1: f.fullData.arms.soft1.heldOut.values };
  } catch (e) { console.error("distill facts not read:", e.message); return null; }
}

async function main() {
  if (jobAt >= 0) { process.stdout.write(JSON.stringify(runJob(process.argv[jobAt + 1]))); return; }
  const t0 = Date.now(), truth = await child("truth");
  console.error(`truth ${truth.mean} in ${truth.seconds.toFixed(1)} s`);
  const J = await pool([...trainJobs(), ...covJobs()], 4, truth.mean);
  const items = scoreItems(MODEL, heldOut(ROWS, CTX));
  const ctx = { M, items, truth, J, SEEDS, ARMS, COVERAGE, STEPS, TRIALS, ROWS, COV_RESAMPLES, stored: storedDistill() };
  const secs = sections(ctx);
  const facts = {
    about: "Lesson E23, error bars. Computed by tools/school/fill_errorbars.mjs from system/school/errorbars.mjs, errorbars-truth.mjs, the attention lab's own model and the corpus generator. Do not edit by hand. Losses are in nats (natural log). Intervals are 95 percent; bootstrap intervals are percentile intervals (type 7 quantiles) from a seeded resampler, so every number here is reproducible.",
    modelSha256: createHash("sha256").update(raw).digest("hex"), modelFile: "media/school/attention/model.json",
    ...deep(secs), film: deep(film(ctx, secs)),
    runSeconds: Object.fromEntries(Object.entries(J).map(([k, j]) => [k, round(j.seconds, 1)])), seconds: 0,
  };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ widths: facts.widths.verdict, unit: facts.unit.verdict, paired: facts.paired.verdict, seeds: facts.seeds.verdict, coverage: facts.coverage.verdicts, seconds: facts.seconds }, null, 1));
}

main().catch((e) => { console.error("fill_errorbars failed:", e); process.exit(1); });
