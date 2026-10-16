// The threads film's segments (lesson K21) in the cannery: 48 workers in three crews of 16 over a
// shelf of 40 cans, one past the end, one warp's 32 lanes reading neighbouring or spread cans, and
// the trip counts. Every value drawn is a facts.json value (F); timings from film.scene.mjs (T).
import { rect, label, C, span } from "../../shared/lib.mjs";
import { INK, CREW, lab, plate, floor, scene, shelf, workers, trip } from "./cannery.mjs";

const P = 36, X0 = 160, place = (i) => [X0 + 15 + i * P, 620];
const rows = (t, T) => t >= T.whole ? 40 : 48;

export function open(t, A, T, F) {
  const lit = span(t, 0.8, 2);
  return scene(t, A, [...floor(), ...shelf(A, 48, { a: lit }), ...workers(F.film.map, place, { idleCone: false, a: lit })]);
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...floor(), ...shelf(A, 48, { a: 0.5 }), ...workers(F.film.map, place, { idleCone: false, a: 0.5 }), label(A, "Threads, workgroups and memory", 76, 960, 420, C.ink, "center", a, "head")]);
}
// One worker, one can: worker 40 reads can 40 of each list and writes the sum.
export function threads(t, A, T, F) {
  const k = 40, hot = (i) => t >= T.thread && i === k, items = [...floor(), ...shelf(A, 48, { hot, label: `the first 48 of ${F.lab.n.toLocaleString("en")} numbers` }), ...workers(F.film.map, place, { hot, idleCone: false })];
  if (t >= T.thread) { const [x, y] = place(k), a = span(t, T.thread, T.thread + 0.8); items.push(trip(x, y - 14, X0 + k * P + 15, 190, CREW[2], a), lab(A, `thread ${k}: read ${k}, add, write ${k}`, 24, 600, 800, INK.night, "left", a)); }
  return scene(t, A, items, 1);
}
// Crews: three crews of 16; crew 2, place 8 is element 40; then the list of 40 with idle workers.
export function crews(t, A, T, F) {
  const o = F.film.offByOne[0], n = rows(t, T), hot = (i) => t >= T.forty && t < T.whole && i === o.global, items = [...floor(), ...shelf(A, n, { hot }), ...workers(F.film.map, place, { hot, idleCone: t >= T.whole })];
  for (let g = 0; g < 3; g++) items.push(lab(A, `crew ${g}`, 20, X0 + 15 + g * 16 * P, 680, INK.dim, "left", span(t, T.start, T.start + 1)));
  if (t >= T.forty && t < T.whole) items.push(lab(A, `crew ${o.workgroup} x 16 + place ${o.local} = element ${o.global}`, 26, 600, 800, INK.ember, "left", span(t, T.forty, T.forty + 0.8)));
  if (t >= T.whole) { const G = F.grouping.rows[2], a = span(t, T.idle, T.idle + 0.8);
    items.push(lab(A, `${G.n.toLocaleString("en")} numbers in crews of ${G.wg}: ${G.workgroups} crews, ${G.invocations.toLocaleString("en")} threads, ${G.idleThreads} idle`, 24, 520, 860, INK.night, "left", a), lab(A, `here: ${F.film.map.filter((w) => w.runs).length} numbers in crews of ${F.film.map.filter((w) => w.workgroup === 0).length}, ${F.film.map.filter((w) => !w.runs).length} idle (cones)`, 22, 520, 900, INK.dim, "left", a)); }
  return scene(t, A, items, 1);
}
// One past the end: worker 40 writes onto the guard can past the shelf; the checks.
export function edge(t, A, T, F) {
  const o = F.film.offByOne[0], items = [...floor(), ...shelf(A, 44, { guard: (i) => i >= 40, hot: (i) => t >= T.forty && i === 40 }), ...workers(F.film.map, place, { hot: (i) => i === o.global })];
  items.push(lab(A, "blue: guard cans past the end", 20, 1600, 240, [0.7, 0.82, 0.95], "right"));
  if (t >= T.forty) { const [x, y] = place(o.global), a = span(t, T.forty, T.forty + 0.8); items.push(trip(x, y - 14, X0 + 40 * P + 15, 190, [0.89, 0.58, 0.45], a), lab(A, `thread ${o.global}: one place past the end`, 24, 600, 800, INK.ember, "left", a)); }
  if (t >= T.checks) items.push(plate(560, 840, 1160, 100, 0.7), lab(A, "checks: every sum against the main processor's, and the guard cans", 22, 600, 900, INK.night, "left", span(t, T.checks, T.checks + 0.8)));
  return scene(t, A, items, 1);
}
