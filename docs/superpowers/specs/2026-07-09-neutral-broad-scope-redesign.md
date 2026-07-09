# Neutral Broad-Scope Redesign Spec

## Goal

Shift the portfolio site from an accountability/proof-surface thesis into a broad, neutral public map of Zain Dana Harper's work: systems, local-model workflows, research infrastructure, graphics, generative art, demos, writing, consulting, and release tracks.

## Verified Context

- `index` and `index-graph` were run against `C:/dev` on 2026-07-09 before this stage.
- The current site is a mixed surface: a Vite-built home shell, static HTML pages, shared `system/system.css`, document pages on `system/doc.css`, and route injection through `system/nav.js`.
- The public Reddit profile supplied by the user shows a voice that is exploratory, candid, broad, critique-seeking, and careful about private boundaries.
- The old copy remains concentrated in `PRODUCT.md`, `DESIGN.md`, `DESIGN-RULES.md`, `overview.html`, the home bundle, and tests.

## Direction

The new public voice is not "prove this tool is trustworthy." It is "here is the workshop, here are the working surfaces, here is how to enter the range."

Use:

- broad system-of-systems language
- first-person-adjacent clarity without overexplaining the author
- explicit lanes: engines, demos, research, graphics, model workflows, local endpoints, writing, consulting
- honest maturity labels for projects, but not as the central thesis
- generative/procedural art as the site material, not copied inspiration

Avoid as site-level thesis:

- accountability-first framing
- proof-surface as the brand center
- trust/trustworthy language as the main claim
- MATCH/DRIFT/UNVERIFIABLE as the main public hook
- courtroom/audit-heavy scenario framing unless a page is specifically about that work

## Information Architecture

Home should answer:

- What is Project Telos in broad terms?
- What can I try or inspect now?
- What lanes does the work span?
- How do I hire, collaborate, or enter a research thread?

Overview should become a "field map" rather than a proof manifesto:

- Field map hero
- Lanes of work
- Engine lineup
- Live demos
- Research and writing
- Work-with-me routes

Research and writing pages may still contain accountability-specific articles, but their index copy should present those as one lane among several.

## Visual Direction

Keep the dark generative system and procedural field work. Make the site feel like a model-native workshop and field instrument, not a compliance product.

Material:

- dark mineral field
- cyan, violet, magenta, ember, and lime as working signals
- procedural canvases and generated textures
- dense but legible navigation
- fewer repeated proof/verdict chips as visual grammar

Responsive success means:

- no horizontal overflow at 375px and 390px widths
- hero headings wrap cleanly
- nav remains reachable and legible
- canvas never reduces contrast
- document pages keep readable long-form measures

## First Execution Stage

1. Rewrite `PRODUCT.md`, `DESIGN.md`, and `DESIGN-RULES.md`.
2. Rewrite the top and scenario sections of `overview.html` into a broad field map.
3. Patch the Vite home bundle copy mechanically, because source files are not present in this checkout.
4. Update visual contract tests to guard the neutral broad-scope direction.
5. Run Python tests, nav tests, link crawl, and screenshot QA.

## Remaining Stages

- Stage 2: rewrite research/writing/publications index copy and page introductions.
- Stage 3: rebuild the home from source or recover the Vite source tree so bundle patching is no longer necessary.
- Stage 4: expand procedural art into page-specific generated specimens.
- Stage 5: publish-ready outreach package after the site voice is stable.
