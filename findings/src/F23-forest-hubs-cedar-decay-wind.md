---
id: F23
slug: forest-hubs-cedar-decay-wind
title: Fungal hub trees mostly track sampling, cedar heartwood rots slowest, wind damage evades prediction
tier: B
fields: [biology-plant-forest-pathology, biology-mycology, ecology-climate]
date_found: 2026-10-29
standfirst: In a public map of fungi shared between Douglas-fir roots, the hub trees are largely what the sampling and the number of links produce. In a 30-year log experiment, western redcedar heartwood lost density slowest of four species, and in a large forest inventory, wind damage ranked well but forecast almost nothing.
status: keep
figure: none
data: Beiler, Simard and Durall 2015 network data (Dryad, doi 10.5061/dryad.7ts20, CC0). HJ Andrews Experimental Forest TD014 long-term log decay experiment, PI Mark E. Harmon (CC BY 4.0, credit line required). USDA Forest Service Forest Inventory and Analysis DataMart, Washington and Oregon (public domain).
---
## What it means

The "wood wide web" has become a popular story about trees sharing resources through fungal networks, with large "mother trees" as hubs. When we reran a public network map with the right comparison, most of what looks like hub structure came from how many root tips were sampled on each tree and from the number of links alone. Networks may still exist; a picture of hubs needs a null model before it carries meaning. The same studies confirmed that cedar heartwood resists decay and showed that inventory wind damage is hard to forecast tree by tree.

## The question

Do big trees act as hubs in a mapped fungal network once sampling effort is accounted for? Does western redcedar heartwood decay more slowly than other conifers, and can decay be forecast for logs not yet sampled? Can inventory data say which trees wind will damage?

## How we tested it

Network: six 10 by 10 m plots of interior Douglas-fir in British Columbia, where 758 root tips were typed to one Rhizopogon fungal individual (genet) and one tree. That gives 166 trees and 56 genets. We compared each plot's hub concentration and nestedness with 1,000 degree-preserving shuffles, which keep every tree's and genet's number of links and scramble who links to whom.

Logs: 530 logs of four species laid out in 1985 at six old-growth sites in the HJ Andrews forest. We fitted decay curves to years 1 to 16 and forecast logs held out at years 20 and 30, scored against carrying the last value forward. Decay rates came from single-exponential fits to all 30 years with a bootstrap over logs.

Wind: 488,499 live trees in the Forest Inventory and Analysis records for Washington and Oregon, 2013 to 2024, with 30 percent of plots held out. All predictions were hash-locked before analysis, and an addendum on slenderness before its scores were read.

## Controls and planted checks

The degree-preserving shuffles are the main control for the network: a plot whose hubs sit inside the shuffled range has no hub structure beyond its link counts. Sampling effort was controlled by the number of root tips sampled per tree. For the logs, the known answer was the principal investigator's own published rate order, compared only after our fits were frozen. Forecasts for years 40 and 50 were frozen in a hashed file for later scoring.

## Result

Bigger trees carried more genets (Spearman rho 0.45, bootstrap 95% interval 0.06 to 0.75, 26 trees with measured diameter). Samples per tree tracked genets per tree at rho 0.87 across all 166 trees, and after controlling for samples the size link fell to a partial rho of 0.20 (p 0.067). Hub concentration and nestedness sat inside the shuffled range in 6 of 6 plots. Degree distributions fit an exponential-type tail better than a power law, by 40 AIC units for genets per tree, so "scale-free" is not supported. Predicted modularity appeared in 1 of 6 plots, and predicted dry against moist differences failed.

Cedar heartwood decayed slowest: 0.0026 per year (0.0016 to 0.0038), against Douglas-fir 0.0067, western hemlock 0.020 and Pacific silver fir 0.036, with every difference from cedar excluding zero. Cedar sapwood was not slow; it ranked third of four. At year 30, decay models beat carrying forward for heartwood in 3 of 4 species, with skill 0.53 to 0.93.

Only 0.10 percent of trees carried recorded wind damage (506). A logistic model ranked risk with a held-out AUC of 0.77, but its Brier skill over the base rate was 0.0014. The predictions that bigger, more slender and recently cut trees suffer more damage all failed, and slenderness added no skill.

## Limits

The network sample is small: 26 trees had a measured diameter, in one forest type, sampled once. Degree-preserving nulls keep much of hub share by construction, and controlling for samples may over-correct, since a bigger root system may be a real size effect. A shared genet shows one fungus at two root systems; it shows no transfer of carbon, water or signals. The cedar rates repeat the principal investigator's order. Density loss leaves out fragmentation. A 2023 wildfire burned three of the six log sites. Wind damage is recorded on live trees, and 29 percent of damaged trees had a broken or missing top, which distorts the slenderness measure itself.

## Verified

Verified: the plot, tree and genet counts, the size correlations and partial rho with its p value, the 6 of 6 null results, the AIC gap, the four heartwood decay rates with their intervals, the year-30 skill range, the 530 logs, the wind damage count and rate, the AUC and the Brier skill were re-read on 2026-11-09 from the study's results file and match the ledger. The preregistration file's current sha256 matches the addendum hash. The machine-written result tables behind the results file were not opened. Not re-run.

## Reproduce

Download the Beiler 2015 network from Dryad, build one tree-by-genet network per plot, and compare top-10 percent link share and NODF nestedness with 1,000 curveball shuffles; correlate diameter with genets per tree, then partial out root tips sampled. Download TD014, express heartwood density relative to time zero, and fit single-exponential decay per species with a bootstrap over logs. From the FIA DataMart, model wind damage code 50013 on live trees with logistic regression on held-out plots.

## Sources

- Beiler, Simard and Durall (2015), Journal of Ecology 103: 616-628; data Dryad doi 10.5061/dryad.7ts20.
- Beiler et al. (2010), New Phytologist 185: 543-553.
- Karst, Jones and Hoeksema (2023), Nature Ecology and Evolution 7: 501-511.
- HJ Andrews TD014, PI Mark E. Harmon. Data were provided by the HJ Andrews Experimental Forest research program, funded by the National Science Foundation's Long-Term Ecological Research Program (DEB 1440409), US Forest Service Pacific Northwest Research Station, and Oregon State University.
- USDA Forest Service, Forest Inventory and Analysis DataMart.
