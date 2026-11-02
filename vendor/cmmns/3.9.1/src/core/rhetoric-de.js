// German grammar for the stance-neutral markers, built the way rhetoric-fr.js is. German puts the
// verb last ("man sollte alle X erschießen") and adds -n in the dative plural ("Tod den
// Ausländern"), so groups take an optional "n". These run only for families not yet found.

import * as L from "./lexicon-de.js";
import { RX, scoreRules } from "./rhetoric-util.js";

const { alt, B, E, FILL, re } = RX;
const G = `(?:${alt(L.GROUPS_DE)})n?`, D = alt(L.DEHUMANISE_DE);
const DET = "(?:die\\s+|diese\\s+|alle\\s+|den\\s+|diesen\\s+|allen\\s+)*";
const ADV = "(?:(?:alle|doch|nur|halt|eben|einfach|echt|wirklich|allesamt|nichts als|nichts anderes als)\\s+)*";
const COP = "(?:sind|bleiben|waren)";

export const RE_DE = {
  dehumanise: re(`${B}${G}${E}${FILL}\\s+${COP}\\s+${ADV}(?:ein\\s+|eine\\s+)?(?:${D})${E}`),
  compound: re(`${B}(?:${alt(L.COMPOUND_STEMS_DE)})(?:${alt(L.COMPOUND_TAILS_DE)})${E}` +
    `|${B}(?:linkes|rechtes|braunes|rotes|grünes|gruenes|linke|rechte)\\s+(?:Pack|Gesindel|Geschmeiß|Geschmeiss)${E}`),
  violenceCall: re(`${B}(?:man sollte|man müsste|man muesste|man muss|wir sollten|wir müssen|wir muessen|lasst uns)` +
    `\\s+(?:sie\\s+)?${DET}${G}${E}(?:\\s+[\\p{L}']+){0,2}?\\s+(?:${alt(L.KILL_INF_DE)})${E}`),
  violenceDeserve: re(`${B}${G}${E}${FILL}\\s+(?:gehören|gehoeren|sollten|sollen|müssten|muessten|müssen|muessen|` +
    `verdienen es,?)\\s+${ADV}(?:${alt(L.KILL_PP_DE)})${E}`),
  violenceSlogan: re(`${B}(?:Tod\\s+(?:den|allen)\\s+${G}|${G}\\s+verrecke|${alt(L.SLOGANS_DE)})${E}`),
  stereotype: re(`${B}${G}${E}${FILL}\\s+${COP}\\s+${ADV}(?:${alt(L.STEREOTYPE_TRAITS_DE)})${E}`),
  conspiracy: re(`${B}(?:${alt(L.CONSPIRACY_DE)})${E}`),
  slur: re(`${B}(?:${alt(L.SLURS_DE)})${E}`),
};

export const NEGATION_DE = RX.negation(["nicht", "nie", "niemals", "kein", "keine", "keinen", "keiner", "keines",
  "niemand"]);

const RULES = {
  dehumanise: [[RE_DE.dehumanise, true], [RE_DE.compound, false]],
  violence: [[RE_DE.violenceCall, true], [RE_DE.violenceDeserve, true], [RE_DE.violenceSlogan, false]],
  stereotype: [[RE_DE.stereotype, true]],
  conspiracy: [[RE_DE.conspiracy, false]],
  slur: [[RE_DE.slur, false]],
};

export function scoreDe(hit, have) {
  scoreRules(RULES, hit, have);
}
