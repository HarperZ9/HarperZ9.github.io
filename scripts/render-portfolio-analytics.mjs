#!/usr/bin/env node
/** Render comparable benchmark evidence and a supporting source inventory.
 *
 * 2026-09-25, void-and-bone pass: each measured figure leads with a poster title and one
 * notebook sheet. The sheet states one plain takeaway, draws the chart large in the site's
 * tokens, keeps one limit line under it, and moves digests, model references, test statistics
 * and commit identities into "How we know". Every number on a sheet is read from the record
 * here; none is typed in. The figure code lives in this one file because the renderer tests run
 * a copy of it beside the chassis alone. Every chart on a page is HTML rows over SVG strips, so it
 * reflows to a phone; the standalone SVG plates exist only for an img on another page. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { SHEET_DEFS, axisRow, barPlate, escapeMarkup, howWeKnow, number, page, plainDate, plateStyle, sheet } from "./analytics-page.mjs";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key !== "--input" && key !== "--output-dir") throw new Error(`unknown argument: ${key}`);
    if (!argv[index + 1]) throw new Error(`${key} requires a value`);
    values[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  if (!values.input || !values["output-dir"]) {
    throw new Error("usage: render-portfolio-analytics.mjs --input <dataset.json> --output-dir <directory>");
  }
  return { input: resolve(values.input), outputDir: resolve(values["output-dir"]) };
}

const measured = (metric) => metric?.status === "measured" && Number.isFinite(metric.value);
const metricText = (metric, digits = 2) => measured(metric) ? `${number(metric.value, digits)} ${metric.unit ?? ""}`.trim() : `Unknown: ${metric?.reason ?? "not_reported"}`;

const pct = (value) => `${(value * 100).toFixed(2)}%`;
const listed = (items) => items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items.join("");

// Model ids in words for the chart rows. The tables under "How we know" keep the record's own ids.
const MODEL_NAMES = {
  "claude-sonnet-5": "Claude Sonnet 5",
  "gpt-5.3-codex-spark": "GPT-5.3 Codex Spark",
  "flywheel-local-coder-14b": "Flywheel Local Coder 14B",
  "flywheel-local-coder-32b": "Flywheel Local Coder 32B",
  "14b-cpt-adapter": "Flywheel 14B adapter",
  "qwen2.5:7b": "Qwen 2.5 7B",
};
const modelName = (id) => MODEL_NAMES[id] ?? String(id).split(/[-_:]+/).filter(Boolean)
  .map((part) => /^\d+(\.\d+)?b$/i.test(part) ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");

// A row that did not run, in words: its recorded status, then the first clause of its reason.
const UNAVAILABLE = { "NOT OPERATIONAL": "Could not run", SKIPPED: "Skipped" };
const REASON_WORDS = [[/^quota_or_rate_limit\b/, "quota or rate limit"], [/^no configured endpoint\b/, "no endpoint configured"]];
function unavailableWords(row) {
  const status = UNAVAILABLE[row.status] ?? `${String(row.status).charAt(0)}${String(row.status).slice(1).toLowerCase()}`;
  const reason = REASON_WORDS.find(([pattern]) => pattern.test(row.reason ?? ""))?.[1]
    ?? String(row.reason ?? "no reason recorded").split(";")[0].replaceAll("_", " ").trim();
  return `${status} (${reason})`;
}
const grats = (points) => points.map((point) => `<line x1="${point}%" y1="0" x2="${point}%" y2="100%" class="m-grat"/>`).join("");

// ------------------------------------------------------------------ paired model comparison

/** A strip of one scanline bar on a zero-to-one scale, with the value set large beside it. */
function shareRow(name, sub, value, display) {
  return `<div class="ns-row"><div class="ns-rname"><p class="ns-n">${escapeMarkup(name)}</p><p class="an-sub">${escapeMarkup(sub)}</p></div>`
    + `<div class="ns-sc"><svg class="ns-strip" aria-hidden="true" focusable="false">${grats([25, 50, 75, 100])}`
    + `<line x1="0%" y1="0" x2="0%" y2="100%" class="m-zero"/><rect x="0" y="8" width="${pct(value)}" height="26" class="m-scan"/></svg></div>`
    + `<p class="ns-rval"><span class="an-big">${escapeMarkup(display)}</span></p></div>`;
}

/** A row that did not run: a stippled band with a dashed edge and "No score" in words, never a zero. */
function unmeasuredRow(name, sub) {
  return `<div class="ns-row is-unknown"><div class="ns-rname"><p class="ns-n">${escapeMarkup(name)}</p><p class="an-sub">${escapeMarkup(sub)}</p></div>`
    + `<div class="ns-sc"><svg class="ns-strip" aria-hidden="true" focusable="false"><rect x="0" y="13" width="100%" height="16" class="m-unk"/></svg></div>`
    + `<p class="ns-rval"><span class="t-null-word">No score</span></p></div>`;
}

/** One square per task. The left half fills when the base model passed it, the right half when
 * the second model did, so the four paired outcomes read from the squares themselves. */
function unitGrid(groups, columns, pitch, cell, className) {
  const cells = groups.flatMap((group) => Array.from({ length: group.count }, () => group));
  const rows = Math.ceil(cells.length / columns);
  const width = columns * pitch - (pitch - cell);
  const height = rows * pitch - (pitch - cell);
  const half = cell / 2;
  const marks = cells.map((group, index) => {
    const x = (index % columns) * pitch;
    const y = Math.floor(index / columns) * pitch;
    // A task both models passed is one solid square, so no seam shows between its halves.
    const fill = group.base && group.other
      ? `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" class="an-fill"/>`
      : `${group.base ? `<rect x="${x}" y="${y}" width="${half}" height="${cell}" class="an-fill"/>` : ""}${group.other ? `<rect x="${x + half}" y="${y}" width="${half}" height="${cell}" class="an-fill"/>` : ""}`;
    return `${fill}<rect x="${x + 0.5}" y="${y + 0.5}" width="${cell - 1}" height="${cell - 1}" class="an-cell"/>`;
  }).join("");
  return { svg: marks, width, height, className };
}

function unitFigure(groups, total, label) {
  const summary = groups.map((group) => `${group.count} ${group.words}`).join("; ");
  const variant = ({ svg, width, height, className }, suffix) => `<svg class="${className}" role="img" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-labelledby="units-${suffix}-t units-${suffix}-d">`
    + `<title id="units-${suffix}-t">${escapeMarkup(label)}</title><desc id="units-${suffix}-d">${escapeMarkup(`${total} squares, one per task, in this order: ${summary}.`)}</desc>${svg}</svg>`;
  return `<figure class="dg-figure dg-at-40 an-units">${variant(unitGrid(groups, 41, 24, 18, "dg-wide"), "wide")}${variant(unitGrid(groups, 14, 22, 18, "dg-tall"), "tall")}</figure>`;
}

const glyph = (base, other) => `<svg class="ns-g" viewBox="0 0 16 16" aria-hidden="true" focusable="false">`
  + (base && other ? `<rect x="1" y="1" width="14" height="14" class="an-fill"/>` : "")
  + (base && !other ? `<rect x="1" y="1" width="7" height="14" class="an-fill"/>` : "")
  + (other && !base ? `<rect x="8" y="1" width="7" height="14" class="an-fill"/>` : "")
  + `<rect x="1.5" y="1.5" width="13" height="13" class="an-cell"/></svg>`;

function modelComparisonFigure(dataset, comparison) {
  const [base, other] = comparison.models;
  const n = comparison.denominator;
  const paired = comparison.paired;
  const gap = number(Math.abs(comparison.deltaPercentagePoints), 2);
  const direction = comparison.deltaPercentagePoints < 0 ? "lower" : "higher";
  const significance = comparison.mcnemar.significantAt005 ? "statistically significant at 0.05" : "not statistically significant";
  const svg = barPlate({
    id: "model-pass-at-1-comparison",
    title: "164-task model pass@1 comparison",
    description: `Pass at one under the same harness, greedy decoding, and temperature zero. McNemar p equals ${comparison.mcnemar.pValue}; the difference was ${comparison.mcnemar.significantAt005 ? "" : "not "}statistically significant at 0.05. ${comparison.doesNotProve}`,
    heading: `Share of ${n} code-completion tasks passed on the first try`,
    scaleNote: "Same tasks, same harness, one greedy try each. The scale starts at zero.",
    rows: comparison.models.map((row) => ({ label: row.role, detail: `${row.passed} of ${n} tasks passed`, value: row.passAt1, display: `${number(row.passAt1 * 100, 2)}%` })),
    footnote: `The ${gap}-point gap is ${significance}${comparison.mcnemar.significantAt005 ? "" : " at 0.05"}.`,
    embedFonts: true,
  });

  const groups = [
    { count: paired.both_pass, base: true, other: true, words: "both models passed" },
    { count: paired.regressions_flywheel_fail_base_pass, base: true, other: false, words: `only ${base.role} passed` },
    { count: paired.gains_flywheel_pass_base_fail, base: false, other: true, words: `only ${other.role} passed` },
    { count: paired.both_fail, base: false, other: false, words: "both models failed" },
  ];
  if (groups.reduce((sum, group) => sum + group.count, 0) !== n) throw new Error("paired outcomes do not sum to the task count");
  const split = paired.regressions_flywheel_fail_base_pass + paired.gains_flywheel_pass_base_fail;

  const bars = `<div class="ns-rows an-bars" role="group" aria-label="Share of the ${n} tasks each model passed on the first try">`
    + axisRow("Share of tasks passed on the first try. The scale starts at zero.", [[0, "0%", " is-s"], [25, "25%", " is-opt"], [50, "50%", ""], [75, "75%", " is-opt"], [100, "100%", " is-e"]])
    + comparison.models.map((row) => shareRow(row.role, `${row.passed} of ${n} tasks passed`, row.passAt1, `${number(row.passAt1 * 100, 2)}%`)).join("")
    + `</div>`;
  const units = `<p class="ns-panel-h">Where the two models split</p>`
    + `<p class="ns-units">Each square is one task. Its left half is filled when ${escapeMarkup(base.role)} passed it, its right half when ${escapeMarkup(other.role)} passed it.</p>`
    + unitFigure(groups, n, `The ${n} tasks by paired outcome`)
    + `<ul class="ns-key an-unit-key" aria-label="Key">${groups.map((group) => `<li>${glyph(group.base, group.other)}<span><b class="ns-count">${group.count}</b> ${escapeMarkup(group.words)}</span></li>`).join("")}</ul>`;
  const limit = `<p class="limit-line">A gap this small can be chance: the two models split on ${split} of the ${n} tasks, ${paired.regressions_flywheel_fail_base_pass} for ${escapeMarkup(base.role)} and ${paired.gains_flywheel_pass_base_fail} for ${escapeMarkup(other.role)}. It covers one ${n}-task code-completion suite and does not measure agentic tool use or general coding quality.</p>`;

  const tableRows = comparison.models.map((row) => `<tr><th scope="row">${escapeMarkup(row.role)}</th><td data-label="Model reference">${escapeMarkup(row.modelRef)}</td><td class="num" data-label="Passed / n">${row.passed}/${n}</td><td class="num" data-label="Pass@1">${number(row.passAt1 * 100, 2)}%</td></tr>`).join("");
  const table = `<div class="table-wrap" role="region" aria-labelledby="model-cap" tabindex="0"><table class="data-table" data-stack><caption id="model-cap">Text equivalent for both model results.</caption>`
    + `<thead><tr><th scope="col">Model role</th><th scope="col">Model reference</th><th scope="col" class="num">Passed / n</th><th scope="col" class="num">Pass@1</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
  const source = comparison.sourcePublicUrl ? `<a href="${escapeMarkup(comparison.sourcePublicUrl)}">Public tracked result</a>` : escapeMarkup(comparison.sourceAvailability);
  const hwk = howWeKnow(`How we know<span class="ns-vh">: the comparison</span>`, [
    ["Does not prove", escapeMarkup(comparison.doesNotProve)],
    ["Limits", escapeMarkup(comparison.limitations.join(" "))],
    ["Method", `Same ${n} code-completion tasks, same harness, pass@1, greedy decoding, temperature 0. Each bar is the share of the ${n} tasks a model passed on its first try, on a scale that starts at zero.`],
    ["Test", `${escapeMarkup(other.role)} was ${gap} percentage points ${direction}. McNemar test on the paired outcomes: continuity-corrected χ²=${number(comparison.mcnemar.chiSquareContinuityCorrected, 3)}, p=${number(comparison.mcnemar.pValue, 3)}, significant at 0.05: ${comparison.mcnemar.significantAt005 ? "yes" : "no"}.`],
    ["Paired outcomes", `${paired.gains_flywheel_pass_base_fail} gains; ${paired.regressions_flywheel_fail_base_pass} regressions; ${paired.both_pass} both pass; ${paired.both_fail} both fail`],
    ["Tally", table],
    ["Source", `<p>${source}</p><p>Source SHA-256: <code class="digest">${escapeMarkup(comparison.sourceSha256)}</code></p>`],
  ]);
  const takeaway = `${base.role} passed ${base.passed} of the ${n} tasks and ${other.role} passed ${other.passed}, a gap of ${gap} points that is ${significance}.`;
  const figure = sheet({
    uid: "model", seed: 16441, title: `How many of the ${n} tasks each model passed on its first try`, takeaway,
    body: `<div class="ns-fig">${bars}${units}</div>${limit}${hwk}`,
    stamp: `Measured result, captured ${plainDate(dataset.capturedAt)}`,
  });
  const html = page("164-task model pass@1 comparison", `<p class="eyebrow">MEASURED MODEL COMPARISON · ${escapeMarkup(dataset.capturedAt)}</p><h1>164-task model pass@1 comparison</h1>`
    + `<p class="lede">Two 14B coding models took the same ${n} code-completion tasks through the same harness, with one greedy try at each task.</p>${SHEET_DEFS}${figure}`);
  return { svg, html, companion: { renderer: "zentropy-portfolio-analytics/v2", figure: { id: "model-pass-at-1-comparison", kind: "paired-model-comparison", sourceSha256: comparison.sourceSha256, units: ["pass@1", "passed tasks", "percentage points", "McNemar p-value"], denominator: comparison.denominator, retrievedAt: dataset.capturedAt, uncertainty: comparison.limitations, doesNotProve: comparison.doesNotProve, data: comparison } } };
}

// ------------------------------------------------------------------ exploratory stack matrix

function exploratoryStackFigure(dataset, comparison) {
  const n = comparison.denominator;
  const ranked = [...comparison.measuredRows].sort((a, b) => b.passed - a.passed || a.label.localeCompare(b.label));
  const missing = comparison.unavailableRows.map((row) => row.label);
  const notDrawn = `${listed(missing)} did not run and ${missing.length === 1 ? "is" : "are"} not drawn as zero.`;
  const detail = (row) => `${modelName(row.model)}, ${row.passed} of ${row.denominator} cases passed`;
  const display = (row) => `${number(row.passRate * 100, 1)}%`;
  const svg = barPlate({
    id: "exploratory-stack-comparison",
    title: "Seven-case exploratory stack matrix",
    description: `Pass rate for ${ranked.length} operational rows on the same ${n} custom cases. Models and stack configurations differ. ${comparison.unavailableRows.map((row) => `${row.label}: ${unavailableWords(row)}.`).join(" ")} ${comparison.doesNotProve}`,
    heading: `Share of the ${n} cases each stack passed`,
    scaleNote: "Each stack ran its own model and configuration. The scale starts at zero.",
    rows: [...ranked.map((row) => ({ label: row.label, detail: detail(row), value: row.passRate, display: display(row) })),
      ...comparison.unavailableRows.map((row) => ({ label: row.label, detail: unavailableWords(row), unavailable: true, display: "No score" }))],
    footnote: `Stack-level evidence, not a same-model harness test. ${notDrawn}`,
    embedFonts: true,
  });
  const measuredRows = comparison.measuredRows.map((row) => `<tr><th scope="row">${escapeMarkup(row.label)}</th><td>${escapeMarkup(row.backend)}</td><td>${escapeMarkup(row.model)}</td><td>${row.passed}/${row.denominator}</td><td>${number(row.passRate * 100, 1)}%</td><td>${number(row.meanQuality, 3)}</td><td>${number(row.meanLatencyMs, 3)} ms</td><td>${number(row.errorRate * 100, 1)}%</td><td>${escapeMarkup(Object.entries(row.failureClasses).map(([key, count]) => `${key}: ${count}`).join("; "))}</td></tr>`).join("");
  const unavailable = comparison.unavailableRows.map((row) => `<tr><th scope="row">${escapeMarkup(row.label)}</th><td class="status unknown">${escapeMarkup(row.status)}</td><td>${escapeMarkup(row.reason)}</td></tr>`).join("");
  const takeaway = `${ranked[0].label} passed ${ranked[0].passed} of the ${n} cases, ${listed(ranked.slice(1).map((row) => `${row.label} ${row.passed}`))}, each on its own model and stack configuration.`;
  const hwk = howWeKnow(`How we know<span class="ns-vh">: the matrix</span>`, [
    ["What this does not prove", escapeMarkup(comparison.doesNotProve)],
    ["Limitations", escapeMarkup(comparison.limitations.join(" "))],
    ["Method", escapeMarkup(comparison.method)],
    ["Environment", escapeMarkup(comparison.environment)],
    ["Denominator", `${comparison.denominator} custom cases per operational row`],
    ["Operational rows", `<div class="table-wrap"><table><caption>Text equivalent for the three operational rows.</caption><thead><tr><th>Stack</th><th>Backend</th><th>Model</th><th>Passed / n</th><th>Pass rate</th><th>Mean quality</th><th>Mean latency</th><th>Error rate</th><th>Failure classes</th></tr></thead><tbody>${measuredRows}</tbody></table></div>`],
    ["Unavailable rows", `<div class="table-wrap"><table><caption>Systems excluded from numeric ranking rather than represented as zero.</caption><thead><tr><th>System</th><th>Status</th><th>Reason</th></tr></thead><tbody>${unavailable}</tbody></table></div>`],
    ["Source SHA-256", `<code class="digest">${escapeMarkup(comparison.sourceSha256)}</code>`],
  ]);
  const swatch = (cls) => `<svg class="ns-sw" viewBox="0 0 26 16" aria-hidden="true" focusable="false"><rect x="1" y="3" width="24" height="10" class="${cls}"/></svg>`;
  const key = `<ul class="ns-key" aria-label="Key"><li>${swatch("m-scan")}<span>Share of the ${n} cases passed</span></li><li>${swatch("m-unk")}<span>Did not run, so it has no score</span></li></ul>`;
  const bars = `<div class="ns-rows an-bars" role="group" aria-label="Share of the ${n} cases each stack passed">`
    + axisRow(`Share of the ${n} cases passed. The scale starts at zero.`, [[0, "0%", " is-s"], [25, "25%", " is-opt"], [50, "50%", ""], [75, "75%", " is-opt"], [100, "100%", " is-e"]])
    + ranked.map((row) => shareRow(row.label, detail(row), row.passRate, display(row))).join("")
    + comparison.unavailableRows.map((row) => unmeasuredRow(row.label, unavailableWords(row))).join("")
    + `</div>`;
  const figure = sheet({
    uid: "stack", seed: 70709, title: `Share of the ${comparison.denominator} cases each stack passed`, takeaway,
    body: `<div class="ns-fig">${key}${bars}</div>`
      + `<p class="limit-line">This is stack-level evidence, not a same-model harness attribution test. ${escapeMarkup(notDrawn)}</p>${hwk}`,
    stamp: `Exploratory result, captured ${plainDate(dataset.capturedAt)}`,
  });
  const html = page("Seven-case exploratory stack matrix", `<p class="eyebrow">EXPLORATORY ACTUAL RESULT · ${escapeMarkup(dataset.capturedAt)}</p><h1>Seven-case exploratory stack matrix</h1><p class="lede">The operational rows used the same seven cases and scoring fields, but different models and stack configurations. This is stack-level evidence, not a same-model harness attribution test.</p>${SHEET_DEFS}${figure}`);
  return { svg, html, companion: { renderer: "zentropy-portfolio-analytics/v2", figure: { id: "exploratory-stack-comparison", kind: "exploratory-actual-result", sourceSha256: comparison.sourceSha256, units: ["pass rate", "quality score", "milliseconds", "error rate", "failure counts"], denominator: comparison.denominator, retrievedAt: dataset.capturedAt, uncertainty: comparison.limitations, doesNotProve: comparison.doesNotProve, data: comparison } } };
}

// ------------------------------------------------------------------ source inventory
//
// One sheet draws each public repository's source and test lines, then the full commit-backed
// table sits under "How we know". The sizes run from a few hundred lines to nearly two hundred
// thousand, so the strips use a log scale with each step ten times the last, and every row prints
// its two counts in words beside the marks. A measured zero cannot sit on a log scale, so it
// prints as words and draws no mark. A repository with no measurement draws a stippled band.

// The drawn domain: 10^1.5 (about 32 lines) to 10^5.5 (about 316,000 lines), four steps of ten.
const LOG_LOW = 1.5;
const LOG_HIGH = 5.5;
const position = (value) => ((Math.log10(value) - LOG_LOW) / (LOG_HIGH - LOG_LOW)) * 100;
const TICKS = [[position(100), "100"], [position(1000), "1,000"], [position(10000), "10,000"], [position(100000), "100,000"]];
const REASONS = {
  local_checkout_not_found: "no local checkout was found at capture time",
};

function repositoryCommitLink(project) {
  return project.commit?.status === "measured"
    ? `${project.repositoryUrl}/tree/${encodeURIComponent(project.commit.value)}`
    : project.repositoryUrl;
}

function inventoryRow(project) {
  const source = project.sourceLoc;
  const test = project.testLoc;
  const name = `<div class="ns-rname"><p class="ns-n">${escapeMarkup(project.name)}</p></div>`;
  if (!measured(source) || !measured(test)) {
    const reason = REASONS[source?.reason] ?? String(source?.reason ?? "not reported").replaceAll("_", " ");
    return `<div class="ns-row an-inv is-unknown">${name}<div class="ns-sc"><svg class="ns-strip" aria-hidden="true" focusable="false">`
      + `<rect x="0" y="9" width="100%" height="14" class="m-unk"/></svg></div>`
      + `<p class="ns-rval"><span class="t-null-word">Unknown: ${escapeMarkup(reason)}</span></p></div>`;
  }
  const marks = [];
  const sx = source.value > 0 ? position(source.value) : null;
  const tx = test.value > 0 ? position(test.value) : null;
  if (sx !== null && tx !== null) marks.push(`<line x1="${sx.toFixed(2)}%" y1="16" x2="${tx.toFixed(2)}%" y2="16" class="an-link"/>`);
  if (tx !== null) marks.push(`<svg x="${tx.toFixed(2)}%" y="16" width="1" height="1" overflow="visible"><path d="M0 -6.5 L6.5 0 L0 6.5 L-6.5 0 Z" class="an-test"/></svg>`);
  if (sx !== null) marks.push(`<circle cx="${sx.toFixed(2)}%" cy="16" r="6" class="an-src"/>`);
  const words = source.value === 0 && test.value === 0
    ? "No code files"
    : `${number(source.value, 0)} source · ${number(test.value, 0)} test`;
  return `<div class="ns-row an-inv">${name}<div class="ns-sc"><svg class="ns-strip" aria-hidden="true" focusable="false">`
    + TICKS.map(([x]) => `<line x1="${x.toFixed(2)}%" y1="0" x2="${x.toFixed(2)}%" y2="100%" class="m-grat"/>`).join("")
    + `${marks.join("")}</svg></div><p class="ns-rval">${escapeMarkup(words)}</p></div>`;
}

function inventoryTable(dataset) {
  const rows = dataset.projects.map((project) => {
    const extensions = (project.extensions ?? []).map((item) => `${item.language} (${item.extension}): ${number(item.loc, 0)} LOC`).join("; ") || "Unknown or no included code extension";
    return `<tr><th scope="row"><a href="${escapeMarkup(project.repositoryUrl)}">${escapeMarkup(project.name)}</a></th><td><a href="${escapeMarkup(repositoryCommitLink(project))}">${project.commit?.status === "measured" ? `<code>${escapeMarkup(project.commit.value)}</code>` : `Unknown: ${escapeMarkup(project.commit?.reason ?? "not_reported")}`}</a></td><td>${escapeMarkup(project.commitDate?.value ?? `Unknown: ${project.commitDate?.reason ?? "not_reported"}`)}</td><td>${escapeMarkup(metricText(project.sourceFiles, 0))}</td><td>${escapeMarkup(metricText(project.testFiles, 0))}</td><td>${escapeMarkup(metricText(project.sourceLoc, 0))}</td><td>${escapeMarkup(metricText(project.testLoc, 0))}</td><td>${escapeMarkup(metricText(project.testCollectionCount, 0))}${project.testCollectionCount?.method ? `<br><span class="status">${escapeMarkup(project.testCollectionCount.method)}</span>` : ""}</td><td>${escapeMarkup(extensions)}</td></tr>`;
  }).join("\n");
  return `<div class="table-wrap"><table><caption>Text equivalent for every measured or unknown public-registry project.</caption><thead><tr><th>Project</th><th>Commit</th><th>Commit date</th><th>Source files</th><th>Test files</th><th>Source LOC</th><th>Test LOC</th><th>Static test definitions</th><th>Language or extension LOC</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

const key = `<ul class="ns-key" aria-label="Key">`
  + `<li><svg class="ns-g" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6" class="an-src"/></svg><span>Source lines</span></li>`
  + `<li><svg class="ns-g" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.5 L14.5 8 L8 14.5 L1.5 8 Z" class="an-test"/></svg><span>Test lines</span></li>`
  + `<li><svg class="ns-sw" viewBox="0 0 26 16" aria-hidden="true" focusable="false"><rect x="1" y="3" width="24" height="10" class="m-unk"/></svg><span>Not measured</span></li>`
  + `</ul>`;

function sourceInventory(dataset) {
  const projects = dataset.projects;
  const measuredProjects = projects.filter((project) => measured(project.sourceLoc) && measured(project.testLoc));
  const ordered = [...measuredProjects].sort((a, b) => b.sourceLoc.value - a.sourceLoc.value || a.name.localeCompare(b.name));
  const unknown = projects.filter((project) => !measuredProjects.includes(project));
  const total = measuredProjects.reduce((sum, project) => sum + project.sourceLoc.value, 0);
  const [first, second] = ordered;
  const sizes = ordered.map((project) => project.sourceLoc.value).sort((a, b) => a - b);
  const median = sizes.length % 2 ? sizes[(sizes.length - 1) / 2] : (sizes[sizes.length / 2 - 1] + sizes[sizes.length / 2]) / 2;
  // The sentence follows the count: a registry with one measured repository or none still gets a
  // true takeaway, never a share of an empty total.
  let takeaway = "No repository in the registry could be measured at capture time.";
  if (ordered.length === 1) takeaway = `${first.name} is the one measured repository, with ${number(total, 0)} source lines.`;
  if (ordered.length > 1 && total > 0) {
    const share = Math.round(((first.sourceLoc.value + second.sourceLoc.value) / total) * 100);
    takeaway = `${first.name} and ${second.name} hold ${share} percent of the ${number(total, 0)} source lines across the ${measuredProjects.length} measured repositories, and the median repository holds ${number(median, 0)}.`;
  }

  const chart = `<div class="ns-fig">${key}<div class="ns-rows an-inventory" role="group" aria-label="Source and test lines in each repository">`
    + axisRow("Physical lines, log scale: each step is ten times the last", TICKS.map(([x, label], index) => [x.toFixed(2), label, index === 0 ? " is-s" : index === TICKS.length - 1 ? " is-e" : ""]))
    + [...ordered, ...unknown].map(inventoryRow).join("") + `</div></div>`;
  const limit = `<p class="limit-line">Line counts measure size. This inventory is not the portfolio's benchmark result and is not used as a proxy for quality.</p>`;
  const hwk = howWeKnow(`How we know<span class="ns-vh">: the inventory</span>`, [
    ["Does not prove", escapeMarkup(dataset.doesNotProve)],
    ["Uncertainty", escapeMarkup(dataset.uncertainty)],
    ["Date", escapeMarkup(dataset.capturedAt)],
    ["Units", "tracked files, physical lines, and statically recognized test definitions"],
    ["Denominator", `${escapeMarkup(String(dataset.selection?.denominator ?? projects.length))} public registry-listed GitHub repositories`],
    ["Method", `${escapeMarkup(dataset.method?.snapshot ?? "git HEAD blobs only")}; ${escapeMarkup(dataset.method?.lineCount ?? "physical lines")}. The chart draws source and test lines on a log scale; a measured zero prints as words.`],
    ["Exclusions", escapeMarkup((dataset.method?.excludedPathSegments ?? []).join(", "))],
    ["Full inventory", inventoryTable(dataset)],
  ]);
  const figure = sheet({
    uid: "inventory", seed: 31032, title: "Source and test lines in each public repository", takeaway,
    body: `${chart}${limit}${hwk}`,
    stamp: `Inventory captured ${plainDate(dataset.capturedAt)}`,
  });
  const html = page("Portfolio source inventory", `<p class="eyebrow">SUPPORTING INVENTORY · ${escapeMarkup(dataset.capturedAt)}</p><h1>Public source and test inventory</h1><p class="lede">This supporting inventory records commit-backed source structure. It is not the portfolio's benchmark result and is not used as a proxy for quality.</p>${SHEET_DEFS}${figure}`);
  const companion = {
    schema: "zentropy-portfolio-source-inventory/v1",
    capturedAt: dataset.capturedAt,
    units: ["tracked files", "physical lines", "statically recognized test definitions"],
    denominator: dataset.selection?.denominator ?? projects.length,
    method: dataset.method,
    uncertainty: dataset.uncertainty,
    doesNotProve: dataset.doesNotProve,
    projects,
  };
  return { html, companion };
}

function publicBlobLink(record) {
  return `${record.repositoryUrl}/blob/${encodeURIComponent(record.commit)}/${record.trackedPath.split("/").map(encodeURIComponent).join("/")}`;
}

function benchmarkStatus(dataset) {
  const evidence = dataset.benchmarkEvidence;
  const groups = evidence.comparisonGroups ?? [];
  const targets = (evidence.baselineTargets ?? []).map((target) => {
    const provenance = target.officialUrl
      ? `<a href="${escapeMarkup(target.officialUrl)}">official</a>${target.sourceUrl ? ` · <a href="${escapeMarkup(target.sourceUrl)}">source</a>` : ""}`
      : target.repositoryUrl ? `<a href="${escapeMarkup(publicBlobLink(target))}">contract</a>` : "Not reported";
    return `<tr><th scope="row">${escapeMarkup(target.toolName)}</th><td>${escapeMarkup(target.modelName)}</td><td class="status unknown">${escapeMarkup(target.status)}</td><td>${escapeMarkup(target.reason)}</td><td>${provenance}</td></tr>`;
  }).join("");
  const excluded = (evidence.excludedCandidates ?? []).map((candidate) => `<tr><th scope="row">${escapeMarkup(candidate.projectId)}</th><td>${escapeMarkup(candidate.trackedPath)}</td><td>${escapeMarkup(candidate.schema ?? "unknown")}</td><td>${escapeMarkup(candidate.reason)}</td></tr>`).join("");
  const actualCount = Object.keys(evidence.actualComparisons ?? {}).length;
  const targetList = evidence.baselineTargets ?? [];
  const notMeasured = targetList.filter((target) => target.status === "NOT_MEASURED").length;
  const excludedCount = (evidence.excludedCandidates ?? []).length;
  // Four counts carry the page, each set as a display numeral with its meaning under it.
  const card = (count, words, names = "") => `<li class="ns-card"><p class="ns-big">${number(count, 0)}</p><p class="ns-cl">${escapeMarkup(words)}</p>${names ? `<p class="an-names">${escapeMarkup(names)}</p>` : ""}</li>`;
  const cards = `<ul class="ns-cards" style="--cards:4" aria-label="Benchmark evidence counts">`
    + card(groups.length, `same-task comparison group${groups.length === 1 ? "" : "s"} passed the scorecard gate`)
    + card(actualCount, `measured comparison${actualCount === 1 ? "" : "s"} published on ${actualCount === 1 ? "its" : "their"} own page`)
    + card(notMeasured, `named baseline tool${notMeasured === 1 ? "" : "s"} not measured yet`, listed(targetList.filter((target) => target.status === "NOT_MEASURED").map((target) => target.toolName.replaceAll(" ", "\u00a0"))))
    + card(excludedCount, `benchmark-like record${excludedCount === 1 ? "" : "s"} kept out of any comparison`)
    + `</ul>`;
  const ACTUAL_PAGES = { modelComparison: ["model-pass-at-1-comparison.html", "The 164-task model comparison"], exploratoryStackMatrix: ["exploratory-stack-comparison.html", "The seven-case stack matrix"] };
  const readLinks = Object.keys(evidence.actualComparisons ?? {}).filter((key) => ACTUAL_PAGES[key])
    .map((key) => `<a href="${ACTUAL_PAGES[key][0]}">${ACTUAL_PAGES[key][1]}</a>`).join(" · ");
  const takeaway = groups.length
    ? `${groups.length} same-task comparison group${groups.length === 1 ? "" : "s"} passed the gate, and ${notMeasured} of the ${targetList.length} named baseline tools are not measured yet.`
    : `No same-task comparison has passed the scorecard gate yet, so none of the ${targetList.length} named baseline tools has a result; the ${actualCount} measured comparison${actualCount === 1 ? " is" : "s are"} published separately with ${actualCount === 1 ? "its" : "their"} own limits.`;
  const hwk = howWeKnow(`How we know<span class="ns-vh">: the evidence status</span>`, [
    ["Does not prove", escapeMarkup(dataset.benchmarkDoesNotProve)],
    ["Scorecard gate", `Generic scorecard gate: ${escapeMarkup(evidence.status)}${evidence.reason ? ` · ${escapeMarkup(evidence.reason)}` : ""}. ${groups.length} same-task-set comparison group${groups.length === 1 ? "" : "s"} passed that gate. ${actualCount} separately scoped, source-hashed actual comparison${actualCount === 1 ? "" : "s"} are published with their own limitations. A target marked NOT_MEASURED is a planned baseline, not a result and not a zero.`],
    ["Named baseline targets", `<div class="table-wrap"><table><caption>Market-adjacent and focal tools named by the site-owned benchmark plan.</caption><thead><tr><th>Tool</th><th>Model</th><th>Status</th><th>Reason</th><th>Plan provenance</th></tr></thead><tbody>${targets || `<tr><td colspan="5">No named baseline targets were found.</td></tr>`}</tbody></table></div>`],
    ["Excluded benchmark candidates", `<div class="table-wrap"><table><caption>Tracked benchmark-like JSON kept out of generic comparative figures.</caption><thead><tr><th>Project</th><th>Tracked path</th><th>Schema</th><th>Exclusion reason</th></tr></thead><tbody>${excluded || `<tr><td colspan="4">No candidate exclusions were recorded.</td></tr>`}</tbody></table></div>`],
  ]);
  const figure = sheet({
    uid: "status", seed: 28082, title: "Where the benchmark evidence stands", takeaway,
    body: `<div class="ns-fig">${cards}</div>${readLinks ? `<p class="an-read">Read the measured results: ${readLinks}</p>` : ""}`
      + `<p class="limit-line">A tool that has not been measured has no score here, which is not a score of zero.</p>${hwk}`,
    stamp: `Status captured ${plainDate(dataset.capturedAt)}`,
  });
  const html = page("Benchmark evidence status", `<p class="eyebrow">BENCHMARK EVIDENCE · ${escapeMarkup(dataset.capturedAt)}</p><h1>Benchmark evidence status</h1>${SHEET_DEFS}${figure}`);
  const companion = {
    schema: "zentropy-benchmark-evidence-status/v1",
    capturedAt: dataset.capturedAt,
    status: evidence.status,
    reason: evidence.reason ?? null,
    unit: evidence.unit,
    comparableGroupCount: groups.length,
    actualComparisonCount: actualCount,
    actualComparisons: evidence.actualComparisons ?? {},
    baselineTargets: evidence.baselineTargets ?? [],
    excludedCandidates: evidence.excludedCandidates ?? [],
    doesNotProve: dataset.benchmarkDoesNotProve,
  };
  return { html, companion };
}

const ratioMetrics = [
  ["taskCompletion", "TASK COMPLETION"],
  ["quality", "QUALITY"],
  ["toolUseSuccess", "TOOL-USE SUCCESS"],
  ["reproducibility", "REPRODUCIBILITY"],
];

function renderBenchmarkSvg(dataset, groups) {
  const width = 1500;
  const metricWidth = 150;
  const left = 330;
  const rowHeight = 76;
  const groupGap = 150;
  let cursorY = 112;
  const body = [];
  for (const group of groups) {
    body.push(`<g role="group" aria-label="Task set ${escapeMarkup(group.taskSetId)}"><rect x="24" y="${cursorY - 60}" width="1452" height="${group.runs.length * rowHeight + 116}" rx="12" fill="#0d1519" stroke="#33484e"/><text x="44" y="${cursorY - 28}" font-size="21" font-weight="700">${escapeMarkup(group.taskSetId)} · n=${group.taskCount} tasks · ${escapeMarkup(group.environment.environmentId)}</text><text x="44" y="${cursorY - 4}" class="mono muted" font-size="14">${escapeMarkup(group.environment.hardware)} · ${escapeMarkup(group.environment.operatingSystem)} · ${escapeMarkup(group.environment.runtime)}</text>`);
    for (const [runIndex, run] of group.runs.entries()) {
      const y = cursorY + runIndex * rowHeight;
      const cells = ratioMetrics.map(([key, label], metricIndex) => {
        const metric = run.metrics[key];
        const x = left + metricIndex * metricWidth;
        if (!measured(metric) || metric.value < 0 || metric.value > 1) {
          return `<text x="${x}" y="${y + 28}" class="mono muted" font-size="14">${escapeMarkup(metricText(metric))}</text>`;
        }
        return `<rect x="${x}" y="${y + 8}" width="120" height="18" fill="#1b3035"/><rect x="${x}" y="${y + 8}" width="${120 * metric.value}" height="18" fill="#8be4cf"><title>${label}: ${number(metric.value * 100, 1)}%</title></rect><text x="${x}" y="${y + 47}" class="mono muted" font-size="14">${number(metric.value * 100, 1)}%</text>`;
      }).join("");
      const latencyX = left + ratioMetrics.length * metricWidth + 20;
      const otherX = latencyX + 170;
      body.push(`<g data-figure-point="true" tabindex="0" role="graphics-symbol" aria-label="${escapeMarkup(run.toolName)} ${escapeMarkup(run.toolVersion)}, ${escapeMarkup(run.modelId)}, n equals ${run.executedTaskCount}"><rect class="focus-ring" x="34" y="${y - 5}" width="1432" height="65" rx="7" fill="none" stroke="transparent"/><text x="44" y="${y + 21}" font-size="18" font-weight="700">${escapeMarkup(run.toolName)} ${escapeMarkup(run.toolVersion)}</text><text x="44" y="${y + 45}" class="mono muted" font-size="14">${escapeMarkup(run.modelId)} · ${escapeMarkup(run.configurationId)}</text>${cells}<text x="${latencyX}" y="${y + 22}" font-size="15">${escapeMarkup(metricText(run.metrics.latencyMs, 1))}</text><text x="${otherX}" y="${y + 16}" class="mono muted" font-size="13">resource ${escapeMarkup(metricText(run.metrics.resourceUse, 2))}</text><text x="${otherX}" y="${y + 36}" class="mono muted" font-size="13">cost ${escapeMarkup(metricText(run.metrics.costUsd, 4))}</text><text x="${otherX}" y="${y + 56}" class="mono muted" font-size="13">failures ${escapeMarkup(Object.entries(run.failureModes).map(([key, count]) => `${key}:${count}`).join(", "))}</text></g>`);
    }
    body.push("</g>");
    cursorY += group.runs.length * rowHeight + groupGap;
  }
  const height = Math.max(460, cursorY + 30);
  const headings = ratioMetrics.map(([, label], index) => `<text x="${left + index * metricWidth}" y="38" class="mono muted" font-size="13">${label}</text>`).join("");
  return `<svg role="img" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-labelledby="benchmark-title benchmark-desc"><title id="benchmark-title">Same-task, same-environment benchmark comparison</title><desc id="benchmark-desc">Each panel is a separate comparable task set. Ratio metrics use a zero to one scale. Latency is in milliseconds. Resource use and cost retain their reported units or remain unknown. No comparison is made across panels. ${escapeMarkup(dataset.benchmarkDoesNotProve)}</desc><style>text{font-family:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#eef6f6}.mono{font-family:"Conso","JetBrains Mono",ui-monospace,monospace}.muted{fill:#bcd0d4}[data-figure-point]:focus{outline:none}[data-figure-point]:focus-visible .focus-ring{stroke:#fff;stroke-width:4}</style><rect width="${width}" height="${height}" fill="#070c0f"/>${headings}<text x="${left + ratioMetrics.length * metricWidth + 20}" y="38" class="mono muted" font-size="13">MEAN LATENCY</text>${body.join("\n")}<text x="44" y="${height - 18}" class="mono muted" font-size="13">Captured ${escapeMarkup(dataset.capturedAt)} · panels are not cross-comparable · unknown is not zero</text></svg>`;
}

function benchmarkComparison(dataset, groups, svg) {
  const sections = groups.map((group) => {
    const provenance = publicBlobLink(group);
    const rows = group.runs.map((run) => `<tr><th scope="row">${escapeMarkup(run.toolName)} ${escapeMarkup(run.toolVersion)}<br><span class="status">${escapeMarkup(run.harnessId)} · ${escapeMarkup(run.modelId)}</span></th><td>${escapeMarkup(run.configurationId)}</td><td>${run.executedTaskCount}</td><td>${escapeMarkup(metricText(run.metrics.taskCompletion))}</td><td>${escapeMarkup(metricText(run.metrics.quality))}</td><td>${escapeMarkup(metricText(run.metrics.latencyMs, 1))}</td><td>${escapeMarkup(metricText(run.metrics.toolUseSuccess))}</td><td>${escapeMarkup(metricText(run.metrics.reproducibility))}</td><td>${escapeMarkup(metricText(run.metrics.resourceUse))}</td><td>${escapeMarkup(metricText(run.metrics.costUsd, 4))}</td><td>${escapeMarkup(Object.entries(run.failureModes).map(([key, count]) => `${key}: ${count}`).join("; "))}</td><td>${run.rawArtifactLinks.map((link, index) => `<a href="${escapeMarkup(link)}">raw ${index + 1}</a>`).join(", ")}</td></tr>`).join("");
    return `<section><h2>${escapeMarkup(group.taskSetId)}</h2><p><strong>n:</strong> ${group.taskCount} tasks per run. <strong>Environment:</strong> ${escapeMarkup(group.environment.hardware)}; ${escapeMarkup(group.environment.operatingSystem)}; ${escapeMarkup(group.environment.runtime)}. <strong>Date:</strong> ${escapeMarkup(group.capturedAt)}. <a href="${escapeMarkup(provenance)}">Tracked scorecard</a>.</p><p><strong>Confidence:</strong> ${escapeMarkup(group.confidence.level)} · ${escapeMarkup(group.confidence.basis)}. <strong>Limitations:</strong> ${escapeMarkup(group.limitations.join(" "))}</p><div class="table-wrap"><table><caption>Text equivalent for same-task-set runs in ${escapeMarkup(group.taskSetId)}.</caption><thead><tr><th>Tool, version, harness, model</th><th>Configuration</th><th>n</th><th>Task completion</th><th>Quality</th><th>Latency</th><th>Tool-use success</th><th>Reproducibility</th><th>Resource use</th><th>Cost</th><th>Failure modes</th><th>Raw artifacts</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join("\n");
  const html = page("Same-task benchmark comparison", `<p class="eyebrow">REPRODUCIBLE BENCHMARK EVIDENCE · ${escapeMarkup(dataset.capturedAt)}</p><h1>Same-task, same-environment benchmark comparison</h1><p class="lede">Every panel compares only runs from the same task set and is independently gated by prompt hashes, metric schema, execution policy, environment, tool and model identity, version, configuration, date, and public raw-artifact links. Panels are not compared with one another.</p><div class="figure-scroll" tabindex="0" aria-label="Scrollable benchmark comparison">${svg}</div>${sections}<p class="does-not-prove"><strong>What this figure does not prove:</strong> ${escapeMarkup(dataset.benchmarkDoesNotProve)}</p>`);
  const companion = {
    renderer: "zentropy-portfolio-analytics/v2",
    figure: {
      id: "portfolio-benchmark-comparison",
      kind: "small-multiple-comparison",
      title: "Same-task, same-environment benchmark comparison",
      description: "Ratio metrics are plotted within separately gated task-set panels; latency, resource use, cost, failures, and unknowns remain explicit.",
      units: ["ratio", "score ratio", "milliseconds", "reported resource units", "USD", "failure counts"],
      denominator: groups.map((group) => ({ groupId: group.groupId, taskSetId: group.taskSetId, tasksPerRun: group.taskCount, runs: group.runs.length })),
      retrievedAt: dataset.capturedAt,
      provenance: groups.map((group) => ({ repositoryUrl: group.repositoryUrl, commit: group.commit, trackedPath: group.trackedPath, rawArtifactLinks: group.runs.flatMap((run) => run.rawArtifactLinks) })),
      transformations: ["Require identical task IDs and raw prompt hashes within each panel.", "Require the same task-set ID, metric schema, execution policy, and environment record.", "Aggregate task metrics by arithmetic mean within each run.", "Keep non-comparable and non-executed candidates out of the figure."],
      uncertainty: dataset.uncertainty,
      doesNotProve: dataset.benchmarkDoesNotProve,
      data: { groups },
    },
  };
  return { html, companion };
}

const duration = (ms) => ms === null || ms === undefined ? null : (ms >= 1000 ? `${number(ms / 1000, 1)} s` : `${number(ms, 0)} ms`);
const unknown = (reason) => `<span class="unknown">Unknown: ${escapeMarkup(reason)}</span>`;
const ratio = (part, whole) => whole ? part / whole : 0;

function roleCost(role) {
  // A partial sum still looks whole on a page, so the coverage travels with it
  // and a provider that states nothing shows an absence rather than a zero.
  if (role.cost.usdTotal === null || role.cost.usdTotal === undefined) {
    return unknown(role.nullReasons.cost_usd_total ?? "provider cost unavailable");
  }
  const coverage = role.cost.coverage === null ? "coverage unknown" : `${number(role.cost.coverage * 100, 0)}% of attempts reported a cost`;
  return `$${number(role.cost.usdTotal, 4)} <span class="status">(${escapeMarkup(coverage)})</span>`;
}

function ungradedText(role) {
  const entries = Object.entries(role.ungraded ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!entries.length) return "";
  return entries.map(([reason, count]) => `${count} ${reason}`).join("; ");
}

function recoveryText(role) {
  // A refusal that carried a complete answer and one that carried nothing are
  // different failures. Both were refused, and neither was graded.
  const recovery = role.envelopeRecovery;
  if (!recovery || !recovery.refused) return "";
  const parts = [`${recovery.held_an_envelope} of ${recovery.refused} refused answers held a complete envelope behind other text`];
  if (recovery.unread) parts.push(`${recovery.unread} with no output left to read`);
  return `${parts.join("; ")}.`;
}

// Role ids in words for the chart. The tables under "How we know" keep the record's own ids.
const ROLE_NAMES = {
  claude_code: "Claude Code",
  codex_harness: "Codex harness",
  flywheel_harness: "Flywheel harness",
  local_14b: "Local 14B model",
  local_32b: "Local 32B model",
};
const roleName = (id) => ROLE_NAMES[id] ?? `${id.charAt(0).toUpperCase()}${id.slice(1)}`.replaceAll("_", " ");

/** One entry per attempt, in the order passed, read and failed, never read. */
function attemptCells(role) {
  const failed = role.readable - role.passed;
  const unread = role.attempts - role.readable;
  if (failed < 0 || unread < 0) throw new Error(`current pilot role ${role.role} counts do not nest`);
  return [...Array(role.passed).fill("passed"), ...Array(failed).fill("failed"), ...Array(unread).fill("unread")];
}

/** The same squares drawn in a sheet row, at a fixed size so a square never scales. */
function attemptStrip(role) {
  const pitch = 30;
  const size = 24;
  const width = role.attempts * pitch - (pitch - size);
  const cells = attemptCells(role).map((kind, index) => `<rect x="${index * pitch + 0.75}" y="0.75" width="${size - 1.5}" height="${size - 1.5}" class="${kind === "passed" ? "an-fill" : kind === "failed" ? "an-open" : "m-unk"}"/>`).join("");
  return `<svg class="an-attempts" width="${width}" height="${size}" viewBox="0 0 ${width} ${size}" aria-hidden="true" focusable="false">${cells}</svg>`;
}

function currentCrossHarnessPilot(sourceRecord, sourceDocumentSha256) {
  if (sourceRecord.schema !== "zentropy-current-cross-harness-pilot-source/v2") {
    throw new Error(`unsupported current pilot source schema: ${sourceRecord.schema}`);
  }
  const { counts, roles, receipts } = sourceRecord;
  // The figure and the record it is drawn from must agree, because the way this
  // page went wrong before was a caption that outlived the run behind it.
  const sum = (key) => roles.reduce((total, role) => total + role[key], 0);
  for (const [name, fromRoles, declared] of [["attempts", sum("attempts"), counts.attempts], ["readable", sum("readable"), counts.readable], ["passed", sum("passed"), counts.passed], ["roles", roles.length, counts.roles]]) {
    if (fromRoles !== declared) throw new Error(`current pilot ${name} disagree: roles say ${fromRoles}, counts say ${declared}`);
  }
  if (receipts?.records?.length !== receipts?.attempts) {
    throw new Error("current pilot receipt records do not match the declared attempt denominator");
  }
  if (receipts.attempts !== counts.attempts) {
    throw new Error(`current pilot receipts cover ${receipts.attempts} of ${counts.attempts} attempts`);
  }
  // A hash that is present must be a hash. A hash that is absent is a receipt
  // the run no longer has on disk, which is a fact to print rather than a
  // reason to withhold the whole page: the attempt still happened.
  const hashOrAbsent = (value) => value === null || value === undefined || /^[a-f0-9]{64}$/.test(value);
  if (!receipts.records.every((record) => hashOrAbsent(record.receiptSha256) && hashOrAbsent(record.receiptSubjectSha256))) {
    throw new Error("current pilot receipt hash is malformed");
  }
  const verifiedStates = receipts.records.filter((record) => record.state === "verified").length;
  if (verifiedStates !== receipts.verified) {
    throw new Error(`current pilot receipt states disagree: ${verifiedStates} verified, header says ${receipts.verified}`);
  }
  if (!Object.values(sourceRecord.artifactHashes).every((sha256) => /^[a-f0-9]{64}$/.test(sha256))) {
    throw new Error("current pilot artifact hash is invalid");
  }
  const companion = {
    ...sourceRecord,
    schema: "zentropy-current-cross-harness-pilot/v2",
    sourceEvidence: {
      href: "source/current-cross-harness-pilot-source.json",
      sha256: sourceDocumentSha256,
      availability: sourceRecord.evidenceAvailability,
    },
  };

  const headline = `${counts.attempts} attempts · ${counts.readable} reached a grader · ${counts.passed} passed · ${receipts.verified}/${receipts.attempts} receipts verified`;
  const parityLine = `${escapeMarkup(companion.parity.prompt)} prompt and runtime context for every role on each of ${counts.tasks} tasks`;
  // Each role's attempts as squares: solid when the attempt passed, open when a checker read it
  // and it failed, stippled with a dashed edge when no checker could read it. Every row also
  // prints its counts, so a zero never has to be read from an empty track.
  const cellPitch = 34;
  const cellSize = 26;
  const gridX = 330;
  const svgRows = roles.map((role, index) => {
    const y = 176 + index * 74;
    const median = duration(role.latencyMsMedian);
    const foot = [median ? `median ${median}` : "latency unmeasured", role.modelsObserved.length ? listed(role.modelsObserved.map(modelName)) : "no model observed"].join(" · ");
    const label = `${roleName(role.role)}: ${role.readable} of ${role.attempts} readable, ${role.passed} passed, ${foot}`;
    const squares = attemptCells(role).map((kind, cellIndex) => `<rect x="${gridX + cellIndex * cellPitch + 0.5}" y="${y - 22.5}" width="${cellSize - 1}" height="${cellSize - 1}" class="${kind === "passed" ? "fill" : kind === "failed" ? "open" : "unk"}"/>`).join("");
    const textX = gridX + role.attempts * cellPitch + 24;
    return `<g role="graphics-symbol" tabindex="0" aria-label="${escapeMarkup(label)}"><rect class="focus-ring" x="38" y="${y - 34}" width="1044" height="58"/>`
      + `<text x="56" y="${y - 4}" font-size="19" font-weight="700">${escapeMarkup(roleName(role.role))}</text><text x="56" y="${y + 18}" class="s" font-size="14">${escapeMarkup(foot)}</text>${squares}`
      + `<text x="${textX}" y="${y - 3}" font-size="16" font-weight="600">${role.readable} of ${role.attempts} reached a grader</text><text x="${textX}" y="${y + 18}" class="s" font-size="14">${role.passed} passed</text></g>`;
  }).join("\n");
  const svgHeight = 176 + roles.length * 74 + 64;
  const svgKey = `<g><rect x="42.5" y="119.5" width="15" height="15" class="fill"/><text x="66" y="132" class="s" font-size="14">passed</text>`
    + `<rect x="152.5" y="119.5" width="15" height="15" class="open"/><text x="176" y="132" class="s" font-size="14">reached a grader and failed</text>`
    + `<rect x="392.5" y="119.5" width="15" height="15" class="unk"/><text x="416" y="132" class="s" font-size="14">never reached a grader</text></g>`;
  const svg = `<svg role="img" xmlns="http://www.w3.org/2000/svg" class="an-plate" width="1120" height="${svgHeight}" viewBox="0 0 1120 ${svgHeight}" aria-labelledby="pilot-title pilot-desc"><title id="pilot-title">Cross-harness run across ${counts.roles} harness roles</title><desc id="pilot-desc">${escapeMarkup(headline)}. On each task the prompt and runtime context every role received were ${escapeMarkup(companion.parity.prompt)}. Each square is one attempt: solid when it passed, open when a checker read it and it failed, stippled when no checker could read it. Durations are wall clock on one machine and are not a speed ranking.</desc>`
    + plateStyle(false)
    + `<defs><pattern id="an-stip" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".85" class="dot"/></pattern></defs>`
    + `<rect x="0.5" y="0.5" width="1119" height="${svgHeight - 1}" class="bg"/><text x="42" y="48" font-size="27" font-weight="760">Cross-harness run across ${counts.roles} harness roles</text><text x="42" y="78" class="s" font-size="16" font-weight="500">${escapeMarkup(headline)}</text><text x="42" y="102" class="s" font-size="14">${parityLine} · durations are wall clock on one machine</text>${svgKey}${svgRows}<text x="42" y="${svgHeight - 22}" class="s" font-size="14">${escapeMarkup(companion.capturedAt)} · not market performance · not a quality ranking</text></svg>`;

  const roleRows = roles.map((role) => `<tr><th scope="row">${escapeMarkup(role.role)}<br><span class="status">${escapeMarkup(role.modelsObserved.join(", ") || "no model observed")}</span></th><td>${role.launched}/${role.attempts}</td><td>${role.readable}/${role.attempts}</td><td>${role.passed}</td><td>${duration(role.latencyMsMedian) ?? unknown("latency unmeasured")}</td><td>${duration(role.latencyMsP90) ?? unknown("latency unmeasured")}</td><td>${roleCost(role)}</td></tr>`).join("");
  const ungradedRows = roles.filter((role) => ungradedText(role)).map((role) => `<tr><th scope="row">${escapeMarkup(role.role)}</th><td>${escapeMarkup(ungradedText(role))}.</td><td>${escapeMarkup(recoveryText(role)) || "not probed"}</td></tr>`).join("");
  const parityRows = companion.parityArtifacts.map((artifact) => `<tr><th scope="row">${escapeMarkup(artifact.taskId)}</th><td><code>${artifact.prompt.sha256.join("</code><br><code>")}</code></td><td><code>${artifact.runtimeContext.sha256.join("</code><br><code>")}</code></td><td>${artifact.identicalAcrossRoles ? `yes, across ${artifact.roles} roles` : "no"}</td></tr>`).join("");
  const receiptRows = receipts.records.map((record) => `<tr><th scope="row">${escapeMarkup(record.role)}<br><span class="status">${escapeMarkup(record.taskId)}</span></th><td>${escapeMarkup(record.state)}</td><td>${record.receiptSha256 ? `<code>${record.receiptSha256}</code>` : unknown("the receipt file is no longer on disk")}</td><td>${record.receiptSubjectSha256 ? `<code>${record.receiptSubjectSha256}</code>` : unknown("no subject hash retained")}</td></tr>`).join("");
  const hashRows = Object.entries(companion.artifactHashes).map(([name, sha256]) => `<tr><th scope="row">${escapeMarkup(name)}</th><td><code>${sha256}</code></td></tr>`).join("");
  const checkerBlocks = companion.checkers.map((checker) => {
    const heading = `<p class="an-check"><strong>${escapeMarkup(checker.checker_id)}</strong></p><p class="status">${escapeMarkup(checker.task_ids.join(", "))} · ${checker.scored_attempts} scored attempt${checker.scored_attempts === 1 ? "" : "s"}</p>`;
    if (!checker.metrics.length) {
      // An empty table reads as a score of zero. This checker graded the
      // attempts and reported no numeric evidence, which is a different fact.
      return `${heading}<p>This checker reported no numeric evidence for the attempts it graded.</p>`;
    }
    const names = checker.metrics[0].roles.map((entry) => entry.provider_role);
    const header = names.map((name) => `<th>${escapeMarkup(name)}</th>`).join("");
    const rows = checker.metrics.map((metric) => {
      const cells = metric.roles.map((entry) => entry.mean === null || entry.mean === undefined ? `<td>${unknown("this role reported no value")}</td>` : `<td>${number(entry.mean, 3)} <span class="status">n=${entry.n}</span></td>`).join("");
      return `<tr><th scope="row">${escapeMarkup(metric.metric)}<br><span class="status">${escapeMarkup(metric.direction)} is better</span></th>${cells}</tr>`;
    }).join("");
    return `${heading}<div class="table-wrap"><table><caption>Checker means for ${escapeMarkup(checker.checker_id)}.</caption><thead><tr><th>Metric</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join("");
  const treeNote = companion.sourceTreeState === "clean"
    ? "The source tree was checked against the commit these rows name and matched."
    : `The run recorded its source tree as <code>${escapeMarkup(companion.sourceTreeState)}</code>, so nothing confirmed the tree still matched the commit these rows name. Each attempt verified its own workspace, which is a narrower claim.`;

  const ungradedWords = (role) => {
    const text = ungradedText(role);
    return text ? `Not graded: ${text}.` : "Every attempt reached a grader.";
  };
  const behind = (role) => {
    // The number and its unit never part at a line end.
    const median = duration(role.latencyMsMedian);
    return `${role.modelsObserved.length ? listed(role.modelsObserved.map(modelName)) : "No model observed"}, ${median ? `median ${median.replace(" ", "\u00a0")}` : "latency unmeasured"}`;
  };
  const attemptRows = roles.map((role) => `<div class="ns-row"><div class="ns-rname"><p class="ns-n">${escapeMarkup(roleName(role.role))}</p><p class="an-sub">${escapeMarkup(behind(role))}</p></div>`
    + `<div class="ns-sc">${attemptStrip(role)}</div>`
    + `<div class="ns-rval"><p class="an-val">${role.readable} of ${role.attempts} reached a grader, ${role.passed} passed</p><p class="an-sub">${escapeMarkup(ungradedWords(role))}</p></div></div>`).join("");
  const sw = (cls) => `<svg class="ns-g" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="13" height="13" class="${cls}"/></svg>`;
  const key = `<ul class="ns-key" aria-label="Key"><li>${sw("an-fill")}<span>Passed</span></li><li>${sw("an-open")}<span>Reached a grader and failed</span></li><li>${sw("m-unk")}<span>Never reached a grader</span></li></ul>`;
  const verified = receipts.verified === receipts.attempts ? `all ${receipts.attempts} receipts verified on re-check` : `${receipts.verified} of ${receipts.attempts} receipts verified on re-check`;
  const takeaway = `${counts.readable} of ${counts.attempts} attempts across ${counts.roles} harness roles reached a grader and ${counts.passed} passed, and ${verified}.`;
  const record = [
    ["Benchmark code", `<a href="${escapeMarkup(companion.sourceCommitUrl)}"><code>${escapeMarkup(companion.sourceCommit)}</code></a>`],
    ["Run identifier", `<code>${escapeMarkup(companion.runId)}</code>`],
    ["Task set", `<code>${escapeMarkup(companion.taskSetId)}</code>`],
    ["Public result source", `<a href="${escapeMarkup(companion.sourceEvidence.href)}">Sanitized source record</a> · <code class="digest">${companion.sourceEvidence.sha256}</code>`],
    ["Evidence availability", `${escapeMarkup(companion.evidenceAvailability)}; raw attempt outputs remain private and are represented here by hashes and sanitized receipt records.`],
    ["Source tree state", treeNote],
    ["Resource use", `<span class="unknown">Unknown: CPU, memory, GPU, and energy observations unavailable</span>`],
  ];
  const hwk = howWeKnow(`How we know<span class="ns-vh">: the run</span>`, [
    ["What this does not prove", escapeMarkup(companion.doesNotProve)],
    ["Limits", `<ul>${companion.limitations.map((item) => `<li>${escapeMarkup(item)}</li>`).join("")}</ul>`],
    ["Method", `${counts.roles} harness roles ran the same ${counts.tasks} tasks. On every task the prompt bytes and the runtime-context bytes each role received were ${escapeMarkup(companion.parity.prompt)}. Each square in the chart is one attempt.`],
    ["Outcome and cost", `<div class="table-wrap"><table><caption>Outcome and cost for each harness role, with its own denominator.</caption><thead><tr><th>Role and observed model</th><th>Launched</th><th>Reached a grader</th><th>Passed</th><th>Median latency</th><th>p90 latency</th><th>Cost</th></tr></thead><tbody>${roleRows}</tbody></table></div>`],
    ["Why an attempt went ungraded", `<p>A malformed answer and a missing one are different failures, so each is named. An attempt that never returned a readable result has no quality numbers here, which is a fact about this run and not a score of zero.</p><div class="table-wrap"><table><caption>Ungraded attempts by reason, and whether a refused answer still held one.</caption><thead><tr><th>Role</th><th>Reasons</th><th>Envelope recovery</th></tr></thead><tbody>${ungradedRows}</tbody></table></div>`],
    ["Graded quality metrics", `<p>Each checker graded the attempts that reached it. A mean over one repetition is a reading and not an estimate, so no interval is reported.</p>${checkerBlocks}`],
    ["Prompt and context parity", `<div class="table-wrap"><table><caption>Prompt and runtime-context hashes for each task, across all roles.</caption><thead><tr><th>Task</th><th>Prompt SHA-256</th><th>Runtime context SHA-256</th><th>Equal across roles</th></tr></thead><tbody>${parityRows}</tbody></table></div>`],
    ...record,
    ["Sanitized receipt records", `<p>Every attempt carries a receipt whose subject hash names the artifacts it produced. ${receipts.verified} of ${receipts.attempts} verified on re-check; any other state is printed as it was recorded.</p><div class="table-wrap"><table><caption>Public receipt and receipt-subject identities for all ${receipts.attempts} attempts.</caption><thead><tr><th>Role and task</th><th>State</th><th>Receipt SHA-256</th><th>Subject SHA-256</th></tr></thead><tbody>${receiptRows}</tbody></table></div>`],
    ["Artifact hashes", `<div class="table-wrap"><table><caption>SHA-256 identities for the operator-local run artifacts.</caption><thead><tr><th>Artifact</th><th>SHA-256</th></tr></thead><tbody>${hashRows}</tbody></table></div>`],
  ]);
  const figure = sheet({
    uid: "pilot", seed: 35117, title: `What happened to each role's ${counts.tasks} attempts`, takeaway,
    body: `<div class="ns-fig">${key}<div class="ns-rows an-attempt-rows" role="group" aria-label="Attempts for each harness role">${attemptRows}</div></div>`
      + `<p class="limit-line">This is one repetition per task on one machine. Times are wall-clock medians and not a speed ranking. It is not market performance and not a quality ranking.</p>${hwk}`,
    stamp: `Run captured ${plainDate(companion.capturedAt)}`,
  });
  const html = page(`Cross-harness run across ${counts.roles} harness roles`, `<p class="record-label">Current cross-harness run · ${escapeMarkup(companion.capturedAt)}</p><h1>Cross-harness run across ${counts.roles} harness roles</h1><p class="lede">${counts.roles} harness roles ran the same ${counts.tasks} tasks from the same task set. On every one of those tasks the prompt bytes and the runtime-context bytes each role received were ${escapeMarkup(companion.parity.prompt)}, so what differs between the rows is the harness and the model behind it. ${counts.readable} of ${counts.attempts} attempts produced something a checker could read, and why the rest did not is reported beside each row rather than left inside the rate.</p>${SHEET_DEFS}${figure}`);
  return { html, svg, companion };
}

const args = parseArgs(process.argv.slice(2));
const dataset = JSON.parse(await readFile(args.input, "utf8"));
if (dataset.schema !== "harperz9-portfolio-analytics/v1") throw new Error(`unsupported analytics schema: ${dataset.schema}`);
if (!Array.isArray(dataset.projects) || !dataset.benchmarkEvidence || !/^\d{4}-\d{2}-\d{2}$/.test(dataset.capturedAt)) throw new Error("analytics dataset is incomplete");
await mkdir(args.outputDir, { recursive: true });

const inventory = sourceInventory(dataset);
const status = benchmarkStatus(dataset);
const currentPilotSourceUrl = new URL("../analytics/source/current-cross-harness-pilot-source.json", import.meta.url);
const currentPilotSourceBytes = await readFile(currentPilotSourceUrl);
const currentPilotSource = JSON.parse(currentPilotSourceBytes.toString("utf8"));
const currentPilotSourceSha256 = createHash("sha256").update(currentPilotSourceBytes).digest("hex");
const currentPilot = currentCrossHarnessPilot(currentPilotSource, currentPilotSourceSha256);
await Promise.all([
  writeFile(resolve(args.outputDir, "portfolio-source-inventory.html"), `${inventory.html}\n`, "utf8"),
  writeFile(resolve(args.outputDir, "portfolio-source-inventory.json"), `${JSON.stringify(inventory.companion, null, 2)}\n`, "utf8"),
  writeFile(resolve(args.outputDir, "benchmark-evidence-status.html"), `${status.html}\n`, "utf8"),
  writeFile(resolve(args.outputDir, "benchmark-evidence-status.json"), `${JSON.stringify(status.companion, null, 2)}\n`, "utf8"),
  writeFile(resolve(args.outputDir, "current-cross-harness-pilot.html"), `${currentPilot.html}\n`, "utf8"),
  writeFile(resolve(args.outputDir, "current-cross-harness-pilot.svg"), `${currentPilot.svg}\n`, "utf8"),
  writeFile(resolve(args.outputDir, "current-cross-harness-pilot.json"), `${JSON.stringify(currentPilot.companion, null, 2)}\n`, "utf8"),
]);

const groups = dataset.benchmarkEvidence.comparisonGroups ?? [];
if (groups.length) {
  const svg = renderBenchmarkSvg(dataset, groups);
  const comparison = benchmarkComparison(dataset, groups, svg);
  await Promise.all([
    writeFile(resolve(args.outputDir, "portfolio-benchmark-comparison.svg"), `${svg}\n`, "utf8"),
    writeFile(resolve(args.outputDir, "portfolio-benchmark-comparison.html"), `${comparison.html}\n`, "utf8"),
    writeFile(resolve(args.outputDir, "portfolio-benchmark-comparison.json"), `${JSON.stringify(comparison.companion, null, 2)}\n`, "utf8"),
  ]);
  console.log(`rendered portfolio-benchmark-comparison: ${groups.length} independently comparable group(s)`);
} else {
  console.log(`withheld portfolio-benchmark-comparison: ${dataset.benchmarkEvidence.reason ?? "no comparable group"}`);
}
const actual = dataset.benchmarkEvidence.actualComparisons ?? {};
if (actual.exploratoryStackMatrix) {
  const figure = exploratoryStackFigure(dataset, actual.exploratoryStackMatrix);
  await Promise.all([
    writeFile(resolve(args.outputDir, "exploratory-stack-comparison.svg"), `${figure.svg}\n`, "utf8"),
    writeFile(resolve(args.outputDir, "exploratory-stack-comparison.html"), `${figure.html}\n`, "utf8"),
    writeFile(resolve(args.outputDir, "exploratory-stack-comparison.json"), `${JSON.stringify(figure.companion, null, 2)}\n`, "utf8"),
  ]);
  console.log("rendered exploratory-stack-comparison");
}
if (actual.modelComparison) {
  const figure = modelComparisonFigure(dataset, actual.modelComparison);
  await Promise.all([
    writeFile(resolve(args.outputDir, "model-pass-at-1-comparison.svg"), `${figure.svg}\n`, "utf8"),
    writeFile(resolve(args.outputDir, "model-pass-at-1-comparison.html"), `${figure.html}\n`, "utf8"),
    writeFile(resolve(args.outputDir, "model-pass-at-1-comparison.json"), `${JSON.stringify(figure.companion, null, 2)}\n`, "utf8"),
  ]);
  console.log("rendered model-pass-at-1-comparison");
}
console.log("rendered supporting source inventory and benchmark evidence status");
