// Spanish grammar for the stance-neutral markers, built the way rhetoric-fr.js is. These run only
// for families the English grammar and earlier languages did not already find in the same text.

import * as S from "./lexicon-es.js";
import { RX, scoreRules } from "./rhetoric-util.js";

const { alt, B, E, FILL, re } = RX;
const G = alt(S.GROUPS_ES), D = alt(S.DEHUMANISE_ES);
const DET = "(?:los\\s+|las\\s+|esos\\s+|esas\\s+|estos\\s+|estas\\s+|unos\\s+|unas\\s+)?";
const ALL = "(?:todos\\s+|todas\\s+)?";
const COP = "(?:son|siguen siendo|eran|serán|seran)";
// "no hay que matar": a negation just before the call word
const NOT_BEFORE = "(?<!(?:no|nunca|jamás|jamas)\\s+)";

export const RE_ES = {
  dehumanise: re(`${B}(?:${G})${E}${FILL}\\s+${COP}\\s+${ALL}(?:unos\\s+|unas\\s+|una\\s+|un\\s+|solo\\s+|sólo\\s+)?` +
    `(?:${D})${E}`),
  // "no son más que parásitos": the negation is part of the marker
  dehumaniseOnly: re(`${B}(?:${G})${E}${FILL}\\s+no\\s+son\\s+(?:más|mas|nada más|nada mas)\\s+que\\s+(?:unos\\s+|unas\\s+)?` +
    `(?:${D})${E}`),
  dehumaniseOf: re(`${B}(?:esa|esas|ese|esos|esta|estas|este|estos)\\s+(?:${D})\\s+de\\s+(?:${G})${E}`),
  violenceCall: re(`${NOT_BEFORE}${B}(?:hay que|habría que|habria que|tenemos que|deberíamos|deberiamos|vamos a|hay q)\\s+` +
    `(?:${alt(S.KILL_INF_ES)})\\s+(?:a\\s+)?${ALL}${DET}(?:${G})${E}`),
  violenceDeserve: re(`${B}(?:${G})${E}${FILL}\\s+(?:merecen|deberían|deberian|deben|tienen que|tendrían que)\\s+${ALL}` +
    `ser\\s+${ALL}(?:${alt(S.KILL_PP_ES)})${E}`),
  violenceSlogan: re(`${B}(?:muerte a\\s+${DET}(?:${G})|(?:${G})\\s+al\\s+paredón|(?:${G})\\s+al\\s+paredon|` +
    `${alt(S.SLOGANS_ES)})${E}`),
  stereotype: re(`${B}(?:${G})${E}${FILL}\\s+${COP}\\s+${ALL}(?:unos\\s+|unas\\s+|solo\\s+|sólo\\s+)?` +
    `(?:${alt(S.STEREOTYPE_TRAITS_ES)})${E}`),
  conspiracy: re(`${B}(?:${alt(S.CONSPIRACY_ES)})${E}`),
  slur: re(`${B}(?:${alt(S.SLURS_ES)})${E}`),
};

export const NEGATION_ES = RX.negation(["no", "nunca", "jamás", "jamas", "nadie", "ningún", "ningun", "ninguna", "ni"]);

const RULES = {
  dehumanise: [[RE_ES.dehumaniseOnly, false], [RE_ES.dehumanise, true], [RE_ES.dehumaniseOf, true]],
  violence: [[RE_ES.violenceCall, true], [RE_ES.violenceDeserve, true], [RE_ES.violenceSlogan, false]],
  stereotype: [[RE_ES.stereotype, true]],
  conspiracy: [[RE_ES.conspiracy, false]],
  slur: [[RE_ES.slur, false]],
};

export function scoreEs(hit, have) {
  scoreRules(RULES, hit, have);
}
