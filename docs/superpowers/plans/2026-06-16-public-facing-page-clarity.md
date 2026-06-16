# Public Facing Page Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the portfolio, WARDEN, and QuantaLang public pages so they plainly explain what each thing is, how it works, and what evidence supports the claims.

**Architecture:** Keep the existing static-site systems and update copy/structure through HTML plus targeted static contract tests. Portfolio and WARDEN are in `C:\dev\public\portfolio-site`; QuantaLang's live splash is the tested GitHub Pages surface at `C:\dev\public\pubscan\quantalang\docs\index.html`.

**Tech Stack:** Static HTML/CSS, pytest static-source tests, Python local HTTP servers, Browser/Playwright, GitHub Pages.

---

## Source Discovery Note

The design spec mentions the older nested QuantaLang website path. Implementation should target `C:\dev\public\pubscan\quantalang\docs\index.html` because the existing tests read `docs/index.html` and `docs/styles.css`, and that directory is the public splash used by `https://harperz9.github.io/quantalang/`.

## Task 1: Add Plain-Language Portfolio And WARDEN Contracts

**Files:**
- `C:\dev\public\portfolio-site\tests\test_portfolio_visual_contract.py`

**Steps:**
- [ ] Replace the portfolio "receipts not sales posture" test with a clearer contract that requires direct explanation of the work.
- [ ] Assert the portfolio source includes: `I build compilers, graphics tools, accountability systems, and live web products.`
- [ ] Assert the portfolio source includes: `turning ambiguous technical ideas into working software with tests, examples, and public artifacts`
- [ ] Assert the portfolio source includes: `Public release review means checking whether a repo, page, demo, or tool makes claims it can support.`
- [ ] Assert the portfolio source includes: `inspect a public surface, check source and provenance, collect evidence, write a report, and preserve a review trail`
- [ ] Assert the portfolio source names the current work lanes: `language and compiler work`, `accountability and evidence tools`, `graphics and color systems`, `live web products`, and `agent workflow tooling`.
- [ ] Update the WARDEN test to require: `WARDEN is a system for checking AI-assisted work.`
- [ ] Update the WARDEN test to require: `It records what was claimed, what evidence supports it, where the work came from, what changed, and what a human reviewer should look at.`
- [ ] Update the WARDEN test to require workflow labels: `State the claim`, `Attach evidence`, `Check provenance`, `Review anomalies`, `Write a handoff report`, and `Keep human ownership visible`.
- [ ] Run `python -m pytest -q tests\test_portfolio_visual_contract.py` and confirm the new assertions fail before implementation.

## Task 2: Rewrite Portfolio Copy For What, How, And Evidence

**Files:**
- `C:\dev\public\portfolio-site\index.html`

**Steps:**
- [ ] Change the portfolio hero headline to a direct statement, for example: `Software that makes technical work understandable.`
- [ ] Replace the hero lead with: `I build compilers, graphics tools, accountability systems, and live web products. The common thread is turning ambiguous technical ideas into working software with tests, examples, and public artifacts.`
- [ ] Update the hero kicker to name the lanes plainly: `language and compiler work`, `accountability and evidence tools`, `graphics and color systems`, `live web products`, and `agent workflow tooling`.
- [ ] Rewrite the current-state section heading to `What I can help make clear.`
- [ ] Rewrite the public release review card around this explanation: `Public release review means checking whether a repo, page, demo, or tool makes claims it can support. I compare the public story against code, tests, docs, samples, and missing evidence.`
- [ ] Rewrite the toolchain map card around this explanation: `The workflow can inspect a public surface, check source and provenance, collect evidence, write a report, and preserve a review trail.`
- [ ] Rewrite the directions section heading to `What the work is for.`
- [ ] Rewrite each direction row as a concrete lane:
  - Evidence systems: tools that check public claims against code, docs, tests, source records, and review notes.
  - Quanta research: compiler and language experiments showing how source moves through parsing, type checking, MIR, C output, shader output, and labeled research targets.
  - Graphics/color: rendering and calibration work for shaders, tone mapping, profiles, color transforms, and practical visual quality.
  - Agent workflow: utilities for routing work, preparing context, making IO safer, and making agent-assisted coding easier to review.
  - Private platforms: live product surfaces and private systems presented through public screenshots, pages, and outcome descriptions rather than internal code.
- [ ] Keep the design system intact; adjust only the copy and minor structure needed for readability.

## Task 3: Rewrite WARDEN As A Straightforward Flagship

**Files:**
- `C:\dev\public\portfolio-site\warden.html`

**Steps:**
- [ ] Change the hero kicker to direct language such as `AI-assisted work - evidence trails - reviewer handoff`.
- [ ] Change the hero headline to: `Check AI-assisted work. Keep the trail.`
- [ ] Replace the hero lead with: `WARDEN is a system for checking AI-assisted work. It records what was claimed, what evidence supports it, where the work came from, what changed, and what a human reviewer should look at.`
- [ ] Update CTA labels to practical destinations: `See the workflow`, `Public and private boundary`, and `Portfolio`.
- [ ] Rewrite the loop labels as actions: `State the claim`, `Attach evidence`, `Check provenance`, `Review anomalies`, `Write a handoff report`, and `Keep human ownership visible`.
- [ ] Change the first explanatory section heading to `What WARDEN does.`
- [ ] Rewrite the explanatory cards around practical outcomes: making claims reviewable, turning agent output into a handoff, and keeping public/private boundaries clear.
- [ ] Change the lanes section heading to `The public parts of the system.`
- [ ] Expand the boundary section with: `The public page can explain the pattern and link to public tools. It does not publish private internals, credentials, client data, operational details, or sensitive workflows.`
- [ ] Retain `accountability engine` only after the practical explanation is clear, not as the first explanation.

## Task 4: Add QuantaLang Public-Splash Contracts

**Files:**
- `C:\dev\public\pubscan\quantalang\tests\test_docs_landing_page.py`

**Steps:**
- [ ] Update the landing-page tests to require `QuantaLang is a compiler project.`
- [ ] Require the current-state sentence: `Today, the verified path compiles .quanta programs to C`
- [ ] Require the supporting phrases: `runs them through a native compiler`, `also emits HLSL/GLSL shader code`, and `Other backends exist as research surfaces`.
- [ ] Require the workflow heading: `How the compiler works.`
- [ ] Require the compiler pipeline phrase: `source moves through lexer, parser, type checker, MIR, and backends`
- [ ] Require the factual-anchor sentence: `The root README, STATUS, and TEST_RESULTS files are the factual anchors`
- [ ] Replace old hero expectations around `A compiler with receipts` with the new direct compiler-language contract.
- [ ] Keep evidence assertions for test counts, corpus verification, `quantac doctor`, and concrete commands unless the page copy legitimately updates the exact wording.
- [ ] Run `python -m pytest -q tests\test_docs_landing_page.py` and confirm the new assertions fail before implementation.

## Task 5: Rewrite QuantaLang Public Splash

**Files:**
- `C:\dev\public\pubscan\quantalang\docs\index.html`

**Steps:**
- [ ] Change the page title to `QuantaLang - compiler project`.
- [ ] Rewrite the meta description as: `QuantaLang is a compiler project with a verified .quanta to C path, HLSL/GLSL shader output, and clearly labeled research backends.`
- [ ] Change the hero kicker to: `compiler project - verified C path - shader output - labeled research backends`.
- [ ] Change the hero headline to: `QuantaLang is a compiler project.`
- [ ] Replace the hero lead with: `Today, the verified path compiles .quanta programs to C, runs them through a native compiler, and also emits HLSL/GLSL shader code. Other backends exist as research surfaces.`
- [ ] Rename the hero evidence card to a practical label such as `how to run it`.
- [ ] Rename the C-path proof card to `C is the verified execution path` and explain that source moves through lexer, parser, type checker, MIR, and C99 output before native compilation.
- [ ] Update the capabilities section heading to `How the compiler works.`
- [ ] Add or rewrite section copy with: `A .quanta source moves through lexer, parser, type checker, MIR, and backends. C is the verified execution path; shader output is working; the remaining backends are labeled by maturity.`
- [ ] Add the factual anchor sentence near evidence or quickstart: `The root README, STATUS, and TEST_RESULTS files are the factual anchors for current compiler status.`
- [ ] Replace ambiguous `receipts` language with concrete labels such as `status checks`, `diagnostics`, `tests`, `examples`, and `verification commands`.

## Task 6: Verify Locally In Tests And Browser

**Portfolio/WARDEN:**
- [ ] From `C:\dev\public\portfolio-site`, run `python -m pytest -q`.
- [ ] From `C:\dev\public\portfolio-site`, run `git diff --check`.
- [ ] Serve the portfolio locally with `python -m http.server 8765`.
- [ ] Use Browser/Playwright to inspect `http://127.0.0.1:8765/` and `http://127.0.0.1:8765/warden.html` at desktop and mobile widths.
- [ ] Confirm there are no visible overlaps, blank sections, broken internal links, or console errors on the touched pages.

**QuantaLang:**
- [ ] From `C:\dev\public\pubscan\quantalang`, run `python -m pytest -q tests\test_docs_landing_page.py`.
- [ ] From `C:\dev\public\pubscan\quantalang`, run `git diff --check`.
- [ ] Serve `C:\dev\public\pubscan\quantalang\docs` locally with `python -m http.server 8766`.
- [ ] Use Browser/Playwright to inspect `http://127.0.0.1:8766/` at desktop and mobile widths.
- [ ] Confirm the copy reads as clear public explanation and the layout still matches the caliber of the existing public-facing sites.

## Task 7: Commit, Push, Sync, And Live-Check

**Steps:**
- [ ] In `C:\dev\public\portfolio-site`, run a staged secret-shape check before committing.
- [ ] Commit the portfolio and WARDEN changes as `site: clarify portfolio and WARDEN copy`.
- [ ] Push `main` to `origin`.
- [ ] Fast-forward duplicate public-site clones at `C:\dev\public\sitefix` and `C:\dev\public\pubscan\HarperZ9.github.io`.
- [ ] In `C:\dev\public\pubscan\quantalang`, run a staged secret-shape check before committing.
- [ ] Commit the QuantaLang splash changes as `docs: clarify quantalang public splash`.
- [ ] Push `main` to `origin`.
- [ ] Live-check `https://harperz9.github.io/`, `https://harperz9.github.io/warden.html`, and `https://harperz9.github.io/quantalang/` for expected phrases after GitHub Pages updates.

## Success Criteria

- [ ] Portfolio explains the full body of work plainly: what exists, how it is evaluated, and what evidence supports it.
- [ ] WARDEN opens with a concrete explanation before any thematic or brand language.
- [ ] QuantaLang explains the current compiler path, shader output, and research backends without implying all targets share the same maturity.
- [ ] Static tests enforce the public-facing copy contracts.
- [ ] Local browser verification confirms the pages remain polished and readable at desktop and mobile widths.
- [ ] Both GitHub Pages repositories are committed, pushed, and live-checked.
