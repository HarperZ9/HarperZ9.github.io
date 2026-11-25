#!/usr/bin/env node
// Build architecture.html: the cohesive 5-platform architecture, interactive interoperability graph,
// verifiable dataset catalog (DS-01..DS-07), observed benchmark ledger, and repository consolidation map.
//
//   node scripts/build-architecture.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";
import { esc } from "./studies-markdown.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = JSON.parse(readFileSync(path.join(site, "site-src/world/architecture.json"), "utf8"));

// Distinct geometric marks per platform (colour is never the sole carrier; matches home supergraphic marks).
const ICONS = {
  playground: '<svg viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><path d="M14.8 14.8L43.9 4.9A39 39 0 0 1 4.9 43.9z" fill="currentColor"/><path d="M-14.8 14.8L-4.9 43.9A39 39 0 0 1 -43.9 4.9z" fill="currentColor"/><path d="M-14.8 -14.8L-43.9 -4.9A39 39 0 0 1 -4.9 -43.9z" fill="currentColor"/><path d="M14.8 -14.8L4.9 -43.9A39 39 0 0 1 43.9 -4.9z" fill="currentColor"/></svg>',
  buildlang: '<svg viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><rect x="-44" y="18" width="88" height="24" fill="currentColor"/><rect x="-30" y="-12" width="60" height="24" fill="currentColor"/><rect x="-16" y="-42" width="32" height="24" fill="currentColor"/></svg>',
  flywheel: '<svg viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><path d="M0,-10 A14,14 0 1,1 -14,6 A24,24 0 1,1 20,18 A36,36 0 1,1 -32,-18" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/><circle r="8" fill="currentColor"/></svg>',
  commons: '<svg viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><circle cx="-18" cy="-12" r="20" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="22" cy="-16" r="15" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="8" cy="22" r="14" fill="none" stroke="currentColor" stroke-width="7"/></svg>',
  research: '<svg viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><path d="M-24 -42h48" stroke="currentColor" stroke-width="11"/><path d="M0 -42L-38 22M0 -42L-20 36M0 -42L0 42M0 -42L20 36M0 -42L38 22" stroke="currentColor" stroke-width="8"/></svg>',
};

// Wide 860 x 470 viewBox so all 5 platform cards and 7 directed edge labels sit in clean whitespace with zero overlap.
const POS = {
  buildlang:  { x: 24,  y: 26,  w: 262, h: 108 },
  playground: { x: 574, y: 26,  w: 262, h: 108 },
  flywheel:   { x: 299, y: 181, w: 262, h: 108 },
  commons:    { x: 24,  y: 336, w: 262, h: 108 },
  research:   { x: 574, y: 336, w: 262, h: 108 },
};

// Exact boundary anchor routes (from box border to box border, never crossing through a node box).
const ROUTES = {
  "buildlang->playground": { d: "M 286 72 Q 430 40 568 72", lx: 430, ly: 48 },
  "playground->flywheel":  { d: "M 640 134 Q 590 198 566 212", lx: 676, ly: 158 },
  "buildlang->flywheel":   { d: "M 220 134 Q 270 198 294 212", lx: 184, ly: 158 },
  "commons->flywheel":     { d: "M 220 336 Q 270 272 294 258", lx: 184, ly: 312 },
  "flywheel->research":    { d: "M 561 258 Q 595 272 640 331", lx: 676, ly: 312 },
  "commons->research":     { d: "M 286 398 Q 430 430 568 398", lx: 430, ly: 422 },
  "research->playground":  { d: "M 776 336 Q 828 235 776 140", lx: 742, ly: 235 },
};

function edgeGeometry(e) {
  const key = `${e.from}->${e.to}`;
  if (ROUTES[key]) return ROUTES[key];
  const a = POS[e.from], b = POS[e.to];
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  return { d: `M ${ax} ${ay} L ${bx} ${by}`, lx: mx, ly: my };
}

function graphSection() {
  const buttons = [
    `<button type="button" class="graph-btn" data-graph-pick="all" aria-pressed="false">All flows</button>`,
    ...DATA.platforms.map((p, i) => `<button type="button" class="graph-btn" data-plat="${esc(p.hue)}" data-graph-pick="${esc(p.id)}" aria-pressed="${i === 0 ? "true" : "false"}">${ICONS[p.id]}<span>${esc(p.title)}</span></button>`),
  ].join("\n");

  const edgeSvg = DATA.edges.map((e) => {
    const { d, lx, ly } = edgeGeometry(e);
    const pillW = Math.max(96, Math.round(e.label.length * 6.8 + 18));
    return `<path class="arch-edge" data-graph-edge data-from="${esc(e.from)}" data-to="${esc(e.to)}" d="${d}" marker-end="url(#arch-arrow)"/>
<rect class="arch-edge-pill" data-graph-edge-pill data-from="${esc(e.from)}" data-to="${esc(e.to)}" x="${Math.round(lx - pillW / 2)}" y="${Math.round(ly - 11)}" width="${pillW}" height="20" rx="3"/>
<text class="arch-edge-label" data-graph-edge-label data-from="${esc(e.from)}" data-to="${esc(e.to)}" x="${lx}" y="${ly + 3}" text-anchor="middle">${esc(e.label)}</text>`;
  }).join("\n");

  const nodeSvg = DATA.platforms.map((p, i) => {
    const pos = POS[p.id];
    const nodeTitle = p.nodeTitle || p.title;
    return `<g class="arch-node${i === 0 ? " is-selected" : ""}" data-plat="${esc(p.hue)}" data-graph-node="${esc(p.id)}" role="button" tabindex="0" aria-pressed="${i === 0 ? "true" : "false"}" aria-label="${esc(p.title)} (${esc(p.mark)}): ${esc(p.short)}">
  <rect class="arch-node-box" x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="3"/>
  <g class="arch-node-icon" transform="translate(${pos.x + 28}, ${pos.y + 34}) scale(0.28)">${ICONS[p.id].replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>
  <text class="arch-node-mark" x="${pos.x + 52}" y="${pos.y + 27}">${esc(p.mark)}</text>
  <text class="arch-node-title" x="${pos.x + 52}" y="${pos.y + 47}">${esc(nodeTitle)}</text>
  <text class="arch-node-sub" x="${pos.x + 14}" y="${pos.y + 74}">${esc(p.short)}</text>
  <text class="arch-node-sub" x="${pos.x + 14}" y="${pos.y + 92}">${esc(p.repoLabel)}</text>
</g>`;
  }).join("\n");

  const p0 = DATA.platforms[0];
  const initialInspector = `<div class="graph-inspector" id="arch-inspector" data-plat="${esc(p0.hue)}" aria-live="polite">
  <h3>${ICONS[p0.id]}${esc(p0.title)}</h3>
  <p class="graph-inspector-mark">${esc(p0.mark)} / ${esc(p0.repoLabel)}</p>
  <p>${esc(p0.what)}</p>
  <dl class="graph-io">
    <dt>Consumes</dt><dd>${esc(p0.consumes)}</dd>
    <dt>Produces</dt><dd>${esc(p0.produces)}</dd>
    <dt>Interoperability contract</dt><dd>${esc(p0.contract)}</dd>
  </dl>
  <code class="graph-cmd">${esc(p0.run)}</code>
  <nav class="graph-links" aria-label="${esc(p0.title)} links">${p0.links.map(([h, t]) => `<a href="${esc(h)}">${esc(t)}</a>`).join("")}</nav>
  <p class="graph-verified"><b>Verified:</b> ${esc(p0.verified)}</p>
</div>`;

  const payload = JSON.stringify({ platforms: DATA.platforms, icons: ICONS }).replace(/</g, "\\u003c");
  return `<section class="arch-sec" id="graph" aria-labelledby="h-graph">
  <h2 id="h-graph"><span class="d-3d" data-hue="brass">System Architecture and Interoperability</span></h2>
  <p class="arch-sec-lede">Select any platform in the diagram or button row to trace what it consumes, what it produces, and how its receipts cross into the other platforms. With scripts off, all five platforms and every cross-platform flow remain listed in full below.</p>
  <div class="graph-shell">
    <div class="graph-stage">
      <div class="graph-controls" role="group" aria-label="Select platform flow">
        ${buttons}
      </div>
      <svg class="arch-svg" viewBox="0 0 860 470" role="img" aria-labelledby="arch-svg-title arch-svg-desc">
        <title id="arch-svg-title">Five-platform verification loop linking BuildLang, The Playground, The Flywheel, The Commons, and Research</title>
        <desc id="arch-svg-desc">A closed-loop hub diagram with The Flywheel in the centre and four platforms at the corners. BuildLang at top-left sends deterministic kcore math kernels right to The Playground and sends effect-row build hashes down-right into The Flywheel. The Playground at top-right sends SHA-256 engine-receipt/1 render proofs down-left into The Flywheel. The Commons at bottom-left sends claim provenance up-right into The Flywheel and sends the 43,380-item cross-domain archive right to Research. The Flywheel sends Three-Plate audit verdicts down-right to Research, and Research at bottom-right loops DS-03 and DS-04 calibration suites upward back into The Playground so verified benchmark findings govern subsequent engine runs.</desc>
        <defs>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor"/>
          </marker>
        </defs>
        ${edgeSvg}
        ${nodeSvg}
      </svg>
    </div>
    ${initialInspector}
  </div>
  <script type="application/json" id="arch-graph-data">${payload}</script>
</section>`;
}

function platformsSection() {
  const cards = DATA.platforms.map((p) => `<article class="plat-card" id="plat-${esc(p.id)}" data-plat="${esc(p.hue)}" aria-labelledby="hp-${esc(p.id)}">
  <div class="plat-card-head">
    <span class="plat-emblem">${ICONS[p.id]}</span>
    <div>
      <h3 id="hp-${esc(p.id)}">${esc(p.title)}</h3>
      <span class="plat-mark">${esc(p.mark)}</span>
    </div>
  </div>
  <p class="plat-what">${esc(p.what)}</p>
  <ul class="plat-parts">${p.parts.map(([name, desc]) => `<li><b>${esc(name)}:</b> ${esc(desc)}</li>`).join("")}</ul>
  <pre class="plat-run"><code>${esc(p.run)}</code></pre>
  <nav class="plat-links" aria-label="${esc(p.title)} pages and source">${p.links.map(([h, t]) => `<a href="${esc(h)}">${esc(t)}</a>`).join("")}</nav>
  <p class="plat-verified"><b>Verified:</b> ${esc(p.verified)}</p>
</article>`).join("\n");

  return `<section class="arch-sec" id="platforms" aria-labelledby="h-platforms">
  <h2 id="h-platforms"><span class="d-3d" data-hue="theplygrnd">Five Unified Platforms</span></h2>
  <p class="arch-sec-lede">Standalone tools and experiments have been consolidated into five super-project homes so shared checks, kernels, and releases stay in one tree.</p>
  <div class="plat-grid">${cards}</div>
</section>`;
}

function datasetsSection() {
  const filters = [
    ["all", "All seven"],
    ["theplygrnd", "The Playground"],
    ["bldlng", "BuildLang"],
    ["theflywheel", "The Flywheel"],
    ["thecmmns", "The Commons"],
    ["rsrch", "Research"],
  ];
  const filterButtons = filters.map(([k, lbl], i) => `<button type="button" class="arch-filter-btn" data-ds-filter="${esc(k)}" aria-pressed="${i === 0 ? "true" : "false"}">${esc(lbl)}</button>`).join("");
  const rows = DATA.datasets.map((d) => `<tr data-ds-row data-ds-platform="${esc(d.platforms.join(" "))}">
  <th scope="row"><code>${esc(d.id)}</code></th>
  <td data-label="Dataset and purpose"><b>${esc(d.name)}</b><br>${esc(d.what)}</td>
  <td data-label="Platform"><span class="arch-tag" data-plat="${esc(d.hue)}">${esc(d.platformLabel)}</span></td>
  <td data-label="Oracle">${esc(d.oracle)}</td>
  <td data-label="Observed result" class="num">${esc(d.observed)}</td>
  <td data-label="Status"><span class="arch-badge" data-verdict="${esc(d.verdict)}">${esc(d.verdictLabel)}</span></td>
</tr>`).join("\n");

  return `<section class="arch-sec" id="datasets" aria-labelledby="h-datasets">
  <h2 id="h-datasets"><span class="d-3d" data-hue="rsrch">Seven Open Verifiable Datasets (DS-01 to DS-07)</span></h2>
  <p class="arch-sec-lede">Each dataset pairs structured records with an executable oracle and a privacy scrub before export. Rows carry measured counts and verdicts from the verification runs, with honest scope limits kept visible.</p>
  <div class="arch-filter-bar" role="group" aria-label="Filter datasets by platform">
    ${filterButtons}
    <span class="arch-filter-status" id="ds-filter-status" aria-live="polite">${DATA.datasets.length} of ${DATA.datasets.length} datasets shown</span>
  </div>
  <div class="arch-table-wrap" tabindex="0" role="region" aria-label="Verifiable datasets table">
    <table class="arch-table">
      <thead><tr><th scope="col">ID</th><th scope="col">Dataset and purpose</th><th scope="col">Platform</th><th scope="col">Oracle</th><th scope="col">Observed result</th><th scope="col">Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="verified"><b>Verified</b> ${esc(DATA.datasetsVerified)}</p>
</section>`;
}

function benchmarksSection() {
  const rows = DATA.benchmarks.map((b) => `<tr>
  <th scope="row">${esc(b.surface)}</th>
  <td data-label="Platform"><span class="arch-tag" data-plat="${esc(b.hue)}">${esc(b.platform)}</span></td>
  <td data-label="What was checked">${esc(b.check)}</td>
  <td data-label="Observed result" class="num">${esc(b.result)}</td>
  <td data-label="Verdict"><span class="arch-badge" data-verdict="${esc(b.verdict)}">${esc(b.verdictLabel)}</span></td>
  <td data-label="Open gap or limit">${esc(b.gap)}</td>
</tr>`).join("\n");

  return `<section class="arch-sec" id="benchmarks" aria-labelledby="h-benchmarks">
  <h2 id="h-benchmarks"><span class="d-3d" data-hue="theflywheel">Observed Benchmarks and Honest Gaps</span></h2>
  <p class="arch-sec-lede">Every figure below comes directly from a recorded run of the test suite, renderer, or oracle. Open gaps and known failures stay on the table beside passing runs.</p>
  <div class="arch-table-wrap" tabindex="0" role="region" aria-label="Observed benchmarks and open gaps">
    <table class="arch-table">
      <thead><tr><th scope="col">Surface</th><th scope="col">Platform</th><th scope="col">What was checked</th><th scope="col">Observed result</th><th scope="col">Verdict</th><th scope="col">Open gap or limit</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="arch-gap"><b>Honest nulls and open work:</b> ${esc(DATA.honestGaps)}</p>
</section>`;
}

function consolidationSection() {
  const rows = DATA.consolidation.map((c) => `<tr>
  <th scope="row"><code>${esc(c.oldRepo)}</code></th>
  <td data-label="Live super-project home"><a href="${esc(c.liveUrl)}"><code>${esc(c.livePath)}</code></a></td>
  <td data-label="Platform"><span class="arch-tag" data-plat="${esc(c.hue)}">${esc(c.platform)}</span></td>
  <td data-label="State">${esc(c.status)}</td>
</tr>`).join("\n");

  return `<section class="arch-sec" id="consolidation" aria-labelledby="h-consolidation">
  <h2 id="h-consolidation"><span class="d-3d" data-hue="bldlng">Repository Consolidation Map</span></h2>
  <p class="arch-sec-lede">${esc(DATA.consolidationLede)}</p>
  <div class="arch-table-wrap" tabindex="0" role="region" aria-label="Consolidated repositories and live monorepo homes">
    <table class="arch-table">
      <thead><tr><th scope="col">Former standalone repo</th><th scope="col">Live super-project home</th><th scope="col">Platform</th><th scope="col">State</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</section>`;
}

function build() {
  const stats = DATA.stats.map((s) => `<li class="arch-stat"><span class="arch-stat-num">${esc(s.value)}</span><span class="arch-stat-lbl">${esc(s.label)}</span></li>`).join("");

  const body = `<article class="arch" data-arch-root>
  <header class="arch-head">
    <h1 id="h-arch"><span class="d-3d" data-hue="brass">${esc(DATA.title)}</span></h1>
    <p class="arch-lede">${esc(DATA.lede)}</p>
    <p class="arch-sub">${esc(DATA.sub)}</p>
    <nav class="arch-ways" aria-label="On this page">
      <a href="#graph">Architecture graph</a>
      <a href="#platforms">Five platforms</a>
      <a href="#datasets">Seven datasets</a>
      <a href="#benchmarks">Observed benchmarks</a>
      <a href="#consolidation">Consolidation map</a>
    </nav>
    <ul class="arch-stats" aria-label="Current platform snapshot">${stats}</ul>
  </header>
  ${graphSection()}
  ${platformsSection()}
  ${datasetsSection()}
  ${benchmarksSection()}
  ${consolidationSection()}
  <p class="verified"><b>Verified</b> ${esc(DATA.pageVerified)}</p>
  <nav class="arch-foot-nav" aria-label="Continue exploring">
    <a href="/">Home</a>
    <a href="/playground/">The Playground</a>
    <a href="/buildlang.html">BuildLang</a>
    <a href="/flywheel.html">Flywheel</a>
    <a href="/cmmns.html">CMMNS</a>
    <a href="/articulate.html">Articulate</a>
    <a href="/estuary.html">Estuary Lantern</a>
    <a href="/floor.html">Everything</a>
  </nav>
</article>`;

  const html = page({
    path: "architecture.html",
    title: "Platform Architecture",
    description: DATA.description,
    body,
    bodyClass: "reading arch-page",
    extraHead: '<link rel="stylesheet" href="/world/site/architecture.css">\n<script type="module" src="/world/site/architecture.js"></script>',
  });

  if (DATA.description.length < 40 || DATA.description.length > 160) {
    throw new Error(`architecture: meta description length ${DATA.description.length} outside 40..160`);
  }
  if (/[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|SteamLibrary)/.test(html) || html.includes("\u2014")) {
    throw new Error("architecture: a local path or an em dash reached the page");
  }
  if (/zentropy/i.test(html)) {
    throw new Error("architecture: retired name reached the page");
  }
  writeFileSync(path.join(site, "architecture.html"), html);
  console.log("architecture: architecture.html built");
}

build();
