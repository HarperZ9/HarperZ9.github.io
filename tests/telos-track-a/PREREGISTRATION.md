# Telos Track A, steps T0 to T3: pre-registration

Written 2026-10-02, before any code for these steps existed and before any number below was measured.
The block between the two markers is hashed with SHA-256 (UTF-8 bytes strictly between the end of the
start marker and the start of the end marker, LF line endings). `node tests/telos-track-a/prereg-hash.mjs`
prints the hash. Every result file under `tests/telos-track-a/results/` carries it as `prereg_sha256`.

Binding status: this file is committed to a local branch only. A local commit can be rewritten by its
author, so the hash binds nothing until the maintainer records it somewhere the author cannot rewrite
(a pushed commit, a signed tag or a Flywheel receipt). A threshold changed after a related result exists
gets a new hash, a date, a reason and the label "post hoc".

<!-- prereg-track-a-v1:start -->
## Scope

Steps T0 to T3 of Track A: pre-registration and witness rules (T0), the false and mislabelled perception
channels (T1), SHA-256 receipts (T2), and an integer colour path with cross-language conformance (T3).
CPU only. Where the plan and its adversarial review disagree, the review's fix is followed and noted.

## T0. Witness rules

- T0.1 Hash. The prereg hash is SHA-256 of this block as defined above.
- T0.2 Citation. Threshold: 100% of result files under `tests/telos-track-a/results/` carry
  `prereg_sha256` equal to the hash of this block.
- T0.3 Paired mutation. Every equality test named in `tests/telos-track-a/mutation/registry.json` has at
  least one paired mutation. The runner copies the code to a temporary directory, applies one mutation,
  runs the paired test file and records pass or fail. The unmutated copy must pass. Threshold: every
  listed equality test is failed by at least one of its mutations (the test is shown able to fail).
  Surviving mutations are reported with the test they survived and are never deleted from the registry.
- T0.4 Receipt edit suite. For each receipt type (media conversion receipt, export receipt, certificate
  content pointer), 20 single-field edits each change the receipt hash. Threshold: 20 of 20 per type.

## T1. False and mislabelled channels

Removed (decision D2 recommended by the plan; review F4 and F5):
- T1.R1 WPIR leaves the packet: no `wpir` key in `fidelity`, in the vision readout, or in the fidelity
  ledger record. The `wpir` library function is deleted. RTF-1 (step T10) is its replacement.
- T1.R2 PBE leaves the packet: no `pbe` key in `fidelity`, in `audioPerceptual`, or in the ledger record.
  The `pbe` library function is deleted.
- Threshold for R1 and R2: a packet assembled with audio present serializes with 0 occurrences of the
  keys `wpir` and `pbe`, and the ledger normaliser drops both keys from legacy input.

Edge orientation (review F5: tested in both directions):
- T1.O rule: angles are measured with y pointing up on the displayed image. Each strong Sobel edge
  (magnitude at or above the existing threshold 40) votes into one of four bins centred on 0, 45, 90
  and 135 degrees (horizontal, rising diagonal "/", vertical, falling diagonal "\"). Coherence is the
  length of the mean of the unit vectors at twice each edge angle, in [0, 1]. `dominant` is "none" when
  there are no strong edges or coherence is below 0.2; otherwise it names the largest bin.
- Fixtures: four sinusoidal gratings, 96 x 96 grey, luma 128 + 100 sin(2 pi d / 8) with d = y
  (horizontal), x (vertical), (x + y) / sqrt 2 (rising, image y down), (x - y) / sqrt 2 (falling); two
  half-plane frames 192 x 128, value 220 where y > H - x H / W (rising) or y > x H / W (falling), else 0;
  an isotropic disk, 96 x 96, radius 30 at the centre, 220 inside and 30 outside.
- Threshold: each grating's own bin share is at least 0.8 and `dominant` names it; each half-plane frame's
  `dominant` names its diagonal; the disk has coherence below 0.2 and `dominant` "none".

Pitch:
- T1.P rule: the scalar `audio.pitch` is the YIN f0 of the analyser's 8-bit time-domain buffer, rounded
  to 0.1 Hz, and is 0 when the buffer's RMS is below 1/128 (silence). `pitchMethod` is "yin". The
  FFT-peak `dominantPitchHz` no longer feeds `audio.pitch`.
- Fixtures: sample rate 48,000 Hz, 4,096 samples, notes C2, C3, C4, C5, C6 and C7 (MIDI 36 to 96 in
  octaves, A4 = 440 Hz). Full tone: partials 1 to 5 at amplitude 1/k. Missing fundamental: partials 2 to
  6 at amplitude 1/k. Phase 0, peak normalised to 0.8, quantised as byte = clamp(round(128 + 128 x)).
- Threshold: |12 log2(pitch / f_true)| at or below 1 semitone on all 12 tones; silence reads 0.

Loudness (review F5):
- T1.L rule: ISO 226 phon and sone are computed only when the caller supplies `splOffsetDb`; then SPL is
  the analyser dB of the loudest bin plus the offset, evaluated at that bin's frequency. Without an
  offset the `iso226` key is absent.
- Fixtures: analyser bytes (decibel range -100 to -30, fftSize 4,096, 48 kHz) with one peak at the bin
  nearest 1 kHz and every other bin at byte 0; peak byte 146; offset chosen so the peak's SPL equals 40,
  60 and 80 dB.
- Threshold: phon within 1 of ISO 226 at 1,000 Hz for each of the three levels; `iso226` absent when no
  offset is given.

Colour words, rule R-hue-v1 (a finding made while preparing this step: the plan's suggested rule, nearest
of 11 prototypes in OKLab, names lime "yellow", cyan "white" and sky blue "pink"; R-hue-v1 replaces it):
- Inputs: OKLab of the sRGB bytes (sense-core float conversion); C = hypot(a, b); h = atan2(b, a) in
  degrees. Prototypes are build-color's 11 basic colours (red ff0000, orange ffa500, yellow ffff00, green
  008000, blue 0000ff, purple 800080, pink ffc0cb, brown 8b4513, white ffffff, grey 808080, black 000000).
- Achromatic when C < 0.035 (build-color's own achromatic threshold): black when L < 0.35, white when
  L >= 0.85, else grey (build-color's description bands collapsed to basic terms).
- Otherwise the hue sector is the nearest prototype hue, circularly, among pink, red, orange, yellow,
  green, blue and purple.
- Brown when the sector is orange or yellow, or the sector is red and h >= the mean of the red and brown
  prototype hues, and L < the mean of the orange and brown prototype L values.
- Red when the sector is pink and L < the mean of the red and purple prototype L values.
- Margin: the OKLab distance to the nearest boundary that decided the word (hue rays as chords at the
  colour's chroma; L and C splits directly). Every word ships with its margin.
- Fixtures (plan's 19): the 11 prototypes named as themselves; e8aac8 (eosin-like) pink; 5f328c
  (hematoxylin-like) purple; six near-boundary colours, one per boundary kind, placed by the rule's
  Python twin at a margin between 0.003 and 0.01: c4631a brown (red and orange ray), d0b0c6 purple
  (pink and purple ray), eadafb purple (blue and purple ray), d26837 red (brown L split), a54764 pink
  (dark-pink L split), 44272a red (achromatic C split).
- Threshold: the JavaScript name equals the reference on all 19.
- Extended probe (author-labelled by the Claude session that wrote this file, unambiguous CSS colours;
  a sanity probe, not an independent human reference): red ff0000 dc143c b22222 8b0000; orange ffa500
  ff8c00; yellow ffff00 ffd700; green 00ff00 008000 228b22 32cd32 006400 2e8b57 90ee90; blue 0000ff 000080
  4169e1 1e90ff 87ceeb 00bfff 4682b4 191970; purple 800080 4b0082 8a2be2 9932cc 663399 9370db; pink ffc0cb
  ff69b4 ff1493 ffb6c1; brown 8b4513 a0522d d2691e; white ffffff fffafa f5f5f5; grey 808080 a9a9a9 d3d3d3
  696969 708090; black 000000 1e2228. Threshold: at least 44 of 46 match. build-color's nearest
  prototype rule is scored on the same probe as the comparator and reported, not gated.

Symmetry:
- T1.S rule: each axis reports the Pearson correlation between luma and its mirror image across that
  axis, in [-1, 1], with `measure: "pearson-luma-mirror"`; a flat frame reports null. A frame reads
  mirrored on an axis when the correlation is at least 0.9; the long description reads "asymmetric" when
  both correlations are below 0.5.
- Fixtures: a true left-right mirror, 96 x 64, luma round(40 + 120 t(x) + 80 y / 63) with
  t(x) = 1 - |2x - 95| / 95; a true top-bottom mirror, 96 x 64, luma round(40 + 120 t(y) + 80 x / 95)
  with t(y) = 1 - |2y - 63| / 63; the audit's low-contrast frame (192 x 128, value 120, left half
  120 + 20 x / 96, constant along y, so it is a true top-bottom mirror); the audit's off-centre disk
  (192 x 128, ground 30,34,40, disk at 130,50 radius 28 coloured 230,190,40); seeded white noise
  (192 x 128, xorshift32 seed 20261002).
- Threshold: on every fixture, an axis reads mirrored if and only if the frame's pixels are exactly
  mirror-symmetric on that axis (checked by direct pixel comparison in the test).

Shapes:
- T1.H rule: colour labels use hue bins of 45 degrees centred on 0 degrees (bin = floor(((h + 22.5) mod
  360) / 45)), so a red that crosses 0 degrees stays in one bin.
- Fixtures: (a) 120 x 80 grey ground (128,128,128) with a block x in [30, 90), y in [20, 60) whose HSV
  hue runs linearly from 350 to 10 degrees across x, saturation 0.9, value 0.85; (b) the audit's red-wrap
  frame, 192 x 128, ground 40,40,40, block |x - 96| < 40 and |y - 64| < 30 with R 210 and (G, B) either
  (30, 10) or (10, 30) by a seeded xorshift32 coin (seed 20261002).
- Threshold: on each fixture, exactly one non-ground component overlaps the block, with area within 0.01
  of the block's share of the shape grid and bbox IoU at least 0.95 against the block.

## T2. SHA-256 receipts

- Canonical bytes `project-telos.canonical-bytes/v1`: UTF-8; object keys sorted by UTF-16 code unit;
  no insignificant whitespace; strings escaped as JSON with only `"`, `\`, `\b`, `\f`, `\n`, `\r`, `\t`
  and `\u00XX` (lowercase hex) for other C0 controls; non-ASCII written raw; lone surrogates rejected;
  numbers allowed only as safe integers (at most 2^53 - 1 in magnitude), so fractional values travel as
  fixed-decimal strings; NaN, infinities, fractions and `undefined` are rejected with an error.
- SHA-256 is a pure JavaScript implementation, synchronous, used wherever Web Crypto is absent, so a
  receipt never falls back to FNV-1a. Known-answer vectors: FIPS 180-4 examples ("", "abc", the 448-bit
  and 896-bit messages, one million "a"). Agreement with Node's built-in SHA-256 on 1,000 seeded byte
  strings of length 0 to 300.
- Receipts switched: the media conversion receipt and the export receipt hash their payloads with
  SHA-256 always and carry `receiptSha256` over their own canonical bytes; the certificate content
  pointer becomes SHA-256 over canonical bytes (64 hex characters). The Studio shelf id stays a 32-bit
  FNV-1a, because it is a deduplication id and the spec reserves FNV for that use.
- Cross-language: 1,000 seeded receipts generated in JavaScript are re-derived by an independent Python
  canonicaliser (stdlib only). Threshold: 100% agreement on canonical bytes and on SHA-256; the KAT set
  and the Node comparison agree 100%; T0.4 holds for every receipt type.

## T3. Integer colour path and cross-language conformance

Path `project-telos.oklab-int/v1` (review F12; the plan names a table cube root, the review allows a
table or a correctly rounded routine; this uses a table built by an exact integer routine):
- sRGB byte to linear: a 256-entry table of round(lin(i / 255) x 2^20), computed once at high precision
  and written as integer literals in both languages.
- Linear to LMS: Ottosson's M1 with each coefficient as round(c x 2^20); LMS in Q20 = floor((sum +
  2^19) / 2^20); then Q16 = floor((Q20 + 8) / 16), clamped to [0, 65536].
- Cube root: a 65,537-entry table, cbrt_q16(x) = the integer nearest cbrt(x / 65536) x 65536, built by an
  exact integer routine (floor cube root of x x 2^32, then round up when 8 x 2^32 x >= (2f + 1)^3).
- LMS' to OKLab: Ottosson's M2 with coefficients round(c x 2^20); L, a, b in Q36 (no rounding).
- Bins: bin = clamp(floor((2 (V - LO) n + S) / (2 S)), 0, n), n = 2^bits - 1, S = HI - LO, with LO and HI
  as round(x x 2^36) of L [0, 1], a [-0.234, 0.277], b [-0.312, 0.199]. All divisions are exact integer
  floor divisions. Cell means are taken on Q20 linear values, rounded half up.
- Layer text `oklab-int/v1`: L0 (size, achromatic flag, L8 bins at p5, p50, p95 by nearest rank, chroma
  p95 in thousandths from an integer square root); L1 (L on 8 x 8, a and b on 4 x 4, 6 bits, 64-symbol
  alphabet); L2 chromatic at N = 12 and 32 (L on N x N, a and b on N/2 x N/2, 6 bits); L2 achromatic at
  N = 16 and 24 (L only, 8 bits, hex). Achromatic flag: chroma p95 below 0.02. The hue angle of the
  prototype L0 is left out of the integer L0 because it needs atan2.
- Fixtures: all 16,777,216 sRGB colours at L6/ab6 and at L8; the 36 audit frames (read from the directory
  in `TELOS_AUDIT_FRAMES`, checked against a committed SHA-256 manifest); 1,000 seeded random images
  (xorshift32, seed 20261002, sizes 1 to 64 on each side, a mix of noise, blocks, ramps and grey images).
- Threshold: 0 bin mismatches between Node and Python over the full cube at both allocations; byte-identical
  layer text on all 1,036 images. Reported, not gated: integer bins against the float prototype's bins
  over the cube, and float bins from Node against float bins from numpy (review inference on F12).
<!-- prereg-track-a-v1:end -->

## Notes outside the hashed block

- The plan's T1 hue fix pointed at build-color's nearest-prototype rule. Before this file was written,
  that rule was run on a handful of CSS colours and misnamed lime, cyan, sky blue, turquoise and medium
  purple. R-hue-v1 and its extended probe were written after seeing those misnamings and before R-hue-v1
  was run on the probe.
- The six near-boundary colours were placed by running the Python twin of R-hue-v1 on seeded random
  colours and keeping the first colour per boundary kind with a margin between 0.003 and 0.01. Their
  reference names are the twin's output, so the 19-colour test checks agreement between two
  implementations of one rule; the extended probe is the only check of the rule against meaning.

## Amendment 1 (T3 integer path v2)

Written 2026-10-02 after the v1 results existed and before any v2 code. Relative to v1 this is post hoc;
relative to v2 it is a pre-registration. The block below has its own hash (`amendment_1_sha256` in the
v2 result files, printed by `node tests/telos-track-a/prereg-hash.mjs --amendment-1`). The v1 block above
is unchanged and its hash is unchanged.

<!-- prereg-track-a-amend-1:start -->
## T3 amendment 1: integer path v2

Reason: v1 met every pre-registered gate, and v1 deviates from float64 OKLab by up to 2.0e-3 near black
(measured on a 1-in-27 sample of the cube; worst at sRGB 0,0,3). The cause is rounding LMS to Q16 before
the table cube root, where the cube root amplifies small differences. 2.0e-3 is about half an L8 bin, and
the achromatic branch carries L8; dark frames (radiographs, fluorescence) sit in that range.

Path `project-telos.oklab-int/v2`, replacing v1 (v1 stays in the history and in the `-v1` result files):
- sRGB byte to linear: a 256-entry table of round(lin(i / 255) x 2^24), generated at 60-digit precision.
- Linear to LMS: M1 coefficients round(c x 2^20); LMS kept unrounded in Q44, clamped below at 0.
- Cube root: the integer nearest cbrt(x / 2^44) x 2^16, computed as the exact nearest integer cube root
  of 16 x: a floating-point first guess, then integer corrections until f^3 <= 16 x < (f + 1)^3, then
  f + 1 when 8 x 16 x >= (2f + 1)^3. The result does not depend on the float guess.
- LMS' to OKLab: M2 coefficients round(c x 2^20), Q36, unrounded. Bins and ranges as in v1.
- Cell means on Q24 linear values, rounded half up. Layer text header `oklab-int/v2`; otherwise the v1
  format.

Thresholds:
- Conformance (as v1): 0 bin mismatches between Node and Python over all 16,777,216 colours at L6/ab6 and
  L8; byte-identical layer text on the 1,000 seeded random images and the 36 audit frames.
- Accuracy (new gate): over the full cube, the maximum absolute difference between v2 OKLab and float64
  OKLab (numpy, Ottosson matrices, np.cbrt) is at most 1e-4 on each of L, a and b. The estimate before
  measuring is about 4e-5 (Q16 rounding of the cube root, times the M2 row sums).
- Reported, not gated: bin disagreement between v2 and the float prototype, beside v1's.
<!-- prereg-track-a-amend-1:end -->
