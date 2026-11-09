// The first half of the matrices film: the harbour crane at night, the title, the crane moving the
// whole chart at once, reading a matrix by its columns, and turn, stretch and lean with their
// determinants (from facts.json's demos).
import { rect, polyline, span, ease, lerp, window, words, label } from "../../shared/lib.mjs";
import { K, P, desk, paper, arrow, pylon, talking } from "../../vectors/scene/chart.mjs";
import { harbour, sortedThings, S } from "../../../raw-native/tree-ada041f/templates/guides/worlds/harbour.mjs";
import { I2, apply, mix, rot, det, sheet, steps, crateOn, block, pin, onPlate, f2 } from "./sheet.mjs";

const PY = [1745, 1015];
const CRATES = [[1, 1], [3, 0.5], [2, 2.5], [0.5, 3]];
export function base(t, A, { dim = 0 } = {}) {
  return { back: [...desk(t, dim), ...paper(A)], guide: pylon(t, PY[0], PY[1], 0.52, { talk: talking(A.rows, t) }) };
}
const BX = 380, BY = 60;

// Cold open: the painted harbour, the camera finds the crane and its lamp comes on; through black
// to the desk.
export function open(t, A, T) {
  if (t < 3.0) {
    const H = harbour(A.W, []), push = span(t, 0, 3.0, ease.inOut), [cx, cy] = S(12.2, 1.6, 4.5);
    const items = [...H.back, ...sortedThings(H.things), ...H.front, { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, span(t, 2.3, 3.0)] }];
    return { items, camera: { x: lerp(1000, cx, push), y: lerp(560, cy, push), zoom: lerp(0.9, 1.9, push) }, painted: true };
  }
  const B = base(t, A), u = span(t, 3.0, 3.6);
  return { items: [...B.back, ...sheet(I2, { alpha: u }), ...CRATES.flatMap((p) => crateOn(I2, p, { alpha: u })), ...B.guide, { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 1 - u] }], camera: { x: 960, y: 540, zoom: 1 } };
}

export function title(t, A, T) {
  const B = base(t, A), a = window(t, T.say, T.end, 0.6, 0.8), stamp = span(t, T.say, T.say + 0.25, ease.out), items = [...B.back, ...sheet(I2), ...CRATES.flatMap((p) => crateOn(I2, p))];
  items.push({ shape: rect(380, 140, 760, 200, 8), fill: [0.95, 0.9, 0.78, 0.92 * a], stroke: K.ink, width: 3 });
  items.push({ shape: words("Matrices", A.head, 104 * (1.3 - 0.3 * stamp), 760, 268, "center"), fill: K.ink, opacity: a * stamp });
  items.push({ shape: words("a matrix moves every place at once", A.sans, 34, 760, 318, "center"), fill: K.dim, opacity: span(t, T.sub, T.sub + 0.6) * a });
  items.push(...B.guide);
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The crane takes the whole sheet: a turn, a stretch, a lean, and back; the matrix block keeps up.
export function craneM(t, T) {
  const u = (t - T.whole) / 3.2, k = Math.floor(u), f = ease.inOut(Math.min(1, (u - k) * 1.4));
  const seq = [I2, rot(0.5), [[1.6, 0], [0, 1]], [[1, 0.6], [0, 1]], [[1.3, -0.4], [0.3, 0.9]], I2];
  if (u < 0) return I2;
  const i = Math.min(seq.length - 2, k);
  return k >= seq.length - 1 ? seq.at(-1) : mix(seq[i], seq[i + 1], f);
}
export function crane(t, A, T) {
  const B = base(t, A), M = craneM(t, T), lift = window(t, T.whole, T.end - 1, 0.6, 0.8), items = [...B.back];
  items.push(...sheet(M, { lift }), ...CRATES.flatMap((p) => crateOn(M, p)), ...pin(1, window(t, T.corner, T.end, 0.4, 0.6)));
  if (t >= T.grid) items.push(...block(A, M, BX, BY, { a: span(t, T.grid, T.grid + 0.6), name: "the crane's move, as a matrix" }));
  if (t < T.grid && t >= T.one) { const c = [3, 0.5], g = window(t, T.one, T.whole, 0.4, 0.4); items.push(...arrow(P(c), P([c[0], c[1] + 1.4 * g]), K.rust, 5, 1, g)); }
  items.push(...B.guide);
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Read the columns: the east step lands on column one, the north step on column two; any place is
// so many of each.
export function columns(t, A, T) {
  const B = base(t, A), M0 = [[1.5, 0.5], [0.5, 1.2]], m = span(t, T.first - 1.5, T.first, ease.inOut), M = mix(I2, M0, m), items = [...B.back];
  items.push(...sheet(M, { alpha: 0.7, x0: 0, x1: 3, y0: 0, y1: 2.5 }), ...steps(M, { g: span(t, T.watch, T.watch + 1.0) }), ...pin());
  const hi = t >= T.second ? 1 : t >= T.first ? 0 : -1;
  items.push(...block(A, M, BX, BY, { a: span(t, T.watch, T.watch + 0.6), hi: t >= T.all ? -1 : hi }));
  if (t >= T.every) {
    // (2, 1) as 2 east steps then 1 north step, in the moved steps: it lands at 2 x col 1 + 1 x col 2.
    const g = span(t, T.every + 0.5, T.every + 4.5, ease.inOut), e = apply(M, [1, 0]), n = apply(M, [0, 1]);
    const p1 = e, p2 = [2 * e[0], 2 * e[1]], p3 = [p2[0] + n[0], p2[1] + n[1]];
    items.push(...arrow(P([0, 0]), P(p1), K.ink, 6, Math.min(1, g * 3)), ...arrow(P(p1), P(p2), K.ink, 6, Math.min(1, Math.max(0, g * 3 - 1))), ...arrow(P(p2), P(p3), K.rust, 6, Math.max(0, g * 3 - 2)));
    const la = span(t, T.every + 4.5, T.every + 5);
    if (la > 0) items.push({ shape: rect(330, 975, 1260, 54, 8), fill: [0.06, 0.045, 0.03, 0.85 * la], screen: true },
      label(A, `(2, 1) lands at 2 x (${f2(e[0])}, ${f2(e[1])}) + 1 x (${f2(n[0])}, ${f2(n[1])}) = (${f2(p3[0])}, ${f2(p3[1])})`, 32, 960, 1012, K.night, "center", la, "mono"));
  }
  items.push(...B.guide);
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Turn, stretch, lean: each from facts.json's demos, with the unit square's area (the determinant).
export function kinds(t, A, T, F) {
  const B = base(t, A), items = [...B.back], D = F.demos, cuts = [T.turn, T.stretch, T.lean, T.end];
  let k = 0; for (let i = 0; i < 3; i++) if (t >= cuts[i]) k = i;
  const d = D[k], M = mix(I2, d.matrix, span(t, cuts[k] + 0.6, cuts[k] + 2.6, ease.inOut));
  items.push(...sheet(M, { alpha: 0.7, x0: -0.5, x1: 3, y0: 0, y1: 2.5 }));
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map((p) => P(apply(M, p)));
  items.push({ shape: polyline(sq.flat(), true), fill: [0.65, 0.27, 0.16, 0.35], stroke: K.rust, width: 3 });
  items.push(...steps(M), ...pin());
  items.push(...block(A, M, BX, BY, { name: d.name }));
  if (k > 0 && t >= (k === 1 ? T.area : T.same)) items.push(...onPlate(A, `area of the square: ${f2(Math.abs(det(M)))}   determinant: ${f2(d.det)}`, 32, 1260, 110, K.ember, span(t, k === 1 ? T.area : T.same, (k === 1 ? T.area : T.same) + 0.6)));
  items.push(...B.guide);
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}
