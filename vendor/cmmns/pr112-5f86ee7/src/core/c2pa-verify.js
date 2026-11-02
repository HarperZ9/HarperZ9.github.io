// Checks a C2PA manifest without a network call: the claim signature (COSE_Sign1 over the claim,
// with the key in the signer's certificate), the hash of every assertion the claim lists, and the
// hard binding that ties the claim to the file's bytes (c2pa.hash.data, or c2pa.hash.bmff for MP4).
// Each check is { ok: true | false | null, text }: null means CMMNS could not check it here.
// Not checked here: whether the certificate chains to a trusted issuer, revocation, and the
// time-stamp authority's signature.

import { cborDecode, cborEncode, bytesConcat } from "./cbor.js";
import { bmffBoxes } from "./jumbf.js";
import { readCertificate } from "./der.js";

const HASH = { sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" };
const subtle = () => (globalThis.crypto && globalThis.crypto.subtle) || null;
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

async function digest(alg, bytes) {
  const name = HASH[alg || "sha256"];
  if (!name || !subtle()) return null;
  return new Uint8Array(await subtle().digest(name, bytes));
}

// Resolve a hashed URI ("self#jumbf=c2pa.assertions/x" or "self#jumbf=/c2pa/urn:.../x") to a box.
export function resolveUri(store, manifest, url) {
  const path = String(url || "").replace(/^self#jumbf=/, "");
  let box = manifest, parts = path.split("/").filter(Boolean);
  if (path.startsWith("/") || path.startsWith("c2pa/")) { box = store.root; parts = parts.slice(1); }
  for (const p of parts) {
    box = (box.content || []).find((c) => c.type === "jumb" && c.label === p);
    if (!box) return null;
  }
  return box;
}

// Every hashed URI in the claim, recomputed over the referenced box's contents (its header excluded).
export async function checkAssertions(store, manifest, claim) {
  const refs = [...(claim.assertions || []), ...(claim.created_assertions || []), ...(claim.gathered_assertions || [])];
  if (!refs.length) return { ok: null, text: "the claim lists no assertions" };
  let bad = 0, missing = 0;
  for (const r of refs) {
    const box = resolveUri(store, manifest, r.url);
    if (!box) { missing++; continue; }
    const h = await digest(r.alg || claim.alg, store.buf.subarray(box.contentStart, box.end));
    if (!h) return { ok: null, text: `hash algorithm ${r.alg || claim.alg} is not supported here` };
    if (!same(h, r.hash)) bad++;
  }
  if (bad) return { ok: false, text: `${bad} of ${refs.length} assertions changed after signing` };
  if (missing) return { ok: false, text: `${missing} of ${refs.length} assertions the claim lists are missing` };
  return { ok: true, text: `all ${refs.length} assertions match the signed claim` };
}

const COSE = { "-7": ["ECDSA", "SHA-256"], "-35": ["ECDSA", "SHA-384"], "-36": ["ECDSA", "SHA-512"], "-37": ["RSA-PSS", "SHA-256", 32], "-38": ["RSA-PSS", "SHA-384", 48], "-39": ["RSA-PSS", "SHA-512", 64], "-8": ["Ed25519"] };
const ALG_NAME = { "-7": "ES256", "-35": "ES384", "-36": "ES512", "-37": "PS256", "-38": "PS384", "-39": "PS512", "-8": "Ed25519" };

// The COSE_Sign1 signature: { sign: check, cert, alg, timestamp }.
export async function checkSignature(sigBytes, claimBytes, claimVersion = 2) {
  let s;
  try { s = cborDecode(sigBytes); } catch { return { sign: { ok: false, text: "the signature cannot be read" } }; }
  const arr = s && s.tag === 18 ? s.value : s;
  if (!Array.isArray(arr) || arr.length !== 4) return { sign: { ok: false, text: "the signature has some other structure than COSE_Sign1" } };
  const [protBytes, unprot, , sig] = arr;
  const prot = protBytes && protBytes.length ? cborDecode(protBytes) : {};
  const chain = prot["33"] || (unprot || {})["33"] || (unprot || {}).x5chain;
  const leafDer = Array.isArray(chain) ? chain[0] : chain;
  const algId = String(prot["1"]), alg = COSE[algId];
  const out = { alg: ALG_NAME[algId] || algId, timestamp: !!(unprot && (unprot.sigTst || unprot.sigTst2)) };
  if (!leafDer) return { ...out, sign: { ok: null, text: "the signature carries no certificate" } };
  try { out.cert = readCertificate(leafDer); } catch { return { ...out, sign: { ok: false, text: "the signer's certificate cannot be read" } }; }
  if (!alg || !subtle()) return { ...out, sign: { ok: null, text: `signature algorithm ${out.alg} is not supported here` } };
  const tbs = cborEncode(["Signature1", protBytes, new Uint8Array(0), claimBytes]);
  out.sign = await verifyWith(alg, out.cert, sig, tbs);
  // C2PA 2.x puts the certificate in the signed header. A version 2 claim with the certificate
  // outside it could have another certificate with the same key and a different name swapped in.
  // Version 1 files did this routinely, and the 1.x specification allowed it.
  if (out.sign.ok && !prot["33"] && claimVersion >= 2) out.sign = { ok: null, text: "the signature matches, but the certificate sits outside the signed part (an older format), so the name on it is not bound to the signature" };
  return out;
}

async function verifyWith([name, hash, salt], cert, sig, tbs) {
  try {
    const params = name === "ECDSA" ? { name, namedCurve: cert.curve } : name === "RSA-PSS" ? { name, hash } : { name };
    const key = await subtle().importKey("spki", cert.spki, params, false, ["verify"]);
    const ok = await subtle().verify(name === "ECDSA" ? { name, hash } : name === "RSA-PSS" ? { name, saltLength: salt } : { name }, key, sig, tbs);
    return ok ? { ok: true, text: "the signature matches the claim and the signer's certificate" } : { ok: false, text: "the signature fails against the claim: the claim changed, or another key signed it" };
  } catch (e) {
    return { ok: null, text: `this browser cannot check ${name} signatures (${String(e && e.message || e).slice(0, 60)})` };
  }
}

// c2pa.hash.data: the file's bytes outside the exclusion ranges.
export async function checkDataHash(file, a, complete) {
  if (!complete) return { ok: null, text: "CMMNS read part of the file, so the byte comparison was skipped" };
  const parts = [];
  let p = 0;
  for (const e of [...(a.exclusions || [])].sort((x, y) => x.start - y.start)) {
    if (e.start < p || e.start + e.length > file.length) return { ok: false, text: "the exclusion ranges run outside this file" };
    parts.push(file.subarray(p, e.start)); p = e.start + e.length;
  }
  parts.push(file.subarray(p));
  const h = await digest(a.alg || "sha256", bytesConcat(parts));
  if (!h) return { ok: null, text: `hash algorithm ${a.alg} is not supported here` };
  return same(h, a.hash) ? { ok: true, text: "the file's bytes match the signed hash" } : { ok: false, text: "the file's bytes changed after signing" };
}

const u64 = (n) => { const o = new Uint8Array(8); new DataView(o.buffer).setBigUint64(0, BigInt(n)); return o; };

// Container boxes whose children an exclusion path can name. meta is a FullBox (4 bytes first).
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "udta", "mvex", "moof", "traf", "mfra", "meta", "iprp", "ipco", "sinf", "schi"]);

const b64 = (v) => (v instanceof Uint8Array ? v : typeof v === "string" ? Uint8Array.from(atob(v), (c) => c.charCodeAt(0)) : null);

// A rule applies when its data, version and flags conditions hold for the box.
function matches(file, box, rule) {
  const ok = (rule.data || []).every((d) => { const v = b64(d.value); return v && same(file.subarray(box.start + d.offset, box.start + d.offset + v.length), v); });
  if (!ok) return false;
  const at = box.start + box.header;
  if (rule.version != null && file[at] !== rule.version) return false;
  if (rule.flags != null) {
    const want = b64(rule.flags), have = file.subarray(at + 1, at + 4);
    if (!want || want.length !== 3) return false;
    if (rule.exact === false ? !want.every((x, i) => (have[i] & x) === x) : !same(have, want)) return false;
  }
  return true;
}

// The ranges a matching rule removes: the whole box, or its subsets (length 0 runs to the end).
function rangesOf(box, rule, depth) {
  if (!rule.subset) return [[box.start, box.end, depth, true]];
  return rule.subset.map((x) => [Math.min(box.end, box.start + x.offset), x.length ? Math.min(box.end, box.start + x.offset + x.length) : box.end, depth, false]).filter(([a, c]) => c > a);
}

// Byte ranges excluded by xpath rules such as "/uuid" or "/moov/trak/mdia/minf/stbl/stco".
function exclusionRanges(file, rules) {
  const out = [];
  const walk = (from, to, path, depth) => {
    if (depth > 8) return;
    for (const box of bmffBoxes(file, from, to)) {
      const p = path + "/" + box.type;
      const hit = rules.find((r) => r.xpath === p && matches(file, box, r));
      if (hit) { out.push(...rangesOf(box, hit, depth)); if (!hit.subset) continue; }
      if (CONTAINERS.has(box.type) && rules.some((r) => (r.xpath || "").startsWith(p + "/"))) walk(box.start + box.header + (box.type === "meta" ? 4 : 0), box.end, p, depth + 1);
    }
  };
  walk(0, file.length, "", 0);
  return out;
}

// c2pa.hash.bmff: the file without its excluded boxes; v2 and later put the 8-byte offset of each
// top-level box that is hashed before it.
export async function checkBmffHash(file, a, label, complete) {
  if (!complete) return { ok: null, text: "CMMNS read part of the file, so the byte comparison was skipped" };
  const rules = a.exclusions || [];
  if (!a.hash || a.merkle || rules.some((r) => !/^(\/[\w ]{4})+$/.test(r.xpath || ""))) {
    return { ok: null, text: "this video uses a hash layout CMMNS skips for now (fragments or partial exclusions)" };
  }
  const withOffsets = /\.v[2-9]$/.test(label), ex = exclusionRanges(file, rules);
  const top = new Set(ex.filter((e) => e[2] === 0 && e[3]).map((e) => e[0]));
  const parts = [];
  for (const box of bmffBoxes(file)) {
    if (top.has(box.start)) continue;
    if (withOffsets) parts.push(u64(box.start));
    let p = box.start;
    for (const [s, e] of ex.filter((x) => !(x[2] === 0 && x[3]) && x[0] >= box.start && x[1] <= box.end).sort((x, y) => x[0] - y[0])) { parts.push(file.subarray(p, s)); p = e; }
    parts.push(file.subarray(p, box.end));
  }
  const h = await digest(a.alg || "sha256", bytesConcat(parts));
  if (!h) return { ok: null, text: `hash algorithm ${a.alg} is not supported here` };
  return same(h, a.hash) ? { ok: true, text: "the video's bytes match the signed hash" } : { ok: false, text: "the video's bytes changed after signing" };
}
