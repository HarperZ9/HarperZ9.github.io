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

export function preregBlock(text) {
  const t = text.replace(/\r\n/g, "\n");
  const s = t.indexOf(START);
  const e = t.indexOf(END);
  if (s < 0 || e < 0 || e < s) throw new Error("prereg markers missing or out of order");
  if (t.indexOf(START, s + 1) >= 0 || t.indexOf(END, e + 1) >= 0) throw new Error("prereg markers repeated");
  return t.slice(s + START.length, e);
}

export function preregSha256(text = readFileSync(PREREG_PATH, "utf8")) {
  return createHash("sha256").update(Buffer.from(preregBlock(text), "utf8")).digest("hex");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(preregSha256());
}
