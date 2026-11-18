// low-water.mjs: the words of low-water.html, built by scripts/build-product-pages.mjs. The game's repository is
// private, so its story facts are read from the design on its dev branch and stated here with that commit; the engine
// figures open to public pull requests, and their merge state comes from site-src/world/releases.json.
// The author, 2026-11-09, on how much to show: "all". On what the game is for: "engine is far more important; game is
// a full scale AAAA engine demo".
export const INTRO = {
  title: "Low Water",
  description: "Low Water, a narrative game in five eras and the full-scale demonstration of the raw-native engine: fights the animation decides.",
  lede: "One family's line through a hundred and fifteen years of one village, where the people at the table decide who eats and who is sent away. The full-scale demonstration of the engine.",
  note: "It shows abuse, persecution and genocide on screen. Two lines hold: nothing sexual with minors, and sexual violence with no sexual content.",
};

// The island: the game's world, generated from one seed by HarperZ9/superframe games/low-water/world and walked on
// this page with that folder's own code, carried unchanged at commit cac34166 into media/low-water/world-cac3416/
// (pinned by its SHA256SUMS). Figures come from the generated world.json, the folder's README and stills/README.md
// at that commit; the bytes and frame times from tests/low-water-walk.cjs and the run recorded in the release review.
// The author, 2026-11-16: "The low water showcase is not good enough" and "Nothing was ever supposed to be dropped."
const SF = "https://github.com/HarperZ9/superframe";
export const ISLAND = {
  title: "The island",
  commit: "cac34166",
  lede: "The game's world, made from one seed: an island 131 km by 98 km with eleven regions, a river system, fifteen ring towns a day's walk apart and forty-seven villages. You can walk it here, drawn live by the engine that will run the game.",
  progress: "The world is in progress. The land, the water, the towns, the weather and the sky stand where the rules put them, and all of it can be walked. The trees, the buildings and the ground surface are first versions. Set beside the pictures each region traces to, none looks right yet; the fog forest comes closest.",
  // where each walk starts: a place in km from the island's north-west corner, a heading and pitch in degrees, a day
  // and a clock (the forest is the densest stand of its cover near the region's seat, the view the engine's still tool
  // takes; the town stands on the road 200 m out of Hoarstead, facing its street; the island is the still tool's view)
  starts: [
    { id: "forest", go: "Walk into the fog forest", q: "x=31.232&z=49.152&yaw=40&pitch=3&clock=6.9&day=3",
      alt: "A forest at dawn under standing fog: tall conifers in tiers fading into white, ferns and grass tufts on a floor of patchy snow.",
      cap: "The Fog Forest at dawn, where the first walk starts." },
    { id: "town", go: "Walk into the snow town", q: "x=61.074&z=28.376&yaw=176&pitch=1&clock=18.3&day=5",
      alt: "A snow town at dusk: dark board houses on stone footings under heavy snow roofs with icicles, one window lit warm, snow falling.",
      cap: "Hoarstead, the snow town of Thaw Country, at dusk." },
    { id: "island", go: "See the whole island", q: "x=65.536&z=106.168&alt=52000&yaw=0&pitch=-50&clock=9.5&day=3&fly=1",
      alt: "The whole island from 52 km up: a snowy north-south range, dark wet forest in the west, the dry banded east, a bay and a small city island across a strait.",
      cap: "The whole island from 52 km up, mid-morning." },
  ],
  keys: "W A S D move. Click, then the mouse looks. Shift runs. F flies, and Space and C rise and sink. The number keys, 0 and minus go to the eleven regions. The wheel turns the clock and T holds it. Esc lets the mouse go, and Esc again, or Back to the page, leaves the walk.",
  stillsLede: "Before the forest and the town were built at walking height, the engine's still tool took one or two views of every region, and each was set beside the saved picture its region traces to. The read under each still is the one written beside it. Those reference pictures are other people's, so they stay off this page.",
  // file, place, verdict, read: superframe games/low-water/world/stills/README.md at cac34166
  stills: [
    ["00-island", "The whole island", "Reads", "The range, the snow, the wet west, the dry east, the bay and the city island are all legible from 52 km up. The coast is plain."],
    ["01-thaw-country", "Thaw Country", "Idea only", "A walled town as a dark line on a snow plain under a pink dusk and a moon. The reference is lamp light on snow at arm's length."],
    ["02-uplands-white-house", "The Folded Uplands", "Idea only", "One white house, a small building in a large place, snow peaks behind. The moor is one flat brown and the grass is orange spikes."],
    ["02-uplands-cloud-sea", "The Folded Uplands, above the cloud", "Not yet", "The ridges and the snow line are good terrain. There is no cloud sea in the frame, which was the point of the view."],
    ["03-fog-forest", "The Fog Forest", "Closest in mood", "Tiers of conifers fading into fog, dark trunks, a slope. The trees are cones and the birch crowns are yellow blocks."],
    ["04-storm-coast", "The Storm Coast", "Idea carries", "One stack in a grey sea under a low sky. The stack is a plain frustum, with no surf, no breaking swell and no port."],
    ["05-canyon", "The Canyon and Badlands", "Not yet", "A rim town of adobe boxes and a canyon mouth in warm light. No strata in view and no depth; the reference is all layered distance."],
    ["06-marsh", "The Marsh", "Wrong", "Dry ground with reed spikes and a far town. No standing water, no reed halls in frame, no buffalo."],
    ["07-city-across-water", "The City Across the Water", "Idea only", "Dark blocks and a scatter of lit windows across black water at night. No skyline, no reflections, no crowd."],
    ["08-the-works", "The Works", "Furthest from its reference", "Lit furnaces far off across dark ground. The reference is thousands of lamps on pipework, mirrored in water."],
    ["09-monument-ground", "The Monument Ground", "Scale reads, surface does not", "The Tower stands on the dusk horizon from 5.5 km. Close to, it is a bare cylinder; the reference is an inhabited wall of balconies and ivy."],
    ["09-tower-from-afar", "The Tower from the uplands", "Scale reads", "The 1,200 m Tower shows from the uplands 27 km away, the megastructure doing its job."],
    ["10-drowned-quarter", "The Drowned Quarter", "Idea carries", "Blocks standing in water with the city behind them in haze. Nothing has grown on anything."],
    ["11-far-north-works-town", "The Far-North Works Town", "Closest in subject", "A pastel slab block with a few lit windows, a smelter stack, pipes on stilts, snow, whiteout. No pylons, no road, no vehicles."],
    ["11-aurora", "The Far-North Works Town, the aurora night", "Works as an event", "Green and violet curtains over lit blocks and a stack. The curtains are ribbons and the stars are streaks."],
  ],
  stillsSource: `Taken by the world's still tool on the CPU at 1280 x 720 and kept at half size, seed 20261118, at superframe commit bbe45038 (<a href="${SF}/pull/124">superframe #124</a>). The forest, the town and the works were rebuilt at walking height after these were taken (<a href="${SF}/pull/125">superframe #125</a>), and the three pictures above the walk come from that later version.`,
  postersSource: "The three pictures are the walk's own canvas, drawn on an RTX 4090 at 1600 x 900 from the code and world this page loads.",
  plateCap: "The same island drawn as a plate: shadow hachures lit from the north-west, water-lining round the coast, rivers that widen to the sea, signs for tree, reed and stipple cover, the roads and the ferry in one colour, and every name lettered from the game's own stroke skeletons. The scale bar is the measured day's walk between ring towns.",
  plateSource: `Drawn by the world's plate tool from the generated files of seed 20261118 (<a href="${SF}/pull/122">superframe #122</a>). Press it for the full plate, 1500 pixels wide.`,
  make: [
    "Five tectonic plates; where two meet the ground lifts, and the long north-south range stands on one such boundary.",
    "Thirty rounds of stream-power erosion against uplift, each one flooding the surface from the sea so every cell has a way downhill.",
    "Lakes in four overdeepened valleys, kettle ponds on the northern shield and pools in the marsh.",
    "Rain on a west wind, spent on the climb, so the east sits in a rain shadow; cover follows temperature, rain, slope and height.",
    "A seat for each region, ring towns where the nearest is too far, villages and lone houses, and roads as least-time routes for a walker.",
    "Landmarks placed by rule, up to the 1,200 m Tower of the monument ground.",
  ],
  makeNote: `Every step uses integer hashing and plain arithmetic, so one seed gives the same bytes on any machine. The checks: 113 river lines whose water never rises downstream, no hydrology fault, all eleven regions present, and a median road between ring towns of 5.9 hours over 29 km. The generator is written in BuildLang (<a href="${SF}/pull/120">superframe #120</a>), and the walk runs on the engine's web GPU host (<a href="${SF}/pull/121">superframe #121</a>).`,
  verified: "the island's figures from the generated world of seed 20261118 and the world's README and still notes at superframe commit cac34166; the world on this page was generated twice from that commit's generator and the two runs match byte for byte, and every carried file matches its SHA-256 in the folder's SHA256SUMS.",
};

export const ERAS = [
  ["The Exchange", 45], ["The Quota", 85], ["Allocation", 50], ["The Closure", 60], ["The Clearance", 80],
];
export const STORY = {
  title: "The story",
  lede: "A boy who did not come home, and a parent who fails him. Famine presses from the first era; persecution grows until it is a clearance.",
  rule: "The story reaches you through bodies, sound, touch and changed places, never through a ledger to read.",
  state: "Written to the ending: 591 story nodes, every one reachable. Voices, art and the native port come next.",
  verified: "the era names, lengths and node count were read from the game's design and content at commit 8b49bdd of its private repository.",
};

export const SECTIONS = [
  {
    id: "fights", title: "The fights",
    lede: "Fights run on raw-native's 60 Hz action timeline, and the animation decides each hit: capsules bound to the bones of the swing.",
    next: "Next, timing, sound, physics, effects and hit markers move onto one shared schedule, and the game's own simulation takes up the capsule contact.",
    toy: { id: "tell", title: "Read a tell",
      lede: "A telegraphed strike gives you 18, 30 or 36 frames of warning, slow at first and then fast. Start one, and press Parry (or Space) as the arc closes.",
      note: "The three leads and the slow-then-fast shape are the engine's own rule. The 4-frame parry window is an example for practice, not the game's number. Sound is off until you turn it on." },
    figs: [
      { n: "bit for bit", text: "the C++ timeline matches the game's JavaScript combat engine", detail: "It loads the game's move data and ports its strike generator expression for expression, on [[deterministic maths]]: the same bits on every machine.", repo: "HarperZ9/raw-native", pr: 239 },
      { n: "18, 30 or 36", text: "frames of warning before a telegraphed strike, checked as data, with the slow-then-fast shape on every tell you can parry", detail: "Telegraph retiming drives the presentation clock while the simulation keeps its integer frames.", repo: "HarperZ9/raw-native", pr: 242 },
    ],
  },
  {
    id: "rules", title: "The rules",
    lede: "The rules are written in BuildLang and compiled into a C library the C++ host links.",
    figs: [
      { n: "16 of 16", text: "checks of the host's own test pass against the BuildLang rules, as they do against the C++ module", detail: "Records that need the story expression language are refused by name until it is ported.", repo: "HarperZ9/buildlang", pr: 158 },
      { n: "5.09x", text: "faster: the 40-fight corpus run in parallel at 8 threads, with the same bytes as the serial run", detail: "95% interval 4.94 to 5.37, on an i7-13700KF shared with GPU training.", repo: "HarperZ9/buildlang", pr: 136 },
    ],
  },
];

export const FOOTAGE = "No footage of the game is on this page yet. The first fight and the turning-point scenes will be rendered by the engine itself, with its own video writer.";

// What a press downloads, in bytes, measured by tests/low-water-walk.cjs (the test fails when a press loads more than
// this): the frame page, the walk's code and shaders, the engine's GPU host, the world's description and every tile.
export const WALK_BYTES = 4000000;   // 3,912,228 measured on 18 November 2026, in 94 requests
// Frame times on the author's machine, 18 November 2026, recorded in the release review with the method.
export const FRAMES = "On an RTX 4090 shared with other work, the walk kept to the display's 120 frames a second in the forest and the town. Over 300 frames the median gap was 8.3 ms at 1280 x 720 and at 2560 x 1440; the worst was 42 ms at 1280 x 720 and 33 ms at 2560 x 1440. Drawn back to back, a frame of the forest took the GPU 2.2 to 3.9 ms at 1280 x 720 and 6.7 to 7.3 ms at 2560 x 1440, over two runs.";
