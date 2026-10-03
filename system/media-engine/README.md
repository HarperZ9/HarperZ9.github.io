<!-- writing-profile: readme -->
# Media engine

One scheduler, one seed and receipt layer, one colour module, and a plugin per visual surface. No build step and no dependencies.

## What it does for a page

- One `requestAnimationFrame` per page, however many canvases are live.
- A canvas draws only while it is on screen and the tab is visible.
- With reduced motion requested, each canvas draws one still frame per mount, resize or change.
- Every frame can carry a receipt: the request, its SHA-256, and the SHA-256 of the pixels.

Measured on the Retro Engine page at 1440 x 900 (Chromium, five interleaved rounds): script time fell from 1,044 to 301 ms per second on screen, from 1,018 to 2.3 off screen, and from 1,053 to 2.2 with reduced motion. Frame time fell from 83 to 16.7 ms. These are one machine's numbers; no low-end or mobile device has been measured.

## Files

| File | Holds |
|---|---|
| `core.mjs` | `createEngine()`: plugin registry, scheduler, `mount()`, frame receipts |
| `page.mjs` | `pageEngine()` and `usePlugin(id)`: one engine per page, plugins loaded on first use |
| `seed.mjs` | `mulberry32`, `fnv1a32`, `rngFrom`, `xmur3`, `makeRng`: the site's one seeded randomness |
| `receipt.mjs` | `frameReceipt`, `reconcile`, `verifyBytes`, `digestOrNull`, `digest` |
| `scene.mjs` | `media.scene` camera requests in raw-native's params shape |
| `colour.mjs` | OKLab maths (re-exported from sense-core) and the risk tokens |
| `risk.css` | The risk tokens as CSS custom properties, generated from `colour.mjs` |
| `gl2.mjs` | WebGL2 helpers: context, program, full-screen triangle, render targets |
| `plugins/retro.mjs` | The Retro pipeline, tube stage on the GPU; `createRetroRenderer()` for `retro-studio.js` |
| `plugins/aperture.mjs` | The hero aperture used on the Gallery, Retro Engine and Loom pages |
| `plugins/plate.mjs` | A Gallery plate, drawn once from its seed |
| `plugins/loom.mjs` | Any frame woven into cloth with the Loom's draft maths; `wif()` gives the weaver's file |
| `plugins/evidence.mjs` | BRender Archival and Engine Revival: release media re-hashed against the published manifest |
| `plugins/slots.mjs` | Reserved slots (`raw`, `revival`) and the still card shown until a slot is filled |
| `proof.html` | A bench page that mounts both plugins and compares the GPU tube against the CPU tube |

## The Studio as a creative suite

`studio.html` is the one entry. Its Engine group lists every media surface: Retro Engine, Gallery, Loom, Splat Lab, BRender, Engine Revival and RAW, reachable as `studio.html?source=retro` and so on. Every older page URL still works and links back in.

Each surface shares the same tools and the same panel: its controls, then one action row in a fixed order (Send to Retro, Weave in Loom, Export frame and receipt, the surface's own page), then "How we know" with risk-marked status lines. Every control is a native form control in tab order, so the keyboard path is the same on each surface.

- Send to Retro and Weave in Loom copy the frame on the stage into that plugin as its input. The receiving surface shows where the input came from and its SHA-256.
- Export frame and receipt saves a PNG and a JSON receipt for exactly those pixels, including the input's hash when there was one.

## Plugin contract

```js
export const plugin = {
  id: "name", version: "1.0.0", backends: ["webgl2", "canvas2d"],
  create({ canvas, params, seed, backend, reduced }) {
    return { frame(t, dt) {}, setParams(p) {}, resize() {}, readPixels() {}, dispose() {} };
  },
};
```

An instance may set `static: true`: the loop never draws it, and it draws on mount, on `setParams`, on `redraw()`, or when it calls the `requestRedraw()` it was given at `create()` (an image arrived).

`mount(canvas, id, { params, seed, backend, minFrameMs, stillTime, keepAlive })` returns a handle with `setParams`, `resize`, `redraw`, `receipt(t)` and `dispose`. `keepAlive()` lets an instance whose output is also sound keep running off screen; reduced motion still holds its picture still.

## The reference backend

`wasm-raw` is a backend like any other in the list: the raw-native core compiled to WebAssembly, the suite's exact rasterizer for 3D work. A 3D-capable plugin lists it in `backends`; `handle.receipt(t, { reference: true })` then draws the same request through the backend registered with `registerReferenceBackend("wasm-raw", { render })` and adds `referenceBackend` and `reconcile` (RMSE and maximum error on a 0..1 scale, a MATCH or DRIFT verdict against a tolerance) to the receipt. With no backend registered, `reconcile` reads UNVERIFIABLE and says why. The 2D surfaces (weave, plotter, Canvas2D plates, audio) do not list it.

`scene.mjs` builds `media.scene` requests whose camera fields carry raw-native's own names (`width`, `height`, `eye`, `target`, `up`, `fovy`, `prev_eye`, `prev_target`, `prev_up`), so `toRawParams()` gives the file `raw_native_cli --params` reads and `fromRawChannels()` reads its `channels.json` camera back.

## Filling a slot

A slot becomes a live plugin when a loader is registered under its `pluginId`:

```js
import { registerPlugin } from "./page.mjs";
registerPlugin("raw", () => import("./plugins/raw.mjs").then((m) => m.raw));
```

The Studio's RAW surface then mounts that plugin in place of its placeholder card. A WebAssembly plugin follows the same contract: `create()` loads the module, `frame()` draws into the canvas it was given, `readPixels()` returns top-down RGBA, and its receipt names `backend: "wasm"`.

## Risk colour

Status colour reads as liability. Four levels, from the author's ruling of 3 October 2026:

| Level | Verdicts | Light pole | Dark pole |
|---|---|---|---|
| low liability | MATCH, VERIFIED, PASS | `#186844` | `#8fdc8a` |
| moderate liability | UNVERIFIABLE, UNKNOWN, PENDING | `#5c5a66` | `#a9a6b4` |
| elevated liability | DRIFT, WARN, STALE | `#8f5200` | `#f0a848` |
| high liability | FAIL, REFUSED, ERROR | `#b3261e` | `#ff7a6b` |

Quiet marks use `#5d584e` on light and `#9d978a` on dark. An unknown verdict word reads as moderate.

The rule: one hot mark per view. `markRisk(nodes)` sets `data-risk` on every status node and `data-risk-hot` on the one with the highest liability. `risk.css` colours only that one; every other mark stays quiet ink, and each mark names its level in words, so colour is never the only cue. Every token clears 4.5:1 on its pole's grounds, and `colour.test.mjs` fails the build if an edit breaks that. The colour spectrum stays inside generative art.

## Not yet moved

- Five modules keep their own float OKLab. Moving them would shift palette output by a level or two, so each moves with a pixel-hash check of the frames it draws.
- `atelier.js` is a classic script and keeps its inline PRNG; `seed.test.mjs` pins the engine's `makeRng` to its stream.
- The home page's React bundle inlines its own copies of `field-ground.js`, `logo-field.js` and `emphasis-field.js`. Those three move when the bundle is next rebuilt.
- GPU time is unmeasured: the test browser exposes no timer query. WebGPU is unmeasured for the same reason.
