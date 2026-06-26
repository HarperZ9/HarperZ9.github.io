# Project Telos flagship repo kit design

Date: 2026-06-26
Status: approved direction, awaiting operator review of written spec
Approved approach: Unified Repo Kit
Scope: `gather`, `crucible`, `index`, `forum`, and `telos`

## Goal

Make the five flagship repositories feel like one polished Project Telos product
line from the first GitHub viewport through the runnable demonstration. Each repo
must gain a sleek user-facing identity that matches the current
`harperz9.github.io` home presentation: ceramic ground, black editorial
typography, one iris accent, sparse chrome, large architectural type, and a
single project-specific mark that acts like a specimen of the larger line.

The outcome should make a visitor understand three things quickly:

- what the flagship does;
- why it exists as a distinct organ in Project Telos;
- how to run or inspect the demonstration without needing private context.

## Current-state basis

The design is grounded in the current local state inspected on 2026-06-26.

- `portfolio-site` owns the visual canon. The relevant files are
  `DESIGN-RULES.md`, `system/home.css`, `system/ribbon-field.js`, and the
  flagship pages under `gather.html`, `crucible.html`, `index-graph.html`,
  `forum.html`, and `index.html`.
- `gather`, `crucible`, `index`, and `forum` are Python/package-style repos with
  `README.md`, `pyproject.toml`, examples, source, tests, and documentation.
- `telos` is the conceptual flagship and has a slimmer Node demo tree under
  `demo/`, plus `docs/ARCHITECTURE.md`, `docs/HOW-IT-WORKS.md`, and
  `docs/WHO-USES-IT.md`.
- `index` already has a self-contained visual atlas at
  `examples/atlas-demo.html` and embeddable UI assets in
  `src/index_graph/viz/atlas_assets.py`.
- `gather`, `forum`, and `crucible` currently prove themselves mostly through
  CLI examples and README narrative. They need polished demonstration pages or
  report surfaces rather than forced full app shells.

## Visual canon

The repo kit inherits the white-sculptural Project Telos system. It must feel
like the same family as the homepage, not a separate open source template.

- Ground: ceramic near-white `#f4f3ef`, never sterile white as the dominant
  surface.
- Ink: deep near-black `#0b0c0e` for primary text.
- Secondary text: `#2f3238`, `#585c64`, and faint hairline rules based on
  `rgba(11,12,14,.14)`.
- Accent: iris `#4636e8`, used sparingly and paired with text or shape.
- Type: Kilon/Conso/JetBrains Mono where the web page can load site assets.
  GitHub README SVGs must not depend on web fonts for correctness, so exported
  marks and hero panels should use paths, system-safe text, or controlled
  fallback text.
- Shape: large negative space, hairline rules, tactile pills for short actions,
  and one dominant mark per repo. No card-grid-of-everything.
- Motion: only for demo pages, never required for comprehension. Honor
  `prefers-reduced-motion`; README art is static.
- Punctuation and source hygiene: ASCII punctuation in committed source. Avoid
  em dashes.

## Unified repo kit

Each flagship repo receives the same structural kit, adapted to its identity.

1. `docs/brand/<repo>-mark.svg`
   - GitHub-safe monochrome or one-accent SVG.
   - Includes `<title>` and `<desc>`.
   - Uses a stable `viewBox` and does not require JavaScript.
   - Reads at small sizes and can serve as a social/avatar seed.

2. `docs/brand/<repo>-hero.svg`
   - README hero panel with ceramic ground, oversized wordmark, mono labels,
     one concise promise, and the repo mark.
   - Self-contained SVG. No remote scripts, no remote images.
   - Width suitable for GitHub README display, with responsive behavior through
     intrinsic SVG scaling.

3. README first viewport
   - Starts with the hero image, then a short textual fallback heading and
     proof-oriented summary.
   - Keeps badges, install instructions, and the existing evidence-rich
     narrative, but moves them under a cleaner hierarchy.
   - Adds a small "Project Telos flagships" navigation row linking all five
     peers and the live homepage.
   - Adds a "Try it" section near the top with the shortest verified command.

4. Description metadata
   - `pyproject.toml` description is tuned where present.
   - GitHub repository description is updated after implementation using `gh`
     or the GitHub connector, preserving package names and repo identity.
   - Descriptions use concrete product nouns, not vague AI hype.

5. Demonstration surface
   - Each repo gets a polished demo or report surface that matches the homepage
     language and shows the flagship working.
   - Demos are static or generated artifacts where possible, so visitors can
     inspect them without accounts or hosted services.
   - Demo pages carry skip links, landmarks, focus styles, responsive layout,
     and reduced-motion behavior.

## Per-flagship identity

### telos

Role: root membrane, verified contact with state and range.

Mark: ribbon aperture. A single ribbon-like plane bends through a membrane ring,
signaling perception, constraint, and verified passage.

README hero promise: "Give a stateless model durable, verified contact with
state and range."

Demo surface: add a polished `demo/index.html` that explains and runs alongside
the existing `node demo/run.mjs` certificate loop. The page should present the
two runs as a ceramic instrument: honest render -> CERTIFIED, broken render ->
UNVERIFIABLE, with recheck status visible as text.

### gather

Role: accountable research intake, sources in, provenance receipts out.

Mark: provenance strata. A narrow intake cone or aperture resolves scattered
source lines into sealed strata, with the iris accent reserved for the receipt
line.

README hero promise: "Bring difficult sources in, and keep how they arrived on
the record."

Demo surface: create a static or generated provenance digest page from
`examples/demo.py` or `examples/pipeline.py`. The surface should show source
items, method labels, content hashes, scope filtering, digest seal, and the
tamper check in a readable instrument layout.

### index

Role: repository and documentation atlas, code shape made inspectable.

Mark: atlas graph. A sparse node map with one emphasized doc-to-code edge,
drawn with hairlines and a restrained iris node.

README hero promise: "Map a workspace from evidence, not memory."

Demo surface: restyle `examples/atlas-demo.html` and the embedded atlas CSS in
`src/index_graph/viz/atlas_assets.py` to the white-sculptural Telos system.
The graph remains useful first: pan, zoom, search, details, document rendering,
and keyboard/focus behavior must stay intact.

### forum

Role: model-agnostic orchestration with a witnessed causal ledger.

Mark: ledger waves. Parallel routes converge into a chained ledger spine, with
small task points and a visible verification tick.

README hero promise: "Route agent work through a ledger you can replay and
verify."

Demo surface: create a static or generated ledger replay page from
`examples/demo.py` or `examples/run.py`. It should show routing, planning waves,
result records, quick verify, deep verify, and the intentional tamper contrast.

### crucible

Role: thesis evaluation, measurement-backed verdicts, clean verifier boundary.

Mark: verdict axis. A measured line passes through a furnace/aperture into three
visible verdict states: MATCH, DRIFT, UNVERIFIABLE.

README hero promise: "Turn claims into verdicts grounded in measurement."

Demo surface: create a static or generated cleanroom verdict page from
`examples/demo.py` and the run/review bundle flow. It should show thesis,
claim, measurement, verdict, seal, and the verifier boundary: original spec and
artifact only, no worker context.

## README information architecture

Each README should follow this order unless a repo has a strong local reason to
deviate.

1. Hero SVG.
2. Text heading and one-line fallback summary.
3. Badges.
4. "What it does" in two to three short paragraphs.
5. "Try it" with install and shortest demo command.
6. "What to look for" as proof-oriented bullets.
7. "Project Telos flagships" navigation.
8. Existing deeper explanation, architecture, and examples.
9. License and contribution/review invitation.

The first viewport should not bury the command to try the tool. The repo should
feel like a usable product artifact, not only a long manifesto.

## Demo UI architecture

The demo pages should use one shared static design vocabulary:

- `main` landmark, skip link, clear page title, and a short mono status rail.
- Huge repo wordmark as a low-contrast layer.
- One primary specimen area showing the demo result.
- Hairline-separated rows for evidence, checks, hashes, or ledger steps.
- Status pills with text: MATCH, DRIFT, UNVERIFIABLE, CERTIFIED, VERIFY TRUE,
  VERIFY FALSE, or equivalent repo-native language.
- No nested cards. Use sections, rows, and specimen panels.
- Mobile layout must stack without horizontal scrolling.
- Demo output must be reproducible from local examples or static fixture files.

Implementation may use generated static HTML files for the CLI-led repos. The
important behavior is that a visitor can see the proof shape before deciding to
run the command.

## Accessibility and usability requirements

- README SVGs include `<title>` and `<desc>` and remain legible when images do
  not load because the README has text fallback immediately below.
- Demo pages include skip link, `main`, logical headings, visible focus states,
  and adequate contrast on the ceramic ground.
- Any motion honors `prefers-reduced-motion`; content is never hidden behind
  animation.
- Status is not color-only. Use text labels and shape.
- All links have clear names. Peer flagship links are repeated in text, not only
  visual art.
- Pages work at 390px mobile width and 1440px desktop width.

## Verification plan

Implementation is not complete until these checks pass:

- For each repo, README references every new brand asset with valid relative
  paths.
- For each repo, the demo surface exists and can be opened or generated from the
  documented command.
- For `index`, existing atlas tests still pass after restyling embedded assets.
- For Python repos, targeted tests covering changed docs/demo generation pass,
  plus package metadata validation where available.
- For `telos`, `node demo/run.mjs` still exits successfully after adding the
  demo page.
- Link checks or equivalent path checks verify internal README/demo links.
- Visual QA screenshots are inspected for desktop and mobile demo pages.
- Search verifies no committed em dashes in source files touched by this work.
- Git status is reviewed per repo so only intended files are committed.

## Non-goals

- Do not build a hosted SaaS dashboard for these repos in this slice.
- Do not move all five tools into one monorepo.
- Do not make GitHub README rendering depend on JavaScript, remote fonts, or
  remote images.
- Do not replace the current technical narrative with marketing copy. The
  design should make the evidence easier to read, not hide it.
- Do not publish secrets, generated logs, or private artifacts.

## Open implementation choices

The implementation plan should decide exact file names for generated demo pages
after reading each repo's test and packaging conventions. The expected default
is `examples/<repo>-demo.html` for Python/package repos and `demo/index.html`
for `telos`.

The plan should also decide whether the brand asset generator lives in each repo
or as a temporary local builder. The preferred path is to commit only final SVG
and HTML assets to the repos, unless a repo benefits from a repeatable generator
that can be tested.
