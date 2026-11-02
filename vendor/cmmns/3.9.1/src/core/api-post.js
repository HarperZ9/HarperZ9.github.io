// Evidence about one post's text: strong language, named theories, persuasion techniques,
// machine-writing and spam signs, fact-checked claims and the domains it names. Each item says
// what it shows, where it came from and what it does not prove, and carries the matched span so
// anyone holding the post can check it. Pure: no DOM, no network.

import { score } from "./rhetoric.js";
import { persuasion, PERSUASION_DOES_NOT_PROVE } from "./persuasion.js";
import { machineSigns } from "./machine.js";
import { theoryById, THEORY_DOES_NOT_PROVE } from "./theories.js";
import { matchClaims, CLAIM_LABEL, CLAIM_DOES_NOT_PROVE, CLAIM_ATTRIBUTION } from "./claims.js";
import { domainsIn } from "./owners.js";
import { cleanDomain } from "./api-site.js";
import { STRONG_LABEL, STRONG_MEANING, SRC_RULES, STRONG_DOES_NOT_PROVE, LEAK_DOES_NOT_PROVE, MACHINE_DOES_NOT_PROVE, SPAM_DOES_NOT_PROVE } from "./api-words.js";

// Where `match` sits in `text`: { post, start, end, text }. start and end are null when the
// match was found after folding look-alike letters and is not in the text as written.
export function spanOf(post, text, match) {
  const m = String(match || "");
  const at = m ? String(text || "").toLowerCase().indexOf(m.toLowerCase()) : -1;
  return at < 0 ? { post, start: null, end: null, text: m } : { post, start: at, end: at + m.length, text: String(text).slice(at, at + m.length) };
}

const item = (post, kind, level, label, shows, source, context, spans = [], data = {}) =>
  ({ kind, scope: "post", level, label, shows, source, context, posts: [post], spans, data });

function language(id, text) {
  const out = [], s = score(text);
  for (const mk of s.markers) {
    if (STRONG_LABEL[mk.family]) out.push(item(id, "strong-language", "warn", STRONG_LABEL[mk.family], STRONG_MEANING[mk.family], SRC_RULES, STRONG_DOES_NOT_PROVE, [spanOf(id, text, mk.match)], { family: mk.family, lang: mk.lang || "en" }));
    const t = mk.family === "conspiracy-theory" ? theoryById(mk.theory) : null;
    if (t) out.push(item(id, "names-theory", "info", `names a theory: ${t.name}`, `${t.claim} What the record shows: ${t.record}`, (t.sources || []).map((x) => `${x.title} (${x.date}): ${x.url}`).join("; ") || SRC_RULES, `${t.dnp ? t.dnp + " " : ""}${THEORY_DOES_NOT_PROVE}`, [spanOf(id, text, mk.match)], { theory: t.id }));
  }
  for (const t of persuasion(text)) {
    out.push(item(id, "persuasion", "info", `persuasion: ${t.name.toLowerCase()}`, t.definition, SRC_RULES, PERSUASION_DOES_NOT_PROVE, [spanOf(id, text, t.match)], { technique: t.technique, lang: t.lang || "en" }));
  }
  return { items: out, extreme: s.extreme };
}

function machine(id, text) {
  const M = machineSigns(text), out = [];
  if (M.leak) out.push(item(id, "leaked-ai", "warn", "leaked AI text", "Text a chatbot writes, posted without editing.", SRC_RULES, LEAK_DOES_NOT_PROVE, [spanOf(id, text, M.leak)]));
  else if (M.machineLike) out.push(item(id, "machine-writing", "flag", "machine-writing signs", `Signs: ${M.signs.join("; ")}. CMMNS counts three or more independent signs in a post of at least 25 words.`, SRC_RULES, MACHINE_DOES_NOT_PROVE, [], { signs: M.signs }));
  if (M.spam) out.push(item(id, "spam-pattern", "warn", "spam pattern", "A pattern common in scam and spam posts: giveaways, crypto, contact bait.", SRC_RULES, SPAM_DOES_NOT_PROVE, [spanOf(id, text, M.spam)]));
  return { items: out, machineLike: !!(M.leak || M.machineLike) };
}

function claims(id, text, index) {
  if (!index) return [];
  return matchClaims(index, text).map((m) => item(id, "fact-check", "warn", CLAIM_LABEL,
    `${m.checker} rated a similar claim "${m.rating}": ${m.claim} (${m.url}). Wording overlap: ${Math.round(m.coverage * 100)}% of the claim's words.${m.negationDiffers ? " One of the two says \"not\" and the other does not. Read both." : ""}`,
    CLAIM_ATTRIBUTION, CLAIM_DOES_NOT_PROVE, [], { checker: m.checker, rating: m.rating, claim: m.claim, url: m.url, date: m.date || null, overlap: m.coverage, negationDiffers: !!m.negationDiffers }));
}

// The domains a post links to or names, lower case, unique.
export function postDomains(post) {
  const out = new Set();
  for (const l of post.links || []) { const d = cleanDomain(l); if (d) out.add(d); }
  for (const d of domainsIn(post.text)) { const c = cleanDomain(d); if (c) out.add(c); }
  return [...out];
}

// post: { id, text, links? }. Returns { items, extreme, machineLike, domains }.
export function postEvidence(post, { claimIndex = null } = {}) {
  const id = String(post.id), text = String(post.text || "");
  const L = language(id, text), M = machine(id, text);
  return { items: [...L.items, ...M.items, ...claims(id, text, claimIndex)], extreme: L.extreme, machineLike: M.machineLike, domains: postDomains(post) };
}
