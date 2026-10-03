// system/media-engine/colour.mjs
// The engine's one colour module: the perceptual colour maths every plugin should use, and the
// risk tokens every status or verdict mark in the engine, the Studio and the font engine uses.
//
// 1. Perceptual colour. Re-exported from system/lib/sense-core/colour-perceptual.mjs, the tested
//    module. New engine code imports OKLab from here. Five older modules (retro-palettes.js,
//    fractal-color.js, reactive-visuals.js, engine/sim/particles-cpu.js and sense-core itself)
//    still carry their own float OKLab with slightly different matrix precision. Moving them here
//    would shift palette output by a level or two, so each moves only with a pixel-hash check of
//    the frames it draws (assessment section 6, step 6).
//
// 2. Risk tokens. The author's ruling of 3 October 2026: status colour in UI is read as liability
//    and risk. Four levels, ordered:
//
//      low       the claim is verified; acting on it carries little liability   (verdict MATCH)
//      moderate  the claim could not be checked; liability is unknown           (UNVERIFIABLE)
//      elevated  the check found drift; acting on it needs care                 (DRIFT)
//      high      the check failed or was refused; acting on it is a liability   (FAIL, REFUSED)
//
//    One hot mark per view (the design canon's colour rule): in any one view only the item with
//    the highest liability is drawn in its hot colour. Every other status mark in that view is
//    drawn quiet: ink text with the level named in words, never colour alone. hotMark() picks
//    the item. The spectrum stays inside generative art and never reaches these tokens.

export {
  srgbToLinear, linearToSrgb, linearRgbToOklab, oklabToLinearRgb, oklabToOklch, oklchToOklab,
  oklchToSrgbByte, srgbByteToLab, ciede2000,
} from "../lib/sense-core/colour-perceptual.mjs";

export const RISK_LEVELS = Object.freeze(["low", "moderate", "elevated", "high"]);

export const RISK_LABELS = Object.freeze({
  low: "low liability", moderate: "moderate liability", elevated: "elevated liability", high: "high liability",
});

// Hot colours per pole. Each clears WCAG AA (4.5:1) as text on the site's grounds for its pole;
// colour.test.mjs checks every pair, so a token edit that breaks contrast fails the build.
export const RISK_TOKENS = Object.freeze({
  light: Object.freeze({ low: "#186844", moderate: "#5c5a66", elevated: "#8f5200", high: "#b3261e", ink: "#15130f", quiet: "#5d584e" }),
  dark: Object.freeze({ low: "#8fdc8a", moderate: "#a9a6b4", elevated: "#f0a848", high: "#ff7a6b", ink: "#ebe5d8", quiet: "#9d978a" }),
});

// The grounds the tokens are checked against: page, bone and paper on the light pole; void,
// instrument and raised panel on the dark pole.
export const RISK_GROUNDS = Object.freeze({
  light: Object.freeze(["#f4f3ef", "#ebe5d8", "#f2efe6"]),
  dark: Object.freeze(["#060608", "#070406", "#1d1622"]),
});

const VERDICT_TO_RISK = Object.freeze({
  MATCH: "low", VERIFIED: "low", PASS: "low", OK: "low",
  UNVERIFIABLE: "moderate", UNKNOWN: "moderate", PENDING: "moderate",
  DRIFT: "elevated", WARN: "elevated", STALE: "elevated",
  FAIL: "high", FAILED: "high", REFUSED: "high", ERROR: "high", BROKEN: "high",
});

// Map any verdict word the site prints to a risk level. Unknown words read as moderate: a status
// nobody can interpret is a liability nobody has measured.
export function riskOf(verdict) {
  if (RISK_LEVELS.includes(verdict)) return verdict;
  return VERDICT_TO_RISK[String(verdict || "").trim().toUpperCase()] || "moderate";
}

export function riskRank(level) { return RISK_LEVELS.indexOf(riskOf(level)); }

// Given the status marks in one view, return the index of the one mark that is drawn hot: the
// highest liability, the first such item on a tie. Returns -1 for an empty view. A view whose
// worst item is low liability still gets its one hot mark, so a clean result is visible too.
export function hotMark(levels) {
  let best = -1, rank = -1;
  for (let i = 0; i < levels.length; i++) {
    const r = riskRank(levels[i]);
    if (r > rank) { rank = r; best = i; }
  }
  return best;
}

// Apply the rule to DOM nodes: every node gets data-risk="<level>", and exactly one gets
// data-risk-hot. risk.css colours only [data-risk-hot]. Nodes must already carry the level in
// their text, so the meaning never depends on colour.
export function markRisk(nodes, levelOf = (n) => n.dataset.verdict || n.dataset.risk) {
  const list = Array.from(nodes || []);
  const levels = list.map((n) => riskOf(levelOf(n)));
  const hot = hotMark(levels);
  list.forEach((n, i) => {
    n.dataset.risk = levels[i];
    if (i === hot) n.dataset.riskHot = ""; else delete n.dataset.riskHot;
  });
  return hot;
}

// WCAG 2.x contrast ratio of two #rrggbb colours.
export function contrastRatio(a, b) {
  const lum = (hex) => {
    const h = hex.replace("#", "");
    const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// The CSS custom properties for both poles, generated from RISK_TOKENS so risk.css cannot drift
// from this module (colour.test.mjs compares the two).
export function riskCss() {
  const block = (t) => RISK_LEVELS.map((k) => `--risk-${k}:${t[k]};`).join("") + `--risk-ink:${t.ink};--risk-quiet:${t.quiet};`;
  return `:root{${block(RISK_TOKENS.light)}}`
    + `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${block(RISK_TOKENS.dark)}}}`
    + `:root[data-theme="dark"]{${block(RISK_TOKENS.dark)}}`;
}
