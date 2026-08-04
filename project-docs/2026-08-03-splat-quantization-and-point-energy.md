# Splat quantization and point-sprite energy

Closes the remaining renderer items from `2026-08-03-visual-engine-audit.md`: S8's
scene-independent quantization and S9's unclamped point-sprite energy. One of the two turned out
not to be worth fixing, and the measurement that says so is the deliverable.

Measured 2026-08-03 against the shipped corpus and the live scenes, ANGLE (NVIDIA RTX 4090,
Direct3D11), Chrome, WebGL 1.0.

---

## 1. S8, quantization: real about the format, worth nothing in the image

The audit is correct that the NGSF dequantization is scene-independent. `parseNGSF` maps int16
positions against a hard-coded `2.5` with no per-scene AABB in the header, and maps scales through a
fixed exponential. The question is what that costs.

**Position range, all 27 shipped scenes, 1,992,087 components:**

| | |
|---|---|
| components pinned at the int16 rail | **0** |
| range utilisation | 40.4% (scene-15) to 55.9% (scene-01) |
| best case gain from a per-scene AABB | 2.48x |

**Scale range, same corpus:**

| | |
|---|---|
| codes at the exponential ceiling or floor | **0** |
| observed code span | 19,835 … 44,817 of 0 … 65,535 |
| world scale span | 1.39e-3 … 2.93e-2 |
| headroom above the largest actual splat | 12.5x |

Nothing is near either limit, so nothing is being clipped. What remains is wasted precision, and
precision only matters if it reaches the eye:

| | |
|---|---|
| position quantum | 7.63e-5 world units |
| at a 1550px backing (Studio, DPR 2) | **0.059 px** — one quantum every 17 pixels |
| with a per-scene AABB | 0.024 px |

The quantization step is already an order of magnitude finer than the pixel grid, and far finer than
a Gaussian footprint that spans several pixels. Recovering the other 2.5x would mean re-encoding the
scenes, which breaks the byte-exact provenance chain the atlas is served under — the receipts hash
the extracted artifacts. **Paying that for a change of 0.035 px is not a trade worth making.**

Scale is log-encoded (`exp(u/65535*8 - 9)`), so it wastes no headroom at all: 0.0122% relative per
step regardless of where a scene sits in the band. Quaternions quantize to 0.0018 degrees.

### The dismissal is now a guarded invariant

A measurement is only a reason not to act while it still holds. Three tests in
`system/spatial-atlas.test.mjs` fail if a future scene clips the position rail, presses against
either end of the scale band, or sits so far inside the position range that the quantum rises above
0.1 px. Any of those turns this dismissal back into a defect, loudly.

The remaining sub-items of S8 are declined on the same grounds: smallest-three quaternion encoding
would halve 64 bits to 32 in a format whose files are already extracted artifacts of record, and the
missing parser coverage was closed in PR #102.

## 2. S9, point-sprite energy: real, and fixed

Both point lanes clamped `gl_PointSize` to a floor of 1.0 without touching alpha:

```glsl
gl_PointSize = clamp(iSize * uPixelScale * (3.4 / max(0.4, -viewPos.z)), 1.0, 64.0);
```

A point sprite cannot be rasterized smaller than one pixel. A splat that earned a quarter of a pixel
was therefore handed four times the area at unchanged peak alpha. Energy is alpha times area, so
distant material read too dense, and every splat crossing the threshold under camera motion popped
rather than faded — the shimmer the audit describes.

The fix keeps integrated energy constant: compute the unclamped size, clamp it, and scale alpha by
the inverse area ratio.

```glsl
float want = iSize * uPixelScale * (3.4 / max(0.4, -viewPos.z));
float size = clamp(want, 1.0, uMaxPoint);
float areaRatio = min(1.0, (want / size) * (want / size));
```

`min(1.0, …)` matters: above the ceiling the ratio would exceed 1 and push alpha past what a sprite
can carry, so the upper clamp deliberately gets no compensation. A receding splat now fades to
nothing instead of clamping to a full-strength pixel.

`uMaxPoint` replaces the hard-coded ceilings (64 in the dust/beam lane, 42 in Crystal City) with the
driver's own `ALIASED_POINT_SIZE_RANGE`, capped to what each lane wants. An implementation that
stops at 32 was previously clamping the near field silently; it is now accounted for. The query is
cached per context, and a missing or nonsense range falls back to the lane's ceiling rather than to
zero — failing open, not dark.

### Where it matters, measured

Crystal City's textured lane sizes sprites independently of the backing, and its disclosed camera
boundary allows only ±0.12 units of dolly, so the affected population barely moves:

| dolly (boundary is ±0.12) | sub-pixel splats of 23,850 | excess energy removed |
|---|---|---|
| −0.12 | 1,155 (4.8%) | 0.07% |
| 0 | 1,230 (5.2%) | 0.08% |
| +0.12 | 1,301 (5.5%) | 0.09% |

The folded-light lane scales sprite size with the backing height, and viewport size genuinely
varies. This is where the defect lived:

| backing height | sub-pixel splats of 10,500 | excess energy removed |
|---|---|---|
| 360 px (phone) | 6,366 (60.6%) | **10.8%** |
| 480 px | 4,386 (41.8%) | 4.5% |
| 720 px | 2,263 (21.6%) | 1.0% |
| 1080 px | 645 (6.1%) | 0.1% |
| 1550 px | 79 (0.8%) | 0.0% |
| 2160 px | 0 | 0.0% |

**This was a small-screen defect.** On a phone the atmosphere carried about 11% more energy than it
should and popped as splats crossed the floor; on a desktop 4K canvas the fix does nothing at all.
That is why it never showed up in a desktop screenshot, and why the audit had to reason about it
from the shader rather than from an image.

An earlier version of this measurement swept camera distance to 6x the default and reported up to
49.7% excess energy. Those camera positions are not reachable — the disclosed boundary caps dolly at
±0.12 — and the figure is withdrawn. The tables above stay inside what a viewer can actually do.

## 3. Verification

- `system/spatial-shaders.test.mjs` (new, 7 tests): driver ceiling vs lane ceiling, fallback on a
  missing or nonsense range, single cached query, both lanes reading the uniform rather than a
  constant, both applying the ratio to alpha, and the inverse-square arithmetic including the
  no-compensation-above-the-ceiling case.
- `system/spatial-atlas.test.mjs` (3 added): the quantization envelope described above.
- Both lanes verified rendering in the Studio with no GL errors; folded light shows its receipt
  MATCH and its 10,500 splats.

## Still open

- **S7, asset density.** 27k Gaussians against a 1229x1536 source is about one per 70 source pixels,
  and the audit is right that this is the real quality ceiling. It is not a renderer change:
  raising it means regenerating scenes at higher density, and the 27 original PNGs are not in local
  storage — only the atlas derivatives. Doing it from derivatives would move these scenes from
  "extracted byte-exact" to "derived by us", which is a provenance and lane-labelling decision, not
  an engineering one. Flagged for the operator rather than taken unilaterally.
- Perturbation rendering for the 2D fractal, per
  `project-docs/2026-08-03-fractal-precision.md`.
