// radar-core: the public API. One zero-dependency ES module over CMMNS' pure core, for anyone
// who wants CMMNS' evidence without the browser extension. No DOM, no network, no storage: the
// caller hands in the posts, the file bytes and (optionally) the data tables, and gets back
// evidence objects that match schema/evidence.v2.json. project-docs/INTEGRATION.md documents it.
//
//   analyzeThread({ site, root, replies })   evidence about a thread
//   analyzeText(text)                        evidence about one piece of text
//   checkMedia(bytes)                        Content Credentials and AI metadata of a file
//   siteInfo(domain)                         what CMMNS' tables hold about a site
//   useData({ sites, owners, state, claims, claimParts })   load the tables (optional)
//
// Every evidence item states what it shows, its source and what it does not prove. None names an
// account: items point at posts by id.

import { postEvidence } from "./api-post.js";
import { threadItems, flagsOf } from "./api-thread.js";
import { siteEvidence, siteSummary, cleanDomain } from "./api-site.js";
import { mediaReading } from "./api-media.js";
import { useData, claimIndex, dataLoaded } from "./api-data.js";
import { REPORT_DOES_NOT_PROVE } from "./report.js";
import { THREAD_LIMIT, TEXT_LIMIT } from "./api-words.js";

export const API_VERSION = "2.0.0";
export const EVIDENCE_SCHEMA = "urn:radar:evidence:v2";
export { useData, dataLoaded };

const envelope = (kind, extra) => ({ schema: EVIDENCE_SCHEMA, api: API_VERSION, kind, ...extra });
const number = (items) => items.map((it, i) => ({ id: "e" + (i + 1), ...it }));

// Adds the site items for every domain the posts link to, one item set per domain.
function linkItems(byDomain) {
  return [...byDomain].flatMap(([d, posts]) => siteEvidence(d, posts, { quiet: true }));
}

// One post in the input: { id?, author?, text, posted?, timePrecision?, links?, flags?, account? }.
function normalise(p, i, now) {
  const post = { id: p && p.id != null ? String(p.id) : "p" + (i + 1), author: String((p && p.author) || "unknown-" + (i + 1)), text: String((p && p.text) || ""), posted: (p && p.posted) || null, links: (p && p.links) || [] };
  post.flags = flagsOf(p || {}, now);
  if (p && p.account) post.account = p.account;
  if (p && p.timePrecision) post.timePrecision = p.timePrecision;
  return post;
}

// text: a string. opts: { id, links }. Returns the evidence envelope for one piece of text.
export function analyzeText(text, opts = {}) {
  const id = opts.id != null ? String(opts.id) : "p1";
  const P = postEvidence({ id, text, links: opts.links || [] }, { claimIndex: claimIndex() });
  const links = new Map(P.domains.map((d) => [d, [id]]));
  return envelope("text", { posts: { n: 1, accounts: null }, evidence: number([...P.items, ...linkItems(links)]), limits: [TEXT_LIMIT] });
}

// Quoted posts: a top-level `quoted` list, or a `quoted` post inside the root or a reply. Their
// words are read like any post's, but they are not replies, so the thread comparisons skip them.
function quotedPosts(input, now) {
  const own = [input.root, ...(input.replies || [])].filter((p) => p && p.quoted && typeof p.quoted === "object" && !Array.isArray(p.quoted)).map((p) => p.quoted);
  const listed = Array.isArray(input.quoted) ? input.quoted : [];
  const seen = new Set(), out = [];
  for (const [i, q] of [...listed, ...own].entries()) {
    if (!q || typeof q.text !== "string" || !q.text.trim()) continue;
    const post = normalise({ id: q.id != null ? q.id : "q" + (i + 1), ...q }, i, now);
    if (!seen.has(post.id)) { seen.add(post.id); out.push(post); }
  }
  return out;
}

// input: { site, root?, replies: [post], quoted?: [post], timePrecision? }. opts: { now }: the time account
// ages are measured at. timePrecision ("exact", "second", "minute", "hour" or "day") says how precise the
// post times are, for the whole thread; a post's own timePrecision overrides it (src/core/precision.js).
export function analyzeThread(input, opts = {}) {
  const now = opts.now || Date.now();
  const replies = ((input && input.replies) || []).map((p, i) => normalise(p, i, now));
  const root = input && input.root && input.root.text != null ? normalise({ id: "root", ...input.root }, -1, now) : null;
  const quoted = input ? quotedPosts(input, now).filter((q) => q.id !== (root && root.id) && !replies.some((r) => r.id === q.id)) : [];
  const items = [], links = new Map();
  for (const post of [...(root ? [root] : []), ...replies, ...quoted]) {
    const P = postEvidence(post, { claimIndex: claimIndex() });
    items.push(...P.items);
    post.extreme = P.extreme; post.machine = P.machineLike;
    for (const d of P.domains) (links.get(d) || links.set(d, []).get(d)).push(post.id);
  }
  const T = threadItems(replies, root, { now, timePrecision: input && input.timePrecision });
  const evidence = number([...T.items, ...items, ...linkItems(links)]);
  const posts = { n: replies.length + (root ? 1 : 0), accounts: T.accounts, ids: [...(root ? [root.id] : []), ...replies.map((r) => r.id)], timePrecision: T.timePrecision };
  if (quoted.length) posts.quoted = quoted.map((q) => q.id);
  return envelope("thread", { site: (input && input.site) || null, posts, evidence, limits: [THREAD_LIMIT, REPORT_DOES_NOT_PROVE] });
}

// bytes: the whole file as a Uint8Array or ArrayBuffer. Resolves to the evidence envelope.
export async function checkMedia(bytes) {
  const M = await mediaReading(bytes);
  return envelope("media", { media: { state: M.state, ai: M.ai, format: M.format }, evidence: number(M.items), limits: ["CMMNS read this file on this device. Credentials and metadata describe how the file says it was made."] });
}

// domain: "example.com" or a URL. Returns the evidence envelope, or null for an empty domain.
export function siteInfo(domain) {
  const d = cleanDomain(domain);
  if (!d) return null;
  const loaded = dataLoaded();
  const limits = ["Every row names its source."];
  if (!loaded.sites && !loaded.owners && !loaded.state) limits.push("The site tables were absent, so the look-alike check ran alone.");
  return envelope("site", { site: siteSummary(d), evidence: number(siteEvidence(d, [])), limits });
}
