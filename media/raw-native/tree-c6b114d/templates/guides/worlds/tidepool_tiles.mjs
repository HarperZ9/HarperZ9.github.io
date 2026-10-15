// The tidepool's pixel art: one fixed palette of 20 colours, 16 x 16 ground tiles and the
// sprites that sit on them (the moon, sea stacks, boulders, the tidepool, kelp, shells and
// the film 1 props). Drawn by hand as character rows, except where the shape is geometry
// (the moon's disc, the stacks' outlines, the kelp's sway, the sky's dither steps), which is
// computed here from hand-chosen numbers. No noise: every pixel is placed or follows a rule
// written below. Original art for raw-native under its licence.
import { T, canvas, step } from "./tidepool_px.mjs";
export { SHORE, SHORE_PALETTE } from "./tidepool_px.mjs";
export { GROUND_TILES, SKY_TILES, SEA_TILES } from "./tidepool_ground.mjs";

// ---- Sprites ---------------------------------------------------------------------------
// The moon: a bone disc shaded toward the lower left in an ordered dither, a ring of halo,
// and three craters. The aperture of the corpus, low over the sea.
export function moon(R = 20) {
  const S = 2 * R + 12, c = canvas(S, S), m = S / 2 - 0.5;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - m, y - m);
    if (d <= R) {
      const shade = Math.max(0, ((m - x) + (y - m)) / (2 * R) + (d / R) * 0.35 - 0.2);
      c.set(x, y, step("W", "F", Math.min(1, shade), x, y));
    } else if (d <= R + 2.2) c.set(x, y, step(".", "F", 0.25, x, y));
    else if (d <= R + 5) c.set(x, y, step(".", "T", 0.12, x, y));
  }
  for (const [x, y] of [[m + 6, m - 7], [m - 3, m + 4], [m + 9, m + 5]]) { c.set(Math.round(x), Math.round(y), "G"); c.set(Math.round(x) + 1, Math.round(y), "F"); }
  return c.tile();
}

// Sea stacks on the horizon: each one a run of rows (from the top) given as [left, right]
// insets, filled with night and lit on its right edge by the moon.
export function stacks() {
  const c = canvas(160, 44), base = 43;
  const draw = (x0, spans) => spans.forEach(([l, r], j) => {
    const y = base - spans.length + 1 + j;
    c.span(y, x0 + l, x0 + r, "N");
    c.set(x0 + r, y, j % 5 === 2 ? "T" : "B");
    if (j === 0) c.span(y, x0 + l, x0 + r, "B");
  });
  const col = (top, w, lean, n) => Array.from({ length: n }, (_, j) => { const t = j / (n - 1), half = w * (0.55 + 0.45 * Math.sqrt(t)); const cx = lean * (1 - t); return [Math.round(cx - half), Math.round(cx + half)]; });
  draw(26, col(0, 9, 3, 40));                // the tall stack, leaning seaward
  draw(52, col(0, 6, -2, 24));               // its smaller twin
  draw(8, col(0, 5, 0, 12));
  draw(120, col(0, 14, 0, 14).map(([l, r], j) => (j < 3 ? [l + 8, r - 8] : [l, r])));   // a low reef far right
  // The arch: a bite out of the tall stack's foot where the sea shows through.
  for (let y = 36; y < 44; y++) for (let x = 22; x < 30; x++) if (Math.hypot(x - 25.5, y - 44) < 6.5) c.set(x, y, ".");
  return c.tile();
}

// A boulder, by hand.
export const boulder = T([
  "...........rrrrr................",
  "........rrrFFrrrrr..............",
  "......rrFFrrrrrrrrrr............",
  ".....rFFrrrrrrrrrrrrrr..........",
  "....rFrrrrrrrrrRrrrrrrrr........",
  "...rrrrrrrrrrrRRRrrrrrrrrr......",
  "..rrrrrrrrrrrrrrrrrrrrrrrrr.....",
  "..rrrrRrrrrrrrrrrrrrrrrrrrrr....",
  ".rrrrRRRrrrrrrrrrrrrrRRrrrrrr...",
  ".rrrrrrrrrrrrrrrrrrrRRRRrrrrrr..",
  "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..",
  "RRrrrrrrrrrrrRrrrrrrrrrrrrrrrrr.",
  "RRRRrrrrrrrrRRRrrrrrrrrrrrrrrRR.",
  "RRRRRRRRrrrrrrrrrrrrrrrrRRRRRRRR",
  "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
  ".RRRRRRRNRRRRRRRRRRRNRRRRRRRRRR.",
  "..RRRRRRRNNRRRRRRRRNRRRRRRRRRR..",
  "...DDRRRRRRRRRRRRRRRRRRRRRRDDD..",
  ".....DDDDDDDDDDDDDDDDDDDDDDD....",
]);

// The tidepool set into the shelf: a rim, still water with the moon in it, a starfish and an
// anemone. 48 x 20.
export const pool = T([
  "......rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr........",
  "...rrrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRrrr.....",
  "..rRRNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNRRrr...",
  ".rRNTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTNRRr..",
  "rRNTTTTTTTTTTSSTTTTTTTTTTTTTTTTTTWWTTTTTTTTNRr..",
  "rRNTTTTTTTTTTTTTTTTTTTTTTTTTTTTTWFFWTTTTTTTTNRr.",
  "rRNTTTTPTTTTTTTTTTTTTTTTSSSTTTTTTWWTTTTTTTTTNRr.",
  "rRNTTTPPPTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTSSTTTNRr.",
  "rRNTTPPPPPTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTNRr.",
  "rRNTTTPPPTTTTTTTTTTTTkTTTTTTTTTTTTTTTTTTTTTTNRr.",
  "rRNTTTTPTTTTTTTTTTTTkTkTTTTTTTTTTTTcTcTTTTTTNRr.",
  "rRNTTTTTTTTTTTSSTTTTTkTTTTTTTTTTTTTcccTTTTTTNRr.",
  "rRNTTTTTTTTTTTTTTTTTTkTTTTTTTTTTTTcCcCcTTTTTNRr.",
  ".rRNTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTCCCTTTTTNRr..",
  ".rRRNNTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTNNRRr..",
  "..rrRRNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNRRrr...",
  "...rrrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRrr.....",
  ".....rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr.......",
  "................................................",
  "................................................",
]);

// Kelp in the foreground: strands that sway by a hand-set curve, with leaves every few rows.
export function kelp(w = 40, h = 72, strands = [[6, 0.0, 9], [16, 1.3, 7], [27, 2.4, 10], [34, 0.7, 6]]) {
  const c = canvas(w, h);
  for (const [x0, ph, amp] of strands) for (let y = 0; y < h; y++) {
    const t = 1 - y / h, x = Math.round(x0 + Math.sin(ph + t * 3.1) * amp * t);
    c.set(x, y, "K"); c.set(x + 1, y, y % 3 ? "K" : "k");
    if (y % 7 === 3 && y < h - 6) for (let i = 1; i < 5; i++) c.set(x + 1 + i, y - (i >> 1), i < 4 ? "k" : "K");
    if (y % 9 === 6 && y < h - 6) for (let i = 1; i < 4; i++) c.set(x - i, y - (i >> 1), "k");
  }
  // A dark rock the kelp grows from.
  for (let y = h - 10; y < h; y++) c.span(y, 0, Math.round(w * (0.5 + 0.5 * (y - h + 10) / 10)), "K");
  return c.tile();
}

// A claim shell, in three states: not yet knocked, holds (bone), hollow (dark).
const shellRows = (o, i, l) => [
  "....oooo....",
  "..ooiiiioo..",
  ".oiilllliio.",
  "oiiliiiiliio",
  "oiiliilliilo",
  "oiiiiiiiiiio",
  ".oooooooooo.",
  "..DDDDDDDD..",
].map((r) => r.replace(/o/g, o).replace(/i/g, i).replace(/l/g, l));
export const shellTiles = {
  unknocked: T(shellRows("R", "F", "W")), holds: T(shellRows("D", "W", "G")), hollow: T(shellRows("K", "N", "B")),
};
// A claim card lying on the sand, a paper boat and a cone, for the other guides' beats.
export const card = T([
  "WWWWWWWWWW..",
  "WDDDDDDWWWD.",
  "WWWWWWWWWWD.",
  "WDDDDWWWWWD.",
  "WWWWWWWWWWD.",
  ".DDDDDDDDDD.",
]);
export const boat = T([
  "......W.......",
  ".....WWF......",
  "....WWWFF.....",
  "...WWWWFFF....",
  "WWWWWWWWWWWWWW",
  ".GWWWWWWWWWWG.",
  "..GGGGGGGGGG..",
  "...DDDDDDDD...",
]);
export const cone = T([
  "....cc...",
  "....cC...",
  "...WWWW..",
  "...cccC..",
  "..ccccCC.",
  "..WWWWWW.",
  ".cccccCCC",
  "CCCCCCCCC",
  ".DDDDDDD.",
]);

// Things on the sand: a starfish, a run of pebbles and a length of driftwood.
export const starfish = T([
  "....P....",
  "....P....",
  "...PcP...",
  "PPPPcPPPP",
  ".PPcccPP.",
  "..PPcPP..",
  ".PP...PP.",
  "PP.....PP",
  "DD.....DD",
]);
export const pebbles = T([
  "..rr.........FF.",
  ".rFrr...R..rrrr.",
  ".rrrR..RrR.rrrRD",
  "..DD....D...DDD.",
]);
export const driftwood = T([
  "...........DDD..............",
  "..GGGGGGGGGGGDDGGGGGGGGGGG..",
  ".GDDDDGGGGGGGGGGGGGDDDGGGGG.",
  "GGGGGGGGDDDDDGGGGGGGGGGGGDGr",
  ".DDGGGGGGGGGGGGGDDDDGGGGGGDr",
  "..DDDDDDDDDDDDDDDDDDDDDDDDr.",
  "....RRRRRRRRRRRRRRRRRRRRR...",
]);
