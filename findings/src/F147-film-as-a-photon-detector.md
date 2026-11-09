---
id: F147
slug: film-as-a-photon-detector
title: Kodak's own curves put modern colour negative at 0.6 to 4.9 percent quantum efficiency
tier: B
fields: [colour-film, instruments-metrology]
date_found: 2026-10-31
standfirst: Reading three Kodak VISION3 data sheets as if the film were a photon counter, the best layer uses about 5 percent of the light's information and the median layer about 2 percent. The 500T and 200T stocks match each other within 10 percent although one needs about twice the photons of the other.
status: keep
figure: traxler-slot
data: Kodak VISION3 technical data sheets for 5219 (500T), 7213 (200T) and 7203 (50D), digitised from the published vector sheets (Kodak copyright; only derived values are reported). Brochure example, https://www.kodak.com/content/products-brochures/motion-picture/KODAK-VISION3-500T-5219-7219-brochure.pdf
---
## What it means

Detective quantum efficiency (DQE) asks how much of the information in the arriving photons a detector keeps. It lets you put a film stock, a camera sensor and an eye on one scale. From numbers Kodak already prints, the colour layers of three current motion-picture stocks keep between 0.6 and 4.9 percent. That is a ceiling estimate, and it gives a film emulator a measured noise model to use in place of a textbook rule.

## The question

Three questions shared one preregistration. What peak DQE do the published sheets imply for each colour layer? Does grain noise grow with density as Siedentopf's classic rule says (variance proportional to density)? And can one Poisson hit-threshold model, the kind used for rods in the eye, describe the film's response and its noise together?

## How we tested it

We digitised the characteristic curves, granularity curves (48 micrometre aperture) and spectral sensitivity for nine layers: blue, green and red in 5219, 7213 and 7203. DQE is noise-equivalent quanta over photons in the aperture. Noise-equivalent quanta come from the curve's slope and the granularity; photons come from the sheet's sensitivity at net density 0.2, counted as if every photon arrived at the layer's most efficient wavelength. That last step is why the figure is an upper-range value. For noise against density we compared Siedentopf's rule with constant, affine and quadratic forms on held-out high-density points. For response shape we compared eight forms, from Hill and Naka-Rushton to a hinge, again on held-out points.

## Controls and planted checks

Each block had a planted check with a known answer. Synthetic single-size grains with a closed-form DQE came back within 11.3 percent (limit 20). Planted response forms were recovered 80 percent of the time on held-out points (limit 50). The planted variance law was recovered only 70 percent of the time against a locked requirement of 80, so by our own rule the variance verdict is void and what we say about noise below is description only. For response forms we shuffled density against exposure 25 times; the real top-form share of 1.0 beat the shuffled 95th percentile of 0.44 (p 0.038). A pairing control for the slope-to-noise correlation gave 0.61 against a shuffled mean of 0.66 (p 0.74), so that test could not separate the layers.

## Result

- Peak DQE across nine layers: median 2.1 percent, range 0.57 to 4.92 percent.
- Green layers: 5219 4.5 percent, 7213 4.9 percent, 7203 1.5 percent. Photons per square micrometre at net density 0.2 in green: 4.2, 8.7 and 65.8, a spread of 15.7 times. The DQE spread is 3.24 times, just over our preregistered limit of 3, so "same efficiency at every speed" fails narrowly: 500T and 200T agree within 10 percent and 50D is lower.
- DQE peaks low on the curve, at net density 0.06 to 0.31.
- Noise (descriptive only): variance falls with density overall, median power slope -0.54 where our forecast was +0.15, with a hump near the toe. Siedentopf's rule lost on held-out points in 9 of 9 layers.
- Response shape: the hinge won on held-out points in 9 of 9 layers. Negative stock shows no shoulder within the sheet's range, so every saturating form loses when extrapolated.
- Poisson threshold: the form does not fit. A later study of ours (F163) found that this fit passed the logarithm of the standard deviation where the model expected the logarithm of the variance. On the corrected channel the log-variance error is 0.186 and the density error 0.068, both above our limits of 0.05 and 0.04, and the best hit number changes from 1,1,1,6,6,6,6,6,6 to 1,1,1,1,6,1,6,1,1 across the layers. The conclusion stands and no hit number is read as a measurement.

## Limits

One maker, one aperture, vendor curves read from printed sheets. Kodak notes that its granularity uses a modified technique. The photon count assumes peak-wavelength light, so every DQE here is an upper bound. Searches turned up roughly 1 percent for older emulsions through secondary summaries; Shaw's and Dainty and Shaw's classic texts on film DQE were not read, and they may set these numbers in context. Forecasts on 5219 were not blind: one hand calculation was done before the lock and is disclosed. Nothing here bears on rods; the cross-media comparison waited for later data.

## Verified

Verified: the nine peak DQE values (0.0057 to 0.0492, median 0.0212), the green-layer DQE and photon counts, the 3.24 and 15.7 spreads, the median slope -0.54, the 0.113 planted DQE error, the 0.70 planted variance rate, the hinge share and its shuffle p 0.038 were re-read from the run's result file on 2026-11-09 and match the ledger. The preregistration hash c0dbcacf...329a matches the file on disk. The corrected threshold numbers come from the later ledger entry, F163, and were not recomputed here. Not re-run.

## Reproduce

Digitise the characteristic curve, the diffuse rms granularity curve and the spectral sensitivity curve for each layer of a VISION3 data sheet. On a grid of 0.05 in log exposure, compute the slope gamma and, from granularity sigma, NEQ = (gamma / (ln 10 x sigma))^2. Convert the sheet's sensitivity at net density 0.2 into photons per square micrometre at the layer's peak wavelength, scale to the aperture area, and take DQE = NEQ / Q at each exposure. Report the peak per layer. For the threshold model, fit density and log variance (not log sigma) together.

## Sources

- Kodak VISION3 5219, 7213 and 7203 technical data sheets.
- Shaw, 1963, and Dainty and Shaw, 1976, cited in secondary sources; not read.
- Siedentopf's grain variance rule, as named in the study.
