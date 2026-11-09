---
id: F310
slug: titius-bode-is-spacing
title: Titius-Bode regularity in 122 exoplanet systems sits in gap sizes; their order adds nothing
tier: B
fields: [physics-other, method]
date_found: 2026-10-31
standfirst: Exoplanet systems do look more regular than random gaps would make them, but shuffling each system's own gaps into a new order leaves that regularity in place. A planet's position is predicted better by its two neighbours than by a Titius-Bode fit.
status: keep
figure: traxler-slot
data: NASA Exoplanet Archive, Planetary Systems Composite Parameters table (pscomppars), public archive, retrieved 2026-10-31 through the archive's TAP service, https://exoplanetarchive.ipac.caltech.edu
---
## What it means

The Titius-Bode rule says planets sit at distances that grow by a steady ratio, and it has been used to predict where unseen planets should be. Across 122 exoplanet systems we find the regularity is there, and it is fully explained by a simpler fact: the gaps inside one system tend to be similar sizes. Their order carries nothing extra. So a claim that a Titius-Bode fit "predicts" a missing planet deserves little weight, and a reader should ask whether the same prediction would come from the neighbours alone.

## The question

Does exoplanet spacing follow Titius-Bode beyond what each system's set of gaps explains? We fixed the decision in advance: if the rule failed the test, it would be reported as spacing and predicted-planet claims built on it would get no weight in our work.

## How we tested it

We took every system in the NASA Exoplanet Archive composite table with at least four planets that have periods and no controversy flag: 122 systems, 543 planets. For each system we fit three forms to the logarithm of the period: a plain log-linear rule, a Blagg-Richardson style form with an offset, and a Bovaird and Lineweaver style form that may insert up to two unseen planets. Our score for one system is the rms residual of log period divided by the mean log gap; the sample score is the negative median of that, so higher means more regular.

We also tested prediction directly. For each interior planet we dropped it, predicted its period from a fit to the rest, and compared that error with the error of the plain geometric mean of its two neighbours. A ratio above 1 means the neighbours win.

## Controls and planted checks

- Pooled gaps: rebuild each system from gaps drawn from the whole catalogue. Beating this means gaps within a system resemble each other.
- Order shuffle: keep each system's own gaps and put them in random order. Only beating this would show that the sequence itself is regular.
- Planted systems with exact log-linear periods and 5 percent jitter, at the same multiplicities, had to score above the pooled control's 95th percentile. They scored -0.050 against -0.190, so the instrument could see regularity when it was there.

The forms and the decision rule were locked before any spacing was computed; we had seen only the first two rows of the file.

## Result

- Plain form score -0.157. Pooled-gap control 95th percentile -0.190: the real systems beat it, p 0.0005 over 2,000 draws.
- Order-shuffle control 95th percentile -0.145: the real systems do not beat it, p 0.85 over 2,000 draws.
- Blagg-Richardson style form: -0.141 against an order-shuffle 95th percentile of -0.116, p 0.995 (200 draws).
- Gapped form: -0.079 against -0.074, p 0.68 (200 draws).
- Leave-one-out: median fit error 0.131 against 0.107 for the neighbours, ratio 1.23. Neighbours win.
- The Solar System, reported beside the test and outside it, scores r 0.32 on the plain form and 0.17 with gaps allowed. The catalogue's median system is more regular than ours on this statistic.

Our forecasts were 150 systems (got 122), median residual 0.22 (got 0.157), a 0.8 chance of beating the pooled control (it did), a 0.15 chance of beating the order shuffle (it did not), and a neighbour ratio of 1.15 (got 1.23). The preregistered "law-like" verdict failed.

## Limits

The three forms were written from memory of the published ones, and a later review of our ledger flagged that; a published form that differs could score differently, so the result is strictly about these three versions. Transit surveys miss long periods and tilted planets, so the gaps we see are shaped by the surveys; the order shuffle keeps those effects, which is why it is the fair control. Multi-planet catalogue entries are a selected set. The finding says nothing about the physics that sets spacing. Scoring was done by our own code and is not blind.

## Verified

Verified: n 122 systems and 543 planets, the scores -0.157, -0.141 and -0.079, the control percentiles and p values 0.0005, 0.85, 0.995 and 0.68, the planted score -0.050, the leave-one-out ratio 1.228 and the Solar System values were re-read from the run's result file on 2026-11-09 and match the ledger. The preregistration hash matches the hash recorded in the result. Not re-run.

## Reproduce

Query the NASA Exoplanet Archive composite parameters table for systems with four or more planets with known orbital periods and no controversy flag. For each system, sort planets by period and fit log period against index, with and without an offset term, and with up to two inserted empty slots chosen to minimise residual. Score each system as rms residual over mean log gap and take the median. Build two null sets: one shuffles the order of each system's own gaps, one draws gaps from the pooled catalogue. Compare the real median with each null's 95th percentile. For prediction, drop each interior planet and compare the fit's error with the error of the geometric mean of its neighbours' periods.

## Sources

- NASA Exoplanet Archive, Planetary Systems Composite Parameters.
- Bovaird and Lineweaver, 2013 (form used from memory).
- Blagg and Richardson (form used from memory).
- Weiss and others, 2018, on similar spacing within systems (cited from memory).
- Titius, 1766, the original distance rule.
