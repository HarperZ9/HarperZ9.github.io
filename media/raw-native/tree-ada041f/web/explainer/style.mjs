// Palette and type for explainer films, from the site's design rules (DESIGN-RULES.md in
// HarperZ9.github.io): two principal families with distinct roles, Hanken Grotesk for headings,
// reading text and labels, and Conso for data, characters and code, as the site delivers them.
// Labels are mixed case with no added tracking (no tracked caps, no eyebrows). Text colour is ink;
// accents carry states and always sit beside text. Figures may use a limited explanatory palette.
//
//   const T = await loadType((p) => ctx.json(p));        // the atlases, once
//   items.push(...T.head("How attention moves information", { x: 160, y: 200, size: 72, ground: "night" }));
//   items.push(...T.meta("MODEL · 2 LAYERS · SEED 7", { x: 160, y: 250, reveal: 0.6 }));
import { text } from "../motion/text.mjs";
import { span, ease } from "../motion/timeline.mjs";

// Display colours (sRGB hex) for each ground. verified / drift / unverifiable are the only
// colours that carry meaning; ink and ink2 are text.
export const GROUNDS = Object.freeze({
  night: { ink: "#ece5d6", ink2: "#9a9284", rule: "#3a3630", verified: "#7fd6a8", drift: "#e2a45a", unverifiable: "#8f8aa8" },
  paper: { ink: "#1d1b18", ink2: "#5f5a52", rule: "#bdb5a6", verified: "#2f7d55", drift: "#a5611c", unverifiable: "#5d5872" },
});

export const FONTS = Object.freeze({
  head: "fonts/hanken-grotesk-700.atlas.json",
  body: "../../docs/motion/hanken-grotesk-500.atlas.json",
  mono: "fonts/conso-400.atlas.json",
});

// A cache of laid-out strings: layout is the costly part of text, and labels repeat every frame.
function cache() {
  const m = new Map();
  return (key, make) => { let v = m.get(key); if (!v) { v = make(); m.set(key, v); if (m.size > 4000) m.delete(m.keys().next().value); } return v; };
}

export async function loadType(load = async (p) => (await fetch(new URL(p, import.meta.url))).json()) {
  const [head, body, mono] = await Promise.all([load(FONTS.head), load(FONTS.body), load(FONTS.mono)]);
  return typeKit({ head, body, mono });
}

// The text roles. Each returns display-list items; `reveal` (0..1) types the string on, glyph by
// glyph, which is how a label appears; `opacity` fades the whole item.
export function typeKit(atlases) {
  const memo = cache();
  const lay = (role, str, size, x, y, anchor, tracking) =>
    memo(`${role}|${str}|${size}|${x}|${y}|${anchor}|${tracking}`, () => text(str, { atlas: atlases[role], size, x, y, anchor, tracking }));
  function draw(role, str, o = {}) {
    const g = GROUNDS[o.ground || "night"], size = o.size ?? 32, anchor = o.anchor ?? "left";
    const tracking = o.tracking ?? (role === "head" ? -0.01 : 0);
    const t = lay(role, str, size, o.x ?? 0, o.y ?? 0, anchor, tracking);
    const n = t.glyphs.length, k = Math.round((o.reveal ?? 1) * n);
    if (k <= 0 || (o.opacity ?? 1) <= 0) return [];
    const shape = k >= n ? t.shape : t.glyphs.slice(0, k).flatMap((q) => q.shape);
    return [{ shape, fill: o.color || g[o.tone || "ink"], opacity: o.opacity ?? 1, screen: o.screen, z: o.z, blur: o.blur }];
  }
  return {
    atlases,
    width: (role, str, size, tracking = 0) => lay(role, str, size, 0, 0, "left", tracking).width,
    head: (s, o = {}) => draw("head", s, { size: 64, ...o }),
    body: (s, o = {}) => draw("body", s, { size: 32, ...o }),
    // Labels: figure labels, units, sources. Small, secondary ink, sentence case.
    meta: (s, o = {}) => draw("body", s, { size: 20, tone: "ink2", ...o }),
    // Data: characters, values, commands, in Conso.
    mono: (s, o = {}) => draw("mono", s, { size: 22, ...o }),
    // A big bound number: the string is computed by the caller from data.
    figure: (s, o = {}) => draw("head", s, { size: 120, ...o }),
  };
}

// Reveal helper for typed labels: 0 before a, 1 after a + dur, with a short ease.
export const typeOn = (t, a, dur = 0.8) => span(t, a, a + dur, ease.linear);
