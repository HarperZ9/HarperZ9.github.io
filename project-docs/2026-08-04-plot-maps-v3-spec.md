# plot-maps v3 spec: plotter-community research, applied

Five research lanes run live 2026-08-04 (plotter community technique, generative cartography,
multi-pass and material simulation, impossible geometry and op-art, self-generating systems),
each source-linked, then synthesized against the operator's own reference corpus gathered from
their reddit upvotes and twitter likes the same day.

The verdict section below is a critique of code written earlier in this same session. It is kept
verbatim rather than softened, because the defects it names are real and several are fixed in the
commit that lands this document.

Lane coverage: plotter-art community technique (r/PlotterArt, AxiDraw/vpype/vsketch ecosystem, artist writeups) (14), generative cartography beyond contours (13), multi-pass and material simulation for pen/ink line art (14), impossible geometry, op-art, and structural pattern for line output (14), self-generating and self-varying systems (14)

# plot-maps v3 implementation spec

Target tree: `C:\dev\public\portfolio-site\system\`. Tracked at HEAD: `plot-maps.js` (307 lines, 4 studies), `plotter.js`, `plot-maps.test.mjs`, wired into `studio.js` at lines 101-105, 756-777, 808-809, 852-856. Untracked and already in flight on disk: `plot-studies.js` (7 studies: basin, moire, lattice, strata, monolith, nomogram, orbital), `plot-marks.js` (jitter, multiPass, stipple, hatchFollows, dashed, spiralFill, clipLines), `plot-compose.js` (grammar + `measureSheet` + re-roll). This spec assumes those three land and specifies what comes after them. Where it says "fix", the defect is in code I read, with line numbers.

---

## 1. THE VERDICT

The sheet is geometrically correct and materially dead. Everything descends from one isotropic fBm field (`elevationField`, plot-maps.js:59), and isotropic fBm thresholded at N levels is cloud blobs, not landform: no drainage, no directional grain, no coast worth decorating, so `contourFromLuma` gets called `levels` times over the same buffer (plot-maps.js:226-230) to produce concentric rings that say nothing. Tone does not exist: every layer is one pass at uniform spacing, and `plotMapSVG` encodes weight as `stroke-width = weight * 0.35` (plot-maps.js:300), which is the single most un-plotter line in the file, because a pen has exactly one width and the machine cannot honor a number that says otherwise. The export is called plotter-grade but does none of what the ecosystem means by that: no linemerge, no reloop, no simplify, `orderPaths` is greedy nearest-endpoint with no two-opt (plotter.js:229), and every layer's paths are concatenated into one giant `d` attribute so downstream tools cannot address a path. Both clippers drop out-of-box vertices instead of intersecting the boundary (plot-maps.js:178, plot-marks.js:193), so every study has a ragged margin up to one sample step wide instead of a clean edge. The graticule emits roughly 200 two-point polylines where four would do (plot-maps.js:155-159) and each sounding is two separate strokes sharing an endpoint (plot-maps.js:172), which is pen-lift waste on the one axis a plotter charges you for. The new composer is a real improvement but its grammar is `pick(rng, studyKeys)` with no conditioning and no layer stack (plot-compose.js:199-203), its register applies the same pass count to every stroke on the sheet rather than putting ink where the field is dark (plot-compose.js:167-180), and it threads one shared `rng` through study, register, and furniture in sequence, so changing how many random draws a study makes silently changes the furniture of every seed. Nothing on the sheet can say its own name: no single-stroke type, so the cartouche is deliberately empty (plot-compose.js:143-157), which is honest and also the reason the sheets read as texture studies rather than plates.

---

## 2. NEW STUDIES

Ranked by payoff per effort. Each names the module functions it needs. All coordinates stay normalized `[0,1]`, all return `{ layers:[{name, polylines, pen, tone, passes}], meta }` (note the new `pen` and `passes` fields, section 5).

### Rank 1. `scanline` (S)
Modulated-amplitude relief scanlines. SquiggleDraw family: one polyline per row, amplitude and frequency both driven by local tone (https://github.com/evil-mad/SquiggleDraw, https://mattwidmann.net/notes/plotting-raster-images/).

- Depends on: new `hillshade()` in plot-field.js; nothing else.
- Layers: `scan` (ink, 1 pen), optional `horizon` (support), `frame`.
- Algorithm: for row j of R rows at y = M + j·(1-2M)/R, walk x from M to 1-M in steps dx = 0.0015. Carry phase `φ += 2π·f(x,y)·dx`. Emit `[x, y + A(x,y)·sin(φ)]`.
  - `t = 1 - hillshade(x,y)` (0 light, 1 dark)
  - `A = A0 · t^1.3`, A0 = rowPitch·0.45 (so adjacent rows never collide)
  - `f = f0 · (1 + 2.2·t)`, f0 = 55 cycles per sheet width
- Parameters: `R` 90..150 (seeded), light azimuth 315°, altitude 35°, `A0` clamp 0.0035.
- Serves: outrun horizon lines and cassette-futurism oscilloscope in one move, with tone strictly from line density. Highest ratio on the list: about 60 lines of code, a completely new-looking sheet.

### Rank 2. `tanaka` (S)
Illuminated contours plus slope hachures, two pen groups (Tanaka 1950; Kennelly and Kimerling, *Cartographic Perspectives* 37, 2000, https://mbmg.mtech.edu/pdf/gis_hachuretxt.pdf; modification paper https://www.tandfonline.com/doi/abs/10.1559/152304001782173709).

- Depends on: existing `contourFromLuma`; new `splitByIllumination()`; `hatchFollows` for the hachure pass.
- Layers: `contour-lit` (pen 1, light), `contour-shadow` (pen 0, dark, `passes: 2`), `hachure` (pen 0, `tone: support`), `frame`.
- Algorithm: extract contours as today, then split every polyline at segment granularity. For segment with tangent `T`, downhill normal `N = rot90(T)` chosen to point downslope: `w = cos(azimuth(N) - azimuth(light))`. `w > 0.15` goes to `contour-lit`, `w < -0.15` to `contour-shadow` with `passes = 1 + round(2·|w|)`, the band between stays in a third thin group. Split points must be re-chained (`chainSegments` in plotter.js:174 already does this) so each output is a run, not per-segment confetti.
- Hachures: aggregate the field 3x by mean before computing slope (Kennelly's legibility rule), drop any point with slope < 2°, bin remaining slope at 4.6° and 7.2° into pass counts 1/2/3, stroke length 0.012..0.024 along steepest descent.
- Serves: verdict-only two-pen light/dark on toned ground, one hot mark, real cartography rather than decoration.

### Rank 3. `stitch` (S)
Hitomezashi sashiko field (Defant and Krattenthaler, arXiv 2201.03461, https://arxiv.org/pdf/2201.03461).

- Depends on: nothing outside a bit source; `chainStaircase()` helper.
- Layers: `stitch` (ink), optional `loops` (accent pen for closed loops, one hot mark), `frame`.
- Algorithm: grid of `n × m` cells, n = 48..96 seeded. Column bits `v[i]` and row bits `h[j]` taken from the seed string itself: `v[i] = (hash32(seed+"|v"+i) & 1)`. Along vertical line i draw unit dashes on cells whose parity matches `v[i]`; same horizontally. Then chain collinear and corner-adjacent dashes into staircase polylines: a mandatory step, otherwise the study emits ~10k two-point strokes and destroys plot time.
- Variant knob: modulate dash length by `0.7 + 0.6·field(x,y)` for a terrain-warped textile.
- Serves: op-art textile repeat, literally a stitch pattern, and text-seedable ("type a phrase, get a sheet") which fits the seed-string contract already in place.

### Rank 4. `horizon` (S)
Outrun perspective grid with a scanline sun, built entirely from polylines.

- Depends on: `scanline` amplitude code; `occlude()` (section 5) for the sun behind the ridge.
- Layers: `sun-scan` (accent pen, horizontal bars whose length follows a circle and whose pitch widens downward), `grid-depth` (support: verticals converging to a vanishing point), `grid-cross` (support: horizontals at `y = yh + k/(N-i)` so spacing compresses toward the horizon), `ridge` (ink: the existing `ridgelines()` used as an occluding silhouette), `frame`.
- Parameters: horizon at y = 0.42 ± 0.06, vanishing point x = 0.5 ± 0.12, 24..40 depth lines, cross-line law `y_i = yh + (1-yh)·(i/N)^2.2`.
- Serves: the synthwave signal directly, with the two-pen magenta/cyan separation coming free from the pen model.

### Rank 5. `relief` (M)
Evenly spaced streamline hachures at variable density (Jobard and Lefer 1997, https://www.semanticscholar.org/paper/Creating-Evenly-Spaced-Streamlines-of-Arbitrary-Jobard-Lefer/8b15ba829f82787a92c97026d41a925e9d33a027; plotter framing at https://volzo.de/posts/hatching-hachures-contours/, which is conceptual only and gives no parameters, so the numbers below are this spec's).

- Depends on: new `evenStreamlines(fieldAngle, dsepAt, opts)` in plot-marks.js, plus a uniform-grid spatial hash of cell size `dsep_max`.
- Layers: `relief` (ink), `contour-index` (ink, every 5th level), `frame`.
- Algorithm: RK2 integration of `angle = perp(grad)` for contour-parallel texture, or `grad` for hachures (seeded choice). Kill a streamline when it comes within `dtest = 0.5·dsep(x)` of any laid vertex. Seed new candidates at `±dsep` perpendicular to finished lines, FIFO queue.
- Variable density: `dsep(x,y) = dsepMin + (dsepMax - dsepMin)·hillshade(x,y)`, `dsepMin = 1.2·penWidth` in sheet units, `dsepMax = 8·penWidth`. This is the whole tone system for the study.
- Serves: CFD/LES flow visualization grounded in terrain, and Giger single-pen tonal range without a fill anywhere. It is also the engine that should replace the ad-hoc `hatchFollows` sampling inside `strata` and `basin`.

### Rank 6. `plate` (M)
Technical-sheet collage: partitioned panels with per-cell decorators, marginalia, and a lettered title block (Gachadoat's decorator model, https://www.rightclicksave.com/article/the-power-of-the-plotter-generative-art-aleksandra-jovanic-julien-gachadoat-feral-file-graph-interview; Fogleman's marginalia and Hershey labels, https://www.michaelfogleman.com/plotter/; Hershey format, https://www.evilmadscientist.com/2011/hershey-text-an-inkscape-extension-for-engraving-fonts/).

- Depends on: new `plot-hershey.js` (simplex glyph table inlined, roughly 6 KB of coordinate strings, no network), `partition()` (Voronoi from seeded peaks or a 3x4 grid with seeded merges), and the decorator registry.
- Layers: `panels` (ink, cell outlines), `decor-*` (one layer per decorator family so pens can differ), `margin-hist` (support: histogram of the elevation field, 32 bins, drawn as a step polyline), `margin-quartile` (support: per-row elevation quartile sparklines), `title` (ink, Hershey), `frame`.
- Decorators, chosen per cell by mean elevation and area: parallel hatch at `angle = f(cellIndex)`, concentric inset rings, zigzag single-stroke, dash field, spiral fill, contour fragment.
- Title block content: seed string, study name, pen list, stroke count, ink length in mm, date. All values the generator already knows.
- Serves: the archival technical sheet and cassette-futurism panel layout more directly than anything else on the list. Blocked only by needing Hershey first.

### Rank 7. `truchet` (M)
Multi-scale winged-arc Truchet (Carlson, Bridges 2018, https://christophercarlson.com/portfolio/multi-scale-truchet-patterns/).

- Depends on: quadtree subdivision driven by `field`, arc-chaining into long polylines.
- Layers: `arcs` (ink), `arcs-fine` (second pen at the two smallest scales), `frame`.
- Algorithm: quadtree over the sheet, subdivide cell with probability `p = 0.15 + 0.7·|∇field|` capped at depth 4. Each leaf gets a seeded orientation from the tile set; arcs are quarter circles of radius `s/2` with contact points at the 1/3 and 2/3 marks of each edge so half-scale children join their parents exactly. Chain arcs sharing endpoints into continuous strokes before export.
- Serves: op-art repeat at distance, biomechanical density up close, and it composes with the cartography because the quadtree is terrain-driven.

### Rank 8. `diffusion` (M)
Gray-Scott reaction-diffusion contoured with the existing marching squares (https://github.com/jasonwebb/morphogenesis-resources).

- Depends on: `contourFromLuma` (unchanged), a Float32 grid pair.
- Layers: `iso-1..iso-5` (one per threshold, ascending pass count 1,1,2,2,3 for the 12-pass banded look), `frame`.
- Parameters: `dA=1.0, dB=0.5, dt=1.0`, grid 256², 3000 iterations fixed, seeded initial B blobs. Morphology by seeded choice of `(f,k)`: coral `(0.037, 0.060)`, mitosis `(0.0545, 0.062)`, U-skate `(0.029, 0.057)`. Spatially modulate `k` by `k0 + 0.004·field(x,y)` to fuse organism and terrain. Confidence on the exact Pearson parameter triples: moderate, they are standard-literature values and should be verified visually against the first contact sheet.
- Serves: Giger biomechanical crosshatch density and the r/PlotterArt layered-band plot, using code already in the repo.

### Rank 9. `meander` (L)
Fisk-style historical meander belt: run channel migration for N epochs and plot every epoch (Turner, https://heredragonsabound.blogspot.com/2020/07/a-meandering-subject.html, 2020-07-06; Hodgin, https://roberthodgin.com/project/meander).

- Depends on: `basin()` for the initial channel, Menger curvature, self-intersection detection.
- Layers: `epoch-0..epoch-K` (K = 5..8, ascending pen weight, oldest lightest), `oxbows` (accent pen), `plots` (Voronoi land parcels snapped to channel geometry), `frame`.
- Algorithm per iteration: for each point compute Menger curvature `c` over the 3-point neighborhood, clamp to `[0, cMax]`, displace by `0.75·bitangent·c + 0.25·tangent·drift`, resample to uniform spacing, then detect near-self-contact within `2·spacing` and cut the loop out as a closed oxbow. Taper migration to zero over the last 15% of the channel near the mouth.
- Serves: the strongest single match to archival-technical-sheet plus multi-pass tone, since here pass count is literally geologic time.

### Rank 10. `tour` (L)
Weighted Voronoi stipple relaxed against hillshade, then connected into one continuous TSP tour (Secord NPAR 2002, https://www.cs.ubc.ca/labs/imager/tr/2002/secord2002b/secord.2002b.pdf; StippleGen, https://www.evilmadscientist.com/2012/stipplegen-weighted-voronoi-stippling-and-tsp-paths-in-processing/).

- Depends on: replacing the grid-relaxation shortcut in `stipple()` (plot-marks.js:82-102) with real Lloyd iterations on a rasterized Voronoi (jump-flood on a 512² Int32 buffer is enough and stays deterministic).
- Layers: `tour` (ink, exactly one polyline), `frame`.
- Parameters: 6000..12000 points, 25 Lloyd iterations, density `ρ = 1 - hillshade`, then greedy nearest-neighbour tour plus 2-opt with a fixed iteration cap (not a wall-clock budget, which would break determinism): `40 · n` improvement attempts.
- Serves: the whole sheet as one unbroken line, single-pen full tonal range, the purest statement of the no-fill constraint. Effort is high because 2-opt on 10k nodes needs a neighbour-list restriction (only consider the 12 nearest) to run in the browser.

---

## 3. SELF-GENERATION

Replaces `composeSheet` in plot-compose.js. Four mechanisms, in order of execution.

### 3.1 Independent seed channels (fix first)
Today one `rng` is threaded through study build, register, and furniture (plot-compose.js:198-211), so furniture depends on how many draws a study happened to make. Replace with:

```js
const chan = (seed, name) => mulberry(hash32(`${seed}\u0000${name}`));
// chan(s,"field"), chan(s,"grammar"), chan(s,"study#2"), chan(s,"register"),
// chan(s,"furniture"), chan(s,"pens"), chan(s,"accent"), chan(s,"marks")
```
Every generator takes its own channel. Changing a study's internal draw count then cannot move any other layer. Add a test asserting that adding a `rng()` call inside `lattice` leaves `frame` geometry byte-identical.

### 3.2 The grammar
A weighted context-free expansion, expanded with `chan(seed,"grammar")`. Productions, with conditioning:

```
SHEET   -> GROUND FIGURE? OVERLAY{0,2} FURNITURE MARGIN?
GROUND  -> relief .18 | scanline .14 | strata .12 | truchet .10 | stitch .10
         | diffusion .10 | moire .08 | nomogram .08 | orbital .06 | none .04
FIGURE  -> monolith .30 | lattice .25 | basin .25 | tour .10 | none .10
OVERLAY -> contour-index .25 | graticule .20 | soundings .12 | hachure .15
         | route .10 | spot-heights .10 | none .08
FURNITURE -> frame{plain .5|double .2|ticked .3} + cartouche? .5 + registration
MARGIN  -> hist+quartiles .35 | none .65
```
Conditioning rules, applied as weight multipliers before sampling:
- `GROUND = orbital or tour` forces `FIGURE = none` and zeroes all OVERLAY except `graticule` (a single continuous trace must not be crowded).
- `GROUND ∈ {relief, scanline, strata, diffusion}` triples the weight of `contour-index` and doubles `hachure`.
- `FIGURE = basin` forces `OVERLAY` to include `spot-heights` with p 0.6 and zeroes `moire`-family grounds.
- `GROUND = stitch or truchet` zeroes `FIGURE` unless the figure is `lattice` (both are lattice logic).
- At most one layer may carry `pen: accent`. The grammar assigns it to `FIGURE` if present, else to the highest-`passes` overlay.

Composition, not just selection: when `GROUND` and `FIGURE` are both present, the figure's silhouette is fed to `occlude(groundLines, silhouette, {keepHidden: true})` and the hidden fragments go to a `ghost` pen group (occult `-k` semantics, https://github.com/LoicGoulefert/occult). That single step is what turns two studies stacked into one composed sheet.

### 3.3 The metric (measureSheet v2)
Keep the four existing measures and the geometric-mean score (plot-compose.js:102, the veto property is correct), with three fixes and four additions. All measured on geometry, no raster, so it still runs in node.

Fixes:
1. `coverage` occupancy test is `cells[i] > total·1e-4` (plot-compose.js:83), which one stray stroke satisfies. Change to an absolute ink threshold: a cell counts as visited when it holds more than `0.15 mm` of line at the target sheet size.
2. `scale` uses per-polyline total length (plot-compose.js:88-95), so a study that emits many short dashes (dashed graticule, stipple, stitch before chaining) is scored as machine-uniform. Measure segment lengths, not polyline totals, and compute `p90/p10` over segments.
3. Compute all lengths in mm at the target sheet width so thresholds are physical, not normalized.

Additions:
4. `inkMm`: total path length in mm. Reject `< 2000` or `> 90000` on A4 (a 0.3 mm pen laying 90 m on A4 is a saturated mat, and roughly 8 minutes of plot time at 200 mm/s draw speed per 10 m).
5. `travelRatio`: pen-up mm over pen-down mm after `linesort`. Reject `> 0.45`. This is the measure that catches unchained dash fields.
6. `focal`: blur the 24×24 ink grid with a 3×3 box, then `max / mean`. Reject `< 1.9`, which is the numeric form of "this sheet has no subject". This is the measure the current metric is missing entirely, and the reason sheets read as texture.
7. `structure`: compression-progress proxy (Schmidhuber, https://arxiv.org/abs/0812.4360). Quantize every vertex to 0.1 mm, delta-encode along each path, concatenate to a byte stream, run a 150-line LZ77 with a 4 KB window, take `ratio = compressed/raw`. Accept the band `0.10 ≤ ratio ≤ 0.60`. Below is a repetitive grid, above is unstructured scribble.

Score stays the geometric mean of `coverage · spread · scale · direction`, now with `focal` folded in as a fifth factor and the exponent changed to `1/5`. Recalibrate the bar against a fresh contact sheet: the current 0.52 was calibrated against seven studies on 2026-08-04 (plot-compose.js:99-101) and will not survive the new factor.

### 3.4 Re-roll policy
```
for k in 0..11:
  rngs      = channels(seed + "#" + k)
  sketch    = buildSketch(grammar(rngs), res: 64)      // cheap, no marks, no passes
  if noveltyDistance(signature(sketch), ARCHIVE) < 0.18: continue   // too familiar
  sheet     = buildFull(...)
  m         = measureSheet(sheet)
  if hardReject(m): continue
  bar       = 0.52 - 0.02 * max(0, k - 5)              // documented relaxation
  if m.score >= bar: return accept(sheet, cleared: true, tried: k+1)
return accept(bestSoFar, cleared: false, ...)          // and say so in meta, as today
```
- `hardReject`: `coverage < 0.12 || coverage > 0.985 || spread < 0.16 || focal < 1.9 || travelRatio > 0.45 || inkMm` outside band.
- `signature(sketch)`: 16-value vector = 8×8 ink grid downsampled to 4×4 (16 values), L2-normalized. `ARCHIVE` is a committed static table of ~64 signatures, one per known accepted look, generated offline by the contact-sheet tool and checked in as JSON in a `.js` module (no build step, no network). This is the online half of novelty search (Lehman and Stanley, https://www.cs.swarthmore.edu/~meeden/DevelopmentalRobotics/lehman_ecj11.pdf).
- Determinism is preserved: the candidate sequence, the sketch, the archive, and the acceptance are all functions of the seed string plus committed data.

### 3.5 Contact-sheet mode (the QA loop)
`renderContactSheet(baseSeed, n = 64, cols = 8)` renders `hash(baseSeed, i)` thumbnails at 180 px with a one-line stat readout per cell (`score`, `inkMm`, `focal`, `study/register`, `cleared`). Dev-only page, no route from the public nav. This is the Hobbs long-form loop: generate the set, find the worst, and turn each weak seed into either a new hard reject or a grammar weight change (https://www.tylerxhobbs.com/words/the-rise-of-long-form-generative-art). Do not add elements for variety; vary structure inside the cartographic frame.

---

## 4. MATERIAL

Units below are millimetres on a 210 mm sheet; normalized units are `mm / 210`.

### 4.1 Replace the hand model
`jitter` (plot-marks.js:26-46) uses a single sinusoid per line, so a long stroke reads as a wave, not a hand. Replace with 1D fBm along arclength plus an endpoint taper:

```
s      = arclength from start, in mm
w(s)   = A · Σ_{k=0..3} 2^-k · noise1(seed_k + s · f0 · 2^k)     // f0 = 1/35 per mm
tr(s)  = T · (rand() - 0.5) · 2
taper  = smoothstep(0, 2mm, s) · smoothstep(0, 2mm, L - s)
offset = normal(s) · (w(s) + tr(s)) · taper
```
- Clean register: `A = 0.05 mm, T = 0.01 mm`
- Drawn: `A = 0.30 mm, T = 0.05 mm`
- Worked: `A = 0.28 mm, T = 0.06 mm`
- Laboured: `A = 0.42 mm, T = 0.08 mm`

The taper matters: without it, two chained paths that shared an endpoint before jitter no longer meet, and `linemerge` can no longer join them.

### 4.2 Multi-pass
`multiPass` (plot-marks.js:52-62) offsets perpendicular only, which is the flaw tldraw names in its own engine (https://tldraw.dev/blog/engineering-imperfection-with-draw-shapes): offsets should come from a disc, not a line. Pass `p` of `n`:
```
θ_p = 2π · halton(p, 2)      // deterministic, well spread
r_p = 0.12mm · sqrt(p)
offset_p = (r_p·cos θ_p, r_p·sin θ_p) applied as a whole-line translation,
           plus an independent jitter draw at A_p = A · 0.5
direction alternates per pass (keep the existing reversal, plot-marks.js:58)
```
Passes are separate SVG groups labelled with the pass index, never a thicker stroke.

### 4.3 Tone by density, calibrated
Coverage for `n` parallel-hatch passes of pen width `w` at spacing `s`, and for crosshatch at two spacings:
```
C_parallel  = 1 - (1 - w/s)^n
C_cross     = 1 - (1 - w/s1)(1 - w/s2)
s(C, n, w)  = w / (1 - (1 - C)^(1/n))
```
Committed LUT for `w = 0.3 mm`, `n = 1` (mm spacing): `C 0.1 -> 3.00`, `0.2 -> 1.50`, `0.3 -> 1.00`, `0.4 -> 0.75`, `0.5 -> 0.60`, `0.6 -> 0.50`, `0.7 -> 0.43`, `0.8 -> 0.375`, `0.9 -> 0.333`. Floor at `1.1·w = 0.33 mm`; below that the pen bleeds into a solid and the sheet is no longer line art. Every study routes tone through this one table (CMU 60-428 calibration method, https://courses.ideate.cmu.edu/60-428/f2021/index.html%3Fp=823.html).

### 4.4 Hatch follows form
```
grad   = (∂e/∂x, ∂e/∂y) by central difference on the field
normal = normalize(-grad.x·kx, -grad.y·ky, 1)        // kx,ky = vertical exaggeration ~2.5
light  = (cos(alt)·cos(az), cos(alt)·sin(az), sin(alt))    // az 315°, alt 35°
hillshade = max(0, dot(normal, light))
hatchAngle(x,y) = atan2(grad.y, grad.x) + π/2        // contour-parallel, engraving logic
tone(x,y)       = 1 - hillshade(x,y)
spacing(x,y)    = LUT(tone(x,y))
```
This one block replaces the ad-hoc `dens`/`flow` closures in `strata` (plot-studies.js:186-190) and `basin` (plot-studies.js:79-94), which currently invent their own tone curves per study and therefore never agree.

### 4.5 Screen angles
Per-pen hatch angles from `{15°, 75°, 0°, 45°}` in pen order, minimum 30° apart, the print-industry rule. Deliberate violation is a study parameter, not an accident: `moire` sets the second family 2°..3° off the first, where fringe spacing is `D = p / (2·sin(α/2)) ≈ p/α`, and `nomogram` uses a pitch beat `p` vs `p+Δp` with fringe period `p²/Δp` (https://en.wikipedia.org/wiki/Moir%C3%A9_pattern).

### 4.6 Watercolour and marker behaviours, faked with lines only
From the Curtis et al. mechanism list (https://grail.cs.washington.edu/projects/watercolor/), each reduced to polyline operations:
- Edge darkening: for any toned region, add one extra outline pass and multiply hatch spacing by 0.7 within a 2.5 mm inner band.
- Granulation: reuse the fBm field as a paper height map; drop a dash of length 0.6..1.4 mm with probability `0.35 · clamp((paper - 0.5)·2, 0, 1)`.
- Backrun: displace hatch endpoints along a fingered boundary, `r(θ) = r0·(1 + 0.18·noise1(3θ))`, leaving an unhatched halo inside.
- Glazing: independent hatch layers in separate pen passes, each rotated 30°, tone accumulating by superposition (the LUT already predicts the result).
- Depletion: preview alpha `= clamp(1 - distSinceRefill/L, 0.35, 1)`, `L = 900 mm` fineliner, `L = 250 mm` marker. Preview only; it must not change geometry.

---

## 5. PLOTTER TRUTH

### 5.1 Pen model (new, replaces `weight`)
```js
{ index: 0, label: "ink", widthMm: 0.3, colorHint: "#111", angleDeg: 15 }
```
Layers carry `pen` (index into a sheet-level pen table) and `passes` (integer). `weight` is deleted from the export path. `stroke-width` in SVG is always `pen.widthMm` and never a tone signal. Canvas preview may still use `passes` and depletion for alpha, since the screen is allowed to lie about ink and the machine is not.

### 5.2 Export pipeline
Run in this order, replicating vpype semantics verified at https://vpype.readthedocs.io/en/latest/reference.html:
1. `linemerge(tol = 0.05 mm, allowReverse = true)` per pen layer.
2. `linesort()` greedy nearest-endpoint (existing `orderPaths`, plotter.js:229) then bounded 2-opt: `min(20000, 25·n)` improvement attempts, fixed iteration count for determinism.
3. `reloop(tol = 0.05 mm)`: rotate closed-path start points to a seeded position so pen-down blobs do not stack on one seam.
4. `linesimplify(tol = 0.05 mm)`: Ramer-Douglas-Peucker. On `orbital`'s 26,000-point trace this alone will remove most of the file.

Report in `meta`: `inkMm`, `travelMm`, `pathCount`, `pointCount`, `penChanges`, `estMinutes = inkMm/12000 + travelMm/24000 + penChanges·0.5` (200 mm/s draw, 400 mm/s travel, both in mm/min terms).

### 5.3 SVG structure
- One `<g>` per pen pass, id `p{penIndex}-{label}-pass{k}`, with `data-pen-width`, `data-pass`, `data-strokes`, `data-ink-mm`.
- One `<path>` per polyline. Not one `d` with many `M` commands (plot-maps.js:298-300); downstream tools address paths, and the current form makes per-path operations impossible.
- `fill="none"` on every group, asserted by test.
- A 10 mm registration cross at a fixed sheet coordinate outside the artboard, emitted in every pen group, so pen swaps can be verified (https://wiki.evilmadscientist.com/Multicolor_Plot_Tips).
- Header comment keeps seed, study, register, grammar expansion, measure scores, and `cleared`.

### 5.4 Clipping (defect fix)
Both clippers drop out-of-box vertices (plot-maps.js:178-191, plot-marks.js:193-206). Replace with true segment-rect intersection: for each segment crossing a boundary, solve the parameter `t` at the crossing and insert the exact boundary point before ending the run. Cost is a few lines; the payoff is a clean plate edge instead of a frayed one on every study.

### 5.5 Occlusion
New `occlude(lines, silhouettes, { keepHidden })` in plot-geom.js: silhouettes are ordered opaque closed polygons; each line is clipped against each polygon by even-odd crossing parameterization, outside portions kept. With `keepHidden: true` the removed segments go to a `ghost` pen group rather than being deleted. This generalizes the horizon tracker in `ridgelines` (plot-maps.js:106-132) to arbitrary stacked shapes and is what lets the grammar layer a monolith over terrain.

### 5.6 Invariants, as tests in `plot-maps.test.mjs`
1. Determinism: `JSON.stringify(round(build(seed)))` equal across two calls and across node runs.
2. Channel independence: adding an rng draw inside one study leaves other layers byte-identical.
3. No path with fewer than 2 points, no NaN, no coordinate outside `[0,1]` after clipping.
4. No `fill` attribute other than `none`; no `stroke-width` differing from its pen width.
5. `travelRatio < 0.45` and `inkMm` in band for every study at default parameters.
6. `linemerge` is idempotent, and `linesort` never increases `travelMm`.

---

## 6. ADOPT NOW vs LATER

### Now (10)
1. True segment-rect clipping in `clipLines` and `clipToFrame`.
2. Independent seed channels (`chan(seed, name)`), removing the shared-`rng` thread in `composeSheet`.
3. Pen model plus SVG rewrite: one `<path>` per polyline, `stroke-width` = pen width, passes as repeated groups, registration crosses.
4. Export pipeline: linemerge 0.05 mm, linesort with bounded 2-opt, reloop, linesimplify 0.05 mm, plus the `inkMm`/`travelMm`/`estMinutes` report.
5. `jitter` v2 (fBm along arclength, endpoint taper) and `multiPass` disc offsets.
6. `plot-field.js` extraction with `hillshade`, `gradient`, and the ridged/valley/terrace/island transforms (https://www.redblobgames.com/maps/terrain-from-noise/), plus the tone-to-spacing LUT wired into `strata`, `basin`, and `monolith`.
7. Study `scanline`.
8. Study `tanaka`.
9. Study `stitch`.
10. `measureSheet` v2 (fixed coverage and scale, plus `focal`, `travelRatio`, `inkMm`, `structure`) with the re-roll ladder and the contact-sheet dev page.

### Later
`plot-hershey.js` and lettered title blocks, then `plate`; `occlude()` and grammar-level composition of GROUND plus FIGURE; `relief` (Jobard-Lefer) as the shared hatch engine; `truchet`; `diffusion`; `meander`; `tour`; simulated-annealing label placement (http://rlguy.com/map_generation/index.html); the offline MAP-Elites archive (https://arxiv.org/abs/1504.04909) to replace the hand-picked novelty archive; WFC macro-layout (https://github.com/mxgmn/WaveFunctionCollapse); drainage-carved terrain on a Voronoi mesh; Penrose pentagrid; hyperbolic tiling.

### Sources loaded during this spec
- https://vpype.readthedocs.io/en/latest/reference.html (linemerge 0.05 mm and `--no-flip`, linesort `--two-opt`, reloop `--tolerance` 0.05 mm, linesimplify 0.05 mm, multipass `--count` default 2). Verified 2026-08-04.
- https://www.tylerxhobbs.com/words/flow-fields (grid at 0.5 to 1% of width, grid extended `-0.5w` to `1.5w`, step 0.1 to 0.5% of width, circle-packed seeds, angle quantization to π/10 or π/4, per-step minimum-distance kill). Verified 2026-08-04.
- https://scipython.com/blog/the-reutersvard-triangle/ (unit cube ±0.5, rotations y:π/4 then x:π/4 then z:π/6, back-face cull on negative-z normal, nine cubes with corners at 0/120/240° offset 30°, two cubes redrawn out of order for the impossibility). Verified 2026-08-04.
- https://volzo.de/posts/hatching-hachures-contours/ (conceptual only; contains no parameters, no Tanaka formula, no spacings. The Tanaka and hachure numbers in section 2 are this spec's, derived from Kennelly and Kimerling). Verified 2026-08-04.
