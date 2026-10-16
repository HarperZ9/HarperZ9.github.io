// Report helpers for tools/school/fill_evaluate.mjs: turn the runs into
// facts.json blocks. Every verdict line is written from the numbers.
import { units, agreement, generatorExact, words, promptOf, METRICS } from "../../system/school/evaluate.mjs";
import { pairwiseItems, pairwiseSummary, pairedStatInterval, contaminationGap, sign } from "../../system/school/evaluate-judge.mjs";
import { bootstrapInterval, diffInterval, scoreOf } from "../../system/school/errorbars.mjs";
import { spread } from "../../system/school/scaling.mjs";

export const round = (v, k = 4) => (typeof v !== "number" || Number.isInteger(v) ? v : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toPrecision(3)) : Math.round(v * 10 ** k) / 10 ** k);
export const deep = (o) => (Array.isArray(o) ? o.map(deep) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)])) : round(o));
const fx = (v, k = 3) => (Number.isFinite(v) ? String(round(v, k)) : "n/a");
const RES = 1000, KEYS = ["loss", "exact", "perfect", "fluent"];
const iv = (x) => ({ mean: x.mean, lo: x.lo, hi: x.hi });
const ivs = (x) => `${fx(x.mean)} [${fx(x.lo)}, ${fx(x.hi)}]`;
const stat = (vals) => { const s = spread(vals); return { values: vals, mean: s.mean, sd: s.sd }; };
const word = (s) => (s > 0 ? "resolved better" : s < 0 ? "resolved worse" : "unresolved");

export function metricsOf(rows) {
  const out = Object.fromEntries(METRICS.map((m) => [m, iv(bootstrapInterval(units(rows, m), { resamples: RES, seed: 1 }))]));
  out.stopped = scoreOf(units(rows, "stopped"));
  out.len = scoreOf(units(rows, "len"));
  return out;
}

// Change from rows a (earlier) to rows b (later), oriented so positive means
// b is better (lower loss, higher share), paired over the same rows.
export function improvement(a, b, m) {
  const ua = units(a, m), ub = units(b, m);
  return iv(m === "loss" ? diffInterval(ua, ub, { resamples: RES, seed: 2 }) : diffInterval(ub, ua, { resamples: RES, seed: 2 }));
}

function checkpointBlock(ctx) {
  const per = Object.fromEntries(ctx.SEEDS.map((s) => [s, Object.fromEntries(ctx.MARKS.map((k) => [k, metricsOf(ctx.J[`ckpt.${s}`].at[k])]))]));
  const across = Object.fromEntries(ctx.MARKS.map((k) => [k, Object.fromEntries([...METRICS, "stopped", "len"].map((m) => [m, stat(ctx.SEEDS.map((s) => (m === "stopped" || m === "len" ? per[s][k][m] : per[s][k][m].mean)))]))]));
  return { about: `The attention lab's recipe retrained at seeds ${ctx.SEEDS.join(", ")} (seed 1 is model.json's own), scored on fresh set B (${ctx.SETS.B.rows} rows, never trained on) at steps ${ctx.MARKS.join(", ")}. loss: nats per word over every word. exact: share of one-answer words (generator probability 1, look-back targets) where the model's top word is right; who and copy split it by episode. perfect and fluent: share of rows whose free continuation each judge accepts. Each is mean [95 percent row bootstrap interval]. across: mean and sd over seeds. stopped: share of continuations that ended with "." within ${ctx.RECIPE.maxNew} words; len: mean continuation length in words.`, perSeed: per, across };
}

function disagreementBlock(ctx) {
  const rows = [];
  for (const s of ctx.SEEDS) {
    const at = ctx.J[`ckpt.${s}`].at, pairs = [...ctx.MARKS.slice(1).map((k, i) => [ctx.MARKS[i], k]), ...ctx.MARKS.slice(0, -2).map((k) => [k, ctx.STEPS])];
    for (const [a, b] of pairs) {
      const d = Object.fromEntries(KEYS.map((m) => [m, improvement(at[a], at[b], m)]));
      rows.push({ seed: s, from: a, to: b, ...d, signs: Object.fromEntries(KEYS.map((m) => [m, sign(d[m])])) });
    }
  }
  const opposite = rows.filter((r) => KEYS.some((m) => r.signs[m] > 0) && KEYS.some((m) => r.signs[m] < 0));
  const lossOnly = rows.filter((r) => r.signs.loss > 0 && r.signs.exact === 0);
  const judgeBlind = rows.filter((r) => r.signs.perfect > 0 && r.signs.fluent === 0);
  const line = (r) => `seed ${r.seed}, step ${r.from} to ${r.to}: ${KEYS.map((m) => `${m} ${word(r.signs[m])} (${fx(r[m].mean)} [${fx(r[m].lo)}, ${fx(r[m].hi)}])`).join("; ")}.`;
  return { about: "Paired change of each metric between two checkpoints of the same run, on the same rows of set B; positive means the later checkpoint is better (lower loss, higher share). Pairs: consecutive checkpoints, and every checkpoint against the last. A sign is +1 or -1 when the 95 percent paired row bootstrap interval excludes 0, else 0. opposite: pairs where one metric is resolved better and another resolved worse. lossOnly: loss resolved better while exact match is unresolved. judgeBlind: the perfect judge resolved better while the fluent judge is unresolved.",
    pairs: rows, counts: { pairs: rows.length, opposite: opposite.length, lossOnly: lossOnly.length, judgeBlind: judgeBlind.length },
    opposite: opposite.map(line), lossOnly: lossOnly.map(line), judgeBlind: judgeBlind.map(line) };
}

function judgeBlock(ctx) {
  const kappa = (a, b) => agreement(a, b).kappa, fa = (a, b) => agreement(a, b).falseAccept;
  const per = Object.fromEntries(ctx.SEEDS.map((s) => [s, Object.fromEntries(ctx.MARKS.map((k) => {
    const r = ctx.J[`ckpt.${s}`].at[k], p = r.map((x) => x.perfect), f = r.map((x) => x.fluent), ag = agreement(p, f);
    return [k, { ...ag, kappaIv: iv(pairedStatInterval([p, f], kappa, { resamples: RES, seed: 3 })), falseAcceptIv: iv(pairedStatInterval([p, f], fa, { resamples: RES, seed: 3 })) }];
  }))]));
  return { about: "The fluent judge (every adjacent word pair seen in 4,096 rows of generator text) against the perfect judge (the generator's grammar) on the same continuations of set B. agree: share of rows where they give the same verdict. kappa: Cohen's kappa, agreement beyond what their two acceptance rates give by chance (1 is perfect, 0 is chance). falseAccept: of the continuations the grammar rejects, the share the fluent judge accepts. falseReject: of those the grammar accepts, the share the fluent judge rejects. Intervals resample rows (1,000 resamples).", perSeed: per };
}

function pairwiseBlock(ctx) {
  const vs = ctx.MARKS.filter((k) => k < ctx.STEPS && [200, 600, 1000].map(ctx.scale).includes(k));
  const out = {};
  for (const s of ctx.SEEDS) for (const k of vs) {
    const X = ctx.J[`ckpt.${s}`].at[k], Y = ctx.J[`ckpt.${s}`].at[ctx.STEPS], items = pairwiseItems(X, Y);
    const yWinPerfect = (it) => it.filter((t) => t.perfect !== "tie").length ? it.filter((t) => t.perfect === "y").length / it.filter((t) => t.perfect !== "tie").length : NaN;
    const consistent = (it) => { const d = it.filter((t) => !t.same); return d.length ? d.filter((t) => t.consistent).length / d.length : NaN; };
    out[`${s}.${k}`] = { seed: s, earlier: k, later: ctx.STEPS, ...pairwiseSummary(items), perfectLaterWinsDecided: iv(pairedStatInterval([items], yWinPerfect, { resamples: RES, seed: 4 })), consistentDifferIv: iv(pairedStatInterval([items], consistent, { resamples: RES, seed: 4 })) };
  }
  return { about: "Pairwise judging of an earlier checkpoint (x) against the last (y) on the same prompts of set B, each pair judged twice, with x shown first (XY) and with y shown first (YX). The fluent pairwise judge must name a winner: the answer passing the fluent check wins, else the longer, else the one shown first (position and length rules written in on purpose, as analogues of the biases Zheng and others 2023 measured in LLM judges). The perfect pairwise judge prefers the grammatical answer and ties otherwise. same: share of pairs whose two texts are identical. consistent: same winner in both orders; firstBoth: the first-shown answer won in both orders; the Differ fields count only pairs with different texts. decidedBy: which rule decided the XY verdict. agreeOnDecided: on pairs the perfect judge decides, the share where the fluent judge names the same winner in both orders. longerPicked: of pairs where the perfect judge prefers the shorter answer, the share where the fluent judge picks the longer one (XY order). perfectLaterWinsDecided: on pairs the perfect judge decides, the share won by the later checkpoint.", pairs: out };
}

function leakOne(ctx, steps, n, k, s, m) {
  const ck = ctx.J[`ckpt.${s}`], lk = ctx.J[`leak.${steps}.${n}.${k}.${s}`];
  const cA = units(ck.onA[steps].slice(0, n), m), cB = units(ck.at[steps], m), kA = units(lk.A, m), kB = units(lk.B, m);
  const g = m === "loss" ? contaminationGap(cA, kA, cB, kB, { seed: 5 }) : contaminationGap(kA, cA, kB, cB, { seed: 5 });
  return { cleanA: scoreOf(cA), leakedA: scoreOf(kA), cleanB: scoreOf(cB), leakedB: scoreOf(kB), ...g };
}

function contaminationBlock(ctx) {
  const arms = {}, verdict = [];
  for (const [steps, n, k] of ctx.LEAKS) {
    const name = `${steps}.${n}x${k}`, per = Object.fromEntries(ctx.SEEDS.map((s) => [s, Object.fromEntries(["loss", "exact", "perfect"].map((m) => [m, leakOne(ctx, steps, n, k, s, m)]))]));
    const leaked = ctx.J[`leak.${steps}.${n}.${k}.1`].leaked, share = leaked / (steps * ctx.M.batch);
    arms[name] = { steps, rows: n, repeats: k, leakedRows: leaked, leakedShare: share, perSeed: per, gap: Object.fromEntries(["loss", "exact", "perfect"].map((m) => [m, { ...stat(ctx.SEEDS.map((s) => per[s][m].gap)), resolvedSeeds: ctx.SEEDS.filter((s) => per[s][m].lo > 0 || per[s][m].hi < 0).length }])) };
    for (const m of ["loss", "exact", "perfect"]) {
      const p = ctx.SEEDS.map((s) => per[s][m]);
      verdict.push(`${steps} steps, ${n} rows of set A leaked ${k} times each (${fx(share * 100, 1)} percent of training rows), ${m}: on A the leaked model moved ${p.map((x) => fx(x.onA)).join(", ")} against its clean twin, on fresh B ${p.map((x) => fx(x.onB)).join(", ")}; gap ${p.map((x) => `${fx(x.gap)} [${fx(x.lo)}, ${fx(x.hi)}]`).join(", ")} (seeds ${ctx.SEEDS.join(", ")}; ${arms[name].gap[m].resolvedSeeds} of ${ctx.SEEDS.length} resolved).`);
    }
  }
  return { about: "Contamination (Sainz and others 2023): the clean run and a leaked twin share the model seed and the data stream; the leaked twin also has the first `rows` rows of set A written into its batches (`repeats` shuffled passes, spread evenly over the run, replacing the last rows of a batch). Both are scored on those rows of A and on fresh B. leakedShare is the share of all training rows that were leaked rows. onA and onB: the leaked model's improvement over its clean twin (clean minus leaked for loss, leaked minus clean for shares), paired over rows. gap = onA - onB, with a 95 percent interval resampling A's rows and B's rows separately (2,000 resamples). A positive gap means the score on the leaked rows is inflated beyond any change on fresh rows.", arms, verdict };
}

function setsBlock(ctx) {
  const d = (set) => { const c = [0, 0, 0]; for (const v of set.one) c[v]++; return { rows: set.rows, words: set.rows * set.ctx, oneAnswer: c[1] + c[2], who: c[1], copy: c[2], generatorExact: generatorExact(set) }; };
  const ov = Object.fromEntries(ctx.SEEDS.map((s) => [s, ctx.J[`ckpt.${s}`].overlap]));
  return { about: `Two held-out sets from the corpus generator with seeds ${ctx.SETS.A.seed} (A, the set leaked into contaminated runs) and ${ctx.SETS.B.seed} (B, never trained on). oneAnswer counts look-back targets where the generator's exact odds give the target probability 1. generatorExact is the generator's own top word on those words: right every time, the pipeline check. overlap: rows of each set that occur word for word among a clean run's ${ctx.STEPS * ctx.M.batch} training rows (chance overlap, before any leak).`, A: d(ctx.S.A), B: d(ctx.S.B), overlap: ov, reproducesModelJson: ctx.J["ckpt.1"].reproducesModelJson };
}

function filmBlock(ctx) {
  const at = ctx.J["ckpt.1"].at, B = ctx.S.B, early = ctx.MARKS.includes(ctx.scale(200)) ? ctx.scale(200) : ctx.MARKS[0];
  const curve = ctx.MARKS.map((k) => ({ step: k, ...Object.fromEntries(KEYS.map((m) => [m, iv(bootstrapInterval(units(at[k], m), { resamples: RES, seed: 1 }))])) }));
  const ex = (b) => ({ prompt: words(promptOf(B, b)), early: { words: words(at[early][b].gen), perfect: at[early][b].perfect, fluent: at[early][b].fluent }, late: { words: words(at[ctx.STEPS][b].gen), perfect: at[ctx.STEPS][b].perfect, fluent: at[ctx.STEPS][b].fluent } });
  const fooled = at[early].map((r, b) => (r.fluent && !r.perfect ? b : -1)).filter((b) => b >= 0).slice(0, 4);
  const leak = ctx.LEAKS.map(([st, n, k]) => ({ steps: st, rows: n, repeats: k, loss: ctx.SEEDS.map((s) => { const x = leakOne(ctx, st, n, k, s, "loss"); return { seed: s, cleanA: x.cleanA, leakedA: x.leakedA, cleanB: x.cleanB, leakedB: x.leakedB, gap: x.gap, lo: x.lo, hi: x.hi }; }) }));
  return { about: `What the films draw. curve: seed 1's four metrics on set B at every checkpoint with 95 percent intervals. examples: the first 6 rows of B, the prompt and the continuation written at step ${early} and at step ${ctx.STEPS}, with both judges' verdicts. fooled: rows where the step-${early} continuation passes the fluent judge and fails the grammar. leak: per seed, loss on A and B for each clean and leaked pair.`, curve, examples: [0, 1, 2, 3, 4, 5].map(ex), fooled: fooled.map(ex), leak };
}

// What each metric misses, each line measured on these runs.
function missesBlock(ctx, ck, dis, ju, co) {
  const last = ck.across[ctx.STEPS], early = ctx.MARKS[1], e = ck.across[early];
  const heavy = Object.values(co.arms).reduce((b, a) => (a.gap.loss.mean > b.gap.loss.mean ? a : b));
  const fa = ctx.SEEDS.map((s) => ju.perSeed[s][early].falseAccept);
  return {
    about: "What each metric misses, read off the blocks above (all set B unless named).",
    loss: `Loss counts every word, so it keeps moving where exact match has stopped: ${dis.counts.lossOnly} checkpoint pairs have loss resolved better and exact match unresolved. Loss is also an average over every word: from step ${ctx.MARKS[0]} to step ${early} it falls from ${fx(ck.across[ctx.MARKS[0]].loss.mean)} to ${fx(e.loss.mean)} nats (final ${fx(last.loss.mean)}) while exact match on the one-answer words moves only from ${fx(ck.across[ctx.MARKS[0]].exact.mean)} to ${fx(e.exact.mean)} (final ${fx(last.exact.mean)}); a falling loss does not say which words got better.`,
    exact: `Exact match sees only the one-answer words (${(() => { let c = 0; for (const v of ctx.S.B.one) if (v) c++; return c; })()} of ${ctx.S.B.rows * ctx.S.B.ctx} words of B) and saturates: at step ${ctx.STEPS} it is ${fx(last.exact.mean)}, so it cannot show a leak; with ${heavy.rows} rows leaked ${heavy.repeats} times each the loss gap on them is ${fx(heavy.gap.loss.mean)} nats (seeds ${heavy.gap.loss.values.map((v) => fx(v)).join(", ")}) and the exact-match gap ${fx(heavy.gap.exact.mean)}.`,
    fluent: `The fluent judge reads word pairs, so it passes text whose long-range facts are wrong: at step ${early} it accepts ${fx(e.fluent.mean)} of continuations against the grammar's ${fx(e.perfect.mean)}, and of the continuations the grammar rejects it accepts ${fa.map((v) => fx(v)).join(", ")} (seeds ${ctx.SEEDS.join(", ")}).`,
    perfect: "The perfect judge is perfect only for this toy language: it says whether the generator could have written the text, not whether the text is useful, and it scores one sampled continuation per row, so its number moves with the sampling seed as well as the model. Outside a toy no such parser exists, which is why real evaluations reach for an LLM judge and then have to measure that judge.",
  };
}

export function sections(ctx) {
  const ck = checkpointBlock(ctx), dis = disagreementBlock(ctx), ju = judgeBlock(ctx), pw = pairwiseBlock(ctx), co = contaminationBlock(ctx);
  const sp = ctx.speed;
  const last = ck.across[ctx.STEPS], first = ck.across[ctx.MARKS[0]];
  const verdicts = [
    `At step ${ctx.STEPS} (seeds ${ctx.SEEDS.join(", ")}): loss ${fx(last.loss.mean)} (sd ${fx(last.loss.sd)}), exact match ${fx(last.exact.mean)} (sd ${fx(last.exact.sd)}), perfect judge ${fx(last.perfect.mean)}, fluent judge ${fx(last.fluent.mean)}. At step ${ctx.MARKS[0]}: loss ${fx(first.loss.mean)}, exact ${fx(first.exact.mean)}, perfect ${fx(first.perfect.mean)}, fluent ${fx(first.fluent.mean)}.`,
    `Disagreements over ${dis.counts.pairs} checkpoint pairs: ${dis.counts.opposite} with one metric resolved better and another resolved worse; ${dis.counts.lossOnly} with loss resolved better and exact match unresolved; ${dis.counts.judgeBlind} with the perfect judge resolved better and the fluent judge unresolved.`,
    ...ctx.SEEDS.map((s) => { const j = ju.perSeed[s][ctx.MARKS[1]], z = ju.perSeed[s][ctx.STEPS]; return `Seed ${s}: fluent against perfect judge, kappa ${ivs({ mean: j.kappa, ...j.kappaIv })} at step ${ctx.MARKS[1]} and ${ivs({ mean: z.kappa, ...z.kappaIv })} at step ${ctx.STEPS}; false accepts ${fx(j.falseAccept)} and ${fx(z.falseAccept)}.`; }),
    ...Object.values(pw.pairs).map((p) => `Seed ${p.seed}, step ${p.earlier} against ${p.later}: identical texts ${fx(p.same)}; on the ${p.differ} different pairs the fluent judge kept its verdict after a swap in ${fx(p.consistentDiffer)} and the first-shown answer won both orders in ${fx(p.firstBothDiffer)}; on pairs the perfect judge decides, the later model wins ${ivs(p.perfectLaterWinsDecided)}, and the fluent judge agrees in both orders on ${fx(p.agreeOnDecided)}.`),
    ...co.verdict,
  ];
  return {
    sets: setsBlock(ctx), checkpoints: ck, disagreements: dis, misses: missesBlock(ctx, ck, dis, ju, co), judges: ju, pairwise: pw, contamination: co, verdicts,
    speed: { about: "Milliseconds in Node (V8), one process, nothing else running. msPer16Rows: one scorer step of the lab (16 rows of set B: loss and exact match by one forward pass, then a free continuation and both judges per row); a browser lab running 40 ms slices takes one step per slice. msPerTrainStep: one training step at batch 16. inPool: mean training step inside the fill's runs, 4 processes at once.", ...sp, inPool: spread(Object.values(ctx.J).map((j) => j.msPerStep)).mean, rowsPer40ms: Math.floor((40 / sp.msPer16Rows) * 16) },
    film: filmBlock(ctx),
  };
}
