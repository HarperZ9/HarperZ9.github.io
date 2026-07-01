# Project Telos site design rules

These are the governing rules for the portfolio site. The canon is two reference
sites, set by the operator on 2026-06-25:

- **aircenter.space (AIR)** for structure: monochrome, one sculptural object,
  type pinned to the viewport edges, deep negative space, scroll-as-animation.
- **wembi.ai** for warmth: a single bold accent, big tactile pills, large
  editorial type even in utility sections, soft material.

Build from these references in motion, not from memory. The only way to know how a
reference behaves is to drive it (scroll, hover) and watch it move.

**Flagship identity + hero artwork:** see [`BRAND.md`](BRAND.md). Every flagship, repo, and
private-line tool uses one shared **flagship card** as its hero (ceramic card, one iris accent,
`PROJECT TELOS / {ROLE}` eyebrow, sans headline, pipeline line, ghost wordmark, one glyph). Heroes
are generated from `img/og/_card.html` + `img/og/cards-data.js`, never hand-authored per repo.

## 1. One protagonist, evolving through states

There is a single 3D sculptural object that is the protagonist of the page. It
carries the visual richness, and it **moves through a range of states as you
scroll** (the work is in the state change, not in static decoration). On Telos the
object is the Ribbon Field, and its states map to the thesis: perceive, build,
verify.

## 2. Palette: monochrome plus one accent

Near-white ceramic ground (`#f4f3ef`, not sterile white), ink text, monochrome
discipline. At most **one** bold accent, used sparingly and confidently (wembi uses
exactly one). Color lives in the object's material and light, not in the UI.

## 3. Typography is a first-class object

Heavy grotesk (Archivo) at architectural scale. No expressive serif: AIR and wembi
are grotesk. Type is **placed as independent, full-bleed layers** (edge-pinned,
free to overlap the object), never trapped inside a centered content column. Use
display type where a paragraph would be timid, including in the footer. Mono
(JetBrains Mono) for instrument labels and chrome.

## 4. Independent layers that compose by overlap

Every element (the object, the giant wordmark, the headline, the pills, the chapter
index) lives in its own viewport-relative frame and is free to layer. No element's
visibility or crop depends on another element's box. Each has its own field of view.

## 5. Components

- **Pills:** big, tactile, rounded. One emphatic solid pill, the rest quiet.
- **Chrome:** minimal and quiet. A small nav. An orienting device (a chapter index
  or progress indicator) that tells you where you are in the journey. A scroll cue.
- **Rules:** hairline, low-contrast. Generous negative space everywhere.

## 6. Motion

Scroll is a choreographed narrative, not a scrollbar. The object scrubs through its
states. Slow and cinematic. Real pointer and hover reactivity. An enter moment that
establishes the world. Always honor `prefers-reduced-motion` with a settled frame.

## 7. Discipline

No clutter. No card-grid-of-everything. No small body paragraph where display type
belongs. Restraint is the premium signal. When in doubt, remove, enlarge the type,
and add space.

## 8. Engineering floor (non-negotiable)

WebGL fails safe to a clean static page. Zero em-dashes anywhere. Accessible
landmarks, skip link, focus-visible, reduced-motion. The dead-link crawl
(`tests/linkcheck.mjs`) and the home contract (`tests/test_portfolio_visual_contract.py`)
stay green.
