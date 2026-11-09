---
id: F183
slug: shifted-optima-plain-beats-bio-optimisers
title: After we fixed our own bug, plain optimisers beat nature-inspired ones on shifted tests
tier: D
fields: [cs-systems, method]
date_found: 2026-10-31
standfirst: Our first benchmark said optimisers named after slime moulds, wolves, bees and ants beat the standard methods. The win came partly from a bug in our own CMA-ES code. Fixed, CMA-ES ranked first, and two popular nature-inspired methods turned out to work well only when the answer sits at the centre of the search box.
status: keep
figure: none
data: No external data. Seven standard test functions in 10 dimensions, evaluated by our own code.
---
## What it means

Optimisation research has seen a flood of methods named after animals and plants, and critics have argued that many are old ideas with new names that look good mainly on biased tests. Our own first run seemed to favour the nature-inspired group, and that result came largely from a bug in how we ran a standard method. Once it was fixed, the standard method came first. Two of the nature-inspired methods lost twelve or more orders of magnitude in accuracy when the best answer was moved away from the centre of the search space. A benchmark whose optimum sits at the origin can reward a method for guessing the origin.

## The question

On standard test functions, do optimisers with biological labels search better than plain methods? And how much of any advantage survives when the optimum is shifted away from the centre?

## How we tested it

We compared ten methods on seven test functions (sphere, ellipsoid, Rosenbrock, Rastrigin, Ackley, Griewank and Schaffer) in 10 dimensions, with 20,000 function evaluations per run and 15 repeats. The plain group was random search, L-BFGS, differential evolution and CMA-ES. The biologically labelled group was slime mould (SMA), grey wolf (GWO), particle swarm (PSO), artificial bee colony (ABC), ant colony for continuous domains (ACOR) and invasive weed (IWO). Each function was run with its optimum at the origin and shifted away from it. Methods were ranked per function and the ranks averaged. All methods used default parameters, with no tuning.

The first run (O4) put the bio group ahead, mean rank 5.04 against 6.20. Tracing CMA-ES's poor score, we found its search centre had drifted far outside the box, every sample was clipped to one corner, its step size collapsed, and it never restarted. Several other methods also stored candidates outside the box. We kept that run as it was, fixed the box handling for every method, added a restart to CMA-ES, and preregistered a rerun (O4b) with new forecasts before running it.

## Controls and planted checks

CMA-ES had to solve the sphere and rotated ellipsoid to near zero, or the rerun would stop. It reached about 1.6e-15 on the sphere. A planted cheat, a method that simply returns the centre of the box, scored 7e-7 on the unshifted sphere and about 10 to the 4.3 on the shifted one, showing the shifted test catches centre bias. Method labels were permuted within each function to give a null for the group difference.

## Result

On shifted functions, mean ranks were: CMA-ES 2.00, ACOR 3.14, IWO 4.43, L-BFGS 4.57, PSO 4.57, differential evolution 5.36, ABC 5.86, SMA 6.36, GWO 8.86 and random search 9.86. Without random search the plain group averaged 3.98 against 5.54 for the bio group, a gap of 1.56. Counting random search as plain, the two groups tied at 5.45 and 5.54.

On unshifted functions, SMA ranked first (2.07) and GWO second (2.43). Moving the optimum off the origin cost SMA 12.1 and GWO 13.6 orders of magnitude in median error. ACOR, IWO and PSO lost almost nothing (0.0006, 0.07 and 0.42 orders), so the charge that bio-labelled methods win through centre bias holds for some and not others.

A no-free-lunch check found no significant difference in the best of the first 500 distinct points across methods (p 0.74), and none on raw values (p 0.13). The first run's failure of that check came from converged methods revisiting the same points.

Our forecast that plain would beat bio was right after the fix, with a gap of 1.56 against a forecast of 1.2. We forecast PSO or ACOR as the best bio method and ACOR came first. We forecast IWO would rank below differential evolution, and it ranked above.

## Limits

These results hold for seven functions, 10 dimensions, one budget and default parameters. Other functions, dimensions or budgets could reorder the methods. Tuned parameters could change the ranking. The work was scored by code and checked by the same analyst who wrote it. PSO's biological label is thin: it is a velocity rule with a metaphor and predates the recent flood of such methods.

## Verified

Verified: all ten mean ranks on shifted and the SMA and GWO ranks on unshifted functions, the group means with and without random search, the gap of 1.56, the shift penalties for all methods, the CMA-ES and cheat-control values, and both no-free-lunch p values were re-read from the rerun's result file on 2026-11-09 and match the ledger. The first run's group ranks were re-read from its result files. Function count, dimension, budget and repeats were read from the build file. The rerun preregistration's sha256 matches its recorded hash. Not re-run.

## Reproduce

Implement the ten methods with default parameters and keep every candidate inside the search box. Give CMA-ES a penalty outside the box and a restart when its step size collapses. Run each on the seven functions in 10 dimensions with 20,000 evaluations and 15 repeats, once with the optimum at the origin and once shifted. Rank methods per function by median final error, average the ranks, and compare each method's shifted and unshifted error.

## Sources

No external sources are named in the study files beyond the standard test functions.
