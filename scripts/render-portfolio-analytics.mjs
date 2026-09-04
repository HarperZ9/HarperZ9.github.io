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

function currentCrossHarnessPilot(sourceRecord, sourceDocumentSha256) {
  if (sourceRecord.schema !== "zentropy-current-cross-harness-pilot-source/v1") {
    throw new Error(`unsupported current pilot source schema: ${sourceRecord.schema}`);
  }
  if (sourceRecord.receipts?.records?.length !== sourceRecord.receipts?.attempts) {
    throw new Error("current pilot receipt records do not match the declared attempt denominator");
  }
  if (!sourceRecord.receipts.records.every((record) => record.state === "verified" && /^[a-f0-9]{64}$/.test(record.receiptSha256) && /^[a-f0-9]{64}$/.test(record.receiptSubjectSha256))) {
    throw new Error("current pilot receipt record is incomplete or unverified");
  }
  if (!Object.values(sourceRecord.artifactHashes).every((sha256) => /^[a-f0-9]{64}$/.test(sha256))) {
    throw new Error("current pilot artifact hash is invalid");
  }
  const companion = {
    ...sourceRecord,
    schema: "zentropy-current-cross-harness-pilot/v1",
    sourceEvidence: {
      href: "source/current-cross-harness-pilot-source.json",
      sha256: sourceDocumentSha256,
      availability: sourceRecord.evidenceAvailability,
    },
  };

  const svgRows = companion.attempts.map((attempt, index) => {
    const y = 156 + index * 72;
    return `<g role="graphics-symbol" tabindex="0" aria-label="${escapeMarkup(attempt.route)}, ${escapeMarkup(attempt.taskId)}, ${number(attempt.latencyMs, 0)} milliseconds, ${escapeMarkup(attempt.execution)}, oracle ${escapeMarkup(attempt.oracle)}, receipt verified"><rect class="focus-ring" x="38" y="${y - 34}" width="1044" height="58" rx="8" fill="#0d1519" stroke="#33484e"/><text x="56" y="${y - 8}" font-size="18" font-weight="700">${escapeMarkup(attempt.route)}</text><text x="250" y="${y - 8}" class="mono muted" font-size="14">${escapeMarkup(attempt.taskId)}</text><text x="780" y="${y - 8}" font-size="16">${number(attempt.latencyMs, 0)} ms</text><text x="56" y="${y + 14}" class="mono muted" font-size="13">Execution ${escapeMarkup(attempt.execution)} · oracle ${escapeMarkup(attempt.oracle)} · receipt verified</text></g>`;
  }).join("\n");
  const svg = `<svg role="img" xmlns="http://www.w3.org/2000/svg" width="1120" height="480" viewBox="0 0 1120 480" aria-labelledby="pilot-title pilot-desc"><title id="pilot-title">Current cross-harness integration-failure profile</title><desc id="pilot-desc">Four receipt-verified attempts received byte-identical prompts and runtime contexts by task. No attempt produced a valid comparable task outcome. Durations are diagnostic only and are not a speed ranking.</desc><style>text{font-family:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#eef6f6}.mono{font-family:"Conso","JetBrains Mono",ui-monospace,monospace}.muted{fill:#bcd0d4}g:focus{outline:none}g:focus-visible .focus-ring{stroke:#fff;stroke-width:4}</style><rect width="1120" height="480" fill="#070c0f"/><text x="42" y="44" font-size="25" font-weight="700">Current cross-harness integration-failure profile</text><text x="42" y="76" class="mono muted" font-size="15">4/4 verified receipts · 0 valid comparable task outcomes</text><text x="42" y="102" class="mono muted" font-size="13">Byte-identical prompt and context parity · durations are diagnostic only</text>${svgRows}<text x="42" y="458" class="mono muted" font-size="13">2026-08-28 · not market performance · not a quality ranking</text></svg>`;

  const attemptRows = companion.attempts.map((attempt) => `<tr><th scope="row">${escapeMarkup(attempt.route)}<br><span class="status">${escapeMarkup(attempt.taskId)}</span></th><td>${number(attempt.latencyMs, 0)} ms</td><td>${escapeMarkup(attempt.execution)}</td><td>${escapeMarkup(attempt.oracle)}</td><td>${escapeMarkup(attempt.receipt)}</td><td>${escapeMarkup(attempt.detail)}</td></tr>`).join("");
  const parityRows = companion.parityArtifacts.map((artifact) => `<tr><th scope="row">${escapeMarkup(artifact.taskId)}</th><td><code>${artifact.prompt.sha256}</code><br>${number(artifact.prompt.bytes, 0)} bytes</td><td><code>${artifact.runtimeContext.sha256}</code><br>${number(artifact.runtimeContext.bytes, 0)} bytes</td><td>yes</td></tr>`).join("");
  const receiptRows = companion.receipts.records.map((record) => `<tr><th scope="row">${escapeMarkup(record.route)}<br><span class="status">${escapeMarkup(record.taskId)}</span></th><td>${escapeMarkup(record.state)}</td><td><code>${record.receiptSha256}</code></td><td><code>${record.receiptSubjectSha256}</code></td></tr>`).join("");
  const hashRows = Object.entries(companion.artifactHashes).map(([name, sha256]) => `<tr><th scope="row">${escapeMarkup(name)}</th><td><code>${sha256}</code></td></tr>`).join("");
  const html = page("Current cross-harness integration-failure profile", `<p class="record-label">Current integration-failure profile · ${escapeMarkup(companion.capturedAt)}</p><h1>Current cross-harness integration-failure profile</h1><p class="notice"><strong>Verdict:</strong> 4/4 receipts verified; 0 valid comparable task outcomes. This is an integration-failure profile, not market performance and not a quality ranking.</p><p class="lede">Codex direct and Flywheel on Codex received byte-identical task prompts and byte-identical role-neutral runtime contexts for each task. The four durations below are diagnostic only because no attempt completed with an oracle pass.</p><div class="figure-scroll" tabindex="0" aria-label="Scrollable current integration-failure profile">${svg}</div><div class="table-wrap"><table><caption>Exact outcomes for all four attempts.</caption><thead><tr><th>Route and task</th><th>Duration</th><th>Execution</th><th>Oracle</th><th>Receipt</th><th>Exact result</th></tr></thead><tbody>${attemptRows}</tbody></table></div><h2>Byte-identical prompt and context parity</h2><div class="table-wrap"><table><caption>Hashes and byte counts match across the two routes for each task.</caption><thead><tr><th>Task</th><th>Prompt SHA-256 and bytes</th><th>Runtime context SHA-256 and bytes</th><th>Equal across routes</th></tr></thead><tbody>${parityRows}</tbody></table></div><dl class="scope"><dt>Benchmark code</dt><dd><a href="${escapeMarkup(companion.sourceCommitUrl)}"><code>${companion.sourceCommit}</code></a></dd><dt>Public result source</dt><dd><a href="${escapeMarkup(companion.sourceEvidence.href)}">Sanitized source record</a> · <code>${companion.sourceEvidence.sha256}</code></dd><dt>Evidence availability</dt><dd>${escapeMarkup(companion.evidenceAvailability)}; raw attempt artifacts remain private and are represented here by hashes and sanitized receipt records.</dd><dt>Requested model</dt><dd>${companion.requestedModelReference}</dd><dt>Observed model identity</dt><dd class="unknown">Unknown: requested registry reference was not provider-observed</dd><dt>Cost</dt><dd class="unknown">Unknown: provider cost unavailable</dd><dt>Resource use</dt><dd class="unknown">Unknown: CPU, memory, GPU, and energy observations unavailable</dd></dl><h2>Sanitized receipt records</h2><div class="table-wrap"><table><caption>Public receipt and receipt-subject identities for all four attempts.</caption><thead><tr><th>Route and task</th><th>State</th><th>Receipt SHA-256</th><th>Subject SHA-256</th></tr></thead><tbody>${receiptRows}</tbody></table></div><h2>Artifact hashes</h2><div class="table-wrap"><table><caption>SHA-256 identities for the operator-local receipt-bearing run artifacts.</caption><thead><tr><th>Artifact</th><th>SHA-256</th></tr></thead><tbody>${hashRows}</tbody></table></div><h2>Limitations</h2><ul>${companion.limitations.map((item) => `<li>${escapeMarkup(item)}</li>`).join("")}</ul><p class="does-not-prove"><strong>What this does not prove:</strong> ${escapeMarkup(companion.doesNotProve)}</p>`);
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
