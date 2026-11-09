# Fact-check: L13 "Data: what goes in comes out"

Checked 2026-10-15 against `film.json` (filled), `film.template.json` (tokens), `evidence.json`, `facts.json`, `tools/school/fill_data.mjs`, `system/school/data.mjs`, `system/school/corpus.mjs`, `system/school/trainloop.mjs` and `evaluate()` in `system/school/tinyformer-train.mjs`. The fill was not rerun; every number below is read from `facts.json` and the code that wrote it.

Totals: 30 correct, 2 reword, 2 wrong.

## What the metrics measure

- `summary.copyAccuracy` is `evaluate().copyAccuracy`: top-1 accuracy over every held-out target with `kind = 1`. That covers all look-back positions in both copy and who episodes (the found thing in copy episodes; the verb, the thing and the guide's name in who episodes). On the default held-out mix there are 506 such targets: 107 in copy episodes and 399 in who episodes (`reproduce.split`). It equals `split.lookback.accuracy` in every run. "Look-back words" is the right name for it; "copies" is not.
- The held-out set is the same 256 rows (6,144 targets) for every run: `mixBatch(rng(HELD_OUT_SEED), 256, 24)` with the default mix.
- The untrained model (step 0, model seed 7) scores held-out loss 3.8414 and look-back accuracy 0.0692 (`lookback.runs.*.curve[0]`).

## Lines

| # | Segment | Line or claim | Verdict | Evidence | Suggested rewording |
|---|---|---|---|---|---|
| 1 | title | "Data. What goes in comes out." | correct | Framing line, no factual claim. | |
| 2 | title | "train the same model the same way" | correct | `reproduce.pointsEqual` 81 of 81, `worstAbsDiff` 0; every job uses model seed 7, 2,000 steps, the same lr and batch (`fill_data.mjs` `runJob`). | |
| 3 | mix | Three kinds of episode: copy, who, plain; plain needs no looking back | correct | `corpus.mjs` `copyEpisode`, `whoEpisode`, `plainEpisode`; plain tokens never carry a source. | |
| 4 | mix | "80 percent of episodes need a look back" | correct | `lookback.runs.5.lookbackShare` 0.8; `DEFAULT_MIX` copy 0.4, who 0.4. | |
| 5 | mix | "gets look-back words right 99 percent of the time" | correct | `reproduce.split.lookback.accuracy` 0.9921 over all 506 look-back targets, copy and who. | |
| 6 | less | "cut the look-back episodes down, and keep everything else the same" | correct | `lookbackMix(f)`: copy and who at f/2 each, plain fills the rest; seeds and steps unchanged. | |
| 7 | less | "At 40 percent, it still gets 99 percent right" | correct | `lookback.runs.4.summary.copyAccuracy` 0.9862. | |
| 8 | less | "At 20 percent, 56" | correct | `lookback.runs.3.summary.copyAccuracy` 0.5593. | |
| 9 | less | "At 5 percent, 19" | correct | `lookback.runs.2.summary.copyAccuracy` 0.1917; three-seed range 0.17 to 0.1937 (`noise.lookback5`). | |
| 10 | less | "with none at all, the model is right 3 percent of the time" | correct | `lookback.runs.0.summary.copyAccuracy` 0.0316. | |
| 11 | less | "below a blind guess among the ten things" | reword | Look-back targets are not all things: of 506, about 124 are guide names (`split.guideAnswer.n`) and roughly a quarter are verbs. A blind guess inside the right word class would score about 18 percent (my estimate from the split counts); a blind guess over all 46 words scores 2.2 percent, which 3.16 percent beats. The untrained model scored 6.92 percent (`lookback.runs.0.curve[0].copyAccuracy`). | "And with none at all, the model is right 3 percent of the time, less than half what it scored before any training." |
| 12 | less | "Its loss on unseen rows is 8.25, worse than before it was trained" | correct | `lookback.runs.0.summary.heldOut` 8.2495 against step-0 held-out 3.8414. Most of that loss sits on ordinary words inside copy and who episodes (`split.local.loss` 7.71 over 5,638 targets), so it is a loss on the whole row. | |
| 13 | less | "It learned to be sure, and wrong" | correct | Look-back loss 14.24 nats at 3 percent accuracy (`lookback.runs.0.split.lookback`): high-confidence wrong answers. | |
| 14 | less (predict) | "from most of the crates to a twentieth" | correct | 80 percent is most; 5 percent is a twentieth. | |
| 15 | transfer | "Take out only the copy episodes, and keep the who episodes" | correct | `JOBS.noCopyEpisodes` mix copy 0, who 0.4, plain 0.2. | |
| 16 | transfer | "On who questions, the model is still right 100 percent of the time" | correct | `shift.noCopyEpisodes.whoOnly.lookback` 1 on 946 look-back targets (who-only rows). On the default rows its who-episode accuracy is 0.995. | |
| 17 | transfer | "On copy rows it never trained on, 5 percent" | reword | `shift.noCopyEpisodes.copyOnly.lookback` 0.0464 is right. "Copy rows it never trained on" reads as "held-out rows", which every run is scored on; the point is that it never saw a copy episode at all. Supporting detail: the model with no look-back episodes scores 0.0607 on the same rows (`shift.lb0.copyOnly.lookback`), so the who training gave no lift here. | "On copy episodes, a kind it never saw in training, 5 percent." |
| 18 | transfer | "The looking back did not carry over to a kind of sentence it had never seen" | correct | Same numbers as 16 and 17. The line names the sentence kind, which keeps it inside the evidence's does-not-prove (frame confound). | |
| 19 | noise | "swap 10 percent of the training answers for random words" | correct | `noisySource` replaces each target with probability 0.1 by a uniform word; measured `changedShare` 0.0982 (1 in 46 draws is the same word). | |
| 20 | noise | "Ordinary next words barely notice: still right 70 percent of the time" | correct | `labelNoise.runs.0.summary.localAccuracy` 0.7001 against clean 0.7002. | |
| 21 | noise | "the look-back skill comes slower" | correct | Clean run passes 0.93 at step 700; the 10 percent run is 0.33 at step 700 and 0.66 at step 800, then levels near 0.76 (`labelNoise.runs.0.curve`, `lookback.runs.5.curve`). | |
| 22 | noise | "after the same training it copies only 76 percent right" | wrong | 0.7609 is all look-back words. On copy episodes this run is 100 percent right (`labelNoise.runs.0.split.copyEpisodes.accuracy` 1); the loss is in who episodes (0.6967). In a film that has just separated copy from who episodes, "copies" points the viewer at the one kind that did not suffer. | "But the look-back skill comes slower, and after the same training it gets only 76 percent of look-back words right." |
| 23 | noise | "At 30 percent noise, 33" | correct | `labelNoise.runs.1.summary.copyAccuracy` 0.3281. | |
| 24 | repeat | "keep the amount of text the same, but draw it from a small pile of rows" | correct | `poolSource`: same 16 rows per step for 2,000 steps, drawn from a fixed pool. | |
| 25 | repeat | "With 64 rows, each seen 500 times" | correct | `duplication.runs.0.passes` 500 (2,000 x 16 / 64). | |
| 26 | repeat | "learns the pile by heart and fails on new rows: a held-out loss of 3.02" | correct | Pool loss 0.1276 at step 2,000, far under the generator floor 0.6585 that no non-memorising model can beat; held-out 3.0157. | |
| 27 | repeat | "Its best was at step 100, before it started memorising" | wrong | Step 100 is the first scored point, and by then each pool row had been seen 25 times. At step 100 the pool loss is already 0.5864, under the 0.6585 floor, against held-out 1.2955 (`duplication.runs.0.curve[1]`): memorising had started. The run is scored every 100 steps, so the true best could lie anywhere before step 200. | "Its best held-out score came at the first check, step 100, and it only got worse from there as it memorised." |
| 28 | repeat | "With 1,024 rows: 0.71. With fresh rows every step: 0.69." | correct | `duplication.runs.2.summary.heldOut` 0.7062; `duplication.fresh.summary.heldOut` 0.6874. | |
| 29 | repeat (predict) | "only 64 different rows" | correct | `duplication.runs.0.rows` 64. | |
| 30 | shift | "Rerun never does the deed in a who episode" | correct | `JOBS.rerunNeverDoes` uses `doers: ["tallow", "pylon"]`; Rerun still appears in copy and plain episodes. | |
| 31 | shift | "It names the right guide 0 percent of the time" | correct | `shift.rerunNeverDoes.whoRerunDoes.guideAnswer` 0. | |
| 32 | shift | "When the answer is Tallow or Pylon, 100 percent" | correct | `shift.rerunNeverDoes.whoOthersDo.guideAnswer` 1. | |
| 33 | close | "Whatever is rare in them is weak in the model, and whatever is missing from them is missing from it" | correct | Rare: 1 and 5 percent look-back shares give 18 and 19 percent. Missing: rows 17 and 31. Shown for this model only; the evidence's does-not-prove covers large models. | |
| 34 | close | "Next ... what happens when the model and the crates get bigger" | correct | L14 varies model size and training length on fresh rows, so more text is seen. | |

## Other notes

- `evidence.json` claims match `facts.json` value for value (look-back by share, no-copy, label noise, pools, Rerun, seed ranges, untrained 3.84).
- Only the 5 percent and default recipes have three seeds. Every other variant is one seed, so row 22's split (copy 1.0 against who 0.70) and row 17's 0.046 against 0.061 rest on one run each.
- No hand-typed numbers in the spoken lines besides those in the predict prompts ("a twentieth", "64"), both of which match.

## Sources read

- `ours-data` (`facts.json` and the code that wrote it): read in full. Fill code: `tools/school/fill_data.mjs`; generator and scoring: `system/school/data.mjs`, `corpus.mjs`; summary and curve compare: `trainloop.mjs`; `evaluate()` in `tinyformer-train.mjs`. Not rerun.
- No outside papers are cited in this film.
