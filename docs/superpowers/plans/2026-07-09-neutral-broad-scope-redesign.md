# Neutral Broad-Scope Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the public portfolio from an accountability/proof-surface thesis into a broad, neutral map of systems, models, graphics, research, demos, writing, and consulting.

**Architecture:** Keep the current deployment architecture: Vite-built home shell, static HTML pages, shared CSS cascades, and injected shared navigation. Update source-of-truth docs first, then page copy, then tests and rendered QA.

**Tech Stack:** Static HTML/CSS/JS, Vite-built home bundle, Python pytest visual contracts, Node nav tests, local HTTP server, Playwright/browser screenshots.

## Global Constraints

- Do not copy inspiration images; synthesize procedural/generative art through first-party code.
- Do not use accountability/proof/trust as the site-level thesis.
- Keep accountability and proof-specific language only where a specific project or article actually requires it.
- Protect secrets, credentials, `.env` files, tokens, and private artifacts.
- Verify by running tests and inspecting desktop/mobile renders.

---

### Task 1: Source-Of-Truth Reframe

**Files:**
- Modify: `C:/dev/public/portfolio-site/PRODUCT.md`
- Modify: `C:/dev/public/portfolio-site/DESIGN.md`
- Modify: `C:/dev/public/portfolio-site/DESIGN-RULES.md`

**Interfaces:**
- Consumes: current user correction and Reddit-derived voice signal.
- Produces: neutral copy rules for subsequent page edits and tests.

- [ ] Rewrite users, product purpose, brand personality, and design principles around broad scope.
- [ ] Remove accountability/proof/trust as the governing thesis.
- [ ] Preserve rigor, maturity labels, source links, and evidence as support.
- [ ] Verify with `rg -n "Proof before trust|public proof surface|accountability line|verdict lattice" PRODUCT.md DESIGN.md DESIGN-RULES.md`.

### Task 2: Overview Field Map

**Files:**
- Modify: `C:/dev/public/portfolio-site/overview.html`

**Interfaces:**
- Consumes: source-of-truth reframe from Task 1.
- Produces: high-traffic static overview that matches the new direction.

- [ ] Replace hero title, lede, close, and seal with field-map copy.
- [ ] Replace `#finding` with a broad "field guide" section.
- [ ] Replace `#where-it-fits` scenarios with lane-based public entry points.
- [ ] Keep project-specific proof language only in engine rows where it names the actual tool behavior.
- [ ] Verify mobile wrapping with browser metrics.

### Task 3: Home Bundle Copy Alignment

**Files:**
- Modify: `C:/dev/public/portfolio-site/index.html`
- Modify: `C:/dev/public/portfolio-site/assets/index-Dvl98w8q.js`

**Interfaces:**
- Consumes: current built bundle, because source is not available in this checkout.
- Produces: visible home copy aligned with the new voice until the source bundle can be rebuilt.

- [ ] Replace title and meta descriptions with broad-scope Project Telos framing.
- [ ] Mechanically replace hero, section, range, work, and footer copy in the JS bundle.
- [ ] Preserve routes, class names, section IDs, links, and canvas wiring.
- [ ] Verify app tests still locate section IDs and nav anchors.

### Task 4: Tests And Contracts

**Files:**
- Modify: `C:/dev/public/portfolio-site/tests/test_portfolio_visual_contract.py`
- Modify only if needed: `C:/dev/public/portfolio-site/system/nav.test.mjs`

**Interfaces:**
- Consumes: updated copy.
- Produces: tests that fail if the rejected framing returns as the main home contract.

- [ ] Replace old home thesis assertions with broad-scope assertions.
- [ ] Add explicit negative assertions for retired thesis snippets.
- [ ] Keep tests for generative field, accessibility, nav, and linked assets.
- [ ] Run `python -m pytest tests/test_portfolio_visual_contract.py tests/test_owned_blog_article.py tests/test_public_test_run_request.py`.
- [ ] Run `node --test system/nav.test.mjs`.
- [ ] Run `node tests/linkcheck.mjs`.

### Task 5: Rendered QA

**Files:**
- Write: `C:/dev/public/portfolio-site/.preview/neutral-home-1440.png`
- Write: `C:/dev/public/portfolio-site/.preview/neutral-home-mobile.png`
- Write: `C:/dev/public/portfolio-site/.preview/neutral-overview-1440.png`
- Write: `C:/dev/public/portfolio-site/.preview/neutral-overview-mobile.png`

**Interfaces:**
- Consumes: local HTTP server and edited pages.
- Produces: visual evidence for the current stage and a remaining-work list.

- [ ] Start or reuse a local HTTP server.
- [ ] Capture desktop and mobile screenshots for home and overview.
- [ ] Check `document.documentElement.scrollWidth <= clientWidth` at 375px and 390px.
- [ ] Inspect screenshots for nav overlap, heading clipping, and text/art contrast.
- [ ] Record any unresolved issues as next-stage work instead of calling the redesign complete.
