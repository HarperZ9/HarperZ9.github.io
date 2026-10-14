// Rerun's shore: a tidepool on a rock shelf at dusk, the pixel 2.5D world. Six layers at
// their own depths, so a camera move gives parallax: the sky and moon (farthest), the sea
// stacks, the sea, the beach and shelf with its props, and kelp in the foreground. Every
// layer is hand-placed tiles or sprites (tidepool_tiles.mjs) drawn by the tile pass, on one
// fixed palette, in pixel mode.
//
// Positions are given in screen pixels of the 480 x 270 frame as seen from the reference
// camera (x 960, y 540, zoom 1); place() turns them into the depth and scale that keep one
// art pixel on one frame pixel at every depth.
import { tileAtlas, authoredMap, parallaxZ } from "../../../web/world/author.mjs";
import * as A from "./tidepool_tiles.mjs";
import { portraitFrames } from "./portraits.mjs";

export const PX = 4;                               // design units per frame pixel (1920 / 480)
export const REF = { x: 960, y: 540 };
export const DEPTH = { sky: 0.15, stacks: 0.3, sea: 0.55, beach: 1, front: 1.5 };
export const KELP_FRAMES = 12, KELP_LOOP = 2.4;

// A tilemap item for a map whose top-left lands at screen pixel (lx, ly) under the reference
// camera, on the layer that scrolls at factor f.
export function place(map, tileset, lx, ly, f) {
  return { kind: "tilemap", map, tileset, x: REF.x + (lx * PX - 960) / f, y: REF.y + (ly * PX - 540) / f, scale: PX / f, z: parallaxZ(f) };
}
// Design coordinates of a screen pixel on the beach layer (factor 1), for characters and vector props.
export const beach = (lx, ly) => [lx * PX, ly * PX];

const one = (name, img) => {
  const atlas = tileAtlas([[name, img]], { tileW: img.width, tileH: img.height });
  return { atlas, map: authoredMap({ atlas, layers: [{ rows: ["x"], legend: { x: name } }] }) };
};

// The beach and shelf, by hand. Base layer: surf, wet sand, sand. Rock layer: the shelf.
const BEACH_W = 42;
const fit = (s) => s.padEnd(BEACH_W, s.slice(-1)).slice(0, BEACH_W);
const BASE = [
  "fFfFfFfFfFfFfFfFfFfFfFfFfFfFfFfFfF",
  "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
  "tttttttttttttttttttttttttttttttttt",
  "s.S..3.s....%..S.....3...s...S..3.",
  "..3.s....S.....3..s......%.....s..",
  ".s....3......s......S..3.....S....",
  "S...%....s.3.....s.......s..3....s",
  "..s....3.....S......%......s..3...",
  "s.....S...3......s.....3.......s..",
  "...3.......s..S.......s.....%.....",
].map(fit);
const ROCK = [
  "..................................",
  "lLlLlLlLlLlLe.....................",
  "o-b-xp-o-bo-E.....................",
  "-o--O-xb--O-E.....................",
  "bx-o---O-pxoE.....................",
  "-O-bxo--x--bE.....................",
  "||||||||||||#.....................",
  "..................................",
  "..................................",
  "..................................",
].map(fit);
const BASE_KEY = { f: "foam", F: "foam2", w: "wet", t: "wetToSand", s: "sand", S: "sand2", 3: "sand3", ".": "sandPlain", "%": "sandShell" };
const ROCK_KEY = { ".": null, "-": "rockPlain", x: "rockShade", l: "shelfTop", L: "shelfTop2", e: "shelfEndR", o: "rockFlat", O: "rockFlat2", b: "rockBarnacle", p: "rockPit", E: "rockEdgeR", "|": "shelfFace", "#": "shelfFaceEndR" };

const SKY = [
  ["vV", "vvvvVvvvvvvvvvVvvvvvvvvvVvvvvvvvvv"],
  ["n", "nnnnnnNnnnnnnnnnnnNnnnnnnnnnnnnNnn"],
  ["g", "gggggggggggggggggggggggggggggggggg"],
  ["h", "hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh"],
  ["b", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
  ["c", "cccccccccccccccccccccccccccccccccc"],
  ["z", "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"],
].map(([, r]) => fit(r));
const SKY_KEY = { v: "void", V: "voidStar", n: "voidNight", N: "voidNightStar", g: "night", h: "nightBlue", b: "blue", c: "blueSlate", z: "horizon" };
const SEA = [
  "ffffffffffffffffffffffFfffffffffff",
  "mmmmmmmmmmmmmmmmmmmmmmMmmmmmmmmmmm",
  "mmmmmmmmmmmmmmmmmmmmmmMmmmmmmmmmmm",
  "mmmmmmmmmmmmmmmmmmmmmmmMmmmmmmmmmm",
].map(fit);
const SEA_KEY = { f: "far", F: "farGlint", m: "mid", M: "midGlint" };

export async function loadTidepool(motion) {
  const at = (tiles) => tileAtlas(tiles, { tileW: 16, tileH: 16 });
  const ground = at(A.GROUND_TILES), sky = at(A.SKY_TILES), sea = at(A.SEA_TILES);
  const W = {
    beach: authoredMap({ atlas: ground, layers: [{ name: "base", rows: BASE, legend: BASE_KEY }, { name: "rock", rows: ROCK, legend: ROCK_KEY }] }),
    sky: authoredMap({ atlas: sky, layers: [{ rows: SKY, legend: SKY_KEY }] }),
    sea: authoredMap({ atlas: sea, layers: [{ rows: SEA, legend: SEA_KEY }] }),
    sprites: {
      moon: one("moon", A.moon()), stacks: one("stacks", A.stacks()), boulder: one("boulder", A.boulder), pool: one("pool", A.pool),
      kelp: one("kelp", A.kelp()), kelpR: one("kelpR", A.kelp(36, 60, [[8, 1.9, 7], [20, 0.4, 9], [30, 2.8, 6]])),
      // The kelp's sway, drawn as KELP_FRAMES sprites a loop apart (stepped, as sprite animation is).
      ...Object.fromEntries(Array.from({ length: KELP_FRAMES }, (_, k) => {
        const p = (Math.PI * 2 * k) / KELP_FRAMES, sh = (x) => 0.35 * Math.sin(p + x);
        return [[`kelp${k}`, one(`kelp${k}`, A.kelp(40, 72, [[6, 0.0 + sh(0), 9], [16, 1.3 + sh(1), 7], [27, 2.4 + sh(2), 10], [34, 0.7 + sh(3), 6]]))],
          [`kelpR${k}`, one(`kelpR${k}`, A.kelp(36, 60, [[8, 1.9 + sh(0.5), 7], [20, 0.4 + sh(1.5), 9], [30, 2.8 + sh(2.5), 6]]))]];
      }).flat()),
      unknocked: one("unknocked", A.shellTiles.unknocked), holds: one("holds", A.shellTiles.holds), hollow: one("hollow", A.shellTiles.hollow),
      starfish: one("starfish", A.starfish), pebbles: one("pebbles", A.pebbles), driftwood: one("driftwood", A.driftwood),
      ...Object.fromEntries(Object.entries(portraitFrames()).map(([k, img]) => [`portrait-${k}`, one(`portrait-${k}`, img)])),
      card: one("card", A.card), boat: one("boat", A.boat), cone: one("cone", A.cone),
    },
  };
  if (motion) {
    motion.image("tp-ground", ground.image); motion.image("tp-sky", sky.image); motion.image("tp-sea", sea.image);
    for (const [k, s] of Object.entries(W.sprites)) motion.image("tp-" + k, s.atlas.image);
  }
  return W;
}

// A sprite on a layer, its top-left at screen pixel (lx, ly).
export const sprite = (W, name, lx, ly, f = 1) => place(W.sprites[name].map, "tp-" + name, lx, ly, f);

// The world's layers behind the characters, and the foreground in front of them.
export function tidepool(W, { front: withFront = true, t = null } = {}) {
  const back = [
    place(W.sky, "tp-sky", -32, 0, DEPTH.sky),
    sprite(W, "moon", 316, 26, DEPTH.sky),
    sprite(W, "stacks", 14, 69, DEPTH.stacks),
    place(W.sea, "tp-sea", -16, 112, DEPTH.sea),
    place(W.beach, "tp-ground", -16, 160, DEPTH.beach),
    sprite(W, "pool", 36, 210),
    sprite(W, "boulder", 166, 168),
    sprite(W, "driftwood", 228, 186), sprite(W, "pebbles", 214, 252), sprite(W, "starfish", 438, 200), sprite(W, "pebbles", 400, 262),
  ];
  const k = t == null ? null : Math.floor(((t % KELP_LOOP) / KELP_LOOP) * KELP_FRAMES) % KELP_FRAMES, kn = (n) => (k == null ? n : n + k);
  const front = withFront ? [sprite(W, kn("kelp"), -8, 204, DEPTH.front), sprite(W, kn("kelpR"), 452, 216, DEPTH.front)] : [];
  return { back, front };
}

// A shell grid on the sand: state(i) is "unknocked", "holds" or "hollow".
export function shellGrid(W, cols, rows, lx, ly, state, dx = 20, dy = 14) {
  const out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) out.push(sprite(W, state(j * cols + i), lx + i * dx + (j % 2) * (dx >> 1), ly + j * dy));
  return out;
}
