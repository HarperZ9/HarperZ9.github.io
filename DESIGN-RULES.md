# Project Telos site design rules

These are the governing rules for the portfolio site as of 2026-07-09. The old
white ceramic/editorial layer is retired for the public site. The current system
is dark-first, generative, broad-scope, and connected through one shared
navigation and design cascade.

## 1. One public map, many working surfaces

The site is not a set of unrelated pages and it is not a single-lane proof
manifesto. Home, overview, catalog, research, writing, docs, demos, and project
pages should read as one public map of a larger workshop.

Every page should answer three questions:

- what is this thing
- what can the visitor try, inspect, read, or use
- where should a serious reader go next

## 2. Visual thesis

The visual world is a model-native workshop: dark mineral field, procedural
growth, generative specimens, compact route maps, and precise tool surfaces. It
should feel built, not templated. Use generative art as craft, atmosphere, and
evidence that the system can make its own material, not as decoration pasted
behind text.

Reference material:

- private inspiration references stay outside the public repository
- procedural field loader: `system/generative-field.js`
- procedural engine source: `system/hero-gl.js`
- home spectrum shell: canonical `src/App.css` in `HarperZ9/telos-v2`
- shared public cascades: `system/system.css` and `system/doc.css`

## 3. Palette

Dark-first. The page ground is near-black with violet and magenta depth. The
primary signal is cyan. Ember, lime, violet, and muted lavender are supporting
signals for lanes, demos, and generated material. Light ceramic surfaces are
allowed only for generated social cards or print output.

Never reintroduce beige, cream, sand, paper, or generic editorial monochrome as
the screen default.

## 4. Typography

Use the committed system fonts:

- brand display: Telos Display 0.5, generated from `tools/fonts/build_telos_display.py`. The current build is a readable-outline derivation from Kilon: deterministic narrowing, subtle slant, contour breathing, local outline edits, and a dedicated lowercase l terminal so the face can carry identity without becoming illegible.
- readable display: Kilon for normal headings, document titles, labels, and mixed-case page delivery
- body: Hanken Grotesk
- mono/readout: JetBrains Mono or the home mono face where already bundled

Type should feel instrument-grade: large where it carries the page, precise in
readouts, and readable in essays. Avoid editorial serif affect, drop caps, and
repeated tiny section eyebrows as default scaffolding.

`typeface.html` is the public specimen surface. Keep it wired into the shared
nav and use it as the reference for the generated face: character coverage,
lookalike differentiation, readable lowercase forms, local font loading, the
0.5 generated-outline build, and the rule that Telos Display carries identity
while Kilon and Hanken Grotesk carry reading.

## 5. Generative material

Generative art can appear as:

- a full-field background under a strong veil
- a clipped specimen texture
- an ambient signal layer
- a tool-output or artifact exhibit
- a motion or canvas scene with reduced-motion fallback
- a route-seeded orbit, contour, crystal, or flow-field specimen generated in browser
- a route-seeded metaball, fluid-curl, ordered-dither, or ASCII field generated in browser
- a route-seeded hydra tile, lamp symmetry, poster dither, or interaction shock field generated in browser

Inspiration should be synthesized into first-party procedural output. Do not
copy inspiration images into the site or depend on bitmap backgrounds for the
core public style.

The synthesis rule is stable: borrow architecture and direction, never source,
shaders, images, or exact compositions. Any private research used to establish
that direction stays outside the deployed repository.

It must not reduce contrast or make content harder to scan. Text always wins over
the art layer.

## 6. Connected pages

Every shipped page should either:

- use the React home shell,
- use `system/system.css` plus `system/nav.js`, or
- use `system/doc.css` plus `system/nav.js` for document pages.

Pages that are intentionally standalone demos must still have a route back to the
site, an accessible title, and a clear source, demo, or context link where
possible.

## 7. Interaction and motion

Motion should read like entering a live system: scanning, sensing, drawing,
generating, or responding. It should not be a generic fade-on-scroll reflex.
Every motion path must honor `prefers-reduced-motion`. Content must be visible
without animation.

## 8. Bans

- no glassmorphism as the default material
- no gradient text as the primary emphasis
- no beige or cream page ground on screen
- no generic card grid as the main page structure
- no old editorial-magazine look
- no accountability/proof/trust framing as the site-level thesis
- no copied inspiration images as public assets
- no hand-authored per-page hero style that fights the shared system
- no hidden text, broken links, inaccessible nav, or motion-gated content

## 9. Verification

Before shipping visual changes:

```powershell
python -m pytest tests/test_portfolio_visual_contract.py
node tests/linkcheck.mjs
```

For CSS or link-heavy changes, also inspect desktop and mobile renderings in a
browser and run any targeted page tests that touch the changed surface.
