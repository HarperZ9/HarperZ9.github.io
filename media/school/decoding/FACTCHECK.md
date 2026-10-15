# Fact-check: L15, Decoding (temperature, top-k, top-p)

Checked 2026-10-15 against `media/school/decoding/film.json` (filled), `film.template.json`, `facts.json`, `system/school/decoding.mjs`, `system/school/corpus.mjs`, `tools/school/fill_decoding.mjs`, the L9 facts the template borrows, and the two papers in `evidence.json`. The fill script was not re-run. One read-only probe was run at below-normal priority from a scratch directory to read the model's spread after "pylon found a", the context greedy decoding actually meets.

Verdicts: **correct** 21, **reword** 6, **wrong** 2.

## Film lines

| # | Segment | Line or claim | Verdict | Evidence | Suggested rewording |
|---|---|---|---|---|---|
| 1 | title | "Decoding. Turning guesses into sentences." | correct | | |
| 2 | title | "Last time, the model's guess was a spread of belief over every word." | reword | `media/school/curriculum.json` puts L14 (Scaling) before L15; the spread was L9. Fine only if the films run out of curriculum order. | "In the lesson on next-word prediction, the model's guess was a spread of belief over every word." |
| 3 | greedy | "always take the brightest lamp. That is called greedy decoding." | correct | `decoding.mjs` settingProbs mode greedy = argmax | |
| 4 | greedy | From pylon it writes: pylon found a kettle. Pylon put a cone on the kettle. Pylon found a kettle. Again until the page runs out. | correct | `prompts.2.settings.greedy.examples.0`; stops when the 24-word context is full (`method.about`, maxNew 23) | |
| 5 | greedy | After found a, rules choose among 10 equally; kettle gets 14 percent | correct | 10 from L9 `torn.rows.1.truthBetween`. 14 comes from `shapes.rows.1.top.0.p` 0.1428, measured after "tallow found a", not the "pylon found a" that greedy meets. The probe gives 0.1424 after "pylon found a" and 0.1504 at the second "found a" in the greedy run, so the spoken 14 holds. | Optional: add a facts entry for the "pylon found a" context so the token and the scene match. |
| 6 | greedy | "A small lean, taken every time, becomes the only story it tells." | correct | `prompts.2.settings.greedy.repeatedSentence` 1. Holtzman 2020: maximization decoding "gets stuck in repetitive loops". | |
| 7 | sample | Spin a wheel with slot width equal to share | correct | `decoding.mjs` sampleIndex (inverse CDF) | |
| 8 | sample | Spun 1,500 times from the same start | correct | `prompts.2.settings.t1.n` 1500, prompt ["pylon"]; each run has its own random stream (`method.about`) | |
| 9 | sample | "Counting each repeat once, that gave 99 different texts for every hundred runs" | reword | `prompts.2.settings.t1.uniqueShare` 0.988 = distinct texts / runs (`method.diversity`), so 1,482 distinct of 1,500. The arithmetic is right, but a listener can hear "99 of every 100 runs were unlike all the others", which is a different and smaller number. | "Of the 1,500 runs, only 18 repeated a text an earlier run had written." |
| 10 | sample | 89 percent could have been written by the rules | correct | `prompts.2.settings.t1.grammatical` 0.8907 | |
| 11 | sample | Strict check: parses with the rules, including the look-back ones | correct | `method.grammatical`. One leniency a careful listener may want: a run cut off mid-sentence passes if it can still be finished. | |
| 12 | temperature | Scores divided by the temperature before the wheel is cut; below 1 bright lamps brighter, faint ones fade | correct | `decoding.mjs` settingProbs divides logits by T; `shapes.rows.0` vs `rows.1`: kettle 0.143 to 0.197, rope 0.069 to 0.046 | |
| 13 | temperature | "Above 1, everything evens out." | reword | At T = 2 the spread moves toward even but stays uneven: kettle 0.1097, rope 0.0762 (`shapes.rows.2.top`). Only infinite temperature is fully even. | "Above 1, the shares move toward even." |
| 14 | temperature | Kettle 20 percent at 0.5, 11 percent at 2; nonsense words get bigger slots | correct | `shapes.rows.0.top.0.p` 0.1966, `shapes.rows.2.top.0.p` 0.1097. Share outside the ten things: about 0.004 at T = 1, about 0.089 at T = 2 (one minus the top-ten sums in `shapes.rows.1` and `rows.2`) | |
| 15 | temperature | 98, 89, 51, only 11 percent follow the rules | correct | `prompts.2.settings.t0.5.grammatical` 0.9807, `t1` 0.8907, `t1.5` 0.5107, `t2` 0.106 | |
| 16 | temperature | Near zero, the brightest lamp takes the wheel; 200 spins at 0.01 all greedy | correct | `prompts.2.nearZeroTemperature` n 200, sameAsGreedy 1 | |
| 17 | topk | Keep the k brightest; Fan and colleagues used ten for stories in 2018 | correct | Fan 2018 sec. 5.4: "randomly sample from the k = 10 most likely candidates" | |
| 18 | topk | k = 3 after tallow found a keeps kettle, map, crate; other things never written | correct | `shapes.rows.3` kept 3, top kettle, map, crate; the other seven things get 0 | |
| 19 | topk | k never changes; too many where two make sense, too few where ten do | correct | This critique is Holtzman 2020 sec. 3.2 ("the use of a constant k is sub-optimal"), not Fan. The segment's `sources` lists only ours and fan2018. | Add `holtzman2020` to this segment's sources. |
| 20 | topp | Holtzman 2020: keep brightest words until they reach p; one or two when sure, many when torn | correct | Holtzman eq. 2, the smallest set whose mass is at least p; the nucleus ranges "between one and a thousand candidates" | |
| 21 | topp | p = 0.9 keeps 9 slots after tallow found a; 94 percent follow the rules | correct | `shapes.rows.5.kept` 9 (top eight sum 0.843, top nine 0.927); `prompts.2.settings.p0.9.grammatical` 0.9447. The 9 slots are from the tallow context and the 94 percent from runs starting at pylon; the line does not say they share a context. The ninth cut drops rope, one of the ten valid things. | |
| 22 | topp | p = 0.5: 99.7 percent follow the rules | correct | `prompts.2.settings.p0.5.grammatical` 0.9973 | |
| 23 | topp | "But it gives only 14 different texts for every hundred runs." | reword | `prompts.2.settings.p0.5.uniqueShare` 0.14: 210 distinct texts in 1,500 runs. Same listening risk as row 9. | "But 1,500 runs wrote only 210 different texts. Safe, and samey." |
| 24 | tail | Holtzman found plain spinning at temperature 1 drifts into nonsense in big models, because thousands of unlikely words each get a sliver | reword | Holtzman: pure sampling gives text "incoherent and almost unrelated to the context" (GPT-2 Large). Their cause is stronger than "each gets a sliver": the tail is "over-represented in the aggregate", that is, the slivers add up to too much. | "That paper also found that plain spinning, at temperature 1, drifts into nonsense in big models. Tens of thousands of unlikely words each get a sliver, and together the slivers are bigger than they should be." |
| 25 | tail | "Ours does not show it." | **wrong** | Ours shows a small version. At temperature 1 from pylon, 4.1 percent of runs contain a word pair that never occurs in the training text (`prompts.2.settings.t1.bigramValid` 0.9593). Top-p at 0.9 removes every one of them (`p0.9.bigramValid` 1) and lifts the rule-following share from 89 to 94 percent. That is the paper's mechanism, tail cut, quality up. What ours does not show is the paper's perplexity symptom (row 26). Most of the rest of the misses are look-back errors no cut fixes (`t1.bigramValidButUngrammatical` 0.0687). | "Ours shows it only a little. At temperature 1, about 4 runs in 100 use a word pair never seen in training, and top-p at 0.9 removes all of them. Most other misses are look-back mistakes that no cut can fix." |
| 26 | tail | Its runs about as varied as the rules' own writing: the model is torn between 1.87 on its own runs, 1.92 on the rules' runs | correct | `prompts.2.settings.t1.modelPerplexity` 1.873, `generator.modelPerplexity` 1.921. This mirrors Holtzman sec. 4.2, which compares generated-text perplexity with the gold text's; there pure sampling scored worse than gold, here it does not. | |
| 27 | tail | "With only 46 words, the tail of unlikely words is short. So here, plain spinning works, and the paper's problem needs a bigger model to see." | **wrong** | The first sentence is a fair inference (`nextword:model.vocab` 46). The second overstates: 11 percent of temperature-1 runs break the rules (`t1.grammatical` 0.8907), against 0 percent for the rules' own runs (`generator.grammatical` 1), and truncation measurably helps (row 25). | "With only 46 words, the tail is short, so the damage is small: plain spinning breaks the rules in about 1 run in 9, and cutting the tail fixes some of that. The full problem needs a bigger model to see." |
| 28 | close | Greedy one story, spinning many; temperature, top-k, top-p shape the slots | correct | Rows 4, 9, 12 to 23 | |
| 29 | close | "Next in the lighthouse: the block that the attention lamp sits in." | reword | Curriculum: L11 is the transformer block, and L16 (Evaluating a language model) follows L15. | If curriculum order holds: "Next in the lighthouse: how to tell whether a language model is any good." Otherwise, update the curriculum order. |

## Evidence claims (`evidence.json`)

| Claim | Verdict | Evidence |
|---|---|---|
| ours: greedy from pylon writes "found a kettle . pylon put a cone on the kettle . pylon found a kettle ..." | correct | `prompts.2.settings.greedy.examples.0` |
| ours: grammatical shares (t0.5 0.9807, t1 0.8907, t1.5 0.5107, t2 0.106, k3 0.9487, p0.9 0.9447, p0.5 0.9973, uniform 0, generator 1) | correct | `prompts.2.settings.*.grammatical` |
| ours: distinct continuations per run t1 0.988, p0.5 0.14 | correct | `uniqueShare`; see rows 9 and 23 for wording |
| ours: kettle 0.197 at T 0.5, 0.110 at T 2; top-k 3 keeps kettle, map, crate; top-p 0.9 keeps 9 | correct | `shapes.rows` |
| ours: T 0.01 equals greedy in 200 of 200 | correct | `prompts.2.nearZeroTemperature` |
| ours: model perplexity of own T 1 runs 1.873, of generator runs 1.921 | correct | `prompts.2.settings.t1`, `generator` |
| ours: binomial standard error about 0.013 near 0.5 | correct | sqrt(0.25 / 1500) = 0.0129. Settings share random streams, so differences between settings are paired and tighter than two independent errors. |
| fan2018: sample from the k = 10 most likely words; beam search gives common, repetitive phrases | correct | Fan 2018 sec. 5.4: beam search "tends to produce common phrases and repetitive text". The same section says they also tuned a softmax temperature per model. |
| holtzman2020: nucleus = smallest set of most likely words reaching p | correct | Holtzman eq. 2 and 3 |
| holtzman2020: greedy and beam search repeat; pure sampling incoherent through the unreliable tail | correct | Holtzman abstract and sec. 1 |
| evidence `read` field for both papers says "to be re-read by the fact-check" | done | Both re-read in full text for this check |

## Sources read

- **Fan, Lewis, Dauphin 2018, Hierarchical Neural Story Generation (arXiv 1805.04833, ACL 2018).** Full PDF fetched from arxiv.org and read in text form, sections 5.4 and 6. Supports k = 10 top-k sampling for stories and the beam-search comparison. They also tune temperature, which the film does not mention and does not need to.
- **Holtzman, Buys, Du, Forbes, Choi 2020, The Curious Case of Neural Text Degeneration (arXiv 1904.09751, ICLR 2020).** Full PDF fetched from arxiv.org and read in text form, abstract and sections 1, 3.1 to 3.3, 4.2. Supports the nucleus definition, the constant-k critique (sec. 3.2), repetition under maximization, incoherence under pure sampling, and the tail explanation. Its perplexity comparison (sec. 4.2) is the model for row 26.
