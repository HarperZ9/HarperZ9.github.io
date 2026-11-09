---
id: F320
slug: stress-classifier-leakage
title: A random split scores a stress classifier perfect on data with nothing to learn
tier: B
fields: [method, human-studies, psychology]
date_found: 2026-10-31
standfirst: On planted data where nothing carries from one person to the next, a random train-test split still gives a perfect score of 1.00, while holding out whole people gives chance. On the real WESAD recordings the classifier does hold across 15 people, at an AUC of 0.966, and how stressed people said they felt did not track how much their bodies changed.
status: keep
figure: none
data: WESAD (Wearable Stress and Affect Detection), Schmidt, Reiss, Duerichen, Marberger and Van Laerhoven, ICMI 2018; UCI record doi 10.24432/C57K5T; data from the authors' page, terms scientific non-commercial use with credit, https://ubi29.informatik.uni-siegen.de/usi/data_wesad.html
---
## What it means

Wearable stress detectors are often scored by cutting a recording into overlapping windows and splitting the windows at random into training and test sets. Neighbouring windows share most of their samples, so the model can recognise the window's neighbours and the condition block it came from. Our planted test shows how far that goes: with no signal that generalises at all, the random split still scores 1.00. Any reported score from a random split over overlapping windows tells you nothing until it is repeated with whole people held out.

## The question

Does a stress classifier trained on WESAD hold for a person it has never seen? How much does the random split inflate the score? Which sensors carry the signal? And does the size of a person's bodily response follow the size of the stress they report?

## How we tested it

WESAD records 15 people with a chest sensor during a baseline, amusing clips and the Trier Social Stress Test (a public talk and mental arithmetic in front of a panel). We used the chest signals only: ECG, electrodermal activity (EDA), skin temperature, respiration, acceleration and EMG. Each recording was cut into 60 s windows every 15 s, so neighbours overlap by 75 percent, giving 2,122 windows, 30 percent of them stress. Twenty features in six groups were fixed before any label was compared. We scored a random forest and a logistic regression under four splits: random over windows, time blocks within a person with a gap, leave one subject out, and leave one subject out with each person's features scaled to their own baseline.

## Controls and planted checks

- Planted zero: the same windows and timing, with each person and condition block given a random offset per feature and no shared direction. A random split had to read high and a held-out-person split near 0.5.
- Planted real: a shared shift added on top, which a held-out-person split had to find. In the first run we set the bar at 0.90 for a shift of 2, and a later calculation showed the ceiling for that shift was about 0.91, so the run failed its own check (0.82). A second preregistered run tested shifts of 2, 3 and 4; at 4 the forest reached 0.994, and the first run's real-data results were credited.
- Shuffled labels: stress reassigned to a random condition block within each person, keeping the block structure. Logistic held-out-person AUC 0.896 against a shuffled 95th percentile of 0.656 (p 0.0099).
- Sensor groups corrected with Benjamini-Hochberg at q 0.05.

## Result

| Split | Forest AUC | Logistic AUC |
|---|---|---|
| Random over windows | 1.000 | 0.982 |
| Held-out person | 0.966 | 0.896 |
| Held-out person, own baseline | 0.964 | 0.971 |
| Planted zero, random | 1.00 | |
| Planted zero, held-out person | 0.47 (first run), 0.39 (second run) | |

- The random split inflated the forest score by 0.033 and the logistic score by 0.086.
- Mean within-person AUC under held-out-person forest: 0.979, interval 0.961 to 0.994 across people. The worst person reads 0.91 under the forest and 0.65 under logistic.
- By sensor (forest, held-out person): ECG 0.92, EDA 0.89, respiration 0.85, acceleration 0.82, temperature 0.60, EMG 0.45. EMG did not pass correction; the other five did.
- Physiology without motion or breath (ECG, EDA, temperature): 0.97. Motion alone: 0.79. We forecast that motion would lead, and it did not.
- Reported anxiety (six-item STAI) rose by 7.7 points on average from baseline to stress. Across the 15 people, the size of that rise did not follow the size of the bodily change: Spearman 0.03 with EDA, 0.02 with heart rate, -0.45 with breathing rate (p 0.09).

## Limits

Fifteen people, one lab, one hour, one protocol. The stress session tends to follow baseline in time, so order is confounded with condition, and a cardiac signal also carries posture and speech. With n 15 the interval on any of the felt-stress correlations is about plus or minus 0.5, so "does not follow" means "no detectable relation at this size". None of this reaches daily stress or trauma, and the classifier says nothing about what the hour meant to anyone. Our scoring was by our own code, not blind, and the second run's forecasts for the real data were written after the first run had shown them.

## Verified

Verified: the 2,122 windows and 15 people, every AUC in the table, the gaps 0.033 and 0.086, the within-person mean and interval, the per-sensor AUCs and corrected q values, the planted-zero and planted-real values in both runs, the shuffled control and the felt-stress correlations were re-read from both runs' result files on 2026-11-09 and match the ledger. The result files' leading hashes 65165c7a7ae8e10e and 142aab473f4fbe40 match the ledger. Not re-run.

## Reproduce

Request WESAD from its authors under their terms and use the chest recordings and questionnaires. Cut each condition into 60 s windows with a 15 s step. Compute fixed features per sensor. Train a random forest and a logistic regression and score AUC under a random split over windows and under leave-one-subject-out. Build a planted dataset with per-person, per-block random offsets and confirm the random split scores high while held-out people score near 0.5. Compare each person's change in STAI with their change in EDA, heart rate and breathing rate by Spearman correlation.

## Sources

- Schmidt, Reiss, Duerichen, Marberger and Van Laerhoven, 2018, WESAD, ICMI, doi 10.1145/3242969.3242985.
- Campbell and Ehlert, 2012, Acute psychosocial stress: does the emotional stress response correspond with physiological responses?, doi 10.1016/j.psyneuen.2011.12.010.
