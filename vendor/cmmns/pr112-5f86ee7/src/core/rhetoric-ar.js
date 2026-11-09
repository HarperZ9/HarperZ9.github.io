// Arabic grammar for the stance-neutral markers. Arabic needs no "are" ("اليهود خنازير",
// "الروافض كلاب"), and attaches "and", "the" and "for" to the word ("وللروافض"), so every group may
// carry those prefixes. Text and lists are read with one alef, ي for ى, and no vowel marks or
// tatweel (prepAr); the matched text is that normalised form.

import * as L from "./lexicon-ar.js";
import { RX, scoreRules } from "./rhetoric-util.js";

const { alt, B, E, re } = RX;
// Same length for the alef and ya swaps; marks and tatweel are removed.
export const prepAr = (s) => s.replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627").replace(/\u0649/g, "\u064A");
const A = (list) => alt(list.map(prepAr));
const PRE = "(?:و|ف)?(?:ال|لل|بال|كال|ل|ب)?";
const G = `${PRE}(?:${A(L.GROUPS_AR)})`;
const NEG = "(?:(?:ليسوا|ليسو|ليس|ليست|مش|مو|مب|ما\\s+هم|ماهم|غير)\\s+)?";
const ALL = "(?:(?:كل|جميع|كافة|هؤلاء|هذول|هذولا)\\s+)?";
const HUM = "(?:(?:كلهم|هم|هما|زيك|زيكم|دول|دي|ده|دا|هادول|مجرد|عبارة\\s+عن|ليسوا\\s+الا|ما\\s+هم\\s+الا|ماهم\\s+الا|الا)\\s+)*";

export const RE_AR = {
  dehumanise: re(`${B}${ALL}${G}${E}\\s+${HUM}${NEG}${HUM}(?:ال)?(?:${A(L.DEHUMANISE_AR)})${E}`),
  // construct state: "كلاب الشيعة", "خنازير الصهاينة"
  dehumaniseOf: re(`${B}(?:و)?(?:${A(L.DEHUMANISE_AR)})\\s+(?:ال|لل)(?:${A(L.GROUPS_AR)})${E}`),
  phrase: re(`${B}(?:${A(L.DEHUMANISE_PHRASES_AR)})${E}`),
  violenceImperative: re(`${B}(?:لا\\s+)?(?:${A(L.KILL_IMP_AR)})\\s+${ALL}${G}${E}`),
  violenceCall: re(`${B}(?:لا\\s+)?(?:يجب|لازم|لابد\\s+من|لا\\s+بد\\s+من|وجب|ينبغي|نريد|خلينا|يلا|الحل)\\s+(?:ان\\s+)?(?:${A(L.KILL_NOUN_AR)})\\s+${ALL}${G}${E}`),
  violenceDeserve: re(`${B}${ALL}${G}${E}\\s+(?:كلهم\\s+)?(?:لا\\s+)?(?:يستحقون|يستاهلون|يستاهلوا|يستحقوا|لازم|يجب|وجب)\\s+(?:ان\\s+)?(?:${A(L.DEATH_AR)})${E}`),
  curse: re(`${B}(?:اللهم|يا\\s+رب|يارب)\\s+(?:${A(L.CURSE_AR)})\\s*(?:${G})${E}`),
  // "الموت لـ ..." at the start of a clause: any word, so every target alike
  deathTo: re(`(?:^|[.!?؟;:،\\n(]\\s*)الموت\\s+(?:لل|ل)[\\p{L}]+`),
  stereotype: re(`${B}${ALL}${G}${E}\\s+${HUM}${NEG}${HUM}(?:${A(L.STEREOTYPE_TRAITS_AR)})${E}`),
  conspiracy: re(`${B}(?:${A(L.CONSPIRACY_AR)})${E}`),
  paid: re(`${B}(?:ممولين|ممولون|ممول|مدعومين|عملاء|عميل|ذيول|أذناب|مرتزقة)\\s+(?:من\\s+|ل)?(?:${A(L.PAYMASTERS_AR)})${E}`),
  slur: re(`${B}${PRE}(?:${A(L.SLURS_AR)})${E}`),
};

// "لا" counts only before a verb ("لا بد", "must", is not a negation), and "ليسوا الا" and "ما هم
// الا" ("nothing but") are the marker, not its negation.
export const NEGATION_AR = new RegExp("(?<![\\p{L}\\p{M}])(?:(?:ليسوا|ليسو|ليس|ليست|ماهم)(?!\\s+الا)|ما(?=\\s+هم(?!\\s+الا))" +
  "|لسنا|لم|لن|مش|مو|مب|غير|ابدا|لا(?=\\s+[تينا]))(?![\\p{L}\\p{M}])", "iu");

const RULES = {
  dehumanise: [[RE_AR.dehumanise, true], [RE_AR.dehumaniseOf, false], [RE_AR.phrase, false]],
  violence: [[RE_AR.violenceImperative, true], [RE_AR.violenceCall, true], [RE_AR.violenceDeserve, true],
    [RE_AR.curse, false], [RE_AR.deathTo, false]],
  stereotype: [[RE_AR.stereotype, true]],
  conspiracy: [[RE_AR.conspiracy, false], [RE_AR.paid, false]],
  slur: [[RE_AR.slur, false]],
};

export function scoreAr(hit, have) {
  scoreRules(RULES, hit, have);
}
