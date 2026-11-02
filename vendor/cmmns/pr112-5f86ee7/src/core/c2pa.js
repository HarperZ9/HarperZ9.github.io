// Reads Content Credentials (C2PA 2.x manifests) from a media file's bytes and says what they claim
// and which parts CMMNS could check. It never calls a file authentic: a valid credential shows who
// signed a claim and that the file has not changed since, not that the claim is true. A missing
// credential is the common case, because most platforms strip metadata on upload.

import { cborDecode } from "./cbor.js";
import { findManifestStore, parseStore, childByLabel } from "./jumbf.js";
import { checkAssertions, checkSignature, checkDataHash, checkBmffHash } from "./c2pa-verify.js";
import { sourceType, aiMetadata } from "./aimeta.js";

export const OLDER_FORMAT = "could not fully verify (older manifest format): CMMNS still needs a test against the reference checker on version 1 manifests in video";
const content = (box) => (box && box.content && box.content[0]) || null;
function decodeBox(box) { const c = content(box); if (!c) return null; try { return c.type === "json" ? JSON.parse(new TextDecoder().decode(c.data)) : cborDecode(c.data); } catch { return null; } }
const assertionsOf = (m) => (childByLabel(m, "c2pa.assertions") || {}).content || [];
const base = (label) => String(label || "").replace(/__\d+$/, "");

function generatorOf(claim) {
  const g = claim.claim_generator_info;
  const one = Array.isArray(g) ? g[0] : g;
  if (one && one.name) return one.version ? `${one.name} ${one.version}` : one.name;
  return claim.claim_generator ? String(claim.claim_generator).split(" ")[0].replace("/", " ") : null;
}

const agent = (a) => (!a ? null : typeof a === "string" ? a : [a.name, a.version].filter(Boolean).join(" ") || null);

// What one manifest claims: actions, source types, generator, title and ingredients.
function summarise(m) {
  const claimBox = (m.content || []).find((c) => /^c2pa\.claim(\.v2)?$/.test(c.label));
  const claim = decodeBox(claimBox) || {};
  const actions = [], ingredients = [];
  for (const a of assertionsOf(m)) {
    const label = base(a.label), v = decodeBox(a);
    if (!v) continue;
    if (/^c2pa\.actions(\.v2)?$/.test(label)) for (const x of v.actions || []) actions.push({ action: x.action, source: sourceType(x.digitalSourceType), agent: agent(x.softwareAgent) });
    if (/^c2pa\.ingredient/.test(label)) ingredients.push({ title: v["dc:title"] || v.title || null, relationship: v.relationship || null, manifest: ((v.activeManifest || v.c2pa_manifest || {}).url || "").match(/urn:[^/]+/)?.[0] || null });
  }
  return { label: m.label, claimBox, claim, title: claim["dc:title"] || null, generator: generatorOf(claim), actions, ingredients, version: claimBox && claimBox.label === "c2pa.claim.v2" ? 2 : 1 };
}

// The hard binding assertion of a manifest, checked against the file. An update manifest has
// none of its own: the binding of the manifest it updates (its parentOf ingredient) applies.
// Adding the update manifest grew the store, so the parent's exclusion range is retried as the
// store's current place in the file: every byte outside the credentials is still compared.
async function binding(file, m, complete, store, ranges, depth = 0) {
  const s = summarise(m), parent = s.ingredients.find((x) => x.relationship === "parentOf");
  if (!assertionsOf(m).some((a) => /^c2pa\.hash\./.test(base(a.label))) && parent && parent.manifest && depth < 4) {
    const pm = store.manifests.find((x) => x.label === parent.manifest || (x.label || "").endsWith(parent.manifest));
    if (pm && pm !== m) {
      const b = await binding(file, pm, complete, store, ranges, depth + 1);
      if (b.ok !== false || !ranges || !ranges.length) return b;
      const v = decodeBox(assertionsOf(pm).find((a) => base(a.label) === "c2pa.hash.data"));
      return v ? checkDataHash(file, { ...v, exclusions: [{ start: ranges[0][0], length: ranges[ranges.length - 1][1] - ranges[0][0] }] }, complete) : b;
    }
  }
  for (const a of assertionsOf(m)) {
    const label = base(a.label), v = decodeBox(a);
    if (label === "c2pa.hash.data" && v) return checkDataHash(file, v, complete);
    if (/^c2pa\.hash\.bmff/.test(label) && v) return checkBmffHash(file, v, label, complete);
    if (/^c2pa\.hash\./.test(label)) return { ok: null, text: `binding type ${label} is on CMMNS' list to check later` };
  }
  return { ok: false, text: "the manifest lacks a hard binding to the file's bytes" };
}

async function signatureOf(store, m, s) {
  const sigBox = childByLabel(m, "c2pa.signature");
  if (!s.claimBox || !sigBox || !content(sigBox)) return { sign: { ok: false, text: "the claim or its signature is missing" } };
  return checkSignature(content(sigBox).data, content(s.claimBox).data, s.version);
}

const isAi = (s) => s.actions.some((a) => a.source && a.source.kind === "ai");

// The full reading for one file. complete: false when only the start of the file was read.
export async function readCredentials(bytes, { complete = true } = {}) {
  const file = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const meta = aiMetadata(file);
  let found;
  try { found = findManifestStore(file); } catch { found = { format: null, store: null }; }
  const out = { format: found.format, found: !!found.store, meta };
  if (!found.store) return meta.remote ? { ...out, remote: meta.remote } : out;
  let store;
  try { store = parseStore(found.store); } catch { return { ...out, broken: "the Content Credentials in this file are damaged or in an unreadable form" }; }
  if (!store.manifests.length) return { ...out, broken: "the credential store holds no manifest" };
  const active = store.manifests[store.manifests.length - 1], s = summarise(active);
  const sig = await signatureOf(store, active, s);
  const checks = {
    signature: sig.sign,
    assertions: await checkAssertions(store, active, s.claim),
    binding: await binding(file, active, complete, store, found.ranges),
  };
  // Fail-safe: forms where agreement with the reference checker (c2patool) is not shown are never
  // reported as unchanged. Version 1 claims in MP4 are one: see project-docs/DESIGN.md.
  if (found.format === "bmff" && s.version === 1) checks.format = { ok: null, text: OLDER_FORMAT };
  const earlier = [];
  for (const m of store.manifests.slice(0, -1)) {
    const e = summarise(m), es = await signatureOf(store, m, e);
    earlier.push({ title: e.title, generator: e.generator, ai: isAi(e), signer: es.cert ? es.cert.subject : null, signature: es.sign });
  }
  return {
    ...out, manifests: store.manifests.length,
    active: { title: s.title, generator: s.generator, actions: s.actions, ingredients: s.ingredients, claimVersion: s.version, ai: isAi(s), alg: sig.alg, timestamp: sig.timestamp, cert: sig.cert || null },
    checks, earlier, aiAnywhere: isAi(s) || earlier.some((e) => e.ai),
  };
}

// The overall state, in words CMMNS can stand behind: "unchanged", "changed", "unchecked", "remote" or "none".
export function credentialState(r) {
  if (r && !r.found && r.remote) return "remote";
  if (!r || !r.found) return "none";
  if (r.broken) return "changed";
  const c = Object.values(r.checks || {});
  if (c.some((x) => x.ok === false)) return "changed";
  return c.every((x) => x.ok === true) ? "unchanged" : "unchecked";
}
