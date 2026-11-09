---
id: F97
slug: drought-space-time-tree-lens
title: Tree rings record the broad drought pattern and almost none of the local one
tier: B*
fields: [ecology-climate, biology-plant-forest-pathology]
date_found: 2026-10-29
standfirst: Across 664 western North American tree-ring sites, the trees pass almost none of the summer drought signal at scales below about 55 km and most of it above about 460 km. A tree-ring record that looks like a weak, flat climate recorder site by site is acting as a spatial filter.
status: keep
figure: none
data: CRU TS 4.10 self-calibrating PDSI (Climatic Research Unit, University of East Anglia; ODbL 1.0; Harris et al. 2020, doi 10.1038/s41597-020-0453-3). International Tree-Ring Data Bank standard chronologies (NOAA NCEI, public; cite contributors).
---
## What it means

When people check how well tree rings record drought, they usually compare one tree-ring site with the climate at that spot, year by year. Done that way, the trees in the American West look like a weak recorder that is about equally weak at every time scale. Splitting the comparison by distance as well as by time tells a different story. The trees carry most of the broad, regional drought pattern and almost none of the local detail, so the weakness belongs to space. A site-by-site skill number for any proxy hides how much of the loss is spatial.

## The question

We looked at western summer drought in space and time together. Three questions went to the drought field: whether its covariance splits into a space part times a time part, whether anomalies travel across the region over successive years, and whether broad and fine patterns fade at different rates. A fourth asked which combinations of spatial and time scale the tree rings pass through.

## How we tested it

We used the June to August self-calibrating Palmer Drought Severity Index from CRU TS 4.10 for 399 one-degree cells between 125 and 100 W and 30 and 50 N, 1903 to 2025, and 664 ring-width chronologies from the International Tree-Ring Data Bank in the same box, complete from 1903 to 1980, each paired with its nearest drought cell. Every series was detrended and scaled to unit variance.

Space was split into six bands with Gaussian smoothers 55 to 460 km wide, and time into five bands from periods over 32 years down to 2 to 4 years. In each cell we measured squared coherence between trees and drought: the share of the drought signal the trees pass. The plan and its pass and fail rules were hash-locked before any real outcome was computed.

## Controls and planted checks

The same code first ran on synthetic fields with known answers. It called a separable field separable (median p 0.37), recovered a planted wave's speed within 2.2 percent and its direction within 0.7 degrees, and read a diffusion exponent of 1.88 where the rule asked for 1.7 to 2.3. Real results faced a fitted separable surrogate, shuffled site coordinates, per-site phase randomisation, and an antisymmetric shuffle for travel. Seven tests were corrected together (Benjamini-Hochberg, q 0.05); intervals come from a 10-year moving-block bootstrap.

## Result

The tree filter passed. The contrast between broad and fine scales was 0.64 (95% interval 0.62 to 0.68), against 95th percentiles of 0.22 under phase randomisation and 0.30 when tree series were reassigned to shuffled sites; adjusted p 0.035. Below 55 km the trees passed 0.000 to 0.004 of the drought signal across the five time bands. Between 95 and 160 km they passed 0.07 to 0.11. Above 460 km they passed 0.27 to 0.91, with 0.91 at periods longer than 32 years and 0.27 at 2 to 4 years. About 61 percent of the tree variance sits in the finest spatial band, against about 12 percent for the drought index at the same sites.

The other tests came back null. Neither field departed from separability beyond its surrogate (drought index p 0.72, trees p 0.35). The drought fit pointed east-northeast at 64.5 km per year and beat the antisymmetric shuffle, but the bootstrap interval of the speed along that direction ran from minus 41 to 242 km per year and the adjusted p was 0.66, so no travel speed is claimed. The dispersion exponent for the drought field was 0.02 (minus 0.12 to 0.17): broad and fine scales lose their memory at about the same rate, with e-folding times of 0.76 to 0.83 years in every band.

## Limits

The drought grid is itself smooth. CRU interpolates precipitation with a correlation decay distance of about 450 km, close to where the tree filter opens, so part of the low fine-scale coherence may come from the reference grid. The tree sites cluster, so the finest band partly reads site noise. The travel and dispersion nulls hold for summer scPDSI at one degree and yearly steps in this box; monthly data or another index could show more. scPDSI is itself a model built from temperature and precipitation. The trees' dispersion fit hit its lower bound and tells us nothing. The per-site comparison that looked weak and flat was exploratory and was not preregistered.

## Verified

Verified: the contrast and its interval, both null percentiles, the adjusted p values, the coherence ranges in every band, the travel and dispersion estimates with their intervals, the e-folding times and the synthetic instrument readings were re-read from the run's result file on 2026-11-09 and match the ledger. The 61 and 12 percent variance shares were re-read from the published space-time panel file. The preregistration file's sha256 matches the hash recorded in the run. Not re-run.

## Reproduce

Download CRU TS 4.10 scPDSI and the ITRDB chronologies for the box above. Average June to August drought to complete one-degree cells, keep chronologies complete 1903 to 1980, then detrend and standardise. Build spatial bands with Gaussian smoothers of 55, 95, 160, 270 and 460 km and time bands at 1/32, 1/16, 1/8 and 1/4 cycles per year. Compute squared coherence between each tree and its nearest drought cell in every band pair, and compare the broad-against-fine contrast with phase-randomised and site-shuffled copies.

## Sources

- Harris et al. (2020), CRU TS dataset description, with the 450 km precipitation correlation decay distance. doi 10.1038/s41597-020-0453-3.
- International Tree-Ring Data Bank, NOAA National Centers for Environmental Information.
- Duchesne et al. (2017). PLoS ONE, on stand-level averaging of tree-ring climate signals and the fall of covariance with distance. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5744929/
