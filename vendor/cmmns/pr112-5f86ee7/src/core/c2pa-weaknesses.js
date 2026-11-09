// Known weaknesses of the C2PA specification itself, each tied to the clause that allows it, and the
// test of whether it applies to one file's validation report. Sections cite C2PA 2.5 (October 2026);
// the same text is in 2.3 (January 2026). Sources: Golaszewski et al. 2026, "Verifying Provenance of
// Digital Media: Why the C2PA Specifications Fall Short", arXiv:2604.24890 (versions 2.2 to 2.4), and
// Nemecek et al. 2026, "Authenticated Contradictions from Desynchronized Provenance and
// Watermarking", arXiv:2603.02378.

const GOLASZEWSKI = "arXiv:2604.24890";
const NEMECEK = "arXiv:2603.02378";

export const C2PA_WEAKNESSES = Object.freeze([
  {
    id: "revocation-optional", spec: "C2PA 2.5 sections 13.3.5 and 14.9.2", source: GOLASZEWSKI,
    title: "Revocation checking is optional",
    detail: "A validator may skip the online revocation check and still call the manifest valid; skipping only adds an informational code. Other tools can show this file as valid without ever asking whether its certificate was revoked.",
    applies: (r) => r.signature.valid === true,
  },
  {
    id: "revoked-after-signing", spec: "C2PA 2.5 sections 14.9.1 and 14.9.2", source: GOLASZEWSKI,
    title: "A later revocation does not undo earlier signatures",
    detail: "The spec judges revocation at the time of signing. A file time-stamped before the revocation date still counts as not revoked, including one signed between a key's compromise and its revocation. A validator that finds an OCSP response stapled at signing time, with a time stamp, may accept it and never ask again (section 14.9.1).",
    applies: (r) => r.revocation.now.status === "revoked",
  },
  {
    id: "no-revocation-pointer", spec: "C2PA 2.5 section 14.9", source: GOLASZEWSKI,
    title: "No way to ask whether the certificate was revoked",
    detail: "The certificate names no OCSP or CRL address, and the spec tells validators to treat such a certificate as not revoked.",
    applies: (r) => !!r.signer && !r.signer.revocationPointers.ocsp.length && !r.signer.revocationPointers.crl.length,
  },
  {
    id: "timestamp-unbound", spec: "C2PA 2.5 sections 10.3.2.5.4 and 14.8.2", source: GOLASZEWSKI,
    title: "The time stamp sits outside the signed data",
    detail: "The time stamp is stored in an unprotected header, so it can be removed or replaced without breaking the signature, and a failed time stamp is ignored rather than rejected. The spec also leaves the time-stamp authority's own revocation unchecked. CMMNS does not check time-stamp tokens.",
    applies: (r) => r.timestamp.present,
  },
  {
    id: "expiry-unverifiable", spec: "C2PA 2.5 section 14.8.2", source: GOLASZEWSKI,
    title: "Without a time stamp, the file stops validating when its certificate expires",
    detail: "With no trusted time stamp, validators check the certificate against the current time, so once it expires the same unchanged file fails validation.",
    applies: (r) => r.signature.valid === true && !r.timestamp.present,
  },
  {
    id: "ai-origin-optional", spec: "C2PA 2.5 sections 16.4.1.2 and 14.10.1.2", source: NEMECEK,
    title: "The AI-origin field is not required",
    detail: "A digital source type is required only with a c2pa.created action, never with c2pa.opened, and no validator step checks for it. A manifest that leaves out the AI-origin field passes validation, whatever made the pixels.",
    applies: (r) => r.signature.valid === true && r.fields.aiOrigin === "absent",
  },
  {
    id: "exclusion-range", spec: "C2PA 2.5 section 16.3.1.1", source: GOLASZEWSKI,
    title: "Some bytes of the file are not covered by the hash",
    detail: "The data hash excludes byte ranges beyond the credentials themselves. The spec allows those ranges to hold metadata such as EXIF or IPTC, which can then change without breaking the binding.",
    applies: (r) => (r.binding.hard.exclusions || []).some((e) => !e.onlyCredentials),
  },
  {
    id: "soft-binding-not-cryptographic", spec: "C2PA 2.5 section 2.3.14", source: GOLASZEWSKI,
    title: "A soft binding is a fingerprint or watermark, not a hash",
    detail: "Soft bindings are not statistically unique and can match other content. CMMNS does not check them.",
    applies: (r) => r.binding.soft.present,
  },
  {
    id: "validators-disagree", spec: null, source: GOLASZEWSKI,
    title: "Conforming validators can disagree",
    detail: "Certification rests largely on self-reported compliance, and the same file has been shown valid by one conforming tool and invalid by another.",
    applies: (r) => r.signature.valid === true,
  },
]);

// The weaknesses that apply to report r, without their tests, ready for JSON.
export function applicableWeaknesses(r) {
  return C2PA_WEAKNESSES.filter((w) => w.applies(r)).map(({ id, title, detail, spec, source }) => ({ id, title, detail, spec, source }));
}
