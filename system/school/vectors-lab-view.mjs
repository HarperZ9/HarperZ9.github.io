// The vectors lab, drawn: Pylon's chart with two crates the reader drags (the dot product, lengths
// and cosine computed from where they sit), or the word table on the flat chart, with the chosen
// word's nearest neighbours in all 32 directions. A Motion display list; pure in (state, time).
import { rect, circle, polyline, words } from "../../media/school/shared/lib.mjs";
import { K, P, desk, paper, vec, arc, rightMark, crate, pylon } from "../../media/school/vectors/scene/chart.mjs";

const f2 = (v) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));
const panel = (A, lines, x = 360, y = 36, w = 1040) => [{ shape: rect(x, y, w, 30 + 52 * lines.length, 10), fill: [0.06, 0.045, 0.03, 0.88], screen: true },
  ...lines.map(([s, size = 32, fill = K.night], i) => ({ shape: words(s, A.mono, size, x + 24, y + 56 + i * 52), fill, screen: true }))];

function chartView(s, A, t) {
  const items = [...desk(t), ...paper(A)], { a, b, m } = s;
  const aa = Math.atan2(a[1], a[0]), ab = Math.atan2(b[1], b[0]);
  if (m.la > 0 && m.lb > 0) items.push(arc(aa, ab, Math.min(1.1, 0.4 * Math.min(m.la, m.lb)), K.rust, 4));
  if (m.la > 0 && m.lb > 0 && Math.abs(m.cos) < 0.005) items.push(rightMark(aa, 0.4, K.rust));
  items.push(...vec(a, K.ink, 7), ...vec(b, K.rust, 7));
  items.push(...crate(A, a, { label: "a", lift: s.drag === "a" ? 0.5 : 0 }), ...crate(A, b, { label: "b", colour: "#9a5a3a", lift: s.drag === "b" ? 0.5 : 0 }));
  items.push(...panel(A, [[`a = (${f2(a[0])}, ${f2(a[1])})    b = (${f2(b[0])}, ${f2(b[1])})`, 28, K.nightDim],
    [`a . b = ${f2(a[0])} x ${f2(b[0])} + ${f2(a[1])} x ${f2(b[1])} = ${f2(m.dot)}`, 32],
    [`length a = ${f2(m.la)}   length b = ${f2(m.lb)}   cosine = ${m.la > 0 && m.lb > 0 ? f2(m.cos) : "none (a zero list has no direction)"}`, 30, K.ember]]));
  items.push(...pylon(t, 1745, 1015, 0.52, { look: [-8, -3] }));
  return items;
}

// The word table on the flat chart: dots at their two principal coordinates; lines from the
// chosen word to its nearest neighbours by cosine in all 32 directions.
function wordView(s, A, t) {
  const items = [...desk(t), ...paper(A, { grid: 0, axes: 0 })], W = s.words, pos = s.flat, i = s.word;
  for (const n of s.near) {
    const [x0, y0] = pos[i], [x1, y1] = pos[n.index];
    items.push({ shape: polyline([x0, y0, x1, y1]), fill: null, stroke: [0.65, 0.27, 0.16, 0.75], width: 3 });
    items.push({ shape: words(f2(n.score), A.mono, 22, (x0 + x1) / 2 + 6, (y0 + y1) / 2 - 6), fill: K.rust });
  }
  W.forEach((w, j) => {
    const hot = j === i, near = s.near.some((n) => n.index === j);
    items.push({ shape: circle(...pos[j], hot ? 9 : 5, 12), fill: hot ? K.rust : K.ink }, { shape: words(w, A.sans, hot ? 32 : near ? 26 : 22, pos[j][0] + 10, pos[j][1] - 8), fill: hot ? K.rust : near ? K.ink : K.dim });
  });
  const tbl = { trained: "the trained table", shuffled: "the lists shuffled between words (control)", start: "the table before training (control)" }[s.table];
  items.push(...panel(A, [[`${tbl}: same-kind nearest neighbour for ${Math.round(s.share * 100)}% of the ${W.length} words`, 28],
    [`nearest to "${W[i]}" in all 32 directions: ${s.near.map((n) => n.word).join(", ")}`, 28, K.ember]], 360, 36, 1180));
  items.push({ shape: words("flat chart: the two directions that keep the most spread; lines and cosines use all 32", A.mono, 22, 960, 1005, "center"), fill: K.night, screen: true });
  items.push(...pylon(t, 1745, 1015, 0.52, { look: [-8, -3] }));
  return items;
}

export function frame(s, A, t) {
  return { background: [0.02, 0.016, 0.012], camera: { x: 960, y: 540, zoom: 1 }, items: s.mode === "words" ? wordView(s, A, t) : chartView(s, A, t),
    post: { bloom: 0.12, threshold: 1.0, vignette: 0.4, grain: 0, passes: [] } };
}
