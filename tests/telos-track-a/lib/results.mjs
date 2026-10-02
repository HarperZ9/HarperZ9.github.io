// results.mjs: write a Track A result file that cites the pre-registration hash (T0.2).
// Writing happens only when TELOS_WRITE_RESULTS=1, so ordinary test runs and mutation runs leave the
// committed result files untouched.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preregSha256 } from "../prereg-hash.mjs";

export const RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "results");

export function writeResult(name, body) {
  if (process.env.TELOS_WRITE_RESULTS !== "1") return null;
  mkdirSync(RESULTS_DIR, { recursive: true });
  const out = { prereg_sha256: preregSha256(), result: name, node: process.version, ...body };
  const path = join(RESULTS_DIR, name + ".json");
  writeFileSync(path, JSON.stringify(out, null, 1) + "\n");
  return path;
}
