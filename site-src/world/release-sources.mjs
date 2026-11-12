// release-sources.mjs: where each version and status on the home comes from. scripts/fetch-releases.mjs reads these
// sources and writes site-src/world/releases.json; scripts/build-world-home.mjs turns that file into the versions,
// the install lines and the Verified lines, so a release refreshes the home with no hand edit.
//
//   github    the repository whose latest GitHub release names the version shown
//   registry  the package index that should carry the same version (pypi, crates or npm), if any
//   asset     a download the release must carry, with {v} for the version
//   prs       merged pull requests a row without a release rests on: [repo, number]
export const SOURCES = {
  buildlang: { github: "HarperZ9/buildlang", registry: { kind: "crates", name: "buildlang" } },
  flywheel: { github: "HarperZ9/flywheel", registry: { kind: "pypi", name: "flywheel-verify" } },
  "raw-native": { github: "HarperZ9/raw-native", asset: "raw-native-{v}-windows-x64.zip" },
  superframe: { github: "HarperZ9/superframe" },
  cmmns: { github: "HarperZ9/cmmns", asset: "cmmns-chrome-{v}.zip" },
  articulate: { github: "HarperZ9/articulate", registry: { kind: "pypi", name: "articulate-writing" } },
  // Low Water's repository is private and has no release; its row rests on the engine work merged in public
  "low-water": { prs: [["HarperZ9/raw-native", 239], ["HarperZ9/raw-native", 242], ["HarperZ9/buildlang", 135], ["HarperZ9/buildlang", 158]] },
  // the BuildLang page: each figure opens to one of these, and its merge state is read, not written
  "buildlang-page": { prs: [118, 119, 135, 136, 137, 138, 156, 158, 160, 161, 162].map((n) => ["HarperZ9/buildlang", n]) },
};

export const REGISTRY_NAMES = { pypi: "PyPI", crates: "crates.io", npm: "npm" };
