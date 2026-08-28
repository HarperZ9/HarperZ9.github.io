# HarperZ9 Site Design Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish one coherent, accessible Zain Dana Harper and Zentropy Labs front door, with Flywheel as the strongest featured platform, using a dark instrument ground and warm-paper evidence plates.

**Architecture:** Keep `HarperZ9.github.io` as the live source of truth. Evolve shared CSS and navigation first, then rebuild the React homepage from its checked-in `home/` source, apply the shared system to publication and core route surfaces, and deploy through the existing hashed-bundle path. Preserve all current URLs and career artifact bytes.

**Tech Stack:** Static HTML, CSS, JavaScript modules, React 19, TypeScript 6, Vite 8, Python pytest, Node test runner, Playwright with installed Chrome.

**Spec:** `docs/superpowers/specs/2026-08-28-site-design-upgrade.md`

## Global Constraints

- Zain Dana Harper and Zentropy Labs are the front door. Flywheel is the sole `primary-platform` inside the work.
- Do not use abstract slash-separated concept labels, generic eyebrows, floating pseudo-dashboard cards, decorative framework language, or ungrounded technical ornament.
- Use Hanken Grotesk and Conso only.
- Use color semantically outside art.
- Use warm-paper plates only for charts, diagrams, tables, evidence ledgers, and publication figures.
- Preserve existing public URLs and career artifact bytes.
- Never publish live bypasses, exploit chains, targets, or unpublished vulnerabilities.
- Every figure carries scope, denominator, date, provenance, uncertainty, limitations, and semantic fallbacks.
- Final verification covers responsive reflow, keyboard focus, AA contrast, reduced motion, forced colors, print, no-JS, links, and horizontal overflow.
- Do not run a wholesale Telos deployment into the Pages tree.
- Current base `2a036013b97dad407aa3d18386d919555d047d47` has 23 pre-existing Python failures; final release requires a green full suite after rebasing or reconciling `main`.

---

### Task 1: Lock the two-face visual contract

**Files:**
- Modify: `tests/test_zentropy_sitewide_contract.py`
- Modify: `tests/test_page_export.py`
- Modify: `system/system.css`
- Modify: `system/doc.css`
- Modify: `system/nav.css`
- Modify: `system/figure.css`

**Interfaces:**
- Consumes: existing CSS variables and shared page classes.
- Produces: `--font-sans`, `--font-mono`, `--ground-instrument`, `--ground-paper`, `--ink-paper`, `.data-plate`, and `.evidence-ledger`.

- [ ] **Step 1: Write failing type and plate tests**

Add assertions that active shared CSS contains no `ZentropyDisplay`, defines exactly the Hanken and Conso font faces, exposes the six variables above, and defines `.data-plate` with warm-paper background plus dark ink. Assert forced-colors and print rules remove decorative backgrounds while retaining borders.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
python -m pytest tests/test_zentropy_sitewide_contract.py tests/test_page_export.py -q
```

Expected: failures name `ZentropyDisplay`, the missing token names, and the absent plate rules.

- [ ] **Step 3: Implement the canonical tokens**

Remove active `ZentropyDisplay` declarations and references. Define:

```css
:root{
  --font-sans:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --font-mono:"Conso","JetBrains Mono",ui-monospace,"SFMono-Regular",monospace;
  --ground-instrument:#070406;
  --ground-paper:#f2efe6;
  --ink-paper:#111014;
}
.data-plate{background:var(--ground-paper);color:var(--ink-paper)}
```

Mirror the variables in `system.css`, `doc.css`, `nav.css`, and `figure.css` only where each stylesheet is self-contained. Add print and forced-colors fallbacks.

- [ ] **Step 4: Run focused and Node CSS-adjacent tests**

Run:

```powershell
python -m pytest tests/test_zentropy_sitewide_contract.py tests/test_page_export.py tests/test_page_metadata.py -q
node --test system/nav.test.mjs system/figure.test.mjs
```

Expected: all tests that are not part of the recorded pre-existing baseline pass.

- [ ] **Step 5: Commit the visual foundation**

```powershell
git add tests/test_zentropy_sitewide_contract.py tests/test_page_export.py system/system.css system/doc.css system/nav.css system/figure.css
git diff --cached --check
git commit -m "style(site): unify instrument and evidence surfaces"
```

### Task 2: Replace route posters with a quiet route header

**Files:**
- Modify: `tests/test_zentropy_sitewide_contract.py`
- Modify: `tests/test_page_metadata.py`
- Modify: `system/nav.js`
- Modify: `system/nav.test.mjs`
- Modify: `system/nav.css`
- Modify: `system/system.css`
- Modify: `system/doc.css`

**Interfaces:**
- Consumes: route metadata from each document title, description, and body class.
- Produces: `buildRouteHeader(document): HTMLElement` and one `.route-header` per eligible static page.

- [ ] **Step 1: Write failing route-header tests**

Require `buildRouteHeader` to emit a label, title, summary, and optional image without the text `route artifact`. Assert that `nav.js` does not add `aria-current` to more than one link for `hire.html#engineering-path` and that the route header is excluded from `index.html`.

- [ ] **Step 2: Run tests and verify RED**

```powershell
python -m pytest tests/test_zentropy_sitewide_contract.py tests/test_page_metadata.py -q
node --test system/nav.test.mjs
```

Expected: the current `route artifact` caption and duplicate-current behavior fail the new assertions.

- [ ] **Step 3: Implement `buildRouteHeader` and current-route resolution**

Use the current page's existing route image and metadata. Render:

```html
<figure class="route-header">
  <img class="route-header__art" alt="">
  <figcaption>
    <span class="route-header__label"></span>
    <strong class="route-header__title"></strong>
    <span class="route-header__summary"></span>
  </figcaption>
</figure>
```

When a hash route is exact, mark only the exact hash link current. Otherwise mark only the base page link current.

- [ ] **Step 4: Verify route behavior**

Run the focused Python and Node tests, then serve the worktree and inspect `catalog.html`, `publications.html`, `retro.html`, and `hire.html#engineering-path` at 390 and 1440 px.

- [ ] **Step 5: Commit the shared header and navigation change**

```powershell
git add tests/test_zentropy_sitewide_contract.py tests/test_page_metadata.py system/nav.js system/nav.test.mjs system/nav.css system/system.css system/doc.css
git diff --cached --check
git commit -m "feat(site): unify route headers and current navigation"
```

### Task 3: Rebuild the person-and-lab-first homepage sequence

**Files:**
- Modify: `tests/test_home_marketing_funnel.py`
- Modify: `tests/test_portfolio_visual_contract.py`
- Modify: `home/src/App.tsx`
- Modify: `home/src/App.css`
- Modify: `home/src/index.css`
- Modify: `home/index.html`
- Modify: `home/deploy.mjs`
- Regenerate: `index.html`
- Regenerate: `assets/index-*.js`
- Regenerate: `assets/index-*.css`

**Interfaces:**
- Consumes: `site/systems.json`, `site/evidence-stream.json`, current figure routes, current career routes, and shared `/system/home-art.js`.
- Produces: `IdentityHero`, `FeaturedFlywheel`, `EvidenceBoard`, `CapabilityOverview`, `CurrentResearch`, `RetroSystemsLab`, `SecurityBoundary`, and `HiringRoutes` sections in `App.tsx`.

- [ ] **Step 1: Replace stale homepage tests with the adopted sequence**

Assert the source contains the nine section identifiers from spec section 6. Require the exact hero identity lines from the spec and prohibit `orientation / artifact / claim / proof / route`, `Recorded workflows`, and `Try four browser-native checks`. Require no more than twelve overview nodes, Flywheel as the only primary platform inside the work, a visible hire route, and a complete static `noscript` mirror.

- [ ] **Step 2: Run the home tests and verify RED**

```powershell
python -m pytest tests/test_home_marketing_funnel.py tests/test_portfolio_visual_contract.py -q
```

Expected: failures identify the product-first hero, abstract eyebrow, release card, stale workflow and browser-check sections, and missing identity, evidence, retro, security, and hiring sections.

- [ ] **Step 3: Implement the new React section components**

Keep components local to `App.tsx` until a component exceeds 120 lines. Use semantic `section`, `figure`, `table`, `ol`, and `article` elements. The evidence board must derive its displayed values from checked-in data rather than duplicating counts in JSX.

- [ ] **Step 4: Implement the homepage visual hierarchy**

Use the instrument ground for the page, warm-paper plates for the evidence board and figures, editorial ruled rows for systems, and one contained operator-authored or tool-generated identity artwork in the hero. Remove active `ZentropyDisplay`, decorative cyan UI, pill controls, the abstract slash eyebrow, floating release card, and the recorded-workflow poster wall from homepage CSS.

- [ ] **Step 5: Build and deploy into the worktree**

```powershell
Set-Location home
npm ci
npm run build
node deploy.mjs
Set-Location ..
```

Expected: `index.html` points to exactly one hashed JavaScript and one hashed CSS asset, and the old unreferenced pair is removed by the deploy script.

- [ ] **Step 6: Run focused tests and visual checks**

Run the two home test modules, the atomic-bundle tests, and screenshot the home at 390, 768, and 1440 px with JavaScript on and off. Confirm no horizontal overflow and that the no-JS page carries the same section order and primary actions.

- [ ] **Step 7: Commit the homepage**

```powershell
git add home index.html assets tests/test_home_marketing_funnel.py tests/test_portfolio_visual_contract.py
git diff --cached --check
git commit -m "feat(site): rebuild the Zain and Zentropy front door"
```

### Task 4: Apply the evidence-plate system to figures and publications

**Files:**
- Modify: `tests/test_capability_publication_release.py`
- Modify: `tests/live/test_capability_constellation_static.py`
- Modify: `system/figure.css`
- Modify: `system/figure.js`
- Modify: `system/figure.test.mjs`
- Modify: `publications.html`
- Modify: `briefings/index.html`
- Modify: `briefings/2026-08-26-openai-hugging-face-incident/index.html`
- Modify: `figures/*.html`
- Modify: `figures/*.svg`

**Interfaces:**
- Consumes: existing figure JSON companions and existing publication metadata.
- Produces: `.data-plate`, `.figure-finding`, `.figure-scope`, `.figure-limitations`, and a semantic table or mobile-card representation for each figure.

- [ ] **Step 1: Write failing evidence-plate tests**

For every figure route, require title, finding, scope, denominator, date, sources, uncertainty, limitations, `What this figure does not prove`, and one semantic fallback. Assert 16 px minimum labels and 2 px primary strokes in committed SVGs.

- [ ] **Step 2: Run figure tests and verify RED**

```powershell
python -m pytest tests/test_capability_publication_release.py tests/live/test_capability_constellation_static.py -q
node --test system/figure.test.mjs
```

Expected: failures enumerate figures missing the strengthened metadata or visual measurements.

- [ ] **Step 3: Extend the figure renderer without changing source facts**

Render the additional metadata from existing JSON. Do not infer missing denominators or dates. When a value is absent, render `unknown` and style it as unverifiable.

- [ ] **Step 4: Restyle figure and publication surfaces**

Use warm-paper data plates, near-black ink, direct labels, non-color encoding, print fallbacks, forced-colors borders, and stacked mobile cards. Keep article prose on a calm dark reading column.

- [ ] **Step 5: Verify source and figure parity**

Run focused tests, inspect the canonical incident briefing and four capability maps at 390 and 1440 px, print each to PDF, and confirm no source link or limitation disappeared.

- [ ] **Step 6: Commit the figure-led publication system**

```powershell
git add tests/test_capability_publication_release.py tests/live/test_capability_constellation_static.py system/figure.css system/figure.js system/figure.test.mjs publications.html briefings figures
git diff --cached --check
git commit -m "feat(site): publish accessible evidence plates"
```

### Task 5: Normalize catalog, security, retro, and hiring routes

**Files:**
- Modify: `tests/test_capability_publication_release.py`
- Modify: `tests/test_flywheel_retro_live_release.py`
- Modify: `tests/test_career_documents.py`
- Modify: `catalog.html`
- Modify: `security.html`
- Modify: `security-toolkit.html`
- Modify: `retro.html`
- Modify: `engine-revival.html`
- Modify: `brender-archival.html`
- Modify: `hire.html`
- Modify: `resume.html`
- Modify: `portfolio.html`
- Modify: `system/system.css`
- Modify: `system/doc.css`

**Interfaces:**
- Consumes: shared tokens, route header, route registry, existing career artifact manifest, and current retro source claims.
- Produces: one catalog row grammar, one lawful-security boundary panel, one Retro Systems Lab play/preserve/verify cluster, and visually consistent hiring routes.

- [ ] **Step 1: Write failing route-parity tests**

Require each core route to use shared tokens and route header classes. Require the retro cluster to link all three pages and use the exact verbs `play`, `preserve`, and `verify`. Require career artifact hashes before and after the task to be identical.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
python -m pytest tests/test_capability_publication_release.py tests/test_flywheel_retro_live_release.py tests/test_career_documents.py -q
```

Expected: visual-parity assertions fail while content-integrity assertions remain unchanged from the recorded base.

- [ ] **Step 3: Apply the shared route composition**

Replace page-local decorative structures with shared editorial rows, evidence plates, and action links. Do not rewrite career facts, security claims, retro maturity claims, or downloadable document bytes.

- [ ] **Step 4: Add the Retro Systems Lab cluster**

Embed one accessible play, preserve, verify diagram with a semantic ordered-list fallback and direct links to Retro Engine, Engine Revival, BRender Archival, and Flywheel.

- [ ] **Step 5: Verify the core route set**

Serve the site and inspect each route at 390 and 1440 px, with keyboard navigation, reduced motion, and forced colors. Recompute the career artifact manifest and assert no document hash changed.

- [ ] **Step 6: Commit route normalization**

```powershell
git add tests/test_capability_publication_release.py tests/test_flywheel_retro_live_release.py tests/test_career_documents.py catalog.html security.html security-toolkit.html retro.html engine-revival.html brender-archival.html hire.html resume.html portfolio.html system/system.css system/doc.css
git diff --cached --check
git commit -m "style(site): unify core public routes"
```

### Task 6: Run the complete release gate and publish

**Files:**
- Modify only if verification exposes a tested defect.
- Record: `docs/superpowers/plans/2026-08-28-site-design-upgrade-verification.md`

**Interfaces:**
- Consumes: all prior task commits and current `origin/main`.
- Produces: reviewed PR, merge receipt, Pages build receipt, and live parity evidence.

- [ ] **Step 1: Rebase on current `origin/main` and classify conflicts**

Fetch `origin/main`, record its SHA, and rebase. Preserve current career artifacts and any newer publication state. Resolve only conflicts whose desired behavior is specified here.

- [ ] **Step 2: Run all automated gates**

```powershell
python -m pytest tests -q
node --test "system/**/*.test.mjs"
git diff --check origin/main...HEAD
```

Start `npx serve -l 8802 .` in a hidden process, run `node tests/linkcheck.mjs`, and stop the exact process.

Expected: zero failed tests and zero broken internal links.

- [ ] **Step 3: Run the browser accessibility matrix**

Check `/`, `/catalog.html`, `/publications.html`, the canonical incident briefing, four capability maps, `/security.html`, `/retro.html`, and `/hire.html#engineering-path` at 320, 390, 768, and 1440 px. Record overflow, current navigation count, focus visibility, reduced motion, forced colors, print, and no-JS results.

- [ ] **Step 4: Scan staged public content**

Search added lines and new binaries for local paths, credential markers, browser profile data, private corpus references, live bypass material, and unpublished vulnerability details. Require zero findings.

- [ ] **Step 5: Request independent code and design review**

Use `superpowers:requesting-code-review`. Review spec compliance, accessibility, content truth, source parity, and deployment safety. Fix each confirmed issue test-first.

- [ ] **Step 6: Push and open one PR**

Push `codex/site-design-upgrade-20260828`. Create one PR to `main` containing the base SHA, test results, linkcheck result, screenshots, accessibility matrix, and source-of-truth statement.

- [ ] **Step 7: Merge only after green checks and verify Pages**

After review and green CI, merge once. Verify that the latest Pages build is `built`, has no error, and references the exact merge SHA. Recheck the live route matrix and write the verification receipt.
