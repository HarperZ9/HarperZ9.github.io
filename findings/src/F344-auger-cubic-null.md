---
id: F344
slug: auger-cubic-null
title: No cubic pattern in public Auger cosmic-ray directions, at sensitivity that sees only large ones
tier: D
fields: [physics-other, method]
date_found: 2026-10-31
standfirst: If space were a fine cubic grid, the highest-energy cosmic rays might arrive in a pattern aligned with its axes. In the public Pierre Auger sample we find no such pattern at any of five energy cuts, and our planted tests show the search could only have seen a strong one.
status: keep
figure: traxler-slot
data: Pierre Auger Observatory Open Data (public 10 percent sample and UHECR catalogue), Zenodo record 10488964, CC BY-SA 4.0, doi 10.5281/zenodo.10488964, https://opendata.auger.org/data.php
---
## What it means

This is a null, and its value is in stating how weak it is. The public share of the Auger data is small enough that only a pattern of order-one strength at the top energies, or about 20 percent at 8 EeV, would have shown up. So the result rules out a large cubic imprint on these arrival directions and says nothing about a subtle one. Anyone citing public cosmic-ray data for or against a lattice universe should quote the planted sensitivity beside the p value.

## The question

One line of speculation about a discretised spacetime (Beane and others) predicts that a cubic lattice would bend the energy-momentum relation of the fastest particles differently along its axes and its diagonals. That could leave a cubic pattern in where ultra-high-energy cosmic rays come from. We asked whether the public Pierre Auger arrival directions carry any such pattern, and what the most energetic event says about the lattice spacing.

## How we tested it

We read the public event list (25,086 events) and the UHECR catalogue, and made five energy cuts: 8, 16 and 32 EeV from the event list, 40 and 78 EeV from the catalogue. The pattern is the cubic harmonic x^4 + y^4 + z^4 on the unit sphere. For each cut we rotated it through 400 random orientations, measured the mean excess of the events over an exposure-matched isotropic sky in standard-error units, and kept the largest. A null sky came from scrambling each event's right ascension while keeping its declination, which keeps the detector's exposure; each p value uses 300 scrambles. We corrected the five p values with the Benjamini-Hochberg procedure. The kill rule was locked in advance: a corrected p below 0.01 would have had to survive removing the Centaurus A region and a second energy cut before counting.

We also made a kinematic reading: the top event's energy sets the largest lattice spacing that would still let it propagate, in the simple picture where a particle cannot have a wavelength shorter than the grid: spacing below pi times hbar c over the energy.

## Controls and planted checks

- Right-ascension scrambles, 200 draws: the real statistic at 32 EeV, 1.69, sat well inside the null (95th percentile 3.27, p 0.87).
- Planted cubic patterns of strength epsilon at random orientations, drawn at the real events' declinations, gave the detection power at each strength: 30 trials per strength at 32 EeV, 10 at 8 EeV, so each power figure is coarse.
- Outlier checks: the 28 events within 27 degrees of Centaurus A removed, and the top 3 events removed.

## Result

- Events per cut: 3,111 at 8 EeV, 793 at 16, 155 at 32, 109 at 40, 101 at 78.
- Raw p values: 0.19, 0.68, 0.85, 0.55, 0.61. After Benjamini-Hochberg, all five read 0.85. No cubic pattern.
- At 32 EeV: without Centaurus A, p 0.38; without the top 3 events, p 0.71.
- Planted power at 32 EeV: 0.20 at epsilon 0.2, 0.40 at 0.5, 0.80 at 0.8, 0.97 at 1.0. At 8 EeV: 0.10 at 0.05, 0.30 at 0.1, 0.90 at 0.2.
- Kinematic reading: the top event at 166 EeV bounds the spacing below 3.7e-27 m, an inverse spacing of 5.3e10 GeV, 0.53 of the 1e11 GeV figure we recalled from Beane and others.

We had forecast about 2,600 events above 32 EeV, remembering the full dataset; the public release holds 155. We forecast detection at epsilon about 0.12; the real threshold is far higher.

## Limits

Only the public 10 percent of events was available, which is the main reason the sensitivity is low. The full Auger dataset would do much better and is not public at this level. Cosmic rays at 8 EeV are bent by galactic magnetic fields, and we did not model that, so a lattice pattern at the source could be smeared before arrival. We tested a cubic pattern only. The published bound we compared against was recalled, not re-read. The null bounds a large pattern alone. Scoring was by our own code, not blind.

## Verified

Verified: the 25,086 events read, the per-cut counts, the five raw p values, the Benjamini-Hochberg value 0.85, the Centaurus A and top-3 p values, every planted power figure, the scramble control percentile and p, the 166 EeV top energy, the 3.7e-27 m bound and the 0.53 ratio were re-read from the run's result file on 2026-11-09 and match the ledger. The data source and licence were read from the download's source record. Not re-run.

## Reproduce

Download the Pierre Auger Open Data release from Zenodo. Take arrival directions and energies, and cut at the energies above. For each cut, fit the amplitude of a cubic harmonic pattern over a grid of cube orientations and keep the maximum. Build a null by scrambling right ascension within the data, which preserves exposure in declination, and recompute the maximum many times. Plant cubic modulations of known strength into scrambled skies to measure detection power. Correct across cuts with Benjamini-Hochberg.

## Sources

- Pierre Auger Collaboration, Open Data, Zenodo, doi 10.5281/zenodo.10488964.
- Beane and others, on constraints on a lattice universe from cosmic rays (bound recalled from memory).
