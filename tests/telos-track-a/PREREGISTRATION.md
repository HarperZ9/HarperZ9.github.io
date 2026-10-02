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

## Pre-registration 2 (steps T4 to T7)

Written 2026-10-02, after the T0 to T3 results and before any code for T4 to T7 existed and before any
T4 to T7 number was measured. Nothing in the slice 0 store had been encoded, tokenized or probed by this
session when the block below was written. The block has its own hash (`prereg_t4t7_sha256` in every T4
to T7 result file, printed by `node tests/telos-track-a/prereg-hash.mjs --t4t7`). The v1 block, the
amendment 1 block and their hashes are unchanged. The binding status note at the top of this file applies.

<!-- prereg-track-a-t4t7:start -->
## Scope

Steps T4 to T7 of Track A (PLAN.md section 2.2): the measurement contract that accepts a caller's image
(T4), declared token budgets with non-inferiority margins (T5), nuisance invariance (T6) and task value
measured on real labelled images (T7). CPU only. Images: the 36 audit frames (TELOS_AUDIT_FRAMES) and the
300 clean rows of the slice 0 store `slice0-v2` (TELOS_SLICE0_STORE for the PNG files, TELOS_SLICE0_RECORDS
for `records_clean.jsonl` of build run3a). No MMBU dev image is read. Where a threshold below differs from
the plan or the spec, the reason is given beside it.

## Shared definitions

- Packet: `layerPacket(px, w, h, 4, 32)` of system/lib/sense-core/layers-int.mjs: L0, L1 and the L2 branch
  the L0 achromatic flag selects (chromatic: N = 32, L6/ab6; achromatic: floor(32 / 2) = 16 cells per side,
  L8 hex). This fixes the open issue from T3: the achromatic branch at N / 2 cells is pre-registered here.
- Decoding a layer: bin v of a channel with range [LO, HI] and n = 2^bits - 1 dequantizes to
  LO + v (HI - LO) / n, with the integer path ranges L [0, 1], a [-0.234, 0.277], b [-0.312, 0.199].
- Slice 0 decode: PIL `Image.open(...).convert("RGBA")` of each store PNG; every row's pixel SHA-256 of the
  RGB bytes is checked against `pixel_sha256` in its record before use.
- Bootstrap: percentile intervals, 10,000 resamples, numpy default_rng seed 20261002. On slice 0, resampling
  is by cluster: Kather by `group` (slide), BBBC010 by `group` (well), PBC by row (PBC has no group ids).
  On the audit frames, by frame.
- Tokenizer: Qwen3.5-2B `tokenizer.json` from the local Hugging Face cache (snapshot
  15852e8c16360a2fea060d615a32b45270f8a8fc, file SHA-256 recorded in the result), `encode(text,
  add_special_tokens=False)`, each layer's text counted on its own.
- Equality tests carry "eq:" in their names and are registered with at least one paired mutation (T0.3).
  The T0 witness rules extend to the T4 to T7 suites and result files.

## T4. Measurement contract v2 (`telos.measurement.layers` accepts a caller's image)

Repository: the Telos MCP repo (worktree from origin/main, branch feat/telos-measurement-v2). The tool
keeps its v1 demo packet when called with no arguments. With arguments it reads a request
`project-telos.measurement-request/v2` and returns `project-telos.measurement-layers/v2`.

Request:
- `image`: exactly one of `{rgba, width, height}` (base64 of raw 8-bit RGBA) or `{path, width, height}`
  (a raw 8-bit RGBA file). PNG and JPEG decoding are out of scope for v2; JPEG stays with the caller.
- `declared`: `colour_space` in srgb, display-p3, rec2020, unknown (absent means unknown; recorded as a
  declaration); `alpha` in none, straight, premultiplied (premultiplied is un-premultiplied in integers,
  c' = min(255, floor((c 255 + floor(a / 2)) / a)) for a > 0, and 0 for a = 0, before any statistic, and
  the step is recorded); `bit_depth` 8 only, otherwise `unsupported_bit_depth`.
- `layers`: subset of L0, L1, L2, L3 (default L0 to L2, plus L3 when overlays are given); `n`: L2 grid,
  integer 1 to 64, default 32; `roi` `{x, y, w, h}` in native pixels; `resample` `{long_edge, filter:
  "area-linear"}`; `overlays`: list of `{id, mask}` with mask the base64 of width x height bytes, nonzero
  inside; `run_id`, `frame_id` echoed into events.
- Limits: width and height at least 1 and width x height at most 16,777,216, otherwise `image_too_large`;
  rgba length not equal to width x height x 4 gives `pixel_dimensions_mismatch`.
- Paths: allowed roots come from the server environment TELOS_MEASUREMENT_ROOTS (path-list separator).
  A path is accepted only when it is absolute, is not a UNC or device path, and its real path (after every
  symlink and junction) lies inside the real path of an allowed root (case-insensitive on Windows).
  Otherwise `path_outside_allowed_root`. No roots configured means every path is refused.

Processing order: decode, un-premultiply, roi crop, resample, layers. Resampling uses the Telos filter
`resample-int/v1`: exact-area box filter on Q24 linear values in integers (output pixel = round half up of
the area-weighted mean of the source pixels it covers), shared with T6. Layers are the sense-core
integer path (L0 to L2 as in the packet definition, at the caller's n after the privacy cap). L0 is computed
on pixels outside the union of overlay masks. L3 (overlay-only in v2) lists each overlay as id, bbox
`x0,y0,x1,y1` (inclusive integer pixels), area in thousandths of the frame, and `overlay:true`.

Response: `input_receipt` (rgba_sha256 of the decoded RGBA bytes after un-premultiply, width, height,
decoder `raw-rgba8`, declared fields, colour_status `declared` or `unverifiable`, alpha step, roi,
resample, and `sha256` over the canonical bytes of the rest); `layers[]` (id, text, cells, params,
preserves, discards, `measurement_sha256`); `oklab_mean` (OKLab of the mean linear colour, 9-decimal
strings, from an exact BigInt path: Q24 linear means, M1 and M2 coefficients at 2^40, nearest integer
cube root); a luma histogram (16 bins of integer Rec. 709 luma); `events[]` with uncertainty status
`computed` and the input receipt hash (review F20: `witnessed` is reserved for pixels Telos rendered
itself); `status` "UNVERIFIABLE" with reason `no_criterion_supplied`; `failure_codes` and `warnings`;
`receipt_sha256` over the canonical bytes (`project-telos.canonical-bytes/v1`) of everything else.
Errors return a structured rejection `{status: "REJECTED", failure_code}` with exit status 0.

Privacy (review F7): every emitted layer has at most floor(w h / 16) cells after roi and resample. L0 counts
as 1 cell, L1 as 80, L2 chromatic as N^2 + floor(N / 2)^2, L2 achromatic as floor(N / 2)^2, L3 as 1 per
overlay. L2's N is capped to the largest value that fits and the cap is reported as a warning; a layer
that cannot fit at N = 1 (or L1 at all) is dropped and listed with `privacy_cell_bound`, never truncated.
After assembly the response is serialized and scanned with every emitted layer text removed: a base64 or
hex run (characters A-Z a-z 0-9 + / = _ -) longer than 64 characters, or a decimal list (numbers joined by
commas, semicolons or spaces) longer than 64 characters, replaces the response with a `raw_payload_leak`
rejection.

Thresholds (the spec's checks (a) to (e), review F6, F7, F20, F27):
- (a) a constant 64 x 64 image (sRGB 200, 120, 40) puts its histogram in one bin, and `oklab_mean` is within
  1e-6 of exp-resolution/colour.py's float OKLab on each channel; the same holds for 200 seeded constant
  colours (xorshift32 seed 20261002).
- (b) rgba length mismatch returns `pixel_dimensions_mismatch`; (c) a path outside every root, a UNC path, a
  relative path, and a junction inside an allowed root that points outside it each return
  `path_outside_allowed_root`, and a file inside the root is accepted.
- (d) two runs in one process and two runs in separate processes give an identical `receipt_sha256`; an
  independent Python canonicaliser re-derives `input_receipt.sha256` and `receipt_sha256` on 100 seeded
  responses (100 of 100). Runs on a second Node major version and on Linux are recorded as not run when no
  such runtime is on the machine.
- Paired sensitivity (F6): a one-code-value change to one pixel changes `input_receipt.sha256`,
  `receipt_sha256` and the changed layer's `measurement_sha256` on 20 of 20 seeded images; a change to one
  declared field changes both receipt hashes; 20 single-field edits of a response each change
  `receipt_sha256` (20 of 20).
- (e) on 100 seeded random images (sizes 1 to 96 per side) and a 64 x 64 noise image no run as defined
  above appears outside permitted layer blocks; on a 32 x 32 input with n = 32 every emitted layer has at
  most 64 cells (L1 dropped, L2 capped at N = 7); a response with an injected 65-character hex run is
  rejected with `raw_payload_leak`.
- Status: every event from caller pixels carries `computed` and the input receipt hash; no `witnessed`
  appears in a v2 response; the packet status is UNVERIFIABLE.
- Layer identity: the vendored sense-core files in the Telos repo are byte-identical to the site's
  (checked in the site suite when TELOS_MCP_ROOT is set), and the v2 layer text equals the site's
  `layerPacket` text on the same pixels for 50 seeded images.

## T5. Declared token budgets and prefix rebuilds (U2, review F10)

- Budgets declared now (C8): L0 at most 80 tokens; L1 at most 100 (both from the spec); L2 chromatic at
  N = 32 at most 1,300 and L2 achromatic at 16 x 16 at most 650 (the spec's measured prototype means, 1,034
  and 520, times 1.25, rounded up to 50). Threshold: every layer at or under its budget on every image of
  both corpora (36 audit frames, 300 slice 0 images).
- Prefix rebuilds at native size: R0 from L0 is a flat image at OKLab (L = p50 bin / 255, a = b = 0). R1 from
  L0 and L1: L from the 8 x 8 grid, a and b from the 4 x 4 grid. R2 from L0 to L2: chromatic, L from the
  N x N grid and a, b from the N/2 grid; achromatic, L from the 16 x 16 L8 grid and a, b from L1. Grids are
  upsampled bilinearly with the exp-resolution `bilinear` rule; OKLab goes to linear with the inverse
  Ottosson matrices and is clipped to [0, 1].
- Terms: mean CIEDE2000 over pixels (exp-resolution `de2000` on CIELAB) and SSIM on linear luma
  (exp-resolution `ssim`, sigma 1.5). Loss at step k (R(k-1) to R(k)): CIEDE2000(R(k)) - CIEDE2000(R(k-1))
  and SSIM(R(k-1)) - SSIM(R(k)).
- Thresholds per corpus and step: the upper end of the paired 95% interval of the mean loss is at most 0.5
  (CIEDE2000) and 0.02 (SSIM); no single image has a loss above 2.0 (CIEDE2000) or 0.05 (SSIM).
- Noise floor ("hold"): the packet text of every image encoded twice in Node, and the Python twin's text,
  are byte-identical (equality test), so the noise floor of every term is 0 and "hold" means a loss of
  exactly 0. Node and Python texts are compared on all 300 slice 0 images in the runner and on every tenth
  image in the test suite.

## T6. Nuisance invariance (C13, review F9)

- Corpora: the 24 art frames and the 300 slice 0 images. Nuisances: JPEG re-encode at quality 75, 85 and 95
  (PIL with its default chroma subsampling; version recorded); resize by 0.5, 0.75, 1.5 and 2 with
  `resample-int/v1` (output size max(1, round(w s)) by max(1, round(h s)), round half up); a 1-pixel shift
  right with the left column repeated. C2 probe: every pixel's float OKLab L lowered by 0.04 (colour.py
  matrices), converted back to sRGB bytes with clipping and round half to even (numpy).
- Distance per layer between the packet of the clean image and the packet of the altered image, each packet
  computed on its own image with its own branch: L0, the mean of |dp5|, |dp50|, |dp95| (L8 bins / 255) and
  |d chroma-p95| (thousandths / 1000); L1 and L2, each layer decoded to OKLab on a 32 x 32 grid (cell
  (i, j) of the grid reads cell floor(i c / 32), floor(j c / 32) of each channel grid with c cells per side;
  the achromatic L2 takes a and b from its own packet's L1), then the mean Euclidean OKLab distance over
  the 1,024 grid cells.
- Threshold: for each layer, nuisance and corpus, the median over images of (nuisance distance / C2
  distance) is at most 0.25. An image whose C2 distance is 0 enters with ratio 0 when its nuisance distance
  is 0 and infinity otherwise, and the count is reported. Achromatic flag flips under each nuisance are
  reported, not gated.
- Overlays: on every greyscale image (the 100 BBBC010 rows and every audit frame with chroma-p95 below
  0.02), a red (255, 0, 0) rectangle outline centred on the frame, its outer box at half the frame size,
  thickness chosen as the smallest integer whose pixel count reaches 2% (and 10%) of the frame (count
  recorded). Thresholds (equality tests): the L0 flag computed outside the mask on the composited image
  equals the clean image's flag; L0, L1 and L2 computed on the clean image with the overlay passed beside
  it equal the clean image's text; L3 lists the outline with `overlay:true`, its exact bbox and its area in
  thousandths. Reported, not gated: the flag on the composited image when no mask is passed.
- `resample-int/v1` has a Python twin; equality tests: Node and Python outputs are identical on 50 seeded
  images at the four scales, and scale 1 returns the input's linear values unchanged.

## T7. Task value (C12, review F1 and F21)

- Tasks (scope "in-source only"; held-out-source value needs slice 1): PBC `cell_class` (8 classes), Kather
  `tissue_class` (8), BBBC010 `condition` (2, primary for that source) and BBBC010 `channel` (2, reported:
  the two channels differ in mean intensity by construction).
- Features per layer, parsed from the Node packet text: L0 the five numbers (p5, p50, p95, chroma
  thousandths, flag); L1 the 64 L bins and 16 a, b bin pairs; L2 every bin of its branch. A parser
  round-trip (features re-encoded to the identical text) is an equality test.
- Probe: one-vs-rest ridge classifier on z-scored features (statistics from the training fold; zero-variance
  features dropped), one-hot targets, prediction by argmax. Penalty lambda = c p with p the feature count and
  c chosen inside each training fold from {1e-3, 1e-2, 1e-1, 1, 10, 100} by exact leave-one-out accuracy
  (ties go to the larger c). Outer loop: 5-fold group cross-validation (groups as in the bootstrap; group to
  fold by a seeded shuffle; PBC rows stratified by class), repeated with seeds 1 to 10; each image's score is
  its mean correctness over the 10 repeats.
- Configurations: all seven non-empty subsets of {L0, L1, L2}. Conditional value of layer X: per image,
  score(L0 to L2) - score(L0 to L2 without X); paired 95% cluster-bootstrap interval of the mean. A layer
  carries task value on a task only when the lower end is above 0. Value per 100 tokens is printed beside it
  (mean value / mean tokens of X on that source x 100).
- Controls (gate): wrong-image (every image's full feature vector replaced by another image's, a uniform
  random derangement within the source) and shuffled-layer (each layer block replaced by another image's
  block, an independent derangement per layer). Each control runs 20 draws, each draw one outer
  cross-validation with its own seed; the control's statistic is the mean accuracy over draws and its upper
  bound is the mean plus 1.96 standard deviations over sqrt(20). Threshold: the upper bound is at most the
  majority-class rate + 0.02 on every task. Single-draw Wilson intervals are reported. Reason fixed before
  measuring: at n = 100 the Wilson upper bound of one draw at the chance rate exceeds the majority rate by
  more than 2 points, so the plan's bound is applied to the mean over draws.
- Positive control (check of the check, gate): a planted block P, the one-hot label of each image with the
  label replaced by a uniform random class with probability 0.5, added to the full packet; P's conditional
  value must have a lower end above 0 on every task.
- Head-to-head (reported): the shipped `colorGridHex(px, w, h, 4, 16)` as JSON text (768 byte features)
  against the OKLab L2 alone at N = 32, and against L2 alone at N_match, the N in {8, 12, 16, 20, 24, 28, 32,
  40, 48} whose mean token count on the source is nearest the colour grid's (the achromatic branch at
  floor(N / 2) per side when the flag is set). Paired per-image score differences with cluster-bootstrap
  intervals; tokens of both printed.
<!-- prereg-track-a-t4t7:end -->

## Amendment 2 (overlay semantics, T4 and T6)

Written 2026-10-02, after pre-registration 2 was committed (497eab0) and before any T4 to T7 code or
measurement existed. Reason: pre-registration 2 contradicts itself. T4 computes L0 on pixels outside the
overlay masks; T6 requires that L0 computed on a clean image with the overlay passed beside it equals the
clean image's L0. Excluding mask pixels from a clean image can move its percentiles, so both cannot hold.
The review's intent (F9) is that layers describe the clean image and that the flag ignores drawn pixels.
Printed by `node tests/telos-track-a/prereg-hash.mjs --amendment-2`.

<!-- prereg-track-a-amend-2:start -->
## Amendment 2: `overlays_drawn`

- The v2 request gains `overlays_drawn` (boolean, default false). When false, the image is clean: L0, L1
  and L2 are computed on every pixel and the overlays appear only in L3. When true, the overlays are drawn
  in the pixels: L0 (every statistic, the flag included) is computed on pixels outside the union of the
  masks, L1 and L2 are computed on all pixels as given, and the warning `overlay_in_pixels` is emitted.
- A mask that covers every pixel with `overlays_drawn` true is rejected with `overlay_covers_frame`.
- T6 overlay thresholds read: the flag from the composited image with `overlays_drawn` true equals the
  clean image's flag; L0, L1 and L2 from the clean image with the overlay passed and `overlays_drawn` false
  equal the clean image's text; L3 as before. Everything else in pre-registration 2 is unchanged.
<!-- prereg-track-a-amend-2:end -->

## Amendment 3 (the luma histogram under the privacy scan, T4)

Written 2026-10-02, after amendment 2 (bda70d4), while writing the T4 code and before any T4 test or
measurement ran. Reason: pre-registration 2 puts a 16-bin luma histogram in the response and also refuses
any decimal list longer than 64 characters outside layer text. Sixteen counts of a frame with more than a
few thousand pixels exceed 64 characters, so the scan would refuse almost every honest response.
Printed by `node tests/telos-track-a/prereg-hash.mjs --amendment-3`.

<!-- prereg-track-a-amend-3:start -->
## Amendment 3: the histogram is a bounded summary block

- The luma histogram counts as 16 cells under the privacy bound. When floor(w h / 16) is below 16 it is
  dropped and listed with `privacy_cell_bound`.
- When emitted, its `bins` array is removed before the payload scan, as emitted layer texts are. Every
  other field is scanned as pre-registered. Thresholds are unchanged.
<!-- prereg-track-a-amend-3:end -->
