<!-- writing-profile: readme -->
# Media engine

One scheduler, one seed and receipt layer, one colour module, and a plugin per visual surface. No build step. The one outside file is the superstack contract (`contracts.mjs`), copied byte for byte from superstack v0.2.0 (FSL-1.1-MIT) and pinned by SHA-256.

## What it does for a page

- One `requestAnimationFrame` per page, however many canvases are live.
- A canvas draws only while it is on screen and the tab is visible.
- With reduced motion requested, each canvas draws one still frame per mount, resize or change.
- Every frame can carry a superstack receipt: the request as the scene, its time in flicks, the SHA-256 of the pixels, two verdicts against a reference when one drew the same request, what the receipt does not prove, and a seal.

Measured on the Retro Engine page at 1440 x 900 (Chromium, five interleaved rounds): script time fell from 1,044 to 301 ms per second on screen, from 1,018 to 2.3 off screen, and from 1,053 to 2.2 with reduced motion. Frame time fell from 83 to 16.7 ms. These are one machine's numbers; no low-end or mobile device has been measured.

A second step moved the Retro front half (downscale, OKLab, palette, dither) into a worker. Main-thread script time on screen fell from 312 to 20 ms per second (median of five interleaved rounds, range 19 to 23), with the output still changing 20.3 times a second. The work moved, so it is still counted: the worker spends about 8.4 ms per frame, about 170 ms per second. The worker's grid is the page's grid byte for byte. The first live frame also runs on the main thread, and if the two ever differ the worker is retired and the page keeps its own front half.

## Files

| File | Holds |
|---|---|
| `core.mjs` | `createEngine()`: plugin registry, scheduler, `mount()`, frame receipts |
| `page.mjs` | `pageEngine()` and `usePlugin(id)`: one engine per page, plugins loaded on first use |
| `contracts.mjs` | The vendored superstack v0.2.0 contract (FSL-1.1-MIT): canonical JSON, SHA-256, the seed rule, the flick clock, OKLab, risk tokens, PCM and loudness, reconcile and receipts. Never edited; `SUPERSTACK.sha256` holds its pin and CI checks it and runs the release's vectors (`tests/superstack/`) |
| `seed.mjs` | `mulberry32`, `makeRng`, `xmur3` (the contract's seed rule), `fnv1a32` and `rngFrom` (the legacy `fnv1a32-mulberry32` rule): the site's one seeded randomness |
| `sound.mjs` | The sound layer: scenes, offline float64 references, loudness, PCM receipts, live playback and its reconcile, reduced sound |
| `receipt.mjs` | `frameReceipt` (a `superstack.receipt/1`), `reconcileFrame`, `verifyReceipt`, `verifyBytes`, `digestOrNull`, `digest` |
| `scene.mjs` | `media.scene` camera requests in raw-native's params shape |
| `colour.mjs` | OKLab and the risk tokens from the contract, OKLCh and CIEDE2000 from sense-core, `markRisk` and `riskCss` |
| `risk.css` | The risk tokens as CSS custom properties, generated from `colour.mjs` |
| `gl2.mjs` | WebGL2 helpers: context, program, full-screen triangle, render targets |
| `plugins/retro.mjs` | The Retro pipeline, tube stage on the GPU; `createRetroRenderer()` for `retro-studio.js` |
| `retro-worker.mjs` | The Retro front half off the main thread: the same `quantizeGrid` from `retro-engine.js` on the same bytes |
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

`wasm-raw` is a backend like any other in the list: the raw-native core compiled to WebAssembly, the suite's exact rasterizer for 3D work. A 3D-capable plugin lists it in `backends`; `handle.receipt(t, { reference: true })` then draws the same request through the backend registered with `registerReferenceBackend("wasm-raw", { render })` and puts the result in the receipt's `reconcile` block: `identity` is MATCH or DRIFT for the RGBA bytes, and `tolerance` is verified, refuted or unverifiable against the contract's bound (mean absolute error at most one level) and the site's (RMSE at most 2/255 on a 0..1 scale). One level off on one channel reads DRIFT and verified, which is why the two verdicts are separate. With no backend registered, the tolerance verdict is unverifiable and says why. A receipt nobody asked to check has `reconcile: null` and says so in `does_not_prove`. The 2D surfaces (weave, plotter, Canvas2D plates, audio) do not list it.

`scene.mjs` builds `media.scene` requests whose camera fields carry raw-native's own names (`width`, `height`, `eye`, `target`, `up`, `fovy`, `prev_eye`, `prev_target`, `prev_up`), so `toRawParams()` gives the file `raw_native_cli --params` reads and `fromRawChannels()` reads its `channels.json` camera back.

## Sound

`sound.mjs` puts the site's own sounds on the superstack contract. Each one is a `superstack.sound/1` scene at 48 kHz: the Seed sound, the Music source's built-in chord, a picture or woven cloth played as notes (the Loom's cloth, the Retro picture, the Gallery plate) and the Retro scope's drawn figure. An offline renderer computes every sample in float64, normalises it with the contract's BS.1770 meter (music to -14 LUFS, interactive sound to at most -18 LUFS, never past a -1 dBFS sample peak) and quantizes once to 16-bit PCM. That PCM is the reference: the receipt hashes it, the WAV export is its bytes, and the live context runs at 48 kHz and plays exactly those samples. `reconcileLive()` renders the playback graph in an `OfflineAudioContext` and holds it against the reference with the contract's two verdicts. WebAudio is never the reference.

The four producers are also engine plugins (`sound-seed`, `sound-music`, `sound-scan`, `sound-figure` in `plugins/sound.mjs`): mounted, each draws a still of its waveform and exposes `reference()`, `receipt()`, `reconcileLive()`, `play()` and `wav()`.

Nothing autoplays. `reducedSound()` is true when the reader asks for reduced motion or turns the site's sound preference off (the Gallery sound desk has the switch). Then the Retro drone, the Loom's weaving rows and the Music pad, which react to the picture or the music, do not start, and each says why. A sound the reader starts with a play button still plays. The drone fades out while the tab is hidden.

The drone and the pings stay live WebAudio graphs with a compressor: they follow the picture frame by frame, so they have no fixed scene and no reference.

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
| high liability | FAIL, REFUSED, REFUTED, ERROR | `#b3261e` | `#ff7a6b` |

Quiet marks use `#5d584e` on light and `#9d978a` on dark. An unknown verdict word reads as moderate.

The rule: one hot mark per view. `markRisk(nodes)` sets `data-risk` on every status node and `data-risk-hot` on the one with the highest liability. `risk.css` colours only that one; every other mark stays quiet ink, and each mark names its level in words, so colour is never the only cue. Every token clears 4.5:1 on its pole's grounds, and `colour.test.mjs` fails the build if an edit breaks that. The colour spectrum stays inside generative art.

## Not yet moved

- `lib/sense-core` keeps its own float OKLab, because it is a vendored library with its own source; `colour.test.mjs` holds it equal to the contract's. `retro-palettes.js`, `fractal-color.js`, `reactive-visuals.js` and `engine/sim/particles-cpu.js` now import OKLab from the contract, with identical floats and pixel hashes.
- `system/vendor/learn/` keeps its own mulberry32 and FNV-1a copies: it is another repository's vendored file. `atelier.js` keeps two FNV-1a loops over numbers (a stroke and a field fingerprint), which hash numbers, not strings.
- The home page's React bundle inlines its own copies of `field-ground.js`, `logo-field.js` and `emphasis-field.js`. Those three move when the bundle is next rebuilt.
- GPU time is unmeasured: the test browser exposes no timer query. WebGPU is unmeasured for the same reason.
