# Portfolio site design rules

These are the governing rules for the portfolio site as of 2026-09-06. The
current direction is a clean, professional editorial workshop, with comfortable
light and dark modes and one connected navigation system. This supersedes the
July dark-first, full-field generative direction.

## 1. One public map, many working surfaces

The site is not a set of unrelated pages and it is not a single-lane proof
manifesto. Home, overview, catalog, research, writing, docs, demos, and project
pages should read as one public map of a larger workshop.

Every page should answer three questions:

- what is this thing
- what can the visitor try, inspect, read, or use
- where should a serious reader go next

## 2. Visual thesis

Lead with the work and give it room. Use clear titles, readable paragraphs,
purposeful figures and direct next actions. Essays should read like essays;
working tools should retain their controls and outputs. Keep useful generative
art as an exhibit, not an ambient layer competing with prose. Do not flatten
every surface into the same card grid.

Reference material:

- private inspiration references stay outside the public repository
- procedural field loader: `system/generative-field.js`
- procedural engine source: `system/hero-gl.js`
- canonical home source: `home/src/` in this repository
- shared public cascades: `system/system.css`, `system/doc.css` and the
  reading, report, demo and instrument editorial stylesheets in `system/`
- Telos V2 is reference material, not the publication or deployment authority

## 3. Palette

Support light paper and quiet dark grounds. Keep body text high-contrast and
secondary text readable. Use restrained accents for links, focus and meaningful
states; provide text or shape as well as color for verdicts. Figures may use a
limited explanatory palette. Do not use color or animated backgrounds to turn
metadata into the visual headline.

## 4. Typography

Use two principal families with distinct roles: readable text and expressive
display. The current shared delivery uses bundled Hanken Grotesk and Conso;
verify each surface rather than assuming every legacy page has migrated. A
monospaced fallback is appropriate for code, not for an extra decorative voice.

Use mixed-case headings, comfortable line lengths and clear size/weight
hierarchy. Avoid repeated tiny tracked uppercase labels, category eyebrows and
ornamental wordmarks. Check actual paragraphs, numerals and ambiguous glyphs at
reading sizes, not only large specimen headlines.

Original custom families are being developed privately. Do not publish their
engine, masters or development binaries here. Do not reinstate the old derived
display face as the default or imply that a local build establishes retail
rights. Only reviewed, explicitly released font artifacts belong on the public
site. `typeface.html` is a public specimen, not a private foundry interface.

## 5. Generative material

Generative art can appear as:

- a clipped specimen texture
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

Artwork should not carry repeated brand/category eyebrows, slash-separated
keyword rails, or a second corner wordmark. Keep the title and, when useful,
one plain-language description. Preserve functional figure labels, source
attribution, legends, and genuine process diagrams.

## 6. Connected pages

Every shipped page should either:

- use the React home shell,
- use `system/system.css` plus `system/nav.js`, or
- use `system/doc.css` plus `system/nav.js` for document pages.

Pages that are intentionally standalone demos must still have a route back to the
site, an accessible title, and a clear source, demo, or context link where
possible.

## 7. Interaction and motion

Motion should explain a change or demonstrate a tool. It should not be an
ambient requirement or a generic fade-on-scroll reflex.
Every motion path must honor `prefers-reduced-motion`. Content must be visible
without animation.

## 8. Bans

- no glassmorphism as the default material
- no gradient text as the primary emphasis
- no generic card grid as the main page structure
- no ornamental metadata rails, repeated seals or hashes in the reading path
- no accountability/proof/trust framing as the site-level thesis
- no copied inspiration images as public assets
- no hand-authored per-page hero style that fights the shared system
- no hidden text, broken links, inaccessible nav, or motion-gated content

Keep provenance, dates, sources and limitations accessible through plain links,
captions or optional details. Removing clutter must not remove evidence or
functional controls. Preserve discoverable routes to Bulletin, Flywheel,
publications and the broader workshop.

## 9. Verification

Before shipping visual changes:

```powershell
python -m pytest tests/test_portfolio_visual_contract.py
node tests/linkcheck.mjs
```

For CSS or link-heavy changes, inspect desktop and mobile renderings in light
and dark modes and run targeted page checks. Verify keyboard access, reflow,
reduced motion and readable print output. Inventory all public route families;
representative screenshots alone are not proof that every surface is complete.
