// Shared by the three visual-direction proofs for the attention lesson. One beat, drawn three
// ways: the last word of "pylon found a crate . pylon put a cone on the" looks back along the
// sentence, and most of its attention lands on "crate". The scores here are set by hand for the
// proof (labelled on screen as an illustration); the film itself uses the trained model.
export const ENGINE = "../../../raw-native/tree-c6b114d/";
export const WORDS = ["pylon", "found", "a", "crate", ".", "pylon", "put", "a", "cone", "on", "the"];
export const QUERY = WORDS.length - 1;
// Hand-set scores (logits) for the query against each earlier word.
const SCORES = [0.6, -0.4, -0.2, 3.1, -1.0, 0.4, -0.3, -0.2, 1.2, 0.3, -0.5];

export function softmax(v) {
  const m = Math.max(...v), e = v.map((x) => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}
export const WEIGHTS = softmax(SCORES);

// A second head that reads something else (the word just before), for the prism split.
export const WEIGHTS2 = softmax(WORDS.map((_, i) => (i === QUERY - 1 ? 2.6 : i === QUERY ? 1.0 : -0.6)));

export const smooth = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
export const loadAtlas = async (ctx) => ({ atlas: await ctx.json(ENGINE + "docs/motion/hanken-grotesk-500.atlas.json") });
