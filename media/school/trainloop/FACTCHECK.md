# Fact-check: L12 The training loop

Checked 2026-10-15 against `media/school/trainloop/facts.json`, `film.template.json` (token paths), `system/school/trainloop.mjs`, `system/school/tinyformer-train.mjs`, `system/school/tinyformer-model.mjs`, `tools/school/fill_trainloop.mjs` and the sources in `evidence.json`. The fill was not re-run; no number disagreed with the code or the facts. Scripts, facts and code were not edited.

Summary: 20 film lines checked. 13 correct, 6 reword, 1 wrong. Evidence text: 8 claims checked, 7 correct, 1 reword.

Reference values: a uniform guess over 46 words scores ln 46 = 3.83 nats. Format rules from `tools/school/fill_script.mjs`: `int` rounds, `f2` gives two decimals, `pct` rounds v x 100.

## Film lines

| # | Segment | Line or claim | Verdict | Evidence | Suggested rewording |
|---|---|---|---|---|---|
| 1 | title | "The training loop. Four steps, two thousand times." | reword | `recipe.model.steps` 2000 (hand-typed but correct). The close names five steps ("Batch, forward, loss, backward, step"), and trainloop.mjs lists six including clip | "The training loop. Five steps, two thousand times." to match the close, or drop "loss" from the close. Consider filling "two thousand" from `recipe.model.steps`. |
| 2 | title | "Every lesson so far has a piece of training in it." | correct | Earlier films (vectors to decoding) each mention training, learning or downhill steps | |
| 3 | loop | "Take a batch of 16 rows ... score every next word: that is the loss." | correct | `recipe.model.batch` 16; `lossAndGrad`: mean cross-entropy over 16 x 24 = 384 targets | |
| 4 | loop | "the slope for every one of the model's 20,864 numbers. Then the optimiser takes one step downhill." | correct | `recipe.model.nParams` 20864; every tensor gets a gradient in `lossAndGrad` | |
| 5 | loop | "On one computer core, with this lesson's own code, a lap takes about 21 milliseconds, and most of that is the backward pass: 14 of them." | reword | `speed.msPerStep` 20.674; `speed.anatomy.backwardOnly` 14.0096 (68 percent). Numbers right. `speed.about`: "One machine and one engine: a browser tab or another CPU will differ." | "On one core of our test machine, with this lesson's own code, a lap takes about 21 milliseconds. Most of that, 14 of them, is the backward pass." |
| 6 | settings | "The optimiser is Adam, with a little weight decay that shrinks every number slightly each step, as in AdamW." | wrong | `adam()`: `wd = model.decay[name] ? weightDecay : 0`; `paramSpecs` marks gains and biases false. 768 of the 20,864 numbers never decay | "The optimiser is Adam, with a little weight decay, as in AdamW: each step shrinks the weight tables by one part in ten thousand, but leaves the biases and norm settings alone." (Shrink per step is lr x 0.01 = 0.0001 after warmup.) |
| 7 | settings | "starts tiny and grows over the first 30 laps to 0.01. That is warmup." | correct | `recipe.defaults.warmup` 30, `lr` 0.01; `recipe.warmupLr` step 1 at 0.000333 | |
| 8 | settings | "if a slope is ever too steep, longer than 1, it is shortened to 1 before the step ... It fired on 76 of the 2,000 laps, 62 of them in the first 250." | reword | `adam()`: one global L2 norm over all gradients, then every gradient scaled by clip / norm. `gradients.stats.clipped` 76, `n` 2000; `byWindow.0.clipped` 62, `to` 250 | "And if the whole slope, all 20,864 numbers taken together as one arrow, is ever longer than 1, the arrow is shortened to length 1 before the step. That is clipping. It fired on 76 of the 2,000 laps, 62 of them in the first 250." (As written, "a slope" can be heard as one number's slope.) |
| 9 | run | "At lap zero, the held-out loss is 3.84, a blind guess." | correct | `reproduce.milestones.0.heldOut` 3.8414, next to ln 46 = 3.83 | |
| 10 | run | "By lap 100 it is 0.97: the easy patterns, which word tends to follow which, come first." | correct | `reproduce.milestones.1` step 100, 0.9654; curve at 100: local accuracy 0.674 (final 0.700), copy 0.156 | |
| 11 | run | "Copying a word from far back comes late, and all at once. At lap 500, copying is right 43 percent of the time. By lap 750, 97 percent." | reword | `reproduce.milestones.2` 500: 0.4289; `.3` 750: 0.9684. `reproduce.curve` copy: 0.21 at 200, 0.34 at 300, 0.43 at 500, 0.66 at 650, 0.93 at 700. It climbs for 600 laps, then jumps | "Copying a word from far back comes late, and it finishes fast. It creeps up for hundreds of laps: right 43 percent of the time at lap 500. Then it jumps: 97 percent by lap 750." |
| 12 | run | "got the attention lesson's model back exactly: all 29 weight tables, number for number" | correct | `reproduce.tensorsEqual` 29, `tensorsTotal` 29; `pointsEqual` 81 of 81. Template note: the line fills from `tensorsTotal`, so it would still say "all 29" if a table failed to match. Fill it from `tensorsEqual`, or gate on equality | |
| 13 | change | "the same recipe on two other sets of training rows ends at 0.70 and 0.70, and the original at 0.70. Smaller differences than that are luck." | reword | `variants.noise.0` 0.7000, `.1` 0.7019; `variants.reference` 0.6981. The spread is 0.004, which two decimals hide. `variants.about`: differences smaller than the spread "are not evidence"; that does not make them luck, and two noise runs do not bound luck | "...ends at 0.70 and 0.70, and the original at 0.70: all three within 0.004 of each other. A difference that small cannot be told apart from luck." |
| 14 | change | "A step size ten times smaller ends at 0.78, and copies right only 54 percent of the time. Ten times larger ends worse, at 0.95, copying 22 percent." | correct | `variants.runs.0` lr 0.001: 0.7835, copy 0.5395; `runs.2` lr 0.1: 0.9506, copy 0.2174; reference lr 0.01, so "ten times" holds both ways | |
| 15 | change | "Without weight decay: 0.70, inside the noise ... it makes no difference we can see." | correct | `variants.runs.4` 0.6995, inside 0.6981 to 0.7019; copy 0.9822 against noise runs 0.9802 and 0.9921 | |
| 16 | change | "Batches of 4 rows for the same number of laps see a quarter of the text, and end at 0.87." | reword | `variants.runs.5` batch 4, 1000 laps, 96,000 target words against 384,000: a quarter, 0.8702. But `runs.6` (batch 4, 4,000 laps, the same 384,000 words) still ends at 0.7636, so text seen is only part of the gap | Add: "Give them the same text over 4,000 laps, and they still end at 0.76." |
| 17 | broken | "With a step size of zero, nothing moves: the loss stays at 3.84." | correct | `controls.runs.0` lr 0, 200 laps, every point 3.8414. Weight decay is scaled by lr, so it is zero too | |
| 18 | broken | "Turn every slope around ... the loss climbs to 68." | correct | `controls.runs.1` gradient sign -1, 68.4964 at lap 200 (32.4 at 50, 63.4 at 100) | |
| 19 | close | "Batch, forward, loss, backward, step. Two thousand times, and a blind guess becomes a model that copies." | correct | `reproduce.summary` copy 0.9921 at 2000; start 3.8414. Step count conflicts with row 1 | |
| 20 | close | "Next on the dock: what goes into the batches." | correct | `media/school/curriculum.json`: L13 "Data: what goes in comes out" follows L12 | |

Not graded: the host open and close stage directions and the two `predict` questions.

Side observation, no line affected: the lr 0.001 variant clipped on 989 of its 1,000 laps (`variants.runs.0.norms.clipped`), against 67 for the reference recipe's first 1,000. If the film ever explains why the small step size lags, that number belongs in the explanation.

## Evidence text

| # | Claim | Verdict | Evidence | Suggested rewording |
|---|---|---|---|---|
| E1 | ours-trainloop: 29 of 29 tensors byte for byte, 81 of 81 curve points | correct | `reproduce.tensorsEqual` 29, `pointsEqual` 81 | |
| E2 | ours-trainloop: clip at norm 1 fired 76 of 2000, 62 in 1 to 250; warmup 30 to 0.01 | correct | `gradients.stats`, `gradients.byWindow.0`, `recipe.defaults` | |
| E3 | ours-trainloop: held-out 3.84, 0.97, 0.82, 0.72 at 0, 100, 500, 750; copy 0.43 and 0.97 | correct | `reproduce.milestones` | |
| E4 | ours-trainloop: variants at 1,000 steps | correct | `variants.reference` 0.6981; noise 0.7000, 0.7019; runs.0, runs.2, runs.4, runs.5 as quoted | |
| E5 | ours-trainloop: controls 3.8414 and 68.5 | correct | `controls.runs` | |
| E6 | ours-trainloop: about 21 ms per step; forward 6.3, backward 14.0, update 0.2 | correct | `speed.anatomy.ms`, `speed.msPerStep` | |
| E7 | kingma2015: Adam "keeps running averages of each gradient and its square and steps by their ratio"; beta2 0.99 here, paper suggests 0.999 | reword | Algorithm 1 defaults: alpha 0.001, beta1 0.9, beta2 0.999, epsilon 1e-8; the update divides the bias-corrected first moment by the square root of the second; `adam()` uses beta2 0.99 | "...and steps by the first average divided by the square root of the second, both bias-corrected (Algorithm 1)." |
| E8 | loshchilov2019: decay applied to the weights apart from the gradient step (Algorithm 2); here scaled by the full learning rate | correct | Algorithm 2 line 12: theta_t = theta_{t-1} - eta_t (alpha m_hat / (sqrt(v_hat) + eps) + lambda theta_{t-1}); the decay carries eta_t but not alpha. `adam()`: `p -= lr * (adam_term + wd * p)` | |

## Sources read

**Kingma and Ba 2015, arXiv 1412.6980 (v9).** Read from the arXiv PDF (text extracted locally); the header confirms "Published as a conference paper at ICLR 2015". Algorithm 1: the default settings and the moment updates were legible. The Greek symbols in the bias-correction and update lines did not survive extraction, so those lines were checked by their structure plus my own knowledge of the algorithm (high confidence), not by a clean quote.

**Loshchilov and Hutter 2019, arXiv 1711.05101 (v3).** Read from the arXiv PDF (text extracted locally; header "Published as a conference paper at ICLR 2019") and the ar5iv HTML rendering for Algorithm 2, whose line 12 gave the update with symbols intact. Sections 2 and Appendix B.1 (normalised weight decay) skimmed; the film does not use normalised decay.

No source failed to load. The PDF text extraction lost Greek symbols in both optimiser papers; ar5iv filled the gap for AdamW but carried no rendering of the Adam paper.
