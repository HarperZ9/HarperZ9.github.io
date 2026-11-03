// Fact-checked claims. A post is matched to a claim a fact-checker has already reviewed, from a
// table bundled with CMMNS (src/ext/claims.json, built by scripts/claims-build.mjs from the Data
// Commons ClaimReview feed). CMMNS shows the fact-checker's rating in the fact-checker's own
// words, with a link. It never rates a post itself.
//
// Matching is on content words (function words in six languages removed, a light stemmer), each
// weighted by how rare it is in the table. A claim matches a post only when:
//   - the claim has at least MIN_CLAIM_TOKENS content words and the post shares MIN_SHARED of them;
//   - the shared words carry at least COVER_MIN of the claim's weight;
//   - every name (a capitalised word) and every number in the claim is in the post: a different
//     place, person, year or count is a different claim;
//   - at least BIGRAM_MIN of the claim's word pairs appear in the post in the same order, so the
//     claim's words scattered through a long post do not count;
//   - no claim word was swapped for another between the same two neighbours ("kill birds every
//     year" against "kill bats every year").
// Political side is never an input: no word list here names a side, party or group, and
// tests/claims.symmetry.test.js holds the matcher to the same decision for actors from every
// direction.

import { foldConfusables } from "./confusables.js";

export const MIN_CLAIM_TOKENS = 4, MIN_SHARED = 4, COVER_MIN = 0.85, BIGRAM_MIN = 0.3, MAX_CANDIDATES = 200;
export const CLAIM_LABEL = "A fact-checker reviewed a similar claim";
export const CLAIM_DOES_NOT_PROVE = "Similar wording to a reviewed claim; check the source. The rating is the fact-checker's, about the claim they reviewed.";
export const CLAIM_ATTRIBUTION = "ClaimReview markup published by the fact-checker, from the Data Commons fact-check feed (CC BY 4.0).";

const LANG_STOPS = {
  en: "the a an and or but of to in on at by for with from as is are was were be been being it its this that these those there their they them he she his her we our you your i me my not no do does did has have had will would can could should may might just than then so if into about over under after before through within more most very all any some such only also what which who whom whose when where why how up out off",
  fr: "le la les un une des du de et ou en dans pour par sur au aux avec est sont été être a ont pas ne que qui ce cette ces son sa ses leur leurs il elle ils elles nous vous on se plus tout toute toutes tous va vont",
  es: "el la los las un una unos unas de del y o en para por con es son fue ser ha han no que se su sus al lo como más pero este esta estos estas va",
  de: "der die das den dem des ein eine einen einem und oder in im auf für mit von zu ist sind war wird werden nicht kein keine dass sich es er sie wir auch noch nach bei aus",
  pt: "o a os as um uma de do da dos das e ou em no na nos nas para por com é são foi ser não que se seu sua ao mais mas como",
  it: "il lo la i gli le un una di del della dei e o in nel nella per con è sono era non che si suo sua al più ma come",
};
const NO_STOPS = new Set();
const LANG_SETS = Object.fromEntries(Object.entries(LANG_STOPS).map(([k, v]) => [k, new Set(v.split(" "))]));
const NUMBER_WORDS = new Set("one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty hundred thousand million billion trillion half dozen".split(" "));
const NEGATION = /\b(?:not|never|no|none|nobody|nothing|isn'?t|aren'?t|wasn'?t|weren'?t|don'?t|doesn'?t|didn'?t|won'?t|can'?t|pas|jamais|nunca|nicht|kein\w*|non|não)\b|n['’]t\b/i;

function words(text) {
  return foldConfusables(text)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@\w+/g, " ")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")   // keep combining marks: Indic vowel signs are marks
    .split(/\s+/)
    .filter(Boolean);
}

// A light stemmer: plurals and the commonest English endings, so "killing", "kills" and "killed"
// all read as "kill". Words with digits are kept as written.
function stem(w) {
  if (/\d/.test(w)) return w;
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ied")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

// { tokens: content words in order, named: words capitalised in the text, numbers }.
// An all-capitals word is kept even when it is also a function word ("the WHO", "the US").
// Function words are dropped only for the guessed language, and none are dropped when the guess
// is unsure: a word dropped from a claim widens what it matches, so the English "son" must not be
// dropped as the French or Spanish one.
export function claimTokens(text) {
  const tokens = [], named = new Set(), numbers = new Set();
  const lang = guessLanguage(text), STOP = lang ? LANG_SETS[lang] : NO_STOPS;
  for (const w of words(text)) {
    const lower = w.toLowerCase();
    const caps = w.length >= 2 && w === w.toUpperCase() && /\p{Lu}/u.test(w);
    if (STOP.has(lower) && !caps) continue;
    if (lower.length < 2 && !/\d/.test(lower)) continue;
    const s = stem(lower);
    tokens.push(s);
    if (/^\p{Lu}/u.test(w)) named.add(s);
    if (/\d/.test(s) || NUMBER_WORDS.has(s)) numbers.add(s);
  }
  return { tokens, named, numbers };
}

export function hasNegation(text) { return NEGATION.test(String(text || "")); }

// A guess from function words; null when no language clearly leads.
export function guessLanguage(text) {
  const ws = words(text).map((w) => w.toLowerCase());
  const scores = Object.entries(LANG_SETS).map(([k, set]) => [k, ws.filter((w) => set.has(w)).length]).sort((a, b) => b[1] - a[1]);
  return scores[0][1] >= 2 && scores[0][1] > scores[1][1] ? scores[0][0] : null;
}

const pairs = (seq) => { const out = new Set(); for (let i = 1; i < seq.length; i++) out.add(seq[i - 1] + " " + seq[i]); return out; };

// table: { checkers: [name], rows: [[claim, rating, checkerIndex, url, date, lang]] }.
export function buildClaimIndex(table) {
  const rows = [], postings = new Map();
  for (const r of (table && table.rows) || []) {
    const [claim, rating, ci, url, date, lang] = r;
    const t = claimTokens(claim);
    const uniq = [...new Set(t.tokens)];
    if (uniq.length < MIN_CLAIM_TOKENS) continue;
    const id = rows.length;
    rows.push({ claim, rating, checker: (table.checkers || [])[ci] || "unknown", url, date: date || null, lang: lang || null, seq: t.tokens, uniq, named: t.named, numbers: t.numbers, neg: hasNegation(claim) });
    for (const tok of uniq) { if (!postings.has(tok)) postings.set(tok, []); postings.get(tok).push(id); }
  }
  return { rows, postings, n: rows.length };
}

function weight(index, tok) { return Math.log(1 + index.n / ((index.postings.get(tok) || []).length || 1)); }

// A claim word swapped for a different word between the same two neighbours.
function substituted(row, have, postSeq) {
  for (let i = 1; i < row.seq.length - 1; i++) {
    if (have.has(row.seq[i])) continue;
    const prev = row.seq[i - 1], next = row.seq[i + 1];
    for (let j = 1; j < postSeq.length - 1; j++) if (postSeq[j - 1] === prev && postSeq[j + 1] === next) return true;
  }
  return false;
}

function verify(index, row, post) {
  const shared = row.uniq.filter((t) => post.have.has(t));
  if (shared.length < MIN_SHARED) return null;
  const total = row.uniq.reduce((s, t) => s + weight(index, t), 0);
  const coverage = shared.reduce((s, t) => s + weight(index, t), 0) / total;
  if (coverage < COVER_MIN) return null;
  for (const t of row.named) if (!post.have.has(t)) return null;
  for (const t of row.numbers) if (!post.have.has(t)) return null;
  const claimPairs = pairs(row.seq);
  if (claimPairs.size) {
    let inOrder = 0;
    for (const p of claimPairs) if (post.pairs.has(p)) inOrder++;
    if (inOrder / claimPairs.size < BIGRAM_MIN) return null;
  }
  if (substituted(row, post.have, post.seq)) return null;
  return { claim: row.claim, rating: row.rating, checker: row.checker, url: row.url, date: row.date, lang: row.lang, coverage: Math.round(coverage * 100) / 100, shared: shared.length, negationDiffers: row.neg !== post.neg };
}

// Text read from an image (src/ocr) can carry one wrong letter in a word: "Venezucla", "150o".
// With fuzzy on, a word of four or more characters that no claim uses is replaced by the one claim
// word one edit away, when exactly one exists. The index of one-letter deletions is built on first use.
function deletions(w) { const out = [w]; for (let i = 0; i < w.length; i++) out.push(w.slice(0, i) + w.slice(i + 1)); return out; }
export function nearToken(index, tok) {
  if (tok.length < 4 || index.postings.has(tok)) return tok;
  if (!index.dels) {
    index.dels = new Map();
    for (const k of index.postings.keys()) if (k.length >= 4) for (const d of deletions(k)) { const s = index.dels.get(d); if (!s) index.dels.set(d, [k]); else if (!s.includes(k)) s.push(k); }
  }
  const found = new Set();
  for (const d of deletions(tok)) for (const k of index.dels.get(d) || []) if (oneEdit(tok, k)) found.add(k);
  return found.size === 1 ? [...found][0] : tok;
}
function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

// The best matches for one post, at most `max`, one per fact-check URL, closest first.
export function matchClaims(index, text, { max = 3, fuzzy = false } = {}) {
  if (!index || !index.n || !text) return [];
  const t = claimTokens(text);
  if (fuzzy) {
    const near = new Map(t.tokens.map((k) => [k, nearToken(index, k)]));
    t.tokens = t.tokens.map((k) => near.get(k));
    t.named = new Set([...t.named].map((k) => near.get(k) || k));
    t.numbers = new Set([...t.numbers].map((k) => near.get(k) || k));
  }
  const post = { seq: t.tokens, have: new Set(t.tokens), pairs: pairs(t.tokens), neg: hasNegation(text) };
  if (post.have.size < MIN_SHARED) return [];
  const maxDf = Math.max(50, index.n * 0.05), hits = new Map();
  for (const tok of post.have) {
    const p = index.postings.get(tok);
    if (!p || p.length > maxDf) continue;
    for (const id of p) hits.set(id, (hits.get(id) || 0) + 1);
  }
  const cands = [...hits].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, MAX_CANDIDATES);
  const out = [], seen = new Set();
  for (const [id] of cands) {
    const m = verify(index, index.rows[id], post);
    if (m && !seen.has(m.url)) { seen.add(m.url); out.push(m); }
  }
  return out.sort((a, b) => b.coverage - a.coverage || b.shared - a.shared).slice(0, max);
}

// The card rows for one match. The rating is quoted as the fact-checker wrote it.
export function claimCard(m) {
  let host = m.url;
  try { host = new URL(m.url).hostname.replace(/^www\./, ""); } catch { /* keep the raw URL */ }
  const rows = [
    ["Fact-checker", m.checker],
    ["Their rating", `"${m.rating}"`],
    ["Claim they reviewed", m.claim],
    ["Reviewed on", m.date || "date not given"],
    ["Wording overlap", `${Math.round(m.coverage * 100)}% of the claim's words`],
    m.negationDiffers ? ["Note", "One of the two contains \"not\" and the other lacks it. Read both."] : null,
    ["Read it", { links: [[host, m.url]] }],
    ["Source", CLAIM_ATTRIBUTION],
    ["What it shows", CLAIM_DOES_NOT_PROVE],
  ].filter(Boolean);
  return { label: CLAIM_LABEL, rows };
}
