// Word lists derived from human-labelled corpora by scripts/derive-lexicon.mjs (dev split only).
// Generated; do not edit between the markers. Each language lists its "slur" terms and the label
// they were derived against: "group" (hate aimed at a group) or "hostile" (the corpus has only an
// offensive-or-not label). A term ending in "*" is a Turkish stem matched with any ending. How each
// term was picked, with its dev counts: project-docs/evidence/derived-lexicon.json.

// derived:begin (scripts/derive-lexicon.mjs)
export const DERIVED = {
  he: {"basis":"hostile","slur":["זבל","זונה","נפש"]},
  tr: {"basis":"group","slur":[]},
  ko: {"basis":"group","slur":["개독","개돼","개한","계집","광신","김치","꺼져","꼰대","꼴통","꼴페","나라로","나베","나이값","노땅","노망","뇌가","늙다","달창","대깨","맘충","매국","메갈","무능","문빠","미개","부들","북괴","빨갱","사이비","사회악","쓰레기들","여적","예수쟁","왜구","일베","재앙","정신병자","조센","종북","종특","좌빨","짱개","짱깨","쪽바","추방","친일","쿵쾅","토착","틀니","틀딱","한남","한녀","헬조","홍어"]},
  ja: {"basis":"group","slur":["反日","死ね"]},
  fa: {"basis":"group","slur":[]},
  id: {"basis":"group","slur":["penista"]},
  hi: {"basis":"hostile","slur":["कुत्ते","तुम","धर्म","साले"]},
};
// derived:end

// The languages whose list cleared the test-split gate in scripts/eval-derived.mjs. A language not
// listed is held back: its list is kept for the record and never runs on a reply.
// ship:begin (scripts/eval-derived.mjs)
export const DERIVED_SHIP = ["ko","id"];
// ship:end
