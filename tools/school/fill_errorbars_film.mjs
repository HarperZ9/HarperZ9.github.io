// The film block of lesson E23's facts.json: the shapes the films draw, all
// computed here from the same seeded resamplers as the numbers.
import { firstRows, unitsOf, scoreOf, createBootstrap, createDiffBootstrap } from "../../system/school/errorbars.mjs";

const BINS = 30;

// Histogram of resampled scores over [lo, hi] in BINS bins.
function histogram(stats, lo, hi) {
  const counts = new Array(BINS).fill(0), w = (hi - lo) / BINS;
  for (const s of stats) counts[Math.min(BINS - 1, Math.max(0, Math.floor((s - lo) / w)))] += 1;
  return { lo, hi, counts };
}

function spreadPair(a, b) {
  const lo = Math.min(...a, ...b), hi = Math.max(...a, ...b);
  return [histogram(a, lo, hi), histogram(b, lo, hi)];
}

const drawn = (make, k) => { const d = make(); d.step(k); return d; };
const unitsFrom = (job) => ({ num: Float64Array.from(job.loss), den: new Float64Array(job.loss.length).fill(24) });

export function film(ctx, secs) {
  const { items, J } = ctx, s64 = firstRows(items, 64), K = 2000;
  const row = drawn(() => createBootstrap(unitsOf(s64, "loss", "row"), 64), K), word = drawn(() => createBootstrap(unitsOf(s64, "loss", "word"), 64), K);
  const [hRow, hWord] = spreadPair(row.stats, word.stats);
  const A = unitsFrom(J["train.hard.1"]), B = unitsFrom(J["train.soft1.1"]);
  const p = drawn(() => createDiffBootstrap(A, B, "paired", 1), K), u = drawn(() => createDiffBootstrap(A, B, "unpaired", 1), K);
  const [hP, hU] = spreadPair(p.stats, u.stats);
  const trials = Object.values(J).filter((j) => j.trials && j.rows === 64 && j.copies === 1)[0].trials.slice(0, 50);
  const widths = [16, 64, 256, 1024].map((n) => ({ rows: n, row: secs.widths.at[n].loss.rowPct.width, word: secs.widths.at[n].loss.wordPct.width, normal: secs.widths.at[n].loss.rowNormal.width }));
  return {
    about: `Shapes for the films. bootstrap64: the mean loss of the attention model on the first 64 held-out rows (point ${scoreOf(unitsOf(s64, "loss", "row"))}) resampled ${K} times by rows and by words (seed 64), as histograms over one shared range of ${BINS} bins. pairedVsUnpaired: the hard-minus-soft1 difference on 1,024 rows, ${K} paired and ${K} unpaired resamples, on one shared range. coverage64: the first 50 coverage trials at 64 rows (truth ${ctx.truth.mean}): each trial's row-percentile and word-percentile interval and whether it held the truth. byPosition: the model's mean loss and the generator's exact expected loss at each of the 24 positions of a row. widths: the mean-loss interval width at 16, 64, 256 and 1,024 rows: row bootstrap, word bootstrap and row normal.`,
    bootstrap64: { point: scoreOf(unitsOf(s64, "loss", "row")), row: hRow, word: hWord, rowInterval: row.interval(), wordInterval: word.interval() },
    pairedVsUnpaired: { point: scoreOf(A) - scoreOf(B), paired: hP, unpaired: hU },
    coverage64: { truth: ctx.truth.mean, trials: trials.map((t) => ({ mean: t.mean, row: [t.rowPct.lo, t.rowPct.hi, t.rowPct.hit], word: [t.wordPct.lo, t.wordPct.hi, t.wordPct.hit] })) },
    byPosition: { model: secs.items.modelByPosition, generator: ctx.truth.perPosition },
    widths,
  };
}
