---
id: F39
slug: long-tails-dark-spectra
title: Music with long ringing tails and dark spectra is rated calmer, and also sadder
tier: B*
fields: [music-acoustics, psychology]
date_found: 2026-10-29
standfirst: Across 502 held-out music clips by 270 artists, sounds that ring on longer and lean toward low frequencies were rated lower in arousal, beyond loudness, genre and year. We forecast they would also be rated more pleasant; they were rated less pleasant instead.
status: keep
figure: none
data: DEAM (Aljanaki, Yang and Soleymani 2017, PLoS ONE 12(3) e0173392), 1,744 clips of 45 s with crowd arousal and valence ratings, CC BY-NC; audio from a public mirror because the official host was unreachable, annotations checked identical across three independent copies
---
## What it means

Many people reach for music with long, ringing sustain and a warm, dark tone when they want to wind down. On a public set of rated music clips, those two acoustic properties did go with lower rated arousal, and the link held on artists the model had never seen and across all eleven genres. The same sounds were also rated less pleasant. That reversal matters: "calm" in these ratings sits closer to subdued or melancholy than to contented. It is a link between sound and how listeners judge a clip's mood. It does not measure how the music made anyone feel.

## The question

Do acoustic properties that carry decay and spectral darkness go with lower rated arousal, and possibly higher rated valence, beyond loudness and genre, on held-out tracks?

## How we tested it

DEAM gives arousal and valence ratings, averaged over crowd raters on nine-point scales, for 1,744 clips of 45 seconds. We measured each clip's onset-locked tail, the slower of note decay and room decay, and its spectral slope, which falls as energy shifts toward low frequencies. A calm index combines a longer tail with a darker slope. Loudness, genre and year were controlled. Artists were split so that 502 clips from 270 artists formed a held-out test set.

Before any rating was joined to any measure, the instruments were checked on synthetic music with planted values. The tail measure recovered its target with an error ratio of 0.12 (rank correlation 0.95) and the slope measure with 0.21 (0.99). A measure of reverb size alone failed in dense music (ratio 0.81), so room reverb could not be separated from note decay and enters no verdict. The hypotheses, including the direction for valence, were hashed before the run.

## Controls and planted checks

The calm index was shuffled across test clips 1,000 times; the 5th percentile of the partial correlation with arousal was -0.076. Tail and slope values were shuffled within the training and test sets as a null for the held-out gain in R2 (95th percentile 0.003). A constant estimator was included in the instrument check as a false-success control and failed, as it must.

## Result

On 502 held-out clips with loudness, genre and year controlled:

- Calm index against arousal: partial r -0.394 (95% interval -0.476 to -0.304).
- Tail alone: -0.301. Slope alone: +0.324 (a higher slope means a brighter spectrum).
- Held-out R2 gain from tail and slope: +0.110 (0.034 to 0.182).
- With tempo and spectral entropy also controlled: -0.343.
- Calm index against valence: -0.375 (-0.455 to -0.280). We had forecast a rise. With arousal also held: -0.227.

After the run, and outside the preregistered tests, the arousal link survived controlling for note rate (-0.370) and was negative in all 11 genres on the full sample, from -0.25 in hip-hop to -0.62 in international music.

## Limits

Tail length is partly a proxy for instrumentation and production style, since timbre was not held fixed; the sound may not cause the rating. DEAM ratings are crowd judgments of perceived emotion in short clips, not felt calm or relief. Room reverb could not be measured apart from note decay with these tools. The audio came from a mirror whose file count and hash match the published set, though its provenance is still a limit. Links between brightness, sustain and arousal are already known for isolated tones (Eerola 2012; Korsmit 2024), so the new part is the onset-locked tail in full mixed music. Earlier studies of reverberation time and emotion report mixed results (Wilkie and Harrison 2025). A separate questionnaire analysis on music absorption and personality was seen before its rules were locked, so it is not reported here. A later review of dose-response shapes across our findings (F49) read the arousal link as a fall that levels off, with no U shape; that check was not re-read here.

## Verified

Verified: on 2026-11-09 the partial correlations -0.394, -0.301, +0.324, -0.343 and -0.375 with their intervals, the R2 gain and interval, the shuffle quantiles, the 502-clip and 270-artist test counts and all nine verdicts were re-read from the study's result file; the -0.227, -0.370 and per-genre values from the post hoc file; and the instrument ratios 0.12, 0.21 and 0.81 from the instrument file. All match the ledger. The preregistration's SHA-256 matches. Not re-run.

## Reproduce

Obtain DEAM audio and static annotations. Convert each clip to mono at 22,050 Hz and take the first 45 seconds. Measure the onset-locked tail and the spectral slope, and check both measures on synthetic music with planted decay and tilt first. Hold out 30 percent of artists. Compute the partial correlation of a combined calm index with mean arousal and valence, controlling for loudness, genre and year, and compare held-out R2 with and without the two measures.

## Sources

- Aljanaki, Yang and Soleymani, 2017, DEAM, PLoS ONE 12(3) e0173392.
- Eerola, 2012, timbre and affect in isolated tones.
- Korsmit, 2024, re-analysis of timbre and affect.
- Wilkie and Harrison, 2025, reverberation and perceived emotion.
