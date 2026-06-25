// io-protocol.js: the Telos witnessed-artifact I/O protocol - how the flagships exchange results.
//
// A flagship emits a WITNESSED ARTIFACT: its claim, a compact certificate, and a `recheck` descriptor
// naming WHICH verifier re-runs it and with WHAT parameters. A consuming flagship calls verifyArtifact,
// which RE-RUNS the named verifier and confirms the verdict reproduces - so a peer trusts the PROOF, not
// the emitter, and a forged or drifted artifact is caught. This is the reconcile spine (carry a
// re-checkable proof) made into the inter-flagship contract. The envelope is shared; each flagship
// registers verifiers for the kinds it understands. Zero dependencies; pure data + a dispatch.

export const PROTOCOL = "telos.witnessed-artifact/v1";

// Build a witnessed artifact. `certificate` is reduced to its portable core; `recheck` is the
// re-derivation descriptor: { verifier: "<name>", ...params } that a peer feeds back to verifyArtifact.
export function emitArtifact({ flagship, kind, subject = {}, claim = "", certificate = {}, recheck = null }) {
  return {
    protocol: PROTOCOL,
    flagship: String(flagship || "unknown"),
    kind: String(kind || "artifact"),
    subject,
    claim: String(claim),
    certificate: {
      verdict: certificate.verdict || "unverifiable",
      certified: !!certificate.certified,
      criterion: certificate.criterion || null,
    },
    recheck,
  };
}

export function isArtifact(a) {
  return !!(a && a.protocol === PROTOCOL && a.recheck && typeof a.recheck.verifier === "string");
}

// A small deterministic content hash (FNV-1a over a string): content-addresses any external output.
export function contentHash(s) {
  let h = 0x811c9dc5; const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return ("00000000" + h.toString(16)).slice(-8);
}

// INGEST: wrap an external tool's output (an SVG, an OBJ, a video frame, any string/bytes) as a witnessed,
// tamper-evident Telos artifact. The layer over the stack: a Blender / Maya / TouchDesigner / NLE export
// becomes a re-verifiable artifact with recorded provenance. Re-check with checkContent(artifact, content).
export function importArtifact(source, kind, content, meta = {}) {
  return emitArtifact({
    flagship: String(source || "external"),
    kind: String(kind || "imported"),
    subject: { source: String(source || "external"), ...meta },
    claim: `imported ${kind} from ${source}`,
    certificate: { verdict: "verified", certified: true, criterion: "content matches its recorded hash (provenance + tamper-evidence)" },
    recheck: { verifier: "content", hash: contentHash(content) },
  });
}

// Re-verify an imported artifact against the content in hand: the hash must reproduce (intact + authentic).
export function checkContent(artifact, content) {
  return !!(isArtifact(artifact) && artifact.recheck.verifier === "content" && artifact.recheck.hash === contentHash(content));
}

// Re-verify an artifact by re-running its named verifier (from a registry) and comparing the reproduced
// verdict to the one the artifact carries. `verifiers` maps verifier-name -> (recheck) -> verdictString.
// Returns { ok, reproduced, carried, matches, reason }. matches === true means the proof re-checks live.
export function verifyArtifact(artifact, verifiers) {
  if (!isArtifact(artifact)) return { ok: false, matches: false, reason: "not a telos witnessed artifact" };
  const fn = verifiers && verifiers[artifact.recheck.verifier];
  if (typeof fn !== "function") return { ok: false, matches: false, reason: `no verifier registered for '${artifact.recheck.verifier}'` };
  let reproduced;
  try { reproduced = fn(artifact.recheck); }
  catch (e) { return { ok: false, matches: false, reason: "verifier threw: " + (e && e.message ? e.message : String(e)) }; }
  const carried = artifact.certificate.verdict;
  return { ok: true, reproduced, carried, matches: reproduced === carried };
}
