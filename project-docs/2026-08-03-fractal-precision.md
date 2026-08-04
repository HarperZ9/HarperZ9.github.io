# Deep-zoom precision and raymarcher antialiasing

Closes two of the findings left open by `2026-08-03-visual-engine-audit.md`: the 2D fractal's
float32 deep-zoom wall, and the 3D raymarcher's single-sample silhouettes.

Measured 2026-08-03 on ANGLE (NVIDIA GeForce RTX 4090, Direct3D11), Chrome, WebGL 1.0.
Hardware figures below come from `system/fractal-precision-probe.js`, which is re-runnable.

---

## 1. The float32 wall was real, and worse than the audit recorded

A float32 mantissa is 24 bits, so near |c| = 0.744 the smallest representable step is 2^-24, about
6e-8. The "Seahorse Deep" preset (`system/fractal.js`, cx = -0.744539761, scale = 6.25e-6) frames
6.25e-6 of the complex plane, which across 512 pixels is 1.2e-8 per pixel — roughly five times
finer than the format can address. Neighbouring pixels land on the same point and the image goes
blocky. The escape loop has the same problem independently: z reaches magnitude ~1, so per-pixel
differences below 6e-8 disappear inside the iteration even if the coordinate survived.

**Coordinate separation, 512-pixel-wide frame** (how many of the 512 columns the arithmetic can
actually tell apart; 512/512 means every pixel is its own point):

| view | scale | float32 | df64 |
|---|---|---|---|
| Full Overview | 3.5 | 512/512 | 512/512 |
| Seahorse Valley | 7e-4 | 512/512 | 512/512 |
| Misiurewicz Hub | 1e-4 | 512/512 | 512/512 |
| — | 1e-5 | 160/512 | 512/512 |
| **Seahorse Deep** | **6.25e-6** | **92/512** | **512/512** |
| — | 1e-6 | 10/512 | 512/512 |
| — | 1e-7 | 2/512 | 512/512 |
| — | 1e-8 … 1e-12 | 1/512 | 512/512 |
| — | 1e-13 | 1/512 | 52/512 |
| — | 1e-14 | 1/512 | 6/512 |

float32 begins failing at 1e-5 and is completely dead by 1e-8 — a single addressable coordinate
across the whole frame. df64 holds every pixel down to 1e-12 and gives out at 1e-13, which puts its
real resolution at about 2.6e-15 relative, a shade better than 2^-48.

Visual confirmation at the Seahorse Deep preset, 560x560, 2000 iterations: float32 smears the
filaments into horizontal streaks and chunks the minibrot's edge; df64 resolves the spirals, the
filament structure and the bulbs on the minibrot. Both images share every other parameter.

## 2. The part that nearly shipped broken

Compensated arithmetic works by keeping the rounding error a plain add throws away, and every step
of it is an algebraic no-op that an optimizer is glad to delete. This compiler deletes them.

A probe shader compiled `float t1 = u_a + u_b; float e = t1 - u_a;` and reported, for
u_a = -0.744539761 and u_b = 1e-8, **both** `t1 == u_a` (the increment was below half an ulp and was
swallowed entirely) **and** `e == u_b`. Those cannot both be true of real arithmetic. The compiler
folded `(a + b) - a` back to `b`. Written the textbook way, df64 compiles down to exactly the
float32 program it was meant to replace, produces a plausible image, and reports nothing.

The fix is `dsBar(x) { return x * u_one; }` with `u_one` a uniform holding 1.0. Multiplying by
exactly 1.0 is exact in IEEE754, so no value changes; the compiler cannot prove the identity across
an unknown uniform and has to emit the subtraction. Every foldable occurrence in the two-sum and in
both halves of the Dekker split goes through it. `system/fractal-gl.test.mjs` asserts each barrier
is present and that no bare foldable form survives, because losing one is a silent regression.

The first version of the probe had the same bug in its own float32 branch — it reported a perfect
512/512 for the path that was actually broken. Any measurement of this kind has to be barriered too.

## 3. What ships

- `system/fractal-gl.js` compiles two programs per fractal type. `fractalPrecisionMode(cx, cy,
  scale, width)` picks between them from the pixel step, so panning and zooming cross the boundary
  with no control to set. Both Mandelbrot, Julia and Burning Ship have a df64 variant; the image
  recipe (bailout, smooth iteration count, cross orbit trap, palette cycle) is identical either way.
- The two boundaries carry deliberately different headroom. Switching to df64 early costs only
  speed, so it takes a 4x margin. Declaring precision *exhausted* early costs the truth, so it takes
  none — the classifier must not print "no new detail" over a frame that is still resolving.
- Devices whose fragment shaders demote `highp` are refused the deep program (`getShaderPrecision
  Format` < 23 bits), since a df64 split on a 10-bit mantissa is worse than the float32 program.
  The renderer records what it actually ran on the canvas and the Studio's note reads that back, so
  a refused device is told its pixels are collapsing rather than being told df64 is running.
- The Studio discloses the mode in its own words when a view goes deep, and says when df64 has hit
  its floor.

## 4. Raymarcher antialiasing

`system/fractal3d.js` marched one ray per pixel. A raymarched surface is a hard binary hit test at
the silhouette, so one sample per pixel leaves stair-stepped edges and crawling under motion that no
amount of shading quality hides. The per-ray work moved into `renderRay(vec2 uv)` and `main()` now
takes a rotated-grid 2x2 pattern (offsets ±0.125 / ±0.375), which resolves near-horizontal and
near-vertical edges better than an axis-aligned grid at the same sample count. Tone mapping happens
per sample inside `renderRay`, so the average blends display-referred values and cannot blow out an
edge pixel.

Mandelbox, 700x700, identical camera (both captured on the first frame, where the idle-orbit clock
is still zero):

| metric | 1 sample | 4 samples | change |
|---|---|---|---|
| isolated pixels (luma differs from all 4 neighbours by > 24) | 33,026 | 12,795 | −61% |
| mean high-frequency energy (mean abs Laplacian of luma) | 65.07 | 37.06 | −43% |

At 5x magnification the single-sample crop is confetti — isolated single-pixel colour noise across
the whole crusty region. The supersampled crop resolves into coherent surfaces: the craters read as
shapes and the dark ridge has a defined edge.

It is opt-in, one full march per sample: `read3DOpts()` in `system/studio.js` requests 4 samples on
High quality or when the hardware render plan already rates the device high or max, and 1 otherwise.

## 5. Honest null: frame cost is not measured

df64 is roughly an order of magnitude more ALU per iteration than float32, and supersampling is one
extra march per sample. **Neither cost was measured.** The driven Chrome instance used for this work
does not composite at display rate — `requestAnimationFrame` is pinned to exactly 1000 ms — and GPU
timings taken through it contradict each other by two orders of magnitude and change with call
order (the same deep float32 configuration read 0.6 ms and 105 ms in the same session). Pure JS in
the same tab runs at full speed, so the CPU side is fine; the GPU scheduling is not observable here.

No frame-time claim is made. What ships instead is a pair of conservative guards: df64 clamps
supersampling to at most 2 samples per axis below 1.6 megapixels and to 1 above it, and the deep
program is only ever compiled for views that need it. If deep-zoom interaction turns out slow on
weaker hardware, the next lever is a reduced-resolution interactive pass, which the CPU path already
does in `cpuFractalProgressive`.

## 6. Re-running the measurement

Serve the site with correct `.mjs` MIME (Python's `http.server` on Windows serves `text/plain` and
silently kills the module graph), open any same-origin page, and:

```js
const probe = await import('/system/fractal-precision-probe.js');
const c = document.createElement('canvas'); c.width = 512; c.height = 4;
probe.measureCoordinateSeparation(c, { cx: -0.744539761, scale: 6.25e-6, mode: 'single' });
probe.measureCoordinateSeparation(c, { cx: -0.744539761, scale: 6.25e-6, mode: 'double' });
```

Reuse one canvas: a fresh canvas per call takes a fresh WebGL context and browsers cap those at
around 16. Measure on a page with no other renderer running.

## Still open from the audit

- S7 asset density: 27k gaussians against a 1229x1536 source is about one per 70 source pixels.
- Scene-independent NGSF quantization: fixed 2.5 range, no per-scene AABB.
- Perturbation rendering (reference orbit in doubles plus float deltas, with rebasing) would take
  the 2D fractal from df64's 1e-13 floor to 1e-30 and beyond, at lower per-pixel cost than df64,
  for Mandelbrot and Julia. Burning Ship needs a different perturbation formula.
