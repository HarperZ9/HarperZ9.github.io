---
id: F32
slug: skipping-and-abstain-gates
title: Forecasters who skip questions score better, and the best filter reads the probability
tier: B*
fields: [forecasting-prediction, psychology, method]
date_found: 2026-10-29
standfirst: In 410,451 forecasts from the Good Judgment Project, a filter that holds back forecasts by their stated probability cut the average error far more than one that reads the forecaster's own expertise rating. People who skip more questions also score better on their first answers, though a person who skips more in one year is not clearly better for it.
status: keep
figure: none
data: Good Judgment Project survey forecasts, years 1 to 4, CC0 1.0, Harvard Dataverse doi:10.7910/DVN/BPCDH5 (cite Mellers et al.)
---
## What it means

When a system has to decide which answers to hold back, the probability it already states is a far better guide than its self-rated expertise. In a large public forecasting tournament, a filter on the stated probability cut the error of kept forecasts about six times as much as a filter on self-rating, and adding the rating on top bought no more than a shuffled rating did. People who answer selectively are better forecasters on average, so skipping marks a careful source. The data does not show that skipping makes the remaining answers better.

## The question

The Good Judgment Project asked thousands of volunteers to forecast world events over four years and to rate their expertise on each forecast from 1 to 5. An earlier round found that people who skip more questions score better. This round asked whether that survives on first forecasts only, whether the hedge toward 50 percent on low-rated forecasts is the right size, and which input makes the better abstain filter.

## How we tested it

We used every scored forecast on closed questions: 1,064,355 forecasts from 9,914 people, of which 414,570 were first forecasts on a question. The dataset has no skip record, so a skip is a closed question, open during a forecaster's active window, that they never answered. Skip rate was compared with relative Brier score (GJP form, 0 to 2) inside strata of year and forecast count. A second version also matched on when the first forecast arrived in the question's life. A third followed the same people across years.

For the filter, we sorted 410,451 binary forecasts from years 1 to 3 by each input and computed the mean Brier score of the kept forecasts as coverage fell from 100 percent to 10 percent. The area under that curve (lower is better) scores each filter. The hypotheses, thresholds and controls were written and hashed before the run.

## Controls and planted checks

Skip rate was shuffled within strata 1,000 times; the shuffled correlation reached a 95th percentile of +0.018 for both first-forecast tests. For the filter, the expertise rating was shuffled within each forecaster-year and the models refitted, which tests whether the rating carries information about a single forecast or only about who is rating. A random filter gives the floor: 0.277.

## Result

Skipping and first forecasts: Spearman rho +0.286 (95% interval +0.264 to +0.303) across 9,204 forecaster-years. Matched for timing as well: +0.195 (+0.174 to +0.212). Skippers enter questions later (rho +0.41 with the timing of their first forecasts), and timing explains about a third of the effect. Within the same person across consecutive years (1,578 same-condition pairs): +0.041 (-0.007 to +0.095), at the shuffle's 95th percentile of 0.041, so no within-person effect was shown.

The hedge: for forecasts rated expertise 1, the best extremising factor was 0.92 (0.79 to 1.06), with a held-out gain of +0.0002. For ratings 2 to 5 it was 0.93 (0.81 to 1.04). Low-rated forecasts are pulled toward 50 percent by about the right amount. Ratings of 4 and 5 were over-extreme (0.82, interval 0.68 to 0.96).

The filter (area under the risk-coverage curve): random 0.277, self-rating 0.259, stated probability 0.171, both together 0.168. Adding the rating to the probability gained 0.0026 (0.0007 to 0.0046), under the preregistered bar of 0.005, and the shuffled rating gained 0.0024 on average (95th percentile 0.0030). Withholding every expertise-1 forecast keeps 78 percent at Brier 0.267; a probability filter at the same coverage gives 0.214. Teams and individuals did not differ detectably.

## Limits

Skips are inferred and may include unseen questions. Nothing here is causal. The within-person interval reaches +0.095, which leaves room for a small benefit. A probability filter lowers Brier partly by arithmetic: forecasts near 0 or 1 score well when right, so the filter rewards confidence by construction. Merkle and colleagues (2017) studied question selection in the same tournament and report good forecasters selecting more questions, an apparently opposite sign before matching; we read only the abstract, and the matched strata may be what flips the sign. Year 4 has no self-ratings.

## Verified

Verified: on 2026-11-09 every correlation, interval, denominator, extremising factor, filter area, shuffle value and operating point quoted here was re-read from the study's result file and results text and matches the ledger. The preregistration file's SHA-256 matches the hash in the result file. Not re-run.

## Reproduce

Download the GJP survey forecasts and question file from the Harvard Dataverse. Drop withdrawals, voided questions and forecasts after close, and score each forecast by Brier relative to the question average. Correlate skip rate with relative score on first forecasts inside year and forecast-count strata, then add a timing match. For the filter, rank binary forecasts by stated probability, by self-rating and by both, and average the kept Brier score over coverage 0.10 to 1.00. Shuffle the rating within forecaster-year as the control.

## Sources

- Mellers et al., Good Judgment Project data, Harvard Dataverse, doi:10.7910/DVN/BPCDH5.
- Merkle, Steyvers, Mellers and Tetlock, 2017, on question selection by forecasters (International Journal of Forecasting 33(4), 817 to 832).
- Baron, Mellers and others, 2014, on extremising aggregated forecasts.
- arXiv 2106.11248, on incentives to skip under the Brier score.
