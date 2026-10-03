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
| `receipt.mjs` | `frameReceipt`, `verifyBytes`, `digestOrNull`, `digest` |
| `colour.mjs` | OKLab maths (re-exported from sense-core) and the risk tokens |
| `risk.css` | The risk tokens as CSS custom properties, generated from `colour.mjs` |
| `gl2.mjs` | WebGL2 helpers: context, program, full-screen triangle, render targets |
| `plugins/retro.mjs` | The Retro pipeline, tube stage on the GPU; `createRetroRenderer()` for `retro-studio.js` |
| `plugins/aperture.mjs` | The hero aperture used on the Gallery, Retro Engine and Loom pages |
| `proof.html` | A bench page that mounts both plugins and compares the GPU tube against the CPU tube |

## Plugin contract

```js
export const plugin = {
  id: "name", version: "1.0.0", backends: ["webgl2", "canvas2d"],
  create({ canvas, params, seed, backend, reduced }) {
    return { frame(t, dt) {}, setParams(p) {}, resize() {}, readPixels() {}, dispose() {} };
  },
};
```

`mount(canvas, id, { params, seed, backend, minFrameMs, stillTime, keepAlive })` returns a handle with `setParams`, `resize`, `redraw`, `receipt(t)` and `dispose`. `keepAlive()` lets an instance whose output is also sound keep running off screen; reduced motion still holds its picture still.

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
