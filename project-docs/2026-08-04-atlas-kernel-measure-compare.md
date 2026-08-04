# The Atlas: kernel faithfulness, artwork-box measurement, live source compare

Answers two operator reports: "move the actual object that is rendered, you will see the quality
is weird, and the measurements are inaccurate," and the request to bring the source images live
for compare and contrast. All figures measured 2026-08-04 against scene-19 (the corpus's most
saturated source) unless stated. Screenshots and probes ran on the local checkout through
chrome-devtools; the reference is `Native_Gaussian_Splat_Atlas_v0.5.0_Standalone.html` in
Downloads, the artifact of record the scenes were extracted from.

## 1. The motion defect: the port rendered a different kernel than the scenes were trained under

One drag reproduced it: at yaw 0.55 the artwork bloomed into a white, smeared sheet with all
structure gone. Working through the candidates in order:

- **Angular support gating?** No. `vMeta.x` (the per-splat angular-support channel) reaches the
  fragment shader unused in our port — and extracting the reference's shaders shows IT does not
  gate by it either; there it only feeds the "support heat" visualization. Both renderers draw
  every splat from every angle. Not the divergence.
- **Blend mode?** No. Both use premultiplied `ONE, ONE_MINUS_SRC_ALPHA`.
- **Fat z-axes in the data?** No. Measured across scene-19's 26,536 records: the z (normal-axis)
  scale is 18-25% of the in-plane scale — thin surfels. The full-covariance z term is negligible.
- **The kernel.** Yes. The reference cuts each splat's quad at ONE stored axis length with an
  `exp(-3.7 r^2)` falloff and a 0.008 discard. Our port drew quads at 3 sigma times splatScale
  1.12 (= 3.36 sigma) — the "complete" Gaussian with tails. That is ~9x the per-splat area, so
  every ray crossed deep stacks of overlapping tails, and alpha-over across misaligned stacks
  cross-mixes colour: frontally it read as blur and washed chroma; obliquely, where front and
  back splats mix along each ray, it whited out entirely.

The discriminating experiment needed no code: setting splatScale to 0.37 makes the shipped
shader's kernel `exp(-4.5 (d/1.1σ)^2) = exp(-3.7 (d/σ)^2)` — the reference kernel almost
exactly. At the same oblique view the white smear vanished and the structure returned, matching
the reference's pointillist character. The forward model the scenes were trained under is the
look; textbook completeness re-renders them through a kernel they were never optimized for.

**Shipped:** quad extent = one sigma × splatScale (default 1.0), falloff `exp(-3.7 r^2)`,
discard 0.008, controls opacity 0.92 / exposure 1.0 / gamma 2.2 — the reference's values,
verbatim (`ATLAS_DEFAULT_CONTROLS`). The EWA projection, the 0.3px anti-scintillation dilation,
the full-covariance warp handling, the uEye view response, and the per-frame sorting from
PR #101 all stay: they fix real defects and are kernel-independent. Tests hold every kernel
constant still.

The earlier defaults (splatScale 1.12, exposure 1.18, PR #95) were tuned frontally to give the
3-sigma kernel "presence" — compensations for the wrong kernel, withdrawn with it.

### What the colour measurements say now

| scene-19, mean over the artwork box | saturation | luminance |
|---|---|---|
| source derivative | 63.0 | 133.4 |
| reference standalone (screenshot crop) | 19.9 | 80.1 |
| our port, 3.36-sigma kernel (before) | 25.8 | 99.4 |
| our port, reference kernel, lit pixels only | keeps 39% of source | keeps 76% of source |

The reconstruction's chroma loss against the source is in the reference renderer too — it is
the training/density ceiling (S7), not a port defect. Note the trap in the "before" row: the
washed kernel scored HIGHER on mean saturation than the faithful one, because blur smears colour
into the gaps that honest stipple leaves black. A mean over a sparse field rewards exactly the
wrong thing; coverage has to be reported separately (below).

## 2. The measurement defect: the panel described the letterbox, not the artwork

A portrait artwork in the wide canvas measured as `wide (1.80:1)`, "dominated by near-black"
(74% swatch), hash of mostly letterbox. True of the pixels, false of the piece.

**Shipped:** a content-rect contract. The atlas projects its splat AABB through the live
view/projection each frame (`projectAabbRect`, pure and node-tested) and publishes it at
`window.__studioContentRect`; every measurement surface — `perceive()`, the 12Hz live loop, the
no-vision perception detail — crops to it when present. The panel now reads `795×881 artwork
box`, orientation `square (0.90:1)` (the box carries the relief's depth; the flat plane is
0.80:1), and dominant colours over the artwork. Sources that fill the frame publish nothing and
measure exactly as before; the rect is withdrawn on stop, verified by switching to the 2D
fractal (`2779×1550, wide (1.79:1)` again).

## 3. Live compare and contrast, as asked

The source derivatives already ship beside every model (`source_preview` in the manifest), so
this is alignment, not new assets. The Atlas panel gains a **Source compare** control:

- **Curtain** — the source clipped at the mix slider's position over the reconstruction.
- **Overlay** — the source cross-faded by the slider.
- Alignment projects the picture plane (XY extent at z=0), not the depth-inflated box, so the
  source sits at its true aspect (measured 0.802 vs 0.800) over its own reconstruction.
- A divergence note updates ~1Hz, measured over the artwork box, lit pixels only for the
  render: "covers 82% · lit pixels keep 39% of the source's saturation, 76% of its luminance.
  The gap is the density ceiling, disclosed, not hidden."

The layer is pointer-transparent (orbit and dolly keep working under it), atlas-only, taken
down on world switch and source stop. Scene changes also fire a settled `perceive()` so the
Live Perception column carries the new scene's hash instead of a stale dash.

## 4. Verification

- 531 node tests pass (6 new: four kernel-faithfulness locks, three `projectAabbRect`
  geometry/degeneracy cases), 59 python contract tests pass.
- Browser, fresh isolated contexts: oblique view holds structure at the reference kernel;
  compare curtain aligns at source aspect; measurement reads the artwork box on the atlas and
  the full frame on the fractal; no console errors.
- Sitewide `system.css?v=` bumped (33 pages) for the compare-layer styles.

## Open

- S7 asset density is still the visible ceiling and still an operator call (provenance:
  regenerating scenes from derivatives moves them from extracted to derived).
- The reference standalone's richer instrumentation (visualization modes: support heat,
  importance, view response, depth bands; splat inspector; camera presets) is worth porting into
  the Studio's atlas panel — folded into the full-studio controls pass.
