// forge/family/compose.mjs
// Accented letters as composites (a reference to the base plus a reference to the mark), so a fix to
// a base letter or a mark reaches every letter built from it. The decomposition comes from Unicode
// itself (String.prototype.normalize("NFD")); placement comes from the anchors glyph.mjs recorded.

import { SPACING } from "./marks.mjs";

// The coverage target: Latin-1 Supplement and Latin Extended-A letters, plus the dot-below and
// dot-above letters the site's transliterations use (Latin Extended Additional).
export function targetCodepoints() {
  const cps = [];
  for (let c = 0xc0; c <= 0xff; c++) cps.push(c);
  for (let c = 0x100; c <= 0x17f; c++) cps.push(c);
  for (const c of [0x1e0c, 0x1e0d, 0x1e24, 0x1e25, 0x1e32, 0x1e33, 0x1e36, 0x1e37, 0x1e42, 0x1e43, 0x1e44, 0x1e45, 0x1e46, 0x1e47,
    0x1e5a, 0x1e5b, 0x1e62, 0x1e63, 0x1e6c, 0x1e6d, 0x1e92, 0x1e93, 0x1eb8, 0x1eb9, 0x1ecc, 0x1ecd, 0x1ebc, 0x1ebd, 0x1ef2, 0x1ef3, 0x1e9e,
    0x218, 0x219, 0x21a, 0x21b,                                   // Romanian comma-below S and T
    0x1e80, 0x1e81, 0x1e82, 0x1e83, 0x1e84, 0x1e85]) cps.push(c);  // Welsh w with grave, acute, dieresis
  return cps;
}

const BELOW = new Set([0x323, 0x326, 0x327, 0x328]);
const COMMA_NOT_CEDILLA = new Set(["G", "K", "L", "N", "R", "g", "k", "l", "n", "r"]);   // and U+0326 itself always is
const CARON_ALT = new Set(["d", "l", "t", "L"]);
const ASCENDER = new Set(["b", "d", "h", "k", "l"]);

const isUpper = (ch) => ch !== ch.toLowerCase();

function baseName(ch, marks, glyphs) {
  const top = marks.some((m) => !BELOW.has(m));
  if (ch === "i" && top) return "dotlessi";
  if (ch === "j" && top) return "dotlessj";
  return glyphs[ch] ? ch : null;
}

function markPlacement(ch, m, base, k) {
  let name = `uni${m.toString(16).toUpperCase().padStart(4, "0")}`, anchor = "top", dy = 0;
  if (m === 0x327 && COMMA_NOT_CEDILLA.has(ch)) { name = ch === "g" ? "uni0312" : "uni0326"; anchor = ch === "g" ? "top" : "bottom"; }
  else if (m === 0x30c && CARON_ALT.has(ch)) { name = "caronalt"; anchor = "caronalt"; }
  if (BELOW.has(m)) anchor = m === 0x328 ? "ogonek" : "bottom";
  if (anchor === "top" && name !== "uni0312") {
    if (isUpper(ch)) name += ".case";
    else if (ASCENDER.has(ch)) { name += ".case"; dy = k.asc - k.cap; }
  }
  let x;
  if (anchor === "ogonek") x = base.ink ? base.ink.x1 - k.V * 0.55 : base.advance / 2;
  else if (anchor === "caronalt") { x = base.ink.x1 + k.V * 0.55; if (ch === "t" || ch === "d") x = base.anchors.top + k.V * 1.05; dy = ch === "L" ? k.cap - k.asc : ch === "t" ? -(k.asc - k.xh) * 0.22 : 0; }
  else x = base.anchors[anchor];
  return { name, dx: x, dy };
}

export function composeAccented(glyphs, k) {
  const out = {};
  for (const cp of targetCodepoints()) {
    const ch = String.fromCodePoint(cp);
    if (Object.values(glyphs).some((g) => g.unicode === cp)) continue;
    const nfd = [...ch.normalize("NFD")];
    if (nfd.length < 2) continue;
    const marks = nfd.slice(1).map((c) => c.codePointAt(0));
    const bn = baseName(nfd[0], marks, glyphs);
    if (!bn) continue;
    const base = glyphs[bn], comps = [{ name: bn, dx: 0, dy: 0 }];
    let stackDy = 0;
    for (const m of marks) {
      const pl = markPlacement(nfd[0], m, base, k);
      if (!glyphs[pl.name]) { comps.length = 0; break; }
      comps.push({ name: pl.name, dx: pl.dx, dy: pl.dy + stackDy });
      if (!BELOW.has(m)) stackDy += k.xh * 0.28;
    }
    if (!comps.length) continue;
    out[`uni${cp.toString(16).toUpperCase().padStart(4, "0")}`] = { components: comps, advance: base.advance, unicode: cp, base: bn };
  }
  return out;
}

// Spacing accents, the ligatures and the letters built from two letters.
export function composeOther(glyphs, k) {
  const out = {}, w = (n) => glyphs[n]?.advance ?? 0;
  for (const [name, [mark, cp]] of Object.entries(SPACING)) {
    if (!glyphs[mark]) continue;
    const adv = k.mono ? k.cell : Math.round(k.xh * 0.62), dy = name === "asciicircum" ? -(k.cap - k.xh) * 0.9 : 0;
    out[name] = { components: [{ name: mark, dx: adv / 2, dy }], advance: adv, unicode: cp };
  }
  // Two letters side by side; in the mono cell they overlap into one cell instead.
  const pair = (a, b, cp, gap = 0) => (k.mono
    ? { components: [{ name: a, dx: -k.cell * 0.2, dy: 0 }, { name: b, dx: k.cell * 0.2, dy: 0 }], advance: k.cell, unicode: cp }
    : { components: [{ name: a, dx: 0, dy: 0 }, { name: b, dx: w(a) + gap, dy: 0 }], advance: w(a) + gap + w(b), unicode: cp });
  // Vulgar fractions: numerator, fraction slash, denominator, overlapped by the slash's own width.
  const frac = (n, dd, cp) => {
    const a = `${n}.numr`, b = `${dd}.dnom`, sl = w("fraction"), s = k.mono ? k.cell / (w(a) + w(b) + sl * 0.2) : 1;
    if (!glyphs[a] || !glyphs[b]) return null;
    if (k.mono) return { components: [{ name: a, dx: -k.cell * 0.28, dy: 0 }, { name: "fraction", dx: 0, dy: 0 }, { name: b, dx: k.cell * 0.28, dy: 0 }], advance: k.cell, unicode: cp, _s: s };
    return { components: [{ name: a, dx: 0, dy: 0 }, { name: "fraction", dx: w(a) - sl * 0.45, dy: 0 }, { name: b, dx: w(a) + sl * 0.1, dy: 0 }], advance: w(a) + sl * 0.1 + w(b), unicode: cp };
  };
  for (const [n, dd, cp] of [["one", "four", 0xbc], ["one", "two", 0xbd], ["three", "four", 0xbe]]) { const f = frac(n, dd, cp); if (f) out[{ 0xbc: "onequarter", 0xbd: "onehalf", 0xbe: "threequarters" }[cp]] = f; }
  if (glyphs.I && glyphs.J) out.IJ = pair("I", "J", 0x132);
  if (glyphs.i && glyphs.j) out.ij = pair("i", "j", 0x133);
  if (glyphs.L && glyphs.periodcentered) out.Ldot = { components: [{ name: "L", dx: 0, dy: 0 }, { name: "periodcentered", dx: k.mono ? k.cell * 0.12 : w("L") * 0.52, dy: k.cap * 0.10 }], advance: w("L"), unicode: 0x13f };
  if (glyphs["l"] && glyphs.periodcentered) out.ldot = pair("l", "periodcentered", 0x140, -k.sb * 0.4);
  // U+02BC, the modifier-letter apostrophe (a letter in Azerbaijani, Hausa and others): the right quote.
  if (glyphs.quoteright) out.uni02BC = { components: [{ name: "quoteright", dx: 0, dy: 0 }], advance: w("quoteright"), unicode: 0x2bc };
  if (glyphs.quoteright && glyphs.n) out.napostrophe = pair("quoteright", "n", 0x149);
  if (glyphs.f && glyphs.dotlessi && !k.mono) out.f_i = pair("f", "dotlessi", null, -k.sb * 0.5);
  if (glyphs.f && !k.mono) out.f_f = pair("f", "f", null, -k.sb * 0.9);
  if (glyphs.space) out.uni00A0 = { components: [], advance: w("space"), unicode: 0xa0 };
  return out;
}
