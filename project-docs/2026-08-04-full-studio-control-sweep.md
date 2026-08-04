# Full-studio control sweep: findings and fixes

The piecewise/stepwise method (every knob at its extremes, contact-sheet tiles, numeric
lit/colour stats per tile) applied across the Studio's sources, per the operator's directive to
assess all controls. Method receipts: the same harness that caught the atlas kernel defect.
Swept 2026-08-04 on the local checkout, fresh isolated browser contexts per source.

## Inventory

13 sources, ~29 sliders, ~45 chips, ~30 buttons (full matrix in the sweep harness output).
The per-source verdicts:

| source | verdict | notes |
|---|---|---|
| Atelier | PASS | 9/9 tiles coherent; seeds differentiate; complexity has authority |
| 2D Fractal | **3 dead presets → fixed** | see below |
| 3D Fractal | overhauled in PR #108 | mineral material, cone epsilon, dither, dual AO |
| Dimensions | **2 defects → fixed** | projection chips dead; orthoplex n=1 empty |
| Spatial | overhauled in PR #106 | kernel, measurement, source compare |
| Living neural | PASS | field evolves (frames hash-differ 2s apart); reseed changes the field |
| Seed sound | PASS | audio plays under real input, level/pitch meters live; sparse score notation is the design |
| Poster | **gap** | zero controls — no control surface at all (enhancement, not regression) |
| Bring your own / Watch / Music / Physics / Showcase | partially swept | media/capture/mic paths need real user permissions the harness cannot grant; not judged |

## Defects found and fixed here

### Three 2D-fractal presets rendered solid black

The preset sweep ran the real CPU renderer over every preset at thumbnail size:

- **Burning Ship: Hull** (cx −0.5, cy −0.5, scale 0.5) — a fully non-escaping window, 0% lit.
  Worse, it is the Burning Ship type's DEFAULT preset, so selecting the type chip showed a black
  frame and the whole type looked broken. Reframed to the ship's main body (cx −1.0, cy −0.35,
  scale 1.8; 45% lit, 35 colour bins).
- **Feigenbaum Point** (scale 1e-6) — that deep on the boundary is essentially all interior at
  any iteration budget; 0% lit. Reframed to show the period-doubling cascade the point is named
  for (scale 6e-3, maxIter 900; 69% lit).
- **Period-3 Bulb** (scale 0.005) — framed entirely INSIDE the bulb; interior renders black by
  design, so the view was solid black. Reframed to the whole bulb with boundary filaments
  (scale 0.55; 68% lit).

A preset is a claim that a view is worth looking at. The new regression test runs every preset
through the CPU renderer in node and refuses both failure directions (near-empty and
structureless), so no preset can go dark silently again.

### The Dimensions projection chips had no authority

Perspective / Orthographic / Stereographic produced pixel-identical frames: studio.js read the
chip state into `drawNDimFrame(...)` and dropped it before the render — and the render-nd
library had no projection concept to receive it anyway. The mode now reaches `embedTo3D`, where
it is the mathematical content of the control:

- **perspective** — the original iterated dist/(dist − ck) collapse (near cells grow),
- **orthographic** — higher axes dropped (uniform cells, the flat engineering read),
- **stereographic** — vertex normalized to the unit n-sphere, projected from a pole at 1.12
  (cells near the pole bloat; the conformal read).

Verified visually (three clearly distinct silhouettes on the 6-cube) and by tests: the modes
must disagree wherever a higher axis is nonzero, be the identity for n ≤ 3, and carry end to
end through `renderSceneVolumetric` (meta records the mode; over half the vertices must move
between modes at the same rotation and camera).

### The 1-orthoplex rendered as nothing

`nOrthoplexEdges` excludes antipodal pairs — correct for n ≥ 2, but at n = 1 the only vertex
pair IS antipodal, so the edge set was empty and the frame showed nothing (cube and simplex at
n = 1 both draw their segment). The 1-orthoplex is the segment [−1, 1]; its one edge is real
and now returned, with the n ≥ 2 exclusion untouched and pinned by tests.

## Enhancement gaps recorded, not taken here

- Poster has no control surface at all.
- Seed sound's score could carry a spectrum-reactive layer under the notation.
- The Atelier's palette varies little across seeds (every piece is gold-on-black; breadth, not
  correctness).
- Music/mic, Watch/capture, and BYO media paths need a human-permission sweep session.

## Verification

- 541 node tests pass (10 new: preset liveness, projection authority ×3, orthoplex edges,
  plus the existing suites), 59 python contract tests pass.
- Browser: three distinct projection silhouettes verified; all three reframed presets verified
  lit and structured through the live Studio path; Seed sound verified with real (activation-
  granting) input — synthetic clicks cannot start audio and would have misjudged the source.
