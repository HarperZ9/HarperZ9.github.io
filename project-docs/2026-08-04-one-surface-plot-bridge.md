# One surface: the plot bridge (2026-08-04)

The ask: include the published plates as plotter pieces, plot uploaded pictures, plot the voxel
builds, and cross the creative boundary into shared mediums — one rendering surface where
materials and approaches blend natively.

## Architecture: two languages, one sheet

Every medium in the Studio speaks one of two languages, and the bridge honours both instead of
flattening everything to pixels:

- **Tone fields** (`plot-image.js`): anything raster — a published plate, an upload, whatever the
  shared canvas last showed. `{ w, h, lum }`, pure, node-testable.
- **Geometry** (`plot-bridge.js`): anything constructed — a voxel build crosses over as projected
  faces and edges, never as a traced screenshot. Exact edges stay exact.

Both land in the same layer shape (`{ name, polylines, weight, tone }`), take the same mark
registers, the same pen model, the same SVG export, and the same measurement. `mergeSheets` puts
layers from different worlds on one sheet with one frame and per-part provenance.

## The image methods (`plot-image-studies.js`)

Eight, all from the plotter / NPR literature, none of them filters: flowline and engrave
(Jobard–Lefer evenly-spaced streamlines over the Kang–Lee–Chui edge-tangent flow, tone from
separation), stipple (weighted rejection + relaxation), one-path (TSP art: grid-bucketed
nearest-neighbour + windowed 2-opt), squiggle (SquiggleDraw scanlines), spiral (single-stroke
halftone spiral), contour (iso-luminance via the existing marching squares), line drawing (the
band-pass line component of XDoG, walked along the flow).

**The judge is fidelity, not taste.** `measureTone` correlates per-cell stroke length against
per-cell source ink (Pearson r, support layers excluded, zero-variance reported as 0 not 1).
"Auto" draws several methods and keeps the best-measured, and the receipt names every candidate
with its number.

## The voxel crossing (`plot-bridge.js`)

Painter-identical projection, then classic hidden-line removal against a depth raster (6 samples
per voxel edge). Abutting faces differ by 1 in ray depth, true occluders by 3+, so a 1.5
tolerance separates the regimes exactly. Edges deduplicate: drawn-once = silhouette, mixed
orientation = crease, same orientation with a tone jump = value edge, coplanar continuations
vanish — ten adjacent cube tops become one plateau outline. Walls hatch along their own axes by
the painter's lit tone (face base × baked AO × depth cue × material luminance). Partial
occlusion (a ridge hiding half a wall) is handled by clipping every stroke against the raster.

## Defects found while building

- **ETF eigenvector degeneracy.** The single algebraic form `(F, λ₁−E)` is (0,0) for any
  diagonal structure tensor — i.e. every exactly vertical or horizontal edge, the most common
  edges there are. Fix: compute both forms, keep the longer.
- **Euler drift on closed isophotes.** Straight steps along a circle of radius r drift outward
  step²/2r per step (3 px per lap at r=8), so loops spiralled and never met their own tail,
  double-inking whole annuli: 7 fat spirals where 13 rings belonged. Fix: midpoint (RK2)
  integration, as in the original paper, plus self-termination with a recency window (the
  backward half sees the forward half's far end, so a loop draws exactly once).
- **XDoG masses vs lines.** Winnemöller's absolute threshold inks every dark MASS — right for
  his stylization, wrong input for a line tracer. The line component is the band-pass term
  alone: zero in flat regions at any grey level, ink on the dark side of an edge.
- **The aspect squash.** Composed sheets lived in the unit square, were viewed square, and were
  exported at the cartographic 0.75 paper — every published SVG of a composed sheet was missing
  a quarter of its height, and the screen stretched cartographic sheets by a third. Sheets now
  carry `meta.aspect` (1 for composed, 0.75 for cartographic, the picture's own ratio for image
  plots, the drawing's bbox for voxel plots); the canvas letterboxes to it and returns the
  visible rect, published as the measurement content rect. Screen, measurement, and file agree
  by construction. Node-tested.

## Studio wiring

Material chips (Field / Plate / Picture / Studio canvas / Voxel build), method chips for
tone-field materials, blend chips (Alone / Field under / Field over), plate picker fed from
`atlas.world.json`, "Plot it" crossover button in the Voxels panel. The canvas material
snapshots the outgoing frame at source-switch; a released GPU buffer captures as flat black,
which is detected by tonal span and refused with an honest message instead of plotted.
Uploaded pictures never leave the page.

## Verification

- Node: 605 tests, 591 pass, 0 fail (14 pre-existing skips). New suites: plot-image (9),
  plot-image-studies (6), plot-bridge (5), plus the aspect receipt in plot-maps.
- Browser (chrome-devtools, isolated context): field sheet regression ✓; plate scene-01 →
  1,073 strokes, tone r 0.883, portrait rect 614×768 (aspect 1.25 ✓); voxel relic 7,577 voxels →
  6,384-stroke hidden-line drawing via the crossover button ✓; canvas capture of a live Atelier
  frame → 566 strokes, r 0.55 ✓. Zero console errors.
- Operator, live and unprompted, in the Playwright window during the build: uploaded their own
  picture → squiggle at r 0.922; blended a plate with the field at laboured register. The
  controls were found and used without instruction.

## Boundaries, said plainly

- Tone correlation measures WHERE ink lands, not whether a drawing is good; busy generative
  frames legitimately score ~0.5.
- The depth raster resolves occlusion to 1/6 voxel edge; sub-sample slivers can survive.
- Capturing a WebGL source depends on the buffer surviving the source switch; when it does not,
  the surface says so and refuses.
- The blend maps the field's unit square onto the material's aspect; mild anisotropy for the
  field layer is accepted and disclosed rather than resampled away.
