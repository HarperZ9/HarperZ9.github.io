# Fact-check: F4, "Backpropagation: blame, passed backwards"

Checked by an independent sub-agent that did not write the script, on 2026-10-15.

## What was read, and how

| Source | How it was read | Result |
|---|---|---|
| `film.json`, `film.template.json`, `evidence.json`, `facts.json` | Read in full (bulk arrays inspected by script) | Every spoken line listed below |
| `system/school/backprop.mjs`, `backprop-attention.mjs`, `tools/school/fill_backprop.mjs`, `tinyformer-model.mjs`, `tinyformer-ops.mjs` (function list), `tinyformer-train.mjs` (optimiser), `media/school/attention/model.json` (config) | Read in full or the relevant parts | Numbers traced to code |
| Linnainmaa 1970 | Not read (Finnish MSc thesis). Read A. Griewank, "Who Invented the Reverse Mode of Differentiation?", Documenta Math. Extra Volume ISMP (2012) 389-400, full text, and J. Schmidhuber's page "Who invented backpropagation?" | Confirmed through secondary sources |
| Rumelhart, Hinton, Williams 1986, Nature 323, 533-536 | Nature full text paywalled; the free PDF link on ML Anthology returned an HTML page. Read the abstract (ML Anthology) and the Schmidhuber account | Abstract-level confirmation only |
| Griewank and Walther 2008 | Not read (SIAM book, paywalled). Read Griewank 2012 (above), which states the same complexity result | Confirmed through the 2012 paper |

## Line by line

Verdicts: correct, reword, wrong.

| Segment, line | Verdict | Reason and source |
|---|---|---|
| title, 0 | correct | Title. |
| title, 1 | correct | F3's toy surfaces had two numbers; the attention model has 20,864. |
| network, 0 | correct | `twoSpirals`, two classes. |
| network, 1 | correct | Sizes [2, 8, 8, 2]; 2x8+8 + 8x8+8 + 8x2+2 = 114 (`facts.net`). Inputs at the top and outputs at the bottom matches a chain drawn top to bottom. |
| network, 2 | reword | True for the 16 hidden buckets (weighted sum plus bias, then tanh). The two output buckets do not squash one at a time: their totals go through a softmax together (`forward`, z3 then p). |
| nudge, 0 | correct | Cross-entropy loss at the output; 114 slopes. |
| nudge, 1 | correct | One extra forward run per number with a one-sided difference; 20,864 for the attention model. (The check later uses central differences, two runs per number; the line says "one extra run", which is the minimum, so it stands.) |
| back, 0 | correct | One forward pass, then the reverse sweep. |
| back, 1 | reword | Two problems. There are two output buckets, not one "last bucket". The line also leaves out the sum: a bucket that fed several buckets adds the blame from all of them (`backDense`: da[k] = sum over m of dz[m] W[k, m]). Without the sum the chain rule is stated wrongly for any bucket with more than one child, which is every hidden bucket here. |
| back, 2 | correct | Griewank 2012 (p. 389, p. 392): Linnainmaa conceived the reverse mode in 1970 and used it to estimate rounding errors; English publication 1976 (BIT). Schmidhuber: the 1970 thesis gives reverse mode with FORTRAN code, "without reference to NNs"; Rumelhart, Hinton and Williams showed experimentally that it yields useful internal representations in hidden layers. Their abstract says hidden units come to represent important features of the task. "Showed what it could do for training networks" is fair and does not claim priority. Werbos (1982) applied it to neural networks earlier (Griewank 2012 p. 390); the line does not contradict that. |
| cost, 0 | correct | One reverse sweep gives the gradient of a scalar loss with respect to every number. |
| cost, 1 | reword | The numbers 98, 208 and 2.122 match `facts.cost` and `countOps`. "Every multiply and add" overstates the count: it counts one multiply-add per weight use, plus 2 for the softmax normalisation and 32 for the local-derivative products; it leaves out bias additions, the softmax sum and the bias-gradient additions, and the 19 tanh, exp and log calls are counted apart. "Not 114 runs. About two." compares the backward pass with extra forward runs, so it should say "extra". Griewank 2012 (p. 396) gives the general result as OPS{gradient} <= omega OPS{function} with omega depending on the cost measure, exactly 3 for multiplication counts of polynomial programs; that bound compares the whole gradient evaluation, forward plus reverse, which here is (98 + 208) / 98 = 3.12. "About two" is our measurement of the reverse sweep alone and must not be read as the general bound; the line does not present it as one, so a reword is enough. |
| check, 0 | correct | `gradCheck`: central differences, eps 1e-6, every one of the 114 numbers, mean loss over 16 training points. |
| check, 1 | wrong | "The worst disagreement is about one part in a billion" holds for the worst tensor (W1, 1.24e-9, an L2 relative error over the whole tensor). The worst single number disagrees by 3.31e-8 (`afterTraining.worstEntry`), about 30 times larger. Read literally, the line is wrong. The phrase is also typed by hand in the template. |
| check, 2 | correct | Control uses 1 - a instead of 1 - a^2 for the second hidden layer. After training: W2 0.969 and b2 0.982 (that layer) fail; W1 1.06 and b1 1.00 (the layer above) fail; W3 8.98e-10 and b3 1.06e-9 (the output layer, below the break) pass. "Above" and "below" are right for a chain drawn with inputs at the top. The control also fails before training (W2 0.106, b1 1.06). |
| learn, 0 | correct | `train`: minibatches of 32, fixed step 0.3, no momentum. |
| learn, 1 | reword | Held-out accuracy 0.355 at step 0 (142 of 400; "36 percent" is the rounding). The curve is sampled every 100 steps: 0.9425 at step 1,900 and 0.965 at step 2,000, so it passes 95 percent somewhere after step 1,900 and by step 2,000, not at it. 0.9975 at step 4,000 (399 of 400). |
| big, 0 | reword | The hand-written backward passes are real: `attnBackward`, `layerNormBackward`, `geluBackward`, `matmulBackward`, `softmaxXent` in tinyformer. But "does exactly this" follows a line about plain downhill steps, and the attention model trains with AdamW, warmup, weight decay and gradient clipping (`tinyformer-train.mjs`, `createTrainer`), with batch 16. The forward and backward walk is the same; the step rule is not. |
| big, 1 | correct | 36 entries (9 tensors x 4), two held-out rows. Worst float64 relative error 2.86e-7 (l1.wqkv[333]), "a few parts in ten million". "Full precision" means a float64 copy of the float32 weights; "double precision" is more exact. The float32 check, as the model is run, is worst at 1.0e-2; the line does not mention it, which is acceptable. The phrase is typed by hand in the template. |
| close, 0 | correct | Summary of verified claims. |
| close, 1 | correct | F5 covers other step rules (`backprop.mjs`, `train` comment: momentum and Adam are lesson F5). |

Counts: 21 lines. Correct 15, reword 5, wrong 1.

## Suggested rewordings (exact replacement text)

check, 1 (wrong). Replace with:

> After training, they agree layer by layer to about one part in a billion, and the worst single number is off by about three parts in a hundred million.

Fill "one part in a billion" from `gradientCheck.afterTraining.worst` and "three parts in a hundred million" from `gradientCheck.afterTraining.worstEntry`, so neither is typed by hand.

network, 2. Replace with:

> Every bucket in the middle takes what the buckets above hand it, weighs it, adds it up, and squashes the total through a smooth curve. The last two turn their totals into two guesses that add up to one. That's the forward pass.

back, 1. Replace with:

> Each bucket at the bottom knows how much the loss changes when its own output changes. It hands that blame up to each bucket that fed it, multiplied by how much its own output moved when that input moved. A bucket that fed several adds up the blame from all of them, then does the same, all the way to the top.

cost, 1. Replace with:

> Counting multiply-adds for one point, and leaving the curves aside: the forward pass takes 98, the backward pass 208, about 2.12 times as many. Not 114 extra runs. About two runs' worth.

learn, 1. Replace with:

> On points it never trained on, the network starts out right 36 percent of the time. It is past 95 percent by step 2,000, and after 4,000 steps it gets 99.8 percent right.

big, 0. Replace with:

> The model from the attention lesson walks forward and back the same way, with a backward pass written out by hand for every part: the attention, the layer norms, the bends. It steps downhill a little more cleverly, and that's next time.

## Corrections to evidence.json

`linnainmaa1970`
- read: "Thesis not read (Finnish). Read Griewank, A. (2012), Who invented the reverse mode of differentiation?, Documenta Mathematica Extra Volume ISMP, 389-400, in full, and Schmidhuber's 'Who invented backpropagation?' page."
- claims[0]: keep, and append "for estimating the effect of rounding errors, without reference to neural networks; published in English in 1976 (BIT). Others found the reversal independently, including Ostrowski et al. in chemical engineering and Werbos (1982) for neural networks (Griewank 2012, pp. 389-392)."

`rumelhart1986`
- read: "Abstract only (ML Anthology mirror; Nature full text paywalled). Secondary: Schmidhuber's history page, which describes the paper as an experimental analysis showing that back-propagation yields useful internal representations in hidden layers."
- claims[0]: consistent with the abstract; keep.

`griewank2008`
- read: "Book not read (SIAM, paywalled). Read instead Griewank, A. (2012), Who invented the reverse mode of differentiation?, Documenta Mathematica Extra Volume ISMP, 389-400: OPS{F'(x)} <= m omega OPS{F(x)}, with omega depending on the cost measure and platform, exactly 3 for multiplication counts of polynomial operations; m = 1 for a scalar loss (the cheap gradient principle)."
- Consider citing the 2012 paper as the source read, or add it as a second source.
- does_not_prove: append "Our 2.12 is the reverse sweep alone; the bound compares forward plus reverse with the forward pass, which here is 3.12."

`ours-net`
- claims[1]: append "; worst single entry 3.31e-8 after training".
- claims[2]: change "0.95 first reached at step 2,000" to "0.95 first reached by step 2,000 (curve sampled every 100 steps; 0.9425 at 1,900)".

`ours-model`
- claims[0]: append "Training of this model uses AdamW with warmup, weight decay and gradient clipping (tinyformer-train.mjs), not plain gradient descent."
