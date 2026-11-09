# Fact check: F5 optimisers film (film.json, evidence.json, facts.json)

Checked 2026-10-15 by an independent sub-agent that did not write the script. Verdicts: correct, reword, wrong.

## What was read, and how

- Script: media/school/optimisers/film.json (filled), every spoken line in `segments[].lines`. Host stage directions are not spoken and were not checked.
- Numbers: media/school/optimisers/facts.json, read in full by a Node dump of every field.
- Code: system/school/optimisers.mjs (all of it: sgd, heavyBall, adam, adamw, run2d, bestOf, RACES, momentumStudy), tinyformer-train.mjs (all of it: the AdamW step and the trainer), tinyformer-model.mjs (paramSpecs, the decay flag per tensor), corpus.mjs (generator and makeBatch), gradients.mjs (makeBowl, ROSENBROCK lines), tools/school/fill_optimisers.mjs (the 95 percent rule `q[key] >= SP.target`, the selection on the validation draw, the transformer setup), media/school/attention/model.json (metadata and curve), media/school/gradients/film.json (to confirm what "last time" refers to).
- Reruns on CPU (no GPU, under a second each): the Rosenbrock race for Adam at alpha 1e-3 and the heavy ball at 3e-3, through `run2d`; a count of the trainable numbers the trainer decays; model.json's copy-accuracy curve.
- Kingma and Ba, arXiv:1412.6980 v9: PDF downloaded from arxiv.org, text extracted with PyMuPDF. Read Algorithm 1, section 2.1, section 3.
- Loshchilov and Hutter, arXiv:1711.05101: PDF from arxiv.org, text extracted. Read section 2, eq. (1), Algorithm 2, Proposition 2 and the paragraph after it.
- Loshchilov and Hutter, arXiv:1608.03983 (SGDR): PDF from arxiv.org, text extracted. Read eq. (5) and the paragraph around it.
- Goyal et al., arXiv:1706.02677: PDF from arxiv.org, text extracted. Read section 2.2.
- Polyak 1964: NOT read. The Elsevier copy is paywalled, and the mathnet.ru record (which lists the Russian full text) refused the connection from both WebFetch and curl on 2026-10-15. I checked the update rule against an open secondary account instead: arXiv:2410.16849 v2, eq. (1) and (2), which attribute both the discrete update and the heavy-ball ODE with friction to "[Pol64]". I could not confirm whether the 1964 paper itself uses the name "heavy ball".

## Line by line

| Segment, line | Verdict | Reason and source location |
|---|---|---|
| title, 0 | correct | Not a factual claim. |
| title, 1 | correct | Refers back to F4 (gradients film). |
| valley, 0 | correct | gradients/film.json `valley` segment: "steep across and almost flat along"; the surface is ROSENBROCK (gradients.mjs). |
| valley, 1 | correct | facts `races.rosenbrock.entrants.sgd`: chosenLr 0.0015 from grid of 5, stepsToThreshold 6217, threshold 1e-4. Step 0.002 dips under at 4,630 but does not stay (stepsToThreshold null), which supports "have to stay small". `run2d` defines stepsToThreshold as staying under to the end of the run, so "and keep it there" is right. |
| momentum, 0 | correct | optimisers.mjs `heavyBall`: `theta - lr*g + beta*(theta - prev)` with beta 0.9 (facts `races.rosenbrock.settings.momentum.beta`). "Keeps 90 percent of the last step's motion and adds the new slope on top" is this update in words. Matches arXiv:2410.16849 eq. (1). |
| momentum, 1 | correct | Standard intuition for momentum in a narrow valley. Not separately measured, but consistent with the 285 against 6,217 result. |
| momentum, 2 | reword | Polyak 1964 introduced the method (secondary: arXiv:2410.16849, "introduced by Polyak in his seminal work [Pol64]"). I could not read the 1964 text, so I cannot confirm he used the name "heavy ball" there. Safer wording below. |
| adam, 0 | correct | Kingma and Ba, Algorithm 1: exponential moving averages of g and g squared, elementwise. |
| adam, 1 | wrong | Second and third sentences. If a direction's slope is steady, Adam's step there is about alpha whatever the steepness: mhat/sqrt(vhat) is about plus or minus 1. Kingma and Ba sec. 2.1: "In more common scenarios, we will have that mhat/sqrt(vhat) is about plus or minus 1", and the step "is also invariant to the scale of the gradients". Our own facts.json shows it: `rules.biasCorrection`, gradient (0.5, -0.002), and both coordinates move by exactly 0.001 per step. A steep steady direction and a gentle steady direction get the same step. Relative to plain descent the steep one is slowed and the gentle one sped up, which is probably what was meant. The step gets short when the slope keeps changing sign (sec. 2.1, smaller "signal-to-noise ratio" gives a smaller step). |
| adam, 2 | reword | At t = 1, Algorithm 1 gives mhat = g, vhat = g squared, so the step is alpha times g / (abs(g) + eps). That equals alpha only up to eps (1e-8), and it is zero in any coordinate whose first gradient is zero. "Exactly" and "in every direction" both overreach slightly. The paper does not state the first-step fact; it follows from Algorithm 1. Section 3 supports "scales them back up": the correction divides by (1 - beta^t). |
| race, 0 | correct | Grids of 5 to 7 steps per walker (facts `races.*.entrants.*.grid`); bestOf picks fewest updates. |
| race, 1 | correct | facts `races.rosenbrock`: heavy ball 285 (rerun: 285), plain 6,217, Adam firstBelow 10,346, stepsToThreshold 16,790. My rerun of Adam crosses the 1e-4 line 18 times between 10,346 and 16,790 (worst loss in that span 0.0022), so "keeps wandering around it" holds. "After 16,790": that is the first update from which it stays under; "from step 16,790" is exact, "after" is acceptable. |
| race, 2 | correct | facts `races.bowl`: sgd 33, momentum 146, adam 146. Both others are 146. |
| edge, 0 | correct | facts `aboveEdge.plainBound` predicted 0.5, measured 0.5; gradients/film.json `step` segment gives the same edge. Step 0.6 is 1.2 times it. |
| edge, 1 | reword | Numbers right: sgd diverges (final loss 1.7e12), heavy-ball edge measured 0.95 (`momentumBound.measured` 0.949999999999, predicted 2(1+0.9)/4), heavy ball converges in 158, Adam converges in 145. The "so" overstates. Not growing with the slope explains why Adam does not fly off. It does not by itself explain why it settles: Adam's steps stay near alpha = 0.6 until the slope's sign starts flipping and the step shrinks (Kingma and Ba sec. 2.1, "a form of automatic annealing"). |
| schedule, 0 | correct | Goyal sec. 2.2: warmup is "using less aggressive learning rates at the start of training" because "the network is changing rapidly, which commonly occurs in early stages of training". SGDR eq. (5) is a half cosine from eta_max to eta_min. Goyal does not claim warmup is common; "many models" is general practice in the field, not a claim from this source. Our own language model uses warmup then a flat step (facts `schedules.labTrainer`), which the line does not contradict. |
| schedule, 1 | reword | Loshchilov and Hutter Algorithm 2 line 12: theta minus eta_t (Adam step + lambda theta), so the shrink fraction is eta_t lambda: fixed only while the schedule multiplier is fixed. Sec. 2: decoupled decay "regularizes all weights with the same rate", and "both mechanisms push weights closer to zero". In our language model (the next segment says it trains with AdamW) the decay is NOT on every number: tinyformer-model.mjs `paramSpecs` marks gains and biases false; 20,096 of 20,864 numbers decay. Its fraction is lr times 0.01, which grows during the 30-step warmup. "Pulls numbers that aren't earning their keep back towards zero" is a fair plain gloss: every decayed number is pulled at the same rate, and only numbers the loss gradient pushes back on stay large. The paper does not use this phrasing. |
| real, 0 | correct | facts `spiral.arms.*.firstHeldAtTarget` 2000, 1300, 900; steps chosen on the validation draw (seed 4), held-out seed 2 (`spiral.about`, fill_optimisers.mjs line 99). "Pass" is `>= 0.95` in fill_optimisers.mjs; accuracy is checked every 100 updates, so each number is the first checkpoint at or above 95 percent. |
| real, 1 | reword | facts `spiral.seedSpread.arms.adam.finalHeldAccuracy` min 0.9175, max 0.9925 (91.75 rounds to 91.8). Each rerun changes both the starting network and the batch order (`seedSpread.seeds` are pairs), so "five different starting networks" is incomplete. "Less steady" rests on one outlier run (row 4: 0.9175, and 3,100 updates to 95 percent, slower than plain descent's worst of 2,500). The listener has no comparison: plain descent stays between 99.0 and 99.75, heavy ball between 99.5 and 99.75. |
| real, 2 | correct | facts `transformer.arms`: AdamW 0.8456, heavy ball 0.8925, plain 0.9608; same model seed 7 and data seed 11; trainer is AdamW (tinyformer-train.mjs `adam`). Unstated but not misleading at this level: the AdamW arm also has weight decay and beta2 0.99, the others have no decay; one seed; steps picked on 64 validation rows. |
| limits, 0 | correct | Matches evidence `does_not_prove`. |
| limits, 1 | reword | model.json `steps` 2000, so 400 is the first fifth, not "the very start". Copy accuracy at 400 is 0.32 (facts `transformer.arms.adamw.finalCopyAccuracy` 0.3221), against chance 0.10 (model.json `baselines.copyChance`) and 0.99 at 2,000; it rises past 0.93 by 700. "Hasn't learned to copy yet" is fair in spirit; "barely started" is more exact. |
| close, 0 | correct | Summary of the race results above. |
| close, 1 | correct | Not a factual claim. |

Counts: 17 correct, 6 reword, 1 wrong (24 spoken lines).

## Suggested rewordings (exact replacement text)

momentum, 2:
> Boris Polyak described it in 1964. It's known as the heavy ball method.

adam, 1 (wrong):
> It divides the first by the square root of the second. So a direction with a steady slope gets a step of about the same size, however steep or gentle it is: steep directions are slowed down, gentle ones sped up. A direction whose slope keeps flipping gets a short step.

adam, 2:
> Both averages start at zero, so at first they're too small. Adam scales them back up, so its very first step is the step size you chose, to within a hair, in every direction that has any slope at all.

edge, 1:
> Careful steps fly off, as before. The heavy ball's edge here is 0.95, so it gets down. Adam's steps don't grow with the slope, so it doesn't fly off, and here it gets down too.

schedule, 1:
> And AdamW adds one more thing: almost every number shrinks by a small fraction at each step, kept separate from Adam's own step. It pulls numbers that aren't earning their keep back towards zero.

real, 1:
> But run five different starting networks and batch orders, and Adam's final score ranges from 91.8 to 99.3 percent, while careful steps stay between 99.0 and 99.8. Fast, and on this network, less steady.

limits, 1:
> And four hundred steps is the first fifth of the language model's training. It has barely started to copy, so this shows who gets off the line fastest, not who finishes best.

## Corrections to evidence.json

`polyak1964`
- `read`: "Not read: paywalled at Elsevier, and the mathnet.ru full text did not respond on 2026-10-15. Update rule checked against an open secondary account, arXiv:2410.16849 v2, eq. (1) and (2), which attribute it and the friction ODE to Polyak 1964. Whether the 1964 paper uses the name 'heavy ball' is unverified."
- `claims`: keep as written (it matches arXiv:2410.16849 eq. (1) and optimisers.mjs `heavyBall`).

`kingma2015`
- `read`: "Full text, arXiv:1412.6980 v9 PDF, 2026-10-15: Algorithm 1, section 2.1, section 3."
- replace claim 2 with: "At t = 1 the bias-corrected step is alpha g / (|g| + eps) in each coordinate (Algorithm 1), so about alpha wherever the first gradient is not zero. Section 2.1: the step is approximately bounded by alpha and invariant to the scale of the gradients; a smaller signal-to-noise ratio gives a smaller step."
- add to `does_not_prove`: "That steep directions get shorter steps than gentle ones: with a steady slope, every direction's step is about alpha."

`loshchilov2017`
- `read`: "Full text, arXiv:1608.03983 PDF, 2026-10-15: eq. (5) and the paragraph around it."

`loshchilov2019`
- `read`: "Full text, arXiv:1711.05101 PDF, 2026-10-15: section 2, eq. (1), Algorithm 2 line 12, Proposition 2."
- replace the claim with: "AdamW applies weight decay directly to the weights, separately from the adaptive gradient step (Algorithm 2 line 12), at a per-step fraction eta_t lambda, where eta_t is the schedule multiplier; section 2: it regularizes all weights with the same rate. Our trainer decays matrices and embeddings only (20,096 of 20,864 numbers), never gains or biases."

`goyal2017`
- `read`: "Full text, arXiv:1706.02677 PDF, 2026-10-15: section 2.2."
- replace the claim with: "Gradual warmup ramps the learning rate from small to large over the first 5 epochs, for large minibatches, because the network changes rapidly early in training (section 2.2)."
- add to `does_not_prove`: "How common warmup is."

`ours-spiral`
- add to claim 2: "Each of the five reruns changes both the network seed and the batch seed. Plain descent's final held-out accuracy ranges from 0.99 to 0.9975, heavy ball's from 0.995 to 0.9975."

`ours-model`
- add a claim: "The AdamW arm also differs from the other two in weight decay (0.01 times lr, on matrices and embeddings) and beta2 (0.99). At update 400 copy accuracy is 0.32 for AdamW; the full 2,000-update run reaches 0.99 and passes 0.93 by update 700."
