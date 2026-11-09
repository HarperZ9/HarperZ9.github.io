---
id: F47
slug: skill-against-noise-ceilings
title: More variables raise prediction skill, yet most targets stall far below their noise ceiling
tier: B*
fields: [forecasting-prediction, method, psychology]
date_found: 2026-10-29
standfirst: Across trees, mood, music ratings, forecasters and a similarity task, held-out skill grew as we added measured variables and always beat a shuffled baseline. In five of six targets with a measurable ceiling it stopped between 0.18 and 0.65 of the way there, and the gap closed mainly when a different kind of variable arrived.
status: keep
figure: none
data: USDA Forest Service Forest Inventory and Analysis (Washington and Oregon remeasured trees); openESM dataset 0062 (Neubauer), CC BY 4.0; DEAM static ratings, CC BY-NC; Good Judgment Project data, CC0 1.0, Harvard Dataverse doi:10.7910/DVN/BPCDH5; THINGS odd-one-out triplets with the 66 SPOSE dimensions (publisher's terms)
---
## What it means

A common hope says that measuring enough things about a system lets you predict it. We tested that against real data and against each target's own measurement noise, which caps any honest score. Skill rose with every added variable, but in most targets it levelled off far below that ceiling. The jumps came from a new kind of information, such as past behaviour or a human rating. Two toys showed hard limits: chaos buys time only logarithmically with precision, and a published forecast that people react to can defeat itself.

## The question

Can held-out skill reach the noise ceiling when enough measured variables are added? We tested six real targets with a ceiling, one without, and two toy systems where the answer is known.

## How we tested it

Variables were added in eight random orders and one informed order, refitting at about 14 counts with ridge, L2 logistic or conditional logit models. Every score is held out, split by plot, later beeps, artist, forecaster or between-subject repeats. A saturating curve fitted to each order estimates where skill levels off.

Ceilings came from each dataset's own repeats: parallel items for mood, rater spread for music, split halves for forecasters, between-person agreement for triplets. Rules were hashed before the first run. A first run exposed a scaling fault on the forecaster target (held-out R2 -1.686, from near-constant variables taking huge scaled values). The second run clipped scaled values at plus or minus 5 and changed nothing else. Its rules were hashed after the first run had been read, so it is a corrected rerun and not blind.

## Controls and planted checks

Every target was refitted on shuffled training labels 20 times. All beat that null: the shuffled 95th percentile was at most 0.013 R2, 0.531 AUC for tree death and 0.439 accuracy for triplets. The Lorenz-63 toy has a theoretical answer: the forecast horizon should grow by about 2.54 time units per tenfold gain in precision. An overfitting demonstration fitted 150 variables to 150 forecasters.

## Result

All values are held out, from the second run.

- Similarity triplets, 66 dimensions: accuracy 0.655 against a ceiling of 0.660 (chance 0.333), a share of 0.985. These dimensions were learned from the same triplet corpus.
- Mood at the next beep, 31 items: R2 0.521 against a ceiling of 0.798 (share 0.65). Current happiness alone gives 0.501.
- Music valence and arousal, 22 sound and genre variables: R2 0.445 and 0.393 against ceilings of 0.821 and 0.862 with 10 raters assumed (shares 0.54 and 0.46). The other dimension's human rating adds 0.082 and 0.092.
- Forecaster accuracy, 1,349 individual-difference variables: R2 0.131, fitted asymptote 0.137 (0.118 to 0.155), against a ceiling of 0.714 (share 0.18). Accuracy on the other half of the questions lifts it to 0.360, the one plateau that moved by the preregistered rule.
- Tree growth, 42 variables: R2 0.396; prior growth lifts it to 0.639. The preregistered ceiling estimator failed (-3.96), so this target has no valid ceiling here.

One of six targets reached 0.8 of its ceiling, against a forecast of at least four. One of seven plateaus moved, against a forecast of at least three. Both predictions failed.

Toys: the Lorenz horizon grew 2.51 time units per decade of precision (theory 2.54, linear R2 0.9999); twelve decades bought 1.2 to 28.7 time units. In the reflexive crowd, an unpublished forecast with every member measured scored R2 1.00, a published naive one -1.55, and a forecaster who solves for the crowd's reaction 0.9999. Measuring 100 of 1,000 members dropped that forecaster to 0.40, and identical members left no surviving forecast (-0.02). Least squares at 150 variables fitted training data at R2 0.96 and scored -135,817 held out; ridge on real targets reached 0.067.

## Limits

Ridge and logistic models may leave signal that a nonlinear model would find, so a stall may belong to the model class. The datasets are a convenience sample. The mood ceiling is a lower bound, the music rater count is assumed, and the tree ceiling failed. The rerun was not blind. A related identification test used a private image collection and is left out of this piece. The toys model their stated mechanisms only. Prior work covers limits on predicting life outcomes (Salganik 2020) and past accuracy as a predictor of forecasting skill (Himmelstein, Atanasov and Budescu 2021).

## Verified

Verified: on 2026-11-09 every number and verdict quoted here was re-read from the second run's result file, and -1.686 from the first run's, and all match the ledger to rounding (the failed tree ceiling reads -3.9645, logged in the ledger as -3.97). Both preregistration files' SHA-256 values match the ledger. Not re-run.

## Reproduce

Obtain the five public datasets. Hold out by the units named above, add variables in random and correlation order, refit at each count and score held out. Compute each ceiling from the data's own repeats, fit s(k) = a k / (k + h), and refit on shuffled labels as the null. For the toys, integrate Lorenz-63 from perturbed states until the error exceeds 1.

## Sources

- Mellers et al., Good Judgment Project data, doi:10.7910/DVN/BPCDH5; Mellers 2015.
- Salganik et al., 2020, on held-out limits to predicting life outcomes.
- Himmelstein, Atanasov and Budescu, 2021, on predicting forecaster accuracy.
- Aljanaki, Yang and Soleymani, 2017, DEAM, PLoS ONE 12(3) e0173392.
- openESM dataset 0062 (Neubauer).
- THINGS odd-one-out data and SPOSE dimensions.
- USDA Forest Service, Forest Inventory and Analysis.
