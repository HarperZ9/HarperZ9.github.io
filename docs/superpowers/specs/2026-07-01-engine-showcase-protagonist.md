# Engine showcase protagonist: First Integral

- **Date:** 2026-07-01
- **Repo / branch:** c:/dev/public/portfolio-site, `feat/engine-showcase`
- **Status:** spec, ready to build
- **Winning concept:** "First Integral" (lens: physics). One Kepler orbit, integrated live
  by the site's own symplectic integrator over a quiet reconcile flowfield ground; the
  discovery engine fits the conserved angular momentum from the trace; the same verifier
  visibly REFUSES a damped run; the whole scene is seeded, hashed, and re-checkable
  (MATCH / DRIFT / UNVERIFIABLE) in the browser.
- **Where it lives:** a new Studio source ("Showcase", Verify group) on studio.html.
  The recaptured `img/hero-engine.png` is state 4 of this live scene, so the site caption
  "rendered live in the Studio" stays literally true.

## Verified seams (all checked against source on 2026-07-01)

| Claim | Receipt |
|---|---|
| Kepler system, `r'' = -mu r / |r|^3` | `system/discovery/systems.js:60-80` |
| Kepler accel uses `Math.pow(r2, 1.5)` (NOT exact-rounded; blocks bit-hash as shipped) | `system/discovery/systems.js:77` |
| Kepler IC sampling uses `Math.cos`/`Math.sin` (NOT exact-rounded) | `system/discovery/systems.js:69-74` |
| Symplectic velocity-Verlet, optional `drag` dissipation as negative control | `system/discovery/integrator.js:18-40` |
| `jacobiEigen` uses only `+ - * / sqrt abs` (no trig; bit-stable given bit-stable input) | `system/discovery/reference.js:12-36` |
| `leastVarianceCombo`, `conservedSubspace` | `system/discovery/reference.js:49,111` |
| Lab canon for kepler: `seed 1, dt 0.004, n 2000, tol 0.05` | `system/discovery/lab.js:16` |
| Verifier verdicts `verified / refuted / unverifiable`; `recheckConservation` re-runs physics from the certificate's own params | `system/discovery/verify.js:25,55,90-98` |
| Negative controls are tested behavior | `system/discovery/discovery.test.mjs:110,115,119` |
| reconcile engine: browser-clean ESM, zero deps, all-relative imports, largest file 114 lines | `c:/dev/public/reconcile/src/*` (16 files) |
| `create/refine/evaluate/makeWorld/palette/CRIT` public API | `c:/dev/public/reconcile/src/index.js` |
| flowfield organ (field, verified GLSL via `renderProgram`), params scale/warp | `reconcile/src/organs/fields.js:30-41` |
| World id + receipt `{id, seed, organs, shas, witness}`; content hash is cyrb53 (`hashHex`), NOT SHA-256 | `reconcile/src/world.js:52-58`, `reconcile/src/hash.js:1-16` |
| `makeLayer(organ, params, palette)` takes an explicit palette array (we can force ceramic hexes; no organ change) | `reconcile/src/world.js:48-50` |
| reconcile GL harness precedent (`u_palette` upload, point recipes) | `reconcile/web/app.js:14-41` |
| Studio source registry + lifecycle seam | `system/studio.js:141-151` (SOURCES map), `:186-188` (discovery start pattern) |
| Animated-source gate that keeps the meter loop alive | `system/studio-loop.js:20-32` |
| `Spine.witness` = SHA-256 via `crypto.subtle`; `Spine.gate` default-deny | `system/spine.js:20-36` |
| `Studio.connectModel` seam | `system/studio.js:2577` |
| Capability probe + tier override | `system/engine/capability.js:136,162` |
| Vendor parity gate walks ONLY `.mjs` under `system/lib/` (vendored `.js` is invisible to it) | `system/lib/parity.test.mjs:17` |
| Vendor sync copies only `.mjs` from studio-libs | `c:/dev/public/studio-libs/scripts/sync-to-site.mjs` |
| sense-core `hueName(hDeg, sat, val)` vendored | `system/lib/sense-core/features.mjs:59` |
| Measurimeter swatches carry hex + percent but NO colour name | `system/studio.js:1932-1947` |
| Current hero is 1600x900 (633,972 bytes); target is the 2400 class | `img/hero-engine.png` (PNG header read) |
| `hero-engine.png` referenced by 32 html files + `system/hero.js`; hero.js is loaded ONLY by `_preview/hero-industrial.html` | grep, 2026-07-01 |
| The home hero is the Ribbon Field, pinned by contract (NOT hero.js) | `tests/test_portfolio_visual_contract.py:63-78` |
| Julia og:image:alt string present in 21 html files; catalog seal at `catalog.html:49`; specimen alt at `catalog.html:204` | grep, 2026-07-01 |
| Cache-buster convention `?v=YYYYMMDD<letter>`, used on script tags AND inside import specifiers | `studio.html:731-745`, `system/studio.js:6` |
| fractal-gl.js requests `antialias:false` today | `system/fractal-gl.js:205` |

## Decisions (deviations from the raw concept, each earned)

1. **D1, the pow fix (blocking).** The concept's bit-identity claim is false as shipped:
   `Math.pow(r2, 1.5)` is not IEEE-754 correctly rounded. Rewrite `systems.js:77` to
   `const r2 = s.x*s.x + s.y*s.y; const r3 = r2 * Math.sqrt(r2) + 1e-12;`. Every op in the
   Kepler right-hand side is then `+ - * /` or `sqrt`, all exact-rounded, so the trajectory
   is bit-identical across engines. Discovery tests are tolerance-based, so this is safe;
   re-run the discovery slice after the edit.
2. **D2, IC literals in the receipt.** `sampleState` uses `cos`/`sin`, which are not
   exact-rounded. The seed still derives the shipped initial condition, but the receipt
   records the IC as rounded decimal literals (r6), and re-check re-integrates FROM THE
   RECORDED LITERALS. Bit-hash coverage therefore starts at the literals, and the trig in
   the derivation can never poison a verdict.
3. **D3, the REFUSED beat is the same system, not a second protagonist.** Instead of
   swapping in the reconcile harmonograph organ (judges: "the refusal must read as the
   same verifier, not a second demo"), the refusal run is Kepler with `drag 0.02`, the
   integrator's own dissipation knob and the literal tested negative control ("verifier
   REFUSES energy on a DAMPED system"). Same equations, same integrator, same verifier,
   one honest knob. Drawn subordinate in the instrument band, never replacing the orbit.
4. **D4, the home keeps the Ribbon Field.** The home contract pins
   `<canvas id="ribbon-canvas">`, `system/ribbon-field.js`, and `system/home-scroll.js`.
   The four-state choreography therefore ships INSIDE the Studio scene (autoplay once per
   entry, then settle), not as home scroll states. Home impact is limited to: new pixels
   at the same `img/hero-engine.png` URL, and the og:image:alt string swap. Migrating the
   home protagonist is a separate future epic.
5. **D5, og:image policy.** BRAND.md's canon (flagship card as og:image) applies to
   flagship pages, and they already comply (e.g. studio.html's alt is the flagship card).
   The ~30 non-flagship pages that use `hero-engine.png` today keep it, recaptured. No og
   migration inside this epic; only the Julia strings change.
6. **D6, sound is cut from v1.** Concept risk 7 plus judge consensus. Key `M` is reserved
   and documented as not shipped. A silent scene is canon-clean.
7. **D7, static ground frame.** The flowfield World is animatable, but at 2 to 3 percent
   ink contrast a static `t=0` frame reads identically, costs nothing on mobile, and makes
   the reduced-motion frame and the hero still pixel-honest. Render the ground once per
   seed, composite as an image.
8. **D8, the display-type layer (judges' shared gap).** The capture frame (and only the
   capture frame layout) carries one edge-pinned Archivo display word, `FIRST INTEGRAL`,
   per DESIGN-RULES rules 3 and 4, so the still reads as the site's canon and not a lab
   notebook. In-Studio the type layer stays mono instrument scale.
9. **D9, vendored reconcile gets its own parity gate.** The existing gate walks `.mjs`
   only, so vendored `.js` would silently drift. A new `system/lib/reconcile-parity.test.mjs`
   byte-compares every vendored file against `c:/dev/public/reconcile/src`.
10. **D10, naming.** `system/reconcile.js` (the stroke-judgment port, loaded at
    `studio.html:736`) is untouched. The vendored engine lives at `system/lib/reconcile/`
    and is imported under the local name `reconcileEngine` wherever both are in scope.
11. **D11, hash honesty in the receipt.** The reconcile World receipt's `witness` is
    cyrb53 (fast content hash, verified). The scene's top-level receipt is SHA-256 via
    `globalThis.crypto.subtle` over the canonical report JSON, which EMBEDS the World
    receipt. The chip labels both: "report sha256 <12 hex>, ground world <cyrb53 id>".
    Never present cyrb53 as SHA-256.

---

## WAVE 1: rendering core + integration

### 1.1 Vendor the reconcile engine

- New script `tools/sync-reconcile.mjs` (node, zero-dep, mirrors the style of
  studio-libs' `sync-to-site.mjs`): copies `c:/dev/public/reconcile/src/**/*.js`
  (16 files, incl. `organs/`) to `system/lib/reconcile/`, plus the reconcile `LICENSE`
  to `system/lib/reconcile/LICENSE`. `sync-to-site.mjs` stays untouched; it belongs to
  studio-libs and is scoped to `.mjs` sources.
- Verified browser-clean: no node builtins, all-relative ESM imports, so the tree works
  as-is under `system/lib/reconcile/index.js`.
- License note: reconcile is AGPL-3.0-or-later, author is the operator (copyright holder
  on both repos). The vendored copy keeps its headers and LICENSE file; the site repo is
  public on GitHub Pages, so source availability holds. No conflict.
- New gate `system/lib/reconcile-parity.test.mjs`: walks `.js` under
  `system/lib/reconcile/`, byte-compares each against `c:/dev/public/reconcile/src/`
  (same hardcoded local-path convention as `parity.test.mjs`), and asserts
  `index.js` and `organs/index.js` are present.

### 1.2 render-nd / sense-core re-sync

- Run `node c:/dev/public/studio-libs/scripts/sync-to-site.mjs` once before merge.
  Expected: no diffs unless 1.4 lands. Any render-nd change MUST land in
  `c:/dev/public/studio-libs/render-nd` first, then re-sync, or the byte-parity gate
  goes red (verified: the gate walks the vendored tree and compares to studio-libs).
- This scene does NOT use render-nd (its WebGL backend is additive-glow on a dark
  ground; wrong tool for ceramic). sense-core is used for the readout (1.3, wave 3).

### 1.3 The new Studio source module

Directory `system/showcase/` (each file under 300 lines):

| File | Responsibility |
|---|---|
| `system/showcase/first-integral.js` | Source lifecycle (`startShowcase(canvas)`, `stopShowcase()`), the four-state machine, control + keyboard wiring, aria-live feed |
| `system/showcase/orbit-render.js` | Ground World creation + GL render-to-offscreen (or CPU `sampleField` fallback), composite, accumulating ink polyline, iris accents, capture layout |
| `system/showcase/report.js` | Shipped IC literals, integrate + fit + verify calls, canonical JSON serializer (fixed key order, r6 state, r4 coefficients), SHA-256 via `globalThis.crypto.subtle` (same digest in node >= 18 and browser), verdict mapping, `recheck()` |
| `system/showcase/readout.js` | One structured readout, two renderings: sentences (aria-live) and JSON (model channel) |
| `system/showcase/verify-cli.mjs` | Node re-run: prints the canonical report JSON + sha256 to stdout, byte-stable, for CI |
| `system/showcase/showcase.test.mjs` | Node tests (see TESTS) |

Wiring (all additive, none of the pinned markers removed):

- `system/studio.js`:
  - `import { startShowcase, stopShowcase } from "./showcase/first-integral.js?v=20260701a";`
  - `SOURCES` gains `showcase: { block: "src-showcase", mode: "generate" }` (seam at
    `studio.js:141-151`).
  - `setSource` gains `if (next === "showcase") { try { startShowcase($("studio-canvas")); } catch (_) {} startMeterLoop(); }`
    and the leave-cleanup gains `try { stopShowcase(); } catch (_) {}` (mirror of the
    discovery pattern at `studio.js:186-188`).
  - Debug/test global, following the `__studio*` convention:
    `window.__studioShowcase = { report, verdict, recheck }`.
- `system/studio-loop.js`: add `case "showcase":` returning `!s.showcaseSettled`
  (animated during states 1 to 3, idles once settled; the gate is at
  `studio-loop.js:20-32`).
- `studio.html`:
  - Verify group (line 56 region) gains one tab:
    `<button type="button" role="tab" data-source="showcase" aria-selected="false" aria-controls="src-showcase" tabindex="-1">Showcase</button>`.
    The pinned group labels "Create", "Observe", "Verify" and every pinned control id
    stay byte-identical.
  - New `<section class="src-block" id="src-showcase" role="tabpanel" aria-label="Engine showcase controls" hidden>` with ids:
    `show-seed`, `show-system` (chips: sho, pendulum, kepler, oscillator2d; kepler default),
    `show-ecc`, `show-dt`, `show-n`, `show-drag` (the refusal toggle), `show-terms`,
    `show-replay`, `show-verify`, `show-export`, `show-receipt` (chip), `show-verdict`,
    `show-live` (`aria-live="polite"`), `show-doc` (the connectModel/MCP doc block, wave 3).
  - Cache busters: `system/studio.js?v=20260628a` becomes `?v=20260701a` (line 742).
    No other script tags change; the showcase modules are imported by studio.js, not
    script-tagged.
- Media IR: **none needed.** The scene draws into the shared `#studio-canvas` exactly
  like the Physics source, so the measurimeter, exporters, snapshot, and model seam all
  work unchanged. `CANONICAL_MEDIA_KINDS` untouched.

### 1.4 WebGL quality upgrades (scoped, droppable garnish)

- `system/fractal-gl.js`: DPR-aware backing store only, `min(devicePixelRatio, 2)` on
  tier mid and above (tier from the existing `probeCapability`/`pickTier`). Keep
  `antialias:false` (MSAA does nothing for full-screen fragment content). One clamp,
  fail-safe, revert if integrated-GPU frame time regresses.
- render-nd line AA (the Dimensions source): request `antialias:true` in the WebGL1
  context attributes of `render-nd/backends/webgl.mjs` (MSAA does smooth line-primitive
  edges). This edit lands in `c:/dev/public/studio-libs/render-nd` FIRST, then
  `sync-to-site.mjs` re-syncs, keeping the parity gate green. Browsers may ignore the
  flag; that is the fail-safe.
- Nothing else. No new framebuffer passes, no glow work, nothing on the showcase path.

---

## WAVE 2: the protagonist

### 2.1 Composition (five layers, back to front)

| Layer | Content | Palette |
|---|---|---|
| L1 | The page ceramic itself, untouched | `#f4f3ef` (`--paper`) |
| L2 | Ground: `create("flowfield", {seed, scheme})` World rendered once at `t=0` by its verified GLSL program to an offscreen canvas, composited as an image. Palette forced via `makeLayer`'s explicit palette array to a ceramic ramp (e.g. `#f4f3ef, #f1f0eb, #eeede7, #ebeae4, #e9e8e1, #edece6`), 2 to 3 percent contrast: grain, not decoration. CPU fallback: `sampleField(expr, 24, 0)` (in `expr.js`) painted as a coarse smooth-scaled 2D gradient; if even that is unavailable, plain ceramic and the readout says so | ceramic family only |
| L3 | Protagonist: the Kepler trajectory at lab defaults (`dt 0.004, n 2000`), drawn as an accumulating ink polyline on Canvas2D with per-segment low-alpha darkening (multiply-style accumulation). Equal-time sampling shades the ellipse honestly: dense at aphelion, sparse at perihelion. Never additive glow on white | ink `#0b0c0e` at low alpha |
| L4 | The single accent, iris `#4636e8`, exactly three uses: the moving body dot, the fitted-invariant hairline `L(t)` flat across the base band, the verdict chip | iris only |
| L5 | Type: seed line, system name, fitted law in mono, hairline rules. Capture layout additionally pins one Archivo display word `FIRST INTEGRAL` to the frame edge (D8) | ink |

WebGL1 is needed only for L2 (the reconcile fragment program, full-screen triangle,
`u_palette` upload per `reconcile/web/app.js`). L3 to L5 are Canvas2D and are fully
sufficient at 2000 points. No float textures, no blending exotica.

### 2.2 Seed handling

- Visible seed line, mono, always rendered first:
  `seed 1 . kepler . dt 0.004 . n 2000`.
- The seed drives: the flowfield World (organ params + scheme via the seeded organ
  defaults) and the IC derivation (`sampleState(rng(seed))`, eccentricity clamped, see
  2.6). The receipt then records the derived IC as r6 decimal literals (D2), and every
  re-check integrates from the literals.
- `show-seed` input accepts any string; hash to uint32 for `rng`. URL param
  `studio.html?source=showcase&seed=<s>` pre-seeds the scene (the `params.get`
  convention already pinned in studio.js is followed, not altered).

### 2.3 The states (in-Studio choreography, D4)

Autoplays once on source entry, then settles; `show-replay` or key `R` replays.

1. **SEED.** Seed line and IC literals print in mono; the ground breathes in (static
   frame, fade only); no orbit yet.
2. **MOTION.** The integrator runs (chunked, about 60 steps per frame so the whole trace
   takes about 2 seconds); the ink line accumulates; the iris body dot is the only
   motion accent.
3. **LAW.** On completion the fit runs ONCE (never in the render loop):
   `leastVarianceCombo` / `conservedSubspace` over the stated basis (default
   `x*vy, y*vx`, editable via `show-terms`). The `L(t)` hairline appears dead flat with
   value and drift ratio, e.g. `x*vy - y*vx = 0.9137 . drift 4e-4`. A beat later the
   refusal run executes LIVE in the instrument band: same Kepler, `drag 0.02`, energy
   candidate; its hairline visibly sags; the verifier (`verify.js`) returns `refuted`
   and the band stamps `REFUSED`. The verdict is read from the verifier's return value;
   a canned string is forbidden and tested against.
4. **WITNESS.** The canonical report assembles; SHA-256 renders as the receipt chip
   (first 12 hex + seed + policy line); the re-check control arms; the initial in-browser
   re-check runs and stamps `MATCH`.

Reduced motion (matching the `prefers-reduced-motion` precedent in home-scroll.js,
hero.js, capability.js): skip 1 to 3 visually, render the settled state 4 frame, but
STILL execute integrate + fit + verify + hash exactly once, so every number on screen is
real. `showcaseSettled` flips immediately so the meter loop idles.

### 2.4 Witness, receipt, re-check

Canonical report JSON (fixed key order, written by one serializer in `report.js`):

```
{ schema: "telos.showcase.first-integral/1",
  system: "kepler", seed: "1", dt: 0.004, n: 2000,
  ic: { x: r6, y: r6, vx: r6, vy: r6 },
  basis: ["x*vy", "y*vx"],
  coefficients: [r4...], invariant_value: r4, drift_ratio: r6,
  refusal: { drag: 0.02, basis: [...], verdict: "refuted" },
  verifier: { oracle: "conservation-v1", tol: 0.05 },
  hash_policy: "kepler trajectory bit-hashed (+,-,*,/,sqrt only, from recorded IC literals); sin-based systems hash the recipe and verify values by tolerance",
  ground: { organ: "flowfield", world: { id, seed, organs, shas, witness } },
  trajectory_sha256: "<sha256 of the joined full-precision state strings>" }
```

- `trajectory_sha256`: SHA-256 over `states.map(s => x,y,vx,vy full-precision Number
  strings).join(";")`. ECMA-262 shortest round-trip printing means bit-identity implies
  string identity, so this is the bit-hash (valid ONLY under the D1 pow fix + D2 IC
  literals; that is the policy split, and it is printed inside the receipt).
- Receipt chip = SHA-256 over the canonical report JSON, via `globalThis.crypto.subtle`
  (identical code path in node and browser; `Spine.witness` remains the browser
  convenience and produces the same digest).
- **Re-check** (button or key `V`): re-integrate from the recorded literals, re-fit,
  re-run the refusal, re-serialize, re-hash, compare.
  - `MATCH`: recomputed hash equals the receipt.
  - `DRIFT`: recomputation ran but hash or any toleranced value diverged; the actual
    deltas print in the chip, never hidden.
  - `UNVERIFIABLE`: the capability probe (`probeCapability()`) says the environment
    cannot re-run (no canvas AND no worker budget, or `crypto.subtle` absent outside a
    secure context, per the `Spine.witness` null path); the chip says so instead of
    pretending.
- **Node CLI:** `node system/showcase/verify-cli.mjs` re-runs the same modules and
  prints the canonical JSON + hash byte-for-byte, so CI asserts MATCH headlessly.

### 2.5 Hero recapture procedure

1. Serve locally: `python -m http.server 8802` from the repo root (the linkcheck BASE).
2. Capture with headless Chrome (the BRAND.md og-card precedent):
   `chrome --headless=new --window-size=2400,1350 --hide-scrollbars --virtual-time-budget=20000 --screenshot=img/hero-engine.png "http://localhost:8802/studio.html?source=showcase&hero=1&seed=1"`
3. `hero=1` puts `first-integral.js` in capture layout: body class hides nav, rails, and
   toolbar; the canvas letterboxes to the full 2400x1350 frame; states run once on an
   accelerated timeline; `window.__showcaseSettled = true` when state 4 is composed
   (the virtual-time budget covers it; the whole pipeline is milliseconds of compute).
4. Verify the PNG: 2400x1350 (current file is 1600x900, 633,972 bytes; budget <= 900 KB;
   ceramic compresses well). The og:image URL does not change, only the pixels.
5. Composition check against the concept's heroStill: ellipse left of golden section,
   dense far arc, empty focus, one iris dot, one flat iris hairline with
   `x*vy - y*vx = 0.9137 . drift 4e-4 . MATCH`, second hairline row with seed + first
   12 hex of the receipt, `FIRST INTEGRAL` display word edge-pinned.

### 2.6 Eccentricity clamp (the DRIFT-on-our-own-homepage risk)

`sampleState` already samples sub-circular speeds (0.7 to 0.95 of circular). The shipped
seed-1 IC must land at moderate eccentricity; `showcase.test.mjs` asserts the shipped
literals produce `drift_ratio < 0.025` (half the lab tol 0.05) over the full 2000 steps,
in CI, before any capture. If seed 1 ever violates it, pick the shipped seed by test,
never by eye.

### 2.7 Caption sweep (plan-required rename, per the no-blind-rename rule)

Exact string replacements, then linkcheck + home contract + showcase tests:

1. og:image:alt, 21 files (grep-enumerated at execution time, not from this list):
   - OLD: `A still from the engine: a Julia set rendered in the site's palette, real mathematics drawn by our own code.`
   - NEW: `A still from the engine: a Kepler orbit with its conserved angular momentum fitted from the trace, real mathematics drawn by our own code.`
2. `catalog.html:49` seal line (keep the link markup byte-identical inside):
   - OLD: `The hero is a Julia set, real mathematics, <a ...>rendered live in the Studio</a>.`
   - NEW: `The hero is a Kepler orbit with its angular momentum fitted from the trace, real mathematics, <a ...>rendered live in the Studio</a>.`
3. `catalog.html:204` specimen alt:
   - OLD: `A still from the engine: a Julia set rendered in the site's palette`
   - NEW: `A still from the engine: a Kepler orbit and its fitted invariant rendered in the site's palette`
4. Guard: the Studio's 2D fractal source legitimately mentions Julia sets (fractal.js
   presets, fractal docs). ONLY the three hero-caption strings above are swept. Grep for
   remaining `Julia` after the sweep and justify every survivor.

### 2.8 Home-page impact (index.html)

- Verified reality: `system/hero.js` is loaded only by `_preview/hero-industrial.html`;
  it samples `/img/hero-engine.png` as a displacement texture (`hero.js:1129-1131`) and
  inherits the recapture with zero code change. index.html's visible hero is the Ribbon
  Field.
- What changes on index.html: line 16's og:image:alt string (sweep item 1). Nothing else.
- What must NOT change (pinned by `test_portfolio_visual_contract.py`):
  `<canvas id="ribbon-canvas"`, `system/ribbon-field.js`, `system/home-scroll.js`,
  the absence of `styles.css`, `name="color-scheme" content="light"`,
  `content="#f4f3ef"`, the thesis copy (`Build with a model.`,
  `Take nothing on faith.`, `Eight engines, equal standing.`,
  `Looking verified is not the same as being verifiable.`,
  `Build it to be checked, or do not ship it.`), `MATCH` / `DRIFT` / `UNVERIFIABLE`,
  the dex rail labels, and zero em/en dashes in index.html, home.css, ribbon-field.js,
  home-scroll.js.

---

## WAVE 3: a11y + model tooling

### 3.1 Keyboard map (scene keys active only while the showcase source is selected and focus is on the stage or its rail; never while typing in an input)

| Key | Action |
|---|---|
| Arrow keys | Step the focused parameter (native range/number inputs: seed, ecc, dt, n; Shift for coarse) |
| `S` | Cycle system chips (sho, pendulum, kepler, oscillator2d) |
| `Space` | Pause / resume integration (also arms the existing `rt-playpause` toolbar button) |
| `R` | Replay states 1 to 4 |
| `V` | Re-verify (re-check the receipt) |
| `E` | Export World + report JSON (via the existing StudioExporters `download` path) |
| `M` | Reserved for sound; not shipped in v1; documented as such |

Every control is a real focusable element with the existing visible focus ring; the tab
into the source uses the tablist's roving tabindex already in place.

### 3.2 One readout, three audiences

`readout.js` builds a single structured object per state change:
sense-core numbers from the composed frame (box-average luminance grid, dominant colours
with `hueName`), plus the scene facts (system, seed, state, invariant value, drift ratio,
refusal verdict, receipt hash, verdict). Consumers:

1. **aria-live:** `#show-live` (`aria-live="polite"`), one sentence per state change,
   announced once each, e.g.
   `Kepler system, seed 1. Orbit complete. Angular momentum 0.9137, conserved within stated tolerance 0.05. Damped run refused by the verifier. Verdict MATCH. Dominant colours near-white ceramic and ink, one iris accent.`
   The canvas keeps a full text alternative describing the ellipse and the flat
   invariant line.
2. **Model channel:** the same JSON rides the existing perception assembly behind
   `Studio.connectModel` (`studio.js:2577`) and the studio-perception MCP; the model
   perceives exactly the numbers a screen reader hears.
3. **Measurimeter:** unchanged; it perceives the shared canvas as with any source.

### 3.3 Measurimeter swatch naming fix

`paintSwatches` (`studio.js:1932`) names its colours: convert each swatch hex to HSV,
call the vendored `hueName(h, s, v)` (`system/lib/sense-core/features.mjs:59`), then
`aria-label` becomes `Colour <name> <hex>, <pct> of the frame` and `title` becomes
`<name> . <hex> . <pct>`. Visible label stays the percent. Applies to every source, not
just the showcase; purely additive.

### 3.4 Dex-rail keyboard operability (audit scope)

The dex is native anchor links (`index.html:39-45`) and `:focus-visible` is pinned in
home.css, so it is expected operable. Audit only: tab to each dex link, activate, confirm
the focus ring is visible and the target section receives scroll. Fix only if a defect is
found, additively (e.g. `scroll-margin-top`), never restructuring the pinned markup.

### 3.5 On-page documentation

`#show-doc` (mono, hairline-ruled, inside the showcase rail): three sentences documenting
that `Studio.connectModel(fn)` receives the identical readout JSON, that the
studio-perception MCP serves the same channel to a local model, and that key `V`
re-checks the receipt. Additionally one clause in the existing About details block
(additive; the pinned About strings stay).

---

## TESTS

### Must stay green (pinned strings quoted from source)

- `tests/test_portfolio_visual_contract.py`: all of it, notably
  `'<canvas id="ribbon-canvas"'`, `"system/ribbon-field.js"`, `'"styles.css" not in src'`,
  `"--paper:#f4f3ef"`, `"Build with a model."`, the `MATCH` / `DRIFT` / `UNVERIFIABLE`
  loop, and `test_no_em_or_en_dashes_in_home_and_system`.
- `tests/test_studio_showcase.py`: the section labels
  `("Create", "Observe", "Verify", "Model transforms", "Palette &amp; detail", "4D+ rotation")`,
  every pinned control id (`engine-statusbar` ... `engine-status-media`), and every
  studio.js marker (`'from "./studio-effects.js"'`, `'from "./engine/capability.js"'`,
  `"CANONICAL_MEDIA_KINDS"`, `"__studioMediaAdapters"`, `'params.get("autodetect") !== "1"'`, ...).
  All showcase edits are additive around them.
- `system/lib/parity.test.mjs`: `vendored ${f} === studio-libs source` for every `.mjs`;
  goes red if 1.4's render-nd edit skips studio-libs.
- `tests/linkcheck.mjs`: the dead-link crawl over every shipped page at
  `http://localhost:8802/`.
- `system/discovery/discovery.test.mjs`: `"verifier REFUSES a non-conserved quantity"`,
  `"verifier REFUSES energy on a DAMPED system (negative control)"`,
  `"verifier REFUSES trivial constants"` (re-run after the D1 pow fix).
- `tests/test_engine_assembly_scope.py`: untouched.

### New node tests

`system/showcase/showcase.test.mjs`:

1. **Determinism:** `buildReport(seed "1")` twice yields byte-identical canonical JSON
   and identical SHA-256; the ground World id is stable across calls.
2. **Pow-fix pin:** the kepler accel source contains no `Math.pow` (regression guard for
   D1), and two independent 2000-step integrations from the shipped literals produce
   identical joined state strings (the bit-hash precondition).
3. **Verdicts:** `recheck(report)` returns `MATCH`; a tampered coefficient returns
   `DRIFT` carrying the actual deltas; a stubbed capability failure returns
   `UNVERIFIABLE` with the stated reason.
4. **Refusal is computed, not canned:** the `drag 0.02` run's `refusal.verdict` equals
   the live return of the verifier (`verify.js` oracle `refuted`), asserted by calling
   the verifier independently in the test; the string `REFUSED` appears in the UI layer
   only via that value.
5. **Drift clamp:** shipped seed-1 literals give `drift_ratio < 0.025` (headroom under
   lab tol 0.05).
6. **Policy split:** the receipt's `hash_policy` string is present and the serializer
   refuses to emit `trajectory_sha256` for sin-based systems (sho, pendulum,
   oscillator2d get recipe + tolerance verification only).
7. **CLI byte-identity:** two runs of `verify-cli.mjs` byte-equal, and equal to the
   test-computed canonical JSON (this is the headless MATCH assertion for CI).
8. **Em-dash scan:** no em or en dash in any `system/showcase/*` file or in the
   `src-showcase` region of studio.html.

`system/lib/reconcile-parity.test.mjs`: every vendored reconcile `.js` byte-equals its
`c:/dev/public/reconcile/src` source; `index.js` and `organs/index.js` present.

Targeted regression slice (default run, per the global testing standard):
`python -m pytest tests/test_studio_showcase.py tests/test_portfolio_visual_contract.py -q`
plus `node --test system/showcase/ system/lib/ system/discovery/discovery.test.mjs`,
plus the linkcheck run before merge.

### Visual verification checklist (screenshots archived with the PR)

| Case | What must be true |
|---|---|
| Desktop, WebGL1 | Ground grain visible at 2 to 3 percent; ink orbit with honest aphelion density; exactly three iris uses; MATCH chip after re-check |
| Integrated GPU / tier low | Same frame within tolerance; no frame drops during MOTION; fit runs once (no per-frame fit, profiled) |
| Mobile 390px | Scene letterboxes; type layer legible; controls reachable; no horizontal scroll |
| prefers-reduced-motion | Settled state 4 only; numbers real (fit executed once); no animation |
| No WebGL (tier/override via `pickTier` override) | CPU ground or plain ceramic; polyline still draws on Canvas2D; readout states the degrade; verdict honest (UNVERIFIABLE only if re-run is truly impossible) |
| Keyboard only | Full map in 3.1 operable; visible focus at every stop; aria-live announces each state once |
| Hero still | 2400x1350; matches 2.5 composition check; recapture reproducible from the same seed |

---

## NON-GOALS (explicit)

- No dark theme anywhere; the ceramic ground is the ground.
- No new pages; the capture layout is a query-param mode of studio.html.
- No studio-engine (Python) dependency at runtime; the browser scene uses only the
  vendored reconcile ESM and the site's own modules.
- No breaking the Studio source menu contract: every existing tab (Atelier, 2D Fractal,
  3D Fractal, Dimensions, Bring your own, Watch with me, Music, Physics) and the pinned
  Create / Observe / Verify grouping remain; Showcase is additive.
- No em-dashes, no en-dashes, anywhere, including this spec, the new modules, the new
  studio.html copy, and every swept caption.
- No sound in v1 (D6). No render-nd on the showcase path. No home hero replacement
  (D4). No og:image policy migration (D5). No bit-hashing of sin-based systems, ever
  (the policy split is enforced by test 6).

## Risks and mitigations (carried from concept + judges, all owned)

1. **False MATCH/DRIFT via float nondeterminism:** only the Kepler path is bit-hashed,
   and only from recorded IC literals after the pow fix (D1, D2); enforced by tests 2
   and 6.
2. **Honest DRIFT on our own hero:** eccentricity clamp + CI drift assertion (2.6,
   test 5) gate the capture.
3. **Ink accumulation on white:** Canvas2D low-alpha darkening; additive glow is
   forbidden on this path and absent from the code.
4. **Caption blast radius:** scripted, checklisted sweep (2.7) followed by linkcheck +
   home contract + grep-for-survivors.
5. **Mobile CPU:** fit once at completion, chunked integration, static ground frame
   (D7); profiled on tier low.
6. **Theatrical refusal:** the verdict is the verifier's live return value; test 4 makes
   a canned REFUSED unshippable (the crucible lesson).
7. **One-accent drift:** the ground palette is ceramic-family hexes passed explicitly to
   `makeLayer`; the visual checklist verifies dominant colours read as ceramic + ink +
   one iris via sense-core on the captured frame.
8. **Scope:** sound is already cut; if the week tightens further, cut the Archivo
   capture-frame word (D8) before anything load-bearing, and never cut a test.

## Build order

Wave 1 (vendor + module skeleton + parity gates + AA tweaks), commit.
Wave 2 (scene + receipt + re-check + CLI + tests 1 to 8 green, then recapture + sweep +
linkcheck), commit.
Wave 3 (keyboard + readout + swatch names + docs + audit), commit.
Then the full targeted slice, the visual checklist, and the PR on `feat/engine-showcase`.
