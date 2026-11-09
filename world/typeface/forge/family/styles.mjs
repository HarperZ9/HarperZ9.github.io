// forge/family/styles.mjs
// The three styles and their weight masters. A master is a full parameter set at one point on the
// weight axis; any weight between two masters interpolates the parameters linearly, which is the same
// linear model the variable font's gvar deltas apply to the outlines.
//
// Units: font units at 1000 per em.
//   V      vertical stem; H = V x C is the horizontal stroke
//   C      contrast (1 = monoline). The upstream contrast floor (0.45) still applies.
//   sb     straight sidebearing for lowercase; sbCap for capitals
//   cw     counter factor: 1 at the light master, below 1 where weight eats the counter

export const FAMILY = "Accession";   // the family name, chosen by the author on 2026-10-23

const common = { n: 2.5, ap: 0.62, desc: -212, ov: 10, ovC: 12 };

export const STYLES = Object.freeze({
  text: {
    name: "Text", axis: [300, 800], default: 400,
    fixed: { ...common, xh: 500, cap: 700, asc: 742, fig: 690, wd: 1.0, kernGain: 0.42, kernCap: 0.13 },
    masters: {
      300: { V: 68, C: 0.92, sb: 66, sbCap: 80, cw: 1.0 },
      800: { V: 168, C: 0.76, sb: 50, sbCap: 62, cw: 0.86 },
    },
  },
  // Text Italic: the Text skeletons sheared 9 degrees before the pen, a little narrower and tighter.
  textItalic: {
    name: "Text Italic", axis: [300, 800], default: 400,
    fixed: { ...common, xh: 500, cap: 700, asc: 742, fig: 690, wd: 0.95, italic: 9, kernGain: 0.42, kernCap: 0.13 },
    masters: {
      300: { V: 66, C: 0.92, sb: 58, sbCap: 72, cw: 1.0 },
      800: { V: 162, C: 0.76, sb: 44, sbCap: 56, cw: 0.86 },
    },
  },
  display: {
    name: "Display", axis: [300, 900], default: 700,
    fixed: { ...common, taperFloor: 1, joinDepth: 0.001, n: 2.9, ap: 0.5, xh: 540, cap: 720, asc: 760, fig: 720, wd: 1.04, ov: 9, ovC: 11 },
    masters: {
      300: { V: 58, C: 0.80, sb: 44, sbCap: 54, cw: 1.0 },
      900: { V: 214, C: 0.58, sb: 30, sbCap: 36, cw: 0.78 },
    },
  },
  // Display and Super set taperFloor 1 and joinDepth 0.001: no ink traps and bowls that run into the stem,
  // because a trap that opens text at 12 px reads as a broken letter at 96 px and up.
  // Supergraphic: the room-scale word. Squared bowls (superellipse n 3.7; above about 4 the inner offset of a heavy stroke loops at the corners), a tall x-height and very
  // heavy stems, for one huge word per wall and for footage knocked into the letters. The wiqaayat
  // films' heavy condensed card face and the poster mascot word are the brief; Kilon Bold (licensed)
  // was looked at for weight, not copied: the skeletons are this family's own.
  super: {
    name: "Super", axis: [600, 900], default: 900,
    fixed: { ...common, taperFloor: 1, joinDepth: 0.001, n: 3.7, ap: 0.42, xh: 600, cap: 760, asc: 790, desc: -190, fig: 760, wd: 0.94, ov: 4, ovC: 4 },
    masters: {
      600: { V: 150, C: 0.66, sb: 26, sbCap: 30, cw: 0.92 },
      900: { V: 240, C: 0.56, sb: 20, sbCap: 22, cw: 0.80 },
    },
  },
  mono: {
    name: "Mono", axis: [300, 700], default: 400,
    fixed: { ...common, n: 2.7, xh: 530, cap: 700, asc: 740, fig: 700, wd: 0.92, mono: true, cell: 600, monoSb: 52 },
    masters: {
      300: { V: 60, C: 0.90, sb: 50, sbCap: 50, cw: 1.0 },
      700: { V: 132, C: 0.80, sb: 50, sbCap: 50, cw: 0.86 },
    },
  },
});

export const CONTRAST_FLOOR = 0.45;

// The parameter context a glyph definition reads.
export function context(styleId, weight, extra = {}) {
  const st = STYLES[styleId];
  if (!st) throw new Error(`styles: unknown style ${styleId}`);
  const [lo, hi] = st.axis, t = Math.min(1, Math.max(0, (weight - lo) / (hi - lo)));
  const a = st.masters[lo], b = st.masters[hi], m = {};
  for (const key of Object.keys(a)) m[key] = a[key] + (b[key] - a[key]) * t;
  const k = { style: styleId, weight, ...st.fixed, ...m, ...extra };
  k.H = k.V * k.C;
  // allowLowContrast is a display-only exemption (the Mincho proposal); text styles never set it.
  if (k.C < CONTRAST_FLOOR && !k.allowLowContrast) throw new Error(`contrast-floor: ${k.C.toFixed(2)} under ${CONTRAST_FLOOR}`);
  return k;
}
