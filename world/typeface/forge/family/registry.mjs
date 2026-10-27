// forge/family/registry.mjs
// Every drawn glyph by production name, with its code point. A single-character name maps to itself;
// suffixed names (a.ss01, zero.tf) have no code point and are reached through OpenType features.

import { LOWER_A_M } from "./lower.mjs";
import { LOWER_N_Z } from "./lower2.mjs";
import { UPPER } from "./upper.mjs";
import { figureGlyphs, monoFigureOverrides } from "./figset.mjs";
import { PUNCT } from "./punct.mjs";
import { SYMBOLS } from "./symbols.mjs";
import { MARKS } from "./marks.mjs";
import { EXTRAS } from "./extras.mjs";
import { MONO } from "./mono.mjs";

export const NAMED = { dotlessi: 0x131, dotlessj: 0x237 };

// Spaces, by advance. The figure space matches a tabular figure; the others follow typesetting use.
function spaces(k) {
  const sp = (adv, cp) => () => ({ advance: Math.round(adv), raw: true, unicode: cp });
  const word = k.mono ? k.cell : k.xh * 0.50;
  return {
    space: sp(word, 0x20), uni2009: sp(k.mono ? k.cell : 1000 / 6, 0x2009), uni200A: sp(k.mono ? k.cell : 1000 / 12, 0x200a),
    uni2008: sp(k.mono ? k.cell : k.sb * 2 + k.V, 0x2008), uni202F: sp(k.mono ? k.cell : 1000 / 6, 0x202f),
    uni2007: () => ({ advance: 0, raw: true, unicode: 0x2007, figureSpace: true }),
    ".notdef": () => ({ strokes: [], fills: [], advance: 500, raw: true, notdef: true }),
  };
}

export function codeFor(name) {
  if (name in NAMED) return NAMED[name];
  if ([...name].length === 1) return name.codePointAt(0);
  const m = /^uni([0-9A-F]{4,6})$/.exec(name);
  return m ? parseInt(m[1], 16) : null;
}

export function drawn(k) {
  const mods = [LOWER_A_M, LOWER_N_Z, UPPER, figureGlyphs(), PUNCT, SYMBOLS, MARKS, EXTRAS, spaces(k)];
  if (k.mono) mods.push(MONO, monoFigureOverrides());
  const out = {};
  for (const mod of mods) for (const [name, fn] of Object.entries(mod)) {
    out[name] = (kk, d) => { const def = fn(kk, d); if (def) def.unicode = def.unicode ?? codeFor(name); return def; };
  }
  return out;
}
