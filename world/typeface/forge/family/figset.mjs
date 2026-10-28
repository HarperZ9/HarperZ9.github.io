// forge/family/figset.mjs
// The figure sets as named glyphs: lining proportional (default in Text and Display), tabular lining
// (.tf), oldstyle (.osf), tabular oldstyle (.tosf), slashed zero (.zero), superiors, inferiors,
// numerators (.numr) and denominators (.dnom) for fractions.

import { FIGS, FIG_NAMES, osfBox, tabWidth, zero } from "./figures.mjs";
import { dims, smallK } from "./kit.mjs";

const SUP_CP = [0x2070, 0xb9, 0xb2, 0xb3, 0x2074, 0x2075, 0x2076, 0x2077, 0x2078, 0x2079];

function tab(def, k, d) { return { ...def, advance: tabWidth(k, d), center: true }; }

function small(k, fn, i, y0f, y1f) {
  const s = smallK(k, 0.58), ds = dims(s);
  const def = fn(s, ds, k.cap * y0f, k.cap * y1f);
  return def;
}

export function figureGlyphs() {
  const out = {};
  FIGS.forEach((fn, i) => {
    const nm = FIG_NAMES[i];
    out[nm] = (k, d) => ({ ...fn(k, d, 0, k.fig), unicode: 0x30 + i });
    out[`${nm}.tf`] = (k, d) => tab(fn(k, d, 0, k.fig), k, d);
    out[`${nm}.osf`] = (k, d) => fn(k, d, ...osfBox(k, i));
    out[`${nm}.tosf`] = (k, d) => tab(fn(k, d, ...osfBox(k, i)), k, d);
    out[`${nm}.sups`] = (k) => ({ ...small(k, fn, i, 0.42, 1.0), unicode: SUP_CP[i] });
    out[`${nm}.sinf`] = (k) => ({ ...small(k, fn, i, -0.16, 0.42), unicode: 0x2080 + i });
    out[`${nm}.numr`] = (k) => small(k, fn, i, 0.42, 1.0);
    out[`${nm}.dnom`] = (k) => small(k, fn, i, 0.0, 0.58);
  });
  out["zero.zero"] = (k, d) => zero(k, d, 0, k.fig, true);
  out["zero.tf.zero"] = (k, d) => tab(zero(k, d, 0, k.fig, true), k, d);
  return out;
}

// Mono figures are tabular by construction (one cell); its zero is slashed by default so it never
// reads as O in a hash.
export function monoFigureOverrides() {
  return { zero: (k, d) => ({ ...zero(k, d, 0, k.fig, true), unicode: 0x30 }) };
}
