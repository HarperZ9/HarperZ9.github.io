# Visual engine audit: where we stand against the enterprise and category-dominant bar

Date: 2026-08-03. Repo: `C:/dev/public/portfolio-site` at `35cf527`. Working tree clean at time of audit (verified).

Scope note and honest null up front: two lanes were audited in depth (the spatial/Gaussian pipeline, and the 2D generative art engine). Three findings went through an adversarial confirmation pass. The UI/design-canon compliance lane, the audio lane, and the WebGPU/WebGL2 particle lanes under `system/engine/sim/` were **not** audited and carry no grade here. Two source documents arrived truncated (lane-2 finding 9's fix text, and the third adversarial verdict's `revised_severity`); both are flagged in place rather than filled in.

---

## 1. The honest verdict

We are category-leading on exactly one axis and a generation behind on the axis the site is named for. The provenance layer is genuinely ahead of every comparator surveyed: `system/spatial-atlas.js:250-256` re-hashes each `.ngsf` against `manifest.receipts` in the browser and throws on DRIFT rather than degrading, and no surveyed tool (Spark, SuperSplat, Spline, cables.gl, fxhash) ships provenance on output at all. The rendering core underneath that receipt is not at the same standard. In the spatial lane, four separate defects produce **wrong output**, not merely slow output: the splat order is stale for the entire duration of every camera move, two of three transform modes sort in a different space than they rasterize, the footprint is a two-axis parallelogram rather than a projected conic, and the published view-response channel is evaluated view-invariantly. In the 2D lane, every plate is composed in a fixed 300px reference space and upscaled by the rasterizer, so "full-size plate" means roughly 144k reference pixels regardless of what the screen or a print asks for. Stated plainly: **the receipt layer is a moat, the renderer is an engineering demo wearing art.** The good news is that the ratio is favourable. Most of the confirmed defects are small, contained, and executable by one maintainer inside a week, and one of them turns out to be cheaper than the audit thought because the machinery already exists in the repo unused.

### Grade table

| Lane | Grade | One line |
|---|---|---|
| Provenance, receipts, disclosure (manifest layer) | **A-** | Byte-level gating actually blocks the draw; claim boundaries are exact and self-critical. Loses the A because none of it reaches the UI. |
| Lifecycle, context management, determinism | **B+** | Monotonic teardown tokens, explicit `loseContext`, observer-driven sizing with the reflow regression documented in place. |
| Spatial / Gaussian rendering core | **C** | Correct premultiplied alpha and a correct depth prepass, sitting on a sorter and a footprint model that are both wrong under motion. |
| 2D generative art output | **C** | Real algorithms, real seed determinism, zero dependencies, capped at a resolution no print or 4K screen can use. |
| Colour pipeline (art engines) | **C+** | Corrected upward from the lane audit: a tested perceptual module exists in-repo and is simply not wired into the two art engines. |
| Art-engine regression coverage | **D** | Zero output tests behind a published claim that "seeded plates repeat exactly". |
| UI / design-canon compliance | not audited | No lane audit supplied. |
| Audio, particle sim lanes | not audited | No lane audit supplied. |

Overall: **C.** Confidence: high on the graded lanes, since every grade traces to a verified file:line.

---

## 2. What is genuinely ours

These are not aspirations, they are shipped and verified.

**Receipts gate the draw, not the README.** `system/spatial-atlas.js:250-256` re-hashes every `.ngsf` sidecar against `manifest.receipts` before it renders and throws on mismatch; `system/studio-spatial.js:70-81` does the same across all 81 files for the hybrid lanes. DRIFT refuses rather than softening. The committed research digest's own comparator survey found no tool that does this. Confidence: high, verified by the lane audit against source.

**Disclosure is self-critical.** `art/spatial/atlas/atlas.world.json` carries a `claim_boundary` naming what the scenes are *not* (not a scan, not photogrammetry, not independent multi-view observation) and volunteers the session's own negative review that the all-splat representation reads weaker than the source at the canonical view. Per-scene receipts carry training iterations, seed, camera list, held-out camera list, and per-view metrics. That is the "no receipt, no accept" standard met at the data layer.

**Determinism is structural, not incidental.** `system/atelier.js:29-51` uses xmur3 plus mulberry32; `system/generative-field.js:56` uses a stateless salt-indexed hash so layers cannot perturb each other's stream by draw order. The lane audit verified byte-identical call traces across two canvas sizes for nine layers.

**Offline and build-free, with no excuses made.** No CDN, no build step, no runtime network dependency beyond the package's own receipted sidecars. Every shader is an inline ES module string. This constraint has been held without degrading the feature set.

**We own the renderer.** Context lifecycle is handled for a stated reason: `spatial-atlas.js:354-369`, `spatial-scene.js:129-143`, `spatial-textured.js:177-192` delete programs, buffers and textures then explicitly `loseContext`, with the ~16-live-context browser cap named in the comment. `spatial-gl.js:7-14` retries acquisition with backoff. `studio-spatial.js:263-320` uses a monotonic token so overlapping world switches tear down the superseded scene. That is production discipline, not demo code.

**A perception layer already exists and is tested.** `system/lib/sense-core/colour-perceptual.mjs` (433 lines) exports `srgbToLinear`, `linearRgbToOklab`, `oklabToOklch`, `oklchToSrgbByte`, `ciede2000`, `dominantColoursOklab`, with a 279-line test at `system/colour-perceptual.test.mjs`. It is dependency-free and already consumed by `system/reactive-visuals.js` and the particle sim modules. Confidence: high, verified directly in this pass.

**The pure layer is genuinely pure.** `spatial-core.js` and `engine/world-package.js` have no DOM or GPU dependency, with node tests covering seed determinism, camera clamping, back-to-front layer order with stable ties, torn-record refusal, and receipt shape.

---

## 3. Confirmed defects

### 3a. Spatial / Gaussian pipeline

**S1. Splat order is stale for the whole duration of every camera move. Severity: critical. Adversarially CONFIRMED as written, with amplifications.**

Evidence: `system/spatial-atlas.js:287-290` is `clearTimeout` plus `setTimeout(..., 90)`; `:314` calls `scheduleSort` on every `pointermove`, so during a continuous drag the timer is cancelled and rescheduled on every event and the sort never runs. The order rendered while orbiting is the one computed before the interaction began. The sort itself (`:272-276`) is `baseIndices.slice().sort(cmp)` allocating two 3-element array literals per comparison, and `gather()` (`:108-127`) then rebuilds seven Float32Arrays and issues seven `gl.bufferData` reallocations even though only the order changed and every attribute is immutable for the life of the scene.

The confirmation pass measured this on scene-01 (26,915 splats): boxed sort 8.18 ms median of 7, `gather()` 5.18 ms plus 161,490 transient TypedArray views, 2,260,860 bytes re-uploaded. Total ~13.4 ms main-thread stall per re-sort on fast desktop. Four refutations were tested and rejected, including "order barely matters for a 2.5D interpretation": scene-01's z extent (-1.397..1.124) exceeds its x extent, mean opacity is 0.776, 86.3% of splats are above 0.5 alpha, and `:399-401` is order-dependent over-blending with `depthMask(false)`. Measured pairwise inversion versus the pre-drag order is 8.4% at 17 degrees yaw, 41.1% at the 1.25 rad clamp, and 62.6% at both clamps, which is worse than random.

Three amplifications the original finding understated: the camera easing at `:387-388` lerps 12% per frame, so the single post-release sort fires about 5.4 frames after the last input while the camera is still roughly 50% short of target and is never recomputed once it settles, meaning the **resting** frame is also wrongly ordered; `gather()` is a second cost centre folded into the upload; and the wheel handler at `:319` schedules a full re-sort on a pure dolly, which cannot reorder anything, making that path 13.4 ms plus 2.26 MB of provably dead work.

Below bar because: PlayCanvas 2.19 runs a WebGPU compute radix sort every frame; Spark 2.x and the mkkellogg non-SAB path run a worker bucket sort on fixed-point keys every frame. Neither ever renders a stale order during interaction, and neither re-uploads immutable attributes to change order.

Fix, in two slices (the confirmation pass corrected the original single-slice scope): **(a)** precompute depth keys into a preallocated Float32Array and sort a Uint32Array index (measured 5.06 ms versus 8.18 ms), then move that to a plain ES-module worker with fixed-point keys and a bucket/radix pass, using the last completed order until the next lands. No build step, no CDN, and the digest at `project-docs/2026-08-03-studio-v2-research-digest.md:40` already rules out SharedArrayBuffer for GitHub Pages and names the non-SAB path. **(b)** Eliminating the 2.26 MB re-upload is not a drop-in: WebGL2 instancing cannot indirect an attribute fetch, so order-as-index-stream requires moving the 21 per-splat floats into textures and reducing the per-instance attribute to one Uint32 that the vertex shader `texelFetch`es. That is a real refactor of `ATLAS_VS:17-40` plus `setup():222-240`, still single-maintainer executable, but scope it separately. Effort: M then L.

**S2. Inversphere and Holo sort against pre-warp positions. Severity: high as filed, adversarially CONFIRMED with a material correction; revised severity unknown (source verdict truncated before `revised_severity`).**

Evidence: `spatial-atlas.js:26-29` warps every position in the vertex stage (mode 1 radial inversion plus twist, mode 3 time-varying displacement), while `sortAndUpload` (`:272-276`) keys on `scene.means` with only `depthScale` applied. `frame()` enables blending with `depthMask(false)` at `:398-401` and never enables `DEPTH_TEST`, so order alone determines the composite. `setControl` (`:324`) returns before `scheduleSort`, so a mode switch does not even trigger a re-sort. `studio.html:361-366` presents both as first-class Transform chips with no caveat, and `buildRunReceipt` asserts nothing about ordering validity.

The correction matters: **"systematically inverted" is wrong.** Measured on scenes 01/07/14/22 against the shader's own math, global Spearman rho between used and true keys is +0.91 with 13% pairwise discordance. Ordering is degraded, not reversed. The real damage is local: among splats that overlap on screen and therefore blend, discordance is 40% at the default 2.55 dolly and 55-70% at close dolly. The confirmation pass also noted the omission is *inconsistent* rather than a disclosed boundary, since `depthScale` **is** mirrored between shader (`:26`) and sort key (`:273-275`) and does re-trigger a sort (`:326`).

Fix: mirror `warp()` for mode 1 in JS (closed form, ~15 lines) and key the sort on the warped position, exactly as `depthScale` already is. For mode 3, either evaluate the warp at the current `uTime` when the sort runs, or switch modes 1 and 3 to additive blending, which is order-independent by construction and suits their luminous look. Either way, add the mode's ordering status to `buildRunReceipt`'s controls block (`system/engine/world-package.js:129-146`) so the receipt carries it. Effort: M.

**S3. The published view-response channel does not depend on the view. Severity: filed high, adversarially CONFIRMED but revised down to medium.**

Evidence: `spatial-atlas.js:34` computes the splat's local z axis in model space from `aQuat` alone; `:40` passes it as `vNormal` with no `uView` applied anywhere; the fragment stage declares no view uniform at all (`:44-45`); `:50` reads `abs(vNormal.z)`. That is a per-splat constant, identical at every camera position. `art/spatial/atlas/atlas.world.json:57` publishes `view_response:int8x3` in `model_format` with no caveat.

Two corrections from the confirmation pass. First, the amplitude claim was overstated: the shipped int8 values cluster near zero (scene-01 range [0,7], 53% of 26,915 records all-zero; widest scene reaches |22|), so after the `/127` scaling and the `+-0.5` bound, even a **correct** evaluation yields a 3% to 9% shading swing, not the difference between "lit spatial object" and "frozen point cloud". Second, "inert" is the wrong word: the channel produces a real static per-splat tint; what is absent is specifically the view dependence. Provenance note that lowers blame but not the defect: `art/spatial/extract_atlas.py:132` copies `model_format` verbatim from the upstream Atlas v0.5.0 manifest, so the field name is inherited. We still republish it without disclosure.

Correct framing: this is a **naming and disclosure defect** first, a rendering defect second. Fix: pass a `uEye` uniform (`cameraFrame()` at `:292-302` already computes eye and uploads it nowhere), evaluate `dot(n0, normalize(uEye - p))`, and separately label the shipped behaviour honestly in the manifest and Studio copy. Effort: S.

**S4. The splat footprint is a two-axis parallelogram, not a projected 2D covariance. Severity: high (lane audit, not adversarially re-tested).**

Evidence: `spatial-atlas.js:34-38` builds the quad from only two axes; `aScale.z` is parsed at `:78` and never referenced in the shader again. `:48-49` evaluates `exp(-3.7*dot(vCorner,vCorner))` on the unit corner square, which is the correct 2D Gaussian only when the projected axes are orthogonal and equal-length in screen space. Under a generic orbit they are sheared and unequal. A Gaussian whose long principal axis is local z collapses to a dot from every angle. There is no anti-aliasing dilation, so sub-pixel Gaussians scintillate under motion.

Below bar because the EWA formulation every comparator uses builds Sigma from all three scale components, projects through the perspective Jacobian to a 2x2, and evaluates the conic per fragment. Mip-Splatting and stock 3DGS both add a low-pass term (about `0.3*I`) precisely to kill the scintillation.

Fix: build the full 3x3 from `aQuat` and all three scale components, project with the perspective Jacobian, add 0.3 to the 2x2 diagonal, and either take eigenvectors for the quad axes or pass the inverted 2x2 as a varying. Roughly 25 lines of GLSL in `:30-40` and `:47-53`, no file-format change. Effort: M.

**S5. Reduced motion is ignored in the default world, contradicting a published claim. Severity: high (lane audit).**

Evidence: `studio.html:408` publishes "Reduced motion holds a single still frame." The hybrid lanes honour it (`spatial-scene.js:65`, `spatial-textured.js:78` set `motion.freezeAt = 0.0`). The atlas does not: `spatial-atlas.js:150-151` are the only two references to `reducedMotion` in the entire file (re-verified in this pass: exactly two hits). `frame()` at `:409` gates time on `this.paused` only, so `uTime` keeps advancing and Holo keeps animating for a reduced-motion user, and the atlas is the default world (`studio-spatial.js:22`). Separately, there is no dirty-frame gating anywhere, so ~27k blended instanced quads redraw at 60 fps forever with a settled camera.

This is an accessibility-floor breach against a claim already printed on the surface. Fix: gate the clock the way the hybrid lanes do, snap yaw/pitch when reduced, and add a `dirty` flag that skips `frame()` when nothing changed and the mode is not time-varying. Effort: S.

**S6. Held-out PSNR is published stripped of its denominator; the claim boundary never reaches any UI. Severity: high (lane audit).**

Evidence: `studio-spatial.js:159-160` renders `held-out PSNR 43.4` into the live status line. The qualifiers all exist and are all withheld: `art/spatial/atlas/scene-01.receipt.json` shows the held-out set is 8 synthesized cameras at 144x180 against a 1229x1536 canonical source, per-view range 41.0 to 45.1, 32 training iterations in 4.99 s. I re-ran the grep in this pass: `claim_boundary` appears in **zero** site HTML or JS files (the one hit is an unrelated `overclaim_boundary` string in `research-hyphal-context-benchmark.html:77`). Confidence: high.

This is our own standard turned against us. Fix: render the number complete (`43.4 dB mean, 41.0-45.1 across 8 synthesized held-out views at 144x180`) or drop it, and render `scene.claim_boundary` verbatim in the Atlas panel beside the receipt verdict. Effort: S.

**S7 (medium, lane audit).** No frustum culling, no screen-space LoD, and `SPLAT_BUDGETS` in `engine/render-plan.js:12-17` (low 25000, mid 120000, high 400000) can only bind on the low tier since the largest scene is 29,613 gaussians, so `studio.html:339`'s "splats follow your device tier's budget" describes a mechanism that does nothing above low. The honest read is that our quality ceiling here is **asset density, not renderer speed**: 27k Gaussians against a 1229x1536 source is about one Gaussian per 70 source pixels, which is why the session's own review judged the all-splat representation weaker than the source. Effort: L.

**S8 (medium, lane audit).** Quantization is scene-independent: `:73-75` dequantizes int16 positions against a hard-coded `2.5` with no per-scene AABB in the 16-byte header; `:55` maps scales through a fixed exponential clipping anything above 0.37 scene units; `:79-82` spends 64 bits on a quaternion that smallest-three encodes in 32, and silently accepts an all-zero quaternion as identity while every other malformation in the parser is refused loudly. There is no `spatial-atlas.test.mjs`, so `parseNGSF` and `orderByImportance` have zero coverage including all four refusal paths. Effort: M.

**S9 (medium, lane audit).** The hybrid and textured lanes draw Gaussian material in raw buffer order under non-commutative alpha-over (`spatial-scene.js:267` and `:205`, `spatial-textured.js:329` and `:362`). All of that material is emissive, so `blendFunc(ONE, ONE)` is exactly order-independent and closer to the intended look. One line each. The point-size floor of 1.0 (`spatial-shaders.js:104`, `spatial-textured-shaders.js:237`) has no alpha compensation, so distant material holds full alpha and shimmers, and neither ceiling is checked against `ALIASED_POINT_SIZE_RANGE`. Effort: S.

### 3b. 2D generative art engine

**G1. Fixed 300px reference space caps structural detail. Severity: critical (lane audit).**

Evidence, re-verified in this pass at `HEAD`: `system/generative-field.js:2454` is `const REFERENCE_SHORT_EDGE = 300;` and `:2492-2494` divides the canvas by that scale, so every layer draws into roughly 471x300. Measured on a 2200x1400 plate: neural-field emits 35,403 fillRects at 14.0 device px each; voronoi-stain at 18.7 px; clifford plots 59,979 points at 7.0 px each; the dither veil paints 46.8-device-px squares. `drawNeuralSdf:2059` marches 118x75 rays and upscales 18.6x. The resolution-adaptive budgets are now dead code: `drawClifford:2344`'s `Math.min(360000, Math.max(60000, width*height*0.18))` evaluates to 60000 at every canvas size because reference-space area never exceeds ~160k, and exactly 59,976 points were measured at 800x500, 1000x625 and 1600x1000 alike.

Note on provenance: `HEAD` is the merge of `fix/resolution-independent-plates`, which is what introduced this normalization. Composition stability was the goal and it was achieved. The unintended cost is that detail is now pinned to composition scale.

Fix: separate composition scale from detail scale. Thread `detail = canvas.width*canvas.height / REFERENCE_SHORT_EDGE^2` through the layer signature and multiply the six grid/march/budget sites by `sqrt(detail)` or `detail`: `drawNeuralField:2016`, `drawVoronoiStain:2286`, `drawDlaCoral:1814`, `drawNeuralSdf:2059`, `drawClifford:2344`, `drawIfsLightVeil:1790`. The rest of the vocabulary is stroke-based and already scales. Effort: M.

**G2. The art engines do not use the perceptual colour module that already ships in this repo. Severity: high. Corrected from the lane audit.**

The lane audit filed this as "no perceptual colour space anywhere: grep for oklch/oklab/srgbToLinear across `system/*.js` returns zero hits." That grep is true and the conclusion drawn from it is **wrong**. Recursive grep in this pass returns `system/lib/sense-core/colour-perceptual.mjs` (433 lines, tested at `system/colour-perceptual.test.mjs`, 279 lines), already consumed by `system/reactive-visuals.js` and the three particle sim modules. Confidence: high, verified directly.

The defect that survives is narrower and cheaper: `system/generative-field.js` imports `neural.js`, `voxel.js` and `typeface.js` and not the colour module, and `system/atelier.js` imports nothing. So every ramp, shade, luminance read and additive composite in the two art engines is naive gamma-sRGB: `atelier.js:63` `lerpRgb`, `atelier.js:138` and `:2353` Rec.601 luma on gamma-encoded bytes, `generative-field.js:2031-2036`, `:2306`, `:2394-2397`, plus 29 `globalCompositeOperation = "lighter"` sites adding in non-linear space. Measured consequence on the atelier `spectrum` palette: the sRGB midpoint of `#3f857a` to `#efab30` is OKLCH L 0.663 / C 0.089 / H 109, chroma 41% below the more saturated endpoint, landing on an olive belonging to neither ink.

Fix, revised down in cost: **import the existing module**, do not write a new one. Add `mixOk` and `rampOk` helpers (about 20 lines) on top of the existing `oklchToSrgbByte` / `linearRgbToOklab`, replace `atelier.js:63` and the four `generative-field.js` sites, and replace the two luma lines with OKLab L. Effort: S to M, down from the filed M.

**G3. 19 of 46 registered layers accept `palette` and ignore it. Severity: high (lane audit).** Zero `palette` references in the bodies of `drawFacetPlanes:934`, `drawGrooveMarble:1009`, `drawCausticVeils:1183`, `drawCausticPaper:1204`, `drawPlanetLimb:1223`, `drawAuroraLeak:1278`, `drawObsidianBurst:1308`, `drawDendrite:1352`, `drawRisoMoire:1401`, `drawMoireSwirl:1438`, `drawPlotterPlate:1465`, `drawAcidDuotone:1517`, `drawStellatedLantern:1640`, `drawFiberStrands:1695`, `drawPixelSortRuin:1726`, `drawIfsLightVeil:1768`, `drawDlaCoral:1805`, `drawWeaveLattice:1874`, `drawFiberTerrain:1923`. 98 hardcoded rgb literals, 67 distinct. `gallery.html:183` ships plate 3 as `riso-moire + dendrite` and `:213` plate 6 as `moire-swirl + aurora-leak`, in each case two layers that both ignore the route palette. Fix: a `{ ground, ink, support, hot }` role API built by `routePalette` from OKLCH anchors, plus a lint assertion that fails any `SPECIMEN_LAYERS` body matching a raw rgb literal. Effort: M.

**G4. The chaos-game IFS driver is periodic. Severity: high (lane audit).** `generative-field.js:1789` selects the affine map with `rand(seed, 2400 + (i % 997))`, so the map sequence has period 997 and the orbit converges to a cycle. Measured: 41,976 fillRects, 3,005 distinct coordinates, 93% redundant work. The invariant measure is never sampled. Fix: `rand(seed, 2400 + i)`, one line, still fully deterministic. Effort: S. This is the best impact-per-character fix in the audit.

**G5. Additive point accumulation clips into the 8-bit canvas. Severity: high (lane audit).** `drawClifford:2346-2356` composites 60,000 points at alpha 0.12 with `lighter`, saturating after about 9 coincident hits, so the folded core clips flat while only sparse wisps carry gradation. `drawIfsLightVeil:1801` is the same at 0.07. There is no accumulation buffer anywhere in the file. Fix: accumulate into a `Float32Array(w*h*4)`, map `alpha = log(1+count)/log(1+max)`, apply gamma, blit once. About 60 lines shared between the two layers, and it makes G1's detail scaling free for them since more points cost accumulation rather than draw calls. Effort: M.

**G6 (medium).** Dithering and halftone are one 4x4 Bayer matrix (`:281-290`) used at eight sites, driving both threshold and dot size in the same cell at `:269` and `:273`, so the 4-cell period is imprinted twice. No error diffusion, no blue noise, no per-ink screen angle. At G1's scale factor each Bayer cell becomes a 47-device-px block. Fix: an embedded 64x64 void-and-cluster blue-noise tile (about 4 KB base64, no build step) plus a real rotated AM screen. Effort: M.

**G7 (medium).** `pixel-sort-ruin` (`:1726-1765`) never reads a pixel; the only `getImageData` calls in the file are the neural-SDF buffers at `:2069` and `:2150`. `acid-duotone` (`:1517-1564`) has no source and no tone curve. `riso-moire` uses `lighter` at `:1409` for a two-ink overprint, which moves toward white where real ink overprint darkens. On a site whose thesis is honest labelling, a layer named for a technique it does not perform is the same defect class as an unbacked benchmark number. Fix: implement (a real pixel sort is about 40 lines and composes correctly with `renderSpecimenOver`) or rename in code and captions. Switch `:1409` to `multiply` regardless. Effort: M.

**G8 (medium).** The art engine has zero output regression coverage. `tests/` holds 14 files (verified this pass); the only references to the engine are `test_deploy_sanity.py:25` asserting file presence and `test_zentropy_sitewide_contract.py:37` asserting the nav imports it. Nothing renders a layer or pins an output, while `gallery.html:8` and `:144` publish "seeded plates repeat exactly". Fix: `scripts/field-receipts.mjs`, a ~60-line recording Canvas2D Proxy that logs every call, renders all 46 layers at two sizes and two seeds, SHA-256s the call trace, and diffs against a committed manifest. The lane audit ran exactly this shim against the real module in Node with no DOM and no dependencies, and all 46 layers executed. Effort: S.

**G9 (medium, source truncated).** No print-resolution export path. `atelier.js:2024-2028` caps the canvas at `min(2, devicePixelRatio)`; the rich screen render `paintRich` (`:1694-1727`) is deliberately excluded from export by the module's own comment at `:1667-1672`; the only download is `toSVG` (`:1729`), the flat plotter file. Gallery "save png" ends at `exporters.js:369-377` `canvas.toBlob` at the existing backing store. So neither instrument can produce a high-resolution file of the image the viewer is actually looking at. **The supplied fix text was truncated mid-word.** Reconstructed direction, flagged as mine and not from the audit: add an offscreen render-at-resolution path that re-runs `paintRich` into a detached canvas at a requested edge (with G1's detail parameter driving actual added structure rather than upscale), and expose it behind an explicit resolution control. Effort: M, low confidence on the sizing until the original fix text is recovered.

---

## 4. The gap to category dominance

Five items, ranked by impact divided by effort. Everything here is executable by one maintainer.

**1. Fix the IFS period and wire the existing colour module. Effort: S. Impact: high.**
One line at `generative-field.js:1789` turns a 3,000-point skeleton into a real attractor. Importing `system/lib/sense-core/colour-perceptual.mjs` into the two art engines fixes the measured chroma collapse across every palette in the gallery. Both are visible in output the same day. This ranks first only because the cost is near zero; it does not close the structural gap on its own.

**2. Ship the disclosure to the surface, and honour reduced motion. Effort: S. Impact: high.**
`claim_boundary` currently appears in zero UI files while a bare `43.4` PSNR is printed live. Rendering the boundary verbatim and the metric complete converts our strongest asset from a JSON file into the thing a visitor actually sees, which is the differentiator the research digest identifies as the Studio's position. Pair it with the reduced-motion gate in `spatial-atlas.js`, since a published accessibility claim that the default world does not honour is the same defect class.

**3. Correct the sorter: keys, index sort, worker, warped-space keys. Effort: M. Impact: highest.**
This is the single largest quality gap and the measurements are unambiguous: 62.6% pairwise inversion at the orbit clamps, 13.4 ms of main-thread stall, 2.26 MB re-uploaded per re-sort, and a resting frame that is also wrong because the sort fires before the camera easing settles. Slice one (precomputed keys plus index sort plus worker plus mirrored warp) needs no architecture change and no build step. Do **not** bundle the texture refactor here.

**4. Give the 2D engine a detail axis and a density buffer. Effort: M. Impact: high.**
Six call sites plus a float accumulation buffer converts "nineteen full-size plates" from a rasterizer upscale into genuinely higher-resolution renders. This is the difference between a screenshot and an edition, and it is the precondition for any print or 4K claim.

**5. Projected 2D covariance with low-pass dilation. Effort: M. Impact: medium-high.**
About 25 lines of GLSL, no format change. This is the correctness floor every comparator clears, and it removes the sub-pixel scintillation that currently reads as noise under motion. Ranked fifth only because items 1 through 4 have better ratios, not because it is optional.

Honest null on what is **not** on this list: LoD splat trees, SOG streaming, GPU radix sort, and StochasticSplats sort-free transparency are all in the research digest and all correctly scoped as later. Our scenes are 27k Gaussians. The category operates two to three orders of magnitude above that. Chasing their scale machinery before fixing our correctness and our asset density would be spending effort where we have no bottleneck.

---

## 5. Staged plan

### Now (this week)

Target: every defect that produces visibly wrong output at S effort, plus the sorter's first slice.

- `generative-field.js:1789` per-iteration map selection. Verify with the distinct-point probe: distinct count should approach iteration count.
- Import `system/lib/sense-core/colour-perceptual.mjs` into `generative-field.js` and `atelier.js`; add `mixOk` / `rampOk`; replace `atelier.js:63`, `:138`, `:2353` and `generative-field.js:2031-2036`, `:2306`, `:2394-2397`. Re-measure the `spectrum` midpoint chroma; it should hold near 0.15, not 0.089.
- `spatial-atlas.js` reduced motion: gate `uTime` on `paused || reducedMotion`, snap yaw and pitch, add the `dirty` flag.
- `studio-spatial.js:159-160`: render the PSNR complete or drop it. Add a persistent `claim_boundary` line to the Atlas scene panel.
- `spatial-scene.js:205` and `spatial-textured.js:370`: additive blend for the emissive point pass, restore after.
- Sorter slice one: precomputed Float32Array keys, Uint32Array index sort, mirror `warp()` mode 1 into the key, remove the debounce, skip the re-sort on pure dolly, add `ordering` to `buildRunReceipt`'s controls block.
- `scripts/field-receipts.mjs` plus its committed manifest, wired into CI.

Deliverable: one PR per group, each with a before/after measurement in the description. Branch only, never main.

### Next (this month)

- Sorter slice two: move the 21 per-splat floats to textures, reduce the per-instance attribute to a Uint32 index, `texelFetch` in `ATLAS_VS`. Refactor of `:17-40` and `:222-240`. Measure the upload drop (2.26 MB to about 108 KB) and record it.
- Move the sort into a plain ES-module worker with transferable Uint32Array and last-completed-order semantics. No SharedArrayBuffer, per the digest's GitHub Pages constraint.
- EWA projected covariance plus 0.3 low-pass dilation in `spatial-atlas.js:30-40` and `:47-53`.
- `detail` parameter threaded through the layer signature; the six grid, march and budget sites converted; log-density accumulation for `drawClifford` and `drawIfsLightVeil`.
- `uEye` uniform and real view-direction evaluation, **plus** an honest label in `atlas.world.json` and Studio copy either way. Note the upstream provenance (`extract_atlas.py:132` copies `model_format` verbatim) in the manifest so the naming trail is intact.
- `system/spatial-atlas.test.mjs`: header refusals, byte-count mismatch, hand-built record round trip, degenerate quaternion refusal, `orderByImportance` budget floor and dropped count.
- Palette role API and the 19 layer conversions, plus the raw-rgb-literal lint.
- Render-at-resolution export for `paintRich` and the gallery plates. Recover the truncated fix text from the lane-2 source before sizing this precisely.

Deliverable: the Studio renders a correct order at every frame in every mode, the art engine produces genuinely more structure at higher output resolution, and both carry regression receipts.

### Later (research-grade)

- NGSF v6 header: per-scene AABB and scale window, smallest-three quaternion packing, the freed 4 bytes spent on the SH1 block the digest already scopes. Keep the NGS5 branch so existing receipts stay valid.
- Build-time spatial bucketing with per-bucket AABB and importance-ordered runs written into the header, then per-sort bucket culling and projected-footprint prefix selection. This is what makes `SPLAT_BUDGETS` mean something.
- Asset density: the quality ceiling is one Gaussian per 70 source pixels, not renderer throughput. Raising training iterations and Gaussian count is the intervention that would change the visual verdict at the canonical view, and it is the honest answer to the session's own negative review.
- Blue-noise screen and true rotated AM halftone with per-ink angles and a dot-gain curve, replacing the single 4x4 Bayer.
- Real pixel sort and real duotone, or renamed layers with corrected captions. Decide deliberately and record which.

---

**Confidence summary.** High on every file:line cited from the two lane audits and re-verified in this pass (`spatial-atlas.js:272-290`, `generative-field.js:2454`, `:2492-2494`, the two `reducedMotion` hits, the zero `claim_boundary` UI hits, the `colour-perceptual.mjs` module and its test, the 14-file `tests/` inventory). High on the three adversarially confirmed findings including their corrections. Moderate on the lane-audit findings that did not go through adversarial confirmation (S4 through S9, G1 and G3 through G8), since their measurements are reported rather than re-run here. Low and flagged on G9's fix sizing, where the source text was truncated.
