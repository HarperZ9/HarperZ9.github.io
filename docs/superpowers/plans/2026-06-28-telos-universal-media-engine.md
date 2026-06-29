# Telos Universal Media Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope and build Project Telos into a hardware-scaled, graph-native, format-agnostic universal media engine that can edit, simulate, render, verify, and exchange every media class through one interoperable substrate.

**Architecture:** Telos becomes a system of small engine organs, not a single page script. Every organ speaks through typed ports, a Canonical Media IR, conversion receipts, and hardware-scaled execution plans. The Studio becomes one editor shell plugged into this substrate; CLI, MCP, IDE, TUI, and application surfaces consume the same graph and receipt contracts.

**Tech Stack:** Browser ES modules, WebGPU, WGSL, WebGL2, Canvas2D, OffscreenCanvas, Workers, existing Studio import/export/perception modules, existing shared-frame receipt modules, future native/CLI adapters, and optional WASM bridges for heavyweight codecs and scientific formats.

## Related State Docs

- `C:\dev\public\telos\docs\CURRENT-STATE.md` records the current five-flagship state, moving-target refresh rule, and engine-lineage boundary.
- `C:\dev\public\telos\docs\QUALITY-TOOL-REVIVAL.md` records the quality-tool promotion boundary for older tools, `studio-engine`, and `reconcile`.
- `docs/superpowers/research/2026-06-28-project-telos-current-state-and-research-os.md` records the Studio-side research OS and engine implications.

## Global Constraints

- No false capability claims: the public Studio may show roadmap organs, but runnable code must label what is implemented, planned, or simulated.
- Format-agnostic means adapters over a canonical IR, not one-off import hacks.
- Every conversion must emit a conversion receipt with conserved fields, dropped fields, fidelity verdict, source hash, result hash, and round-trip test status when available.
- Every hardware path must degrade WebGPU -> WebGL2 -> WebGL1/Canvas2D/CPU without breaking the editor.
- Every graph evaluation must produce an evaluation receipt that joins input node ids, output ids, and runtime backend.
- Every user-facing editor surface must be keyboard reachable, reduced-motion safe, and testable without a GPU.
- Keep files focused. `system/studio.js` is already too large; new engine work belongs under `system/engine/`, `system/graph/`, `system/media/`, and `system/editor/`.

## Research And Competitive Baseline

This plan uses current public references as of 2026-06-28, with fresh receipts from Gather/ArXiv and official vendor docs:

- Blender: reference breadth across modeling, Geometry Nodes, compositor, animation, Grease Pencil, Cycles, EEVEE, and viewport from the official Blender 4.5 LTS release notes and release page.
- Houdini: reference procedural depth, Solaris/Karma, Copernicus image processing, GPU Pyro, ML tools, and Gaussian Splats from SideFX Houdini 21 materials.
- TouchDesigner: reference operator-family design and live GPU point processing from the TouchDesigner 2025 POPs release notes.
- DaVinci Resolve: reference timeline, Fusion node compositing, Fairlight audio, color workflows, media pages, and AI-assisted editing from Blackmagic Design Resolve 20/21 materials.
- Gaussian Splatting: Gather receipt `2308.04079v1`, "3D Gaussian Splatting for Real-Time Radiance Field Rendering"; receipt `2402.13827v2`, clustering unnecessary Gaussians for fast rendering; receipt `2411.11363v1`, GPS-Gaussian+ sparse-view real-time rendering; receipt `2602.03207v1`, "WebSplatter: Enabling Cross-Device Efficient Gaussian Splatting in Web Browsers via WebGPU".
- WebGPU: W3C WebGPU and WGSL specs define the browser-native GPU compute/render target.
- OpenUSD: OpenUSD is the target scene interchange spine for assets, shots, worlds, variants, layers, materials, lights, animation, and physics.
- glTF: Khronos glTF remains the runtime 3D delivery target for efficient web/native scene transfer.
- OpenColorIO: OCIO/ACES-style color management is the target color transform contract for image, video, render, and texture workflows.

The intent is not to copy Blender, Houdini, TouchDesigner, or DaVinci Resolve. The target is a media operating system that can interoperate with all of them while adding agent-native receipts, provenance, verification, and hardware-scaled execution.

## Existing Organs To Preserve

- Atelier generators: `system/atelier.js` contains deterministic generative studies, specimen-driven fields, reaction diffusion, physarum, boids, hydrogen orbitals, plotter paths, and SVG export behavior.
- Fractal renderers: `system/fractal.js`, `system/fractal-gl.js`, and `system/fractal3d.js` cover CPU/WebGL fractals and raymarched 3D fractals.
- nD geometry: `system/lib/render-nd/` contains polytopes, rotations, projection, embedding, depth sorting, picking, paint state, and WebGL/raster backends.
- Particle and hardware scale: `system/engine/capability.js`, `governor.js`, `gpu-particles.js`, workers, and WebGPU/WebGL2/CPU particle backends already form a first hardware ladder.
- Import/export spine: `system/importers.js` and `system/exporters.js` already parse images, video, audio, SVG, OBJ, GLTF, PLY, CSV, JSON, emit receipts, and export PNG, JSON, OBJ, GLTF, SVG, WebM.
- Perception and evidence: `system/sense.js`, `shared-frame/eye.js`, `shared-frame/certificate.js`, `shared-frame/audit-log.js`, and discovery artifacts are the measured evidence layer.
- Scientific discovery: `system/discovery/` includes governed physical systems, integrators, expression verification, Noether-style tooling, quantum experiments, creative generators, and IO protocol tests.

## Target Organs And Interfaces

### Node Graph Runtime

**Responsibility:** The graph is the engine's execution language. It holds nodes, typed ports, edges, dirty-state propagation, evaluation order, caching, receipts, and backend hints.

**Inputs:** `GraphDefinition`, node registry, current `HardwareRenderPlan`, assets from `Asset Graph and Import/Export Spine`.

**Outputs:** `GraphEvaluationResult`, `EvaluationReceipt`, updated media handles, warnings, backend usage telemetry.

**Minimal interface:**

```js
evaluateGraph(graph, registry, context) -> {
  outputs: Map<string, MediaHandle>,
  receipts: EvaluationReceipt[],
  telemetry: GraphTelemetry,
}
```

**Must support:** acyclic graphs first, explicit cycle rejection, lazy evaluation by requested outputs, deterministic hashes, node-local state, and headless tests.

### Shader and Material Graph

**Responsibility:** Turn visual node graphs into backend-specific shader programs and material bindings.

**Inputs:** shader nodes, material nodes, geometry streams, textures, color transforms, time/audio uniforms.

**Outputs:** WGSL, GLSL ES 3.00, GLSL ES 1.00 fallbacks, Canvas2D shaderless fallback instructions, compile receipts.

**Must support:** real shaders, not CSS effects; compile diagnostics; shader cache by source hash; uniform layouts; texture/sampler binding maps; WebGPU compute, vertex, and fragment stages; WebGL2 transform feedback when compute is unavailable.

### Hardware Render Planner

**Responsibility:** Convert user hardware and scene load into concrete execution budgets.

**Inputs:** capability probe, user tier override, viewport size, DPR, reduced motion, scene complexity, graph node hints.

**Outputs:** `HardwareRenderPlan`.

**Plan fields:**

```js
{
  tier: "low" | "mid" | "high" | "max",
  backend: "webgpu" | "webgl2" | "webgl1" | "canvas2d" | "cpu",
  workerMode: "worker" | "main",
  particleBudget: number,
  splatBudget: number,
  textureMax: number,
  renderScale: number,
  shaderQuality: "basic" | "standard" | "high" | "path",
  readbackEveryNFrames: number,
  postPassBudget: number,
}
```

**Must support:** native hardware scaling, not one static quality path. Existing `capability.js` and `governor.js` are the foundation; this organ generalizes them beyond particles.

### Scene and Geometry Kernel

**Responsibility:** Hold editable scene state: objects, transforms, cameras, lights, meshes, curves, splats, volumes, materials, constraints, selections, and handles.

**Inputs:** Canonical Media IR scene documents, imported geometry, generated geometry, graph outputs, user edits.

**Outputs:** scene graph handles, geometry buffers, selection state, transform receipts, exportable scene packages.

**Must support:** 2D, 3D, 4D+ transforms; mesh and model transforms; curves; point clouds; Gaussian Splatting; volumes; simulation geometry; exact user-space/object-space/world-space transform records.

### Simulation and Physics Kernel

**Responsibility:** Provide simulation nodes that can drive visual, scientific, and creative media.

**Inputs:** scene state, graph parameters, time, audio/sensor streams, physical constants, solver configs.

**Outputs:** state buffers, field textures, trajectories, invariant checks, solver receipts.

**Domains:** particles, rigid bodies, soft bodies, cloth, fluids, reaction diffusion, cellular automata, boids, swarm systems, vector fields, n-body, quantum toy systems, conservation-law discovery.

### Image, Compositing, and Pixel Lab

**Responsibility:** Provide image editing, compositing, glitch, dithering, pixel sorting, poster/plotter transforms, LUTs, EXR/HDR workflows, and OCIO-style color transforms.

**Inputs:** raster layers, vector layers, masks, depth/normal passes, video frames, shader outputs, graph controls.

**Outputs:** composited frames, layer stacks, edit receipts, exports.

**Must support:** non-destructive stacks, blend modes, masks, procedural generators, print/plotter modes, dithering, halftone, channel ops, pixel sorting, temporal effects, and color-managed preview/export.

### Timeline, Sequencer, and State Transport

**Responsibility:** Time is first-class. A graph can be evaluated at frame/time, and all edits can be sequenced.

**Inputs:** media clips, graph parameters, keyframes, animation curves, audio clocks, live streams, action receipts.

**Outputs:** timeline state, rendered frames, transport receipts, export manifests.

**Must support:** DAW/NLE-style timeline, graph parameter automation, multi-track media, clip effects, nested timelines, undoable state deltas, and headless bounded render jobs.

### Audio and Signal Engine

**Responsibility:** Audio is not just a reactive visual input; it is an editable media domain.

**Inputs:** WAV, AIFF, FLAC, MP3, MIDI, live input, FFT/spectral data, graph modulation.

**Outputs:** audio buffers, MIDI events, envelopes, spectral textures, rendered stems, reactive uniforms, receipts.

**Must support:** analysis, synthesis, modulation routing, envelope followers, MIDI mapping, timeline sync, spectrum displays, and sample-accurate provenance where possible.

### Asset Graph and Import/Export Spine

**Responsibility:** The engine is agnostic and entirely interoperable with all formats through adapters.

**Inputs:** Files, URLs, live streams, blobs, archives, database rows, API resources, MCP resources.

**Outputs:** Canonical Media IR documents, MediaHandles, export packages, conversion receipts.

**Must support:** plugin adapters for any format without changing the editor core.

### Canonical Media IR

**Responsibility:** The canonical IR is the internal language between all adapters and engine organs.

**Required document classes:**

- `media.scene`: scene graph, transforms, materials, cameras, lights, animation, USD-style layers.
- `media.mesh`: vertices, indices, normals, tangents, UVs, materials, skinning, morph targets.
- `media.splat`: Gaussian Splatting centers, covariance/scale/rotation, SH/color, opacity, clustering metadata.
- `media.volume`: voxels, sparse grids, fields, scalar/vector semantics.
- `media.image`: pixels, layers, color space, alpha, masks, depth, normal, metadata.
- `media.video`: frames, tracks, timecode, audio links, color space, proxies.
- `media.audio`: samples, channels, sample rate, spectral analysis, MIDI links.
- `media.vector`: SVG/Bezier/path/plotter geometry, units, strokes, fills.
- `media.table`: CSV/JSON/Parquet-like tabular data, schema, units, provenance.
- `media.shader`: source, stage, uniforms, varyings, resources, compile target.
- `media.graph`: nodes, ports, edges, defaults, evaluation metadata.
- `media.receipt`: import, export, transform, graph evaluation, verification, admission, and execution receipts.

### Format Adapter Contract

**Responsibility:** Every format adapter is a reversible-or-honest bridge between external formats and canonical IR.

```js
adapter = {
  id: "gltf",
  match(fileOrResource) -> boolean,
  import(input, context) -> { ir, receipt },
  export(ir, context) -> { bytes, mime, extension, receipt },
  canRoundTrip(ir) -> boolean,
  fidelity(ir, bytesOrIr) -> FidelityVerdict,
}
```

**Receipt requirements:** every adapter emits a conversion receipt with conserved fields, dropped fields, fidelity verdict, origin hash, result hash, adapter version, warnings, and round-trip test status.

### Interoperability Matrix

**Initial matrix targets:**

- 3D/scene: OpenUSD, USDA, USDC, USDZ, glTF, GLB, OBJ, FBX via future native bridge, STL, PLY, Alembic via future bridge.
- Image: PNG, JPEG, WebP, AVIF, TIFF, EXR, SVG, PSD via future bridge, Krita/ORA via future bridge.
- Video: WebM, MP4, MOV via browser/native bridge, image sequences.
- Audio: WAV, AIFF, FLAC, MP3, OGG, MIDI.
- Data/science: CSV, JSON, JSONL, Parquet via future WASM/native bridge, HDF5/Zarr via future bridge, FASTA/PDB/mmCIF for bio/science adapters.
- Shader/material: WGSL, GLSL, MaterialX via future adapter, OCIO config/LUTs.
- Project/editor: Telos graph package, receipt bundles, MCP resource bundles, CLI package manifests.

### Agent, Provenance, and Receipt Layer

**Responsibility:** Agent work is native, not bolted on. Every graph, edit, render, import, export, verification, and model action can be receipt-chained.

**Inputs:** action proposals, admission decisions, graph evaluations, tool executions, user edits, external sources.

**Outputs:** action receipts, admission records, verification verdicts, export receipts, ledger entries, conformance fixtures.

**Must support:** `MATCH`, `DRIFT`, `UNVERIFIABLE`; normalized failure codes; no raw prompt/tool-arg leakage by default; join fields across proposed action, admission record, and execution span.

### Editor Shell and Interaction Model

**Responsibility:** Studio becomes an editor/harness, not a presentation page.

**Surfaces:**

- command palette
- scene graph/outliner
- node graph editor
- shader graph editor
- timeline/sequencer
- inspector/properties panel
- modifier stack
- asset browser
- render viewport
- signal/audio monitor
- receipt ledger
- hardware profiler
- export/delivery panel

**Must support:** dense tool UI, keyboard shortcuts, focus-visible navigation, inspector editing, drag/drop, multi-select, undo/redo, saved workspaces, and headless execution of the same graph.

### Hardware Scaling Contract

**Responsibility:** Telos must scale to user hardware natively.

**Rules:**

- Probe once, plan per scene, govern continuously.
- Low: CPU/Canvas2D, low particles/splats, low readback cadence, reduced post passes.
- Mid: WebGL2 transform feedback/raster, moderate particle/splat budgets, standard shaders.
- High: WebGPU compute/render, workers, larger buffers, high shader quality, Gaussian Splatting.
- Max: desktop-class WebGPU, multi-pass post, high texture/splat budgets, bigger graph batches.
- Reduced motion always floors motion-heavy systems to safe/low, regardless of GPU.
- Browser path must work without cross-origin isolation; native/desktop path may enable SharedArrayBuffer, filesystem watchers, native codecs, and GPU-native interop.

## Phase 0: Scope The Engine Organs

- [ ] Create this plan and keep it test-backed with `tests/test_engine_assembly_scope.py`.
- [ ] Add `docs/engine/ENGINE-ASSEMBLY.md` as the stable architecture map once the first runtime organ lands.
- [ ] Add a Studio-facing summary that clearly separates implemented organs from planned organs.
- [ ] Add an issue/ledger entry for each organ so work can be resumed by graph, renderer, media, editor, or provenance agents independently.

**Acceptance Criteria:** the scope artifact names every organ, every required contract, and every evidence gate. The static scope test passes.

## Phase 1: Graph Runtime Spine

- [x] Create `system/graph/runtime.js` with typed nodes, ports, edges, topological evaluation, dirty caching, cycle rejection, and evaluation receipts.
- [x] Create `system/graph/runtime.test.mjs`.
- [x] Add node types: constant, passthrough, math, image-effect, mesh-transform, shader-source, render-target.
- [x] Connect `studio-effects.js` and `mesh-transform.js` as graph nodes, not only button handlers.
- [x] Emit `media.receipt` IR outputs from render-target graph nodes.
- [x] Emit `media.graph` project package outputs for saved/editable graphs.

**Acceptance Criteria:** node graphs evaluate deterministically in Node tests; cycles produce `UNVERIFIABLE` receipts; existing effects and mesh transforms can run through graph nodes.

## Phase 2: Hardware Render Planner

- [x] Create `system/engine/render-plan.js` and tests.
- [x] Generalize `capability.js` beyond particles into `HardwareRenderPlan`.
- [x] Add budgets for particles, splats, texture size, render scale, post passes, readback cadence, and shader quality.
- [ ] Integrate render planner into music particles, fractal renderers, nD renderer, and future Gaussian Splatting.
- [x] Surface hardware plan in Studio status bar with real backend, tier, budgets, and fallback reason.

**Acceptance Criteria:** tests prove low/mid/high/max plans; reduced motion floors heavy motion; forced tiers clamp to hardware; browser QA shows the status bar without console errors.

## Phase 3: Canonical Media IR And Format Adapters

- [x] Create `system/media/ir.js` with document schemas and validation helpers.
- [x] Create `system/media/adapters.js` with Format Adapter Contract registry.
- [x] Wrap current `importers.js` and `exporters.js` through adapters.
- [x] Add conversion receipts with conserved fields, dropped fields, fidelity verdict, and round-trip test status.
- [ ] Add adapters for OBJ, glTF, SVG, PNG, JSON, CSV, WAV, and WebM first.
- [ ] Add OpenUSD design adapter as a schema-only bridge until native/WASM support lands.

**Acceptance Criteria:** each adapter has import/export tests where feasible; conversion receipts are emitted; unknown formats produce honest `UNVERIFIABLE` adapter receipts rather than silent failures.

## Phase 4: Shader, Material, And Render Graph

- [ ] Create `system/graph/shader-graph.js` and tests.
- [ ] Create a small material node vocabulary: color, texture, noise, normal, metallic/roughness, emission, alpha, displacement.
- [ ] Compile to WGSL for WebGPU and GLSL for WebGL2/WebGL1 where possible.
- [ ] Add compile receipts with source hash, target backend, errors/warnings, and fallback path.
- [ ] Add a graph-driven render pass that can feed Canvas2D fallback, WebGL2, or WebGPU.

**Acceptance Criteria:** shader graphs compile to at least WGSL and GLSL for a simple material; compile errors are captured as receipts; fallback material renders when GPU compile fails.

## Phase 5: Universal Editor Shell

- [ ] Split Studio into editor modules under `system/editor/`.
- [ ] Add command palette, outliner, node graph panel, inspector, modifier stack, timeline, asset browser, hardware profiler, and receipt ledger.
- [ ] Make current source panels into tools or graph templates, not separate demos.
- [ ] Add project save/load using Canonical Media IR graph packages.
- [ ] Add headless graph execution for CLI/MCP and browser editor parity.

**Acceptance Criteria:** Studio feels like an editor because users can create a graph, inspect nodes, transform assets, sequence parameters, export formats, and review receipts from one shell. The same graph can execute in headless tests.

## Phase 6: Beyond Single-App Editors

- [ ] Build OpenUSD scene exchange.
- [ ] Build Gaussian Splatting import/render/edit pipeline with WebGPU first, WebGL fallback, and clustering LOD.
- [ ] Build timeline compositor with image/video/audio tracks.
- [ ] Build DAW-style audio graph and MIDI routing.
- [ ] Build scientific media adapters for PDB/mmCIF, FASTA, volumetric data, CSV/Parquet, and research artifact bundles.
- [ ] Build agent-driven find/fix/crawl graph for repositories using Gather, Index, Forum, Crucible, and Telos receipts.

**Acceptance Criteria:** Telos can ingest, edit, render, and export across media domains while retaining provenance and conversion receipts. It can run as web editor, CLI, MCP server, plugin/superpower, and full app harness.

## Evidence Gates

- Static scope gate: `python -m pytest tests/test_engine_assembly_scope.py -q`.
- Graph runtime gate: `node --test system/graph/runtime.test.mjs`.
- Render planner gate: `node --test system/engine/render-plan.test.mjs system/engine/capability.test.mjs system/engine/governor.test.mjs`.
- Adapter gate: `node --test system/media/*.test.mjs system/importers.test.mjs system/exporters.test.mjs`.
- Studio contract gate: `python -m pytest tests/test_studio_showcase.py -q`.
- Browser QA gate: serve `studio.html`, load in Playwright, verify zero console errors/warnings and presence of editor shell, graph, hardware, and receipt affordances.
- Interoperability gate: each format adapter must prove at least one round-trip, lossy conversion receipt, or explicit unsupported verdict.

## Current Implementation Notes

Implemented in this slice:

1. `system/graph/runtime.js`
2. `system/graph/runtime.test.mjs`
3. `system/engine/render-plan.js`
4. `system/engine/render-plan.test.mjs`
5. `system/media/ir.js`
6. `system/media/adapters.js`
7. `system/media/studio-adapters.js`
8. `system/graph/nodes/media-nodes.js`
9. `system/graph/package.js`
10. `system/graph/package.test.mjs`
11. Studio status/editor summary wiring for graph runtime, graph-native media nodes, hardware plan, Canonical Media IR, and Studio adapter inventory.

The remaining near-term work is to harden each first-party format adapter with format-specific round-trip fixtures and expose a small node/receipt inspector panel inside Studio.

## Immediate Next Patch

The next code patch should implement adapter hardening and a visible graph receipt panel:

1. Format-specific adapter fixtures for OBJ, glTF, SVG, PNG, JSON, CSV, WAV, and WebM.
2. A Studio node/receipt panel that can inspect one graph evaluation without claiming the full node editor is finished.
3. Expose existing `media.graph` project save/load packages in the editor shell and receipt panel so graph packages can be shared across browser, CLI, MCP, and future IDE/TUI surfaces.
4. A shader graph compiler spike that emits WGSL/GLSL compile receipts before any visual claim.

This gets the engine out of "demo collection" territory and into a real, composable execution substrate.
