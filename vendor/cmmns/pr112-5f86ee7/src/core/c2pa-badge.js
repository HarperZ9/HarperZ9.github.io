// One line for a file's Content Credentials: the strongest statement the validation report supports,
// and nothing stronger. A name on a certificate is only "signed by" when the chain reaches a trust
// anchor the caller supplied; otherwise it is the certificate's own claim. Revocation that was not
// checked is said to be unchecked, never "not revoked". An absent AI-origin field is named as absent.

const quote = (s) => `"${s}"`;
const signerName = (r) => (r.signer && (r.signer.subject.CN || r.signer.subject.O)) || "an unnamed signer";

function identity(r) {
  const who = signerName(r);
  if (r.chain.trusted === true) return { id: "signer", text: `signed by ${who}` };
  return { id: "signer", text: `valid signature from a certificate naming ${quote(who)}` };
}

function origin(r) {
  const f = r.fields;
  if (f.aiOrigin === "declared-ai") return { id: "ai-declared", text: `says it was made with generative AI${f.softwareAgent ? ` (${f.softwareAgent})` : ""}` };
  if (f.aiOrigin === "earlier-ai") return { id: "ai-declared", text: "says an earlier version was made with generative AI" };
  if (f.aiOrigin === "declared-not-ai") return { id: "source-declared", text: `declares its source: ${f.digitalSourceType.says} (${f.digitalSourceType.code})` };
  return { id: "ai-absent", text: "AI-origin field absent, which the spec does not require" };
}

function unchecked(r) {
  const open = [];
  if (r.chain.trusted === null) open.push("trust list");
  if (r.revocation.now.status === "unknown") open.push("revocation");
  if (r.binding.hard.valid === null) open.push("file bytes");
  if (r.formatNote) open.push("older manifest format");
  return open.length ? { id: "unchecked", text: `not checked: ${open.join(", ")}` } : null;
}

function early(r) {
  if (!r.found) return r.remote ? { level: "info", parts: [{ id: "remote", text: "credentials stored online; CMMNS did not fetch them" }] } : { level: "info", parts: [{ id: "none", text: "no Content Credentials found" }] };
  if (r.broken) return { level: "flag", parts: [{ id: "broken", text: `Content Credentials found but unreadable: ${r.broken}` }] };
  if (r.signature.valid === false) return { level: "flag", parts: [{ id: "signature-fails", text: "the signature does not match the claim: the credentials changed after signing, or another key signed them" }] };
  if (r.assertions.valid === false) return { level: "flag", parts: [{ id: "assertions-changed", text: `the claim is signed, but ${r.assertions.text}` }] };
  if (r.signature.valid === null) return { level: "info", parts: [{ id: "signature-unchecked", text: `signature not checked: ${r.signature.text}` }] };
  return null;
}

// { level: "info" | "warn" | "flag", text, parts: [{ id, text }] } for report r.
export function c2paBadge(r) {
  const stop = early(r);
  if (stop) return { ...stop, text: stop.parts.map((p) => p.text).join("; ") };
  const parts = [identity(r)];
  let level = "info";
  if (r.binding.hard.valid === false) { parts.push({ id: "changed", text: "the file changed after signing" }); level = "flag"; }
  const now = r.revocation.now;
  if (now.status === "revoked") { parts.push({ id: "revoked", text: `certificate revoked since ${(now.revokedAt || "").slice(0, 10)}` }); level = "flag"; }
  if (r.chain.trusted === false) { parts.push({ id: "untrusted", text: `the certificate does not chain to a trusted issuer (${r.chain.text})` }); if (level === "info") level = "warn"; }
  const o = origin(r);
  parts.push(o);
  if (o.id === "ai-declared" && level === "info") level = "warn";
  const u = unchecked(r);
  if (u) parts.push(u);
  return { level, text: parts.map((p) => p.text).join("; "), parts };
}
