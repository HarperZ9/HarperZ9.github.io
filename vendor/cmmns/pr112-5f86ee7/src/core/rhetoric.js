// Stance-neutral rhetoric markers. The word lists live in lexicon.js; this file holds the grammar.
//   dehumanise   a group described as vermin, disease, animals, filth
//   violence     a call for violence or collective punishment against a group
//   vigilante    a call for people outside the law, or soldiers, to act against people
//   slur         a slur or coded hate term (strong), or a context-dependent one (slurSoft)
//   stereotype   "<group> are <trait>": a whole group named by a trait
//   motive       "<group> want to destroy / replace ...": an aim put in a whole group's mouth
//   essentialise blanket and replacement claims ("all X are", "violence is cultural")
//   conspiracy   conspiracy framing; absolutist  us-versus-them framing
//   contempt     declared hatred of a whole group ("I hate X", "fuck all the X"), weight 1
// Disagreement, anger and strong opinions score 0; only the marker grammar counts. Scores feed
// the thread report, and the strong families also label the comment (never the person).

import * as L from "./lexicon.js";
import { scoreFr, NEGATION_FR } from "./rhetoric-fr.js";
import { scoreEs, NEGATION_ES } from "./rhetoric-es.js";
import { scoreDe, NEGATION_DE } from "./rhetoric-de.js";
import { scorePt, NEGATION_PT } from "./rhetoric-pt.js";
import { scoreIt, NEGATION_IT } from "./rhetoric-it.js";
import { scoreAr, NEGATION_AR, prepAr } from "./rhetoric-ar.js";
import { scoreRu, NEGATION_RU, prepRu } from "./rhetoric-ru.js";
import { scoreUk, NEGATION_UK } from "./rhetoric-uk.js";
import { scoreZh, NEGATION_ZH, prepZh } from "./rhetoric-zh.js";
import { scoreHi, NEGATION_HI, prepHi } from "./rhetoric-hi.js";
import { derivedLanguages } from "./rhetoric-derived.js";
import { mentionedIntl } from "./rhetoric-mention.js";
import { foldConfusables } from "./confusables.js";
import { theoryMatches } from "./theories.js";
import { GROUP_STEREOTYPE } from "./rhetoric-groups.js";

export const GROUPS = L.GROUPS;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alt = (list) => list.map(esc).sort((a, b) => b.length - a.length).join("|");
const word = (list) => new RegExp(`\\b(?:${alt(list)})\\b`, "i");
// Slurs may start or end with symbols ("(((", "14/88"), so their edges are any non-word character.
const edged = (list) => new RegExp(`(?:^|[^\\w])(?:${alt(list)})(?:$|[^\\w])`, "i");
const G = alt(L.GROUPS);
const CALL = "should|must|need to|needs to|have to|has to|let's|lets|let us|time to|gotta|got to|ought to|we will|we'll" +
  "|we'd|we would|i'd|i would";
const DET = "(?:the\\s+|these\\s+|those\\s+|our\\s+|their\\s+|your\\s+)?";
const FILLERS = "(?:(?:all|just|nothing but|such|literally|basically|like|no better than|worse than|a bunch of|a pack of|" +
  "a|an|the|fucking|filthy|dirty|disgusting|vile|rabid|stinking|dumb|savage)\\s+){0,4}";
// For the unambiguous nouns only: up to four words after "are" with no preposition among them
// ("X are horny useless rats", not "farmers are losing money to rats"), or a coordinated group
// ("nationalists and fascist scum").
const ADJ = alt(L.DEHUMANISE_ADJACENT);
const WINDOW = "(?:(?!(?:to|from|by|with|of|for|about|on|in|at|than|over|against|and|or|not|never)\\b)[\\w']+,?\\s+){0,4}?";
const LINK = "(?:(?:and|or|&)\\s+[\\w-]+\\s+|(?:fucking|filthy|dirty|disgusting|vile|stinking|rabid|ghetto|lazy|worthless|useless|" +
  "economic|socioeconomic)\\s+)?";
// Up to two helper words before a simile verb: "are just breeding", "keep spreading".
const AUX = "(?:(?:are|is|were|keep|just|all)\\s+){0,2}";
const NOTICE = "(?:stop|quit|keep|kept|start|started|starting|are|were|is|been|caught|always)\\s+notic(?:e|es|ed|ing)\\b";
const INTENSE =`(?:(?:${alt(L.INTENSIFIERS)})\\s+)?`;

const RE = {
  // "X are (nothing but) (filthy) rats", "commie filth", "an infestation of X". A marker word a few
  // words away from a group ("women with cancer", "police dogs") is not enough.
  dehumanise: new RegExp(`\\b(?:${G})(?:\\s+(?:are|is|r)|\\s*[-:=])\\s+${FILLERS}(?:${alt(L.DEHUMANISE)})\\b` +
    `|\\b(?:${G})\\s+(?:are|is|r)\\s+${WINDOW}(?:${ADJ})\\b` +
    `|\\b(?:${G})\\s+${LINK}(?:${ADJ})\\b` +
    `|\\b(?:${ADJ})\\s+like\\s+(?:these\\s+|those\\s+|the\\s+|all\\s+)?(?:${G})\\b` +
    `|\\b(?:${alt(L.SWARM)})\\s+of\\s+(?:the\\s+)?(?:${G})\\b`, "i"),
  // "they are infecting every country like parasites", "X are spreading like a plague". Scored with
  // the stricter guard in scoreEnglish: someone else's words ("posts saying ...") are skipped.
  simile: new RegExp(`\\b(?:(?:${G}|${alt(L.SIMILE_SUBJECTS)})(?:'re)?\\s+${AUX}(?:${alt(L.SIMILE_VERBS)})|they(?:'re)?\\s+${AUX}(?:${alt(L.SIMILE_THEY_VERBS)}))\\b` +
    `(?:\\s+[\\w']+){0,4}?\\s+like\\s+(?:${alt(L.SIMILE_NOUNS)})\\b`, "i"),
  violenceGroup: new RegExp(`\\b(?:${G})\\b(?:\\W+\\w+){0,6}?\\W+(?:should|must|need to|needs to|deserve to|ought to|will)\\s+(?:all\\s+)?(?:be\\s+)?(?:${alt(L.VIOLENCE_VERBS)})\\b`, "i"),
  violenceSlogan: word(L.VIOLENT_SLOGANS),
  // "X deserve to die", "X should all die"
  deathWish: new RegExp(`\\b(?:${G})\\s+(?:all\\s+)?(?:deserve to|deserves to|should all|must all|should|must|ought to|need to)` +
    `\\s+(?:just\\s+)?(?:${alt(L.DEATH_WISH)})\\b`, "i"),
  // "death to X" as a slogan: at the start of a clause, not "beaten to death to make a point"
  deathTo: /(?:^|[.!?;:\n(]\s*|\s[-–]\s)death to\s+\w+/i,
  helicopterFor: new RegExp(`\\bhelicopter rides?\\s+for\\s+(?:all\\s+)?${DET}(?:${G})\\b`, "i"),
  contempt: new RegExp(`\\b(?:i|we)\\s+(?:fucking\\s+|really\\s+|just\\s+|absolutely\\s+)?(?:${alt(L.CONTEMPT_VERBS)})\\s+` +
    `(?:all\\s+)?${DET}(?:${G})\\b(?!\\s+(?:said|say|says|did|do|think|want|voted|policy|policies))` +
    `|\\bfuck\\s+(?:all\\s+)?(?:of\\s+)?${DET}(?:${G})\\b|\\b(?:${G})\\s+are\\s+the\\s+worst\\b`, "i"),
  // the echo: "(((them)))"
  echo: /\(\(\(\s*[\w\s.'-]{1,40}?\s*\)\)\)/,
  // "we should exterminate the X", "let's kill all the X": a call with the group as the object
  violenceCall: new RegExp(`\\b(?:${CALL})\\s+(?:just\\s+)?(?:${alt(L.KILL_VERBS)})\\s+(?:all\\s+(?:of\\s+)?|every one of\\s+|each of\\s+|every\\s+)?${DET}(?:${G})\\b`, "i"),
  // "... the same fate for our X", counted only when the text names a killing (VIOLENT_STEM)
  sameFate: new RegExp(`\\bsame fate\\s+(?:for|to|as)\\s+(?:all\\s+)?${DET}(?:${G})\\b`, "i"),
  // "the only good commie is a dead commie": the same word twice, any target
  onlyGoodDead: /\bthe only good (\w+) (?:is|are) (?:a )?dead \1\b/i,
  // "communists aren't people": denying a group is human. Matched before the negation filter,
  // since the "not" is the marker here.
  notHuman: new RegExp(`\\b(?:${G})\\s+(?:are not|aren't|arent|ain't)\\s+(?:even\\s+)?(?:people|human|humans|real people)\\b`, "i"),
  // "declare war on Islam", "war against the Jews"
  warOn: new RegExp(`\\b(?:declare|declaring|wage|waging|start)\\s+(?:a\\s+)?(?:holy\\s+)?war\\s+(?:on|against)\\s+(?:the\\s+)?(?:${G})\\b`, "i"),
  vigilante: word(L.VIGILANTE),
  slur: edged(L.SLURS),
  // "<identity> bitch", "<identity> whores": a gendered slur fused with an identity word
  slurCompound: new RegExp(`\\b(?:${alt(L.IDENTITY_ADJ)})\\s+(?:ass\\s+)?(?:${alt(L.GENDERED_SLURS)})\\b`, "i"),
  slurSoft: word(L.SLURS_SOFT),
  // The "noticing" code beside a mocking cue: "oy vey, stop noticing", "the goyim keep noticing". The
  // verb must be a habit or an order ("stop noticing", "are noticing"), so "oy vey, did you notice" stays clear.
  noticing: new RegExp(`\\b(?:${alt(L.NOTICING_CUES)})\\b[^.!?\\n]{0,30}?\\b${NOTICE}` +
    `|\\b${NOTICE}[^.!?\\n]{0,30}?\\b(?:${alt(L.NOTICING_CUES)})\\b`, "i"),
  stereotype: new RegExp(`\\b(?:${G})\\s+(?:are|is)\\s+(?:all\\s+|just\\s+|nothing but\\s+|such\\s+)?${INTENSE}(?:${alt(L.STEREOTYPE_TRAITS)})\\b|\\btypical\\s+(?:${G})\\b`, "i"),
  motive: new RegExp(`\\b(?:${G})\\s+(?:want|wants|are trying|plan|are planning|intend)\\s+to\\s+(?:${alt(L.MOTIVE_VERBS)})\\b|\\b(?:they|${G})\\s+(?:all\\s+)?hate\\s+(?:${alt(L.HATRED_OBJECTS)})\\b`, "i"),
  essentialise: new RegExp(`\\b(?:${alt(L.ESSENTIALISE)})\\b|\\ball (?:the )?(?:${G}) are\\b|\\b(?:${G}) are all\\b`, "i"),
  conspiracy: word(L.CONSPIRACY),
  absolutist: word(L.ABSOLUTIST),
};

// "Immigrants are not animals" and "nobody should be killed" are the opposite of the marker.
const NEGATION = /\b(?:not|never|no one|nobody|aren't|arent|isn't|isnt|shouldn't|shouldnt|don't|dont)\b/i;
const VIOLENT_STEM = /\b(?:extermin|kill|massacr|slaughter|genocid|gass(?:ed|ing)|hang(?:ed|ing)|shoot|shot|lynch|wiped? out|wiping out|eradicat)/i;
// Reported speech and quoted words are a mention, not the speaker's own use: "he called X vermin",
// "compared X to rats", "the word "slur"". Group-blind, so it treats every target alike.
const REPORTED = /\b(?:call(?:s|ed|ing)?|compar(?:e|es|ed|ing)|describ(?:e|es|ed|ing)|label(?:s|ed|led|ing)?|brand(?:s|ed|ing)?|dubb?(?:s|ed|ing)?|refer(?:s|red|ring)? to)\b[^.!?"]{0,40}$/i;
// Someone else's words: "posts saying X are a plague", "nobody should say that X ...", "saying X
// spread like a disease is wrong". The speaker's own "I say" or "we said" is still a use.
const SAID = /\b(?:(?<!\b(?:i|we|i've|we've|i'd|we'd|i'll|we'll|i'm|we're)\s+(?:\w+\s+)?)(?:say|says|said|saying)|wrote|writes|tweeted|posts? saying|claim(?:s|ed|ing)? that|(?:phrases?|repl(?:y|ies)|posts?|memes?|slogans?|terms?|words?)\s+(?:such as|like)|(?:myth|trope|lie|claim|idea|canard|theory|stereotype|notion)s?\s+that|asked\s+(?:whether|if))\b[^.!?"]{0,40}$/i;
const QUOTES = /["“”«»]/;
function mention(s, m) {
  const at = m.index ?? s.indexOf(m[0]);
  const start = at + (m[0].length - m[0].trimStart().length), end = at + m[0].trimEnd().length;
  const before = s.slice(Math.max(0, start - 60), start), after = s.slice(end, end + 2);
  if (REPORTED.test(before)) return true;
  const lead = m[0].trim();
  return QUOTES.test(before.slice(-1)) && QUOTES.test(after.slice(0, 1)) || (QUOTES.test(lead[0]) && QUOTES.test(lead[lead.length - 1]));
}
const unleet = (s) => s.replace(/[013457@$!]/g, (c) => L.LEET[c] || c);

export const WEIGHTS = { dehumanise: 2, violence: 3, vigilante: 2, slur: 2, slurSoft: 1, stereotype: 2, motive: 1,
  essentialise: 1, conspiracy: 1, absolutist: 1, contempt: 1,
  // Named theories (theories.js) are not measured yet, so they stay out of "extreme".
  "conspiracy-theory": 0 };
// "Extreme" for the thread report: any strong marker, or two weaker ones together.
export const EXTREME_AT = 2;
// Families strong enough to label the comment itself.
export const STRONG = new Set(["dehumanise", "violence", "vigilante", "slur", "stereotype"]);

// Other languages, in order. Each adds only families that English and the languages before it
// did not find, and negates its matches with its own negation words. `prep` normalises the text
// for that language's lists (one alef in Arabic, simplified Chinese, NFC Hindi) before matching.
// Ukrainian reads the modifier apostrophe as ', as replies type both. `report` adds the reported-
// speech and quotation cues of rhetoric-mention.js for that language.
export const LANGUAGES = [
  { code: "fr", score: scoreFr, negation: NEGATION_FR },
  { code: "es", score: scoreEs, negation: NEGATION_ES },
  { code: "de", score: scoreDe, negation: NEGATION_DE },
  { code: "pt", score: scorePt, negation: NEGATION_PT },
  { code: "it", score: scoreIt, negation: NEGATION_IT },
  { code: "ar", report: true, score: scoreAr, negation: NEGATION_AR, prep: prepAr },
  { code: "ru", report: true, score: scoreRu, negation: NEGATION_RU, prep: prepRu },
  { code: "uk", report: true, score: scoreUk, negation: NEGATION_UK, prep: (t) => prepRu(t).replace(/ʼ/g, "'") },
  { code: "zh", report: true, score: scoreZh, negation: NEGATION_ZH, prep: prepZh },
  { code: "hi", report: true, score: scoreHi, negation: NEGATION_HI, prep: prepHi },
];
// Word lists derived from labelled corpora (rhetoric-derived.js), only for the languages that
// cleared the test-split gate. They run after the written grammars.
const DERIVED_LANGUAGES = derivedLanguages();

// A matcher that records a marker when `re` matches and, if negatable, the match has no negation.
function recorder(s, markers) {
  return (family, re, negatable = false, on = s, negation = NEGATION, intl = false) => {
    const m = on.match(re);
    if (!m || (negatable && negation.test(m[0])) || mention(on, m) || (intl && mentionedIntl(on, m))) return false;
    markers.push({ family, match: m[0].trim().slice(0, 80) });
    return true;
  };
}

// For the rules added from the 2026-10-23 feed test: a match after a cue that someone else said it
// is skipped. The older rules keep the narrower REPORTED guard, which their measured figures rest on.
// Counter-speech names the words as hate right after them: "... is just antisemitism".
const COUNTERED = /^[^.!?\n]{0,40}?\b(?:is|are|was|were)\s+(?:just\s+|pure\s+|plain\s+|textbook\s+)?(?:antisemitic|antisemitism|racist|racism|bigoted|bigotry|hateful|hate speech|dehumanising|dehumanizing|vile|disgusting|wrong)\b/i;
function strict(s, hit, family, re) {
  const m = s.match(re);
  if (!m) return false;
  const before = s.slice(Math.max(0, m.index - 60), m.index), after = s.slice(m.index + m[0].length);
  return !SAID.test(before) && !COUNTERED.test(after) && hit(family, re, true);
}

function scoreEnglish(s, hit) {
  if (!hit("dehumanise", RE.notHuman) && !hit("dehumanise", RE.dehumanise, true)) strict(s, hit, "dehumanise", RE.simile);
  if (!hit("violence", RE.violenceGroup, true) && !hit("violence", RE.violenceCall, true) && !hit("violence", RE.warOn, true)
    && !hit("violence", RE.deathWish, true) && !hit("violence", RE.onlyGoodDead)
    && !(VIOLENT_STEM.test(s) && hit("violence", RE.sameFate, true))) {
    if (!hit("violence", RE.deathTo) && !hit("violence", RE.helicopterFor)) hit("violence", RE.violenceSlogan);
  }
  hit("vigilante", RE.vigilante);
  if (!hit("slur", RE.slur) && !hit("slur", RE.slur, false, unleet(s)) && !hit("slur", RE.echo)
    && !hit("slur", RE.slurCompound) && !strict(s, hit, "slur", RE.noticing)) hit("slurSoft", RE.slurSoft);
  if (!hit("stereotype", RE.stereotype, true)) strict(s, hit, "stereotype", GROUP_STEREOTYPE);
  hit("motive", RE.motive, true);
  hit("essentialise", RE.essentialise, true);
  hit("conspiracy", RE.conspiracy);
  hit("absolutist", RE.absolutist);
  hit("contempt", RE.contempt, true);
}

// Returns { score, markers: [{ family, match, lang? }], extreme }. lang: the code of the language
// grammar that found the marker; absent for English. opts.derived: derived-list codes to run in
// place of the shipped ones (the evaluation passes every code).
export function score(text, opts = {}) {
  // Look-alike letters from other scripts are folded first (src/core/confusables.js).
  const s = foldConfusables(text).replace(/[’]/g, "'");
  const markers = [];
  const hit = recorder(s, markers);
  scoreEnglish(s, hit);
  for (const t of theoryMatches(s)) {
    if (!mention(s, Object.assign([t.match], { index: t.index }))) markers.push({ family: "conspiracy-theory", theory: t.theory, match: t.match });
  }
  for (const lang of [...LANGUAGES, ...(opts.derived ? derivedLanguages(opts.derived) : DERIVED_LANGUAGES)]) {
    const have = new Set(markers.map((m) => m.family));
    const on = lang.prep ? lang.prep(s) : s;
    const from = markers.length;
    lang.score((family, re, negatable = false) => hit(family, re, negatable, on, lang.negation, !!lang.report), have);
    // Each marker a language grammar found carries its code, so the window can say which word
    // list found it and how that language was measured.
    for (let i = from; i < markers.length; i++) markers[i].lang = lang.code;
  }
  const total = markers.reduce((a, m) => a + WEIGHTS[m.family], 0);
  return { score: total, markers, extreme: total >= EXTREME_AT };
}
