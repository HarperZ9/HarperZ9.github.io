# HarperZ9.github.io

Static portfolio and product-surface site for Zain Dana Harper: a clean public
entry point for compiler work, proof-surface utilities, agent workflow kits,
EMET witness material, QuantaLang, live frontend surfaces, and labeled research
artifacts.

The site is deliberately static and inspectable. It should make public claims
small enough to check, keep maturity labels visible, and point readers toward
the repo or sample artifact that supports each claim.

## Files

- `index.html` - primary portfolio page.
- `proof-surface-sample.html` - sample proof-surface report.
- `proof-index-sample.html` - sample proof index.
- `public-surface-sweeper-sample.html` - sample public-surface sweep.
- `emet-sample.html` - sample EMET witness surface.
- `AUTHORS.md` - authorship and release ownership note.

## Public Lineup

| Group | Public signal | Current state |
| --- | --- | --- |
| Developer workflow utilities | `agent-hook-pack`, `agent-routing-kit`, `agent-template-pack`, `context-curator-lite`, `safe-io-lite`, `workflow-harness-lite`, `workspace-repo-map` | Artifact-backed `v0.1.x` releases. |
| Proof, provenance, and AI safety | `public-surface-sweeper`, `model-provenance-validator`, `repo-proof-index`, `gpu-trace-validator`, `EMET`, `ai-safety-guardrail-manager`, `ai-safety-prefire` | Release-surface, provenance, and model-context integrity tools with public proof-packet conventions. |
| Quanta and editor support | `quantalang`, `quantalang-vscode`, `quantalang-tmLanguage`, `quanta-universe` | Compiler and editor surfaces with explicit maturity labels. |
| Graphics, color, and calibration | `calibrate-pro`, `quanta-color`, ELDER.ENB, RAW | Public color/calibration products plus private graphics prototypes and a large public shader/mod release. |
| WARDEN public packages | `warden-reporting`, `warden-algorithms`, `warden-anomaly` | Sanitized public pieces from a larger private tooling system: reports, algorithms, and anomaly primitives. |
| Support surfaces and forks | `wol-pi`, `linguist`, `CL4R1T4S-CR0SS0VER` | Useful supporting repos and research surfaces with narrower scopes. |
| Private product and platform work | Harper Advocates, Harper Compliance, WARDEN, APPS, Aurora, Quanta internals | Public-safe descriptions only: live sites, orchestration tooling, DSL/compiler work, and domain-specific systems. |

## Public Directions

- Evidence and release-readiness systems - public claims, provenance, proof
  packets, model-context integrity, and reviewer handoffs.
- Language and systems research - QuantaLang, Quanta Universe, editor support,
  compiler work, and labeled experimental surfaces.
- Graphics, color, and calibration - ELDER.ENB, RAW, Calibrate Pro, and Quanta
  Color as one applied rendering and color-science thread.
- Agent workflow infrastructure - hook, routing, template, safe-IO, context,
  workflow, and repo-map packages for repeatable agentic coding workflows.
- Private product and platform work - public-safe descriptions of live sites,
  orchestration tooling, DSL/compiler work, and domain-specific systems.

## Local Verification

Open `index.html` directly in a browser or serve this directory locally:

```powershell
python -m http.server 8765
```

Then visit `http://127.0.0.1:8765/`.

Before publishing, verify:

- The first viewport identifies the portfolio and current offer.
- Local sample links resolve.
- External GitHub links point at intended public repositories.
- The page remains legible at desktop and mobile widths.
- No local secrets, generated logs, or private artifacts are staged.
