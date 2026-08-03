# The Spatial Annex: completing the rendering engine

Date: 2026-08-03. Status: accepted, implementing.
Origin: the ZentropyLabs spatial session (Crystal City Hybrid Proof v1.0 to v1.3
and its closing engineering priorities), carried into this repo's engine.

## What the session established

The all-splat pipeline was judged a failed visual experiment at v0.9. The reset
that worked is a hybrid grammar:

- The canonical image stays the comparison authority (source lock).
- Semantic layers carry the structure: textured depth meshes on a shared grid,
  one mask and one depth field per layer, drawn back to front over a coverage
  backdrop, with a depth prepass so atmosphere passes behind structure.
- Gaussian primitives are reserved for what they render well: dust, beam
  energy, water glints, bokeh, stars, sparks. 40-byte records: position (3f),
  color (3f), size, alpha, kind, seed.
- Motion is spatiotemporal and material-scoped: time drives water, haze, beam,
  and dust; architecture holds still. Pause and freeze are first class.
- The camera boundary is narrow and disclosed. Support fill for disocclusion is
  labeled invented, never recovered.
- Every scene exports a receipt: representation list, parameters, hashes.

The session's closing priorities, sized to this repo: hybrid scene
representation, an authoring surface with observability, and a gallery runtime
that serves certified world packages. The WebGPU render graph and the Spatial
Reasoning Engine remain research items and are out of scope here.

## Two lanes, one boundary

- **Authored lane (this PR).** Scenes authored from this site's own generative
  DNA, seeded and deterministic. Nothing is reconstructed, so nothing hidden is
  invented; the disclosure is simply "authored". This is where the engine ships
  and demonstrates parallax, occlusion, and temporal material.
- **Reconstruction lane (unchanged).** The Gaussian Splat Lab's three hashed
  pilot sources keep status SOURCE_PREPARED with zero published scenes. The
  page's boundary sentence and the contract tests in
  tests/test_gaussian_splats.py stay exactly true. Only the generator language
  changes: the credential-blocked external service is replaced by the native
  in-repo pipeline as the intended route.

## Components

1. **World package format** `system/engine/world-package.js`
   Schema id `zentropy.world-package/v1`, conforming to the `media.splat` and
   `media.scene` kinds already declared in system/media/ir.js. A package is a
   JSON manifest plus sidecar binaries: layer depth/mask fields and one splat
   block. The manifest records lane (authored or reconstruction), source
   receipt, layer list with depth ranges, splat kind vocabulary, camera
   boundary clamps, temporal systems, disclosure, and SHA-256 receipts for
   every sidecar. Pure functions, node-tested: validate, parse splat records,
   clamp to a tier's splat budget (render-plan.js supplies the budget),
   build a run receipt.

2. **Hybrid spatial renderer** `system/spatial-scene.js` (+ shaders module)
   WebGL1-compatible port of the v1.3 grammar: coverage backdrop, semantic
   depth-displaced mesh layers on a shared grid, depth prepass, selective
   Gaussian points with temporal drivers, eased narrow camera, receipt export.
   Consumes a world package. Returns a handle: stop(), setControl(), receipt(),
   splatCount, animating.

3. **Studio source "Spatial"** in studio.html + studio.js
   New tab in the Make group following the exact lazy-source pattern
   (SOURCES entry, epoch-guarded loader, stop on leave, GL canvas mount via
   mountGLCanvas/leave3D, cam-interactive stage, animated so WebM export and
   the perception loop engage). Rail controls: scene picker, parallax,
   atmosphere drift, luminous gain, water motion, pause. The engine status bar
   finally shows a live splat count against the tier budget.

4. **Authored scene** `art/spatial/`
   "Folded light, inhabited": the gallery's opening showpiece vocabulary
   authored as a spatial world. Built deterministically from a seed by
   `art/spatial/build_scene.py` (stdlib only) into `folded-light.world.json`
   plus sidecar binaries, hashed into the manifest. Small enough to commit.

5. **Gallery editions desk** in gallery.html + `art/editions.json`
   Serving the plates as shop items, softcontinuum-informed but honest: each
   plate is an open edition whose provenance is its seed and instrument stack;
   the desk lists every edition with its live render, edition kind (seeded,
   live one-of-one, spatial), what you can take today (PNG, plotter SVG, print
   files, the spatial scene in the Studio), and the acquisition state. No
   fabricated collectors, prices, or sale counters. Where no physical sales
   route exists the record says so plainly. The 1976 Computer Graphics and Art
   lineage (art reproductions offered beside the printed work with a minimal
   order mechanism) sets the register: the offer sits with the work, quietly.

6. **Splat Lab copy refresh** in gaussian-splats.html + art/gaussian-splats/
   The "requires upstream service credentials" boundary is replaced by the
   native pipeline boundary. Locked sentences and all hashes stay. The page
   links the Studio's authored lane so the distinction is visible.

## Error handling

Renderer init failures surface in the rail status line and never take down the
rest of the Studio (same pattern as every lazy source). Package validation
failures name the offending field and refuse to render. Missing WebGL yields
the labeled static fallback, not a blank stage.

## Testing

- Node: world-package.test.mjs, spatial-scene.test.mjs (pure parts: clamps,
  ordering, record parsing, receipt shape).
- Python: tests/test_spatial_annex.py (files exist, manifest hashes match the
  sidecars byte for byte, editions.json is well formed and honest, studio and
  gallery wiring present, splat-lab boundary sentences preserved).
- Existing suites stay green, including test_gaussian_splats.py unchanged.

## Out of scope

WebGPU render graph, Spatial Reasoning Engine, multi-hypothesis reconstruction,
any reconstruction-lane scene publication, any real payment integration.
