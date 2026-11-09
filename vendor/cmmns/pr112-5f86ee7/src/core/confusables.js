// Look-alike letters, folded before matching. A Cyrillic "а" or a Greek "ο" inside an English word
// looks the same on screen but defeats an exact match, so a copy-paste campaign can slip past the
// duplicates sign, the cross-thread fingerprint, claim matching and the word lists that way.
// Folding follows the Unicode confusables table (UTS #39, src/core/confusables-data.js) with three
// limits that keep ordinary text intact:
//   - Only a word that mixes Latin, Cyrillic, Greek, Armenian or Cherokee letters is folded, and
//     only toward the script most of its letters use. A word written wholly in one script is
//     left alone, so Russian, Greek or Ukrainian text never turns into Latin.
//   - A word with any letter from another script (Arabic, Devanagari, Han and the rest) is left
//     alone.
//   - A word in Cyrillic or Greek whose every letter has a Latin look-alike is folded to Latin only
//     inside text that is otherwise Latin (at least MIN_LATIN_WORDS Latin words and no other word
//     in that script), as in "the сосо plant" with a Cyrillic "сосо".
// Styled letters that stand for plain ones (fullwidth "Ｈｅｌｌｏ", mathematical bold "𝐇𝐞𝐥𝐥𝐨",
// circled letters) are read as the plain letters, and invisible characters used to split words
// (zero-width space, soft hyphen, word joiner) are removed. The text shown to the user never
// changes; folding applies to the copy CMMNS matches against.

import { TO_LATIN, TO_CYRILLIC, TO_GREEK } from "./confusables-data.js";

const pairs = (s) => { const a = [...s], m = new Map(); for (let i = 0; i + 1 < a.length; i += 2) m.set(a[i], a[i + 1]); return m; };
const TO = { Latin: pairs(TO_LATIN), Cyrillic: pairs(TO_CYRILLIC), Greek: pairs(TO_GREEK) };
const SCRIPTS = [["Latin", /\p{Script=Latin}/u], ["Cyrillic", /\p{Script=Cyrillic}/u], ["Greek", /\p{Script=Greek}/u],
  ["Armenian", /\p{Script=Armenian}/u], ["Cherokee", /\p{Script=Cherokee}/u]];
export const MIN_LATIN_WORDS = 3;

// Zero-width space, word joiner and invisible operators, BOM, soft hyphen, Mongolian vowel
// separator, combining grapheme joiner. ZWJ and ZWNJ shape Indic and Persian text, so they are
// removed only between two letters of the five scripts above.
const INVISIBLE = /[­͏᠎​⁠-⁤﻿]/g;
const JOINER = /(?<=[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}])[‌‍](?=[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}])/gu;
const WORD = /[\p{L}\p{M}\p{N}]+/gu;

function scriptOf(c) {
  if (!/\p{L}/u.test(c)) return "";
  for (const [name, re] of SCRIPTS) if (re.test(c)) return name;
  return "other";
}

// A styled letter or digit that stands for a plain one ("Ｈ", "𝐇", "Ⓗ") becomes the plain one.
// Only characters whose compatibility form is plain ASCII letters or digits are touched.
function plain(text) {
  return text.replace(/[^\x00-\x7F]/gu, (c) => {
    const k = c.normalize("NFKC");
    // a symbol ("Ⓗ") only when it stands for one letter, so "™" stays a symbol
    return (/[\p{L}\p{N}]/u.test(c) ? /^[A-Za-z0-9]+$/ : /^[A-Za-z0-9]$/).test(k) ? k : c;
  });
}

function counts(word) {
  const n = {};
  for (const c of word) { const s = scriptOf(c); if (s) n[s] = (n[s] || 0) + 1; }
  return n;
}

// The script a mixed word folds toward: the text's main script when every letter can be read in
// it, otherwise the script most of the word's own letters use (Latin on a tie).
function targetOf(word, n, main) {
  const fits = (t) => [...word].every((c) => { const s = scriptOf(c); return !s || s === t || TO[t].has(c); });
  if (main && fits(main)) return main;
  return ["Latin", "Cyrillic", "Greek"].filter((s) => n[s]).sort((a, b) => n[b] - n[a] || (a === "Latin" ? -1 : b === "Latin" ? 1 : 0))[0] || "Latin";
}

function foldWord(word, n, main, lone) {
  const scripts = Object.keys(n);
  if (n.other) return word;
  if (scripts.length === 1) {
    // a whole Cyrillic or Greek word made only of Latin look-alikes, alone inside Latin text
    if (lone && [...word].every((c) => !scriptOf(c) || TO.Latin.has(c))) return [...word].map((c) => TO.Latin.get(c) || c).join("");
    return word;
  }
  const target = targetOf(word, n, main);
  return [...word].map((c) => { const s = scriptOf(c); return s && s !== target ? TO[target].get(c) || c : c; }).join("");
}

// The text with look-alike letters folded, for matching only.
export function foldConfusables(text) {
  const s = plain(String(text || "").replace(INVISIBLE, "").replace(JOINER, ""));
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  const words = s.match(WORD) || [];
  const info = words.map((w) => counts(w));
  // Words wholly in one script: the text's main script is the one with the most such words.
  const whole = {};
  for (const n of info) { const k = Object.keys(n); if (k.length === 1 && k[0] !== "other") whole[k[0]] = (whole[k[0]] || 0) + 1; }
  const main = ["Latin", "Cyrillic", "Greek"].filter((x) => whole[x]).sort((a, b) => whole[b] - whole[a])[0] || null;
  const latinText = main === "Latin" && whole.Latin >= MIN_LATIN_WORDS;
  let i = 0;
  return s.replace(WORD, (w) => {
    const n = info[i++], k = Object.keys(n);
    const lone = latinText && k.length === 1 && k[0] !== "Latin" && whole[k[0]] === 1;
    return foldWord(w, n, main, lone);
  });
}
