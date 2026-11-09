// Fill lesson L7's numbers ("Tokens: cutting text into crates") so no number
// in the film or lab is typed by hand. Writes media/school/tokens/facts.json.
//
//   node tools/school/fill_tokens.mjs [media/school/tokens]
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  EOW, pretokenize, wordCounts, charSymbols, byteSymbols, BYTE_BASE, symbolText, learnBPE, pickRandom,
  encodeWord, encodeText, compressionCurve, utf8Table, naiveBytes, roundTrips, utf8Encode, utf8Decode, naiveDecode,
  corpusTrainText, corpusHeldText, CORPUS_SEED, CORPUS_EPISODES,
} from "../../system/school/tokens.mjs";
import { MOBY_DICK, PRIDE_AND_PREJUDICE, SOURCES } from "../../system/school/tokens-texts.mjs";
import { VOCAB, HELD_OUT_SEED } from "../../system/school/corpus.mjs";
import { rng } from "../../system/school/tinyformer-ops.mjs";

const t0 = Date.now();
const outDir = process.argv[2] || "media/school/tokens";
const round = (v, k = 4) => Math.round(v * 10 ** k) / 10 ** k;
const RANDOM_SEEDS = 10;
const show = (m, byteLevel = false) => ({ a: symbolText(m.a, byteLevel), b: symbolText(m.b, byteLevel), made: symbolText(m.a + m.b, byteLevel), count: m.count });
const curveR = (c) => c.map((p) => ({ ...p, tokensPerWord: round(p.tokensPerWord), charsPerToken: round(p.charsPerToken) }));

// BPE against RANDOM_SEEDS runs of random merges, same merge counts, same texts.
function randomControl(counts, nMerges, trainText, heldText, steps, symbols = charSymbols) {
  const runs = [];
  for (let s = 1; s <= RANDOM_SEEDS; s++) {
    const m = learnBPE(counts, nMerges, { symbols, pick: pickRandom(rng(1000 + s)) });
    runs.push({ train: compressionCurve(trainText, m, steps, symbols), held: compressionCurve(heldText, m, steps, symbols) });
  }
  const agg = (key) => steps.filter((s, i) => runs.every((r) => r[key][i])).map((s, i) => {
    const v = runs.map((r) => r[key][i].tokensPerWord);
    return { merges: s, mean: round(v.reduce((a, b) => a + b, 0) / v.length), min: round(Math.min(...v)), max: round(Math.max(...v)) };
  });
  return { seeds: RANDOM_SEEDS, train: agg("train"), held: agg("held") };
}

function unseen(words, model, trainCounts, symbols = charSymbols, byteLevel = false) {
  const known = new Set(model.vocab);
  return words.map((w) => {
    const p = encodeWord(w, model.merges, { symbols });
    return { word: w, seenInTraining: trainCounts.has(w), pieces: p.map((s) => symbolText(s, byteLevel)),
      unknownPieces: p.filter((s) => !known.has(s)).map((s) => symbolText(s, byteLevel)) };
  });
}

// ---- the guides' corpus ----
const cTrain = corpusTrainText(), cHeld = corpusHeldText();
const cCounts = wordCounts(pretokenize(cTrain));
const cModel = learnBPE(cCounts, 100000);
const cSteps = [...new Set([0, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, cModel.merges.length])].sort((a, b) => a - b);
const cWords = pretokenize(cTrain).length;
const tieIn = [cModel.base.length, VOCAB.length, 64, 100, cModel.base.length + cModel.merges.length].map((v) => {
  const e = encodeText(cTrain, cModel.merges, { upto: v - cModel.base.length });
  return { vocab: v, merges: v - cModel.base.length, tokens: e.nTokens, tokensPerWord: round(e.tokensPerWord), wordLevelTokens: cWords };
});
const firstWhole = (() => { // the first merge count at which every corpus word is one token
  for (const h of cModel.history) if (h.tokens === cWords) return h.merges;
  return null;
})();
const corpus = {
  about: `The guides' corpus as text: ${CORPUS_EPISODES} episodes from corpus.mjs (seed ${CORPUS_SEED}), "." and "?" attached to the word before; held out: 500 episodes from the held-out seed. BPE learned until every word is one symbol.`,
  sample: cTrain.split("\n").slice(0, 6),
  chars: cTrain.length, words: cWords, wordTypes: cCounts.size, heldWords: pretokenize(cHeld).length,
  // Word types that are words, not marks ('.' and '?' are pre-tokens too); added after the fact-check of 15 October 2026.
  letterWordTypes: [...cCounts.keys()].filter((w) => /\p{L}/u.test(w)).length, markTypes: [...cCounts.keys()].filter((w) => !/\p{L}/u.test(w)).length,
  base: cModel.base, baseSize: cModel.base.length, totalMerges: cModel.merges.length, firstMerges: cModel.merges.slice(0, 20).map((m) => show(m)),
  allMerges: cModel.merges.map((m) => [m.a, m.b, m.count]),
  curveTrain: curveR(compressionCurve(cTrain, cModel, cSteps)), curveHeld: curveR(compressionCurve(cHeld, cModel, cSteps)),
  randomControl: randomControl(cCounts, cModel.merges.length, cTrain, cHeld, cSteps),
  unseen: unseen(["lamplit", "shellfish", "redcoat", "kettlebell", "lighthouse", "harbour"], cModel, cCounts),
};

// ---- English ----
const eCounts = wordCounts(pretokenize(MOBY_DICK));
const eModel = learnBPE(eCounts, 100000);
const eSteps = [0, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 600, 700, 800, eModel.merges.length];
const eKnown = new Set(eModel.vocab);
const english = {
  about: "BPE learned on the first five paragraphs of Moby-Dick chapter 1 until every word is one symbol; held out: the first ten paragraphs of Pride and Prejudice chapter 1. Characters per token can start below 1 because the end-of-word symbol is its own token until a merge absorbs it.",
  sources: SOURCES, trainText: MOBY_DICK, heldText: PRIDE_AND_PREJUDICE,
  chars: Array.from(MOBY_DICK).length, words: pretokenize(MOBY_DICK).length, wordTypes: eCounts.size,
  // 'words' counts every pre-token, punctuation included; spaceWords splits on whitespace (the everyday count).
  spaceWords: MOBY_DICK.trim().split(/\s+/).length, heldSpaceWords: PRIDE_AND_PREJUDICE.trim().split(/\s+/).length,
  heldWords: pretokenize(PRIDE_AND_PREJUDICE).length, heldWordsUnseen: pretokenize(PRIDE_AND_PREJUDICE).filter((w) => !eCounts.has(w)).length,
  base: eModel.base, baseSize: eModel.base.length, totalMerges: eModel.merges.length, firstMerges: eModel.merges.slice(0, 20).map((m) => show(m)),
  vocabCurve: eModel.history.filter((h, i) => i % 25 === 0 || i === eModel.history.length - 1)
    .map((h) => ({ merges: h.merges, vocab: eModel.base.length + h.merges, symbolsInUse: h.inUse, trainTokens: h.tokens })),
  curveTrain: curveR(compressionCurve(MOBY_DICK, eModel, eSteps)), curveHeld: curveR(compressionCurve(PRIDE_AND_PREJUDICE, eModel, eSteps)),
  randomControl: randomControl(eCounts, eModel.merges.length, MOBY_DICK, PRIDE_AND_PREJUDICE, eSteps),
  unseen: unseen(["lighthouse", "seafaring", "whaleboats", "Pylon", "neighbourhood", "Netherfield"], eModel, eCounts),
  heldUnknownChars: [...new Set(encodeText(PRIDE_AND_PREJUDICE, eModel.merges, { known: eKnown }).pieces.flat().filter((s) => !eKnown.has(s)))],
  heldUnknownTokens: encodeText(PRIDE_AND_PREJUDICE, eModel.merges, { known: eKnown }).unknown,
  crossDomain: (() => { // merges learned on the guides' corpus, applied to English
    const e = encodeText(PRIDE_AND_PREJUDICE, cModel.merges), o = encodeText(PRIDE_AND_PREJUDICE, eModel.merges, { upto: cModel.merges.length });
    return { about: `Pride and Prejudice cut with the ${cModel.merges.length} merges learned on the guides' corpus, against the first ${cModel.merges.length} merges learned on Moby-Dick.`,
      corpusMerges: round(e.tokensPerWord), englishMerges: round(o.tokensPerWord) };
  })(),
};

// ---- bytes ----
const CHARS = ["a", "é", "’", "€", "\u{1F9AD}"];
const bModel = learnBPE(wordCounts(pretokenize(MOBY_DICK)), eModel.merges.length, { symbols: byteSymbols, base: BYTE_BASE });
const bKnown = new Set(bModel.vocab);
const PROBE = "Pylon’s café “bell” \u{1F9AD}";
const pe = encodeText(PROBE, eModel.merges, { known: eKnown }), pb = encodeText(PROBE, bModel.merges, { symbols: byteSymbols, known: bKnown });
const bytes = {
  about: "UTF-8 bytes per character from TextEncoder, and a byte-level BPE learned on the same Moby-Dick text from a base of all 256 bytes (Radford et al. 2019, section 2.2). Control: one byte per character by keeping the low 8 bits of the code point, which cannot be decoded back.",
  table: utf8Table(CHARS),
  passages: [["MOBY_DICK", MOBY_DICK], ["PRIDE_AND_PREJUDICE", PRIDE_AND_PREJUDICE]].map(([n, s]) => ({ name: n, chars: Array.from(s).length, bytes: utf8Encode(s).length,
    nonAscii: [...new Set(Array.from(s).filter((c) => c.codePointAt(0) > 127))] })),
  naiveControl: CHARS.map((c) => ({ char: c, utf8RoundTrip: roundTrips(c, utf8Encode, utf8Decode), naiveRoundTrip: roundTrips(c, naiveBytes, naiveDecode), naiveByte: naiveBytes(c)[0] })),
  byteBPE: { baseSize: bModel.base.length, merges: bModel.merges.length, firstMerges: bModel.merges.slice(0, 20).map((m) => show(m, true)),
    heldTokensPerWord: round(encodeText(PRIDE_AND_PREJUDICE, bModel.merges, { symbols: byteSymbols }).tokensPerWord),
    heldUnknownTokens: encodeText(PRIDE_AND_PREJUDICE, bModel.merges, { symbols: byteSymbols, known: bKnown }).unknown },
  charBPE: { baseSize: eModel.base.length, merges: eModel.merges.length,
    heldTokensPerWord: round(encodeText(PRIDE_AND_PREJUDICE, eModel.merges).tokensPerWord), heldUnknownTokens: english.heldUnknownTokens },
  probe: { text: PROBE, charLevel: { pieces: pe.pieces.map((p) => p.map((s) => symbolText(s))), unknown: pe.unknown },
    byteLevel: { pieces: pb.pieces.map((p) => p.map((s) => symbolText(s, true))), unknown: pb.unknown } },
  gpt2: {
    citation: "Radford, Wu, Child, Luan, Amodei, Sutskever (2019), Language Models are Unsupervised Multitask Learners, OpenAI, section 2.2 Input Representation and section 2.3 Model.",
    says: [
      "Reference BPE implementations work on Unicode code points; covering all of Unicode that way needs a base vocabulary of over 130,000 symbols before any merge (section 2.2).",
      "A byte-level BPE needs a base vocabulary of only 256 (section 2.2).",
      "Plain BPE on bytes wasted slots on variants such as dog. dog! dog?, so GPT-2 blocks merges across character categories, with an exception for spaces (section 2.2).",
      "Because any Unicode string is a byte string, the model can assign a probability to any string (section 2.2).",
      "The GPT-2 vocabulary has 50,257 tokens (section 2.3).",
    ],
  },
};

const facts = {
  about: "Computed by tools/school/fill_tokens.mjs. Do not edit by hand. Byte-pair encoding as in Sennrich, Haddow and Birch (2016), section 3.2: characters plus an end-of-word symbol, merge the most frequent adjacent pair within words, repeat.",
  method: { citation: "Sennrich, Haddow, Birch (2016), Neural Machine Translation of Rare Words with Subword Units, ACL, section 3.2 and Algorithm 1.",
    endOfWord: EOW, pretokenizer: "a run of letters, a run of digits, or one other non-space character",
    ties: "equal counts: the pair whose left symbol sorts first (JavaScript string order), then the right symbol",
    vocabSize: "base symbols plus one per merge, as the paper states; symbolsInUse counts symbols still present in the training words",
    tokensPerWord: "tokens divided by pre-tokenized words (punctuation marks count as words, as in the attention model)",
    charsPerToken: "letters, digits and punctuation (no whitespace) divided by tokens; the end-of-word symbol is part of a token, not a character" },
  corpus, english, bytes,
  tieIn: { about: `The attention model is word-level with ${VOCAB.length} words. The same training corpus cut by BPE at a few vocabulary sizes (base characters plus merges). Every corpus word is a single token after ${firstWhole} merges (vocabulary ${cModel.base.length + firstWhole}).`,
    attentionVocab: VOCAB.length, rows: tieIn, everyWordWholeAtMerges: firstWhole },
  heldOutSeed: HELD_OUT_SEED,
  seconds: 0,
};
facts.seconds = round((Date.now() - t0) / 1000, 2);
mkdirSync(outDir, { recursive: true });
const ascii = JSON.stringify(facts).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
writeFileSync(join(outDir, "facts.json"), ascii + "\n");
const brief = (c) => c.map((p) => `${p.merges}:${p.tokensPerWord}`).join(" ");
console.log(JSON.stringify({
  corpus: { words: corpus.words, base: corpus.baseSize, merges: corpus.totalMerges, train: brief(corpus.curveTrain), held: brief(corpus.curveHeld),
    randTrain: corpus.randomControl.train.map((p) => `${p.merges}:${p.min}-${p.max}`).join(" "), unseen: corpus.unseen.map((u) => u.pieces.join("|")) },
  english: { words: english.words, types: english.wordTypes, base: english.baseSize, merges: english.totalMerges, train: brief(english.curveTrain), held: brief(english.curveHeld),
    randHeld: english.randomControl.held.map((p) => `${p.merges}:${p.min}-${p.max}`).join(" "), unseen: english.unseen.map((u) => u.pieces.join("|")),
    heldUnknownChars: english.heldUnknownChars, crossDomain: english.crossDomain },
  bytes: { table: bytes.table.map((r) => `${r.codePoint}:${r.hex}`), passages: bytes.passages.map((p) => `${p.name} ${p.chars}c ${p.bytes}b`),
    byteBPE: bytes.byteBPE.heldTokensPerWord, byteUnknown: bytes.byteBPE.heldUnknownTokens, charBPE: bytes.charBPE, probe: bytes.probe },
  tieIn: facts.tieIn, seconds: facts.seconds,
}, null, 1));
