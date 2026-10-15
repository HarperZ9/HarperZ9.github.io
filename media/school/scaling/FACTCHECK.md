# Fact-check: L14 "Scaling: bigger, longer, how much"

Checked 2026-10-15 against `film.json` (filled), `film.template.json` (tokens), `evidence.json`, `facts.json`, `tools/school/fill_scaling.mjs`, `system/school/scaling.mjs`, and the two papers (full text). The fill was not rerun.

Totals: 21 correct, 9 reword, 0 wrong.

## Lines

| # | Segment | Line or claim | Verdict | Evidence | Suggested rewording |
|---|---|---|---|---|---|
| 1 | title | "Scaling. Bigger, longer, how much." | correct | Framing line. | |
| 2 | title | "for years, making them bigger and training them longer kept making them better" | correct | Kaplan abstract: loss "scales as a power-law with model size, dataset size, and the amount of compute"; Hoffmann section 2: increasing size "has been responsible for improving the state-of-the-art". | |
| 3 | title | "a shelf of small ones, and we are honest about what a shelf this small can show" | correct | Framing; `papers.about` states the limits. | |
| 4 | shelf | "12 versions ... 8 to 64 numbers per word, one to three floors" | correct | `grid.runs.length` 12; widths 8, 16, 32, 64; depths 1 to 3. | |
| 5 | shelf | "The smallest has 616 numbers outside its word tables; the largest, 100,544" | reword | Numbers right (`grid.runs.0.params.nonEmbedding` 616, `grid.runs.11` 100,544). `paramCounts` also leaves out the position table, which is not a word table. | "The smallest has 616 numbers outside its word and position tables; the largest, 100,544." |
| 6 | shelf | "Each trained for 4,000 steps on the same text" | correct | `final.step` 4000; every grid job uses data seed 11. | |
| 7 | shelf | "the floor, 0.6585, the loss of the rules themselves" | correct | `FLOOR` is a constant in `fill_scaling.mjs`, but L13 computes the same 0.6585 independently from the generator on the same held-out rows (`media/school/data/facts.json` `labelNoise.floor`). | |
| 8 | bigger | "The smallest ends 0.15 above the floor and copies 36 percent right" | reword | `grid.runs.0.final.excess` 0.15426, `copyAccuracy` 0.35968. That metric covers every look-back word (copy and who episodes), as L13 explains, so "copies" undersells what it counts. | "The smallest ends 0.15 above the floor and gets 36 percent of look-back words right." |
| 9 | bigger | "Two floors of 16: 0.0161 above the floor, copying 100 percent" | reword | `grid.runs.4.final.excess` 0.016079; `copyAccuracy` 0.99605 rounds to 100, which reads as perfect. Same "copying" issue as row 8. | "Two floors of 16: 0.0161 above the floor, with nearly every look-back word right." |
| 10 | bigger | "Past that, the gap barely moves" | reword | True for the two- and three-floor models (0.012 to 0.026), but the one-floor model of 32 (8,608 numbers, bigger than the two-floor 16) ends at 0.108, seven times the gap (`grid.runs.6.final.excess` 0.10795). | "Past that, the gap barely moves, except for the one-floor model of 32, which lags far behind." |
| 11 | bigger | "The lesson's own model is 0.0150 above the floor" | reword | 0.014979 is the d32 L2 grid run at 4,000 steps. The lesson's shipped model is the same recipe stopped at 2,000 steps, where held-out is 0.6874, excess about 0.029 (`noise.reproduce` matches the curve up to step 2,000). | "The lesson's own model, trained to 4,000 steps, is 0.0150 above the floor, and the largest 0.0225." |
| 12 | bigger | "and the largest 0.0225" | correct | `grid.runs.11.final.excess` 0.022533. | |
| 13 | bigger | "Three runs of the same model with different seeds spread about as much as that" | correct | Seed range of excess: d16 L2 about 0.016 to 0.028, d32 L2 about 0.015 to 0.025 (from `noise.d16/d32.log10Excess` min and max). The spread among d16 L2, d32 L2 and d64 L3 is 0.0150 to 0.0225. Note: model and data seed both vary. | |
| 14 | bigger | "we cannot see any gain from size above about 4,480 numbers" | correct | Best larger model is d32 L3 at 0.011939; log10 gap to d16 L2 is 0.13, about one seed sd (0.118 to 0.138). Also d16 L2's 0.0161 is the lowest of its three seeds, so the comparison does not flatter the small model. | |
| 15 | bigger (predict) | "Over twenty times more numbers than the two-floor model of 16" | correct | 100,544 / 4,480 = 22.4 by non-embedding count, the count the film uses. By total count it is 17.0 (107,968 / 6,336). | |
| 16 | compute | "the arithmetic each training run has done, in floating-point operations" | correct | `checkpoints[].flops` from the model's own FLOPS count, forward and backward. | |
| 17 | compute | "take the lowest loss any model on the shelf had reached. Those best points fall on a straight line on a log-log chart, with a slope of -0.65" | reword | The fit is on the frontier's excess (loss minus floor), not loss: `frontier.fitExcess` slope -0.64767, se 0.022, R2 0.971, n 28. Loss itself flattens toward 0.6585 and would not be straight. | "At every amount of work, take the best model on the shelf, and plot how far it sits above the floor. Those gaps fall on a straight line on a log-log chart, with a slope of -0.65." |
| 18 | compute | "More work, a smaller gap, at a steady rate" | correct | Constant slope on log-log axes over 6e7 to 2.6e11 FLOPs (`fitExcess.xRange`). | |
| 19 | compute | "the best model for each amount of work grows as the work grows. Small models win the small budgets; bigger ones win the big ones." | reword | Trend holds (`fitSizeAtBudget` slope 0.414, R2 0.857), but not step by step: at 3.2e9 FLOPs the winner (1,216 numbers) is smaller than at 1.8e9 (2,256); at 3.2e10 the 2,256 model beats the 4,480 one (`frontier.budgets`). Only 5 distinct models ever win; the three width-64 models never do; the top budget goes to 25,696, a quarter of the largest. | "And the best model for each amount of work tends to grow as the work grows, though not step by step. Small models win the small budgets; middle-sized ones win the big ones." |
| 20 | papers | Kaplan: "over models from hundreds of numbers to more than a billion" | correct | Kaplan section 3: "ranging in size from 768 to 1.5 billion non-embedding parameters". | |
| 21 | papers | Kaplan: "found curves like this ... over a much wider range of work" | correct | Kaplan section 1.2: L(C_min) power law, exponent 0.050; best N grows as C to the 0.73. Kaplan's compute trends span many decades; this shelf spans about 3.6. One gap: Kaplan's main fits have no floor term (row 27). | |
| 22 | papers | Hoffmann: "found that most large models of the time were too big for their training text" | correct | Abstract: "current large language models are significantly undertrained"; section 5: Gopher is "substantially over-sized" for its budget, and most large models saw about 300 billion tokens. | |
| 23 | papers | "Their Chinchilla had 70 billion numbers" | correct | Table 1: 70 billion parameters. This is a total count, while the film's own numbers leave out the word tables; harmless at this scale. | |
| 24 | papers | "a quarter of Gopher's" | correct | Table 1: Gopher 280 billion; 70 / 280 = 1/4. | |
| 25 | papers | "trained on more than four times the text" | correct | Table 1: 1.4 trillion against 300 billion tokens, 4.67 times. | |
| 26 | papers | "and beat it" | correct | Abstract: Chinchilla "uniformly and significantly outperforms Gopher". Optional: the paper's point is that it did so on the same compute, which ties this line to the frontier segment. | Optional: "trained on more than four times the text for the same work, and beat it." |
| 27 | papers | "What it can show is the shape: a floor, a gap that shrinks with work, and a best size that grows with the budget" | correct | Shelf: rows 7, 17, 19. Of the papers, Hoffmann's fit carries the floor term (E = 1.69); Kaplan names it only as a limit the trends "must eventually" reach (section 6.3). | |
| 28 | close | "Bigger and longer help until a model gets close to what its text allows. On our shelf, that comes early." | correct | Rows 10 to 14: little visible gain past 4,480 numbers at 4,000 steps. | |
| 29 | close | "For real text, nobody knows where that point is" | reword | Both papers give estimates: Kaplan section 6.3 guesses about 1.7 nats per token, "highly uncertain"; Hoffmann's fit gives E = 1.69 for their text (appendix D.2). Unknown exactly, but estimated. | "For real text, that point can only be estimated, and the estimates are rough." |
| 30 | host close (visual, not spoken) | "The tallest is barely brighter than the middle ones" | reword | The largest model (excess 0.0225) is worse than the best middle ones (d32 L3 0.0119, d32 L2 0.0150). | "The tallest is no brighter than the middle ones." |

## Other notes

- `evidence.json` `ours-scaling` claims match `facts.json`. The `kaplan2020` and `hoffmann2022` claims match the papers (768 to 1.5e9 non-embedding parameters; 70B and 1.4T against 280B and 300B, same compute). Their `read` fields still say they are waiting for this fact-check.
- `papers.kaplan` and `papers.hoffmann` in `facts.json` (0.076, 0.095, 0.050, 0.73; E 1.69, alpha 0.34, beta 0.28; over 400 models, 70M to over 16B, 5B to 500B tokens) match the paper text I checked. I did not check the per-approach Hoffmann exponents (0.50/0.49/0.46 and 0.50/0.51/0.54) line by line against Table 2 (low risk; not used in the film).
- Confound already stated in facts: one learning rate tuned for width 32. It may explain the d32 L1 outlier in row 10, but that was not tested.

## Sources read

- `ours-scaling`: `facts.json`, `fill_scaling.mjs` and `scaling.mjs`, read in full. Not rerun.
- Kaplan et al. 2020, arXiv 2001.08361 v1: full PDF text, fetched from arxiv.org on 2026-10-15. Read the abstract, section 1 summary and equations 1.1 to 1.3, the section 3 model-size range, and section 6.3 (where the trends must level off).
- Hoffmann et al. 2022, arXiv 2203.15556 v1: full PDF text, fetched from arxiv.org on 2026-10-15. Read the abstract, the introduction, Table 1, the section 5 conclusion, and the fitted constants E, A and B.
- No source was unreadable.
