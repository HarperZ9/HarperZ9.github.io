# Hiring-First Public Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:test-driven-development for every behavior change, superpowers:systematic-debugging for every failure, and superpowers:verification-before-completion before any success claim, commit, push, PR, or deploy.

**Goal:** Turn HarperZ9.github.io and the HarperZ9 GitHub profile into a conversion-first, three-path hiring surface, preserve current career artifacts in the canonical build source, and present public and private security work with verified maturity and useful public-safe detail.

**Architecture:** `HarperZ9/telos-v2` remains the canonical site source. A data-only route registry generates the React and static navigation projections. Vite builds the complete site into `dist/`, and the reviewed deploy script stages that output into `HarperZ9/HarperZ9.github.io`. The profile and selected product repositories remain separate public repos with their own verification gates. No runtime service, analytics, tracking, account system, or new frontend framework is added.

**Tech Stack:** React 19, TypeScript, Vite 8, static HTML/CSS/ES modules, Node test runner, pytest, Playwright/browser inspection, deterministic HTML-to-PNG card renderer, GitHub Pages.

**Spec:** `C:/dev/worktrees/site-hiring-first-architecture/docs/superpowers/specs/2026-08-26-hiring-first-public-presence-design.md`

**Global constraints:** Keep Flywheel, Behavior Transform, Brender Archival, and Engine Revival source code outside this workstream. Do not publish private source, protected history, credentials, client material, sensitive deployment facts, or actionable offensive procedures. Detailed public-safe explanations may cover purpose, problem, components, bounded workflow, intended users, test strategy, non-sensitive deployment shape, limitations, and authorized engagement boundaries. Do not claim firefighter, EMT, academy, incident-command, certification, adoption, endorsement, or current-green status without first-party evidence.

---

## Task 1: Adopt the Live Career Funnel Back Into Canonical Source

**Files:**

- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/hire.html`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/resume.html`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/cv.html`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/portfolio.html`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/cover-letter.html`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/dossier.html`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/nav.js`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/doc.css`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/system.css`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/src/App.tsx`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/src/App.css`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/career/Zain-Dana-Harper-Resume-Technical.pdf`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/career/Zain-Dana-Harper-Resume-Technical-Operations.pdf`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/career/Zain-Dana-Harper-Resume-Public-Operations.pdf`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/career/Zain-Dana-Harper-Resume-Grounds.pdf`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/career/open-source-census.json`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_career_documents.py`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_home_roster_and_marketing.py`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/README.md`

**Step 1: Write the failing source-ownership tests**

Add tests that require `public/hire.html`, the four `%PDF-` assets, the current hiring-first homepage copy, and `public/system/nav.js` to exist in canonical source. Add a test that builds to `dist/` and compares SHA-256 for these preserved outputs.

Run:

```powershell
python -m pytest tests/test_career_documents.py tests/test_home_roster_and_marketing.py -q
```

Expected: FAIL because the canonical source lacks the live hiring funnel and specialized résumés.

**Step 2: Port text sources and verified binary artifacts**

Use the merged Pages output at commit `e08a3d797d2daf039b76b388f42ef47480907d6a` as the adoption input. Apply text changes to canonical source with `apply_patch`. Copy the four existing PDF binaries only after recording and comparing their SHA-256 values. Do not reconstruct or reprint those PDFs in this task.

**Step 3: Rebuild and prove output parity**

Run:

```powershell
npm run build
python -m pytest tests/test_career_documents.py tests/test_home_roster_and_marketing.py -q
```

Expected: PASS; `dist/hire.html`, the four route résumés, home source, and navigation now reproduce the approved live output.

**Step 4: Commit the adoption**

```powershell
git diff --check
git status --short
git add public src tests README.md
git commit -m "fix(site): adopt live hiring funnel into canonical source"
```

---

## Task 2: Establish One Route Registry for Home and Static Navigation

**Files:**

- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/site/routes.json`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/scripts/render-route-registry.mjs`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/src/site-routes.ts`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/routes.js`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/nav.js`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/src/App.tsx`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/package.json`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_route_registry.py`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/nav.test.mjs`

**Step 1: Write failing registry and parity tests**

Require exactly five top-level families in order: Work, Systems, Security, Research, Studio. Require GitHub as an external action. Require all career pages to resolve to Work and every security/tool route to resolve to Security. Require the generated TypeScript and browser-module projections to match `site/routes.json` byte-for-byte after normalization.

Run:

```powershell
python -m pytest tests/test_route_registry.py -q
node --test public/system/nav.test.mjs
```

Expected: FAIL because the shared registry and projections do not exist.

**Step 2: Implement the smallest generator**

Create a dependency-free Node script that validates the JSON schema, writes deterministic generated modules, and exits nonzero on duplicate keys, duplicate routes, missing labels, or unknown active families. Add `routes:render` and `routes:check` scripts. Make `build` and `verify` run `routes:check` before Vite.

**Step 3: Consume generated projections**

Import `PRIMARY_ROUTES`, `SECONDARY_GROUPS`, and `routeFamily()` from the generated modules in both React and static navigation. Preserve noscript fallbacks in page HTML.

**Step 4: Verify and commit**

```powershell
npm run routes:check
python -m pytest tests/test_route_registry.py -q
node --test public/system/nav.test.mjs
npm run build
git diff --check
git commit -am "feat(site): generate one public route taxonomy"
```

---

## Task 3: Replace the Document Rail With a Conversion Layout

**Files:**

- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/hire.html`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/hire.css`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/system/doc.css`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_career_documents.py`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_hire_layout.py`

**Step 1: Write failing conversion contracts**

Require no `doc-rail` on `hire.html`; three explicit route bands; the approved engineering, technical-operations, and public-service/safety/field labels; explicit openness to physical and non-physical work; no unearned firefighter/EMT credential claim; primary technical résumé and email actions at the top; specialized route PDF links; and a secondary disclosure for letter/dossier resources.

**Step 2: Implement semantic route bands**

Use a dedicated `.hire-sheet` layout, not equal cards. Keep engineering visually dominant while preserving full route choices. Add facts and role examples without turning every interest into a credential claim.

**Step 3: Add responsive and target-size tests**

Serve the built site with `npx serve -l 8765 dist`. Inspect 320, 390, 760, 980, 1000, and 1440 CSS pixels. Assert that widening from 980 to 1000 does not reduce route-band width and that primary controls are at least 44 CSS pixels high.

**Step 4: Verify and commit**

```powershell
npm run build
python -m pytest tests/test_career_documents.py tests/test_hire_layout.py -q
node tests/linkcheck.mjs
git diff --check
git commit -am "feat(career): build a three-path hiring surface"
```

---

## Task 4: Make the Homepage Hiring-First

**Files:**

- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/src/App.tsx`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/src/App.css`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/index.html`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_home_roster_and_marketing.py`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_portfolio_visual_contract.py`

**Step 1: Write the failing first-viewport tests**

Require `Work with Zain Dana Harper`, the three route names, technical résumé, selected evidence, and email/hire links before the engine roster. Require route labels from `src/site-routes.ts`, not a second hand-written taxonomy.

**Step 2: Implement the approved evidence sequence**

Order the page: hiring thesis, three routes, selected evidence, current contributions, broader workshop, contact. Keep the live field contained and preserve text before WebGL.

**Step 3: Verify reduced motion, noscript, and breakpoints**

Run component/source contracts, a production build, and desktop/mobile browser review. Confirm that JavaScript failure leaves the person, work routes, résumé, and contact visible.

**Step 4: Commit**

```powershell
npm run verify
git diff --check
git commit -am "feat(home): lead with hiring routes and evidence"
```

---

## Task 5: Rebuild the Security Lane Around Verified Maturity

**Files:**

- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/security-tools.json`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/security.html`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/security-toolkit.html`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/emet.html`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/phantom.html`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/private-practice.html`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/scripts/check-security-claims.mjs`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_security_surface.py`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/sitemap.xml`

**Step 1: Write failing claim-boundary tests**

Require four maturity classes: shipped, alpha/release-candidate, toolkit, private-contract. Require EMET `v1.2.0` only after fresh first-party revalidation. Require Phantom `v1.1.0` plus Layer-2-only and unsigned installer/driver caveats. Prohibit private repository links, current-green claims derived from stale local runs, offensive procedure text, adoption, endorsement, certification, and unbounded surveillance/evasion claims.

**Step 2: Build the data-backed security index**

Create one inspectable record per public item with purpose, version, maturity, source, install/entry command, verification command, evidence date, limitations, and authorization boundary. Render honest nulls for unknown release or CI state.

**Step 3: Write detailed public-safe private-practice descriptions**

For Seed, Array, Sofer, Bounds, ORCA, and other approved systems, explain purpose, problem, components, bounded workflow, intended users, testing approach, non-sensitive deployment model, limitations, and engagement boundary. Do not expose source, client facts, sensitive deployment specifics, exploit chains, persistence/evasion procedures, credentials, targets, or actionable operational instructions.

**Step 4: Verify and commit**

```powershell
node scripts/check-security-claims.mjs
python -m pytest tests/test_security_surface.py -q
npm run verify
git diff --check
git commit -am "feat(security): publish verified tool and practice surfaces"
```

---

## Task 6: Extend the Deterministic Flagship Artwork Pipeline

**Files:**

- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/img/og/cards-data.js`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/img/og/_card.html`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/scripts/render-social-cards.mjs`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/public/docs/brand/README.md`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/img/og/security-toolkit.png`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/public/img/og/private-practice.png`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_social_cards.py`

**Step 1: Write failing deterministic-art tests**

Require a registry entry, exact dimensions, embedded title/role metadata, stable render hash receipt, and site metadata reference for each promoted security surface. Require one iris accent, one library glyph, and no unapproved hacker imagery.

**Step 2: Add cards to the existing renderer**

Use the established ceramic-card-on-dark-mat pipeline. Do not use free-form image generation because the established code-native renderer is the canonical and reproducible asset system.

**Step 3: Render, inspect, and record receipts**

Run the renderer twice. The outputs must be byte-identical. Inspect the PNGs at original resolution and record command, dimensions, and SHA-256 in the brand README.

**Step 4: Verify and commit**

```powershell
npm run media:cards
npm run media:cards
python -m pytest tests/test_social_cards.py -q
git diff --check
git commit -am "feat(brand): extend canonical security artwork"
```

---

## Task 7: Update the GitHub Profile Funnel

**Files:**

- Modify: `C:/dev/worktrees/profile-hiring-first/README.md`
- Modify: `C:/dev/worktrees/profile-hiring-first/scripts/check_profile_surface.py`
- Modify: `C:/dev/worktrees/profile-hiring-first/docs/brand/README.md`

**Step 1: Create an isolated worktree**

Create `C:/dev/worktrees/profile-hiring-first` on `codex/hiring-first-profile` from the current remote default branch. Do not reuse the local `feat/platforms-section` checkout.

**Step 2: Write failing profile contracts**

Require the three hiring routes, Hire/Resume/Portfolio/CV/Email actions, current EMET and Phantom versions after revalidation, private/public boundary language, and a dated evidence note. Prohibit archived Flywheel Desktop promotion and duplicate stale version strings.

**Step 3: Implement a scan-first README**

Keep the first screen focused on identity, work routes, proof, and contact. Move the long system catalog below the hiring funnel or into collapsible detail. Preserve public-safe offensive-tool descriptions without turning the profile into a capability manual.

**Step 4: Verify and commit**

```powershell
python scripts/check_profile_surface.py
git diff --check
git commit -am "feat(profile): lead with three hiring paths"
```

Pin changes are separate GitHub UI actions. Before changing pins, reread the live profile and repository archive state. Prefer EMET and Phantom over archived `flywheel-desktop` only if the live state matches the verified inventory.

---

## Task 8: Upgrade Selected Repository READMEs Without Crossing Boundaries

**Repositories:** EMET, Phantom, Accountable Surface, Public Surface Sweeper, Secret Redact IO, Model Provenance Validator, Agent Hook Pack, Repo Proof Index.

**Step 1: Re-read each repository's own `AGENTS.md`, status, release, workflows, and README**

Do not edit a reserved or dirty checkout. Create one isolated `codex/` worktree per repository only when its branch and ownership are clear.

**Step 2: Add a repository-local failing presentation test where useful**

Require maturity/version, one verified quickstart, security/authorization boundary, limitations, support, and canonical artwork link. Never add a badge for a missing workflow or a command that has not been run from a fresh checkout.

**Step 3: Implement the standard in priority order**

1. EMET and Phantom.
2. Accountable Surface only as alpha until a release exists.
3. Grouped toolkit repos where current tests and public state are green.
4. Private-contract pages remain site-only unless their public repository actually exists.

Commit and PR each repository separately. Do not bundle unrelated repos into one release claim.

---

## Task 9: Run the Full Site and Accessibility Gate

**Files:**

- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/.github/workflows/ci.yml`
- Modify: `C:/dev/worktrees/telos-hiring-first-public-presence/package.json`
- Add: `C:/dev/worktrees/telos-hiring-first-public-presence/tests/test_public_presence_gate.py`

**Step 1: Make CI run the same local gate**

Include route generation/check, career rendering/check, Vite build, all pytest tests, all Node tests, link crawl, security-claim check, artwork parity, no-em-dash/public-copy checks, and credential-shaped-content scan.

**Step 2: Run local verification**

```powershell
npm ci
npm run verify
git diff --check
git status --short
```

Serve `dist/` and visually inspect home, hire, security, toolkit, EMET, Phantom, résumé, and one research page at desktop/mobile widths, keyboard-only, reduced motion, and no-JavaScript conditions.

**Step 3: Request code review and resolve only verified findings**

Use `superpowers:requesting-code-review`. If review produces changes, use `superpowers:receiving-code-review`, reproduce each issue, patch minimally, and rerun focused plus full gates.

---

## Task 10: Deploy, Reconcile Live Production, Then Resume Outreach

**Repositories:**

- Source: `C:/dev/worktrees/telos-hiring-first-public-presence`
- Pages output: `C:/dev/worktrees/site-hiring-first-architecture`

**Step 1: Stage the exact verified build**

```powershell
npm run build
node scripts/deploy-into-pages.mjs C:/dev/worktrees/site-hiring-first-architecture --include-home
```

Review every staged file. Confirm no source-only docs, private paths, secrets, or removed live artifacts. Run the Pages repository's Python, Node, and link suites against the staged tree.

**Step 2: Commit and push source first**

Push `codex/hiring-first-public-presence`, open one reviewed PR to the remote default `feat/spectrum-redesign`, and wait for clean CI. Merge only after the source receipt exists.

**Step 3: Commit and push generated output**

Commit the reviewed generated output on `codex/hiring-first-site-architecture`, push, open one Pages PR, wait for clean CI, and merge. Record the exact source commit, output commit, PRs, and Pages deployment receipt.

**Step 4: Verify production**

Check live HTTP 200 and rendered content for `/`, `/hire.html`, `/security.html`, `/security-toolkit.html`, `/emet.html`, `/phantom.html`, all four route PDFs, and sitemap entries. Confirm canonical metadata and social images resolve.

**Step 5: Resume collision-safe career execution**

Use the improved assets for current first-party routes. Add fire/public-safety, field, public works, parks, utilities, facilities, grounds, arboriculture, technical operations, and engineering opportunities to the durable queue only after duplicate, eligibility, deadline, and account-state checks. Treat Seattle Fire entry-level hiring as a fall-2026 monitor until the official application opens. Treat Seattle Fire Prep as a preparation/mail-list route, not employment or credential evidence. Any account access, private-data entry, upload, email, certification, or final submission still receives its required action-time confirmation.

---

## Final Evidence Packet

Record:

- source and Pages commit SHAs;
- profile and repository PRs;
- exact test totals and commands;
- breakpoint screenshots and accessibility observations;
- deterministic artwork hashes;
- first-party release/CI evidence dates;
- live URLs and Pages deployment receipt;
- preserved limitations and honest nulls;
- outreach queue additions and no-resubmit controls.

Do not claim completion until every changed public surface is tied to a merged commit, clean verification output, and a live readback.
