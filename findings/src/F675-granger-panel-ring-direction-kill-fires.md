---
id: F675
slug: granger-panel-ring-direction-kill-fires
title: A panel test read climate driving tree rings correctly, and our own rule still failed it
tier: D
fields: [ecology-climate, method]
date_found: 2026-11-02
standfirst: On 161 northern tree-ring sites a panel-wide lagged test pointed from summer temperature to ring width, the known direction, with a wide margin. Two of its locked checks missed their bars by less than 0.02, so by the rule we wrote first the method earned no standing in this round.
status: keep
figure: none
data: International Tree-Ring Data Bank standard ring-width chronologies at or above 55 N outside Europe (NOAA NCEI; public). CRU TS 4.10 June to August temperature (Climatic Research Unit, University of East Anglia; ODbL 1.0).
---
## What it means

This is the second round of a test of tools that claim to read causal direction from time series. Tree rings and summer temperature make a fair test, because warmth shapes the ring and the ring has no meaningful effect on the weather. In the first round, a site-by-site transfer entropy estimator could not tell the two directions apart (finding F132). Here a simpler lagged regression, read across the whole panel of sites at once, pointed the right way with a large margin and flipped when time ran backwards. We still record it as a failure, because two checks we had locked as binding missed by small amounts. Holding to a rule written before the data keeps a near miss from being promoted after the fact.

## The question

Read as a panel instead of site by site, can lagged Granger tests exclude the reverse route (ring to climate) and read the forward route (climate to ring) on sites the first round never touched?

## How we tested it

We used 161 ring-width chronologies at or above 55 degrees north outside Europe: 100 in Canada, 45 in Alaska and 16 in Asia, in 77 two-degree blocks, with a median length of 89 years. Each was paired with June to August temperature from its nearest CRU TS 4.10 cell. At each site we ran Granger F tests with lags of one and two years in both directions and took the difference of their z-scores, d. A positive panel mean d points from climate to ring. Three versions of the data were tested: high-passed with a 10-year Gaussian, first-differenced, and raw. The plan, the checks and a kill rule (any binding check failing means no status) were hash-locked before the run.

## Controls and planted checks

Synthetic worlds were built from each site's own surrogate copies, five draws each: no coupling, a planted forward effect and a planted reverse effect at real and at strong strength, a common driver, and a shared trend. The real result was compared with 199 pairings of each tree with climate from a cell 1,000 km or more away.

## Result

On the high-pass series the panel index was plus 1.206 (block bootstrap 95% interval plus 0.871 to plus 1.591), against a far-pairing 95th percentile of plus 0.213 (p 0.005, the floor at 199 pairings). First differences gave plus 1.107 against plus 0.186, and raw series plus 1.242. Climate predicted next year's ring at 39.8 percent of sites; rings predicted next year's summer at 6.8 percent, inside the no-coupling world's 7.8 percent. Reversing time flipped the index to minus 0.894. A shared trend pushed it negative (minus 0.317) and a common driver gave minus 0.090 with an interval across zero, so neither could produce the positive real value.

All high-pass checks passed. Two first-difference checks failed. The planted reverse world was called correctly at 58.4 percent of sites against a bar of 60 percent, and the shared-trend world's reverse detection rate was 11.7 percent against a limit of 10 percent. The kill rule fired. Our own forecast had been a forward rate of 9 percent and a mean d of minus 0.05; both were far off.

## Limits

The planted forward effect used a positive prior-summer term. A look after the run, which is exploratory, found the real prior-summer coefficient negative at most sites (median minus 0.127, positive at 21.7 percent): a warm summer raises that year's ring and lowers the next. The planted world therefore did not match the real lag structure, an error carried over from the first round. Both failed checks are ours: we made the first-difference arm binding when pilot runs had already shown it weaker. CRU temperature at these latitudes rests on few stations before about 1950 (a recalled fact, held with high confidence). Sites cluster in Alaska and Canada. Lag tests cannot see a same-year reverse effect.

A third round, run the same day on 145 further held-out sites with the planted term fitted to the measured lag sign and only the high-pass arm binding, passed every binding check but one. Its kill rule did not fire, and the panel method gained a limited direction status at that coupling strength. That later result does not change this round's verdict.

## Verified

Verified: the site, block and length counts, the panel index on all three arms with the high-pass interval, both far-pairing percentiles, the forward and reverse detection rates, the no-coupling rate, the time-reversed index, the trend and common-driver values, and both failed check values were re-read on 2026-11-09 from the run's result file and its results report, and match the ledger. The result file's sha256 matches the hash in the ledger. The preregistration file's sha256 matches its locked prefix. Not re-run.

## Reproduce

Select ITRDB ring-width chronologies at or above 55 N outside Europe and pair each with the June to August temperature of its nearest CRU TS 4.10 cell. High-pass both series. At each site run Granger F tests with lags 1 and 2 in both directions, convert the p values to z-scores, and take climate-to-ring minus ring-to-climate. Average across sites with a block bootstrap by two-degree cell, and compare with the same statistic on far-away pairings and on surrogate worlds with planted effects of known sign and size.

## Sources

- International Tree-Ring Data Bank, NOAA National Centers for Environmental Information.
- CRU TS 4.10, Climatic Research Unit, University of East Anglia.
