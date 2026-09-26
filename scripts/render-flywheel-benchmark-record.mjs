#!/usr/bin/env node
/** Publish the Flywheel offline benchmark record and its capability declarations.
 *
 * Both inputs are byte-identical copies of files committed in the Flywheel
 * repository, so a reader can fetch the originals at the named commit and hash
 * them against the digests the page lists. Nothing here recomputes a benchmark.
 * Every score and count rendered is read out of the sealed record, and every
 * peer tally is derived from the declaration rows, so no stored summary can
 * disagree with them.
 *
 * 2026-09-25 human-first notebook: the page leads with one plain notice and one
 * chart sheet. The chart draws each suite's score as a scanline bar with a
 * Wilson 95 percent interval, the one interval this renderer derives (from the
 * count and denominator the record states), and draws the signed comparison on
 * its own axis. The peer tallies, the unmeasured suites, the commit, the record
 * seal, the two file digests and the regeneration commands move into a closed
 * "How we know" section. Suite slugs become words on the page; the record's own
 * notes appear in plain words, and the companion JSON keeps them verbatim. The
 * standalone SVG is a plate: its own light, dark and forced-color styles and an
 * embedded Hanken Grotesk subset, so it reads the same through an img element.
 *
 * Round 3, 25 September 2026: each row carries a short form of its suite's question, the
 * paired row names both models, the takeaway states the finding once and the limit line
 * carries the chance reading, and the record's notes read as plain facts.
 *
 * Round 4, 25 September 2026: each row asks its suite's question in full, plain words, and the
 * page prints the same questions under "What each suite asks" (the companion JSON keeps the
 * record's wording). Every interval names its low end at its left cap, the key keeps one
 * definition, the model has one name, "Flywheel Local Coder 14B", with continued pretraining
 * glossed once, and the record's notes keep their meaning: roster, greedy decode and the
 * unmeasured checking harness.
 *
 * Void and bone, 25 September 2026: the sheet fills the page frame instead of a narrow column,
 * and the plate's grounds move to the site's bone and void papers.
 *
 * Round 2, 25 September 2026: one "How we know" per figure plus one page-level
 * record, with no paragraph printed twice. Unmeasured suites carry plain names,
 * the record's questions and notes print as sentences, the interval whiskers are
 * soft ink with one direct label, the paired comparison is a dot against a
 * labelled zero line, and the plate embeds Hanken Grotesk and Conso under their
 * own family names.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { escapeMarkup, number, page, plainDate } from "./analytics-page.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = resolve(ROOT, "analytics", "source");
const RECORD_NAME = "flywheel-offline-benchmark-record.json";
const MATRIX_NAME = "flywheel-capability-declarations.json";
const OUTPUT_STEM = "flywheel-benchmark-record";
const PLATE_FONT = resolve(ROOT, "scripts", "render-flywheel-benchmark-record.font.json");

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
// Only a pass count over a denominator is a binomial proportion. harness_overall
// is a mean score across dimensions, so it gets no interval.
const BINOMIAL_KEYS = new Set(["pass_rate", "recovery_success_rate"]);
const Z95 = 1.959963984540054;

// Suite slugs in words. A slug the map does not know is spelled out from its parts.
const SUITE_NAMES = {
  accountability: "Accountability",
  "governed-agent": "Governed agent",
  "agent-recovery": "Agent recovery",
  "stateful-provider-swap": "Provider swap",
  "source-mined": "Source-mined checks",
  "paired-replication": "Flywheel Local Coder 14B against its base model",
};
// 2026-09-25 round 4: each chart row asks its suite's question in full, plain words, so a
// first-time reader sees what the suite asks without opening "How we know". The same words
// print under "What each suite asks"; the companion JSON keeps the record's own wording.
const SHORT_QUESTIONS = {
  accountability: "Does an unaccountable system get a low score here?",
  "governed-agent": "Does a workflow refuse an action above its allowed level?",
  "agent-recovery": "After an injected fault, does the agent recover without failing quietly?",
  "stateful-provider-swap": "Does saved state survive a switch to another model provider?",
  "source-mined": "Do checks drawn from source datasets still hold against those datasets?",
  "paired-replication": "Did further training change how well the model completes code?",
};
const suiteName = (slug) => SUITE_NAMES[slug] ?? `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`.replaceAll("-", " ").replaceAll("_", " ");

// The record's notes in plain words. Keys are the record's exact text, so a
// changed note falls back to the record's own wording until someone reviews it.
// The companion JSON always carries the record's text verbatim.
const PLAIN = {
  "One deterministic sample per task per arm. A single sample measures the greedy decode, not the model.":
    "Each arm ran one greedy sample per task. One sample shows the greedy output only, so it does not measure the model's range of answers.",
  "a chat backend; the deterministic variants below ran instead":
    "A chat backend. Without one, only the deterministic variants ran, and the chart above shows them.",
  "endpoints and a private task set the operator supplies":
    "Endpoints and a private task set that the person running it supplies.",
  "flywheel cells are audited against this repo at read time; competitor cells are dated declarations from public docs and configs, not measurements":
    "Flywheel's entries are checked against its own repository when the record is read. The entries for the other tools are dated declarations from their public documentation and configuration files, and nobody measured them.",
  "measures accountability, NOT capability. Pair it with a capability bench":
    "This suite scores accountability only. Pair it with a capability benchmark.",
  "continued pretraining on the workspace corpus did not improve general code completion and did not significantly harm it; the point estimate is a regression inside the noise":
    "Continued pretraining on the workspace corpus brought no improvement in general code completion and no significant harm. The point estimate is a small drop inside the noise.",
  "The model references in these artifacts no longer resolve to anything on a live roster, so the exact weights behind each arm cannot be fetched again from the reference alone. The per-task outcomes are committed and the arithmetic here is reproducible; the generation is not.":
    "The model names in these results no longer point to any model on a current roster, so the exact weights behind each arm cannot be fetched again from the name alone. The per-task outcomes are committed, so anyone can redo the arithmetic, but the answers cannot be generated again.",
  "This compares base weights against continued-pretrained weights on general code completion. It is not a measurement of the verification harness, which is the thing this repository is.":
    "This compares base weights with continued-pretrained weights on general code completion. It does not measure Flywheel's checking harness, which is what this repository builds.",
  "retired on 2026-07-26. The arms were not independent: the treatment's first attempt is the same call as the baseline's only attempt, so the treatment cannot score lower and the difference is not a comparison. The quantity measured is verified pass@k. The retired table read verified inference 9/10 against single-shot 8/10, difference +0.100 with 95% CI [-0.236, +0.420], an interval that includes zero, and no capability uplift is claimed.":
    "Retired on 26 July 2026. The arms were not independent: the treatment's first attempt is the same call as the baseline's only attempt, so the treatment cannot score lower and the difference is not a comparison. The quantity measured is verified pass@k. The retired table read verified inference 9 of 10 against single-shot 8 of 10, a difference of +0.100 with a 95 percent interval of -0.236 to +0.420. That interval includes zero, and no capability uplift is claimed.",
};
// Every note prints as a sentence: a capital first letter and closing punctuation.
const sentence = (text) => {
  const trimmed = String(text).trim();
  const capped = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  return /[.?!]$/.test(capped) ? capped : `${capped}.`;
};
const plain = (text) => sentence(String(PLAIN[text] ?? text).replace(/\b\d{4}-\d{2}-\d{2}\b/g, (date) => plainDate(date)));
// The record states each suite's question in lower case without a mark; the page asks it.
const asQuestion = (text) => {
  const trimmed = String(text).trim().replace(/[.?]$/, "");
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}?`;
};

// Unmeasured suites by plain name. The companion JSON keeps the record's own ids.
const NOT_RUN_NAMES = {
  "m7 capability arms": "Retired capability comparison, four arms",
  "uplift_bench paired arms": "Paired uplift benchmark",
  "verified_bench private task set": "Verified benchmark on a private task set",
  "classifier friction backend modes": "Classifier friction check across chat backend modes",
  "backend variants of the governed, recovery, stateful and source-mined suites":
    "Chat-backend versions of the governed, recovery, stateful and source-mined suites",
};
const notRunName = (id) => NOT_RUN_NAMES[id] ?? sentence(id.replaceAll("_", " ")).replace(/\.$/, "");

function wilson(successes, n) {
  const p = successes / n;
  const z2 = Z95 * Z95;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

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
      reason: "a signed difference",
      interval: null,
    };
  }
  const rate = RATE_KEYS.map((key) => (typeof head[key] === "number" ? { key, value: head[key] } : null)).find(Boolean);
  if (!rate) throw new Error(`suite ${suite.name} reports neither a rate nor a signed difference`);
  if (rate.value < 0 || rate.value > 1) throw new Error(`suite ${suite.name} rate falls outside zero to one`);
  const passes = rate.value * denominator.value;
  const interval = BINOMIAL_KEYS.has(rate.key) && Math.abs(passes - Math.round(passes)) < 1e-9
    ? wilson(Math.round(passes), denominator.value)
    : null;
  return { display: `${number(rate.value * 100, 1)}%`, rate, denominator, reason: null, interval };
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

// ------------------------------------------------------------------ sheet parts

const PAGE_DEFS = `<svg class="ns-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>`
  + `<pattern id="ns-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="2.5" y1="-1" x2="2.5" y2="6" class="p-d"/></pattern>`
  + `<pattern id="ns-stip" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".85" class="p-u"/></pattern>`
  + `<pattern id="ns-scan" width="6" height="3" patternUnits="userSpaceOnUse"><rect x="0" y="1" width="6" height="1" class="p-i"/></pattern>`
  + `</defs></svg>`;

function seal() {
  const ticks = [];
  for (let index = 0; index < 72; index += 1) {
    const angle = (2 * Math.PI * index) / 72;
    const inner = index % 6 === 0 ? 40.4 : 42.4;
    const point = (radius) => [radius * Math.cos(angle), radius * Math.sin(angle)].map((value) => value.toFixed(2));
    const [x1, y1] = point(inner);
    const [x2, y2] = point(45);
    ticks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="sl-t"/>`);
  }
  return `<svg class="ns-seal" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><circle r="47.5" class="sl-o"/>${ticks.join("")}`
    + `<circle r="31" class="sl-r"/><circle r="21" class="sl-i"/><circle r="10" class="sl-p"/><circle r="3.2" class="sl-c"/></svg>`;
}

const grain = (uid, seed) => `<svg class="ns-grain" aria-hidden="true" focusable="false"><filter id="ns-grain-${uid}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">`
  + `<feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="2" seed="${seed}" stitchTiles="stitch" result="n"/>`
  + `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.2 0 0 0 -1.72" result="a"/>`
  + `<feFlood class="ns-grain-ink" result="f"/><feComposite in="f" in2="a" operator="in"/></filter>`
  + `<rect width="100%" height="100%" filter="url(#ns-grain-${uid})"/></svg>`;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (count) => WORDS[count] ?? String(count);
const capitalized = (text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
const pct = (value) => `${(value * 100).toFixed(1)}%`;
const grats = (points) => points.map((point) => `<line x1="${point}%" y1="0" x2="${point}%" y2="100%" class="m-grat"/>`).join("");
const sizeWords = (suite) => `${suite.denominator.value} ${suite.denominator.key}`;

function axisRow(caption, ticks) {
  const spans = ticks.map(([position, label, extra]) => `<span class="ns-tick${extra}" style="left:${position}%">${label}</span>`).join("");
  return `<div class="ns-row is-axis"><p class="ns-rname ns-axcap">${caption}</p><div class="ns-sc"><div class="ns-axis" aria-hidden="true">${spans}</div></div><p class="ns-rval"></p></div>`;
}

function rateRow(suite) {
  const whisker = suite.interval
    ? `<line x1="${pct(suite.interval[0])}" y1="25" x2="${pct(suite.interval[1])}" y2="25" class="m-ci"/>`
      + `<line x1="${pct(suite.interval[0])}" y1="21" x2="${pct(suite.interval[0])}" y2="29" class="m-ci"/>`
      + `<line x1="${pct(suite.interval[1])}" y1="21" x2="${pct(suite.interval[1])}" y2="29" class="m-ci"/>`
    : "";
  // Round 4: every interval names its low end beside its left cap, so the range each 100 percent
  // could hide reads without the tally. The key carries the one definition of the capped line.
  const note = suite.interval
    ? `<text x="${pct(suite.interval[0])}" y="30" dx="-6" text-anchor="end" class="t-ref">${Math.round(suite.interval[0] * 100)}%</text>`
    : "";
  const size = `${sizeWords(suite)}${suite.interval ? "" : ", mean score"}`;
  const ask = SHORT_QUESTIONS[suite.name] ? `${escapeMarkup(SHORT_QUESTIONS[suite.name])} ` : "";
  return `<div class="ns-row"><div class="ns-rname"><p class="ns-n">${escapeMarkup(suiteName(suite.name))}</p><p class="ns-den">${ask}<span class="fw-size">${escapeMarkup(size)}</span></p></div>`
    + `<div class="ns-sc"><svg class="ns-strip" aria-hidden="true" focusable="false">${grats([50, 100])}`
    + `<line x1="0%" y1="0" x2="0%" y2="100%" class="m-zero"/><rect x="0" y="4" width="${pct(suite.rate.value)}" height="14" class="m-scan"/>${whisker}${note}</svg></div>`
    + `<p class="ns-rval"><span class="ns-count">${escapeMarkup(suite.display)}</span></p></div>`;
}

// The signed axis runs from ten points worse to ten points better.
const SIGNED_SPAN = 10;
function signedRow(suite) {
  const points = suite.headline.delta_points * 100;
  if (Math.abs(points) > SIGNED_SPAN) throw new Error(`suite ${suite.name} difference falls outside the drawn axis`);
  const x = `${(((points + SIGNED_SPAN) / (2 * SIGNED_SPAN)) * 100).toFixed(2)}%`;
  const words = `${number(Math.abs(points), 2)} points ${points < 0 ? "lower" : "higher"}`;
  // Zero is a full-height ink line named in words. The record holds no interval for this
  // difference, so none is drawn: a dot against the zero line, and nothing between them.
  return `<div class="ns-row is-tall"><div class="ns-rname"><p class="ns-n">${escapeMarkup(suiteName(suite.name))}</p><p class="ns-den">${SHORT_QUESTIONS[suite.name] ? `${escapeMarkup(SHORT_QUESTIONS[suite.name])} ` : ""}<span class="fw-size">${escapeMarkup(sizeWords(suite))}</span></p></div>`
    + `<div class="ns-sc"><svg class="ns-strip" aria-hidden="true" focusable="false">${grats([25, 75])}`
    + `<line x1="50%" y1="0" x2="50%" y2="100%" class="m-zero"/><text x="50%" y="44" dx="6" class="t-ref">no change</text>`
    + `<circle cx="${x}" cy="15" r="11" class="m-hot-case"/><circle cx="${x}" cy="15" r="11" class="m-hot"/><circle cx="${x}" cy="15" r="4.5" class="m-est"/></svg></div>`
    + `<p class="ns-rval"><span class="ns-count">${escapeMarkup(words)}</span></p></div>`;
}

function intervalWords(suite) {
  if (suite.interval) return `${Math.round(suite.interval[0] * 100)} to ${Math.round(suite.interval[1] * 100)}%`;
  return suite.rate ? "None, because this is a mean score" : "None in the record";
}

function chart(suites) {
  const rates = suites.filter((suite) => suite.rate);
  const signed = suites.filter((suite) => !suite.rate);
  const rateBlock = `<div class="ns-rows" role="group" aria-label="Score on each suite's own tests">`
    + axisRow("Score on the suite's own tests", [[0, "0%", " is-s"], [50, "50%", ""], [100, "100%", " is-e"]])
    + rates.map((suite) => rateRow(suite)).join("") + `</div>`;
  const signedBlock = signed.length
    ? `<p class="ns-panel-h">The one comparison between two models</p><div class="ns-rows" role="group" aria-label="Change in pass rate">`
      + axisRow("Change in pass rate, in points", [[0, "-10", " is-s"], [25, "-5", " is-opt"], [50, "0", " is-zero"], [75, "+5", " is-opt"], [100, "+10", " is-e"]])
      + signed.map(signedRow).join("") + `</div>`
    : "";
  return `<div class="ns-fig">${rateBlock}${signedBlock}</div>`;
}

function resultWords(suite) {
  if (suite.rate) return suite.display;
  const points = suite.headline.delta_points * 100;
  return `${number(Math.abs(points), 2)} points ${points < 0 ? "lower" : "higher"}`;
}

function suiteTable(suites) {
  const rows = suites.map((suite) => `<tr><th scope="row">${escapeMarkup(suiteName(suite.name))}</th>`
    + `<td data-label="Size">${escapeMarkup(sizeWords(suite))}</td>`
    + `<td class="num" data-label="Result">${escapeMarkup(resultWords(suite))}</td>`
    + `<td data-label="95% interval">${escapeMarkup(intervalWords(suite))}</td></tr>`).join("");
  return `<div class="table-wrap" role="region" aria-labelledby="suite-cap" tabindex="0"><table class="data-table" data-stack>`
    + `<caption id="suite-cap">Each suite with its size, result and interval.</caption>`
    + `<thead><tr><th scope="col">Suite</th><th scope="col">Size</th><th scope="col" class="num">Result</th><th scope="col">95% interval</th></tr></thead>`
    + `<tbody>${rows}</tbody></table></div>`;
}

// What each suite asks, with the record's own notes, as sentences under the table.
function suiteQuestions(suites) {
  return `<ul class="fw-asks">${suites.map((suite) => {
    const notes = [suite.nonGoal, ...suite.caveats].filter(Boolean).map((item) => escapeMarkup(plain(item))).join(" ");
    return `<li><strong>${escapeMarkup(suiteName(suite.name))}.</strong> ${escapeMarkup(SHORT_QUESTIONS[suite.name] ?? asQuestion(suite.question))}${notes ? ` ${notes}` : ""}</li>`;
  }).join("")}</ul>`;
}

// The page's own layer on top of the analytics chassis and the notebook sheet:
// the sheet keeps its own spacing inside the analytics type rules, and the value
// column is wide enough for "3.05 points lower" on one line.
const PAGE_STYLE = `<style data-record-page>`
  + `body.analytics-page .fw-sheet{max-width:none}body.analytics-page .fw-page-hwk{max-width:var(--wide,58rem)}`
  + `body.analytics-page .fw-sheet :is(h2,p){margin:0}`
  + `body.analytics-page .fw-sheet .ns-row{--nw:16rem;--vw:9.5rem}`
  + `body.analytics-page .fw-sheet .ns-den .fw-size{display:block}`
  + `body.analytics-page .fw-sheet .ns-row .ns-rname{padding-block:.35rem}`
  + `body.analytics-page .fw-sheet .ns-den{font:400 .875rem/1.4 var(--font-sans);color:var(--ns-soft)}`
  + `body.analytics-page .fw-sheet .ns-rows + .ns-panel-h{margin-top:var(--ns-lead)}`
  + `body.analytics-page .fw-sheet .hwk-list .table-wrap{margin:0}`
  + `body.analytics-page .fw-sheet .data-table :is(td,th).num{white-space:normal}`
  + `body.analytics-page .fw-sheet .ns-row .ns-sc{min-height:40px}body.analytics-page .fw-sheet .ns-row.is-tall .ns-sc{min-height:52px}`
  + `body.analytics-page .fw-sheet .t-ref{font-size:14px;font-weight:500;fill:var(--ns-soft)}`
  // Void and bone: each score is set as a display numeral beside its bar.
  + `body.analytics-page .fw-sheet .ns-rval .ns-count{font:760 clamp(1.375rem,1.1rem + .9vw,1.75rem)/1 var(--font-sans);letter-spacing:-.03em;font-variant-numeric:tabular-nums}`
  + `body.analytics-page .fw-sheet .ns-row.is-tall .ns-rval .ns-count{font-size:1.125rem;letter-spacing:-.01em}`
  + `body.analytics-page .fw-asks{margin:0;padding-left:1.2rem;display:grid;row-gap:.5rem}`
  + `body.analytics-page .fw-notice{max-width:var(--measure,38rem);margin:0 0 var(--s-6,2rem);font:400 1.0625rem/1.6 var(--font-sans);color:var(--ink)}`
  + `body.analytics-page .fw-page-hwk{margin-top:var(--s-6,2rem)}`
  + `body.analytics-page .hwk-list dd > p,body.analytics-page .fw-sheet td > div > p{margin:0 0 .6rem}`
  + `@media (max-width:39.99rem){body.analytics-page .fw-sheet .ns-row .ns-rname{padding-block:.5rem .375rem}}`
  // On phones the value sits on the name line at the right, beside the bar end it describes.
  + `@container ns-sheet (max-width:39.99rem){body.analytics-page .fw-sheet .ns-row:not(.is-axis){grid-template-areas:"n v" "s s";grid-template-columns:minmax(0,1fr) auto;column-gap:1rem}`
  + `body.analytics-page .fw-sheet .ns-row:not(.is-axis) .ns-rval{align-self:start;padding-top:.5rem;text-align:right}}`
  + `</style>`;

// ------------------------------------------------------------------ plate

// 25 September 2026, void and bone: the plate's grounds are the sheet's bone and void papers.
const PLATE_TOKENS = {
  light: { paper: "#f1ece1", ink: "#16130f", soft: "#4a443b", hair: "#d6ccb8", frame: "#b9af9b" },
  dark: { paper: "#0a0a0d", ink: "#ece5d6", soft: "#b8b0a0", hair: "#262529", frame: "#38363b" },
};
const tokenBlock = (set) => `--p:${set.paper};--i:${set.ink};--s:${set.soft};--h:${set.hair};--f:${set.frame};--hot:${set.ink}`;

function plateText(x, y, size, weight, text, extra = "") {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}"${extra}>${escapeMarkup(text)}</text>`;
}

function plate(suites, declarations, font) {
  const rates = suites.filter((suite) => suite.rate);
  const signed = suites.filter((suite) => !suite.rate);
  const left = 40;
  const trackX = 330;
  const trackW = 460;
  const valueX = 810;
  const rowH = 52;
  let y = 150;
  const drawn = [];
  const marks = [];
  const label = (...args) => { drawn.push(args[4]); return plateText(...args); };
  marks.push(label(left, 44, 26, 760, "Flywheel offline benchmark record"));
  const nulls = signed.length;
  const takeaway = [
    `${capitalized(word(rates.length))} suites scored 100 percent on their own tests.`,
    nulls ? `Flywheel Local Coder 14B scored ${number(Math.abs(signed[0].headline.delta_points * 100), 2)} points below its base model, within noise.` : "",
  ].filter(Boolean);
  takeaway.forEach((line, index) => marks.push(label(left, 76 + index * 24, 17, 500, line)));
  marks.push(label(left, y - 18, 14, 500, "Score on the suite's own tests", ' class="s"'));
  for (const [position, text] of [[0, "0%"], [50, "50%"], [100, "100%"]]) {
    const x = trackX + (trackW * position) / 100;
    marks.push(label(x, y - 18, 14, 500, text, ` class="s" text-anchor="${position === 0 ? "start" : position === 100 ? "end" : "middle"}"`));
    marks.push(`<line x1="${x}" y1="${y - 10}" x2="${x}" y2="${y + rates.length * rowH - 12}" class="g"/>`);
  }
  for (const suite of rates) {
    marks.push(label(left, y + 10, 16, 600, suiteName(suite.name)));
    marks.push(label(left, y + 30, 14, 400, `${sizeWords(suite)}${suite.interval ? "" : ", mean score"}`, ' class="s"'));
    marks.push(`<rect x="${trackX}" y="${y}" width="${(trackW * suite.rate.value).toFixed(1)}" height="14" class="bar"/>`);
    if (suite.interval) {
      const [lo, hi] = suite.interval.map((value) => (trackX + trackW * value).toFixed(1));
      marks.push(`<path d="M${lo} ${y + 21} V${y + 29} M${lo} ${y + 25} H${hi} M${hi} ${y + 21} V${y + 29}" class="ci"/>`);
      marks.push(label(lo, y + 46, 14, 500, `${Math.round(suite.interval[0] * 100)}%`, ' class="s" text-anchor="middle"'));
    }
    marks.push(label(valueX, y + 12, 16, 600, suite.display));
    y += rowH + (suite.interval ? 16 : 0);
  }
  if (nulls) {
    const suite = signed[0];
    const points = suite.headline.delta_points * 100;
    y += 30;
    marks.push(label(left, y - 18, 14, 500, "Change in pass rate, in points", ' class="s"'));
    for (const [position, text] of [[0, "-10"], [50, "0"], [100, "+10"]]) {
      const x = trackX + (trackW * position) / 100;
      marks.push(label(x, y - 18, 14, position === 50 ? 600 : 500, text, ` class="s" text-anchor="${position === 0 ? "start" : position === 100 ? "end" : "middle"}"`));
    }
    const zero = trackX + trackW / 2;
    const px = (trackX + (trackW * (points + SIGNED_SPAN)) / (2 * SIGNED_SPAN)).toFixed(1);
    marks.push(`<line x1="${zero}" y1="${y - 10}" x2="${zero}" y2="${y + 40}" class="z"/>`);
    marks.push(label(zero + 6, y + 40, 14, 500, "no change", ' class="s"'));
    marks.push(`<circle cx="${px}" cy="${y + 12}" r="11" class="hc"/><circle cx="${px}" cy="${y + 12}" r="11" class="hot"/><circle cx="${px}" cy="${y + 12}" r="4.5" class="dot"/>`);
    marks.push(label(left, y + 10, 16, 600, "Flywheel Local Coder 14B"));
    marks.push(label(left, y + 30, 14, 400, `against its base model, ${sizeWords(suite)}`, ' class="s"'));
    marks.push(label(valueX, y + 17, 16, 600, `${number(Math.abs(points), 2)} points ${points < 0 ? "lower" : "higher"}`));
    y += rowH + 12;
  }
  y += 18;
  marks.push(`<line x1="${left}" y1="${y}" x2="920" y2="${y}" class="g"/>`);
  marks.push(label(left, y + 28, 14, 500, `No peer harness was executed. Record dated ${plainDate(declarations.declaredOn)}.`, ' class="s"'));
  const height = y + 52;

  const allowed = new Set(font.characters);
  for (const text of drawn) {
    for (const character of text) {
      if (!allowed.has(character)) throw new Error(`plate draws "${character}", which the embedded face does not carry`);
    }
  }
  const desc = `${suites.length} suites ran with no model endpoint. `
    + rates.map((suite) => `${suiteName(suite.name)}: ${suite.display} of ${sizeWords(suite)}${suite.interval ? `, 95 percent interval ${intervalWords(suite)}` : ", a mean score"}.`).join(" ")
    + (nulls ? ` ${suiteName(signed[0].name)}: ${number(Math.abs(signed[0].headline.delta_points * 100), 2)} points lower over ${sizeWords(signed[0])}, a signed difference inside its noise.` : "")
    + ` No peer harness was executed; the ${declarations.rows} peer declaration rows are a dated reading of public documentation.`;
  // Both site faces travel inside the plate under their own family names, so an img element
  // that cannot fetch page fonts still draws Hanken Grotesk, and no third family is ever named.
  const style = `<style>@font-face{font-family:"Hanken Grotesk";font-weight:100 900;src:url(data:font/woff2;base64,${font.woff2Base64}) format("woff2")}`
    + `@font-face{font-family:"Conso";font-weight:500;src:url(data:font/woff2;base64,${font.monoWoff2Base64}) format("woff2")}`
    + `svg{${tokenBlock(PLATE_TOKENS.light)}}`
    + `@media (prefers-color-scheme:dark){svg{${tokenBlock(PLATE_TOKENS.dark)}}}`
    + `@media (forced-colors:active){svg{--p:Canvas;--i:CanvasText;--s:CanvasText;--h:GrayText;--f:CanvasText;--hot:Highlight}}`
    + `text{font-family:"Hanken Grotesk",system-ui,sans-serif;fill:var(--i)}.s{fill:var(--s)}`
    + `.bg{fill:var(--p);stroke:var(--f)}.g{stroke:var(--h);stroke-dasharray:2 4}.z{stroke:var(--i);stroke-width:1.4}`
    + `.bar{fill:url(#plate-scan);stroke:var(--i)}.scan{fill:var(--i)}.ci{fill:none;stroke:var(--s);stroke-width:2}`
    + `.dot{fill:var(--i);stroke:var(--p);stroke-width:1.5}.hc{fill:none;stroke:var(--p);stroke-width:6.5}.hot{fill:none;stroke:var(--hot);stroke-width:2.8}</style>`;
  return `<svg role="img" xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}" aria-labelledby="record-title record-desc">`
    + `<title id="record-title">Flywheel offline benchmark record</title>`
    + `<desc id="record-desc">${escapeMarkup(desc)}</desc>`
    + style
    + `<defs><pattern id="plate-scan" width="6" height="3" patternUnits="userSpaceOnUse"><rect x="0" y="1" width="6" height="1" class="scan"/></pattern></defs>`
    + `<rect x="0.5" y="0.5" width="959" height="${height - 1}" class="bg"/>`
    + marks.join("")
    + `</svg>`;
}

// ------------------------------------------------------------------ page

function build(record, matrix, evidence, font) {
  const suites = readRecord(record);
  const declarations = readMatrix(matrix, record);
  const svg = plate(suites, declarations, font);
  const nulls = suites.filter((suite) => !suite.rate);
  const rates = suites.filter((suite) => suite.rate);
  const declared = plainDate(declarations.declaredOn);
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
      interval95: suite.interval ? { method: "wilson", low: Number(suite.interval[0].toFixed(4)), high: Number(suite.interval[1].toFixed(4)) } : null,
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
      "Five suites in the not-measured list need a live model endpoint and did not run. The record names them, so an absent number reads as unmeasured and never as zero.",
      "The capability list sets Flywheel's checked entries beside the other tools' declared entries. Those are two different kinds of evidence, and the page never averages them into a score.",
      "The paired replication compares base weights with continued-pretrained weights on general code completion, one deterministic sample per task per arm. It measures a greedy decode and leaves the checking harness unmeasured.",
      "Every suite here runs offline, so the record covers accountability, recovery and state behavior. None of it scores capability against a frontier model.",
      "The 95 percent intervals are Wilson intervals, computed for this page from each suite's pass count and denominator. They are the one derived quantity on the page.",
    ],
    doesNotProve:
      "This record does not rank Flywheel against any other coding harness. No other harness was run to produce a single entry in the capability list, and the entries for the other tools are a dated reading of public documentation. The one comparison the record does contain is negative and sits inside its own noise.",
  };

  const signed = nulls[0];
  const delta = signed ? Math.abs(signed.headline.delta_points * 100) : null;
  const lowest = Math.min(...rates.filter((suite) => suite.interval).map((suite) => Math.round(suite.interval[0] * 100)));
  const takeaway = `${capitalized(word(rates.length))} suites scored 100 percent on small test sets, where the true rate could be as low as ${lowest} percent.`
    + (signed ? ` Flywheel Local Coder 14B scored ${number(delta, 2)} points below its base model.` : "");
  if (!rates.every((suite) => suite.rate.value === 1)) throw new Error("the takeaway reads 100 percent; revise it before a suite scores lower");
  const limit = signed
    ? `<p class="limit-line">A gap this small can be chance: of ${signed.denominator.value} tasks, ${signed.headline.gains} passed only on Flywheel Local Coder 14B and ${signed.headline.regressions} passed only on the base model.</p>`
    : "";
  const sw = (inner) => `<svg class="ns-sw" viewBox="0 0 26 16" aria-hidden="true" focusable="false">${inner}</svg>`;
  // Round 4: direct labels carry the marks; the key keeps the one definition a reader needs, and
  // the ringed mark, the only one of its kind, needs no line of its own.
  const key = `<ul class="ns-key" aria-label="Key">`
    + `<li>${sw('<line x1="2" y1="8" x2="24" y2="8" class="m-ci"/><line x1="2" y1="4" x2="2" y2="12" class="m-ci"/><line x1="24" y1="4" x2="24" y2="12" class="m-ci"/>')}<span>95% interval: the range likely to hold the true score, with its low end named</span></li>`
    + `</ul>`;
  const marked = "";

  const exact = signed
    ? ` The model comparison re-reads per-task results the two models produced earlier. Its exact McNemar (binomial) test gives p = ${signed.headline.p_exact.toFixed(2)}, and the continuity-corrected test on the model comparison page gives 0.404: ${signed.headline.gains} tasks passed only after continued pretraining and ${signed.headline.regressions} passed only on the base model. The record holds no interval for that difference, so none is drawn.`
    : "";
  const sheetBody = key + chart(suites) + marked + limit
    + `<details class="how-we-know"><summary>How we know<span class="ns-vh">: the chart</span></summary><dl class="hwk-list">`
    + `<dt>Does not prove</dt><dd>${escapeMarkup(companion.doesNotProve)}</dd>`
    + `<dt>Limits</dt><dd>The ${word(rates.length)} 100 percent scores come from small test sets of ${Math.min(...rates.map((suite) => suite.denominator.value))} to ${Math.max(...rates.map((suite) => suite.denominator.value))} items each, and the capped lines show how wide that leaves each interval. Each suite runs offline, so none of these scores measures capability against a frontier model.</dd>`
    + `<dt>Method</dt><dd>Every score and count is read out of the sealed record. The capped line is a Wilson 95 percent interval, computed for this page from each suite's pass count and denominator. Accountability reports a mean score across its dimensions, so it gets no interval. The comparison sits on its own signed axis, because a drop drawn on a 0 to 100 track would look like a partial success.${exact}</dd>`
    + `<dt>Tally</dt><dd>${suiteTable(suites)}</dd>`
    + `<dt>What each suite asks</dt><dd>${suiteQuestions(suites)}</dd>`
    + `</dl></details>`;
  const sheet = `<article class="ns-sheet fw-sheet" id="sheet-record" aria-labelledby="t-record"><div class="ns-paper">${grain("record", 30113)}<div class="ns-live">`
    + `<header class="ns-head"><h2 class="ns-title" id="t-record">What the ${word(suites.length)} suites scored</h2><p class="takeaway">${escapeMarkup(takeaway)}</p></header>`
    + sheetBody
    + `<div class="ns-stamp"><p>Record dated ${declared}</p>${seal()}</div>`
    + `</div></div></article>`;

  const tallyRows = declarations.tallies
    .map((tally) => `<tr><th scope="row">${escapeMarkup(tally.label)}</th><td class="num" data-label="Declares">${tally.declares}</td><td class="num" data-label="Partial">${tally.partial}</td><td class="num" data-label="Absent">${tally.absent}</td></tr>`)
    .join("");
  const nullRows = record.not_run
    .map((entry) => `<tr><th scope="row">${escapeMarkup(notRunName(entry.suite))}</th><td data-label="Needs">${escapeMarkup(plain(entry.needs))}</td><td data-label="Standing result">${escapeMarkup(entry.standing_result ? plain(entry.standing_result) : "No standing result.")}</td></tr>`)
    .join("");
  const evidenceRows = evidence
    .map((item) => `<tr><th scope="row"><a href="${escapeMarkup(item.href)}">${escapeMarkup(item.name)}</a></th>`
      + `<td data-label="SHA-256"><code class="digest">${escapeMarkup(item.sha256)}</code></td>`
      + `<td data-label="Original"><a href="${escapeMarkup(item.repositoryHref)}">Original at the named commit</a></td></tr>`)
    .join("");
  // The page prints each null once: the chart's own disclosure carries the offline and
  // interval limits, and the suite notes carry the paired replication's caveats.
  // 2026-09-25 round 3: the not-measured sentence prints once, in the Not measured row.
  const limitationItems = companion.limitations.slice(1, 2).map((item) => `<li>${escapeMarkup(item)}</li>`).join("");

  const body = `<p class="record-label">Offline benchmark record &#183; ${escapeMarkup(declared)}</p>`
    + `<h1>Flywheel offline benchmark record</h1>`
    + `<p class="lede">${capitalized(word(suites.length))} test suites ran offline, with no model connected. The first ${word(rates.length)} test accountability, recovery and state handling on their own small test sets. The ${WORDS[suites.length] === "six" ? "sixth" : "last"} re-reads saved per-task results from two models: a base model and Flywheel Local Coder 14B, the same model after continued pretraining, meaning further training on new text.</p>`
    + PAGE_STYLE
    + PAGE_DEFS
    + `<p class="fw-notice">We ran no other coding harness for this record, so this page ranks no one. The full record below lists what the public documentation of ${declarations.tallies.map((tally) => tally.label).join(", ").replace(/, ([^,]*)$/, " and $1")} declares, as read on ${declared}.</p>`
    + sheet
    + `<details class="how-we-know fw-page-hwk"><summary>The full record</summary><dl class="hwk-list">`
    + `<dt>Limits</dt><dd><ul>${limitationItems}</ul></dd>`
    + `<dt>Unknown</dt><dd>No other harness was run, so how Flywheel compares with other coding harnesses stays unknown.</dd>`
    + `<dt>Not measured</dt><dd><p>These suites need a live model endpoint. The record names them, so an absent number reads as unmeasured.</p>`
    + `<div class="table-wrap" role="region" aria-labelledby="null-cap" tabindex="0"><table class="data-table" data-stack><caption id="null-cap">Suites that did not run, and what each one needs.</caption>`
    + `<thead><tr><th scope="col">Suite</th><th scope="col">Needs</th><th scope="col">Standing result</th></tr></thead><tbody>${nullRows}</tbody></table></div></dd>`
    + `<dt>Peer declarations</dt><dd><p>${escapeMarkup(plain(declarations.note))} A declaration is not a measurement, so this page ranks no one. Flywheel's own entries hold on ${declarations.witnessed} of ${declarations.rows} rows of the capability list, with ${declarations.absent} missing, and for ${declarations.uniquelyWitnessed} of those rows no other listed tool declares the feature. The page recounts these totals from the rows each time it is built.</p>`
    + `<div class="table-wrap" role="region" aria-labelledby="peer-cap" tabindex="0"><table class="data-table" data-stack><caption id="peer-cap">What each tool's public documentation declares, across all ${declarations.rows} rows.</caption>`
    + `<thead><tr><th scope="col">Tool</th><th scope="col" class="num">Declares</th><th scope="col" class="num">Partial</th><th scope="col" class="num">Absent</th></tr></thead><tbody>${tallyRows}</tbody></table></div></dd>`
    + `<dt>Check it yourself</dt><dd><p>The two source files are byte-identical copies of files committed in the Flywheel repository. Fetch them at commit <a href="${escapeMarkup(companion.sourceCommitUrl)}"><code>${escapeMarkup(SOURCE_COMMIT)}</code></a> (the benchmark code), hash them, and compare them with these digests. Record seal: <code class="digest">${escapeMarkup(record.result_sha256)}</code>. Interpreter: Python ${escapeMarkup(record.python)}.</p>`
    + `<div class="table-wrap" role="region" aria-labelledby="source-cap" tabindex="0"><table class="data-table" data-stack><caption id="source-cap">Public source files and their digests.</caption>`
    + `<thead><tr><th scope="col">File</th><th scope="col">SHA-256</th><th scope="col">Original</th></tr></thead><tbody>${evidenceRows}</tbody></table></div>`
    + `<p>To regenerate the record, run <code>python scripts/run_offline_benchmarks.py</code> then <code>python scripts/build_benchmark_page.py</code> in the engine repository. A test there re-runs the first and compares the seal.</p></dd>`
    + `</dl></details>`;

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
// records and prove the checks above fail. A falsifier that is never fired is a
// comment, and this one is fired.
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
const [record, matrix, font] = await Promise.all([
  source(RECORD_NAME, "docs/benchmarks/report.json", "Sealed offline benchmark record"),
  source(MATRIX_NAME, "docs/benchmarks/parity.json", "Capability declaration matrix"),
  readFile(PLATE_FONT, "utf8").then((text) => JSON.parse(text)),
]);
const built = build(record.parsed, matrix.parsed, [record.evidence, matrix.evidence], font);
await Promise.all([
  writeFile(resolve(outputDir, `${OUTPUT_STEM}.html`), `${built.html}\n`, "utf8"),
  writeFile(resolve(outputDir, `${OUTPUT_STEM}.svg`), `${built.svg}\n`, "utf8"),
  writeFile(resolve(outputDir, `${OUTPUT_STEM}.json`), `${JSON.stringify(built.companion, null, 2)}\n`, "utf8"),
]);
console.log(
  `rendered ${OUTPUT_STEM}: ${built.companion.suites.length} suites, `
  + `${built.companion.capabilityDeclarations.rows} declaration rows, 0 peer harnesses executed`,
);
