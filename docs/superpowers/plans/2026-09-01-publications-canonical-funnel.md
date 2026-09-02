# Publications Canonical Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `HarperZ9/HarperZ9.github.io` the single deterministic publication source and deployment surface, publish two reviewed editorial works with accessible figures, and let the existing scheduled agents ship future material updates through guarded, receipt-backed releases.

**Architecture:** Standard-library Python validates public-ready JSON records and renders complete static HTML, semantic figures, index blocks, feeds, sitemap routes, and deterministic build receipts. Private scheduled-task artifacts enter a complete hash inventory before reviewed records cross into the public repository. The Pages repository owns publication truth, the GitHub profile consumes verified Pages links, and `telos-v2` remains reference-only.

**Tech Stack:** Python 3.12 standard library, pytest 8.4.2, static HTML/CSS/SVG, Node 24 link checks, GitHub Actions, GitHub Pages, Codex recurring automations, and local browser accessibility checks.

**Spec:** `docs/superpowers/specs/2026-09-01-publications-canonical-funnel-design.md`

## Global Constraints

- `HarperZ9/HarperZ9.github.io` is the only canonical public site, publication source, build, deployment, and live-receipt repository.
- `HarperZ9/HarperZ9` is a derivative profile index. It may link to verified live Pages routes but must not own publication bodies, edition state, feeds, source ledgers, renderers, or deployment logic.
- `HarperZ9/telos-v2` is reference-only. Do not edit, merge, deploy, or restore it as a release dependency.
- Keep the dirty primary Pages, Telos V2, project-docs, and Canon trees read-only. Work only in ownership-verified isolated worktrees.
- Flywheel remains the sole primary technical flagship. Editorial works must not become product advertisements.
- Complete article text, source links, figure values, and limitations must be available without JavaScript.
- Use concrete nouns and active verbs, define specialized terms, keep evidence and limitations adjacent, and use no em dash.
- Every figure records scope, units, denominator, date, provenance, transformation, uncertainty, limitation, `doesNotProve`, and a semantic fallback.
- Identical records must produce byte-identical outputs. Receipts derive their time fields from record dates, never the wall clock.
- No material delta means no commit, pull request, deployment, profile change, social draft, or no-change log.
- Never publish private correspondence, health records, browsing or social-account history, credentials, protected session capsules, controlled security material, or unadopted personal claims.
- Frontier Safety retains sole ownership of its source scan, dated digest, corrections, and the canonical August 26 incident dossier.
- Website publication is authorized per refresh only after the exact nonduplicate packet passes source, claim, privacy, review, test, collision, current-main, deployment, and live-parity gates.
- Social posting remains outside this plan. A prepared social derivative is not a published post without an exact first-party receipt.

## File and Interface Map

### Pages repository

- `publications/schema/publication-record.schema.json`: public schema documentation for one publication record.
- `publications/data/records/*.json`: reviewed public-ready records only.
- `publications/data/index.json`: deterministic public route, category, hash, and idempotency index.
- `publications/build.json`: deterministic input/output hash receipt.
- `tools/publication_model.py`: canonical serialization, validation, hashing, and idempotency interfaces.
- `tools/build_publications.py`: transactional renderer for articles, figures, index blocks, feeds, sitemap, and receipts.
- `tools/render_legacy_essays.py`: one-time and repeatable static renderer for the five JavaScript-dependent legacy pages.
- `tools/build_publication_inventory.py`: safe metadata-only inventory builder whose output must remain outside the public repository.
- `system/publication-article.css`: shared accessible article and figure presentation.
- `tests/test_publication_authority.py`: repository ownership and stale-canon regression checks.
- `tests/test_publication_model.py`: schema, claim, source, figure, hash, route, and idempotency contracts.
- `tests/fixtures/publication-record.json`: complete valid record shared by renderer and validator tests.
- `tests/test_publication_builder.py`: transactional, deterministic, generated-index, feed, sitemap, and receipt contracts.
- `tests/test_publication_nojs.py`: complete initial-HTML body and semantic-figure contracts.
- `tests/test_publication_inventory.py`: complete hash inventory and public-output refusal contracts.

### GitHub profile repository

- `AGENTS.md`: derivative-consumer boundary.
- `README.md`: one stable Publications link, without copied article bodies or a competing current-edition claim.
- `scripts/check_profile_surface.py`: prohibited publication-state and canonical-link checks.

### Private automation state

- `publication-inventory.json`: complete artifact inventory with hashes, source automation, observed date, sensitivity class, editorial state, and hold reason. This file stays outside every public repository.
- Existing automation prompts: guarded publication authority and repository ownership. Update through the Codex automation API, preserving schedule, status, project, model, and reasoning settings.

---

### Task 1: Lock the repository authority contract

**Files:**
- Modify: `README.md` under `## Deployment source`
- Modify: `AGENTS.md` under `## Product Boundary`
- Create: `tests/test_publication_authority.py`

**Interfaces:**
- Consumes: approved repository authority in the design spec.
- Produces: `PAGES_REPO`, `PROFILE_REPO`, and `REFERENCE_REPO` constants used by later authority checks.

- [ ] **Step 1: Write the failing authority tests**

```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES_REPO = "HarperZ9/HarperZ9.github.io"
PROFILE_REPO = "HarperZ9/HarperZ9"
REFERENCE_REPO = "HarperZ9/telos-v2"


def test_pages_readme_names_the_operational_canon() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert f"`{PAGES_REPO}` is the canonical source and deployment repository" in readme
    assert f"`{PROFILE_REPO}` is a derivative GitHub profile index" in readme
    assert f"`{REFERENCE_REPO}` is reference-only" in readme
    assert "telos-v2) is the canonical" not in readme


def test_pages_agent_boundary_forbids_split_publication_state() -> None:
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    for term in ("publication bodies", "edition state", "feeds", "source ledgers", "deployment logic"):
        assert term in agents
    assert "profile repository" in agents.lower()
```

- [ ] **Step 2: Run the tests and verify the stale README fails**

Run: `python -m pytest tests/test_publication_authority.py -q`

Expected: FAIL because `README.md` still calls `telos-v2` canonical and the agent boundary does not yet name the profile consumer rule.

- [ ] **Step 3: Correct the authority prose**

Replace the README deployment section with this exact substance:

```markdown
## Deployment source

`HarperZ9/HarperZ9.github.io` is the canonical source and deployment repository
for the website and publications funnel. GitHub Pages deploys `main` from `/`.
`HarperZ9/HarperZ9` is a derivative GitHub profile index that links to verified
live routes. `HarperZ9/telos-v2` is reference-only; code may be ported from it
after verification, but it cannot overwrite or define the live site.
```

Add the same ownership boundary to `AGENTS.md`, including the explicit list of state that the profile must not own.

- [ ] **Step 4: Run the authority test and repository hygiene check**

Run: `python -m pytest tests/test_publication_authority.py -q`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Commit the authority correction**

```bash
git add README.md AGENTS.md tests/test_publication_authority.py
git commit -m "docs: lock publication repository authority"
```

### Task 2: Pre-render every legacy JavaScript-dependent article

**Files:**
- Create: `tools/render_legacy_essays.py`
- Create: `tests/test_publication_nojs.py`
- Modify generated bodies in: `models-propose-oracles-dispose.html`
- Modify generated bodies in: `frontier-safety-openai-hugging-face-incident.html`
- Modify generated bodies in: `no-receipt-no-accept.html`
- Modify generated bodies in: `pick-the-lock-for-everyone.html`
- Modify generated bodies in: `pick-the-lock-for-everyone-talk.html`
- Retain as optional enhancement only: `system/essay-loader.js`

**Interfaces:**
- Consumes: existing Markdown part lists and the `essay` or `talk` rendering mode.
- Produces: `render_markdown(source: str, mode: str) -> str`, `render_page(page: Path, parts: tuple[Path, ...], mode: str) -> bytes`, and `build(root: Path) -> dict[str, str]`.

- [ ] **Step 1: Add failing initial-HTML tests for all five pages**

```python
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "models-propose-oracles-dispose.html": "Models propose",
    "frontier-safety-openai-hugging-face-incident.html": "Hugging Face",
    "no-receipt-no-accept.html": "No Receipt",
    "pick-the-lock-for-everyone.html": "Pick the Lock",
    "pick-the-lock-for-everyone-talk.html": "Help is not surrender",
}


def article_text(page: str) -> str:
    html = (ROOT / page).read_text(encoding="utf-8")
    body = html.split('class="article-body"', 1)[1].split("</div>", 1)[0]
    return " ".join(re.sub(r"<[^>]+>", " ", body).split())


def test_legacy_articles_ship_complete_initial_html() -> None:
    for page, marker in PAGES.items():
        html = (ROOT / page).read_text(encoding="utf-8")
        assert marker in article_text(page), page
        assert "Loading the plain-text" not in html
        assert "needs JavaScript to typeset" not in html
        assert "data-markdown-parts" not in html
```

- [ ] **Step 2: Run the no-JavaScript test and confirm the loader shells fail**

Run: `python -m pytest tests/test_publication_nojs.py -q`

Expected: FAIL on all five pages because the initial body contains only a loading paragraph.

- [ ] **Step 3: Implement the minimal deterministic legacy renderer**

Use an explicit immutable page map so the script cannot discover or overwrite arbitrary HTML:

```python
ESSAYS = {
    "models-propose-oracles-dispose.html": ("essay", tuple(Path("writing/models-propose-oracles-dispose") / f"{i:02}.md" for i in range(1, 5))),
    "frontier-safety-openai-hugging-face-incident.html": ("essay", tuple(Path("writing/frontier-safety-openai-hugging-face-incident") / f"{i:02}.md" for i in range(1, 4))),
    "no-receipt-no-accept.html": ("essay", tuple(Path("writing/no-receipt-no-accept") / f"{i:02}.md" for i in range(1, 10))),
    "pick-the-lock-for-everyone.html": ("essay", tuple(Path("writing/pick-the-lock-for-everyone-v3") / f"{i:02}.md" for i in range(1, 14))),
    "pick-the-lock-for-everyone-talk.html": ("talk", (
        Path("writing/pick-the-lock-for-everyone-talk/01.md"),
        Path("writing/pick-the-lock-for-everyone-talk/02.md"),
        Path("writing/pick-the-lock-for-everyone-talk/02b.md"),
        Path("writing/pick-the-lock-for-everyone-talk/02c.md"),
        Path("writing/pick-the-lock-for-everyone-talk/02d.md"),
        Path("writing/pick-the-lock-for-everyone-talk/02e.md"),
        Path("writing/pick-the-lock-for-everyone-talk/03.md"),
    )),
}
```

Port the existing loader's escaping, inline links, emphasis, headings, lists, blockquotes, rules, and talk cues. Replace only the existing `article-body` node, remove its loading/live-fetch attributes, remove the obsolete `noscript` warning, and leave source links and the visual coda intact.

- [ ] **Step 4: Generate twice and verify byte identity**

Run `python tools/render_legacy_essays.py`, capture `Get-FileHash -Algorithm SHA256` for the five explicit output pages, run the renderer again, capture the same hashes, and require `Compare-Object` to return no rows.

Expected: both SHA-256 sets are identical.

- [ ] **Step 5: Run focused legacy and publication tests**

Run:

```powershell
python -m pytest -q `
  tests/test_publication_nojs.py `
  tests/test_pick_the_lock_for_everyone.py `
  tests/test_no_receipt_no_accept.py `
  tests/test_publications_funnel.py
```

Expected: PASS, including the existing voice, coda, and source-part contracts.

- [ ] **Step 6: Commit the no-JavaScript repair**

```bash
git add tools/render_legacy_essays.py tests/test_publication_nojs.py system/essay-loader.js models-propose-oracles-dispose.html frontier-safety-openai-hugging-face-incident.html no-receipt-no-accept.html pick-the-lock-for-everyone.html pick-the-lock-for-everyone-talk.html
git commit -m "fix: render complete publication bodies without javascript"
```

Do not stage `system/essay-loader.js` if no source change was needed.

### Task 3: Define the public-ready publication record

**Files:**
- Create: `publications/schema/publication-record.schema.json`
- Create: `tools/publication_model.py`
- Create: `tests/test_publication_model.py`
- Create: `tests/fixtures/publication-record.json`

**Interfaces:**
- Produces: `PublicationError`, `canonical_json_bytes(value)`, `record_sha256(record)`, `idempotency_key(record)`, `load_record(path)`, and `validate_record(record)`.
- Consumed by: Tasks 4, 6, 7, and 8.

- [ ] **Step 1: Write failing validator and determinism tests**

```python
import copy
import json
from pathlib import Path

import pytest

from tools.publication_model import PublicationError, record_sha256, validate_record

FIXTURE = Path(__file__).parent / "fixtures" / "publication-record.json"


def valid_record() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))
```

Write this complete object to `tests/fixtures/publication-record.json`:

```json
{
        "schema_version": 1,
        "id": "example-work",
        "route": "example-work.html",
        "category": "tools-systems",
        "form": "essay",
        "title": "Example work",
        "summary": "A bounded example.",
        "author": "Zain Dana Harper",
        "published_at": "2026-09-01",
        "updated_at": "2026-09-01",
        "observed_at": "2026-09-01T17:00:00Z",
        "thesis": "A concrete finding with a visible limit.",
        "opening": {
            "question": "What was measured?",
            "finding": "One bounded result was observed.",
            "evidence": "The primary source reports the result.",
            "limit": "One observation cannot establish a trend."
        },
        "sections": [{"id": "finding", "heading": "Finding", "paragraphs": ["Evidence and limit."]}],
        "sources": [{"id": "S1", "publisher": "Example", "title": "Primary source", "url": "https://example.org/source", "role": "primary research", "published_at": "2026-08-01", "observed_at": "2026-09-01"}],
        "claims": [{"id": "C1", "text": "The bounded claim.", "status": "verified", "source_ids": ["S1"], "scope": "Example scope", "uncertainty": "One source", "doesNotProve": "General validity"}],
        "figures": [{"id": "example-figure", "title": "Example figure", "claim": "One measured value", "type": "bar", "columns": ["Measure", "Value"], "rows": [["Observed", "1"]], "scope": "One observation", "units": "count", "denominator": "one source", "date": "2026-09-01", "provenance": ["S1"], "transformation": "none", "uncertainty": "single observation", "limitations": "not comparative", "doesNotProve": "a trend", "alt": "One observed value of one."}],
        "corrections": [],
        "ai_assistance": "AI assisted with research organization, drafting, and verification. Zain Dana Harper reviewed and accepts responsibility for the published work."
}
```

Then add these tests:


```python
def test_record_requires_claim_boundaries_and_source_references() -> None:
    record = valid_record()
    record["claims"][0]["source_ids"] = ["missing"]
    with pytest.raises(PublicationError, match="unknown source"):
        validate_record(record)


def test_record_hash_ignores_key_order_but_not_claim_text() -> None:
    first = valid_record()
    reordered = dict(reversed(list(copy.deepcopy(first).items())))
    assert record_sha256(first) == record_sha256(reordered)
    reordered["claims"][0]["text"] = "A different claim."
    assert record_sha256(first) != record_sha256(reordered)
```

- [ ] **Step 2: Run the model tests and verify imports fail**

Run: `python -m pytest tests/test_publication_model.py -q`

Expected: FAIL because `tools.publication_model` does not exist.

- [ ] **Step 3: Write the schema and standard-library validator**

The schema must require every field shown in `valid_record()`, reject additional top-level fields, limit `route` to a basename ending in `.html`, require the four opening fields in question/finding/evidence/limit order, require unique IDs, require HTTPS sources, reject private/local path shapes, and restrict claim status to `verified`, `inferred`, `unknown`, or `correction`.

Use canonical serialization exactly:

```python
def canonical_json_bytes(value: dict | list) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def record_sha256(record: dict) -> str:
    return hashlib.sha256(canonical_json_bytes(record)).hexdigest()


def idempotency_key(record: dict) -> str:
    material = f"editorial-atlas\n{record['observed_at']}\n{record['route']}\n{record_sha256(record)}\n"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()
```

- [ ] **Step 4: Add negative controls**

Tests must reject duplicate source, claim, section, and figure IDs; an unreferenced claim; missing `doesNotProve`; an absent or reordered opening field; an `http://` source; a route containing `/` or `..`; an em dash in public prose; local paths; credential shapes; opaque ChatGPT citation markers; internal workflow vocabulary in reader-facing fields; an empty figure denominator; a personal first-person claim without `personal_voice_adopted: true`; and any social state marked `published` without URL and timestamp.

- [ ] **Step 5: Run focused tests and commit**

Run: `python -m pytest tests/test_publication_model.py -q`

Expected: PASS.

```bash
git add publications/schema/publication-record.schema.json tools/publication_model.py tests/test_publication_model.py tests/fixtures/publication-record.json
git commit -m "feat: define public-ready publication records"
```

### Task 4: Build the deterministic transactional renderer

**Files:**
- Create: `tools/build_publications.py`
- Create: `system/publication-article.css`
- Create: `tests/test_publication_builder.py`
- Modify: `publications.html` to add generated-entry markers
- Modify: `writing.html` to add generated-essay markers
- Modify: `sitemap.xml` to add generated-publication markers
- Generate: `publications/data/index.json`
- Generate: `publications/build.json`
- Generate: `feed.xml`
- Generate: `feed.json`

**Interfaces:**
- Consumes: `load_record`, `validate_record`, `record_sha256`, and `idempotency_key` from Task 3.
- Produces: `replace_marker_block(text, name, rendered)`, `load_existing_briefings(root)`, `render_article(record)`, `render_figure_svg(figure)`, `render_figure_html(figure)`, `planned_outputs(records, root)`, and `build(record_paths, output_root) -> dict`.

- [ ] **Step 1: Add failing renderer tests using a temporary site root**

```python
import json
from pathlib import Path

import pytest

from tools.build_publications import build
from tools.publication_model import PublicationError

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "publication-record.json"


def fixture_site(tmp_path: Path) -> Path:
    root = tmp_path / "site"
    (root / "publications/data/records").mkdir(parents=True)
    (root / "briefings").mkdir()
    for name, marker in (
        ("publications.html", "GENERATED EDITORIAL PUBLICATIONS"),
        ("writing.html", "GENERATED EDITORIAL ESSAYS"),
        ("sitemap.xml", "GENERATED EDITORIAL ROUTES"),
    ):
        (root / name).write_text(
            f"<!-- BEGIN {marker} -->\n<!-- END {marker} -->\n",
            encoding="utf-8",
        )
    record_path = root / "publications/data/records/example-work.json"
    record_path.write_bytes(FIXTURE.read_bytes())
    return root


def snapshot(root: Path) -> dict[str, bytes]:
    return {
        str(path.relative_to(root)).replace("\\", "/"): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def write_record(root: Path, name: str, record: dict) -> Path:
    path = root / "publications/data/records" / name
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def load_fixture() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_build_is_transactional_and_deterministic(tmp_path: Path) -> None:
    root = fixture_site(tmp_path)
    first = build([root / "publications/data/records/example-work.json"], root)
    first_bytes = {path: (root / path).read_bytes() for path in first["outputs"]}
    second = build([root / "publications/data/records/example-work.json"], root)
    assert first == second
    assert first_bytes == {path: (root / path).read_bytes() for path in second["outputs"]}


def test_duplicate_route_leaves_site_unchanged(tmp_path: Path) -> None:
    root = fixture_site(tmp_path)
    before = snapshot(root)
    duplicate = load_fixture()
    duplicate["id"] = "another-id"
    write_record(root, "duplicate.json", duplicate)
    with pytest.raises(PublicationError, match="duplicate route"):
        build(sorted((root / "publications/data/records").glob("*.json")), root)
    assert snapshot(root) == before
```

- [ ] **Step 2: Run and confirm the builder import fails**

Run: `python -m pytest tests/test_publication_builder.py -q`

Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement complete static rendering**

The article output must contain, in initial HTML: title, thesis, all sections, source register, claim ledger, correction history, AI disclosure, and every figure's semantic table. JavaScript may enhance navigation but cannot create the body.

Render the opening as four short labeled paragraphs in the exact order Question, Finding, Evidence, Limit. `system/publication-article.css` must load Hanken Grotesk for reading roles and Conso for data/utility roles, retain visible focus and AA contrast, reflow at 320 CSS pixels and 400 percent zoom, and include reduced-motion, forced-colors, text-spacing-safe, and print rules.

The renderer must generate these marker blocks:

```html
<!-- BEGIN GENERATED EDITORIAL PUBLICATIONS -->
<!-- END GENERATED EDITORIAL PUBLICATIONS -->
```

in `publications.html`, and:

```html
<!-- BEGIN GENERATED EDITORIAL ESSAYS -->
<!-- END GENERATED EDITORIAL ESSAYS -->
```

in `writing.html`, plus matching generated-publication route markers in `sitemap.xml`.

- [ ] **Step 4: Implement semantic figures from one data record**

For each figure, generate:

- `figures/<figure-id>.svg` with `<title>`, `<desc>`, direct labels, and no script;
- `figures/<figure-id>.json` with the exact source data and boundary fields;
- `figures/<figure-id>.html` with the canonical semantic table and source links;
- the same semantic table adjacent to the SVG in the article.

The SVG and table must derive from the same `rows` array. A test must compare every row label and value across JSON, SVG text, standalone HTML, and article HTML.

- [ ] **Step 5: Implement deterministic indexes, feeds, sitemap, and receipt**

`publications/data/index.json` contains sorted records with `id`, `route`, `category`, `form`, dates, record SHA-256, and idempotency key. `publications/build.json` contains sorted input hashes and hashes of every generated output except the receipt itself. Its `built_at` value equals the lexicographically latest `updated_at` date plus `T00:00:00Z`. Git and the external release receipt bind `publications/build.json` itself.

`load_existing_briefings(root)` reads the existing canonical briefing publication records and returns their title, route, summary, published date, and updated date without rewriting their bodies. Atom and JSON Feed entries include all generated editorial works and those canonical briefing records. Sort by `updated_at`, then route. The sitemap route set is unique.

- [ ] **Step 6: Implement atomic publication**

Render and validate every byte in a temporary directory under the output root. Check collisions against existing routes and the prior public index. Replace destination files only after all validation succeeds. If any write fails, restore the pre-build bytes and raise `PublicationError`.

- [ ] **Step 7: Run builder, publication-funnel, and link tests**

Run:

```powershell
python -m pytest -q tests/test_publication_model.py tests/test_publication_builder.py tests/test_publications_funnel.py
node tests/linkcheck.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit the renderer foundation**

```bash
git add tools/build_publications.py system/publication-article.css tests/test_publication_builder.py publications.html writing.html sitemap.xml publications/data/index.json publications/build.json feed.xml feed.json
git commit -m "feat: add deterministic publication renderer"
```

### Task 5: Inventory the full scheduled-task corpus without publishing it

**Files:**
- Create: `tools/build_publication_inventory.py`
- Create: `tests/test_publication_inventory.py`
- Create outside all public repositories: private `publication-inventory.json`

**Interfaces:**
- Produces: `inventory_file(path: Path, root: Path, automation_id: str) -> dict`, `build_inventory(roots: dict[str, Path], output_path: Path, public_roots: list[Path]) -> dict`, and `assert_private_output(output_path: Path, public_roots: list[Path]) -> None`.
- Consumed by: both recurring automations and the release review in Task 9.

- [ ] **Step 1: Add failing completeness and safety tests**

```python
from pathlib import Path

import pytest

from tools.build_publication_inventory import build_inventory


def make_fixture_files(root: Path, names: list[str]) -> None:
    root.mkdir(parents=True)
    for index, name in enumerate(names):
        (root / name).write_text(f"fixture-{index}\n", encoding="utf-8")


def test_inventory_accounts_for_every_input_file(tmp_path: Path) -> None:
    first = tmp_path / "first"
    second = tmp_path / "second"
    make_fixture_files(first, ["packet.md", "receipt.md", "source.json"])
    make_fixture_files(second, ["automation.toml", "memory.md"])
    output = tmp_path / "private" / "publication-inventory.json"
    result = build_inventory({"editorial": first, "frontier": second}, output, public_roots=[])
    assert result["summary"]["file_count"] == 5
    assert {item["relative_path"] for item in result["artifacts"]} == {
        "packet.md", "receipt.md", "source.json", "automation.toml", "memory.md"
    }


def test_inventory_refuses_public_output(tmp_path: Path) -> None:
    public = tmp_path / "public-site"
    public.mkdir()
    with pytest.raises(ValueError, match="outside public repositories"):
        build_inventory({"editorial": tmp_path / "input"}, public / "inventory.json", [public])
```

- [ ] **Step 2: Implement a metadata-only inventory**

Each artifact record contains only `automation_id`, `relative_path`, `sha256`, byte length, last-write time, suffix, classification, editorial state, public readiness, and hold reason. It must not copy file bodies, extract private names, or include absolute paths.

Classification rules are explicit: automation configuration and memory are `private-control`; receipts and maps are `private-evidence`; source checks and research notes are `review-required`; reviewed editorial packets are `candidate`; generated public-site mirrors are `duplicate-reference`. Unknown files default to `private-hold`.

- [ ] **Step 3: Run the inventory twice against both complete automation directories**

Use the two existing automation IDs as root labels. Write the inventory only into automation-owned private state. Compare the inventory's file count with an independent recursive file count, and run twice to confirm identical content hashes when inputs do not change.

Expected: every file under both automation roots is represented exactly once, with no absolute path in the JSON.

- [ ] **Step 4: Run tests and commit only the reusable safe tool**

Run: `python -m pytest tests/test_publication_inventory.py -q`

Expected: PASS.

```bash
git add tools/build_publication_inventory.py tests/test_publication_inventory.py
git commit -m "feat: inventory private publication research safely"
```

Do not stage the generated private inventory.

### Task 6: Publish “The Second Hearing” from its reviewed packet

**Files:**
- Create: `publications/data/records/the-second-hearing.json`
- Generate: `the-second-hearing.html`
- Generate: `figures/the-second-hearing-evidence-map.svg`
- Generate: `figures/the-second-hearing-evidence-map.json`
- Generate: `figures/the-second-hearing-evidence-map.html`
- Modify generated blocks in: `publications.html`, `writing.html`, `feed.xml`, `feed.json`, and `sitemap.xml`
- Modify generated receipts: `publications/data/index.json` and `publications/build.json`
- Create: `tests/test_the_second_hearing.py`

**Interfaces:**
- Consumes: reviewed packet SHA-256 `5000a4a067a74b04f3f24046f596dfaee8ea52492bf3c10d45bf34a4b87df773` and the record/renderer interfaces from Tasks 3 and 4.
- Produces: route ID `the-second-hearing`, route `the-second-hearing.html`, category `music-listening`, and figure ID `the-second-hearing-evidence-map`.

- [ ] **Step 1: Re-hash the packet and recheck time-sensitive source metadata**

Expected packet SHA-256: `5000a4a067a74b04f3f24046f596dfaee8ea52492bf3c10d45bf34a4b87df773`.

Recheck the seven DOI or official repository records named S1 through S7. Record any changed publication metadata in the public record; do not change a scientific claim from an abstract or search snippet.

- [ ] **Step 2: Write failing article-specific tests**

```python
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_json(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def figure_record(record_name: str, figure_id: str) -> dict:
    record = read_json(f"publications/data/records/{record_name}")
    return next(item for item in record["figures"] if item["id"] == figure_id)


def test_second_hearing_keeps_distinct_constructs_and_limits() -> None:
    record = read_json("publications/data/records/the-second-hearing.json")
    assert record["route"] == "the-second-hearing.html"
    assert {source["id"] for source in record["sources"]} == {f"S{i}" for i in range(1, 8)}
    assert {claim["id"] for claim in record["claims"]} == {f"C{i}" for i in range(1, 9)}
    text = json.dumps(record, ensure_ascii=False)
    for term in ("piece familiarity", "style familiarity", "within-piece repetition", "across-hearing repetition"):
        assert term in text
    assert "replay count" in text.lower()
    assert "universal exposure curve" in text.lower()


def test_second_hearing_figure_refuses_cross-study_magnitude_comparison() -> None:
    figure = figure_record("the-second-hearing.json", "the-second-hearing-evidence-map")
    assert len(figure["rows"]) == 4
    assert {row[0] for row in figure["rows"]} == {"S2", "S4", "S5", "S6"}
    assert "not a meta-analysis" in figure["limitations"].lower()
    assert "not comparable" in figure["limitations"].lower()
```

- [ ] **Step 3: Draft the complete source-grounded record**

Use these nine section IDs and headings: `second-hearing`, `four-familiarities`, `liking-trajectories`, `attention-is-not-liking`, `memory-without-preference`, `listener-in-measurement`, `replay-count-limits`, `listening-card`, and `honest-measurement`.

Use no personal anecdote. Label the four-note listening card as an editorial exercise, not a tested intervention. Keep liking, recognition, attention, memory interference, and perceived unpredictability distinct.

- [ ] **Step 4: Encode the four-panel evidence map**

Use four rows for S2, S4, S5, and S6. Preserve each study's denominator, exposure schedule, outcome unit, transformation, and non-proof. Do not normalize results, estimate unpublished means, or place the perceptual-path model on an exposure-response axis.

- [ ] **Step 5: Render twice, inspect the diff, and run focused tests**

Run:

```powershell
python tools/build_publications.py --records-dir publications/data/records
python -m pytest -q tests/test_the_second_hearing.py tests/test_publication_model.py tests/test_publication_builder.py tests/test_publication_nojs.py tests/test_publications_funnel.py
node tests/linkcheck.mjs
```

Run the renderer a second time and require `git diff` to remain unchanged.

- [ ] **Step 6: Commit the first editorial work**

```bash
git add publications/data/records/the-second-hearing.json the-second-hearing.html figures/the-second-hearing-evidence-map.* publications.html writing.html feed.xml feed.json sitemap.xml publications/data/index.json publications/build.json tests/test_the_second_hearing.py
git commit -m "content: publish the second hearing"
```

### Task 7: Publish “Availability Is Not Reach” from its reviewed packet

**Files:**
- Create: `publications/data/records/availability-is-not-reach.json`
- Generate: `availability-is-not-reach.html`
- Generate: `figures/availability-is-not-reach.svg`
- Generate: `figures/availability-is-not-reach.json`
- Generate: `figures/availability-is-not-reach.html`
- Modify generated blocks and receipts from Task 6
- Create: `tests/test_availability_is_not_reach.py`

**Interfaces:**
- Consumes: reviewed packet SHA-256 `3FF9F84962225A78573D907538FBF0D5FA5A685E157A7982172867317B0E2ED3` and Tasks 3 and 4.
- Produces: route ID `availability-is-not-reach`, route `availability-is-not-reach.html`, category `education-access`, and figure ID `availability-is-not-reach`.

- [ ] **Step 1: Re-hash the packet and refresh S1, S4, and S6**

Expected packet SHA-256: `3FF9F84962225A78573D907538FBF0D5FA5A685E157A7982172867317B0E2ED3`.

Recheck the NCES results/workbook, the 2026 scale-focused meta-analysis, and the Department of Education liquidation-extension page on publication day. Preserve the workbook SHA-256 `E010E660A1EE8D2D5C6E0E42889300136AFC670E4208101196D4380C1E88B865` in the private receipt, not as a replacement public citation.

- [ ] **Step 2: Write failing denominator and claim-boundary tests**

```python
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_json(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def test_availability_and_reach_are_not_rendered_as_a_funnel() -> None:
    record = read_json("publications/data/records/availability-is-not-reach.json")
    figure = next(item for item in record["figures"] if item["id"] == "availability-is-not-reach")
    assert figure["type"] == "separate-panels"
    assert [row[1] for row in figure["rows"]] == ["85%", "42%", "8%", "25%"]
    assert "June 2025" in json.dumps(figure)
    assert "October 2024" in json.dumps(figure)
    assert "not a sequential funnel" in figure["doesNotProve"]


def test_scale_estimates_keep_their_analysis_conditions() -> None:
    text = json.dumps(read_json("publications/data/records/availability-is-not-reach.json"), ensure_ascii=False)
    for value in ("0.288", "0.40", "0.22", "0.16"):
        assert value in text
    assert "wide prediction intervals" in text
    assert "fixed penalty" in text
```

- [ ] **Step 3: Draft the complete public-interest record**

Use these nine section IDs and headings: `ordinary-budgets`, `what-works-means`, `scale-changes-claim`, `availability-is-not-reach`, `measure-delivery`, `preserve-denominator`, `independent-outcome`, `funding-boundary`, and `public-claim`.

Use no first-person anecdote, named district, vendor judgment, local budget claim, clinical claim, or product call to action. Label the proposed receipt fields as an editorial accountability design, not a federal standard.

- [ ] **Step 4: Encode two separate figure panels**

Panel A contains June 2025 school-level availability: 85 percent any tutoring and 42 percent high-dosage tutoring. Panel B contains October 2024 student reach: 8 percent across all public schools and 25 percent within offering schools. Keep the two months and denominators inside each panel. Draw no arrows and no funnel.

- [ ] **Step 5: Render twice and run focused tests**

Run:

```powershell
python tools/build_publications.py --records-dir publications/data/records
python -m pytest -q tests/test_availability_is_not_reach.py tests/test_publication_model.py tests/test_publication_builder.py tests/test_publication_nojs.py tests/test_publications_funnel.py
node tests/linkcheck.mjs
```

Expected: PASS and no second-render diff.

- [ ] **Step 6: Commit the education article**

```bash
git add publications/data/records/availability-is-not-reach.json availability-is-not-reach.html figures/availability-is-not-reach.* publications.html writing.html feed.xml feed.json sitemap.xml publications/data/index.json publications/build.json tests/test_availability_is_not_reach.py
git commit -m "content: publish availability is not reach"
```

### Task 8: Give both scheduled agents the guarded per-refresh contract

**Files:**
- Modify through Codex automation API: `daily-editorial-research-atlas`
- Modify through Codex automation API: `frontier-safety-daily-publication`
- Modify: `docs/frontier-safety-operations.md`
- Create: `docs/publications-operations.md`

**Interfaces:**
- Consumes: public record hash, idempotency key, private inventory, current Git ownership, CI, Pages, and live-byte receipts.
- Produces: exact automation views after update and operator-facing release/recovery procedures.

- [ ] **Step 1: View both automations and preserve all non-prompt fields**

Use the Codex automation API in `view` mode for each exact ID. Record name, kind, status, destination/project, model, reasoning effort, and schedule internally. Do not create replacement automations.

- [ ] **Step 2: Add the exact editorial release authority**

Append this operational substance to the editorial prompt:

```text
HarperZ9/HarperZ9.github.io is the only canonical public site and publication repository. HarperZ9/HarperZ9 is a derivative profile index, and HarperZ9/telos-v2 is reference-only. Maintain a complete private publication-inventory.json, but copy only reviewed public-ready records into Pages. Zain authorizes each refresh to prepare, commit, push, open one pull request, merge, deploy, and live-verify one material nonduplicate website publication without another action-time approval when every source, claim, privacy, personal-voice, accessibility, deterministic-build, independent-review, collision, current-main, CI, Pages, and live-parity gate passes. Derive one idempotency key from the automation ID, observation boundary, route, and public-ready record hash. No material delta means no commit, pull request, deploy, profile change, or no-change log. Update the GitHub profile only after a Pages live receipt and only when its stable routing materially changes. Never publish or amend Frontier Safety content from this automation.
```

- [ ] **Step 3: Add the same canonical-repository and receipt rules to Frontier**

Keep Frontier's separate source ownership, one-edition-per-day limit, canonical August 26 dossier, and social confirmation boundary. Replace any ambiguous checkout language with the Pages-only authority. Allow the existing automation to merge and deploy a material reviewed web edition without another approval, but require current-main, independent review, green CI, Pages receipt, live hash, and no duplicate idempotency key.

- [ ] **Step 4: View both automations again and compare preserved fields**

Expected: the prompt and update timestamp change; schedule, status, project, model, reasoning effort, kind, and automation ID remain identical. The two prompts must contain mutually exclusive ownership sentences for Frontier editions and general editorial essays.

- [ ] **Step 5: Document collision, correction, rollback, and receipt procedures**

`docs/publications-operations.md` must document private intake, public-ready promotion, idempotency calculation, branch naming, current-main check, test suites, review artifact, PR/merge/Pages/live receipts, correction records, profile-after-Pages sequencing, rollback, and no-change silence.

Update the Frontier operations document only where repository authority or per-refresh approval changed.

- [ ] **Step 6: Run documentation and authority checks, then commit public docs**

Run: `python -m pytest tests/test_publication_authority.py tests/test_frontier_safety_workflow_security.py -q`

Expected: PASS.

```bash
git add docs/publications-operations.md docs/frontier-safety-operations.md
git commit -m "docs: define guarded publication operations"
```

### Task 9: Reconcile the current Frontier delta without duplicating it

**Files:**
- Existing: `frontier-safety/data/source-state.json`
- Conditional reviewed input: `frontier-safety/data/editions/2026-09-01.json`
- Conditional generated Frontier artifacts owned by `tools/build_frontier_safety_briefing.py`
- Private source-review receipt only when the delta is nonmaterial

**Interfaces:**
- Consumes: the current 2026-09-01 source check, which reports four OpenAI source IDs changed, zero errors, and zero unbaselined sources.
- Produces: either one reviewed 2026-09-01 edition/amendment with receipts or a reviewed private fingerprint-state update with no public release.

- [ ] **Step 1: Re-run the curated checker from current Pages main**

Run the existing source checker once. Require exhaustive current first-party reads for the four changed OpenAI IDs. A changed sitemap-derived fingerprint is review input, not a claim.

- [ ] **Step 2: Compare substantive source bodies against the prior reviewed baseline**

For each changed ID, record whether claim text, event date, publication date, control statement, evidence basis, or unresolved question changed. If only a navigation, sitemap, template, or publication-list fingerprint changed, classify it as nonmaterial.

- [ ] **Step 3: Follow exactly one branch**

Material branch: create `frontier-safety/data/editions/2026-09-01.json`, route incident detail to `/briefings/2026-08-26-openai-hugging-face-incident/`, and use the existing deterministic Frontier builder and tests.

Nonmaterial branch: merge only reviewed fingerprints into private or approved state, create no edition, commit, pull request, social draft, public amendment, or no-change log.

- [ ] **Step 4: Run the Frontier suite if and only if public bytes change**

Run:

```powershell
python -m pytest -q tests/test_frontier_safety_*.py tests/test_deploy_sanity.py
python tools/check_frontier_safety_public_artifacts.py frontier-safety.html frontier-safety/data frontier-safety/archive frontier-safety/social
```

Expected: PASS with the canonical incident duplication guard intact.

- [ ] **Step 5: Commit only a material reviewed Frontier change**

Use commit message `research: publish reviewed frontier safety edition` only when the material branch produces changed public artifacts. Otherwise leave the Pages branch untouched.

### Task 10: Run full verification and independently review the Pages release

**Files:** No planned changes unless a verifier finds a defect.

**Interfaces:**
- Consumes: Tasks 1 through 9.
- Produces: focused/full test receipts, renderer hashes, privacy scan, accessibility evidence, and an independent release review.

- [ ] **Step 1: Rebase or merge current `origin/main` only after collision inspection**

Fetch current first-party state. List open PRs and compare touched paths. Stop if another owner touches publication records, `publications.html`, `writing.html`, feeds, sitemap, publication tools/tests, or the same Frontier route.

- [ ] **Step 2: Run deterministic regeneration and staged-diff checks**

Run both renderers twice. Require no second-run diff. Run `git diff --check` and inspect every staged path. Verify `publications/build.json` hashes every generated output except itself and that no generated file is untracked.

- [ ] **Step 3: Run the complete test suites**

Run:

```powershell
python -m pytest -q
node --test "system/**/*.test.mjs"
node tests/linkcheck.mjs
```

Expected baseline: all Python tests pass, including the previously observed 437-test baseline plus new tests; all Node tests and internal links pass.

- [ ] **Step 4: Run public-safety scans**

Scan staged text for credentials, private/local paths, protected markers, opaque ChatGPT citations, em dashes, unadopted first-person claims, controlled security terms, and placeholder language. Confirm the private inventory and raw automation packets are not staged.

- [ ] **Step 5: Serve and inspect accessibility states**

Run: `npx serve -l 8765 .`

Inspect Publications, both new articles, all five repaired legacy articles, both figure fallbacks, and current Frontier at desktop, 320 CSS pixels, 400 percent zoom/reflow, keyboard-only focus, text spacing, reduced motion, forced colors, print preview, and JavaScript disabled. Record screenshots or structured observations outside the public repo until scrubbed.

- [ ] **Step 6: Obtain independent review**

Review the staged diff against the spec for claim/source parity, denominator integrity, deterministic outputs, no-JavaScript body parity, privacy, authority, and release collision. Resolve every blocking finding and rerun affected focused and full tests.

- [ ] **Step 7: Commit any review fixes separately**

Use a narrow commit message such as `fix: resolve publication release review` and stage only the reviewed defect corrections.

### Task 11: Publish Pages and capture terminal receipts

**Files:**
- Modify after live verification: `docs/publications-operations.md` with public-safe receipt identifiers only.

**Interfaces:**
- Consumes: clean reviewed branch and green local checks from Task 10.
- Produces: branch, PR, CI, merge, Pages deployment, live URL, HTTP, and byte-hash receipts plus a no-resend control.

- [ ] **Step 1: Push one current branch and open one pull request**

Push `codex/publications-canonical-funnel-20260901`. Open one PR whose body lists the authority correction, no-JavaScript repair, renderer, complete private-inventory boundary, two editorial works, automation changes, Frontier outcome, tests, and limitations.

- [ ] **Step 2: Wait for required checks and reconcile failures**

Do not merge stale or red. If main advances, refresh collision state and rerun affected checks before updating the branch.

- [ ] **Step 3: Merge once and capture the merge commit**

Merge only the reviewed PR. Record the PR URL, head commit, merge commit, check-suite URLs/statuses, and merge timestamp. Mark the branch/PR idempotency key as consumed so no session can resubmit it.

- [ ] **Step 4: Verify GitHub Pages and live bytes**

Require HTTP 200 and canonical tags for:

- `https://harperz9.github.io/publications.html`
- `https://harperz9.github.io/the-second-hearing.html`
- `https://harperz9.github.io/availability-is-not-reach.html`
- both figure HTML routes
- all five repaired legacy article routes
- `https://harperz9.github.io/feed.xml`
- `https://harperz9.github.io/feed.json`

Hash the live article, figure JSON, feed, and sitemap bytes and compare them with the merged repository outputs where GitHub Pages performs no transformation.

- [ ] **Step 5: Record the release and no-resend controls**

Add only public-safe commit, PR, deployment, route, and hash identifiers to `docs/publications-operations.md`. Keep automation-local paths, account state, tokens, and private packet locations out of the public document.

### Task 12: Synchronize the GitHub profile only after Pages is live

**Files in `HarperZ9/HarperZ9`:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `scripts/check_profile_surface.py`

**Interfaces:**
- Consumes: verified live Pages Publications URL and merge/deployment receipt from Task 11.
- Produces: one stable Publications link and a profile no-split contract; no article copy or edition state.

- [ ] **Step 1: Create an ownership-verified isolated profile worktree**

Use the worktree skill, fetch profile `main`, verify no open PR or parallel owner touches the three planned files, and run `python scripts/check_profile_surface.py` for the baseline.

- [ ] **Step 2: Add failing profile-boundary checks**

Extend `check_profile_surface.py` with:

```python
CANONICAL_PUBLICATIONS_URL = "https://harperz9.github.io/publications.html"
PROHIBITED_PUBLICATION_PATHS = (
    "publications/data",
    "frontier-safety/data",
    "feed.xml",
    "feed.json",
    "sitemap.xml",
    "tools/build_publications.py",
)


def assert_publication_boundary() -> None:
    text = README.read_text(encoding="utf-8")
    if CANONICAL_PUBLICATIONS_URL not in text:
        fail("profile must link the canonical Pages publications route")
    leaked = [path for path in PROHIBITED_PUBLICATION_PATHS if (ROOT / path).exists()]
    if leaked:
        fail(f"profile contains canonical publication state: {', '.join(leaked)}")
```

- [ ] **Step 3: Add one stable top-level Publications link and boundary prose**

Add `[Publications](https://harperz9.github.io/publications.html)` to the profile's primary action row. Do not add either article title, a “latest edition” date, copied abstract, source manifest, feed, or publication count.

Update `AGENTS.md` to state that Pages owns every publication body, route, manifest, feed, edition, automation, deployment, correction, and live receipt.

- [ ] **Step 4: Run profile verification and inspect the diff**

Run:

```powershell
python scripts/check_profile_surface.py
npx --yes markdownlint-cli2 README.md AGENTS.md
git diff --check
```

Expected: PASS and a small derivative-only diff.

- [ ] **Step 5: Review, push, merge, and verify the profile separately**

Use a separate branch and PR. Merge only after green profile CI. Verify the GitHub profile renders the canonical Publications link and that no article or edition state was copied. Record its PR/merge receipt as a derivative synchronization, never as the publication receipt.

### Task 13: Close the release with a cross-repository authority audit

**Files:** No source changes unless the audit detects a defect.

- [ ] **Step 1: Audit first-party repository trees**

Verify publication records, generated article bodies, figure records, feeds, edition state, renderers, and deployment logic exist only in Pages. Verify the profile contains only its stable link and boundary checker. Verify Telos V2 was unchanged.

- [ ] **Step 2: Reconcile automation and release idempotency keys**

Confirm the private inventory accounts for both automation corpora, each public record hash appears once, the Pages release key is consumed once, the profile derivative receipt points to the live Pages deployment, and Frontier has either one dated update or a recorded private nonmaterial review.

- [ ] **Step 3: Report only material outcomes**

Report the Pages PR/merge/deployment, the two live article URLs, accessibility/no-JavaScript outcome, automation update confirmation, Frontier material/nonmaterial verdict, profile synchronization receipt, and any remaining genuine blocker. Do not expose private paths, raw packet content, account state, or no-change logs.
