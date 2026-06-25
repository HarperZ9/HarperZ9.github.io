// creative-io.js: Telos's creative organ on the witnessed-artifact I/O protocol. A generated design is
// emitted as an artifact carrying its generator + params + content hash; a peer re-derives it (re-runs the
// generator, re-hashes) to confirm it is exactly what it claims - reproducible, owned, tamper-evident
// creative output, the same contract as a discovered physical law.
import { GENERATORS, pathHash } from "./creative.js";
import { emitArtifact } from "./io-protocol.js";

export const creativeVerifiers = {
  design(recheck) {
    const gen = GENERATORS[recheck.generator];
    if (!gen) return "unverifiable";
    return pathHash(gen(recheck.params || {})) === recheck.hash ? "verified" : "refuted";
  },
};

// Emit a generated design as a witnessed artifact other flagships (or a plotter) can re-derive + verify.
export function designArtifact(generatorName, params = {}) {
  const gen = GENERATORS[generatorName];
  if (!gen) throw new Error("unknown generator: " + generatorName);
  const hash = pathHash(gen(params));
  return emitArtifact({
    flagship: "telos",
    kind: "design",
    subject: { generator: generatorName, medium: "plotter-svg" },
    claim: `design: ${generatorName}(${JSON.stringify(params)})`,
    certificate: { verdict: "verified", certified: true, criterion: "design re-derives from its generator + params to the same content hash" },
    recheck: { verifier: "design", generator: generatorName, params, hash },
  });
}
