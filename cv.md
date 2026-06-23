# Zain Dana Harper — Curriculum Vitae

**Systems engineer · AI accountability · compilers · real-time graphics · security**
Independent · Seattle · since 2023
[harperz9.github.io](https://harperz9.github.io) · [github.com/HarperZ9](https://github.com/HarperZ9) · zaindharper@gmail.com

---

## Profile

A self-taught systems engineer working across an unusually wide stack — compiler internals,
real-time graphics, color science, AI accountability, and offensive/defensive security — held
together by a single discipline: **everything proves itself.** No claim ships without a test, a
witnessed byte, or an inspectable artifact beside it; maturity is labeled, never inflated.

The current work is the accountability layer the agentic era requires: making a machine's
perception and action *answerable to evidence* instead of asserted. It is built on years of the
opposite discipline — understanding how systems are attacked and evaded, red-teamed to where they break — because
you build an honest system best when you know every way one lies. That arc, adversary to
accountability, is the through-line.

## Areas of expertise

- **AI accountability & provenance** — witnessed perception, default-deny authorization gates,
  bilateral provenance, cryptographic witnessing, content-addressed state.
- **Compilers & languages** — lexing, parsing, type systems, effect systems, interprocedural
  lifetime analysis, native codegen.
- **Real-time graphics** — D3D11 rendering, screen-space GI/AO/reflections (GTAO, SSGI, SSR),
  HLSL/GLSL shader engineering, HDR tone mapping, proxy-DLL pipeline injection, GPU state capture.
- **Color science** — perceptual color spaces, CIECAM02/CAM16, ΔE, ICC, HDR tone mapping.
- **Reverse engineering & security** — binary analysis & decompilation, proxy-DLL interception,
  live memory/state re-derivation, instrumentation, anti-cheat & proprietary-engine RE, systems-level
  integrity (build-and-break, in service of defense).
- **Native & systems** — native driver development (DDC/CI display control, standalone of ArgyllCMS),
  signal & information theory (entropy, mutual information, Granger, PELT, FFT), CMake/C++ build,
  SKSE/plugin architecture.
- **Agent systems & orchestration** — scoped/expiring authority, witnessed action, capability platforms.

## The body of work

### The accountability spine *(flagship)*

A composable stack that instantiates one loop — **perceive → gate → act → verify → witness**:

- **EMET** — the witness. Re-derives a file's bytes and answers MATCH / DRIFT / UNVERIFIABLE,
  never *trusted*. 19/19 conformance across three independent language implementations
  (Python · Rust · Node).
- **coherence-membrane** — the read-gate. Turns a model's state-blindness into witnessed,
  re-derivable observations across an organ family (visual, raw, region, structured, audio,
  caption). Zero dependencies; **312 tests**; PyPI.
- **proof-surface** — the write-gate. A default-deny, fail-closed authorization contract: expiring
  least-privilege grants, work-record receipts, delegation chains rooted in a real human with
  monotonic scope attenuation. Stdlib-only; **258 tests**; PyPI.
- **accountable-surface** — the loop. A model perceives natively, acts only on an *allow*, and
  re-perceives to confirm. MCP server + filesystem/web/command effectors, inert until authorized;
  **201 tests**, including a 39-test adversarial integrity suite (forge a digest, manufacture a
  grant, escape a bound — each refused).
- **accountable-engine** — the bilateral critic: the same evidentiary standard turned on the
  operator, not only the machine.

### Compilers & languages

- **QuantaLang / quantac** — a typed-effects language. A function's signature names the effects it
  may perform and the lifetimes of the references it returns; the compiler checks both and lowers
  to native code through a C backend. **999 tests**; C backend end-to-end; other targets experimental.

### Systems & graphics

- **signal-kernels** — header-only C++23: entropy, mutual information, divergences, Granger
  causality, PELT changepoint, FFT.
- **anomaly-kernels** — C++23 anomaly detection: baselines, z-score/IQR, temporal correlation.
- **RAW** (Rendering Advancement Workshop) — a public real-time D3D11 rendering platform: a proxy
  DLL owning the pipeline with mid-frame dispatch of screen-space GI, AO, and reflections (GTAO,
  SSGI, SSR, skylighting). Reverse-engineering/graphics origin, maturing toward the substrate's
  spatial, live-state visual engine.
- **gpu-trace-validator** — a focused public tool: validate GPU-trace JSON against a schema, emit bounded receipts.

### Color science

- **quanta-color** — 15+ color spaces, CIECAM02/CAM16, perceptual ΔE, ICC, HDR tone mapping; GUI
  and CLI; PyPI v1.0.1.
- **calibrate-pro** — Windows display calibration; DDC/CI, ICC / 3D-LUT output.

### Release & agent toolkit *(shipping discipline)*

**19 packages on PyPI**, each tested and released — secret-redact-io, release-surface-scanner,
public-surface-sweeper, repo-proof-index, model-provenance-validator, provenance-sensorium,
proof-surface-report, agent-audit, agent-hook-pack, agent-routing-kit, context-curator-lite,
workflow-harness-lite, workspace-repo-map, and more.

### Security & platform *(private; by capability)*

- A C++23 **integrity / anti-cheat framework** (~3,000 tests across ~59 modules) — detecting
  tampering, evasion, and manipulation by understanding exactly how they are done.
- An **agent-orchestration / capability platform** — scoped, expiring, witnessed authority at
  scale; the production substrate the public accountability organs were extracted from.
- Binary reverse-engineering, instrumentation, and red-team research across the stack — repurposed
  inward, to make the accountability platform self-accountable by adversarial construction.

## Research & writing

- **The Accountability Conjecture** (*THEORY.md*) — a falsifiable theory of intrinsic, bilateral
  accountability, with a working proof-of-concept; states its own epistemic status (pre-proof) and
  the path to a law. MIT, dated, authored.
- **Senses and Sensibility** (*THESIS.md*) — the concise statement of the four principles and the
  accountable loop.
- ***Conferred Existence*** — a long-form philosophical corpus (no-aseity, the membrane, the arity
  gap, the forcing argument) from which the accountability thesis is extracted; **published** at
  [senses-and-sensibility](https://github.com/HarperZ9/senses-and-sensibility) (MIT, dated).

## Selected receipts

19/19 EMET conformance · 312 coherence-membrane tests · 258 proof-surface tests · 201
accountable-surface tests (39 adversarial) · 999 QuantaLang tests · ~3,000 integrity-framework
tests · 19 PyPI releases · a live, inspectable, proof-first portfolio.

## Approach

Curious to a fault — ideas from biology, geometry, and color perception routinely end up in the
software (the portfolio's own imagery is real mathematics rendered from original macro photography).
Honest about limits, in public, with receipts. Build, *and* break — every guarantee tested against
the attack it claims to survive.

## Note

No computer-science degree. Independent since 2023. The work is the credential, and it is all
inspectable. · Updated 2026-06-20.
