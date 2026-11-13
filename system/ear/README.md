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
| Notes | attack time and its spread, spectral flux inside a note, brightness against level, likeness of repeated notes, inharmonicity | per note of a lead or bass layer, from the score's note list (`note.js`) |
| Identity | which instrument a single note is nearest to, among real instruments | 25 timbre features per note (`timbre.js`), nearest class over a book of notes recorded from real instruments (`identity.js`, `identity-refs.json`) |
| | how far a note is from a real note of the same pitch, moment by moment, over the whole note and per segment (attack, first 150 ms, sustain, tail) | mel-spectrogram distance in dB (`likeness.js`); a second reading with each picture's fixed colour per band removed (`flattened`) |
| Pluck | the finger or hammer burst above each band's decay, two decay speeds per harmonic, the pitch just after a pluck | short frames per octave band; early and late decay lines; instantaneous frequency of harmonics 3 to 8 (`pluck.js`) |
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
and bass piece) raise no flag. The same excerpt with one defect planted must raise the flag that names it. Eighteen
are planted: clipping, the bass a semitone high, the electric piano a semitone high, a wrong chord in one bar, tempo
drift, an 8 dB peak at 3 kHz, an 8 dB loudness error, an inverted channel, a 60 ms dropout, a DC offset, ambience
raised over the lead, one lead note 45 cents sharp, the first statement repeated as a loop, the band starting all at
once, the top of the mix turned down 6 dB, the right channel inverted below 200 Hz only, a bass guitar moved into
the sub's band, and (round three, the eighteenth) a lead whose every note is the same wave. The controls found two holes while the ear was being built (a wrong chord passed a loose limit, and a 3 kHz
peak passed an absolute harshness measure on a dark mix); both are closed and the controls keep them closed.

## Instrument identity (round four)

The measures above say a render is clean. None of them says whether a voice labelled saxophone resembles a saxophone.
Round four gives the ear ground truth: 332 single notes recorded from real instruments, from six public sets whose
licences allow this use (University of Iowa Musical Instrument Samples, free for any project without restrictions;
Karoryfer Black And Blue Basses, Weresax and Meatbass, CC0; Versilian Community Sample Library tenor saxophone, CC0;
Discord SFZ GM Bank electric piano, CC0). The recordings stay outside the repository. `identity-refs.json` holds numbers
measured from them, with each source named.

Two measures, and what each is for:

- **The judge** (`identity.js`) names the nearest instrument class for one note, or "none". It is tested on its own book
  first (`identity.test.mjs`): with each note held out in turn, 286 of 332 are named as their own instrument (86 percent);
  saxophone and clarinet are confused in 3 of 68 and 3 of 34 notes; bass guitar and upright bass never; 16 of 16 sines
  and sawtooths are rejected as every instrument; a reference moved 2 or 3 semitones keeps its class in 237 of 267 cases.
- **Likeness** (`likeness.js`) is the stricter one: the distance in dB between our note and a real note of the same pitch,
  beside the distance between two real recordings of that instrument from different sources. A voice passes only when
  it is nearer to real notes from sources held back from its fitting than real sources are to each other.

What the judge cannot do, stated from its own failed controls:

- It does not stand for "convincing". It named the round three saxophone a saxophone in 90 to 100 percent of notes, and
  a listener did not find that voice convincing. The listener's ear overrides the judge.
- It knows sources as much as instruments. With a whole source held back, 93 of 144 notes are still named correctly
  (65 percent; saxophone 82 percent, bass guitar 28 percent). Notes cut from a played saxophone phrase of a source it had
  never seen were named saxophone in 1 of 10 cases. It reads isolated single notes, and reads them best from rooms and
  microphones like the ones in its book.
- A sawtooth sits close to a saxophone on the averaged features. It is rejected only by the range test on noise and
  movement, which a synthetic voice can satisfy by adding noise and movement.
- The electric piano has one instrument behind it, flute and clarinet one source each, so those three have no
  held-out source and get no pass or fail from likeness.

Build and report: `node system/ear/tools/identity.mjs build NOTES_DIR`, then `report NOTES_DIR`. Judge our voices:
`node system/site-music/tools/voicejudge.mjs --notes NOTES_DIR`.

## Placing a fault in time (round five)

A single distance says a voice differs; it does not say where. `segmentDistances` in `likeness.js` splits the distance
into four parts of the note, in seconds from its onset: the attack (-0.02 to 0.03), the early part (0.03 to 0.15, where a
plucked string sheds its upper harmonics fastest), the sustain (0.15 to 0.6) and the tail (0.6 to 1.5; reference notes
ring until they die, so this is the decay). The yardstick is the same split between two real recordings. Bass voices
are drawn from 30 Hz, so the fundamental of a low string is in the picture (from 60 Hz it was not).
`system/site-music/tools/segcheck.mjs` runs it for one voice; `voicetable.mjs` for all of them.

Per-source normalisation: each recording carries its microphone and room as a fixed colour across the bands.
`flattened` removes from a picture its own mean level per band over the note. When the plain distance is large and the
flattened one small, the difference is mostly fixed colour (a microphone or a body), and not the shape of the note in time.

The harmonic-sum bass reader (`pitch.js`): a partial below four times 135 Hz lends its energy, divided by k, to the
fundamental it would be harmonic k of. A bass whose second or third harmonic is stronger than its fundamental is still
read at its fundamental; round four read a strong third harmonic as a fifth in the bass.

## Limits

- Roughness does not catch a layer played a semitone off in this idiom, and round two did not close that hole. Ninth
  and thirteenth chords already hold seconds and sevenths. Round one read the whole mix: 0.081 clean against 0.086 (bass
  transposed) and 0.097 (piano transposed). Round two added roughness between layers only (each pair takes one partial
  from each of two layers), which removes the roughness inside a chord voicing: 0.066 clean against 0.071 and 0.076.
  The separation is 8 and 15 percent, too small to set a limit on. The chord fit of each layer catches the defect
  (0.03 and 0.21 against a limit of 0.72). Roughness stays in the report as a description of the harmony, with flags
  only for gross readings.
- The note measures say whether a line is stamped out, and they are weaker at saying whether an instrument convinces.
  Likeness of repeated notes is the firm one: copies read 1.00 and a played line reads well under 0.9. Brightness
  against level is firm only on a designed ladder (one pitch, one length, several strengths); inside a piece it is
  mixed up with note length and register and is reported without a limit. The targets used for the saxophone and bass
  guitar (brightness rising about 0.15 to 0.25 octave per 10 dB, a string inharmonicity near 1e-4, a reed attack of
  some tens of milliseconds) are from memory of the acoustics literature, not checked against a source in this work.
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
