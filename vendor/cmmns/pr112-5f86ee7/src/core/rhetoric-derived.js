// Word lists derived from human-labelled corpora, for Hebrew, Turkish, Korean, Japanese, Persian,
// Indonesian and Hindi. Nobody types these lists: scripts/derive-lexicon.mjs picks each term on the
// dev split of the corpora in project-docs/evidence/CORPORA.md and writes lexicon-derived.js. This
// file holds the Unicode handling both sides share, so a term is found in a reply exactly as it was
// counted in the corpus.
//   prepDerived(code, text)   the normal form a language's terms are counted and matched in
//   candidates(code, text)    the terms a text offers to the derivation (words, word pairs, n-grams)
//   compileTerms(code, list)  one regex for a list of terms
// Korean and Japanese do not separate words with spaces the way the matcher needs, so they are
// counted and matched as character n-grams. Turkish adds suffixes to a stem, so a long Turkish word
// is counted by its first five letters and matched as that stem plus any ending.

import { DERIVED, DERIVED_SHIP } from "./lexicon-derived.js";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Hebrew points and cantillation; the maqaf, paseq and sof pasuq are punctuation and stay.
const HE_MARKS = /[֑-ׇֽֿׁׂׅׄ]/g;
// Arabic vowel signs and the tatweel, which Persian writers add or drop freely.
const FA_MARKS = /[ً-ْٰـ]/g;
// "anjiiing" and "anjing" are one word; three or more of a letter become one.
const squeeze = (s) => s.replace(/(\p{L})\1{2,}/gu, "$1");

const PREP = {
  he: (s) => s.normalize("NFC").replace(HE_MARKS, "").toLowerCase(),
  tr: (s) => squeeze(s.normalize("NFC").toLocaleLowerCase("tr")),
  // NFC, not NFKC: NFKC would turn the jamo of "ㅅㅂ" into conjoining jamo.
  ko: (s) => s.normalize("NFC").toLowerCase(),
  // NFKC folds half-width katakana and full-width Latin.
  ja: (s) => s.normalize("NFKC").toLowerCase(),
  fa: (s) => s.normalize("NFC").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(FA_MARKS, "").replace(/‌+/g, "‌").toLowerCase(),
  id: (s) => squeeze(s.normalize("NFC").toLowerCase()),
  hi: (s) => squeeze(s.normalize("NFC").toLowerCase()),
};
export const DERIVED_CODES = Object.keys(PREP);
export const prepDerived = (code, s) => PREP[code](String(s || ""));

// Character runs for the n-gram languages: Hangul syllables and jamo; kana, kanji and the long-vowel mark.
const RUNS = { ko: /[ᄀ-ᇿ㄰-㆏가-힯]+/gu, ja: /[぀-ヿㇰ-ㇿ㐀-鿿ｦ-ﾟ々〆ー]+/gu };
const NGRAM = [2, 4];
// A word: letters, marks and digits, with the Persian zero-width non-joiner and the Hebrew geresh inside it.
const WORD = /[\p{L}\p{M}\p{N}‌׳״']+/gu;
const STEM = 5;
const trim = (w) => w.replace(/^['‌]+|['‌]+$/g, "");
const words = (s) => (s.match(WORD) || []).map(trim).filter((w) => w && !/^\p{N}+$/u.test(w));
const unit = (code, w) => (code === "tr" && [...w].length > STEM ? [...w].slice(0, STEM).join("") + "*" : w);
const longEnough = (w) => [...w.replace(/\*$/, "")].length >= 3;

// Korean n-grams start a word (an eojeol: a stem with its particles), so "대들" inside "세대들"
// (generations) is never a candidate. Japanese has no word spaces, so its n-grams start anywhere.
const WORD_START = { ko: true };
function ngrams(code, s) {
  const out = new Set();
  for (const run of s.match(RUNS[code]) || []) {
    const ch = [...run], starts = WORD_START[code] ? 1 : ch.length;
    for (let n = NGRAM[0]; n <= NGRAM[1]; n++) for (let i = 0; i < starts && i + n <= ch.length; i++) out.add(ch.slice(i, i + n).join(""));
  }
  return out;
}

// The terms a prepared text offers: each word (or Turkish stem) and each pair of neighbouring words.
export function candidates(code, prepared) {
  if (RUNS[code]) return ngrams(code, prepared);
  const w = words(prepared), out = new Set();
  for (let i = 0; i < w.length; i++) {
    const u = unit(code, w[i]);
    if (longEnough(u)) out.add(u);
    if (i + 1 < w.length) out.add(`${w[i]} ${w[i + 1]}`);
  }
  return out;
}

const B = "(?<![\\p{L}\\p{M}\\p{N}_])", E = "(?![\\p{L}\\p{M}\\p{N}_])";
// Hebrew writes "and", "the", "in", "to", "from", "that" and "as" as one-letter prefixes.
const PREFIX = { he: "(?:[והבלמשכ]{1,2})?" };
// Persian plurals and the ezafe join with or without the zero-width non-joiner.
const SUFFIX = { fa: "(?:\\u200c?(?:های|ها|ان|ی))?" };
const altOf = (list) => [...new Set(list)].map((t) => esc(t).replace(/ /g, "\\s+")).sort((a, b) => b.length - a.length).join("|");

// One regex for a list of terms, built the same way for the derivation and for replies.
export function compileTerms(code, list) {
  if (!list.length) return null;
  if (RUNS[code]) return new RegExp(`${WORD_START[code] ? `(?<!${RUNS[code].source.slice(0, -1)})` : ""}(?:${altOf(list)})`, "u");
  const stems = list.filter((t) => t.endsWith("*")).map((t) => t.slice(0, -1)), exact = list.filter((t) => !t.endsWith("*"));
  const parts = [];
  if (exact.length) parts.push(`(?:${altOf(exact)})${SUFFIX[code] || ""}${E}`);
  if (stems.length) parts.push(`(?:${altOf(stems)})[\\p{L}\\p{M}]*${E}`);
  return new RegExp(`${B}${PREFIX[code] || ""}(?:${parts.join("|")})`, "u");
}

// The languages the evaluation let through (measured-langs.js), each with its compiled list.
const COMPILED = new Map();
function compiled(code) {
  if (!COMPILED.has(code)) COMPILED.set(code, compileTerms(code, (DERIVED[code] && DERIVED[code].slur) || []));
  return COMPILED.get(code);
}

// Hindi already has a written grammar under "hi"; its derived list reports as "hi-data".
export const markerCode = (code) => (code === "hi" ? "hi-data" : code);

// A LANGUAGES entry for rhetoric.js. Only "slur" is derived: terms that cleared the dev bar against
// each corpus's group-directed hate label.
export function derivedLanguage(code) {
  return {
    code: markerCode(code), report: true, negation: /(?!)/u, prep: (s) => prepDerived(code, s),
    score: (hit, have) => { const re = compiled(code); if (re && !have.has("slur")) hit("slur", re, false); },
  };
}

// The entries rhetoric.js runs: the shipped languages, or any list of codes (the evaluation runs all).
export const derivedLanguages = (codes = DERIVED_SHIP) => codes.map(derivedLanguage);
