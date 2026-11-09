// The next-word lab, drawn at Tallow's wheel: the model's spread for the word after the chosen
// position (one slot per word), the rules' own odds as a ring when the text follows the rules, the
// word that came in ember, and the text across the top with each word's surprise. Pure in state.
import { rect, words } from "../../media/school/shared/lib.mjs";
import { room, host } from "../../media/school/embeddings/scene/segs.mjs";
import { WHEEL, INK, wheel, pointer, ring, lab, plateRect } from "../../media/school/nextword/scene/wheel.mjs";

const byShare = (d) => Array.from(d, (p, i) => [p, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);
const pick = (d, o) => o.map((i) => d[i]);

export function frame(s, A, t) {
  const items = [...room(t, 0.4)];
  if (!s.words.length) items.push(lab(A, "type a few words from the guides' sentences", 28, 700, 520));
  else {
    const at = { x: 1240, y: 600, r: 300 }, o = byShare(s.model), next = s.words[s.pos + 1], k = next === undefined ? -1 : o.indexOf(s.vocab.indexOf(next));
    items.push(...wheel(A, pick(s.model, o), pick(s.vocab, o), { at, hot: (i) => i === k, pct: (i) => i < 3 || i === k }), ...pointer(at));
    if (s.truth) items.push(...ring(A, pick(s.truth, o), pick(s.vocab, o), { at, label: "the rules" }));
    // The text, one tile per word: the chosen position outlined, each later word tinted by its surprise.
    let x = 120;
    s.words.forEach((w, i) => {
      const wd = w.length * 13 + 26, sur = i > 0 ? s.surprise[i - 1] : null, heat = sur === null ? 0 : Math.min(1, sur / 4);
      items.push({ shape: rect(x, 60, wd, 40, 4), fill: [0.89 - 0.1 * heat, 0.84 - 0.35 * heat, 0.71 - 0.4 * heat, 1], stroke: i === s.pos ? "#e29472" : "#2a2219", width: i === s.pos ? 4 : 1, screen: true },
        { shape: words(w, A.sans, 22, x + wd / 2, 88, "center"), fill: INK.ink, screen: true });
      x += wd + 6;
      if (x > 1760) x = 1760;
    });
    items.push(plateRect(100, 116, 900, 50, 0.6), lab(A, s.line, 24, 120, 150, INK.night));
  }
  return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items: [...items, ...host(t, { rows: [] })],
    post: { bloom: 0.2, threshold: 1, vignette: 0.12, grain: 0, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
}
