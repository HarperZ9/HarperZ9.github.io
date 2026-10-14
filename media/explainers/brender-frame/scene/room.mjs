// The host beats, in Tallow's home style (the retro thriller: one practical light, film stock,
// a soft tube). Cold open: the night desk is dark; a match strikes and Tallow lights himself.
// His light finds a period monitor showing a 1998 frame (gallery 09), the title sits in his
// first light, and the camera pushes into the tube until its delta mask shows (segment 0).
// Segment 1 pulls back to the room. The close (segment 8) brings him back at the foot of the
// tower. He reacts as CHARACTERS.md says and decides nothing for the viewer.
import { GUIDES, pose } from "../../../raw-native/tree-dev/templates/guides/guides.mjs";
import { thrillerSet } from "../../../raw-native/tree-dev/templates/guides/sets.mjs";
import { clipBeat, CLIPS } from "../../../raw-native/tree-dev/templates/guides/motion.mjs";
import { LOOKS } from "../../../raw-native/tree-dev/templates/guides/look.mjs";
import { C, put, image, rect, text, transform, span, window, ease, lerp, lerpLog } from "./lib.mjs";

const G = GUIDES.tallow;
// The monitor on the desk, in the room's 1920 x 1080 design frame; its screen is 4:3.
export const SCREEN = { x: 1210, y: 400, w: 320, h: 240 };
const SC = [SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2];
// Zoom at which the screen covers the whole frame.
export const FILL = Math.max(1920 / SCREEN.w, 1080 / SCREEN.h) * 1.04;
const HOME = { x: 700, y: 985, s: 0.88 };

function monitor() {
  const x = SCREEN.x, y = SCREEN.y, w = SCREEN.w, h = SCREEN.h, ink = "#0b0a0c";
  return [
    { shape: rect(1040, 742, 680, 30, 4), fill: "#2b2119", stroke: ink, width: 3 },          // the desk top
    { shape: rect(1080, 772, 24, 300), fill: "#1d1611", stroke: ink, width: 2 }, { shape: rect(1656, 772, 24, 300), fill: "#1d1611", stroke: ink, width: 2 },
    { shape: rect(x - 50, y - 44, w + 100, h + 120, 18), fill: "#cbc2a8", stroke: ink, width: 3 },   // the case, period beige
    { shape: rect(x - 18, y - 16, w + 36, h + 32, 10), fill: "#2c2a26", stroke: ink, width: 2 },     // the bezel
    { shape: rect(x + w - 40, y + h + 38, 22, 12, 3), fill: "#6c8a4a", stroke: ink, width: 1.5 },     // the power lamp
    { shape: rect(x + 70, y + h + 76, w - 140, 24, 4), fill: "#b8ae94", stroke: ink, width: 2 },      // the stand
  ];
}

export function prepare(A) {
  A.room = {
    set: thrillerSet({}),
    monitor: monitor(),
    title: text("How a 1998 engine drew a frame.", { atlas: A.head, size: 64, x: 96, y: 112 }).shape,
    games: [text("Carmageddon", { atlas: A.sans, size: 44, x: 96, y: 300 }).shape, text("Croc", { atlas: A.sans, size: 44, x: 96, y: 360 }).shape],
    gamesNote: text("games named by the article; credits not checked", { atlas: A.sans, size: 26, x: 96, y: 404 }).shape,
    argonaut: text("Argonaut Software . BRender", { atlas: A.sans, size: 40, x: 96, y: 170 }).shape,
    v132: text("BRender 1.3.2 . about November 1998 . MIT", { atlas: A.sans, size: 40, x: 96, y: 170 }).shape,
    tree: A.tree.paths.map((p, k) => text(p, { atlas: A.mono, size: 24, x: 96, y: 0 })),
  };
}

// Tallow as items: his shadow, his pose, his light. o is the pose; cam the camera; light
// style "thriller" (darkness outside his circle) or "soft" (a glow only, for the tower).
export function tallow(t, b, cam, { clip = "idle", style = "thriller", screen = false } = {}) {
  const beat = clipBeat("tallow", clip, { ...b, o: b.o }, ((t % CLIPS[clip]) + CLIPS[clip]) % CLIPS[clip]);
  const x = b.x + beat.offset[0], y = b.y + beat.offset[1];
  const o = { ...beat.o, flame: (b.o.flame ?? 1) * (beat.o.flame ?? 1) };
  const body = [...G.under(x, y, b.s, "thriller"), ...pose(G.parts(o), { x, y, s: b.s, yaw: b.yaw || 0, shear: G.shear })];
  if (screen) for (const it of body) it.screen = true;
  const lightCam = screen ? { x: 960, y: 540, zoom: 1 } : cam;
  const light = G.light(style === "thriller" ? "thriller" : "painted", lightCam, { x, y, s: b.s, o });
  return { body, light };
}

// The cold open and segment 1. T: { strike, title, push, fill, pull, back, argonaut, games, v132, exit }.
export function camera(t, T) {
  if (t < T.push) return { x: 960, y: 540, zoom: 1 };
  if (t < T.pull) { const u = span(t, T.push, T.fill, ease.smooth); return { x: lerp(960, SC[0], u), y: lerp(540, SC[1], u), zoom: lerpLog(1, FILL, u) }; }
  const u = span(t, T.pull, T.back, ease.smooth);
  return { x: lerp(SC[0], 960, u), y: lerp(SC[1], 540, u), zoom: lerpLog(FILL, 1, u) };
}
// While the screen fills the frame, the frame is the tube's own signal: gallery 09 stretched to
// the frame, which the crt pass box-filters back to 320 x 240.
export const tubeMode = (t, T) => t >= T.fill && t < T.pull;

export function draw(t, A, T, items, cam) {
  const R = A.room, vis = 1 - span(t, T.exit, T.exit + 1.6);
  if (vis <= 0) return;
  if (tubeMode(t, T)) { items.push(image("g09", 0, 0, 1920, 1080, 1, { screen: true })); return; }
  const flame = span(t, T.strike, T.strike + 0.5, ease.out);
  if (flame <= 0) return;
  items.push(...R.set.map((it) => ({ ...it, opacity: (it.opacity ?? 1) * vis })), ...R.monitor.map((it) => ({ ...it, opacity: (it.opacity ?? 1) * vis })));
  items.push(image("g09", SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, vis * span(t, T.strike + 0.3, T.strike + 1.3)));
  // His pose: at the strike the arm comes down from the wick; on the source tree he leans the
  // flame toward the source tab (a number with a source: he lights the line that names it).
  const toTab = window(t, T.v132, T.exit, 1.0, 0.8);
  const o = { armR: lerp(160, 40, flame), elbR: lerp(20, 110, flame), prop: null, lid: lerp(0.6, 0.2, flame), look: [lerp(8, -8, toTab), lerp(-2, -8, toTab)], lean: lerp(10, -22, toTab), flame: 0.05 + 0.95 * flame };
  const g = tallow(t, { ...HOME, o }, cam);
  items.push(...g.body.map((it) => ({ ...it, opacity: (it.opacity ?? 1) * vis })), ...g.light.map((it) => ({ ...it, opacity: (it.opacity ?? 1) * vis })));
  // Words in his light, on top of the darkness.
  put(items, R.title, C.ink, vis * window(t, T.title, T.push + 0.9, 0.8, 0.8), { screen: true });
  put(items, R.argonaut, C.ink, vis * window(t, T.argonaut, T.v132, 0.8, 0.6), { screen: true });
  const g2 = vis * window(t, T.games, T.v132, 0.8, 0.6);
  R.games.forEach((s) => put(items, s.shape ?? s, C.ink2, g2, { screen: true }));
  put(items, R.gamesNote, C.ink2, g2 * 0.9, { screen: true });
  const tv = vis * window(t, T.v132, T.exit + 1.4, 0.8, 0.8);
  put(items, R.v132, C.ink, tv, { screen: true });
  // The 1.3.2 source tree as a column of file names (names only), scrolling up under the label.
  if (tv > 0) {
    const scroll = (t - T.v132) * 46;
    R.tree.forEach((run, k) => {
      const y = 260 + k * 34 - scroll;
      if (y < 230 || y > 740) return;
      const edge = Math.min(1, (y - 230) / 80, (740 - y) / 80);
      items.push({ shape: transform(run.shape, [1, 0, 0, 1, 0, y]), fill: C.dim, opacity: tv * edge * 0.85, screen: true });
    });
  }
}

export const THRILLER_POST = LOOKS.thriller.post;
export { HOME };
