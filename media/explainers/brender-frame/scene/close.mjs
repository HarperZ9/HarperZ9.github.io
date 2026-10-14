// Segments 6.3 to 8: the 64-bit ladder beside the period one, what you can run today (the
// viewer and the game, at the foot of the tower), and the close. At the close Tallow comes
// back in his home style, looks up at the one frame nobody claims, and lets the viewer go.
import { C, put, putL, stroke, image, box, contour, rect, text, span, window, ease, lerp } from "./lib.mjs";
import { rungY, RUNGS, BASE, TOP } from "./world.mjs";
import { tallow } from "./room.mjs";

export const IMAGES = Array.from({ length: 8 }, (_, k) => [`kh${k}`, `keepers-lamp-${k}.png`]);
const L64 = 1800, RAIL = 70;
const VIEWER = { x: -1000, y: 1450, w: 800, h: 480 }, GAME = { x: 2120, y: 1480, w: 800, h: 450 };
// brview's bundled scenes (brender-archival modern/viewer/brview_scenes.c), names only.
const SCENES = ["Earth (sph32.dat, earth.pix)", "Utah teapot (teapot.dat)", "Skull (skull.dat)", "Argonaut logo (argo.dat)",
  "Spaceship (ship.dat)", "Duck (duck.dat)", "Torus (torus.dat, rosewood.pix)", "Terrain (terrain.dat)"];

export function prepare(A, T) {
  const t = (s, o) => text(s, o).shape;
  A.close = {
    rails: [contour([L64 - RAIL, BASE - 120, L64 - RAIL, rungY(20) - 120], false), contour([L64 + RAIL, BASE - 120, L64 + RAIL, rungY(20) - 120], false)],
    rungs: RUNGS.map((_, i) => [contour([L64 - RAIL, rungY(i), L64 + RAIL, rungY(i)], false)]),
    names: [t("1.3.2 . Win32", { atlas: A.head, size: 150, x: 960 - 720, y: 0, anchor: "right" }), t("1.4 . x64", { atlas: A.head, size: 150, x: L64 + 160, y: 0, anchor: "left" })],
    viewer: { frame: box(VIEWER.x, VIEWER.y, VIEWER.w, VIEWER.h), bar: rect(VIEWER.x, VIEWER.y, VIEWER.w, 48),
      title: t("brview: BRender on a modern PC", { atlas: A.mono, size: 24, x: VIEWER.x + 20, y: VIEWER.y + 33 }),
      list: SCENES.map((s, k) => t(s, { atlas: A.mono, size: 26, x: VIEWER.x + 40, y: VIEWER.y + 100 + k * 44 })),
      note: t("viewer frames not recorded for this draft", { atlas: A.sans, size: 26, x: VIEWER.x + VIEWER.w / 2, y: VIEWER.y + VIEWER.h + 50, anchor: "center" }) },
    game: { frame: box(GAME.x, GAME.y, GAME.w, GAME.h), note: t("lamp room, one sweep, BRender's software rasteriser", { atlas: A.sans, size: 26, x: GAME.x + GAME.w / 2, y: GAME.y + GAME.h + 50, anchor: "center" }) },
    st: {
      viewer: t("brview . free download", { atlas: A.head, size: 44, x: 96, y: 150 }),
      game: t("The Keeper's Hour", { atlas: A.head, size: 44, x: 96, y: 150 }),
      keep: t("Rebuild in steps you can check.", { atlas: A.head, size: 52, x: 960, y: 150, anchor: "center" }),
      voice: t("The voice is synthesized . Sources under the video", { atlas: A.sans, size: 30, x: 960, y: 214, anchor: "center" }),
    },
  };
  A.closeText = ["1.3.2 . Win32", "1.4 . x64", "brview . free download", "The Keeper's Hour", "Rebuild in steps you can check.", "The voice is synthesized . Sources under the video", ...SCENES];
}

export function cameraKeys(T, all) {
  return [
    [T.s7 - 0.4, T.s7 + 2.4, { x: VIEWER.x + VIEWER.w / 2 - 170, y: VIEWER.y + VIEWER.h / 2 - 70, zoom: 1.6 }],
    [T.game - 0.4, T.game + 2.6, { x: GAME.x + GAME.w / 2 - 170, y: GAME.y + GAME.h / 2 - 70, zoom: 1.6 }],
    [T.s8 - 0.6, T.s8 + 4.0, { ...all, x: 1500, y: all.y - 120, zoom: 0.205 }],
  ];
}

export function drawWorld(t, A, T, items) {
  const K = A.close;
  const m = span(t, T.modern - 0.2, T.modern + 1.2);
  if (m > 0) {
    stroke(items, K.rails, C.ink, 3, m);
    K.rungs.forEach((r, i) => { const lit = span(t, T.bit64 + i * 0.095, T.bit64 + i * 0.095 + 0.3); stroke(items, r, lit > 0 ? C.ok : C.ink, 3.5, m * (0.6 + 0.4 * lit)); });
    K.names.forEach((s) => putL(items, s, C.ink2, m));
  }
  const v = span(t, T.s7 - 0.6, T.s7 + 0.6);
  if (v > 0) {
    const W = K.viewer;
    items.push({ shape: W.bar, fill: "#1e1e22", opacity: v });
    stroke(items, W.frame, C.ink2, 2.5, v);
    putL(items, W.title, C.ink, v);
    W.list.forEach((s, k) => putL(items, s, k === 6 ? C.ink : C.ink2, v * span(t, T.s7 + 0.3 + k * 0.15, T.s7 + 0.8 + k * 0.15)));
    putL(items, W.note, C.ink2, v);
  }
  const g = span(t, T.game - 0.6, T.game + 0.6);
  if (g > 0) {
    const G = K.game, k = Math.floor(Math.max(0, t - T.game) * 2) % 8;
    items.push(image(`kh${k}`, GAME.x, GAME.y, GAME.w, GAME.h, g));
    stroke(items, G.frame, C.ink2, 2.5, g);
    putL(items, G.note, C.ink2, g);
  }
}

// Statements of segments 7 and 8, and Tallow at the close (screen space, his own glow).
export function drawHost(t, A, T, items) {
  const S = A.close.st;
  put(items, S.viewer, C.ink, window(t, T.s7 + 0.4, T.game, 0.6, 0.6), { screen: true });
  put(items, S.game, C.ink, window(t, T.game + 0.4, T.s8, 0.6, 0.6), { screen: true });
  const h = span(t, T.s8 + 0.4, T.s8 + 2.0);
  if (h <= 0) return;
  const out = 1 - span(t, T.end - 1.4, T.end);
  const look = span(t, T.voice - 0.6, T.voice + 0.6);
  const o = { prop: "loupe", armR: 22, elbR: 140, lid: lerp(0.45, 0.25, look), look: [lerp(7, 2, look), lerp(-10, 0, look)], lean: lerp(8, 0, look) };
  const g = tallow(t, { x: 330, y: 1060, s: 0.78, o }, null, { style: "soft", screen: true });
  for (const it of [...g.body, ...g.light]) items.push({ ...it, opacity: (it.opacity ?? 1) * h * out });
  put(items, S.keep, C.ink, h * out, { screen: true });
  put(items, S.voice, C.ink2, span(t, T.voice, T.voice + 0.8) * out, { screen: true });
}
