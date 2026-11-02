// Italian grammar for the stance-neutral markers, built the way rhetoric-fr.js is. "Vanno
// fucilati" ("should be shot") is the common Italian form of a call, beside "bisogna" and
// "meritano di essere". These run only for families not yet found in the same text.

import * as L from "./lexicon-it.js";
import { RX, scoreRules } from "./rhetoric-util.js";

const { alt, B, E, FILL, re } = RX;
const G = alt(L.GROUPS_IT), D = alt(L.DEHUMANISE_IT);
const ART = "(?:i\\s+|gli\\s+|le\\s+|questi\\s+|queste\\s+|quei\\s+|quegli\\s+|quelle\\s+)?";
const ALL = "(?:tutti\\s+|tutte\\s+)?";
const COP = "(?:sono|restano|erano|saranno)";
const PART = "(?:dei\\s+|delle\\s+|degli\\s+|solo\\s+|soltanto\\s+|una\\s+|un\\s+)?";
const NOT_BEFORE = "(?<!(?:non|mai)\\s+)";

export const RE_IT = {
  dehumanise: re(`${B}(?:${G})${E}${FILL}\\s+${COP}\\s+${ALL}${PART}(?:${D})${E}`),
  // "non sono altro che vermi": the negation is part of the marker
  dehumaniseOnly: re(`${B}(?:${G})${E}${FILL}\\s+non\\s+sono\\s+(?:altro|nient'altro|niente altro)\\s+che\\s+${PART}(?:${D})${E}`),
  dehumaniseOf: re(`${B}(?:questi|queste|quei|quegli|quelle|quel|quella|questa)\\s+(?:${D})\\s+(?:di|dei|degli|delle)\\s+(?:${G})${E}`),
  violenceCall: re(`${NOT_BEFORE}${B}(?:bisogna|bisognerebbe|dobbiamo|dovremmo|andiamo a|si deve|si devono|è ora di|e ora di)` +
    `\\s+(?:${alt(L.KILL_INF_IT)})\\s+${ALL}${ART}(?:${G})${E}`),
  violenceDeserve: re(`${B}(?:${G})${E}${FILL}\\s+(?:vanno|andrebbero|devono essere|dovrebbero essere|meritano di essere|` +
    `meriterebbero di essere)\\s+${ALL}(?:${alt(L.KILL_PP_IT)})${E}`),
  violenceSlogan: re(`${B}(?:(?:morte|a morte)\\s+(?:ai|agli|alle|a|i|gli|le)\\s+(?:${G})|` +
    `uccidere\\s+(?:un|una)\\s+[\\p{L}]+\\s+non\\s+(?:è|e)\\s+reato|${alt(L.SLOGANS_IT)})${E}`),
  stereotype: re(`${B}(?:${G})${E}${FILL}\\s+${COP}\\s+${ALL}${PART}(?:${alt(L.STEREOTYPE_TRAITS_IT)})${E}`),
  conspiracy: re(`${B}(?:${alt(L.CONSPIRACY_IT)})${E}`),
  slur: re(`${B}(?:${alt(L.SLURS_IT)})${E}`),
};

export const NEGATION_IT = RX.negation(["non", "mai", "nessuno", "nessuna", "né"]);

const RULES = {
  dehumanise: [[RE_IT.dehumaniseOnly, false], [RE_IT.dehumanise, true], [RE_IT.dehumaniseOf, true]],
  violence: [[RE_IT.violenceCall, true], [RE_IT.violenceDeserve, true], [RE_IT.violenceSlogan, false]],
  stereotype: [[RE_IT.stereotype, true]],
  conspiracy: [[RE_IT.conspiracy, false]],
  slur: [[RE_IT.slur, false]],
};

export function scoreIt(hit, have) {
  scoreRules(RULES, hit, have);
}
