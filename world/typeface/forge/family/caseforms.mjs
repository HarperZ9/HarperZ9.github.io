// forge/family/caseforms.mjs
// Case-sensitive forms (OpenType case): punctuation raised to centre on the capitals, so a hyphen,
// a bracket or a guillemet sits right in ALL-CAPS headings and running heads.

const RAISE_MID = ["hyphen", "endash", "emdash", "guillemetleft", "guillemetright", "guilsinglleft", "guilsinglright", "periodcentered", "bullet", "colon"];
const RAISE_TALL = ["parenleft", "parenright", "bracketleft", "bracketright", "braceleft", "braceright", "at", "exclamdown", "questiondown"];

export function caseForms(glyphs, k) {
  const out = {}, mid = (k.cap - k.xh) * 0.5;
  const tall = k.cap / 2 - ((k.asc + 40) + (k.desc + 20)) / 2;
  for (const n of RAISE_MID) if (glyphs[n]) out[`${n}.case`] = { components: [{ name: n, dx: 0, dy: Math.round(n === "colon" ? (k.cap - k.xh) / 2 : mid) }], advance: glyphs[n].advance };
  for (const n of RAISE_TALL) {
    if (!glyphs[n]) continue;
    const dy = n === "at" ? Math.round(k.cap / 2 - (k.cap + 40 + k.desc * 0.6) / 2) : n.endsWith("down") ? Math.round(-k.desc * 0.9) : Math.round(tall);
    out[`${n}.case`] = { components: [{ name: n, dx: 0, dy }], advance: glyphs[n].advance };
  }
  return out;
}
