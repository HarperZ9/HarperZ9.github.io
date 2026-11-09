// The receipts film's later segments (lesson E25): two rows trade marks and the tree catches it; a
// signed lie rebuilds the whole tree and only the revealed answer or a trusted key catch it; the
// verifier's unchecked identifier; and the close. Every value drawn is a facts.json value (F).
import { rect } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, span } from "../../errorbars/scene/tide.mjs";
import { tree } from "./segs.mjs";

// The tree shows sixteen of the fifty rows, q008 to q023, so it holds the first wrong rows (q016, q017).
const OFF = 8, ok16 = (F) => (i) => F.film.rows[i + OFF];
// Two rows trade marks (the receipt's control swaps q000 and q016; the tree shows q008 and q016).
export function swap(t, A, T, F) {
  const w = F.film.rows.slice(OFF, OFF + 16).findIndex((r) => !r), done = t >= T.swap, base = ok16(F);
  const ok = (i) => (done && (i === 0 || i === w) ? !base(i) : base(i)), hot = (i) => t >= T.caught && (i === 0 || i === w);
  const items = [...beach(t), ...tree(A, ok, hot).items, lab(A, `the count: still ${F.rederive.correct} of ${F.rederive.total}`, 26, 560, 220, INK.night, "left", span(t, T.count, T.count + 0.8))];
  if (t >= T.caught) items.push(lab(A, "the rows' hash and the tree: changed", 24, 1200, 220, INK.ember, "left", span(t, T.caught, T.caught + 0.8)));
  return scene(t, A, items);
}
// The signed lie: one wrong bead turns right and the tree is rebuilt, so the knot matches its new
// signature. Then the two checks that can catch it.
export function cheater(t, A, T, F) {
  const C = F.film.cheat, k = Number(C.id.slice(1)) - OFF, lie = t >= T.lie, base = ok16(F);
  const items = [...beach(t), ...tree(A, (i) => (lie && i === k ? true : base(i)), (i) => lie && i === k && t < T.rebuilt, 1, { knotHot: lie && t < T.rebuilt }).items];
  if (t >= T.rebuilt) items.push(lab(A, "rebuilt and signed again: every hash check passes", 22, 560, 200, INK.night, "left", span(t, T.rebuilt, T.rebuilt + 0.8)));
  if (t >= T.trusted) items.push(lab(A, "insist on the key trusted before: the signature check fails", 22, 560, 240, INK.ember, "left", span(t, T.trusted, T.trusted + 0.8)));
  if (t >= T.reveal) items.push(lab(A, `the liar holds the trusted key: only the answer catches it. ${C.id}: said ${C.prediction}, answer ${C.answer}`, 22, 560, 280, INK.ember, "left", span(t, T.reveal, T.reveal + 0.8)));
  if (t >= T.proves) items.push(plate(560, 860, 1260, 70, 0.7), lab(A, "a receipt proves the bytes are unchanged and which key signed them; not that the rows were true", 20, 590, 902, INK.night, "left", span(t, T.proves, T.proves + 0.8)));
  return scene(t, A, items);
}
export function found(t, A, T, F) {
  const f = F.reproduce.fields.receipt_id, items = [...beach(t), { shape: rect(600, 240, 1180, 380, 10), fill: [0.9, 0.86, 0.75, 0.95], screen: true }];
  items.push(lab(A, "receipt id", 22, 640, 310, "#5a5046"), lab(A, f.stated.slice(0, 32), 26, 640, 350, "#1d1812"));
  items.push(lab(A, "Flywheel's verifier: never recomputed", 28, 640, 450, "#8f2f1a", "left", span(t, T.never, T.never + 0.8)), lab(A, `this page: recomputed, ${f.same ? "the same" : "different"}`, 28, 640, 520, "#1f4a2a", "left", span(t, T.ours, T.ours + 0.8)));
  return scene(t, A, items);
}
export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end);
  return scene(t, A, [...beach(t), ...tree(A, ok16(F), () => false, 1 - 0.6 * dim).items]);
}
