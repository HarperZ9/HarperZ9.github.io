---
id: F50
slug: childhood-trauma-amygdala-vmpfc-null
title: Childhood trauma scores showed no meaningful link to amygdala-prefrontal coupling in 187 adults
tier: D
fields: [biology-neuro, psychology, medicine]
date_found: 2026-10-29
standfirst: In a preregistered test on open brain-scan data, adults' childhood trauma questionnaire scores were unrelated to resting connectivity between the amygdala and the ventromedial prefrontal cortex (partial r -0.006). The result rules out effects of 0.20 or larger and leaves smaller ones between 0.10 and 0.20 open.
status: keep
figure: none
data: OpenNeuro ds005237, Transdiagnostic Connectome Project, snapshot 1.1.3, CC0, doi:10.18112/openneuro.ds005237.v1.1.3
---
## What it means

A widely discussed idea holds that childhood maltreatment weakens the link between the amygdala, which responds to threat, and the ventromedial prefrontal cortex, which helps regulate that response. Small studies have reported such links. In 187 adults from a public dataset, with the analysis fixed before we looked at any data, we found no association of meaningful size. This adds an independent, preregistered null beside a much larger earlier null (Goltermann and colleagues, 2022, 1,325 people). A reader should treat a strong resting-state version of the idea with caution. A weak effect remains possible, and other measures of brain function were not tested.

## The question

Does the total score on the Childhood Trauma Questionnaire (CTQ) predict resting-state functional connectivity between both amygdalae and the ventromedial prefrontal cortex, after adjusting for age, sex, scan site, head motion and the number of usable volumes? The smallest effect of interest was set in advance at |r| = 0.20, about 4 percent shared variance.

## How we tested it

The preregistration was frozen before any questionnaire value or image was viewed. The data are the Transdiagnostic Connectome Project on OpenNeuro: adults with and without psychiatric diagnoses, four resting-state runs each. All 241 participants were preprocessed with fMRIPrep 25.2.6 with no processing errors. Regions came from the Harvard-Oxford atlas: left and right amygdala, and "Frontal Medial Cortex" for the prefrontal target. A pre-declared secondary test used the subcallosal cortex. Denoising used 24 motion parameters, aCompCor and cosine drift terms, with high-motion volumes censored. Participants needed at least two usable runs.

The decision rule had three outcomes. An association if the 95% interval excludes 0. No meaningful association if the 90% interval lies wholly inside -0.20 to 0.20, which is a two one-sided tests equivalence check. Inconclusive otherwise.

Six deviations from the plan are logged. One was written before any outcome was opened: the dataset codes missing CTQ answers as 88, which the registered code did not list, so 88 became a missing code.

## Controls and planted checks

CTQ scores were shuffled 10,000 times across participants. The observed primary correlation fell at the 47th percentile of that null (permutation p 0.93), and the secondary at the 37th (p 0.73). There is no positive control: no known effect was planted to show the pipeline can find one.

## Result

Of 241 participants, 17 were excluded for motion, 16 had no CTQ record and 21 were missing a subscale, leaving 187.

- Primary, amygdala to ventromedial prefrontal cortex: partial r -0.006, 95% interval -0.152 to 0.140, 90% interval -0.129 to 0.117, Holm-adjusted p 1.0. Decision: no meaningful association.
- Secondary, amygdala to subcallosal cortex: r -0.025, 95% interval -0.171 to 0.121. No meaningful association.

Power at n 187 to detect |r| = 0.20 was 0.77 (0.68 at the Holm alpha); 80 percent power would need r 0.207. Fifteen exploratory sensitivity analyses (motion rules, global signal regression, single hemispheres, each trauma subscale, minimisation, aCompCor variants, diagnostic group, and excluding anyone with an 88 code) moved the primary r between -0.081 and 0.081. None reached an association. Two subscale analyses, emotional neglect and physical abuse, came out inconclusive because their 90% intervals touched 0.20.

## Limits

This is one resting-state measure with anatomical masks in one transdiagnostic adult sample. The CTQ is retrospective self-report. The primary motion rule uses a low-pass filter on framewise displacement outside the single-band data it was validated on. Without a positive control we cannot show the pipeline would find a known effect. A true |r| between 0.10 and 0.20 could give this result. Birn and colleagues (2014) reported a positive link in 27 veterans, a different population and design from this one.

## Verified

Verified: on 2026-11-09 the flow counts (241, 17, 16, 21, 187), the primary and secondary r values with their 95% and 90% intervals, the Holm p, the permutation percentiles and p values, the power values and the range of the 15 exploratory analyses were re-read from the study's registered and extras result files and match the ledger. The frozen preregistration body hash recorded in the result files matches the ledger; the current preregistration file has a different hash because the deviation log was appended, and the frozen body was not recomputed here. Not re-run.

## Reproduce

Download ds005237 from OpenNeuro. Run fMRIPrep, denoise with 24 motion parameters, aCompCor and cosine terms, and censor volumes with framewise displacement above 0.5 mm. Extract mean time series from Harvard-Oxford amygdala and frontal medial cortex masks at the 50 percent threshold, correlate, Fisher-transform and average over usable runs. Sum the five CTQ subscales, treating 88 as missing. Compute the partial correlation with age, sex, site, mean displacement and retained volumes, then apply the equivalence rule at 0.20.

## Sources

- Transdiagnostic Connectome Project, OpenNeuro ds005237, doi:10.18112/openneuro.ds005237.v1.1.3.
- Goltermann et al., 2022, childhood maltreatment and resting connectivity, null at n 1,325.
- Birn et al., 2014, childhood maltreatment and amygdala connectivity in 27 veterans.
