// buildlang.mjs: the words and figures of buildlang.html, built by scripts/build-product-pages.mjs.
// Every figure names the pull request or file it was read from. The build reads each pull request's merge state and
// the release from site-src/world/releases.json, so "in 1.11.0", "on main" and "open" are fetched, never typed here.
// A figure with no public source does not go on this page.
export const REPO = "https://github.com/HarperZ9/buildlang";
export const file = (p) => `${REPO}/blob/main/${p}`;

export const INTRO = {
  title: "BuildLang",
  description: "BuildLang is a compiled language where a function's type lists what it may touch. The compiler proves the laws written beside the code, checks parallel loops for safety, and builds native programs through C. Our own tools ship in it as packages.",
  lede: "A function's type lists what it may touch. The compiler checks it, proves your laws and builds native code through C.",
};

export const SECTIONS = [
  {
    id: "registry", title: "The registry",
    lede: "Our own tools, rewritten in BuildLang and checked byte for byte against the originals they replace.",
    run: "buildc pkg build",
    // each package: where it came from (drawn twice, by shape and by word) and what its check found
    list: [
      ["sha256", "1.0.0", "flywheel", "Published with the package manager in 1.11.0, pure BuildLang."],
      ["merkle", "1.0.0", "flywheel", "Matches Flywheel's RFC 6962 tree on every root and proof for 0 to 40 leaves."],
      ["canonical-record", "1.0.0", "flywheel", "190 of 190 cases byte-identical with Flywheel's RFC 8785 original."],
      ["readability", "1.0.0", "flywheel", "9 of 9 cases and 400 random texts identical with Flywheel's linter."],
      ["color", "1.0.0", "color", "34 Sharma CIEDE2000 pairs exact; 608 random pairs within 2.84e-14."],
      ["repo-art", "1.0.0", "site", "The 3 committed artworks and 7 stress artworks byte-identical."],
      ["art-receipts", "1.0.0", "site", "10 of 10 cases byte-identical, with equal exit codes."],
      ["shader-utils", "1.0.0", "std", "Carries a SHA-256 per version since 1.11.0."],
      ["std-math", "1.0.0", "std", "Carries a SHA-256 per version since 1.11.0."],
      ["std-collections", "0.1.0", "std", "Carries a SHA-256 per version since 1.11.0."],
      ["lw-hash", "0.1.0", "game", "611 of 611 Low Water world states: payload text and hash identical."],
      ["lw-codec", "0.1.0", "game", "40 of 40 combat traces round-trip byte for byte."],
      ["lw-cbegin", "0.1.0", "game", "The 40 run records identical to the first line of each trace."],
      ["lw-moves", "0.1.0", "game", "168,234 bytes identical to the game's expanded move table."],
    ],
    origins: { flywheel: ["circle", "from Flywheel"], color: ["square", "from build-color"], site: ["triangle", "from this site's tools"], std: ["diamond", "the standard library"], game: ["hexagon", "from Low Water, AGPL-3.0-only"] },
    listSource: { file: "registry/index.json" },
    figs: [
      { n: "190 of 190", text: "cases of canonical-record are byte-identical with Flywheel's RFC 8785 original", detail: "Also 75 of 75 published vector fields and 8,000 random documents.", pr: 156 },
      { n: "34 of 34", text: "Sharma CIEDE2000 pairs from color match build-color exactly", detail: "608 random pairs agree within 2.84e-14. JzAzBz, ICtCp, HSV and the wide-gamut matrices are left for a later wave.", pr: 156 },
      { n: "0 to 40 leaves", text: "merkle matches Flywheel's RFC 6962 tree byte for byte on every root, inclusion and consistency proof", detail: "Published with the package manager: publish, resolve, lock and build offline, with a SHA-256 content hash per version.", pr: 137 },
      { n: "BL0702", text: "is the error a tampered package gets; two clean copies build the same C from one lock", detail: "compiler/tests/pkg_flow.rs also plants an unmeetable range (BL0701), a stale lock (BL0703) and a republish (BL0707).", pr: 137 },
      { n: "4", text: "Low Water kernels joined the public registry under AGPL-3.0-only", detail: "lw-hash, lw-codec, lw-cbegin and lw-moves, each checked against the game's own files; the registry now holds 14 versions, each matching its index.", pr: 160 },
    ],
  },
  {
    id: "laws", title: "Laws and contracts",
    lede: "Write a law beside the code. The compiler proves it, refutes it with a counterexample, or says why it cannot tell.",
    run: "buildc verify laws.bld",
    figs: [
      { n: "10 of 10", text: "false laws with rare counterexamples stay unproved", detail: "A planted mutant prover, one that treats 0 >= 0 as a contradiction, fails that set. The prover is sound and incomplete: every step only weakens what it knows.", pr: 138 },
      { n: "12 proved, 4 refuted", text: "on our own laws: the DETMATH integer rules, the trace codec and conservation laws", detail: "All four refutations are planted.", pr: 138 },
      { n: "12 of 13", text: "of Bend 2's laws, ported, are proved", detail: "The unknown one, add_comm over a recursive add on all of u32, needs induction the prover does not do. No comparison with Bend or any other verifier on a shared benchmark is claimed.", pr: 138 },
    ],
    source: { file: "docs/VERIFY.md" },
  },
  {
    id: "tv", title: "Translation validation",
    lede: "An independent checker proves that each function's C does what its source says: the same traps, the same results.",
    run: "buildc tv program.bld",
    figs: [
      { n: "31 of 38", text: "functions inside the checked subset are certified in tests/programs, and 22 of 26 in the standard library", detail: "The subset is integers up to 64 bits and bool, with branches, loops and calls. Most functions fall outside it because they print or use strings, floats or structs.", pr: 161 },
      { n: "3 of 3", text: "adding functions lose their certificate when a planted switch turns + into - in the C backend", detail: "The other six stay certified. A wrong variable map, a wrong loop head and tampered C are each refused.", pr: 161 },
      { n: "1 bug", text: "found by the checker in the compiler, and fixed: an unannotated integer compared with an i64 was emitted as 32 bits", detail: "The program passed buildc check and aborted at 2^31; the checker refused the function. The fix types the binding from what the checker inferred.", pr: 162 },
    ],
  },
  {
    id: "parallel", title: "Parallel by default",
    lede: "par_for and par_map run on every core, and the checker proves from the source that the body is safe, so the result matches the serial loop byte for byte.",
    limit: "The parallel call is written out: BuildLang checks its safety, and does not find parallelism on its own.",
    run: "BUILD_PAR_THREADS=8 buildc run program.bld",
    figs: [
      { n: "5.34x", text: "n-body kernel speed-up at 8 threads, 95% interval 5.07 to 5.63", detail: "Per-pixel shading 5.87x [5.57, 6.05]; the Low Water 40-fight corpus 5.09x [4.94, 5.37]. Measured on an i7-13700KF shared with GPU training, 10 rounds. The whole n-body process runs 3.20x faster, because its output loop is serial.", pr: 136 },
      { n: "90 of 90", text: "parallel runs printed the same bytes as the serial run", detail: "Before the fix to the runtime's shared formatting buffers, a control corrupted 2 strings in 1 of 5 runs at 3 threads.", pr: 136 },
    ],
    source: { file: "docs/PARALLEL.md" },
  },
  {
    id: "cabi", title: "Into C, and out of it",
    // the work shipped in #135; #158 scored it on the release, so the section's state is #135's
    statusPrs: [135],
    lede: "Low Water's rules are written in BuildLang and linked into raw-native's C++ host through a plain C header.",
    figs: [
      { n: "16 of 16", text: "checks of raw-native's own C++ test pass against the BuildLang library, as they do against the C++ module", detail: "A planted threshold fails 1. The story expression language is not ported: a record that needs it makes lw_rules_create refuse it with an error naming the record.", pr: 158 },
      { n: "12 of 12", text: "DETMATH goldens hold, and 40 of 40 combat traces match the game's own corpus", detail: "The moves file builds to 168,234 bytes, identical to the golden. Both planted trace faults are caught.", pr: 158 },
      { n: "34 of 34", text: "held-out tasks pass in each of two samples, Wilson 95% 0.90 to 1.00", detail: "The tasks were sealed before any generator saw them. Both samples are two draws of one model with one prompt, and the task writer also wrote the compiler changes, so the tasks may sit closer to the docs than an outside writer's would.", pr: 158 },
    ],
    source: { file: "docs/LANGUAGE-COMPLETE.md" },
  },
  {
    id: "builddb", title: "BuildDB moves in",
    lede: "BuildDB is the database written in BuildLang. The compiler already writes a program into it as tables you can query; the database itself is moving into the language's repository.",
    limit: "The move is not on GitHub yet, so nothing here links to it.",
    run: "buildc bql query prog.bld \"SELECT DISTINCT function FROM effects WHERE effect = 'Network'\"",
    figs: [
      { n: "4 tables", text: "from one program: functions, calls, effects and items, built from the compiler's own analysis", detail: "bql export writes them in BuildDB's file format, so its full SQL dialect runs over a program; bql query runs a subset in process and names BuildDB for the rest.", pr: 118 },
      { n: "35 of 35", text: "sampled renames agree with a full rebuild, and 1 is refused", detail: "bql verify rebuilds the store and compares it table by table. No incremental view ships without sampled agreement against a rebuild, and two planted faults are caught.", pr: 119 },
    ],
  },
];

// the first step: one real check, captured from buildc (kept from the earlier page, output verbatim)
export const FIRST_STEP = {
  title: "The first step",
  lede: "Choose what the function may touch and watch it build or fail.",
  toyNote: "The function above follows BuildLang's rule in the page itself: read_file needs FileSystem, println! needs Console, and effects join with +. The messages copy the wording of the captured run below. The rule is written down in",
  code: `fn load_config() {
    read_file("ops.toml");   // reaches the filesystem
}

$ buildc check missing_effect.bld
function \`load_config\` performs effect \`FileSystem\` but does not declare it
help: add ~ FileSystem to the signature

fn load_config() ~ FileSystem { read_file("ops.toml"); }

$ buildc check load_config.bld --receipt receipt.json
Type checking... OK`,
};
