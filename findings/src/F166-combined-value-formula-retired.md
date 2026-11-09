---
id: F166
slug: combined-value-formula-retired
title: Our combined value formula lost to plain prospect theory on 11,759 risky choice problems
tier: D
fields: [psychology, economy, method]
date_found: 2026-10-31
standfirst: We tested our own formula for how people value risky options, prospect theory plus terms for information, threat and drive, against a richer version of prospect theory on the public choices13k data. It never beat that richer model, so we retired it. Fitted loss aversion came out at 1.16 when people chose from descriptions and 0.89 when they learned from feedback.
status: keep
figure: none
data: choices13k (Peterson et al. 2021), aggregate choice rates per problem; no licence stated by the publisher, so used as a local research copy
---
## What it means

This is a refutation of our own idea, and it is useful for that reason. We had a single value formula meant to explain choices through gains and losses, the information a gamble resolves, the threat of a loss, and a drive toward a setpoint. When a flexible version of prospect theory gets the same number of chances to fit the data, the extra terms add nothing in choices made from descriptions and almost nothing in choices made from feedback. The terms that do help in the feedback setting read best as patches for where prospect theory misfits, not as new psychology. Loss aversion near 1 is also a reminder that the classic estimate of 2.25 from Tversky and Kahneman depends on the task.

## The question

Does the combined form V = prospect value + beta × information - gamma × threat + w × drive reduction predict human risky choice better than cumulative prospect theory, and better than a richer pure prospect theory that could absorb the same misfit?

## How we tested it

The choices13k data give the share of people choosing option B over option A for thousands of gamble pairs. We kept unambiguous problems and analysed two settings apart: 1,928 problems where people chose from a description, and 9,831 where they learned outcomes through feedback. There is no person-level input, only per-problem rates.

All models predict the logit of choosing B from the difference in value. The baseline is expected value. Cumulative prospect theory (CPT) uses curvature, loss aversion lambda and probability weights. The flexible version (FLEX) has separate curvature and loss terms and two-parameter weighting on each side. The combined formula (COMB) adds four terms to CPT: outcome entropy in bits, probability of a loss, and the mean and mean square of outcomes, which is what a quadratic drive-reduction term expands to. Boosted trees on raw features give a flexible reference, and the spread between people gives a sampling ceiling. Scoring was 10-fold cross-validated R2 grouped by problem, with a quasi-binomial BIC and permutation tests corrected by Benjamini-Hochberg over six tests. The kill rule was written before any fit: if COMB fails to beat FLEX by 0.005 in R2 with a BIC drop of more than 10 in both settings, the formula is retired.

## Controls and planted checks

We simulated data on the same problems, three sets from CPT with lambda 1.6 and three from CPT plus an entropy term. Model selection picked the right truth in 6 of 6 and recovered lambda in 3 of 3. Two nulls tested the added terms in the description setting: the terms shuffled across problems, and outcomes simulated from the fitted CPT. A join check caught a bug before the lock: the data file's keys were row positions, not problem IDs, which gave a match rate of 0.015 on a dry run; after the fix it was 1.0.

## Result

Cross-validated R2, description setting: expected value 0.373, CPT 0.628, FLEX 0.645, COMB 0.634, boosted trees 0.736, ceiling 0.825. Feedback setting: 0.464, 0.584, 0.596, 0.597, 0.805, 0.863.

COMB minus FLEX was -0.011 in the description setting and +0.001 in the feedback setting, against a bar of +0.005. The kill fired. In the description setting the joint gain of the added terms (7.6 in deviance) sat below both nulls' 95th percentiles (52.0 shuffled, 58.9 simulated). In the feedback setting COMB did beat basic CPT, and entropy and loss probability each cleared the correction as residual terms (q 0.015); the drive term did not (q 0.46).

Loss aversion lambda was 1.16 (bootstrap 95% interval 1.05 to 1.30) for descriptions and 0.89 (0.86 to 0.93) with feedback. We had forecast 1.3 for descriptions; we made no forecast for feedback.

## Limits

Entropy and loss probability are one reading of "information" and "threat". Another reading could score differently, so this does not show that no information or drive term helps. The stakes are small, the sample is online, and with only aggregate rates there are no individual parameters. Boosted trees beat every value model by a wide margin, so structure such as payoff correlation and lottery shape is left on the table by all of them. One analyst wrote the forecasts, rules and scoring. The lambda estimates repeat a kind of estimate that already exists in the literature.

## Verified

Verified: on 2026-11-09 the row counts 1,928 and 9,831, every cross-validated R2 in both settings, the COMB minus FLEX values -0.011 and +0.001, the lambda estimates and intervals, the joint gain 7.6 against null quantiles 52.0 and 58.9, the corrected q values 0.015 and 0.46, the planted recovery and all seven verdicts were re-read from the study's result file and match the ledger. The preregistration's SHA-256 matches. Not re-run.

## Reproduce

Download choices13k. Keep unambiguous problems and split them into description and feedback rows. Fit expected value, cumulative prospect theory, a flexible prospect theory and prospect theory plus entropy, loss probability, mean and mean square of outcomes, each predicting the logit of the choice rate by binomial likelihood. Score by 10-fold cross-validation grouped by problem and by quasi-binomial BIC. Bootstrap the loss-aversion estimate.

## Sources

- Peterson et al., 2021, choices13k risky choice data.
- Tversky and Kahneman, 1992, cumulative prospect theory.
- Brown et al., 2024, meta-analysis of loss aversion.
