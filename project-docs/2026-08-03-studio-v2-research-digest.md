# Studio v2 Design Digest: Synthesis of the August 2026 Research Corpus

Reference vintage: three.js r185 (published 2026-07-01, GitHub API, high confidence). Corpus caveat carried forward: multiple 2026 SEO blogs give wrong three.js dates; only the GitHub releases API survived verification. Where a lane cited r184 as latest, that claim is superseded by the verified r185.

---

## 1. The frontier, honestly

**What the best tools do.**

- **Spark 2.x (World Labs, MIT, v2.1.0, WebGL2-only)** is the flagship three.js splat renderer: LoD splat tree with a hard per-frame splat budget (default 500K-2.5M), .RAD chunked streaming over HTTP Range requests, a shared LRU splat page table claimed at 1B+ splats on mobile, 16-byte PackedSplats internal encoding, worker-thread bucket sort, and the "dyno" shader-graph for GPU-side per-splat procedural effects. (high confidence)
- **PlayCanvas 2.19.0 (June 2026)** defines the performance ceiling: WebGPU compute cull + project + GPU radix sort, measured 1.1x at 2M splats to 5.7x at 35M (Apple M4 Max), ~2x on iPhone 13 Pro Max, with automatic WebGL2 fallback to the classic worker CPU sort. SuperSplat is the leading open splat editor; SOG and Streamed SOG (chunks + manifest with LODs) are the pragmatic static-hosting formats. (high confidence)
- **three.js r183-r185** has consolidated on: one Renderer frontend over swappable WebGPU/WebGL2 backends, TSL as a typed shader IR with a written spec compiling to WGSL or GLSL, node-based declarative post-processing (RenderPipeline, r183), reversed-z, compute passes as pipeline nodes, and built-in memory/draw telemetry (Inspector Memory tab, r184). Release cadence is now roughly quarterly. (high confidence)
- **WebGPU is baseline**: Safari 26 shipped September 2025; coverage widely reported at ~85-95% with WebGL2 fallback covering the rest. Exact percentages come from secondary sources, not primary measurement. (moderate confidence)
- **The culture around us**: Spline Hana makes 2D-to-3D lifting consumer-grade (cloud, closed, no provenance); Marble generates navigable splat worlds from a single image (funded at $1B, cloud-only); fxhash enforces a seed-to-identical-output determinism contract as platform law, but chain-anchored and market-coupled; C2PA/Content Credentials went mainstream with EU AI Act Article 50 machine-readable disclosure enforcement beginning August 2026. (moderate-to-high confidence per item)

**What none of them do.**

- three.js core has NO official Gaussian splat support through r185. Zero mentions across three release cycles. The practice bar is third-party. (high confidence)
- No mainstream web renderer ships a stochastic sort-free splat mode as of August 2026 (StochasticSplats exists in research + Evergine's WebGPU add-on only). (moderate confidence)
- No shipped audio-reactive or self-reenacting splat exemplar surfaced in searches. Honest null: only the building blocks exist separately. (moderate confidence)
- Not one surveyed studio tool (cables, OpenProcessing, Spline, SuperSplat, Marble, compute.toys) embeds provenance, receipts, or a determinism contract on output. The intersection of determinism + offline/no-CDN + cryptographic receipts + owned renderer is empty. That empty intersection is the Studio's position.

---

## 2. What we adopt as REFERENCE (port ideas, not code)

### From three.js architecture (r183-r185 changelogs)
| Technique | Source | What we port |
|---|---|---|
| Frontend/backend renderer split | three.js WebGPURenderer | A backend abstraction seam in the owned renderer: render plan vs device-owning backend, sized so WebGPU can land later as a probe-gated max tier |
| Typed shader IR | TSL spec (TSL.md, r183; 3x compile speedup r184) | A minimal owned IR, a few hundred lines, emitting GLSL ES 1.00 today and WGSL later; kills per-tier shader string duplication |
| Declarative pass graph | RenderPipeline rename, r183 (#32789) | Formalize the splat-budget render plan into a small named-pass graph with cached state |
| Per-frame telemetry | Inspector Memory tab, r184 (#33097) | Per-pass memory/draw stats emitted into the existing receipt system |
| Baked probe-grid relighting | LightProbeGrid, r184 (#33125) | A candidate world-package record type for relighting hybrid mesh+splat scenes |

### From the splat-renderer field
| Technique | Source | What we port |
|---|---|---|
| Worker bucket/radix sort, fixed-point keys | Spark SplatWorker; mkkellogg non-SAB path | Upgrade the owned sorter today; SharedArrayBuffer needs COOP/COEP that GitHub Pages cannot serve, so the non-SAB path is the reference (high confidence) |
| Packed GPU encoding + parallel semantic array | Spark 16-byte PackedSplats | Packed GPU-side records with kind/seed kept CPU-side |
| LoD tree + hard splat budget + Range streaming | Spark 2.0 .RAD; SuperSplat Streamed SOG | Precomputed LoD at package-build time (hashable artifacts), coarse-to-fine via HTTP Range, which works on GitHub Pages (high confidence) |
| Columnar quantized compression | SPZ v4 (24-bit fixed pos, 8-bit log scale, 8-bit color/alpha; version number moderate confidence) | Compressed world-package variant, roughly 3-4x smaller; gzip via native DecompressionStream for zero-dependency decode |
| GPU radix sort on compute | PlayCanvas 2.19 | Future WebGPU max tier only; the measured curve says GPU sort pays off above a few million splats, which validates the current worker sort at world-package scale |

### From rendering research
| Technique | Source | What we port |
|---|---|---|
| Stochastic sort-free transparency | StochasticSplats (ICCV 2025), plain OpenGL fragment shaders, >4x faster | Hash/blue-noise alpha discard + z-buffer + temporal accumulation; per-splat seed field is the natural RNG input; disclosed as "converges over N frames" (high confidence on technique, moderate on WebGL1 port) |
| TAA in WebGL2 | Halton jitter + camera reprojection + neighborhood clamp (alextardif.com; three.js TAA pass as existence proof) | One history RT, one resolve pass; denoises stochastic splats, stabilizes shimmer, upgrades mesh edges (high confidence) |
| Perspective-correct inversion-free splat evaluation | Hahlbohm et al., arXiv 2410.08129 | Portable into the existing WebGL1 shader independent of tiers |
| Coarse chunk sort + weighted-sum blending | Duplex-GS, arXiv 2508.03180 | Low/mid-tier no-noise fallback (moderate confidence) |
| Hybrid k-buffer transparency | Hahlbohm et al. | WebGPU-tier quality ceiling, eventual |
| Optional SH1 view-dependence | web splat viewer practice | ~12-byte quantized block, tier-gated, labeled "SH1 approximation, not full radiance" (moderate confidence) |

### For the time axis
| Technique | Source | What we port |
|---|---|---|
| Analytic per-splat temporal block | Spacetime Gaussians (CVPR 2024) | Quantized temporal center, sigma, low-order motion coefficients; 8-16 bytes/splat; deterministic, WebGL1-expressible, hash-stable (high confidence) |
| Scene-level Eulerian loop field | LoopGaussian (ACM MM 2024) | A few coefficients or tiny grid in the package header, bidirectional looping; labeled "procedural temporal interpretation" |
| WebGL existence proof | splaTV (antimatter15, MIT) | Readable shader math to study, not a dependency |
| Rejected branch | 4DGaussians deformation fields | NOT taken: needs training data, opaque priors, weights are not a disclosure. Knowing the mainline makes "we chose scripted fields" a defensible disclosure, not a limitation |
| Keyframe+delta captured 4D | .splat4d GOP format | On file for the future; its sizes (megabytes per second) argue for scripted fields now |

### For the optional in-browser builder (lab module, never load-bearing)
- Depth: **Depth Anything V2 Small** fp16, ~50 MB, Apache-2.0, ship-now baseline; DA3-Small (Apache-2.0) held as the A/B upgrade once quantized exports land; DA3 Large/Giant are CC BY-NC and excluded. (high confidence)
- Masks: **SlimSAM** (5.5M params) via transformers.js on all tiers; SAM2 via ONNX Runtime Web on high tier with ORT pinned (1.21.x broke SAM on WebGPU; the regression validates pin-and-receipt discipline). (high confidence)
- Matting: **BiRefNet (MIT) or MODNet (Apache-2.0, license from memory, moderate confidence)**; RMBG-2.0 excluded (non-commercial).
- Timing: no reproducible browser benchmarks exist for these models (low confidence on any third-party number). Measure on-device per tier, publish with denominator and interval.

---

## 3. What we vendor vs own

**three.js: port ideas, do not vendor.** The decisive facts:

1. **Floor mismatch.** three.js's compatibility floor is now WebGL2 (WebGPURenderer with automatic WebGL2 fallback); its WebGL1-era renderer is frozen out of all new material and node features. Adopting it abandons our WebGL1 floor rather than strengthening it. (high confidence)
2. **Not single-file.** three.webgpu.js imports ./three.core.js; three.tsl.js imports the bare specifier 'three/webgpu' requiring an import map. Verified by reading the shipped files. Strict vendoring means 2-3 files plus an import map, or an owned offline bundling step, for ~652 KB minified before addons, mostly duplicating what we own. (high confidence)
3. **Nothing splat-shaped to inherit.** No official splat support exists through r185.

**Spark 2.1.0** is the only maintained candidate if a three.js path is ever wanted: MIT, ships as one spark.module.js. Blocker before any vendoring: it has a Rust-built WASM component and the docs do not state whether the WASM is inlined or fetched as a side file. Offline test required first. mkkellogg/GaussianSplats3D is end-of-life (README recommends Spark); gsplat.js is dormant (last release 2024-07-12). (high confidence)

**transformers.js v4** for the optional builder only: vendorable as same-origin static files (JS bundle + pinned .wasm sidecars + model files), which satisfies the no-CDN rule but not the literal single-file preference; handled with a multi-file SHA-256 receipt manifest and version pinning. (high confidence)

**Everything render-path is owned.** All Section 2 techniques are implementable in plain shaders plus, at the max tier only, at most two small WGSL compute kernels, all vendorable, no runtime network deps.

Upstream watch cost: quarterly. The r183 (Feb) / r184 (Apr) / r185 (Jul) cadence makes a once-per-quarter release-notes review near-zero effort.

---

## 4. The distinctive thesis

The 2026 frontier decomposes into four capabilities held by different tools: splat-native LoD rendering (Spark, SuperSplat), browser GPU compute (compute.toys, three.js TSL), AI-inside-the-canvas (Spline Hana, Marble, OpenProcessing's 2026 batches), and determinism-plus-provenance (fxhash's contract, C2PA infrastructure). **No surveyed tool holds more than two. The intersection of all four plus offline self-custody is empty.**

The moat, concretely:

- **Receipts.** SHA-256 over source image, interpretation chain, splat records, and per-pass render telemetry. C2PA went mainstream this month via EU AI Act Article 50, and not one competitor ships anything. Expressing world-package receipts as an offline, self-generated C2PA-style manifest converts existing discipline into legible distinction.
- **Determinism.** fxhash proves seed-to-identical-output is a culture collectors trust, but theirs is chain-anchored and platform-hosted. We publish the same contract off-chain, testable via the seed field already in the 40-byte record, with full offline self-custody. No chain platform can match that combination.
- **Two-lane honesty.** Marble and Spline generate; their outputs carry no provenance and their motion/depth comes from opaque priors. Our scripted temporal fields and semantic depth meshes are authored math with an honest label: "procedural temporal interpretation of a still image." The disclosure IS the differentiation, because diffusion-based single-image 4D cannot honestly claim its motion derives from the artwork.
- **Open editions.** Static files on GitHub Pages, no CDN, no cloud, no account. Even the offline-first leader (cables standalone) ships zero provenance; the provenance leaders (fxhash) ship zero offline self-custody.
- **Semantic records.** The kind+seed fields in the 40-byte record have no equivalent in Spark's records or SuperSplat's PLY model. Semantic world packages are genuinely ahead, not behind.

Strategic negatives, equally load-bearing: do not build a general node editor (cables took a decade; nodes.io is a near-decade beta), do not compete on raw generation (Marble's $1B says that ground is lost), do not compete on community (not a single-maintainer lane). Capability parity where it is cheap, provenance leadership where the field is empty.

---

## 5. Staged capability roadmap

### Stage A: this PR (foundation, all owned, no new deps)
1. **Sorter upgrade**: fixed-point distance keys + radix/bucket sort in a web worker (Spark SplatWorker and mkkellogg's non-SAB path as references). Immediate win on the existing WebGL1 floor.
2. **Perspective-correct splat math**: port the inversion-free evaluation (arXiv 2410.08129) into the existing shader. Tier-independent quality gain.
3. **Named-pass render graph**: formalize the splat-budget render plan into a small pass graph (declare read/write targets, topo-sort, RT pooling; ~300 lines). Wrap every pass in timing where available; WebGL timings labeled "aggregate CPU-side timing only" when the timer-query probe fails (EXT_disjoint_timer_query availability is historically unstable, high confidence).
4. **Determinism contract, stated**: publish the seed-to-identical-output guarantee for world packages as a testable claim, plus a C2PA-style offline manifest (source-image hash, interpretation chain, splat-record hash, disclosure label). This is mostly documentation of discipline that already exists.

### Stage B: next (compression, streaming, time, and the first tier-above feature)
1. **Compressed package variant**: SPZ-inspired columnar quantization (24-bit fixed pos, 8-bit log size, 8-bit color/alpha, kind/seed as raw columns), gzip via native DecompressionStream, plaintext header carrying the receipt. Roughly 3-4x smaller, zero dependencies.
2. **LoD + streaming**: precomputed LoD levels at package-build time (hashable), coarse-to-fine loading via HTTP Range requests on GitHub Pages, hard per-frame splat budget per tier (Spark 2.0 shape).
3. **TAA**: Halton-jittered projection, camera-only reprojection (scenes are static worlds under camera motion), neighborhood-clamped history. One float RT, one resolve pass. Prerequisite for item 4.
4. **Stochastic sort-free mode** on mid/high tiers: blue-noise alpha discard + z-buffer + TAA accumulation, seeded from the per-splat seed field, disclosed as "stochastic, converges over N frames." No mainstream renderer ships this; first claimable tier-above feature. Duplex-style coarse chunk sort + weighted-sum blending as the no-noise low-tier fallback.
5. **Scripted time axis**: Spacetime-Gaussians-style temporal block (8-16 bytes/splat) + LoopGaussian-style Eulerian loop field in the header, evaluated in the vertex shader, tier-gated (low: temporal opacity only; mid: +drift; high: +full trajectories). Label: procedural temporal interpretation.
6. **Optional SH1 block**: ~12 bytes/splat, tier-gated, "SH1 approximation" label.

### Stage C: research-grade (the max tier and the lab)
1. **Backend seam + shader IR**: split frontend render plan from a device-owning backend; minimal typed shader IR emitting GLSL ES 1.00 and WGSL from one source. Sized in the low hundreds of lines each, TSL-inspired, not TSL.
2. **WebGPU max tier**: probe-gated on navigator.gpu, owned WGSL radix sort + cull/project compute prepass (PlayCanvas 2.19 shape, proven 2-5.7x), reversed-z, per-pass timestamp queries (~99% of WebGPU configs, disclose Chrome's 100us quantization in the receipt). WebGL path remains the automatic fallback and the honest floor. Hybrid k-buffer transparency as the quality ceiling here.
3. **In-browser world-package builder** as an optional lab module, never load-bearing: transformers.js v4 pinned and receipted, DA2-Small fp16 depth, SlimSAM masks, BiRefNet or MODNet matting, WASM fallback on low tier, feature disappears cleanly behind a disclosure label if /models is absent. All latency numbers measured on-device per tier with denominators and intervals; no third-party timing claims.
4. **Audio-reactive fields**: Web Audio analyser bands driving the temporal field's phase/amplitude uniforms. Searches found no shipped audio-reactive splat exemplar (honest null, moderate confidence), so this is claimable ground at near-zero cost.
5. **Watch items, not integrations**: SAM 3 text-prompted concept masks (custom Meta license, immature ports); DA3-Small quantized exports; Spark WASM-inlining verification; baked light-probe-grid record type for relighting; .splat4d GOP pattern if true captured 4D is ever wanted.

---

*Corpus discipline notes carried forward: three.js version facts verified against the GitHub API only; SPZ version 4 needs header-constant verification before implementing (moderate confidence); Spark WASM inlining unverified (offline test before any vendoring); no reproducible browser ML inference benchmarks exist (low confidence on all third-party timings); WebGPU coverage percentages are secondary-sourced (moderate confidence). Honest nulls retained: no official three.js splat support, no shipped stochastic web renderer, no shipped audio-reactive splat exemplar.*
