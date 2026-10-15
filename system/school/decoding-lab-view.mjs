// The decoding lab, drawn at Tallow's wheel: the next-word wheel after the prompt, cut by the chosen
// setting; the runs spun so far as ribbons, each with the first word the rules cannot explain in
// ember; and the tally of a batch. Pure in state.
import { room, host } from "../../media/school/embeddings/scene/segs.mjs";
import { INK, wheel, pointer, ribbon, lab, plateRect } from "../../media/school/nextword/scene/wheel.mjs";

const byShare = (d) => Array.from(d, (p, i) => [p, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);
const pick = (d, o) => o.map((i) => d[i]);

export function frame(s, A, t) {
  const at = { x: 1300, y: 420, r: 260 }, o = byShare(s.base), items = [...room(t, 0.4)];
  items.push(...wheel(A, pick(s.dist, o), pick(s.vocab, o), { at, turn: s.turn, pct: (k) => k < 3, size: 24 }), ...pointer(at));
  items.push(plateRect(100, 40, 900, 54, 0.6), lab(A, `${s.setting}: ${s.kept} of ${s.vocab.length} words keep a slot`, 24, 120, 76, INK.night));
  s.runs.slice(-2).forEach((r, i) => items.push(...ribbon(A, r.words, t, -1e9, { x: 560, y: 740 + i * 105, w: 1300, size: 18, hot: (j) => j === r.failAt })));
  if (s.tally) items.push(plateRect(540, 960, 1320, 56, 0.6), lab(A, s.tally, 24, 560, 996, INK.night));
  return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items: [...items, ...host(t, { rows: [] })],
    post: { bloom: 0.2, threshold: 1, vignette: 0.12, grain: 0, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
}
