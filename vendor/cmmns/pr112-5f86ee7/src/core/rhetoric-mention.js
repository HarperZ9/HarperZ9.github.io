// Reported speech and quoted words in Arabic, Russian, Ukrainian, Chinese and Hindi: a mention of a
// marker, not the speaker's own use ("عمري ما قلت ان ...", "他骂女人是垃圾", "не называй их ...").
// Group-blind, so every target is treated alike. English has its own rule in rhetoric.js.

const CUES = [
  // Arabic: said that, calls, describes, phrases like, believe that
  "قلت ان", "تقول ان", "يقول ان", "بتقول ان", "بيقول ان", "قال ان", "قالوا ان", "تسمي", "بتسمي", "يسمي", "بيسمي", "تسمية",
  "وصف", "وصفت", "يصف", "عبارات", "عبارة", "كلمة", "زي ان", "تصدق ان", "يصدق ان", "مقولة",
  // Russian and Ukrainian: calls, said that, writes that, the word
  "называет", "называют", "назвал", "назвала", "называть", "называй", "сказал что", "сказала что", "говорит что", "пишет что",
  "сравнил", "слово", "фраза", "називає", "називають", "назвав", "назвала", "називати", "сказав що", "каже що", "пише що",
  "порівняв", "слово", "фраза",
  // Chinese: scolds as, calls, shouts, sends, threatens, like the saying. "说" (say) is left out: a
  // speaker who says it is using it.
  "骂", "称", "叫", "喊", "发送", "扬言", "类似", "宣称", "称呼",
  // Hindi: saying that, calls, believing that
  "कहना कि", "कहते हैं कि", "कहा कि", "बोलना कि", "मानना कि", "कहना", "बुलाना", "kehna ki", "kehte hain ki", "kaha ki",
  "bolna ki", "vishwas nahi kar sakte ki", "maanna ki",
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The cue may sit up to 24 characters before the match, with no sentence end between.
const CUE = new RegExp(`(?:${CUES.map(esc).join("|")})[^.!?。！？؟\\n]{0,24}$`, "iu");
const OPEN = /["“«「『„]/u, CLOSE = /["”»」』“]/u;

// s: the text the match came from; m: the match. True when the match is reported or quoted.
export function mentionedIntl(s, m) {
  const at = m.index ?? s.indexOf(m[0]);
  const before = s.slice(Math.max(0, at - 40), at), after = s.slice(at + m[0].length, at + m[0].length + 12);
  if (CUE.test(before)) return true;
  // An open quote before the match with no close between, and a close soon after.
  const lastOpen = Math.max(...[...before].map((c, i) => (OPEN.test(c) ? i : -1)));
  return lastOpen >= 0 && !CLOSE.test(before.slice(lastOpen + 1)) && CLOSE.test(after);
}
