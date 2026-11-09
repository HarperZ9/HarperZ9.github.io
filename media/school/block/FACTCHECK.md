# Fact-check: L11 The transformer block

Checked 2026-10-15 against `media/school/block/facts.json`, `film.template.json` (token paths), `system/school/block.mjs`, `system/school/tinyformer-model.mjs`, `tools/school/fill_block.mjs` and the four sources in `evidence.json`. Scripts, facts and code were not edited. `node --test system/school/block.test.mjs` passed 9 of 9, including the test that the hooked forward equals the model's forward bit for bit.

Summary: 20 film lines checked. 16 correct, 4 reword, 0 wrong. Evidence and facts text: 8 claims checked, 7 correct, 1 reword.

Reference values used below: a uniform guess over the 46-word vocabulary scores ln 46 = 3.83 nats; the unigram baseline is `baselines.unigramLoss` 3.272; copy chance is `baselines.copyChance` 0.1008. Layer `l0` is the first floor and `l1` the top floor (`params.config.nLayers` 2). Head `h0` is the first head and `h1` the second.

## Film lines

| # | Segment | Line or claim | Verdict | Evidence | Suggested rewording |
|---|---|---|---|---|---|
| 1 | title | "Two floors, one stream." | correct | `params.config.nLayers` 2; one residual buffer `h` in `hookedForward` | |
| 2 | title | "On each floor, two rooms read it and add something to it." | correct | `layerForward`: attention add, then MLP add, per layer | |
| 3 | stream | "a word's 32 numbers from the table: its embedding, plus a list for its place in the sentence" | reword | `embed`: `wte[token] + wpe[position]`, two tables, summed element by element | "Start with a word's 32 numbers: its row from the word table, added number by number to a row from a second table for its place in the sentence. Call that the stream." (The current wording says one table and can be heard as two lists placed side by side.) |
| 4 | stream | "Each room reads the stream ... adds its answer back on. Nothing is thrown away. That adding is called the residual connection." | correct | `layerForward`: `xout = xin + tmp`, then `xout += tmp` | |
| 5 | stream | "Before each room reads, the stream is rescaled to a steady size. That is layer norm ... as in GPT-2, it comes first in each room." | reword | block.mjs header: the stream "is never normalised in place"; each sub-layer reads a normalised copy. GPT-2 2.3: norm "was moved to the input of each sub-block" | "Each room reads a rescaled copy of the stream, centred and set to a steady size; the stream itself is left alone. That is layer norm, and in this model, as in GPT-2, it comes first in each room." (As written, "the stream is rescaled" contradicts "nothing is thrown away" one line earlier.) |
| 6 | rooms | "This model has 2 heads per floor, two separate ways of looking." | correct | `params.config.nHeads` 2, `headDim` 16 | |
| 7 | rooms | "It widens the 32 numbers to 64, bends them, and narrows them back." | correct | `params.config.dFF` 64; `gelu` between `w1` and `w2`. Vaswani 3.3: applied "to each position separately and identically" | |
| 8 | rooms | "almost the same number of the model's 20,864 numbers: 8,448 and 8,384" | correct | `params.counts`: total 20864, attention 8448, mlp 8384 (recomputed by hand: 2 x (32x96+96+32x32+32) and 2 x (32x64+64+64x32+32)) | |
| 9 | climb | "ask it to guess the next word early, using the model's final step" | reword | `readout`: final layer norm with its learned gain and bias, then `wout`. nostalgebraist used outputs "after layer norm, but before the learned point-wise transformation", which is this repo's `normOnly` variant | "...using the model's own last layer norm and output table, as if the tower ended there." Naming the readout matters: with the post's original variant (`lens.normOnly`), copying after the first floor reads 19 percent, not 43. |
| 10 | climb | "held-out loss of 2.33. After the first floor, 0.86. After the second, 0.69." | correct | `lens.trained.0.loss` 2.3304, `.2.loss` 0.8631 (after l0 MLP), `.4.loss` 0.6874 | |
| 11 | climb | "right 43 percent of the time after the first floor, and 99 percent at the top" | correct | `lens.trained.2.copyAccuracy` 0.4289, `.4.copyAccuracy` 0.9921. Valid for the full-norm readout only (see row 9) | |
| 12 | knockout | "With everything on, it copies right 99 percent of the time." | correct | `ablations.trained.base.copyAccuracy` 0.9921 | |
| 13 | knockout | "Silence the second head on the top floor, and copying falls to 40 percent. Silence the first head there, and nothing changes: 99 percent. One head does the copying; its neighbour is close to idle." | reword | `ablations.trained.rows.14` (l1.h1 zero) copy 0.4032; `rows.13` (l1.h0 zero) copy 0.9921, dLoss -0.0002. Head numbering matches. But `rows.2` (l0.h1 zero) also drops copy to 0.3755, and 40 percent is still four times chance (0.1008) | "Silence the second head on the top floor, and copying falls to 40 percent. Silence the first head there, and copying stays at 99 percent. On the top floor, one head carries most of the copying, and its neighbour is close to idle. A head on the first floor turns out to matter for copying too." |
| 14 | knockout | "Switch off the first floor's MLP, and the loss jumps from 0.69 to 5.96, worse than a blind guess." | correct | `ablations.trained.base.loss` 0.6874; `rows.3` (l0.mlp zero) 5.9605 > 3.83 (uniform) and > 3.272 (unigram). Note: the mean knockout of the same MLP (`rows.7`) gives 3.56, under the uniform guess, so the "worse than a blind guess" holds for zeroing only. Optional: "worse than guessing evenly among all 46 words". | |
| 15 | knockout | "On an untrained model, the same switches barely move the loss. The jobs were learned, not built in." | correct | `ablations.untrained.rows[*].dLoss`: largest size 0.0021 across all 30 rows; base 3.8414 | |
| 16 | residual | "What if a room replaced the stream with its answer, instead of adding to it?" | correct | `join` with mode "replace": `h = tmp` | |
| 17 | residual | "For the top floor's attention, the loss goes to 6.62. The room was only ever adding a little, and the rest of the stream was still needed." | correct | `residual.trained.rows.2` (l1.attn replace) 6.6192; `stream.trained.adds.2.ratioToStream` 0.1825 | |
| 18 | residual | "The first floor's MLP adds a vector about 10 times the size of the stream it reads, so replacing barely matters there: 0.69." | correct | `stream.trained.adds.1.ratioToStream` 10.0522 (mean per-position ratio; the ratio of mean norms is 42.03 / 4.49 = 9.4, still "about 10"); `residual.trained.rows.1.loss` 0.6905 against base 0.6874 | |
| 19 | close | "attention looks along the sentence, the MLP works on each word, and each adds its answer back on" | correct | `layerForward`; causal mask in `attnForward` (keys j <= i) | |
| 20 | close | "Next in the lighthouse: how the whole tower is trained." | correct | `media/school/curriculum.json`: L12 "The training loop" follows L11 | |

Not graded: the host open and close stage directions and the two `predict` questions, which make no factual claim.

Order of operations in the block, as the code runs it (`tinyformer-model.mjs` `embed`, `layerForward`, `forward`): position embeddings enter once, added to the word embedding before the first layer; then per layer `mid = h + Wo.attn(LN1(h))` and `out = mid + W2.gelu(W1.LN2(mid))`; then `logits = LNf(h).wout`. The film matches this order.

## Evidence and facts text

| # | Claim | Verdict | Evidence | Suggested rewording |
|---|---|---|---|---|
| E1 | ours-block: parameter counts 20864; attention 8448, MLP 8384, embeddings 2240, output 1472, norms 320 | correct | `params.counts` | |
| E2 | ours-block: readout losses 2.33, 1.73, 0.86, 0.75, 0.69; copy 0.12, 0.21, 0.43, 0.82, 0.99 | correct | `lens.trained[0..4]` | |
| E3 | ours-block: l1.h1 zero copy 0.4032; l1.h0 0.9921; l0 MLP 5.9605; untrained moves under 0.05 | correct | `ablations.trained.rows.14`, `.13`, `.3`; untrained max size 0.0021, so "under 0.003" would be tighter | |
| E4 | ours-block: replace losses 6.62, 4.93, 2.85, 0.69; l0 MLP output about 10 times the stream | correct | `residual.trained.rows`; `stream.trained.adds.1` | |
| E5 | vaswani2017: two sub-layers, each with residual and layer norm; norm after the add (section 3.1) | correct | 3.1: "LayerNorm(x + Sublayer(x))" | |
| E6 | radford2019: layer norm moved to the input of each sub-block (section 2.3) | correct | 2.3: "was moved to the input of each sub-block" | |
| E7 | nostalgebraist2020: output step on intermediate streams gives guesses that improve with depth | correct | "gradually converge to the final distribution over the layers" | |
| E8 | facts `lens.about`: "normOnly skips the final norm's learned gain and bias" and block.mjs calls it "a variant of the logit lens" | reword | The post's own readout skips the learned gain and bias, so `normOnly` is the original and the full-norm readout is the variant | In `lens.about` and the block.mjs comment: "normOnly skips the final norm's learned gain and bias, as the original post did; the default applies the full final norm, the more common practice since." |

Also checked in `facts.cites.about`: the GELU, the MLP width (Vaswani 3.3 gives dmodel 512, dff 2048, ReLU), learned positions (Vaswani 3.5 reports "nearly identical results"), the shared embedding and output matrix (Vaswani 3.4), the final layer norm and the 1/sqrt(N) residual initialisation (GPT-2 2.3, matching `paramSpecs` scale 0.02 / sqrt(2 x nLayers)). All correct.

## Sources read

**Vaswani et al. 2017, arXiv 1706.03762.** Read from the arXiv PDF (text extracted locally). Sections 3.1 to 3.5: the encoder and decoder stacks with post-norm sub-layers, eight heads at dmodel 512, the position-wise feed-forward net with ReLU and dff 2048, weight sharing between the embeddings and the pre-softmax matrix, and the sinusoidal position encoding with the learned-embedding comparison. The paper is an encoder-decoder; this model is decoder-only, which the film does not contradict.

**Radford et al. 2019, GPT-2 report.** Read from the OpenAI PDF (text extracted locally). Section 2.3 Model: layer norm moved to each sub-block's input, an extra layer norm after the final block, residual weights scaled at initialisation by 1/sqrt(N) for N residual layers, vocabulary 50,257, context 1024.

**nostalgebraist 2020, "interpreting GPT: the logit lens", LessWrong, 31 August 2020.** Read the post page. It applies GPT-2's output projection (the transposed embedding matrix) to intermediate block outputs, taken after layer norm but before its learned gain and bias, and reports that the predicted distributions converge toward the final one across layers, often well before the end. A blog post, not peer reviewed, as the evidence file says. A May 2021 editor's note mentions a variant decoder in a newer notebook; I did not read that notebook.
