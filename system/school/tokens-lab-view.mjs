// The tokens lab, drawn: the reader's text cut into crates on the shed's belts, with the merge count,
// pieces per word and any pieces with no crate (unknown) in ember. A display list; pure in state.
import { pylon } from "../../media/school/vectors/scene/chart.mjs";
import { shed, belt, crates, lab, INK } from "../../media/school/tokens/scene/shed.mjs";

export function frame(s, A, t) {
  const items = [...shed(t)], rows = [], perRow = 1600;
  let row = [], width = 0;
  s.pieces.forEach((ps) => { const w = ps.reduce((a, p) => a + p.length * 32 * 0.62 + 34, 0) + 26; if (width + w > perRow && row.length) { rows.push(row); row = []; width = 0; } row.push(ps); width += w; });
  if (row.length) rows.push(row);
  rows.slice(0, 6).forEach((r, i) => { const y = 230 + i * 130; items.push(...belt(y, t), ...crates(A, r, 130, y, { size: 32, hot: (_, p) => s.unknown.has(p) }).items); });
  if (rows.length > 6) items.push(lab(A, `... ${rows.length - 6} more rows`, 22, 130, 1020, INK.dim));
  items.push(lab(A, `${s.source}, ${s.upto} of ${s.max} merges${s.bytes ? ", bytes as the base" : ""}: ${s.nPieces} pieces for ${s.nWords} words (${(s.nPieces / Math.max(1, s.nWords)).toFixed(2)} per word)${s.unknownCount ? `, ${s.unknownCount} with no crate` : ""}`, 26, 130, 120, INK.night));
  items.push(...pylon(t, 1780, 1030, 0.42));
  return { background: [0.02, 0.022, 0.03], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.3, threshold: 1, vignette: 0.32, grain: 0, passes: [] } };
}
