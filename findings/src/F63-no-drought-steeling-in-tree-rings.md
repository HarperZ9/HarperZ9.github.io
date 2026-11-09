---
id: F63
slug: no-drought-steeling-in-tree-rings
title: Across 1,175 tree-ring sites, an earlier moderate drought did not toughen trees
tier: D
fields: [biology-plant-forest-pathology, ecology-climate]
date_found: 2026-10-29
standfirst: We tested whether trees that lived through a moderate drought came through a later severe drought better. Across 1,175 North American tree-ring sites they did not, detectably, and a rerun with a finer drought grid gave the same null.
status: keep
figure: none
data: International Tree-Ring Data Bank standard chronologies (NOAA NCEI; public, check contributor terms). NOAA nClimDiv June to August PDSI by climate division (public). Rerun with CRU TS 4.10 scPDSI at 0.5 degree (Climatic Research Unit, University of East Anglia; ODbL 1.0).
---
## What it means

A common intuition says stress hardens: a tree that survives a dry spell should cope better with the next one. We looked for that effect across a large public archive of tree rings, with the test written down in advance, and found nothing we could tell from chance. Trees that had lived through an earlier drought grew less in the severe drought year and bounced back more afterwards, and the two roughly cancel. Anyone citing drought "priming" or "stress memory" in forests should treat it as unshown at this scale.

## The question

Does a moderate drought four to eleven years earlier raise a tree's resilience to a later severe drought?

## How we tested it

We used standard ring-width chronologies from the International Tree-Ring Data Bank for 1,175 sites and 65 species, matched to NOAA's June to August Palmer Drought Severity Index for their climate division. A severe drought was a division year with PDSI at or below minus 3. That gave 579 division droughts and 3,780 site-drought events. For each event we computed Lloret resilience, growth after the drought relative to growth before, on a log scale. We then asked whether events preceded by a moderate drought in the window four to eleven years earlier had higher resilience, with site and year effects and standard errors clustered by climate division. The hypotheses and pass rules were hash-locked before the run.

## Controls and planted checks

The main null shifted each division's drought record in time by a random offset of 20 years or more, which breaks the link between drought and growth while keeping each record's own pattern. A placebo looked for an effect of droughts that came after the event, which should show nothing. A second null permuted the prior-drought labels among a site's own events.

## Result

Moderate prior drought moved log resilience by plus 0.039 (95% interval minus 0.011 to plus 0.090), with a Benjamini-Hochberg q of 0.17. That sits inside the time-shift null, whose 95th percentile was 0.065 (p 0.18). The preregistered steeling test failed. A severe prior drought gave plus 0.009 (minus 0.039 to plus 0.057). Moderate and severe priors did not differ, and no rise-then-fall pattern with dose emerged. The future-window placebo was clean (plus 0.006, p 0.86).

The components explain why. A prior severe drought lowered resistance, growth in the drought year itself, by 0.087 (p 0.006) and raised recovery by about 0.10. Resilience is resistance times recovery, so a weaker drought-year ring raises recovery partly by arithmetic.

The estimate did beat the label-permutation null (95th percentile 0.020, p 0.004). That null keeps every site's drought timing, so it is a weaker comparison than the time shift, and the preregistered rule used the time shift.

A day later we reran the test with drought taken from the nearest 0.5 degree cell of the CRU TS self-calibrating PDSI, on 1,097 sites and 2,549 events with species and year effects. Moderate prior drought gave plus 0.025 (minus 0.009 to plus 0.059), below the time-shift 95th percentile of 0.038 (p 0.14). A small positive sign that had appeared under division drought with species effects (plus 0.037, p 0.047) did not survive the finer drought data.

## Limits

The interval still allows a gain of up to about 9 percent in resilience, so small conditioning effects are not ruled out. No autocorrelation baseline for biological memory was fitted, and the recovery gain is partly mechanical. In the finer-grid rerun with site effects in place of species effects, a prior severe drought gave plus 0.064 (0.009 to 0.118, uncorrected p 0.022). That model was not the preregistered test there, and we read it as a lead for a new locked study. The same study ran toy models of a growing rod, a small neural network and a Bayesian learner; those show only what follows from their own rules and say nothing about trees or people.

## Verified

Verified: the 1,175 sites, 65 species, 3,780 events and 579 droughts, the moderate and severe estimates with their intervals, the q value, the time-shift and permutation null percentiles and p values, the placebo, and the resistance and recovery estimates were re-read on 2026-11-09 from the run's result file and results file and match the ledger. The finer-grid rerun's counts, estimate, interval and null percentile were re-read from its own result file. The preregistration file's sha256 matches the locked hash. The ledger headline counts 9 passes and 13 failures across all 22 tests; the result file and the ledger's own list give 10 and 12. None of the tree numbers above depends on that count. Not re-run.

## Reproduce

Take ITRDB standard chronologies in the contiguous United States and pair each site with its NOAA climate division June to August PDSI. Mark severe droughts at PDSI of minus 3 or below. For each site-drought event compute log Lloret resilience, and flag whether a moderate drought fell four to eleven years before. Regress resilience on the flags with site and year effects and division-clustered errors, then repeat 200 times with each division's PDSI record circularly shifted by 20 years or more.

## Sources

- International Tree-Ring Data Bank, NOAA National Centers for Environmental Information.
- NOAA nClimDiv climate division drought data.
- CRU TS 4.10, Climatic Research Unit, University of East Anglia.
- Anderegg et al. (2020), Nature Climate Change, on repeated drought, doi 10.1038/s41558-020-00919-1.
- Anderegg et al. (2015), drought legacy effects.
- Schwarz et al. (2020), on the arithmetic link between Lloret resistance and recovery.
