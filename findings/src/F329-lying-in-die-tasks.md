---
id: F329
slug: lying-in-die-tasks
title: In 27,039 private die rolls, about 45 percent report honestly, and the reports cannot tell us why
tier: B
fields: [psychology, economy, human-studies]
date_found: 2026-10-31
standfirst: Payoff maximisation says everyone in a private die-roll task should claim the top number. Across 58 published studies with 27,039 subjects, the held-out reports look like about 45 percent honest, 26 percent claiming the maximum and 29 percent shading upward partway. Six competing theories of why people hold back fit those reports almost equally well.
status: keep
figure: none
data: Abeler, Nosenzo and Raymond (2019) truth-telling meta-study data, CC BY, from www.preferencesfortruthtelling.com/resources (figshare files 16211150 and 16211414)
---
## What it means

In these experiments a person rolls a die in private and is paid by the number they report, so lying pays and cannot be caught. Most people still do not claim the top number. That gap between strict self-interest and real behaviour is large and stable. The harder lesson is about inference. A model where lying has a fixed cost, one where people care about looking honest, one where they follow what others do, and even a plain payoff model with enough noise all reproduce the reports to within a hair. To learn which mechanism is at work you need experiments designed to pull them apart, and the distribution of reports alone is not enough.

## The question

Which account of people's preferences best predicts how they report private random outcomes, on studies the models have not seen? And what share of reports look honest, maximal or partial?

## How we tested it

We used the open meta-study data of Abeler, Nosenzo and Raymond (2019). Keeping first-round reports from uniform tasks with 2, 3, 6 or 10 outcomes, and removing treatments that changed the incentive structure or told people what others reported, left 252 treatments from 58 papers with 27,039 subjects. Papers were split by a hash of the citation: 30 percent held out, giving 9,960 test subjects from 19 papers.

Six models were fitted on the training papers: a payoff logit on money, a fixed lying cost, a cost that grows with the size of the lie, a reputation model with a fixed cost and a value on appearing honest, a norm model where the cost shrinks when others lie, and a full model combining reputation and size cost. Two baselines framed them: everyone honest, and the training papers' average report distribution for each task size. Each was scored by log loss per report on held-out papers. The share of honest reports was read as the number of outcomes times the share of the lowest report; maximal liars are the excess at the top; the rest are partial. The plan was hashed before any model was fitted, though the pooled report shapes had been printed first, so the share forecasts were not blind.

## Controls and planted checks

Report labels were shuffled within each held-out treatment as a null; the best model's gain over the honest baseline was 0.072 nats per report against a shuffled 95th percentile of -0.086. A planted check simulated data from the reputation model at known parameters. The reputation model had to beat the fixed-cost model on that simulated test data, and it lost by 0.0003 nats. That plant failed, so by the preregistered rule no ranking among the models counts.

## Result

Held-out loss in nats per report: reputation 1.2484, payoff logit with noise 1.2488, size cost 1.2491, full 1.2493, fixed cost 1.2515, norm 1.2519, training average 1.2519, everyone honest 1.3202. All theory models sit within 0.005 of each other, and no contrast against the fixed-cost model passes the false-discovery correction. Reputation over fixed cost is +0.003 (95% interval -0.001 to +0.008). The payoff model was forecast to do worse than the honest baseline; with its noise term it did better by 0.071.

On held-out tasks with three or more outcomes, reports split 45 percent honest, 26 percent maximal and 29 percent partial (forecast 42, 25 and 33). Stakes elasticity sat between 0.89 and 0.96, so the size of the payment hardly moved reports. Across the 23 country pools of Gächter and Schulz (2016), the mean standardised report ranged from 0.18 to 0.58.

## Limits

The failed plant means the method could not recover a known model, so the near-tie is uninformative about mechanism and says nothing about which theory is true. One paper, Effron and colleagues (2015, 2,151 subjects), carries the full model's small edge; without it the sign flips. The share split is read from distributions, not from observed lies, and assumes upward lies come only from preference. Our subset gives a mean standardised report of 0.287 against 0.234 on the publishers' full set; the preregistration asked for agreement within 0.03, so our filtered subset does not reproduce their headline figure. All tasks are lab die or coin tasks. Abeler and colleagues separate the models with designed treatments, which we did not refit.

## Verified

Verified: on 2026-11-09 the subject, paper and treatment counts, the eight held-out losses, the shuffle quantile, the planted result, the share split, the stakes elasticities, the Gächter and Schulz range and the Effron sensitivity were re-read from the study's result file and its results summary and match the ledger. The 0.287 against 0.234 reproduction gap was read from the same files and is not in the ledger entry. The data source and licence were read from the download record. Not re-run.

## Reproduce

Download the merged meta-study file from the authors' resources page. Keep first-round reports from uniform 2, 3, 6 and 10 outcome tasks, drop the treatments listed above, and split papers 70 to 30 by citation hash. Fit each model by maximum likelihood and score held-out log loss. Read the three shares from each test task's report distribution.

## Sources

- Abeler, Nosenzo and Raymond, 2019, Preferences for Truth-telling, Econometrica 87(4), 1115 to 1153.
- Gächter and Schulz, 2016, intrinsic honesty across 23 countries.
- Effron et al., 2015, one of the pooled coin-task studies.
