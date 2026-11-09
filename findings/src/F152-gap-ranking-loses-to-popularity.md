---
id: F152
slug: gap-ranking-loses-to-popularity
title: Finding missing links by shared neighbours lost to simple popularity on three corpora
tier: D
fields: [method, forecasting-prediction, information-theory]
date_found: 2026-10-31
standfirst: The classic way to hunt for undiscovered connections, ranking unlinked pairs of ideas by the neighbours they share, found fewer of the links that later appeared than just pairing the most common ideas. Among pairs of equal popularity it still carried some signal.
status: keep
figure: none
data: Question tags from Biology Stack Exchange and Skeptics Stack Exchange, 2011 to 2024, CC BY-SA; a third corpus of our own research notes, not public
---
## What it means

Tools that promise to surface hidden connections in a body of knowledge often rank candidate links by shared neighbours: if A goes with B and B goes with C, perhaps A goes with C. Swanson described this idea in 1986. On three corpora, that ranking found fewer of the links that later appeared than the dumbest baseline available, which pairs the two most frequent terms. Anyone building or judging a discovery tool should test it against popularity first. A tool that only beats random guessing may be reading how common words are. Shared neighbours did carry some information once popularity was held fixed. The weakness sits at the top of the ranked list, where a user would look first.

## The question

Does a shared-neighbour score, discounted for popularity, rank the unlinked concept pairs that later co-occur above a preferential-attachment baseline that ranks pairs by the product of their degrees?

## How we tested it

Each corpus was ordered by date and cut into slices. A link is two concepts appearing in the same document. A target is a pair that never co-occurred in the training slices and then co-occurs in at least two documents of the next slice. Three folds trained on slices 1, 1 to 2 and 1 to 3, and each tested on the slice after.

The shared-neighbour score is a cosine over common neighbours with edges weighted to discount popular terms, Swanson's A-B-C idea in the form used for time-sliced tests by Krenn and Zeilinger (2020). The baseline is preferential attachment, the product of the two concepts' link counts. The main measure is precision in the top 200 candidates, averaged over folds, with a document bootstrap for the difference. A second measure is the area under the ROC curve within deciles of the degree product, which compares pairs of similar popularity. The corpora were our own research notes and the question tags of two public Stack Exchange sites. The rules and forecasts were hashed before any score was computed. Adamic-Adar, another common link-prediction score, was reported as a secondary and was not preregistered.

## Controls and planted checks

The shared-neighbour score was also computed on 20 degree-preserving rewired copies of the training graph, which keep each concept's popularity and destroy the real neighbourhoods, and on 20 copies with node labels permuted. If the score adds anything beyond popularity at the top of the list, it should beat the rewired copies. There was no planted known answer.

## Result

Precision in the top 200, averaged over folds:

- Research notes: shared neighbours 0.127, popularity 0.268. Difference interval -0.182 to -0.125.
- Biology Stack Exchange: 0.018 against 0.088 (interval -0.105 to -0.062).
- Skeptics Stack Exchange: 0.007 against 0.043 (interval -0.077 to -0.042).

On the rewired graphs the shared-neighbour score reached a 95th percentile of 0.164, above its real-graph score of 0.127, so at the top of the list it added nothing beyond popularity. It did beat the node-permuted copies (95th percentile 0.048). Within popularity deciles its area under the curve was 0.569 on the research notes and 0.757 on Biology, above the preregistered 0.55 bar, so it holds some signal among pairs of equal popularity.

Adamic-Adar tied popularity on the research notes (0.273) and beat it on Biology (0.122). Because it was not preregistered, that is a lead for a new test.

We had forecast popularity at 0.25 and shared neighbours at 0.15 on the research notes, and put the chance of beating the rewired control at 0.85. That forecast failed.

## Limits

A later co-occurrence is an attention event, not a confirmed discovery, so a hit does not show that a link is true. On the research notes almost all hits come from the first fold, with 285 concepts; later folds ran at base rates near 0.001. The research-notes corpus spans days of reading rather than years, and it is not public. One tokenizer was used, with no synonym handling. The study does not show that Adamic-Adar is the better method. Prior work treats literature-based discovery as link prediction and also finds degree baselines hard to beat (Kastrin, Rindflesch and Hristovski 2016).

## Verified

Verified: on 2026-11-09 the precision values on all three corpora, the three difference intervals, the rewired and permuted control quantiles, the within-decile AUCs, the Adamic-Adar values, the 285-concept first fold and the later base rates, and all four verdicts were re-read from the study's result file and match the ledger. The preregistration's SHA-256 matches the locked hash. Not re-run.

## Reproduce

Take the public Stack Exchange data for Biology and Skeptics and use question tags as concepts. Order questions by date, cut them into five equal slices, and build a co-occurrence graph from the training slices. List unlinked pairs that co-occur at least twice in the next slice as targets. Rank candidates by popularity-discounted shared-neighbour cosine and by degree product, and compare precision at 200 with a document bootstrap. Repeat on degree-preserving rewired graphs as the control.

## Sources

- Swanson, 1986, undiscovered public knowledge and the A-B-C model.
- Krenn and Zeilinger, 2020, time-sliced prediction of research links.
- Kastrin, Rindflesch and Hristovski, 2016, link prediction for literature-based discovery, Methods of Information in Medicine.
- Stack Exchange data, Biology and Skeptics sites, CC BY-SA.
