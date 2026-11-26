// platforms.mjs: the front door's landmarks and the work under each, built into index.html by
// scripts/build-world-home.mjs, and the menu every generated page carries (scripts/studies-shell.mjs).
//
// Landmarks keep their place (DESIGN-RULES.md, author 2026-11-09: "Yes"). Their order is the author's, 2026-11-09,
// verbatim: "BuildLang, Flywheel, Engine, Game, Site, Everything". The third word is shown as The Playground (author,
// 2026-11-11: "the playground is the rendering engine. It's the engine."); its id, anchors and hue key are unchanged. The same six lead the menu on every page, in that
// order, and the home sets them down in that order.
//
// Display marks (the author, 2026-10-29: "THE COMMONS (THECMMNS) | THE PLAYGROUND (THEPLYGRND) THE FLYWHEEL
// (THEFLYWHEEL)"; 2026-11-02: "ARTICULATE (ARTIQL8)" and "BLDLNG and RSRCH works.") are names on the page only; no
// repo, package or path changes with them.
//
// No version or date is written here by hand. Each row names its release source (site-src/world/release-sources.mjs);
// scripts/fetch-releases.mjs reads the releases into releases.json, and this module turns them into the version,
// the install line and the Verified line. tests/test_front_door_platforms.py checks the shape and the voice.
import { existsSync, readFileSync } from "node:fs";
import { REGISTRY_NAMES } from "./release-sources.mjs";

const RELEASES = new URL("./releases.json", import.meta.url);
const R = existsSync(RELEASES) ? JSON.parse(readFileSync(RELEASES, "utf8")) : { checkedAt: null, products: {} };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const longDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
export const CHECKED = R.checkedAt ? longDate(R.checkedAt.slice(0, 10)) : "not yet checked";

// What each pull request behind a row without a release adds, in the words of its own title and body.
const PR_SHOWS = {
  "HarperZ9/raw-native#239": "adds the fight timeline and its match against the game's JavaScript engine",
  "HarperZ9/raw-native#242": "adds hit volumes and the timing of telegraphed strikes",
  "HarperZ9/buildlang#135": "adds the game's rules module, written in BuildLang",
  "HarperZ9/buildlang#158": "records 40 of 40 combat traces matching the game's own corpus",
};

// The Verified line says only what the fetch saw: the GitHub release, the registry, a download, a merge.
function verifiedFor(id) {
  const p = R.products[id];
  if (!p) return null;
  const parts = [];
  if (p.github) {
    const g = p.github;
    let s = `version ${g.version} is the latest GitHub release of ${g.repo} (${longDate(g.published)})`;
    if (p.registry) {
      const reg = REGISTRY_NAMES[p.registry.kind];
      s += p.registry.version === g.version ? ` and the current ${reg} version of ${p.registry.name}` : `; ${reg} still lists ${p.registry.name} ${p.registry.version}`;
    }
    if (g.asset) s += g.asset.attached ? `, and ${g.asset.name} is attached to it` : `; ${g.asset.name} is not attached to it`;
    parts.push(s);
  }
  if (p.prs) {
    const merged = p.prs.filter((x) => x.merged), open = p.prs.filter((x) => !x.merged);
    const name = (x) => `${x.repo.split("/")[1]} #${x.number}`;
    // A pull request number alone tells a reader nothing; PR_SHOWS says what each one adds, from its title and body.
    const shows = (x) => PR_SHOWS[`${x.repo}#${x.number}`];
    if (merged.length && merged.every(shows)) parts.push(`${merged.length} pull requests are merged on main: ${merged.map((x) => `${name(x)} ${shows(x)}`).join("; ")}`);
    else if (merged.length) parts.push(`${merged.map(name).join("; ")} ${merged.length === 1 ? "is" : "are"} merged on main`);
    if (open.length) parts.push(`${open.map(name).join("; ")} ${open.length === 1 ? "is" : "are"} still open`);
  }
  return parts.join(". ") + ".";
}
const versionOf = (id) => R.products[id]?.github?.version || null;
const fill = (s, id) => (s ? s.replace("{v}", versionOf(id) || "") : s);

// Each piece of work: what it does for the visitor, where to see it, how to run it now, and its source.
const ROWS = {
  buildlang: { hue: "bldlng", product: "BuildLang",
    try: "#w-buildlang", what: "A compiled systems and GPU language where every function declares what it can touch. The compiler checks effect laws beside the code, compiles through C and HLSL/GLSL, and pairs with BuildDB (qdb.exe) and 115x-191x f64 kernels.",
    see: ["/buildlang.html", "Language, BuildDB, and kernels"], more: ["https://github.com/HarperZ9/buildlang/blob/main/docs/GETTING_STARTED.md", "The language guide"],
    run: "cargo install buildlang --version {v} --locked", repo: "https://github.com/HarperZ9/buildlang" },
  flywheel: { hue: "theflywheel", product: "Flywheel",
    try: "#w-flywheel", what: "A self-hosted AI workstation, coding harness, and local model forge. It runs hosted or local models behind one interface, seals every tool step into an offline SHA-256 [[receipt]] (engine-receipt/1), and houses the Plexus RTX 4090 / Colab Arm C oracle loop.",
    see: ["/demos.html#flywheel", "Watch a check, a tamper, and a refusal"], more: ["/flywheel.html", "Flywheel"],
    run: "pip install flywheel-verify", then: "flywheel up", repo: "https://github.com/HarperZ9/flywheel" },
  "raw-native": { hue: "theplygrnd", product: "The native renderer",
    try: "#w-engine", what: "The C++23 rendering core of The Playground on Direct3D 12, Vulkan, and WebGPU, released as raw-native. It draws frames on both CPU reference and GPU, checks agreement via [[radiance cascades]] and BT.2100 spectral optics, and drives live Skyrim SE / Fallout 4 / Starfield captures.",
    see: ["/raw.html", "Render the frame, then check it"], more: ["/low-water.html", "The game made with it"],
    run: "Download raw-native-{v}-windows-x64.zip from the release", runIsProse: true, repo: "https://github.com/HarperZ9/superframe/tree/main/native" },
  superframe: { hue: "theplygrnd", product: "Superframe",
    try: "#w-engine", what: "The unified core of The Playground. One seeded recipe produces paint, living type, biomechanics, 6-DOF physical-AI, sound, and touch. It is [[deterministic]]: the same inputs produce the same bytes on every run.",
    see: ["/world/#superframe", "One recipe in every medium"], more: ["/playground/", "Open The Playground"],
    run: "git clone https://github.com/HarperZ9/superframe", then: "npm run make", note: "Node 24 or later", repo: "https://github.com/HarperZ9/superframe" },
  "low-water": { hue: "game", product: "Low Water",
    try: "#w-low-water", what: "A narrative game in five eras, built directly on The Playground as its full-scale demonstration.",
    see: ["/low-water.html", "Low Water"], more: ["/raw.html", "The renderer under it"] },
  site: { product: "This site",
    what: "Unified 44-HTML showcase (36 flagship pages plus 8 live engine frames) covering all five flagships, local models, 159 public repositories, live media, and research.",
    see: ["#p-light", "The places"], more: ["/world/", "World atlas"], repo: "https://github.com/HarperZ9/HarperZ9.github.io" },
  cmmns: { hue: "thecmmns", product: "CMMNS", name: "THE COMMONS", mark: "THECMMNS",
    try: "#w-commons", what: "A site-agnostic browser extension and archival tool capturing any webpage or thread into collision-free provenance sidecars, surfacing sources, coordination cues, and fact-checks locally.",
    see: ["/cmmns.html#try", "Try it on your own words"], more: ["https://harperz9.github.io/cmmns/how-it-works.html", "How each sign is read"],
    run: "Download cmmns-chrome-{v}.zip, then Load unpacked", runIsProse: true, repo: "https://github.com/HarperZ9/cmmns" },
  articulate: { hue: "artiql8", product: "Articulate", name: "ARTICULATE", mark: "ARTIQL8",
    try: "#w-articulate", what: "Names each writing pattern in your prose with the line it is on, locally on your own computer.",
    see: ["/demos.html#articulate", "Try Articulate live"], more: ["/tools.html#articulate", "Articulate"],
    run: "pip install articulate-writing", then: "articulate check notes.md", repo: "https://github.com/HarperZ9/flywheel/tree/main/packages/articulate" },
  research: { hue: "rsrch", product: "Essays and papers", name: "RESEARCH", mark: "RSRCH",
    try: "#w-writing", what: "Essays, Zenodo preprints, local model labs, and preregistered studies with every null result kept in the denominator.",
    see: ["/studies/", "Studies and benchmarks"], more: ["/essays.html", "Essays and papers"] },
};

// The six landmarks. `href` is where the menu sends a reader, always the product's own page; `sub` is the second
// level the menu lists under the word; `rows` is the work the home sets under each.
export const LANDMARKS = [
  { id: "buildlang", hue: "bldlng", word: "BuildLang", mark: "BLDLNG", href: "/buildlang.html", tech: "glyphcell", def: "[[BuildLang]] means the language, its compiler buildc, BuildDB (qdb.exe), and its fast f64 kernels.", rows: ["buildlang"] },
  // the checking platforms sit together: Flywheel seals and rechecks, CMMNS reads public claims, Articulate checks
  // the words that leave; each keeps its own name and mark
  { id: "flywheel", hue: "theflywheel", word: "Flywheel", mark: "THEFLYWHEEL", href: "/flywheel.html", sub: [["/cmmns.html", "CMMNS"], ["/models.html", "Models"], ["/demos.html#articulate", "Articulate"]], tech: "light", def: "[[Flywheel]] is an AI workstation, coding harness, and local model forge with offline SHA-256 receipts. CMMNS and Articulate sit beside it.", rows: ["flywheel", "cmmns", "articulate"] },
  { id: "engine", hue: "theplygrnd", word: "The Playground", mark: "THEPLAYGRND", href: "/playground/", sub: [["/raw.html", "Native renderer"], ["/studio.html", "Studio"], ["/media/", "Media & films"], ["/low-water.html", "Low Water"]], tech: "nightlights", def: "[[The Playground]] is a rendering engine that turns one description into picture, type, biomechanics, and sound.", rows: ["raw-native", "superframe"] },
  { id: "game", hue: "game", word: "Game", href: "/low-water.html", tech: "chladni", def: "Low Water, the game built on The Playground.", rows: ["low-water"] },
  { id: "site", hue: "brass", word: "Site", href: "/#site", tech: "swarm", def: "This site, built with The Playground.", rows: ["site"] },
  { id: "everything", hue: "brass", word: "Everything", href: "/tools.html", tech: "rope", def: "Every public repository, tool, plugin, and study across all five flagships.", rows: ["research"] },
];

// After the six, the rest of the hand's places, also in a fixed order.
export const MENU_AFTER = [
  ["/person.html", "rope", "About"],
  ["/architecture.html", "rope", "Architecture"],
  ["/models.html", "glyphcell", "Models"],
  ["/demos.html", "light", "Demos"],
  ["/media/", "sound", "Media"],
  ["/world/", "rope", "World"],
  ["/essays.html", "swarm", "Essays"],
  ["/studies/", "rope", "Studies"],
  ["/findings/", "rope", "Findings"],
  ["/security.html", "rope", "Security"],
  ["/hire.html", "rope", "Work"],
  ["/cv.html", "rope", "CV"],
];
export const MENU = [...LANDMARKS.map((l) => [l.href, l.tech, l.word, l.sub || []]), ...MENU_AFTER];

// Every piece of work in landmark order, each with its generated version and Verified line.
export const PLATFORMS = LANDMARKS.flatMap((l) => l.rows.map((id) => {
  const r = ROWS[id], version = versionOf(id);
  return { id, landmark: l.id, ...r, version, releaseUrl: R.products[id]?.github?.url || null, run: fill(r.run, id), verified: verifiedFor(id) };
}));
