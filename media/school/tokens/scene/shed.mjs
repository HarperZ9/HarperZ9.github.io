// Pylon's customs shed at night (PROGRESS.md, step 20): conveyor belts that carry text cut into
// crates. A row of crates is drawn from real pieces (the lesson's own encoder over facts.json's
// merges), so what moves on the belt is what the tokenizer makes. "_" marks the end of a word.
import { rect, circle, polyline, words } from "../../shared/lib.mjs";
import { EOW } from "../../../../system/school/tokens.mjs";

export const INK = { night: "#ece5d6", dim: "#958e80", ember: "#e29472", warm: [1, 0.75, 0.45], cold: [0.75, 0.82, 0.95] };
export const label = (p) => p.replace(EOW, "_");

export function shed(t, { lamp = 1 } = {}) {
  const out = [{ shape: rect(0, 0, 1920, 1080), screen: true, fill: [0.02, 0.022, 0.03, 1] }];
  for (let k = 0; k < 9; k++) out.push({ shape: rect(80 + k * 220, 0, 6, 1080), fill: [0.07, 0.07, 0.09, 1] });
  out.push({ shape: circle(960, -40, 520, 48), fill: [1, 0.75, 0.45, 0.05 * lamp], blend: "add" });
  return out;
}
// A belt at height y, with rollers that turn at the belt's speed.
export function belt(y, t, speed = 60, x0 = 100, x1 = 1820) {
  const out = [{ shape: rect(x0, y + 36, x1 - x0, 16, 6), fill: [0.22, 0.2, 0.19, 1] }];
  for (let x = x0 + 20; x < x1; x += 80) { const a = (t * speed) / 12 + x; out.push({ shape: circle(x, y + 44, 9, 12), fill: [0.12, 0.11, 0.1, 1] }, { shape: polyline([x, y + 44, x + 8 * Math.cos(a), y + 44 + 8 * Math.sin(a)]), fill: null, stroke: [0.45, 0.42, 0.38, 1], width: 2 }); }
  return out;
}
// A row of crates for a list of words' pieces, left to right from x, riding the belt at y.
// hot(i) marks a piece in ember; a is opacity. Returns items and the row's right edge.
export function crates(A, pieceLists, x, y, { a = 1, hot = () => false, size = 40, gap = 26 } = {}) {
  const out = [];
  let i = 0;
  for (const pieces of pieceLists) {
    for (const p of pieces) {
      const s = label(p), w = s.length * size * 0.62 + 22, h = hot(i, p);
      out.push({ shape: rect(x, y - 40, w, 80, 6), fill: h ? [0.89, 0.58, 0.45, 0.28 * a] : [1, 0.75, 0.45, 0.16 * a], stroke: h ? [0.95, 0.6, 0.45, a] : [1, 0.8, 0.55, 0.85 * a], width: 2.5, blend: "add" },
        { shape: words(s, A.mono, size, x + w / 2, y + size * 0.36, "center"), fill: h ? INK.ember : INK.night, opacity: a });
      x += w + 6; i++;
    }
    x += gap;
  }
  return { items: out, right: x };
}
export const lab = (A, s, size, x, y, fill = INK.night, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
