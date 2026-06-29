# HarperZ9.github.io

![HarperZ9.github.io hero](docs/brand/portfolio-site-hero.png)

> Static public site for the Project Telos portfolio, demos, repos, and evidence.

HarperZ9.github.io is the public site surface for Project Telos. It links the
portfolio, flagship tools, sample reports, creative demos, proof surfaces, and
developer entry points a visitor can open and inspect.

## Why it matters

The website has to serve both public readers and developers. Public readers need
plain claims and visible status; developers need local verification, repo links,
and a path from the page to the code or receipt behind it.

## Try it

```powershell
git clone https://github.com/HarperZ9/HarperZ9.github.io.git
cd HarperZ9.github.io
python -m http.server 8765
```

## What to test first

- Open `http://127.0.0.1:8765/`.
- Check the first viewport for plain product and evidence language.
- Verify public repo links, sample pages, and mobile/desktop readability.

## Current status

Static public portfolio and product-surface site. It should stay inspectable,
accessible, and honest about maturity; private systems stay bounded off-page.

## Existing technical notes

The portfolio and product-surface site for **Zain Dana Harper** — an evidence-first
entry point for the accountability work, the compiler work, the graphics/color tools,
and the public research.

The site is deliberately static and inspectable. It leads with what can be opened,
built, and checked; it keeps private systems bounded; it labels maturity instead of
inflating it; and every claim points at the repo, test, receipt, or live page that
supports it. **Proof before trust.**

## The thesis

One accountable perception-and-action loop: a model perceives only through **witnessed**
organs, acts only through a **gate** it cannot talk past, **journals** everything, and
**verifies** its own work by re-perceiving. The public repos are the organs;
`accountable-surface` composes them into the live loop. The portfolio is the
forward-facing presentation of the same idea.

## Pages

- `index.html` — primary portfolio and work index.
- `proof-surface.html` — the write-gate organ (allow / deny / needs-human).
- `coherence-membrane.html` — the witnessed perception organs.
- `accountable-machines.html` — the live perceive → gate → act → verify loop.
- `emet.html` · `quantalang.html` — the byte witness, and the typed-effects compiler.
- `*-sample.html` — scrubbed public sample reports and witness surfaces.
- `resume.md` · `cv.md` — text-bodied résumé and CV.
- `AUTHORS.md` — authorship and release ownership.

## Public lineup

| Group | Public repos | State |
| --- | --- | --- |
| Accountability spine | `accountable-surface`, `proof-surface`, `coherence-membrane`, `emet`, `accountable-engine`, `repo-proof-index` | The perceive → gate → act → verify organs. Tested; on PyPI / public. |
| Provenance & release | `provenance-sensorium`, `model-provenance-validator`, `public-surface-sweeper`, `release-surface-scanner`, `secret-redact-io` | Witness, provenance, and release-surface CLIs. |
| Agent workflow | `agent-audit`, `agent-hook-pack`, `agent-routing-kit`, `context-curator-lite`, `workflow-harness-lite`, `index` | Small, low-/zero-dependency utilities and plugin extractions. |
| Compilers & QuantaLang | `quantalang`, `quantalang-vscode`, `quantalang-tmLanguage`, `quanta-universe` | A typed-effects language (the heavy repo) plus editor support and an alpha showcase. |
| Systems, graphics & color | `signal-kernels`, `anomaly-kernels`, `gpu-trace-validator`, `quanta-color`, `calibrate-pro` | Header-only C++ kernels, a GPU-trace validator, and color/calibration tools. |

Private platform and product work exists behind these leaves; public claims stay
limited to outcomes and categories, never internals.

## Local verification

Serve this directory locally:

```powershell
python -m http.server 8765
```

Then visit `http://127.0.0.1:8765/`. Before publishing, verify:

- The first viewport says what the strongest public evidence is.
- Internal links and `*-sample.html` resolve; no link 404s.
- External GitHub links point at intended public repositories.
- The page stays legible at desktop and mobile widths.
- No secrets, generated logs, or private artifacts are staged.

## For developers

Keep the public README, examples, and repository metadata aligned with current behavior. Before opening a PR or publishing a release, verify the working tree and any documented commands for this repo.

```bash
git status --short
```
