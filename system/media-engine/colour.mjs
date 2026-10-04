// system/media-engine/colour.mjs
// The engine's one colour module: the perceptual colour maths every plugin should use, and the
// risk tokens every status or verdict mark in the engine, the Studio and the font engine uses.
//
// 1. Perceptual colour. The sRGB transfer and both OKLab directions are the vendored superstack
//    contract's (contracts.mjs, pinned by SHA-256). The OKLCh and CIEDE2000 helpers, which the
//    contract does not carry, come from system/lib/sense-core/colour-perceptual.mjs, whose OKLab
//    colour.test.mjs holds equal to the contract's. retro-palettes.js, fractal-color.js,
//    reactive-visuals.js and engine/sim/particles-cpu.js import OKLab from the contract too; each
//    swap was checked bit for bit and against the pixel hashes of what it draws.
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
  srgbToLinear, linearToSrgb, linearSrgbToOklab as linearRgbToOklab, oklabToLinearSrgb as oklabToLinearRgb,
  RISK_LEVELS, RISK_TOKENS, RISK_GROUNDS, riskOf, hotMark, contrastRatio,
} from "./contracts.mjs";
export {
  oklabToOklch, oklchToOklab, oklchToSrgbByte, srgbByteToLab, ciede2000,
} from "../lib/sense-core/colour-perceptual.mjs";
import { RISK_LEVELS, RISK_TOKENS, riskOf, hotMark } from "./contracts.mjs";

export const RISK_LABELS = Object.freeze({
  low: "low liability", moderate: "moderate liability", elevated: "elevated liability", high: "high liability",
});

// Hot colours per pole (RISK_TOKENS), their grounds (RISK_GROUNDS), the verdict-word map (riskOf,
// unknown words read moderate; REFUTED, the contract's tolerance verdict, reads high), the one hot
// mark per view (hotMark) and the WCAG contrast check all come from the contract above.
// colour.test.mjs checks every token against every ground of its pole.

export function riskRank(level) { return RISK_LEVELS.indexOf(riskOf(level)); }

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

// The CSS custom properties for both poles, generated from RISK_TOKENS so risk.css cannot drift
// from this module (colour.test.mjs compares the two).
export function riskCss() {
  const block = (t) => RISK_LEVELS.map((k) => `--risk-${k}:${t[k]};`).join("") + `--risk-ink:${t.ink};--risk-quiet:${t.quiet};`;
  return `:root{${block(RISK_TOKENS.light)}}`
    + `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${block(RISK_TOKENS.dark)}}}`
    + `:root[data-theme="dark"]{${block(RISK_TOKENS.dark)}}`;
}
