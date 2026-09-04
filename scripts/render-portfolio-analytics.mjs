#!/usr/bin/env node
/** Render comparable benchmark evidence and a supporting source inventory. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { escapeMarkup, number, page } from "./analytics-page.mjs";

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

function repositoryCommitLink(project) {
  return project.commit?.status === "measured"
    ? `${project.repositoryUrl}/tree/${encodeURIComponent(project.commit.value)}`
    : project.repositoryUrl;
}

function sourceInventory(dataset) {
  const rows = dataset.projects.map((project) => {
    const extensions = (project.extensions ?? []).map((item) => `${item.language} (${item.extension}): ${number(item.loc, 0)} LOC`).join("; ") || "Unknown or no included code extension";
    return `<tr><th scope="row"><a href="${escapeMarkup(project.repositoryUrl)}">${escapeMarkup(project.name)}</a></th><td><a href="${escapeMarkup(repositoryCommitLink(project))}">${project.commit?.status === "measured" ? `<code>${escapeMarkup(project.commit.value)}</code>` : `Unknown: ${escapeMarkup(project.commit?.reason ?? "not_reported")}`}</a></td><td>${escapeMarkup(project.commitDate?.value ?? `Unknown: ${project.commitDate?.reason ?? "not_reported"}`)}</td><td>${escapeMarkup(metricText(project.sourceFiles, 0))}</td><td>${escapeMarkup(metricText(project.testFiles, 0))}</td><td>${escapeMarkup(metricText(project.sourceLoc, 0))}</td><td>${escapeMarkup(metricText(project.testLoc, 0))}</td><td>${escapeMarkup(metricText(project.testCollectionCount, 0))}${project.testCollectionCount?.method ? `<br><span class="status">${escapeMarkup(project.testCollectionCount.method)}</span>` : ""}</td><td>${escapeMarkup(extensions)}</td></tr>`;
  }).join("\n");
  const html = page("Portfolio source inventory", `<p class="eyebrow">SUPPORTING INVENTORY · ${escapeMarkup(dataset.capturedAt)}</p><h1>Public source and test inventory</h1><p class="lede">This supporting inventory records commit-backed source structure. It is not the portfolio's benchmark result and is not used as a proxy for quality.</p><div class="table-wrap"><table><caption>Text equivalent for every measured or unknown public-registry project.</caption><thead><tr><th>Project</th><th>Commit</th><th>Commit date</th><th>Source files</th><th>Test files</th><th>Source LOC</th><th>Test LOC</th><th>Static test definitions</th><th>Language or extension LOC</th></tr></thead><tbody>${rows}</tbody></table></div><dl class="scope"><dt>Date</dt><dd>${escapeMarkup(dataset.capturedAt)}</dd><dt>Units</dt><dd>tracked files, physical lines, and statically recognized test definitions</dd><dt>Denominator</dt><dd>${escapeMarkup(String(dataset.selection?.denominator ?? dataset.projects.length))} public registry-listed GitHub repositories</dd><dt>Method</dt><dd>${escapeMarkup(dataset.method?.snapshot ?? "git HEAD blobs only")}; ${escapeMarkup(dataset.method?.lineCount ?? "physical lines")}</dd><dt>Exclusions</dt><dd>${escapeMarkup((dataset.method?.excludedPathSegments ?? []).join(", "))}</dd><dt>Uncertainty</dt><dd>${escapeMarkup(dataset.uncertainty)}</dd><dt>What this table does not prove</dt><dd class="does-not-prove">${escapeMarkup(dataset.doesNotProve)}</dd></dl>`);
  const companion = {
    schema: "zentropy-portfolio-source-inventory/v1",
    capturedAt: dataset.capturedAt,
    units: ["tracked files", "physical lines", "statically recognized test definitions"],
    denominator: dataset.selection?.denominator ?? dataset.projects.length,
    method: dataset.method,
    uncertainty: dataset.uncertainty,
    doesNotProve: dataset.doesNotProve,
    projects: dataset.projects,
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
  const html = page("Benchmark evidence status", `<p class="eyebrow">BENCHMARK EVIDENCE · ${escapeMarkup(dataset.capturedAt)}</p><h1>Benchmark evidence status</h1><p class="notice"><strong>Generic scorecard gate:</strong> ${escapeMarkup(evidence.status)}${evidence.reason ? ` · ${escapeMarkup(evidence.reason)}` : ""}. ${groups.length} same-task-set comparison group${groups.length === 1 ? "" : "s"} passed that gate. ${actualCount} separately scoped, source-hashed actual comparison${actualCount === 1 ? "" : "s"} are published with their own limitations. A target marked NOT_MEASURED is a planned baseline, not a result and not a zero.</p><h2>Named baseline targets</h2><div class="table-wrap"><table><caption>Market-adjacent and focal tools named by the site-owned benchmark plan.</caption><thead><tr><th>Tool</th><th>Model</th><th>Status</th><th>Reason</th><th>Plan provenance</th></tr></thead><tbody>${targets || `<tr><td colspan="5">No named baseline targets were found.</td></tr>`}</tbody></table></div><h2>Excluded benchmark candidates</h2><div class="table-wrap"><table><caption>Tracked benchmark-like JSON kept out of generic comparative figures.</caption><thead><tr><th>Project</th><th>Tracked path</th><th>Schema</th><th>Exclusion reason</th></tr></thead><tbody>${excluded || `<tr><td colspan="4">No candidate exclusions were recorded.</td></tr>`}</tbody></table></div><p class="does-not-prove">${escapeMarkup(dataset.benchmarkDoesNotProve)}</p>`);
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

function actualFigureSvg(id, title, description, rows, valueKey, valueLabel, valueFormat) {
  const width = 1120;
  const left = 300;
  const barWidth = 650;
  const height = 150 + rows.length * 92;
  const points = rows.map((row, index) => {
    const y = 112 + index * 92;
    const value = row[valueKey];
    return `<g tabindex="0" role="graphics-symbol" aria-label="${escapeMarkup(row.label)} ${escapeMarkup(valueFormat(value))}"><rect class="focus-ring" x="24" y="${y - 36}" width="1072" height="72" rx="8" fill="transparent" stroke="transparent"/><text x="42" y="${y - 4}" font-size="19" font-weight="700">${escapeMarkup(row.label)}</text><text x="42" y="${y + 22}" class="mono muted" font-size="13">${escapeMarkup(row.detail)}</text><rect x="${left}" y="${y - 22}" width="${barWidth}" height="28" rx="5" fill="#1b3035"/><rect x="${left}" y="${y - 22}" width="${Math.max(0, Math.min(barWidth, barWidth * value))}" height="28" rx="5" fill="#8be4cf"/><text x="${left + barWidth + 18}" y="${y}" font-size="17">${escapeMarkup(valueFormat(value))}</text></g>`;
  }).join("\n");
  return `<svg role="img" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${escapeMarkup(title)}</title><desc id="${id}-desc">${escapeMarkup(description)}</desc><style>text{font-family:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#eef6f6}.mono{font-family:"Conso","JetBrains Mono",ui-monospace,monospace}.muted{fill:#bcd0d4}g:focus{outline:none}g:focus-visible .focus-ring{stroke:#fff;stroke-width:4}</style><rect width="${width}" height="${height}" fill="#070c0f"/><text x="42" y="42" font-size="25" font-weight="700">${escapeMarkup(title)}</text><text x="${left}" y="72" class="mono muted" font-size="13">${escapeMarkup(valueLabel)} · ZERO-BASED SCALE</text>${points}</svg>`;
}

function exploratoryStackFigure(dataset, comparison) {
  const rows = comparison.measuredRows.map((row) => ({ ...row, detail: `${row.model} · ${row.passed}/${row.denominator} passed` }));
  const svg = actualFigureSvg(
    "exploratory-stack-comparison",
    "Seven-case exploratory stack matrix",
    `Pass rate for three operational rows on the same seven custom cases. Models and stack configurations differ. Claude was nonoperational and OpenCode was skipped. ${comparison.doesNotProve}`,
    rows,
    "passRate",
    "PASS RATE",
    (value) => `${number(value * 100, 1)}%`,
  );
  const measuredRows = comparison.measuredRows.map((row) => `<tr><th scope="row">${escapeMarkup(row.label)}</th><td>${escapeMarkup(row.backend)}</td><td>${escapeMarkup(row.model)}</td><td>${row.passed}/${row.denominator}</td><td>${number(row.passRate * 100, 1)}%</td><td>${number(row.meanQuality, 3)}</td><td>${number(row.meanLatencyMs, 3)} ms</td><td>${number(row.errorRate * 100, 1)}%</td><td>${escapeMarkup(Object.entries(row.failureClasses).map(([key, count]) => `${key}: ${count}`).join("; "))}</td></tr>`).join("");
  const unavailable = comparison.unavailableRows.map((row) => `<tr><th scope="row">${escapeMarkup(row.label)}</th><td class="status unknown">${escapeMarkup(row.status)}</td><td>${escapeMarkup(row.reason)}</td></tr>`).join("");
  const html = page("Seven-case exploratory stack matrix", `<p class="eyebrow">EXPLORATORY ACTUAL RESULT · ${escapeMarkup(dataset.capturedAt)}</p><h1>Seven-case exploratory stack matrix</h1><p class="lede">The operational rows used the same seven cases and scoring fields, but different models and stack configurations. This is stack-level evidence, not a same-model harness attribution test.</p><div class="figure-scroll" tabindex="0" aria-label="Scrollable exploratory comparison">${svg}</div><div class="table-wrap"><table><caption>Text equivalent for the three operational rows.</caption><thead><tr><th>Stack</th><th>Backend</th><th>Model</th><th>Passed / n</th><th>Pass rate</th><th>Mean quality</th><th>Mean latency</th><th>Error rate</th><th>Failure classes</th></tr></thead><tbody>${measuredRows}</tbody></table></div><h2>Unavailable rows</h2><div class="table-wrap"><table><caption>Systems excluded from numeric ranking rather than represented as zero.</caption><thead><tr><th>System</th><th>Status</th><th>Reason</th></tr></thead><tbody>${unavailable}</tbody></table></div><dl class="scope"><dt>Source SHA-256</dt><dd><code>${escapeMarkup(comparison.sourceSha256)}</code></dd><dt>Denominator</dt><dd>${comparison.denominator} custom cases per operational row</dd><dt>Environment</dt><dd>${escapeMarkup(comparison.environment)}</dd><dt>Method</dt><dd>${escapeMarkup(comparison.method)}</dd><dt>Limitations</dt><dd>${escapeMarkup(comparison.limitations.join(" "))}</dd></dl><p class="does-not-prove"><strong>What this does not prove:</strong> ${escapeMarkup(comparison.doesNotProve)}</p>`);
  return { svg, html, companion: { renderer: "zentropy-portfolio-analytics/v2", figure: { id: "exploratory-stack-comparison", kind: "exploratory-actual-result", sourceSha256: comparison.sourceSha256, units: ["pass rate", "quality score", "milliseconds", "error rate", "failure counts"], denominator: comparison.denominator, retrievedAt: dataset.capturedAt, uncertainty: comparison.limitations, doesNotProve: comparison.doesNotProve, data: comparison } } };
}

function modelComparisonFigure(dataset, comparison) {
  const rows = comparison.models.map((row) => ({ ...row, label: row.role, detail: `${row.modelRef} · ${row.passed}/${comparison.denominator} passed` }));
  const svg = actualFigureSvg(
    "model-pass-at-1-comparison",
    "164-task model pass@1 comparison",
    `Pass at one under the same harness, greedy decoding, and temperature zero. McNemar p equals ${comparison.mcnemar.pValue}; the difference was not statistically significant at 0.05. ${comparison.doesNotProve}`,
    rows,
    "passAt1",
    "PASS@1",
    (value) => `${number(value * 100, 2)}%`,
  );
  const tableRows = comparison.models.map((row) => `<tr><th scope="row">${escapeMarkup(row.role)}</th><td>${escapeMarkup(row.modelRef)}</td><td>${row.passed}/${comparison.denominator}</td><td>${number(row.passAt1 * 100, 2)}%</td></tr>`).join("");
  const source = comparison.sourcePublicUrl ? `<a href="${escapeMarkup(comparison.sourcePublicUrl)}">Public tracked result</a>` : escapeMarkup(comparison.sourceAvailability);
  const html = page("164-task model pass@1 comparison", `<p class="eyebrow">MEASURED MODEL COMPARISON · ${escapeMarkup(dataset.capturedAt)}</p><h1>164-task model pass@1 comparison</h1><p class="lede">Same 164 code-completion tasks, same harness, pass@1, greedy decoding, temperature 0. Flywheel 14B was ${number(Math.abs(comparison.deltaPercentagePoints), 2)} percentage points lower. McNemar p=${number(comparison.mcnemar.pValue, 3)}; the observed difference was not statistically significant at 0.05.</p><div class="figure-scroll" tabindex="0" aria-label="Scrollable model comparison">${svg}</div><div class="table-wrap"><table><caption>Text equivalent for both model results.</caption><thead><tr><th>Model role</th><th>Model reference</th><th>Passed / n</th><th>Pass@1</th></tr></thead><tbody>${tableRows}</tbody></table></div><dl class="scope"><dt>Source</dt><dd>${source}</dd><dt>Source SHA-256</dt><dd><code>${escapeMarkup(comparison.sourceSha256)}</code></dd><dt>Paired outcomes</dt><dd>${comparison.paired.gains_flywheel_pass_base_fail} gains; ${comparison.paired.regressions_flywheel_fail_base_pass} regressions; ${comparison.paired.both_pass} both pass; ${comparison.paired.both_fail} both fail</dd><dt>McNemar test</dt><dd>continuity-corrected χ²=${number(comparison.mcnemar.chiSquareContinuityCorrected, 3)}, p=${number(comparison.mcnemar.pValue, 3)}, significant at 0.05: ${comparison.mcnemar.significantAt005 ? "yes" : "no"}</dd><dt>Limitations</dt><dd>${escapeMarkup(comparison.limitations.join(" "))}</dd></dl><p class="does-not-prove"><strong>What this does not prove:</strong> ${escapeMarkup(comparison.doesNotProve)}</p>`);
  return { svg, html, companion: { renderer: "zentropy-portfolio-analytics/v2", figure: { id: "model-pass-at-1-comparison", kind: "paired-model-comparison", sourceSha256: comparison.sourceSha256, units: ["pass@1", "passed tasks", "percentage points", "McNemar p-value"], denominator: comparison.denominator, retrievedAt: dataset.capturedAt, uncertainty: comparison.limitations, doesNotProve: comparison.doesNotProve, data: comparison } } };
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
  const trackX = 300;
  const trackW = 440;
  const svgRows = roles.map((role, index) => {
    const y = 176 + index * 74;
    const readableW = Math.round(trackW * ratio(role.readable, role.attempts));
    const passedW = Math.round(trackW * ratio(role.passed, role.attempts));
    const median = duration(role.latencyMsMedian);
    const foot = [median ? `median ${median}` : "latency unmeasured", role.modelsObserved.length ? role.modelsObserved.join(", ") : "no model observed"].join(" · ");
    const label = `${role.role}: ${role.readable} of ${role.attempts} readable, ${role.passed} passed, ${foot}`;
    // A zero-width bar and an unmeasured one look identical, so the counts are
    // printed beside every track rather than left to the fill to imply.
    const readable = readableW ? `<rect x="${trackX}" y="${y - 20}" width="${readableW}" height="22" rx="4" fill="#9fc2c7"/>` : "";
    const passed = passedW ? `<rect x="${trackX}" y="${y - 20}" width="${passedW}" height="22" rx="4" fill="#8be4cf"/>` : "";
    return `<g role="graphics-symbol" tabindex="0" aria-label="${escapeMarkup(label)}"><rect class="focus-ring" x="38" y="${y - 34}" width="1044" height="58" rx="8" fill="#0d1519" stroke="#33484e"/><text x="56" y="${y - 4}" font-size="18" font-weight="700">${escapeMarkup(role.role)}</text><text x="56" y="${y + 18}" class="mono muted" font-size="13">${escapeMarkup(foot)}</text><rect x="${trackX}" y="${y - 20}" width="${trackW}" height="22" rx="4" fill="#1b3035"/>${readable}${passed}<text x="${trackX + trackW + 18}" y="${y - 3}" class="mono" font-size="14">${role.readable}/${role.attempts} readable</text><text x="${trackX + trackW + 18}" y="${y + 18}" class="mono muted" font-size="13">${role.passed} passed</text></g>`;
  }).join("\n");
  const svgHeight = 176 + roles.length * 74 + 64;
  const svg = `<svg role="img" xmlns="http://www.w3.org/2000/svg" width="1120" height="${svgHeight}" viewBox="0 0 1120 ${svgHeight}" aria-labelledby="pilot-title pilot-desc"><title id="pilot-title">Cross-harness run across ${counts.roles} harness roles</title><desc id="pilot-desc">${escapeMarkup(headline)}. On each task the prompt and runtime context every role received were ${escapeMarkup(companion.parity.prompt)}. The pale bar is how many attempts reached a grader and the bright bar is how many passed. Durations are wall clock on one machine and are not a speed ranking.</desc><style>text{font-family:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#eef6f6}.mono{font-family:"Conso","JetBrains Mono",ui-monospace,monospace}.muted{fill:#bcd0d4}g:focus{outline:none}g:focus-visible .focus-ring{stroke:#fff;stroke-width:4}</style><rect width="1120" height="${svgHeight}" fill="#070c0f"/><text x="42" y="44" font-size="25" font-weight="700">Cross-harness run across ${counts.roles} harness roles</text><text x="42" y="76" class="mono muted" font-size="15">${escapeMarkup(headline)}</text><text x="42" y="102" class="mono muted" font-size="13">${parityLine} · durations are wall clock on one machine</text><g><rect x="42" y="120" width="14" height="14" rx="3" fill="#9fc2c7"/><text x="64" y="132" class="mono muted" font-size="13">reached a grader</text><rect x="216" y="120" width="14" height="14" rx="3" fill="#8be4cf"/><text x="238" y="132" class="mono muted" font-size="13">passed</text></g>${svgRows}<text x="42" y="${svgHeight - 22}" class="mono muted" font-size="13">${escapeMarkup(companion.capturedAt)} · not market performance · not a quality ranking</text></svg>`;

  const roleRows = roles.map((role) => `<tr><th scope="row">${escapeMarkup(role.role)}<br><span class="status">${escapeMarkup(role.modelsObserved.join(", ") || "no model observed")}</span></th><td>${role.launched}/${role.attempts}</td><td>${role.readable}/${role.attempts}</td><td>${role.passed}</td><td>${duration(role.latencyMsMedian) ?? unknown("latency unmeasured")}</td><td>${duration(role.latencyMsP90) ?? unknown("latency unmeasured")}</td><td>${roleCost(role)}</td></tr>`).join("");
  const ungradedRows = roles.filter((role) => ungradedText(role)).map((role) => `<tr><th scope="row">${escapeMarkup(role.role)}</th><td>${escapeMarkup(ungradedText(role))}.</td><td>${escapeMarkup(recoveryText(role)) || "not probed"}</td></tr>`).join("");
  const parityRows = companion.parityArtifacts.map((artifact) => `<tr><th scope="row">${escapeMarkup(artifact.taskId)}</th><td><code>${artifact.prompt.sha256.join("</code><br><code>")}</code></td><td><code>${artifact.runtimeContext.sha256.join("</code><br><code>")}</code></td><td>${artifact.identicalAcrossRoles ? `yes, across ${artifact.roles} roles` : "no"}</td></tr>`).join("");
  const receiptRows = receipts.records.map((record) => `<tr><th scope="row">${escapeMarkup(record.role)}<br><span class="status">${escapeMarkup(record.taskId)}</span></th><td>${escapeMarkup(record.state)}</td><td>${record.receiptSha256 ? `<code>${record.receiptSha256}</code>` : unknown("the receipt file is no longer on disk")}</td><td>${record.receiptSubjectSha256 ? `<code>${record.receiptSubjectSha256}</code>` : unknown("no subject hash retained")}</td></tr>`).join("");
  const hashRows = Object.entries(companion.artifactHashes).map(([name, sha256]) => `<tr><th scope="row">${escapeMarkup(name)}</th><td><code>${sha256}</code></td></tr>`).join("");
  const checkerBlocks = companion.checkers.map((checker) => {
    const heading = `<h3>${escapeMarkup(checker.checker_id)}</h3><p class="status">${escapeMarkup(checker.task_ids.join(", "))} · ${checker.scored_attempts} scored attempt${checker.scored_attempts === 1 ? "" : "s"}</p>`;
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

  const html = page(`Cross-harness run across ${counts.roles} harness roles`, `<p class="record-label">Current cross-harness run · ${escapeMarkup(companion.capturedAt)}</p><h1>Cross-harness run across ${counts.roles} harness roles</h1><p class="notice"><strong>Verdict:</strong> ${escapeMarkup(headline)}. This is one repetition per task on one machine. It is not market performance and not a quality ranking.</p><p class="lede">${counts.roles} harness roles ran the same ${counts.tasks} tasks from the same task set. On every one of those tasks the prompt bytes and the runtime-context bytes each role received were ${escapeMarkup(companion.parity.prompt)}, so what differs between the rows is the harness and the model behind it. ${counts.readable} of ${counts.attempts} attempts produced something a checker could read, and why the rest did not is reported beside each row rather than left inside the rate.</p><div class="figure-scroll" tabindex="0" aria-label="Scrollable cross-harness run figure">${svg}</div><div class="table-wrap"><table><caption>Outcome and cost for each harness role, with its own denominator.</caption><thead><tr><th>Role and observed model</th><th>Launched</th><th>Reached a grader</th><th>Passed</th><th>Median latency</th><th>p90 latency</th><th>Cost</th></tr></thead><tbody>${roleRows}</tbody></table></div><h2>Why an attempt went ungraded</h2><p>A malformed answer and a missing one are different failures, so each is named. An attempt that never returned a readable result has no quality numbers here, which is a fact about this run and not a score of zero.</p><div class="table-wrap"><table><caption>Ungraded attempts by reason, and whether a refused answer still held one.</caption><thead><tr><th>Role</th><th>Reasons</th><th>Envelope recovery</th></tr></thead><tbody>${ungradedRows}</tbody></table></div><h2>Graded quality metrics</h2><p>Each checker graded the attempts that reached it. A mean over one repetition is a reading and not an estimate, so no interval is reported.</p>${checkerBlocks}<h2>Prompt and context parity</h2><div class="table-wrap"><table><caption>Prompt and runtime-context hashes for each task, across all roles.</caption><thead><tr><th>Task</th><th>Prompt SHA-256</th><th>Runtime context SHA-256</th><th>Equal across roles</th></tr></thead><tbody>${parityRows}</tbody></table></div><dl class="scope"><dt>Benchmark code</dt><dd><a href="${escapeMarkup(companion.sourceCommitUrl)}"><code>${escapeMarkup(companion.sourceCommit)}</code></a></dd><dt>Run identifier</dt><dd><code>${escapeMarkup(companion.runId)}</code></dd><dt>Task set</dt><dd><code>${escapeMarkup(companion.taskSetId)}</code></dd><dt>Public result source</dt><dd><a href="${escapeMarkup(companion.sourceEvidence.href)}">Sanitized source record</a> · <code>${companion.sourceEvidence.sha256}</code></dd><dt>Evidence availability</dt><dd>${escapeMarkup(companion.evidenceAvailability)}; raw attempt outputs remain private and are represented here by hashes and sanitized receipt records.</dd><dt>Source tree state</dt><dd>${treeNote}</dd><dt>Resource use</dt><dd class="unknown">Unknown: CPU, memory, GPU, and energy observations unavailable</dd></dl><h2>Sanitized receipt records</h2><p>Every attempt carries a receipt whose subject hash names the artifacts it produced. ${receipts.verified} of ${receipts.attempts} verified on re-check; any other state is printed as it was recorded.</p><div class="table-wrap"><table><caption>Public receipt and receipt-subject identities for all ${receipts.attempts} attempts.</caption><thead><tr><th>Role and task</th><th>State</th><th>Receipt SHA-256</th><th>Subject SHA-256</th></tr></thead><tbody>${receiptRows}</tbody></table></div><h2>Artifact hashes</h2><div class="table-wrap"><table><caption>SHA-256 identities for the operator-local run artifacts.</caption><thead><tr><th>Artifact</th><th>SHA-256</th></tr></thead><tbody>${hashRows}</tbody></table></div><h2>Limitations</h2><ul>${companion.limitations.map((item) => `<li>${escapeMarkup(item)}</li>`).join("")}</ul><p class="does-not-prove"><strong>What this does not prove:</strong> ${escapeMarkup(companion.doesNotProve)}</p>`);
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
