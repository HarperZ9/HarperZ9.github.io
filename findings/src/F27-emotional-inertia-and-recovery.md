---
id: F27
slug: emotional-inertia-and-recovery
title: Mood that lingers and mood that bounces back were not shown to be separate traits
tier: D
fields: [psychology]
date_found: 2026-10-29
standfirst: In four open phone-survey mood datasets, people whose mood carries over from one prompt to the next also tend to return more slowly after a spike. A two-trait model never beat a one-trait model, but the measures were too noisy for that test to have much power.
status: keep
figure: none
data: openESM datasets 0018 (Bailon 2020, CoVidAffect), 0062 (Neubauer 2024, STECCO), 0008 (Westhoff 2024) and 0076 (Bayer, mCog), CC BY 4.0
---
## What it means

Psychologists measure "emotional inertia": how much your mood at one moment predicts your mood at the next. A natural question is whether that is the same thing as how fast you recover after a sharp high or low. If they were separate, a person could be steady day to day yet slow to bounce back from a shock. We found the two linked in every dataset, and a model with two separate traits never fit better than one. That does not settle the question, because the person-level measures were barely reliable. The useful result is the warning: the usual way of computing inertia shares data with recovery, which inflates the link to between 0.67 and 0.81 on its own.

## The question

Does a person's emotional inertia vary separately from how fast they return to their usual mood after a spike?

## How we tested it

We used four open experience-sampling datasets, where people answer short mood questions on their phones several times a day. Each dataset was analysed on its own scale and never pooled. A lag pair is two adjacent prompts on the same day. A spike is a prompt at least 1.5 standard deviations from the person's mean. Recovery is the median share of each spike that has gone one prompt later. Inertia is the correlation between consecutive prompts, computed only on pairs that do not start with a spike, so the two measures use different data. People needed at least 30 prompts and 5 spikes, which left 71, 49, 99 and 259 people.

Two tests were preregistered. First, is the across-person correlation of inertia and recovery weaker than it would be if each person had only one parameter? Second, does a factor model with separate inertia and recovery factors, built from odd and even study days, beat a model with one factor?

## Controls and planted checks

Shuffling each person's mood values in time destroyed inertia in all four datasets, so the instrument reads real carryover. The key null simulated every person as a one-parameter AR(1) process on their exact prompt schedule, then ran the full pipeline. On synthetic data this null behaved as designed: in a one-parameter world the observed correlation fell inside it 6 of 6 times, and in a two-parameter world below its 5th percentile 6 of 6 times.

## Result

Across people, inertia against recovery gave r -0.44 (95% interval -0.63 to -0.19) in 0018, -0.41 (-0.68 to -0.09) in 0062, -0.28 (-0.45 to -0.09) in 0008 and -0.29 (-0.41 to -0.15) in 0076.

The coupling was weaker than the one-parameter null in 0008 (|r| 0.28 against a 5th percentile of 0.37) and in 0018 by a margin of 0.001 (0.439 against 0.440). In 0062 and 0076 it sat inside the null.

Two factors never beat one. Factor correlations were 0.95 and 0.98 in 0018 and 0008, and the 0076 model hit the boundary at 1.0 in magnitude. In 0062 too few people had enough data in both halves to fit it.

With the usual all-pairs inertia, which shares the spike pairs with recovery, |r| ran from 0.67 to 0.81. Coupling grew with series length: in 0018, r was -0.14, -0.45 and -0.78 across the shortest, middle and longest thirds, which fits noise hiding the link in short series.

## Limits

Split-half reliability ran from 0.03 to 0.47, so the factor test had little power. The AR(1) null has no measurement-noise term; noise weakens the observed coupling, which favours a pass on the first test, so the two passes are weak evidence. Recovery rests on few spikes per person. The four datasets are convenience samples on different scales. A second round with a noise term was planned and preregistered, but no run of it is on record, so its outcome is unknown. Related work exists, including Koval and colleagues (2015) on inertia, exposure and recovery.

## Verified

Verified: on 2026-11-09 the four correlations with their intervals and person counts, the AR(1) null quantiles, the factor correlations, the split-half reliabilities, the all-pairs range 0.67 to 0.81 and the 0018 tertile values were re-read from the study's result file and match the ledger. The preregistration's SHA-256 matches the locked hash. No result exists for the second round. Not re-run.

## Reproduce

Download the four openESM datasets. For each person, form lag pairs of adjacent prompts on the same day, flag spikes at 1.5 standard deviations from the person's mean, and compute recovery as the median fraction of each spike gone at the next prompt. Compute inertia as the lag-one correlation over non-spike pairs. Correlate the two across people with a person bootstrap. Simulate each person as AR(1) on their own schedule as the null. Fit one-factor and two-factor models to odd-day and even-day halves.

## Sources

- openESM datasets 0018 (Bailon 2020), 0062 (Neubauer 2024), 0008 (Westhoff 2024), 0076 (Bayer).
- Koval et al., 2015, emotional inertia and external events.
- Schreuder et al., 2024, on bouncing back from emotional ups and downs.
- Kendall, 1954, on bias in short autoregressive series.
- Kuppens, Allen and Sheeber, 2010, on emotional inertia.
