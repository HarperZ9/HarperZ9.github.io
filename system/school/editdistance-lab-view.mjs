// The edit-distance lab, drawn at Rerun's tide line: the table filled so far (the last square in ember,
// its three neighbours lit), the traced path once the corner is filled, and the alignment as letter
// tiles below. Pure in state.
import { rect } from "../../media/school/shared/lib.mjs";
import { lab, plate, beach, scene, INK } from "../../media/school/errorbars/scene/tide.mjs";
import { tiles } from "../../media/school/editdistance/scene/segs.mjs";

function pathCells(st) {
  const w = st.n + 1, out = new Set(); let i = st.m, j = st.n;
  while (i > 0 || j > 0) { out.add(i * w + j); const op = st.choice[i * w + j]; if (op === 3) i--; else if (op === 4) j--; else { i--; j--; } }
  out.add(0);
  return out;
}
export function frame(s, A, t) {
  const items = [...beach(t), plate(600, 60, 1240, 900, 0.6)], st = s.st;
  if (!st) { items.push(lab(A, "type two strings and press Fill the table", 24, 660, 400, INK.night)); return { background: [0.012, 0.011, 0.014], ...scene(t, A, items), post: { bloom: 0.12, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } }; }
  const w = st.n + 1, c = Math.min(46, Math.floor(Math.min(1100 / (st.n + 2), 620 / (st.m + 2)))), x0 = 660 + c, y0 = 100 + c, path = st.done ? pathCells(st) : new Set(), k = st.filled - 1;
  for (let i = 0; i <= st.m; i++) for (let j = 0; j <= st.n; j++) { const idx = i * w + j, v = st.D[idx], last = idx === k && !st.done, nb = !st.done && ((i === st.i - 1 && (j === st.j || j === st.j - 1)) || (i === st.i && j === st.j - 1));
    items.push({ shape: rect(x0 + j * c, y0 + i * c, c - 3, c - 3, 3), fill: path.has(idx) ? [0.89, 0.58, 0.45, 1] : last ? [0.89, 0.58, 0.45, 0.8] : nb ? [0.42, 0.39, 0.35, 1] : v >= 0 ? [0.24, 0.22, 0.2, 1] : [0.11, 0.1, 0.09, 1], screen: true });
    if (v >= 0) items.push(lab(A, String(v), Math.round(c * 0.4), x0 + j * c + c / 2 - 2, y0 + i * c + c * 0.64, INK.night, "center")); }
  [...st.a].forEach((ch, i) => items.push(lab(A, ch === " " ? "_" : ch, Math.round(c * 0.4), x0 - c * 0.5, y0 + (i + 1) * c + c * 0.64, INK.dim, "center")));
  [...st.b].forEach((ch, j) => items.push(lab(A, ch === " " ? "_" : ch, Math.round(c * 0.4), x0 + (j + 1) * c + c / 2 - 2, y0 - c * 0.25, INK.dim, "center")));
  if (s.align) { const tw = Math.min(40, Math.floor(1100 / s.align.top.length)); items.push(...tiles(A, s.align.top, 660, 820, (i) => s.align.marks[i] !== " ", 1, tw), ...tiles(A, s.align.bottom, 660, 880, (i) => s.align.marks[i] !== " ", 1, tw)); }
  return { background: [0.012, 0.011, 0.014], ...scene(t, A, items), post: { bloom: 0.12, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
}
