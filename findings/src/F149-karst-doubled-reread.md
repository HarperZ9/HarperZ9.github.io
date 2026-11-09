---
id: F149
slug: karst-doubled-reread
title: Did unsupported citations about fungal networks double? It depends on the weighting
tier: B*
fields: [law-governance, biology-mycology, method]
date_found: 2026-10-31
standfirst: A 2023 paper reported that citations overstating the evidence for forest fungal networks roughly doubled over time. On the authors' own deposited table, their model gives about 2.2 and 2.8 times, while weighting each year by its number of citations gives about 1.8 and 1.5, and only one of the four intervals clears 1.
status: keep
figure: none
data: Dataverse deposit accompanying Karst, Jones and Hoeksema (2023), study-year rate table and metadata (CC0). Numerators from the paper's supplementary Note 3 were used to rebuild denominators; only derived values are reported, since the supplement is copyrighted.
---
## What it means

Karst, Jones and Hoeksema (2023) argued that the scientific literature on common mycorrhizal networks in forests has drifted toward citing field studies for more than they show, and that the share of such unsupported citations about doubled. That claim is now part of a live dispute. We reran it on the data the authors deposited. "Doubled" is a fair reading of their fitted curve. Counted as a share of all citations, the rise is smaller and less certain, and the uncertainty across the handful of focal studies is wide. The honest summary is "rose, about doubled on their model", with the interval beside it.

## The question

On the deposited table, does the rate of unsupported citations double over the study period for both kinds of claim the paper examined, network function and network structure, and does that hold when each year is weighted by how many citations it contains?

## How we tested it

The deposit holds 268 study-year rates of unsupported citation, for 11 focal studies on function and 7 on structure, after skipping 4 blank rows. It gives rates and no denominators. We rebuilt denominators from the numerators in the paper's supplementary Note 3: 84.6 percent of nonzero rates gave a whole number, and the rebuilt numerators matched the paper's table totals with a median gap of zero. Years with a rate of zero shared the remainder, which is the weakest step. We then fitted the negative binomial count model the authors used, a within-study model, and a citation-weighted share model, with intervals from resampling focal studies. Pass and fail rules, including a kill rule, were hash-locked before the run.

## Controls and planted checks

We first checked that we could recover the paper's stated means: row means came out at 33.2 and 15.3 percent against the stated 32.2 and 14.8, and the mean of study means gave 32.3 and 14.7, which identifies the authors' definition. A planted calibration fed the pipeline synthetic data with a known answer. With a flat truth, it called a rise 9 percent of the time. With a true doubling, the median estimate was 2.11 and the interval covered the truth 89 percent of the time. Year labels were shuffled to build a null for each ratio.

## Result

On the authors' model, function rose by a factor of 2.19 over the period (study resampling 0.86 to 4.14; shuffled 95th percentile 1.31, p 0.002) and structure by 2.84 (1.18 to 6.62; shuffled 95th percentile 2.09, p 0.013). Dropping 2022 gave 2.26 and 2.43. Inside individual studies the rise held for both: 3.0 for function (p 0.001) and 3.5 for structure (p 0.009), so the rise does not come from which focal studies happen to be cited when.

Weighted by citations, function rose by 1.77 (0.52 to 2.99) and structure by 1.54 (0.85 to 5.81). Neither interval excludes 1. In pooled shares, function went from 21.5 percent in its first ten years to 34.9 percent in 2012 to 2021, about 1.6 times; structure went from 13.6 to 14.7 percent, about 1.1 times. The preregistered kill text for structure applies: its pass on the count model leans on thin early years, where the first five structure years all have a rate of zero over about 3 citations a year.

The calibration matters for reading the failures. A true doubling clears an interval excluding 1 only 43 percent of the time with this many focal studies, so an interval that includes 1 is no evidence against doubling.

## Limits

This analysis was not blind: before the lock we saw the metadata, the column header, one data row by accident, and the numerators from an earlier reread. Denominators were rebuilt, and zero-rate years share a remainder. Every rate is the original authors' coding, which they describe as subjective. Our definition of "doubled" may differ from theirs, because a key figure in the paper sits behind a paywall and was not read. The paper's own endpoints of about 25 and almost 50 percent were not compared. Nothing here bears on whether fungal networks exist or move resources between trees. Simard, Ryan and Perry (2025) criticised the paper's study selection and its year-based counting; we found no published numeric reanalysis of the deposit.

## Verified

Verified: the 268 rates and 4 skipped rows, the 84.6 percent integer share and zero median gap, the recovered means, the calibration rates, the 0.43 power figure, both count-model ratios with their intervals and shuffled percentiles, the ratios without 2022, the within-study ratios and p values, both weighted ratios with intervals, and the pooled shares were re-read from the run's result file on 2026-11-09 and match the ledger. The result file and the preregistration file both match their recorded sha256. Not re-run.

## Reproduce

Download the CC0 rate table from the Dataverse deposit for Karst et al. (2023). Rebuild yearly citation counts from the supplementary Note 3 numerators, checking that each rebuilt numerator is a whole number and that totals match the paper's tables. Fit a negative binomial model of unsupported counts on year with focal-study resampling, then a citation-weighted logistic share model, and report the ratio of fitted rates at the end and start of the period for each. Calibrate with synthetic flat and doubled series of the same shape.

## Sources

- Karst, Jones and Hoeksema (2023), Positive citation bias and overinterpreted results lead to misinformation on common mycorrhizal networks in forests, Nature Ecology and Evolution 7: 501-511, doi 10.1038/s41559-023-01986-1. Author Correction, doi 10.1038/s41559-023-02035-7.
- Simard, Ryan and Perry (2025), Frontiers in Forests and Global Change, doi 10.3389/ffgc.2024.1512518.
