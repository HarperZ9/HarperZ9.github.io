# Explainer kit

Motion primitives for films about how models work, drawn from the model's own numbers. A scene
made with the kit renders frame-exact to video and plays live in the browser from the same file,
where a viewer can pause and read any number under the pointer.

Demo: `docs/explainer/attention.html` (live) and `docs/explainer/attention.scene.mjs`, a 72-second
film on how attention moves information between tokens, driven by a model trained on a CPU.

## What is in it

| Module | What it gives a scene |
|---|---|
| `layers.mjs` | GPU layers for Motion's display list (`kind: "layer"`): the atmosphere, the orb (aperture iris, line-work corona, prismatic ring), point clouds with level of detail, and flow pulses along curves. |
| `ref.mjs` | The same maths in double precision: the reference the WGSL is held to, and what a C++ port copies. |
| `wgsl.mjs` | The WGSL. One `COMMON` block feeds both the passes and the parity kernel. |
| `data.mjs` | `loadBundle()`: a JSON file plus the `.npy` arrays it lists, each checked against its SHA-256. `parseNpy()`, `show()` for formatting bound numbers. |
| `layout.mjs` | `tensorGrid()` lays out a 3-axis tensor as points and inverts a point back to its element; `tokenRow()`, `ellipseLattice()`. |
| `style.mjs` | Type and colour by the site's design rules (DESIGN-RULES.md in HarperZ9.github.io): Hanken Grotesk for headings, text and labels in sentence case; Conso for data, characters and code. Ink text, restrained accents beside text, a limited explanatory palette in figures. |
| `cards.mjs` | Data cards, bars, attention matrices, image grids. A card takes a value and a format, never a typed number. |
| `shots.mjs` | Camera keys with easing (zoom in log space), the orb iris transition, focus pulls, pulse phase. Under reduced motion moves become cuts. |

## Use

```js
import { createLayers, loadBundle, tensorGrid, typeKit, shots, NIGHT } from "../../web/explainer/index.mjs";

const bundle = await loadBundle(ctx.url("data.json"));            // throws nothing; check bundle.verified
const grid = tensorGrid({ shape: [256, 64, 64], x: 160, y: 160, w: 1600, h: 760 });
const kit = await createLayers(ctx.motion);
const cloud = kit.points(grid.positions(bundle.arrays["residual.npy"].data));
items.push({ kind: "layer", layer: kit.field, mode: "atmos", spec: NIGHT, time: t });
items.push({ kind: "layer", layer: cloud, area: grid.area, density: 0.8, radius: grid.cell / 2, range: [-3, 3] });
```

Level of detail: points are stored sorted by an integer hash of their id, so the points kept at
any fraction are a prefix and a frame draws only those. The kept fraction holds about `density`
points per covered pixel; an additive cloud's light is kept constant by a matching gain.

## Checks

    node --test web/explainer/explainer.test.mjs
    python tests/web/explainer_parity.py --adapter swiftshader

The parity bounds in `evidence/explainer-parity-bounds.json` were committed before the first GPU
run. Run 1 failed and is kept in `evidence/explainer-parity-run1-failed.json`; the bounds file
records each cause and fix. Three controls must fail: a 3% change to the orb's core radius, a
changed hash constant, and point positions shifted by 1 px.

Measured on SwiftShader (Chrome's CPU WebGPU), 1280 x 720: an empty frame 25 ms; 1,048,576
points 7.3 s with every point drawn and 2.6 s at the LOD fraction the layer picked (0.35). A
hardware GPU was not measured (the machine's GPU was in use by another job).

## Making a film

    python tools/explainer/attention_model.py --out docs/explainer/attention     # the numbers, about 80 s on a CPU
    node tools/explainer/captions.mjs docs/explainer/attention/script.mjs docs/explainer/attention/data.json docs/explainer/attention/captions.vtt
    python tools/explainer/render_film.py --scene ../../docs/explainer/attention.scene.mjs --out OUT --seconds 72 --vtt docs/explainer/attention/captions.vtt

The demo's narration (`docs/explainer/attention/narration.m4a`) is a synthesized voice made with
the author's own pipeline; the author approved it for this film on 2026-10-16. Each sentence is
placed at its caption row's start, or just after the previous sentence when that runs long
(`narration.placement.json`, up to 1.9 s late).

The render runs in resumable 6-second chunks on the CPU adapter and writes `OUT/receipt.json`
with the commit, every frame's SHA-256 and the film's.

## Fonts

Hanken Grotesk is under the SIL Open Font License 1.1 (`third_party/fonts/OFL-hanken-grotesk.txt`).
Conso's atlas is cut from the webfont the author's site ships. Its licence terms are unknown: the
source archive carries no licence file. The site records that the author holds the designer's
licence privately, and the use here follows the site's own.
