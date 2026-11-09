---
id: F281
slug: speed-limit-rerun
title: A home rerun of the GRB 090510 light-speed test, and sound waves that keep their own limit
tier: D
fields: [physics, physics-other]
date_found: 2026-10-31
standfirst: Using public Fermi photons from one gamma-ray burst, we bound any energy-dependent change in light speed to under 7.6 parts in a quintillion at 30 GeV, about 24 times weaker than the published limit from the same burst. In a simulated fluid, sound obeys its own speed limit at long wavelengths and leaves it at short ones by a known law.
status: keep
figure: traxler-slot
data: Fermi Large Area Telescope public photon data, weekly photon file for week 49 (P305) and the GRB 090510 trigger folder bn090510016, NASA HEASARC Fermi Science Support Center, public with no restriction on use, https://heasarc.gsfc.nasa.gov/FTP/fermi/data/lat/triggers/2009/bn090510016/current/
---
## What it means

The question "can some waves beat the speed of light" has two honest answers depending on what you mean by speed. In empty space, the highest-energy photons from a distant burst arrived with the low-energy ones, and even our simple reanalysis puts a tight lid on any energy-dependent speed. In a medium, waves have their own speed limits that bend at short wavelengths by an ordinary, known law. Neither result needs new physics, and our rerun is a check on method that comes out weaker than the published one.

## The question

We tested three readings. Vacuum: light speed depends on photon energy, so a short, distant gamma-ray burst would deliver its high-energy photons early or late. Medium: phase and group velocities can exceed c while the signal front cannot. Sound: in a moving fluid, sound has its own light-cone set by the sound speed, and that cone breaks at short wavelengths. Each had numeric kill rules written before the run.

## How we tested it

For the vacuum reading we took the public LAT photons around GRB 090510, kept those above 100 MeV near the burst (119), and fitted a linear time delay per GeV on the 84 inside the analysis window. The highest-energy photon carried 29.9 GeV and arrived 0.828 s after the trigger. We bounded the delay by bootstrap. After seeing in a dry run that resampling drops the top photon, we added a one-photon bound that assumes no emission before the trigger; it is labelled as added.

For the sound reading we simulated waves in a uniform and in a horizon-forming flow, checked the transformation between frames, and measured the dispersion of a Bose-condensate-like medium against the Bogoliubov formula.

## Controls and planted checks

- Shuffled photon energies, 300 draws: the real fitted delay of 0 sits inside the shuffled range of -44 to +76 ms per GeV.
- Planted delays at 1, 3, 5 and 10 times the limit were recovered within 0.9 percent.
- In the sound frame test, the true sound speed gave a residual of 4.5e-4 and a wrong speed gave 0.78, so the test can tell them apart.

## Result

Vacuum. The bootstrap interval on the delay is -117 to +46 ms per GeV. That gives a linear quantum-gravity energy scale above 0.32 Planck energies, or a fractional speed change under 7.6e-18 at 29.9 GeV. Our preregistered kill for the vacuum form was 1e-15, so the form is killed in the 0.1 to 30 GeV band of this test. The added one-photon bound gives 27.7 ms per GeV, or 1.36 Planck energies. The published limits are stronger: above 7.6 Planck energies from this burst (Vasileiou and others, 2013) and above 10 from GRB 221009A (LHAASO, 2024). We forecast at least 0.5 Planck from the fit and got 0.32, so two of our own rows failed.

Sound. In a uniform flow, waves move at v plus or minus the sound speed to within 1e-6. Inside a simulated horizon they stay trapped, and the surface gravity came out within 3.3 percent. At short wavelengths the measured frequencies follow the Bogoliubov dispersion within 2 percent, and a short-wavelength packet travelled at 2.89 times the sound speed. Sound has its own cone at long wavelength and leaves it at short wavelength by a known law. One rule failed: the packet's position lagged the ray prediction by 0.16 against a limit of 0.01, because the packet's width is as large as the distance it travels.

In all, 12 of 15 locked rules passed.

## Limits

The vacuum limit holds only for the energies tested. Above them, the published limits apply; radio and lower energies, and any carrier not measured, stay open. Our selection is simple: no instrument response and no intrinsic spectral lag were modelled, which is part of why our bound is weaker. A later review of our ledger noted that the rerun does not reproduce the published number, and we agree: read it as a reproduction of the method. The sound simulations test known theory and add no new law. Scoring was by our own code, not blind; plans tuned in dry runs before the lock are listed in the preregistration.

## Verified

Verified: the photon counts 119 and 84, the 29.9 GeV top energy at 0.828 s, the bootstrap bounds, the 0.32 and 1.36 Planck values, the 7.64e-18 speed change, the shuffled range, the planted recovery errors, the 9.6e-7 uniform-flow error, the 0.16 horizon lag, the 3.3 percent surface-gravity error, the 1.95 percent Bogoliubov error, the 2.89 packet group speed and the 12 of 15 pass count were re-read from the run's result file on 2026-11-09 and match the ledger. The preregistration hash 21d88e4c matches the file on disk. Published limits are as quoted from abstracts in the study's source list. Not re-run.

## Reproduce

Download the Fermi LAT photon data covering GRB 090510 from the HEASARC archive. Select photons above 100 MeV within the burst region and window. Fit arrival time against energy with a linear slope, bootstrap the slope, and convert the larger bound to an energy scale using the burst's redshift with the standard linear-dispersion formula. Shuffle energies across photons to build a null. For the sound part, solve the linear wave equation in a moving medium, then the Bogoliubov dispersion omega = c_s k sqrt(1 + (k xi)^2 / 2), with xi the healing length, and compare packet motion with ray predictions.

## Sources

- Vasileiou and others, 2013, arXiv 1305.3463 (abstract read).
- LHAASO, Cao and others, 2024, arXiv 2402.06009 (abstract read).
- Abbott and others, 2017, ApJ Letters, arXiv 1710.05834, gravitational waves against gamma rays (abstract read).
- Unruh and Steinhauer on sonic horizons (abstracts read).
- Fermi LAT public data, NASA HEASARC.
