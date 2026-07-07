Confirmed the defect: the shared nav `DEST` array (the actual top-nav rendered on every page) does NOT include a "Publications" entry. `publications.html` is mapped into the RESEARCH *section* for active-state highlighting, but there is no clickable nav link to reach it. The page is effectively orphaned — reachable only by typing the URL. This is a P2 (missing surfacing of shipped work) bordering on the whole point of the task (6 new papers need surfacing).

I now have everything needed. Let me compile the prioritized, sourced fix list.

I have completed the reconciliation. Here is the full analysis.

---

# Site Fact-Reconciliation: Prioritized Fix List

**Canonical site source:** `C:/dev/public/portfolio-site/` (git remote = `HarperZ9/HarperZ9.github.io`, branch `main`). The `C:/dev/public/pubscan/HarperZ9.github.io/` copy is a stale scan clone — do NOT edit it. `C:/dev/public/telos-v2/` is an unrelated Vite scaffold, not this site.

**Scope note:** The original claim inventory referenced `.html` filenames that all resolve inside `portfolio-site/`. All line numbers below are from that directory.

---

## P0 — False or misleading claims live on the site (brand-breaking)

### P0-1 · gather version is wrong everywhere (says 1.5.0, shipped is 1.6.0)
Ground truth: `gather-engine` **1.6.0** is the live PyPI release (published 2026-07-04, tag v1.6.0, pyproject 1.6.0). The site says 1.5.0 in 8 places. Every one is a stale "shipped" version number — exactly the defect the brand forbids.

| page | exact_text (find) | change to |
|---|---|---|
| `index.html:110` | `gather-engine 1.5.0 &middot; PyPI` | `gather-engine 1.6.0 &middot; PyPI` |
| `overview.html:211` | `PyPI <span translate="no">gather-engine</span> 1.5.0.` | `...gather-engine</span> 1.6.0.` |
| `catalog.html:83` | `on PyPI as <span translate="no">gather-engine</span> 1.5.0.` | `...gather-engine</span> 1.6.0.` |
| `catalog.html:116` | `PyPI <code translate="no">gather-engine</code> 1.5.0.` | `...gather-engine</code> 1.6.0.` |
| `gather.html:38` | `<span translate="no">gather</span> &middot; v1.5.0 &middot;` | `...gather</span> &middot; v1.6.0 &middot;` |
| `cv.html:64` | `<span translate="no">gather-engine</span> 1.5.0.` | `...gather-engine</span> 1.6.0.` |
| `cv.html:165` | `gather-engine</span> package metadata: 1.5.0.` | `...metadata: 1.6.0.` |
| `portfolio.html:54` | `PyPI <span translate="no">gather-engine</span> 1.5.0.` | `...gather-engine</span> 1.6.0.` |

Severity P0: false version on a shipped package.

### P0-2 · buildlang: `buildc 1.0.6 · crates.io` is doubly false
Ground truth: the crate is **`buildlang` 1.1.0** on crates.io. `buildc` is only the *binary name* inside that crate — **`crates.io/crates/buildc` does not exist (HTTP 404)**. So the landing chip both (a) states a version that was never the crate's version and (b) implies "buildc" is the crates.io package, which it is not.

- **`index.html:162`** — find `buildc 1.0.6 &middot; crates.io` → change to **`buildlang 1.1.0 &middot; crates.io`**. (P0: names a non-existent crate + wrong version, on the landing page.)
- **`buildlang.html:38`** (seal) — find `<span translate="no">buildc</span> 1.0.6 &middot; a Rust-built compiler, on crates.io` → the "on crates.io" applies to `buildlang`, not `buildc`. Change to reference `buildlang 1.1.0` as the crate, keeping `buildc` as the binary: e.g. `buildc &middot; buildlang 1.1.0 on crates.io &middot; effects and lifetimes, in the type`. (P0.)
- **`buildlang.html:54`** — find `<span translate="no">buildc</span> 1.0.5, release build` → the binary version string is a claim about the built binary; update to **1.1.0** to match the shipped crate (or soften to "the release binary"). (P1 — this is the binary version in an exhibit caption, less load-bearing than the crate identity.)
- **`buildlang.html:185`** — find `buildlang 1.0.0 is on crates.io` → **`buildlang 1.1.0 is on crates.io`**. (P1: stale crate version in prose.)
- **`cv.html:67` and `cv.html:89`** — find `v1.0.0` for buildlang / BuildLang-buildc → **v1.1.0**. (P1: stale version on the CV.)

### P0-3 · overview.html proof-surface count is stale and contradicts the site's own proof-surface page
Ground truth (from the actual `C:/dev/public/proof-surface` repo, HEAD 8757032): version **v0.2.0**, **652 test functions** across 79 test files, eleven proof-packet wedges. `proof-surface.html:39` already states this correctly. But `overview.html` still carries the old v0.1.0 figure of "258 tests," including a fabricated-looking terminal line `258 passed in 0.26s`.

| page | exact_text (find) | issue | change to |
|---|---|---|---|
| `overview.html:291` | `<em>258 tests, zero dependencies.</em>` | stale count | `<em>652 tests, zero dependencies.</em>` |
| `overview.html:416` | `<span class="ok">258 passed in 0.26s</span>` | asserted pytest output that no longer matches reality; the `0.26s` timing was never re-run | `652 passed` (drop the invented `in 0.26s` timing, or regenerate it from a real run — do not assert a timing you did not produce) |
| `overview.html:418` | `zero dependencies, 258 passing tests` | stale count | `...652 passing tests` |

Severity P0: the site contradicts itself (overview says 258, proof-surface page says 652) and presents an un-run timing as terminal output — the exact "trust me" pattern the brand rejects. **The `0.26s` is UNVERIFIABLE — do not restate it; either drop the timing or produce it from an actual `pytest` run.**

### P0-4 · toolkit.html still calls proof-surface v0.1.0
- **`toolkit.html:47`** — find `<b>proof-surface</b> <span class="built-stat">v0.1.0</span>` → **v0.2.0**. Also the surrounding description ("a checkpoint that says no… chains of who delegated what") describes the v0.1.0 core only; v0.2.0 adds the eleven wedges. Bump the version at minimum. (P0: stale shipped-version label; contradicts proof-surface.html.)

---

## P1 — Stale but not strictly false

### P1-1 · Elder ENB specific download figure has drifted
Ground truth (live NexusMods counter, mod 117327, as of 2026-07-07): **913,809 total / 155,581 unique**. These counters drift continuously.

- **`index.html:309`** — `900,000+ downloads` and `more than 150,000 unique downloaders` are TRUE (conservative floors) — **keep as-is**; the "+" phrasing is the correct way to state a drifting counter.
- **`resume.html:88`** — find `<b>900,000+ downloads</b> (908,206)` → the parenthetical **`(908,206)`** is a stale point-in-time exact number (live is now 913,809). Either update to `(913,809 as of 2026-07-07)` **with the date**, or delete the parenthetical and keep `900,000+`. Recommend deleting the exact number — a bare "+" floor doesn't rot. (P1: not false, just stale-precise.)
- `resume.html:45,52,183`, `resume.html` meta — `900,000+` / `past 900,000` are fine (floors). No change.

### P1-2 · "roughly 280 releases" / "about two years" — UNVERIFIABLE this session
Ground truth did NOT independently confirm the release count or the two-year maintenance window (NexusMods mod page returns 403; only the download/unique/views CSV was verifiable). These are plausible operator-supplied figures but were not verified.
- `index.html:309`, `resume.html:87` — "roughly 280 releases" / "about two years." **Recommendation: leave as-is if the operator has first-party records** (mod version history), since these are their own product. Do NOT harden into a precise claim. Flag as **UNVERIFIABLE by this session's sources** — mark for the operator to confirm against their NexusMods changelog before treating as ground truth.

### P1-3 · learn 1.6.0 is NOT published — site's 1.5.0 is correct, keep it
Ground truth: npm `@harperz9/learn` **latest = 1.5.0** (published 2026-07-01). Local `main` has 1.6.0 (FSRS merge) but it is **NOT published to npm**. Every site claim of **v1.5.0** (`index.html:175`, `learn.html:38`, `overview.html:235`, `catalog.html:99,120`) is **correct — do NOT change to 1.6.0.** This is the brand working as designed: the site states the *shipped* version, not the local WIP. **No edit. Listed here so no one "helpfully" bumps it to an unpublished number.**

---

## P2 — Missing new work that should be surfaced

### P2-1 · publications.html is ORPHANED — nothing links to it
The shared top-nav (`system/nav.js:3-11`, the `DEST` array rendered on every page) has entries Home / Guide / Flagships / Catalog / Research / Writing / About. There is **no "Publications" link**. `publications.html` is mapped into the RESEARCH section for active-state (`nav.js:20`) but is unreachable by clicking — only by typing the URL. The six-paper corpus (the session's headline new work) is effectively invisible.

**Fix (choose one):**
- Add `["Publications", "publications.html", "publications"]` to the `DEST` array in `system/nav.js` (surfaces it site-wide in one edit), **or**
- Add a prominent link to `publications.html` from `research.html` and `overview.html` (the research index and the flagship overview).

Recommend the nav entry — one edit, maximum reach. (P2, arguably the single most important gap given the task's explicit "surface the 6 new papers" directive.)

### P2-2 · publications.html understates the corpus: says "Five... DOIs, the sixth pending" — ground truth is SIX published
Ground truth (verified against Zenodo API with MD5 checks this session): **6 papers are published on Zenodo with DOIs**, including **The Personhood-Gate Handoff → 10.5281/zenodo.21234475**.

- **`publications.html:30`** — find `Five are archived on Zenodo with permanent DOIs, linked below; the sixth is held pending author review, and arXiv submission is in preparation.` → now stale. The sixth (Personhood-Gate) IS published. Change to: **`All six are archived on Zenodo with permanent DOIs, linked below; arXiv submission is in preparation (endorsement pending).`**
- **`publications.html:66`** (the Personhood-Gate row) — find `&middot; public release pending author review` (it has **no DOI link**) → add the DOI: `&middot; <a href="https://doi.org/10.5281/zenodo.21234475" translate="no">Zenodo&nbsp;DOI</a>`. Update the gloss's "public release pending" if the release is now done. (P2: a published paper shown as unpublished, missing its DOI — under-claiming, but still inaccurate.)

### P2-3 · Publications not surfaced on landing/overview/research bodies
Neither `index.html` nor `overview.html` nor `research.html` mentions the six-paper corpus in body copy or links to it. Given the brand ("authored, dated, citable, DOIs"), the DOI-backed papers are strong evidence and should appear. **Add** a short "Publications" reference block linking `publications.html` to at least `overview.html` (it already has a "Papers"-style tier with the two older DOIs at lines 358/364 — add the six-paper corpus there). (P2.)

---

## Verification results with NO defect (do not "fix" these)

- **arXiv claims — CLEAN.** Every arXiv mention on the site already uses correct language: `publications.html` says "arXiv submission is in preparation" and each paper row says "(endorsement pending)". `research-*.html` mentions of arXiv are about *source intake* (gather pulling arXiv metadata), not "our paper is on arXiv." **No false "on arXiv" claim exists.** The ground-truth warning (arXiv not posted, endorsement pending) is already reflected. No edit.
- **index-graph 2.8.0** — matches ground truth everywhere (`index.html:97`, `overview.html:199`, `catalog.html`, `index-graph.html:38,126,133`, etc.). No change.
- **forum 1.12.0** — matches ground truth everywhere. No change.
- **crucible-bench 1.1.0 release candidate** — matches ground truth; the site correctly calls it RC / "not claimed stable." No change.
- **emet v1.0 / four languages / 35/35** — matches ground truth (README: all four impls pass the 35 core conformance vectors in CI). The `35/35 vectors pass` per-impl lines in `emet.html:87-90` are consistent with the repo. `publications.html:46` says "44 conformance vectors" — also defensible (35 core + 5 receipt + 4 experimental rebind = the full defined set for the Python reference). These are different scopes, not a contradiction. No edit required; optionally add a one-word scope qualifier ("35 core / 44 total") for precision (P3).
- **telos v0.1.0 / "Live" / "first flagship"** — tag v0.1.0 exists and is pushed to `github.com/HarperZ9/telos` (`git ls-remote` confirms `refs/tags/v0.1.0`). package.json is 0.2.0 on main but 0.2.0 is **untagged/unreleased** (open ship-prep PR #18), so the site correctly advertises the *released* v0.1.0, not the WIP 0.2.0. "Live" (demonstrated in Studio) and "first flagship" are positioning, not release claims. No edit.

## Demos — REAL, not mocks (per the inventory's own assessment, confirmed by design)

The two interactive demos referenced live on `overview.html` (`#witness-demo` calling `Spine.witness()` via `crypto.subtle.digest("SHA-256")`, and `#gate-demo` calling `Spine.gate()`) are **real current capability**, not stale mocks. **No fix needed for the demo logic.** The only stale artifact in that neighborhood is the **static `258 passed in 0.26s` exhibit block** — that is not a live demo, it is asserted text, and it is covered by **P0-3** above (stale count + un-run timing).

---

## Items flagged UNVERIFIABLE (soften, do not restate as fact)

1. **`overview.html:416` `258 passed in 0.26s`** — the `0.26s` timing is UNVERIFIABLE (never re-run). Drop it or regenerate from a real run. (Covered in P0-3.)
2. **"roughly 280 releases" / "about two years"** (`index.html:309`, `resume.html:87`) — UNVERIFIABLE by this session's sources (NexusMods page 403'd). Operator's own product records may confirm; do not harden. (P1-2.)
3. **overview.html DOIs `10.5281/zenodo.20778927` and `10.5281/zenodo.20773724`** (Witnessing Spine, Conferred Existence) — these are the *older* works, NOT in this session's verified six-paper set. Their existence was not checked against Zenodo this session. **Not asserting they are wrong** — flag for a quick Zenodo resolve-check before the next publish, then treat as confirmed or correct. (P3.)
4. **orca / aleph / kun / behavior-transform "Public" chips** (`overview.html:249,255,261,267`) — ground truth confirms these repos exist locally; public-registry release state is moderate/unverified for orca and behavior-transform, and **kun has no version identifier at all** (UNVERIFIABLE). The chips say "Public" (repo visibility), not "released vX" — that is the safe framing and is defensible. **Do not add version numbers to these** (especially kun — there is no version to state). No edit; listed so no one adds an unverifiable version chip.

---

### Suggested edit order
1. **P0-1, P0-2, P0-3, P0-4** (false shipped versions + self-contradiction + un-run timing) — these are the brand-breaking defects.
2. **P2-1, P2-2** (orphaned publications page + six-vs-five DOIs) — surfacing the headline new work.
3. **P1-1** (drop the stale `(908,206)` exact figure).
4. **P2-3, P3 items** (polish).

All paths are absolute under `C:/dev/public/portfolio-site/`. The stale `pubscan/HarperZ9.github.io/` clone must not be touched.