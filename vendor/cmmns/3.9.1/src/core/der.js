// Just enough DER (X.690) to read an X.509 certificate from a C2PA signature: who it names, who
// issued it, its validity dates and its public key in a form WebCrypto can import.

function tlv(b, i) {
  const tag = b[i];
  let len = b[i + 1], h = 2;
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let k = 0; k < n; k++) len = len * 256 + b[i + 2 + k]; h = 2 + n; }
  if (i + h + len > b.length) throw new Error("der: truncated");
  return { tag, start: i, cs: i + h, end: i + h + len };
}

function kids(b, node) {
  const out = [];
  for (let i = node.cs; i < node.end;) { const k = tlv(b, i); out.push(k); i = k.end; }
  return out;
}

function oid(b, n) {
  const v = b.subarray(n.cs, n.end), parts = [Math.floor(v[0] / 40), v[0] % 40];
  let x = 0;
  for (let k = 1; k < v.length; k++) { x = x * 128 + (v[k] & 0x7f); if (!(v[k] & 0x80)) { parts.push(x); x = 0; } }
  return parts.join(".");
}

const NAMES = { "2.5.4.3": "CN", "2.5.4.10": "O", "2.5.4.11": "OU", "2.5.4.6": "C", "2.5.4.7": "L", "2.5.4.8": "ST", "1.2.840.113549.1.9.1": "email" };
const td = new TextDecoder();

function name(b, n) {
  const out = {};
  for (const rdn of kids(b, n)) for (const atv of kids(b, rdn)) {
    const [t, v] = kids(b, atv), key = NAMES[oid(b, t)];
    if (key && !out[key]) out[key] = td.decode(b.subarray(v.cs, v.end));
  }
  return out;
}

function time(b, n) {
  const s = td.decode(b.subarray(n.cs, n.end));
  const m = n.tag === 0x17 ? s.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?Z$/) : s.match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?Z$/);
  if (!m) return null;
  const y = n.tag === 0x17 ? (+m[1] < 50 ? 2000 + +m[1] : 1900 + +m[1]) : +m[1];
  return new Date(Date.UTC(y, +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))).toISOString();
}

const KEY = { "1.2.840.10045.2.1": "ec", "1.2.840.113549.1.1.1": "rsa", "1.2.840.113549.1.1.10": "rsa-pss", "1.3.101.112": "ed25519" };
const CURVE = { "1.2.840.10045.3.1.7": "P-256", "1.3.132.0.34": "P-384", "1.3.132.0.35": "P-521" };

// An RSA-PSS key re-labelled as rsaEncryption, which is the only RSA form WebCrypto imports.
function rsaSpki(b, keyBits) {
  const bits = b.subarray(keyBits.start, keyBits.end);
  const alg = Uint8Array.of(0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00);
  return seq([alg, bits]);
}

function seq(parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const lenBytes = len < 128 ? [len] : len < 256 ? [0x81, len] : len < 65536 ? [0x82, len >> 8, len & 255] : [0x83, len >> 16, (len >> 8) & 255, len & 255];
  const out = new Uint8Array(1 + lenBytes.length + len);
  out[0] = 0x30; out.set(lenBytes, 1);
  let o = 1 + lenBytes.length;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// { subject, issuer, notBefore, notAfter, keyType, curve, spki, selfIssued } from DER bytes.
export function readCertificate(der) {
  const b = der instanceof Uint8Array ? der : new Uint8Array(der);
  const cert = tlv(b, 0), [tbs] = kids(b, cert);
  let f = kids(b, tbs);
  if (f[0].tag === 0xa0) f = f.slice(1);                 // explicit version
  const [, , issuer, validity, subject, spkiNode] = f;
  const [nb, na] = kids(b, validity);
  const [algSeq, keyBits] = kids(b, spkiNode);
  const [algOid, params] = kids(b, algSeq);
  const keyType = KEY[oid(b, algOid)] || "unknown";
  const out = {
    subject: name(b, subject), issuer: name(b, issuer),
    notBefore: time(b, nb), notAfter: time(b, na), keyType,
    spki: keyType === "rsa-pss" ? rsaSpki(b, keyBits) : b.slice(spkiNode.start, spkiNode.end),
  };
  if (keyType === "ec" && params && params.tag === 0x06) out.curve = CURVE[oid(b, params)] || null;
  out.selfIssued = JSON.stringify(out.subject) === JSON.stringify(out.issuer);
  return out;
}
