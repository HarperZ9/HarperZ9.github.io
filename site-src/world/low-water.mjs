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
