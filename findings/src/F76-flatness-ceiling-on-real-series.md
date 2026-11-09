---
id: F76
slug: flatness-ceiling-on-real-series
title: How flat a spectrum is predicts forecast skill, but real series follow it loosely
tier: B*
fields: [forecasting-prediction, information-theory, instruments-metrology]
date_found: 2026-10-29
standfirst: A 1940s formula says how predictable a series can be from its spectrum alone. On 1,236 real series it ranked held-out forecast skill (rho 0.41) and held as a ceiling in about 94 percent of them, yet real series tracked it less tightly than copies with the same spectrum and scrambled phases.
status: keep
figure: traxler-slot
data: International Tree-Ring Data Bank (ITRDB) index series, public; experience-sampling mood series from openESM (licence per dataset, check terms); two machine power logs that are not public
---
## What it means

The spectrum of a time series tells you how its variance spreads over frequencies. Kolmogorov and Szegő showed that a perfectly flat spectrum, white noise, cannot be predicted by any linear rule, and that the less flat it is the more a linear forecast can win. That gives a cheap ceiling you can compute before fitting any model. On real tree-ring and mood series it ranked series by how well they could be forecast, though less sharply than on idealised copies of the same data. Use it as a rough ceiling with an error band, never as an exact number for one series.

## The question

Does one minus spectral flatness, estimated on the first half of a series, rank and bound the skill of a linear forecast on the second half? And does it do so as well on real data as on Gaussian surrogates that share each series' spectrum?

## How we tested it

We took 1,128 tree-ring index series from the ITRDB (at least 200 years, no gaps), 106 experience-sampling mood series (at least 100 beeps), and two long machine power logs. Each series was split in half by time. On the training half we estimated flatness with a Hann-tapered periodogram and a log-bias correction, and fitted an autoregressive model with its order chosen by AIC. On the test half we scored one-step skill as one minus the mean squared error over the test variance.

A series violates the bound when its excess skill beats that of all but at most one of 39 phase-randomised surrogates of itself, which keeps the spectrum and destroys any other structure. By chance that happens in 5 percent of series. A nearest-neighbour analogue forecaster checked for predictability beyond the linear limit. The design and rules were hashed before any real-series statistic was computed. One change came before the lock and is disclosed: a first estimator underestimated the bound on synthetic data, so the tapered periodogram became primary.

## Controls and planted checks

Shuffling each series in time gave a pooled correlation with 95th percentile -0.023. On the 39 surrogate sets the correlation ran from 0.568 to 0.628 (5th to 95th percentile), and their mean violation rate was 5.1 percent, so the violation rule is calibrated. On 300 planted Gaussian AR series the estimated bound correlated 0.925 with skill and 0.946 with the true bound, with 4.3 percent violations. On 50 noisy logistic maps, a nonlinear system, the analogue forecaster beat the linear bound in all 50, so that instrument works.

## Result

All 1,236 series were kept. Spearman rho between bound and AR skill was 0.414 (95% interval 0.361 to 0.461), shuffle p 0.0099. Violations: 80 of 1,236, 6.5 percent (5.2 to 8.0), under the preregistered 10 percent kill. Median bound 0.203, median AR skill 0.129.

By group, tree rings gave rho 0.396 with 6.1 percent violations. Mood gave rho 0.035 (shuffle 95th percentile 0.098), because its bound (median 0.024) leaves almost nothing to rank. Both power series violated the bound; their load drifts between halves, so they are not stationary.

The real rho of 0.414 sits below every surrogate set (0.568 to 0.628). The violation rate is above the 5 percent chance rate (binomial p 0.013), though no single series survives a false-discovery correction across series. The analogue forecaster violated in 6.4 percent of series, equal to its own false rate on Gaussian AR (6.3 percent), so no nonlinear predictability beyond the linear bound turned up.

A later round tested drift-aware versions of the bound on a fresh split of the same data. None beat the original. On 585 test series the original gave rho 0.404 against a surrogate value of 0.595, so the gap repeated on a split of the same data family, not on new series.

## Limits

Tree rings are 91 percent of the series and arrive already standardised by their chronology method, so the pooled rho may come partly from the group mix. Fitting the AR model on half a series adds estimation error, which may explain part of the surrogate gap; nonstationarity and non-Gaussian structure are the other candidates, and this study does not separate them. The bound holds as a ceiling only after estimation error is allowed for: AR skill exceeded the point bound in 36 percent of real series and 46 percent of synthetic ones. Only one-step forecasts were tested. The bound itself is classical, and close heuristics exist.

## Verified

Verified: on 2026-11-09 every number and all eight verdicts quoted from the main study were re-read from its result file and match the ledger; the follow-up values 0.404, 0.595 and 585 were re-read from the later round's result file. The preregistration's SHA-256 matches. Not re-run.

## Reproduce

Download ITRDB chronologies of at least 200 years and open experience-sampling mood series of at least 100 beeps. On the first half of each series, compute flatness from a tapered periodogram with the Euler-gamma log correction and fit an AR model by AIC (maximum order min(20, n/10)); score one-step skill on the second half. Flag a series when its excess beats at least 38 of 39 phase-randomised surrogates. Correlate bound and skill across series.

## Sources

- Kolmogorov-Szegő formula for one-step linear prediction error.
- Fang et al., theory of predictability bounds, arXiv 1904.04765.
- Forecastability measures on the M5 data, arXiv 2507.13556 (abstract only).
- Goerg, 2013, Forecastable Component Analysis, PMLR v28.
- Luati, Proietti and Reale, variance profile.
- International Tree-Ring Data Bank.
