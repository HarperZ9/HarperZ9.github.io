# Studio depth: draw, watch, keep (2026-08-04)

The ask: "turn this studio into something people can spend an unlimited amount of time in —
customizing, creating, building, plotting, drawing, sketching, playing, or exporting," designed
against the operator's own inspiration corpus, not a model default.

Built as a four-agent workflow fan-out over disjoint modules (studies, sketch, replay, shelf),
wired and verified by the orchestrating session. 481k subagent tokens, all four returned green.

## Sketch — the studio learns to draw by hand

`system/sketch.js` + a full Studio source. The pointer is the instrument: strokes are captured in
sheet space (resampled, smoothed once, quantized at capture so shelf round-trips are lossless),
expanded LIVE through a symmetry — mirror, radial k, or kaleido (rotation + in-sector mirror) —
and settled into the pen surface's own mark registers on pen-up. Changing the fold after drawing
re-expands everything already drawn: that slider is the toy. Guides (iso grid, graticule, op-art
zigzag) draw as support and stay out of exports. Every sheet carries a geometry hash — the
receipt that a restored or re-shared sketch is exactly the drawing it claims to be. The drawing
crosses to the pen surface as its own material, blends with the field, exports as SVG/G-code.

Defect found live: a release outside the window left the stroke OPEN, and every later hover move
silently joined it — a 639-point phantom committed by the next pen-down. Window-level release,
blur, and visibility-loss now all lift the pen.

## Replay theatre — watching it draw is half the pleasure

`system/plot-replay.js`: any sheet flattened into true plotter execution order (pens ascending,
layer order within a pen, each layer's passes run back to back so the ink builds), stepped by
POINTS so playback is uniform in ink laid down, never in strokes. A step never crosses a pen
boundary; pen changes are announced by name, exactly pens−1 times. Scrubbing is an instant
re-run to the target progress. First cut ran a 42k-point sheet in under two seconds — a blink,
not a plot; the base rate now puts a dense sheet at ~half a minute. The letterbox transform was
extracted from renderPlotMap into `sheetTransform` so screen render and replay can never
disagree; `penIndexFor`/`passesFor` are exported so the replay, the SVG, and the G-code share
one pen model.

## G-code — the sheet as a machine program

`sheetGcode(plot)`: the same execution order the replay draws, as G21/G90 servo-pen G-code with
an **M0 program pause at every pen change** — data-pen made physical. Y-flipped to machine
coordinates, provenance in the header, byte-deterministic (tested).

## The shelf — the studio's memory, user-owned

`system/studio-shelf.js`: pins are RECIPES — seed + controls, raw strokes for a sketch, and for
a voxel build the ORDERED op log (turns and hand edits interleaved, because an edit after a turn
addresses the rotated grid; storing them as separate piles would land every pre-turn edit on the
wrong cell — schema corrected during integration, along with numeric face ids). Ids are hashes
of the canonical recipe, so re-pinning dedupes and keeps the user's rename. Persists in
localStorage, travels as versioned JSON (whole-or-nothing import, id re-derivation catches
edited files), refuses when full rather than dropping work, rolls back memory on storage
failure. No streaks, no scores: quiet, deliberately non-extractive.

## Three studies from the corpus

- **tanaka** — Tanaka's illuminated contours (1950): every contour segment weighted by its
  facing to a NW sun; lit segments thin, shade segments heavy, the near-parallel sector drops
  out so lines taper by absence. Measured: shade cells carry 1.87× the ink of lit cells. Floor
  0.888 (p33/16 seeds).
- **relief** — Jobard-Lefer evenly spaced streamlines over terrain via the image pipeline's own
  edge-tangent flow; separation carries tone (r(elevation, ink) = −0.638: valleys dense, crests
  paper). Floor 0.897.
- **zigzag** — op-art textile interference: triangle-wave strands whose phase rate and amplitude
  ride two low-frequency fields, compounding into standing interference waves; zero jitter — for
  this register exactness IS the mark. Floor 0.732.

Also fixed: scanline, horizon, and stitch never had chips (composer-only since #115).

## A defect the fan-out caught, fixed here

`contourFromLuma` accepted `opts.threshold` and IGNORED it — every call marched the same five
fixed levels. The pen surface's contour-levels knob was inert (14 requested levels were the same
5 re-traced), index contours sat exactly on minor ones, and the "coast" was nowhere near sea
level. Confirmed empirically (thresholds 51 and 229: byte-identical output). Fixed to honour an
explicit threshold on either scale (0–1 or 0–255); regression test proves the iso-line moves and
the levels knob buys real contours. Legacy five-level behaviour unchanged for callers that never
passed a threshold.

## Verification

- Node: 647 tests, 633 pass, 0 fail (14 pre-existing skips). New: sketch 14, replay 13,
  shelf 14, plus the contour regression and three auto-covered studies.
- Browser (chrome-devtools, fresh isolated contexts): sketch draw → fold slide ×6→×10
  retroactive → pin → wipe → restore with the SAME geometry hash (5eb8c436); three studies
  drawn and screenshotted; replay runs paced (94→197‰ over 3 s) with pen-change callouts and
  scrubbing; G-code 48,570 lines, 2 pauses, no NaN; shelf persists two kinds in storage and
  restores a rotated voxel build. Zero console errors.
- The operator interacted with test windows live during the build (third time this session);
  their unscripted strokes exposed the open-stroke leak above. Real hands beat synthetic
  events, again.

## Adversarial review, and what it found

The slice was reviewed by a four-lens agent panel (wiring lifecycle, determinism/receipts,
geometry/pipeline, dead-controls/honest-copy), every finding independently verified with a code
walk or a node reproduction before it counted. Fourteen findings were confirmed. All of them are
fixed here; the shelf ones matter most, because a shelf that quietly loses work is worse than no
shelf at all.

**The recipe could not hold what restore needed.**
- A voxel pin stored its resolution and knobs; restore applied neither. A build pinned at 64³
  tuned rebuilt at 48³ untuned, and the op log then replayed onto a grid where those cell
  indices meant something else. Now the whole grid identity is restored first, the replay guard
  checks it, and any op that still cannot land is **reported, not swallowed**.
- A blended sketch pinned with `sketch: null` — accepted, thumb showing the drawing, promising
  exact reproduction, reproducing nothing. A user who trusted the pin and cleared the sketch had
  lost the work.
- A sketch's mark register was stripped before hashing. `worked` is three passes and `drawn` is
  one, so the same strokes restored as a visibly different sheet.
- The pen surface's register (`auto`) was being written over the drawing's own — caught by my own
  verification pass, not the panel: the restored blend came back 24 strokes light.
- `source` was hardcoded to `"plotmaps"`, so **two different photographs hashed to the same
  recipe id** and pinning the second silently overwrote the first. Dedupe had become data loss.

**Lifecycle.** A running replay had no source guard and `setSource` never stopped it, so it kept
painting plot strokes over whatever source came next. The scrubber's fixed 20,000-point budget
overshot the requested position by most of a sheet.

**Honest surfaces.** A sketch sheet's receipt fell through to the cartography branch and
announced a study of `undefined` over a sea level of `undefined`. The fold slider sat live under
symmetries that ignore it. The density slider was visible and inert under the sketch material.
The pin remove control was a `<span>` inside a `<button>` — a creation could be pinned but never
removed without a mouse. And "Nothing you draw leaves this page" was an overclaim: connect your
own model and the canvas frame goes to the endpoint you configure. The copy now says exactly
that.

**Geometry.** `tanaka` was tracing every interior band boundary twice — an artifact of working
around the dead `threshold` option — laying double ink on four of its levels and reading as false
index contours, which defeats the study's own premise that weight alone carries the shading. With
the option honest, the levels are simply asked for; floor re-measured 0.888 → **0.883**. G-code
rounded its paper height differently from the SVG, so the two files disagreed by half a
millimetre about the same sheet.

## Boundaries

- A pinned picture/canvas material sheet cannot re-fetch its pixels (they live only in the
  moment); restore applies the rest of the recipe and says so.
- Replay end-state can differ microscopically from the static render on support layers (passes
  accumulate alpha; the static render draws each layer once). The replay is the truer picture of
  the physical plot.
- Sketch capture quantizes to 4 decimals (~0.02 mm on A4) — below any pen's repeatability.
