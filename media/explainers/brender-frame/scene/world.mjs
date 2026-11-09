// The world: a ladder of 21 rungs inside a tall tower, drawn as plotter line-work. The tower
// is the lighthouse of The Keeper's Hour. Each rung has a frame that fills with that rung's
// real output (brender-archival gallery, MIT) when the narration reaches it, and every rung
// lights lime when segment 6 says the ladder passes. Rung names are the README table's.
import { C, put, putL, stroke, image, box, contour, rect, trim, text, span, window, ease, clamp01 } from "./lib.mjs";

// The README table, in order (brender-archival README, "Rung | What it proves").
export const RUNGS = [
  "Vector math", "Framework startup", "Wireframe", "Scene graph", "Solid shaded", "Depth buffer", "Textured",
  "Datafile models", "UV-textured models", "Multi-part assembly", "Gouraud shading", "Plotter lane", "Asset audit",
  "Pixelmap audit", "Material audit", "Pixelmap round trip", "Material resolve", "File-texture sampling", "Game shell",
  "Host semantic", "Period pipeline",
];
// The gallery frame each rung shows; rungs without one show their name as a log tile.
export const OUTPUT = { 2: "g01", 3: "g02", 4: "g03", 5: "g04", 6: "g05", 7: "g06", 8: "g07", 9: "g08", 10: "g09", 11: "g10", 20: "orbit" };
export const IMAGES = [
  ["g01", "01-wireframe-cube.png"], ["g02", "02-scene-graph-cube.png"], ["g03", "03-solid-shaded.png"], ["g04", "04-depth-buffer.png"],
  ["g05", "05-texture-mapped.png"], ["g06", "06-datafile-models.png", 1], ["g07", "07-uv-textured-globe.png"], ["g08", "08-multipart-coupe.png"],
  ["g09", "09-gouraud-sphere.png"], ["g10", "10-teapot-plotter.png", 1],
  ...Array.from({ length: 8 }, (_, k) => [`orbit${k}`, `period-pipeline-orbit-0${k}.png`]),
];

export const YB = 1900, PITCH = 170, FW = 264, FH = 198, RAIL = 70, CX = 960;
export const rungY = (i) => YB - i * PITCH;
// Even rungs keep their frame on the right of the ladder, odd rungs on the left.
export const frameBox = (i) => ({ x: i % 2 === 0 ? CX + 150 : CX - 150 - FW, y: rungY(i) - FH / 2, w: FW, h: FH });
// The honest gap: the textured period render, beside the top rung, on the free side.
export const GAP = { x: CX - 150 - FW, y: rungY(20) - FH / 2 - 110, w: FW, h: FH };
export const TOP = -2060, BASE = 2160;

// Tower outline: tapered walls, the gallery rail, the lamp room and its dome.
function towerShape() {
  const wall = (x0, x1) => contour([CX + x0, BASE, CX + x1, -1700], false);
  const s = [wall(-620, -470), wall(620, 470), contour([CX - 700, BASE, CX + 700, BASE], false)];
  s.push(contour([CX - 540, -1700, CX + 540, -1700], false), contour([CX - 540, -1760, CX + 540, -1760], false));
  for (let k = -9; k <= 9; k++) s.push(contour([CX + k * 60, -1700, CX + k * 60, -1760], false));
  s.push(contour([CX - 230, -1760, CX - 230, -1930, CX + 230, -1930, CX + 230, -1760], false));
  for (let k = -2; k <= 2; k++) s.push(contour([CX + k * 92, -1760, CX + k * 92, -1930], false));
  const dome = [];
  for (let a = 0; a <= 24; a++) { const u = Math.PI * (a / 24); dome.push(CX - Math.cos(u) * 250, -1930 - Math.sin(u) * 120); }
  s.push(contour(dome, false), contour([CX, -2050, CX, TOP - 40], false));
  // Plotter hatching along the walls: courses of stone as fine horizontal strokes.
  for (let y = BASE - 60; y > -1690; y -= 120) {
    const u = (BASE - y) / (BASE + 1700), xo = 620 - 150 * u;
    s.push(contour([CX - xo + 8, y, CX - xo + 70, y], false), contour([CX + xo - 70, y, CX + xo - 8, y], false));
  }
  return s;
}
const rails = () => [contour([CX - RAIL, BASE - 120, CX - RAIL, rungY(20) - 120], false), contour([CX + RAIL, BASE - 120, CX + RAIL, rungY(20) - 120], false)];
const rungLine = (i) => [contour([CX - RAIL, rungY(i), CX + RAIL, rungY(i)], false)];

export function prepare(A) {
  const W = { tower: towerShape(), rails: rails(), rungs: RUNGS.map((_, i) => rungLine(i)), frames: RUNGS.map((_, i) => { const f = frameBox(i); return box(f.x, f.y, f.w, f.h); }) };
  // Rung names beside each frame, on the far side; log tiles for rungs with no picture.
  W.names = RUNGS.map((n, i) => {
    const f = frameBox(i);
    return text(n, { atlas: A.sans, size: 24, x: f.x + f.w / 2, y: f.y - 12, anchor: "center" }).shape;
  });
  W.tiles = RUNGS.map((n, i) => (OUTPUT[i] ? null : text(n.toLowerCase(), { atlas: A.mono, size: 22, x: frameBox(i).x + FW / 2, y: rungY(i) + 8, anchor: "center" }).shape));
  W.ticks = RUNGS.map((_, i) => [contour([CX - 22, rungY(i) - 2, CX - 6, rungY(i) + 12, CX + 24, rungY(i) - 18], false)]);
  W.gap = box(GAP.x, GAP.y, GAP.w, GAP.h);
  W.gapLabel = [text("textured period render:", { atlas: A.sans, size: 21, x: GAP.x + GAP.w / 2, y: GAP.y + 88, anchor: "center" }).shape, text("not claimed", { atlas: A.sans, size: 21, x: GAP.x + GAP.w / 2, y: GAP.y + 122, anchor: "center" }).shape].flat();
  A.W = W;
}

// draw(t, A, S, items): S says, per rung, when its frame fills (fill[i]) and when it lights
// (lit[i]), plus the tower's draw-on progress and the orbit clock.
export function draw(t, A, S, items) {
  const W = A.W, o = S.opacity ?? 1;
  if (o <= 0) return;
  const draw = S.draw ?? 1, labels = S.labels ?? 1;
  stroke(items, draw < 1 ? trim(W.tower, 0, draw) : W.tower, C.ink2, 2.2, 0.75 * o);
  const rail = clamp01((draw - 0.55) / 0.45);
  if (rail > 0) stroke(items, trim(W.rails, 0, rail), C.ink, 3, o);
  W.rungs.forEach((r, i) => {
    const show = clamp01((draw - 0.6 - i * 0.015) / 0.12);
    if (show <= 0) return;
    const lit = S.lit ? S.lit(i) : 0, fill = S.fill ? S.fill(i) : 0;
    stroke(items, r, lit > 0 ? C.ok : C.ink, 3.5, o * show * (lit > 0 ? 1 : 0.6 + 0.4 * fill));
    stroke(items, W.frames[i], lit > 0 ? C.ok : C.dim, 2, o * show * (lit > 0 ? 0.55 + 0.45 * lit : 0.7));
    if (lit > 0) stroke(items, W.ticks[i], C.ok, 3, o * lit);
    if (fill > 0) {
      const f = frameBox(i), key = OUTPUT[i];
      if (key === "orbit") items.push(image(`orbit${Math.floor(Math.max(0, S.orbit ?? 0)) % 8}`, f.x, f.y, f.w, f.h, o * fill));
      else if (key) items.push(image(key, f.x, f.y, f.w, f.h, o * fill));
      else putL(items, W.tiles[i], C.ink2, o * fill * 0.9);
    }
    if (labels > 0) putL(items, W.names[i], fill > 0 ? C.ink : C.dim, o * show * labels * (0.55 + 0.45 * fill));
  });
  const gap = S.gap ?? 0;
  if (gap > 0) {
    stroke(items, W.gap, C.hot, 3, o * gap);
    putL(items, W.gapLabel, C.hot, o * gap * labels);
  }
}
