# Studio v3 research digest: latest methods per lane

Gathered live 2026-08-04 by a six-lane web-research workflow (raymarch quality, plot maps,
voxel tooling, living systems, generative audio, studio-UX benchmarks), each lane returning
source-linked findings, then synthesized. Constraint frame for every finding: vanilla JS ES
modules, no build step, no CDN or runtime network dependency, WebGL1 + 2D canvas, deterministic
seeded rendering, receipts and honest disclosure. Findings whose primary source could not be
dated are flagged in place.

Lane coverage: state-of-the-art quality for real-time raymarched 3D fractals (Mandelbulb/Mandelbox) in a fragment shader — WebGL1 single-pass (12), algorithmic plot maps (pen-plotter-style generative cartography and field drawing) (12), voxel art tooling on the web (12), living/neural generative systems (12), generative audio / seed sound (12), control-ux-benchmark: web art/creative studios (disclosure: shadertoy.com and openprocessing.org returned 403 to automated fetch; Shadertoy verified via Wikipedia; OpenProcessing and the p5 web editor omitted rather than filled from memory) (12)

# Research Digest: Generative Art Studio Techniques

Ranked within each lane by visual payoff per unit effort. Effort tags: S / M / L. Findings whose primary source carries no publication date are flagged **[undated source]**.

---

## Lane 1: Real-time raymarched 3D fractals (WebGL1, single-pass)

Prerequisite for everything below: **escape-time distance estimator with running derivative** (trig-free Mandelbulb, Mandelbox boxfold/spherefold). DE ~ 0.5·|z|·log|z|/|z'|; the gradient doubles as a shading normal. Effort M. https://iquilezles.org/articles/mandelbulb/ (Mandelbox DE: Syntopia Nov 2011, TLS cert broken on that host, confirmed via search excerpts only).

1. **Single-ray soft shadows (min k·h/t, Aaltonen 2017 refinement)** — S. Highest payoff-per-line in the lane; self-shadowing is what makes a Mandelbulb read as solid. One extra march loop, ~8 lines. https://iquilezles.org/articles/rmshadows/
2. **Orbit traps + origin-trap fake AO** — S. Four min() accumulators inside the loop you already run; zero extra DE calls; palette becomes a seedable parameter. The veined mineral look instead of flat plastic. https://iquilezles.org/articles/mandelbulb/
3. **Three-term lighting rig (sun/sky/bounce, split visibility)** — S. ~12 lines, one shadow ray total; sun direction and colors become receipt parameters. https://iquilezles.org/articles/outdoorslighting/ **[undated source]**
4. **Tetrahedron 4-tap normals** — S. Saves 2 full fractal-loop evaluations per pixel; real frame-time win, no derivatives extension. https://iquilezles.org/articles/normalsSDF/ **[undated source]**
5. **Fog: exponential + sun-scatter tint + analytic height fog** — S. ~6 lines, no extra DE calls; the main depth cue on fractal renders. https://iquilezles.org/articles/fog/ **[undated source]**
6. **ACES filmic tone map (Narkowicz fit) before gamma** — S. 5 lines; hot orbit-trap colors roll off instead of clipping. Record operator name in receipt. https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/ (AgX adoption context: https://github.com/mrdoob/three.js/issues/27362)
7. **5-tap DE ambient occlusion** — S. ~6 lines + 5 map() calls; use for the sky term, orbit AO as multiplier. https://iquilezles.org/articles/nvscene2008/rwwtt.pdf
8. **Blue-noise dithered ray offset** — S. ~3 lines + one tiling texture (data URI or generated at startup); halves usable step counts. Keep noise seed in receipt. https://blog.demofox.org/2020/05/10/ray-marching-fog-with-blue-noise/
9. **Enhanced sphere tracing (over-relaxation + pixel-cone epsilon)** — M. ~10 lines changed; where the speed lives on conservative Mandelbox DEs; t-proportional epsilon stabilizes far detail. https://www.lgdv.tf.fau.de/publications/enhanced-sphere-tracing/ **[undated page; paper 2014 from memory, moderate confidence]** (refinement: https://people.inf.elte.hu/csabix/publications/articles/eurographics-2018-shortpaper.pdf)
10. **Temporal accumulation with seeded jitter** — M. Two RGBA8 ping-pong FBOs, ~40 lines JS; reproducible with recorded frame count. SSAA 2x2 for receipts, accumulation for live view. https://www.shadertoy.com/view/tslSWS **[undated source]**
11. **Cone marching prepass** — L. Multi-pass; only when a Mandelbox scene misses frame budget; prefer over-relaxation first. https://www.fulcrum-demo.org/wp-content/uploads/2012/04/Cone_Marching_Mandelbox_by_Seven_Fulcrum_LongVersion.pdf

---

## Lane 2: Algorithmic plot maps (pen-plotter cartography)

1. **Flow fields (Hobbs grid-of-angles, non-overlap via spatial hash)** — S. Arrays + seeded PRNG + self-written noise; output is polylines, ideal for single-stroke SVG. https://www.tylerxhobbs.com/words/flow-fields
2. **Hidden-line ridgeline terrain (horizon tracking)** — S. ~30 lines over elevation rows; the cheapest occlusion win in the lane; the writeup doubles as a 2026 end-to-end plotter workflow checklist. https://nummy.blog/pen-plotter/generative-art/python/creative-coding/2026/02/06/three-months-with-a-pen-plotter.html
3. **Marching squares contouring of noise fields** — S. ~100-150 lines, core studio primitive; chain segments into closed polylines for occlusion and labeling. https://en.wikipedia.org/wiki/Marching_squares **[undated source]** (reference impl: https://github.com/d3/d3-contour)
4. **Multi-scale Truchet (Carlson winged tiles)** — S. Pure arc geometry, native SVG arcs, deterministic quadtree subdivision driven by a density field. https://archive.bridgesmathart.org/2018/bridges2018-39.html
5. **Hatch/crosshatch fill with serpentine joining** — M. Even-odd scanline vs polygons; density-mapped spacing gives tonal shading; joining is the plot-time optimizer. https://wiki.evilmadscientist.com/Hatch_fill **[undated source]**
6. **vpype-style export pipeline: simplify, reloop, merge, sort** — M. These four passes are the definition of plotter-grade; mm viewBox + per-layer stroke stats are receipt material. https://vpype.readthedocs.io/en/stable/cookbook.html **[undated source]**
7. **Weighted Voronoi stippling (Secord, discrete Lloyd on canvas)** — M. No exact Voronoi needed; feeds TSP art and terrain texturing. https://www.cs.ubc.ca/labs/imager/tr/2002/secord2002b/secord.2002b.pdf
8. **TSP art (nearest-neighbor + 2-opt in a worker)** — M. One unbroken stroke, zero pen lifts; fix iteration count for determinism. https://www.evilmadscientist.com/2012/stipplegen-weighted-voronoi-stippling-and-tsp-paths-in-processing/
9. **Differential growth** — M. Replace rbush with a hand-rolled grid hash (~50 lines); freeze after N iterations, emit polyline. https://medium.com/@jason.webb/2d-differential-growth-in-js-1843fd51b0ce (origin: https://github.com/inconvergent/differential-line)
10. **Wave Function Collapse tile maps** — M. Fictional street/terrain maps with joinable strokes; record restart count in the receipt. https://www.boristhebrave.com/2020/04/13/wave-function-collapse-explained/
11. **Isoline labeling (ladders, line masking as literal gaps)** — M. The detail that makes contour pieces read as maps; single-stroke Hershey digits in a polyline break. https://doc.esri.com/en/arcgis-pro/latest/help/mapping/text/label-using-the-contour-placement-style.html **[undated source]**
12. **Occlusion culling by draw order (occult convention)** — L. Clip polylines against later closed shapes; keeps layered maps single-stroke honest; keep-removed maps to a disclosure debug layer. https://github.com/LoicGoulefert/occult **[undated source]**

---

## Lane 3: Voxel art tooling on the web

1. **.vox base format reader/writer** — S. Few hundred lines over DataView; byte-exact output hashes straight into receipts; surface the 256^3 and 256-color caps honestly. https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox.txt
2. **Baked per-vertex AO with quad-flip rule** — S. The cheap 80% of the path-traced look, zero runtime cost; works even in a 2D-canvas rasterizer. https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/
3. **SDF-to-voxel generator (IQ distance-function catalog)** — S. Port a dozen primitives + CSG/smooth/repeat operators; seeded parameter sets make every model reproducible. https://iquilezles.org/articles/distfunctions/ **[undated source; license unknown]**
4. **WebGL1 draw strategy: merged per-chunk VBOs, one draw per chunk** — S. Architecture guidance; keep chunks under 65,536 vertices or gate on OES_element_index_uint; reserve instancing for editor overlays. https://developer.mozilla.org/en-US/docs/Web/API/ANGLE_instanced_arrays
5. **Image-to-voxel conversion (heightmap and sprite-extrude modes)** — S. getImageData, quantize to 256 colors, emit .vox; deterministic given image bytes + seed. Existence proof of the fully client-side pipeline: https://drububu.com/miscellaneous/voxelizer/ **[undated source]**
6. **Greedy meshing** — M. Linear time, deterministic; atlas caveat vanishes for palette-colored art (merge on equal palette index + equal baked AO). https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/
7. **Palette-compressed bit-packed chunk storage** — M. Typed-array buffers hash cheaply for receipts and undo snapshots, serialize to localStorage. https://voxel.wiki/wiki/palette-compression/ **[undated source]**
8. **.vox extension chunks + version-200 tolerance** — M. Accept 150 and 200, skip unknown chunks by size, write 150 for compatibility; MATL _emit is the emissive-lighting hook. https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox-extension.txt **[undated spec]** (v200 issue: https://github.com/ephtracy/ephtracy.github.io/issues/264)
9. **Naive surface nets for smooth mode** — M. No case tables, small meshes; skip dual contouring unless sharp CSG edges become a requirement. https://0fps.net/2012/07/12/smooth-voxel-terrain-part-2/
10. **Isometric 2D-canvas presentation (obelisk.js pattern, not dependency)** — M. Painter's order + 1:2 pixel cubes + three face shades; the no-WebGL fallback and PNG sprite exporter. https://github.com/nosir/obelisk.js/blob/master/README.md **[last activity unknown]**
11. **Per-pixel Amanatides-Woo DDA raycasting (2D-atlas volume on WebGL1)** — L. The honest path to the MagicaVoxel render look; same DDA doubles as editor pick and CPU receipt thumbnails. https://github.com/cgyurgyik/fast-voxel-traversal-algorithm/blob/master/overview/FastVoxelTraversalOverview.md **[overview undated; paper 1987 from memory]** (setup: https://www.willusher.io/webgl/2019/01/13/volume-rendering-with-webgl/)
12. **Editor feature baseline (Voxel Builder, Blockbench)** — L. Feature checklist and UX reference only; not portable code. Studio differentiators neither ships: seeded generators, provenance receipts. https://github.com/nimadez/voxel-builder **[release date unknown]**

---

## Lane 4: Living/neural generative systems

1. **Particle Lenia** — S. Best constraint fit in the lane: 200-1000 particles at O(N^2) runs on 2D canvas with zero graphics-API risk; analytic gradients; keep force accumulation order stable or float non-associativity desyncs identical runs. https://google-research.github.io/self-organising-systems/particle-lenia/
2. **CPPN compiled to GLSL** — S. The seed is the artwork: seeded PRNG generates weight matrices, same seed regenerates the identical shader; pure WebGL1, no extensions, no training. https://wxs.ca/research/cppn-to-glsl/
3. **Gray-Scott with spatially modulated (f,k)** — S. One ping-pong pass; the differentiator over a thousand demos is driving (f,k) from a seeded field through the Pearson crescent; half-float state or disclose 8-bit banding. https://www.karlsims.com/rd.html
4. **Physarum transport networks** — M. Best wonder-per-line needing no training data; WebGL1 path via float agent textures + additive point deposit; 2D-canvas fallback at ~30-60k agents plausible (unmeasured estimate). https://cargocollective.com/sagejenson/physarum
5. **Multi-scale Turing patterns** — M. High wonder, no weights, no assets; separable box blurs or mipmap cheats; global renorm needs a reduction pyramid or a disclosed clamp approximation. https://github.com/afavaro/TuringPatterns **[repo undated]**
6. **Particle life (asymmetric species matrix)** — M. The binning pipeline does not port to WebGL1; use canvas + typed-array grid (5-20k particles, unmeasured estimate) or the blurred-density-field trick that makes cost O(N·K) and shares physarum machinery. https://lisyarus.github.io/blog/posts/particle-life-simulation-in-browser-using-webgpu.html
7. **microNCA (68-588 byte models)** — M. Whole model is a byte array pasted into a .js file; runtime S but weights are offline training work, disclose that in the receipt. https://ar5iv.labs.arxiv.org/html/2111.13545
8. **Boids + predator layer** — S. Lowest risk, most-seen effect; earns a place only if predator dynamics or rendering does the differentiating work. https://www.red3d.com/cwr/boids/
9. **LPPN structural steal: coarse sim + implicit upsample pass** — S for the steal (hand-written sin-basis decode pass, no training); L to reproduce properly (reference demo is WebGL2/SwissGL). https://arxiv.org/abs/2506.22899
10. **Full 16-channel NCA on 8-bit WebGL1 textures (distill ca.js)** — L. Proof it runs on phones with zero extensions; the atan-squash 8-bit packing trick is worth stealing on its own; shipped weights need citation and license in the receipt. https://raw.githubusercontent.com/distillpub/post--growing-ca/master/public/ca.js
11. **Grid Lenia / SmoothLife** — L. Highest wonder, honest cost is 961 taps/pixel at R=15; kernel-texture and separable approximations change which creatures exist and must be disclosed; half-float minimum. https://raw.githubusercontent.com/Chakazul/chakazul.github.io/master/Lenia/WebGL/shadertoy/lenia1.glsl
12. **DiffLogic CA** — L. Bit-exact across GPUs, the best provenance story in the lane; GLSL ES 1.00 has no bitwise ops, so evaluate soft-gate arithmetic on {0,1} floats, which is exact; circuits are trained artefacts. https://google-research.github.io/self-organising-systems/difflogic-ca/

---

## Lane 5: Generative audio / seed sound

1. **AudioWorklet for all custom DSP** — S. Same-origin ES module fits no-build exactly; pass seed via processorOptions; ship no ScriptProcessorNode path. https://developer.mozilla.org/en-US/docs/Web/API/ScriptProcessorNode (spec: https://www.w3.org/TR/webaudio-1.1/)
2. **Autoplay gate handling** — S. Required, not optional: lazy context creation, resume() on pointerdown, reflect context.state in UI, visuals fully functional with sound off. https://developer.chrome.com/blog/web-audio-autoplay
3. **Karplus-Strong with seeded noise burst** — S. Best deterministic instrument: only randomness is the burst, so a seeded PRNG makes output bit-identical per machine; ~30 lines. http://amid.fish/javascript-karplus-strong **[undated source]**
4. **Two-operator FM recipes** — S. ~15 lines per voice, sample-free; seed maps to (ratio, index peak, decay); non-integer ratios give bell territory. https://www.pluginboutique.com/articles/1873-FM-Synthesis-Cookbook-Five-Classic-FM-Sounds-and-How-They-Work **[undated source]**
5. **Euclidean rhythms E(k,n)** — S. ~15 lines; (k, n, rotation) triple from the seed is a compact receipt-friendly rhythm genome. https://en.wikipedia.org/wiki/Euclidean_rhythm
6. **Incommensurate loops / phase music** — S. Most deterministic composition technique available: seed-derived coprime loop lengths determine the piece for all time, no runtime PRNG. https://teropa.info/blog/2016/07/28/javascript-systems-music.html
7. **OfflineAudioContext render receipts** — S. Hash seed + params for provenance; disclose that PCM hashes are per-machine-stable, not universal; enables pre-flight peak measurement. https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext
8. **Safety limiter chain with offline-measured gain staging** — S. Voices, envelope gains, master ~0.3-0.5, compressor, destination; render offline first and set per-seed master gain so the limiter is a backstop: a receipt-verifiable loudness guarantee. https://www.w3.org/TR/webaudio-1.1/
9. **Event-stream visual coupling first, AnalyserNode for texture only** — S. Scheduler events are provably a function of the seed; analyser-driven pixels are machine-dependent and should be disclosed as such. https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
10. **128-frame feedback clamp (disclosure footnote)** — S. Native-node feedback loops cannot produce fundamentals above ~344 Hz at 44.1 kHz; use the worklet for melody. https://developer.mozilla.org/en-US/docs/Web/API/DelayNode
11. **LUFS receipts (BS.1770 reimplementation)** — M. ~100 lines over the offline buffer; integrated LUFS + peak slot into receipts and enable cross-seed loudness matching. Algorithm reference only, not a dependency: https://github.com/domchristie/needles **[last activity unknown]**
12. **Strudel pattern-as-query core** — M. Pure function of time, deterministic, drives audio and visuals from one clock; reimplement from the manual (AGPL license on source, moderate confidence, verify). https://github.com/tidalcycles/strudel/wiki/Technical-Manual

---

## Lane 6: Control UX benchmark

Lane disclosure carried forward: shadertoy.com and openprocessing.org returned 403 to automated fetch; Shadertoy claims verified via Wikipedia.

1. **URL as document + history as undo/A-B (tixy)** — S. Seed + param bytes in URL, pushState on explicit commit; back/forward becomes free undo and two-tap A/B compare, no UI to build. https://tixy.land/ **[site undated; Nov 2020 launch tweet embedded]**
2. **Artwork contract: init(canvas, seed), params registry, setParam, onChange (cables.gl pattern)** — S. One interface drives gallery shell, receipt panel, URL restorer, future MIDI bridge. https://cables.gl/docs/4_export_embed/dev_embed_vars/dev_embed_vars **[undated source]**
3. **Five-slider visitor mode with co-creator credit (EditArt)** — S. A hard cap of five curated named sliders, chosen vector recorded in the receipt as a co-created variant; pure UI policy over the registry. https://www.electric-chronicles.com/articles/editart-generative-art-through-collaboration **[article undated; launch 2022 moderate confidence]**
4. **Reactive control binding (Observable viewof pattern)** — S. ~50-line pub/sub; the contract (element + value + change event) makes MIDI, URL, presets, and sliders interchangeable. https://observablehq.com/documentation/inputs/overview **[undated source]**
5. **Progressive-disclosure editor verbosity dial (twigl)** — S. Beginner mode explicit, terse mode auto-injects seed plumbing and boilerplate before compile. https://github.com/doxas/twigl **[feature dates unknown]**
6. **Stable per-work URLs + iframe embed + commented remixable source (Shadertoy, Fragments)** — S. One URL per artwork carrying seed + params, plus shipped utility modules per piece. https://en.wikipedia.org/wiki/Shadertoy (Fragments: https://tympanus.net/codrops/2025/10/17/fragments-a-platform-for-learning-creative-coding-with-shaders/)
7. **Typed param schema with byte serialization + per-param update modes (fxhash)** — M. Serialized bytes are the receipt; the update-mode enum tells the shell whether a drag patches a uniform live or re-runs the seeded render. https://docs.fxhash.xyz/creating-on-fxhash/fxhash-api/parameter-definition-specs.md **[undated source]**
8. **Deterministic fixed-framerate capture, one keystroke emits image + receipt JSON (twigl, Hydra)** — M. Step the clock manually per frame so exports are bit-reproducible; PNG via toBlob is S, self-written GIF encoder is the L part. https://github.com/hydra-synth/hydra **[undated READMEs]**
9. **Annotation-driven auto panel with XY pads and action buttons (OPENRNDR orx-gui)** — M. One params descriptor per sketch, shared builder emits DOM controls; panel state survives seed changes. https://raw.githubusercontent.com/openrndr/orx/master/orx-jvm/orx-gui/README.md
10. **Preset morph + seeded variation grid (ShaderVine UX, param-space port)** — M. Morph slider records (parentA, parentB, t); mutation grid with locked params excluded is the honest randomize+lock. https://meditations.metavert.io/p/shadervine-a-webgpu-shader-editor
11. **Canvas-to-code coordinate injection (Ronin) and scrubbable numbers + rendered-node stage picker (NodeBox)** — M each. Pointer events writing back into the same registry; the stage picker doubles as a process-disclosure surface. https://github.com/hundredrabbits/Ronin **[undated README]**, https://www.nodebox.net/node/documentation/tutorial/getting-started.html **[undated source]**

---

## Adopt now (max 12, cross-lane)

1. Fractal quality stack in one pass: soft shadows, orbit-trap coloring + fake AO, three-term lighting, tetrahedron normals, fog, ACES tone map. Six S-effort items, ~40 lines total, transforms any raymarched piece. (Lane 1, items 1-6)
2. Blue-noise dithered ray offset with seed recorded in the receipt. (Lane 1, item 8)
3. Particle Lenia as a zero-GPU-risk 2D-canvas ES module with fixed accumulation order. (Lane 4, item 1)
4. CPPN-to-GLSL seeded shaders; the seed regenerates the identical artwork. (Lane 4, item 2)
5. Gray-Scott with seeded (f,k) modulation across the Pearson crescent, half-float state. (Lane 4, item 3)
6. Flow fields + marching squares contours as the plotter-lane primitives, single-stroke SVG out. (Lane 2, items 1 and 3)
7. Hidden-line ridgeline terrain, ~30 lines, cheapest occlusion win. (Lane 2, item 2)
8. .vox reader/writer with byte-hash receipts, plus SDF-to-voxel seeded generators. (Lane 3, items 1 and 3)
9. Baked vertex AO + greedy-meshed chunk VBOs for the WebGL1 voxel display path. (Lane 3, items 2, 4, 6)
10. Audio starter: AudioWorklet + autoplay gate + seeded Karplus-Strong + Euclidean rhythms + offline render receipts + limiter chain with offline-measured gain. (Lane 5, items 1-3, 5, 7, 8)
11. Studio shell contract: URL-as-state with pushState undo, artwork interface (init/params/setParam/onChange), five-slider visitor mode. (Lane 6, items 1-3)
12. Fixed-framerate deterministic capture emitting image + receipt JSON on one keystroke. (Lane 6, item 8, PNG path first)

## Adopt later / research-grade

- Enhanced sphere tracing and temporal accumulation buffers (Lane 1, M; add when a fractal scene needs the budget or the live view needs convergence)
- Cone marching prepass (Lane 1, L; only after over-relaxation is exhausted)
- vpype-style four-pass export pipeline, hatch fill, stippling + TSP art, differential growth, WFC maps, isoline labeling (Lane 2, M; sequence them as the plotter lane matures)
- Occlusion culling occult-style (Lane 2, L; heavy geometry clipping)
- Per-pixel voxel DDA raycasting for the MagicaVoxel-render look (Lane 3, L; progressive enhancement over the meshed path)
- Mesh voxelization and full editor feature parity (Lane 3, L)
- Physarum, multi-scale Turing, particle life, microNCA (Lane 4, M; high wonder, each needs a WebGL1 texture-pipeline investment or trained weights with disclosure)
- Full 16-channel NCA, Grid Lenia, DiffLogic CA, LPPN reproduction (Lane 4, L; research-grade, trained artefacts and heavy tap counts; steal the 8-bit atan packing and the coarse-sim-plus-decode structure first)
- Strudel pattern-as-query core with rational time (Lane 5, M; unlocks one clock for audio and visuals)
- LUFS metering for loudness-normalized receipts (Lane 5, M)
- fxhash-style byte-serialized param schema, orx-gui auto panels, preset morphing and variation grids, canvas-to-code injection, scrubbable fields with stage picker (Lane 6, M; layer onto the shell contract once it exists)
