// The error-bars film's segments (lesson E23) at the tide line: one score enters the prism, every
// resample leaves it as a ray and lands as a bead; the beads' middle 95 percent is the interval.
// Every value drawn is a facts.json value (F); timings from the cue map in film.scene.mjs (T).
import { rect, circle, polyline, label, C } from "../../shared/lib.mjs";
import { INK, PRISM, lab, plate, beach, scene, thePrism, beads, bracket, span } from "./tide.mjs";

const pct = (v) => `${Math.round(v * 100)}%`;
const hist = (H, x0 = 960, w = 840) => { const n = H.row.counts.length, bw = w / n;
  return { X: (b) => x0 + (b + 0.5) * bw, V: (v) => x0 + ((v - H.row.lo) / (H.row.hi - H.row.lo)) * w }; };

export function open(t, A, T, F) {
  const lit = span(t, 0.8, 1.8);
  return scene(t, A, [...beach(t), ...thePrism(lit)]);
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...beach(t), ...thePrism(0.6), label(A, "Error bars", 92, 960, 120, C.ink, "center", a, "head"), label(A, "how sure is the number", 34, 960, 172, INK.dim, "center", span(t, T.sub, T.sub + 0.6) * a)]);
}

// One number: a single beam of the score into the prism.
export function one(t, A, T, F) {
  const a = span(t, T.score, T.score + 1), items = [...beach(t), ...thePrism(0.3)];
  items.push({ shape: polyline([120, PRISM.y, 120 + (PRISM.x - 180) * a, PRISM.y]), fill: null, stroke: [1, 0.95, 0.85, 0.9], width: 6 },
    lab(A, `loss ${F.items.loss.toFixed(4)} on ${F.items.rows.toLocaleString("en")} rows`, 28, 130, PRISM.y - 30, INK.night, "left", a),
    lab(A, `${pct(F.items.accuracy)} of next words right`, 24, 130, PRISM.y + 50, INK.dim, "left", a));
  if (t >= T.draw) items.push(lab(A, "another draw of rows: another number", 26, 1000, 300, INK.night, "left", span(t, T.draw, T.draw + 0.8)));
  return scene(t, A, items);
}

// The bootstrap on 64 rows: rays to beads, then the middle 95 percent.
export function bootstrap(t, A, T, F) {
  const H = F.film.bootstrap64, { X, V } = hist(H), u = span(t, T.resample, T.spread + 2), I = H.rowInterval, items = [...beach(t), ...thePrism(Math.min(1, u * 3))];
  items.push({ shape: polyline([120, PRISM.y, PRISM.x - 60, PRISM.y]), fill: null, stroke: [1, 0.95, 0.85, 0.9], width: 6 }, lab(A, `64 rows: ${H.point.toFixed(4)}`, 26, 130, PRISM.y - 30));
  items.push(...beads(H.row.counts, X, u));
  if (t >= T.interval) items.push(...bracket(A, V, I.lo, I.hi, `middle 95%: ${I.lo.toFixed(4)} to ${I.hi.toFixed(4)}`, span(t, T.interval, T.interval + 0.8)));
  if (t >= T.resample && t < T.interval) items.push(lab(A, `resamples: ${Math.round(u * H.row.counts.reduce((x, y) => x + y, 0)).toLocaleString("en")}`, 24, 1000, 300, INK.dim, "left", 1));
  return scene(t, A, items, { knock: T.resample - 0.6 });
}

// Narrower with more rows: the interval at 16, 64, 256 and 1,024 rows on one scale.
export function shrink(t, A, T, F) {
  const at = F.widths.at, X = (v) => 700 + ((v - 0.58) / 0.16) * 1100, items = [...beach(t), ...thePrism(0.4), plate(640, 200, 1220, 560, 0.6)];
  ["16", "64", "256", "1024"].forEach((n, i) => {
    const r = at[n].loss.rowPct, y = 300 + i * 110, a = span(t, T.start + i * 0.9, T.start + i * 0.9 + 0.8);
    items.push({ shape: rect(X(r.lo), y, X(r.hi) - X(r.lo), 14, 4), fill: [0.89, 0.58, 0.45, a], screen: true }, { shape: circle(X(at[n].loss.score), y + 7, 7, 12), fill: [0.95, 0.9, 0.8, a], screen: true },
      lab(A, `${Number(n).toLocaleString("en")} rows`, 24, 680, y + 14, INK.night, "left", a), lab(A, `width ${r.width.toFixed(4)}`, 22, X(r.hi) + 16, y + 14, INK.dim, "left", a));
  });
  if (t >= T.avg) { const R = F.coverage.runs; items.push(lab(A, `averaged over 1,000 draws: ${R.rows16.rowPct.meanWidth.toFixed(4)}, ${R.rows64.rowPct.meanWidth.toFixed(4)}, ${R.rows256.rowPct.meanWidth.toFixed(4)}`, 24, 680, 730, INK.night, "left", span(t, T.avg, T.avg + 0.8))); }
  return scene(t, A, items);
}

// Does it work: fifty of the thousand intervals against the known truth; misses in ember.
export function truth(t, A, T, F) {
  const Cv = F.film.coverage64, X = (v) => 760 + ((v - 0.55) / 0.17) * 1050, n = Math.floor(span(t, T.draw, T.answer) * Cv.trials.length), items = [...beach(t), ...thePrism(0.4), plate(700, 120, 1160, 680, 0.6)];
  if (t >= T.truth) items.push({ shape: rect(X(Cv.truth) - 1.5, 140, 3, 640), fill: [0.7, 0.82, 0.95, span(t, T.truth, T.truth + 0.8)], screen: true }, lab(A, `the truth: ${Cv.truth.toFixed(4)}`, 22, X(Cv.truth), 805, [0.7, 0.82, 0.95], "center", span(t, T.truth, T.truth + 0.8)));
  Cv.trials.slice(0, n).forEach((r, i) => items.push({ shape: rect(X(r.row[0]), 150 + i * 12.5, X(r.row[1]) - X(r.row[0]), 6, 2), fill: r.row[2] ? [0.9, 0.86, 0.75, 0.9] : [0.89, 0.58, 0.45, 1], screen: true }));
  if (t >= T.answer) { const R = F.coverage.runs; items.push(lab(A, `of 1,000: ${(R.rows64.rowPct.coverage * 100).toFixed(1)}% hold it (64 rows); ${(R.rows256.rowPct.coverage * 100).toFixed(1)}% (256 rows)`, 24, 740, 860, INK.night, "left", span(t, T.answer, T.answer + 0.8))); }
  return scene(t, A, items, { read: span(t, T.draw, T.draw + 1) });
}
