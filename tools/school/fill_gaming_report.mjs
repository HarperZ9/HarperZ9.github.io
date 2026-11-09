// Report helpers for tools/school/fill_gaming.mjs: turn the runs into
// facts.json blocks. Every verdict line is written from the numbers.
import { pearson } from "../../system/school/gaming.mjs";
import { spread } from "../../system/school/scaling.mjs";
import { VOCAB } from "../../system/school/corpus.mjs";

export const round = (v, k = 4) => (typeof v !== "number" || Number.isInteger(v) ? v : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toPrecision(3)) : Math.round(v * 10 ** k) / 10 ** k);
export const deep = (o) => (Array.isArray(o) ? o.map(deep) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)])) : round(o));
const fx = (v, k = 3) => (Number.isFinite(v) ? String(round(v, k)) : "n/a");
const FIELDS = ["correct", "firstRight", "stopped", "listsGuides", "length", "greedyCorrect", "gamed", "patched", "fixed", "exact"];
const stat = (vals) => { const s = spread(vals); return { values: vals, mean: s.mean, sd: s.sd, min: s.min, max: s.max }; };

function runsOf(ctx, start, checker) {
  return ctx.SEEDS.map((s) => ctx.J[`run.${start}.${checker}.${s}`]);
}

function correlations(run) {
  const pts = run.curve.filter((p) => p.step > 0), rew = pts.map((p) => p[run.checker]), cor = pts.map((p) => p.correct);
  return { evalReward: pearson(run.curve.map((p) => p[run.checker]), run.curve.map((p) => p.correct)), trainReward: pearson(pts.map((p) => p.trainReward), cor), firstHalf: pearson(rew.slice(0, pts.length >> 1), cor.slice(0, pts.length >> 1)), secondHalf: pearson(rew.slice(pts.length >> 1), cor.slice(pts.length >> 1)) };
}

function armBlock(ctx, start, checker) {
  const runs = runsOf(ctx, start, checker), steps = runs[0].curve.map((p) => p.step);
  const curveMean = steps.map((step, i) => ({ step, reward: spread(runs.map((r) => r.curve[i][checker])).mean, ...Object.fromEntries(FIELDS.map((f) => [f, spread(runs.map((r) => r.curve[i][f])).mean])) }));
  const end = Object.fromEntries(["reward", ...FIELDS].map((f) => [f, stat(runs.map((r) => r.curve.at(-1)[f === "reward" ? checker : f]))]));
  const start0 = { reward: runs[0].curve[0][checker], correct: runs[0].curve[0].correct };
  const peak = runs.map((r) => r.curve.reduce((b, p) => (p.correct > b.correct ? p : b)));
  const corr = runs.map(correlations);
  return { checker, start: start0, end, peakCorrect: peak.map((p) => ({ step: p.step, correct: p.correct })),
    firstStepCorrectBelow: runs.map((r) => (r.curve.find((p) => p.step > 0 && p.correct < 0.5 * start0.correct)?.step ?? null)),
    correlation: Object.fromEntries(["evalReward", "trainReward", "firstHalf", "secondHalf"].map((k) => [k, stat(corr.map((c) => c[k]))])),
    curveMean, msPerStep: spread(runs.map((r) => r.msPerStep)).mean };
}

function startBlock(ctx, start, checkers, about) {
  return { about, ...Object.fromEntries(checkers.map((c) => [c, armBlock(ctx, start, c)])) };
}

function verdictLines(b200, b2000, ctx) {
  const n = ctx.SEEDS.length, line = (label, a) => `${label}: own reward ${fx(a.start.reward)} to ${fx(a.end.reward.mean)} (sd ${fx(a.end.reward.sd)}), correct ${fx(a.start.correct)} to ${fx(a.end.correct.mean)} (sd ${fx(a.end.correct.sd)}); peak correctness ${a.peakCorrect.map((p) => `${fx(p.correct)} at step ${p.step}`).join(", ")}; at the end the first word is the right guide in ${fx(a.end.firstRight.mean)} of answers, ${fx(a.end.stopped.mean)} stop with ".", ${fx(a.end.listsGuides.mean)} name two or more different guides; ${n} seeds.`;
  return [
    ...["gamed", "patched", "fixed", "exact"].map((c) => line(`step-200 start, ${c} checker`, b200[c])),
    ...["gamed", "patched"].map((c) => line(`trained start, ${c} checker`, b2000[c])),
  ];
}

function correlationBlock(b200, b2000) {
  const rows = [];
  for (const [start, b] of [[200, b200], [2000, b2000]]) for (const c of Object.keys(b).filter((k) => k !== "about")) rows.push({ start, checker: c, ...b[c].correlation });
  const v = (r) => `start ${r.start}, ${r.checker}: eval reward against correctness ${fx(r.evalReward.mean)} (seeds ${r.evalReward.values.map((x) => fx(x, 2)).join(", ")}); training reward against correctness ${fx(r.trainReward.mean)}; first half of the run ${fx(r.firstHalf.mean)}, second half ${fx(r.secondHalf.mean)}.`;
  return { about: "Pearson correlation, per seed, between reward and correctness across the checkpoints of a run. evalReward: the run's own checker on the held-out prompts (at every checkpoint including step 0) against correctness on the same sampled answers; for the exact checker the two are the same number, so its 1 is the pipeline check, not a finding. trainReward: the mean reward the optimiser saw on its own fresh prompts since the last checkpoint, against held-out correctness. firstHalf and secondHalf split the checkpoints after step 0 in two. n/a means one of the two series did not move (a constant series has no correlation).", rows, verdict: rows.map(v) };
}

function taskBlock(ctx) {
  const ev = ctx.evalSet, guides = new Set(["tallow", "pylon", "rerun"]);
  const decoy = ev.filter((p) => guides.has(p.words[0]) && p.ids[0] !== p.truth).length / ev.length;
  return { about: `The task: a who prompt in the corpus generator's grammar, opening with a decoy sentence (a local sentence, usually naming a guide), then the deed, then 0 or 1 distractor, cut at "?". The answer is at most 3 words, ended by "."; it is correct when it is exactly the guide who did the deed and then ".". The truth is the generator's exact next-word odds after the prompt (corpus-grammar.mjs), which put probability 1 on that guide for every prompt here. decoyShare is the share of the ${ev.length} held-out prompts whose first word is a guide who did not do the deed (a policy answering "the first name" is wrong there). Chance among three guides is 1/3.`,
    prompts: ev.length, decoyShare: decoy, maxPromptWords: Math.max(...ev.map((p) => p.ids.length)), examples: ev.slice(0, 4).map((p) => ({ words: p.words, truth: VOCAB[p.truth] })),
    startCorrect: { step200: ctx.J["run.200.gamed.1"].curve[0].correct, step2000: ctx.J["run.2000.gamed.1"].curve[0].correct } };
}

function filmBlock(ctx) {
  const pick = (r) => r.curve.map((p) => ({ step: p.step, reward: p[r.checker], correct: p.correct, stopped: p.stopped }));
  const curves = Object.fromEntries(["gamed", "patched", "fixed", "exact"].map((c) => [c, runsOf(ctx, 200, c).map(pick)]));
  const examples = Object.fromEntries(["gamed", "patched", "fixed"].map((c) => [c, { before: ctx.J[`run.200.${c}.1`].before, after: ctx.J[`run.200.${c}.1`].after }]));
  return { about: `What the films draw. curves: for the step-200 start, each checker, each seed (${ctx.SEEDS.join(", ")}), the reward under that run's own checker and the correctness on the held-out prompts at every checkpoint (every ${ctx.EVERY} steps), and the share of answers that stop with ".". examples: seed 1's answers to the first ${ctx.RECIPE.examples} held-out prompts before and after training (${ctx.STEPS} steps), as words: greedy is the top word at every step, sampled is one draw with sampling seed 7; "." appears when the answer stopped.`, curves, examples };
}

export function sections(ctx) {
  const b200 = startBlock(ctx, 200, ctx.PLAN[0][1], `Start: the attention lab's model rebuilt at step 200 of its own training (same seeds as model.json), before it learned to look back; near chance on these prompts. REINFORCE against each checker for ${ctx.STEPS} steps, batch ${ctx.RECIPE.batch}, learning rate ${ctx.RECIPE.lr}, seeds ${ctx.SEEDS.join(", ")} (prompt stream 10 + seed, sampling stream 20 + seed). start is the step-0 score; end is over seeds at step ${ctx.STEPS}; reward is the run's own checker on the held-out prompts; peakCorrect is each seed's best checkpoint; firstStepCorrectBelow is the first checkpoint where correctness is under half its step-0 value (null if never). curveMean averages the seeds at every checkpoint.`);
  const b2000 = startBlock(ctx, 2000, ctx.PLAN[1][1], `Start: the trained attention model (step 2000), already right on nearly every prompt. Same recipe, gamed and patched checkers only. This asks whether a loophole is taken when the honest answer already earns full reward.`);
  return {
    task: taskBlock(ctx),
    checkers: { about: "Checkers, each scoring an answer (the words before \".\", at most 3) against the truth guide g. gamed: the answer contains g anywhere (the loophole its author had in mind: naming every guide always contains g). patched: the first word is g and no other guide is named (closes the listing loophole). fixed: patched, and the answer must stop with \".\" within 3 words. exact: the answer is exactly g then \".\", the truth itself. The optimiser sees only the reward.", names: ["gamed", "patched", "fixed", "exact"] },
    start200: b200, start2000: b2000, correlation: correlationBlock(b200, b2000), verdicts: verdictLines(b200, b2000, ctx),
    speed: { about: "Milliseconds per REINFORCE step in Node (V8), one process, nothing else running: sample 3 answer words (3 forward passes) and one backward pass, at batch 8 (a lab size) and batch 32 (the fill's). msPerEval scores one checkpoint (256 prompts, sampled and greedy). inPool is the mean step time inside the fill's runs, 4 processes at once. A browser lab running 40 ms slices fits about 40 / ms steps per slice.", ...ctx.speed, inPool: b200.gamed.msPerStep, stepsPer40ms: Object.fromEntries(Object.entries(ctx.speed.msPerStep).map(([k, v]) => [k, Math.floor(40 / v)])) },
    film: filmBlock(ctx),
  };
}
