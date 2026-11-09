// Certificate revocation for the Content Credentials validation report, offline. CMMNS reads
// revocation evidence it is handed: OCSP responses stapled in the manifest (the status at signing,
// C2PA 2.5 section 13.5.2), and CRLs or OCSP responses a caller fetched itself (the status now).
// Every list must be signed by the certificate's issuer and be current at the time given; anything
// less is "unknown", never "good". With nothing to read, the status now is "unknown".

import { DER } from "./der.js";
import { parseCertificate, verifyWithCert, bitString, algOf, pkiHex, pkiSame, EKU_OCSP } from "./c2pa-pki.js";

const { tlv, kids, oid, time } = DER;
const isTime = (n) => n && (n.tag === 0x17 || n.tag === 0x18);
const intHex = (b, n) => pkiHex(b.subarray(n.cs, n.end)).replace(/^(00)+(?=.)/, "");
const day = (iso) => (iso ? iso.slice(0, 10) : null);
// RFC 5280 reason codes, for the report's words.
const REASONS = ["unspecified", "keyCompromise", "cACompromise", "affiliationChanged", "superseded", "cessationOfOperation", "certificateHold", null, "removeFromCRL", "privilegeWithdrawn", "aACompromise"];
const unknown = (method, text, extra = {}) => ({ status: "unknown", method, text, ...extra });

function entryReason(b, extsN) {
  if (!extsN) return null;
  for (const e of kids(b, extsN)) {
    const p = kids(b, e);
    if (oid(b, p[0]) === "2.5.29.21") { const en = tlv(b, p[p.length - 1].cs); return REASONS[b[en.cs]] || "unspecified"; }
  }
  return null;
}

// { tbs, sigAlg, sig, issuerRaw, thisUpdate, nextUpdate, revoked: Map(serial -> { at, reason }) }.
export function parseCrl(der) {
  const b = der instanceof Uint8Array ? der : new Uint8Array(der);
  const [tbsN, algN, sigN] = kids(b, tlv(b, 0));
  let f = kids(b, tbsN);
  if (f[0].tag === 0x02) f = f.slice(1);
  const [, issuerN, thisN, ...rest] = f;
  const nextN = isTime(rest[0]) ? rest.shift() : null;
  const listN = rest[0] && rest[0].tag === 0x30 ? rest[0] : null;
  const revoked = new Map();
  for (const r of listN ? kids(b, listN) : []) {
    const [s, t, x] = kids(b, r);
    revoked.set(intHex(b, s), { at: time(b, t), reason: entryReason(b, x) });
  }
  return { tbs: b.subarray(tbsN.start, tbsN.end), sigAlg: algOf(b, algN), sig: bitString(b, sigN), issuerRaw: b.subarray(issuerN.start, issuerN.end), thisUpdate: time(b, thisN), nextUpdate: nextN ? time(b, nextN) : null, revoked };
}

// The status of leaf at time now from one CRL, which issuer must have signed.
export async function crlStatus(leaf, issuer, der, now) {
  let crl;
  try { crl = parseCrl(der); } catch { return unknown("crl", "the CRL cannot be read"); }
  const times = { authorityTime: crl.thisUpdate, nextUpdate: crl.nextUpdate };
  if (!issuer) return unknown("crl", "the issuer's certificate is missing, so the CRL's signature cannot be checked", times);
  if (!pkiSame(crl.issuerRaw, leaf.issuerRaw)) return unknown("crl", "the CRL is from another issuer", times);
  if ((await verifyWithCert(issuer, crl.sigAlg, crl.sig, crl.tbs)) !== true) return unknown("crl", "the CRL is not signed by the certificate's issuer", times);
  if (now < new Date(crl.thisUpdate)) return unknown("crl", `the CRL is dated ${day(crl.thisUpdate)}, after the time checked`, times);
  if (crl.nextUpdate && now > new Date(crl.nextUpdate)) return unknown("crl", `the CRL expired on ${day(crl.nextUpdate)}; a newer one is needed`, times);
  const hit = crl.revoked.get(leaf.serial);
  if (hit && hit.reason !== "removeFromCRL") return { status: "revoked", method: "crl", revokedAt: hit.at, reason: hit.reason, text: `the issuer's CRL of ${day(crl.thisUpdate)} lists the certificate as revoked since ${day(hit.at)}`, ...times };
  return { status: "good", method: "crl", text: `the issuer's CRL of ${day(crl.thisUpdate)} does not list the certificate`, ...times };
}

function singleResponse(b, n) {
  const [certId, st, thisN, ...rest] = kids(b, n);
  const [hashAlg, nameHash, keyHash, serial] = kids(b, certId);
  const out = { hashAlg: algOf(b, hashAlg), nameHash: b.subarray(nameHash.cs, nameHash.end), keyHash: b.subarray(keyHash.cs, keyHash.end), serial: intHex(b, serial), thisUpdate: time(b, thisN), nextUpdate: null };
  const nx = rest.find((x) => x.tag === 0xa0);
  if (nx) out.nextUpdate = time(b, kids(b, nx)[0]);
  if (st.tag === 0x80) out.status = "good";
  else if (st.tag === 0xa1) {
    const [rt, rr] = kids(b, st);
    out.status = "revoked"; out.revokedAt = time(b, rt);
    out.reason = rr ? REASONS[b[kids(b, rr)[0].cs]] || "unspecified" : null;
  } else out.status = "unknown";
  return out;
}

// { tbs, sigAlg, sig, responder: { name } | { keyHash }, producedAt, responses, certs } or null.
export function parseOcsp(der) {
  const b = der instanceof Uint8Array ? der : new Uint8Array(der);
  const [statusN, bytesN] = kids(b, tlv(b, 0));
  if (b[statusN.cs] !== 0 || !bytesN) return null;
  const [typeN, octN] = kids(b, kids(b, bytesN)[0]);
  if (oid(b, typeN) !== "1.3.6.1.5.5.7.48.1.1") return null;
  const basic = b.subarray(octN.cs, octN.end);
  const [tbsN, algN, sigN, certsN] = kids(basic, tlv(basic, 0));
  let f = kids(basic, tbsN);
  if (f[0].tag === 0xa0) f = f.slice(1);
  const [ridN, prodN, respN] = f, rid = kids(basic, ridN)[0];
  return {
    tbs: basic.subarray(tbsN.start, tbsN.end), sigAlg: algOf(basic, algN), sig: bitString(basic, sigN),
    responder: ridN.tag === 0xa1 ? { name: basic.subarray(rid.start, rid.end) } : { keyHash: basic.subarray(rid.cs, rid.end) },
    producedAt: time(basic, prodN), responses: kids(basic, respN).map((n) => singleResponse(basic, n)),
    certs: certsN ? kids(basic, kids(basic, certsN)[0]).map((n) => basic.slice(n.start, n.end)) : [],
  };
}

const HASHES = { "1.3.14.3.2.26": "SHA-1", "2.16.840.1.101.3.4.2.1": "SHA-256" };
const digest = async (alg, bytes) => new Uint8Array(await globalThis.crypto.subtle.digest(alg, bytes));

async function matches(r, leaf, issuer) {
  const alg = HASHES[r.hashAlg];
  if (!alg || r.serial !== leaf.serial) return false;
  return pkiSame(r.nameHash, await digest(alg, leaf.issuerRaw)) && pkiSame(r.keyHash, await digest(alg, issuer.keyBits));
}

const names = async (who, c) => (who.name ? pkiSame(who.name, c.subjectRaw) : pkiSame(who.keyHash, await digest("SHA-1", c.keyBits)));

// The certificate that signed the response: the issuer itself, or a responder the issuer
// authorised for OCSP signing (RFC 6960 section 4.2.2.2).
async function responder(o, issuer) {
  if (await names(o.responder, issuer)) return issuer;
  for (const der of o.certs) {
    let c; try { c = parseCertificate(der); } catch { continue; }
    if (!(await names(o.responder, c)) || !c.ext.eku.includes(EKU_OCSP) || !pkiSame(c.issuerRaw, issuer.subjectRaw)) continue;
    if ((await verifyWithCert(issuer, c.sigAlg, c.sig, c.tbs)) === true) return c;
  }
  return null;
}

// The status of leaf from one OCSP response. now: the time it must be current at, or null to read
// the response as of the moment it was produced (a stapled response records the status at signing).
export async function ocspStatus(leaf, issuer, der, now, method = "ocsp") {
  let o;
  try { o = parseOcsp(der); } catch { o = null; }
  if (!o) return unknown(method, "the OCSP response cannot be read or reports an error");
  if (!issuer) return unknown(method, "the issuer's certificate is missing, so the response's signature cannot be checked", { authorityTime: o.producedAt });
  const signer = await responder(o, issuer);
  if (!signer || (await verifyWithCert(signer, o.sigAlg, o.sig, o.tbs)) !== true) return unknown(method, "the OCSP response is not signed by the issuer or a responder it authorised", { authorityTime: o.producedAt });
  let r = null;
  for (const x of o.responses) if (await matches(x, leaf, issuer)) { r = x; break; }
  const times = { authorityTime: o.producedAt, nextUpdate: r ? r.nextUpdate : null };
  if (!r) return unknown(method, "the OCSP response is about another certificate", times);
  if (now && (now < new Date(r.thisUpdate) || (r.nextUpdate && now > new Date(r.nextUpdate)))) return unknown(method, `the OCSP response is not current at ${now.toISOString().slice(0, 10)}`, times);
  if (r.status === "revoked" && r.reason !== "removeFromCRL") return { status: "revoked", method, revokedAt: r.revokedAt, reason: r.reason, text: `the issuer's OCSP response of ${day(o.producedAt)} says revoked since ${day(r.revokedAt)}`, ...times };
  if (r.status === "unknown") return unknown(method, "the OCSP responder does not know the certificate", times);
  return { status: "good", method, text: `the issuer's OCSP response of ${day(o.producedAt)} says not revoked`, ...times };
}

// The status now from what the caller supplied: { crls: [DER], ocsp: [DER] }. A verified
// "revoked" from any source wins over a "good" from another.
export async function revocationNow(leaf, issuer, { crls = [], ocsp = [] } = {}, now = new Date()) {
  const checkedAt = now.toISOString();
  if (!crls.length && !ocsp.length) return { status: "unknown", method: null, checkedAt, text: "not checked: CMMNS works offline and was given no CRL or OCSP response for this certificate" };
  const results = [];
  for (const d of ocsp) results.push(await ocspStatus(leaf, issuer, d, now));
  for (const d of crls) results.push(await crlStatus(leaf, issuer, d, now));
  const pick = results.find((x) => x.status === "revoked") || results.find((x) => x.status === "good");
  if (pick) return { ...pick, checkedAt };
  return { status: "unknown", method: results[0].method, checkedAt, text: results.map((x) => x.text).join("; ") };
}

// The status at signing from OCSP responses stapled in the manifest (rVals).
export async function revocationAtSigning(leaf, issuer, stapled = []) {
  if (!stapled.length) return { status: "not-stapled", method: null, text: "the manifest carries no OCSP response from signing time" };
  const results = [];
  for (const d of stapled) results.push(await ocspStatus(leaf, issuer, d, null, "ocsp-stapled"));
  return results.find((x) => x.status === "revoked") || results.find((x) => x.status === "good") || results[0];
}
