// findings-outcome.mjs: the outcome word against the run's own verdicts.
//
// findings/data/meta.json names, per finding, the result files whose preregistered verdicts the page rests on
// (verdict_files) and, where the paper states it, whether a kill rule fired (kill: "fired" or "not fired", with a
// note). The outcome word is chosen by hand; this module counts the verdicts and refuses a word the count
// contradicts: "held" cannot stand when a kill rule fired or when more verdicts failed than passed.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const F = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "findings");

// tally(id, files) -> { held, failed, untestable, files } over every verdict in the named result files
export function tally(id, files) {
  const t = { held: 0, failed: 0, untestable: 0, files: [...files] };
  for (const f of files) {
    // result files are written by Python, which prints Infinity and NaN bare; only the verdict words are read here
    const verdicts = JSON.parse(readFileSync(path.join(F, "results", id, f), "utf8").replace(/([:,\[]\s*)(-?Infinity|NaN)(?=\s*[,\]}])/g, "$1null")).verdicts;
    if (!verdicts || typeof verdicts !== "object") throw new Error(`${id}: ${f} holds no verdicts`);
    for (const v of Object.values(verdicts)) {
      const word = typeof v === "string" ? v : v.verdict;
      if (word === "PASS") t.held += 1; else if (word === "FAIL") t.failed += 1; else if (word === "UNTESTABLE") t.untestable += 1;
      else throw new Error(`${id}: ${f} has a verdict "${word}" this count does not know`);
    }
  }
  return t;
}

// outcomeProblem(outcome, verdicts, kill) -> a sentence when the word contradicts the verdicts, else null
export function outcomeProblem(outcome, verdicts, kill) {
  if (outcome !== "held") return null;
  if (kill && kill.state === "fired") return 'the outcome is "held" while a kill rule fired';
  if (verdicts && verdicts.failed > verdicts.held) return `the outcome is "held" while ${verdicts.failed} of ${verdicts.held + verdicts.failed} verdicts failed`;
  return null;
}

// verdictsFor(id, meta) -> { verdicts?, kill? } for the record's document
export function verdictsFor(id, meta) {
  const out = {};
  if (meta.verdict_files && meta.verdict_files.length) out.verdicts = tally(id, meta.verdict_files);
  if (meta.kill) {
    if (!["fired", "not fired"].includes(meta.kill.state) || !meta.kill.note) throw new Error(`${id}: kill needs state "fired" or "not fired" and a note`);
    out.kill = { state: meta.kill.state, note: meta.kill.note };
  }
  const problem = outcomeProblem(meta.outcome, out.verdicts, out.kill);
  if (problem) throw new Error(`${id}: ${problem}; choose the outcome word the verdicts support`);
  return out;
}
