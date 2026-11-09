// Lesson L7, "Tokens: cutting text into crates". Byte-pair encoding (BPE) as
// Sennrich, Haddow and Birch (2016, "Neural Machine Translation of Rare Words
// with Subword Units", ACL, section 3.2) describe it: start from characters
// plus an end-of-word symbol, count adjacent symbol pairs inside words
// (weighted by word frequency, never across word boundaries), replace every
// occurrence of the most frequent pair with one new symbol, and repeat. The
// final vocabulary is the starting symbols plus one symbol per merge.
//
// Choices this file makes and states:
//  - Pre-tokenizer: a "word" is a run of letters, a run of digits, or one
//    other non-space character (so "kettle." is "kettle" then "."). Sennrich
//    et al. ran BPE on Moses-tokenized text; this is a simpler stand-in.
//  - End-of-word symbol: EOW = "</w>", a separate symbol at the end of every
//    word, as in the paper's Algorithm 1.
//  - Ties: among pairs with the same count, the pair whose left symbol sorts
//    first wins, then the right symbol (JavaScript string order, which is
//    UTF-16 code unit order). The paper's own example used Python dict order.
//  - Overlaps: pairs are counted overlapping ("a a a" holds the pair (a, a)
//    twice) and merged left to right without overlap ("a a a" becomes
//    "aa a"), as the paper's regex does.
//  - Byte level: byteSymbols starts from the UTF-8 bytes of a word instead
//    of its characters, so the base vocabulary is all 256 bytes (Radford et
//    al. 2019, GPT-2, section 2.2). Each byte b is held as the one-character
//    string String.fromCharCode(b); symbolText turns a symbol back into text.
//    GPT-2 keeps a leading space inside tokens and has no end-of-word symbol;
//    this file keeps EOW at byte level too, so the two encoders differ only
//    in their starting symbols.
//
// Plain ES module, no dependencies, Node and browser.

import { rng } from "./tinyformer-ops.mjs";
import { sampleSentence, HELD_OUT_SEED } from "./corpus.mjs";

export const EOW = "</w>";
const SEP = "￿"; // joins a pair into one Map key; never inside a symbol

// ---- text -------------------------------------------------------------------

export const pretokenize = (text) => text.match(/\p{L}+|\p{N}+|[^\s\p{L}\p{N}]/gu) ?? [];

// Word -> count, in first-seen order.
export function wordCounts(words) {
  const m = new Map();
  for (const w of words) m.set(w, (m.get(w) || 0) + 1);
  return m;
}

export const charSymbols = (word) => [...Array.from(word), EOW];
const ENC = new TextEncoder();
export const byteSymbols = (word) => [...Array.from(ENC.encode(word), (b) => String.fromCharCode(b)), EOW];
export const BYTE_BASE = Array.from({ length: 256 }, (_, b) => String.fromCharCode(b));

// A symbol as readable text. Byte-level symbols are decoded as UTF-8 when
// they form whole characters, else shown as <xx> hex bytes.
export function symbolText(sym, byteLevel = false) {
  if (!byteLevel || sym === EOW) return sym;
  const end = sym.endsWith(EOW), body = end ? sym.slice(0, -EOW.length) : sym;
  const bytes = Uint8Array.from(body, (c) => c.charCodeAt(0));
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { text = Array.from(bytes, (b) => "<" + b.toString(16).padStart(2, "0") + ">").join(""); }
  return text + (end ? EOW : "");
}

// The guides' corpus as plain text: `n` episodes from corpus.mjs, "." and "?"
// attached to the word before them, one episode per line.
export function corpusText(n, seed) {
  const r = rng(seed), lines = [];
  for (let i = 0; i < n; i++) lines.push(sampleSentence(r).join(" ").replace(/ ([.?])/g, "$1"));
  return lines.join("\n");
}
export const CORPUS_SEED = 7, CORPUS_EPISODES = 3000;
export const corpusTrainText = () => corpusText(CORPUS_EPISODES, CORPUS_SEED);
export const corpusHeldText = (n = 500) => corpusText(n, HELD_OUT_SEED);

// ---- learning -----------------------------------------------------------------

function countPairs(entries) {
  const pairs = new Map();
  for (const { syms, n } of entries) {
    for (let i = 0; i + 1 < syms.length; i++) {
      const k = syms[i] + SEP + syms[i + 1];
      pairs.set(k, (pairs.get(k) || 0) + n);
    }
  }
  return pairs;
}

function mergeSyms(syms, a, b) {
  const out = [];
  for (let i = 0; i < syms.length; i++) {
    if (i + 1 < syms.length && syms[i] === a && syms[i + 1] === b) { out.push(a + b); i++; }
    else out.push(syms[i]);
  }
  return out;
}

const cmpKey = (x, y) => {
  const [xa, xb] = x.split(SEP), [ya, yb] = y.split(SEP);
  return xa < ya ? -1 : xa > ya ? 1 : xb < yb ? -1 : xb > yb ? 1 : 0;
};

// The most frequent pair, ties by the stated order.
export function pickFrequent(pairs) {
  let best = null, bestN = -1;
  for (const [k, n] of pairs) if (n > bestN || (n === bestN && cmpKey(k, best) < 0)) { best = k; bestN = n; }
  return best;
}
// The control: a uniformly random pair among those present.
export const pickRandom = (r) => (pairs) => {
  const keys = [...pairs.keys()].sort(cmpKey);
  return keys[Math.floor(r() * keys.length)];
};

// Learn up to `numMerges` merges from a word -> count map. Stops early when
// every word is one symbol. Returns the merges in order, the base symbols,
// and per-step history: tokens on the training words and symbols in use.
export function learnBPE(counts, numMerges, { symbols = charSymbols, pick = pickFrequent, base } = {}) {
  let entries = [...counts].map(([w, n]) => ({ word: w, n, syms: symbols(w) }));
  const baseSet = new Set(base ? [...base, EOW] : []);
  if (!base) for (const e of entries) for (const s of e.syms) baseSet.add(s);
  const tokens = () => entries.reduce((s, e) => s + e.n * e.syms.length, 0);
  const inUse = () => new Set(entries.flatMap((e) => e.syms)).size;
  const merges = [], history = [{ merges: 0, tokens: tokens(), inUse: inUse() }];
  for (let m = 0; m < numMerges; m++) {
    const pairs = countPairs(entries);
    if (pairs.size === 0) break;
    const k = pick(pairs), [a, b] = k.split(SEP);
    merges.push({ a, b, count: pairs.get(k) });
    entries = entries.map((e) => ({ ...e, syms: mergeSyms(e.syms, a, b) }));
    history.push({ merges: m + 1, tokens: tokens(), inUse: inUse() });
  }
  const vocab = [...[...baseSet].sort(), ...merges.map((x) => x.a + x.b)];
  return { merges, base: [...baseSet].sort(), vocab, history, words: entries };
}

// ---- encoding ------------------------------------------------------------------

// Apply the first `upto` merges to one word. Repeatedly merging the
// lowest-ranked pair present gives the same result as applying the merges
// one after another in learned order (a pair made of a new symbol always
// ranks after the merge that made it).
export function encodeWord(word, merges, { symbols = charSymbols, upto = merges.length, rank } = {}) {
  rank ??= rankOf(merges);
  let syms = symbols(word);
  for (;;) {
    let best = -1;
    for (let i = 0; i + 1 < syms.length; i++) {
      const r = rank.get(syms[i] + SEP + syms[i + 1]);
      if (r !== undefined && r < upto && (best < 0 || r < best)) best = r;
    }
    if (best < 0) return syms;
    syms = mergeSyms(syms, merges[best].a, merges[best].b);
  }
}
export const rankOf = (merges) => new Map(merges.map((m, i) => [m.a + SEP + m.b, i]));

// Encode a whole text. Characters count letters, digits and punctuation
// (whitespace is not a character here); EOW is part of a token, never a
// character. `known` is the vocabulary set; a token outside it is unknown.
export function encodeText(text, merges, { symbols = charSymbols, upto = merges.length, known } = {}) {
  const words = pretokenize(text), rank = rankOf(merges), cache = new Map();
  let nTokens = 0, nChars = 0, unknown = 0;
  const pieces = [];
  for (const w of words) {
    let t = cache.get(w);
    if (!t) { t = encodeWord(w, merges, { symbols, upto, rank }); cache.set(w, t); }
    pieces.push(t);
    nTokens += t.length;
    nChars += Array.from(w).length;
    if (known) unknown += t.filter((s) => !known.has(s)).length;
  }
  return { pieces, nWords: words.length, nTokens, nChars, unknown,
    tokensPerWord: nTokens / Math.max(1, words.length), charsPerToken: nChars / Math.max(1, nTokens) };
}

// Tokens per word and characters per token at each merge count in `steps`.
export function compressionCurve(text, model, steps, symbols = charSymbols) {
  return steps.filter((s) => s <= model.merges.length).map((s) => {
    const e = encodeText(text, model.merges, { symbols, upto: s });
    return { merges: s, vocab: model.base.length + s, tokens: e.nTokens, tokensPerWord: e.tokensPerWord, charsPerToken: e.charsPerToken };
  });
}

// Undo an encoding: join each word's pieces and drop EOW.
// Byte-level pieces are joined as bytes first, since one character's bytes
// can sit in different pieces.
export const decodePieces = (pieces, byteLevel = false) =>
  pieces.map((p) => symbolText(p.join(""), byteLevel).replace(EOW, ""));

// ---- bytes -------------------------------------------------------------------------

// How characters become UTF-8 bytes (TextEncoder is UTF-8 by definition).
export function utf8Table(chars) {
  return chars.map((c) => {
    const bytes = Array.from(ENC.encode(c));
    return { char: c, codePoint: "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"),
      bytes, hex: bytes.map((b) => b.toString(16).padStart(2, "0")).join(" "), nBytes: bytes.length };
  });
}
// The control: one byte per character by keeping the low 8 bits of the code
// point. It cannot be undone for anything past U+00FF.
export const naiveBytes = (s) => Array.from(s, (c) => c.codePointAt(0) & 0xff);
export const roundTrips = (s, encodeFn, decodeFn) => decodeFn(encodeFn(s)) === s;
export const utf8Encode = (s) => Array.from(ENC.encode(s));
export const utf8Decode = (b) => new TextDecoder().decode(Uint8Array.from(b));
export const naiveDecode = (b) => String.fromCharCode(...b);
