// The embeddings lab, drawn in Tallow's lamp room: the reader's own skip-gram run, its cards at the
// chosen snapshot on the final table's axes, the chosen word in ember with lines to its nearest
// neighbours (by cosine in all dimensions), and the same-kind share with its shuffle band.
import { polyline, words, rect } from "../../media/school/shared/lib.mjs";
import { room, cards, host } from "../../media/school/embeddings/scene/segs.mjs";

const lab = (A, s, size, x, y, fill = "#ece5d6") => ({ shape: words(s, A.mono, size, x, y), fill, screen: true });
export function frame(s, A, t) {
  const items = [...room(t, 0.6)];
  if (!s.snaps.length) items.push(lab(A, "choose the settings and press Train", 28, 700, 520));
  else {
    const S = s.snaps[s.at], P = S.track, k = s.word;
    for (const n of S.near) items.push({ shape: polyline([...P[k], ...P[n.index]]), fill: null, stroke: [0.89, 0.58, 0.45, 0.8], width: 3 });
    items.push(...cards(A, s, P, t, { hot: (i) => i === k }));
    items.push(...cards(A, { words: [s.words[k]] }, [P[k]], t, { hot: () => true })); // the chosen card again, on top
    items.push({ shape: rect(620, 30, 1260, 120, 10), fill: [0.03, 0.03, 0.04, 0.8], screen: true },
      lab(A, `${Math.round(S.fraction * 100)}% of training: same-kind neighbours ${Math.round(S.share * 100)}% (shuffled: about ${Math.round(s.control * 100)}%)`, 26, 640, 76),
      lab(A, `nearest to "${s.words[k]}": ${S.near.map((n) => `${s.words[n.index]} ${n.score.toFixed(2)}`).join(", ")}`, 24, 640, 116, "#e29472"));
    // Early tables are tiny; the chart magnifies them (as the film does) and says by how much.
    if (P.zoom > 1.5) items.push(lab(A, `drawn ${Math.round(P.zoom)} times larger: the numbers are still tiny`, 22, 640, 1040, "#9a9384"));
  }
  return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items: [...items, ...host(t, { rows: [] })],
    post: { bloom: 0.2, threshold: 1, vignette: 0.12, grain: 0, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
}
