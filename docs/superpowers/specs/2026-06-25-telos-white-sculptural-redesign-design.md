# Project Telos: white-sculptural home redesign

Date: 2026-06-25
Branch: feat/site-redesign
Status: approved (direction + hero object locked with the operator)

## Goal

Lift the Project Telos home to award-agency caliber (the four references:
aircenter.space, wembi.ai, hubtown.co.in, storytelling.noomoagency.com) without
discarding the existing, high-quality structure and engineering. Target word from
the operator: breathtaking. No line-count ceiling on the signature shader.

## What we keep (this is integrate-and-elevate, not scrap)

The current site's nav, layout system, and engineering discipline are strong and
stay. Specifically preserved:

- `system/nav.js` and the nav markup contract (`.site-nav > .sn-home + .sn-links`),
  restyled only via CSS.
- The structural classes in `telos.css`: `shell`, `g12`, `kicker`, `sec-head`,
  the flagship instrument-rows (`flagships`/`flag`), `floor`, `site-foot`.
- The engineering floor: WebGL fail-safe with CSS fallback, `prefers-reduced-motion`
  handling, `<noscript>` nav, skip-link, focus-visible, the design-token `:root`
  system, the cache-busted asset versioning, zero em-dashes anywhere.
- All home content and messaging: "Build with a model. Take nothing on faith.",
  the three flagships (index / forum / the telos engine), the floor manifesto,
  MATCH / DRIFT / UNVERIFIABLE, "Build it to be checked, or do not ship it."
- The 110-module render/engine code (`system/engine/*`, `system/lib/render-nd/*`,
  studio). Untouched; it powers the studio, not the home hero.

## What changes

1. **Palette: cool-dark to white-ceramic.** Evolve the `telos.css` tokens to a
   near-white ground (`#f4f3ef` ceramic, not sterile `#fff`), deep ink text
   (`#0a0b0d`), generous negative space. Re-tune the `.glass` primitive for light:
   frosted-white translucent fills, soft ambient shadows (drop the heavy dark depth
   shadows), hairline ink borders. The masked gradient border, the sheen, and the
   responsive trims stay; only their color stops move.

2. **The hero: replace the liquid-metal canvas with the Ribbon Field.** See below.

3. **Typography to architectural scale.** Keep Archivo (display) / Manrope (body) /
   JetBrains Mono (labels). Push the display face to viewport scale and pin the
   wordmark `T E L O S` to the viewport edges the way aircenter pins `A I R`. The
   mono labels keep the accountable-instrument voice.

4. **Scroll choreography + section index.** A left-column word index
   (Perceive / Shape / Verify / Flagships) that advances with scroll like hubtown.
   An intro moment where the ribbon assembles from flat slats (Noomo's reveal).
   Sections fade and rise on enter; the ribbon responds to scroll position.

## The Ribbon Field (signature hero)

A single sculptural object rotating in the white void with a soft contact shadow:
a vertical stack of thin white slats that twist into a helix and slowly flow and
reorder. The aircenter language (one sculptural object, white space, edge type),
made specifically Telos: the slats are "planes of evidence" the system is stacking
into one verified structure.

**Technique: raymarched signed-distance field, WebGL1, in a fullscreen triangle.**
Chosen over rasterized geometry because it gives soft shadows, ambient occlusion,
and crisp anti-aliased edges essentially for free, and it reuses the exact
fail-safe harness already proven in `system/liquid-metal.js` (context guard,
reduced-motion still frame, DPR-capped render scale, resize and visibility
handling, CSS fallback). New file: `system/ribbon-field.js`. The liquid-metal
file is retired from the home (kept in git history).

SDF model:
- The object is a column of N slats along Y. For a sample point, only the nearest
  2 to 3 slats are evaluated (the point's height selects its slat band), so per-step
  cost stays bounded regardless of N.
- Each slat i: transform the point into the slat's local frame (rotate about Y by
  `theta_i(t)`, translate to the slat center on a gentle lateral S-curve sweep),
  then a thin rounded-box distance. Union by min.
- `theta_i = i * baseTwist + flourish(i, t)` gives the helix; per-slat animated
  offset gives the flow-and-reorder. A reduced-motion build freezes a chosen pose.
- Material: high-albedo white ceramic, soft wrap diffuse, a soft specular, Schlick
  fresnel sampling a faint cool-to-warm studio environment, and the single accent:
  a thin-film iridescent sheen gated to grazing edges only.
- Output is premultiplied alpha over a transparent canvas so the page's white
  ceramic shows through; the object is opaque, the soft contact shadow is low-alpha
  dark, everything else is alpha 0.
- Budget: about 96 march steps, about 20 soft-shadow steps, about 5 AO taps, SDF =
  nearest-3-slat boxes. Adaptive render scale (start 0.9, measure early frames, drop
  toward 0.7 or 0.6 if slow). Pause on hidden tab. Eased pointer parallax on the
  camera.
- Local-prefix discipline in the shader (as in liquid-metal.js) so it compiles on
  strict drivers. No em-dashes in the file.

## Tests and gates

- `tests/linkcheck.mjs` (live, useful): keep green. No broken internal links.
- `tests/test_portfolio_visual_contract.py` is stale (asserts the pre-Telos
  "Harper Advocates" design; already 17/25 failing). Rewrite it into a contract for
  the white-sculptural Telos home: assert the white tokens, the preserved structure
  (skip-link, `main#main`, the nav contract, the three flagships, the floor copy),
  the Ribbon Field canvas and its fallback, reduced-motion handling, and zero
  em-dashes.

## Scope and sequencing

- **Phase 1 (this spec, the centerpiece):** the white home. `ribbon-field.js`, the
  `telos.css` white system, the rebuilt `index.html` with edge type + section index
  + scroll choreography, and the rewritten visual-contract test. Ship something
  breathtaking on the home first.
- **Phase 2 (cascade):** propagate the white design system to the key pages
  (overview, catalog, research, writing, cv) so the whole site lifts. Parallel
  agents, each restyling one page against the new tokens, linkcheck staying green.

## Risks

- Shader performance on integrated GPUs: mitigated by adaptive scale, bounded
  per-step SDF cost, and the static fallback.
- Light-theme contrast for the mono labels: verify against WCAG on `#f4f3ef`.
- Cascade regressions: linkcheck plus a per-page visual check after each restyle.
