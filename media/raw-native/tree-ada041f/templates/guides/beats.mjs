// Beats: where each guide stands in each template world, its pose, and the film 1 props
// around it. The home-style beat of each guide is a moment from film 1, "Claiming got cheap.
// Checking did not."; the other two show the same guide carried into another template.
import { P, ellipse, seeded, lin, INK } from "./rig.mjs";
import { coneParts } from "./pylon.mjs";
import { rect } from "../../web/motion/path.mjs";
import { label } from "./look.mjs";
import { floorCards } from "./sets.mjs";
import { sprite, shellGrid, beach } from "./worlds/tidepool.mjs";
import { S as isoS, depth as isoDepth, groundShadow } from "./worlds/iso_kit.mjs";

const PAPER = "#d9cdb0";

// Claim cards scattered on a floor: n cards in the box, seeded. lit(i) dims or lights each.
export function cards(n, x0, y0, x1, y1, seed, { w = 26, h = 17, lit = () => 1 } = {}) {
  const r = seeded(seed), out = [];
  for (let i = 0; i < n; i++) {
    const cx = x0 + r() * (x1 - x0), cy = y0 + r() * (y1 - y0), a = (r() - 0.5) * 1.2, c = Math.cos(a), s = Math.sin(a);
    const pt = (u, v) => `${(cx + u * c - v * s).toFixed(1)} ${(cy + u * s + v * c).toFixed(1)}`;
    const k = lit(i);
    out.push({ shape: P(`M ${pt(-w / 2, -h / 2)} L ${pt(w / 2, -h / 2)} L ${pt(w / 2, h / 2)} L ${pt(-w / 2, h / 2)} Z`),
      fill: [0.85 * k, 0.8 * k, 0.69 * k, 1], stroke: INK, width: 1.2 });
    out.push({ shape: P(`M ${pt(-w / 3, -h / 6)} L ${pt(w / 3, -h / 6)} M ${pt(-w / 3, h / 6)} L ${pt(w / 6, h / 6)}`), fill: null, stroke: [0.3 * k, 0.26 * k, 0.2 * k, 1], width: 1.2 });
  }
  return out;
}

// Paper boats on the harbour plaza: claims that washed up.
export function boats(n, x0, y0, x1, y1, seed, coned = () => false) {
  const r = seeded(seed), out = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), w = 24 + r() * 8;
    out.push({ shape: P(`M ${x - w} ${y - 6} L ${x + w} ${y - 6} L ${x + w * 0.6} ${y + 6} L ${x - w * 0.6} ${y + 6} Z`), fill: "#e9dfc6", stroke: INK, width: 2 });
    out.push({ shape: P(`M ${x - w * 0.5} ${y - 6} L ${x + 2} ${y - 34} L ${x + w * 0.5} ${y - 6} Z`), fill: "#f6efdd", stroke: INK, width: 2 });
    if (coned(i)) for (const p of coneParts(x, y + 4, { scale: 0.3 })) out.push({ shape: P(p.d), fill: p.fill, stroke: INK, width: 1.5 });
  }
  return out;
}

// Shells on the beach: a grid of claims. state(i): 0 unknocked, 1 holds, 2 hollow.
export function shells(cols, rows, x0, y0, dx, dy, state) {
  const out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, x = x0 + i * dx + (j % 2) * dx * 0.5, y = y0 + j * dy, st = state(k);
    const fill = st === 2 ? "#1d2b53" : st === 1 ? "#fff1e8" : "#c2c3c7";
    out.push({ shape: P(`M ${x - 22} ${y} C ${x - 24} ${y - 26} ${x - 6} ${y - 36} ${x + 8} ${y - 32} C ${x + 24} ${y - 26} ${x + 26} ${y - 8} ${x + 22} ${y} Z`), fill, stroke: INK, width: 3 });
    out.push({ shape: P(`M ${x - 10} ${y - 4} C ${x - 8} ${y - 18} ${x + 6} ${y - 22} ${x + 12} ${y - 12}`), fill: null, stroke: st === 2 ? "#5f574f" : "#83769c", width: 3 });
  }
  return out;
}

// Things on the harbour's ground, each { d, items } for the painter's sort.
const onGround = (ci, cj, draw, r = 0.3) => ({ d: isoDepth(ci, cj), items: [...groundShadow(ci, cj, r, 0.8), ...draw(...isoS(ci, cj))] });
const paperBoat = (ci, cj, coned, k = 1) => onGround(ci, cj, (x, y) => {
  const w = 30 * k, out = [
    { shape: P(`M ${x - w} ${y - 8 * k} L ${x + w} ${y - 8 * k} L ${x + w * 0.6} ${y + 6 * k} L ${x - w * 0.6} ${y + 6 * k} Z`), fill: "#ddd2b6", stroke: INK, width: 2.5 },
    { shape: P(`M ${x - w * 0.5} ${y - 8 * k} L ${x + 2} ${y - 44 * k} L ${x + w * 0.5} ${y - 8 * k} Z`), fill: "#efe6d0", stroke: INK, width: 2.5 },
  ];
  if (coned) for (const p of coneParts(x, y + 6 * k, { scale: 0.36 * k })) out.push({ shape: P(p.d), fill: p.fill, stroke: INK, width: 2 });
  return out;
}, 0.28 * k);
const claimCard = (ci, cj, a = 0) => onGround(ci, cj, (x, y) => {
  const c = Math.cos(a), s = Math.sin(a), pt = (u, v) => `${(x + u * c - v * s).toFixed(1)} ${(y + (u * s + v * c) * 0.5).toFixed(1)}`;
  return [{ shape: P(`M ${pt(-30, -20)} L ${pt(30, -20)} L ${pt(30, 20)} L ${pt(-30, 20)} Z`), fill: "#e2d8bd", stroke: INK, width: 2 },
    { shape: P(`M ${pt(-20, -6)} L ${pt(18, -6)} M ${pt(-20, 6)} L ${pt(8, 6)}`), fill: null, stroke: "#5b4e3c", width: 2 }];
}, 0.25);
const coneStack = (ci, cj, n = 4) => onGround(ci, cj, (x, y) => Array.from({ length: n }, (_, k) => coneParts(x, y - k * 16, { scale: 0.42 }).map((p) => ({ shape: P(p.d), fill: p.fill, stroke: INK, width: 2 }))).flat(), 0.4);
const isoShell = (ci, cj, st) => onGround(ci, cj, (x, y) => {
  const fill = st === 2 ? "#1d2333" : "#e9dfc6";
  return [{ shape: P(`M ${x - 26} ${y} C ${x - 28} ${y - 30} ${x - 6} ${y - 42} ${x + 10} ${y - 38} C ${x + 28} ${y - 30} ${x + 30} ${y - 8} ${x + 26} ${y} Z`), fill, stroke: INK, width: 3 },
    { shape: P(`M ${x - 12} ${y - 4} C ${x - 10} ${y - 20} ${x + 8} ${y - 26} ${x + 14} ${y - 14}`), fill: null, stroke: st === 2 ? "#4a4f5e" : "#8a7d68", width: 3 }];
}, 0.3);

// A key term on a calm ground, bottom centre (the bible's 1 to 6 words).
const keyTerm = (A, s, L, size = 44, y = 968, x = 960) => [
  { shape: rect(x - s.length * size * 0.27 - 40, y - size - 18, s.length * size * 0.54 + 80, size + 44), screen: true, fill: [0.03, 0.028, 0.03, 0.82] },
  label(A.atlas, s, size, x, y, L.ink),
];

const tallowHome = {
  x: 700, y: 985, s: 0.88, o: { armR: 160, prop: "card", look: [6, -7], lid: 0.15, lean: 10 },
  props: () => floorCards(40, "night-floor", { lit: (i) => 0.55 + 0.45 * ((i * 7) % 5 === 0) }),
  hud: (style, A, L) => keyTerm(A, "Does this work exist?", L, 44, 1000, 1380),
};
// Pylon on the quay in front of the claims office; paper boats (claims) washed up along the
// kerb, the coned ones checked-pending, her cone stack running down.
const pylonHome = {
  cell: [8.6, 7.3], s: 0.48, height: 3.2, camera: { x: 1010, y: 470, zoom: 0.86 }, o: { tilt: 6, lid: 0.5, flipR: 55, look: [2, 2] },
  things: () => [
    ...[[10.4, 3.4, 1], [11.2, 5.0, 0], [10.6, 6.0, 1], [11.6, 8.6, 0], [10.6, 9.2, 1], [11.4, 10.6, 0], [9.9, 11.4, 0], [8.4, 12.2, 1], [10.6, 12.2, 0], [7.0, 10.6, 0]]
      .map(([i, j, c]) => paperBoat(i, j, c)),
    coneStack(9.6, 8.9, 3),
  ],
  hud: (style, A, L) => keyTerm(A, "1 boat = 1 reference", L, 48),
};
// Rerun on the shelf by the tidepool; the claims are a grid of shells on the sand.
const rerunHome = {
  x: beach(140, 0)[0], y: beach(0, 236)[1], s: 0.62, o: { clawR: 70, look: [4, -3] },
  props: (style, A) => shellGrid(A.pixel, 6, 3, 258, 196, (k) => (k < 10 ? ((k * 5) % 9 < 5 ? "hollow" : "holds") : "unknocked")),
  hud: (style, A) => [label(A.atlas, "1 shell = 1 reference", 64, 1300, 1030, "#efe6cf")],
};

export const BEATS = {
  tallow: {
    thriller: tallowHome,
    painted: { cell: [10.2, 9.4], s: 0.55, height: 4, camera: { x: 1090, y: 520, zoom: 1 }, o: { armR: 22, elbR: 140, prop: "loupe", lid: 0.5 }, yaw: 20,
      things: () => [[8.6, 8.6, 0.3], [9.0, 10.4, -0.5], [8.2, 11.8, 0.9], [11.2, 11.0, 0.1], [9.8, 12.4, -0.3], [11.6, 8.2, 0.6], [7.4, 10.0, 0.4]].map(([i, j, a]) => claimCard(i, j, a)) },
    pixel: { x: beach(300, 0)[0], y: beach(0, 238)[1], s: 0.36, camera: { x: 1120, y: 540, zoom: 1 }, o: { armR: 160, prop: "card", look: [6, -7], lid: 0.4 },
      props: (style, A) => [[200, 214], [236, 230], [330, 222], [372, 246], [262, 252], [404, 212], [176, 244]].map(([x, y]) => sprite(A.pixel, "card", x, y)) },
  },
  pylon: {
    painted: pylonHome,
    thriller: { x: 760, y: 1000, s: 0.95, o: { tilt: 15, lid: 0.5 },
      props: () => floorCards(30, "dock-floor", { lit: () => 0.6 }) },
    pixel: { x: beach(290, 0)[0], y: beach(0, 240)[1], s: 0.37, camera: { x: 1040, y: 540, zoom: 1 }, o: { bark: 0.7, lid: 0.55, tilt: 3, look: [0, -4] },
      props: (style, A) => [
        ...[[196, 168], [232, 172], [356, 166], [404, 170], [440, 174]].map(([x, y]) => sprite(A.pixel, "boat", x, y)),
        ...[[200, 162], [360, 160]].map(([x, y]) => sprite(A.pixel, "cone", x + 2, y - 4)),
        ...[[338, 224], [372, 236], [214, 230]].map(([x, y]) => sprite(A.pixel, "boat", x, y)),
      ] },
  },
  rerun: {
    pixel: rerunHome,
    thriller: { x: 760, y: 1010, s: 1.05, o: { clawR: 70, look: [6, 2] },
      props: () => [...floorCards(24, "pool-floor", { lit: () => 0.5 }), ...shells(1, 1, 1190, 1000, 0, 0, () => 2)] },
    painted: { cell: [7.6, 8.8], s: 0.6, height: 1.6, camera: { x: 940, y: 600, zoom: 1.15 }, o: { stalk: 1.6, look: [0, -6] }, yaw: 20,
      things: () => [[9.2, 7.6, 2], [9.7, 8.4, 1], [10.2, 9.2, 1], [9.4, 9.9, 2], [10.0, 10.6, 1], [10.6, 7.9, 1], [11.0, 8.8, 2]].map(([i, j, st]) => isoShell(i, j, st)) },
  },
};

// The playable lesson's level, drawn as a still: Night Shift in the thriller corridor.
export const LESSON = {
  x: 760, y: 900, s: 0.62, o: { armR: 160, prop: "card", look: [8, -4], lid: 0.3, flame: 0.8, lean: 12 },
  props: () => [
    ...floorCards(34, "spread", { lit: (i) => (i % 3 ? 0.45 : 0.85), x0: 1150, y0: 700 }),
    ...cards(16, 40, 690, 520, 760, "queue", { w: 46, h: 30, lit: () => 0.75 }),
  ],
  front: () => [
    { shape: rect(860, 760, 520, 40), fill: "#4a3428", stroke: INK, width: 3 },
    { shape: rect(880, 800, 480, 230), fill: lin(0, 800, 0, 1030, [0, "#2e2019"], [1, "#150e0a"]), stroke: INK, width: 3 },
    ...cards(5, 900, 740, 1340, 770, "desk", { w: 46, h: 28 }),
  ],
  hud: (style, A, L) => {
    const box = (x, y, w, h) => ({ shape: rect(x, y, w, h), screen: true, fill: [0.03, 0.028, 0.03, 0.85], stroke: [0.85, 0.8, 0.7, 0.5], width: 1.5 });
    const keys = [["C", "check, 6 h"], ["R", "rerun, 2 to 4 h"], ["L", "let through"], ["H", "hold, 3 left"]];
    return [
      box(40, 40, 470, 150), label(A.atlas, "Night Shift", 40, 64, 92, L.ink, "left"),
      label(A.atlas, "hours left: 22 of 40", 30, 64, 140, "#e8b860", "left"), label(A.atlas, "claims waiting: 18", 26, 64, 176, L.dim, "left"),
      box(40, 940, 1840, 100),
      ...keys.flatMap(([k, s], i) => [label(A.atlas, `[${k}]`, 30, 80 + i * 450, 1002, "#e8b860", "left"), label(A.atlas, s, 30, 140 + i * 450, 1002, L.ink, "left")]),
      box(1380, 40, 500, 110), label(A.atlas, "Tallow: Your guess first.", 28, 1404, 88, L.ink, "left"),
      label(A.atlas, "How many can we check tonight?", 26, 1404, 126, L.dim, "left"),
    ];
  },
};
