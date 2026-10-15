// Tests for lesson L7, "Tokens: cutting text into crates".
// Run: node --test system/school/tokens.test.mjs
// Every claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  EOW, pretokenize, wordCounts, charSymbols, byteSymbols, BYTE_BASE, symbolText, learnBPE, pickFrequent, pickRandom,
  encodeWord, encodeText, compressionCurve, decodePieces, utf8Table, naiveBytes, roundTrips, utf8Encode, utf8Decode, naiveDecode,
  corpusText,
} from "./tokens.mjs";
import { MOBY_DICK, PRIDE_AND_PREJUDICE } from "./tokens-texts.mjs";
import { rng } from "./tinyformer-ops.mjs";

// The dictionary in Sennrich et al. (2016), Algorithm 1.
const PAPER_DICT = new Map([["low", 5], ["lower", 2], ["newest", 6], ["widest", 3]]);
const pairs = (m) => m.merges.map((x) => x.a + " " + x.b);

test("pre-tokenizer: letter runs, digit runs, single other characters", () => {
  assert.deepEqual(pretokenize("pylon put a cone on the kettle."), ["pylon", "put", "a", "cone", "on", "the", "kettle", "."]);
  assert.deepEqual(pretokenize("people’s 1851-ish"), ["people", "’", "s", "1851", "-", "ish"]);
  assert.deepEqual(charSymbols("low"), ["l", "o", "w", EOW]);
});

test("Algorithm 1 dictionary: counts are frequency-weighted and the first merges are es, est, est</w>, lo", () => {
  const m = learnBPE(PAPER_DICT, 10);
  assert.deepEqual(pairs(m).slice(0, 4), ["e s", "es t", "est " + EOW, "l o"]);
  assert.deepEqual(m.merges.slice(0, 4).map((x) => x.count), [9, 9, 9, 7], "newest 6 + widest 3 = 9; low 5 + lower 2 = 7");
  assert.equal(m.vocab.length, m.base.length + 10, "vocabulary = base symbols + merges");
  assert.equal(m.history[0].tokens, 5 * 4 + 2 * 6 + 6 * 7 + 3 * 7);
});

test("Figure 1 dictionary {low, lowest, newer, wider}: the unseen word lower is cut as low er</w>, as in the paper", () => {
  const m = learnBPE(new Map([["low", 1], ["lowest", 1], ["newer", 1], ["wider", 1]]), 4);
  assert.deepEqual(encodeWord("lower", m.merges), ["low", "er" + EOW]);
  // The paper's own four merges (r</w>, lo, low, er</w>) give the same cut.
  const paper = [["r", EOW], ["l", "o"], ["lo", "w"], ["e", "r" + EOW]].map(([a, b]) => ({ a, b }));
  assert.deepEqual(encodeWord("lower", paper), ["low", "er" + EOW]);
});

test("ties break by the stated order, and learning is deterministic", () => {
  const tie = new Map([["ab", 1], ["cd", 1]]);
  assert.deepEqual(pairs(learnBPE(tie, 1)), ["a b"]);
  assert.equal(pickFrequent(new Map([["b￿a", 2], ["a￿z", 2], ["a￿b", 1]])), "a￿z");
  const c = wordCounts(pretokenize(MOBY_DICK));
  assert.deepEqual(learnBPE(c, 50).merges, learnBPE(c, 50).merges);
});

test("encodeWord in rank order equals applying merges one by one; decoding restores the words", () => {
  const m = learnBPE(wordCounts(pretokenize(MOBY_DICK)), 300);
  for (const w of pretokenize(PRIDE_AND_PREJUDICE).slice(0, 80)) {
    let syms = charSymbols(w);
    for (const { a, b } of m.merges) {
      const out = [];
      for (let i = 0; i < syms.length; i++) if (syms[i] === a && syms[i + 1] === b) { out.push(a + b); i++; } else out.push(syms[i]);
      syms = out;
    }
    assert.deepEqual(encodeWord(w, m.merges), syms, w);
  }
  const e = encodeText(PRIDE_AND_PREJUDICE, m.merges);
  assert.deepEqual(decodePieces(e.pieces), pretokenize(PRIDE_AND_PREJUDICE));
});

test("training words match the learner's own segmentation", () => {
  const c = wordCounts(pretokenize(MOBY_DICK)), m = learnBPE(c, 200);
  for (const e of m.words) assert.deepEqual(encodeWord(e.word, m.merges), e.syms, e.word);
  assert.equal(encodeText(MOBY_DICK, m.merges).nTokens, m.history.at(-1).tokens);
});

test("compression grows with merges on training and held-out text", () => {
  const m = learnBPE(wordCounts(pretokenize(MOBY_DICK)), 400);
  for (const text of [MOBY_DICK, PRIDE_AND_PREJUDICE]) {
    const c = compressionCurve(text, m, [0, 50, 100, 200, 400]);
    for (let i = 1; i < c.length; i++) assert.ok(c[i].tokensPerWord <= c[i - 1].tokensPerWord && c[i].charsPerToken >= c[i - 1].charsPerToken);
  }
});

test("control: the same number of random merges compresses worse than BPE, on training and held-out text", () => {
  const counts = wordCounts(pretokenize(MOBY_DICK)), n = 200;
  const bpe = learnBPE(counts, n);
  const tpw = (m, t) => encodeText(t, m.merges).tokensPerWord;
  for (let s = 1; s <= 5; s++) {
    const rnd = learnBPE(counts, n, { pick: pickRandom(rng(s)) });
    assert.equal(rnd.merges.length, n);
    const beatsTrain = tpw(rnd, MOBY_DICK) < tpw(bpe, MOBY_DICK), beatsHeld = tpw(rnd, PRIDE_AND_PREJUDICE) < tpw(bpe, PRIDE_AND_PREJUDICE);
    assert.equal(beatsTrain, false, `seed ${s}: random merges must not beat BPE on training text`);
    assert.equal(beatsHeld, false, `seed ${s}: nor on held-out text`);
  }
});

test("guides' corpus: every word becomes one token, and fewer merges leave more tokens than words", () => {
  const text = corpusText(400, 3), words = pretokenize(text), m = learnBPE(wordCounts(words), 100000);
  assert.ok(wordCounts(words).size <= 46);
  assert.equal(m.history.at(-1).tokens, words.length);
  assert.ok(encodeText(text, m.merges, { upto: 20 }).nTokens > words.length);
});

test("UTF-8: 1 to 4 bytes per character, and the low-byte control cannot be decoded", () => {
  const t = utf8Table(["a", "é", "€", "\u{1F9AD}"]);
  assert.deepEqual(t.map((r) => r.nBytes), [1, 2, 3, 4]);
  assert.equal(t[1].hex, "c3 a9");
  assert.equal(t[3].codePoint, "U+1F9AD");
  for (const c of ["é", "€", "\u{1F9AD}"]) assert.ok(roundTrips(c, utf8Encode, utf8Decode), c);
  assert.equal(roundTrips("€", naiveBytes, naiveDecode), false, "the control must fail past U+00FF");
  assert.deepEqual(naiveBytes("İ"), naiveBytes("0"), "two different characters, one byte: information lost");
});

test("byte-level BPE knows every byte; character-level BPE meets unknown characters", () => {
  const counts = wordCounts(pretokenize(MOBY_DICK));
  const cm = learnBPE(counts, 200), bm = learnBPE(counts, 200, { symbols: byteSymbols, base: BYTE_BASE });
  const probe = "café “bell” \u{1F9AD}";
  const ce = encodeText(probe, cm.merges, { known: new Set(cm.vocab) });
  const be = encodeText(probe, bm.merges, { symbols: byteSymbols, known: new Set(bm.vocab) });
  assert.ok(ce.unknown >= 4, "the control must fail: e-acute, two curly quotes and the seal are unknown characters");
  assert.equal(be.unknown, 0);
  assert.deepEqual(decodePieces(be.pieces, true), pretokenize(probe));
  assert.equal(symbolText(String.fromCharCode(0xc3, 0xa9), true), "é");
  assert.equal(symbolText(String.fromCharCode(0xc3), true), "<c3>");
});

const FACTS = new URL("../../media/school/tokens/facts.json", import.meta.url);
test("facts.json, when present, records random merges compressing worse than BPE at every step", { skip: !existsSync(FACTS) }, () => {
  const f = JSON.parse(readFileSync(FACTS, "utf8"));
  for (const sec of [f.corpus, f.english]) {
    for (const key of ["train", "held"]) {
      const bpe = new Map(sec[key === "train" ? "curveTrain" : "curveHeld"].map((p) => [p.merges, p.tokensPerWord]));
      for (const p of sec.randomControl[key]) if (p.merges > 0) assert.ok(p.min > bpe.get(p.merges), `${key} at ${p.merges}`);
    }
  }
  assert.equal(f.tieIn.attentionVocab, 46);
});
