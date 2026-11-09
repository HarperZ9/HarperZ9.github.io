// The threads film's later segments (lesson K21): one warp's 32 lanes reading from a shelf of 256
// cans in 32-byte blocks (8 cans each), neighbouring then spread eight apart; the trip counts for the
// whole job; the reader's own chip; the close. Every value drawn is a facts.json value (F).
import { rect } from "../../shared/lib.mjs";
import { INK, CREW, lab, plate, floor, scene, trip } from "./cannery.mjs";
import { span } from "../../shared/lib.mjs";

const N = 256, P = 6.5, X0 = 120, BLOCK = 8, lane = (i) => [140 + i * 52, 640];
export function blocksShelf(A, lit, a = 1) {
  const out = [{ shape: rect(X0 - 10, 170, N * P + 20, 70, 6), fill: [0.3, 0.25, 0.2, a], stroke: "#0b0a0c", width: 3 }];
  for (let b = 0; b < N / BLOCK; b++) out.push({ shape: rect(X0 + b * BLOCK * P, 180, BLOCK * P - 2, 50, 2), fill: lit.has(b) ? [0.89, 0.58, 0.45, a] : [0.85, 0.8, 0.7, 0.85 * a] });
  out.push(lab(A, `the warehouse in ${BLOCK * 4}-byte blocks, ${BLOCK} numbers each`, 20, X0, 160, INK.dim, "left", a));
  return out;
}
export function warehouse(t, A, T, F) {
  const spread = t >= T.spread, w = spread ? F.film.warp0.stride8 : F.film.warp0.contiguous, items = [...floor()];
  const show = t >= T.near ? 1 : 0, lit = new Set(show ? w.map((l) => l.seg32) : []);
  items.push(...blocksShelf(A, lit));
  w.forEach((l, i) => { const [x, y] = lane(i); items.push({ shape: rect(x - 12, y - 12, 24, 24, 4), fill: [...CREW[0], 1], stroke: "#0b0a0c", width: 2 });
    if (show) items.push(trip(x, y - 12, X0 + l.element * P + P / 2, 235, CREW[0], 0.5)); });
  items.push(lab(A, "one warp: 32 lanes (NVIDIA)", 22, 140, 700, INK.dim));
  if (show) items.push(lab(A, `${spread ? "every eighth number" : "32 neighbouring numbers"}: ${lit.size} blocks`, 26, 600, 800, INK.ember, "left", span(t, spread ? T.spread : T.near, (spread ? T.spread : T.near) + 0.8)));
  return scene(t, A, items, 1);
}
export function count(t, A, T, F) {
  const R = F.traffic.rows, near = R[0].t32.total, far = R[3].t32.total, W = 1300 / far, items = [...floor(), plate(240, 260, 1440, 480, 0.6)];
  const bar = (y, v, name, at, hot) => { const a = span(t, at, at + 1); if (a <= 0) return []; return [{ shape: rect(300, y, W * v * a, 50, 4), fill: hot ? [0.89, 0.58, 0.45, 1] : [0.85, 0.8, 0.7, 1], screen: true }, lab(A, `${name}: ${v.toLocaleString("en")} blocks`, 24, 300, y - 14, INK.night, "left", a)]; };
  items.push(...bar(380, near, "neighbouring reads", T.near, false), ...bar(560, far, "reads eight apart", Math.max(T.far, T.ask.held), true));
  if (t >= T.ratio) items.push(lab(A, `${R[3].ratio32.toFixed(2)} times the trips, not 8: the writes stay neighbouring`, 24, 300, 700, INK.ember, "left", span(t, T.ratio, T.ratio + 0.8)));
  return scene(t, A, items, 1);
}
export function measure(t, A, T, F) {
  const items = [...floor(), plate(240, 260, 1440, 480, 0.6), lab(A, "these are counts from a model of the chip, not times", 26, 300, 360, INK.night)];
  if (t >= T.lab) items.push(lab(A, `the lab: ${F.lab.kernels.join(" and ")} kernels, crews of ${F.lab.workgroupSizes.join(", ")}`, 24, 300, 460, INK.night, "left", span(t, T.lab, T.lab + 0.8)),
    lab(A, `timed ${F.lab.reps} times on your own chip, with the count beside it`, 24, 300, 520, INK.dim, "left", span(t, T.lab, T.lab + 0.8)));
  return scene(t, A, items, 1);
}
export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end), lit = new Set(F.film.warp0.contiguous.map((l) => l.seg32));
  return scene(t, A, [...floor(), ...blocksShelf(A, lit, 1 - 0.6 * dim)]);
}
