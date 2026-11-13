// platforms.mjs: the front door's landmarks and the work under each, built into index.html by
// scripts/build-world-home.mjs, and the menu every generated page carries (scripts/studies-shell.mjs).
//
// Landmarks keep their place (DESIGN-RULES.md, author 2026-11-09: "Yes"). Their order is the author's, 2026-11-09,
// verbatim: "BuildLang, Flywheel, Engine, Game, Site, Everything". The same six lead the menu on every page, in that
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
    try: "#w-buildlang", what: "A compiled language where a function's type lists what it may touch. The compiler proves the laws you write beside the code and builds native programs through C.",
    see: ["/buildlang.html", "The registry, laws and the C path"], more: ["https://github.com/HarperZ9/buildlang/blob/main/docs/GETTING_STARTED.md", "The language guide"],
    run: "cargo install buildlang --version {v} --locked", repo: "https://github.com/HarperZ9/buildlang" },
  flywheel: { hue: "theflywheel", product: "Flywheel",
    try: "#w-flywheel", what: "Check any model's answer against the source that decides it, and keep every step as a [[receipt]]: a record of each step's inputs, output and hashes that anyone can recheck offline, not a log of what the model claimed.",
    see: ["/demo-flywheel.html", "Watch a check, a tamper and a refusal"], more: ["/flywheel.html", "Flywheel"],
    run: "pip install flywheel-verify", then: "flywheel up", repo: "https://github.com/HarperZ9/flywheel" },
  "raw-native": { hue: "theplygrnd", product: "raw-native",
    try: "#w-engine", what: "A renderer that draws each frame twice, on the CPU reference and on the GPU, and certifies whether they agree. Its light comes from [[radiance cascades]]: light gathered by rings of probes, each ring reaching farther at coarser detail, an approximation checked against a traced reference.",
    see: ["/raw.html", "Render the frame, then check it"], more: ["/low-water.html", "The game it runs"],
    run: "Download raw-native-{v}-windows-x64.zip from the release", runIsProse: true, repo: "https://github.com/HarperZ9/raw-native" },
  superframe: { hue: "theplygrnd", product: "Superframe",
    try: "#w-engine", what: "One seed, written in plain words, comes back as paint, living type, lines, carved material, sound and touch. It is [[deterministic]]: the same words and seed give the same bytes on every run, not just a similar picture.",
    see: ["/superframe.html", "One recipe in every medium"], more: ["/world/superframe/room/index.html", "The assistive room"],
    run: "git clone https://github.com/HarperZ9/superframe", then: "npm run make", note: "Node 24 or later", repo: "https://github.com/HarperZ9/superframe" },
  "low-water": { hue: "game", product: "Low Water",
    try: "#w-low-water", what: "A narrative game in five eras, built as the full-scale demonstration of the engine.",
    see: ["/low-water.html", "Low Water"], more: ["/raw.html", "The engine under it"] },
  site: { product: "This site",
    what: "Ten places, each a medium with the laws it draws on.",
    see: ["#p-light", "The places"], more: ["/world/universe/proto/index.html", "The map"], repo: "https://github.com/HarperZ9/HarperZ9.github.io" },
  cmmns: { hue: "thecmmns", product: "CMMNS", name: "THE COMMONS", mark: "THECMMNS",
    try: "#w-commons", what: "A browser extension that shows where a reply comes from, how it argues, and whether a fact-checker has looked at the claim.",
    see: ["/cmmns.html#try", "Try it on your own words"], more: ["/daylight-commons/how-it-works.html", "How each sign is read"],
    run: "Download cmmns-chrome-{v}.zip, then Load unpacked", runIsProse: true, repo: "https://github.com/HarperZ9/cmmns" },
  articulate: { hue: "artiql8", product: "Articulate", name: "ARTICULATE", mark: "ARTIQL8",
    try: "#w-articulate", what: "Names each writing pattern in your prose with the line it is on, on your own computer.",
    see: ["/repo-explainers/articulate.html", "How it works, animated"], more: ["/articulate.html", "Articulate"],
    run: "pip install articulate-writing", then: "articulate check notes.md", repo: "https://github.com/HarperZ9/articulate" },
  research: { hue: "rsrch", product: "Essays and papers", name: "RESEARCH", mark: "RSRCH",
    try: "#w-writing", what: "Essays, papers and the experiments behind them, each written down before it ran, nulls included.",
    see: ["/experiments/", "Every experiment, nulls included"], more: ["/research.html", "Papers and essays"] },
};

// The six landmarks. `href` is where the menu sends a reader, always the product's own page; `sub` is the second
// level the menu lists under the word; `rows` is the work the home sets under each.
export const LANDMARKS = [
  { id: "buildlang", hue: "bldlng", word: "BuildLang", mark: "BLDLNG", href: "/buildlang.html", tech: "glyphcell", def: "[[BuildLang]] means the language, its compiler buildc and its package registry; it is not a build system.", rows: ["buildlang"] },
  // the checking platforms sit together: Flywheel seals and rechecks, CMMNS reads public claims, Articulate checks
  // the words that leave; each keeps its own name and mark
  { id: "flywheel", hue: "theflywheel", word: "Flywheel", mark: "THEFLYWHEEL", href: "/flywheel.html", sub: [["/cmmns.html", "CMMNS"], ["/articulate.html", "Articulate"]], tech: "light", def: "Three checking tools sit here. [[Flywheel]] checks a model's answer, CMMNS reads public replies, and Articulate checks prose. Each one shows its evidence and leaves the decision to you.", rows: ["flywheel", "cmmns", "articulate"] },
  { id: "engine", hue: "theplygrnd", word: "Engine", mark: "THEPLYGRND", href: "/raw.html", sub: [["/playground/", "The Playground"], ["/superframe.html", "Superframe"]], tech: "nightlights", def: "The [[engine]] means raw-native, which renders, and Superframe, which composes; together they are THE PLAYGROUND.", rows: ["raw-native", "superframe"] },
  { id: "game", hue: "game", word: "Game", href: "/low-water.html", tech: "chladni", def: "Low Water, the game built on the engine.", rows: ["low-water"] },
  { id: "site", hue: "brass", word: "Site", href: "/#site", tech: "swarm", def: "This site, built from the same engines.", rows: ["site"] },
  { id: "everything", hue: "brass", word: "Everything", href: "/floor.html", tech: "rope", def: "Every piece of work, current and past, with its status.", rows: ["research"] },
];

// After the six, the rest of the hand's places, also in a fixed order.
export const MENU_AFTER = [
  ["/world/universe/proto/index.html", "rope", "Map"],
  ["/publications.html", "swarm", "Writing"],
  ["/explainers.html", "sound", "Films"],
  ["/hire.html", "rope", "Work"],
  ["/cv.html", "rope", "CV"],
];
export const MENU = [...LANDMARKS.map((l) => [l.href, l.tech, l.word, l.sub || []]), ...MENU_AFTER];

// Every piece of work in landmark order, each with its generated version and Verified line.
export const PLATFORMS = LANDMARKS.flatMap((l) => l.rows.map((id) => {
  const r = ROWS[id], version = versionOf(id);
  return { id, landmark: l.id, ...r, version, releaseUrl: R.products[id]?.github?.url || null, run: fill(r.run, id), verified: verifiedFor(id) };
}));
