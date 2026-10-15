# Fact check: Night School L8, "Embeddings: every word gets coordinates"

Checked by: an independent sub-agent (it did not write the script). Date: 2026-10-15.
Script checked: `media/school/embeddings/film.json` (the filled script, 16 spoken lines). Host stage directions and the `predict` prompt are not spoken claims and are not judged.

Result: 12 correct, 4 reword, 0 wrong.

## What was read, and how

| Source | How it was read |
|---|---|
| Mikolov, Sutskever, Chen, Corrado, Dean, arXiv 1310.4546 (v1, 16 Oct 2013; NeurIPS 2013) | Full PDF from arxiv.org, text extracted with pdftotext. Read closely: abstract, section 2 (equations 1 and 2, "input" and "output" vectors v and v'), section 2.2 "Negative Sampling" (equation 4, the noise distribution, the k ranges). |
| Mikolov, Chen, Corrado, Dean, arXiv 1301.3781 (v1, 16 Jan 2013) | Abstract from the arXiv page; full PDF text extracted, section 3.2 "Continuous Skip-gram Model" read closely. |
| Our code and numbers | Read in full: `system/school/embeddings.mjs`, `tools/school/fill_embeddings.mjs`, `media/school/embeddings/facts.json` (all fields summarised by script), `evidence.json`. Read in part: `system/school/vectors.mjs` (CATEGORIES, neighbourShare, measureTable, chanceShare), `media/school/attention/model.json` (config: vocab 46, dModel 32, nLayers 2, nHeads 2). Nothing retrained; numbers checked against facts.json and the code that writes them. |

## Line by line

| Line | Verdict | Reason and source |
|---|---|---|
| title.0 | correct | Title. |
| title.1 | correct | The vectors lesson (F1) is voiced by Pylon (`media/school/vectors/film.json` voice "pylon") and teaches "a list of numbers is a place". |
| start.0 | correct | D = 32; input rows start uniform in [-0.5/32, 0.5/32] (`createSGNS`, facts.json `settings.init`). The second list (output) starts at zero, not random; the line speaks of one list before two are introduced, so it is fair. |
| start.1 | correct | facts.json snapshot 0: top-1 same-kind share 0.2609 (12 of 46). Shuffle control mean 0.2214, 95% interval 0.087 to 0.391, p 0.32. "About what a shuffle gives" holds. |
| idea.0 | correct | Skip-gram predicts surrounding words from the current word (1301.3781 section 3.2; 1310.4546 section 2, eq 1). Note: the token stream runs episodes together, so "in a sentence" is approximate at sentence edges. |
| idea.1 | reword | Two lists per word match 1310.4546 section 2: v_w and v'_w are the "input" and "output" vector representations. The objective (eq 4) raises the dot product of the middle word's input vector with the real neighbour's output vector. "A word's list points the same way as its real neighbours' lists" leaves out that it is the neighbours' other list, and the dot product also grows with length, not only direction. |
| idea.2 | reword | Eq 4 uses k samples drawn from a noise distribution P_n(w); section 2.2 picks the unigram distribution raised to the 3/4 power, which beat both the unigram and the uniform distributions. Our code does the same (`noiseCdf`, power 0.75). "At random" will be heard as uniform; common words are drawn more often. k = 5 is inside the paper's 5 to 20 range for small data. A draw equal to the real neighbour is skipped (`noiseFor`), so "up to 5" is exact; not worth saying aloud. The name and year are right: section 2.2 defines "Negative sampling (NEG)"; v1 is dated 16 Oct 2013. |
| train.0 | correct | facts.json `settings.epochs` 5 over the 3,000-episode corpus. |
| train.1 | reword | Numbers match: snapshot 0.05 top-1 0.7174 (33 of 46), final 0.6522 (30 of 46); held-out loss falls at every snapshot (3.97, 3.89, 2.96, 2.59, 2.36, 2.14, 2.03, 1.962, 1.960, 1.954, 1.933, 1.922). Three limits a listener cannot see. "At their best" means the best of 12 snapshots, not a measured peak between them. The slip is 3 words of 46, from one run (seed 1); seeds 2 to 5 have only final shares (all 0.6522 top-1). By the top-3 measure the slip is 0.681 to 0.667, near flat. "The guessing game keeps getting better" is right only for held-out loss, which the line should name. |
| train.2 | correct | Given the train.1 data, "not always tidier" is a fair reading of one run. The objective is the prediction loss, and the category share is never trained on. |
| seeds.0 | reword | facts.json `comparison.overlapSeedToSeed` compares seed 1 with each of seeds 2, 3, 4, 5: 0.8043, 0.7536, 0.7899, 0.7971. Pairs among seeds 2 to 5 were not measured. "From one start to another" claims every pair. The seed also changes the noise and window draws (`rng(o.seed + 7919)`), not only the starting numbers; "different random numbers" covers both. |
| compare.0 | correct | `model.json` config: nLayers 2, vocab 46, dModel 32; its word table is trained by next-word loss. |
| compare.1 | correct | facts.json `comparison.wte.top1` 0.8043; `overlapWithWte` 0.3261; `chanceOverlap` 0.0667 = 3/45, shuffle control mean 0.0655 (95% 0.022 to 0.116). |
| compare.2 | correct | 33% is well above the 7% chance and the shuffle interval, and well below 75% to 80% seed-to-seed. Other skip-gram seeds against wte: 0.30 to 0.37 (`overlapExtraSeedsWithWte`), so the 33% is not a lucky seed. "Neither one is the true map" holds: the categories are hand labels in `vectors.mjs`, and no ground-truth geometry exists. "A map of what its own game needed" is an interpretation, not a measured result; acceptable as framing. |
| close.0 | correct | Summary; final top-3 share 0.667 against a control mean of 0.224. |
| close.1 | correct | Points to the next lesson. |

## Suggested rewordings (exact replacement text)

**idea.1**
> Each word gets two lists: one for when it's the word in the middle, one for when it's a neighbour. Nudge the lists so that the middle word's list and each real neighbour's neighbour-list get a bigger dot product, the measure from the vectors lesson.

**idea.2**
> And for every real neighbour, pick 5 words at random, common words more often than rare ones, and push those the other way. Tomas Mikolov and his colleagues called it negative sampling, in 2013.

**train.1**
> Very early, by 5 percent of the way, the neighbours look their tidiest of any checkpoint: 72 percent of words sit next to a word of the same kind. By the end, in this run, it has slipped back to 65, three words fewer out of 46, while the guessing game keeps getting better on sentences it never trained on.

**seeds.0**
> Start from different random numbers, four more times, and you get different coordinates, but much the same neighbours: against the first run, 75 to 80 percent of each word's three nearest neighbours agree.

## Corrections to evidence.json

- `mikolov2013.read`: replace "to be confirmed by the fact-check" with:
  "full text, read 2026-10-15 by an independent fact-check (arXiv 1310.4546v1 PDF, 16 Oct 2013, text extracted): section 2 (equations 1 and 2, input and output vectors), section 2.2 (equation 4; noise distribution U(w)^(3/4)/Z, which beat the unigram and uniform distributions; k from 5 to 20 for small data, 2 to 5 for large). The skip-gram architecture itself is from arXiv 1301.3781, section 3.2 (16 Jan 2013)."
- `mikolov2013.claims[1]`: append "k = 5 is inside the paper's range for small training sets."
- `ours-embed.claims[0]`: "shuffle control 14% to 31%" is the top-3 interval at the start, not the top-1 one that the 26% belongs to. Replace the parenthesis with "(shuffle control mean 22%, 95% interval 9% to 39%)". Replace "highest at 5% of training (72%)" with "highest of the 12 snapshots at 5% of training (72%, 33 of 46 words), from one seed".
- `ours-embed.claims[1]`: replace with "Seed 1 against each of four other seeds (2 to 5): 75% to 80% of each word's three nearest neighbours agree. Pairs among seeds 2 to 5 were not measured."
- `ours-embed.n`: replace with "46 vocabulary entries (44 words plus '.' and '?'); 5 seeds, of which only seed 1 has training snapshots."
- `ours-model.claims[0]`: correct as written (80%, 33%, chance 6.7%, shuffle control 95% interval 2% to 12%). Optionally append "Skip-gram seeds 2 to 5 overlap wte by 30% to 37%."
