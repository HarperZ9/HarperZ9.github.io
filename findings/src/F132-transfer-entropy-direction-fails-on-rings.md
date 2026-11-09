---
id: F132
slug: transfer-entropy-direction-fails-on-rings
title: Transfer entropy could not tell which way climate and tree rings are linked
tier: D
fields: [ecology-climate, information-theory, method]
date_found: 2026-10-31
standfirst: Summer warmth drives tree growth, with no meaningful effect the other way, so tree rings make a clean test for tools that claim to read causal direction from data. A standard transfer entropy estimator failed that test on 135 sites, including on synthetic data where we planted the true direction ourselves.
status: keep
figure: none
data: International Tree-Ring Data Bank ring-width chronologies (NOAA NCEI; public). CRU TS 4.10 June to August temperature (Climatic Research Unit, University of East Anglia; ODbL 1.0).
---
## What it means

Transfer entropy is a popular way to ask whether one time series drives another, and it turns up in climate, ecology, neuroscience and finance. Here the answer was known in advance: summer temperature shapes the ring a tree lays down, and a ring has no meaningful effect on the summer that follows. On real ring-width records about 80 years long, the estimator found links both ways at similar rates. When we built synthetic records with the true direction planted at realistic strength, it ranked the wrong direction at or above the right one at about half the sites. A direction claim from this method on short, noisy annual records needs a planted-truth test before anyone trusts it.

## The question

Can a nearest-neighbour transfer entropy estimator read the direction of the link between summer temperature and tree-ring width, site by site, on public data? We set the rule in advance: the instrument would be cleared for direction reading only if it passed both the real-data test and a planted-truth anchor.

## How we tested it

We took 135 ring-width chronologies from the International Tree-Ring Data Bank that are complete from 1901, in 57 two-degree blocks, with a median length of 78 years. Each was paired with June to August temperature from its nearest CRU TS 4.10 cell, and both series were high-passed with a 10-year Gaussian. For each site we computed KSG conditional transfer entropy (k equal to 4) from climate to ring and from ring to climate at lags 0 to 3, keeping the largest. Each value was tested against 199 iAAFT surrogates of the source series, which keep its spectrum and value distribution and scramble its timing. A site counted as a detection at p of 0.05 or below. The plan was hash-locked before any estimate on real data.

## Controls and planted checks

The planted-truth anchor built synthetic ring series from each site's own surrogates with a known climate-to-ring coupling, once at the real data's strength and once much stronger (coefficients 0.6 and 0.3). A null world with no coupling, a shared-trend world, time-reversed series and a site-shuffled pairing at 1,000 km or more checked the rest. A second probe, convergent cross mapping, ran beside it.

## Result

On real data the estimator detected climate to ring at 15.6 percent of sites (block bootstrap 8.8 to 26.2 percent) and ring to climate at 11.9 percent (4.9 to 22.5 percent). The preregistered kill rule required the reverse rate to stay under 10 percent, so it fired, narrowly. Direction accuracy was 0.519 against a coin's 0.5. Time-reversed series gave 19.3 and 22.2 percent, so the estimator was reading no arrow of time.

The planted anchor failed. At the real coupling strength, forward detection was 19.3 percent and reverse 18.5 percent, and the false direction ranked at or above the true one at 52.6 percent of sites. With strong coupling, detection rose to 97.8 percent forward and 91.9 percent reverse, and accuracy reached 0.60 against the 0.8 the rule required. The estimator detected coupling and still misread its direction. The shared-trend world produced 12.6 and 17.0 percent, above the 10 percent limit even after high-passing. Convergent cross mapping pointed the wrong way: 18.5 percent forward against 28.9 percent reverse.

A preregistered variant that dropped lag 0 passed on real data (8.9 percent forward, 3.7 percent reverse) but missed a planted lag-one effect in the anchor, so its pass cannot be credited.

## Limits

Power is low at about 78 years and a ring-climate correlation near 0.2, so this is a failure on short annual series, and a longer or monthly design might behave differently. Transfer entropy's trouble with direction is known in general; the news here is limited to the tree-ring setting. Rings here are width only, the weaker channel for warmth. With 199 surrogates the smallest p is 0.005, so correcting across 135 sites could hardly reject anything, a design error we should have caught before the lock. Two later rounds on new sites switched to a panel-wide lagged Granger design. The first had its own kill rule fire on two gates by small margins. The second, on a third held-out panel, passed every binding check but one and earned a limited direction status. Neither changes this result for transfer entropy.

## Verified

Verified: the site, block and length counts, the real forward and reverse rates with their bootstrap intervals, the direction accuracy, the time-reversed rates, the planted-anchor rates at both strengths with the false-ranking share and accuracy, the null and shared-trend rates, the lag-0-removed variant rates and the cross-mapping rates were re-read from the run's result file on 2026-11-09 and match the ledger. The preregistration file's sha256 matches the locked hash. Not re-run.

## Reproduce

Select ITRDB ring-width chronologies complete from 1901 and pair each with the June to August temperature of its nearest CRU TS 4.10 cell. High-pass both with a 10-year Gaussian. Compute KSG conditional transfer entropy both ways at lags 0 to 3, take the maximum, and compare it with 199 iAAFT surrogates of the source treated the same way. Then plant a known climate-to-ring coupling into surrogate rings at the real correlation strength and check whether the estimator ranks the true direction first.

## Sources

- International Tree-Ring Data Bank, NOAA National Centers for Environmental Information.
- CRU TS 4.10, Climatic Research Unit, University of East Anglia.
- Spurious causalities with transfer entropy, Physical Review E 87, 042917.
- De Lellis et al. (2023), Journal of Physics: Complexity 4, 015001, on net transfer entropy misdirection.
