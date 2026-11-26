# Portfolio site design rules

## Intent (November 2026 Canon)

Everything renders together, in one field. The author, 2026-11-02: "I mean, the idea was that there was going to be
less rules to begin with. I guess rules, constraints, structure, form, and function dictate design, but we wanted
everything to kind of render together." Type is dynamic (2026-10-26: "remember that accession is not the rule ~
dynamic is."), with Hanken Grotesk and Conso as the still faces.

### One Shell, Two Harmonized Grounds, Zero Boxed Containers

1. **One shell everywhere (`world/ui/shell/`):** Every page shares the floating corner hand (`Places / Q / Day / Sky /
   Motion / Plain`) and `Ctrl+K` quick-jump dialog. No pasted white breadcrumb rectangles over the ocean or parchment,
   and no dual legacy headers.
2. **Zero SaaS boxes, card grids, or pill walls:** Never wrap prose, links, or tools in boxed cards, hero banners, or
   pill clusters. Use typography, spacing, and crisp `1px solid var(--line)` hairline rules.
3. **Two harmonized grounds from one token set (`world/ui/shell/shell.css` + `world/site/crossover/colour-tokens.json`):**
   - **Open Ocean (`landmark.css`):** Flagship interactive and platform surfaces (`/`, `/playground/`, `/buildlang.html`,
     `/flywheel.html`, `/cmmns.html`, `/architecture.html`, `/models.html`) float directly on the glass-and-water field
     with sculptural extruded display type (`.d-3d`) tinted by platform hue (`bldlng`, `theflywheel`, `thecmmns`,
     `theplygrnd`, `game`, `rsrch`, `brass`).
   - **Measured Drafting Sheet (`studies/studies.css` with `.ds-sheet`, no `.gw-backdrop`):** Reading, archival, career,
     security, biography, and repository/installer ledger pages (`/person.html`, `/security.html`, `/hire.html`,
     `/cv.html`, `/tools.html`, `/studies/`, `/findings/`) sit on warm archival parchment in Day mode (`#e8e3d9` /
     `#16130f`) and deep obsidian in Night mode (`#0a0a0c` / `#ece5d6`), using hairline drafting rules and a quiet
     provenance footer (`.ds-prov`).
4. **Fuzzy brackish-water boundaries, zero siloed creative rooms (2026-11-16 / 2026-11-17 / 2026-11-26):**
   - Capabilities are continuous weighted properties from `0` to `1` on one shared bus (`world/site/surfaces/bus.mjs`),
     never siloed standalone tool pages.
   - `/playground/` unifies Estuary (Perret concrete lantern, metamers, Betti homology), Native DX12/Vulkan/WebGPU
     rendering (`#native`), Low Water (`#low-water`), Superframe (`#superframe`), Type Forge, Shaders & Retro, Sound &
     Round 2 studio cues, Field, and every creative engine in the codebase (Loom, Thread, Posters, Plotter, Fractals,
     Splats, Studio, Fourier, Distill, Swatches, Accession, Glass) into one fluid workbench.

## Limits that protect people and the truth

- **Accessibility as environment:** AA contrast for all text in Day, Night, Plain view, and forced-colors; full keyboard
  navigation; text alternatives for every drawn plate or canvas; reduced motion settles to a crisp still; content never
  depends on motion.
- **Voice & hygiene:** No em dashes. No local filesystem paths (`C:\`, `D:\`, `/Users/`) or internal gate language on
  public pages. No retired names. No private personal trauma details or apologetic disclaimers.
- **Honest nulls stay:** Claims are evidence-bound, and publications carry a Verified line saying what was checked, by
  what, and with what result.
- **Third-party rights:** Reference thumbnails ship small, credited and linked, with a removal contact on `credits.html`.
  Accession and its families ship under SIL Open Font License 1.1 with `OFL.txt` beside them.
- **Non-extractive by default:** No autoplaying audio or video, no dark patterns, no false urgency.
- **Landmarks keep their place (2026-11-09):** The six landmarks keep their order (`BuildLang, Flywheel, The Playground,
  Game, Site, Everything`) across every generated page, and Back returns to the last meaningful state.

## Where the rendering lives

- The shell, hand, and grounds: `world/ui/shell/`, `world/site/landmark.css`, `studies/studies.css`.
- The unified Playground & shared property bus: `world/site/surfaces/` (`registry.mjs`, `bus.mjs`, `rooms.mjs`,
  `surface-page.mjs`, `marbled-field.mjs`, `room-estuary.mjs`, `engine-workbench.mjs`).
- The road, water medium, living type, alive layer, and glass-and-water field: `world/universe/`,
  `world/superframe/lib/medium/`, `world/typeengine/`, `world/alive/`, `world/site/glass-water.js`.
- Drawn marks and colour tokens: `scripts/marks/`, `world/site/crossover/colour-tokens.json`.
- Generators: `scripts/build-world.mjs`, `scripts/build-surfaces.mjs`, `scripts/build-product-pages.mjs`,
  `scripts/build-models-and-tools.mjs`, `scripts/build-addresses.mjs`, `scripts/world-asset-revision.mjs`.
