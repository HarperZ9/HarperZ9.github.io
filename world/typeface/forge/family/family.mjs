// forge/family/family.mjs
// Mint one master of one style: every drawn glyph placed with the pen, then the composed glyphs
// (accents, spacing marks, ligatures, case forms) built from them by reference. Returns plain data the
// font builder writes out, plus the skeletons the lettering library reads.

import { context, STYLES } from "./styles.mjs";
import { dims } from "./kit.mjs";
import { place } from "./glyph.mjs";
import { drawn } from "./registry.mjs";
import { composeAccented, composeOther } from "./compose.mjs";
import { caseForms } from "./caseforms.mjs";
import { tabWidth } from "./figures.mjs";
import { autospace, kernPairs } from "./kern.mjs";
import { CUTS, runicCaps } from "./cuts.mjs";
import { xform } from "./kit.mjs";

// Italic: the skeleton is sheared before the pen runs, so the pen (upright contrast) gives the slant its
// own modulation instead of a slanted copy of the roman. The italic also takes its own a (single storey).
const ITALIC_FORMS = { a: "a.ss01" };
// A sheared stem cut square would dip below the baseline by half a stem x sin(9 degrees); every
// near-vertical end is cut flat instead, so the italic sits on the same lines as the roman.
function flatEnds(st) {
  if (st.path.closed || st.path.pts.length < 2) return st;
  const P = st.path.pts, n = P.length, cap = { ...(st.cap || {}) };
  const steep = (a, b) => Math.abs(b[0] - a[0]) < 0.35 * Math.abs(b[1] - a[1]);
  if (steep(P[0], P[1]) && !cap.a) cap.a = "h";
  if (steep(P[n - 2], P[n - 1]) && !cap.b) cap.b = "h";
  return { ...st, cap };
}
function italicise(def, t, pivot) { const d = xform(def, ([x, y]) => [x + (y - pivot) * t, y]); return { ...d, strokes: d.strokes.map(flatEnds) }; }

// The kerning set: letters, figures and the punctuation that meets them.
export const KERN_SET = [..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "ae", "oe", "oslash", "germandbls", "thorn", "eth", "dotlessi", "eng", "lslash", "AE", "OE", "Oslash", "Thorn", "Eth", "Lslash",
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "period", "comma", "colon", "semicolon", "hyphen", "endash", "quoteright", "quoteleft", "quotedblright", "quotedblleft", "quotesingle", "quotedbl",
  "parenleft", "parenright", "bracketleft", "bracketright", "slash", "guillemetleft", "guillemetright", "ellipsis", "exclam", "question", "ampersand"];

export function mintMaster(styleId, weight, opts = {}) {
  const k = context(styleId, weight, opts.extra || {});
  const d = dims(k);
  const glyphs = {};
  const runic = opts.cut === "runic" ? runicCaps(k, d) : {};
  // A cut decides which ends are free on the default weight, then applies that plan to every weight,
  // so the masters stay point-compatible.
  const k0 = CUTS[opts.cut] ? context(styleId, STYLES[styleId].default, opts.extra || {}) : null, d0 = k0 ? dims(k0) : null;
  const defs = drawn(k), tan = k.italic ? Math.tan(k.italic * Math.PI / 180) : 0;
  for (const [name, fn0] of Object.entries(defs)) {
    const fn = tan && ITALIC_FORMS[name] ? (kk, dd) => ({ ...defs[ITALIC_FORMS[name]](kk, dd), unicode: name.codePointAt(0) }) : fn0;
    let def = runic[name] ? { ...runic[name], unicode: name.codePointAt(0) } : fn(k, d);
    if (!def) continue;
    if (CUTS[opts.cut] && !def.raw) def = CUTS[opts.cut](def, k, fn(k0, d0), k0);
    if (tan) def = italicise(def, tan, k.xh / 2);
    const g = place(name, def, k);
    g.unicode = def.unicode ?? null;
    if (def.mark) g.mark = true;
    if (def.sb && /^([a-zA-Z]|ae|oe|AE|OE|germandbls|thorn|Thorn|eth|Eth|eng|Eng)$/.test(name)) g.sides = def.sb;
    if (def.figureSpace) g.advance = k.mono ? k.cell : tabWidth(k, d);
    if (tan && g.ink && !def.raw) {   // anchors follow the slant: top at the glyph's top, bottom at the baseline
      const mid = (g.ink.y0 + g.ink.y1) / 2;
      if (!def.anchors?.top) g.anchors.top += (g.ink.y1 - mid) * tan; else g.anchors.top += g.ink.y1 * tan;
      if (!def.anchors?.bottom) g.anchors.bottom += (0 - mid) * tan;
    }
    glyphs[name] = g;
  }
  let spacing = {}, kerning = {};
  if (!k.mono && !opts.noSpacing) {
    spacing = autospace(glyphs, k, Object.fromEntries(Object.entries(glyphs).filter(([, g]) => g.sides).map(([n, g]) => [n, g.sides])));
  }
  if (!k.mono && !opts.noKern) kerning = kernPairs(glyphs, k, KERN_SET);
  for (const [n, g] of Object.entries(composeAccented(glyphs, k))) glyphs[n] = g;
  for (const [n, g] of Object.entries(composeOther(glyphs, k))) glyphs[n] = g;
  for (const [n, g] of Object.entries(caseForms(glyphs, k))) glyphs[n] = g;
  return { style: styleId, weight, cut: opts.cut ?? null, k, glyphs, spacing, kerning };
}
