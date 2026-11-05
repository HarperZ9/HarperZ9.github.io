// lane-marks.mjs: one small mark for each study lane on the experiments page (the domains in
// experiments/experiments.json), drawn from what a study in that lane handles, in the same overprinted inks as the
// platform marks. Units: a 48 x 48 square; they are read at 20 to 32 px, so each is two to four simple solids.
import { lay, svg, bar, circle, rect, sector, poly } from "./overprint.mjs";

const Q = Math.PI / 2;
const L = {
  // a forecast and an outcome, laid over each other; where they agree is the overlap
  method: (id) => lay(id, [{ el: circle(19, 24, 13), ink: "sky" }, { el: circle(30, 24, 13), ink: "land" }]),
  // a bob at the end of its swing, the arc it swept
  physics: (id) => lay(id, [{ el: sector(10, 8, 34, 0.35, Q + 0.1), ink: "sand" }, { el: circle(28, 36, 7.5), ink: "land" }, { el: bar([10, 8], [28, 36], 2), ink: "k" }]),
  // a word of bits: filled and empty cells in a row of two
  computing: (id) => lay(id, [1, 0, 1, 1, 0, 1, 0, 0].map((b, i) => ({ el: rect(6 + (i % 4) * 9.5, 13 + Math.floor(i / 4) * 12, 8, 10, 1.5), ink: b ? "sky" : "straw" }))),
  // a signal and its echo: two bands of marks, the second offset, crossing where they carry the same bit
  information: (id) => lay(id, [{ el: rect(6, 14, 36, 8, 4), ink: "sand" }, ...[8, 20, 30].map((x) => ({ el: rect(x, 10, 6, 28, 3), ink: "sky" }))]),
  // a cell dividing: two discs still joined
  biology: (id) => lay(id, [{ el: circle(18, 24, 12), ink: "leaf" }, { el: circle(30, 24, 12), ink: "sand" }]),
  // a dial and its needle
  instruments: (id) => lay(id, [{ el: sector(24, 34, 20, Math.PI, 2 * Math.PI), ink: "straw" }, { el: sector(24, 34, 20, Math.PI, Math.PI * 1.35), ink: "sky" }, { el: bar([24, 34], [36, 18], 2.6), ink: "k" }]),
  // a lens bending three rays to one focus
  optics: (id) => lay(id, [{ el: `<path d="M20 8Q30 24 20 40Q10 24 20 8Z"/>`, ink: "mist" }, ...[14, 24, 34].map((y) => ({ el: bar([4, y], [44, 24 + (24 - y) * -0.1], 2.4), ink: "land" }))]),
  // a stem and its crown of overlapping leaves
  ecology: (id) => lay(id, [{ el: bar([24, 44], [24, 22], 3.2), ink: "velvet" }, { el: circle(17, 19, 9), ink: "leaf" }, { el: circle(30, 17, 9), ink: "straw" }, { el: circle(24, 28, 8), ink: "sky" }]),
  // grains packed in a square lattice, touching
  materials: (id) => lay(id, [[16, 16], [32, 16], [16, 32], [32, 32]].map(([x, y], i) => ({ el: circle(x, y, 9.5), ink: i % 3 ? "sand" : "sky" }))),
  // three typebars meeting at a line
  language: (id) => lay(id, [[8, "sky"], [24, "land"], [40, "sand"]].map(([x, k]) => ({ el: bar([x, 42], [24, 12], 3.4), ink: k })).concat([{ el: rect(10, 8, 28, 2.6, 1.3), ink: "k" }])),
  // a sphere, its lit side and its shadow on the ground
  rendering: (id) => lay(id, [{ el: `<ellipse cx="28" cy="40" rx="16" ry="4"/>`, ink: "velvet" }, { el: circle(22, 22, 14), ink: "sky" }, { el: sector(22, 22, 14, Math.PI, Math.PI * 1.5), ink: "straw" }]),
  // an eye: a lens-shaped lid and its pupil
  psychology: (id) => lay(id, [{ el: `<path d="M4 24Q24 6 44 24Q24 42 4 24Z"/>`, ink: "mist" }, { el: circle(24, 24, 8), ink: "land" }]),
  // inputs weighed into one output: two arriving discs, their weights, the sum
  ai: (id) => lay(id, [{ el: bar([12, 14], [36, 24], 3), ink: "sand" }, { el: bar([12, 34], [36, 24], 3), ink: "sand" }, { el: circle(12, 14, 7), ink: "sky" }, { el: circle(12, 34, 7), ink: "mist" }, { el: circle(36, 24, 9), ink: "land" }]),
  // three people sharing ground: where all three overlap is what they hold in common
  society: (id) => lay(id, [{ el: circle(17, 19, 11), ink: "sky" }, { el: circle(31, 19, 11), ink: "sand" }, { el: circle(24, 31, 11), ink: "leaf" }]),
  // a source and the wavefronts it sends out
  sound: (id) => lay(id, [{ el: sector(8, 24, 38, -0.7, 0.7), ink: "mist" }, { el: sector(8, 24, 26, -0.7, 0.7), ink: "straw" }, { el: sector(8, 24, 14, -0.7, 0.7), ink: "land" }]),
  // strata, each laid down over the one before
  history: (id) => lay(id, [[32, "velvet"], [24, "sand"], [16, "sky"]].map(([y, k], i) => ({ el: rect(6 + i * 4, y - 4, 36 - i * 8, 12, 2), ink: k }))),
};

export const LANE_MARKS = L;
export function laneMark(name, { title = false, cls = "xo-lane", size = null } = {}) {
  const fn = L[name]; if (!fn) return "";
  const id = `lm-${name}`;
  return svg(id, "0 0 48 48", fn(id), { title: title ? `Study lane: ${name}` : "", cls, size });
}
