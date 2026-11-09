// The Finish layer's pinned engine copy (studio-finish.js): every file under
// media/raw-native/post-<version>/ matches the SHA256SUMS beside it, the copy holds exactly the
// listed files, and each look the layer offers is a pass the copied shader library registers.
// A changed byte fails here (control: a flipped byte must not match).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_VERSION, FINISHES } from "./studio-finish.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = join(ROOT, `media/raw-native/post-${ENGINE_VERSION}`);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sums = () => new Map(readFileSync(join(DIR, "SHA256SUMS"), "utf8").trim().split("\n").map((l) => {
  const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(l.trim());
  assert.ok(m, `SHA256SUMS line: ${l}`);
  return [m[2], m[1]];
}));

test("every file of the pinned post stack matches SHA256SUMS", () => {
  const listed = sums();
  const own = new Set(["SHA256SUMS", "LICENSE-NOTE.md", "RELEASE.md"]);
  const files = walk(DIR).map((p) => relative(DIR, p).split(sep).join("/")).filter((n) => !own.has(n));
  assert.deepEqual([...files].sort(), [...listed.keys()].sort(), "the copy holds exactly the listed files");
  for (const name of files) assert.equal(sha(readFileSync(join(DIR, name))), listed.get(name), name);
});

test("a changed byte does not match (control)", () => {
  const listed = sums();
  const b = Buffer.from(readFileSync(join(DIR, "web/motion/post_run.mjs")));
  b[10] ^= 1;
  assert.notEqual(sha(b), listed.get("web/motion/post_run.mjs"));
});

test("the copy is the engine version the layer names, and every look is a registered pass", () => {
  const gpu = readFileSync(join(DIR, "web/raw-gpu.mjs"), "utf8");
  assert.match(gpu, new RegExp(`export const VERSION = "${ENGINE_VERSION.replace(/\./g, "\\.")}";`));
  const lib = readFileSync(join(DIR, "web/shaders/post.mjs"), "utf8");
  const looks = Object.entries(FINISHES).filter(([k]) => k !== "off");
  assert.equal(looks.length, 4);
  for (const [name, f] of looks) for (const s of f.specs) assert.match(lib, new RegExp(`registerPass\\("${s.pass}"`), `${name}: ${s.pass}`);
  // M1 criterion 9 names the CRT, film grain and chromatic aberration: all three are offered.
  const passes = looks.flatMap(([, f]) => f.specs.map((s) => s.pass));
  assert.ok(passes.includes("crt") && passes.includes("crt-classic") && passes.includes("film"));
  assert.ok(FINISHES.classic.specs[0].aberration > 0, "the classic tube draws chromatic aberration");
  assert.equal(FINISHES.off.specs.length, 0);
});
