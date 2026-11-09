---
id: F362
slug: stated-uncertainty-tails
title: Published 1 sigma error bars hold near nominal; a 95 percent interval needs 3 to 5 sigma
tier: B
fields: [instruments-metrology, physics-other, method]
date_found: 2026-10-31
standfirst: When a particle mass or an atomic mass moves between editions of its reference table, the old 1 sigma error bar covers the new value about as often as it should. The tails are far heavier than a bell curve, so covering 95 percent of later values takes 3 to 5 times the stated sigma.
status: keep
figure: traxler-slot
data: Particle Data Group Review of Particle Physics mass and width tables, editions 2010 to 2025; Atomic Mass Evaluation tables 2003, 2012, 2016 and 2020 (older editions through the Internet Archive; terms for those copies not read); CODATA recommended values 2002 to 2022; Huchra's compilation of published Hubble constant values. No URLs or DOIs were recorded in the study files.
---
## What it means

A stated uncertainty is a promise about where the truth will turn out to be. We checked that promise against what happened next, using later editions of the same tables as the stand-in for truth. The core of the promise holds. The edges do not: values that move by four or five sigma happen far more often than a normal curve allows. If you read a published "plus or minus" and want 95 percent confidence, multiply it by three to five, and by ten for a young astronomical measurement.

## The question

How often does an earlier stated interval contain the value in the latest edition of the same table? And what multiple of the stated sigma would have been needed to reach 68 and 95 percent coverage?

## How we tested it

For each quantity in each table we took its value and stated error in the first edition and its value in the last, computed the shift in units of the earlier sigma, and counted how often that shift was under 1 and under 2. We fitted a Student t distribution to the shifts to measure the tails (smaller nu means heavier tails; a normal curve is nu infinite). Because a value that never moves is "covered" trivially, we report a moved-values arm beside the all-values figure. For the Hubble constant there is no later edition, so we used three proxy truths, 67.4, 70 and 73 km/s/Mpc, and report each.

## Controls and planted checks

- Planted data with the stated error set to half the true error and t-distributed scatter: the method recovered the needed multiple as 2.405 against a true 2.394.
- An honest Gaussian world at the PDG sample size, 500 draws, to see what shortfall pure chance gives.
- Assumptions changed one at a time: unchanged values removed, top 1 percent removed (coverage moved about 0.01), last step alone, and one CODATA row per distinct shift pattern.

## Result

| Table | Span | n | Within 1σ | Within 2σ | Needed for 68% | Needed for 95% | t nu |
|---|---|---|---|---|---|---|---|
| PDG, moved values | 2010 to 2025 | 227 | 0.68 | 0.85 | 1.00 | 3.8 | 1.67 |
| PDG, all values | 2010 to 2025 | 347 | 0.79 | 0.90 | 0.56 | 3.1 | |
| AME | 2003 to 2020 | 2,213 | 0.66 | 0.82 | 1.10 | 4.0 | 1.22 |
| CODATA | 2002 to 2022 | 211 | 0.85 | 0.92 | 0.75 | 4.9 | 2.17 |
| CODATA, last step | 2018 to 2022 | 273 | 0.47 | 0.56 | 4.4 | 4.7 | |
| H0, truth 70 | to 2010 | 544 | 0.53 | 0.75 | 1.67 | 6.5 | |
| H0 before 1990, truth 70 | | 115 | 0.35 | 0.55 | 2.9 | 9.8 | |

The 95 percent interval on PDG moved values for 1 sigma coverage is 0.63 to 0.74; for AME it is 0.65 to 0.68. Fitted tails with nu between 1.2 and 2.2 are close to the Cauchy shape. Across all PDG values the tables over-cover, since 35 percent of values never moved. The bad CODATA step from 2018 to 2022 is mostly one input: the fine-structure constant moved by about 4.5 of its 2018 sigma and carried many derived constants with it, which the CODATA 2022 report itself states. The Hubble constant before 1990 is the worst field in the set at every proxy truth.

## Limits

Later tables reuse inputs from earlier ones, which flatters every coverage figure here; editions that share no inputs would be the cleaner test. The H0 numbers depend on the proxy truth chosen, so read them per proxy. PDG editions before 2010 could not be reached. Correction factors fitted on early CODATA editions did not carry forward to later ones, so the 3 to 5 sigma figure describes the past and will miss when a shared input breaks. The direction agrees with Bailey, 2017, which was read once during the study and not re-read for this write-up, and our tails come out heavier than the nu of 2 to 3 reported there. Our forecast of 0.55 for all-value PDG coverage missed; it came in at 0.79.

## Verified

Verified: every n, coverage, multiple and nu in the table, the PDG and AME coverage intervals, the 0.35 PDG unchanged share, the H0 values at all three proxies, and the planted recovery 2.405 against 2.394 were re-read from the run's result file on 2026-11-09 and match the ledger. The preregistration hash matches the hash recorded in the result. The ledger's count "6 of 10 forecasts held" could not be reproduced from the verdict list (5 of 9 forecast rows, 6 of 11 forecast and hypothesis rows) and is left out. Not re-run.

## Reproduce

Take two or more editions of a reference table listing a value and a 1 sigma uncertainty per quantity, and match quantities. For each, compute z = |last value minus first value| / first sigma. Report the share with z under 1 and under 2, the 68th and 95th percentiles of z, and a Student t fit to the signed shifts. Repeat with unchanged values removed. For a field with no settled value, fix two or three candidate truths in advance and report each.

## Sources

- Particle Data Group, Review of Particle Physics, editions 2010 to 2025.
- Atomic Mass Evaluation, 2003, 2012, 2016, 2020.
- CODATA recommended values, 2002 to 2022, and the CODATA 2022 report.
- Huchra's Hubble constant compilation.
- Bailey, 2017, on heavy tails in measurement uncertainty.
