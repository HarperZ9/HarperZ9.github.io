# Project Telos Flagship Repo Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified Project Telos visual and user-facing repo kit to `gather`, `crucible`, `index`, `forum`, and `telos`: logo or project mark, README hero, repo description metadata, polished demonstration surface, and proof-led market narrative for each flagship.

**Architecture:** `portfolio-site` remains the visual source of truth. A small committed generator in `portfolio-site/tools/flagship_repo_kit.py` owns shared tokens, brand geometry, and static demo-page templates, then writes self-contained SVG and HTML assets into the five flagship repos. Each repo receives local README and metadata edits plus repo-local verification so the work can ship independently.

**Tech Stack:** Static SVG, static HTML/CSS, Python 3.11 generator, existing Python package tests, Node 18+ for `telos`, Playwright or browser screenshot verification for visual QA.

## Global Constraints

- Match `harperz9.github.io` white-sculptural presentation: ceramic `#f4f3ef`, ink `#0b0c0e`, iris `#4636e8`, sparse mono chrome, large editorial wordmarks, and no generic OSS template look.
- Use Kilon and Conso as canonical web/demo fonts. Verify source archives at `C:\Users\Zain\Downloads\Kilon-Bold-Display-Font.zip` and `C:\Users\Zain\Downloads\Conso-Font-Family.zip`; use existing webfont copies under `C:\dev\public\portfolio-site\system\fonts` for site-hosted demos.
- GitHub README SVGs must be self-contained and readable without JavaScript, external images, or remote font loading.
- Each README needs immediate text fallback below the hero image.
- Each demo page needs skip link, `main`, logical headings, visible focus states, responsive layout, and reduced-motion handling.
- Status is never color-only; use text labels and shape.
- No nested cards. Use sections, rows, specimen panels, hairlines, and whitespace.
- Integrate the technical narrative with proof-led demand creation: name the costly failure, show the mechanism, point to the runnable artifact, and invite inspection, pilots, sponsorship, or funding without sounding like a pitch deck.
- Use honest marketing only. No fake urgency, fake social proof, dark patterns, inflated adoption claims, or hidden sales framing.
- No committed em dashes in files touched by this work.
- Never commit secrets, generated logs, `.env`, browser profiles, or private artifacts.
- Preserve existing tool behavior. UI work must not break CLI examples, package metadata, atlas interactions, or the Telos certificate loop.

---

## File Structure

### Central design repo

- Create: `C:\dev\public\portfolio-site\tools\flagship_repo_kit.py`
  - Owns shared color tokens, font checks, repo identity data, SVG mark generation, SVG hero generation, and static demo HTML generation.
- Modify: `C:\dev\public\portfolio-site\docs\superpowers\plans\2026-06-26-telos-flagship-repo-kit.md`
  - Track implementation progress if executing inline.

### Per-repo generated assets

Each flagship repo receives:

- Create: `docs/brand/<repo>-mark.svg`
- Create: `docs/brand/<repo>-hero.svg`
- Create: `examples/<repo>-demo.html` for `gather`, `crucible`, `index`, and `forum`, except `index` also updates its existing atlas demo. For `telos`, create `demo/index.html`.

### Per-repo edited files

- Modify: `C:\dev\public\gather\README.md`
- Modify: `C:\dev\public\gather\pyproject.toml`
- Modify: `C:\dev\public\crucible\README.md`
- Modify: `C:\dev\public\crucible\pyproject.toml`
- Modify: `C:\dev\public\index\README.md`
- Modify: `C:\dev\public\index\pyproject.toml`
- Modify: `C:\dev\public\index\src\index_graph\viz\atlas_assets.py`
- Modify: `C:\dev\public\index\examples\atlas-demo.html`
- Modify: `C:\dev\public\forum\README.md`
- Modify: `C:\dev\public\forum\pyproject.toml`
- Modify: `C:\dev\public\telos\README.md`
- Modify: `C:\dev\public\telos\demo\README.md`

### Per-repo tests or checks

- Add or modify docs/demo existence tests only where a repo already has a docs/package test convention:
  - `C:\dev\public\gather\tests\test_docs.py`
  - `C:\dev\public\crucible\tests\test_readiness.py`
  - `C:\dev\public\index\tests\test_atlas_html.py`
  - `C:\dev\public\forum\tests\test_report.py` or `tests\test_cli.py`
- For `telos`, use Node's built-in test/run commands rather than adding a package manager.

---

## Shared Interfaces

### `RepoIdentity`

The generator exposes this Python shape:

```python
@dataclass(frozen=True)
class RepoIdentity:
    key: str
    root: Path
    package_name: str
    role: str
    promise: str
    market_position: str
    status_labels: tuple[str, ...]
    demo_path: Path
    install_command: str
    run_command: str
    description: str
```

### Generator CLI

```powershell
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --check-fonts
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --repo gather
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --repo crucible
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --repo index
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --repo forum
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --repo telos
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --all
```

The CLI prints one line per written file:

```text
wrote C:\dev\public\gather\docs\brand\gather-mark.svg
wrote C:\dev\public\gather\docs\brand\gather-hero.svg
wrote C:\dev\public\gather\examples\gather-demo.html
```

### README hero block

Each README begins with this shape, using repo-specific paths and text:

```markdown
<p align="center">
  <img src="docs/brand/gather-hero.svg" alt="Gather, a Project Telos flagship for accountable research intake">
</p>

# Gather

> Bring difficult sources in, and keep how they arrived on the record.

[Project Telos](https://harperz9.github.io) | [gather](https://github.com/HarperZ9/gather) | [index](https://github.com/HarperZ9/index) | [forum](https://github.com/HarperZ9/forum) | [crucible](https://github.com/HarperZ9/crucible) | [telos](https://github.com/HarperZ9/telos)
```

Use ASCII punctuation in the actual README source.

---

### Task 1: Add the Central Generator

**Files:**
- Create: `C:\dev\public\portfolio-site\tools\flagship_repo_kit.py`
- Verify: `C:\dev\public\portfolio-site\system\fonts\kilon.woff2`
- Verify: `C:\dev\public\portfolio-site\system\fonts\conso-regular.woff2`

**Interfaces:**
- Consumes: approved spec at `docs/superpowers/specs/2026-06-26-telos-flagship-repo-kit-design.md`
- Produces: `render_repo(identity: RepoIdentity) -> list[Path]`, `render_mark(identity) -> str`, `render_hero(identity) -> str`, `render_demo(identity) -> str`

- [ ] **Step 1: Write the failing smoke check**

Create `C:\dev\public\portfolio-site\tools\test_flagship_repo_kit_smoke.py` temporarily with this content:

```python
from pathlib import Path
import importlib.util

module_path = Path(r"C:\dev\public\portfolio-site\tools\flagship_repo_kit.py")
spec = importlib.util.spec_from_file_location("flagship_repo_kit", module_path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert "gather" in module.IDENTITIES
assert module.TOKENS["paper"] == "#f4f3ef"
assert module.TOKENS["ink"] == "#0b0c0e"
assert module.TOKENS["iris"] == "#4636e8"
assert "<title>" in module.render_mark(module.IDENTITIES["gather"])
assert "<desc>" in module.render_hero(module.IDENTITIES["gather"])
assert "Skip to content" in module.render_demo(module.IDENTITIES["gather"])
assert module.IDENTITIES["gather"].market_position.startswith("Research")
```

- [ ] **Step 2: Run smoke check to verify it fails**

Run:

```powershell
python C:\dev\public\portfolio-site\tools\test_flagship_repo_kit_smoke.py
```

Expected: FAIL because `flagship_repo_kit.py` does not exist.

- [ ] **Step 3: Implement the generator**

Create `tools\flagship_repo_kit.py` with:

```python
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import argparse
import html
import sys
from zipfile import ZipFile

TOKENS = {
    "paper": "#f4f3ef",
    "paper2": "#eceae4",
    "ink": "#0b0c0e",
    "soft": "#2f3238",
    "muted": "#585c64",
    "line": "rgba(11,12,14,.14)",
    "iris": "#4636e8",
}

PORTFOLIO = Path(r"C:\dev\public\portfolio-site")
FONT_ARCHIVES = [
    Path(r"C:\Users\Zain\Downloads\Kilon-Bold-Display-Font.zip"),
    Path(r"C:\Users\Zain\Downloads\Conso-Font-Family.zip"),
]
WEB_FONTS = [
    PORTFOLIO / "system" / "fonts" / "kilon.woff2",
    PORTFOLIO / "system" / "fonts" / "conso-regular.woff2",
    PORTFOLIO / "system" / "fonts" / "conso-semibold.woff2",
    PORTFOLIO / "system" / "fonts" / "conso-bold.woff2",
]


@dataclass(frozen=True)
class RepoIdentity:
    key: str
    root: Path
    package_name: str
    role: str
    promise: str
    market_position: str
    status_labels: tuple[str, ...]
    demo_path: Path
    install_command: str
    run_command: str
    description: str


IDENTITIES = {
    "gather": RepoIdentity(
        key="gather",
        root=Path(r"C:\dev\public\gather"),
        package_name="gather-engine",
        role="accountable research intake",
        promise="Bring difficult sources in, and keep how they arrived on the record.",
        market_position="Research work loses trust when source trails disappear. Gather makes provenance feel like leverage: every source has a method, every digest can be checked, and every derived claim keeps its ancestry.",
        status_labels=("SOURCE", "RECEIPT", "DIGEST", "TAMPER CAUGHT"),
        demo_path=Path("examples/gather-demo.html"),
        install_command="pip install gather-engine",
        run_command="python examples/demo.py",
        description="Accountable research intake for difficult sources, with provenance receipts and witnessed digests.",
    ),
    "crucible": RepoIdentity(
        key="crucible",
        root=Path(r"C:\dev\public\crucible"),
        package_name="crucible-bench",
        role="measurement-backed claim evaluation",
        promise="Turn claims into verdicts grounded in measurement.",
        market_position="Decision work gets expensive when plausible claims outrun measurement. crucible gives teams a calmer surface: register the thesis, measure the claim, and fund the verdict with evidence.",
        status_labels=("THESIS", "MEASURE", "MATCH", "UNVERIFIABLE"),
        demo_path=Path("examples/crucible-demo.html"),
        install_command="pip install crucible-bench",
        run_command="python examples/demo.py",
        description="Measurement-backed thesis evaluation with clean verifier packets and re-checkable verdicts.",
    ),
    "index": RepoIdentity(
        key="index",
        root=Path(r"C:\dev\public\index"),
        package_name="index-graph",
        role="workspace atlas",
        promise="Map a workspace from evidence, not memory.",
        market_position="Large workspaces decay when their shape lives in memory. index turns code and docs into a navigable atlas, so onboarding, diligence, and agent routing start from evidence.",
        status_labels=("REPO", "DOC", "EDGE", "ATLAS"),
        demo_path=Path("examples/index-demo.html"),
        install_command="pip install index-graph",
        run_command="python examples/atlas_demo.py",
        description="Evidence-built repo and documentation atlas for multi-repo workspaces.",
    ),
    "forum": RepoIdentity(
        key="forum",
        root=Path(r"C:\dev\public\forum"),
        package_name="forum-engine",
        role="witnessed agent orchestration",
        promise="Route agent work through a ledger you can replay and verify.",
        market_position="Agent work becomes operational only when the route is visible. Forum makes multi-agent execution feel accountable: plan, ledger, replay, and deep verification before trust.",
        status_labels=("ROUTE", "PLAN", "LEDGER", "DEEP VERIFY"),
        demo_path=Path("examples/forum-demo.html"),
        install_command="pip install forum-engine",
        run_command="python examples/demo.py",
        description="Model-agnostic agent orchestration with a replayable, verifiable causal ledger.",
    ),
    "telos": RepoIdentity(
        key="telos",
        root=Path(r"C:\dev\public\telos"),
        package_name="telos",
        role="verified contact with state and range",
        promise="Give a stateless model durable, verified contact with state and range.",
        market_position="Serious AI work needs a floor beneath confidence. Project Telos gives the model shared state, witnessed perception, and a certificate loop a person can re-check.",
        status_labels=("PERCEIVE", "CHECK", "CERTIFIED", "UNVERIFIABLE"),
        demo_path=Path("demo/index.html"),
        install_command="Node 18 or newer",
        run_command="node demo/run.mjs",
        description="The Project Telos membrane demo: perceive, check, and re-derive a certificate.",
    ),
}


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def check_fonts() -> None:
    missing = [str(path) for path in FONT_ARCHIVES + WEB_FONTS if not path.exists()]
    if missing:
        raise SystemExit("missing font assets:\n" + "\n".join(missing))
    for archive in FONT_ARCHIVES:
        with ZipFile(archive) as zip_file:
            names = set(zip_file.namelist())
        if archive.name.startswith("Kilon") and "Web Fonts/kilon-webfont.woff2" not in names:
            raise SystemExit("Kilon archive missing kilon webfont")
        if archive.name.startswith("Conso") and "Web Fonts/conso-regular-webfont.woff2" not in names:
            raise SystemExit("Conso archive missing regular webfont")


def mark_paths(key: str) -> str:
    if key == "telos":
        return '<path d="M115 60 C180 10 292 10 365 86 C438 162 434 278 352 348 C270 418 151 394 96 306 C42 218 50 114 115 60 Z" fill="none" stroke="#0b0c0e" stroke-width="14"/><path d="M142 296 C202 188 272 123 354 88" fill="none" stroke="#4636e8" stroke-width="18" stroke-linecap="round"/>'
    if key == "gather":
        return '<path d="M80 82 H400 L302 210 V330 L178 360 V210 Z" fill="none" stroke="#0b0c0e" stroke-width="14" stroke-linejoin="round"/><path d="M132 238 H348 M154 282 H326 M182 326 H298" stroke="#4636e8" stroke-width="10" stroke-linecap="round"/>'
    if key == "index":
        return '<circle cx="126" cy="138" r="34" fill="none" stroke="#0b0c0e" stroke-width="12"/><circle cx="342" cy="122" r="34" fill="none" stroke="#0b0c0e" stroke-width="12"/><circle cx="242" cy="320" r="38" fill="none" stroke="#4636e8" stroke-width="12"/><path d="M160 138 L308 122 M144 168 L216 292 M322 154 L264 290" stroke="#0b0c0e" stroke-width="10" stroke-linecap="round"/>'
    if key == "forum":
        return '<path d="M82 112 C146 70 206 70 270 112 C334 154 394 154 456 112" fill="none" stroke="#0b0c0e" stroke-width="12" stroke-linecap="round"/><path d="M82 214 C146 172 206 172 270 214 C334 256 394 256 456 214" fill="none" stroke="#0b0c0e" stroke-width="12" stroke-linecap="round"/><path d="M118 326 H404" stroke="#4636e8" stroke-width="14" stroke-linecap="round"/><circle cx="178" cy="326" r="18" fill="#f4f3ef" stroke="#0b0c0e" stroke-width="10"/><circle cx="278" cy="326" r="18" fill="#f4f3ef" stroke="#0b0c0e" stroke-width="10"/><circle cx="378" cy="326" r="18" fill="#f4f3ef" stroke="#0b0c0e" stroke-width="10"/>'
    if key == "crucible":
        return '<path d="M94 350 H386 M150 350 L214 98 H306 L370 350" fill="none" stroke="#0b0c0e" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M164 232 H356" stroke="#4636e8" stroke-width="14" stroke-linecap="round"/><circle cx="260" cy="232" r="42" fill="none" stroke="#0b0c0e" stroke-width="12"/>'
    raise KeyError(key)


def render_mark(identity: RepoIdentity) -> str:
    title = f"{identity.key} mark"
    desc = f"Project Telos mark for {identity.key}, {identity.role}."
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 440" role="img" aria-labelledby="title desc">
  <title id="title">{esc(title)}</title>
  <desc id="desc">{esc(desc)}</desc>
  <rect width="520" height="440" rx="44" fill="{TOKENS["paper"]}"/>
  {mark_paths(identity.key)}
</svg>
'''


def render_hero(identity: RepoIdentity) -> str:
    labels = " / ".join(identity.status_labels)
    title = identity.key
    desc = f"{identity.key} README hero for Project Telos."
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 520" role="img" aria-labelledby="title desc">
  <title id="title">{esc(title)} Project Telos hero</title>
  <desc id="desc">{esc(desc)} {esc(identity.promise)}</desc>
  <rect width="1280" height="520" rx="34" fill="{TOKENS["paper"]}"/>
  <path d="M80 96 H1200 M80 424 H1200" stroke="#0b0c0e" stroke-opacity=".14"/>
  <text x="80" y="86" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="20" letter-spacing="6" fill="{TOKENS["muted"]}">PROJECT TELOS / {esc(identity.role.upper())}</text>
  <text x="76" y="334" font-family="Arial Black, Impact, system-ui, sans-serif" font-size="182" letter-spacing="-8" fill="#0b0c0e" fill-opacity=".08">{esc(identity.key.upper())}</text>
  <text x="84" y="210" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700" fill="{TOKENS["ink"]}">{esc(identity.promise)}</text>
  <text x="86" y="262" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="22" fill="{TOKENS["soft"]}">{esc(labels)}</text>
  <g transform="translate(850 68) scale(.78)">{mark_paths(identity.key)}</g>
</svg>
'''


def demo_rows(identity: RepoIdentity) -> str:
    rows = {
        "gather": [
            ("source", "video metadata, transcript, comment"),
            ("receipt", "method, ref, timestamp, sha256"),
            ("digest", "sealed run record for downstream organs"),
            ("tamper", "altered receipt fails verification"),
        ],
        "crucible": [
            ("thesis", "claim plus falsification condition"),
            ("measure", "substrate oracle records deviation"),
            ("verdict", "MATCH, DRIFT, or UNVERIFIABLE"),
            ("review", "verifier receives spec and artifact only"),
        ],
        "index": [
            ("scan", "repos and docs enter the atlas"),
            ("edge", "dependencies carry file and line evidence"),
            ("read", "markdown appears beside the graph"),
            ("focus", "search and neighborhood views reduce noise"),
        ],
        "forum": [
            ("route", "request receives a witnessed lane"),
            ("plan", "DAG runs in bounded waves"),
            ("ledger", "each result is chained and replayable"),
            ("verify", "deep verification catches body tampering"),
        ],
        "telos": [
            ("perceive", "rendered state is read through two channels"),
            ("check", "criterion lives outside the perceiver"),
            ("certify", "honest render rechecks true"),
            ("refuse", "broken render returns UNVERIFIABLE"),
        ],
    }[identity.key]
    return "\n".join(
        f'<div class="row"><span>{esc(label)}</span><p>{esc(text)}</p></div>'
        for label, text in rows
    )


def render_demo(identity: RepoIdentity) -> str:
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(identity.key)} Project Telos demo</title>
<style>
@font-face{{font-family:Kilon;src:url("https://harperz9.github.io/system/fonts/kilon.woff2") format("woff2");font-display:swap}}
@font-face{{font-family:Conso;src:url("https://harperz9.github.io/system/fonts/conso-regular.woff2") format("woff2");font-display:swap}}
:root{{--paper:#f4f3ef;--ink:#0b0c0e;--soft:#2f3238;--muted:#585c64;--iris:#4636e8;--line:rgba(11,12,14,.14)}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font-family:Conso,Arial,sans-serif;line-height:1.6}}a{{color:var(--ink)}}a:focus-visible,button:focus-visible{{outline:2px solid var(--iris);outline-offset:4px}}.skip{{position:absolute;left:1rem;top:1rem;transform:translateY(-140%);background:var(--paper);border:1px solid var(--line);padding:.6rem 1rem}}.skip:focus{{transform:none}}main{{min-height:100vh;padding:clamp(1.2rem,4vw,4rem)}}.rail{{font-family:ui-monospace,Consolas,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);font-size:.72rem}}h1{{font-family:Kilon,Arial Black,sans-serif;font-size:clamp(4rem,18vw,13rem);line-height:.78;letter-spacing:-.05em;margin:4rem 0 1rem}}.promise{{font-size:clamp(1.25rem,2.2vw,2.2rem);max-width:34ch;color:var(--soft)}}.market{{max-width:62ch;color:var(--muted);margin-top:1.1rem}}.specimen{{margin-top:clamp(2rem,5vw,4rem);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}}.row{{display:grid;grid-template-columns:minmax(8rem,14rem) 1fr;gap:1rem;padding:1rem 0;border-top:1px solid var(--line)}}.row:first-child{{border-top:0}}.row span{{font-family:ui-monospace,Consolas,monospace;text-transform:uppercase;letter-spacing:.16em;color:var(--iris);font-size:.76rem}}.row p{{margin:0;max-width:58ch}}.actions{{display:flex;flex-wrap:wrap;gap:.8rem;margin-top:2rem}}.pill{{border:1px solid var(--ink);border-radius:999px;padding:.72rem 1rem;text-decoration:none}}.pill.primary{{background:var(--ink);color:var(--paper)}}@media(max-width:620px){{.row{{grid-template-columns:1fr}}h1{{font-size:clamp(3.4rem,24vw,7rem)}}}}@media(prefers-reduced-motion:reduce){{*{{scroll-behavior:auto;transition:none!important;animation:none!important}}}}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<main id="main">
  <p class="rail">Project Telos / {esc(identity.role)}</p>
  <h1>{esc(identity.key)}</h1>
  <p class="promise">{esc(identity.promise)}</p>
  <p class="market">{esc(identity.market_position)}</p>
  <section class="specimen" aria-label="{esc(identity.key)} proof sequence">
    {demo_rows(identity)}
  </section>
  <nav class="actions" aria-label="Demo actions">
    <a class="pill primary" href="../README.md">Read the README</a>
    <a class="pill" href="https://harperz9.github.io">Project Telos</a>
  </nav>
</main>
</body>
</html>
'''


def write_text(path: Path, content: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    return path


def render_repo(identity: RepoIdentity) -> list[Path]:
    brand = identity.root / "docs" / "brand"
    written = [
        write_text(brand / f"{identity.key}-mark.svg", render_mark(identity)),
        write_text(brand / f"{identity.key}-hero.svg", render_hero(identity)),
        write_text(identity.root / identity.demo_path, render_demo(identity)),
    ]
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", choices=sorted(IDENTITIES))
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--check-fonts", action="store_true")
    args = parser.parse_args(argv)
    if args.check_fonts:
        check_fonts()
        print("font assets ok")
    keys = sorted(IDENTITIES) if args.all else ([args.repo] if args.repo else [])
    if not keys and not args.check_fonts:
        parser.error("pass --repo, --all, or --check-fonts")
    for key in keys:
        for path in render_repo(IDENTITIES[key]):
            print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
```

- [ ] **Step 4: Verify generator smoke check passes**

Run:

```powershell
python C:\dev\public\portfolio-site\tools\test_flagship_repo_kit_smoke.py
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --check-fonts
```

Expected:

```text
font assets ok
```

- [ ] **Step 5: Remove temporary smoke check**

Delete:

```powershell
Remove-Item -LiteralPath C:\dev\public\portfolio-site\tools\test_flagship_repo_kit_smoke.py
```

- [ ] **Step 6: Commit generator**

Run:

```powershell
git -C C:\dev\public\portfolio-site add tools\flagship_repo_kit.py
git -C C:\dev\public\portfolio-site commit -m "Add Telos flagship repo kit generator"
```

---

### Task 2: Apply Gather Repo Kit

**Files:**
- Create: `C:\dev\public\gather\docs\brand\gather-mark.svg`
- Create: `C:\dev\public\gather\docs\brand\gather-hero.svg`
- Create: `C:\dev\public\gather\examples\gather-demo.html`
- Modify: `C:\dev\public\gather\README.md`
- Modify: `C:\dev\public\gather\pyproject.toml`
- Test: `C:\dev\public\gather\tests\test_docs.py`

**Interfaces:**
- Consumes: `tools\flagship_repo_kit.py --repo gather`
- Produces: README first viewport with hero, fallback heading, Try it block, and peer flagship links

- [ ] **Step 1: Write failing docs test**

Add this test to `tests\test_docs.py`:

```python
from pathlib import Path


def test_flagship_brand_assets_exist_and_are_referenced():
    root = Path(__file__).resolve().parents[1]
    readme = (root / "README.md").read_text(encoding="utf-8")
    for rel in [
        "docs/brand/gather-mark.svg",
        "docs/brand/gather-hero.svg",
        "examples/gather-demo.html",
    ]:
        assert (root / rel).exists(), rel
        assert rel in readme
    assert "## Why it matters" in readme
    assert "## Work with it" in readme
    hero = (root / "docs/brand/gather-hero.svg").read_text(encoding="utf-8")
    assert "<title" in hero
    assert "<desc" in hero
    assert "#f4f3ef" in hero
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest -q tests\test_docs.py::test_flagship_brand_assets_exist_and_are_referenced
```

Expected: FAIL because assets and README references do not exist.

- [ ] **Step 3: Generate assets**

Run:

```powershell
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --repo gather
```

Expected: three `wrote` lines for mark, hero, and demo.

- [ ] **Step 4: Update README first viewport**

Replace the first heading and badge block with the shared README hero block for Gather, then keep the existing narrative under `## What it does`.

Use this exact top block:

```markdown
<p align="center">
  <img src="docs/brand/gather-hero.svg" alt="Gather, a Project Telos flagship for accountable research intake">
</p>

# Gather

> Bring difficult sources in, and keep how they arrived on the record.

[Project Telos](https://harperz9.github.io) | [gather](https://github.com/HarperZ9/gather) | [index](https://github.com/HarperZ9/index) | [forum](https://github.com/HarperZ9/forum) | [crucible](https://github.com/HarperZ9/crucible) | [telos](https://github.com/HarperZ9/telos)

![python: 3.11+](https://img.shields.io/badge/python-3.11%2B-blue.svg)
![deps: none (core)](https://img.shields.io/badge/core%20deps-none-success.svg)
![license: fair-source](https://img.shields.io/badge/license-fair--source-blue.svg)

## Try it

```bash
pip install gather-engine
python examples/demo.py
```

Open the visual proof surface at [`examples/gather-demo.html`](examples/gather-demo.html).

## Why it matters

Research breaks when sources become a blur. Gather keeps method, ref, hash, and derivation visible, so a team can use harder sources without losing the trail.

## Work with it

Bring a messy research workflow, compare the digest against your own notes, or fund adapter work for the sources that matter in your field.

## What it does
```

- [ ] **Step 5: Update package description**

Change `pyproject.toml` description to:

```toml
description = "Accountable research intake for difficult sources, with provenance receipts and witnessed digests."
```

- [ ] **Step 6: Verify Gather**

Run:

```powershell
python -m pytest -q tests\test_docs.py tests\test_demo.py tests\test_package.py
python -m ruff check src tests examples
python -m mypy src\gather
rg -n "[^\x00-\x7F]" README.md pyproject.toml docs examples tests src
git diff --check
```

Expected:
- pytest passes.
- ruff passes.
- mypy passes.
- dash scan returns no matches.
- diff check exits 0.

- [ ] **Step 7: Commit Gather**

Run:

```powershell
git add README.md pyproject.toml docs\brand examples\gather-demo.html tests\test_docs.py
git commit -m "Add Project Telos flagship UI kit for gather"
```

---

### Task 3: Apply Crucible Repo Kit

**Files:**
- Create: `C:\dev\public\crucible\docs\brand\crucible-mark.svg`
- Create: `C:\dev\public\crucible\docs\brand\crucible-hero.svg`
- Create: `C:\dev\public\crucible\examples\crucible-demo.html`
- Modify: `C:\dev\public\crucible\README.md`
- Modify: `C:\dev\public\crucible\pyproject.toml`
- Test: `C:\dev\public\crucible\tests\test_readiness.py`

**Interfaces:**
- Consumes: `tools\flagship_repo_kit.py --repo crucible`
- Produces: README first viewport and cleanroom verdict demo surface

- [ ] **Step 1: Write failing readiness test**

Add this test to `tests\test_readiness.py`:

```python
from pathlib import Path


def test_flagship_brand_assets_exist_and_are_referenced():
    root = Path(__file__).resolve().parents[1]
    readme = (root / "README.md").read_text(encoding="utf-8")
    for rel in [
        "docs/brand/crucible-mark.svg",
        "docs/brand/crucible-hero.svg",
        "examples/crucible-demo.html",
    ]:
        assert (root / rel).exists(), rel
        assert rel in readme
    assert "## Why it matters" in readme
    assert "## Work with it" in readme
    demo = (root / "examples/crucible-demo.html").read_text(encoding="utf-8")
    assert "original spec and artifact only" in demo
    assert "UNVERIFIABLE" in demo
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest -q tests\test_readiness.py::test_flagship_brand_assets_exist_and_are_referenced
```

Expected: FAIL because assets and README references do not exist.

- [ ] **Step 3: Generate assets**

Run:

```powershell
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --repo crucible
```

- [ ] **Step 4: Update README first viewport**

Use this exact top block:

```markdown
<p align="center">
  <img src="docs/brand/crucible-hero.svg" alt="crucible, a Project Telos flagship for measurement-backed claim evaluation">
</p>

# crucible

> Turn claims into verdicts grounded in measurement.

[Project Telos](https://harperz9.github.io) | [gather](https://github.com/HarperZ9/gather) | [index](https://github.com/HarperZ9/index) | [forum](https://github.com/HarperZ9/forum) | [crucible](https://github.com/HarperZ9/crucible) | [telos](https://github.com/HarperZ9/telos)

![python: 3.11+](https://img.shields.io/badge/python-3.11%2B-blue.svg)
![deps: none (core)](https://img.shields.io/badge/core%20deps-none-success.svg)
![license: fair-source](https://img.shields.io/badge/license-fair--source-blue.svg)

## Try it

```bash
pip install crucible-bench
python examples/demo.py
```

Open the visual cleanroom verdict surface at [`examples/crucible-demo.html`](examples/crucible-demo.html).

## Why it matters

Claims are cheap until a decision depends on them. crucible makes a thesis stand next to the measurement that could break it, and turns uncertainty into a verdict you can re-check.

## Work with it

Use it on a claim that needs to survive review, sponsor a domain oracle, or fund the cleanroom review path for harder evaluations.

## What it does
```

- [ ] **Step 5: Update package description**

Change `pyproject.toml` description to:

```toml
description = "Measurement-backed thesis evaluation with clean verifier packets and re-checkable verdicts."
```

- [ ] **Step 6: Verify Crucible**

Run:

```powershell
python -m pytest -q tests\test_readiness.py tests\test_cli_run.py tests\test_report.py
python -m ruff check src tests examples
python -m mypy src\crucible
rg -n "[^\x00-\x7F]" README.md pyproject.toml docs examples tests src
git diff --check
```

Expected: all checks pass and dash scan returns no matches.

- [ ] **Step 7: Commit Crucible**

Run:

```powershell
git add README.md pyproject.toml docs\brand examples\crucible-demo.html tests\test_readiness.py
git commit -m "Add Project Telos flagship UI kit for crucible"
```

---

### Task 4: Apply Index Repo Kit and Restyle Atlas

**Files:**
- Create: `C:\dev\public\index\docs\brand\index-mark.svg`
- Create: `C:\dev\public\index\docs\brand\index-hero.svg`
- Create: `C:\dev\public\index\examples\index-demo.html`
- Modify: `C:\dev\public\index\examples\atlas-demo.html`
- Modify: `C:\dev\public\index\src\index_graph\viz\atlas_assets.py`
- Modify: `C:\dev\public\index\README.md`
- Modify: `C:\dev\public\index\pyproject.toml`
- Test: `C:\dev\public\index\tests\test_atlas_html.py`

**Interfaces:**
- Consumes: `tools\flagship_repo_kit.py --repo index`
- Produces: README first viewport and white-sculptural atlas styling while preserving pan, zoom, search, and detail behavior

- [ ] **Step 1: Write failing atlas/brand test**

Add this test to `tests\test_atlas_html.py`:

```python
from pathlib import Path


def test_flagship_brand_assets_and_atlas_theme():
    root = Path(__file__).resolve().parents[1]
    readme = (root / "README.md").read_text(encoding="utf-8")
    for rel in [
        "docs/brand/index-mark.svg",
        "docs/brand/index-hero.svg",
        "examples/index-demo.html",
    ]:
        assert (root / rel).exists(), rel
        assert rel in readme
    assert "## Why it matters" in readme
    assert "## Work with it" in readme
    assets = (root / "src/index_graph/viz/atlas_assets.py").read_text(encoding="utf-8")
    assert "#f4f3ef" in assets
    assert "#4636e8" in assets
    assert "Skip to content" in assets
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest -q tests\test_atlas_html.py::test_flagship_brand_assets_and_atlas_theme
```

Expected: FAIL because brand assets and atlas theme changes do not exist.

- [ ] **Step 3: Generate brand assets**

Run:

```powershell
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --repo index
```

- [ ] **Step 4: Restyle `atlas_assets.py`**

In `ATLAS_CSS`, introduce these CSS variables and ensure the page uses them:

```css
:root{--bg:#f4f3ef;--panel:rgba(255,255,255,.55);--ink:#0b0c0e;--soft:#2f3238;--muted:#585c64;--hairline:rgba(11,12,14,.14);--accent:#4636e8;--gold:#0b0c0e;--font-body:Arial,Helvetica,sans-serif;--font-mono:ui-monospace,SFMono-Regular,Consolas,monospace}
```

Add a skip link to generated atlas HTML if the current generator does not emit one:

```html
<a class="skip-link" href="#detail">Skip to detail</a>
```

Style it with visible focus:

```css
.skip-link{position:absolute;left:1rem;top:1rem;transform:translateY(-140%);background:var(--bg);border:1px solid var(--hairline);padding:.55rem .85rem;z-index:10}
.skip-link:focus{transform:none;outline:2px solid var(--accent);outline-offset:3px}
```

- [ ] **Step 5: Regenerate atlas demo**

Run:

```powershell
python examples\atlas_demo.py
```

Expected: `examples\atlas-demo.html` changes and contains `#f4f3ef`.

- [ ] **Step 6: Update README first viewport**

Use this exact top block:

```markdown
<p align="center">
  <img src="docs/brand/index-hero.svg" alt="index, a Project Telos flagship for workspace atlas mapping">
</p>

# index

> Map a workspace from evidence, not memory.

[Project Telos](https://harperz9.github.io) | [gather](https://github.com/HarperZ9/gather) | [index](https://github.com/HarperZ9/index) | [forum](https://github.com/HarperZ9/forum) | [crucible](https://github.com/HarperZ9/crucible) | [telos](https://github.com/HarperZ9/telos)

[![license: fair source](https://img.shields.io/badge/license-fair%20source-blue.svg)](LICENSE)
![python](https://img.shields.io/badge/python-3.11%2B-blue.svg)
![version](https://img.shields.io/badge/version-2.8-informational.svg)
[![CI](https://github.com/HarperZ9/index-graph/actions/workflows/ci.yml/badge.svg)](https://github.com/HarperZ9/index-graph/actions/workflows/ci.yml)
![deps: none](https://img.shields.io/badge/deps-none-success.svg)

## Try it

```bash
pip install index-graph
index atlas --root /path/to/your/workspace --format html --out atlas.html
```

Open the visual atlas sample at [`examples/atlas-demo.html`](examples/atlas-demo.html) or the static proof surface at [`examples/index-demo.html`](examples/index-demo.html).

## Why it matters

A workspace becomes risky when nobody can hold its shape. index gives teams and agents a map built from imports, manifests, docs, and evidence instead of memory.

## Work with it

Run it on a real multi-repo workspace, use the atlas for onboarding or diligence, or fund deeper language and documentation resolvers.

## What it does
```

- [ ] **Step 7: Update package description**

Change `pyproject.toml` description to:

```toml
description = "Evidence-built repo and documentation atlas for multi-repo workspaces."
```

- [ ] **Step 8: Verify Index**

Run:

```powershell
python -m pytest -q tests\test_atlas_html.py tests\test_atlas_demo.py tests\test_viz_html.py
python -m pytest -q tests\test_cli.py tests\test_version.py
rg -n "[^\x00-\x7F]" README.md pyproject.toml docs examples src tests
git diff --check
```

Expected: tests pass, dash scan returns no matches, diff check exits 0.

- [ ] **Step 9: Commit Index**

Run:

```powershell
git add README.md pyproject.toml docs\brand examples\index-demo.html examples\atlas-demo.html src\index_graph\viz\atlas_assets.py tests\test_atlas_html.py
git commit -m "Add Project Telos flagship UI kit for index"
```

---

### Task 5: Apply Forum Repo Kit

**Files:**
- Create: `C:\dev\public\forum\docs\brand\forum-mark.svg`
- Create: `C:\dev\public\forum\docs\brand\forum-hero.svg`
- Create: `C:\dev\public\forum\examples\forum-demo.html`
- Modify: `C:\dev\public\forum\README.md`
- Modify: `C:\dev\public\forum\pyproject.toml`
- Test: `C:\dev\public\forum\tests\test_report.py`

**Interfaces:**
- Consumes: `tools\flagship_repo_kit.py --repo forum`
- Produces: README first viewport and ledger replay demo surface

- [ ] **Step 1: Write failing report test**

Add this test to `tests\test_report.py`:

```python
from pathlib import Path


def test_flagship_brand_assets_exist_and_are_referenced():
    root = Path(__file__).resolve().parents[1]
    readme = (root / "README.md").read_text(encoding="utf-8")
    for rel in [
        "docs/brand/forum-mark.svg",
        "docs/brand/forum-hero.svg",
        "examples/forum-demo.html",
    ]:
        assert (root / rel).exists(), rel
        assert rel in readme
    assert "## Why it matters" in readme
    assert "## Work with it" in readme
    demo = (root / "examples/forum-demo.html").read_text(encoding="utf-8")
    assert "deep verification catches body tampering" in demo
    assert "Skip to content" in demo
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m pytest -q tests\test_report.py::test_flagship_brand_assets_exist_and_are_referenced
```

Expected: FAIL because assets and README references do not exist.

- [ ] **Step 3: Generate assets**

Run:

```powershell
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --repo forum
```

- [ ] **Step 4: Update README first viewport**

Use this exact top block:

```markdown
<p align="center">
  <img src="docs/brand/forum-hero.svg" alt="Forum, a Project Telos flagship for witnessed agent orchestration">
</p>

# Forum

> Route agent work through a ledger you can replay and verify.

[Project Telos](https://harperz9.github.io) | [gather](https://github.com/HarperZ9/gather) | [index](https://github.com/HarperZ9/index) | [forum](https://github.com/HarperZ9/forum) | [crucible](https://github.com/HarperZ9/crucible) | [telos](https://github.com/HarperZ9/telos)

[![CI](https://github.com/HarperZ9/forum/actions/workflows/ci.yml/badge.svg)](https://github.com/HarperZ9/forum/actions/workflows/ci.yml)
![license: fair-source](https://img.shields.io/badge/license-fair--source-blue.svg)
![python: 3.11+](https://img.shields.io/badge/python-3.11%2B-blue.svg)
![deps: none](https://img.shields.io/badge/deps-none-success.svg)

## Try it

```bash
pip install forum-engine
python examples/demo.py
```

Open the visual ledger replay surface at [`examples/forum-demo.html`](examples/forum-demo.html).

## Why it matters

Agent fleets fail quietly when their route is just output. Forum makes the route the artifact: every plan, task, result, and verification step lands in a replayable ledger.

## Work with it

Try it on a real agent workflow, inspect the ledger, or fund executor and verifier work for your model stack.

## What it does
```

- [ ] **Step 5: Update package description**

Change `pyproject.toml` description to:

```toml
description = "Model-agnostic agent orchestration with a replayable, verifiable causal ledger."
```

- [ ] **Step 6: Verify Forum**

Run:

```powershell
python -m pytest -q tests\test_report.py tests\test_cli.py tests\test_verify.py tests\test_ledger_replay.py
python -m ruff check src tests examples
python -m mypy src\forum
rg -n "[^\x00-\x7F]" README.md pyproject.toml docs examples tests src
git diff --check
```

Expected: all checks pass and dash scan returns no matches.

- [ ] **Step 7: Commit Forum**

Run:

```powershell
git add README.md pyproject.toml docs\brand examples\forum-demo.html tests\test_report.py
git commit -m "Add Project Telos flagship UI kit for forum"
```

---

### Task 6: Apply Telos Repo Kit

**Files:**
- Create: `C:\dev\public\telos\docs\brand\telos-mark.svg`
- Create: `C:\dev\public\telos\docs\brand\telos-hero.svg`
- Create: `C:\dev\public\telos\demo\index.html`
- Modify: `C:\dev\public\telos\README.md`
- Modify: `C:\dev\public\telos\demo\README.md`

**Interfaces:**
- Consumes: `tools\flagship_repo_kit.py --repo telos`
- Produces: README first viewport and certificate-loop demo page

- [ ] **Step 1: Write failing Node-free file check**

Run this PowerShell check before creating assets:

```powershell
$root = "C:\dev\public\telos"
$required = @(
  "docs\brand\telos-mark.svg",
  "docs\brand\telos-hero.svg",
  "demo\index.html"
)
foreach ($rel in $required) {
  if (-not (Test-Path (Join-Path $root $rel))) { throw "missing $rel" }
}
$readme = Get-Content (Join-Path $root "README.md") -Raw
if ($readme -notmatch "## Why it matters") { throw "missing Why it matters" }
if ($readme -notmatch "## Work with it") { throw "missing Work with it" }
```

Expected: FAIL with `missing docs\brand\telos-mark.svg`.

- [ ] **Step 2: Generate assets**

Run:

```powershell
python C:\dev\public\portfolio-site\tools\flagship_repo_kit.py --repo telos
```

- [ ] **Step 3: Update README first viewport**

Use this exact top block:

```markdown
<p align="center">
  <img src="docs/brand/telos-hero.svg" alt="Project Telos, the flagship membrane for verified contact with state and range">
</p>

# Project Telos

> Give a stateless model durable, verified contact with state and range.

[Project Telos](https://harperz9.github.io) | [gather](https://github.com/HarperZ9/gather) | [index](https://github.com/HarperZ9/index) | [forum](https://github.com/HarperZ9/forum) | [crucible](https://github.com/HarperZ9/crucible) | [telos](https://github.com/HarperZ9/telos)

## Try it

```bash
node demo/run.mjs
```

Open the visual certificate-loop surface at [`demo/index.html`](demo/index.html).

## Why it matters

The hard part of AI work is not generating an answer. It is keeping state, perception, action, and verification in the same room. Telos is the floor for that.

## Work with it

Run the certificate loop, bring a workflow that needs honest UNVERIFIABLE, or fund the next membrane demo.

## What it does
```

- [ ] **Step 4: Update demo README**

Add this paragraph after the `# Demo` heading:

```markdown
For the polished visual walkthrough, open [`index.html`](index.html). The command-line proof remains [`run.mjs`](run.mjs), and the visual page is a static companion for the same certificate loop.
```

- [ ] **Step 5: Verify Telos**

Run:

```powershell
node demo\run.mjs
node --test demo\render-nd demo\render-sound demo\sense-core demo\viable-viz
rg -n "[^\x00-\x7F]" README.md docs demo
git diff --check
```

Expected:
- `node demo\run.mjs` exits 0.
- Node tests pass or report the existing package-local test behavior without new failures.
- dash scan returns no matches.
- diff check exits 0.

- [ ] **Step 6: Commit Telos**

Run:

```powershell
git add README.md docs\brand demo\README.md demo\index.html
git commit -m "Add Project Telos flagship UI kit for telos"
```

---

### Task 7: GitHub Descriptions and Cross-Repo QA

**Files:**
- Verify: all five repo worktrees
- Optional metadata action: GitHub repo descriptions using `gh repo edit`

**Interfaces:**
- Consumes: committed local repo changes from Tasks 2-6
- Produces: GitHub-facing descriptions aligned with README and package metadata

- [ ] **Step 1: Check GitHub auth**

Run:

```powershell
gh auth status
```

Expected: authenticated as `HarperZ9`.

- [ ] **Step 2: Update GitHub repo descriptions**

Run:

```powershell
gh repo edit HarperZ9/gather --description "Accountable research intake for difficult sources, with provenance receipts and witnessed digests."
gh repo edit HarperZ9/crucible --description "Measurement-backed thesis evaluation with clean verifier packets and re-checkable verdicts."
gh repo edit HarperZ9/index --description "Evidence-built repo and documentation atlas for multi-repo workspaces."
gh repo edit HarperZ9/forum --description "Model-agnostic agent orchestration with a replayable, verifiable causal ledger."
gh repo edit HarperZ9/telos --description "Project Telos membrane demo: perceive, check, and re-derive a certificate."
```

Expected: each command exits 0.

- [ ] **Step 3: Run cross-repo asset/link scan**

Run:

```powershell
$repos = "gather","crucible","index","forum","telos"
foreach ($repo in $repos) {
  $root = "C:\dev\public\$repo"
  Write-Output "### $repo"
  Test-Path "$root\docs\brand\$repo-mark.svg"
  Test-Path "$root\docs\brand\$repo-hero.svg"
  Select-String -Path "$root\README.md" -Pattern "docs/brand/$repo-hero.svg","Project Telos"
}
```

Expected: every `Test-Path` prints `True`; each README has the hero and Project Telos links.

- [ ] **Step 4: Visual QA**

Open these files in a browser and capture desktop and mobile screenshots:

```text
C:\dev\public\gather\examples\gather-demo.html
C:\dev\public\crucible\examples\crucible-demo.html
C:\dev\public\index\examples\atlas-demo.html
C:\dev\public\index\examples\index-demo.html
C:\dev\public\forum\examples\forum-demo.html
C:\dev\public\telos\demo\index.html
```

Expected:
- No horizontal overflow at 390px wide.
- Text does not overlap the mark or wordmark.
- Focus ring is visible on action links.
- Status labels are readable without relying on color.
- Pages look like the Project Telos homepage family, not separate templates.

- [ ] **Step 5: Push all branches**

Run:

```powershell
git -C C:\dev\public\gather push origin main
git -C C:\dev\public\crucible push origin release/1.1.0
git -C C:\dev\public\index push origin main
git -C C:\dev\public\forum push origin main
git -C C:\dev\public\telos push origin main
```

Expected: all pushes succeed.

- [ ] **Step 6: Final status**

Run:

```powershell
git -C C:\dev\public\portfolio-site status -sb
git -C C:\dev\public\gather status -sb
git -C C:\dev\public\crucible status -sb
git -C C:\dev\public\index status -sb
git -C C:\dev\public\forum status -sb
git -C C:\dev\public\telos status -sb
```

Expected: all worktrees are clean and aligned with their remotes.

---

## Plan Self-Review Notes

- Spec coverage: The plan covers logo/mark, README hero, repo/package descriptions, demo surfaces, accessibility, responsiveness, visual QA, and GitHub descriptions for all five named flagships.
- Voice coverage: Each flagship has a proof-led "Why it matters" section, a quiet "Work with it" invitation, and a generated demo paragraph that names the failure, mechanism, and evidence path without unsupported sales claims.
- Placeholder scan: No task contains open placeholders or unfinished file names.
- Type consistency: `RepoIdentity`, `IDENTITIES`, `market_position`, `render_repo`, `render_mark`, `render_hero`, and `render_demo` are the only generator interfaces used by later tasks.
- Scope control: The plan does not create a hosted SaaS dashboard, move repos, or replace technical narratives with marketing copy.
