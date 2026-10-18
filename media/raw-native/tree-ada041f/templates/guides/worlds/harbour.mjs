// Pylon's harbour: a dockside claims office at dusk in drizzle, the painted isometric world.
// The ground is laid cell by cell from a hand-drawn map (MAP, through web/world/author.mjs);
// buildings and props stand on it in painter's order (harbour_props.mjs); the light is a warm
// lamp, lit windows and an open door against a cold wet evening, and the cone is the one hot
// mark. The paint pass (look.mjs) turns it to oil. Original art in code.
import { mapLayer } from "../../../web/world/author.mjs";
import { seeded, lin, rad, INK } from "../rig.mjs";
import { rect } from "../../../web/motion/path.mjs";
import { S, quad, line, poly, sorted, lightPool, depth } from "./iso_kit.mjs";
import { office, shed, crates, bollard, lamp, noticeboard, crane, boat, pier, lighthouse, HC } from "./harbour_props.mjs";

export const HARBOUR_CAMERA = { x: 1000, y: 500, zoom: 0.9 };
export const LAMP = [4.75, 5.9];                   // the lamp's ground cell: shadows fall away from it
export const WATER_Z = -0.6;
// The net shed stands clear of the office so its fallen roof reads (PROGRESS.md, step 12).
const SHED = { i0: 5.4, j0: 0.3, i1: 8.4, j1: 2.5, h: 2.6 };

// The ground, one character per cell (column i, row j). c cobbles, m mossy cobbles, p the worn
// path from the door to the pier, f flags in front of the door, g a drain grate, k the granite
// kerb, W water.
const MAP = [
  "cccccmccccccckWW",
  "ccccccccmcccckWW",
  "ccccccccccccckWW",
  "cccccmccccccckWW",
  "mmmmmcccccccckWW",
  "mcccmcppcccmckWW",
  "mccccfppcccccpWW",
  "mcccffffpppppkWW",
  "mccccffcpppgckWW",
  "mcccccfcccccckWW",
  "mmcccccccmccckWW",
  "mmmcccccccccckWW",
  "ccmmccccccccckWW",
  "cccccgcccmccckWW",
  "ccccccccccccckWW",
  "ccccccccccccckWW",
];
const KINDS = { gid: { c: 1, m: 2, f: 3, g: 4, k: 5, W: 6, p: 7 } };
const LEGEND = Object.fromEntries(Object.keys(KINDS.gid).map((k) => [k, k]));
const NAMES = Object.fromEntries(Object.entries(KINDS.gid).map(([k, v]) => [v, k]));

// Stone tones, cool to warm greige, and the mossy set. A stone's tone is fixed by its place.
const STONE = ["#3d3935", "#413c37", "#3a3839", "#45403a", "#383634"];
const MOSS = ["#373d2c", "#3c3f31", "#353a2e", "#403f33", "#33382b"];
const PATH = ["#504a40", "#554e43", "#4c4842", "#5a5246", "#48443e"];
const BASE = { c: ["#2e2b29", "#312d2a", "#2b2928", "#33302c"], m: ["#2b2f23", "#2e3125", "#292c22", "#303226"], p: ["#3d3830", "#403a32", "#3a362f", "#433d34"], f: ["#46423b", "#4a453d", "#433f39", "#4d4740"] };
// Stone placements (u, v, width, height in cell units, tone), drawn by hand: four layouts that
// the cells take in turn.
const STONES = [
  [[0.08, 0.1, 0.3, 0.22, 0], [0.5, 0.06, 0.34, 0.26, 2], [0.14, 0.5, 0.28, 0.3, 3], [0.58, 0.56, 0.3, 0.24, 1]],
  [[0.2, 0.12, 0.36, 0.24, 1], [0.62, 0.3, 0.26, 0.3, 4], [0.1, 0.62, 0.34, 0.26, 2]],
  [[0.06, 0.3, 0.3, 0.26, 3], [0.46, 0.12, 0.3, 0.24, 0], [0.52, 0.6, 0.36, 0.28, 2], [0.2, 0.7, 0.2, 0.2, 4]],
  [[0.3, 0.26, 0.4, 0.3, 1], [0.08, 0.66, 0.26, 0.24, 3]],
];

function cell(kind, i, j) {
  const out = [], base = quad([[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], "#2b2826");
  if (kind === "W") return out;
  out.push(base);
  const set = kind === "m" ? MOSS : kind === "p" || kind === "f" ? PATH : STONE;
  if (kind === "k") {
    // Two long granite slabs, a worn lip on the water side.
    for (const [a, b] of [[0.02, 0.49], [0.51, 0.98]]) out.push(quad([[i + 0.03, j + a, 0], [i + 0.97, j + a, 0], [i + 0.97, j + b, 0], [i + 0.03, j + b, 0]], (i + j) % 2 ? "#878175" : "#7b766b", { stroke: "#2f2d2c", width: 2 }));
    out.push({ shape: line([S(i + 0.95, j, 0), S(i + 0.95, j + 1, 0)]), fill: null, stroke: "#a6a092", width: 3 });
    return out;
  }
  if (kind === "g") {
    out.push(quad([[i + 0.2, j + 0.2, 0], [i + 0.8, j + 0.2, 0], [i + 0.8, j + 0.8, 0], [i + 0.2, j + 0.8, 0]], "#121213", { stroke: "#3a3a3c", width: 3 }));
    for (let t = 0.3; t < 0.8; t += 0.12) out.push({ shape: line([S(i + 0.2, j + t), S(i + 0.8, j + t)]), fill: null, stroke: "#3a3a3c", width: 3 });
    return out;
  }
  // A cell is one painted mass in its kind's tone, a little lighter or darker by place, with a
  // few stones picked out on it from a fixed table: a surface, not a grid.
  const tone = BASE[kind][(i * 5 + j * 3) % 4];
  out[0] = quad([[i - 0.02, j - 0.02, 0], [i + 1.02, j - 0.02, 0], [i + 1.02, j + 1.02, 0], [i - 0.02, j + 1.02, 0]], tone);
  for (const [u, v, w, h, k] of STONES[(i * 7 + j * 11) % STONES.length]) {
    out.push(quad([[i + u, j + v, 0], [i + u + w, j + v, 0], [i + u + w, j + v + h, 0], [i + u, j + v + h, 0]], set[(k + i + j) % 5], { stroke: [0.1, 0.09, 0.08, 0.6], width: 1.5 }));
  }
  return out;
}

// The water below the quay: a deep cold field, wind lines, the kerb wall with weed at its
// foot, and the reflections of the warm lights.
function water(lights) {
  const z = WATER_Z, items = [
    { shape: poly([S(11.5, -6, z), S(26, -6, z), S(26, 22, z), S(11.5, 22, z)]), fill: lin(...S(12, 0, z), ...S(16, 14, z), [0, "#1b2e38"], [0.6, "#13222b"], [1, "#0a1218"]) },
  ];
  const r = seeded("harbour-ripples");
  for (let k = 0; k < 90; k++) {
    const i = 12.2 + r() * 6, j = -2 + r() * 20, L = 0.2 + r() * 0.6;
    items.push({ shape: line([S(i, j, z), S(i, j + L, z)]), fill: null, stroke: [0.32, 0.42, 0.46, 0.25 + 0.3 * r()], width: 2 + r() * 2 });
  }
  for (const [lx, ly, k] of lights) for (let t = 0; t < 9; t++) {
    const y = ly + 60 + t * 26, w = 34 - t * 3;
    items.push({ shape: line([[lx - w + (t % 2) * 10, y], [lx + w - (t % 3) * 8, y]]), fill: null, blend: "add", stroke: [0.9, 0.6, 0.25, k * (0.45 - t * 0.045)], width: 5 });
  }
  // The kerb wall: its +i face from the quay top down to the water, stepped where the kerb steps.
  for (let j = 0; j < 16; j++) {
    const i = MAP[j].indexOf("k") + 1;
    if (i <= 0) continue;
    items.push(quad([[i, j, z], [i, j + 1, z], [i, j + 1, 0], [i, j, 0]], lin(...S(i, j, 0), ...S(i, j, z), [0, "#55534f"], [0.7, "#3b3c3d"], [1, "#2a3a2c"]), { stroke: INK, width: 2 }));
    const nxt = j < 15 ? MAP[j + 1].indexOf("k") + 1 : i;
    if (nxt > i) items.push(quad([[i, j + 1, z], [nxt, j + 1, z], [nxt, j + 1, 0], [i, j + 1, 0]], "#2f2f31", { stroke: INK, width: 2 }));
  }
  return items;
}

// Drizzle and mist, over everything, in screen space.
export function weather(seed = "drizzle") {
  const r = seeded(seed), items = [];
  for (let k = 0; k < 130; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()), x = 1000 + Math.cos(a) * d * 820, y = 560 + Math.sin(a) * d * 440, L = 22 + r() * 30;
    items.push({ shape: line([[x, y], [x - L * 0.32, y + L]]), fill: null, stroke: [0.75, 0.8, 0.85, 0.05 + 0.08 * r()], width: 1.4 });
  }
  items.push({ shape: rect(-20, -20, 1960, 420), screen: true, fill: lin(0, -20, 0, 400, [0, [0.06, 0.07, 0.09, 0.55]], [1, [0.06, 0.07, 0.09, 0]]) });
  items.push({ shape: poly([S(12, -4, WATER_Z), S(22, -4, WATER_Z), S(22, 20, WATER_Z), S(12, 20, WATER_Z)]), fill: lin(...S(16, 0, 0), ...S(12, 12, 0), [0, [0.42, 0.48, 0.52, 0.28]], [1, [0.42, 0.48, 0.52, 0.06]]) });
  // The evening closes in: the frame darkens toward its edges, round the lit heart of the quay.
  items.push({ shape: rect(-20, -20, 1960, 1120), screen: true, fill: rad(1000, 600, 1150, [0, [0.02, 0.02, 0.04, 0]], [0.55, [0.02, 0.02, 0.04, 0.18]], [1, [0.02, 0.02, 0.04, 0.8]]) });
  return items;
}

export async function loadHarbour() {
  const layer = mapLayer(MAP, LEGEND, KINDS, "harbour ground");
  return { layer };
}

// The world: ground, water, things in depth order, and the drizzle in front. Characters and
// beat props join the sorted things through extra([{ d, items }]).
export function harbour(W, extra = []) {
  const L = W.layer, ground = [];
  for (let j = 0; j < L.height; j++) for (let i = 0; i < L.width; i++) ground.push(...cell(NAMES[L.gids[j * L.width + i]], i, j));
  const lp = lamp(LAMP[0], LAMP[1]), bt = boat(17.6, 9.8);
  const things = [
    shed(SHED), office(W.atlas), crates(6.4, 3.4, 3), crates(9.4, 12.6, 2), noticeboard(4.35, 8.9), lp, crane(11.2, 2.6),
    bollard(12.4, 1.4), bollard(12.4, 4.6), bollard(12.4, 9.0), bollard(12.4, 13.4), pier(12, 16.5, 5.3, 6.7), bt, ...extra,
  ];
  const pools = [
    ...lightPool(5.6, 6.2, 2.4, [1, 0.62, 0.25], 0.55), ...lightPool(4.9, 7.6, 1.6, [1, 0.7, 0.35], 0.5),
    ...[4.9, 6.2, 10.6].flatMap((u) => lightPool(4.7, u + 0.35, 0.8, [1, 0.72, 0.38], 0.22)),
  ];
  const puddles = [[6.8, 5.2, 0.7, 0.4], [8.9, 10.3, 0.9, 0.5], [10.2, 6.6, 0.5, 0.35]].map(([i, j, a, b]) => {
    const pts = []; for (let k = 0; k < 24; k++) { const t = (k / 24) * Math.PI * 2, w = 1 + 0.18 * Math.sin(t * 3 + i); pts.push(S(i + Math.cos(t) * a * w, j + Math.sin(t) * b * w)); }
    return { shape: poly(pts), fill: lin(...S(i - a, j), ...S(i + a, j), [0, "#2a3540"], [0.5, "#3c4a55"], [1, "#59503c"]), stroke: [0.08, 0.08, 0.09, 0.8], width: 2 };
  });
  const back = [{ shape: rect(-20, -20, 1960, 1120), screen: true, fill: lin(0, 0, 0, 1080, [0, "#0a0c12"], [1, "#05060a"]) }, ...lighthouse(), ...water([bt.light]), ...ground, ...puddles, ...pools];
  return { back, things, front: weather() };
}
export const sortedThings = (things) => sorted(things);
export { depth, S, HC };
