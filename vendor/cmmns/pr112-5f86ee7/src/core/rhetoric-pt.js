// Portuguese grammar for the stance-neutral markers, built the way rhetoric-fr.js is. Brazilian
// speech often uses "é tudo" for "are all" ("esses X é tudo verme"), so it counts as a copula.
// These run only for families the English grammar and earlier languages did not already find.

import * as L from "./lexicon-pt.js";
import { RX, scoreRules } from "./rhetoric-util.js";

const { alt, B, E, FILL, re } = RX;
const G = alt(L.GROUPS_PT), D = alt(L.DEHUMANISE_PT);
const DET = "(?:os\\s+|as\\s+|a\\s+|esses\\s+|essas\\s+|estes\\s+|estas\\s+|esse\\s+|essa\\s+)?";
const ALL = "(?:todos\\s+|todas\\s+)?";
const COP = "(?:são|sao|é tudo|e tudo|eram|serão|serao)";
const NOT_BEFORE = "(?<!(?:não|nao|nunca|jamais)\\s+)";

export const RE_PT = {
  dehumanise: re(`${B}(?:${G})${E}${FILL}\\s+${COP}\\s+${ALL}(?:uns\\s+|umas\\s+|uma\\s+|um\\s+|só\\s+|so\\s+)?(?:${D})${E}`),
  // "não passam de parasitas": the negation is part of the marker
  dehumaniseOnly: re(`${B}(?:${G})${E}${FILL}\\s+(?:não|nao)\\s+passam\\s+de\\s+(?:uns\\s+|umas\\s+|uma\\s+)?(?:${D})${E}`),
  dehumaniseOf: re(`${B}(?:esses|essas|estes|estas|esse|essa)\\s+(?:${D})\\s+(?:de|da|do|dos|das)\\s+(?:${G})${E}`),
  violenceCall: re(`${NOT_BEFORE}${B}(?:tem que|têm que|temos que|tem de|temos de|vamos|precisamos|é preciso|e preciso|` +
    `bora|devemos|deveríamos|deveriamos)\\s+(?:${alt(L.KILL_INF_PT)})\\s+${ALL}${DET}(?:${G})${E}`),
  violenceDeserve: re(`${B}(?:${G})${E}${FILL}\\s+(?:merecem|deveriam|devem|têm que|tem que|precisam)\\s+${ALL}` +
    `ser\\s+${ALL}(?:${alt(L.KILL_PP_PT)})${E}`),
  violenceSlogan: re(`${B}(?:morte\\s+(?:aos|às|as|a)\\s+(?:${G})|${alt(L.SLOGANS_PT)})${E}`),
  stereotype: re(`${B}(?:${G})${E}${FILL}\\s+${COP}\\s+${ALL}(?:uns\\s+|umas\\s+|só\\s+|so\\s+)?` +
    `(?:${alt(L.STEREOTYPE_TRAITS_PT)})${E}`),
  conspiracy: re(`${B}(?:${alt(L.CONSPIRACY_PT)})${E}`),
  slur: re(`${B}(?:${alt(L.SLURS_PT)})${E}`),
};

export const NEGATION_PT = RX.negation(["não", "nao", "nunca", "jamais", "ninguém", "ninguem", "nenhum", "nenhuma", "nem"]);

const RULES = {
  dehumanise: [[RE_PT.dehumaniseOnly, false], [RE_PT.dehumanise, true], [RE_PT.dehumaniseOf, true]],
  violence: [[RE_PT.violenceCall, true], [RE_PT.violenceDeserve, true], [RE_PT.violenceSlogan, false]],
  stereotype: [[RE_PT.stereotype, true]],
  conspiracy: [[RE_PT.conspiracy, false]],
  slur: [[RE_PT.slur, false]],
};

export function scorePt(hit, have) {
  scoreRules(RULES, hit, have);
}
