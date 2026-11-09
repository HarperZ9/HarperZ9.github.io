// French grammar for the stance-neutral markers. Boundaries are Unicode letter lookarounds
// (rhetoric-util.js), since JavaScript's \b treats accented letters as non-word characters.
// These run only for families the English grammar did not already find in the same text.

import * as F from "./lexicon-fr.js";
import { RX, scoreRules } from "./rhetoric-util.js";

const { alt, B, E, FILL, re } = RX;
const G = alt(F.GROUPS_FR), D = alt(F.DEHUMANISE_FR);
const ART = "(?:les\\s+|ces\\s+|tous\\s+ces\\s+|des\\s+)?";

export const RE_FR = {
  dehumanise: re(`${B}(?:${G})${E}${FILL}\\s+(?:sont|c'est|ce sont|restent)\\s+(?:tous\\s+|toutes\\s+|que\\s+)?` +
    `(?:des\\s+|de la\\s+|de l'|du\\s+|une\\s+|un\\s+|d'|de\\s+)?(?:vraies?\\s+|vrais\\s+|sales\\s+)?(?:${D})${E}`),
  dehumaniseOf: re(`${B}(?:ces|cette|ce|cet)\\s+(?:${D})\\s+(?:de\\s+|d')(?:${G})${E}`),
  violenceCall: re(`${B}(?:il faut|faut|il faudrait|faudrait|il faudra|on doit|on devrait|on va|allons)\\s+` +
    `(?:tous\\s+|toutes\\s+)?(?:${alt(F.KILL_INF_FR)})\\s+(?:tous\\s+|toutes\\s+)?${ART}(?:${G})${E}`),
  violenceDeserve: re(`${B}(?:${G})${E}(?:\\s+[\\p{L}']+){0,4}?\\s+(?:doivent|devraient|méritent|meritent|mériteraient)` +
    `\\s+(?:tous\\s+|toutes\\s+)?(?:d'être|d'etre|être|etre)\\s+(?:${alt(F.KILL_PP_FR)})${E}`),
  violenceSlogan: re(`${B}(?:(?:mort aux|à mort les|a mort les)\\s+(?:${G})|${alt(F.SLOGANS_FR)})${E}`),
  stereotype: re(`${B}(?:${G})${E}\\s+(?:sont|restent)\\s+(?:tous\\s+|toutes\\s+|juste\\s+|que\\s+|rien que\\s+)?` +
    `(?:des\\s+|de\\s+)?(?:${alt(F.STEREOTYPE_TRAITS_FR)})${E}`),
  conspiracy: re(`${B}(?:${alt(F.CONSPIRACY_FR)})${E}`),
};

// "ne sont pas des animaux", "jamais": the opposite of the marker.
export const NEGATION_FR = RX.negation(["ne", "n'", "pas", "jamais", "aucun", "aucune"]);

const RULES = {
  dehumanise: [[RE_FR.dehumanise, true], [RE_FR.dehumaniseOf, true]],
  violence: [[RE_FR.violenceCall, true], [RE_FR.violenceDeserve, true], [RE_FR.violenceSlogan, false]],
  stereotype: [[RE_FR.stereotype, true]],
  conspiracy: [[RE_FR.conspiracy, false]],
};

// Adds French markers through `hit(family, regex, negatable)` for families not yet in `have`.
export function scoreFr(hit, have) {
  scoreRules(RULES, hit, have);
}
