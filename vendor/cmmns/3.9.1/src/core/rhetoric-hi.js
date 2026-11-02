// Hindi grammar for the stance-neutral markers, written once and built twice: for Devanagari and
// for the Latin spelling of Hindi. Hindi puts the verb last ("मुसलमान कीड़े हैं", "संघियों को गोली
// मार दो") and its negation before the verb, so the tail takes an optional "नहीं" / "मत" into the
// match. A noun phrase alone ("मुसलमान आतंकवादी गिरफ्तार", a Muslim terrorist arrested) is not a
// claim about a group: a quantifier ("सब", "सारे") or a closing "हैं" is required.

import * as L from "./lexicon-hi.js";
import { RX, scoreRules } from "./rhetoric-util.js";

const { alt, B, E, re } = RX;
// NFC, so a nukta letter typed as one code point or two matches the lists.
export const prepHi = (s) => s.normalize("NFC");
const N = (list) => alt(list.map((w) => w.normalize("NFC")));

function grammar(w) {
  const G = `(?:${N(w.groups)})(?:\\s+(?:${w.like}))?`, S = "\\s+";
  const PRE = `(?:(?:${w.these})${S})?`;
  const Q = `(?:${w.quant})`, NEG = `(?:${S}(?:${w.not}))?`, COP = `(?:${S}(?:${w.cop}))`;
  // "<group> सब <noun> (नहीं) (हैं)" or "<group> <noun> (नहीं) हैं"
  const claim = (nouns) => `${B}${PRE}${G}${E}${S}(?:${Q}${S}(?:${nouns})${E}${NEG}${COP}?|(?:${nouns})${E}${NEG}${COP})${E}`;
  return {
    dehumanise: re(claim(N(w.dehumanise))),
    violence: re(`${B}${PRE}${G}${E}${S}(?:${w.obj})${S}(?:(?:${w.not})${S})?(?:${N(w.kill)})${E}`),
    stereotype: re(claim(N(w.traits))),
    gendered: re(`${B}${G}${S}(?:${N(L.GENDERED_HI)})${E}`),
  };
}

const DEVA = grammar({ groups: L.GROUPS_HI, dehumanise: L.DEHUMANISE_HI, kill: L.KILL_HI, traits: L.STEREOTYPE_TRAITS_HI,
  these: "ये|इन|सारे|सभी|सब|उन", quant: "सब|सारे|सभी|तो|बस|सिर्फ|निरे|सब के सब", not: "नहीं|ना|न|मत|कभी नहीं",
  cop: "हैं|है|हो|होते हैं|होते है|ही हैं", obj: "को", like: "जैसे लोग|जैसी लोग|लोग" });
const LATN = grammar({ groups: L.GROUPS_HI_LATN, dehumanise: L.DEHUMANISE_HI_LATN, kill: L.KILL_HI_LATN,
  traits: L.STEREOTYPE_TRAITS_HI_LATN, these: "ye|yeh|in|saare|sare|sabhi|sab|un", quant: "sab|saare|sare|sabhi|bas|sirf",
  not: "nahi|nahin|nhi|na|mat|kabhi nahi", cop: "hai|hain|hote hain|hote hai|ho|hi hain", obj: "ko",
  like: "jaise log|jaisi log|log" });

export const RE_HI = {
  deva: DEVA, latn: LATN,
  slogan: re(`${B}(?:गोली मारो सालों को|goli maaro saalon ko|goli maro saalo ko)${E}`),
  conspiracy: re(`${B}(?:${N(L.CONSPIRACY_HI)})${E}`),
  paid: re(`${B}(?:${N(L.PAYMASTERS_HI)})\\s+(?:के|से|ke|se)\\s+(?:पैसे|पैसों|फंडिंग|टुकड़ों|paise|paison|funding|tukdon)\\s+(?:पर|से|पे|par|pe|se)${E}`),
  slur: re(`${B}(?:${N(L.SLURS_HI)})${E}`),
};

export const NEGATION_HI = RX.negation(["नहीं", "ना", "न", "मत", "nahi", "nahin", "nhi", "mat"]);

const RULES = {
  dehumanise: [[DEVA.dehumanise, true], [LATN.dehumanise, true]],
  violence: [[DEVA.violence, true], [LATN.violence, true], [RE_HI.slogan, false]],
  stereotype: [[DEVA.stereotype, true], [LATN.stereotype, true]],
  conspiracy: [[RE_HI.conspiracy, false], [RE_HI.paid, false]],
  slur: [[RE_HI.slur, false], [DEVA.gendered, false], [LATN.gendered, false]],
};

export function scoreHi(hit, have) {
  scoreRules(RULES, hit, have);
}
