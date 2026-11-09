// The receipts film's segments (lesson E25) at the tide line (PROGRESS.md, step 72): the fifty rows
// as beads, a tree of threads from beads to one knot (the receipt's tree of hashes), and a ledger card
// of stated against recomputed fingerprints. Every value drawn is a facts.json value (F); timings from
// the cue map in film.scene.mjs (T).
import { rect, circle, polyline, words, label, C } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, span } from "../../errorbars/scene/tide.mjs";

const EMBER = [0.89, 0.58, 0.45], PAPER = [0.9, 0.86, 0.75], DARK = [0.4, 0.38, 0.35];
// Sixteen beads tied by a binary tree to one knot. ok(i): bead i right or wrong; hot(i): its path lit.
export function tree(A, ok, hot = () => false, a = 1, { x0 = 560, y0 = 780, dx = 72, knotHot = null } = {}) {
  const out = [], n = 16, X = (i) => x0 + i * dx;
  for (let i = 0; i < n; i++) out.push({ shape: circle(X(i), y0, 16, 24), fill: hot(i) ? [...EMBER, a] : ok(i) ? [...PAPER, a] : [...DARK, a] });
  let level = Array.from({ length: n }, (_, i) => [X(i), y0, hot(i)]), y = y0;
  while (level.length > 1) { const next = []; y -= 105;
    for (let k = 0; k < level.length; k += 2) { const [p, q] = [level[k], level[k + 1]], x = (p[0] + q[0]) / 2, h = p[2] || q[2];
      for (const r of [p, q]) out.push({ shape: polyline([r[0], r[1] - 16, x, y + 12]), fill: null, stroke: h ? [...EMBER, a] : [0.8, 0.76, 0.66, 0.7 * a], width: 3 });
      next.push([x, y, h]); }
    level = next; }
  const kh = knotHot ?? level[0][2];
  out.push({ shape: circle(level[0][0], y, 24, 32), fill: kh ? [...EMBER, a] : [...PAPER, a] });
  return { items: out, knot: [level[0][0], y] };
}
// Fifty beads in five rows of ten; lit(i) in 0..1 shows the count reaching bead i.
export function grid(rows, x, y, lit = () => 1, a = 1, hot = () => false) {
  return rows.map((ok, i) => ({ shape: circle(x + (i % 10) * 46, y + Math.floor(i / 10) * 46, 16, 24), fill: hot(i) ? [...EMBER, a] : ok ? [...PAPER, a * (0.35 + 0.65 * lit(i))] : [...DARK, a] }));
}
// A ledger card: rows of [name, stated, recomputed]; k: characters compared so far.
export function ledger(A, rows, x, y, k, a = 1) {
  const out = [{ shape: rect(x, y, 1220, 90 + rows.length * 110, 10), fill: [...PAPER, 0.95 * a], screen: true }];
  rows.forEach(([n, s, r], i) => { const yy = y + 70 + i * 110;
    out.push({ shape: words(n, A.mono, 20, x + 30, yy - 12), fill: "#5a5046", opacity: a, screen: true }, { shape: words(s.slice(0, 32), A.mono, 24, x + 30, yy + 20), fill: "#1d1812", opacity: a, screen: true });
    const shown = r.slice(0, Math.min(32, k)), same = shown === s.slice(0, shown.length);
    out.push({ shape: words(shown, A.mono, 24, x + 30, yy + 52), fill: same ? "#2f5d3a" : "#b5482e", opacity: a, screen: true }); });
  return out;
}
const open16 = (F) => (i) => F.film.rows[i + 8];
export function open(t, A, T, F) { return scene(t, A, [...beach(t), ...tree(A, open16(F), () => false, span(t, 0.5, 2.5)).items]); }
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...beach(t), ...tree(A, open16(F), () => false, 0.35).items, label(A, "A score that carries its receipt", 80, 960, 160, C.ink, "center", a, "head")]);
}
// The claim: fifty rows and the receipt's parts, appearing as the line names them.
export function claim(t, A, T, F) {
  const R = F.receipt, items = [...beach(t), plate(560, 160, 1260, 640, 0.6), ...grid(F.film.rows, 640, 300, () => 1, span(t, T.start + 0.5, T.start + 1.5))];
  items.push(lab(A, "one row per question; pale: right, dark: wrong", 20, 620, 240, INK.dim, "left", span(t, T.start + 0.5, T.start + 1.5)));
  if (t >= T.result) items.push(lab(A, `the result: ${R.correct} of ${R.total}`, 30, 640, 600, INK.night, "left", span(t, T.result, T.result + 0.8)));
  const parts = [["hash of the rows", R.resultsSha256], ["tree of hashes over every row", R.itemsRoot.replace("sha256:", "")], ["hash of the approved job", R.approvedHash], ["signed by key", R.keyId.replace("ed25519:", "")]];
  parts.forEach(([n, h], i) => { const a = span(t, T.receipt + i * 0.7, T.receipt + i * 0.7 + 0.8);
    items.push(lab(A, n, 20, 1180, 300 + i * 70, INK.dim, "left", a), lab(A, h.slice(0, 24), 20, 1180, 326 + i * 70, INK.night, "left", a)); });
  return scene(t, A, items);
}
// Check it yourself: the count lights the right rows, then the ledger compares fingerprints.
export function rederive(t, A, T, F) {
  const f = F.reproduce.fields, items = [...beach(t)];
  if (t < T.recompute) { let n = 0; const order = F.film.rows.map((ok, i) => (ok ? ++n : 0)), u = span(t, T.count, T.count + 3) * F.rederive.correct;
    items.push(plate(560, 160, 1260, 560, 0.6), ...grid(F.film.rows, 640, 300, (i) => (order[i] && order[i] <= u ? 1 : 0)), lab(A, `counted: ${Math.round(Math.min(u, F.rederive.correct))} of ${F.rederive.total}`, 30, 1180, 400, INK.night, "left", span(t, T.count, T.count + 0.6))); }
  else items.push(...ledger(A, [["hash of the rows", f.results_sha256.stated, f.results_sha256.recomputed], ["tree of hashes", f.items_root.stated.replace("sha256:", ""), f.items_root.recomputed.replace("sha256:", "")], ["receipt id", f.receipt_id.stated, f.receipt_id.recomputed]], 600, 180, Math.floor(span(t, T.recompute, T.recompute + 3) * 32)),
    lab(A, F.reproduce.allSame ? "stated (top), recomputed in this page (below): the same" : "", 20, 620, 560, INK.dim, "left", span(t, T.recompute + 3, T.recompute + 4)));
  return scene(t, A, items);
}
// One byte at a time: per file, the bytes flipped and how many the verifier caught.
export function tamper(t, A, T, F) {
  const M = F.film, items = [...beach(t), plate(560, 160, 1260, 600, 0.6), lab(A, `${M.tampers.toLocaleString("en")} copies, each with one byte flipped`, 20, 620, 230, INK.dim, "left", span(t, T.start, T.start + 1))];
  [["the rows", M.results, Math.max(T.rows, T.ask.held)], ["the receipt", M.receipt, T.receipt], ["the permissions file", M.permissions, T.perm]].forEach(([n, r, at], i) => { const a = span(t, at, at + 0.8), y = 330 + i * 140, w = 900;
    const g = Math.max(a, 0.35 * span(t, T.start, T.start + 1));
    items.push(lab(A, n, 22, 640, y - 16, INK.night, "left", g), { shape: rect(640, y, w, 34, 4), fill: [0.3, 0.27, 0.24, g], screen: true }, { shape: rect(640, y, (w * r.caught / r.bytes) * span(t, at, at + 1.5), 34, 4), fill: [...PAPER, a], screen: true },
      lab(A, `${r.caught.toLocaleString("en")} of ${r.bytes.toLocaleString("en")} caught`, 20, 640 + w + 20, y + 26, r.caught === r.bytes ? INK.night : INK.ember, "left", a)); });
  return scene(t, A, items);
}
