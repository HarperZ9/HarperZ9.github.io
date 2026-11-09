---
id: F14
slug: newtons-obliquity-table
title: Newton's grazing-angle ring table follows his fitted rule, which runs 27% low at 85°
tier: B
fields: [history-philosophy-science, physics-optics]
date_found: 2026-10-28
standfirst: Up to 60 degrees, Newton's table of ring thickness against viewing angle matches modern thin-film physics within half a percent. From 65 degrees to 90 degrees every row matches a rule he fitted himself, and at 85 degrees that rule sits 27 percent below what the physics gives.
status: keep
figure: traxler-slot
data: Isaac Newton, Opticks, 4th edition 1730, public-domain text (Project Gutenberg ebook 33504; also at the Newton Project, https://newtonproject.ox.ac.uk/view/texts/xml/NATP00038). CIE D65 illuminant and CIE 1931 2 degree observer tables (official CIE tables).
---
## What it means

Newton's table of coloured rings at oblique light is usually read as a set of measurements. When we put every row beside exact optics, the rows split cleanly in two: the shallow rows track the physics, and the steep rows track an arithmetic rule Newton states on the same page. For any old data table, a row that agrees with the author's own formula to under 1 percent, where the instrument could not have reached that precision, is more likely computed than observed.

## The question

In Book II of the Opticks, Observation 7, Newton gives the air-gap thickness at a ring for thirteen viewing angles, scaled to 10 at perpendicular light, obtained "partly by measuring" and partly by other means. He then states a rule: the thickness goes as the secant of an angle whose sine is the first of 106 arithmetical means between the sines of incidence and refraction. Modern optics says the thickness should follow the plain secant of the air angle. We asked which of the two his rows follow, and where.

## How we tested it

We built an exact model of a glass, air gap, glass stack, with Airy multiple-beam reflectance for both polarisations, N-BK7 glass, and white light from the CIE D65 daylight spectrum weighted by the CIE 1931 eye response. Before the model ran we wrote down five predictions with bounds: the first dark ring within 5 percent of Newton's 1/89000 inch (285.4 nm); bright rings at 1 : 3 : 5 : 7 within 3 percent; the physics on the secant within 0.1 percent to 85 degrees; his table on the secant within 1 percent to 60 degrees; and his table on his own rule within 1.5 percent at every row. We had checked his 90 degree row by hand first, which is why the last prediction exists, and the prediction file says so.

## Controls and planted checks

Two controls had to fail, and both did. With the sign flip at the interfaces removed, the centre turns bright and the first minimum moves to 137.7 nm, 52 percent away from Newton's value. With the thickness column shuffled across rows, his rule failed the 1.5 percent bound at 7 or more rows in every one of 200 shuffles (median 12). A first run stopped its dark-ring search too early; the search was fixed before grading and the model left unchanged.

## Result

All five predictions held. The first dark ring falls at 275.7 nm against Newton's 285.4 nm, a 3.4 percent gap. The bright rings stand at 1 : 3.005 : 5.031 : 7.070. The physics follows the secant within 0.0075 percent to 85 degrees. His table matches the secant within 0.41 percent from 0 to 60 degrees, and matches his own rule within 0.99 percent at every row, 0.33 percent at 90 degrees.

Selected rows (thickness, perpendicular = 10):

| Air angle | His table | His rule | Secant |
|---|---|---|---|
| 60° | 20 | 19.80 | 20.00 |
| 70° | 28.25 | 28.53 | 29.24 |
| 80° | 52.25 | 52.29 | 57.59 |
| 85° | 84.08 | 84.02 | 114.74 |
| 90° | 122.5 | 122.90 | infinite |

From 65 degrees on, every row sits close to the rule. At 85 degrees the rule is 26.7 percent below the secant.

## Limits

That the steep rows were computed from the rule is our reading; the text cannot settle which rows he measured, and a historian should check it against his manuscripts. Our search for earlier analyses was short, and Shapiro's 1993 study and the Optical Papers, unread, may already cover it. The table was coded by hand from the text. The 3.4 percent gap on the first dark ring depends on the light source and on how an eye judges "the darkest part" of a coloured fringe; no solar spectrum or perceptual model was run. Two related studies of ours, F15 on his thick-plate rings and F57 on his colour limits, also find his 1/89000 inch a few percent off.

## Verified

Verified: the first dark ring values 275.7 nm and 285.39 nm, the ring ratios 1 : 3.005 : 5.031 : 7.070, the per-row thickness, rule and secant values in the table above, the 0.41 percent and 0.99 percent maxima, the 26.7 percent secant gap at 85 degrees and both control outcomes were re-read from the study's result file on 2026-11-09 and match the ledger and the preregistration's result section. Not re-run.

## Reproduce

Type the thickness column of Book II, Part I, Observation 7 of the 1730 Opticks. Compare it with 10 over the cosine of the air angle, and with Newton's rule: take the first of 106 arithmetical means between the sines of incidence and refraction (from the larger), find the angle with that sine, and scale its secant to 10 at 0 degrees. For the rings, model a symmetric glass, air, glass gap with Airy reflectance in s and p, average them, integrate over D65 weighted by the CIE 1931 luminosity curve, and find the first minimum and the first four maxima of luminance against gap thickness.

## Sources

- Isaac Newton, Opticks, 4th edition, 1730, Book II, Part I, Observations 6 and 7 (Project Gutenberg 33504).
- The Newton Project transcription, https://newtonproject.ox.ac.uk/view/texts/xml/NATP00038.
- Shapiro, 1993, Fits, Passions and Paroxysms (not read).
- CIE D65 and CIE 1931 2 degree observer tables.
