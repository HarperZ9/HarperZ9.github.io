// Russian grammar for the stance-neutral markers, built the way rhetoric-fr.js is. Russian has no
// present-tense "are" ("либералы — крысы", "мигранты это паразиты") and free word order ("надо
// расстрелять всех X", "всех X надо расстрелять"), so both orders are written out. Groups match in
// any case form. These run only for families not yet found.

import * as L from "./lexicon-ru.js";
import { RX, scoreRules } from "./rhetoric-util.js";

const { alt, B, E, re } = RX;
// Slur forms name a group too, so "всех хохлов надо ..." and "москалів треба ..." read as calls.
const G = `(?:${alt([...L.GROUPS_RU, ...L.SLURS_RU])})`;
const DASH = "\\s*(?:[—–-]|:)?\\s*(?:это\\s+)?";
const ADV = "(?:(?:все|просто|лишь|всего лишь|сплошь|одни|настоящие|грязные|вонючие|тупые|мерзкие|поганые|самые)\\s+)*";
const NOT = "(?:не\\s+)?";
const ALL = "(?:(?:всех|этих|их|всю|эту)\\s+)*";
const CALL = "(?:надо|нужно|необходимо|пора|следует|должны|давайте|будем|можно|стоит)";
const KILL = alt(L.KILL_INF_RU);

export const RE_RU = {
  dehumanise: re(`${B}${G}${E}(?:\\s+[\\p{L}-]+){0,2}?${DASH}${ADV}${NOT}(?:${alt(L.DEHUMANISE_RU)})${E}`),
  // "либералы не люди", "хохлы — не люди": denying a group is human, matched before negation.
  notHuman: re(`${B}${G}${E}${DASH}(?:все\\s+)?не\\s+(?:люди|человеки)${E}`),
  violenceCall: re(`${B}${NOT}${CALL}\\s+${ALL}(?:${KILL})\\s+${ALL}${G}${E}`),
  violenceObject: re(`${B}${ALL}${G}${E}\\s+${ALL}${NOT}${CALL}\\s+(?:всех\\s+)?(?:${KILL})${E}`),
  violenceImperative: re(`${B}${NOT}(?:${alt(L.KILL_IMP_RU)})\\s+${ALL}${G}${E}`),
  violenceDeserve: re(`${B}${G}${E}\\s+(?:все\\s+)?${NOT}(?:должны|заслуживают|достойны|обязаны)\\s+(?:быть\\s+)?(?:${alt(L.KILL_PP_RU)})${E}`),
  // "смерть врагам" at the start of a clause: any plural dative, so every target alike
  deathTo: re(`(?:^|[.!?;:\\n(]\\s*|\\s[—–-]\\s)смерть\\s+[\\p{L}]+(?:ам|ям|им|ым)${E}`),
  onlyGoodDead: re(`${B}хорош(?:ий|ая|ее)\\s+([\\p{L}]+)\\s*[—–-]?\\s*(?:это\\s+)?мертв(?:ый|ая|ое)\\s+\\1${E}`),
  lynch: re(`${B}${G}${E}\\s+на\\s+(?:гиляку|гилляку|ножи|кол|фонари|виселицу)${E}`),
  stereotype: re(`${B}(?:все\\s+)?${G}${E}${DASH}${ADV}${NOT}(?:${alt(L.STEREOTYPE_TRAITS_RU)})${E}`),
  conspiracy: re(`${B}(?:${alt(L.CONSPIRACY_RU)})${E}`),
  paid: re(`${B}(?:(?:про)?плачен(?:ы|о|а|ные|ный)?|проплаченные|на зарплате у|агенты|методички|на деньги)\\s+(?:${alt(L.PAYMASTERS_RU)})${E}`),
  slur: re(`${B}(?:${alt(L.SLURS_RU)})${E}`),
};

export const NEGATION_RU = RX.negation(["не", "ни", "нет", "никогда", "никто", "нельзя"]);

const RULES = {
  dehumanise: [[RE_RU.notHuman, false], [RE_RU.dehumanise, true]],
  violence: [[RE_RU.violenceCall, true], [RE_RU.violenceObject, true], [RE_RU.violenceImperative, true],
    [RE_RU.violenceDeserve, true], [RE_RU.deathTo, false], [RE_RU.onlyGoodDead, false], [RE_RU.lynch, false]],
  stereotype: [[RE_RU.stereotype, true]],
  conspiracy: [[RE_RU.conspiracy, false], [RE_RU.paid, false]],
  slur: [[RE_RU.slur, false]],
};

// ё is written е in the lists; the swap keeps every index in place.
export const prepRu = (s) => s.replace(/ё/g, "е").replace(/Ё/g, "Е");

export function scoreRu(hit, have) {
  scoreRules(RULES, hit, have);
}
