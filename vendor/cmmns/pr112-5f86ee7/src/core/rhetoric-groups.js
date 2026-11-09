// Group stereotype grammar added from the 2026-10-23 feed test (82 X posts, a development set; the
// rules were tuned there and on the dev split of the labelled corpora, then read once on test).
// Each rule names a whole people by faith, race, ethnicity or origin; the lists are in lexicon.js and
// every faith and race is in them, whichever side usually targets it (tests/feed.stereotype.test.js
// runs each rule over every group). rhetoric.js scores these with its stricter guard, so someone
// else's words ("posts saying ...") and counter-speech ("... is racist") are skipped.

import * as L from "./lexicon.js";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alt = (list) => [...new Set(list)].map(esc).sort((a, b) => b.length - a.length).join("|");
const DET = "(?:the\\s+|these\\s+|those\\s+|all\\s+(?:the\\s+)?|most\\s+)?";
const IDA = alt(L.IDENTITY_ADJ), IDG = alt(L.IDENTITY_GROUPS), PEOPLE = alt([...L.IDENTITY_GROUPS, ...L.ORIGIN_GROUPS]);
const MIGRANT = "(?:immigrants|migrants|refugees|asylum seekers)";
// "the media", "US policy", "our government", "American foreign policy"
const OBJECT = `(?:(?:the|our|us|u\\.s\\.|american|western|british|european)\\s+){0,2}(?:${alt(L.CONTROL_OBJECTS)})\\b`;
const HEDGE = "(?:secretly\\s+|really\\s+|basically\\s+|still\\s+|literally\\s+|completely\\s+|totally\\s+)?";

const RULES = [
  // "an uber wealthy Jewish cabal": a secret ruling group named by a people
  `\\b(?:${IDA})\\s+(?:cabal|cabals|puppet masters)\\b`,
  // "Jewish money and priorities control US policy"
  `\\b(?:${IDA})\\s+(?:${alt(L.CONTROL_NOUNS)})(?:\\s+(?:and|&)\\s+[\\w-]+)?\\s+${HEDGE}(?:${alt(L.CONTROL_VERBS)})\\s+${OBJECT}`,
  // "Jews control the media", "white people run everything"
  `\\b${DET}(?:${IDG})\\s+${HEDGE}(?:${alt(L.CONTROL_VERBS)})\\s+${OBJECT}`,
  // "the Muslims will probably attack them": a people predicted to commit violence
  `\\b${DET}(?:${IDG}|${MIGRANT}|(?:${IDA})\\s+(?:men|people|${MIGRANT}))\\s+will\\s+(?:probably\\s+|surely\\s+|definitely\\s+|eventually\\s+|soon\\s+|just\\s+)?(?:${alt(L.ATTACK_VERBS)})\\b`,
  // "tolerating Muslim immigrants will cause your downfall": a people as a country's ruin
  `\\b(?:(?:${IDA})\\s+(?:immigrants|immigration|migrants|refugees|people)|${DET}(?:${PEOPLE}))\\s+(?:will|would|is going to|are going to|are gonna)` +
    `\\s+(?:cause|be|bring(?:\\s+about)?)\\s+(?:the\\s+|your\\s+|our\\s+|their\\s+|its\\s+|this\\s+country's\\s+)?(?:${alt(L.RUIN_NOUNS)})\\b`,
  // "illiterate X", "inbred X": a trait word put before a people
  `\\b(?:${alt(L.ATTRIBUTIVE_TRAITS)})\\s+(?:${PEOPLE})\\b`,
];

export const GROUP_STEREOTYPE = new RegExp(RULES.join("|"), "i");
