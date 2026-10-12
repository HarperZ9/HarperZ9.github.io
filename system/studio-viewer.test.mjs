// The Verified viewer's pinned release copy (studio-viewer.js): every file under
// media/raw-native/viewer-<version>/ is the raw-native release's own byte, checked against the
// SHA256SUMS that ships inside the release's viewer zip, and the page the Studio loads is one of
// them. A changed byte fails here (control: a flipped byte must not match).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { VIEWER_DIR, VIEWER_PAGE, VIEWER_VERSION } from "./studio-viewer.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = join(ROOT, VIEWER_DIR);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sums = () => new Map(readFileSync(join(DIR, "SHA256SUMS"), "utf8").trim().split("\n").map((l) => {
  const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(l.trim());
  assert.ok(m, `SHA256SUMS line: ${l}`);
  return [m[2], m[1]];
}));

test("every file of the pinned viewer matches the release's SHA256SUMS", () => {
  const listed = sums();
  // LICENSE-NOTE.md and RELEASE.md are the site's notes beside the copy; SHA256SUMS is the list itself.
  const own = new Set(["SHA256SUMS", "LICENSE-NOTE.md", "RELEASE.md"]);
  const files = walk(DIR).map((p) => relative(DIR, p).split(sep).join("/")).filter((n) => !own.has(n));
  assert.deepEqual([...files].sort(), [...listed.keys()].sort(), "the copy holds exactly the listed files");
  for (const name of files) assert.equal(sha(readFileSync(join(DIR, name))), listed.get(name), name);
});

test("a changed byte does not match (control)", () => {
  const listed = sums();
  const b = Buffer.from(readFileSync(join(DIR, "web/viewer/viewer.mjs")));
  b[10] ^= 1;
  assert.notEqual(sha(b), listed.get("web/viewer/viewer.mjs"));
});

test("the Studio loads the release's own page, and the page loads the release's own wasm", () => {
  assert.equal(VIEWER_PAGE, `media/raw-native/viewer-${VIEWER_VERSION}/web/viewer/index.html`);
  const listed = sums();
  assert.ok(listed.has("web/viewer/index.html") && listed.has("build-wasm-gpu/raw-native-gpu.wasm"));
  const pinned = JSON.parse(readFileSync(join(DIR, "build-wasm-sums.json"), "utf8"))["wasm-gpu"];
  assert.equal(pinned.wasm, listed.get("build-wasm-gpu/raw-native-gpu.wasm"));
  assert.equal(pinned.mjs, listed.get("build-wasm-gpu/raw-native-gpu.mjs"));
  const note = readFileSync(join(DIR, "RELEASE.md"), "utf8");
  assert.match(note, new RegExp(`raw-native-${VIEWER_VERSION.replace(/\./g, "\\.")}-viewer\\.zip`));
  assert.match(note, /[0-9a-f]{64}/);
});
