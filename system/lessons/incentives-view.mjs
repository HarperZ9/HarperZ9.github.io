// "What gets paid", drawn: a hill seen from above, with the reward flag at the top and three
// roads up to it: the long road (write the fix) and two short ramps (the shortcuts). Each
// episode is a runner on the road it took. When the checker stops paying for a shortcut, Pylon
// has set a cone across it. On the right, reward earned and tasks solved over training.
import { pose, P } from "../../media/raw-native/tree-dev/templates/guides/rig.mjs";
import { GUIDES } from "../../media/raw-native/tree-dev/templates/guides/guides.mjs";
import { coneParts } from "../../media/raw-native/tree-dev/templates/guides/pylon.mjs";
import { clipBeat } from "../../media/raw-native/tree-dev/templates/guides/motion.mjs";
import { rect, circle, polyline, line } from "../../media/raw-native/tree-dev/web/motion/path.mjs";
import { text } from "../../media/raw-native/tree-dev/web/motion/text.mjs";
import { windows } from "./incentives.mjs";

export const INK = "#ece5d6", DIM = "#958e80", OK = "#63d4ce", HOT = "#e29472";
const G = GUIDES.pylon, FLAG = [470, 170];
const word = (s, size, x, y, anchor, atlas, fill = INK) => ({ shape: text(s, { atlas, size, x, y, anchor }).shape, fill });
// Roads as polylines from the foot of the hill to the flag.
export const ROADS = {
  solve: [[170, 960], [120, 800], [300, 700], [140, 560], [330, 450], [210, 320], [400, 240], FLAG],
  exit: [[560, 960], [520, 640], FLAG],
  skip: [[800, 960], [700, 600], FLAG],
};
function along(pts, u) {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), L = seg.reduce((a, b) => a + b, 0);
  let d = u * L, i = 0;
  while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
  const k = seg[i] ? d / seg[i] : 0;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
}

function hill() {
  const out = [{ shape: rect(-20, -20, 1000, 1120), fill: "#2c3b2a" }];
  const land = rect(-20, -20, 1000, 1120);
  for (let r = 1; r <= 7; r++) out.push({ shape: circle(FLAG[0], FLAG[1] + 40, r * 120, 64), fill: null, stroke: [0.75, 0.8, 0.6, 0.12 + 0.02 * r], width: 2, clip: land });
  for (const [k, pts] of Object.entries(ROADS)) out.push({ shape: polyline(pts.flat()), stroke: k === "solve" ? "#b9a47c" : "#8d7a58", width: k === "solve" ? 22 : 16, fill: null, join: "round" });
  out.push({ shape: rect(FLAG[0] - 3, FLAG[1] - 70, 6, 70), fill: "#d9cdb0" }, { shape: P(`M ${FLAG[0] + 3} ${FLAG[1] - 70} L ${FLAG[0] + 60} ${FLAG[1] - 52} L ${FLAG[0] + 3} ${FLAG[1] - 34} Z`), fill: "#e8b860" });
  return out;
}

function chart(log, shown, A) {
  const out = [{ shape: rect(1040, 120, 820, 520, 6), fill: [0.03, 0.03, 0.035, 0.75] }], x0 = 1100, x1 = 1820, y0 = 560, y1 = 200;
  out.push({ shape: line(x0, y0, x1, y0), stroke: DIM, width: 2 }, word("reward earned", 28, x0, 168, "left", A.atlas, INK), word("tasks solved", 28, x0 + 320, 168, "left", A.atlas, OK),
    word("training episodes", 24, (x0 + x1) / 2, 610, "center", A.atlas, DIM), word("all", 22, x0 - 12, y1 + 8, "right", A.atlas, DIM), word("none", 22, x0 - 12, y0 + 8, "right", A.atlas, DIM));
  const w = windows(log.slice(0, Math.max(40, shown)));
  const pts = (k) => w.map((x, i) => [x0 + ((i + 0.5) / 10) * (x1 - x0), y0 - x[k] * (y0 - y1)]).flat();
  if (shown > 0) out.push({ shape: polyline(pts("reward")), stroke: INK, width: 5, fill: null }, { shape: polyline(pts("solved")), stroke: OK, width: 5, fill: null, dash: [16, 10] });
  return out;
}

// v: { log, checker, runStart }.
export function frame(v, now, A, { reduced = false } = {}) {
  const items = [...hill()];
  const t = v.runStart === null ? -1 : reduced ? 1e9 : now - v.runStart, shown = t < 0 ? 0 : Math.min(v.log.length, Math.floor(t * 80));
  // Cones across each shortcut the checker no longer pays for.
  for (const [k, pay] of [["exit", v.checker.exitPasses], ["skip", v.checker.skipPasses]]) if (!pay) {
    const [cx, cy] = along(ROADS[k], 0.3);
    for (const dx of [-36, 0, 36]) for (const p of coneParts(cx + dx, cy + 14, { scale: 0.32 })) items.push({ shape: P(p.d), fill: p.fill, stroke: "#1b1712", width: 1.5 });
  }
  // Runners: the last 40 episodes, each moving up the road it took.
  v.log.slice(Math.max(0, shown - 40), shown).forEach((e, i, a) => {
    const u = ((a.length - i) / 40 + (now * 0.15) % 0.05) % 1, [x, y] = along(ROADS[e.move], 1 - u);
    items.push({ shape: circle(x, y, 9, 16), fill: e.solved ? OK : e.reward ? INK : DIM, stroke: "#1b1712", width: 2 });
  });
  items.push(word("write the fix", 26, 90, 1010, "left", A.atlas), word("exit(0)", 26, 560, 1010, "center", A.atlas), word("SkipTest", 26, 800, 1010, "center", A.atlas));
  items.push(...chart(v.log, shown, A));
  const busy = t >= 0 && shown < v.log.length, b = clipBeat("pylon", "idle", { x: 1450, y: 980, s: 0.42, o: { tilt: busy ? 4 : 10, lid: 0.5, flipR: busy ? 30 : 55, look: [-4, -2] } }, now % 2.4);
  items.push(...G.under(b.x, b.y, b.s, "painted"), ...pose(G.parts(b.o), { x: b.x + (b.offset?.[0] || 0), y: b.y + (b.offset?.[1] || 0), s: b.s, yaw: -15 }));
  return { background: [0.04, 0.05, 0.05], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.06, vignette: 0.25, grain: 0 } };
}
