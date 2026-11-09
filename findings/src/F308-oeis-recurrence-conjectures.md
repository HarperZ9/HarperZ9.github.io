---
id: F308
slug: oeis-recurrence-conjectures
title: Checking 213 OEIS recurrence conjectures against their b-files finds one failure, already known
tier: D
fields: [mathematics-complexity, method]
date_found: 2026-10-31
standfirst: We tested a random sample of conjectured recurrences in the On-Line Encyclopedia of Integer Sequences against the long term lists stored beside them. One of 213 failed, and the entry itself had recorded that failure in 2016, so the sweep produced no new counterexample.
status: keep
figure: none
data: OEIS data from the public oeis/oeisdata repository and OEIS b-files, retrieved 2026-10-31, licence CC BY-SA 4.0 (OEIS End-User License Agreement), https://oeis.org
---
## What it means

Many OEIS entries carry a line such as "Conjecture: a(n) = 3*a(n-1) - 3*a(n-2) + a(n-3)". These lines were usually found by fitting the listed terms, and the b-file beside the entry often holds hundreds or thousands more. A mechanical check is cheap, and on this sample it turned up nothing new. That is useful to know before spending effort on a larger sweep. It also says how to read such a line when it shows up in other work: it has usually held far past the data it was fitted on, which makes it a well-tested guess with no proof behind it.

## The question

What fraction of OEIS recurrence conjectures fail on their own b-files, and are the failures data errors or real counterexamples? The decision it informed was whether these lines are worth a routine mechanical check as a source of counterexamples.

## How we tested it

From the full OEIS data, 23,883 entries mention a conjecture, and 1,179 have a conjecture line our parser accepts: an equation in n and earlier terms a(n-k) with integer coefficients, restricted by a pattern match and a whitelist of allowed expression parts. We drew a seeded random 500 of those entries, which held 531 conjecture lines, 512 of them parsed. A line counts as tested when the b-file reaches at least 30 indices past the entry's listed data. That left 213 tested lines, with a median of 967 terms beyond the data. A line fails when its equation is false at any index in the b-file's range.

The locked plan sampled through the OEIS search pages. That route asks for a sign-in past the first 100 results, which we did not work around, so the first run tested only 2 lines and was void by our own minimum. Having seen only those 2 lines, both passing, we switched to the public data repository and took every entry with a parsable conjecture line. That change is recorded as a deviation; the new frame is wider than the locked one.

## Controls and planted checks

- Planted errors: each tested equation had its first integer coefficient raised by one and was run again. All 212 planted versions were caught.
- Cross check: each equation applied to another sampled entry's terms, 30 terms at a time, 200 draws. This gives the chance pass rate for an unrelated sequence: mean 0.005, 95th percentile 0.033. The real pass rate of 0.995 sits far above it (p 0.005).

## Result

- One failure in 213 tested lines: 0.47 percent, Wilson 95 percent interval 0.08 to 2.6 percent.
- The failure is A031740. Its 2012 conjecture, a(n) = n(961n + 1) with a matching third-order recurrence, holds for 64 terms and fails at n = 65. The entry already carries a 2016 comment stating that the conjecture is false and giving a counterexample term.
- No new counterexample.

Forecasts were 150 lines tested (got 213), a fail rate of 4 percent (got 0.5), a cross-check pass rate of 0.001 (got a 95th percentile of 0.033), and an even chance of at least one failure that a data error could not explain (none).

## Limits

The lines were fitted to data, so passing is what a correct fit does, and a high-order fit can pass by construction when the b-file is short relative to its order. A passing line stays a conjecture with more range. Only about 5 percent of conjecture entries parse under our rules, so the rate describes simple linear recurrences. Many lines come from a few contributors, so the rate also describes their habits. The sampling frame changed after the locked route failed, which a later review of our ledger marked as narrowing the claim. Scoring was by our own code, not blind.

## Verified

Verified: the frame counts 23,883, 1,179 and 500, the 531 lines, 512 parsed and 213 tested, the median 967 terms, the single failure at n = 65 after 64 terms, the Wilson interval, the 212 of 212 planted catches and the cross-check percentiles were re-read from the run's result file and the frame count file on 2026-11-09 and match the ledger. The 2016 comment marking A031740's conjecture false was read in the stored copy of that entry. The preregistration hash matches the hash recorded in the result. Not re-run.

## Reproduce

Download the OEIS data repository and the b-files. Find every entry with a comment or formula line that states a conjecture as an equation in a(n) and earlier terms with integer coefficients. Draw a random sample. For each line, evaluate the equation at every index from the end of the listed data to the end of the b-file, and record the first failure. Keep lines with at least 30 further terms. Perturb each equation slightly to confirm the check catches errors, and apply each equation to an unrelated sequence to set the chance level.

## Sources

- The On-Line Encyclopedia of Integer Sequences, entry A031740 and its 2016 comment.
- OEIS data repository (oeis/oeisdata) and b-files, CC BY-SA 4.0.
