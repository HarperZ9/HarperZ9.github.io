// Scenes for the overprint glass renderer. Each mark is drawn by what its platform does; the shape follows from
// the mechanism, and colour where layers cross comes from the glass, never from a picked swatch.
// Units: a mark lives in a 1000 x 1000 square centred on (0, 0).

const TAU = Math.PI * 2;

// a small deterministic generator, so a mark is the same on every load
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// THEFLYWHEEL: a chained record. Each link is a record whose position comes from the hash of the one before it,
// so the chain closes into a wheel only because every link carries its predecessor.
export async function flywheel() {
  const enc = new TextEncoder();
  let h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("THEFLYWHEEL")));
  const N = 14, groups = [{ ink: "black", edge: 7, z: 1 }, { ink: "red", edge: 7, z: 1 }], shapes = [];
  for (let i = 0; i < N; i++) {
    h = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array([...h, i])));
    const a = (i / N) * TAU + (h[0] / 255 - 0.5) * 0.08, R = 330 + (h[1] / 255 - 0.5) * 18;
    const c = [Math.cos(a) * R, Math.sin(a) * R], t = [-Math.sin(a), Math.cos(a)], L = 88;
    shapes.push({ t: "link", g: i % 2, a: [c[0] - t[0] * L, c[1] - t[1] * L], b: [c[0] + t[0] * L, c[1] + t[1] * L], r: 44, w: 13 });
  }
  return { groups, shapes };
}

// a proposal for the joint review: the same hash-placed chain left open at one slot, where the newest record is
// arriving to hook onto the last, so the wheel reads as appended to rather than as a closed ring
export async function flywheelOpen() {
  const enc = new TextEncoder();
  let h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("THEFLYWHEEL")));
  const N = 14, groups = [{ ink: "sand", edge: 7, z: 1 }, { ink: "straw", edge: 7, z: 1 }, { ink: "land", edge: 7, z: 1 }], shapes = [];
  for (let i = 0; i < N; i++) {
    h = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array([...h, i])));
    const last = i === N - 1, a = (i / N) * TAU - Math.PI / 2 + (h[0] / 255 - 0.5) * 0.08, R = (last ? 430 : 330) + (h[1] / 255 - 0.5) * 18;
    const c = [Math.cos(a) * R, Math.sin(a) * R], t = [-Math.sin(a), Math.cos(a)], L = 88;
    shapes.push({ t: "link", g: last ? 2 : i % 2, a: [c[0] - t[0] * L, c[1] - t[1] * L], b: [c[0] + t[0] * L, c[1] + t[1] * L], r: 44, w: 15 });
  }
  return { groups, shapes };
}

// THECMMNS: overlapping inks. Five sources lay their ink over one shared ground; the common ground is where all
// of them cross, and its colour is what the five transmit together.
export function commons() {
  const inks = ["cyan", "yellow", "red", "green", "black"], groups = inks.map((ink) => ({ ink, edge: 10, dens: ink === "black" ? 0.3 : 0.6 }));
  const shapes = inks.map((_, i) => { const a = -Math.PI / 2 + (i / 5) * TAU; return { t: "disc", g: i, c: [Math.cos(a) * 150, Math.sin(a) * 150], r: 250 }; });
  return { groups, shapes };
}

// THEPLYGRND: liquid bodies. Drops of one liquid merge where their fields meet (a smooth union whose radius is the
// surface's reach); two liquids pass over each other, and where they cross the colour is the two filters together.
export function playground() {
  const groups = [{ ink: "cyan", edge: 46, k: 150, z: 1.4, dens: 0.85 }, { ink: "yellow", edge: 46, k: 130, z: 1.4 }];
  const shapes = [
    { t: "disc", g: 0, c: [-250, -110], r: 170 }, { t: "disc", g: 0, c: [-40, -40], r: 125 }, { t: "disc", g: 0, c: [130, -170], r: 70 }, { t: "disc", g: 0, c: [-300, 160], r: 55 },
    { t: "disc", g: 1, c: [80, 120], r: 160 }, { t: "disc", g: 1, c: [270, 40], r: 95 }, { t: "disc", g: 1, c: [-100, 250], r: 70 }, { t: "disc", g: 1, c: [300, -240], r: 45 },
  ];
  return { groups, shapes };
}

// ARTIQL8: typebars. A segment of 44 typebars rests on an arc and swings to one printing point; the bars for
// A R T I Q L 8 are struck, the rest wait in clear glass. Their order is the keyboard's, row by row.
export function articulate() {
  const keys = "1234567890QWERTYUIOPASDFGHJKLZXCVBNM,.-'/;:?".split("");
  const word = "ARTIQL8", groups = [{ ink: "clear", edge: 5, z: 0.6 }, { ink: "black", edge: 6 }, { ink: "red", edge: 6 }], shapes = [];
  const P = [0, -250], R = 520;
  keys.forEach((k, i) => {
    const a = Math.PI * (0.12 + 0.76 * (i / (keys.length - 1))), base = [Math.cos(a) * R, 330 - Math.sin(a) * R * 0.25];
    const struck = word.indexOf(k);
    const tip = struck >= 0 ? [P[0] + (struck - 3) * 8, P[1]] : [base[0] * 0.55, 330 - Math.sin(a) * R * 0.25 - 210];
    shapes.push({ t: "bar", g: struck < 0 ? 0 : struck % 2 ? 2 : 1, a: base, b: tip, r: struck >= 0 ? 15 : 9 });
    if (struck >= 0) shapes.push({ t: "box", g: struck % 2 ? 2 : 1, c: tip, hw: [26, 34], ang: Math.atan2(tip[1] - base[1], tip[0] - base[0]) + Math.PI / 2, rr: 6 });
  });
  return { groups, shapes };
}

// BLDLNG: stacked blocks. In BuildLang a function's type lists what it may touch, and a callee may only touch
// what its caller holds, so a call stack narrows as it rises. Each capability is one ink; each frame is a block
// carrying the strips of the capabilities it holds.
export function buildlang() {
  const caps = [["files", "cyan"], ["network", "yellow"], ["C", "red"], ["clock", "green"]];
  const frames = [[0, 1, 2, 3], [0, 1, 3], [0, 3], [0], []];
  const groups = caps.map(([, ink]) => ({ ink, edge: 8 })).concat([{ ink: "black", edge: 6, dens: 0.9 }]), shapes = [];
  frames.forEach((held, f) => {
    const y = 320 - f * 150, w = 420 - f * 70;
    shapes.push({ t: "box", g: 4, c: [0, y], hw: [w, 12], rr: 6 });
    held.forEach((c, j) => { const x0 = -w + 30 + j * ((2 * w - 60) / Math.max(held.length, 1)); const bw = (2 * w - 60) / Math.max(held.length, 1);
      shapes.push({ t: "box", g: c, c: [x0 + bw / 2 + bw * 0.12, y - 62], hw: [bw * 0.62, 52], rr: 10 }); });
  });
  return { groups, shapes };
}

// RSRCH: branching arrows. Each question splits into two; a branch either continues or ends in a null, drawn as
// a stop bar. Depth sets the ink.
export function research() {
  const r = rng(20261103), inks = ["black", "red", "cyan", "yellow", "green"], groups = inks.map((ink) => ({ ink, edge: 6 })), shapes = [];
  const grow = (p, ang, len, depth) => {
    const q = [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len], g = Math.min(depth, 4);
    shapes.push({ t: "bar", g, a: p, b: q, r: 15 - depth * 2 });
    const end = depth >= 4 || (depth > 1 && r() < 0.22);
    if (end) {
      if (depth < 4) shapes.push({ t: "bar", g: 0, a: [q[0] - Math.sin(ang) * 30, q[1] + Math.cos(ang) * 30], b: [q[0] + Math.sin(ang) * 30, q[1] - Math.cos(ang) * 30], r: 9 });
      else shapes.push({ t: "pie", g, c: [q[0] + Math.cos(ang) * 22, q[1] + Math.sin(ang) * 22], r: 52, ang: -ang - Math.PI / 2 + Math.PI, ap: 0.42 });
      return;
    }
    const s = 0.42 + r() * 0.2;
    grow(q, ang - s, len * 0.74, depth + 1); grow(q, ang + s, len * 0.74, depth + 1);
  };
  grow([0, 440], -Math.PI / 2, 260, 0);
  return { groups, shapes };
}

// the overprint study: the five measured inks as glass on the warm ground, placed so each measured pair crosses
// (cyan+yellow, red+yellow, green+cyan, red+black, green+red), with one oil film as the accent
export function overprintStudy() {
  const groups = [{ ink: "red", edge: 7 }, { ink: "cyan", edge: 7 }, { ink: "yellow", edge: 7 }, { ink: "green", edge: 7 }, { ink: "black", edge: 6 }, { ink: "clear", edge: 30, z: 1.2, oil: true }];
  const shapes = [
    { t: "pie", g: 0, c: [-900, 506], r: 820, ang: -Math.PI * 0.75, ap: Math.PI / 4 },
    { t: "pie", g: 1, c: [250, -506], r: 700, ang: 0, ap: Math.PI / 4 },
    { t: "disc", g: 2, c: [-200, 0], r: 260 },
    { t: "bar", g: 3, a: [-350, 380], b: [850, -150], r: 85 },
    { t: "bar", g: 4, a: [-640, -470], b: [-500, 140], r: 58 },
    { t: "disc", g: 1, c: [-720, -300], r: 90 },
    { t: "disc", g: 5, c: [-560, -130], r: 150 },
  ];
  // the film hangs from the top of its disc: 300 units = 30 mm, one hour after it was drawn
  return { groups, shapes, film: { top: -280, mmPerUnit: 0.1, seconds: 3600 } };
}

// the Mie field: water droplets lit from the left, each drawn as its scattering lobe (the phase function on a log
// scale, six decades), with size rising across the field. Each wavelength has its own outline, so the colour at a
// lobe's edge is the spread of the droplet's size parameter over the spectrum.
export function mieField({ cols = 8, rows = 3, x0 = 0.8, x1 = 40 } = {}) {
  const groups = [{ ink: "clear", edge: 8, lobe: true, x550: 1, dens: 1 }, { ink: "cyan", edge: 8, lobe: true, x550: 1, dens: 0.35 }, { ink: "black", edge: 3 }], shapes = [];
  const r = rng(7);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const t = (i + j / rows) / cols, x = x0 * Math.pow(x1 / x0, t); // size parameter at 550 nm
    const c = [-800 + i * 228 + (r() - 0.5) * 24, -280 + j * 280 + (r() - 0.5) * 24];
    shapes.push({ t: "lobe", g: j % 2, c, R: 128, size: x });
    shapes.push({ t: "disc", g: 2, c, r: 2 + Math.log10(1 + x) * 3 });
  }
  return { groups, shapes, decades: 4 };
}

export const MARKS = { THEFLYWHEEL: flywheel, THECMMNS: commons, THEPLYGRND: playground, ARTIQL8: articulate, BLDLNG: buildlang, RSRCH: research };

// parity patches: the five measured overlaps as flat squares, no lift, refraction, caustics or surface reflection,
// so the renderer's output can be compared with the overprint model it was baked from
export function parity() {
  const pairs = [["cyan", "yellow"], ["red", "yellow"], ["green", "cyan"], ["red", "black"], ["green", "red"]];
  const inks = ["red", "cyan", "yellow", "green", "black"], groups = inks.map((ink) => ({ ink, edge: 1, z: 0 })), shapes = [];
  pairs.forEach(([a, b], i) => { const c = [-800 + i * 400, 0];
    shapes.push({ t: "box", g: inks.indexOf(a), c: [c[0] - 40, 0], hw: [140, 200] }, { t: "box", g: inks.indexOf(b), c: [c[0] + 40, 0], hw: [140, 200] }); });
  return { groups, shapes, lift: 0, refract: 0, caustic: 0, f0: 0, pairs };
}

// Michel-Levy spheres: radially ordered granules (starch, spherulites) between crossed polarisers with a 530 nm
// plate. Each sphere's retardance peaks at its centre; one parameter, its order, runs from saturated colour to
// clear glass, as a granule melts. Left to right the order falls from 560 nm of retardance to none.
export function michelLevy({ cols = 6, rows = 3 } = {}) {
  const groups = [], shapes = [], r = rng(44);
  for (let i = 0; i < cols; i++) { groups.push({ ink: "clear", edge: 10, retard: 560 * (1 - i / (cols - 1)) ** 1.3, z: 0.8 });
    for (let j = 0; j < rows; j++) shapes.push({ t: "disc", g: i, c: [-750 + i * 300 + (r() - .5) * 40, -300 + j * 300 + (r() - .5) * 40], r: 100 + r() * 30 }); }
  return { groups, shapes };
}

// Cleavage draws Studio 44: a cell divides into two, then four, then eight, the halves pushing apart as they form.
// Each division is a cut through the centre, so the poster's discs, half-discs and quarter-discs carry a mechanism.
export function cleavage() {
  const inks = ["red", "cyan", "yellow", "green"], groups = inks.map((ink) => ({ ink, edge: 7 })), shapes = [];
  const R = 190, gap = (n) => 12 + n * 4;
  [1, 2, 4, 8].forEach((n, s) => {
    const cx = -660 + s * 440, ap = Math.PI / n; // each piece spans 2 pi / n
    for (let k = 0; k < n; k++) { const a = (k + 0.5) * (2 * Math.PI / n), d = n > 1 ? gap(n) : 0;
      shapes.push({ t: n === 1 ? "disc" : "pie", g: (k + s) % 4, c: [cx + Math.cos(a) * d, Math.sin(a) * d], r: R, ang: a - Math.PI / 2, ap }); }
  });
  return { groups, shapes };
}

// candidate marks for the joint review (the author accepted both looks on 2026-11-03; places not chosen yet)
export function michelMark() { // three granules at falling order: colour from structure, fading to the plate
  const groups = [0, 1, 2].map((i) => ({ ink: "clear", edge: 10, retard: [520, 300, 90][i], z: 0.8 }));
  const shapes = [{ t: "disc", g: 0, c: [-150, -90], r: 230 }, { t: "disc", g: 1, c: [190, 40], r: 170 }, { t: "disc", g: 2, c: [-60, 270], r: 120 }];
  return { groups, shapes };
}
export function cleavageMark() { // the four-cell stage: one cell cut twice through its centre
  const inks = ["cyan", "yellow", "red", "green"], groups = inks.map((ink) => ({ ink, edge: 8 })), shapes = [];
  for (let k = 0; k < 4; k++) { const a = (k + 0.5) * Math.PI / 2; shapes.push({ t: "pie", g: k, c: [Math.cos(a) * 26, Math.sin(a) * 26], r: 330, ang: a - Math.PI / 2, ap: Math.PI / 4 }); }
  return { groups, shapes };
}
