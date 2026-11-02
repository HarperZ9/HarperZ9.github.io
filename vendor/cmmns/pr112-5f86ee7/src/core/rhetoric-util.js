// Regex helpers shared by the non-English rhetoric grammars. JavaScript's \b treats accented
// letters as non-word characters, so every boundary here is a Unicode letter lookaround and
// every pattern is compiled with the "u" flag. Combining marks count as part of a word: Hindi
// vowel signs and Arabic vowel marks are marks, not letters, and a word may end in one.

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const RX = {
  // longest first, so "sous-hommes" wins over "hommes"
  alt: (list) => [...new Set(list)].map(esc).sort((a, b) => b.length - a.length).join("|"),
  B: "(?<![\\p{L}\\p{M}\\p{N}_])",
  E: "(?![\\p{L}\\p{M}\\p{N}_])",
  // up to three words between a group and its verb ("les immigrés de ce pays sont ...")
  FILL: "(?:\\s+[\\p{L}']+){0,3}?",
  re: (src) => new RegExp(src, "iu"),
  // a whole-word negation test built from a word list
  negation: (words) => new RegExp(`(?<![\\p{L}\\p{M}])(?:${words.map(esc).join("|")})(?![\\p{L}\\p{M}])`, "iu"),
};

// Adds a language's markers through `hit(family, regex, negatable)` for families not yet in
// `have`. `rules` maps a family to [regex, negatable] pairs, tried in order until one matches.
export function scoreRules(rules, hit, have) {
  for (const [family, list] of Object.entries(rules)) {
    if (have.has(family)) continue;
    for (const [regex, negatable] of list) if (hit(family, regex, negatable)) break;
  }
}
