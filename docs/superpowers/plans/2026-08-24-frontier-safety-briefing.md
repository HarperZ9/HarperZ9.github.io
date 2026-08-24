# Frontier Safety Briefing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the relevant ZentropyLabs research context into a durable public-safe corpus, publish the first verified Frontier Safety Briefing on harperz9.github.io, install a collision-safe daily source-check and distribution workflow, and advance the separate Free Law Project issue 480 contribution through its verified draft-PR gate.

**Architecture:** A standard-library Python generator validates a reviewed JSON edition and renders the current page, an immutable dated archive, machine-readable records, and X/LinkedIn copy. A curated source registry and hash state allow the scheduled workflow to detect change without manufacturing claims. The static site uses the existing shared navigation and fonts with a page-specific instrument layout.

**Tech Stack:** Static HTML/CSS, Python 3.12 standard library, pytest, GitHub Actions, GitHub Pages, Node link checker, local Chrome visual inspection.

**Spec:** `docs/superpowers/specs/2026-08-24-frontier-safety-briefing-design.md`

## Global constraints

- Preserve the parallel-owned Behavior-Transform, BRender, Engine Revival, and Flywheel workstreams.
- Exclude the ZentropyLabs personal health thread from public and shared research artifacts.
- Recheck time-sensitive claims against primary sources before publication.
- Never create a daily no-change edition or duplicate social post.
- Never embed browser sessions, tokens, private paths, opaque ChatGPT citations, or unpublished private artifacts.
- Do not describe announced controls as independently verified.
- Website publication may proceed independently of social-account availability.

### Task 1: Capture the imported research context and source register

**Files:**
- Create: `project-docs/zentropy-import/2026-08-24-context-map.md`
- Create: `project-docs/zentropy-import/2026-08-24-source-register.json`

- [x] Record the visible ZentropyLabs thread catalog, relevant thread scopes, local synthesis inputs, and the intentional health-thread exclusion.
- [x] Normalize the first-party AISI, Anthropic, OpenAI, Hugging Face, METR, NVD, and Sysdig source URLs with role and domain metadata.
- [x] Recheck every source used by the first edition and record observed-at time, publication date where available, and current availability.
- [x] Validate JSON and scan both files for private paths, credentials, and opaque citation markers.

### Task 2: Define failing publication contracts

**Files:**
- Create: `tests/test_frontier_safety_briefing.py`

- [x] Add tests for required source roles, three lanes, dates, confidence, `does_not_prove`, URL allowlist, no bare severity labels, unique edition dates, archive/current equality, public-path hygiene, social limits, and required site links.
- [x] Run the test file and confirm it fails because the briefing artifacts do not exist.

### Task 3: Build the deterministic edition generator

**Files:**
- Create: `tools/build_frontier_safety_briefing.py`
- Create: `frontier-safety/data/edition-2026-08-24.json`
- Create: `frontier-safety/data/source-state.json`
- Create: `frontier-safety/data/history.json`

- [x] Implement schema validation, canonical JSON serialization, SHA-256 edition hashing, safe HTML escaping, lane rendering, social rendering, and duplicate-date protection.
- [x] Keep source-change detection separate from reviewed-claim publication.
- [x] Enter only claims supported by the rechecked source record; include limitations and open questions.
- [x] Run unit contracts for invalid inputs, idempotence, and duplicate suppression.

### Task 4: Render the current page, archive, and social drafts

**Files:**
- Create: `frontier-safety.html`
- Create: `frontier-safety/frontier-safety.css`
- Create: `frontier-safety/archive/2026-08-24.html`
- Create: `frontier-safety/data/current.json`
- Create: `frontier-safety/data/archive/2026-08-24.json`
- Create: `frontier-safety/social/2026-08-24-x.txt`
- Create: `frontier-safety/social/2026-08-24-linkedin.txt`

- [x] Render all artifacts with the generator.
- [x] Implement the approved delta rail, evidence items, control-status table, open questions, sources, corrections, and machine-readable links.
- [x] Confirm HTML escaping, responsive behavior, visible focus, reduced motion, print behavior, and metadata.
- [x] Rerun targeted publication contracts until they pass.

### Task 5: Integrate the briefing into the site

**Files:**
- Modify: `research.html`
- Modify: `sitemap.xml`
- Modify: `tests/test_deploy_sanity.py`

- [x] Add a precise Research-index entry linking to the briefing.
- [x] Add the current and archive URLs to the sitemap.
- [x] Add the briefing to deploy-sanity key pages.
- [x] Run metadata, deploy, Zentropy, and link contracts.

### Task 6: Install collision-safe daily publication automation

**Files:**
- Create: `.github/workflows/frontier-safety-daily.yml`
- Create: `tools/check_frontier_safety_sources.py`
- Create: `docs/frontier-safety-operations.md`

- [x] Implement a scheduled and manually dispatchable source check with timeouts, user agent, fingerprint comparison, and fail-closed behavior.
- [x] Make no-change runs exit without modifying files or logging a synthetic edition.
- [x] Validate changed sources without synthesizing public claims; write a review artifact or open a bounded update path.
- [x] Document website, X, and LinkedIn publication states, required authentication, duplicate guards, corrections, and recovery.
- [x] Add or update one Codex recurring automation only after checking for an existing equivalent automation.

### Task 7: Verify, publish, and distribute

**Files:** No planned source changes unless verification finds a defect.

- [x] Run `python -m pytest -q tests/test_frontier_safety_briefing.py tests/test_deploy_sanity.py tests/test_page_metadata.py tests/test_zentropy_sitewide_contract.py` and separate the two recorded Behavior-Transform baseline failures if still present.
- [x] Run the full pytest suite, the Node internal-link check, `git diff --check`, and a credential/private-path scan.
- [x] Serve locally and inspect the page in Chrome at desktop and mobile widths, including reduced motion where available.
- [ ] Commit only intended files on `codex/zentropy-daily-safety-reports`, push the branch, open a PR, wait for checks, merge after success, and verify the live GitHub Pages URL.
- [ ] Post the live edition to X and LinkedIn if authenticated account state and platform controls permit; otherwise retain ready-to-post drafts and record the exact blocker without claiming publication.
- [ ] Record commit, PR, merge, Pages, and social post receipts in the operations document.

### Task 8: Advance Free Law Project issue 480 without crossing its fact gate

**Files:**
- Existing isolated litigant-portal worktree
- Existing private outreach public-action control

- [x] Recheck issue 480, open and closed PR collisions, assignee/comments, upstream main, branch divergence, and repository contribution/AI policy.
- [x] Re-run formatting, focused validation, diff, and credential checks against commit `1a91549` or its verified successor.
- [ ] Resolve the required applicant facts without guessing: exact model string, logged-in service account, training/data-collection opt-out, applicant review and correction commitment, and CLA status.
- [ ] If every fact is resolved and public action is authorized, reconcile the fork, push the single reviewed branch, and open one draft PR with the reviewed AI disclosure. Do not post an issue comment, open a duplicate, mark ready, or merge.
- [ ] Record the branch, commit, PR URL, collision check, and any CLA/check state in the durable outreach controls.
