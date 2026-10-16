// The error-bars film's later segments (lesson E23): what to draw again (coverage by unit), two
// models on the same rows (paired against unpaired), the seeds the rows cannot see, and the close.
// Every value drawn is a facts.json value (F).
import { rect, circle } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, thePrism, beads, span } from "./tide.mjs";

// Coverage bars: the share of intervals that held the truth, with the promised 95 percent marked.
function bars(A, rows, t) {
  const X0 = 1040, W = 700, out = [plate(640, 220, 1220, 120 + rows.length * 100, 0.6), { shape: rect(X0 + W * 0.95 - 1, 240, 3, rows.length * 100 + 20), fill: [0.7, 0.82, 0.95, 0.8], screen: true }, lab(A, "95% promised", 20, X0 + W * 0.95, 232, [0.7, 0.82, 0.95], "center")];
  rows.forEach((r, i) => {
    const y = 270 + i * 100, a = span(t, r.at, r.at + 0.8);
    out.push(lab(A, r.name, 22, 680, y + 22, INK.night, "left", a));
    if (a > 0) out.push({ shape: rect(X0, y, W * r.v * a, 30, 3), fill: r.hot ? [0.89, 0.58, 0.45, 1] : [0.9, 0.86, 0.75, 0.9], screen: true }, lab(A, `${(r.v * 100).toFixed(1)}%`, 22, X0 + W * r.v * a + 14, y + 22, INK.night, "left", a));
  });
  return out;
}
export function unit(t, A, T, F) {
  const R = F.coverage.runs, rows = [{ name: "64 rows, resampling rows", v: R.rows64.rowPct.coverage, at: T.start + 1 }, { name: "64 rows, resampling single words", v: R.rows64.wordPct.coverage, at: T.words },
    { name: "16 rows copied 4 times, as 64", v: R.rows16x4.rowPct.coverage, at: T.naive, hot: true }, { name: "the same, resampling the 16", v: R.rows16x4.clusterPct.coverage, at: T.distinct }];
  return scene(t, A, [...beach(t), ...thePrism(0.4), lab(A, "how often the interval held the truth, of 1,000 trials", 22, 680, 200, INK.dim), ...bars(A, rows, t)]);
}

// Paired against unpaired: two bead piles for the difference, on one scale, with zero marked.
export function paired(t, A, T, F) {
  const P = F.film.pairedVsUnpaired, n = P.paired.counts.length, X = (b) => 820 + (b + 0.5) * (980 / n), V = (v) => 820 + ((v - P.paired.lo) / (P.paired.hi - P.paired.lo)) * 980, at = F.paired.at1024;
  const items = [...beach(t), ...thePrism(0.5), { shape: rect(V(0) - 1, 180, 3, 620), fill: [0.7, 0.82, 0.95, 0.8], screen: true }, lab(A, "zero", 22, V(0), 170, [0.7, 0.82, 0.95], "center")];
  if (t >= T.paired) items.push(...beads(P.paired.counts, X, span(t, T.paired, T.paired + 4), { base: 470, r: 4, per: 8, maxH: 260 }), lab(A, `kept in pairs: ${at.pairedPct.lo.toFixed(4)} to ${at.pairedPct.hi.toFixed(4)}`, 22, 820, 520, INK.ember, "left", span(t, T.paired + 3, T.paired + 4)));
  if (t >= T.unpaired) items.push(...beads(P.unpaired.counts, X, span(t, T.unpaired, T.unpaired + 4), { base: 790, r: 4, per: 8, maxH: 220 }), lab(A, `each on its own: ${at.unpairedPct.lo.toFixed(4)} to ${at.unpairedPct.hi.toFixed(4)}`, 22, 820, 840, INK.night, "left", span(t, T.unpaired + 3, T.unpaired + 4)));
  if (t >= T.diff) items.push(lab(A, `difference on ${at.n.toLocaleString("en")} rows: ${at.diff.toFixed(4)}`, 24, 820, 120, INK.night, "left", span(t, T.diff, T.diff + 0.8)));
  return scene(t, A, items);
}

// Seeds: five runs of each student as dots, beside the tiny interval the rows gave one run.
export function seeds(t, A, T, F) {
  const S = F.seeds, X = (v) => 760 + ((v - 0.66) / 0.13) * 1050, items = [...beach(t), ...thePrism(0.4), plate(700, 220, 1160, 420, 0.6)];
  [["hard", "taught by the text"], ["soft1", "taught by the teacher"]].forEach(([k, name], i) => {
    const y = 330 + i * 160, r = S[k].rowPct1024, a = span(t, T.start + 1 + i, T.start + 2 + i);
    items.push(lab(A, name, 22, 740, y - 40, INK.night, "left", a), { shape: rect(X(r.lo), y - 3, X(r.hi) - X(r.lo), 6, 2), fill: [0.89, 0.58, 0.45, a], screen: true });
    S[k].values.forEach((v, j) => { const b = span(t, T.five + j * 0.4, T.five + j * 0.4 + 0.6); if (b > 0) items.push({ shape: circle(X(v), y + 40, 10, 16), fill: [0.9, 0.86, 0.75, b], screen: true }); });
  });
  items.push(lab(A, "ember: the rows' interval for one run; dots: five seeds", 20, 740, 610, INK.dim));
  if (t >= T.diffs) items.push(lab(A, `difference, seed by seed: ${S.difference.values.map((v) => v.toFixed(4)).join(", ")}`, 22, 740, 700, INK.night, "left", span(t, T.diffs, T.diffs + 0.8)));
  return scene(t, A, items);
}

export function close(t, A, T, F) {
  const H = F.film.bootstrap64, n = H.row.counts.length, X = (b) => 960 + (b + 0.5) * (840 / n), dim = span(t, T.night, T.end);
  return scene(t, A, [...beach(t), ...thePrism(1 - dim), ...beads(H.row.counts, X, 1 - 0.8 * dim, { rays: false })], { knock: T.end - 2 });
}
