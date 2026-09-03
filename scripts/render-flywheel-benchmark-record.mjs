#!/usr/bin/env node
/** Publish the Flywheel offline benchmark record and its capability declarations.
 *
 * Both inputs are byte-identical copies of files committed in the Flywheel
 * repository, so a reader can fetch the originals at the named commit and hash
 * them against the digests printed on the page. Nothing here recomputes a
 * benchmark. Every number rendered is read out of the sealed record, and every
 * peer tally is derived from the declaration rows rather than read from a
 * summary that could disagree with them.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { escapeMarkup, number, page } from "./analytics-page.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = resolve(ROOT, "analytics", "source");
const RECORD_NAME = "flywheel-offline-benchmark-record.json";
const MATRIX_NAME = "flywheel-capability-declarations.json";
const OUTPUT_STEM = "flywheel-benchmark-record";

// The commit these two source files were copied from. A reader checks the page
// by fetching the same paths at this commit and hashing them.
const SOURCE_COMMIT = "a8e1cd2e7c7a220dc578340438a9482bef3d7485";
const REPO = "https://github.com/HarperZ9/flywheel";
const SHA256 = /^[a-f0-9]{64}$/;
const PEERS = ["codex", "cursor", "claude-code"];
const PEER_LABEL = { codex: "Codex", cursor: "Cursor", "claude-code": "Claude Code" };

// The key each suite leads with. delta_points is read first because a signed
// difference is never a pass rate, and drawing it on a zero-to-one track would
// present a regression as four percent of a success.
const RATE_KEYS = ["pass_rate", "recovery_success_rate", "harness_overall"];
const SIZE_KEYS = ["dimensions", "scenarios", "checks", "cases", "tasks"];

function headline(suite) {
  const head = suite.headline;
  const found = SIZE_KEYS.map((key) => (Number.isInteger(head[key]) ? { key, value: head[key] } : null));
  const denominator = found.find(Boolean);
  if (!denominator) throw new Error(`suite ${suite.name} reports no denominator`);
  if (typeof head.delta_points === "number") {
    const points = head.delta_points * 100;
    return {
      display: `${points >= 0 ? "+" : ""}${number(points, 2)} pp`,
      rate: null,
      denominator,
      reason: "a signed difference, not a rate",
    };
  }
  const rate = RATE_KEYS.map((key) => (typeof head[key] === "number" ? { key, value: head[key] } : null)).find(Boolean);
  if (!rate) throw new Error(`suite ${suite.name} reports neither a rate nor a signed difference`);
  if (rate.value < 0 || rate.value > 1) throw new Error(`suite ${suite.name} rate falls outside zero to one`);
  return { display: `${number(rate.value * 100, 1)}%`, rate, denominator, reason: null };
}

function readRecord(record) {
  if (record.schema !== "flywheel.offline-benchmarks/v1") throw new Error(`unsupported record schema: ${record.schema}`);
  if (!SHA256.test(record.result_sha256)) throw new Error("record seal is not a sha256 digest");
  if (!Array.isArray(record.suites) || !record.suites.length) throw new Error("record carries no suites");
  if (!Array.isArray(record.not_run) || !record.not_run.length) throw new Error("record names no unmeasured suites");
  for (const suite of record.suites) {
    if (!suite.name || !suite.question || typeof suite.headline !== "object") {
      throw new Error(`suite entry is incomplete: ${JSON.stringify(suite.name ?? suite)}`);
    }
  }
  for (const entry of record.not_run) {
    if (!entry.suite || !entry.needs) throw new Error("an unmeasured suite is named without saying what it needs");
  }
  return record.suites.map((suite) => ({
    name: suite.name,
    question: suite.question,
    headline: suite.headline,
    nonGoal: suite.non_goal ?? null,
    caveats: suite.caveats ?? [],
    ...headline(suite),
  }));
}

function readMatrix(matrix, record) {
  if (!Array.isArray(matrix.rows) || !matrix.rows.length) throw new Error("declaration matrix carries no rows");
  if (matrix.declared_on !== record.parity.declared_on) {
    throw new Error("matrix declaration date disagrees with the sealed record");
  }
  if (matrix.rows.length !== record.parity.rows) throw new Error("matrix row count disagrees with the sealed record");
  // The record seals a witnessed count and the rows are the evidence for it.
  // A gap between the two means one of the files is stale, which is the drift
  // this page exists to make impossible.
  const witnessed = matrix.rows.filter((row) => row.flywheel === "WITNESSED").length;
  if (witnessed !== record.parity.witnessed) throw new Error("witnessed rows disagree with the sealed count");
  const tallies = PEERS.map((peer) => {
    const counts = { declares: 0, partial: 0, absent: 0 };
    for (const row of matrix.rows) {
      const cell = row.competitors?.[peer];
      if (cell === true) counts.declares += 1;
      else if (cell === "partial") counts.partial += 1;
      else if (cell === false) counts.absent += 1;
      else throw new Error(`row ${row.key} carries no readable ${peer} cell`);
    }
    if (counts.declares + counts.partial + counts.absent !== matrix.rows.length) {
      throw new Error(`derived ${peer} tallies do not sum to the row count`);
    }
    return { peer, label: PEER_LABEL[peer], ...counts };
  });
  return {
    rows: matrix.rows.length,
    witnessed,
    absent: matrix.rows.length - witnessed,
    uniquelyWitnessed: matrix.summary.uniquely_witnessed.length,
    declaredOn: matrix.declared_on,
    note: matrix.note,
    tallies,
  };
}

function figure(suites, matrix) {
  const trackX = 452;
  const trackWidth = 470;
  const rows = suites
    .map((suite, index) => {
      const y = 158 + index * 62;
      const size = `${suite.denominator.value} ${suite.denominator.key}`;
      const label = suite.rate
        ? `${suite.name}, ${suite.display} ${suite.rate.key.replaceAll("_", " ")} over ${size}`
        : `${suite.name}, ${suite.display}, ${suite.reason}, over ${size}`;
      const track = suite.rate
        ? `<rect x="${trackX}" y="${y - 14}" width="${trackWidth}" height="16" rx="4" fill="#0d1519" stroke="#33484e"></rect>`
          + `<rect x="${trackX}" y="${y - 14}" width="${number(trackWidth * suite.rate.value, 1)}" height="16" rx="4" fill="#2c4a52" stroke="#9fc2c7"></rect>`
        : `<rect x="${trackX}" y="${y - 14}" width="${trackWidth}" height="16" rx="4" fill="#0d1519" stroke="#f3c58f" stroke-dasharray="5 4"></rect>`;
      return `<g role="graphics-symbol" tabindex="0" aria-label="${escapeMarkup(label)}">`
        + `<rect class="focus-ring" x="34" y="${y - 30}" width="1052" height="52" rx="8" fill="none" stroke="none"></rect>`
        + `<text x="52" y="${y}" font-size="17" font-weight="700">${escapeMarkup(suite.name)}</text>`
        + `<text x="52" y="${y + 20}" class="mono muted" font-size="12">${escapeMarkup(size)}</text>`
        + track
        + `<text x="946" y="${y}" font-size="16"${suite.rate ? "" : ' fill="#f3c58f"'}>${escapeMarkup(suite.display)}</text>`
        + `</g>`;
    })
    .join("");
  const nulls = suites.filter((suite) => !suite.rate).length;
  const ruleY = 158 + suites.length * 62 - 40;
  return `<svg role="img" xmlns="http://www.w3.org/2000/svg" width="1120" height="560" viewBox="0 0 1120 560" aria-labelledby="record-title record-desc">`
    + `<title id="record-title">Flywheel offline benchmark record</title>`
    + `<desc id="record-desc">${suites.length} suites ran with no model endpoint. ${suites.length - nulls} report a measured rate and ${nulls} reports a signed difference drawn as a null rather than as a rate. The ${matrix.rows} row capability matrix beneath is a dated reading of public documentation, not a measurement of any peer harness.</desc>`
    + `<style>text{font-family:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#eef6f6}.mono{font-family:"Conso","JetBrains Mono",ui-monospace,monospace}.muted{fill:#bcd0d4}g:focus{outline:none}g:focus-visible .focus-ring{stroke:#ffffff;stroke-width:4}</style>`
    + `<rect width="1120" height="560" fill="#070c0f"></rect>`
    + `<text x="42" y="44" font-size="25" font-weight="700">Flywheel offline benchmark record</text>`
    + `<text x="42" y="76" class="mono muted" font-size="15">${suites.length} suites, no model endpoint required &#183; ${suites.length - nulls} measured rates &#183; ${nulls} negative result</text>`
    + `<text x="42" y="102" class="mono muted" font-size="13">Every number is read out of the sealed record. The negative result is drawn as a null, never on a pass-rate track.</text>`
    + rows
    + `<line x1="42" y1="${ruleY}" x2="1078" y2="${ruleY}" stroke="#33484e"></line>`
    + `<text x="42" y="${ruleY + 28}" class="mono muted" font-size="13">${matrix.rows} capability rows &#183; the Flywheel column is checked against the repository at read time &#183; peer columns are dated declarations</text>`
    + `<text x="42" y="536" class="mono muted" font-size="13">${escapeMarkup(matrix.declaredOn)} &#183; no peer harness was executed &#183; not a speed, quality, or market ranking</text>`
    + `</svg>`;
}

function build(record, matrix, evidence) {
  const suites = readRecord(record);
  const declarations = readMatrix(matrix, record);
  const svg = figure(suites, declarations);
  const nulls = suites.filter((suite) => !suite.rate);
  const companion = {
    schema: "zentropy-flywheel-benchmark-record/v1",
    classification: "offline-benchmark-record",
    declaredOn: declarations.declaredOn,
    sourceCommit: SOURCE_COMMIT,
    sourceCommitUrl: `${REPO}/commit/${SOURCE_COMMIT}`,
    seal: { resultSha256: record.result_sha256, python: record.python, recordSchema: record.schema },
    suites: suites.map((suite) => ({
      name: suite.name,
      question: suite.question,
      headline: suite.headline,
      display: suite.display,
      readsAs: suite.rate ? "rate" : "null",
      denominator: suite.denominator,
      nonGoal: suite.nonGoal,
      caveats: suite.caveats,
    })),
    capabilityDeclarations: declarations,
    peerExecution: {
      peerHarnessesExecuted: 0,
      rowsDeclared: declarations.rows,
      basis: "public documentation and configuration read on the declaration date",
    },
    notRun: record.not_run,
    sourceEvidence: evidence,
    limitations: [
      "Five suites in the not-measured list need a live model endpoint and did not run. They are named rather than omitted so an absent number reads as unmeasured and not as zero.",
      "The capability matrix sets a witnessed Flywheel column beside declared peer columns. Those are two different kinds of evidence and the table does not average them into a score.",
      "The paired replication compares base weights against continued-pretrained weights on general code completion with one deterministic sample per task per arm. It measures a greedy decode, and it does not measure the verification harness.",
      "Every suite here runs offline by construction, so the record covers accountability, recovery, and state behaviour. None of it scores capability against a frontier model.",
    ],
    doesNotProve:
      "This record does not rank Flywheel against any peer harness. No peer was executed to produce a single cell in the capability matrix, the peer columns are a dated reading of public documentation, and the one comparison the record does contain is negative and sits inside its own noise.",
  };

  const suiteRows = suites
    .map((suite) => {
      const notes = suite.caveats.length
        ? suite.caveats.map((item) => `<p>${escapeMarkup(item)}</p>`).join("")
        : escapeMarkup(suite.nonGoal ?? "None recorded");
      return `<tr><th scope="row">${escapeMarkup(suite.name)}<br><span class="status">${escapeMarkup(suite.denominator.value + " " + suite.denominator.key)}</span></th>`
        + `<td${suite.rate ? "" : ' class="unknown"'}>${escapeMarkup(suite.display)}</td>`
        + `<td>${escapeMarkup(suite.question)}</td><td>${notes}</td></tr>`;
    })
    .join("");
  const tallyRows = declarations.tallies
    .map((tally) => `<tr><th scope="row">${escapeMarkup(tally.label)}</th><td>${tally.declares}</td><td>${tally.partial}</td><td>${tally.absent}</td></tr>`)
    .join("");
  const nullRows = record.not_run
    .map((entry) => `<tr><th scope="row">${escapeMarkup(entry.suite)}</th><td>${escapeMarkup(entry.needs)}</td><td>${escapeMarkup(entry.standing_result ?? "No standing result")}</td></tr>`)
    .join("");
  const evidenceRows = evidence
    .map((item) => `<tr><th scope="row"><a href="${escapeMarkup(item.href)}">${escapeMarkup(item.name)}</a></th>`
      + `<td><code>${escapeMarkup(item.sha256)}</code></td>`
      + `<td><a href="${escapeMarkup(item.repositoryHref)}">Original at the named commit</a></td></tr>`)
    .join("");
  const negativeText = nulls.map((suite) => `${suite.name} reads ${suite.display}, ${suite.reason}`).join("; ");
  const limitationItems = companion.limitations.map((item) => `<li>${escapeMarkup(item)}</li>`).join("");

  const body = `<p class="record-label">Offline benchmark record &#183; ${escapeMarkup(declarations.declaredOn)}</p>`
    + `<h1>Flywheel offline benchmark record</h1>`
    + `<p class="notice"><strong>Verdict:</strong> ${suites.length} suites ran with no model endpoint and ${nulls.length} of them reports a negative result. No peer harness was executed. Every peer cell in the capability matrix is a dated reading of public documentation, and this page is not a ranking.</p>`
    + `<p class="lede">The two source files below are byte-identical copies of files committed in the Flywheel repository. Fetch them at the named commit, hash them, and compare against the digests printed here. Every number on this page is read out of them and none is recomputed.</p>`
    + `<div class="figure-scroll" tabindex="0" aria-label="Scrollable Flywheel offline benchmark record">${svg}</div>`
    + `<h2>What ran</h2>`
    + `<div class="table-wrap"><table><caption>One row per suite, leading with the number that answers its question.</caption>`
    + `<thead><tr><th>Suite and denominator</th><th>Headline</th><th>Question</th><th>Caveats and non-goals</th></tr></thead>`
    + `<tbody>${suiteRows}</tbody></table></div>`
    + `<p>${escapeMarkup(negativeText)}. It is drawn as a null rather than on a pass-rate track, because a signed difference plotted between zero and one presents a regression as a partial success.</p>`
    + `<h2>Capability declarations, not measurements</h2>`
    + `<p>${escapeMarkup(declarations.note)}. Flywheel is witnessed on ${declarations.witnessed} of ${declarations.rows} rows with ${declarations.absent} absent, and ${declarations.uniquelyWitnessed} of those rows have no listed peer declaring them. The peer tallies below are derived from the rows on every render rather than read from a stored summary.</p>`
    + `<div class="table-wrap"><table><caption>Peer cells across all ${declarations.rows} rows, derived from the declaration file.</caption>`
    + `<thead><tr><th>Peer harness</th><th>Declares</th><th>Partial</th><th>Absent</th></tr></thead>`
    + `<tbody>${tallyRows}</tbody></table></div>`
    + `<p class="notice"><strong>Peer harnesses executed: 0.</strong> These columns record what each project's public documentation states, read on ${escapeMarkup(declarations.declaredOn)}. A declaration is not a measurement, and no cell here was produced by running the peer.</p>`
    + `<h2>What was not measured</h2>`
    + `<div class="table-wrap"><table><caption>Suites that need a live model endpoint, named so an absent number reads as unmeasured.</caption>`
    + `<thead><tr><th>Suite</th><th>Needs</th><th>Standing result</th></tr></thead>`
    + `<tbody>${nullRows}</tbody></table></div>`
    + `<dl class="scope">`
    + `<dt>Benchmark code</dt><dd><a href="${escapeMarkup(companion.sourceCommitUrl)}"><code>${escapeMarkup(SOURCE_COMMIT)}</code></a></dd>`
    + `<dt>Record seal</dt><dd><code>${escapeMarkup(record.result_sha256)}</code></dd>`
    + `<dt>Interpreter</dt><dd>Python ${escapeMarkup(record.python)}</dd>`
    + `<dt>Regeneration</dt><dd><code>python scripts/run_offline_benchmarks.py</code> then <code>python scripts/build_benchmark_page.py</code>. A test in the engine repository re-runs the first and compares the seal.</dd>`
    + `<dt>Peer measurement</dt><dd class="unknown">Unknown: no peer harness was executed for this record</dd>`
    + `<dt>Capability against a frontier model</dt><dd class="unknown">Unknown: every suite here runs offline and none scores capability</dd>`
    + `</dl>`
    + `<h2>Source evidence</h2>`
    + `<div class="table-wrap"><table><caption>Public source files and their digests.</caption>`
    + `<thead><tr><th>File</th><th>SHA-256</th><th>Original</th></tr></thead>`
    + `<tbody>${evidenceRows}</tbody></table></div>`
    + `<h2>Limitations</h2><ul>${limitationItems}</ul>`
    + `<p class="does-not-prove"><strong>What this does not prove:</strong> ${escapeMarkup(companion.doesNotProve)}</p>`;

  return { html: page("Flywheel offline benchmark record", body), svg, companion };
}

async function source(name, repositoryPath, label) {
  const bytes = await readFile(resolve(sourceDir, name));
  return {
    parsed: JSON.parse(bytes.toString("utf8")),
    evidence: {
      name: label,
      href: `source/${name}`,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      repositoryHref: `${REPO}/blob/${SOURCE_COMMIT}/${repositoryPath}`,
      availability: "public-repository-file",
    },
  };
}

// --source-dir exists so a test can point the reader at a mutated copy of the
// records and prove the checks above actually fail. A falsifier that is never
// fired is not a check, it is a comment.
const flags = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  if (!["--output-dir", "--source-dir"].includes(name) || process.argv[index + 1] === undefined) {
    throw new Error("usage: render-flywheel-benchmark-record.mjs [--output-dir <dir>] [--source-dir <dir>]");
  }
  flags.set(name, process.argv[index + 1]);
}
const sourceDir = resolve(flags.get("--source-dir") ?? SOURCE_DIR);
const outputDir = resolve(flags.get("--output-dir") ?? resolve(ROOT, "analytics"));
await mkdir(outputDir, { recursive: true });
const record = await source(RECORD_NAME, "docs/benchmarks/report.json", "Sealed offline benchmark record");
const matrix = await source(MATRIX_NAME, "docs/benchmarks/parity.json", "Capability declaration matrix");
const built = build(record.parsed, matrix.parsed, [record.evidence, matrix.evidence]);
await Promise.all([
  writeFile(resolve(outputDir, `${OUTPUT_STEM}.html`), `${built.html}\n`, "utf8"),
  writeFile(resolve(outputDir, `${OUTPUT_STEM}.svg`), `${built.svg}\n`, "utf8"),
  writeFile(resolve(outputDir, `${OUTPUT_STEM}.json`), `${JSON.stringify(built.companion, null, 2)}\n`, "utf8"),
]);
console.log(
  `rendered ${OUTPUT_STEM}: ${built.companion.suites.length} suites, `
  + `${built.companion.capabilityDeclarations.rows} declaration rows, 0 peer harnesses executed`,
);
