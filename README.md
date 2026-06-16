# HarperZ9.github.io

Static portfolio and product-surface site for Zain Dana Harper: an evidence-first
entry point for compiler work, proof/review utilities, color tools, WARDEN public
leaves, EMET witness material, live product surfaces, and labeled research.

The site is deliberately static and inspectable. It should lead with what can be
opened, built, and checked; keep private systems bounded; keep maturity labels
visible; and point readers toward the repo, command, README, STATUS file, sample,
or live page that supports each claim.

## Files

- `index.html` - primary portfolio page.
- `warden.html` - WARDEN accountability flagship page.
- `proof-surface-sample.html` - sample proof-surface report.
- `proof-index-sample.html` - sample proof index.
- `public-surface-sweeper-sample.html` - sample public-surface sweep.
- `emet-sample.html` - sample EMET witness surface.
- `AUTHORS.md` - authorship and release ownership note.

## Public Lineup

| Group | Public signal | Current state |
| --- | --- | --- |
| Developer workflow utilities | `agent-hook-pack`, `agent-routing-kit`, `agent-template-pack`, `context-curator-lite`, `safe-io-lite`, `workflow-harness-lite`, `workspace-repo-map` | Small Python/Node packages and plugin extractions. |
| Proof, provenance, and AI safety | `public-surface-sweeper`, `model-provenance-validator`, `repo-proof-index`, `gpu-trace-validator`, `EMET`, `ai-safety-guardrail-manager`, `ai-safety-prefire` | CLIs and witness primitives for release-surface checks, provenance, proof indexing, fixtures, and source/view consistency. |
| Quanta and editor support | `quantalang`, `quantalang-vscode`, `quantalang-tmLanguage`, `quanta-universe` | QuantaLang is the heavy repo; editor packages are support surfaces; Quanta Universe is alpha/showcase. |
| Graphics, color, and calibration | `calibrate-pro`, `quanta-color`, ELDER.ENB, RAW | Python color/calibration packages, an older public graphics release, and private graphics prototype work. |
| WARDEN public packages | `warden.html`, `warden-reporting`, `warden-algorithms`, `warden-anomaly` | Public reporting, algorithm, and anomaly leaves around a private core. |
| Support surfaces and forks | `wol-pi`, `linguist`, `CL4R1T4S-CR0SS0VER` | Support repos and forks; not the portfolio thesis. |
| Private product and platform work | Harper Advocates, Harper Compliance, WARDEN, APPS, Aurora, Quanta internals | Real work exists here, but public claims stay limited to outcomes and categories. |

## Public Directions

- Evidence systems - claim checks, provenance, witness state, proof packets, reports.
- Quanta research - Rust compiler, C execution path, shader output, labeled backend limits.
- Graphics and color - color math, HDR tone mapping, ICC/LUT output, calibration, shader work.
- Agent workflow - routing, hooks, safe IO, context preparation, workflow harnesses, repo maps.
- Private platforms - live products and private systems shown only through public outcomes.

## Local Verification

Open `index.html` directly in a browser or serve this directory locally:

```powershell
python -m http.server 8765
```

Then visit `http://127.0.0.1:8765/`.

Before publishing, verify:

- The first viewport says what the strongest public evidence is.
- Local sample links and `warden.html` resolve.
- External GitHub links point at intended public repositories.
- The page remains legible at desktop and mobile widths.
- No local secrets, generated logs, or private artifacts are staged.
