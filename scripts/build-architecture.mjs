#!/usr/bin/env node
// Build architecture.html: the unified functional showcase of the full body of work:
// 5-platform interactive architecture graph, Full Body of Work launcher, 6 Project Family Trees
// & monthly evolution, 14 Global-Frontier engineering lanes, Computed Concept & Reference Web
// + 50 thinkers, 7 open verifiable datasets (DS-01..DS-07), observed benchmarks, and repo consolidation map.
//
//   node scripts/build-architecture.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";
import { esc } from "./studies-markdown.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readJson = (rel) => JSON.parse(readFileSync(path.join(site, rel), "utf8"));

const DATA = readJson("site-src/world/architecture.json");
const BODY = readJson("site-src/world/body-of-work.json");
const TREES = readJson("site-src/world/family-trees.json");
const FRONTIER = readJson("site-src/world/frontier-14.json");
const CWEB = readJson("site-src/world/concept-web.json");

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

const ROUTES = {
  "buildlang->playground": { d: "M 286 72 Q 430 40 568 72", lx: 430, ly: 48 },
  "playground->flywheel":  { d: "M 640 134 Q 590 198 566 212", lx: 676, ly: 158 },
  "buildlang->flywheel":   { d: "M 220 134 Q 270 198 294 212", lx: 184, ly: 158 },
  "commons->flywheel":     { d: "M 220 336 Q 270 272 294 258", lx: 184, ly: 312 },
  "flywheel->research":    { d: "M 561 258 Q 595 272 640 331", lx: 676, ly: 312 },
  "commons->research":     { d: "M 286 398 Q 430 430 568 398", lx: 430, ly: 422 },
  "research->playground":  { d: "M 776 336 Q 828 235 776 140", lx: 742, ly: 235 },
};

const fmtNum = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : String(n ?? ""));

function edgeGeometry(e) {
  const key = `${e.from}->${e.to}`;
  if (ROUTES[key]) return ROUTES[key];
  const a = POS[e.from], b = POS[e.to];
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
  return { d: `M ${ax} ${ay} L ${bx} ${by}`, lx: (ax + bx) / 2, ly: (ay + by) / 2 };
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

function bodyOfWorkSection() {
  const cats = [
    ["all", `All (${BODY.items.length})`],
    ["flagship", "Flagships"],
    ["tools", "Tools & Packages"],
    ["creative", "Games, Mods & Creative"],
    ["instruments", "Scientific Instruments"],
    ["security", "Security & Hardware"],
  ];
  const catButtons = cats.map(([k, lbl], i) => `<button type="button" class="arch-filter-btn" data-bow-cat="${esc(k)}" aria-pressed="${i === 0 ? "true" : "false"}">${esc(lbl)}</button>`).join("");

  const cards = BODY.items.map((it) => {
    const searchHay = `${it.name} ${it.categoryLabel} ${it.flagship} ${it.lang} ${it.summary} ${it.run}`.toLowerCase();
    const metrics = [
      it.loc ? `${fmtNum(it.loc)} LOC` : "",
      it.test_files ? `${fmtNum(it.test_files)} test files` : "",
      it.lang || "",
    ].filter(Boolean).join(" / ");
    const runHtml = it.run
      ? `<div class="bow-cmd-row"><code class="bow-cmd">${esc(it.run)}</code><button type="button" class="arch-copy-btn" data-copy="${esc(it.run)}" aria-label="Copy run command for ${esc(it.name)}">Copy</button></div>`
      : "";
    const linksHtml = it.links.length
      ? `<nav class="bow-links" aria-label="${esc(it.name)} links">${it.links.map(([h, t]) => `<a href="${esc(h)}">${esc(t)}</a>`).join("")}</nav>`
      : "";
    const gapHtml = it.gap ? `<p class="bow-gap"><b>Open gap:</b> ${esc(it.gap)}</p>` : "";
    return `<article class="bow-card" data-bow-card data-bow-cat="${esc(it.category)}" data-bow-search="${esc(searchHay)}" data-plat="${esc(it.hue)}">
  <div class="bow-card-top">
    <h3>${esc(it.name)}</h3>
    <span class="arch-tag" data-plat="${esc(it.hue)}">${esc(it.categoryLabel)}</span>
  </div>
  ${metrics ? `<p class="bow-meta">${esc(metrics)}</p>` : ""}
  <p class="bow-summary">${esc(it.summary)}</p>
  ${runHtml}
  ${linksHtml}
  ${gapHtml}
</article>`;
  }).join("\n");

  const ossRows = BODY.oss_highlights.map((p) => `<li><a href="${esc(p.url)}"><code>${esc(p.repo)}</code></a> (${esc(p.merged_date)}): ${esc(p.title)}</li>`).join("\n");
  const pkgChips = BODY.packages.map((p) => `<a class="pkg-chip" href="${esc(p.url)}"><code>${esc(p.name)}</code> <span>${esc(p.registry)} ${esc(p.version)}</span></a>`).join("\n");

  return `<section class="arch-sec" id="body-of-work" aria-labelledby="h-bow">
  <h2 id="h-bow"><span class="d-3d" data-hue="artiql8">Full Body of Work Launcher</span></h2>
  <p class="arch-sec-lede">${esc(BODY.vision || "Every flagship platform, consolidated tool, game, shader mod, scientific instrument, and hardware utility in one searchable launcher, with runnable commands, live site demos, and explicit open gaps.")}</p>
  <div class="arch-toolbar">
    <label class="arch-search-wrap" for="bow-search">
      <span class="arch-search-lbl">Filter tools, games, instruments, or languages</span>
      <input id="bow-search" class="arch-search" type="search" placeholder="Search e.g. Elder ENB, Calibrate Pro, BDB, Articulate, Rust, DX12..." autocomplete="off">
    </label>
    <div class="arch-filter-bar" role="group" aria-label="Filter body of work by category">
      ${catButtons}
      <span class="arch-filter-status" id="bow-status" aria-live="polite">${BODY.items.length} of ${BODY.items.length} projects shown</span>
    </div>
  </div>
  <div class="bow-grid" id="bow-grid">${cards}</div>
  <div class="bow-extras">
    <details class="arch-drawer">
      <summary>Accepted external open-source pull requests (${BODY.summary.oss_merged} merged across ${BODY.summary.oss_repos} repositories)</summary>
      <div class="arch-drawer-body">
        <p>Selected merged contributions (full 82-PR census on <a href="/portfolio.html">Portfolio</a>, including <code>python-grimp/grimp</code> PRs #303, #304, and #305):</p>
        <ul class="bow-oss-list">${ossRows}</ul>
      </div>
    </details>
    <details class="arch-drawer">
      <summary>Published registry packages (${BODY.summary.packages} packages across PyPI, crates.io, npm, and GitHub Releases)</summary>
      <div class="arch-drawer-body">
        <div class="pkg-grid">${pkgChips}</div>
      </div>
    </details>
  </div>
  <p class="verified"><b>Verified</b> ${esc(BODY.verified)}</p>
</section>`;
}

function familyTreesSection() {
  const tabs = TREES.families.map((f, i) => `<button type="button" class="arch-filter-btn lineage-tab" role="tab" id="tab-${esc(f.id)}" aria-controls="panel-${esc(f.id)}" aria-selected="${i === 0 ? "true" : "false"}" data-lineage-tab="${esc(f.id)}" data-plat="${esc(f.hue)}">${esc(f.title.split(" (")[0])}</button>`).join("");

  const panels = TREES.families.map((f, i) => {
    const stages = f.maturation_stages.map((s) => `<li><span class="stage-era">${esc(s.era)}</span><div><b>${esc(s.stage)}</b><p>${esc(s.evidence)}</p></div></li>`).join("\n");
    const blocks = f.public_blocks.map((b) => `<a class="block-chip" href="${esc(b.url)}"><code>${esc(b.name)}</code> <span>${esc(b.created)} / ${esc(b.status)}</span></a>`).join("\n");
    const links = f.site_links.map(([h, t]) => `<a href="${esc(h)}">${esc(t)}</a>`).join("");
    return `<div class="lineage-panel" role="tabpanel" id="panel-${esc(f.id)}" aria-labelledby="tab-${esc(f.id)}" data-lineage-panel="${esc(f.id)}" data-plat="${esc(f.hue)}"${i === 0 ? "" : " hidden"}>
  <div class="lineage-head">
    <div>
      <h3>${esc(f.title)}</h3>
      <p class="lineage-meta"><a href="${esc(f.home_url)}"><code>${esc(f.home_repo)}</code></a> / ${fmtNum(f.sessions)} indexed sessions (${fmtNum(f.units)} units) / ${f.public_blocks.length} public building blocks</p>
    </div>
    <nav class="lineage-links" aria-label="${esc(f.title)} pages">${links}</nav>
  </div>
  <p class="lineage-origin">${esc(f.origin_story)}</p>
  <h4>Chronological maturation</h4>
  <ol class="stage-list">${stages}</ol>
  <h4>Public building blocks (merged tools point to live super-project homes)</h4>
  <div class="block-chips">${blocks}</div>
</div>`;
  }).join("\n");

  const months = TREES.monthly_evolution.map((m) => `<article class="month-card">
  <h3>${esc(m.month)}</h3>
  <p class="month-strands">${m.strands.map((s) => `<code>${esc(s)}</code>`).join(" ")}</p>
  <h4>Turning points</h4>
  <ul>${m.turning_points.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
  <h4>Course reversals & shifts</h4>
  <ul>${m.reversals.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
</article>`).join("\n");

  const distinctRows = (TREES.distinct_projects || []).map((dp) => `<tr>
  <th scope="row">${esc(dp.title)}</th>
  <td data-label="Origin date" class="num">${esc(dp.origin_date)}</td>
  <td data-label="Flagship home">${esc(dp.flagship)}</td>
  <td data-label="Indexed sessions" class="num">${fmtNum(dp.sessions)} sessions (${fmtNum(dp.units)} units)</td>
  <td data-label="Origin and maturation">${esc(dp.summary)}</td>
</tr>`).join("\n");

  return `<section class="arch-sec" id="lineage" aria-labelledby="h-lineage">
  <h2 id="h-lineage"><span class="d-3d" data-hue="theflywheel">Project Family Trees and Idea Evolution</span></h2>
  <p class="arch-sec-lede">None of the five platforms started as a monolith. Select a lineage below to trace how each system grew from discrete tools, shader craft, purple teaming, adversarial testing, and polemical essays into its current home.</p>
  <div class="lineage-tabs" role="tablist" aria-label="Select project family tree">${tabs}</div>
  <div class="lineage-panels">${panels}</div>
  <details class="arch-drawer">
    <summary>All ${(TREES.distinct_projects || []).length} distinct project histories (origin dates, session counts, and maturation arcs)</summary>
    <div class="arch-drawer-body">
      <div class="arch-table-wrap" tabindex="0" role="region" aria-label="Twelve distinct project histories">
        <table class="arch-table">
          <thead><tr><th scope="col">Project</th><th scope="col">Origin</th><th scope="col">Home</th><th scope="col">Sessions</th><th scope="col">Origin and maturation</th></tr></thead>
          <tbody>${distinctRows}</tbody>
        </table>
      </div>
    </div>
  </details>
  <details class="arch-drawer lineage-months">
    <summary>Monthly idea evolution and explicit course reversals (July to November 2026)</summary>
    <div class="arch-drawer-body"><div class="month-grid">${months}</div></div>
  </details>
  <p class="verified"><b>Verified</b> ${esc(TREES.verified)}</p>
</section>`;
}

function frontierSection() {
  const filters = [
    ["all", "All 14 lanes"],
    ["theplygrnd", "The Playground"],
    ["bldlng", "BuildLang"],
    ["theflywheel", "The Flywheel"],
    ["thecmmns", "The Commons & Site"],
    ["expansion", "Expansion Lanes (11-14)"],
  ];
  const buttons = filters.map(([k, lbl], i) => `<button type="button" class="arch-filter-btn" data-fr-filter="${esc(k)}" aria-pressed="${i === 0 ? "true" : "false"}">${esc(lbl)}</button>`).join("");

  const cards = FRONTIER.lanes.map((l, idx) => {
    const peers = l.competitors.map((c) => `<span class="peer-chip">${esc(c)}</span>`).join("");
    const srcs = l.sources.map((s) => `<li><a href="${esc(s.url)}">${esc(s.title)}</a> <span class="fr-src-meta">(${esc(s.venue)}, ${esc(s.published)})</span></li>`).join("");
    return `<details class="frontier-card" data-fr-card data-fr-groups="${esc(l.groups.join(" "))}" data-plat="${esc(l.hue)}"${idx < 2 ? " open" : ""}>
  <summary>
    <span class="fr-id">Lane ${String(l.lane_id).padStart(2, "0")}</span>
    <span class="fr-title">${esc(l.title)}</span>
    <span class="arch-tag" data-plat="${esc(l.hue)}">${esc(l.flagship)}</span>
  </summary>
  <div class="frontier-body">
    <div class="fr-peers"><b>Global frontier peers:</b> ${peers}</div>
    <div class="fr-cols">
      <div class="fr-box">
        <h3>[Observed] 2025-2026 breakthroughs</h3>
        <p>${esc(l.breakthroughs)}</p>
        <h3>[Observed] Peer bottlenecks</h3>
        <p>${esc(l.bottlenecks)}</p>
      </div>
      <div class="fr-box">
        <h3>[Observed] Our live baseline & open gaps</h3>
        <p>${esc(l.observed_baseline)}</p>
        <h3>[Proposed] Surpass architecture</h3>
        <p>${esc(l.surpass_angle)}</p>
      </div>
    </div>
    <p class="fr-gate"><b>[Proposed] Falsification gate:</b> ${esc(l.falsification_gate)}</p>
    ${srcs ? `<div class="fr-sources"><b>Verified primary sources:</b><ul>${srcs}</ul></div>` : ""}
  </div>
</details>`;
  }).join("\n");

  return `<section class="arch-sec" id="frontier" aria-labelledby="h-frontier">
  <h2 id="h-frontier"><span class="d-3d" data-hue="theplygrnd">14 Global-Frontier Engineering Lanes</span></h2>
  <p class="arch-sec-lede">Live 2025-2026 global benchmarks across all 14 domains (including AAAA rendering engines, interaction-net compilers, CAD/lens metrology, nuclear/fusion multiphysics, robotics/physical AI, and computational neuroscience). Every card separates observed live baselines from proposed surpass gates.</p>
  <div class="arch-filter-bar" role="group" aria-label="Filter frontier lanes">
    ${buttons}
    <button type="button" class="arch-filter-btn" id="fr-toggle-all" aria-pressed="false">Expand all</button>
    <span class="arch-filter-status" id="fr-status" aria-live="polite">${FRONTIER.lanes.length} of ${FRONTIER.lanes.length} lanes shown</span>
  </div>
  <div class="frontier-list" id="frontier-list">${cards}</div>
  <p class="verified"><b>Verified</b> ${esc(FRONTIER.verified)}</p>
</section>`;
}

function conceptWebSection() {
  const cs = CWEB.corpus_summary;
  // Build a clean two-column bipartite-style SVG diagram of the top 8 cross-flagship bridges
  // so every label sits in open space with zero collisions and clear curve description.
  const bridges = CWEB.top_cross_flagship_bridges.slice(0, 8);
  const leftIds = [];
  const rightIds = [];
  const labelMap = Object.fromEntries(CWEB.nodes.map((n) => [n.id, n]));
  for (const b of bridges) {
    if (!leftIds.includes(b.source)) leftIds.push(b.source);
    if (!rightIds.includes(b.target)) rightIds.push(b.target);
  }
  const shortLbl = (id) => {
    const lbl = (labelMap[id]?.label || id).replace(/\s*\([^)]*\)/g, "");
    return lbl.length > 34 ? lbl.slice(0, 32) + "..." : lbl;
  };
  const svgH = Math.max(leftIds.length, rightIds.length) * 56 + 44;
  const leftPos = Object.fromEntries(leftIds.map((id, i) => [id, { x: 16, y: 24 + i * 56, w: 290, h: 42 }]));
  const rightPos = Object.fromEntries(rightIds.map((id, i) => [id, { x: 554, y: 24 + i * 56, w: 290, h: 42 }]));

  const bridgePaths = bridges.map((b) => {
    const a = leftPos[b.source], c = rightPos[b.target];
    const x1 = a.x + a.w, y1 = a.y + a.h / 2;
    const x2 = c.x, y2 = c.y + c.h / 2;
    const sw = (1.5 + Math.max(0, b.jaccard - 0.5) * 6).toFixed(1);
    return `<path class="cw-edge" d="M ${x1} ${y1} C ${x1 + 95} ${y1}, ${x2 - 95} ${y2}, ${x2} ${y2}" stroke-width="${sw}"><title>${esc(b.source_label)} to ${esc(b.target_label)}: ${b.shared_sessions} shared sessions, Jaccard ${b.jaccard}</title></path>`;
  }).join("\n");

  const drawNode = (id, pos, side) => {
    const n = labelMap[id];
    const hue = n?.flagship?.includes("BuildLang") ? "bldlng" : n?.flagship?.includes("Flywheel") ? "theflywheel" : n?.flagship?.includes("Commons") ? "thecmmns" : n?.flagship?.includes("Playground") ? "theplygrnd" : "rsrch";
    return `<g class="cw-svg-node" data-plat="${hue}">
  <rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="3"/>
  <text class="cw-svg-title" x="${pos.x + 12}" y="${pos.y + 18}">${esc(shortLbl(id))}</text>
  <text class="cw-svg-sub" x="${pos.x + 12}" y="${pos.y + 33}">${esc(n?.flagship || side)} / ${n?.sessions_matched || 0} sessions</text>
</g>`;
  };
  const svgNodes = [
    ...leftIds.map((id) => drawNode(id, leftPos[id], "source")),
    ...rightIds.map((id) => drawNode(id, rightPos[id], "target")),
  ].join("\n");

  const bridgeRows = CWEB.top_cross_flagship_bridges.slice(0, 10).map((b) => `<tr>
  <th scope="row">${esc(b.source_label)}</th>
  <td data-label="Connected domain">${esc(b.target_label)}</td>
  <td data-label="Shared sessions" class="num">${b.shared_sessions}</td>
  <td data-label="Jaccard / PMI" class="num">${b.jaccard.toFixed(3)} / ${b.pmi_bits.toFixed(2)} bits</td>
</tr>`).join("\n");

  const layerFilters = [
    ["all", `All ${CWEB.nodes.length} nodes`],
    ["Engine", "Engine & Physics"],
    ["Verification", "Verification & AI"],
    ["Language", "Language & Math"],
    ["Design", "Design & Commons"],
    ["Biology", "Biology & Philosophy"],
  ];
  const mapLayer = (l) => {
    if (["Engine", "Physics", "Engineering", "Media"].includes(l)) return "Engine";
    if (["Verification", "AI", "Memory", "Governance"].includes(l)) return "Verification";
    if (["Language", "Math", "Data"].includes(l)) return "Language";
    if (["Design", "Commons", "Public", "Art"].includes(l)) return "Design";
    return "Biology";
  };
  const layerButtons = layerFilters.map(([k, lbl], i) => `<button type="button" class="arch-filter-btn" data-cw-layer="${esc(k)}" aria-pressed="${i === 0 ? "true" : "false"}">${esc(lbl)}</button>`).join("");

  const nodeChips = CWEB.nodes.map((n) => {
    const grp = mapLayer(n.layer);
    const hue = n.flagship.includes("BuildLang") ? "bldlng" : n.flagship.includes("Flywheel") ? "theflywheel" : n.flagship.includes("Commons") ? "thecmmns" : n.flagship.includes("Playground") ? "theplygrnd" : "rsrch";
    return `<div class="cw-node-chip" data-cw-node data-cw-layer="${esc(grp)}" data-plat="${hue}">
  <b>${esc(n.label)}</b>
  <span>${esc(n.flagship)} / ${n.sessions_matched} sessions / ${fmtNum(n.all_session_units)} units${n.formulas_matched ? ` / ${n.formulas_matched} formulas` : ""}</span>
</div>`;
  }).join("\n");

  const thinkerGroups = [
    ["all", `All ${CWEB.thinkers.length}`],
    ["math-physics", "Math & Physics"],
    ["philosophy-ethics", "Philosophy & Ethics"],
    ["systems-bio", "Systems & Biology"],
    ["art-design", "Art, Cinema & Design"],
  ];
  const thinkerBtns = thinkerGroups.map(([k, lbl], i) => `<button type="button" class="arch-filter-btn" data-th-group="${esc(k)}" aria-pressed="${i === 0 ? "true" : "false"}">${esc(lbl)}</button>`).join("");
  const thinkerRows = CWEB.thinkers.map((t) => {
    const hay = `${t.name} ${t.field} ${t.era} ${t.mechanism} ${t.transfer}`.toLowerCase();
    return `<tr data-th-row data-th-group="${esc(t.group)}" data-th-search="${esc(hay)}">
  <th scope="row">${esc(t.name)}<br><span class="th-sub">${esc(t.era)} / ${esc(t.field)}</span></th>
  <td data-label="Sessions" class="num">${t.all_rows} hits (${t.sessions} sessions)</td>
  <td data-label="Core mechanism">${esc(t.mechanism)}</td>
  <td data-label="Transfer in our stack">${esc(t.transfer)}</td>
</tr>`;
  }).join("\n");

  return `<section class="arch-sec" id="concept-web" aria-labelledby="h-cweb">
  <h2 id="h-cweb"><span class="d-3d" data-hue="thecmmns">Concept Web and Intellectual Lineage</span></h2>
  <p class="arch-sec-lede">Computed directly across ${fmtNum(cs.sessions_mined)} engineering sessions (${fmtNum(cs.session_units_mined)} units), ${fmtNum(cs.catalogue_artifacts)} catalogued artifacts, ${fmtNum(cs.commons_files)} Commons saves, and ${cs.formulas_indexed} formulas: ${cs.concept_nodes} concept hubs linked by ${cs.concept_edges} weighted co-occurrence edges.</p>
  <div class="cw-svg-wrap">
    <svg class="cw-svg" viewBox="0 0 860 ${svgH}" role="img" aria-labelledby="cw-svg-title cw-svg-desc">
      <title id="cw-svg-title">Strongest cross-flagship co-occurrence bridges across 213 engineering sessions</title>
      <desc id="cw-svg-desc">A two-column bridge diagram whose line thickness encodes co-occurrence strength (Jaccard similarity). The strongest cross-flagship bridges connect Prose Quality and Voice on the left to Interactive Showcase on the right across 98 shared sessions (Jaccard 0.671), Flywheel Verification Oracles to Anti-Silo Consolidation across 95 shared sessions (Jaccard 0.754), and Formal Math Proofs plus Agent Memory to Anti-Silo Consolidation and Verification Oracles across 92 shared sessions each, demonstrating that verification, plain prose, and formal proofs act as the structural spine uniting the five platforms.</desc>
      ${bridgePaths}
      ${svgNodes}
    </svg>
  </div>
  <div class="arch-table-wrap" tabindex="0" role="region" aria-label="Top cross-flagship concept bridges">
    <table class="arch-table">
      <thead><tr><th scope="col">Source concept hub</th><th scope="col">Connected domain</th><th scope="col">Shared sessions</th><th scope="col">Jaccard / PMI</th></tr></thead>
      <tbody>${bridgeRows}</tbody>
    </table>
  </div>
  <h3 class="cw-subhead">All ${CWEB.nodes.length} Concept Nodes (including Frontier Expansion Lanes)</h3>
  <div class="arch-filter-bar" role="group" aria-label="Filter concept nodes by layer">
    ${layerButtons}
    <span class="arch-filter-status" id="cw-status" aria-live="polite">${CWEB.nodes.length} of ${CWEB.nodes.length} nodes shown</span>
  </div>
  <div class="cw-node-grid">${nodeChips}</div>
  <details class="arch-drawer cw-thinkers-drawer">
    <summary>50 author-referenced thinkers and giants mapped to engineering transfers</summary>
    <div class="arch-drawer-body">
      <div class="arch-toolbar">
        <label class="arch-search-wrap" for="th-search">
          <span class="arch-search-lbl">Search thinkers, mechanisms, or stack transfers</span>
          <input id="th-search" class="arch-search" type="search" placeholder="Search e.g. Newton, Shannon, Ramanujan, Sapolsky, Tarkovsky, Noether, Victor..." autocomplete="off">
        </label>
        <div class="arch-filter-bar" role="group" aria-label="Filter thinkers by discipline">
          ${thinkerBtns}
          <span class="arch-filter-status" id="th-status" aria-live="polite">${CWEB.thinkers.length} of ${CWEB.thinkers.length} thinkers shown</span>
        </div>
      </div>
      <div class="arch-table-wrap" tabindex="0" role="region" aria-label="Author-referenced thinkers table">
        <table class="arch-table">
          <thead><tr><th scope="col">Thinker & field</th><th scope="col">Session count</th><th scope="col">Core mechanism</th><th scope="col">Transfer in our stack</th></tr></thead>
          <tbody>${thinkerRows}</tbody>
        </table>
      </div>
    </div>
  </details>
  <p class="verified"><b>Verified</b> ${esc(CWEB.verified)}</p>
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

function workflowsSection() {
  const rows = (DATA.workflows || []).map((w) => `<tr>
  <th scope="row"><code>${esc(w.id)}</code><br>${esc(w.name)}</th>
  <td data-label="Platforms"><span class="arch-tag" data-plat="${esc(w.hue)}">${esc(w.platformLabel)}</span></td>
  <td data-label="Pipeline chain">${esc(w.chain)}</td>
  <td data-label="External tools replaced">${esc(w.replaces)}</td>
  <td data-label="Verified output & receipt">${esc(w.output)}</td>
</tr>`).join("\n");

  return `<section class="arch-sec" id="pipelines" aria-labelledby="h-pipelines">
  <h2 id="h-pipelines"><span class="d-3d" data-hue="theplygrnd">Cohesive Multimodal, Procedural &amp; Assurance Pipelines (WF-01 to WF-08)</span></h2>
  <p class="arch-sec-lede">${esc(DATA.workflowsLede || "")}</p>
  <div class="arch-table-wrap" tabindex="0" role="region" aria-label="Eight cohesive multimodal, procedural, and security pipelines">
    <table class="arch-table">
      <thead><tr><th scope="col">Pipeline</th><th scope="col">Platforms</th><th scope="col">End-to-end chain</th><th scope="col">External tools replaced</th><th scope="col">Verified output &amp; receipt</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="verified"><b>Verified</b> ${esc(DATA.workflowsVerified || "")}</p>
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
      <a href="#pipelines">Pipelines (WF-01..08)</a>
      <a href="#body-of-work">Full body of work</a>
      <a href="#lineage">Family trees (8)</a>
      <a href="#frontier">14 frontier lanes</a>
      <a href="#concept-web">Concept web</a>
      <a href="#datasets">Seven datasets</a>
      <a href="#benchmarks">Benchmarks</a>
      <a href="#consolidation">Consolidation map</a>
    </nav>
    <ul class="arch-stats" aria-label="Current platform snapshot">${stats}</ul>
  </header>
  ${graphSection()}
  ${platformsSection()}
  ${workflowsSection()}
  ${bodyOfWorkSection()}
  ${familyTreesSection()}
  ${frontierSection()}
  ${conceptWebSection()}
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
    <a href="/security.html">Security</a>
    <a href="/playground/#estuary">Estuary Lantern</a>
    <a href="/models.html">Models</a>
    <a href="/tools.html">Tools &amp; 159 Repos</a>
    <a href="/portfolio.html">Portfolio</a>
    <a href="/floor.html">Everything</a>
  </nav>
</article>`;

  const html = page({
    path: "architecture.html",
    title: "Platform Architecture",
    description: DATA.description,
    body,
    bodyClass: "reading landmark arch-page",
    extraHead: '<link rel="stylesheet" href="/world/site/landmark.css">\n<link rel="stylesheet" href="/world/site/architecture.css">\n<script type="module" src="/world/site/home-field.js"></script>\n<script type="module" src="/world/site/architecture.js"></script>',
    live: true,
  });

  if (DATA.description.length < 40 || DATA.description.length > 160) {
    throw new Error(`architecture: meta description length ${DATA.description.length} outside 40..160`);
  }
  if (/[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|SteamLibrary|library|datasets)/.test(html) || html.includes("\u2014")) {
    throw new Error("architecture: a local path or an em dash reached the page");
  }
  if (/zentropy/i.test(html)) {
    throw new Error("architecture: retired name reached the page");
  }
  writeFileSync(path.join(site, "architecture.html"), html);
  console.log("architecture: architecture.html built");
}

build();
