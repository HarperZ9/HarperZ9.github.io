# Fact check: Night School F2, "Matrices move space"

Checked by: an independent sub-agent (it did not write the script). Date: 2026-10-15.
Script checked: `media/school/matrices/film.json` (the filled script, 25 spoken lines). Host stage directions and predict-pause questions are not spoken lines and are not judged, except where a spoken line answers one.

## What was read, and how

| Source | How it was read |
|---|---|
| Vaswani et al. 2017, arXiv 1706.03762 | Full text (PDF from arXiv, text extracted). Sections 3.2.1 (scores divided by the square root of d_k, with the reason) and 3.2.2 (per-head projection matrices W_i^Q, W_i^K, W_i^V; d_k = d_v = d_model/h) read closely. The paper writes the projections as matrices with no bias term. |
| Ba, Kiros, Hinton 2016, arXiv 1607.06450 | Full text (PDF, text extracted). Section 3 (equation 3: mean and standard deviation over all hidden units of a layer, per training case), the layer-normalised RNN passage (gain g and bias b), and section 5.1 ("adaptive bias b and gain g for each neuron after the normalization"). |
| Hendrycks and Gimpel 2016, arXiv 1606.08415 | Full text (PDF, text extracted). Section 2 defines GELU(x) = x Phi(x) and gives two approximations, 0.5x(1 + tanh[sqrt(2/pi)(x + 0.044715x^3)]) and x sigma(1.702x). |
| Strang, Introduction to Linear Algebra, 5th ed. | Partly. Free: table of contents and sample section 1.3 "Matrices", which states that Ax is a combination of the columns of A (this backs the column reading). Not free: sections 2.1, 2.4, 5.1 (determinants) and 8.1 (linear transformations), which `evidence.json` cites. Those claims were checked on their mathematical merits. |
| Our model and code | Full: `system/school/tinyformer-model.mjs`, `tinyformer-ops.mjs` (layer norm and GELU), `system/school/matrices.mjs`, `tools/school/fill_matrices.mjs`, `media/school/matrices/facts.json`, `media/school/attention/facts.json`, `media/school/attention/film.json` and its lamp scene. Recomputed on CPU with Node: AB and BA applied to east, the three determinants, q and k from the stored x, W and b (agree with facts.json within 2.1e-4, the rounding of the stored 4-decimal inputs), q.k = 41.278 and q.k/4 = 10.319, and the mean and spread of the two layer-norm outputs. |

## Line by line

| Line | Verdict | Reason and source |
|---|---|---|
| title.0 | correct | Title. |
| title.1 | correct | Narrative. |
| crane.0 | correct | Rotation, stretch and shear act on the whole plane at once. |
| crane.1 | reword | "Takes every place on the chart to a new place" contradicts the end of the same sentence (the corner stays), and is false for the identity or for points on a stretch's fixed axis. "Keeps straight lines straight" and "leaves the corner where it is" are correct for linear maps (Strang chapter 8, not read; standard). Strictly, a singular matrix can squash a line to a point, which this lesson never shows. |
| columns.0 | correct | Unit vectors e1, e2. |
| columns.1 | correct | First column = A e1, second = A e2. Strang 1.3 (read): Ax is a combination of the columns of A. |
| columns.2 | correct | Linearity: A(x e1 + y e2) = x A e1 + y A e2. |
| kinds.0 | correct | facts.json `demos[0]`: matrix [[0,-1],[1,0]], columns (0,1) and (-1,0). East to north, north to west. |
| kinds.1 | correct | [[2,0],[0,1]], det 2, unit square area 2 (facts.json `demos[1]`). The determinant is the signed area factor; here the sign is positive, so the plain statement is fine. |
| kinds.2 | correct | [[1,1],[0,1]], det 1, unit square to a parallelogram of area 1 (facts.json `demos[2]`). Rows above the axis slide right and rows below slide left; "slides the top sideways" is a fair short form. |
| order.0 | correct | Setup. |
| order.1 | correct | Recomputed: stretch then turn = A B with A the turn, B the stretch; AB = [[0,-1],[2,0]], AB e1 = (0, 2). Turn then stretch: BA = [[0,-2],[1,0]], BA e1 = (0, 1). Matches facts.json `order.eastArrow`. |
| order.2 | correct | Composition of linear maps is linear, its matrix is the product, and matrix products do not commute in general (this pair is a counterexample). |
| corner.0 | correct | Setup. |
| corner.1 | correct | A0 = 0 for every matrix; translation needs an added vector (an affine map). |
| corner.2 | reword | Second sentence correct: every layer of our model adds a bias after each of its four matrices (`l.bqkv`, `l.bo`, `l.b1`, `l.b2` in `paramSpecs`); its layer norms also carry biases; the final readout `wout` has none, but that is not a layer. First sentence overclaims: "Language models do exactly that" is not true of all of them. Vaswani et al. 2017 write the attention projections without biases, and several widely used recent models drop biases from their linear layers (from memory, moderate confidence: LLaMA and PaLM). |
| question.0 | correct | Matches the attention film: probe "rerun found a kettle . pylon put a cone on the", reading word "the" at position 10, answer kettle at position 3, host Tallow (`media/school/attention/film.json`, facts.json `probe`). |
| question.1 | reword | Matrix size correct: dModel 32, nHeads 2, so the head's query slice of `wqkv` is 32 by 16 with a 16-number bias (facts.json `finale`, `matrices.mjs`). "A step that evens out its size" misdescribes layer normalisation. Ba et al. section 3 subtract the mean and divide by the standard deviation over the layer, then section 5.1 applies a learned gain and bias. The output is not evened out in size: the two inputs here have spreads 0.44 (the) and 0.58 (kettle), recomputed from `xQuery` and `xKey`. Minor: by layer 2 the list at a position already carries other words through attention, so "each word's list" is loose. |
| question.2 | correct | Key slice 32 by 16, output 16 numbers, the same length as the query. Vaswani 3.2.2: separate learned projections for queries and keys per head. |
| question.3 | correct | q.k = 41.2776, divided by sqrt(16) = 4 gives 10.3194 (facts.json `finale.qkRaw`, `scaled`; recomputed). Vaswani 3.2.1 divides by sqrt(d_k). `fill_matrices.mjs` refuses to write if this differs from the attention film by more than 1e-4 (worst 4.7e-5). Note: the attention film's lamp scene draws scores with one decimal (`v.toFixed(1)`), so on screen it read 10.3, which is the same number. |
| edge.0 | correct | A product of matrices is a matrix, so a stack of linear maps is one linear map. |
| edge.1 | reword | Our MLP applies GELU between `w1` and `w2` (`layerForward`), to 64 numbers, in the second half of each layer, after attention. "In the middle of each layer" is loose. Our code uses the tanh approximation, which Hendrycks and Gimpel section 2 give and use in their own experiments, so calling it GELU is fair. "Softmax and layer normalisation bend things too" is correct: both are nonlinear. |
| edge.2 | reword | The bends (GELU, softmax, layer norm) are fixed functions. Training learns the numbers in the matrices, biases, and the layer-norm gains and biases. "Learns which way to bend" suggests the curve itself is learned. |
| close.0 | correct | Summary of the columns reading, composition and non-commutativity. |
| close.1 | correct | Narrative bridge to the gradient lesson. |

Counts: correct 20, reword 5, wrong 0.

## Suggested rewordings

1. crane.1, replace with:
   "A matrix is that kind of move written as a grid of numbers. It sends every place on the chart somewhere, it keeps straight lines straight, and it leaves the corner where it is."

2. corner.2, replace with:
   "Many language models do exactly that: a matrix, then a list added on, called a bias. Every layer of the model from the attention lesson does it."

3. question.1, replace with:
   "By the second layer, the list of 32 numbers at each word has been through a step called layer normalisation. It shifts the numbers to average zero and scales them to a standard spread, then applies a learned scale and shift of its own. Then it meets the head's query matrix: 32 rows by 16 columns, plus a bias."

4. edge.1, replace with:
   "So a model puts bends between its matrices. In the one from the attention lesson, a smooth curve called GELU sits between the two matrices in the second half of each layer and bends every number that passes through. The softmax and the layer normalisation bend things too."

5. edge.2, replace with:
   "How a model learns the numbers in its matrices is where the next lessons along the hill go."

## Notes outside the spoken lines

- `evidence.json`, hendrycks2016: the claim describes GELU as x times the normal CDF. Our model computes the tanh approximation from the same paper (`tinyformer-ops.mjs`, constants sqrt(2/pi) and 0.044715). Suggest adding: "Our model uses the paper's tanh approximation."
- `evidence.json`, ba2016: the claim is correct per section 3 and section 5.1. The paper normalises over the hidden units of one layer for one training case; "each input's numbers" is a fair paraphrase.
- `evidence.json`, strang2016: the free samples do not include sections 2.1, 2.4, 5.1 or 8.1. The claims are standard and correct; the citations to those sections were not checked against the text. Section 1.3 (free) also supports the column claim.
- `evidence.json`, strang2016 claim on the determinant: strictly, the absolute value of the determinant is the area factor and the sign records a flip. No spoken line depends on this, since all three demo determinants are positive.
