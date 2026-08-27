# Capability-First Publication Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one verified system registry, a living hiring-first homepage, and a deterministic accessible publication and visualization pipeline for harperz9.github.io.

**Architecture:** Canonical JSON records own systems, evidence, briefings, claims, and figure inputs. Dependency-free Node generators validate those records and emit TypeScript, browser modules, static HTML, SVG figures, tables, feeds, and public JSON receipts. React and static pages consume generated projections, so the homepage, catalog, navigation, system pages, publication archive, and repository references cannot form competing taxonomies.

**Tech Stack:** TypeScript 6, React 19, Vite 8, dependency-free Node ESM generators, static semantic HTML and SVG, Python pytest, Node test runner, Playwright 1.58.0, GitHub Pages.

**Spec:** `C:/dev/worktrees/site-hiring-first-architecture/docs/superpowers/specs/2026-08-26-capability-first-publication-visual-system-design.md`

## Global Constraints

- Hiring remains the first homepage entrance.
- Mature public systems receive first-class depth; `featured` only controls homepage placement.
- Capability domains, use cases, relationships, maturity, evidence, audience, and public/private boundaries form one system model.
- The daily research loop may run hourly but publishes at most one canonical briefing per calendar day.
- No source, claim, figure, release, adoption, endorsement, deployment, or outcome is inferred from stale copy.
- Every measured figure carries source URLs, retrieval dates, input values, units, transformations, limitations, accessible text, and a semantic table.
- Essential content must work without JavaScript, at 320 CSS pixels, at 200 percent zoom, in print, with keyboard navigation, and with reduced motion.
- No public artifact may contain local paths, secrets, raw private sessions, credentials, operational exploit procedures, or sensitive private-system details.
- Existing user-owned `tools/fonts/__pycache__` changes are never staged or reverted.

---

### Task 1: Establish the Canonical System Registry Contract

**Files:**
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/site/systems.json`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/scripts/render-system-registry.mjs`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/src/system-registry.ts`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/systems.js`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/systems.json`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_system_registry.py`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/package.json`

**Interfaces:**
- Consumes: canonical public routes from `site/routes.json`.
- Produces: `SYSTEMS`, `FEATURED_SYSTEMS`, `CAPABILITY_DOMAINS`, `EVIDENCE_STREAM`, `systemById(id)`, and `relatedSystems(id)` in deterministic TypeScript and browser projections.

- [ ] **Step 1: Write the failing registry contract tests**

Require each record to expose the following exact fields and controlled values:

```python
REQUIRED = {
    "id", "name", "purpose", "useCases", "href", "sourceHref", "domains",
    "audiences", "deploymentContexts", "maturity", "placement", "accessMode",
    "evidence", "limitations", "boundary", "inputs", "outputs", "dependencies",
    "related", "lastVerified",
}
MATURITY = {"shipped", "active", "research", "controlled-private", "archived"}
PLACEMENT = {"featured", "catalog-only"}
ACCESS = {"run", "install", "inspect", "request", "read"}
DOMAINS = {
    "agent-systems", "evaluation-verification", "security-privacy",
    "developer-infrastructure", "graphics-media", "research-education",
}
```

Assert stable unique IDs, one canonical local route per public system, valid
dependency and relationship IDs, ISO dates, no empty limitations, no local
paths, and no private source URL when `maturity == "controlled-private"`.

- [ ] **Step 2: Run the tests and confirm the contract is absent**

Run:

```powershell
python -m pytest tests/test_system_registry.py -q
```

Expected: FAIL because `site/systems.json` and its projections do not exist.

- [ ] **Step 3: Implement the deterministic validator and projections**

Export the same normalized registry in both projections:

```javascript
export const SYSTEM_REGISTRY_JSON = "...";
export const SYSTEMS = JSON.parse(SYSTEM_REGISTRY_JSON).systems;
export const FEATURED_SYSTEMS = SYSTEMS.filter((system) => system.placement === "featured");
export const CAPABILITY_DOMAINS = JSON.parse(SYSTEM_REGISTRY_JSON).domains;
export const EVIDENCE_STREAM = SYSTEMS.flatMap((system) =>
  system.evidence.map((evidence) => ({ ...evidence, systemId: system.id }))
).sort((left, right) => right.date.localeCompare(left.date));
export function systemById(id) { return SYSTEMS.find((system) => system.id === id); }
export function relatedSystems(id) {
  const system = systemById(id);
  return system ? system.related.map(systemById).filter(Boolean) : [];
}
```

Reject duplicate JSON keys before `JSON.parse`, unknown fields, unknown enum
values, invalid public URLs, missing relationship targets, dependency cycles,
and generated-output drift. Add `systems:render` and `systems:check`; make
`build` and `verify` run `systems:check` before Vite.

- [ ] **Step 4: Seed a minimal valid fixture and prove deterministic output**

Use `flywheel` as the first fixture with two capability domains, one dated
public-source evidence record, at least one explicit limitation, and an empty
dependency list. Run the renderer twice and compare SHA-256 values.

```powershell
npm run systems:render
$first = (Get-FileHash src/system-registry.ts -Algorithm SHA256).Hash
npm run systems:render
$second = (Get-FileHash src/system-registry.ts -Algorithm SHA256).Hash
if ($first -ne $second) { throw "system projection is nondeterministic" }
python -m pytest tests/test_system_registry.py -q
```

Expected: PASS and identical hashes.

- [ ] **Step 5: Commit the registry contract**

```powershell
git diff --check
git add site/systems.json scripts/render-system-registry.mjs src/system-registry.ts public/system/systems.js public/system/systems.json tests/test_system_registry.py package.json
git commit -m "feat(site): define one verified system registry"
```

---

### Task 2: Migrate the Public System Inventory Into the Registry

**Files:**
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/site/systems.json`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/src/App.tsx`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/security-tools.json`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/scripts/render-system-registry.mjs`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_system_inventory.py`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_security_surface.py`

**Interfaces:**
- Consumes: Task 1 registry and generated accessors.
- Produces: one normalized inventory used by the homepage, catalog, and security projection.

- [ ] **Step 1: Write failing ownership and migration tests**

Assert that `src/App.tsx` no longer declares `ENGINES` or `PLATFORMS`, and that
the registry contains these current systems by stable ID:

```python
EXPECTED = {
    "flywheel", "telos", "index", "gather", "forum", "crucible", "emet",
    "buildlang", "learn", "relay", "plexus", "mneme", "studio-engine",
    "build-color", "phantom", "behavior-transform", "authorized-private-practice",
    "accountable-surface", "public-surface-sweeper", "model-provenance-validator",
}
```

Require every former homepage entry to preserve its public route, source/access
route, purpose, maturity, and current evidence without translating a local test
into adoption or production use.

- [ ] **Step 2: Run the focused tests and observe duplicate ownership**

```powershell
python -m pytest tests/test_system_registry.py tests/test_system_inventory.py tests/test_security_surface.py -q
```

Expected: FAIL because homepage and security inventories are hand-maintained.

- [ ] **Step 3: Revalidate and migrate every listed record**

For each expected ID, read the public repository or package route and its
current local evidence before writing `lastVerified`. Use `null` for unknown
source, package, version, CI, or adoption state. Mark Seed, Array, Sofer,
Bounds, ORCA, and related non-public work through the single
`authorized-private-practice` boundary record rather than publishing separate
operational records.

- [ ] **Step 4: Generate the security projection from the registry**

Add a renderer output that selects systems with `security-privacy` in
`domains` and emits the existing public schema:

```javascript
const securityRecords = registry.systems
  .filter((system) => system.domains.includes("security-privacy"))
  .map(({ id: slug, name, purpose, maturity, sourceHref: source, limitations, boundary: authorizationBoundary, lastVerified: evidenceDate }) => ({
    slug, name, purpose, maturity, source, limitations, authorizationBoundary, evidenceDate,
  }));
```

Preserve the richer install and verification fields when the registry evidence
supports them. Delete no public caveat during migration.

- [ ] **Step 5: Replace homepage arrays with registry-derived views**

Import `FEATURED_SYSTEMS` and group by capability domain. Preserve current
hiring content, but remove the copy that treats engines and platforms as
exclusive prestige classes.

```tsx
const FEATURED_BY_DOMAIN = CAPABILITY_DOMAINS.map((domain) => ({
  ...domain,
  systems: FEATURED_SYSTEMS.filter((system) => system.domains.includes(domain.id)),
})).filter((domain) => domain.systems.length > 0);
```

- [ ] **Step 6: Verify and commit the migration**

```powershell
npm run systems:render
npm run systems:check
python -m pytest tests/test_system_registry.py tests/test_system_inventory.py tests/test_security_surface.py tests/test_home_roster_and_marketing.py -q
git diff --check
git add site/systems.json scripts/render-system-registry.mjs src/App.tsx public/security-tools.json src/system-registry.ts public/system/systems.js public/system/systems.json tests
git commit -m "refactor(site): derive public systems from one registry"
```

---

### Task 3: Build the Shared Accessible Figure Renderer

**Files:**
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/scripts/render-figures.mjs`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/figure.css`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/figure.js`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/site/figures/schema.json`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/site/figures/system-capability-map.json`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_figure_contract.py`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/figure.test.mjs`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/package.json`

**Interfaces:**
- Consumes: figure JSON with `id`, `kind`, `title`, `description`, `claim`, `doesNotProve`, `sources`, `retrievedAt`, `units`, `transformations`, `uncertainty`, and typed `data`.
- Produces: deterministic `public/figures/<id>.svg`, `public/figures/<id>.html`, and `public/figures/<id>.json`.

- [ ] **Step 1: Write failing figure evidence and accessibility tests**

Require kinds `relationship`, `timeline`, `matrix`, `bar`, `line`, and
`uncertainty`. For measured figures, reject missing units, numeric values, or
source records. Require the generated SVG to expose `role="img"`, `<title>`,
`<desc>`, labels that do not depend on color, and a sibling semantic table.

```python
assert '<svg role="img"' in svg
assert "<title" in svg and "<desc" in svg
assert '<table class="figure-table"' in fallback
assert "What this figure does not prove" in fallback
```

- [ ] **Step 2: Run tests and confirm the renderer is absent**

```powershell
python -m pytest tests/test_figure_contract.py -q
node --test public/system/figure.test.mjs
```

Expected: FAIL because figure artifacts and behavior do not exist.

- [ ] **Step 3: Implement deterministic SVG and fallback rendering**

Use a fixed viewBox, stable input ordering, Hanken/Conso font stacks, cyan for
verified/actionable, rust for disputed/caution, muted ice for unavailable or
historical state, and patterns or dash arrays in addition to color. Do not use
random values. If decorative texture is requested, accept an explicit integer
`seed` and serialize it in the companion record.

- [ ] **Step 4: Implement progressive enhancement**

The browser module may add focusable data-point navigation and synchronized
highlighting, but it must not remove the static labels or table. Disable all
motion under `prefers-reduced-motion: reduce`; never place unique information
in a tooltip.

- [ ] **Step 5: Render and inspect the capability relationship map**

Generate nodes from `systems.json` and edges from `dependencies`, `related`,
and evidence references. At 320 CSS pixels, render the semantic relationship
list before the scrollable SVG rather than shrinking labels below readable
size.

- [ ] **Step 6: Verify deterministic and accessible output, then commit**

```powershell
npm run figures:render
$before = Get-FileHash public/figures/system-capability-map.svg -Algorithm SHA256
npm run figures:render
$after = Get-FileHash public/figures/system-capability-map.svg -Algorithm SHA256
if ($before.Hash -ne $after.Hash) { throw "figure renderer is nondeterministic" }
python -m pytest tests/test_figure_contract.py -q
node --test public/system/figure.test.mjs
git diff --check
git add scripts/render-figures.mjs site/figures public/system/figure.css public/system/figure.js public/system/figure.test.mjs public/figures tests/test_figure_contract.py package.json
git commit -m "feat(site): render accessible evidence figures"
```

---

### Task 4: Replace Stale Homepage Snapshots With the Living Operating Surface

**Files:**
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/src/App.tsx`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/src/App.css`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/index.html`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/site/evidence-stream.json`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/scripts/render-system-registry.mjs`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_home_roster_and_marketing.py`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_home_current_surface.py`

**Interfaces:**
- Consumes: `FEATURED_SYSTEMS`, `CAPABILITY_DOMAINS`, `EVIDENCE_STREAM`, the capability-map fallback, and latest published briefing projection.
- Produces: semantic homepage sections in the order hiring, selected evidence, current contributions, current operating surface, research/publications, contact.

- [ ] **Step 1: Write failing source and rendered tests**

Require the homepage to expose a capability map, dated evidence stream, latest
briefing, representative registry-derived workflows, and action routes. Prohibit
the old prime-space headings and data sources:

```python
for stale in ("RECORDED_WORKFLOWS", "Try four browser-native checks", "Recorded workflows"):
    assert stale not in app_source
for current in ("Capability map", "Release and evidence stream", "Current research briefing"):
    assert current in built_html_or_rendered_text
```

At 390x844 and 1440x1000, require all hiring routes in the first viewport and
the current operating surface after the hiring ledger without horizontal
overflow.

- [ ] **Step 2: Run the focused tests and confirm the stale surface remains**

```powershell
npm run build
python -m pytest tests/test_home_roster_and_marketing.py tests/test_home_current_surface.py -q
```

Expected: FAIL on the old workflow/check sections and missing current surface.

- [ ] **Step 3: Implement the living surface from generated data**

Render one compact relationship-map entry, the five newest evidence records,
the newest published briefing, and no more than three representative workflows.
Derive each workflow from explicit `inputs`, `dependencies`, and `outputs`; if a
relationship is incomplete, omit the workflow and expose the evidence gap in
the full catalog.

- [ ] **Step 4: Preserve noscript and conversion order**

Add a semantic noscript summary with hiring routes, latest evidence date,
capability domains, newest briefing route, and contact. Keep the current
homepage metadata hiring-first and describe the systems as supporting proof.

- [ ] **Step 5: Verify responsive, keyboard, reduced-motion, and no-script states**

```powershell
npm run build
python -m pytest tests/test_home_roster_and_marketing.py tests/test_home_current_surface.py tests/test_portfolio_visual_contract.py -q
node tests/linkcheck.mjs
```

Serve `dist/` and inspect 320x800, 390x844, 760x900, 1280x900, and 1440x1000,
plus 200 percent zoom, keyboard-only navigation, reduced motion, and JavaScript
disabled.

- [ ] **Step 6: Commit the homepage replacement**

```powershell
git diff --check
git add src/App.tsx src/App.css index.html site/evidence-stream.json scripts/render-system-registry.mjs tests
git commit -m "feat(home): publish a living capability surface"
```

---

### Task 5: Create the Idempotent Daily Briefing Pipeline

**Files:**
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/content/briefings/README.md`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/site/publications.json`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/scripts/render-publications.mjs`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/public/briefings/index.html`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/public/feed.xml`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/public/feed.json`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_publication_pipeline.py`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/publications.html`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/sitemap.xml`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/package.json`

**Interfaces:**
- Consumes: one directory per briefing with `article.json`, `claims.json`, and `figures.json`.
- Produces: canonical briefing HTML, source/claim/figure JSON receipts, archive index, sitemap entries, JSON Feed, Atom feed, and social-copy files.

- [ ] **Step 1: Write failing schema, collision, and correction tests**

Use a stable ID `YYYY-MM-DD-slug`. Reject a second canonical briefing for the
same date, duplicate source URLs, claims without source IDs, figures without
claim IDs, invalid dates, and body links not present in the source manifest.
Allow only a versioned amendment that names the prior briefing ID and supplies
a correction note.

- [ ] **Step 2: Run tests and confirm no pipeline exists**

```powershell
python -m pytest tests/test_publication_pipeline.py -q
```

Expected: FAIL because briefing sources and renderer are absent.

- [ ] **Step 3: Implement strict rendering and public-copy checks**

Render semantic article sections from JSON blocks, escape all text and
attributes, permit only `https:` citations and approved local routes, and place
source links immediately beside supported claims. Each article must include
published and updated dates, source count, claim-status legend, limitations,
correction history, and figure fallbacks.

- [ ] **Step 4: Generate archive, feeds, sitemap, and social derivatives**

Generate X and LinkedIn text files from the canonical headline, summary,
article URL, and explicitly selected figure alt text. Label them `prepared` in
the receipt. Do not record them as externally published without a first-party
post URL and timestamp.

- [ ] **Step 5: Make the pipeline idempotent**

Run the renderer twice and require byte-identical HTML, SVG, JSON, feed, and
sitemap outputs. If no source record changed, exit zero with no file change.

- [ ] **Step 6: Verify and commit the publication foundation**

```powershell
npm run publications:render
npm run publications:check
python -m pytest tests/test_publication_pipeline.py tests/test_owned_blog_article.py tests/test_publications_pdfs.py -q
node tests/linkcheck.mjs
git diff --check
git add content/briefings site/publications.json scripts/render-publications.mjs public/briefings public/feed.xml public/feed.json public/publications.html public/sitemap.xml tests/test_publication_pipeline.py package.json
git commit -m "feat(publications): build an idempotent briefing pipeline"
```

---

### Task 6: Publish the OpenAI and Hugging Face Incident Briefing Candidate

**Files:**
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/content/briefings/2026-08-26-openai-hugging-face-incident/article.json`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/content/briefings/2026-08-26-openai-hugging-face-incident/claims.json`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/content/briefings/2026-08-26-openai-hugging-face-incident/figures.json`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_openai_hugging_face_briefing.py`
- Modify: generated briefing, archive, feed, sitemap, and latest-briefing projections from Tasks 3 and 5.

**Interfaces:**
- Consumes: the approved source ledger at `C:/dev/worktrees/site-hiring-first-architecture/docs/superpowers/research/2026-08-26-openai-hugging-face-incident-source-ledger.md` and the reviewed internal draft packet.
- Produces: one canonical, source-attributed briefing and reconstructable figure set.

- [ ] **Step 1: Write failing incident-specific truth-boundary tests**

Require direct links to the Alabama announcement and subpoena, Redwood/METR
report, OpenAI overview and technical report, Hugging Face disclosures, and
JFrog advisories. Require the phrases `investigation`, `allegation`,
`company-reported`, `host telemetry`, `independent investigation with
host-controlled data access`, and `not a liability finding` in their relevant
sections.

Reject any chart that combines agents, messages/files, transcripts, actions,
clusters, tasks, repositories, or systems into one quantitative series.

- [ ] **Step 2: Run tests and confirm the publication candidate is absent**

```powershell
python -m pytest tests/test_openai_hugging_face_briefing.py -q
```

Expected: FAIL because the canonical content records do not exist.

- [ ] **Step 3: Convert the reviewed draft into structured content**

Keep five evidence lanes separate: legal process, OpenAI self-report, Hugging
Face host telemetry, Redwood/METR analysis, and vendor remediation. Attribute
all disputed descriptions to their source and place limitations beside the
claim, not only in a footer.

- [ ] **Step 4: Create the reconstructable visual package**

Include:

1. a five-bar Hugging Face daily recovered-action chart with values 3,779,
   1,135, 7,677, 3,892, and 1,130 for July 9 through July 13;
2. a multi-lane timeline covering June 26, July 5, July 8 through July 13,
   July 16, July 19 through July 21, July 27, August 3, August 20 and 24, and
   August 26;
3. an evidence-scope matrix separating source, unit, period, access method, and
   known gap;
4. a two-bar OpenAI self-reported retrospective comparison of 22 percent of
   tasks previously unsolved and 93 percent of board-discussed tasks drawn from
   that set, with no causal implication;
5. a conceptual trust-boundary diagram with equal-width arrows and no exploit
   procedure;
6. a claim-provenance panel distinguishing filing, telemetry, independent
   inference, company self-report, and unresolved allegation.

- [ ] **Step 5: Render and perform a source-by-source review**

```powershell
npm run publications:render
python -m pytest tests/test_openai_hugging_face_briefing.py tests/test_publication_pipeline.py -q
```

Check every number against its cited source and confirm the article does not
imply adjudicated liability, unrestricted forensic access, independent
replication of company harness results, settled motivation, or combined units.

- [ ] **Step 6: Commit the reviewed candidate without claiming deployment**

```powershell
git diff --check
git add content/briefings/2026-08-26-openai-hugging-face-incident public/briefings public/figures public/feed.xml public/feed.json public/publications.html public/sitemap.xml tests/test_openai_hugging_face_briefing.py
git commit -m "feat(research): add the August frontier incident briefing"
```

---

### Task 7: Enforce Publication and Visual Quality in CI

**Files:**
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/.github/workflows/ci.yml`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/package.json`
- Create: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_capability_publication_gate.py`

**Interfaces:**
- Consumes: all generators and generated artifacts from Tasks 1 through 6.
- Produces: one `npm run verify` gate that fails on registry drift, figure drift, publication drift, inaccessible output, duplicate dates, broken links, secret-shaped text, unsupported claims, or build parity failure.

- [ ] **Step 1: Write a failing full-gate test**

Assert that the package script contains `systems:check`, `figures:check`, and
`publications:check`, and that CI runs the exact local `npm run verify` command
after installing pinned Python and Playwright dependencies.

- [ ] **Step 2: Run the test and confirm the gate is incomplete**

```powershell
python -m pytest tests/test_capability_publication_gate.py -q
```

Expected: FAIL until scripts and CI are wired.

- [ ] **Step 3: Wire the unified gate**

Set `verify` to execute registry checks, career parity, figure checks,
publication checks, Vite build, full pytest, full Node tests, link crawl,
security-claim checks, and public secret/path scans. Keep generator commands
separate from check commands so CI never silently repairs drift.

- [ ] **Step 4: Run the complete local gate and rendered inspection**

```powershell
npm ci
npm run verify
git diff --check
git status --short
```

Inspect home, hire, catalog, security, one public system page, publication
archive, incident briefing, and every figure family at desktop/mobile, 200
percent zoom, keyboard-only, reduced motion, print, and no-script states.

- [ ] **Step 5: Request independent code and content review**

Use `superpowers:requesting-code-review`. Reproduce each reported issue before
changing code. After any patch, rerun focused tests and the full gate.

- [ ] **Step 6: Commit the quality gate**

```powershell
git add .github/workflows/ci.yml package.json tests/test_capability_publication_gate.py
git commit -m "ci(site): gate capability and publication integrity"
```

---

### Task 8: Merge, Deploy, Verify Live State, and Close the Feedback Receipt

**Files:**
- Source worktree: `C:/dev/worktrees/telos-hiring-first-public-presence`
- Pages worktree: `C:/dev/worktrees/site-hiring-first-architecture`
- Modify: `C:/dev/worktrees/outreach-reconciliation-aug25/outreach/19-execution-manifest.json` only after live receipts exist.
- Create: one numbered deployment and feedback report under `C:/dev/worktrees/outreach-reconciliation-aug25/outreach/`.

**Interfaces:**
- Consumes: reviewed source branch and exact build artifacts.
- Produces: merged source commit, merged Pages commit, live route receipts, hashes, and one append-only feedback record.

- [ ] **Step 1: Build and stage exact output into the Pages worktree**

```powershell
npm run verify
node scripts/deploy-into-pages.mjs C:/dev/worktrees/site-hiring-first-architecture --include-home
```

Review every staged path. Reject local plans, drafts, source ledgers, private
paths, credentials, generated caches, and any artifact not part of `dist/`.

- [ ] **Step 2: Run Pages repository verification before publication**

Run its repository-local Python, Node, link, sitemap, canonical, and secret
checks. Serve the staged tree and compare the homepage, catalog, briefing, feed,
figures, and hiring pages against the reviewed source build.

- [ ] **Step 3: Merge source before generated output**

Push `codex/hiring-first-public-presence`, create one reviewed pull request to
the verified remote default branch, wait for clean CI, and merge. Record the
source commit and PR receipt. Then push the Pages branch, create one reviewed
Pages pull request, wait for clean CI, and merge.

- [ ] **Step 4: Verify live production against exact commits**

Require HTTP 200, expected canonical URL, expected source commit marker or
content hash, working navigation, figure fallbacks, feed validity, no stale
workflow/check prominence, and no console error for `/`, `/hire.html`,
`/catalog.html`, `/publications.html`, `/briefings/`, the new incident article,
and every generated figure.

- [ ] **Step 5: Record the feedback-loop baseline**

Append one manifest event containing source commit, Pages commit, PRs, deploy
timestamp, live URLs, test totals, figure hashes, briefing ID, source count,
claim count, correction state, and external social receipts if any. If X or
LinkedIn has no first-party post URL, record only `prepared`, not `published`.

- [ ] **Step 6: Resume hiring-first execution with version attribution**

For each later application or outreach action, record the exact resume hash,
cover-letter hash, portfolio route, system evidence date, and live-site commit.
Use future responses and interview progression to revise route choice and asset
structure. Preserve zero-response periods as evidence with competing
explanations, never as proof of one causal defect.

---

## Plan Self-Review

- Spec coverage: system model, first-class maturity, homepage replacement,
  visual grammar, figure evidence contract, accessibility, daily cadence,
  incident scope, archive/feed/social derivatives, corrections, CI, deployment,
  and feedback attribution each map to a task above.
- Placeholder scan: no deferred implementation markers remain.
- Type consistency: Tasks 2 and 4 consume Task 1 exports; Tasks 4 through 6
  consume Task 3 figure artifacts; Tasks 6 through 8 consume Task 5 briefing
  outputs; Task 7 gates every producer before Task 8 deploys them.
