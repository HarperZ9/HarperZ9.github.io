---
id: F114
slug: ring-channel-bits-per-year
title: How much summer warmth one tree ring remembers, measured in bits
tier: B*
fields: [biology-plant-forest-pathology, ecology-climate, information-theory]
date_found: 2026-10-30
standfirst: A single Alpine tree-ring site keeps about a tenth of a bit per year about summer warmth on years it never saw, most of it in the density of its latewood. Averaging many sites buys far more than adding a measurement or one more tree past the usual replication threshold.
status: keep
figure: none
data: International Tree-Ring Data Bank, Europe (NOAA NCEI; open, cite contributors). ISONET oxygen isotope chronologies (GFZ; CC BY 4.0). CRU TS 4.10 temperature, precipitation and cloud cover (Climatic Research Unit, University of East Anglia; ODbL 1.0).
---
## What it means

Tree rings are one of the main records of past summers, and researchers can measure several things in each ring: its width, the width of its early and late wood, and the density of its wood. We put all of these on one scale, bits per year of summer climate recovered on held-out years, so a new channel, a new tree and a new site can be compared directly. Density carries more than width, which dendroclimatologists have known for decades. The new part is the shared scale, and what it shows: at a single site the ring is a narrow channel, and the big gains come from averaging across sites.

## The question

How many bits per year of the summer climate record survive into each tree-ring channel? What does each extra channel buy, and what does each extra tree buy? Can the season be reconstructed on years the model never saw?

## How we tested it

We used 51 Alpine and 24 Fennoscandian sites from the International Tree-Ring Data Bank with five channels gap-free from 1901: ring width, earlywood width, latewood width, minimum density and maximum latewood density. Targets were June to August temperature, precipitation and a sunshine proxy (100 minus cloud cover) from CRU TS 4.10. Every series was high-passed, keeping roughly 2 to 30 year variation. Skill was measured by five-fold block cross-validation and converted to bits as minus one half of log2(1 minus CE), where CE is the coefficient of efficiency. For a near-Gaussian target this is a lower bound on the information the ring carries. A nearest-neighbour (KSG) estimate sat beside it. The plan was hash-locked before any outcome.

## Controls and planted checks

A planted signal of 0.322 bits was read back as 0.331 by the Gaussian estimate, 0.308 by KSG and 0.269 on held-out years. A planted second channel worth 0.22 bits added 0.20. White noise scored minus 0.05 and a redundant copy minus 0.012, so neither was mistaken for signal. On real data the best channel scored 0.095 bits against phase-randomised, shuffled and white-noise controls whose 95th percentiles sat between minus 0.014 and minus 0.017. Of 15 channel and target tests, 14 survived Benjamini-Hochberg correction at q 0.05. A second code path, sharing no code with the first, scored the same verdicts on the Alps and on Fennoscandia.

## Result

In the Alps, maximum latewood density kept 0.090 bits per year of summer warmth on held-out years and ring width 0.028. Density beat width by 0.062 bits (95% interval 0.034 to 0.089; KSG 0.067), and the second code path agreed (0.062, 0.035 to 0.089). In Fennoscandia the gap was 0.28 bits (0.23 to 0.33): same sign, larger at the cold northern line.

Adding channels saturated more slowly than forecast. The mean curve over channel subsets ran 0.029, 0.060, 0.080, 0.088 and 0.092 bits for one to five channels, a saturation ratio of 0.25 against the 0.10 we had predicted, so that test failed. A second channel against one more tree past an expressed population signal of 0.85 could not be told apart: across 43 sites the channel gained 0.014 bits, the tree 0.004, and the difference was 0.011 (minus 0.003 to 0.025). That test failed too, and it fails in Fennoscandia as well.

Averaging all 51 Alpine sites reconstructed summer temperature with a held-out CE of 0.317 (0.275 bits) and a split-period reduction of error of 0.391, against a surrogate 95th percentile of 0.023. In Fennoscandia the regional CE was 0.72 (0.93 bits). Oxygen isotopes at 19 European sites carried 0.05 bits of temperature, 0.10 of rain and 0.11 of sunshine, all surviving correction.

## Limits

Bits here are a monotone transform of CE, so the unit relabels a familiar skill score; its value is that channels, trees and sites share one scale. The ranking of density over width is long known. Part of the regional gain comes from a smoother regional target. The channel against tree comparison is underpowered and its null is inconclusive. Cores stand in for trees. CRU cloud cover is partly interpolated, so sunshine bits are a floor. Windows end about 1975, and early CRU data are thin. The isotope panel is Europe-wide.

## Verified

Verified: all Alpine verdicts, the planted-signal readings, the control percentiles, the 14 of 15 surviving tests, the single-channel bits for density and width, the density-over-width difference with its interval, the subset curve and saturation ratio, the 43-site channel and tree gains with their interval, the regional CE, reduction of error and bits, and the isotope bits were re-read on 2026-11-09 from the Alpine result file. The second code path's Alpine interval and its Fennoscandian difference, interval, CE and bits were re-read from their own result files. All match the ledger. The preregistration file's sha256 matches the hash in the run. Not re-run.

## Reproduce

Take ITRDB European sites with ring width, earlywood and latewood width and minimum and maximum density gap-free from 1901, and pair each with its CRU TS 4.10 cell. High-pass every series with a 10-year Gaussian. For each channel and target, fit a linear reconstruction with five-fold block cross-validation, compute CE on the held-out folds, and convert to bits with minus one half log2(1 minus CE). Compare channels, subsets of channels, added trees past EPS 0.85, and the regional mean on that scale, with phase-randomised and shuffled controls.

## Sources

- International Tree-Ring Data Bank, NOAA National Centers for Environmental Information.
- ISONET European oxygen isotope network, GFZ.
- CRU TS 4.10, Climatic Research Unit, University of East Anglia.
- Wigley, Briffa and Jones (1984), expressed population signal.
- D'Arrigo et al. (1992); Grudd (2008): maximum latewood density over ring width for summer temperature.
- Romer et al. (2025), Quaternary Science Reviews; Popa et al. (2022): channel comparisons in correlation units.
