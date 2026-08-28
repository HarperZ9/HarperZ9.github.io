# HarperZ9 Site Design Upgrade Specification

**Status:** Adopted for implementation on 2026-08-28

**Public surface:** `https://harperz9.github.io/`

**Release base:** `HarperZ9/HarperZ9.github.io@2a036013b97dad407aa3d18386d919555d047d47`

## 1. Purpose

Make the public site read as one coherent body of work, evidence atlas, and hiring surface. Zain Dana Harper and Zentropy Labs are the front door. Flywheel is the strongest featured platform inside that body of work, not the identity of the person or lab. The remaining public work appears as engines, plug-ins, adapters, evaluation layers, infrastructure, research, or standalone-capable extensions.

The redesign preserves the existing Zentropy and Telos identity while correcting the current split between the restrained Flywheel homepage and the louder route-artifact treatment on catalog, publication, career, security, and retro pages.

## 2. Governing authority

The following sources govern, in descending order:

1. The current user objective and the approved capability-constellation architecture.
2. `HarperZ9/telos-v2` document `project-docs/DESIGN-VOICE-CANON.md`.
3. `HarperZ9/telos-v2` document `project-docs/DESIGN-INSPIRATION.md`.
4. This specification.
5. Historical design memories, used as evidence of taste rather than as instructions.
6. Existing page implementations when they do not conflict with the sources above.

Older experiments that require a third display face, decorative interface color, a white site-wide ground, glass panels, or a flat peer-flagship hierarchy are superseded.

## 3. Design thesis

The interface is a restrained instrument. The art is allowed to be rich.

The site uses a dark instrument ground with warm-paper data plates. This preserves the current visual identity while giving charts, diagrams, tables, and publication evidence a calm, high-contrast reading surface.

The structure may borrow evidence density, direct indexing, and figure-led exposition from `https://blog.can.ac/`. It must not reproduce that site's identity, composition, or exact visual language.

## 4. Identity and hierarchy

### 4.1 Identity before product hierarchy

- The first viewport introduces `Zain Dana Harper` and `Zentropy Labs` before any product claim.
- The site is the public body of work. It is not a Flywheel product landing page.
- A visitor can understand the person, the lab, the range of work, and the available hiring or collaboration route without first learning an internal framework.
- Flywheel remains the sole primary platform within the product hierarchy below the identity layer.

- Flywheel is the only `primary-platform`.
- Capability families are `platform`, `evaluation-verification`, `security`, `infrastructure`, `graphics-retro`, and `research-education`.
- Public role labels are `engine`, `plugin`, `adapter`, `evaluation layer`, `infrastructure`, and `standalone system`.
- Higher-risk private tools appear only as an aggregate controlled-security constellation. Public copy must not expose live bypasses, exploit chains, targets, or unpublished vulnerabilities.
- Retro Engine, Engine Revival, and BRender Archival form the Retro Systems Lab sequence: play, preserve, verify.

### 4.2 Primary navigation

The visible desktop navigation is:

1. Work
2. Flywheel
3. Research
4. Retro Systems Lab
5. Security
6. About / hire
7. GitHub

The compact menu carries the complete route registry. Every rendered page has exactly one `aria-current="page"` element.

## 5. Visual system

### 5.1 Type

- Hanken Grotesk is the only prose and display family.
- Conso is the only mono, label, data, and code family.
- `ZentropyDisplay`, Kilon, serif display experiments, and page-local font families are removed from active public CSS.
- Hierarchy comes from size, weight, spacing, and position.

### 5.2 Ground and plates

- Primary ground: plum-black or near-black, anchored near `#070406`.
- Primary text: calm off-white with AA contrast.
- Secondary text: muted but AA-compliant at normal text sizes.
- Data plate: warm paper near `#f2efe6` with near-black ink.
- Data plates are reserved for charts, diagrams, tables, benchmark summaries, evidence ledgers, and publication figures.
- Cards do not become warm-paper plates merely to add variety.

### 5.3 Color semantics

- Verified uses the canonical green.
- Drift, caution, and escalation use the canonical ember.
- Unverifiable uses muted ink plus a text or pattern label.
- Cyan, magenta, spectral gradients, and shader color remain inside artwork and data encodings with an additional non-color encoding.
- Each viewport has at most one decorative hot mark outside art.

### 5.4 Art language

The shared art vocabulary is:

- a luminous aperture or void;
- architectural cutaways and annotated technical plates;
- plotter layering and multi-pass line density;
- early computer-art grids and quantized marks;
- scientific visualization and vector fields;
- cassette-futurist instrument panels;
- halftone, scanline, dither, grain, and print decay;
- crystalline and refractive facets;
- retro renderer output and current native tool captures.

The global shell never places intense animation under body text. Art is contained to hero, gallery, figure, or product-evidence regions. Reduced-motion mode renders a deterministic still.

### 5.5 Anti-patterns

The following generated-design habits are prohibited:

- slash-separated abstract concept lists such as `orientation / artifact / claim / proof / route`;
- generic eyebrows that classify a section without helping a reader;
- an oversized product sentence used as the entire identity;
- floating pseudo-dashboard cards over decorative gradients;
- framework vocabulary before the visitor meets the person, lab, or concrete work;
- pills, chips, and badges when the element is not a real control or status;
- generic mesh gradients, concentric rings, and node diagrams used as filler;
- equal card grids that flatten work with different roles and maturity;
- decorative technical notation that carries no source, measurement, or action.

The hero may contain one operator-authored or tool-generated artwork, but it must function as a real visual identity or native evidence, not a background effect selected from model defaults.

Eyebrows are an exception, not a component primitive. The homepage has none. Route titles, project introductions, and ordinary section headings have none. A small lead-in may appear only when it communicates a concrete state a reader would otherwise miss, such as `Verified 2026-08-28` or `Private recipient channel`; it must use sentence case, appear no more than once in a section, and remain understandable when removed from the visual hierarchy.

## 6. Homepage architecture

The homepage follows this sequence:

1. **Zain Dana Harper / Zentropy Labs.** The name, the lab, and a direct description of the work appear first. The two actions are `Explore the work` and `Hire or collaborate`.
2. **Featured platform: Flywheel.** One concise explanation, one current release fact, one native visual or terminal record, and a direct route to inspect it.
3. **Evidence board.** Six to eight source-backed cells showing current releases, public tests, publication counts, or dated repository evidence. Every cell links to its record.
4. **Capability constellation.** Six families, no more than twelve labeled nodes in the overview, with detail tables behind family routes.
5. **Representative work.** A curated set of systems selected by role and proof, not a wall of equal cards.
6. **Current research.** The canonical incident briefing and current publications with figure previews.
7. **Retro Systems Lab.** Play, preserve, verify, with current Retro Engine output and repository evidence.
8. **Security boundary.** Lawful public defensive work plus the controlled private-recipient boundary.
9. **Hiring and collaboration.** Three career paths, direct document downloads, email, and GitHub.

The hero copy begins with:

```text
Zain Dana Harper
Systems engineering, security tooling, graphics, and public research.
Zentropy Labs is the workshop behind Flywheel and the wider body of work.
```

The hero has no abstract eyebrow, no product release card, and no internal operating-loop language. Its display text is no larger than `clamp(3rem, 6vw, 5.25rem)` and should occupy no more than two lines at 1440 px.

The stale recorded-workflow wall and browser-native-check block are removed from the homepage. Their routes remain available from the catalog and demonstrations library.

## 7. Visualization contract

Every substantive figure includes:

- a plain-language title;
- one-sentence finding;
- scope and denominator;
- measurement or observation date;
- directly labeled values and units;
- source and provenance links;
- uncertainty or unknown state;
- limitations;
- a `What this figure does not prove` statement;
- a semantic HTML table or mobile card fallback;
- a print-safe representation.

Minimum visual requirements:

- 16 px rendered labels at normal desktop scale;
- 2 px primary strokes;
- no color-only distinctions;
- patterns, shapes, labels, or line styles reinforce color;
- 320 px reflow without horizontal page overflow;
- keyboard-reachable controls;
- forced-colors readability;
- reduced-motion stills;
- no-JS access to the same claim and underlying values.

## 8. Publication template

Each briefing or long-form publication uses:

1. Visual thesis
2. Key findings
3. Primary figure
4. Evidence ledger
5. Interpretation
6. Limitations
7. Sources
8. Related systems and reproducible artifacts

The publication ground remains dark. Figures and dense evidence tables use warm-paper plates. Article copy stays on a calm dark reading column with no ambient art behind it.

## 9. Static pages and route art

- The injected route artifact becomes a quiet route header, not a competing poster.
- It uses Hanken Grotesk and Conso only.
- Decorative cyan is removed from navigation and route chrome.
- Page-specific art may retain spectrum within the artwork.
- Route headers use consistent label, title, summary, and optional native evidence image.
- Existing public URLs remain valid.

## 10. Career, security, and retro surfaces

### 10.1 Career

- Preserve the current career artifact release and its generated files.
- Career pages share the same navigation, type, ground, and action grammar.
- The primary action remains a direct document download or contact route.
- No redesign change may alter truth-bounded career content or document hashes.

### 10.2 Security

- Public pages explain lawful purpose, maturity, proof, and boundaries.
- No live bypass payload, target detail, exploit chain, or unpublished vulnerability appears.
- Controlled material routes only to named authorized private or embargoed recipients.

### 10.3 Retro Systems Lab

- Retro Engine is the playable surface.
- Engine Revival is the preservation and reconstruction surface.
- BRender Archival is the verification and archival-evidence surface.
- The cluster has one shared play, preserve, verify diagram and retains separate project pages.

## 11. Accessibility and resilience

The release must pass:

- WCAG AA contrast for text and controls;
- keyboard navigation and visible focus;
- exactly one current-page navigation state;
- responsive reflow at 320, 390, 768, and 1440 px;
- reduced-motion behavior;
- forced-colors behavior;
- print behavior;
- no-JS content access;
- internal link checks;
- no horizontal page overflow.

## 12. Source and release architecture

- `HarperZ9/HarperZ9.github.io` is the live source of truth.
- The React homepage source remains under `home/` in this repository.
- `home/deploy.mjs` produces the root `index.html` and hashed `assets/` pair.
- The root `index.html` retains a complete static `noscript` version.
- Telos may donate reviewed assets or source changes. It must not overwrite the Pages tree wholesale.
- Deployment uses a fresh worktree from current `origin/main`, a PR, and live verification.

## 13. Current baseline

At the adopted base:

- Node system suite: 980 passed, 14 skipped, 0 failed.
- Python suite: 314 passed and 23 failed.
- The Python failures predate this design work and originate in the career conversion release and shared navigation contracts on current `main`.
- Design work may proceed on isolated files, but final release requires a full green suite after reconciling the latest `main`.

## 14. Acceptance criteria

The upgrade is complete only when:

- Zain Dana Harper and Zentropy Labs are visibly the front door;
- Flywheel is visibly the sole primary platform inside the body of work, not the site identity;
- the homepage follows the sequence in section 6;
- all active CSS uses only Hanken Grotesk and Conso;
- data plates follow the warm-paper visualization contract;
- the core homepage, catalog, publications, research, security, retro, and hire routes share one visual system;
- current figures meet section 7;
- no-JS, print, forced-colors, reduced-motion, keyboard, responsive, and link checks pass;
- the PR is reviewed and merged;
- GitHub Pages deploys the exact merge commit;
- live screenshots and DOM checks prove parity at desktop and mobile sizes.
