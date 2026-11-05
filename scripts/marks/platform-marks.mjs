// platform-marks.mjs: the marks of the platforms and of Phantom, each drawn by what it does, in flat overprinted inks
// (overprint.mjs). Each mark carries its platform's ink from the shared hierarchy colour tokens (P below), so a mark
// and every other surface of the platform share one hue. The other roles follow Le Corbusier's colour keyboard
// (world/site/crossover/keyboard.js): what arrives is sky, what is held or recorded is sand, a boundary is velvet.
// Red and traffic-light green are kept for verdicts, so no mark uses them; a study that came back null ends in the
// null verdict's grey. Units: a 100 x 100 square.
import { lay, svg, bar, circle, rect, sector, poly, film, ml, platInk } from "./overprint.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const TOK = JSON.parse(readFileSync(path.join(site, "world/site/crossover/colour-tokens.json"), "utf8"));
const nullGrey = (dark) => TOK.verdict[dark ? "dark" : "light"].null.hex;

const TAU = Math.PI * 2;

// THE FLYWHEEL: an append-only record. Links run out along a spiral, each one laid over the end of the link before
// it, so every crossing is a record carrying its predecessor; the newest link, at the open end, is drawn in the key ink.
function flywheel(id, P) {
  const shapes = [], N = 11;
  const at = (i) => { const t = i / (N - 1), a = -Math.PI / 2 + t * TAU * 1.12, r = 9 + t * 33; return [50 + r * Math.cos(a), 52 + r * Math.sin(a)]; };
  for (let i = 0; i < N; i++) {
    const a = at(i), b = at(i + 0.92), last = i === N - 1;
    shapes.push({ el: bar(a, b, 7.5 + i * 0.35), ink: last ? "k" : i % 2 ? "sky" : P });
  }
  shapes.push({ el: circle(...at(0), 2.6), ink: "k" });
  return lay(id, shapes);
}

// THE COMMONS: three grains between crossed polarisers, each coloured by its own structure. A grain's quadrants
// alternate addition and subtraction against a 530 nm plate (Michel-Levy colours, computed), and the grains fall in
// order from left to right, so the colour reads the grain, not a choice. The crossed polarisers are the platform ink.
function commons(id, P) {
  const shapes = [], G = [[30, 38, 19, 300], [64, 32, 15, 190], [55, 68, 12, 90]];
  for (const [x, y, r, d] of G) {
    for (let q = 0; q < 4; q++) shapes.push({ el: sector(x, y, r, q * TAU / 4, (q + 1) * TAU / 4), ink: ml(q % 2 ? 530 + d : Math.max(0, 530 - d)), solo: true });
    shapes.push({ el: rect(x - r, y - 1.1, 2 * r, 2.2), ink: P, solo: true }, { el: rect(x - 1.1, y - r, 2.2, 2 * r), ink: P, solo: true });
  }
  return lay(id, shapes);
}

// THE PLAYGROUND: one form cut twice through its centre into four, as one recipe becomes every medium. The quarters
// pull apart, and the seed they came from still lies over all four, overprinting each in turn.
function playground(id, P) {
  const keys = ["sky", "sand", P, "velvet"], g = 3.2, shapes = [];
  keys.forEach((k, q) => { const a = q * TAU / 4 + TAU / 8, dx = Math.cos(a) * g, dy = Math.sin(a) * g; shapes.push({ el: sector(50 + dx, 50 + dy, 38, q * TAU / 4, (q + 1) * TAU / 4), ink: k }); });
  shapes.push({ el: circle(50, 50, 14), ink: "mist" });
  return lay(id, shapes);
}

// ARTICULATE: a typewriter's segment of typebars swinging up to one printing point. The bars for A R T I Q L 8 are
// struck and meet at the point, where their ink builds up; the rest wait.
function articulate(id, P) {
  const shapes = [], N = 17, PT = [50, 22], struck = new Set([1, 4, 6, 8, 10, 12, 15]);
  for (let i = 0; i < N; i++) {
    const a = Math.PI + (i + 0.5) / N * Math.PI, R = 40, base = [50 + R * Math.cos(a), 86 + R * 0.62 * Math.sin(a) + 12];
    if (!struck.has(i)) shapes.push({ el: bar(base, [base[0] + (50 - base[0]) * 0.32, base[1] - 16], 3.2), ink: "straw" });
  }
  for (let i = 0; i < N; i++) {
    if (!struck.has(i)) continue;
    const a = Math.PI + (i + 0.5) / N * Math.PI, R = 40, base = [50 + R * Math.cos(a), 86 + R * 0.62 * Math.sin(a) + 12];
    shapes.push({ el: bar(base, PT, 3.6), ink: i % 2 ? P : "sky" });
  }
  shapes.push({ el: rect(26, 12, 48, 3.2, 1.6), ink: "k" });
  return lay(id, shapes);
}

// BUILDLANG: a call stack. Each block sits on the one below and is no wider than what that block allows, the way a
// function may only touch what its caller's type lists; the narrowest, on top, is what runs.
function buildlang(id, P) {
  const rows = [[84, 76, "sand"], [64, 62, "straw"], [46, 48, "sky"], [30, 34, "mist"], [17, 20, P]], shapes = [];
  for (const [y, w, k] of rows) shapes.push({ el: rect(50 - w / 2, y - 9, w, 15, 3), ink: k });
  return lay(id, shapes);
}

// RESEARCH: a line of inquiry branching in two at each step. Some branches end in a stop bar where the study came
// back null, in the null verdict's grey, and they stay drawn; one runs through to an arrow in the platform ink.
function research(id, P, dark) {
  const shapes = [], stops = [], root = [12, 50];
  const grow = (p, a, len, depth) => {
    const q = [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len];
    const nul = depth === 2 && a < 0 || depth === 3 && a > 0.2;
    shapes.push({ el: bar(p, q, 5 - depth * 0.6), ink: depth % 2 ? "sky" : "sand" });
    if (nul) { const n = [Math.cos(a + Math.PI / 2) * 6, Math.sin(a + Math.PI / 2) * 6]; stops.push({ el: bar([q[0] - n[0], q[1] - n[1]], [q[0] + n[0], q[1] + n[1]], 3.2), ink: nullGrey(dark), solo: true }); return; }
    if (depth === 3) { shapes.push({ el: poly([[q[0] + Math.cos(a) * 7, q[1] + Math.sin(a) * 7], [q[0] + Math.cos(a + 2.2) * 5, q[1] + Math.sin(a + 2.2) * 5], [q[0] + Math.cos(a - 2.2) * 5, q[1] + Math.sin(a - 2.2) * 5]]), ink: P }); return; }
    grow(q, a - 0.55, len * 0.78, depth + 1); grow(q, a + 0.55, len * 0.78, depth + 1);
  };
  grow(root, 0, 30, 0);
  return lay(id, [...shapes, ...stops]);
}

// PHANTOM: a hardware identifier read as a row of bars. A sheet slides over part of it, and the bars under the sheet
// read differently, the way the OS-level IDs are swapped; the bars themselves are untouched beneath, the backup
// that restores them. The sheet carries the one thin-film ink, its colour changing with the film's thickness.
function phantom(id, P) {
  const widths = [3, 1.5, 4.5, 1.5, 3, 6, 1.5, 3, 1.5, 4.5, 3, 1.5, 6, 1.5, 3, 4.5], shapes = [];
  let x = 14;
  for (const w of widths) { shapes.push({ el: rect(x, 26, w, 48), ink: "k" }); x += w + 2.2; }
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => `<stop offset="${t}" stop-color="${film(260 + t * 340)}"/>`).join("");
  const grad = `<linearGradient id="${id}-film" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`;
  shapes.push({ el: rect(46, 18, 44, 64, 4), ink: `url(#${id}-film)`, attr: ' fill-opacity=".86"' });
  shapes.push({ el: circle(68, 88, 2.4), ink: P });
  const l = lay(id, shapes);
  return { defs: grad + l.defs, body: l.body };
}

// which platform's ink each mark carries (Phantom lives in THE COMMONS)
export const MARK_PLATFORM = { THEFLYWHEEL: "theflywheel", THECMMNS: "thecmmns", THEPLYGRND: "theplygrnd", ARTIQL8: "artiql8", BLDLNG: "bldlng", RSRCH: "rsrch", PHANTOM: "thecmmns" };

export const PLATFORM_MARKS = {
  THEFLYWHEEL: [flywheel, "Drawn mark: a record of links running out along a spiral, each laid over the end of the one before it; the newest link, at the open end, is drawn in the key ink."],
  THECMMNS: [commons, "Drawn mark: three grains between crossed polarisers, each quartered into the colours its own structure makes, the colour falling with the grain's order."],
  THEPLYGRND: [playground, "Drawn mark: a disc cut twice through its centre into four quarters, pulled apart, with the small disc they came from lying over all four."],
  ARTIQL8: [articulate, "Drawn mark: a typewriter's fan of typebars; the bars for A, R, T, I, Q, L and 8 swing up and meet at one printing point."],
  BLDLNG: [buildlang, "Drawn mark: a stack of blocks narrowing as it rises, each no wider than the block below allows."],
  RSRCH: [research, "Drawn mark: a line branching in two at each step; some branches end in a grey stop bar where a study came back null, one runs through to an arrow."],
  PHANTOM: [phantom, "Drawn mark: a barcode of hardware identifier bars with an iridescent sheet over half of it, so those bars read differently while staying intact beneath."],
};

// an inline mark; id must be unique on its page. dark: the mark sits on the dark field, so it takes the platform's
// dark-ground ink
export function platformMark(name, { title = true, cls = "xo-svg", size = null, dark = false } = {}) {
  const m = PLATFORM_MARKS[name]; if (!m) return "";
  const id = `pm-${name.toLowerCase()}`;
  return svg(id, "0 0 100 100", m[0](id, platInk(MARK_PLATFORM[name], dark), dark), { title: title ? m[1] : "", cls, size });
}
