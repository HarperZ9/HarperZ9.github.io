# Public Facing Page Clarity Design

## Status

Approved direction: explanation-first, still elegant.

The current portfolio, WARDEN, and QuantaLang pages are visually polished and fact-aware, but they lead with internal shorthand before the reader understands the work. The update should make each page plain enough for a smart stranger to understand in 20 seconds while keeping evidence, maturity labels, and public/private boundaries intact.

## Objective

Update the public-facing language and page structure for:

- `C:\dev\public\portfolio-site\index.html`
- `C:\dev\public\portfolio-site\warden.html`
- `C:\dev\public\pubscan\quantalang\quantalang\website\index.html`

The pages should answer, near the top:

1. What is this?
2. Who is it for?
3. What does it do today?
4. How does it work?
5. What evidence supports the claim?

## Shared Copy Rule

Every major section must pass this test:

> Could a smart stranger explain what this is after 20 seconds?

Evidence words are allowed only after the practical meaning is clear. Avoid leading with internal terms such as "proof surface," "receipts," "witness," "accountability engine," "compiler corpus," or "research surface" unless the same sentence explains them in plain language.

## Portfolio Page Direction

The portfolio should explain the body of work in plain terms:

> I build compilers, graphics tools, accountability systems, and live web products. The common thread is turning ambiguous technical ideas into working software with tests, examples, and public artifacts.

The first viewport should name the major lanes plainly:

- language and compiler work
- accountability and evidence tools
- graphics and color systems
- live web products
- agent workflow tooling

The "Current state" section should explain the public offer in normal language:

- Public release review means checking whether a repo, page, demo, or tool makes claims it can support.
- The toolchain map means the work can inspect a public surface, check source/provenance, collect evidence, write a report, and preserve a review trail.

The lineup and directions sections should keep concise descriptions, but each row must say what the tools are for before listing repo names.

## WARDEN Page Direction

WARDEN should stop relying on "accountability engine" as the first explanation. Lead with:

> WARDEN is a system for checking AI-assisted work. It records what was claimed, what evidence supports it, where the work came from, what changed, and what a human reviewer should look at.

The page should explain the way it works as a workflow:

1. State the claim.
2. Attach evidence.
3. Check provenance.
4. Review anomalies.
5. Write a handoff report.
6. Keep human ownership visible.

The page may still call WARDEN an accountability engine, but only after explaining the practical workflow.

The public/private boundary must remain explicit:

- Public surface: repos, sample artifacts, evidence patterns, reports, maturity labels.
- Private core: private internals, credentials, client data, operational details, and sensitive workflows are not exposed.

Do not imply certification, customer deployment, regulatory approval, or external trust status.

## QuantaLang Page Direction

The QuantaLang splash should explain the verified compiler before warning about historical material:

> QuantaLang is a compiler project. Today, the verified path compiles `.quanta` programs to C, runs them through a native compiler, and also emits HLSL/GLSL shader code. Other backends exist as research surfaces.

Then explain how it works:

- source files go through lexer, parser, type checker, and MIR
- the C backend is the verified execution path
- HLSL/GLSL output is usable for shader experiments
- Rust, LLVM, WASM, SPIR-V, x86-64, and ARM64 are experimental or partial
- the current factual anchor is the root README, STATUS, and test results

The page should not feel like an apology for the aspirational tree. It should say clearly:

- What works now.
- What is partial.
- What is future-facing.
- How to build and verify the compiler.

The old fake hosted-product framing should be removed or reframed:

- Do not link to non-current docs, learn, packages, playground, Discord, or Twitter surfaces unless they are real and intended.
- Do not present memory safety, package management, async/await, or broad standard-library claims as current product facts unless the page labels them accurately.

## Tone

Use direct, useful language. Concise is good only when it still explains the thing.

Use:

- "This is..."
- "It works by..."
- "Today it can..."
- "Use it when..."
- "The verified path is..."
- "The public part shows..."

Avoid:

- unexplained internal labels
- clever headlines that hide the product
- long disclaimers before the reader knows the value
- overly clinical phrasing
- unsupported customer, certification, compliance, or production claims

## Structure Requirements

Each page should include a small "What it is" explanation near the top.

Each page should include a "How it works" or equivalent section that maps the workflow without requiring repo knowledge.

Each page should keep evidence links close to claims, but evidence should support the explanation, not replace it.

The rewrite should prefer HTML copy changes and light structural additions. Do not redesign the entire visual system unless needed for readability.

## Verification

Portfolio repo:

- Existing portfolio visual tests must pass.
- Add or update tests so the portfolio page contains plain-language explanations for "what", "how", and WARDEN.
- Add or update tests so WARDEN explains the checking workflow and keeps the public/private boundary.
- Run `python -m pytest -q`.
- Run `git diff --check`.
- Run staged secret-shape scan before commit.
- Browser-check desktop and mobile for portfolio root and WARDEN page.

QuantaLang repo:

- If no suitable website tests exist, add a small static HTML contract test for `website/index.html`.
- Test that the page explains:
  - "QuantaLang is a compiler project"
  - verified `.quanta` to C path
  - HLSL/GLSL output
  - experimental backend boundary
  - root README/STATUS as factual anchors
- Run the targeted test or static check.
- Run `git diff --check`.
- Run staged secret-shape scan before commit.
- Browser-check the local QuantaLang splash page.

## Out Of Scope

- Full visual redesign of the three sites.
- New backend services or dynamic data.
- Claims beyond public repository evidence.
- Publishing private WARDEN internals.
- Rewriting the full QuantaLang root README or STATUS in this pass.

## Self-Review

- No open blanks remain.
- The scope is focused on public-facing page clarity for portfolio, WARDEN, and QuantaLang splash.
- The approved direction is explanation-first, still elegant.
- The design protects factual accuracy while making the pages more understandable and useful.
