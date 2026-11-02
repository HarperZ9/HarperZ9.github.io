// Secret coercion (added 2026-10-23 from feed test 3): a leader or an institution is blackmailed,
// compromised, owned or controlled by a state or a group, or that state or group "has dirt on" them.
// It names the technique, never a side: every pattern takes the same list of actors, and that list
// holds states, leaders, agencies, parties, peoples, lobbies and companies from every direction, so
// "blackmailed by Israel" reads like "blackmailed by Russia", "by the CIA", "by the Democrats" or
// "by Pfizer". tests/theories.coercion.test.js runs every pattern over every actor.
//
// Precision guards, on top of the ones every theory has (debunking, mockery, negation, reported
// speech, quotes): a conditional or a question ("if he were being blackmailed by ..."), an allegation
// someone else made ("allegedly", "according to", "accused ... of"), a documented case ("convicted
// of blackmail", "the court found") and a computer compromise ("his phone was compromised by ...")
// skip the match. Precision comes first, so a first-person claim inside such a sentence is missed.

import { IDENTITY_GROUPS } from "./lexicon.js";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alt = (list) => [...new Set(list)].map(esc).sort((a, b) => b.length - a.length).join("|");

// States, their capitals and leaders, agencies, parties and movements, lobbies, companies and donors.
const ACTOR_LIST = [
  "israel", "russia", "china", "iran", "ukraine", "america", "the us", "the usa", "the united states", "the uk", "britain",
  "saudi arabia", "the saudis", "qatar", "turkey", "india", "pakistan", "north korea", "germany", "france", "the eu", "nato", "the un",
  "the kremlin", "moscow", "beijing", "tehran", "tel aviv", "jerusalem", "kyiv", "washington", "london", "brussels", "riyadh", "doha",
  "putin", "xi", "xi jinping", "netanyahu", "bibi", "zelensky", "zelenskyy", "erdogan", "modi", "kim jong un", "the ayatollah",
  "mossad", "the mossad", "cia", "fbi", "nsa", "kgb", "fsb", "gru", "mi6", "mss", "the deep state", "deep state",
  "ccp", "chinese communist party", "the communist party", "the democrats", "democrats", "the dems", "dems", "the dnc",
  "the republicans", "republicans", "the gop", "gop", "the rnc", "the tories", "tories", "labour", "the communists",
  "the globalists", "globalists", "the zionists", "zionists", "the elites", "the illuminati", "the freemasons", "the masons",
  "the cartels", "the cartel", "the mafia", "the mob", "hamas", "hezbollah",
  "aipac", "the nra", "the israel lobby", "the gun lobby", "the wef", "the banks", "the bankers", "wall street",
  "big pharma", "pfizer", "big tech", "google", "facebook", "meta", "microsoft", "amazon", "blackrock", "vanguard",
  "goldman sachs", "big oil", "exxon", "soros", "george soros", "gates", "bill gates", "musk", "elon musk", "the kochs", "the koch brothers",
  ...IDENTITY_GROUPS, ...IDENTITY_GROUPS.map((g) => `the ${g}`),
];
export const COERCION_ACTORS = [...new Set(ACTOR_LIST)];
const A = `(?:the\\s+)?(?:${alt(COERCION_ACTORS)})`;
// Adjectives for "a Russian asset", "a Kremlin puppet": nationalities, agencies and movements alike.
export const COERCION_ADJ = ["israeli", "russian", "chinese", "iranian", "ukrainian", "american", "british", "saudi", "qatari",
  "turkish", "indian", "pakistani", "north korean", "german", "french", "kremlin", "mossad", "cia", "ccp", "zionist", "globalist",
  "soros", "democrat", "republican", "gop", "pharma", "cartel"];
const ADJ = alt(COERCION_ADJ);
// Who can be coerced: a person or a lawmaking body, never a place or a firm ("the board is controlled by").
const PERSON = "(?:he|she|him|her|the president|our president|the prime minister|the pm|our pm|the chancellor|the senator|the speaker|our leaders?|our politicians|politicians|our government)";
const BODY = "(?:congress|the senate|parliament|the white house|downing street|our government|our politicians|politicians)";
const CONTROLLED = "him|her|the president|our president|the prime minister|our pm";
const OWNED = `${CONTROLLED}|congress|our politicians|politicians`;
const BE ="(?:is|are|was|were|has been|have been|'s|'re|being|been|getting|gets|got)";

export const COERCION_PATTERNS = [
  // "Trump is being blackmailed by Israel", "they were all blackmailed by the CIA"
  `\\b${BE}\\s+(?:\\w+\\s+){0,2}?blackmailed\\s+(?:\\w+\\s+){0,2}?by\\s+${A}\\b`,
  // "Russia is blackmailing him", "Mossad blackmails our politicians", "the CIA blackmailed him"
  `\\b${A}\\s+(?:(?:is|are|has been|have been)\\s+)?(?:\\w+\\s+)?blackmail(?:s|ing|ed)\\s+[a-z]+\\b`,
  // "China has dirt on him", "the Kremlin holds kompromat on", "the CIA has tapes on"
  `\\b${A}\\s+(?:has|have|holds?|has got|have got|is holding|are holding|got)\\s+(?:\\w+\\s+){0,2}?(?:kompromat|dirt|compromising (?:material|tapes|videos?|photos?|files?)|tapes)\\s+on\\b`,
  `\\b${A}(?:'s|'|s)?\\s+kompromat\\b`,
  // "he is compromised by Beijing", "Trump is totally compromised by Russia"
  `\\b${BE}\\s+(?:\\w+\\s+){0,2}?compromised\\s+by\\s+${A}\\b`,
  // "he is owned by AIPAC", "the president is controlled by China", "congress is bought and paid for by"
  `\\b${PERSON}\\s+${BE}\\s+(?:being\\s+)?(?:\\w+\\s+){0,2}?(?:controlled|owned|bought|handled)\\s+(?:and\\s+(?:paid for|controlled|owned)\\s+)?by\\s+${A}\\b`,
  `\\b${BODY}\\s+${BE}\\s+(?:\\w+\\s+){0,2}?(?:owned|bought(?:\\s+and\\s+paid\\s+for)?)\\s+by\\s+${A}\\b`,
  // "Israel owns congress", "China controls him". A party "controls the Senate" or "the White House"
  // after an election, so control takes a person only, and ownership a person, congress or politicians.
  `\\b${A}\\s+(?:(?:totally|completely|fully|secretly|basically|literally)\\s+)?(?:owns?\\s+(?:${OWNED})|controls?\\s+(?:${CONTROLLED}))\\b`,
  // "he is a Russian asset", "she's a Kremlin puppet"
  `\\b${BE}\\s+(?:a|an)\\s+(?:\\w+\\s+)?(?:${ADJ})\\s+(?:asset|puppet|stooge|plant)\\b`,
];

// The sentence around a match: from the last end mark before it to the next one after it.
function sentenceAround(s, index, length) {
  const head = s.slice(0, index), tail = s.slice(index + length);
  const start = Math.max(head.lastIndexOf("."), head.lastIndexOf("!"), head.lastIndexOf("?"), head.lastIndexOf("\n")) + 1;
  const m = tail.match(/[.!?\n]/);
  return { before: head.slice(start), after: m ? tail.slice(0, m.index + 1) : tail };
}

const CONDITIONAL = /\b(?:if|whether|what if|suppose|supposing|imagine|imagining|unless|assuming|in case|could|might|may|would|wonder|wondering|hypothetically)\b/i;
const ALLEGED = /\b(?:allegedly|reportedly|supposedly|according to|accus(?:e|es|ed|ing|ation|ations)|allegations?|rumou?rs?|report(?:s|ed)? that|wrote that|told|tweeted|posted that|theory that)\b/i;
const DOCUMENTED = /\b(?:convicted|pleaded guilty|pled guilty|found guilty|charged|indicted|sentenced|acquitted|court|jury|prosecutors?|trial|lawsuit|sued|verdict)\b/i;
const COMPUTER = /\b(?:hack(?:ed|ers?|ing)?|cyber\w*|systems?|networks?|servers?|accounts?|data|e-?mails?|passwords?|breach\w*|malware|software|devices?|phones?|frozen|sanctions?)\b/i;

// True when the match sits in a conditional or a question, repeats an allegation, describes a
// documented case or a computer compromise: the match is then skipped.
export function coercionSkipped(s, index, length) {
  const { before, after } = sentenceAround(String(s || ""), index, length);
  const lead = before + s.slice(index, index + length), sentence = lead + after;
  return /\?/.test(after) || CONDITIONAL.test(lead) || ALLEGED.test(lead) || DOCUMENTED.test(sentence) || COMPUTER.test(sentence);
}
