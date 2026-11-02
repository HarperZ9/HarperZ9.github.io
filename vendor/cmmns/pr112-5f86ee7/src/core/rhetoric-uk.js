// Ukrainian grammar for the stance-neutral markers, built the way rhetoric-ru.js is: no present-
// tense "are" ("ватники — тварини"), free word order, groups matched in any case form. Ukrainian
// writes the apostrophe inside words; replies type it as ' or ’, and rhetoric.js reads both as '.

import * as L from "./lexicon-uk.js";
import { RX, scoreRules } from "./rhetoric-util.js";

const { alt, B, E, re } = RX;
// Slur forms name a group too, so "всех хохлов надо ..." and "москалів треба ..." read as calls.
const G = `(?:${alt([...L.GROUPS_UK, ...L.SLURS_UK])})`;
const DASH = "\\s*(?:[—–-]|:)?\\s*(?:це\\s+)?";
const ADV = "(?:(?:всі|усі|просто|лише|тільки|суцільні|одні|справжні|брудні|смердючі|тупі|мерзенні|кляті)\\s+)*";
const NOT = "(?:не\\s+)?";
const ALL = "(?:(?:всіх|усіх|цих|їх)\\s+)*";
const CALL = "(?:треба|потрібно|необхідно|пора|час|слід|варто|мусимо|маємо|давайте|будемо|можна)";
const KILL = alt(L.KILL_INF_UK);

export const RE_UK = {
  dehumanise: re(`${B}${G}${E}(?:\\s+[\\p{L}'-]+){0,2}?${DASH}${ADV}${NOT}(?:${alt(L.DEHUMANISE_UK)})${E}`),
  notHuman: re(`${B}${G}${E}${DASH}(?:всі\\s+)?не\\s+(?:люди|людьми)${E}`),
  violenceCall: re(`${B}${NOT}${CALL}\\s+${ALL}(?:${KILL})\\s+${ALL}${G}${E}`),
  violenceObject: re(`${B}${ALL}${G}${E}\\s+${ALL}${NOT}${CALL}\\s+(?:всіх\\s+)?(?:${KILL})${E}`),
  violenceImperative: re(`${B}${NOT}(?:${alt(L.KILL_IMP_UK)})\\s+${ALL}${G}${E}`),
  violenceDeserve: re(`${B}${G}${E}\\s+(?:всі\\s+)?${NOT}(?:мають|повинні|заслуговують на|заслуговують|мусять)\\s+(?:бути\\s+)?(?:${alt(L.KILL_PP_UK)})${E}`),
  deathTo: re(`(?:^|[.!?;:\\n(]\\s*|\\s[—–-]\\s)смерть\\s+[\\p{L}]+(?:ам|ям|им)${E}`),
  lynch: re(`${B}(?:${G}${E}\\s+на\\s+(?:гілляку|гиляку|ножі|кіл|ліхтарі|шибеницю)|${alt(L.SLOGANS_UK)})${E}`),
  stereotype: re(`${B}(?:всі\\s+|усі\\s+)?${G}${E}${DASH}${ADV}${NOT}(?:${alt(L.STEREOTYPE_TRAITS_UK)})${E}`),
  conspiracy: re(`${B}(?:${alt(L.CONSPIRACY_UK)})${E}`),
  paid: re(`${B}(?:проплачен(?:і|о|а|ий)?|оплачен(?:і|о)|на зарплаті у|агенти|методички|на гроші)\\s+(?:${alt(L.PAYMASTERS_UK)})${E}`),
  slur: re(`${B}(?:${alt(L.SLURS_UK)})${E}`),
};

export const NEGATION_UK = RX.negation(["не", "ні", "ніколи", "ніхто", "жодні", "жоден", "немає"]);

const RULES = {
  dehumanise: [[RE_UK.notHuman, false], [RE_UK.dehumanise, true]],
  violence: [[RE_UK.violenceCall, true], [RE_UK.violenceObject, true], [RE_UK.violenceImperative, true],
    [RE_UK.violenceDeserve, true], [RE_UK.deathTo, false], [RE_UK.lynch, false]],
  stereotype: [[RE_UK.stereotype, true]],
  conspiracy: [[RE_UK.conspiracy, false], [RE_UK.paid, false]],
  slur: [[RE_UK.slur, false]],
};

export function scoreUk(hit, have) {
  scoreRules(RULES, hit, have);
}
