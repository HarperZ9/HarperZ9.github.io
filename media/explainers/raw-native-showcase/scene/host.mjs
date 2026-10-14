// The host beats: Rerun, the hermit crab with a glass prism for a shell, in its home style
// (pixel 2.5D, the shore palette with an ordered dither). The film's subject is one box, and
// Rerun's shell is the evidence a claim carries with it, so the two meet: at the cold open
// Rerun knocks on the box (tok, tok: it holds), then the camera steps into its prism, which
// opens into the film's lens. At the close the camera steps back out of the lens until it is
// Rerun's shell again, with the one spectral flare on its rim. Rerun reacts and never decides.
//
// Two settings were tested (PROGRESS.md, step 4): "shore", Rerun's own tidepool world, and
// "floor", the film's own floor drawn in Rerun's pixel style. setHostStyle picks one.
import { pose } from "../../../raw-native/tree-dev/templates/guides/rig.mjs";
import { rerun, FLARE } from "../../../raw-native/tree-dev/templates/guides/rerun.mjs";
import { clipBeat } from "../../../raw-native/tree-dev/templates/guides/motion.mjs";
import { world } from "../../../raw-native/tree-dev/templates/guides/stage.mjs";
import { LOOKS } from "../../../raw-native/tree-dev/templates/guides/look.mjs";
import { contour, transform } from "../../../raw-native/tree-dev/web/motion/path.mjs";
import { C, box, view, span, ease, lerp } from "./world.mjs";

export let HOST_STYLE = "shore";
export const setHostStyle = (v) => { HOST_STYLE = v; };

// Pixel mode keeps one art pixel per frame pixel, so a push-in steps through zooms that divide
// 480 x 270, the way a retro game zooms.
const STEPS = [1, 2, 3, 5];
const SPOT = { x: 560, y: 944, s: 0.62 };          // Rerun's mark on the shore (the guides' rerunHome beat)
const BOXAT = { x: 800, y: 936, w: 150 };          // the box on the sand, to Rerun's right

// The box, small, standing on the sand: the film's own box() with no floor, scaled into place.
function smallBox(v) {
  const items = box(v, { floorGrid: false, shadow: false, edgeWidth: 3 }).slice(1);
  const k = BOXAT.w / 330, m = [k, 0, 0, k, BOXAT.x - 960 * k, BOXAT.y - 760 * k];
  return items.map((it) => ({ ...it, shape: transform(it.shape, m), width: (it.width || 0) * k * 2.4 }));
}

export function prepare(A) {
  A.host = { box: smallBox(view({ yaw: 30, pitch: 16, dist: 12 })), floor: box(view({ yaw: 30, pitch: 18, dist: 13 })) };
}

// Rerun's pose at time u of its knock (the guides' own "action" clip), or idle when u is null.
function crab(u, extra = {}) {
  const beat = { x: SPOT.x, y: SPOT.y, s: SPOT.s, o: { clawR: 0, look: [4, -3] } };
  const b = u == null ? { ...beat, o: { ...beat.o, ...extra }, offset: [0, 0] } : clipBeat("rerun", "action", beat, Math.min(u, 1.75));
  const o = { ...b.o, ...extra }, x = SPOT.x + (b.offset ? b.offset[0] : 0), y = SPOT.y + (b.offset ? b.offset[1] : 0);
  return [{ shape: [contour(ellipseShape(x, y, 120 * SPOT.s, 22 * SPOT.s), true)], fill: [0, 0, 0, 0.45] }, ...pose(rerun(o), { x, y, s: SPOT.s, squash: o.squash || 0 })];
}
function ellipseShape(cx, cy, rx, ry) {
  const p = [];
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; p.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); }
  return p;
}

// Knock marks on the box at each strike of the clip (0.75 s and 1.3 s into it).
function knocks(u) {
  const out = [], hit = (u > 0.75 && u < 0.98) || (u > 1.3 && u < 1.53);
  if (!hit) return out;
  for (const [dx, dy, w] of [[-14, -14, 14], [40, -18, 14], [-18, 10, 10], [44, 12, 10]])
    out.push({ shape: [contour([BOXAT.x - 60 + dx, BOXAT.y - 70 + dy, BOXAT.x - 60 + dx + w, BOXAT.y - 70 + dy], false)], stroke: "#efe6cf", width: 8 });
  return out;
}

// The scene behind Rerun: the shore, or the film's floor.
function ground(A, items) {
  if (HOST_STYLE === "shore") return world("pixel", A.guide, [{ d: 0, items: [...A.host.box, ...items] }], { t: 0 });
  return { items: [{ shape: [contour([0, 0, 1920, 0, 1920, 1080, 0, 1080], true)], fill: [0.05, 0.05, 0.08] }, ...A.host.floor, ...items], front: [], camera: { x: 960, y: 540, zoom: 1 } };
}

// One host frame. phase "open" plays the knock and steps into the shell over [0, H.end];
// phase "close" steps back out of the shell over [H.start, H.start + 1.6] and holds.
export function frame(t, A, H, phase) {
  const u = phase === "open" ? t - H.knock : null;
  const look = phase === "close" ? { look: [0, 0], stalk: 1.15, flare: 1 } : {};
  const w = ground(A, [...crab(u, look), ...(phase === "open" ? knocks(u) : [])]);
  // The push: zoom steps toward the shell (open) or away from it (close).
  const p = phase === "open" ? span(t, H.push, H.end, ease.linear) : 1 - span(t, H.start, H.start + 1.6, ease.linear);
  const z = STEPS[Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))];
  const sx = SPOT.x + FLARE[0] * 0.3 * SPOT.s, sy = SPOT.y - 220 * SPOT.s;
  const cam = z === 1 ? w.camera : { x: Math.round(lerp(w.camera.x, sx, 1) / 8) * 8, y: Math.round(lerp(w.camera.y, sy, 1) / 8) * 8, zoom: z };
  const L = LOOKS.pixel;
  return { background: L.ground, camera: cam, items: [...w.items, ...w.front], post: L.post, pixel: { width: 480 / z, height: 270 / z, mode: "integer" } };
}

// The flash of light where the camera passes through the glass: one frame-filling glint that
// hides the change from pixel mode to the lens. Added on top of the lens frame.
export function glint(t, at, items) {
  const g = 1 - span(t, at, at + 0.35, ease.out);
  if (g <= 0 || t < at) return;
  items.push({ shape: [contour([0, 0, 1920, 0, 1920, 1080, 0, 1080], true)], fill: C.glass, opacity: 0.55 * g, blend: "add", screen: true });
}
