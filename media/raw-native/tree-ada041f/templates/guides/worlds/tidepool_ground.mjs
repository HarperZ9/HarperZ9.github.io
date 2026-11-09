// The tidepool's ground, sky and sea tiles (16 x 16), drawn by hand as character rows on the
// shore palette; the sky's dither steps and the sea's crests follow rules written here.
import { mirror } from "../../../web/world/author.mjs";
import { T, canvas, step, skyTile } from "./tidepool_px.mjs";

// ---- Ground tiles (16 x 16) ---------------------------------------------------------
const sand = T([
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGDDGGGGGGGGGGG",
  "GGGGGDGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGDGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
]);
const sand3 = T([
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGDDDDGG",
  "GGGGGGGGDDGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
]);
const sandPlain = T(Array(16).fill("GGGGGGGGGGGGGGGG"));
const sand2 = mirror(sand);
const sandShell = T([
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGPPGGGG",
  "GGGGGGGGGPWWPGGG",
  "GGGGGGGGGDPPDGGG",
  "GGGGGGGGGGDDGGGG",
  "GGGDDGGGGGGGGGGG",
  "GGGGGDDGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GWGGGGGGGGGDDDGG",
  "GGGGGGGGGGGGGGDG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
]);
const wet = T([
  "DDDDDDDDDDDDDDDD",
  "DDDDDDDDDDDDDDDD",
  "DDDDDDGGDDDDDDDD",
  "DDDDDDDDGGDDDDDD",
  "DDDDDDDDDDDDDDDD",
  "DDDDDDDDDDDDDFDD",
  "DDDDDDDDDDDDDDDD",
  "DDGGGDDDDDDDDDDD",
  "DDDDDGGDDDDDDDDD",
  "DDDDDDDDDDDDDDDD",
  "DDDDDDDDDDDDDDDD",
  "DDDDDDDDDDGGGDDD",
  "DDDDDDDDDDDDDGGD",
  "DDDDDDDDDDDDDDDD",
  "GDDDDDDDDDDDDDDD",
  "GGDDDDDDDDDDDDGG",
]);
// Wet sand fading into dry sand below.
const wetToSand = (() => { const c = canvas(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) c.set(x, y, step("D", "G", y / 13, x, y)); c.set(5, 3, "F"); return c.tile(); })();
// The surf line: sea above, a scalloped foam edge, lace on the wet sand.
const foam = T([
  "TTTTTTTTTTTTTTTT",
  "TTTSSSTTTTTTTTTT",
  "TTTTTTSSTTTTTSST",
  "SSTTTTTTTTTTTTTS",
  "FFSSTTTTTTSSFFFF",
  "WFFFSSSSSSFFWWFF",
  "WWWFFFFFFFFWWWWW",
  "FWWWWWWWWWWWWFFF",
  "DFFWWWWFFFWWFFDD",
  "DDDFFFFDDDFFDDDD",
  "DDDDDDDDDDDDDDDD",
  "DDFDDDDDDDDDDFDD",
  "DDDFFDDDDDDDFDDD",
  "DDDDDDDDDDDDDDDD",
  "DDDDDDDDDDDDDDDD",
  "DDDDDDDDDDDDDDDD",
]);
const foam2 = mirror(foam);
// The rock shelf: a top with moonlit lips, the face below, and both ends.
const shelfTop = T([
  "................",
  "................",
  "...rrrrr.....rr.",
  "rrrFFrrrrrrrrrFr",
  "rFFrrrrrrrrrrrrr",
  "rrrrrrRrrrrrrrrr",
  "rrrrrRRRrrrrrRrr",
  "rrrrrrrrrrrrRRRr",
  "rRrrrrrrrrrrrrrr",
  "RRRrrrrrrRrrrrrr",
  "rrrrrrrrRRRrrrrr",
  "rrrrrrrrrrrrrrrr",
  "RRRRRRRRRRRRRRRR",
  "RRRRRRNRRRRRRRRR",
  "RRRRRNRRRRRRNRRR",
  "RRRRRNRRRRRNRRRR",
]);
const shelfTop2 = mirror(shelfTop);
const shelfFace = T([
  "RRRRRNRRRRRNRRRR",
  "RRRRRNRRRRRRNRRR",
  "RRRRNRRRRRRRNRRR",
  "RRRRNRRRRRRRRRRR",
  "RRRRRRRRRRRRRRRR",
  "RRRrRRRRRRRRRRRR",
  "RRRRRRRRRRRRRNNR",
  "NRRRRRRRRRRRNRRR",
  "RNRRRRRRRRRRRRRR",
  "RRNRRRRRRRRRRRRR",
  "RRRRRRRRRRrRRRRR",
  "RRRRRRRRRRRRRRRR",
  "RRRRRRNRRRRRRRRR",
  "RRRRRRRNNRRRRRRR",
  "RRRRRRRRRNRRRRRR",
  "RRRRRRRRRRRRRRRR",
]);
const shelfEndR = T([
  "................",
  "................",
  "rr..............",
  "rrr.............",
  "rrrr............",
  "rrrrr...........",
  "rrrrrr..........",
  "rrrrrrr.........",
  "rrrrrrrr........",
  "rrrrrrrrR.......",
  "rrrrrrrrRR......",
  "rrrrrrrRRRR.....",
  "RRRRRRRRRRRR....",
  "RRRRRRRRRRRRR...",
  "RRRRRNRRRRRRRR..",
  "RRRRRNRRRRRRRRR.",
]);
const shelfFaceEndR = T([
  "RRRRNRRRRRRRRRRR",
  "RRRRNRRRRRRRRRRR",
  "RRRRRRRRRRRRRRRR",
  "RRRRRRRRRRRRRRRR",
  "RRRRRRRRRRRRRRRR",
  "RRRRRRRRRRRRRRRD",
  "RRRRRRRRRRRRRRDG",
  "RRRRRRRRRRRRRDGG",
  "RRRRRRRRRRRRDGGG",
  "RRRRRRRRRRRDDGGG",
  "RRRRRRRRRRRDGGGG",
  "RRRRRRRRRRDGGGGG",
  "RRRRRRRRRRDGGGGG",
  "RRRRRRRRRDGGGGGG",
  "RRRRRRRRRDGGGGGG",
  "RRRRRRRRDGGGGGGG",
]);

// The shelf's flat top, seen from above at the 2.5D angle: barnacles, a crack, a lit pit.
const rockFlat = T([
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrRrrrrrr",
  "rrrrrrrrRRrrrrrr",
  "rrrrrrrRRrrrrrrr",
  "rrrrrrrrRrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
]);
const rockBarnacle = T([
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrWrrrrrrrrrrrr",
  "rrWrWrrrrrrrrrrr",
  "rrrWrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrkkr",
  "rrrrrrrrrrrrkkrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrWrr",
  "rrrrrrrrrrrrWrWr",
  "rrrrrrrrrrrrrWrr",
]);
const rockPit = T([
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrRRRRrrrrrrr",
  "rrrrRRNNRRrrrrrr",
  "rrrrRNTTNRrrrrrr",
  "rrrrRNTFNRrrrrrr",
  "rrrrrRNNRrrrrrrr",
  "rrrrrrRRrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrRrrrrr",
  "rrrrrrrrrRRrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
]);
const rockShade = T([
  "rrrrrrrrrrrrrrrr",
  "rrrrrrRRRrrrrrrr",
  "rrrrRRRRRRRrrrrr",
  "rrrRRRRRRRRRRrrr",
  "rrRRRRRRRRRRRRrr",
  "rrrRRRRRRRRRRRrr",
  "rrrrRRRRRRRRRrrr",
  "rrrrrrRRRRRrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrr",
]);
const rockPlain = T(Array(16).fill("rrrrrrrrrrrrrrrr"));
const rockFlat2 = mirror(rockFlat);
const rockEdgeR = T([
  "rrrrrrrrrrrRRDGG",
  "rrrrrrrrrrrRRDGG",
  "rrrrrrrrrrrrRRDG",
  "rrrrrrrrrrrrRRDG",
  "rrrrrrrrrrrrRRDG",
  "rrrrrrrrrrrRRDGG",
  "rrrrrrrrrrrRRDGG",
  "rrrrrrrrrrRRDDGG",
  "rrrrrrrrrrRRDGGG",
  "rrrrrrrrrrrRRDGG",
  "rrrrrrrrrrrRRDGG",
  "rrrrrrrrrrrrRRDG",
  "rrrrrrrrrrrrRRDG",
  "rrrrrrrrrrrRRDGG",
  "rrrrrrrrrrrRRDGG",
  "rrrrrrrrrrrRRDGG",
]);

// ---- Sky and sea tiles ----------------------------------------------------------------
const sky = {
  void: skyTile("K", "K", 0, 0), voidStar: skyTile("K", "K", 0, 0, [[4, 5, "W"], [11, 12, "F"]]),
  voidNight: skyTile("K", "N", 0, 0.5), voidNightStar: skyTile("K", "N", 0, 0.5, [[9, 3, "F"]]),
  night: skyTile("N", "N", 0, 0), nightStar: skyTile("N", "N", 0, 0, [[6, 9, "W"]]),
  nightBlue: skyTile("N", "B", 0, 0.5), blue: skyTile("B", "B", 0, 0),
  blueSlate: skyTile("B", "T", 0, 0.5),
  // The horizon: slate warming to dusty rose in the last rows.
  horizon: skyTile("T", "P", -0.25, 0.3),
};
function seaTile(base, crest, glint = 0) {
  const c = canvas(16, 16, base);
  // Crest dashes at hand-chosen places: (x, y, length).
  for (const [x, y, n] of [[3, 1, 3], [6, 2, 2], [11, 4, 3], [14, 5, 2], [0, 5, 1], [4, 8, 4], [8, 9, 1], [12, 12, 3], [0, 13, 2], [15, 13, 1]])
    for (let i = 0; i < n; i++) c.set((x + i) % 16, y, crest);
  // The moon's road: broken horizontal glints, densest at the centre column.
  if (glint) for (const [x, y, n] of [[5, 0, 6], [6, 3, 4], [3, 6, 9], [6, 7, 3], [4, 10, 7], [7, 11, 2], [5, 14, 5]]) for (let i = 0; i < n * glint; i++) c.set(x + i, y, i % 3 === 1 ? "F" : "W");
  return c.tile();
}
const sea = { far: seaTile("B", "T"), mid: seaTile("T", "S"), farGlint: seaTile("B", "F", 0.6), midGlint: seaTile("T", "W", 1) };

export const GROUND_TILES = [
  ["sand", sand], ["sand2", sand2], ["sand3", sand3], ["sandPlain", sandPlain], ["sandShell", sandShell], ["wet", wet], ["wetToSand", wetToSand], ["foam", foam], ["foam2", foam2],
  ["shelfTop", shelfTop], ["shelfTop2", shelfTop2], ["rockFlat", rockFlat], ["rockFlat2", rockFlat2], ["rockBarnacle", rockBarnacle], ["rockPit", rockPit], ["rockPlain", rockPlain], ["rockShade", rockShade], ["rockEdgeR", rockEdgeR], ["shelfFace", shelfFace], ["shelfEndR", shelfEndR], ["shelfFaceEndR", shelfFaceEndR],
];
export const SKY_TILES = Object.entries(sky);
export const SEA_TILES = Object.entries(sea);

