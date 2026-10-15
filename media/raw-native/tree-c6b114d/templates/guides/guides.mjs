// The three guide concepts as a registry: each one's parts, its sheet poses, how it lights a
// scene, and its beat in each template world. Beats (props and on-screen key terms) are in
// beats.mjs.
import { pose, ellipse, rad, P } from "./rig.mjs";
import { tallow, FLAME } from "./tallow.mjs";
import { pylon, pylonTextures, coneParts } from "./pylon.mjs";
import { rerun, FLARE } from "./rerun.mjs";
import { BEATS } from "./beats.mjs";
import { darkness, glow, toScreen, THRILLER } from "./look.mjs";

// Contact shadows. Pixel: one hard-edged translucent ellipse, which the palette turns into the
// ground's own darker colour. Painted and thriller: a soft wide shadow and a dark core where
// the feet meet the ground, so the figure sits on the floor instead of over it.
const shadow = (x, y, s, w = 160, style) => (style === "pixel"
  ? [{ shape: P(ellipse(x, y, w * s * 0.8, w * s * 0.16)), fill: [0, 0, 0, 0.45] }]
  : [{ shape: P(ellipse(x, y, w * s * 1.1, w * s * 0.26)), fill: rad(x, y, w * s * 1.1, [0, [0, 0, 0, 0.5]], [1, [0, 0, 0, 0]]) },
    { shape: P(ellipse(x, y, w * s * 0.62, w * s * 0.11)), fill: rad(x, y, w * s * 0.62, [0, [0.01, 0.01, 0.02, 0.85]], [0.7, [0.01, 0.01, 0.02, 0.5]], [1, [0, 0, 0, 0]]) }]);

export const GUIDES = {
  tallow: {
    title: "Tallow, the night clerk", subtitle: "Home style: retro thriller. The wax is the budget of hours; the flame is what has been checked.",
    parts: tallow, rest: {}, sheetScale: 0.49, shear: 0.03,
    under: (x, y, s, st) => shadow(x, y, s, 150, st),
    poses: [
      { name: "asks first", o: { armR: 160, prop: "card", look: [6, -7], lid: 0.15, lean: 10 } },
      { name: "an estimate: the flame gutters", o: { armR: 22, elbR: 140, prop: "loupe", lid: 0.62, flame: 0.62, lean: -22 }, yaw: 20 },
      { name: "a false claim goes blank", o: { armR: 45, elbR: 45, prop: "blank", lid: 0.35, mouth: 1, lean: 24, look: [-6, 4] }, yaw: -15 },
      { name: "one more drip for the jar", o: { armL: -8, elbL: -78, propL: "jar", armR: 30, elbR: 110, prop: null, lid: 0.55, mouth: 0.6, look: [-9, 6] } },
    ],
    light(style, cam, b) {
      const [fx, fy] = toScreen(cam, b.x + FLAME[0] * b.s, b.y + FLAME[1] * b.s), k = cam.zoom * b.s, fl = (b.o && b.o.flame) ?? 1;
      if (style === "thriller") return [darkness(fx, fy + 260 * k, 1500 * k, (0.93 + 0.05 * (1 - fl)) * THRILLER.dark), glow(fx, fy, 700 * k * (0.6 + 0.4 * fl), [1, 0.6, 0.25], 0.55 * fl)];
      // No glow in pixel mode: a smooth falloff posterises into rings on a fixed palette.
      return style === "pixel" ? [] : [glow(fx, fy, 520 * k * (0.6 + 0.4 * fl), [1, 0.62, 0.3], 0.35 * fl)];
    },
  },
  pylon: {
    title: "Pylon, the claims inspector", subtitle: "Home style: painted isometric. A cone marks a claim nobody has checked yet.",
    parts: pylon, rest: {}, sheetScale: 0.62, textures: pylonTextures,
    under: (x, y, s, st) => shadow(x, y + 4 * s, s, 210, st),
    poses: [
      { name: "your call", o: { tilt: 8, lid: 0.5, flipR: 55, look: [2, 2] } },
      { name: "balances a claim, learns nothing", o: { tilt: -3, lid: 0.55, card: true, look: [3, -8] } },
      { name: "an estimate: a 15 degree tilt", o: { tilt: 15, lid: 0.5 }, yaw: 15 },
      { name: "noted (one bark)", o: { bark: 0.7, lid: 0.55, tilt: 3, look: [0, -4], flipL: 25 } },
    ],
    light(style, cam, b) {
      const [cx, cy] = toScreen(cam, b.x, b.y - 560 * b.s), k = cam.zoom * b.s;
      if (style === "thriller") return [darkness(cx, cy + 380 * k, 1300 * k, 0.9 * THRILLER.dark), glow(cx, cy, 300 * k, [1, 0.42, 0.1], 0.4)];
      return [];
    },
  },
  rerun: {
    title: "Rerun, the hermit crab", subtitle: "Home style: pixel 2.5D. The glass shell is the evidence a claim carries with it.",
    parts: rerun, rest: {}, sheetScale: 0.82,
    under: (x, y, s, st) => shadow(x, y, s, 190, st),
    poses: [
      { name: "knock knock", o: { clawR: 70, look: [4, -3] } },
      { name: "reads the small print", o: { stalk: 1.6, look: [0, -6] }, yaw: 20 },
      { name: "a range: walks to each end", o: { clawL: 20 }, yaw: 70 },
      { name: "the pretty shell (empty)", o: { shell: "pretty", stalk: 1.2, look: [-4, -2], flare: 0 }, yaw: -20 },
    ],
    light(style, cam, b) {
      const [fx, fy] = toScreen(cam, b.x + FLARE[0] * b.s, b.y + FLARE[1] * b.s), k = cam.zoom * b.s;
      if (style === "thriller") return [darkness(fx - 120 * k, fy + 200 * k, 1100 * k, 0.92 * THRILLER.dark), glow(fx, fy, 260 * k, [0.8, 0.9, 1], 0.35)];
      return style === "pixel" ? [] : [glow(fx, fy, 160 * k, [1, 1, 1], 0.25)];
    },
  },
};
for (const [k, g] of Object.entries(GUIDES)) g.beats = BEATS[k];
export { pose, coneParts };
