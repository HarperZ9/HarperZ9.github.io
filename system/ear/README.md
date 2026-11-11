# The ear

Measurement that stands in for listening.

The ear is a set of pure functions over PCM samples. It runs in Node and in a browser, with no dependency outside this
repository. Give it rendered audio and it reports numbers; give it the score and the separate layers as well and it
compares what sounds with what was written.

It can say that a render is clean, in key, in time and balanced. It cannot say that the music is beautiful, that a
melody is worth hearing twice, or that a mix feels warm. A person decides those by listening. A clean report means
"nothing measurable is wrong", and no more than that.

## Use

```js
import { listen, summary } from './index.js';
const report = listen({ channels: [left, right], sr: 48000 }, { score, stems });
console.log(summary(report));      // a few lines of text
report.flags;                      // one entry for each number outside its target
```

`score` is optional: `{ bpm, swing, chords: [{ t0, t1, bar, sym, root, pcs }], lead: [{ t0, t1, m }] }`, with times in
seconds and pitch classes as numbers 0 to 11 (C is 0). `stems` is optional: `{ music, ambience, drums, keys, bass, pad,
lead }`, each a pair of channels the same length as the mix.

## What it measures

| Area | Measure | Method |
| --- | --- | --- |
| Level | integrated loudness in LUFS (loudness units relative to full scale) | ITU-R BS.1770-4, through `world/studio/lib/loudness.mjs` |
| | loudness range in LU | EBU Tech 3342: gated short-term loudness, 10th to 95th percentile |
| | true peak in dBTP (the peak between samples) | 4x oversampling |
| | clipping, DC offset, crest factor | sample counts, channel mean, peak over RMS |
| Balance | level per octave band against a stated target curve | long-term average spectrum (Welch) |
| | harshness | 2 to 5 kHz against the 250 Hz to 2 kHz body, and the tallest third-octave peak from 2 to 5 kHz over its neighbours |
| Pitch | chroma (energy per pitch class) for each written chord | partials found per 340 ms frame, assigned to the nearest semitone |
| | chord estimate, and the share of energy on the written chord | chord templates over the chroma; the bass decides the root |
| | tuning of the lead line in cents | distance of each partial from equal temperament |
| Time | tempo, tempo drift, beat spread, swing, onset density | spectral-flux onsets, autocorrelation, a beat grid |
| Harmonics | sensory roughness over time | Sethares (1993), after Plomp and Levelt (1965); citations in `rough.js` |
| Stereo | correlation, width, level change in mono | sums and differences of the channels |
| Gaps | dropouts and silence | 5 ms level frames against the two seconds around them |
| Layers | how far the music and the lead sit over the ambience, per octave band | band energy of signal over masker |
| | loudness of each layer, and the kit against the harmony layers | BS.1770 per layer |
| Shape | repetition: how alike successive eight-bar phrases are | correlation of band-energy patterns, eight steps to the bar |
| | entries: the largest rise in 3 second loudness, and layers that first sound together | loudness curve; first sounding time per layer |
| Low end | level change under 120 Hz when summed to mono; two bass layers in the same band | low-pass, then sums; band energy per frame |
| Presence | mean of the 2, 4 and 8 kHz bands against the target, flagged as dull or bright past 3 dB | the same octave bands |
| Pictures | log-frequency spectrogram, chromagram, loudness curve | our own PNG writer in `png.js` |

The targets are in `TARGETS` in `index.js`. Loudness (-14 LUFS integrated) and true peak (at most -1 dBTP) are the
site's master target. The balance curve is a house choice for quiet music over sea and wind; it is a statement of
intent and can be replaced per call.

## How we know it hears

Two kinds of control, both run as tests.

**Known signals** (`ear.test.mjs`): a 997 Hz sine at -23 dBFS reads -23 LUFS; a 440 Hz sine is found at 440 Hz on pitch
class A, and the same sine 30 cents sharp reads 30 cents sharp; written chords are named by root and family; pink noise
reads a flat octave slope and white noise 3 dB per octave; click tracks at set tempos and swing ratios are read back;
the roughness curve peaks where the published curve peaks; identical, inverted and unrelated channels read +1, -1 and
0; a 40 ms hole is found where it was cut. Round two (`shape.test.mjs`): a phrase played four times reads as one
performance and four different phrases do not; a 12 dB step reads 12 dB and a slow ramp reads little; layers that
start together are counted; noise shaped to the target curve reads 0 dB presence and 6 dB down at the top reads dull;
bass out of phase between the channels is caught when the whole mix still sums well; two bass layers in one band
clash and an octave apart they do not; a 168 BPM syncopated break reads 168 with the score and 168 or 84 without it.

**Planted defects** (`system/site-music/controls.test.mjs`): clean excerpts of two pieces (the slow ballad and the drum
and bass piece) raise no flag. The same excerpt with one defect planted must raise the flag that names it. Seventeen
are planted: clipping, the bass a semitone high, the electric piano a semitone high, a wrong chord in one bar, tempo
drift, an 8 dB peak at 3 kHz, an 8 dB loudness error, an inverted channel, a 60 ms dropout, a DC offset, ambience
raised over the lead, one lead note 45 cents sharp, the first statement repeated as a loop, the band starting all at
once, the top of the mix turned down 6 dB, the right channel inverted below 200 Hz only, and a bass guitar moved into
the sub's band. The controls found two holes while the ear was being built (a wrong chord passed a loose limit, and a 3 kHz
peak passed an absolute harshness measure on a dark mix); both are closed and the controls keep them closed.

## Limits

- Roughness does not catch a layer played a semitone off in this idiom, and round two did not close that hole. Ninth
  and thirteenth chords already hold seconds and sevenths. Round one read the whole mix: 0.081 clean against 0.086 (bass
  transposed) and 0.097 (piano transposed). Round two added roughness between layers only (each pair takes one partial
  from each of two layers), which removes the roughness inside a chord voicing: 0.066 clean against 0.071 and 0.076.
  The separation is 8 and 15 percent, too small to set a limit on. The chord fit of each layer catches the defect
  (0.03 and 0.21 against a limit of 0.72). Roughness stays in the report as a description of the harmony, with flags
  only for gross readings.
- Tempo has an octave: without the score a 168 BPM break reads as 168 or as 84, and both are right ways to feel it.
- Entry abruptness by level alone is weak: a staged entry and a sudden one read 6 to 8 dB against each other in these
  pieces. The count of layers that first sound together is the measure that separates them, and it needs the layers.
- Repetition compares phrases of a set length on a bar grid. It needs the tempo, and it reads a strict loop; a loop
  with small changes in timbre still reads as one performance, and two performances of the same chords do not.
- The chord estimate needs a bass to name a root. A rootless piano voicing alone is read as the chord its upper notes
  spell (for example E-flat minor ninth without its root reads as G-flat major seventh).
- Masking is a band-energy comparison. It leaves out the inner ear's excitation pattern, so it misses masking that
  spreads upward from a loud low band.
- Tempo is read from onsets. On music with no clear attacks the reading is weak, and windows without a pulse are left
  out of the drift measure.
- Timing is read from the drum layer when it is given on its own, and from the whole music otherwise; rolled chords and
  slow attacks blur the second reading.
- The limits for flags were set from this site's own renders: each sits between the clean reading and the reading with
  the defect planted. Other music needs its own limits.
