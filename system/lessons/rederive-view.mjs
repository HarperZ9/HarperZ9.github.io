// "Run it again", drawn: Pylon at the harbour with one boat per published study, each under a
// cone until it is run again. On the right, every published effect and its repeat on one axis,
// with both means. A Motion frame list, pure in (view state, time).
import { pose, P } from "../../media/raw-native/tree-c6b114d/templates/guides/rig.mjs";
import { GUIDES } from "../../media/raw-native/tree-c6b114d/templates/guides/guides.mjs";
import { coneParts } from "../../media/raw-native/tree-c6b114d/templates/guides/pylon.mjs";
import { clipBeat } from "../../media/raw-native/tree-c6b114d/templates/guides/motion.mjs";
import { rect, circle, line } from "../../media/raw-native/tree-c6b114d/web/motion/path.mjs";
import { text } from "../../media/raw-native/tree-c6b114d/web/motion/text.mjs";

export const INK = "#ece5d6", DIM = "#958e80", OK = "#63d4ce", HOT = "#e29472", UNV = "#b3b1e6";
const G = GUIDES.pylon, EACH = 0.22, AX = { x0: 1040, x1: 1840, lo: -0.4, hi: 1.4 };
export const runLength = (n) => n * EACH + 0.8;
const word = (s, size, x, y, anchor, atlas, fill = INK) => ({ shape: text(s, { atlas, size, x, y, anchor }).shape, fill });
const ax = (d) => AX.x0 + ((d - AX.lo) / (AX.hi - AX.lo)) * (AX.x1 - AX.x0);
const boatAt = (i) => [140 + (i % 6) * 135, 640 + Math.floor(i / 6) * 95];

function boat(x, y, state) {
  const hull = state === "missed" ? "#6b665c" : "#e9dfc6", sail = state === "missed" ? "#837d70" : "#f6efdd";
  const out = [{ shape: P(`M ${x - 40} ${y - 8} L ${x + 40} ${y - 8} L ${x + 26} ${y + 10} L ${x - 26} ${y + 10} Z`), fill: hull, stroke: "#1b1712", width: 2.5 },
    { shape: P(`M ${x - 18} ${y - 8} L ${x + 2} ${y - 52} L ${x + 20} ${y - 8} Z`), fill: sail, stroke: "#1b1712", width: 2.5 }];
  if (state === "coned") for (const p of coneParts(x + 2, y - 6, { scale: 0.34 })) out.push({ shape: P(p.d), fill: p.fill, stroke: "#1b1712", width: 1.5 });
  if (state === "back") out.push({ shape: circle(x + 2, y - 66, 10, 24), fill: OK });
  return out;
}

function plot(v, shown, A) {
  const out = [{ shape: line(AX.x0, 760, AX.x1, 760), stroke: DIM, width: 2 }];
  for (const d of [0, 0.4, 0.8, 1.2]) out.push({ shape: line(ax(d), 752, ax(d), 768), stroke: DIM, width: 2 }, word(d.toFixed(1), 24, ax(d), 800, "center", A.atlas, DIM));
  out.push(word("effect size", 26, (AX.x0 + AX.x1) / 2, 846, "center", A.atlas, DIM), word("published", 28, AX.x0, 420, "left", A.atlas), word("run again", 28, AX.x0, 600, "left", A.atlas));
  v.runs.forEach((r, i) => {
    out.push({ shape: circle(ax(r.original), 470 + (i % 5) * 9, 9, 18), fill: INK, opacity: 0.85 });
    if (i < shown) out.push({ shape: circle(ax(r.again), 650 + (i % 5) * 9, 9, 18), fill: r.back ? OK : DIM, opacity: 0.9 });
  });
  const mean = (k, n) => v.runs.slice(0, n).reduce((a, r) => a + r[k], 0) / Math.max(1, n);
  out.push({ shape: line(ax(mean("original", v.runs.length)), 450, ax(mean("original", v.runs.length)), 530), stroke: INK, width: 5 });
  if (shown === v.runs.length) out.push({ shape: line(ax(mean("again", shown)), 630, ax(mean("again", shown)), 710), stroke: OK, width: 5 },
    { shape: P(`M ${ax(mean("original", shown))} 540 L ${ax(mean("again", shown))} 620`), stroke: HOT, width: 4, dash: [12, 8] });
  return out;
}

// v: { runs (from rerun()), runStart (time, or null) }.
export function frame(v, now, A, { reduced = false } = {}) {
  const items = [
    { shape: rect(-20, -20, 1960, 560), fill: { linear: [0, 0, 0, 560], stops: [[0, "#121a26"], [1, "#253447"]] } },
    { shape: rect(-20, 540, 980, 560), fill: { linear: [0, 540, 0, 1080], stops: [[0, "#1d3d4f"], [1, "#0f2230"]] } },
    { shape: rect(960, 380, 960, 520, 6), fill: [0.03, 0.03, 0.035, 0.7] },
    { shape: rect(-20, 470, 980, 70), fill: { linear: [0, 470, 0, 540], stops: [[0, "#5a4634"], [1, "#3a2c20"]] }, stroke: "#1b1712", width: 3 },
  ];
  for (let x = 20; x < 960; x += 90) items.push({ shape: rect(x, 470, 6, 70), fill: [0, 0, 0, 0.25] });
  const t = v.runStart === null ? -1 : reduced ? 1e9 : now - v.runStart, n = v.runs.length;
  const shown = t < 0 ? 0 : Math.min(n, Math.floor(t / EACH) + 1);
  v.runs.forEach((r, i) => { const [x, y] = boatAt(i); items.push(...boat(x, y, i >= shown ? "coned" : r.back ? "back" : "missed")); });
  items.push(...plot(v, shown, A));
  const busy = t >= 0 && shown < n, beat = { x: 560, y: 520, s: 0.5, o: { tilt: busy ? 6 : 8, lid: 0.5, look: busy ? [-6, 6] : [2, 2], flipR: busy ? 40 : 10 } };
  const b = clipBeat("pylon", "idle", beat, now % 2.4);
  items.push(...G.under(b.x, b.y, b.s, "painted"), ...pose(G.parts(b.o), { x: b.x + (b.offset?.[0] || 0), y: b.y + (b.offset?.[1] || 0), s: b.s, yaw: 20 }));
  return { background: [0.04, 0.05, 0.07], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.08, vignette: 0.25, grain: 0 } };
}
