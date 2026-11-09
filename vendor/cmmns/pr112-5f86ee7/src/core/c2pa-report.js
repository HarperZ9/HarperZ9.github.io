// The Content Credentials validation report: each check CMMNS can make on a file's C2PA manifest,
// in its own field, so a valid signature is never read as more than it is. Fields: the signature,
// the certificate chain against trust anchors the caller supplies, revocation at signing (stapled
// OCSP) and now (CRLs or OCSP responses the caller supplies, else "unknown"), the manifest fields
// present or absent, the binding to the file, and the spec-level weaknesses that apply.
// The JSON shape is documented in project-docs/C2PA-REPORT.md and schema/c2pa-report.v1.json.

import { cborDecode } from "./cbor.js";
import { findManifestStore, parseStore, childByLabel } from "./jumbf.js";
import { readCredentials } from "./c2pa.js";
import { parseCertificate, chainStatus } from "./c2pa-pki.js";
import { revocationNow, revocationAtSigning } from "./c2pa-revocation.js";
import { applicableWeaknesses } from "./c2pa-weaknesses.js";
import { c2paBadge } from "./c2pa-badge.js";

export const C2PA_REPORT_SCHEMA = "cmmns.c2pa-report/1";
const base = (label) => String(label || "").replace(/__\d+$/, "");
const first = (box) => (box && box.content && box.content[0]) || null;
const decode = (box) => { const c = first(box); if (!c) return null; try { return c.type === "json" ? JSON.parse(new TextDecoder().decode(c.data)) : cborDecode(c.data); } catch { return null; } };
const bytesList = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter((x) => x instanceof Uint8Array);

// The raw pieces the reader does not keep: certificate chain, stapled OCSP, time stamp headers,
// assertion labels, hash exclusions and soft bindings of the active manifest.
function material(file) {
  const found = findManifestStore(file), store = parseStore(found.store);
  const m = store.manifests[store.manifests.length - 1];
  const assertions = (childByLabel(m, "c2pa.assertions") || {}).content || [];
  let prot = {}, unprot = {};
  try {
    const s = cborDecode(first(childByLabel(m, "c2pa.signature")).data), arr = s && s.tag === 18 ? s.value : s;
    prot = arr[0] && arr[0].length ? cborDecode(arr[0]) : {}; unprot = arr[1] || {};
  } catch { /* the reader reports an unreadable signature */ }
  const labels = assertions.map((a) => a.label);
  const hash = decode(assertions.find((a) => base(a.label) === "c2pa.hash.data")) || null;
  const soft = assertions.filter((a) => /^c2pa\.soft-binding/.test(base(a.label))).map((a) => (decode(a) || {}).alg || null);
  return {
    chain: bytesList(prot["33"] || unprot["33"]), stapled: bytesList(unprot.rVals && unprot.rVals.ocspVals),
    timestamp: !!(unprot.sigTst || unprot.sigTst2), labels, hash, hardLabel: labels.map(base).find((l) => /^c2pa\.hash\./.test(l)) || null,
    soft, ranges: found.ranges || [],
  };
}

function aiOrigin(r) {
  const withSource = r.active.actions.find((a) => a.source);
  if (r.active.ai) return "declared-ai";
  if (r.aiAnywhere) return "earlier-ai";
  return withSource ? "declared-not-ai" : "absent";
}

function fields(r, mat) {
  const src = (r.active.actions.find((a) => a.source && a.source.kind === "ai") || r.active.actions.find((a) => a.source) || {});
  return {
    title: r.active.title || null, claimGenerator: r.active.generator || null, claimVersion: r.active.claimVersion,
    actions: r.active.actions.map((a) => ({ action: a.action || null, digitalSourceType: a.source ? a.source.code : null, softwareAgent: a.agent || null })),
    firstAction: (r.active.actions[0] || {}).action || null,
    digitalSourceType: src.source ? { code: src.source.code, says: src.source.says, kind: src.source.kind } : null,
    softwareAgent: src.agent || null, aiOrigin: aiOrigin(r),
    aiDisclosureAssertion: mat.labels.some((l) => /^c2pa\.ai-disclosure/.test(base(l))),
    assertions: mat.labels, earlierManifests: (r.earlier || []).map((e) => ({ title: e.title || null, generator: e.generator || null, ai: !!e.ai, signatureValid: e.signature ? e.signature.ok : null })),
  };
}

function binding(r, mat) {
  const inside = (e) => mat.ranges.some(([s, t]) => e.start >= s && e.start + e.length <= t);
  const span = mat.ranges.length ? [mat.ranges[0][0], mat.ranges[mat.ranges.length - 1][1]] : null;
  const exclusions = ((mat.hash && mat.hash.exclusions) || []).map((e) => ({ start: e.start, length: e.length, onlyCredentials: inside(e) || (!!span && e.start >= span[0] && e.start + e.length <= span[1]) }));
  return {
    hard: { type: mat.hardLabel, valid: r.checks.binding.ok, text: r.checks.binding.text, exclusions },
    soft: { present: mat.soft.length > 0, algorithms: mat.soft.filter(Boolean), checked: false },
  };
}

function signer(leaf) {
  if (!leaf) return null;
  const i = leaf.info;
  return { subject: i.subject, issuer: i.issuer, serial: leaf.serial, notBefore: i.notBefore, notAfter: i.notAfter, selfIssued: i.selfIssued, revocationPointers: { ocsp: leaf.ext.ocsp, crl: leaf.ext.crl } };
}

// The issuer of leaf: the next certificate in the chain, or an anchor whose name matches.
function issuerOf(certs, anchors) {
  if (certs[1]) return certs[1];
  for (const d of anchors) { try { const a = parseCertificate(d); if (certs[0] && a.subjectRaw.join() === certs[0].issuerRaw.join()) return a; } catch { /* skip an unreadable anchor */ } }
  return null;
}

async function pki(mat, opts, now) {
  let certs = [];
  try { certs = mat.chain.map(parseCertificate); } catch { certs = []; }
  const leaf = certs[0] || null, issuer = issuerOf(certs, opts.trustAnchors || []);
  const chain = mat.chain.length ? await chainStatus(mat.chain, { at: now, anchors: opts.trustAnchors || [] }) : { trusted: null, at: now.toISOString(), length: 0, anchor: null, problems: [], text: "the signature carries no certificate" };
  chain.timeSource = "validation time: CMMNS does not check time-stamp tokens, and without a trusted one the spec checks the certificate at the current time";
  const revocation = leaf
    ? { atSigning: await revocationAtSigning(leaf, issuer, mat.stapled), now: await revocationNow(leaf, issuer, { crls: opts.crls || [], ocsp: opts.ocsp || [] }, now) }
    : { atSigning: { status: "not-stapled", method: null, text: "no certificate to check" }, now: { status: "unknown", method: null, checkedAt: now.toISOString(), text: "no certificate to check" } };
  const s = revocation.atSigning;
  if (!mat.timestamp && (s.status === "good" || s.status === "revoked")) s.text += "; the spec counts a stapled response only alongside a trusted time stamp, and this manifest has none";
  return { leaf, chain, revocation };
}

const finish = (rep) => { rep.weaknesses = rep.found && !rep.broken ? applicableWeaknesses(rep) : []; rep.badge = c2paBadge(rep); return rep; };

// bytes: the whole file. opts: { now, trustAnchors: [DER], crls: [DER], ocsp: [DER], complete }.
// Resolves to plain JSON (no byte arrays), so it can be stored, sent or rendered as is.
export async function c2paReport(bytes, opts = {}) {
  const file = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const now = opts.now ? new Date(opts.now) : new Date();
  const r = await readCredentials(file, { complete: opts.complete !== false });
  const rep = { schema: C2PA_REPORT_SCHEMA, spec: "C2PA 2.5", checkedAt: now.toISOString(), found: !!r.found, format: r.format || null };
  if (!r.found) return finish({ ...rep, remote: r.remote || null });
  if (r.broken) return finish({ ...rep, broken: r.broken });
  const mat = material(file), { leaf, chain, revocation } = await pki(mat, opts, now);
  return finish({
    ...rep, manifests: r.manifests,
    signature: { valid: r.checks.signature.ok, alg: r.active.alg || null, text: r.checks.signature.text },
    assertions: { valid: r.checks.assertions.ok, text: r.checks.assertions.text },
    signer: signer(leaf), chain, revocation,
    timestamp: { present: mat.timestamp, checked: false },
    fields: fields(r, mat), binding: binding(r, mat),
    formatNote: r.checks.format ? r.checks.format.text : null,
  });
}
