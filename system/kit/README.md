# system/kit

## Mission

Every working page in the workshop should feel like a room of the live site, harperz9.github.io: the same
wall and ink, the same living type, the same hand of controls, and the same care for people who read
with a keyboard, a screen reader, a slow phone or a wish for stillness. One stylesheet and one script
carry that design, so a change made here reaches every page on its next build.

## Source

The kit is the site's own design, gathered for standalone tool pages. Every value below comes from the
site file named beside it, and `tests/test_system_kit.py` fails when a shared token in `kit.css` drifts
from that file. The kit began as a workshop copy taken at origin/main 15f09cc9 (2026-10-28); since this
folder landed, the site is its only source, and workshop copies are rebuilt from here.

| Kit part | Site source |
|---|---|
| wall, ink, soft, line, card, mat, shadow, lamp, grid and super inks, light and dark | `world/ui/shell/shell.css` (CS-max tokens) |
| verdict colours, motion curves and durations | `world/ui/shell/shell.css` (base) |
| type scale `--fs-1` to `--fs-7`, face tokens, Hanken and Conso as the still fallback | `world/ui/shell/type.css` |
| Accession families (OFL 1.1) | `system/fonts/accession/` (variable and cuts, with `OFL.txt`) |
| the hand (lamp, motion, sound, peel), thin-film focus ring | `world/ui/shell/organic/organic.css` |
| storage keys `ui-theme`, `ui-plain` | `world/ui/shell/shell.js` |
| the four primaries `#c8322b #d79e35 #1d2562 #151314` | `world/universe/lib/here.js` (`PRIMARY`) |
| the seven regions and their laws | `world/universe/universe.json` (`regions`) |
| living type contract (`data-living`, scroll position s, clock t, still at t = 0) | `world/site/living-hook.js` |
| grain tile, exposed twelve-column grid, crop marks, dot-screen supergraphic | `world/ui/shell/shell.css` |

## Where the kit differs from the shell

Found when the kit moved into the site, and pinned by `tests/test_system_kit.py`, so each one changes
only on purpose:

| Token | Kit | Shell | Note |
|---|---|---|---|
| `--card` (dark) | `#1a1918` | `#d9d1bf` | the kit keeps a dark card on the night ground; reason not recorded |
| `--grain` | `.07` | `.05` | heavier grain; reason not recorded |
| `--fs-6` (under 860 px) | `40px` | `36px` | reason not recorded |
| `--face-text`, `--face-display`, `--face-utility` | Accession named directly | `var(--house-*)` | the same faces, resolved |
| `--lamp` (light) | `rgba(255,250,238,0)` | `rgba(255,250,238,.0)` | the same value, written differently |

## Files

- `kit.css`: tokens, faces, regions, ground, type, living type, the hand, controls, faders, knobs, records.
- `kit.js`: the hand, theme, plain view, motion, sound, living type, faders, knobs, canvas labels. `window.Kit`.
- `inline.py`: puts the kit inside a page between `<!-- site-kit:begin -->` and `<!-- site-kit:end -->`.
- `audit.py`: contrast, control names, canvas alternatives, tab order and focus, light and dark.
- `check.py`: drives the controls (lamp, knobs by key, Shift and drag, faders) and the 390 px reflow.
- `specimen.html`: every part on one sheet.
- Fonts: none are copied here. `kit.css` points at the site's files in `system/fonts`: the Accession
  families (OFL 1.1), Hanken Grotesk (OFL 1.1) and Conso, which ships only on this site under its terms.

## Use

A page puts the markers in its head, before its own `<style>`, and runs the inliner:

```html
<!-- site-kit:begin --><!-- site-kit:end -->
```

```
python system/kit/inline.py page.html
python system/kit/inline.py --check page.html   # exit 1 when the block is stale
```

A generated page calls it from its builder, so a rebuild keeps the style:

```python
sys.path.insert(0, "system/kit"); from inline import inline_kit
out.write_text(inline_kit(html, out), encoding="utf-8")
```

Font URLs are rewritten relative to the page, so pages opened from disk find `fonts/`. A page moved
elsewhere falls back to Hanken and the system stack. Then:

- `<body data-region="grid|deco|brut|surreal|print|glitch|archive">` picks the region's laws.
- `<main class="k-page">`, a `<header class="k-head">` with the `h1`, an optional `.k-lede`, an optional
  `<p class="k-super" aria-hidden="true">Word</p>` supergraphic and `<hr class="k-horizon">`.
- Controls: `fieldset` per job inside `.k-controls`; `button.k-primary` for the one primary action;
  `input type=range` is a fader; add `data-knob` (with `data-label`, `data-unit` or `data-labels="a|b|c"`)
  for a hardware knob; a `.k-rack` holds a row of knobs.
- Records: `table` inside `.k-scroll`, `[data-verdict="pass|fail|open"]`, `.k-frame` for a figure,
  `.k-card`, `.k-meta`, `.k-foot`.
- A page's own palette maps onto kit tokens in one `:root` block, for example
  `:root{--bg:var(--wall);--muted:var(--soft);--accent:var(--tide-2)}`, so light and dark follow the kit.
- Every canvas carries `aria-label` or `data-alt`; the kit labels any it finds from context and logs it.
- Animation loops read `Kit.still()` and subscribe with `Kit.on(fn)`; when still they draw one settled frame.

## Navigation and layers

Every page answers three questions at a glance: where am I, where can I go, how do I get back.

- **The rail** (built by `kit.js`): a trail, World / the page's map group / the page, and named tools:
  Map, Back, Lamp, Motion, Sound, Plain. Each tool shows its name and a glyph, and carries a tooltip.
  On a phone the tools sit in a bar at the bottom edge. The trail's group opens the map at that group.
- **The map** (`M` opens it, Escape closes it): every page, grouped by what it tells a reader, each with
  its title and its one-line message, with a find box. The map data (`map.js`) is built per workshop and is
  not part of the site; when a `map.js` sits beside `kit.css`, `inline.py` links it, and without one the
  rail shows no Map tool.
- **Three layers**, each deeper than the last, after the zoom in the Eames films:
  `<section class="k-layer" data-layer="toy">` a live toy anyone, a child included, can drag, take apart,
  rebuild and render; then `<p class="k-message">` the page's point in one line; then
  `data-layer="plain"`, plain words for the curious; then `data-layer="pro"`, the maths, data and
  receipts. Each layer opens with `<div class="k-layer-head"><h2>..</h2><span class="k-depth">..</span></div>`.
  The rail lists the layers as numbered jumps.

## Tokens and measured contrast

WCAG 2.x ratios, computed from the hex values. Text uses only pairs at 4.5 or more.

| Token | Light | on wall | Dark | on wall |
|---|---|---|---|---|
| `--ink` | #16130f | 14.48 | #ece5d6 | 15.77 |
| `--soft` | #4a443b | 7.53 (6.66 on wall-2) | #b8b0a0 | 9.19 |
| `--ember-1` | #a3241e | 5.81 | #f07a68 | 7.24 |
| `--ember-2` | #8f3517 | 6.11 (5.40 on wall-2) | #f09356 | 8.49 |
| `--ember-3` | #73490a | 6.11 | #e8b75a | 10.69 |
| `--tide` | #1d2562 | 11.00 | #9fb0f0 | 9.37 |
| `--tide-2` | #2f4a8f | 6.58 | #8e9be6 | 7.52 |
| `--verified` | #0a6b61 | 4.99 (4.42 on wall-2) | #63d4ce | 11.15 |
| `--drift` | #8f3a19 | 5.89 | #e29472 | 8.21 |
| `--unverifiable` | #4e4d85 | 6.03 | #b3b1e6 | 9.75 |

`--red`, `--ochre` and the series `--s1` to `--s5` are for marks, lines and large type. In light mode
`--s3` (#94640f, 4.02) and `--s5` (#b4491a, 4.20) clear the 3:1 needed for graphics; the raw site ochre
(#d79e35, 1.86) and orange (#e0652a, 2.71) do not, so they stay out of figures on the light wall. The
verdict green is the site's own value; on `--wall-2` it falls to 4.42, so verdicts sit on wall or mat.

## What the measurements decided

The live site fixes wall, ink, type scale, motion curves and the regions. Where it leaves a choice open, the
kit takes it from the taste measurements, and says how far each one reaches:

- **Few hues per view.** The design-grammar study (1718 saves, run 2026-10-30) found
  negative space against palette count rho -0.51 and against primitive count rho -0.67. The kit keeps one
  ink, one wall and at most five series hues per figure, the site's four primaries first, and one accent
  walk (red to orange, the author's "colour shifting like red to orange") for living type.
- **Room around groups.** Negative space ranks high in the F40 taste profile (Cliff's delta 0.300 against
  stock photographs, 0.418 against science images). Spacing runs on the site's 8 px cell, grouped on
  8 x (1, 2, 3, 5, 8, 13); the gap between groups (`--sp-5`, 40 px) is five cells and sections open at 64.
- **Sharp edges, deep darks, a strong horizon.** F40 ranks sharpness (0.394 / 0.467), lightness spread
  (0.329), RMS contrast (0.329), deeper shadows and horizon strength (0.190 / 0.393) above the references.
  So: hairlines at 1 px, no blur in any control, ink near black on the wall, the night ground near black,
  and one heavy rule under each title (`.k-horizon`) that ends in the primaries.
- **Edge density.** F40 edge density is higher (0.265). The kit lets the region show its structure: the
  exposed twelve-column grid (grid, brut), scan lines (glitch), a dot screen (print), crop marks on frames.
- **Harmony.** The saves split mixed 507, monochrome 390, analogous 370, achromatic 264, complementary
  150, triadic 37. Hence a monochrome wall with an analogous accent walk, and no triadic sets.

Does not prove: these measures describe saved images, not tool pages. They set defaults that a page can
override. The F40 profile cannot separate this author's taste from art and design taste in general (its
own limit), and C_elites failed, so no claim is made that the kit scores well on the taste model.

## Living type

`kit.js` follows the contract of `world/site/living-hook.js`: a heading with `data-living="display burin"`
names its stops; the reader's position s and the clock t move it; the heading's own words stay in the DOM.
The kit moves weight (620 to 860 on the variable axis, with a 26-unit breath), a misregistered second ink
that walks from red to orange, and the medium itself: every 9 s the heading bleeds into its next family
over the last 22% of the hold. Each page's `h1` takes its region's stops (grid "display slab", glitch
"mono display", archive "burin engraved" and so on). Under reduced motion, Motion off or Plain view it
settles at t = 0 on its first stop. Forced colours and print show plain ink.

The site's WebGL type engine (`world/typeengine/web/living-gl.mjs` and its worker) is not used: it loads as
ES modules and a module worker from the site root, which a page opened from disk cannot do. A page
published on the site should take `living-hook.js` in place of the kit's living type.

## Controls

- Faders: hairline slot, machined cap, the filled slot follows the value. Arrow keys move one step; Shift
  with an arrow moves ten; Home and End go to the ends.
- Knobs: a 270 degree sweep, a pointer, a value arc in red. A stepped value with 24 steps or fewer gets
  detents: one tick mark per step, a soft tick of sound and a 4 ms vibration per detent when Sound is on.
  Drag up or down (Shift for four times the travel), wheel, arrow keys, double-click to reset. Continuous
  knobs glide on after a flick with friction 0.9 per frame, and never under reduced motion. The range
  input stays in the page underneath, so forms, screen readers and page code see a plain range.
- Sound is off by default and never plays on its own.
- Buttons press down 1 px; hover lifts to `--wall-2`; the primary action is ink with a red offset.

## Cinema

From the colour and film catalogue (2026-10-30): the night
grade split-tones a warm key (the site's lamp, top right) against a cool fill low left (`raw-grade`); the
night title carries a faint red bloom, since halation reaches the red layer first (`mc-film-halation-base`);
a toy's frame falls off toward its corners at 18% of the cos^4 optical vignette
(`elder-cfx-optical-vignette`). Grain stays at the site's own values. Gate weave and light leaks are left
out: motion that does not explain anything.

## First screen, marks and failure (2026-10-30, round 3)

From the saves intake of 2026-10-30 (the intake notes, section
"Saves after 03:00, design first"). Measured on all 20 pages before and after; light, reduced motion.

- **One horizon per view.** A toy layer that follows the title takes the title's horizon as its top edge;
  its own red rule is dropped and the gap closes (`.k-head:has(> .k-horizon) ~ .k-layer[data-layer="toy"]`).
  After rubric rewards that score what must be absent as well as what must be present. Stacked rules in
  the first screen: 18 to 0. Toy top at 1440 px: mean 445 to 391 px.
- **One-line trail on a phone.** The mark stands for World (the word stays for screen readers in
  `.k-world`); the group and the page shorten with an ellipsis. Toy top at 390 px: mean 409 to 333 px;
  chrome share 0.175 to 0.130.
- **Registration marks.** `marks()` gives each `.k-frame` seeded crop-mark lengths (`--k-cm`, 7 to 13 px)
  and one mark in the slug below it, drawn from the region's species (grid target, print dot trio, archive
  double rule, deco fan and so on). After generative borders made from frame size, a seed and a species
  file. The mark is an `<i>` with a CSS mask, so a page's own `frame.querySelector("svg")` is unaffected.
  Hidden in plain view and forced colours; `data-k-marks="off"` on an ancestor turns it off.
- **One face while still.** The living type requests the next medium's face only once a bleed starts, so
  a still page loads one display face. Fonts at load: mean 376 to 318 KB.
- **Failure equivalence.** `check.py` also loads each page with scripts off and with fonts blocked at
  390 px; the title, message line and toy must still show, with no sideways scroll and no page errors.
- **First-screen precision.** `audit.py` reports `viewport`: chrome share, stacked rules, the toy's
  visible height and visible text runs. Reported, never scored.

Does not prove: these are layout measures on the pages they were tuned on. Whether readers prefer the
result is untested; a blind A/B on held-out pages is planned in the intake section.

## Checks

```
python system/kit/audit.py file:///path/to/page.html
python system/kit/check.py file:///path/to/page.html
```
