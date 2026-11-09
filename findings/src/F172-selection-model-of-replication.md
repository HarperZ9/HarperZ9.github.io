---
id: F172
slug: selection-model-of-replication
title: A selection model shrinks the overstatement in published effects but cannot pick which replicate
tier: B
fields: [psychology, method, forecasting-prediction]
date_found: 2026-10-31
standfirst: Fitted to published original results from other fields, a model that accounts for the significance filter predicted replication far better than taking originals at face value. In a held-out field it did no better than the plain base rate, and a small logistic model beat it.
status: keep
figure: none
data: Reproducibility Project Psychology (RPP), CC0, from the Open Science Framework; FReD replication database, CC BY 4.0, from the Open Science Framework
---
## What it means

Published effects that cleared a significance threshold tend to be overstated, because the threshold lets lucky overestimates through. A model that accounts for that filter makes much better replication forecasts than one that trusts the published numbers. Still, in a field it had not seen, it did no better than guessing every effect at the overall replication rate. It shrinks inflated expectations; it does not tell you which particular finding will hold. A simple regression on the original z value and the sample sizes did better. If you want to flag single claims for checking, the plain statistics are the stronger tool on these data.

## The question

Can one selection model, fitted only to significant original results from other fields, predict which effects replicate, and at what rate, in a field it has not seen?

## How we tested it

We pooled two public replication sets: 79 significant originals from the Reproducibility Project Psychology and 1,143 from FReD, after removing RPP rows from FReD. Of 2,164 FReD rows, 1,344 could be converted to a correlation, and 201 of those were not significant by our conversion and were dropped. That left 1,222 effects in 307 project clusters, the largest with 156 rows. Effects were put on the Fisher z scale.

The model treats each true effect as either exactly zero (with weight pi0) or drawn from a normal distribution, and assumes we see an original only if it was significant. Replication success means a replication z above 1.96 in the original direction, computed the same way for every row. For each held-out field, all parameters came from the other fields. Competing forecasts were face value (the published effect is the truth), the base rate, a logistic regression on original z and log sample sizes, and a normal prior with no zero spike. Forecasts were scored by Brier score, with 95% intervals from a bootstrap over project clusters and Benjamini-Hochberg correction over four comparisons. The plan, forecasts and kill rule were hashed before outcomes were scored. The forecast for RPP was not blind to its published 36 percent rate.

## Controls and planted checks

On simulated data with known pi0 and spread, the fit recovered pi0 with mean error 0.051 and the success rate with error 0.009, and beat face value in every case. As a data check, the RPP rows gave 34 reported successes against 35 published. FReD rows labelled successful had a derived success rate of 0.86, and rows labelled failed 0.15. Shuffling outcomes across rows gave a 95th percentile skill of -0.110, and shuffling original statistics -0.092. Those nulls sit far below zero because overconfident forecasts are punished hard, so beating them shows the pairing carries signal. The base-rate comparison is the real test.

## Result

Held-out Brier scores (lower is better): selection model 0.260, face value 0.402, base rate 0.256, logistic 0.223, normal prior 0.345, selection with a transport term 0.232.

- Against face value: better by 0.142 (95% interval 0.108 to 0.186), q 0.0005.
- Against base rate: -0.004 (-0.039 to +0.027), q 0.811. Not better.
- Against logistic: -0.037 (-0.069 to -0.011), q 0.014. Worse.

Skill over base rate was positive in half of the six larger fields, short of the 75 percent target. For RPP the model predicted 0.50 against 0.34 observed; face value predicted 0.83. In social psychology it predicted 0.65 against 0.41 observed; face value 0.89. The top calibration bands were overconfident: predicted 0.97, observed 0.57; predicted 1.00, observed 0.83.

The preregistered kill fired. The model narrows the overstatement but does not show it can tell which effects replicate, so that claim is withdrawn. The winner's-curse reading, that significant originals are inflated, survives on these data.

## Limits

An earlier summary said the model corrects the replication rate. Read against the table it only shrinks the gap, and the RPP rate missed by 0.16. A two-normal prior fitted the originals better than the spike model by BIC, so pi0 (0.82) is a poor description and should not be read as a share of false hypotheses. The transport term hit the top of its grid in every fold. Fisher z standard errors ignore study design, unsigned effect types assume the same direction, and effects were converted from mixed metrics. The model predicts from original statistics; it cannot say why an effect failed, and a prediction on one effect is no verdict on that effect or its authors. Which effects got replicated was itself selected. Related methods such as z-curve exist.

## Verified

Verified: on 2026-11-09 the row, project and conversion counts, the six Brier scores, the three comparison means with intervals and q values, the per-field predicted and observed rates, the calibration bands, the planted and data-check values, both shuffle quantiles and all nine verdicts were re-read from the study's result file and match the ledger. The preregistration's SHA-256 matches. Not re-run.

## Reproduce

Download RPP and FReD from the Open Science Framework and drop RPP rows from FReD. Convert effects to Fisher z (standard error 1/sqrt(n-3)) and keep originals with |z| above 1.96. Fit a spike-and-normal prior conditioned on significance, predict each held-out field's successes from power at the replication size, and compare Brier scores with the baselines by a project bootstrap.

## Sources

- Open Science Collaboration, 2015, Reproducibility Project Psychology.
- FReD replication database.
- Gelman and Carlin, 2014, on Type S and Type M errors.
