# Flywheel 2.0.0: Model-Agnostic AI Workstation and Independent Verification Platform

Zain Dana Harper | Updated November 25, 2026 | github.com/HarperZ9/flywheel | pypi.org/project/flywheel-verify

## What Flywheel Does

Flywheel lets engineers and researchers run coding, writing, and analysis workflows across any hosted or local OpenAI-compatible model while separating the model that proposes an action from the deterministic oracle that verifies it. Every consequential action runs through an explicit approval boundary and writes a SHA-256 receipt you can replay offline.

## Shipped Architecture (v2.0.0, 31 Consolidated Packages)

- Gateway, Coding Agent, and Unified SDK: OpenAI-compatible gateway, ACP coding session, FlagshipAgentSDK cross-platform bridge, and a fail-closed workstation control plane (accountable-surface, 563 passing tests) with path-root containment and hash-chained journals.
- Independent Verification and Byte Integrity: Three-Plate Verification Oracle (proposer, independent structural verifier, and deterministic execution/hash oracle), EMET 1.3.1 (#![forbid(unsafe_code)] Rust plus Python, Node, and Go), Crucible 1.6.0, Gather 2.6.0 (deterministic paper, audio, video, and sidecar deconstruction), Forum, Canon 0.7.0, Mneme, and 324 terminal-state benchmark fixtures.
- Prose Quality Without Evasion: Articulate 0.19.1 (articulate-writing on PyPI, 2,096 passing tests) provides deterministic prose linting via CLI, LSP, and SARIF GitHub Actions.

## Measured Results and Explicit Limits

- Three-Plate Verification Oracle (145-case planted-defect suite): 115/115 (100.0%) defect recall, 0/115 false accepts, and 0/30 clean false positives vs 7/115 (6.09%) single-plate review.
- Local 14B Model Execution Lift (RTX 4090, 24 held-out tasks): Single-shot 16.67% (4/24) to compact recall + live buildc float64 oracle 95.83% (23/24, exact McNemar p = 4e-6, 68.08 tok/s, 16.55 GB peak VRAM, 24/24 planted-wrong answers rejected).
- IDF-Gated Federated Recall (80 held-out questions): 91.25% hit@5 (73/80), 2.00 ms median latency, and 95.6 average tokens.
- Steered-Agent Guard (mocked tools, 28 tasks, 66 harmful calls): 64/66 caught (3/145 false alarms) vs 1/66 for a schema check.
- Published Null and Commercial Boundary: An earlier verified-inference accuracy comparison scored 9/10 vs 8/10 (95% CI -0.236 to +0.420) and was retired. Flywheel is open-source independent software with no paid commercial deployments to date; a scoped 10-hour verification pilot ($1,250) is available directly from Zain Dana Harper (harperz9.github.io/flywheel-pilot.html).
