# Telos Discovery Engine

A cheap, stateless language model rediscovers real laws of physics from perception alone, and
every result it submits is checked by a sound verifier that carries a re-checkable certificate.

The engine provides; the model solves. The engine simulates a governed system, exposes its
physical state over time, hands the model a few tools, and certifies answers. The model, seeing
only that data (never the equations), proposes which terms a conserved quantity is built from.
A tool fits the weights; the verifier certifies the result across independent initial conditions.
The model supplies the physical insight; the engine supplies the numerics and the proof. The
model can be cheap precisely because the verifier is sound and the tools carry the arithmetic.

## What it actually demonstrates

- A local 3B model rediscovers energy conservation for the harmonic oscillator from raw data.
- A local 7B model rediscovers, from perception alone, across six systems: energy (SHO, pendulum,
  2D oscillator, quantum oscillator), angular momentum (Kepler), and momentum (free quantum particle).
- It discovers how MANY independent conservation laws a system has (3 for the superintegrable 2D
  oscillator: E_x, E_y, L_z; 1 for the 1D oscillator).
- It solves the time-independent Schrodinger equation and discovers the quantization rule: the
  equally-spaced ladder E_n = (n + 1/2) hbar omega for the harmonic oscillator, a quadratic spectrum
  for a box.

This is REDISCOVERY of known laws, used to prove the loop and the verifier are sound. It is not new
physics and not "physics solved." The mechanism (perceive, propose, verify soundly, certify) is
general; coverage grows with the model's reach and is reported honestly. Reach is bounded by two
things: how sound the verifier is, and how strong the model + tools + perception scaffold is.

## The verifier (the sound floor)

A quantity is certified conserved iff its spread ALONG a trajectory is tiny relative to its spread
ACROSS phase space, holding across several independent initial conditions. That ratio is
scale-invariant and additive-constant robust. The verifier refuses non-conserved quantities, damped
systems, trivial constants, additive-constant gaming, the small-angle approximation of the pendulum,
and a basis that lacks the needed terms. Across every test and live run it never certified anything
false. Certificates reuse `shared-frame/certificate.js` and re-check two ways: the verdict logic
re-derives from the evidence, and the physics re-runs from the embedded parameters.

## Run it

- Tests (zero dependency, Node 18+):
  `node --test system/discovery/discovery.test.mjs system/discovery/quantum.test.mjs`  (42 tests)
- Watch a cheap local model solve a system (needs Ollama with the model pulled):
  `node system/discovery/run-discovery.mjs <sho|pendulum|kepler|oscillator2d|qho|free> <model>`
  e.g. `node system/discovery/run-discovery.mjs sho qwen2.5:7b`
- The live browser lab: serve the site root, then open `system/discovery/lab.html`. Pick a system,
  fit candidate terms, watch the certificate; "perturb" changes the initial condition and re-verifies.

## Modules

- `systems.js` classical systems (SHO, pendulum, Kepler, 2D oscillator) with symplectic dynamics.
- `quantum.js` 1D Schrodinger: split-step TDSE + a pure-JS FFT + observables + the TISE spectrum.
- `quantum-system.js` quantum systems (harmonic oscillator, free particle) as discovery targets.
- `integrator.js` velocity-Verlet + the `trajectory()` seam that serves classical and quantum alike.
- `expr.js` a safe, zero-eval expression evaluator (allowlisted tokens; no JS reachable).
- `observables.js` the perception channel: the physical state/moments the model sees.
- `verify.js` the sound conservation oracle + the witnessed certificate.
- `reference.js` the `fit` engine (least-variance) + `conservedSubspace` (how many independent laws).
- `tools.js` the model's tools: evaluate, fit, discoverLaws, submit.
- `llm.js` + `run-discovery.mjs` the cheap-model solve loop and its live harness.
- `lab.html` + `lab.js` the engine live in the browser.

## I/O protocol (flagship interop)

`io-protocol.js` defines `telos.witnessed-artifact/v1`: how the engine exchanges results with the other
flagships. A flagship `emitArtifact(...)` with its claim, a compact certificate, and a `recheck` descriptor
(which verifier re-runs it, with what parameters). A consuming flagship calls `verifyArtifact(artifact,
verifiers)`, which RE-RUNS the named verifier and confirms the verdict reproduces - so a peer trusts the
proof, not the emitter, and a forged or drifted artifact is caught (it does not reproduce). The envelope is
shared; each flagship registers verifiers for the kinds it understands. Telos's binding (`discovery-io.js`)
emits discovered laws as `conservation-law` artifacts and registers a verifier that re-runs the sound
oracle. The Studio's Physics source exports a verified law as one of these artifacts ("Export artifact").
This is the reconcile spine (carry a re-checkable proof) made into the inter-flagship contract.

## Honest limits

- The 3B solves only the easy system; the still-cheap 7B reaches all six. Both are bounded by whether
  the model proposes the right features (the SINDy division of labor: the model picks the library, the
  tool fits coefficients, the verifier certifies).
- Finite-difference / finite-grid numerics; classical tolerances tuned per system.
- Rediscovery of known laws, not novel discovery. Novel discovery is the same loop pointed at a system
  whose law is genuinely unknown, with the verifier still the floor.
