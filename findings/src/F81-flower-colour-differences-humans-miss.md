---
id: F81
slug: flower-colour-differences-humans-miss
title: Among colours people cannot tell apart, bees and birds split flowers from backgrounds more often
tier: B
fields: [biology-other, colour-film, ecology-climate]
date_found: 2026-10-29
standfirst: On 728 measured natural surfaces, modelled bees and blue tits separate flower-against-background pairs that look identical to people far more often than background-against-background pairs. The direction held on a second surface set and under a second noise model; the size of the effect did not travel.
status: downgrade
figure: none
data: 728 reflectance spectra of Australian flowers, rocks, bark and leaves (Dorin, Shrestha, Garcia, Burd and Dyer; Dryad fn2z34v2c; CC0). CIE 2006 cone fundamentals and D65 (CC BY-SA 4.0). pavo 2.10.0 bee, dog and blue tit sensitivity curves and Endler illuminants (GPL 2 or later). Replication set: LeCroy et al. flower spectra (Dryad v41ns1rtq, CC0) and Kraemer and Adams soil and litter spectra (Dryad 4dv78, CC0).
---
## What it means

Two surfaces can look the same colour to a person and still differ sharply to a bee, mostly because bees see ultraviolet. We asked where those hidden differences fall in a real collection of surfaces. They fall disproportionately between flowers and the rocks, bark and leaves around them, which is what you would expect if flower colour is tuned to the animals that visit flowers. The UV channel itself is textbook, and earlier work used this same data set to study flower signals against backgrounds. What we add is a direct count of human-invisible differences, with controls, and a check of how far the number can be trusted.

## The question

Among pairs of surfaces a human cannot separate, does a modelled bee or blue tit separate flower-background pairs more often than background-background pairs?

## How we tested it

We used 728 open reflectance spectra: 221 flowers and 507 rocks, bark and leaves. Each observer was modelled with the receptor-noise-limited model of Vorobyev and Osorio (1998), with published receptor curves and noise values: human, two kinds of colour-blind human, dog, honeybee, blue tit, and a mantis shrimp in two forms. Two surfaces count as indistinguishable when their modelled colour distance is at most one just-noticeable difference. For every pair a human cannot separate, we asked whether the bee or blue tit can, and compared the rate for flower-background pairs with the rate for background-background pairs. The same was done for pairs a dog cannot separate. The tests and pass rules were hash-locked before the run.

## Controls and planted checks

The main control shuffled the flower and background labels 500 times and recomputed the ratio, which shows how large it gets by chance. An instrument check asked the model for the smallest wavelength step each observer should detect and compared that with behavioural measurements. That check failed: the model resolves 0.4 nm for humans and 0.3 nm for bees, finer than behaviour. Because of this failure, only ranks and ratios from the model are used, never absolute sizes.

## Result

Among pairs a human cannot separate, the bee separated 98 percent of flower-background pairs (1,108 pairs) and 48 percent of background pairs (3,892 pairs), a ratio of 2.04 against a label-shuffle 95th percentile of 1.08 (p 0.002). The blue tit separated 99 against 45 percent, a ratio of 2.22 (95th percentile 1.09). Among pairs a dog cannot separate, the ratios were 1.45 for the bee and 1.16 for the blue tit, each above its shuffle percentile. All four survived Benjamini-Hochberg correction.

Some named examples: a *Hypericum pygmaeum* petal against a dry brown leaf sits 0.63 units apart for a human and 22.4 for a bee, with a petal UV share of 0.70 against 0.00. Going the other way, the red, bird-pollinated *Calothamnus graniticus* is nearly invisible to the bee against several pale minerals while standing out strongly to a human.

A follow-up study the same night added photon noise to the model, the noise every real photoreceptor has. On the same 728 surfaces the ratios fell to 1.67 for the bee and 1.50 for the blue tit given human-blind pairs, still well above their shuffle percentiles. On a second set, Californian flowers against North American soil and leaf litter, the bee ratio was 45.6. That set's 41 background spectra are brown and alike, so the large value measures how uniform those backgrounds are as much as anything about flowers. The direction held in every case; the size depends on the noise model and on the surfaces.

## Limits

The instrument check failed twice, once with the original noise model and again with photon noise, so the model is too fine for at least the bee. Several receptor noise values come from secondary sources or memory. The model uses whole-surface spectra and ignores pattern, so nectar guides inside one flower are out of reach. Backgrounds were not matched to each flower's own site. Dorin et al. (2023) studied flower signalling on this same data. Discrimination capacity in a model is not what the animal experiences, and no behaviour was tested.

## Verified

Verified: the 728 surfaces and group counts, the four flower-background and background-background rates with their pair counts, the four ratios with their shuffle percentiles and p values, and the instrument-check values for human and bee were re-read on 2026-11-09 from the first run's result file. The photon-noise ratios for both sets and the second set's pair counts were re-read from the follow-up run's result file. All match the ledger. The preregistration file's sha256 matches the locked hash. The *Hypericum* example values were re-read from the first run's example list; the *Calothamnus* example comes from the ledger and was not re-read. Not re-run.

## Reproduce

Download the Dorin et al. spectra from Dryad, and receptor sensitivity curves for human (CIE 2006), bee, blue tit and dog. Compute quantum catches under D65 with von Kries adaptation, then receptor-noise-limited distances between every pair of surfaces. Mark pairs below one just-noticeable difference for the human. Among those, compare the share the bee separates for flower-background pairs with the share for background-background pairs, and compare that ratio with label shuffles.

## Sources

- Dorin, Shrestha, Garcia, Burd and Dyer, spectral data, Dryad fn2z34v2c.
- Dorin et al. (2023), Proceedings of the Royal Society B, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10730291/
- Vorobyev and Osorio (1998), receptor-noise-limited colour discrimination model.
- pavo 2.10.0 receptor and illuminant data.
- LeCroy et al., Dryad v41ns1rtq; Kraemer and Adams, Dryad 4dv78.
