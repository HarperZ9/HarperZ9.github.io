// Chinese grammar for the stance-neutral markers. Chinese has no spaces, so the patterns join words
// directly: "<group>都是蟑螂", "杀光<group>", "把<group>都杀了", "<group>都该死". A negation written in
// front ("不应该杀光...") is taken into the match, so the negation test sees it. Traditional text
// is mapped to simplified first (prepZh); the mapping keeps every index.

import * as L from "./lexicon-zh.js";
import { RX, scoreRules } from "./rhetoric-util.js";

const { alt, re } = RX;
const MAP = new Map();
for (let i = 0; i + 1 < L.TRAD_ZH.length; i += 2) MAP.set(L.TRAD_ZH[i], L.TRAD_ZH[i + 1]);
export const prepZh = (s) => s.replace(/[㐀-鿿]/g, (c) => MAP.get(c) || c);

const G = `(?:${alt(L.GROUPS_ZH)})`;
// Animal and filth words that also start everyday compounds (猪肉 pork, 狗粮 dog food, 垃圾分类 sorting).
const D = `(?:${alt(L.DEHUMANISE_ZH)}|猪(?!肉|蹄|排|脚|油|皮|圈|场|饲料|队友|头)|狗(?!粮|仔|窝|绳|链|狗|血|屎运)|` +
  "垃圾(?!分类|桶|袋|站|车|场|处理|食品|短信|邮件|话|堆|食物|回收))";
const QUANT = "(?:这些|那些|这群|那群|这帮|那帮|所有的?|一切)?";
const NOTP = "(?:不|并不|绝不|并非|也不|都不)?";
const COP = "(?:都|全|全都|也|就|真|真的|简直|根本|全部|个个|基本|统统)?(?:是|就是|都是|全是|简直是|=)?";
const ONE = "(?:一群|一帮|一堆|一窝|一伙|一些)?(?:的)?";
const NEG = "(?:不应该|不可以|不要|不能|不该|不会|反对|不|别|没|勿|莫)?";
const MODAL = "(?:应该|必须|就该|该|要|得|一定要|统统|全部|都)?";
const ANY = "(?:所有的?|全部的?|这些|那些|一切)?";
const TRAIT = `(?:${alt(L.STEREOTYPE_TRAITS_ZH)}|懒(?!得|散|觉)|脏(?!话|活|水|辫|器|腑)|蠢|笨(?!重|拙))`;

export const RE_ZH = {
  dehumanise: re(`${QUANT}${G}${NOTP}${COP}${ONE}${D}`),
  notHuman: re(`${G}(?:都|全|根本|简直)?(?:不是人|不算人|不配做人|不配当人|没有人性)`),
  violenceVerb: re(`${NEG}${MODAL}(?:${alt(L.KILL_ZH)})${ANY}${G}`),
  violenceBa: re(`${NEG}${MODAL}把${ANY}${G}(?:都|全|全部|统统)?(?:${alt(L.KILL_ZH)})`),
  violenceDie: re(`${G}(?:都|全|全都|统统)?(?:${alt(L.DIE_ZH)})`),
  stereotype: re(`(?:所有的?)?${G}${NOTP}(?:都|全|全都|就|个个|基本上|基本|大多)?(?:是|都是|就是)?(?:一群|一帮)?${TRAIT}` +
    `|${G}(?:的)?素质(?:真|太|就是|都|很|极|普遍)?(?:低|差)`),
  conspiracy: re(`${alt(L.CONSPIRACY_ZH)}`),
  paid: re(`(?:拿|收|领|吃)了?(?:${alt(L.PAYMASTERS_ZH)})的?(?:钱|经费|美元|美金|人民币|五毛|津贴|补贴)`),
  slur: re(`${alt(L.SLURS_ZH)}`),
};

// "没素质" (no manners) is a trait, not a negation.
export const NEGATION_ZH = /(?:不|没(?!素质|有人性)|别|勿|莫|并非|反对|未)/u;

const RULES = {
  dehumanise: [[RE_ZH.notHuman, false], [RE_ZH.dehumanise, true]],
  violence: [[RE_ZH.violenceVerb, true], [RE_ZH.violenceBa, true], [RE_ZH.violenceDie, false]],
  stereotype: [[RE_ZH.stereotype, true]],
  conspiracy: [[RE_ZH.conspiracy, false], [RE_ZH.paid, false]],
  slur: [[RE_ZH.slur, false]],
};

export function scoreZh(hit, have) {
  scoreRules(RULES, hit, have);
}
