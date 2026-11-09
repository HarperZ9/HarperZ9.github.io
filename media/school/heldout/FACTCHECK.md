# Fact check: F6 held-out set film (film.json, evidence.json, facts.json)

Checked 2026-10-15 by an independent sub-agent that did not write the script. Verdicts: correct, reword, wrong.

## What was read, and how

- Script: media/school/heldout/film.json (filled), every spoken line in `segments[].lines`. Host stage directions are not spoken and were not checked.
- Numbers: media/school/heldout/facts.json, read in full by a Node dump of every field.
- Code: system/school/heldout.mjs (samples, fitAndScore, polyStudy, polySpread, attentionGap, trainingBatches), tools/school/fill_heldout.mjs (first 90 lines: the polynomial controls and the seen/unseen rescoring), system/school/corpus.mjs (the whole generator and makeBatch), tinyformer-train.mjs (createTrainer: one makeBatch per update from rng(seed)), media/school/attention/model.json (metadata: 2,000 steps, batch 16, data seed 11).
- Reruns on CPU (no GPU, seconds each):
  1. Degree-15 and degree-3 fits rebuilt with heldout.mjs, and the held-out error split into points inside and outside the training points' x range.
  2. The language model's training stream regenerated exactly as the trainer draws it (rng(11), 2,000 updates of 16 rows of 24 tokens), with every row compared for exact repeats, and the lab's held-out rows and the next 16 unseen batches checked against it.
  3. 100,000 episodes drawn from the generator to see how often short sentences recur.
- Goodfellow, Bengio and Courville 2016, chapter 5: downloaded deeplearningbook.org/contents/ml.html (the official HTML of the chapter), stripped tags, read sections 5.2 and 5.3.
- Hoerl and Kennard 1970: open copy at papers.baulab.info/papers/also/Hoerl-1970.pdf (8 pages, a scan of the Technometrics article), text extracted with PyMuPDF. Read section 2 (eq. 2.1) and section 3b.

## Line by line

| Segment, line | Verdict | Reason and source location |
|---|---|---|
| title, 0 | correct | Not a factual claim. |
| title, 1 | correct | Metaphor. |
| points, 0 | correct | facts `poly`: nTrain 16, truth sin(pi x), Gaussian noise sigma 0.2. |
| points, 1 | correct | Degree 1 train RMSE 0.445, degree 3 0.192, degree 15 1.4e-11 (facts `poly.degrees`). Degree 15 has 16 coefficients for 16 points. |
| points, 2 | reword | facts `poly.ridge.rows[0].trainRmse` 1.424e-11: "about one part in a hundred billion" is right. "As close to zero as the arithmetic goes" is not: double precision resolves about 1e-16. The 1e-11 floor comes from a badly conditioned system (facts `rDiagRatio` 4.41e6, a lower bound on the condition number). The fit is exact in theory; what is left is rounding. |
| held, 0 | correct | facts `poly.nHeld` 500, same source, seed 22. |
| held, 1 | reword | Numbers right: degree 3 held RMSE 0.33043, degree 15 3,936. "Between the points it learned, it swings off the chart" misplaces where the 3,936 comes from. My rerun: on the 408 held-out points inside the training points' range (x from -0.804 to 0.843), degree 15's RMSE is 2.99 and the curve stays within plus or minus 13.1. On the 92 held-out points beyond the outermost training points, its RMSE is 9,176, and at x = -1 the curve is at -35,560 (facts `poly.curves.byDegree.15`). It does swing hard between the points (13 against data within about 1.3), but the huge number is mostly past the ends. |
| held, 2 | reword | Training error never rises with degree (facts `poly.degrees` trainRmse is non-increasing, as nested least squares must be): correct. Held-out error goes 0.73, 0.53, 0.54, 0.33, 0.48, 0.34, 0.40, 0.49, 2.6, 2.1, 1.6, 14.0, 14.9, 42.7, 25.2, 3,936. The trend is the U of Goodfellow sec. 5.2 ("generalization error has a U-shaped curve as a function of model capacity", Fig. 5.3), but it is not a clean turn: it bounces at degrees 4 to 5, 8 to 10 and 13 to 14. |
| leash, 0 | correct | Hoerl and Kennard eq. (2.1): estimate [X'X + kI]^-1 X'Y; sec. 3b: equivalently the B of least squared length B'B for a given rise in residual sum of squares. "Charge it for every large number" is a fair gloss of a penalty on the sum of squares, which falls mostly on the large numbers. Our version leaves the constant term free (facts `poly.about`). |
| leash, 1 | reword | Numbers right: lambda 0 gives 3,936, lambda 0.01 gives 0.42931, lambda 100 (the heaviest of the 7) gives 0.70337. Two problems. (a) Lambda 0.01 is the middle of the grid; the lightest charge tried (1e-8) only gets to 20.4, so "a light charge" misleads. (b) 0.01 is "the best of 7" judged on these same held-out points (evidence `ours-poly`, fill picks bestLambda by heldRmse). That is exactly the use the `rules` segment says spoils a held-out set, so 0.43 flatters the leash slightly. A careful viewer will catch this; the line should own it. |
| spiral, 0 | correct | facts `spiral.small.nTrain` 40, `spiral.full.nTrain` 400; same F4 network. |
| spiral, 1 | correct | facts `spiral.small.finalAccuracy` 1, `finalHeldAccuracy` 0.7825 (78.3), `spiral.full.finalHeldAccuracy` 0.995. |
| spiral, 2 | wrong | First two sentences correct: held-out loss minimum at update 300 (0.6479), then it rises to 1.487 while the training loss falls (0.558 at 300 to 0.00084 at the end; 4 small upticks in 100 checkpoints). The third sentence is contradicted by the same run: held-out accuracy at the loss minimum is 0.6875, and it keeps rising to 0.8025 at update 1,000 before settling at 0.7825 (facts `spiral.small.curve`). For 700 updates after the minimum, the network was still getting better at new spiral points. The held-out loss rises because the network grows more confident, including on the new points it gets wrong. Stopping at 300 by loss would have cost about 10 points of accuracy. |
| spread, 0 | reword | Numbers right: five 40-point draws (seeds 1, 11, 21, 31, 41) give 0.755 to 0.86 (facts `spiral.draws`). But the draws change the training points with the held-out set fixed, so the first sentence names the wrong thing: it is the training set that is one draw here. |
| spread, 1 | correct | facts `poly.spread.bestDegreeCounts.3` 113 of 200, held-out set fixed. |
| model, 0 | wrong | corpus.mjs builds each row from fresh random episodes, and nothing stops a row or a sentence from coming round again. Sentence level: the generator's plain sentences are a fixed list of eight ("the tide came in", "pylon watched the dock" and so on); in 100,000 episodes each appears about 1,250 times. Row level, my regeneration of the trainer's stream (rng(11), 2,000 updates of 16 rows): 507 of 32,000 rows exactly repeat an earlier row (31,493 distinct; one row came round 5 times). So "never saw the same sentence twice" is false. The conclusion, that it can't have learned its training rows by heart, is still roughly right because exact repeats are rare (1.6 percent of rows), but it must be stated with the repeats. heldout.mjs's comment and facts `attention.about` ("no row is shown twice by design") carry the same error. |
| model, 1 | reword | Numbers right: last 16 trained batches 0.6258, next 16 batches 0.6678 (facts `attention.rescored`). But 8 of those 256 "next" rows also appear among the training rows, so "sentences ... it never saw" overstates. Also, the 0.63 comes from the last 16 batches, which the model had just stepped on; the first 16 batches, seen long ago, score 0.6437. The gap is small either way. |
| model, 2 | correct | facts `attention.rescored.heldOut.loss` 0.6874; five fresh draws 0.6497 to 0.6723. Note: 3 of the 256 lab held-out rows also appear verbatim among the training rows; too few to move 0.69 noticeably, but worth a note in evidence. |
| rules, 0 | correct | Goodfellow sec. 5.3: "test examples are not used in any way to make choices about the model, including its hyperparameters." |
| rules, 1 | correct | Goodfellow sec. 5.3: the validation set is split from the training data, and "after all hyperparameter optimization is complete, the generalization error may be estimated using the test set." "Looks at it once" is a slight strengthening; the same section warns that repeated use of one test set makes it optimistic, which supports it. |
| close, 0 | correct | Summary. |
| close, 1 | correct | Not a factual claim. |

Counts: 14 correct, 6 reword, 2 wrong (22 spoken lines).

## Suggested rewordings (exact replacement text)

points, 2:
> The wild one gets every point right: its error on them is about one part in a hundred billion. That's zero, apart from rounding in the arithmetic.

held, 1:
> On those, the gentle curve's error is 0.33. The wild one's is 3,936. Between the points it learned it swings wildly, and past the outermost ones it shoots off the chart.

held, 2:
> Make the curve more flexible, step by step, and the error on the training points only ever goes down. The error on the held-out points goes down, then turns around and climbs, with a few bumps on the way.

leash, 1:
> A moderate charge brings its held-out error down from 3,936 to 0.43. That's the best of seven charges we tried, picked by looking at these same held-out points, so it flatters the leash a little. Pull too hard and it gets worse again: at the heaviest pull we tried, 0.70.

spiral, 2 (wrong):
> Watch the held-out loss. It's lowest early, at step 300, and then climbs while the training loss keeps falling. Its score on new points still creeps up for a while, to 80 percent by step 1,000, but it grows ever more sure of itself, wrong answers included. After that the score stops improving, and training only tightens its grip on these forty points.

spread, 0:
> And a score from one training set is one draw. Pick five different sets of 40 training points, and the held-out score runs from 75.5 to 86.0 percent.

model, 0 (wrong):
> The language model from the attention lesson was trained on a stream of freshly made sentences, a new batch every step. Its little grammar does repeat itself, and about one training row in sixty is an exact copy of an earlier one. But no row came round more than five times, so it had little chance to learn its training rows by heart.

model, 1:
> Score the finished model on rows it trained on, and its loss is about 0.63. On the next stretch of the same stream, which it didn't train on, 0.67. A small gap, not a chasm.

## Corrections to evidence.json

`goodfellow2016`
- `read`: "Full text of chapter 5 from deeplearningbook.org/contents/ml.html (official HTML), sections 5.2 and 5.3, read 2026-10-15."
- claim 1, replace with: "As capacity increases, training error decreases while the gap to generalization error grows; generalization error has a U-shaped curve as a function of capacity (section 5.2, Figure 5.3)."
- claim 2: correct as written. Source text: test examples are "not used in any way to make choices about the model, including its hyperparameters"; the validation set is built from the training data (section 5.3).

`hoerl1970`
- `read`: "Full text, open scan at papers.baulab.info/papers/also/Hoerl-1970.pdf, 2026-10-15: section 2 (eq. 2.1) and section 3b."
- replace the claim with: "The ridge estimate is [X'X + kI]^-1 X'Y with k >= 0 (eq. 2.1); equivalently, the coefficients of least squared length B'B for a given increase in the residual sum of squares (section 3b). Our lambda plays the role of k; our constant term is not penalised."

`ours-poly`
- add a claim: "Degree 15's held-out error is mostly beyond the outermost training points: RMSE 2.99 on the 408 held-out points inside the training x range (-0.804 to 0.843), 9,176 on the 92 outside it. Recomputed with heldout.mjs on 2026-10-15."
- add to `does_not_prove`: "That degree 3 or lambda 0.01 is the right choice: both were picked on the same 500 held-out points the film reports."

`ours-spiral`
- add to claim 1: "Held-out accuracy at the loss minimum (update 300) is 0.6875; it peaks at 0.8025 at update 1,000 and ends at 0.7825. Over the five draws the held-out loss minimum falls at updates 300, 300, 0, 800 and 1,400."

`ours-model`
- replace claim 1 with: "The trainer draws a fresh batch every update, but rows are generated independently, so repeats happen by chance. In the 32,000 training rows (data seed 11, 2,000 updates of 16), 507 repeat an earlier row exactly (31,493 distinct; at most 5 copies of one row). 8 of the 256 'next unseen' rows and 3 of the 256 lab held-out rows also appear among the training rows. Counted by regenerating the stream with corpus.mjs on 2026-10-15."
- replace `does_not_prove` with: "That the model would not memorise with heavily repeated data; repeats here are rare (1.6 percent of rows), not absent."
