// "How a 1998 engine drew a frame" as a Motion scene: one file for the video and the live
// version. The script, sources and timing are the film's own files (film.json, evidence.json,
// timing.json); this scene adds no claim. Every cue is a sentence or word time from timing.json,
// so the pictures re-time when the real narration replaces the provisional timing.
// Host: Tallow, in his home style (the retro thriller) for the cold open and the close.
import { C, cues, put, clearCaptionArea, stroke, image, box, contour, text, tabShape, loadImages, span, window, ease, lerp, lerpLog } from "./scene/lib.mjs";
import * as world from "./scene/world.mjs";
import * as room from "./scene/room.mjs";
import * as plates from "./scene/plates.mjs";
import * as surface from "./scene/surface.mjs";
import * as close from "./scene/close.mjs";

const FPS = 30;
const PLAIN = { bloom: 0.35, threshold: 0.85, vignette: 0.3, grain: 0.008 };
// The title's tube: raw-native's physical CRT, preset vga-14 (a 14-inch VGA monitor, delta mask).
const TUBE = { bloom: 0, vignette: 0, grain: 0, passes: [{ pass: "crt", preset: "vga-14", source: [320, 240], view: { zoom: 1.5 } }] };

export default {
  title: "How a 1998 engine drew a frame",
  duration: 230,
  fps: FPS,
  design: [1920, 1080],
  chapters: [],
  params: [],
  async load(ctx) {
    const [sans, head, mono, timing, evidence, tree, rosewood, film] = await Promise.all([
      ctx.json("../motion/hanken-500.json"), ctx.json("../motion/hanken-650.json"), ctx.json("../motion/conso-400.json"),
      ctx.json("timing.json"), ctx.json("evidence.json"), ctx.json("frames/source-tree.json"), ctx.json("frames/rosewood.json"), ctx.json("film.json")]);
    await loadImages(ctx, [...world.IMAGES, ...close.IMAGES].map(([name, file, k]) => ({ name, file: "frames/" + file, k: k ?? 1 })));
    const c = cues(timing), A = { sans, head, mono, tree, rosewood, evidence };
    // The film ends after the host's close (film.json host.close.seconds), as provisional_timing.duration says.
    const end = c.last + film.host.close.seconds;
    this.duration = end;
    const T = {
      // Segment 0 and 1: the room (room.mjs).
      room: { strike: 0.25, title: c.at(0, 0) + 0.2, push: c.end(0, 0) - 0.6, fill: c.end(0, 0) + 0.9, pull: c.at(1, 0, 0), back: c.at(1, 0, 0) + 3.2,
        argonaut: c.word(1, 0, 0, "Argonaut"), games: c.at(1, 0, 1), v132: c.word(1, 1, 0, "a 1998 version"), exit: c.at(2, 0, 0) - 0.6 },
      ladder: c.word(2, 0, 1, "ladder"), programs: c.word(2, 0, 1, "twenty-one"), ask: c.ask(2, 0), s3: c.at(3, 0),
      // Segments 3 and 4 (plates.mjs).
      matrix: c.word(3, 0, 0, "a perspective matrix"), project: c.word(3, 0, 0, "turns 3D points"), cube: c.at(3, 1, 0), cubeImg: c.at(3, 1, 0) + 1.8,
      graph: c.at(3, 1, 1), asOne: c.word(3, 1, 1, "moves them as one"), s4: c.at(4, 0), rows: c.at(4, 0) + 0.3, depth: c.at(4, 1),
      gouraud: c.at(4, 2), round: c.word(4, 2, 0, "round"), s5: c.at(5, 0),
      // Segment 5 (surface.mjs).
      split: c.at(5, 0, 0), divide: c.word(5, 0, 1, "a division"), wobble: c.at(5, 1), models: c.at(5, 2), globe: c.word(5, 2, 0, "a globe"),
      twelve: c.word(5, 2, 0, "twelve"), palette: c.end(5, 2) + 0.3, s6: c.at(6, 0, 0),
      // Segments 6 to 8.
      lit: c.word(6, 0, 0, "all twenty-one"), sphere: c.word(6, 0, 0, "draws a lit sphere"), gap: c.at(6, 0, 1), modern: c.at(6, 1), bit64: c.word(6, 1, 0, "64-bit"),
      s7: c.at(7, 0), game: c.word(7, 0, 0, "play a short game"), s8: c.at(8, 0), voice: c.at(8, 1, 0), sources: c.at(8, 1, 1), end,
    };
    T.paletteEnd = T.s6 - 0.2;
    A.T = T;
    world.prepare(A); room.prepare(A); plates.prepare(A); surface.prepare(A); close.prepare(A, T);
    // Rung frames fill as the narration reaches them; every rung lights when segment 6 says they pass.
    const fillAt = { 0: c.word(3, 0, 0, "vectors"), 1: c.word(3, 0, 0, "the engine starting"), 2: T.cubeImg, 3: c.word(3, 1, 1, "scene graph"), 4: T.rows + 3.6,
      5: T.depth + 3.6, 10: T.round + 2.2, 6: T.split + 0.6, 7: T.models, 8: T.globe, 9: T.twelve, 20: T.sphere };
    A.fillAt = world.RUNGS.map((_, i) => fillAt[i] ?? T.lit + i * 0.09);
    // Statements: key words under the source tab, never in the caption area.
    const st = (s, size = 44, y = 150, atlas = head) => text(s, { atlas, size, x: 96, y }).shape;
    const tag = (s) => text(s, { atlas: sans, size: 30, x: 96, y: 198 }).shape;
    A.statements = [
      [st("21 programs"), T.programs, T.ask.start - 0.2],
      // The predict pause (approved by the author, 2026-10-14): the question is spoken, then the empty ladder holds in silence.
      [st(T.ask.text), T.ask.start, T.s3 - 0.3],
      [st("per-face lighting"), T.rows + 0.4, T.depth, tag("drawn by the portable C path")],
      [st("per-pixel occlusion"), T.depth + 0.4, T.gouraud, tag("drawn by the portable C path")],
      [st("a divide per pixel"), T.divide, T.wobble],
      [st("7x faster . looks wrong"), T.wobble + 0.4, T.models, tag("one test, on one machine")],
      [st("12-part coupe . BrModelLoadMany"), T.globe, T.palette + 0.4],
      [st("8-bit index, 256-colour palette"), T.palette + 0.3, T.paletteEnd],
      [st("21/21 . Win32 . 27 Aug 2026 . final_frame_lit 19,284", 40), T.lit, T.modern],
      [st("21/21 . x64 . BRender 1.4 . 10 Oct 2026", 40), T.bit64, T.s7],
    ];
    A.statementText = ["21 programs", T.ask.text, "per-face lighting", "per-pixel occlusion", "a divide per pixel", "7x faster . looks wrong", "12-part coupe . BrModelLoadMany",
      "8-bit index, 256-colour palette", "21/21 . Win32 . 27 Aug 2026 . final_frame_lit 19,284", "21/21 . x64 . BRender 1.4 . 10 Oct 2026"];
    A.tabs = [["brender-wiki", T.room.pull, T.room.v132], ["foone", T.room.v132, T.ladder - 1], ["brender-readme", T.ladder - 1, T.gouraud, "21 rungs"],
      ["gouraud1971", T.gouraud, T.s5, "method via a secondary summary"], ["brender-readme", T.s5, T.divide], ["hecker1995", T.divide, T.models, "one test on the author's machine"],
      ["brender-readme", T.models, T.palette], ["rosewood-texel", T.palette, T.s6], ["brender-readme", T.s6, T.modern], ["brender-modern", T.modern, T.s7, "21 programs"],
      ["brender-readme", T.s7, T.s8]].map(([id, t0, t1, extra]) => ({ id, shape: tabShape(evidence, mono, id, extra), t0, t1 }));
    this.chapters = [["How a 1998 engine drew a frame", 0], ["The engine", c.at(1, 0)], ["A ladder, not a leap", c.at(2, 0)], ["Points to lines", c.at(3, 0)],
      ["Filling and hiding", c.at(4, 0)], ["Pictures on surfaces", c.at(5, 0)], ["Where the rebuild stands", c.at(6, 0)], ["What you can run", c.at(7, 0)],
      ["One thing to keep", c.at(8, 0)]].map(([title, t]) => ({ title, t: Math.max(0, t - 0.4) }));
    A.cams = cameraKeys(T);
    return A;
  },
  frame(t, ctx) {
    const A = ctx.assets, T = A.T, items = [];
    const inRoom = t < T.room.exit + 1.6;
    if (inRoom && room.tubeMode(t, T.room)) {
      room.draw(t, A, T.room, items, null);
      return { background: [0, 0, 0], camera: { x: 960, y: 540, zoom: 1 }, items, post: TUBE };
    }
    const camera = inRoom && t < T.room.exit ? room.camera(t, T.room) : cam(A.cams, t, ctx.reduced);
    const towerIn = span(t, T.room.exit - 0.2, T.ladder + 0.8);
    if (towerIn > 0) {
      world.draw(t, A, {
        opacity: 1, draw: span(t, T.room.exit, T.ladder + 2.2, ease.smooth), labels: camera.zoom > 0.9 ? span(camera.zoom, 0.9, 1.2) : 0,
        fill: (i) => span(t, A.fillAt[i], A.fillAt[i] + 0.9), lit: (i) => span(t, T.lit + i * 0.095, T.lit + i * 0.095 + 0.3),
        gap: span(t, T.gap, T.gap + 1.0), orbit: (t - T.sphere) * 4,
      }, items);
      plates.draw(t, A, T, items);
      surface.draw(t, A, T, items);
      close.drawWorld(t, A, T, items, camera);
    }
    clearCaptionArea(items, camera);
    if (inRoom) room.draw(t, A, T.room, items, camera);
    close.drawHost(t, A, T, items);
    for (const [shape, t0, t1, tg] of A.statements) {
      const a = window(t, t0, t1, 0.6, 0.6);
      put(items, shape, C.ink, a, { screen: true });
      if (tg) put(items, tg, C.ink2, a, { screen: true });
    }
    for (const tb of A.tabs) put(items, tb.shape, C.dim, window(t, tb.t0, tb.t1, 0.6, 0.6), { screen: true });
    const hostStyle = inRoom || t >= T.s8;
    return { background: hostStyle ? [0.012, 0.011, 0.014] : C.void, camera, items, post: inRoom ? room.THRILLER_POST : PLAIN };
  },
};

// Camera keys: [start, end, camera] moves from the previous camera over [start, end] with
// smootherstep in position and log-linear zoom (bible 4.2).
function cameraKeys(T) {
  const Y = world.rungY, all = { x: 960, y: (world.TOP + world.BASE) / 2, zoom: 0.235 };
  return [
    [0, 0, all],
    [T.s3 - 0.4, T.s3 + 2.6, { x: 960, y: (Y(0) + Y(1)) / 2, zoom: 1.5 }],
    [T.matrix - 1.6, T.matrix + 0.6, { x: 1528, y: Y(2), zoom: 1.6 }],
    [T.graph - 0.6, T.graph + 1.6, { x: 437, y: Y(3), zoom: 1.6 }],
    [T.s4 - 0.6, T.s4 + 1.6, { x: 1592, y: Y(4) - 10, zoom: 1.6 }],
    [T.depth - 0.6, T.depth + 1.4, { x: 428, y: Y(5) - 10, zoom: 1.6 }],
    [T.gouraud - 0.4, T.gouraud + 2.4, { x: 1452, y: Y(10), zoom: 1.6 }],
    [T.s5 - 0.6, T.s5 + 2.4, { x: 1787, y: Y(6) + 10, zoom: 1.28 }],
    [T.models - 0.6, T.models + 1.8, { x: 960, y: Y(8), zoom: 1.2 }],
    [T.palette - 0.4, T.palette + 1.0, { x: -330, y: Y(8) + 40, zoom: 1.4 }],
    [T.s6 - 0.3, T.lit + 0.4, all],
    [T.sphere - 0.8, T.sphere + 1.2, { x: 960, y: Y(20) - 60, zoom: 1.5 }],
    [T.modern - 0.4, T.modern + 2.2, { ...all, x: 1380, zoom: 0.21 }],
    ...close.cameraKeys(T, all),
  ];
}
function cam(keys, t, reduced) {
  let prev = keys[0][2];
  for (let k = 1; k < keys.length; k++) {
    const [a, b, c] = keys[k];
    if (t < a) return prev;
    if (t < b) {
      const u = reduced ? 1 : span(t, a, b, ease.smooth);
      return { x: lerp(prev.x, c.x, u), y: lerp(prev.y, c.y, u), zoom: lerpLog(prev.zoom, c.zoom, u) };
    }
    prev = c;
  }
  return prev;
}
