#!/usr/bin/env node
// build-unified-surfaces.mjs: generates the 9 consolidated interactive shared-surface
// pages (models, demos, media, tools, world, studies, findings, essays, frontier-safety)
// using the canonical world shell (studies-shell.mjs) and assets/unified-surface.{css,js}.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const extraHead = [
  '<link rel="stylesheet" href="/assets/unified-surface.css">',
  '<script type="module" src="/assets/unified-surface.js"></script>',
].join("\n");

const writePage = (rel, opts) => {
  const full = path.join(site, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, page({ path: rel, extraHead, ...opts }), "utf8");
  return rel;
};

const hasAsset = (rel) => existsSync(path.join(site, rel));

function bannerSlot(imgRel, alt, seed, label) {
  if (hasAsset(imgRel)) {
    return `<div class="us-banner-frame"><img src="/${imgRel}" alt="${alt}" loading="lazy"></div>`;
  }
  return `<div class="us-banner-frame"><canvas data-plate-seed="${seed}" data-plate-label="${label}" role="img" aria-label="${alt}"></canvas></div>`;
}

function escHtml(s) {
  return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function packExplorer({ pack, category = "", repoCatalog = "", placeholder = "Filter by title, topic, DOI, or keyword..." }) {
  const catAttr = category ? ` data-us-category="${category}"` : "";
  const repoAttr = repoCatalog ? ` data-us-repo-catalog="${repoCatalog}"` : "";
  let anchors = "";
  try {
    const raw = JSON.parse(readFileSync(path.join(site, pack.replace(/^\//, "")), "utf8"));
    const cats = category ? new Set(category.split(",")) : null;
    const items = (raw.items || []).filter((it) => !cats || cats.has(it.category));
    if (items.length) {
      anchors = `<div class="us-anchors" hidden aria-hidden="true">${items.map((it) =>
        `<span id="${escHtml(it.slug)}"></span>`
      ).join("")}</div><noscript><ul class="us-noscript-list">${items.map((it) =>
        `<li><strong>${escHtml(it.title)}</strong>: ${escHtml((it.description || it.excerpt || "").slice(0, 160))}</li>`
      ).join("")}</ul></noscript>`;
    }
  } catch { /* pack optional */ }
  return `<section data-us-pack="${pack}"${catAttr}${repoAttr} aria-label="Interactive archive explorer">
  <div class="us-reader" data-us-reader hidden tabindex="-1"></div>
  <div class="us-controls">
    <label class="sr-only" for="us-q">Filter records</label>
    <input id="us-q" class="us-search" type="search" data-us-search placeholder="${placeholder}">
    <div class="us-pills" data-us-pills role="group" aria-label="Category filters"></div>
  </div>
  <p class="us-status" data-us-status role="status" aria-live="polite">Loading records...</p>
  <div class="us-grid" data-us-grid></div>
  ${anchors}
</section>`;
}

function buildModels() {
  const body = `<article class="us-wrap">
  <section class="us-hero">
    <p class="us-kicker">Local Frontier Model Lab | RTX 4090 &amp; Colab</p>
    <h1>Models, Oracles, and Living World Control</h1>
    <p class="us-lede">Models propose; deterministic oracles dispose. Every local training run and architecture experiment here runs under explicit hardware budgets, planted-failure controls, and offline SHA-256 receipts inside Flywheel Plexus and Superframe.</p>
    ${bannerSlot("media/overhaul/banners/banner-flywheel-models.webp", "Flywheel and local frontier model lab diagram", "jfc3p-noh4-lab", "JFC3P-7B-ORACLE // NOH-4 RESEATING VALVE // PLATO-KEY")}
    <ul class="us-stats">
      <li>JFC3P-7B-Oracle-v1: 95.83% Arm C trap rejection (p = 4e-6)</li>
      <li>NOH-4 Reseating CODIT Valve: 78.0x lower post-fault MSE</li>
      <li>1-Pass Online-Softmax Reverse-KL: &lt; 1e-12 parity vs 2-pass</li>
      <li>Plato-Key Procrustes Bridge: 6.49e-15 orthogonal error</li>
      <li>AVTR-4R Video Pre-Router: 46.73% token reduction</li>
    </ul>
  </section>

  <div class="us-grid">
    <section class="us-card">
      <div class="us-card-meta"><span>Flywheel Plexus</span><span>Verified</span></div>
      <h3>JFC3P-7B-Oracle &amp; Arm C Tool Loop</h3>
      <p>Routes math, physics, and BuildLang checks through an AST-whitelisted f64 sandbox and live buildc.exe instead of trusting free-text completions. Rejects 24 of 24 planted-wrong traps while preserving multi-hop reasoning via token-level Reverse-KL anchoring.</p>
      <p class="us-verified">Verified: 22/22 forge unit &amp; planted-control tests green on HarperZ9/flywheel main.</p>
      <div class="us-card-actions"><a class="us-card-btn" href="https://github.com/HarperZ9/flywheel/tree/main/packages/plexus">Inspect Plexus</a><a class="us-btn" href="/flywheel.html">Flywheel overview</a></div>
    </section>

    <section class="us-card">
      <div class="us-card-meta"><span>Superframe + Plexus</span><span>Verified CPU</span></div>
      <h3>NOH-3 &amp; NOH-4 Living World Organisms</h3>
      <p>Hierarchical control with Buckingham-Pi scale invariance, Birkhoff doubly-stochastic mHC residual routing, and a dual-channel reseating CODIT fault valve that isolates transient physics or ensemble-spread spikes and smoothly readmits healthy organelles.</p>
      <p class="us-verified">Verified: 78.0x lower recovery MSE vs permanent quarantine; 4.5x lower quadrotor OOD error and 16.6x better powered-descent score vs flat baseline.</p>
      <div class="us-card-actions"><a class="us-card-btn" href="https://github.com/HarperZ9/superframe">Inspect Superframe</a><a class="us-btn" href="/world/">World atlas</a></div>
    </section>

    <section class="us-card">
      <div class="us-card-meta"><span>Cross-Model &amp; VLM</span><span>Verified CPU</span></div>
      <h3>Plato-Key &amp; AVTR-4R Multimodal Routing</h3>
      <p>Plato-Key aligns compact readers to 7B/27B teacher spaces through closed-form SVD Procrustes on top principal components inside 24 GB VRAM. AVTR-4R routes Qwen2.5-VL-7B across direct, imagine, think, and combined paths using zero-FLOP video contact-sheet stats.</p>
      <p class="us-verified">Verified: 5/5 clean-room ablation tests passing; exact orthogonal recovery 6.49e-15; 46.73% token savings.</p>
      <div class="us-card-actions"><a class="us-card-btn" href="/architecture.html">Full benchmarks</a><a class="us-btn" href="/demos.html#plexus">Open Plexus demo</a></div>
    </section>

    <section class="us-card">
      <div class="us-card-meta"><span>Data Gate</span><span>Fail-Closed</span></div>
      <h3>Tier-A License Firewall &amp; Contamination Guard</h3>
      <p>Stage-2 pretraining refuses to launch (NO_GO_DATA_GATE) if any training shard carries restrictive licenses (NC/ND/proprietary) or 13-gram overlap with DS-01 through DS-07 evaluation suites.</p>
      <p class="us-verified">Verified: Planted NC/ND shards and DS-01 13-gram leaks blocked fail-closed in CI.</p>
      <div class="us-card-actions"><a class="us-card-btn" href="/studies/">View datasets</a><a class="us-btn" href="/findings/">View findings</a></div>
    </section>
  </div>
</article>`;
  return writePage("models.html", {
    title: "Local Frontier Model Lab",
    description: "JFC3P-7B-Oracle, Arm C deterministic tool verification, NOH-3/NOH-4 living world organisms, Plato-Key, and AVTR-4R built for consumer RTX 4090 and Colab GPUs.",
    body,
  });
}

function buildDemos() {
  const tabs = [
    ["flywheel", "Flywheel Receipt Lab", "Inspect a signed engine-receipt/1 envelope, flip one byte, and watch offline verification catch the tamper immediately.", "pip install flywheel-verify && flywheel up", "https://github.com/HarperZ9/flywheel"],
    ["gather", "Gather Deconstructor", "Deconstruct images, video frames, audio loudness/spectrum, and HTML layouts into reproducible numeric feature tables.", "python -m gather.deconstruct --help", "https://github.com/HarperZ9/flywheel/tree/main/packages/gather"],
    ["crucible", "Crucible Verifier", "Clean-room contract checking and planted-failure controls that refuse unverified claims instead of silently passing.", "python -m crucible check", "https://github.com/HarperZ9/flywheel/tree/main/packages/crucible"],
    ["forum", "Forum Deliberation", "Structured multi-agent debate with explicit dissent preservation, source citations, and verifiable decision logs.", "flywheel forum --help", "https://github.com/HarperZ9/flywheel/tree/main/packages/forum"],
    ["index", "Index Knowledge Graph", "Cross-repository dependency, claim, and evidence graph keeping every link auditable across the five flagships.", "flywheel index --help", "https://github.com/HarperZ9/flywheel/tree/main/packages/index"],
    ["emet", "EMET Calibration", "Epistemic scoring for claims and predictions: separates supported facts, testable hypotheses, and honest nulls.", "pip install emet", "https://github.com/HarperZ9/flywheel/tree/main/packages/emet"],
    ["articulate", "Articulate Prose Check", "Line-numbered prose linter flagging LLM habits, em dashes, vague claims, and structural bloat right on your machine.", "pip install articulate-writing && articulate check notes.md", "https://github.com/HarperZ9/flywheel/tree/main/packages/articulate"],
    ["plexus", "Plexus Model Forge", "Unified model router, local RTX 4090 Arm C deterministic oracle loop, and Colab Reverse-KL / NOH-4 ablation harness.", "python -m plexus.jfc3p_forge.colab_h100_runner --help", "https://github.com/HarperZ9/flywheel/tree/main/packages/plexus"],
  ];

  const tabButtons = tabs.map(([id, name], idx) =>
    `<button type="button" class="us-tab" role="tab" data-tab="${id}" aria-selected="${idx === 0}">${name}</button>`
  ).join("\n      ");

  const tabPanels = tabs.map(([id, name, desc, cmd, url], idx) => `
    <section class="us-panel" id="${id}" role="tabpanel" data-panel="${id}"${idx === 0 ? "" : " hidden"}>
      <h2>${name}</h2>
      <p>${desc}</p>
      <p class="us-verified">Run locally: <code>${cmd}</code></p>
      <div class="us-banner-frame"><canvas data-plate-seed="demo-${id}" data-plate-label="${name.toUpperCase()} // LIVE SPECIMEN" role="img" aria-label="${name} deterministic specimen diagram"></canvas></div>
      <div class="us-card-actions">
        <a class="us-card-btn" href="${url}">Open source package</a>
        <a class="us-btn" href="/playground/">Open Playground studio</a>
      </div>
    </section>`).join("\n");

  const body = `<article class="us-wrap">
  <section class="us-hero">
    <p class="us-kicker">Interactive Workbench | 8 Consolidated Tools</p>
    <h1>Live Tool Demos</h1>
    <p class="us-lede">All eight standalone demo pages now live on one tabbed workbench. Pick a tool below to inspect how it works and run it locally, or browse the full preserved demo records right underneath.</p>
  </section>

  <section data-us-tabs aria-label="Interactive demo switcher">
    <div class="us-tabs" role="tablist" aria-label="Choose a tool demo">
      ${tabButtons}
    </div>
    ${tabPanels}
  </section>

  <section style="margin-top:2rem">
    <h2>Preserved Demo Records &amp; Night School Labs</h2>
    ${packExplorer({ pack: "/assets/data/unified/tools_plugins_demos.json", category: "demo,night-school", placeholder: "Search demos and Night School labs..." })}
  </section>
</article>`;
  return writePage("demos.html", {
    title: "Interactive Demos",
    description: "One tabbed workbench for Flywheel, Gather, Crucible, Forum, Index, EMET, Articulate, and Plexus, plus preserved demo records.",
    body,
  });
}

function buildMedia() {
  const videos = [
    ["media/overhaul/videos/explainer-workstation-overview.mp4", "media/overhaul/videos/explainer-workstation-overview-poster.webp", "The Five-Flagship Ecosystem", "How The Playground, BuildLang, Flywheel, CMMNS, and this site connect into one deterministic workstation."],
    ["media/overhaul/videos/explainer-raw-dx12-playground.mp4", "media/overhaul/videos/explainer-raw-dx12-playground-poster.webp", "RAW DX12 & Superframe Optics", "Live Skyrim SE, Fallout 4, and Starfield DX12 captures beside Superframe biomechanical trees and spectral optics."],
    ["media/overhaul/videos/explainer-flywheel-jfc3p-models.mp4", "media/overhaul/videos/explainer-flywheel-jfc3p-models-poster.webp", "Flywheel, Receipts & JFC3P Models", "Offline SHA-256 verification, Arm C tool loops (95.83% trap rejection), and NOH-4 living world recovery."],
  ];

  const videoSlides = videos.map(([mp4, poster, title, cap], i) => {
    const mediaEl = hasAsset(mp4)
      ? `<video controls preload="metadata"${hasAsset(poster) ? ` poster="/${poster}"` : ""}><source src="/${mp4}" type="video/mp4"></video>`
      : `<canvas data-plate-seed="video-${i + 1}-${title}" data-plate-label="1080P EXPLAINER // ${title.toUpperCase()}" role="img" aria-label="${title} preview plate"></canvas>`;
    return `<article class="us-slide"><figure>${mediaEl}<figcaption><strong>${title}</strong>${cap}</figcaption></figure></article>`;
  }).join("\n      ");

  const banners = [
    ["media/overhaul/banners/site-hero-banner-dark.webp", "Master Hero Banner (Dark)", "Drafting plate and light study across the five flagships."],
    ["media/overhaul/banners/banner-playground-raw.webp", "The Playground & RAW DX12", "Native Direct3D 12/Vulkan/WebGPU renderer, Low Water, and Superframe optics."],
    ["media/overhaul/banners/banner-buildlang-bdb.webp", "BuildLang 1.15.0 & BuildDB", "Effect-typed systems language, qdb.exe paged store, and 115x-191x kernels."],
    ["media/overhaul/banners/banner-flywheel-models.webp", "Flywheel & Local Frontier Models", "Tamper-evident receipts, Arm C tool verification, and NOH-4 control."],
    ["media/overhaul/banners/banner-cmmns-archival.webp", "CMMNS Universal Archival", "Site-agnostic browser capture and collision-free provenance sidecars."],
    ["media/overhaul/banners/banner-research-career.webp", "Research, Studies & Career Pack", "Preregistered findings, open datasets DS-01 to DS-07, and multi-format CV."],
  ];

  const bannerSlides = banners.map(([src, title, cap], i) => {
    const visual = hasAsset(src)
      ? `<img src="/${src}" alt="${title}" loading="lazy"><button type="button" class="us-card-btn" style="margin:0.5rem 1rem 0" data-lightbox-src="/${src}" data-lightbox-alt="${title}" data-lightbox-cap="${cap}">Inspect full size</button>`
      : `<canvas data-plate-seed="banner-${i + 1}-${title}" data-plate-label="${title.toUpperCase()}" role="img" aria-label="${title} generative plate"></canvas>`;
    return `<article class="us-slide"><figure>${visual}<figcaption><strong>${title}</strong>${cap}</figcaption></figure></article>`;
  }).join("\n      ");

  const audioCues = [
    ["media/overhaul/audio/site-main-theme.mp3", "Site Main Theme", "48 kHz mastered stereo cue (-16 LUFS target, zero clipping)."],
    ["media/overhaul/audio/explainer-bed-calm.mp3", "Explainer Ambient Bed", "Warm acoustic room bed composed for the 1080p walkthroughs."],
    ["media/overhaul/audio/playground-acoustic-demo.mp3", "Playground Acoustic Demo", "Physically modeled harmonic study for the Playground sound room."],
  ];

  const audioCards = audioCues.map(([src, title, desc]) => `
    <div class="us-audio-card">
      <strong>${title}</strong>
      <p style="margin:0;color:var(--us-muted);font-size:0.9rem">${desc}</p>
      ${hasAsset(src)
        ? `<audio controls preload="none" src="/${src}"></audio>`
        : `<p class="us-status" style="margin:0">Interactive browser synthesizer available live in <a href="/playground/#sound">The Playground sound room</a>.</p>`}
    </div>`).join("\n    ");

  const body = `<article class="us-wrap">
  <section class="us-hero">
    <p class="us-kicker">Media, Artwork, Audio &amp; 1080p Explainers</p>
    <h1>Media Gallery</h1>
    <p class="us-lede">Banners, engine captures, mastered audio cues, 1080p video walkthroughs, and all preserved figure plates in one smooth scroll-snap gallery. Use mouse drag, horizontal scroll, Prev/Next buttons, or Left/Right arrow keys when focused on a rail.</p>
  </section>

  <section data-us-rail-wrap aria-labelledby="media-videos-h">
    <div class="us-rail-head">
      <h2 id="media-videos-h" style="margin:0">1080p Flagship Video Explainers</h2>
      <div class="us-pills"><button type="button" class="us-btn" data-rail-prev>Prev</button><button type="button" class="us-btn" data-rail-next>Next</button></div>
    </div>
    <div class="us-rail" tabindex="0" aria-label="Flagship video explainers">
      ${videoSlides}
    </div>
  </section>

  <section data-us-rail-wrap aria-labelledby="media-banners-h">
    <div class="us-rail-head">
      <h2 id="media-banners-h" style="margin:0">Flagship Plates &amp; Artwork</h2>
      <div class="us-pills"><button type="button" class="us-btn" data-rail-prev>Prev</button><button type="button" class="us-btn" data-rail-next>Next</button></div>
    </div>
    <div class="us-rail" tabindex="0" aria-label="Flagship plates and artwork">
      ${bannerSlides}
    </div>
  </section>

  <section aria-labelledby="media-audio-h" style="margin-top:1.75rem">
    <h2 id="media-audio-h">Mastered Audio &amp; Sound Studies</h2>
    <p class="us-status">Nothing plays automatically. Press play on any cue below or open the live synthesizer in <a href="/playground/#sound">The Playground</a>.</p>
    <div class="us-grid">
      ${audioCards}
    </div>
  </section>

  <section style="margin-top:2rem" aria-labelledby="media-archive-h">
    <h2 id="media-archive-h">All Preserved Figures &amp; Media Records</h2>
    ${packExplorer({ pack: "/assets/data/unified/media_figures.json", placeholder: "Search figures, plates, and media captures..." })}
  </section>

  <dialog class="us-lightbox" aria-label="Full-size image viewer">
    <div class="us-reader-bar"><strong>Artwork viewer</strong><button type="button" class="us-btn" data-lb-close>Close (Esc)</button></div>
    <figure style="margin:0"><img src="" alt=""><figcaption style="margin-top:0.65rem;color:var(--us-muted)"></figcaption></figure>
  </dialog>
</article>`;
  const videoJsonLd = {
    "@context": "https://schema.org",
    "@graph": videos.map(([mp4, poster, title, cap]) => ({
      "@type": "VideoObject",
      name: title,
      description: cap,
      thumbnailUrl: `https://harperz9.github.io/${poster}`,
      contentUrl: `https://harperz9.github.io/${mp4}`,
      uploadDate: "2026-11-26T00:00:00Z",
    })),
  };
  return writePage("media/index.html", {
    title: "Media, Artwork & Explainers",
    description: "Smooth scroll-snap gallery of flagship artwork, 1080p video explainers, mastered audio cues, and preserved figure plates.",
    body,
    jsonld: videoJsonLd,
  });
}

function buildTools() {
  const catalogAttr = hasAsset("assets/data/unified/all_public_repos_catalog.json")
    ? "/assets/data/unified/all_public_repos_catalog.json"
    : "";
  let installerBlock = "";
  if (hasAsset("assets/data/unified/one_command_installers.json")) {
    const inst = JSON.parse(readFileSync(path.join(site, "assets/data/unified/one_command_installers.json"), "utf8"));
    const cards = (inst.installers || [])
      .filter((x) => x.windows_powershell || x.unix_sh)
      .map((x) => {
        const win = x.windows_powershell ? `<p style="margin:0.35rem 0 0.2rem;font-size:0.8rem;color:var(--us-muted)">Windows PowerShell:</p><pre style="margin:0;padding:0.5rem 0.65rem;overflow-x:auto;font-size:0.78rem;background:var(--us-chip-bg);border:1px solid var(--us-border);border-radius:6px"><code>${escHtml(x.windows_powershell)}</code></pre>` : "";
        const unix = x.unix_sh ? `<p style="margin:0.45rem 0 0.2rem;font-size:0.8rem;color:var(--us-muted)">Linux / macOS:</p><pre style="margin:0;padding:0.5rem 0.65rem;overflow-x:auto;font-size:0.78rem;background:var(--us-chip-bg);border:1px solid var(--us-border);border-radius:6px"><code>${escHtml(x.unix_sh)}</code></pre>` : "";
        const bins = (x.binaries || []).length ? `<span>${escHtml(x.binaries.join(", "))}</span>` : "";
        return `<article class="us-card"><div class="us-card-meta"><span>Fail-Closed SHA256SUMS</span>${bins}</div><h3>${escHtml(x.name)}</h3>${x.notes ? `<p>${escHtml(x.notes)}</p>` : ""}${win}${unix}<div class="us-card-actions" style="margin-top:0.65rem"><a class="us-card-btn" href="https://github.com/${escHtml(x.repo)}">Repository</a>${x.verify_command ? `<span class="us-btn" style="font-family:'Conso',ui-monospace,monospace;font-size:0.78rem">${escHtml(x.verify_command)}</span>` : ""}</div></article>`;
      }).join("\n");
    installerBlock = `<section id="installers" style="margin:1.75rem 0" aria-labelledby="installers-h">
    <h2 id="installers-h" style="margin:0 0 0.4rem">One-Command Installers (Verified via SHA256SUMS)</h2>
    <p class="us-status" style="margin:0 0 1rem">Every flagship installer runs strictly in user space (never sudo, never Machine PATH) and refuses extraction before any file lands if SHA256SUMS mismatches by even one byte. Manifest: <a href="/assets/data/unified/one_command_installers.json">one_command_installers.json</a>.</p>
    <div class="us-grid">${cards}</div>
  </section>`;
  }
  const body = `<article class="us-wrap">
  <section class="us-hero">
    <p class="us-kicker">Complete Public Catalog | 5 Flagships + All 159 Public Repos &amp; Plugins</p>
    <h1>Tools, Plugins &amp; Public Repositories</h1>
    <p class="us-lede">Every standalone tool page, plugin page, repository explainer, and all 159 public HarperZ9 repositories live here in one searchable index. Active work sits inside the five flagships; archived historical repositories keep their exact destination badges so nothing disappears.</p>
    <ul class="us-stats">
      <li>5 Flagship Homes: Superframe, BuildLang, Flywheel, CMMNS, Portfolio Site</li>
      <li>159 Public Repositories (49 Active Original, 0 Private)</li>
      <li>Zero-Friction 1-Command Installers with Fail-Closed SHA256SUMS</li>
    </ul>
  </section>
  ${installerBlock}
  ${packExplorer({
    pack: "/assets/data/unified/tools_plugins_demos.json",
    repoCatalog: catalogAttr,
    placeholder: "Search every public repo, tool, plugin, or package...",
  })}
</article>`;
  return writePage("tools.html", {
    title: "Tools, Plugins & Public Repositories",
    description: "Searchable directory of all 159 public HarperZ9 repositories, tools, plugins, and one-command SHA256SUMS installers.",
    body,
  });
}

function buildWorld() {
  const body = `<article class="us-wrap">
  <section class="us-hero">
    <p class="us-kicker">World, Physical-AI &amp; Material Atlas</p>
    <h1>World Atlas</h1>
    <p class="us-lede">All 171 legacy world pages, exhibits, playbooks, material studies, font specimens, and engine revivals are unified here with full preserved text, category filters, and direct links to the live interactive surfaces.</p>
    ${bannerSlot("media/overhaul/banners/banner-playground-raw.webp", "The Playground and RAW DX12 visual banner", "world-playground-raw", "THE PLAYGROUND // RAW DX12 // SUPERFRAME")}
    <div class="us-pills" style="margin-top:0.85rem">
      <a class="us-btn is-primary" href="/playground/">Open The Playground</a>
      <a class="us-btn" href="/elements.html">Live Element Bench</a>
      <a class="us-btn" href="/studio.html">Media &amp; Fractal Studio</a>
      <a class="us-btn" href="/raw.html">RAW DX12 Renderer</a>
      <a class="us-btn" href="/low-water.html">Low Water Game</a>
    </div>
  </section>
  ${packExplorer({ pack: "/assets/data/unified/world_atlas.json", placeholder: "Search world nodes, exhibits, fonts, optics, ENB, or materials..." })}
</article>`;
  return writePage("world/index.html", {
    title: "World Atlas",
    description: "Unified interactive atlas of all world nodes, exhibits, material studies, typography, and rendering surfaces.",
    body,
  });
}

function buildStudies() {
  const body = `<article class="us-wrap">
  <section class="us-hero">
    <p class="us-kicker">Preregistered Studies, Analytics &amp; Datasets</p>
    <h1>Studies &amp; Benchmarks</h1>
    <p class="us-lede">Every preregistered study, benchmark analytics dashboard, and dataset note lives on one searchable surface. Null results stay in the denominator beside every positive result.</p>
    ${bannerSlot("media/overhaul/banners/banner-research-career.webp", "Research, studies, and open datasets banner", "studies-research-plate", "PREREGISTERED STUDIES // DS-01..DS-07 // HONEST NULLS")}
    <div class="us-pills" style="margin-top:0.85rem">
      <a class="us-btn is-primary" href="/findings/">Open Findings Ledger</a>
      <a class="us-btn" href="/architecture.html">Benchmarks &amp; DS-01..DS-07</a>
      <a class="us-btn" href="/essays.html">Essays &amp; Papers</a>
    </div>
  </section>
  ${packExplorer({ pack: "/assets/data/unified/studies_findings.json", category: "study,analytics", placeholder: "Search studies, datasets, analytics, or controls..." })}
</article>`;
  return writePage("studies/index.html", {
    title: "Studies & Benchmarks",
    description: "All 36 preregistered studies, analytics dashboards, and open benchmark records in one searchable surface.",
    body,
  });
}

function buildFindings() {
  const body = `<article class="us-wrap">
  <section class="us-hero">
    <p class="us-kicker">Verified Evidence Ledger</p>
    <h1>Findings</h1>
    <p class="us-lede">All 38 finding records with their checks, null controls, and verification summaries preserved in full. Open any record to inspect the full text and references without leaving the page.</p>
    <div class="us-pills" style="margin-top:0.85rem">
      <a class="us-btn is-primary" href="/studies/">Open Studies</a>
      <a class="us-btn" href="/models.html">Local Frontier Models</a>
      <a class="us-btn" href="/frontier-safety/">Frontier Safety</a>
    </div>
  </section>
  ${packExplorer({ pack: "/assets/data/unified/studies_findings.json", category: "finding", placeholder: "Search findings by ID, claim, or check..." })}
</article>`;
  return writePage("findings/index.html", {
    title: "Findings",
    description: "All 38 verified findings and null-control results preserved in one searchable ledger.",
    body,
  });
}

function buildEssays() {
  const body = `<article class="us-wrap">
  <section class="us-hero">
    <p class="us-kicker">Writing, Papers &amp; Zenodo DOIs</p>
    <h1>Essays &amp; Long-Form Writing</h1>
    <p class="us-lede">All published essays, philosophy pieces, research papers, DOIs, and the Who Knew First investigation series gathered in one calm reading room. Every link from an older article URL opens the exact piece right here.</p>
    <div class="us-pills" style="margin-top:0.85rem">
      <a class="us-btn is-primary" href="/person.html">Documented History of Zain Dana Harper</a>
      <a class="us-btn" href="/frontier-safety/">Frontier Safety Briefings</a>
      <a class="us-btn" href="/dossier.html">Evidence Dossier</a>
    </div>
  </section>
  ${packExplorer({ pack: "/assets/data/unified/essays_writings.json", category: "essay,overview,career", placeholder: "Search essays, DOIs, Who Knew First, or topics..." })}
</article>`;
  return writePage("essays.html", {
    title: "Essays & Long-Form Writing",
    description: "Complete archive of essays, Zenodo preprints, research papers, and investigations by Zain Dana Harper.",
    body,
  });
}

function buildFrontierSafety() {
  const body = `<article class="us-wrap">
  <section class="us-hero">
    <p class="us-kicker">Dated Archives, Conclusions &amp; Incident Briefings</p>
    <h1>Frontier Safety</h1>
    <p class="us-lede">All dated frontier-safety archive snapshots, conclusions records, and multi-lane incident briefings preserved in full chronological order with source citations intact.</p>
    <div class="us-pills" style="margin-top:0.85rem">
      <a class="us-btn is-primary" href="/security.html">Security &amp; Assurance</a>
      <a class="us-btn" href="/flywheel.html">Flywheel Accountability</a>
      <a class="us-btn" href="/essays.html">All Essays</a>
    </div>
  </section>
  ${packExplorer({ pack: "/assets/data/unified/essays_writings.json", category: "frontier-safety", placeholder: "Search dated archives, incidents, or conclusions..." })}
</article>`;
  return writePage("frontier-safety/index.html", {
    title: "Frontier Safety",
    description: "Dated frontier-safety archives, conclusions, and incident briefings preserved in one interactive timeline.",
    body,
  });
}

const built = [
  buildModels(),
  buildDemos(),
  buildMedia(),
  buildTools(),
  buildWorld(),
  buildStudies(),
  buildFindings(),
  buildEssays(),
  buildFrontierSafety(),
];
console.log(`unified surfaces built (${built.length}): ${built.join(", ")}`);
