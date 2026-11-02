// platforms.mjs: the front door's index of the work, built into index.html by scripts/build-world-home.mjs.
// Each platform: what it does for the visitor, where to see it work, how to run it now, and its source.
// Display names (the author, 2026-10-29: "THE COMMONS (THECMMNS) | THE PLAYGROUND (THEPLYGRND) THE FLYWHEEL
// (THEFLYWHEEL)" and, 2026-11-02, "ARTICULATE (ARTIQL8)") are names on the page only, each shown with its mark; no
// repo, package or path changes with them. BuildLang and Research have no mark from the author, so none is shown.
//
// Every version and date below was read on the day in `checked` from the source named in `verified`. When a release
// ships, update the row and the date together; tests/test_front_door_platforms.py checks the shape and the voice.
export const CHECKED = "2 November 2026";

export const PLATFORMS = [
  {
    id: "flywheel", name: "THE FLYWHEEL", mark: "THEFLYWHEEL", product: "Flywheel", version: "1.9.0",
    what: "Run any model, hosted or local, and check its answer against the source that decides it before the answer reaches your team. Every step is kept as a receipt you can recheck offline.",
    see: ["/demo-flywheel.html", "Watch a check, a tamper and a refusal"], more: ["/flywheel.html", "Flywheel"],
    run: "pip install flywheel-verify", then: "flywheel up",
    repo: "https://github.com/HarperZ9/flywheel",
    verified: "version 1.9.0 is the latest GitHub release of HarperZ9/flywheel (15 October 2026) and the current PyPI version of flywheel-verify.",
  },
  {
    id: "commons", name: "THE COMMONS", mark: "THECMMNS", product: "CMMNS", version: "3.9.1",
    what: "A browser extension that shows where a reply comes from, signs of coordination, how it argues, and whether a fact-checker has reviewed the claim. It runs in your browser on X, YouTube, Reddit, Bluesky and more.",
    see: ["/cmmns.html#try", "Try it on your own words"], more: ["/daylight-commons/how-it-works.html", "How each sign is read"],
    run: "Download cmmns-chrome-3.9.1.zip, then Load unpacked", runIsProse: true,
    repo: "https://github.com/HarperZ9/cmmns",
    verified: "version 3.9.1 and its download names match the latest GitHub release of HarperZ9/cmmns (28 October 2026).",
  },
  {
    id: "playground", name: "THE PLAYGROUND", mark: "THEPLYGRND", product: "Superframe", version: "0.2.0",
    what: "Describe a piece in plain words and get it back from one seed as paint, living type, lines, carved material, sound and touch. The same words and seed give the same files, byte for byte.",
    see: ["/superframe.html", "One recipe in every medium"], more: ["/world/superframe/room/index.html", "The assistive room"],
    run: "git clone https://github.com/HarperZ9/superframe", then: "npm run make", note: "Node 24 or later",
    repo: "https://github.com/HarperZ9/superframe",
    verified: "version 0.2.0 is the latest GitHub release of HarperZ9/superframe (28 October 2026).",
  },
  {
    id: "articulate", name: "ARTICULATE", mark: "ARTIQL8", product: "Articulate", version: "0.17.0",
    what: "Checks prose on your own computer and names each writing pattern with the line it is on. Modes for docs, commits, essays and fiction, in a terminal, an editor or code review.",
    see: ["/repo-explainers/articulate.html", "How it works, animated"], more: ["/articulate.html", "Articulate"],
    run: "pip install articulate-writing", then: "articulate check notes.md",
    repo: "https://github.com/HarperZ9/articulate",
    verified: "version 0.17.0 is the latest GitHub release of HarperZ9/articulate (26 October 2026); PyPI serves 0.16.0 of articulate-writing (23 October 2026).",
  },
  {
    id: "buildlang", name: "BUILDLANG", product: "BuildLang", version: "1.10.0",
    what: "A compiled language where a function's type lists what it may touch, such as files, the network or C. It builds native binaries through C and emits HLSL and GLSL shaders.",
    see: ["/buildlang.html", "Real compiler output"], more: ["/buildlang/", "The language guide"],
    run: "cargo install buildlang --version 1.10.0 --locked",
    repo: "https://github.com/HarperZ9/buildlang",
    verified: "version 1.10.0 is the latest GitHub release of HarperZ9/buildlang (23 October 2026) and the current crates.io version.",
  },
  {
    id: "research", name: "RESEARCH", product: "Essays and papers",
    what: "Essays, papers and dated briefings on how AI work gets checked and who pays for the checking, and the experiments behind them, each written down before it ran.",
    see: ["/experiments/", "Every experiment, nulls included"], more: ["/research.html", "Papers and essays"],
  },
];
