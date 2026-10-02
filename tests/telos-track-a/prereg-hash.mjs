// prereg-hash.mjs: SHA-256 of the pre-registered block in PREREGISTRATION.md.
// The hashed bytes are the UTF-8 bytes strictly between the end of the start marker and the start of
// the end marker, with CRLF folded to LF so a Windows checkout hashes the same as a Linux one.
// Usage: node tests/telos-track-a/prereg-hash.mjs        prints the hex digest
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PREREG_PATH = join(dirname(fileURLToPath(import.meta.url)), "PREREGISTRATION.md");
const START = "<!-- prereg-track-a-v1:start -->";
const END = "<!-- prereg-track-a-v1:end -->";

export function preregBlock(text, start = START, end = END) {
  const t = text.replace(/\r\n/g, "\n");
  const s = t.indexOf(start);
  const e = t.indexOf(end);
  if (s < 0 || e < 0 || e < s) throw new Error("prereg markers missing or out of order");
  if (t.indexOf(start, s + 1) >= 0 || t.indexOf(end, e + 1) >= 0) throw new Error("prereg markers repeated");
  return t.slice(s + start.length, e);
}

export function preregSha256(text = readFileSync(PREREG_PATH, "utf8")) {
  return createHash("sha256").update(Buffer.from(preregBlock(text), "utf8")).digest("hex");
}

// Amendment 1 (T3 integer path v2) has its own block and hash; the v1 block and its hash are unchanged.
const A1_START = "<!-- prereg-track-a-amend-1:start -->";
const A1_END = "<!-- prereg-track-a-amend-1:end -->";
export function amendment1Sha256(text = readFileSync(PREREG_PATH, "utf8")) {
  return createHash("sha256").update(Buffer.from(preregBlock(text, A1_START, A1_END), "utf8")).digest("hex");
}

// Pre-registration 2 (steps T4 to T7) has its own block and hash; the earlier blocks are unchanged.
const P2_START = "<!-- prereg-track-a-t4t7:start -->";
const P2_END = "<!-- prereg-track-a-t4t7:end -->";
export function t4t7Sha256(text = readFileSync(PREREG_PATH, "utf8")) {
  return createHash("sha256").update(Buffer.from(preregBlock(text, P2_START, P2_END), "utf8")).digest("hex");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv;
  console.log(a.includes("--t4t7") ? t4t7Sha256() : a.includes("--amendment-1") ? amendment1Sha256() : preregSha256());
}
