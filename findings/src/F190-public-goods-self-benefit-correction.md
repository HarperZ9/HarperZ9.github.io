---
id: F190
slug: public-goods-self-benefit-correction
title: Our model of cooperation on a grid had been rewarding selfishness
tier: D
fields: [biology-other, economy]
date_found: 2026-10-31
standfirst: We set out to reproduce a textbook result, that living near relatives lets costly cooperation survive cheaters, and our model appeared to succeed. It had a flaw: cooperators were paid back by their own contribution. With that removed, cooperation collapsed at every sensible cost under our update rule.
status: keep
figure: none
data: No external data. A simulation with invented parameters, run as a check on a known mechanism.
---
## What it means

A simulation can match a known answer for the wrong reason. Ours produced a clean threshold for when cooperation survives, close to a number from the theory literature, and we credited the theory. The match came from a coding choice that let each cooperator keep part of its own contribution, which turns cooperation into private investment. We found it by reading a control that should have failed and did not. Anyone building individual-based models of microbes, markets or teams should test whether "cooperators" are paid by their own act.

## The question

Microbes often make costly products, such as enzymes, that help their neighbours. Cheaters that skip the cost should win in a well-mixed population. A standard result in social evolution says that when relatives stay near each other, producers can persist anyway. Before using that idea anywhere in our own writing, we tried to reproduce it on a simple grid model.

## How we tested it

The model is a 100 by 100 grid with wrap-around edges. Each cell holds a producer or a cheater. Producers pay a cost c, and each producer's goods give a benefit b shared across a small box of cells around it. Each generation, every cell's next occupant is drawn from its 3 by 3 neighbourhood in proportion to fitness. A mixed arm draws parents from the whole population, and a shuffled arm scrambles positions every generation, which should erase any benefit of space. Three rounds ran, each with its own preregistration written after reading the round before.

## Controls and planted checks

The shuffled arm is the key control. If space is what protects producers, scrambling positions must make them collapse. In the first round the mixed arm collapsed as expected. In the second, an exact mean-field recursion served as a known answer, matched with a maximum error of 0.002.

## Result

Round one: at b equal to 2 and c equal to 0.3 (a benefit-to-cost ratio of 6.7), local producers collapsed, against our forecast that they would persist.

Round two: local producers first persisted in the majority of runs at a ratio of 9, at b equal to 1, 2 and 4 alike. We had forecast a threshold between 7 and 12 from a rule that says cooperation wins when b over c exceeds the number of neighbours, which is 8 here, and counted it a pass. The shuffled control did not collapse: producers averaged 0.37 of the population (95th percentile 0.52) when they should have vanished.

That control exposed the flaw. In the code, a producer shared in its own goods. With a 3 by 3 box it recovers b/9 of its own output, so producing pays whenever b over c exceeds 9, with or without relatives nearby. The threshold was the box size.

Round three removed self-benefit: goods went only to other cells. At b equal to 2, run side by side for ratios from 2 to 400, the self-including version reproduced the artefact (threshold 9, and the shuffled arm persisting from a ratio of 30 up). The others-only version never reached a majority. Local producers ended at 0.03 of the population at a ratio of 100, 0.19 at 200 and 0.48 at 400. Mixed producers ended at 0.04 or less at every ratio, and the shuffled arm at zero. Producers whose goods reached two cells away, instead of one, fell to 0.18 at a ratio of 400.

## Limits

This is one update rule with invented numbers, and it says nothing about any real microbe. The outcome fits a known result: when relatives compete locally for the same space, the competition can cancel the benefit of living near kin (Griffin 2004). The claim that space protects cooperators therefore stays a citation of published work and is not a result of ours. Other update rules, asynchronous timing or different neighbourhood sizes could let producers persist. The runs were scored by code and checked by the same analyst who wrote them, with no outside review.

## Verified

Verified: the round one collapse at a ratio of 6.7, the round two threshold of 9 at all three benefit values, the recursion error, the shuffled control mean and percentile, the round three curves for local, mixed and shuffled arms with and without self-benefit, and the two-cell range value were re-read from the three rounds' result files on 2026-11-09 and match the ledger. Grid size, generations and replicate count were read from the round three build file. The round three preregistration's sha256 matches its recorded hash. Not re-run.

## Reproduce

Build a 100 by 100 torus of producers and cheaters, start half and half, and run 1,000 synchronous generations, 5 replicates per setting. Give each producer cost c and spread benefit b over the 3 by 3 box around it, paid only to the other cells in the box. Draw each cell's next occupant from its 3 by 3 neighbourhood in proportion to fitness. Sweep b over c from 2 to 400 at b equal to 2, and compare with a whole-population draw and with positions shuffled every generation.

## Sources

- Griffin (2004), on local competition undoing the benefit of kin.
- Nadell (2016), on spatial structure and cooperation in microbes.
- Ohtsuki (2006), the b over c greater than k rule under weak selection.
- Taylor (1992), on local competition and relatedness.
