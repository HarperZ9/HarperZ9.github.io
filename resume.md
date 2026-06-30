# Zain Dana Harper

**Systems Engineer. Compilers, real-time graphics, color science, and multi-agent AI systems.**
Seattle, WA. Remote. [harperz9.github.io](https://harperz9.github.io) - [github.com/HarperZ9](https://github.com/HarperZ9) - zaindharper@gmail.com

---

## Summary

Self-taught engineer shipping production software across compilers, real-time graphics, color science, and multi-agent AI systems. Eight working languages, public releases on crates.io and the VS Code Marketplace, and a real-time graphics framework past 900,000 downloads. I work as architect and orchestrator: directing agentic coding tools across the full lifecycle, then verifying and integrating every line myself. The throughline is accountability. I build systems that perceive, act, and check their own output against a named criterion, returning a verdict (MATCH, DRIFT, or UNVERIFIABLE) rather than asking to be trusted.

No CS degree and no industry certifications. The public releases are the credential: crates published to crates.io, an extension on the VS Code Marketplace, a real-time graphics framework past 900,000 downloads, and open repositories under github.com/HarperZ9.

## Proof snapshot

- **Language compiler, public.** BuildLang, a typed-effects systems language with a full lexer-to-codegen pipeline and multiple backends, installable from crates.io with a companion VS Code extension. (shipped)
- **Real-time graphics framework, 900,000+ downloads.** A shader post-processing framework released publicly in 2024, with a measured audience and a public demo. (shipped)
- **Standalone graphics injector.** A self-contained D3D11 post-processing layer built from first principles in C++ and HLSL, with a companion engine bridging game state to a GPU pipeline over read-only shared memory. (shipped)
- **Accountable AI flagships.** Public engines (orchestration, intake with provenance, a judgment organ, a byte-level witness) that share one discipline: carry a re-checkable proof, never claim trust. (active; some release candidate)
- **Defensive AI-safety writing.** Two structural papers on a jailbreak pattern against LLM coding assistants, written as detection and governance guidance. Analysis only, no offensive detail, responsible-disclosure track. (shipped)

## Core competencies

**Compiler and language design.** Lexer, parser, AST, optimizer, code generation. Ownership and lifetime analysis from first principles. Algebraic effects. Multiple code-generation backends including a native C path and shader output.

**Real-time graphics and color science.** D3D11 and proxy-DLL architecture, HLSL shader authoring, post-processing pipelines (tone mapping, ACES and AgX, TAA, SSR, volumetrics, depth of field). CIE color, ICC profile and 3D-LUT generation, CIEDE2000 and Oklab, color-vision-deficiency simulation, sensorless display calibration.

**Multi-agent AI and LLM engineering.** Director-pattern orchestration, task routing to specialist agents, meta-agents for decomposition, coordination, validation, and synthesis. Model-agnostic provider abstraction behind a unified tool-use surface. Model Context Protocol (MCP) server authoring. Cost-controlled inference routing.

**Accountable verification.** Perceive, act, check against a named criterion, emit a MATCH / DRIFT / UNVERIFIABLE verdict with a re-derivable proof. Worker and verifier kept separate by design. Provenance and witnessing as first-class outputs.

**Systems engineering.** Shared-memory inter-process communication, CMake and vcpkg build systems, GitHub Actions CI, Python tooling and test harnesses, Linux administration.

**Security and compliance documentation.** Hands-on work with the major control frameworks (NIST 800-171, CMMC readiness, SOC 2, ISO 27001) as a technical writer. Frameworks worked with, written as capability, with no client deliverables, no client names, and no compliance internals reproduced here.

## Selected work

**BuildLang: typed-effects language compiler** - Rust - public - shipped
Full lexer-to-codegen pipeline with multiple backends (native and shader targets), ownership and lifetime semantics, algebraic effects, and embedded DSLs. Roughly 600 tests. Installable from crates.io with a companion VS Code Marketplace extension. Repository under github.com/HarperZ9.

**Language ecosystem** - active
A body of modules and ported Unix utilities written in the language itself and compiled to native binaries through the C backend, exercising the compiler at production scale and advancing toward self-hosting.

**Real-time graphics framework** - HLSL / C++ - shipped
A shader post-processing framework with a large overlay and preset system and Python tooling, released publicly in 2024 and past 900,000 downloads with a public demo.

**Standalone D3D11 graphics injector** - C++ / HLSL - shipped
A self-contained proxy-DLL post-processing layer built from first principles: tens of effects and dozens of HLSL shaders (ACES and AgX, TAA, SSR, volumetrics, bokeh depth of field), an ImGui interface, packaged with CMake and vcpkg. A companion engine bridges game state to a GPU pipeline (data trackers and shader systems including GTAO, SSR, SSGI, SDSM, volumetric clouds) over read-only shared-memory IPC.

**Color and calibration suite** - Python - shipped
Sensorless display calibration with ICC v4.4 and 3D-LUT generation and DDC/CI control; a color library spanning many color spaces and tone mappers with CIEDE2000, Oklab, CAT16, and color-vision-deficiency simulation.

**Multi-agent orchestration platform** - Python - active
A director-pattern platform: task routing to specialist agents, with meta-agents for decomposition, coordination, validation, and synthesis, and a model-agnostic provider abstraction behind a unified tool-use surface with MCP servers.

**Accountable verification flagships** - public - active / RC
An open line of engines that share one discipline: an orchestrator with a witnessed causal ledger (forum), an intake tool that attaches a provenance receipt to every item (gather), a repository map and dependency graph (index), a judgment organ that steelmans a thesis and measures what holds (crucible), and a byte-level witness that reads a file and reports MATCH, DRIFT, or UNVERIFIABLE rather than "trusted" (emet).

## Experience

### Independent Software Engineer / AI-Safety Researcher
**Self-employed - 2023-present - remote**

- Built the body of work above: compilers, real-time graphics and color, multi-agent AI systems, and the accountable-verification flagships.
- Architect and orchestrator across the full lifecycle, verifying and integrating every line.
- Wrote two defensive AI-safety papers on a jailbreak pattern against LLM coding assistants, as detection and governance guidance on a responsible-disclosure track.

### Freelance Technical Writer / Consultant
**2017-present - remote**

- Security and compliance documentation, API documentation, and proposal work. Hands-on with NIST 800-171, CMMC readiness, SOC 2, and ISO 27001 as control frameworks.
- Structured authoring and developer-facing API reference (REST, OAuth 2.0, OpenAPI). Python data-validation pipelines over large configuration sets.
- Stated here as capability only, with no client names and no compliance deliverables reproduced.

### Operations Manager / Lead Arborist
**Family business, Seattle area - 2015-present**

- Technical operations, client relations, scheduling, and business administration over more than a decade.
- Hundreds of written deliverables: proposals, site assessments, safety procedures, and client communications. Budget and vendor management.

### Technical Networking Support, Xbox Division
**Microsoft, Redmond, WA - 2013-2014**

- Diagnosed TCP/IP, DNS, NAT, and firewall issues for console networking across phone and chat. Contributed articles to internal knowledge-base documentation.

## Skills at a glance

**Languages** Python, Rust, C++, TypeScript, Lua, HLSL, C#, PowerShell, Bash
**Compilers and systems** lexer to codegen, multiple backends, ownership and lifetime analysis, D3D11 and proxy-DLL graphics, shared-memory IPC, CMake and vcpkg
**Graphics and color** real-time post-processing, GTAO, SSR, SSGI, TAA, tone mapping, CIE color, ICC and 3D-LUT, DDC/CI, sensorless calibration
**AI and LLM** multi-provider SDK integration, tool-use loops, multi-provider routing, MCP server authoring, agentic orchestration, worker and verifier separation
**Verification** provenance, witnessed ledgers, MATCH / DRIFT / UNVERIFIABLE verdicts, re-derivable proofs
**Tooling** Git and GitHub, pytest, GitHub Actions CI, PyQt6, Linux
**Documentation** security and compliance frameworks (NIST 800-171, CMMC, SOC 2, ISO 27001) as capability, API and developer documentation, structured authoring

## Fit

Most useful where a team needs an engineer who can own a hard systems problem end to end and is comfortable working alongside AI as an accountable collaborator rather than an unverified shortcut. Strong fits: compiler and language tooling, real-time graphics and color, multi-agent AI infrastructure, and any role where verification and provenance are part of the product rather than an afterthought.

Open to roles across quantum and scientific computing, finance, cybersecurity, machine learning and AI, and domain-agnostic systems work. Remote preferred; open to onsite, hybrid, contract, full-time, and project-based work.

## Background

Coding since middle school, working across eight production languages. No formal degree and no industry certifications. The public releases (crates.io, the VS Code Marketplace, the 900,000-download graphics framework) and the open repositories under github.com/HarperZ9 are the credential.

---

Updated 2026-06-30.
