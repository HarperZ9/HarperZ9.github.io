// The matrices film's own pieces, on Pylon's chart (shared with the vectors film): the tracing
// sheet the crane moves (its grid, crates and unit steps go wherever the matrix sends them), the
// matrix written as a 2 x 2 block whose columns are coloured like the steps they move, and the
// helpers for applying and blending matrices. Direction: PROGRESS.md, step 12.
import { rect, circle, polyline, words, label } from "../../shared/lib.mjs";
import { K, P, arrow } from "../../vectors/scene/chart.mjs";

export const I2 = [[1, 0], [0, 1]];
export const apply = (M, [x, y]) => [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y];
export const mul = (A, B) => [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]], [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]];
export const det = (M) => M[0][0] * M[1][1] - M[0][1] * M[1][0];
export const mix = (A, B, u) => A.map((r, i) => r.map((v, k) => v + (B[i][k] - v) * u));
export const rot = (a) => [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]];
const f2 = (v) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));

// The tracing sheet: a translucent square of the chart, from x0..x1 by y0..y1, with its own grid,
// moved by M and then shifted by bias b. The printed chart underneath does not move.
export function sheet(M, { b = [0, 0], x0 = -1, x1 = 4, y0 = -0.5, y1 = 3.5, alpha = 1, lift = 0 } = {}) {
  const go = (p) => { const q = apply(M, p); return P([q[0] + b[0], q[1] + b[1]]); }, out = [];
  const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(go);
  if (lift > 0) out.push({ shape: polyline(c.map(([x, y]) => [x + 14 * lift, y + 20 * lift]).flat(), true), fill: [0, 0, 0, 0.22 * lift * alpha], blur: 10 });
  out.push({ shape: polyline(c.flat(), true), fill: [0.97, 0.97, 1, 0.3 * alpha], stroke: [0.2, 0.25, 0.35, 0.65 * alpha], width: 2 });
  for (let k = Math.ceil(x0); k <= x1; k++) out.push({ shape: polyline([...go([k, y0]), ...go([k, y1])]), fill: null, stroke: [0.2, 0.3, 0.5, 0.5 * alpha], width: 2 });
  for (let k = Math.ceil(y0); k <= y1; k++) out.push({ shape: polyline([...go([x0, k]), ...go([x1, k])]), fill: null, stroke: [0.2, 0.3, 0.5, 0.5 * alpha], width: 2 });
  return out;
}
// The two unit steps after M: east (ink) and north (rust), from the moved corner.
export function steps(M, { b = [0, 0], g = 1, alpha = 1 } = {}) {
  const o = P(b), e = apply(M, [1, 0]), n = apply(M, [0, 1]);
  return [...arrow(o, P([e[0] + b[0], e[1] + b[1]]), K.ink, 8, g, alpha), ...arrow(o, P([n[0] + b[0], n[1] + b[1]]), K.rust, 8, g, alpha)];
}
// A crate printed on the sheet at chart point p, carried by M (drawn as the moved square).
export function crateOn(M, p, { b = [0, 0], alpha = 1, s = 0.32 } = {}) {
  const go = (q) => { const r = apply(M, q); return P([r[0] + b[0], r[1] + b[1]]); };
  const c = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([dx, dy]) => go([p[0] + dx, p[1] + dy]));
  return [{ shape: polyline(c.flat(), true), fill: [0.56, 0.42, 0.28, 0.95 * alpha], stroke: [0.16, 0.12, 0.08, alpha], width: 2.5 },
    { shape: polyline([...c[0], ...c[2]]), fill: null, stroke: [0.36, 0.27, 0.19, alpha], width: 2 }];
}
// The matrix as a block in screen space: first column in ink (where east goes), second in rust
// (where north goes); hi lights one column. name is a small caption under it.
export function block(A, M, x, y, { a = 1, hi = -1, name = null, size = 40, plate = true } = {}) {
  if (a <= 0) return [];
  const w = size * 6.4, h = size * 2.9, out = [];
  if (plate) out.push({ shape: rect(x - 30, y - 24, w + 60, h + (name ? 64 : 40), 10), fill: [0.06, 0.045, 0.03, 0.88 * a], screen: true });
  out.push({ shape: polyline([x + 12, y, x, y, x, y + h, x + 12, y + h]), fill: null, stroke: K.night, width: 3, opacity: a, screen: true });
  out.push({ shape: polyline([x + w - 12, y, x + w, y, x + w, y + h, x + w - 12, y + h]), fill: null, stroke: K.night, width: 3, opacity: a, screen: true });
  for (let c = 0; c < 2; c++) {
    const cx = x + w * (c === 0 ? 0.3 : 0.72), glow = hi === c;
    if (glow) out.push({ shape: rect(cx - size * 1.45, y + 6, size * 2.9, h - 12, 8), fill: c === 0 ? [0.93, 0.9, 0.84, 0.18 * a] : [0.89, 0.45, 0.32, 0.25 * a], screen: true });
    for (let r = 0; r < 2; r++) out.push(label(A, f2(M[r][c]), size, cx, y + size * 1.15 + r * size * 1.3, c === 0 ? K.night : K.ember, "center", a, "mono"));
  }
  if (name) out.push(label(A, name, 26, x + w / 2, y + h + 34, K.nightDim, "center", a));
  return out;
}
// The corner pin: the one point no matrix moves.
// A label on a dark plate, for words that sit over the light paper.
export const onPlate = (A, s, size, x, y, fill, a = 1, font = "mono") => a <= 0 ? [] : [{ shape: rect(x - s.length * size * 0.31 - 22, y - size * 0.95, s.length * size * 0.62 + 44, size * 1.45, 8), fill: [0.06, 0.045, 0.03, 0.86 * a], screen: true }, label(A, s, size, x, y, fill, "center", a, font)];
export const pin = (a = 1, glow = 0) => [{ shape: circle(...P([0, 0]), 12 + 10 * glow, 16), fill: [0.89, 0.45, 0.32, (0.3 + 0.5 * glow) * a], blend: "add" }, { shape: circle(...P([0, 0]), 8, 16), fill: K.ink, opacity: a }];

// GELU, the tanh form the model uses (Hendrycks and Gimpel 2016).
export const gelu = (x) => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
export { f2 };
