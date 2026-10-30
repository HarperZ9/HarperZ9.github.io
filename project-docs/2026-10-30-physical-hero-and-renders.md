# The physical hero and the 16K renders (30 October 2026)

Branch `feat/hero-physical`. Not pushed. The author reviews before anything ships.

## 1. The hero, rendered live

The home page's arrival used a pre-rendered loop (`glass-tubes`, 1.19 MB of WebM plus posters). It is now a
WebGL2 render in `world/site/hero/`, built from the materials library's measured data:

| Piece | What it does | Source |
|---|---|---|
| `spectra.js` | 8 and 3 wavelength bins: CMF weights, N-BK7 n, water n, alpha = 4 pi k / lambda for water and N-BK7, light SPDs, adaptation matrices | `scripts/build-hero-spectra.py` from `tools/materials` |
| `optics.js` | exact unpolarised Fresnel, Airy thin film (MgF2 pooling at the rims), two-interface slab refraction, GGX | one GLSL string, also compiled by the test |
| `scene.js` | sky, wave-equation water with Gerstner swell, caustics on the sea floor and from the glass onto the water, glyph reflection in the water, the glass name; integrated per bin to XYZ | |
| `post.js` | wave equation (256 x 256), soft-knee bloom, red-first halation, raw film chain crosstalk, Colour Core log-stop curve per channel, sRGB, dither | catalogue: `raw-halation`, `elder-cfx-film-halation`, `raw-film-emulation`, `elder-color-core-log-tonemap` |
| `glyphs.js` | the name in the page's display face, exact EDT, round rod section | |
| `hero.js` | lamp: high-pressure sodium at night, with four smaller sodium lamps on the far shore so glints cover the whole sea, a low sun by day, `?lamp=filament` for a 2700 K filament; the Lamp control switches them; pointer drops into the water | `mc-seattle-spd` |

Fallbacks: Plain view shows the old poster; reduced motion draws one still frame; no WebGL2 or no float
targets plays the old loop. The ladder steps down on measured time (rAF median over 60 frames above 18.5 ms, or
GPU timer median above 12 ms): render scale 2, 1.5, 1 at 8 bins, then 1.5, 1, 0.6 at 3 bins, then a still frame.
Phones start at 3 bins.

### Measured

| Measure | Before | After |
|---|---|---|
| Hero bytes on a desktop load (local server, uncompressed bodies) | 1,255,503 | 49,413 |
| Whole home page bytes in the first 8 s | 3,779,800 | 2,574,605 |
| GPU time a frame, 1920 x 1080, 8 bins, RTX 4090 (timer query) | n/a | 0.10 ms (0.22 ms with the shore lamps) |
| GPU time a frame, phone 585 x 440, 3 bins, RTX 4090 | n/a | 0.06 ms |
| Frame time with vsync, RTX 4090 | n/a | 16.7 ms (60 fps, display bound) |
| SwiftShader (CPU GL), the ladder | n/a | 8 bins at 1x: 490 to 830 ms GPU; steps to 3 bins, then lower scale, then a still |
| First live frame after navigation (local) | n/a | about 1.1 s; the poster shows until then |

No laptop iGPU was available, so the 60 fps iGPU budget is inferred, not measured: 0.10 ms on a card with
about 80 TFLOPS scales to about 4 ms on a 2 TFLOPS iGPU (low confidence; memory bandwidth and drivers differ). The
ladder is what holds the budget on a real device, and it is measured working on SwiftShader.

Contrast: the h1 and the three links keep their own solid plates, unchanged; the art sits behind them as before.

### Known answers (tests)

- `node --test tests/hero-physical.test.mjs`: n_BK7(587.56 nm) = 1.516798 (SCHOTT 1.5168); Fresnel 4.22 % at
  normal incidence; dispersion order for glass and water in both layouts; water alpha near 690 nm 0.62 per m and
  alpha = 4 pi k / lambda within 0.05 % of the library; equal-energy white integrates to 1; HPS 1969 K, filament
  2697 K, moon 4101 K; a negative control. 7 pass.
- `node tests/hero-physical.cjs` (Playwright, real GPU and SwiftShader): the shader's own GLSL reads back 4.216 %
  for N-BK7, film at zero thickness equals the bare interface, a quarter-wave MgF2 layer on BK7 gives 1.271 %
  (known 1.27 %), blue displaced further than red, Fresnel at 60 degrees matches the closed form; the live hero
  draws, reduced motion gives a still, Plain view gives the poster. All pass on both.

## 2. The renders

Three scenes in `tools/showcase/`, rendered on one RTX 4090 at 81 wavelengths (5 nm) and 4 samples a pixel.
`metals` and `packing` shade every metal and the glass floor through the fused `spectral_shade` CUDA kernel.
`glass-night` is the hero's scene carried at 81 wavelengths, with the refracted geometry under the glass at 41.
Joules are NVML's total-energy counter over the window, the whole board including idle draw.

| Scene | 3840 x 2160 | 7680 x 4320 | 15360 x 8640 |
|---|---|---|---|
| metals | 1.4 s, 44 J | 2.8 s, 126 J | 7.0 s, 412 J |
| packing | 5.2 s, 298 J | 16.8 s, 1,046 J | 89.2 s, 7,599 J |
| glass-night | 14.3 s, 575 J | 37.5 s, 1,731 J | 124.5 s, 7,867 J |

Grading the 16K frames adds 1.4 to 1.8 s and 68 to 98 J. Full 16K was reached for all three. Receipts with
hashes: `H:/showcase/renders/<scene>-<W>x<H>.json`. Masters (float16 HDR and 8-bit) stay on H:.

Limits: one bounce for the spheres (a sphere seen in another is dimmed, not re-shaded); the floor's reflection
of a sphere uses N-BK7's Fresnel at 550 nm as a scalar; the glass scene is a 2.5D slab model, as in the hero.

## 3. Tiles and the viewer

`tools/showcase/tiles.py` writes a Deep Zoom pyramid (512 px tiles, levels 0 to 14, `.dzi` plus a JSON
manifest), AVIF at quality 60 with JPEG fallbacks. `showcase.html` with `world/site/showcase/deepzoom.js`
(no dependencies) fetches only the tiles in view and fills each caption from the render's receipt.

| Set (15360 x 8640) | Tiles | AVIF | JPEG | Encode |
|---|---|---|---|---|
| glass-night | 711 | 2.29 MB | 5.68 MB | 10.2 s |
| metals | 711 | 0.90 MB | 2.75 MB | 9.3 s |
| packing | 711 | 2.18 MB | 5.76 MB | 11.1 s |

First view of `showcase.html` at 1440 x 900: 584,226 bytes in all, 187,772 of them tiles (36 requests across
the three viewers), first contentful paint 252 ms on a local server.

### Hosting (the author's decision)

The three sets total 5.4 MB of AVIF and 14.2 MB of JPEG in 2,133 tiles. GitHub's published limits (from memory,
high confidence): a Pages site up to 1 GB, a soft 100 GB a month of bandwidth, single files under 100 MB.

1. Commit the tiles under `media/showcase/` (about 20 MB). Simplest; the page works as written.
2. A separate tiles repository published with Pages, the page's `data-tiles` pointing at it. Keeps this
   repository's history lean as more renders arrive.
3. Release assets for the full-resolution masters (about 400 MB each as 8-bit) as downloads; poor for tiles,
   which are many small files.

Nothing is committed under `media/showcase/` on this branch; the page shows "not available here" until one is chosen.

## 4. The state-of-the-art bars

| Bar | Measured today | Unreal Engine 5 | Next step |
|---|---|---|---|
| Spectral accuracy | spectral_shade vs Mitsuba 3.6.4 `scalar_spectral`, 8 metals x 3 angles under D65, same n and k: mean CIEDE2000 0.021, max 0.038; Mitsuba's own seed noise up to 0.014 | Path tracer and Lumen are RGB (from memory, moderate); no published spectral error | Same full scene in Mitsuba and PBRT-v4 (multi-bounce) and compare whole images, not one term |
| Determinism | every spectral_shade call in a metals and a packing frame bit-identical CPU vs GPU: 34 of 34 and 28 of 28 calls, about 1M samples each; an input change flips the hash | no published claim | extend bit-identity past the kernel to the whole renderer (ray hits and grade in kcore ops) |
| Performance | 16K 81-wavelength metals in 7.0 s, 412 J; hero 0.10 ms a frame at 1080p on a 4090 | no comparable published spectral numbers; unknown | measure an iGPU laptop; port the eager torch passes to fused kernels |
| Web delivery | hero 49 KB instead of 1.26 MB; 16K viewer first view 188 KB of tiles | HTML5 export removed after UE 4.24, web delivery is Pixel Streaming from a server (from memory, moderate) | measure on the hosted site with compression and a throttled connection |

What this does not prove: agreement with Mitsuba on one term checks the implementation against another
implementation of the same physics and data, not against measurement; no Unreal number here is measured, so no
claim of beating it is made. Unreal was not installed (its licence and size make that non-trivial).

## 5. Not done or open

- `tests/test_capability_publication_release.py` fails: `index.html` bytes changed from the reviewed release.
  Recording that review is the author's step (`python -m tools.release_reviews record ...`).
- No iGPU fps measurement; no hosted measurement.
- The showcase page is not linked from anywhere until hosting is chosen.

## 6. Review of the first screenshots (30 October 2026)

Three defects were reported on the first desktop dark capture. Diagnosis by hiding the hero layer:

- Blocky patches and a stair-stepped diagonal line: the page's own road layers (`strata`, `road`, the mosaic
  uncover), present on main too and drawn with intended pixel blocks. The hero canvas was at tier 1, scale 1,
  1280 x 720 for 1280 x 720 CSS px, with no ladder step. Not the ladder, not the hero shader. Left as they are.
- Muddy water outside the glare: the hero shader. Fixed by four smaller far-shore sodium lamps with their own
  glitter paths, a stronger moonlit zenith (0.05 to 0.14) and a wider horizon glow (falloff 0.07 to 0.12).
- The hero canvas scales with `image-rendering: auto` (bilinear), so a reduced ladder tier softens rather than
  blocks.
