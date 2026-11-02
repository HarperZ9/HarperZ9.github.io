// X.509 for the Content Credentials validation report: the signed part of a certificate, its serial,
// its raw names, the extensions that matter here, signature checks with WebCrypto, and the chain
// from the signer to a trust anchor the caller supplies. CMMNS ships no trust list and makes no
// network call, so with no anchors the chain is reported as unchecked, never as trusted.

import { DER, readCertificate } from "./der.js";

const { tlv, kids, oid } = DER;
const subtle = () => (globalThis.crypto && globalThis.crypto.subtle) || null;
export const pkiHex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
export const pkiSame = (a, b) => !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);

// Signature algorithm OIDs in certificates, CRLs and OCSP responses, as WebCrypto parameters.
const SIG = {
  "1.2.840.10045.4.3.2": ["ECDSA", "SHA-256"], "1.2.840.10045.4.3.3": ["ECDSA", "SHA-384"], "1.2.840.10045.4.3.4": ["ECDSA", "SHA-512"],
  "1.2.840.113549.1.1.11": ["RSASSA-PKCS1-v1_5", "SHA-256"], "1.2.840.113549.1.1.12": ["RSASSA-PKCS1-v1_5", "SHA-384"], "1.2.840.113549.1.1.13": ["RSASSA-PKCS1-v1_5", "SHA-512"],
  "1.3.101.112": ["Ed25519"],
};
const EXT = { basic: "2.5.29.19", eku: "2.5.29.37", crl: "2.5.29.31", aia: "1.3.6.1.5.5.7.1.1" };
export const EKU_OCSP = "1.3.6.1.5.5.7.3.9";

export const bitString = (b, n) => b.subarray(n.cs + 1, n.end);
export const algOf = (b, n) => oid(b, kids(b, n)[0]);

// Every URI (GeneralName tag [6]) inside a node, for the CRL and OCSP addresses a certificate names.
function uris(b, n, out = [], depth = 0) {
  if (n.tag === 0x86) out.push(new TextDecoder().decode(b.subarray(n.cs, n.end)));
  else if ((n.tag & 0x20) && depth < 8) for (const k of kids(b, n)) uris(b, k, out, depth + 1);
  return out;
}

function extensions(b, node) {
  const out = { ca: false, eku: [], crl: [], ocsp: [] };
  if (!node) return out;
  for (const e of kids(b, kids(b, node)[0])) {
    const parts = kids(b, e), id = oid(b, parts[0]), val = parts[parts.length - 1];
    const inner = tlv(b, val.cs);
    if (id === EXT.basic) { const k = kids(b, inner); out.ca = !!(k[0] && k[0].tag === 0x01 && b[k[0].cs]); }
    if (id === EXT.eku) out.eku = kids(b, inner).map((k) => oid(b, k));
    if (id === EXT.crl) out.crl = uris(b, inner);
    if (id === EXT.aia) for (const ad of kids(b, inner)) { const [m, loc] = kids(b, ad); if (oid(b, m) === "1.3.6.1.5.5.7.48.1") out.ocsp.push(...uris(b, loc)); }
  }
  return out;
}

// { der, tbs, sigAlg, sig, serial, issuerRaw, subjectRaw, keyBits, ext, info } from DER bytes.
export function parseCertificate(der) {
  const b = der instanceof Uint8Array ? der : new Uint8Array(der);
  const cert = tlv(b, 0), [tbsN, algN, sigN] = kids(b, cert);
  let f = kids(b, tbsN);
  if (f[0].tag === 0xa0) f = f.slice(1);
  const [serialN, , issuerN, , subjectN, spkiN] = f;
  const keyBits = bitString(b, kids(b, spkiN)[1]);
  return {
    der: b, tbs: b.subarray(tbsN.start, tbsN.end), sigAlg: algOf(b, algN), sig: bitString(b, sigN),
    serial: pkiHex(b.subarray(serialN.cs, serialN.end)).replace(/^(00)+(?=.)/, ""),
    issuerRaw: b.subarray(issuerN.start, issuerN.end), subjectRaw: b.subarray(subjectN.start, subjectN.end),
    keyBits, ext: extensions(b, f.find((x) => x.tag === 0xa3)), info: readCertificate(b),
  };
}

// An ECDSA signature in DER (SEQUENCE of r and s) as the fixed-width r||s WebCrypto expects.
function ecdsaRaw(sig, curve) {
  const size = { "P-256": 32, "P-384": 48, "P-521": 66 }[curve];
  if (!size) return null;
  const seq = tlv(sig, 0), out = new Uint8Array(size * 2);
  kids(sig, seq).forEach((n, i) => {
    let v = sig.subarray(n.cs, n.end);
    while (v.length > size && v[0] === 0) v = v.subarray(1);
    if (v.length > size) throw new Error("ecdsa: integer too long");
    out.set(v, i * size + size - v.length);
  });
  return out;
}

// Whether signer's key made sig over data with the named algorithm: true, false, or null when
// this browser or this module cannot check that algorithm.
export async function verifyWithCert(signer, sigAlg, sig, data) {
  const alg = SIG[sigAlg], info = signer.info;
  if (!alg || !subtle()) return null;
  const [name, hash] = alg;
  try {
    const params = name === "ECDSA" ? { name, namedCurve: info.curve } : name === "Ed25519" ? { name } : { name, hash };
    const key = await subtle().importKey("spki", info.spki, params, false, ["verify"]);
    const raw = name === "ECDSA" ? ecdsaRaw(sig, info.curve) : sig;
    if (!raw) return null;
    return await subtle().verify(name === "ECDSA" ? { name, hash } : { name }, key, raw, data);
  } catch (e) {
    if (/ecdsa:|der:/.test(String(e && e.message))) return false;
    return null;
  }
}

const within = (c, at) => !!c.info.notBefore && !!c.info.notAfter && at >= new Date(c.info.notBefore) && at <= new Date(c.info.notAfter);
const label = (c) => c.info.subject.CN || c.info.subject.O || "an unnamed certificate";
// true, false, or null when the signature algorithm cannot be checked here.
async function issuedBy(child, parent) {
  if (!pkiSame(child.issuerRaw, parent.subjectRaw)) return false;
  return verifyWithCert(parent, child.sigAlg, child.sig, child.tbs);
}

// Each certificate in the chain is signed by the next and valid at the time used. Links whose
// signature algorithm CMMNS cannot check are listed apart, so they never read as broken.
async function linkProblems(certs, at) {
  const problems = [], unchecked = [];
  for (const [i, c] of certs.entries()) {
    if (!within(c, at)) problems.push(`${label(c)} is outside its validity dates at ${at.toISOString().slice(0, 10)}`);
    const next = certs[i + 1];
    if (!next) continue;
    if (!next.ext.ca) problems.push(`${label(next)} is not marked as a certificate authority`);
    const ok = await issuedBy(c, next);
    if (ok === false) problems.push(`${label(c)} is not signed by ${label(next)}, the next certificate in the chain`);
    if (ok === null) unchecked.push(`CMMNS cannot check the signature algorithm on ${label(c)}`);
  }
  return { problems, unchecked };
}

// The chain the signature carries, checked against anchors (DER) at time at.
// { trusted: true | false | null, at, length, anchor, problems, text }.
export async function chainStatus(chainDer, { at, anchors = [] } = {}) {
  const when = at instanceof Date ? at : new Date(at || Date.now());
  let certs;
  try { certs = chainDer.map(parseCertificate); } catch { return { trusted: false, at: when.toISOString(), length: chainDer.length, anchor: null, problems: ["a certificate in the chain cannot be read"], text: "a certificate in the chain cannot be read" }; }
  const base = { at: when.toISOString(), length: certs.length, anchor: null };
  const { problems, unchecked } = await linkProblems(certs, when);
  if (problems.length) return { ...base, trusted: false, problems, text: problems[0] };
  if (unchecked.length) return { ...base, trusted: null, problems: [], text: unchecked[0] };
  if (!anchors.length) return { ...base, trusted: null, problems: [], text: "no trust list was loaded, so CMMNS did not check who issued the certificate" };
  const top = certs[certs.length - 1];
  for (const a of anchors.map(parseCertificate)) {
    if (!within(a, when)) continue;
    if (pkiSame(a.der, top.der) || (await issuedBy(top, a)) === true) return { ...base, anchor: a.info.subject, trusted: true, problems: [], text: `the chain reaches ${label(a)}, a trust anchor CMMNS was given` };
  }
  return { ...base, trusted: false, problems: ["the chain reaches no trust anchor CMMNS was given"], text: "the chain reaches no trust anchor CMMNS was given" };
}
