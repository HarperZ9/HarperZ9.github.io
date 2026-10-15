# Fact-check: F3, "Gradients: which way is downhill"

Checked by an independent sub-agent that did not write the script, on 2026-10-15.

## What was read, and how

| Source | How it was read | Result |
|---|---|---|
| `film.json`, `film.template.json`, `evidence.json`, `facts.json` | Read in full (bulk arrays inspected by script) | Every spoken line listed below |
| `system/school/gradients.mjs`, `gradients-landscape.mjs`, `tools/school/fill_gradients.mjs`, `tinyformer-model.mjs`, `tinyformer-train.mjs`, `corpus.mjs`, `media/school/attention/model.json` (config, seed) | Read in full or the relevant parts | Numbers traced to code |
| `media/school/gradients/proofs/proof.scene.mjs` | Read in full | Scene uses steps 0.25 and 0.60 |
| Re-run of `stepStudy` at 0.5, 0.6, 1, 1.2 and 2 times the edge (no GPU, a few seconds) | Node, read-only import of `gradients.mjs` | See "step" rows |
| Cauchy 1847, Comptes Rendus 25, 536-538 | Gallica scan returned HTTP 403 (also by curl). Read instead: C. Lemarechal, "Cauchy and the Gradient Method", Documenta Math. Extra Volume ISMP (2012) 251-254, full text, which quotes Cauchy's French in footnotes | Year, journal, pages and method confirmed through that secondary source; the primary scan was not read |
| Goodfellow, Bengio, Courville 2016, ch. 4 and ch. 8 | deeplearningbook.org HTML, text extracted and read for 4.2, 4.3, 4.3.1, 8.1.3, 8.2.1 | Confirmed, with one correction (the 2 / largest eigenvalue bound is not stated in the book) |
| Rosenbrock 1960, Computer Journal 3(3) 175-184 | OUP page: abstract and bibliographic data only; full text paywalled. GAMS model library (cites the paper) for the function form | Paper NOT read |
| Li, Xu, Taylor, Studer, Goldstein, arXiv 1712.09913v3 | Full PDF text extracted; read sections 1, 3, 4, 6, 7.1 | Confirmed; one wording problem |

## Line by line

Verdicts: correct, reword, wrong.

| Segment, line | Verdict | Reason and source |
|---|---|---|
| title, 0 | correct | Title. |
| title, 1 | correct | Framing only. |
| slope, 0 | correct | A partial derivative read as "how much higher per small step east". Goodfellow 4.3, derivative as slope (p. 81). |
| slope, 1 | correct | The gradient is the vector of partial derivatives. Goodfellow 4.3. |
| slope, 2 | correct | Goodfellow 4.3 (p. 83): "the gradient points directly uphill, and the negative gradient points directly downhill", the method of steepest descent; p. 81 cites (Cauchy, 1847) for gradient descent. Lemarechal 2012 p. 251: Comptes Rendus of 18 October 1847; p. 252 shows Cauchy's step alpha = -theta X, beta = -theta Y with X, Y the partial derivatives. Note Cauchy outlined the method and promised a fuller memoir that never appeared (Lemarechal p. 254); "wrote it down" is fair. |
| step, 0 | correct | Curvatures 4 and 0.5 from a finite-difference Hessian; ratio 8 (`facts.bowl.conditionNumber`). |
| step, 1 | correct, with a scene condition | The line is honest only if the scene's step before doubling is above half the edge. Doubling 0.25 (half the edge) gives exactly 0.5, the edge itself, where the steep direction neither shrinks nor grows: my re-run gives per-step factor 1.000 and loss 6.83 after 60 steps. That is not "over the edge". The current `proofs/proof.scene.mjs` shows 0.25 and 0.60, which is a factor of 2.4, not a doubling. The plan of 0.6x then 1.2x (0.3 then 0.6) does match "double": re-run gives 0.3 converges (factor 0.85), 0.6 diverges zigzagging (factor 1.40, passes 1e12 at step 39). Neither 0.6x nor 1.2x is in `facts.json` today. |
| step, 2 | correct | Predicted edge 2 / 4 = 0.5; measured edge 0.5 by bisection, relative gap 1.11e-13 (`facts.bowl`). "Overshoots further each time" for steps above 2 / largest curvature is a derivation from Goodfellow eq. 4.9 and 8.10 (a step goes uphill along a direction when 1/2 eps^2 g'Hg exceeds eps g'g), not a sentence in the book; it is exact for a quadratic. |
| step, 3 | wrong | "At twice it, after sixty steps, the loss is about two trillion" is false. `descend()` stops a run once the loss exceeds 1e12; the 2x run has 13 path points, so the 1.9292e12 is the loss at step 12, not step 60 (re-run confirms: steps 12). After 60 steps at factor 3 per step the loss would be near 1e58. The rest of the line is right: 0.5x converges smoothly (factor 0.875, no zigzag); 0.99x "converges slowly, zigzagging", loss 8.79 to 0.605; 1.01x "diverges, zigzagging". Also, every number in this line is typed by hand in `film.template.json`, against the file's own "no number typed by hand" rule. |
| valley, 0 | correct | Hessian of the Rosenbrock function at (1, 1) is [[802, -400], [-400, 200]]; eigenvalues 1001.6 and 0.399; ratio 2,508 (`facts.rosenbrock`). The code's function matches the GAMS form citing Rosenbrock 1960: 100 (y - x^2)^2 + (1 - x)^2. |
| valley, 1 | correct | Step 0.001, half the stable step at the minimum (0.0020). First step below 1e-2: 3,925; below 1e-6: 15,068 (`firstStepBelow`, path recorded every step, index = step). Goodfellow 4.3.1 (p. 87) on poor conditioning. |
| valleys, 0 | correct | Starts (-0.3, 0) and (0.3, 0). The saddle of f = (x^2 - 1)^2 + 1.5 (y - 0.4 x)^2 + 0.2 x is near x = 0.05; the basin map row at y = 0 switches between x = 0 and x = 0.2. |
| valleys, 1 | correct | (0.3, 0) ends in the right valley, f = 0.197; (-0.3, 0) ends in the left, f = -0.202. The right valley is the higher one. Goodfellow fig. 4.3 on local minima. |
| real, 0 | correct | `model.json` nParams 20,864. |
| real, 1 | correct | Gradient norm on 256 held-out rows: 1.8679 at initialisation (seed 7, the training seed), 0.12434 trained. Note the slice in the next line uses 64 rows (norms 1.88 and 0.167); both readings agree in direction. |
| real, 2 | reword | Centre 0.69996 and maximum 13.986 are right, but the maximum sits at one corner (a = -1, b = -1), not along the edges: the lowest value on the border is 5.0 and the other corners are 12.86, 12.44 and 9.04. Li et al. 2018 is NIPS 2018 (arXiv v3 header), method in section 4. |
| real, 3 | reword | "Two random directions out of 20,864" reads as picking 2 of 20,864 axes. Li et al. section 7.1: two random vectors in high dimension are nearly orthogonal; expected cosine about sqrt(2 / (pi n)), which is 0.0055 for n = 20,864. Measured cosines with the gradient: -0.0024 and 0.0079. The fair claim is "almost at right angles to the steepest way", which is also what `SLICE_NOTE` says. "Sits in a dip" needs "along these two directions" (Li et al. section 6: apparent convexity in a 2D slice does not imply convexity of the full surface). |
| one, 0 | reword | The dial s multiplies the readout matrix; it is an added scalar, not one of the 20,864 numbers, so "freeze every number except one" is inexact. |
| one, 1 | reword | sStar = 0.920 on the first 64 held-out rows. Training minimised training loss, so a held-out optimum away from s = 1 does not show that "training stopped near the bottom". Scaling the readout scales the logits, so s < 1 means held-out text prefers slightly softer predictions. The loss gap is small: 0.6988 at 0.92 against 0.69996 at 1. |
| one, 2 | correct | Step 0.05 for 40 steps from 0.05 ends at 0.838. Step 0.2 jumps to 2.46 on the first step and is at 1.27 after 40, still walking back. The stable step near s = 0.05 is 2 / 19.1 = 0.105, so 0.2 is too big there and 0.05 is not. |
| edge, 0 | reword | Goodfellow 8.1.3 supports minibatch gradient estimates. "Real training never feels the whole hill" is too broad: full-batch training exists. For this model the batch is 16 rows of 24 tokens (`model.json` batch 16), and the rows are stretches of the corpus, so "sentences" is loose but acceptable. |
| edge, 1 | correct | Sets up F4. |
| close, 0 | correct | Summary of verified claims. |
| close, 1 | correct | Points to F4. |

Counts: 24 lines. Correct 18, reword 5, wrong 1.

## Suggested rewordings (exact replacement text)

step, 3 (wrong). Replace with:

> Half that step gets down smoothly. Just under the edge, I zigzag and crawl. Just over it, I zigzag outwards. At twice it, the loss passes a trillion in just twelve steps.

In the template, take "twelve" from facts: add a field such as `bowl.runs[3].stepsRun` (the 2x run's `path.length - 1`, 12) and the cap (1e12) to `fill_gradients.mjs`, so the number is not hand-typed.

step, 1 (scene condition, no text change). Make the scene's first run 0.3 (0.6x the edge) and the doubled run 0.6 (1.2x), and add 0.6 and 1.2 to the `multiples` in `stepStudy` so `facts.json` carries both runs. Do not show 0.25 doubled: that lands on the edge and only oscillates.

real, 2. Replace with:

> To see any of it, we cut a slice through the trained point along two random directions, the way Li and colleagues did in 2018. The loss is 0.70 in the middle and climbs to 13.99 at one corner.

real, 3. Replace with:

> One warning. In a hill with 20,864 directions, two random ones are almost at right angles to the steepest one. This slice shows that the model sits in a dip along these two directions. It cannot show the whole hill.

one, 0. Replace with:

> So let's follow one direction we choose. Freeze every number, and add one dial that turns the model's last matrix up or down. At one, it's the model as trained.

one, 1. Replace with:

> On sentences it never trained on, the bottom of this one-way slice is at 0.92, not at one, though the loss there is only a hair lower. Turning the dial down makes the model a little less sure of itself, and new text likes that.

edge, 0. Replace with:

> This model's training never feels the whole hill at once. Each step feels the slope on 16 short stretches of text, so every step is a little off.

(Token for 16: the attention model's `batch` from `model.json`.)

## Corrections to evidence.json

`cauchy1847`
- read: "Primary scan not read (Gallica returned HTTP 403). Read Lemarechal, C. (2012), Cauchy and the gradient method, Documenta Mathematica Extra Volume ISMP, 251-254, in full: it quotes Cauchy's note (Comptes Rendus 25, 536-538, session of 18 October 1847) and shows the step x - theta X, y - theta Y with X, Y the partial derivatives, theta chosen small or by minimising along the line."
- claims[0]: keep, and append "Cauchy outlined the method for solving systems of equations by minimising a non-negative function, with no convergence proof (Lemarechal 2012, pp. 252-254)."

`goodfellow2016`
- read: "Chapters 4.2, 4.3, 4.3.1, 8.1.3 and 8.2.1 (free online text)."
- citation: change "chapter 8 (minibatch training)" to "section 8.1.3 (minibatch algorithms) and 8.2.1 (ill-conditioning)".
- claims[1] is not stated in the book. Replace with: "With a second-order Taylor model, a gradient step of size eps changes the cost by -eps g'g + 1/2 eps^2 g'Hg (eq. 4.9, 8.10), so a step can go uphill along high-curvature directions; the optimal step along the top eigenvector is 1 / largest eigenvalue (eq. 4.10). The edge 2 / largest eigenvalue for a quadratic follows from eq. 4.9 (our derivation, checked by our runs)."

`rosenbrock1960`
- read: "Not read: full text paywalled. Bibliographic data confirmed from the OUP landing page (abstract only). Function form as cited to this paper by the GAMS model library: 100 (x2 - x1^2)^2 + (1 - x1)^2. The start (-1.2, 1) is the conventional one; not confirmed from the paper."
- claims[0]: change "it is a standard hard case for gradient methods" to "it later became a standard hard case for gradient methods". Rosenbrock's own method in that paper is a direct search, so the "hard case for gradient methods" role is later usage, not the paper's claim (from memory of the abstract and later literature, moderate confidence).

`ours-surfaces`
- claims[0]: replace "and reach a loss near 2e12 after 60 steps" with "and the 2x run passes the 1e12 cap at step 12 (loss 1.93e12), where descend() stops it".
- Add, once the runs exist: "0.6x converges (factor 0.85); 1.2x diverges zigzagging (factor 1.40); at exactly the edge the run neither shrinks nor grows (factor 1.000)."

`li2018`
- read: "Full text, arXiv 1712.09913v3 (7 Nov 2018), NIPS 2018: section 4 (filter-wise normalisation by Frobenius norm per filter; footnote 2, batch-norm parameters held constant), section 6 (apparent convexity in a 2D plot does not imply convexity), section 7.1 (random directions nearly orthogonal; expected cosine about sqrt(2 / (pi n)))."
- Add a claim: "Two random directions in n dimensions are nearly orthogonal to each other and to any fixed direction such as the gradient; the expected cosine is about sqrt(2 / (pi n)), 0.0055 for n = 20,864. Ours measured -0.0024 and 0.0079."
- Code comment in `gradients-landscape.mjs` says Li et al. zero the direction for biases; the paper text names batch-norm parameters only. Bias handling comes from their released code, from memory, low confidence. Either cite the code or drop "biases" from that comment.

`ours-model`
- claims[2]: append "(on the first 64 held-out rows; the minimum is for held-out loss, not training loss)".
