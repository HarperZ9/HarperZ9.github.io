// Night Shift, drawn: the claims office at night with Tallow at the desk, as a Motion frame
// list (raw-native's display list). The page draws it with the WebGPU renderer, in the
// thriller template's own look, or with the Canvas 2D drawer where there is no WebGPU.
// Pure in (state, time), so a frame can be checked in Node.
import { pose } from "../../media/raw-native/tree-c6b114d/templates/guides/rig.mjs";
import { GUIDES } from "../../media/raw-native/tree-c6b114d/templates/guides/guides.mjs";
import { thrillerSet } from "../../media/raw-native/tree-c6b114d/templates/guides/sets.mjs";
import { clipBeat } from "../../media/raw-native/tree-c6b114d/templates/guides/motion.mjs";
import { LOOKS } from "../../media/raw-native/tree-c6b114d/templates/guides/look.mjs";
import { rect, circle } from "../../media/raw-native/tree-c6b114d/web/motion/path.mjs";
import { text } from "../../media/raw-native/tree-c6b114d/web/motion/text.mjs";
import { gameHour, reached } from "./night-shift.mjs";

export const INK = "#ece5d6", DIM = "#958e80", OK = "#63d4ce", HOT = "#e29472", UNV = "#b3b1e6", PAPER = "#d9cdb0";
const T = GUIDES.tallow, TALLOW = { x: 560, y: 1000, s: 0.86 };
const DESK = { x: 760, y: 770, w: 760, h: 300 }, CARD = { x: 900, y: 560, w: 420, h: 250 };
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const since = (s, now, id, action) => { const e = [...s.log].reverse().find((x) => x.id === id && (!action || x.action === action)); return e ? now - e.t : Infinity; };

// What Tallow does, from the state: his idle loop, then the reactions CHARACTERS.md gives him.
export function tallowPose(s, now) {
  const base = clipBeat("tallow", "idle", { ...TALLOW, o: { armR: 30, elbR: 40, prop: null, lid: 0.45, look: [4, -2] } }, now % 2.4).o;
  const c = s.desk !== null ? s.night.claims[s.desk] : null, last = s.log[s.log.length - 1], dt = last ? now - last.t : Infinity;
  const o = { ...base, flame: Math.max(0.35, s.budget / s.rules.budget) * (0.85 + 0.15 * base.flame) };
  if (c && c.glossy) { o.lean = 18; o.lid = 0.62; o.look = [8, -3]; }               // a polished claim: the flame leans, the eye narrows
  if (c && c.data && c.route === "ask") o.flame *= 0.85 + 0.15 * Math.cos(now * 9);  // a range he cannot pin down: the flame gutters
  if (last && dt < 1.6) {
    if (last.action === "check" || last.action === "rerun") {
      if (last.found === "nothing there") Object.assign(o, { armR: 45, elbR: 45, prop: "blank", mouth: 1, lean: 24, look: [-6, 4] });
      else Object.assign(o, { armL: -8, elbL: -78, propL: "jar", armR: 30, elbR: 110, prop: null, lid: 0.55, mouth: 0.6 });
    } else if (last.action === "pass") Object.assign(o, { armR: 160, prop: null, look: [10, -6], lid: 0.3 });
  }
  if (s.done) Object.assign(o, { armR: 20, elbR: 60, prop: null, lid: 0.25, look: [0, 0], lean: 0 });
  return o;
}

const shape = (str, size, x, y, anchor, atlas) => text(str, { atlas, size, x, y, anchor }).shape;
function card(c, { x, y, w, h }, atlas, reveal) {
  const out = [], gloss = c.polish;
  out.push({ shape: rect(x + 10, y + 14, w, h, 10), fill: [0, 0, 0, 0.45], blur: 10 });
  out.push({ shape: rect(x, y, w, h, gloss > 0.5 ? 14 : 3), fill: gloss > 0.5 ? { linear: [x, y, x + w, y + h], stops: [[0, "#f4ecda"], [0.48, "#fffaf0"], [0.52, "#e9dfc8"], [1, "#d8cba9"]] } : "#cbbd9c",
    stroke: "#2a2219", width: gloss > 0.5 ? 2 : 4 });
  if (gloss <= 0.5) out.push({ shape: rect(x + 12, y + h - 22, w * 0.6, 6), fill: [0.4, 0.33, 0.24, 0.35] });         // a rough card: a smudge
  const blank = reveal === "nothing there";
  out.push({ shape: shape(c.title, 34, x + 24, y + 56, "left", atlas), fill: "#1d1812", opacity: blank ? 0.06 : 1 });
  for (let i = 0; i < 3; i++) out.push({ shape: rect(x + 24, y + 86 + i * 26, w * (0.78 - i * 0.14), 8), fill: "#4b4032", opacity: blank ? 0.05 : 0.7 });
  if (c.data) out.push({ shape: rect(x + w - 132, y + h - 52, 112, 34, 6), fill: "#1d1812" },
    { shape: shape("data", 22, x + w - 76, y + h - 28, "center", atlas), fill: PAPER });
  if (reveal === "holds") out.push({ shape: circle(x + w - 46, y + 46, 26, 48), fill: null, stroke: OK, width: 6 });
  if (reveal === "still a dark spot") out.push({ shape: circle(x + w - 46, y + 46, 22, 48), fill: "#1d1812" }, { shape: circle(x + w - 46, y + 46, 26, 48), fill: null, stroke: UNV, width: 4 });
  return out;
}

// The town through the window: one dot per 250 people a released claim has reached.
function town(s, now, reduced) {
  const out = [{ shape: rect(470, 120, 380, 250, 4), fill: { linear: [0, 120, 0, 370], stops: [[0, "#0a0f1c"], [1, "#1a2030"]] }, stroke: "#2c2119", width: 10 }];
  // Rooftops of the town, then the panes: whoever a released claim reaches lights a window.
  [[470, 300, 70, 70], [540, 270, 60, 100], [600, 310, 90, 60], [690, 250, 50, 120], [740, 290, 110, 80]].forEach(([x, y, w, h]) => out.push({ shape: rect(x, y, w, h), fill: "#06080d" }));
  out.push({ shape: rect(656, 120, 8, 250), fill: "#2c2119" }, { shape: rect(470, 241, 380, 8), fill: "#2c2119" });
  let n = 0;
  for (const o of s.out) {
    const k = Math.floor(reached(s, o, now) / 250), hot = !s.night.claims[o.id].holds;
    for (let i = 0; i < k && n < 240; i++, n++) {
      const cx = 482 + (n % 24) * 15.4, cy = 262 + (Math.floor(n / 24) % 5) * 21;
      out.push({ shape: rect(cx, cy, 8, 11), fill: hot ? HOT : "#e8d9a8", opacity: reduced ? 1 : 0.9 });
    }
  }
  return out;
}

// The jar of HOURS on the desk: wax spent, in drips.
function jar(s) {
  const spent = s.rules.budget - s.budget, x = 1400, y = 640, w = 90, h = 130, fill = h * (spent / s.rules.budget);
  return [{ shape: rect(x, y + h - fill, w, fill, 6), fill: "#efe3c9" },
    { shape: rect(x, y, w, h, 10), fill: [0.8, 0.85, 0.9, 0.1], stroke: "#8f9aa3", width: 3 },
    { shape: rect(x + 8, y + 50, w - 16, 30, 3), fill: PAPER }];
}

export function frame(s, now, A, { reduced = false, look = "thriller" } = {}) {
  const items = [...thrillerSet(A)];
  items.push(...town(s, now, reduced));
  // The queue at the door: one card per waiting claim, stacked.
  s.queue.slice(0, 18).forEach((id, i) => items.push({ shape: rect(1380 + (i % 3) * 24, 600 - i * 9, 120, 74, 4), fill: s.night.claims[id].glossy ? "#efe6d2" : "#c4b694", stroke: "#2a2219", width: 2 }));
  items.push(...T.under(TALLOW.x, TALLOW.y, TALLOW.s, "thriller"), ...pose(T.parts(tallowPose(s, now)), { x: TALLOW.x, y: TALLOW.y, s: TALLOW.s, shear: T.shear || 0 }));
  items.push({ shape: rect(DESK.x, DESK.y, DESK.w, 34, 4), fill: "#4a3428", stroke: "#0c0907", width: 3 },
    { shape: rect(DESK.x + 20, DESK.y + 34, DESK.w - 40, DESK.h, 2), fill: { linear: [0, DESK.y, 0, DESK.y + DESK.h], stops: [[0, "#2e2019"], [1, "#150e0a"]] }, stroke: "#0c0907", width: 3 });
  items.push(...jar(s));
  // Held claims on the desk's left edge, each with a blank tab: marked, not checked.
  s.held.forEach((id, i) => items.push({ shape: rect(DESK.x + 30 + i * 70, DESK.y - 52, 60, 44, 3), fill: "#d7caa8", stroke: "#2a2219", width: 2 },
    { shape: rect(DESK.x + 38 + i * 70, DESK.y - 60, 20, 14, 2), fill: DIM }));
  // The claim on the desk slides in from the door, then sits in Tallow's light.
  const last = s.log[s.log.length - 1];
  if (s.desk !== null) {
    const c = s.night.claims[s.desk], u = reduced ? 1 : ease((now - Math.max(c.at, last ? last.t : 0)) / 0.6);
    items.push(...card(c, { ...CARD, x: CARD.x + (1 - u) * 500, y: CARD.y - (1 - u) * 80 }, A.atlas, null));
  } else if (last && (last.action === "check" || last.action === "rerun") && now - last.t < 3) {
    items.push(...card(s.night.claims[last.id], CARD, A.atlas, last.found));
  }
  items.push(...T.light("thriller", { x: 960, y: 540, zoom: 1 }, { ...TALLOW, o: tallowPose(s, now) }));
  const h = gameHour(s.t, s.rules), clock = `${Math.floor((22 + h) % 24)}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
  items.push({ shape: shape(clock, 30, 960, 260, "center", A.atlas), fill: DIM, screen: true });
  const L = LOOKS[look] || LOOKS.thriller;
  return { background: L.ground, camera: { x: 960, y: 540, zoom: 1 }, items, post: reduced ? { ...L.post, passes: L.post.passes.filter((p) => p.pass !== "crt-classic") } : L.post };
}
