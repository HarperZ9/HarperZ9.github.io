// "Check the check", drawn: Rerun on the shore with one glass shell per deliberate break and
// a marked shell for the planted failure. During a run he knocks each shell in turn: a caught
// break rings solid, a missed one rings hollow. Two bars above compare what ran with what was
// caught. A Motion frame list, pure in (view state, time), drawn by WebGPU or Canvas 2D.
import { pose } from "../../media/raw-native/tree-c6b114d/templates/guides/rig.mjs";
import { GUIDES } from "../../media/raw-native/tree-c6b114d/templates/guides/guides.mjs";
import { clipBeat } from "../../media/raw-native/tree-c6b114d/templates/guides/motion.mjs";
import { rect, circle } from "../../media/raw-native/tree-c6b114d/web/motion/path.mjs";
import { text } from "../../media/raw-native/tree-c6b114d/web/motion/text.mjs";

export const INK = "#ece5d6", DIM = "#958e80", OK = "#63d4ce", HOT = "#e29472";
const R = GUIDES.rerun, STEP = 1.6, Y = 860, X0 = 470, DX = 190;
export const runLength = (n) => (n + 1) * STEP + 0.6;
const shellX = (i) => X0 + i * DX;
const word = (s, size, x, y, anchor, atlas, fill = INK) => ({ shape: text(s, { atlas, size, x, y, anchor }).shape, fill });

// A glass shell: a faceted dome. state: "glass" (not knocked), "solid" (caught), "hollow" (missed).
function shell(x, y, state, control) {
  const tone = state === "hollow" ? ["#151a20", "#0b0e12"] : ["#bfe6ea", "#2b4b5e"];
  const out = [{ shape: rect(x - 62, y - 8, 124, 16, 8), fill: [0, 0, 0, 0.35], blur: 6 },
    { shape: circle(x, y - 46, 58, 6), fill: { linear: [x - 58, y - 104, x + 58, y], stops: [[0, tone[0]], [1, tone[1]]] }, stroke: "#0b0a0c", width: 4 },
    { shape: rect(x - 66, y - 46, 132, 46), fill: "#c9b98f" }];
  if (control) out.push({ shape: rect(x - 18, y - 72, 36, 36, 4), fill: "#1d1812" }, { shape: rect(x - 10, y - 64, 20, 20, 2), fill: DIM });
  if (state === "solid") out.push({ shape: circle(x, y - 46, 72, 48), fill: null, stroke: OK, width: 6 });
  if (state === "hollow") out.push({ shape: circle(x, y - 46, 72, 48), fill: null, stroke: HOT, width: 6, dash: [14, 10] });
  return out;
}

function bars(a, atlas) {
  const out = [], x = 470, w = 1100;
  const bar = (y, share, label, color) => out.push({ shape: rect(x, y, w, 30, 4), fill: "#14161a", stroke: "#3a3a40", width: 2 },
    { shape: rect(x, y, Math.max(0.001, w * share), 30, 4), fill: color }, word(label, 30, x, y - 12, "left", atlas, DIM));
  bar(140, a.coverage, `statements the tests run: ${Math.round(a.coverage * 6)} of 6`, INK);
  bar(250, a.caught / 6, `breaks the tests catch: ${a.caught} of 6`, OK);
  return out;
}

// view: { a (assess result), runStart (time a run began, or null), guessed (viewer's call) }.
export function frame(v, now, A, { reduced = false } = {}) {
  const items = [
    { shape: rect(-20, 0, 1960, 620), fill: { linear: [0, 0, 0, 620], stops: [[0, "#0b1220"], [1, "#16263a"]] } },
    { shape: rect(-20, 600, 1960, 60), fill: "#20384f" },
    { shape: rect(-20, 650, 1960, 450), fill: { linear: [0, 650, 0, 1080], stops: [[0, "#b8a47a"], [1, "#6f5f42"]] } },
  ];
  items.push(...bars(v.a, A.atlas));
  const t = v.runStart === null ? -1 : (reduced ? 1e9 : now - v.runStart), n = v.a.mutants.length;
  const knockedUpTo = t < 0 ? -1 : Math.floor(t / STEP);
  v.a.mutants.forEach((m, i) => {
    const done = knockedUpTo > i || (knockedUpTo === i && (t - i * STEP) * 2 > 1.8);
    items.push(...shell(shellX(i), Y, done ? (m.caught ? "solid" : "hollow") : "glass", false), word(`${i + 1}`, 30, shellX(i), Y + 60, "center", A.atlas, DIM));
  });
  const cDone = knockedUpTo > n || (knockedUpTo === n && (t - n * STEP) * 2 > 1.8);
  items.push(...shell(shellX(n) + 30, Y, cDone ? (v.a.controlFails ? "solid" : "hollow") : "glass", true), word("control", 28, shellX(n) + 30, Y + 60, "center", A.atlas, DIM));
  // Rerun: idle at the left, or at the shell he is knocking.
  const at = Math.min(knockedUpTo, n), local = t < 0 || knockedUpTo > n ? -1 : (t - at * STEP) * 2;
  const x = local < 0 ? 260 : shellX(at) + (at === n ? 30 : 0) - 130;
  const beat = { x, y: Y + 10, s: 0.62, o: { tally: v.tally || 0, look: [4, -2] } };
  const b = local < 0 ? clipBeat("rerun", "idle", beat, now % 2.4) : clipBeat("rerun", "action", beat, Math.min(local, 3.2));
  const bx = b.x + (b.offset ? b.offset[0] : 0), by = b.y + (b.offset ? b.offset[1] : 0);
  items.push(...R.under(bx, by, b.s, "painted"), ...pose(R.parts(b.o), { x: bx, y: by, s: b.s, squash: b.o.squash || 0 }));
  return { background: [0.04, 0.05, 0.07], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.1, vignette: 0.25, grain: 0 } };
}
