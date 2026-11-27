#!/usr/bin/env node
// build-one-system-pages.mjs: generates and migrates core pages onto the unified One Shell
// (world/ui/shell/) and Two Harmonized Grounds (Open Ocean via landmark.css; Measured Drafting Sheet
// via studies.css + .ds-sheet, backdrop: false), with zero boxed cards, zero legacy dual headers,
// zero em dashes, and zero local paths.
//
// Builds:
//   Open Ocean:              models.html, flywheel.html (migrated in-place off system/nav.js & system.css)
//   Measured Drafting Sheet: tools.html (159 public repos + Wave 19C 1-command installers),
//                            person.html, security.html,
//                            career suite (hire.html, cv.html, cover-letter.html, resume*.html, portfolio.html, dossier.html)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";
import { esc } from "./studies-markdown.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (rel) => readFileSync(path.join(site, rel), "utf8");
const readOrigin = (rel) => {
  try { return execFileSync("git", ["show", `origin/main:${rel}`], { cwd: site, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 16 * 1024 * 1024 }); }
  catch { return read(rel); }
};
const readJson = (rel) => JSON.parse(read(rel));

function assertHygiene(file, html) {
  if (html.includes("\u2014")) throw new Error(`${file}: em dash detected`);
  if (/[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|library)/i.test(html)) throw new Error(`${file}: local filesystem path detected`);
  if (/zentropy/i.test(html)) throw new Error(`${file}: retired name detected`);
}

function writeChecked(rel, html) {
  assertHygiene(rel, html);
  writeFileSync(path.join(site, rel), html);
  console.log(`one-system: wrote ${rel}`);
}

function provenance(name, date = "2026-11-26", note = "Measured Drafting Sheet") {
  return `<footer class="ds-prov" aria-label="Sheet provenance">
  <span><b>Sheet</b> ${esc(name)}</span>
  <span><b>Updated</b> ${esc(date)}</span>
  <span><b>Ground</b> ${esc(note)}</span>
</footer>`;
}

// 1. models.html - Open Ocean (Local Frontier Model Lab)
function buildModels() {
  const HF_SPACE = "https://huggingface.co/spaces/zaindanaharper/jfc3p-oracle-demo";
  const models = [
    ["JFC3P-14B-Oracle (v5 PASS)", "66/84 Arm C (78.57%, +21.43 pp over Base 14B 48/84), 15/15 long-context zero drift, 21/24 traps, 6/6 A1..A6 PASS", "Latest 14B checkpoint coupled to live buildc, numeric f64, and Three-Plate verification oracles on one RTX 4090, improving over JFC3P-7B-Oracle v4 (63/84 Arm C = 75.0%, 31 tool calls, 22.2 ms / 16.47 MiB 151k Reverse-KL). v2's caught attention-layer drift (40/84, 10/15 longppl) remains published in the evolution table above. Interactive Space: huggingface.co/spaces/zaindanaharper/jfc3p-oracle-demo."],
    ["JFC3P-Titan-1M v2 & INV-01 Symplectic Loom-Titan-1M", "10.331 GB RTX 4090 / 5.747 GB Edge at 1,000,000 tokens; INV-01 194.59 M loops/s (2.22e-16 parity vs C++23 AVX2+FMA)", "One-million-token architecture paired with native BuildLang SOTA kernels: 194.59 M loops/s K=32 symplectic recurrence (2,893.98x lower energy drift than explicit Euler), 0.0812 ms 1M-token PLATO/NSA + MoltKV FNV-1a query (3/3 hits, 0.0 err), 5/5 planted fail-closed controls (390-step causal d_beta pre-alarm), 291.69x KV compression, and 99.85 tok/s decode."],
    ["Data Forge (Proof-Carrying Distillation)", "283,687.3 rows/s native BuildLang (158.2x Python 1,792.8 rows/s), bit-exact FIPS 180-4 SHA-256 + RFC 6962 Merkle, 6/6 native + 9/9 pipeline controls caught", "Air-gapped, oracle-verified distillation pipeline sealing every emitted corpus row behind fail-closed sanitization (HIPAA Safe Harbor + Scientific SI + Search-From-The-Start), planted-fault trapping, and offline-verifiable RFC 6962 Merkle Dataset Cards."],
    ["PUCT Oracle Search & Merkle Trace (flywheel#566)", "6/6 adversarial fault catch + 34.99x RFC 6962 proof-carrying trace compression (0 soundness loss)", "Execution-Oracle-Guided PUCT Verification Tree Search with hard Q_oracle pruning (beating planted high-prior wrong branches) paired with fail-closed Merkle trace compression that rejects any dropped witness or forged root."],
    ["J13 Model Epigenetics & J8 Persistent Memory", "100% weights-only incentive detection + restart-persistent fast-weight memory (catalogue #68474)", "Reads training-incentive signatures directly from weight spectra without inference prompts and verifies restart-persistent fast-weight memory against planted random-weight and tampered-checkpoint controls."],
    ["NOH-4", "78.0x lower MSE against baseline neural operator surrogates", "Compact spectral neural operator trained on deterministic fluid, optical, and structural PDE trajectories for real-time physical surrogates inside The Playground."],
    ["Plato-Key", "Deterministic geometric representation & symmetry-manifold lookup", "Separates invariant geometric primitives from rendering skins, enabling continuous metamer detection across visual, structural, and acoustic projections."],
    ["AVTR-4R", "4-stage recurrent reasoning & rollback witness", "Explicit state-hash checkpoints across reasoning steps with zero silent drift; any falsified intermediate assertion rolls back to the last verified witness."],
    ["FRESCO / MoLT / LoopCD", "Looped compute, stress-rest scheduling & distillation kernels", "Tests recursive depth vs parameter count on commodity single-GPU hardware (RTX 4090 / 24 GB VRAM), publishing null results whenever recursive scaling stalls."],
    ["BuildLang 1.18M-Record Corpus Engine", "1.18M structured syntax, effect-row, and proof records", "Self-verifying compiler training corpus generated and checked directly by buildc so every training pair is type-checked and effect-verified before fine-tuning."],
  ];

  const evolution = [
    ["Base (Qwen2.5-Coder-7B)", "49/84 Raw / 51/84 Arm C", "15/15", "Anchor", "", "Unadapted 7B base checkpoint on the sealed 84-item holdout (prior harness baseline 43/84 Raw / 51.2%)."],
    ["JFC3P-7B-Oracle v1", "95.83% buildc Arm C", "n/a (buildc)", "PASS", "verdict-pass", "Live buildc compile-test-repair lift from 16.67% baseline (p=4e-6); Three-Plate Oracle 115/115 recall, 0 false accepts."],
    ["JFC3P-7B-Oracle v2", "40/84 (47.6%)", "10/15", "DRIFT (caught)", "verdict-drift", "Full-layer LoRA degraded long-context attention (-5 on longppl); caught fail-closed and published as an honest negative result."],
    ["JFC3P-7B-Oracle v3", "48/84 Raw / 49/84 Arm C", "15/15", "PASS (+6)", "verdict-pass", "MLP-only LoRA (Q/K/V/O attention frozen) + FRESCO orthogonal projection + 32.72 ms CUDA 151k Reverse-KL; A1..A5 all PASS (1 tool call bottleneck)."],
    ["JFC3P-7B-Oracle v4", "53/84 Raw / 63/84 Arm C (75.0%)", "15/15", "PASS (+12)", "verdict-pass", "31 live tool calls (+12 over Base 51/84, +14 over v3 49/84): 13/15 BuildLang, 8/15 numeric f64, 19/24 trap resistance, 15/15 longppl zero drift, A1..A6 PASS, 22.2 ms / 16.47 MiB 151k Reverse-KL."],
    ["JFC3P-14B-Oracle v5", "66/84 Arm C (78.57%)", "15/15", "PASS (+21.43 pp)", "verdict-pass", "+21.43 pp over Base 14B (48/84), 15/15 long-context zero drift, 21/24 trap resistance, 6/6 A1..A6 PASS; live demo on Hugging Face Spaces."],
    ["Flywheel #566 Search & Trace", "6/6 faults, 34.99x", "0 soundness loss", "PASS", "verdict-pass", "Execution-Oracle PUCT tree search (prunes planted high-prior wrong branch) + RFC 6962 Merkle trace compressor."],
  ];
  const evoRows = evolution.map(([stage, score, lp, verdict, cls, notes]) =>
    `<tr><th scope="row">${esc(stage)}</th><td class="num">${esc(score)}</td><td class="num">${esc(lp)}</td><td${cls ? ` class="${cls}"` : ""}>${esc(verdict)}</td><td>${esc(notes)}</td></tr>`
  ).join("\n");

  const figs = models.map(([name, metric, desc]) => `<li class="fig"><details open><summary><b class="fig-n d-fine">${esc(name)}</b> ${esc(metric)}</summary><p class="fig-src">${esc(desc)}</p></details></li>`).join("\n");

  const body = `<article class="lp" data-landmark="models" data-hue="rsrch">
<header class="lp-head">
  <h1><span class="d-3d">Local Frontier Model Lab</span> <span class="pf-mark">RSRCH</span></h1>
  <p class="lp-lede lp-lede-1">Compact local models trained and evaluated on one workstation against external compilers, physics solvers, and planted-fault oracles. Models propose; independent checkers dispose.</p>
  <p class="lp-rel">Every model below runs locally under a strict Tier-A evidence firewall: no benchmark number is accepted without an offline replay script, an honest null policy, and zero secret or private-data leakage. Try the live interactive demo on <a href="${HF_SPACE}" rel="noopener">Hugging Face Spaces (zaindanaharper/jfc3p-oracle-demo)</a>.</p>
  <nav class="lp-ways" aria-label="On this page">
    <a href="#evolution">Evolution &amp; honest nulls</a>
    <a href="#families">Model families</a>
    <a href="#firewall">Tier-A firewall</a>
    <a href="#datasets">Open datasets</a>
    <a href="${HF_SPACE}" rel="noopener">Live HF Space</a>
    <a href="/flywheel.html">Flywheel</a>
    <a href="/buildlang.html">BuildLang</a>
    <a href="/experiments/#receipt-ledger">SHA-256 Receipt Ledger</a>
    <a href="/architecture.html">Architecture</a>
  </nav>
</header>

<section class="lp-sec" id="evolution" aria-labelledby="h-evolution">
  <h2 id="h-evolution"><span class="d-3d">Honest-nulls model evolution specimen</span></h2>
  <p class="lp-lede">Every iteration stays on the same hairline ledger, including the caught v2 attention-drift regression that motivated freezing Q/K/V/O attention heads for v3, scaling live tool calls in v4 (63/84), and advancing to JFC3P-14B-Oracle v5 at 66/84 Arm C (78.57%, <a href="${HF_SPACE}" rel="noopener">live HF Space demo</a>).</p>
  <div class="rn-wrap"><table class="rn-table">
    <caption>Sealed 84-item holdout evolution from unadapted Base through v1, caught v2 DRIFT, v3 PASS, v4 PASS (63/84 Arm C), v5 PASS (66/84 Arm C, 78.57%), and Flywheel #566 inference-time search &amp; trace compression.</caption>
    <thead><tr><th scope="col">Checkpoint / Stage</th><th scope="col" class="num">Verified Score</th><th scope="col" class="num">longppl</th><th scope="col">Gate</th><th scope="col">Observed Mechanism</th></tr></thead>
    <tbody>${evoRows}</tbody>
  </table></div>
</section>

<section class="lp-sec" id="families" aria-labelledby="h-families">
  <h2 id="h-families"><span class="d-3d">Model families &amp; verified runs</span></h2>
  <p class="lp-lede">Local research lines built to test whether small, verifiable models paired with real execution checks can close the reliability gap without opaque cloud dependencies.</p>
  <ul class="figs">${figs}</ul>
</section>

<section class="lp-sec" id="firewall" aria-labelledby="h-firewall">
  <h2 id="h-firewall"><span class="d-3d">Tier-A evidence firewall</span></h2>
  <p class="lp-lede">Nothing self-warrants. Every fine-tuned checkpoint is scored head-to-head against its unadapted base model on the same harness, with McNemar paired intervals and retired-null disclosures kept public.</p>
  <p class="lp-limit">Example honest nulls kept public: (1) JFC3P-7B-Oracle v2 regressed to 40/84 (10/15 longppl) under full-layer LoRA before v3 froze attention heads (49/84 Arm C, 15/15 longppl), v4 closed the tool-invocation gap to 63/84 Arm C (75.0%, 31 tool calls), and JFC3P-14B-Oracle v5 reached 66/84 Arm C (78.57%, +21.43 pp vs Base 14B 48/84, 21/24 traps, 15/15 longppl); (2) Flywheel Local Coder 14B scored 136/164 (82.9%) vs Qwen 2.5 Coder 14B base at 141/164 (86.0%, p = 0.404) unguided, while coupling the same tier to live <code>buildc</code> lifted BuildLang pass rates from 16.67% to 95.83% (p = 4e-6).</p>
</section>

<section class="lp-sec" id="datasets" aria-labelledby="h-datasets">
  <h2 id="h-datasets"><span class="d-3d">Open datasets &amp; replay</span></h2>
  <p class="lp-lede">Seven open verifiable datasets (DS-01 through DS-07), 30 empirical studies (12 published nulls), and 13 DOI-indexed records anchor every model experiment.</p>
  <p class="lp-ways-end"><a href="${HF_SPACE}" rel="noopener">Live HF Space (jfc3p-oracle-demo)</a> <a href="/experiments/#receipt-ledger">Live SHA-256 Receipt Ledger (G9)</a> <a href="/architecture.html#datasets">Seven datasets</a> <a href="/findings/">30 Findings (12 nulls)</a> <a href="/analytics/flywheel-benchmark-record.html">Benchmark record</a> <a href="/tools.html">159 Public Repos</a></p>
</section>

<p class="lp-verified"><b>Verified</b> 27 November 2026: JFC3P-14B-Oracle v5 (66/84 Arm C = 78.57%, +21.43 pp vs Base 14B 48/84, 15/15 longppl zero drift, 21/24 traps, 6/6 A1..A6 PASS, live HF Space zaindanaharper/jfc3p-oracle-demo), JFC3P-7B-Oracle v4 (63/84 Arm C 75.0%, 31 tool calls), caught v2 DRIFT (40/84, 10/15 longppl), INV-01 Symplectic Loom-Titan-1M (194.59 M loops/s native BuildLang, 2.22e-16 parity vs C++23 AVX2+FMA, 0.0812 ms 1M-token PLATO/NSA + MoltKV query, 5/5 controls, 10.331 GB RTX 4090 / 5.747 GB Edge VRAM), Data Forge native BuildLang (283,687.3 rows/s = 158.2x Python 1,792.8 rows/s, bit-exact SHA-256 + RFC 6962 Merkle, 6/6 native + 9/9 pipeline controls), Flywheel #566 PUCT + 34.99x Merkle trace compressor, and Three-Plate Oracle (115/115 recall, 0 false accepts). Every live benchmark links to a committed SHA-256 JSON receipt on <a href="/experiments/#receipt-ledger">Experiments (G9)</a>.</p>
</article>`;

  const html = page({
    path: "models.html",
    title: "Local Frontier Model Lab",
    description: "Local frontier models (JFC3P-7B-Oracle, NOH-4, Plato-Key, AVTR-4R, FRESCO/MoLT) evaluated against compilers, physics solvers, and planted-fault oracles.",
    body,
    bodyClass: "reading landmark",
    extraHead: '<link rel="stylesheet" href="/world/site/landmark.css">\n<script type="module" src="/world/site/home-field.js"></script>',
    live: true,
  });
  writeChecked("models.html", html);
}

// 2. tools.html — Measured Drafting Sheet (Wave 19C 1-Command Installers + 159 Public Repos)
function buildTools() {
  const installersData = readJson("assets/data/unified/one_command_installers.json");
  const reposData = readJson("assets/data/unified/all_public_repos_catalog.json");
  const repos = Array.isArray(reposData) ? reposData : (reposData.repositories || reposData.repos || reposData.items || []);
  const CAT_LABELS = {
    "flagship": "Flagship platforms",
    "ai-verification-flywheel": "AI verification & Flywheel",
    "rendering-engines-and-enb": "Rendering engines & ENB",
    "compilers-and-buildlang": "Compilers & BuildLang",
    "research-and-governance": "Research & governance",
    "empirical-research-and-science": "Empirical research & science",
    "color-and-calibration": "Color & calibration",
    "systems-and-security": "Systems & security",
    "utilities-and-repros": "Utilities & repros",
    "upstream-fork": "Upstream forks",
  };
  const catLabel = (c) => CAT_LABELS[c] || String(c || "Other").replace(/-/g, " ");
  const catCounts = new Map();
  for (const r of repos) {
    const c = r.category || "other";
    catCounts.set(c, (catCounts.get(c) || 0) + 1);
  }
  const cats = [...catCounts.keys()].sort((a, b) => {
    const order = Object.keys(CAT_LABELS);
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });

  const installerRows = (installersData.installers || []).map((inst) => {
    const winCmd = inst.windows_powershell ? `<div class="ds-cmd"><code>${esc(inst.windows_powershell)}</code><button type="button" data-copy-cmd="${esc(inst.windows_powershell)}">Copy PowerShell</button></div>` : "";
    const unixCmd = inst.unix_sh ? `<div class="ds-cmd"><code>${esc(inst.unix_sh)}</code><button type="button" data-copy-cmd="${esc(inst.unix_sh)}">Copy sh</button></div>` : "";
    const verify = inst.verify_command ? `<span class="ds-sub">Verify: <code>${esc(inst.verify_command)}</code>${inst.merged_pr ? ` | <a href="${esc(inst.merged_pr)}">Merged PR</a>` : ""}</span>` : "";
    const notes = inst.notes ? `<span class="ds-sub">${esc(inst.notes)}</span>` : "";
    return `<li>
      <span class="ds-term">${esc(inst.name)}<span class="ds-sub">${esc(inst.repo || "")}</span></span>
      <div class="ds-gloss">${winCmd}${unixCmd}${verify}${notes}</div>
    </li>`;
  }).join("\n");

  const repoRows = repos.map((r) => {
    const name = r.name || r.repo || "";
    const url = r.html_url || r.url || `https://github.com/HarperZ9/${name}`;
    const desc = r.description || "Public repository under HarperZ9.";
    const cat = r.category || "other";
    const status = r.status || (r.archived ? "archived" : "active");
    const search = `${name} ${desc} ${cat} ${catLabel(cat)} ${status} ${(r.topics || []).join(" ")}`.toLowerCase();
    return `<li data-repo-row data-cat="${esc(cat)}" data-status="${esc(status)}" data-search="${esc(search)}">
      <span class="ds-term"><a href="${esc(url)}">${esc(name)}</a><span class="ds-sub">${esc(catLabel(cat))} | ${esc(status)}</span></span>
      <span class="ds-gloss">${esc(desc)}</span>
    </li>`;
  }).join("\n");

  const careerV2Docs = [
    ["AI Evaluation & Research (1-page)", "Zain-Dana-Harper-Resume-AI-Eval-Research"],
    ["Systems & Platform Director (1-page)", "Zain-Dana-Harper-Resume-Systems-Director"],
    ["Graphics & Creative Tech (1-page)", "Zain-Dana-Harper-Resume-Graphics-Creative-Tech"],
    ["Government & Policy (1-page)", "Zain-Dana-Harper-Resume-Government-Policy"],
    ["Forestry & Trades Lead (1-page)", "Zain-Dana-Harper-Resume-Forestry-Trades-Lead"],
    ["Academic & Fellowship (1-page)", "Zain-Dana-Harper-Resume-Academic-Fellowship"],
    ["Full Living-Proof CV (3-page)", "Zain-Dana-Harper-CV"],
    ["Cover Letter: AI Eval & Systems Direction", "Zain-Dana-Harper-Cover-Letter-AI-Eval-Systems-Direction"],
    ["Cover Letter: Academic & Fellowship", "Zain-Dana-Harper-Cover-Letter-Academic-Fellowship"],
    ["Cover Letter: Government & Policy", "Zain-Dana-Harper-Cover-Letter-Government-Policy"],
    ["Cover Letter: Forestry & Trades Lead", "Zain-Dana-Harper-Cover-Letter-Forestry-Trades-Lead"],
  ];
  const v2Rows = careerV2Docs
    .filter(([, stem]) => existsSync(path.join(site, `career/v2/${stem}_Designed.pdf`)))
    .map(([label, stem]) => `<li><span class="ds-term">${esc(label)}</span><div class="ds-gloss"><div class="ds-formats"><a href="/career/v2/${stem}_Designed.pdf" download>BuildTeX Designed PDF</a><a href="/career/v2/${stem}_ATS.pdf" download>ATS PDF</a><a href="/career/v2/${stem}.docx" download>DOCX</a><a href="/career/v2/${stem}.html">HTML</a><a href="/career/v2/${stem}.md" download>Markdown</a><a href="/career/v2/${stem}.txt" download>Plain text</a></div></div></li>`).join("\n");

  const body = `<article class="st" id="tools-sheet">
<header class="ds-sheet-head">
  <p class="ds-kicker">Measured Drafting Sheet / Installers, Career Suite &amp; Public Inventory</p>
  <h1>Tools, Installers &amp; ${repos.length} Public Repositories</h1>
  <p class="ds-lede">Fail-closed <code>SHA256SUMS</code> one-command user-space installers for the flagship platforms, the November 2026 BuildTeX career document suite (66 verified files), and the complete hairline-ruled ledger of all ${repos.length} public GitHub repositories under HarperZ9 (0 private repositories exposed).</p>
  <p class="ds-meta"><span>Fail-closed SHA-256 verification</span><span>User-space only (never sudo / Machine PATH)</span><span>Offline -SelfTest / --self-test</span></p>
  <nav class="ds-ways" aria-label="On this page">
    <a href="#installers">Installers (${(installersData.installers || []).length})</a>
    <a href="#career-v2">Career Suite v2 (66)</a>
    <a href="#repos">All Public Repos (${repos.length})</a>
    <a href="/playground/">Playground</a>
    <a href="/models.html">Models</a>
  </nav>
</header>

<section class="ds-sec" id="installers" aria-labelledby="h-installers">
  <h2 id="h-installers">Fail-closed one-command installers</h2>
  <p>Every installer refuses extraction before any file lands if <code>SHA256SUMS</code> is missing, an asset entry is absent, or the computed SHA-256 differs by a single byte. Pass <code>-SelfTest</code> (PowerShell) or <code>--self-test</code> (sh) to verify offline tamper rejection.</p>
  <ul class="ds-ledger">${installerRows}</ul>
</section>

<section class="ds-sec" id="career-v2" aria-labelledby="h-career-v2">
  <h2 id="h-career-v2">November 2026 BuildTeX Career Suite (v2, 66 verified files)</h2>
  <p>Typeset directly by BuildTeX with dynamic hairline rules, zero missing glyphs, zero overfull boxes, and six synchronized formats per document (see also <a href="/hire.html">Hire</a> and <a href="/cv.html">Full CV</a>).</p>
  <ul class="ds-ledger">${v2Rows}</ul>
</section>

<section class="ds-sec" id="repos" aria-labelledby="h-repos">
  <h2 id="h-repos">Complete public repository ledger (${repos.length} public, 0 private)</h2>
  <div class="ds-filter">
    <label for="repo-q" class="sr-only">Filter repositories</label>
    <input id="repo-q" type="search" placeholder="Filter ${repos.length} repos by name, category, or topic..." autocomplete="off">
    <label for="repo-cat" class="sr-only">Category</label>
    <select id="repo-cat"><option value="">All categories (${cats.length})</option>${cats.map((c) => `<option value="${esc(c)}">${esc(catLabel(c))} (${catCounts.get(c)})</option>`).join("")}</select>
    <label for="repo-status" class="sr-only">Status</label>
    <select id="repo-status"><option value="">Active &amp; archived</option><option value="active">Active only</option><option value="archived">Archived only</option></select>
    <span id="repo-count" class="ds-meta" aria-live="polite">Showing ${repos.length} of ${repos.length} public repositories</span>
  </div>
  <ul class="ds-ledger" id="repo-ledger">${repoRows}</ul>
</section>

${provenance("tools.html", "2026-11-26", `${repos.length} public repos | fail-closed SHA256SUMS`)}
</article>
<script type="module">
const qEl = document.getElementById("repo-q"), catEl = document.getElementById("repo-cat"), stEl = document.getElementById("repo-status"), countEl = document.getElementById("repo-count");
const rows = [...document.querySelectorAll("[data-repo-row]")];
function apply() {
  const q = (qEl?.value || "").trim().toLowerCase(), c = catEl?.value || "", st = stEl?.value || "";
  let n = 0;
  for (const r of rows) {
    const ok = (!q || r.dataset.search.includes(q)) && (!c || r.dataset.cat === c) && (!st || r.dataset.status === st);
    r.hidden = !ok; if (ok) n++;
  }
  if (countEl) countEl.textContent = "Showing " + n + " of " + rows.length + " public repositories";
}
qEl?.addEventListener("input", apply); catEl?.addEventListener("change", apply); stEl?.addEventListener("change", apply);
document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-copy-cmd]"); if (!btn) return;
  try { await navigator.clipboard.writeText(btn.dataset.copyCmd); const prev = btn.textContent; btn.textContent = "Copied"; setTimeout(() => { btn.textContent = prev; }, 1600); } catch {}
});
</script>`;

  const html = page({
    path: "tools.html",
    title: "Tools, Installers and Public Repositories",
    description: `Fail-closed SHA256SUMS one-command installers and the complete ledger of all ${repos.length} public GitHub repositories by Zain Dana Harper.`,
    body,
    bodyClass: "reading ds-sheet",
    backdrop: false,
  });
  writeChecked("tools.html", html);
}

// 3. person.html — Measured Drafting Sheet (Direct human voice, zero family trauma prose, zero disclaimers)
function buildPerson() {
  const body = `<article class="st" id="person">
<header class="ds-sheet-head">
  <p class="ds-kicker">Measured Drafting Sheet / Biography &amp; Craft</p>
  <h1>Zain Dana Harper</h1>
  <p class="ds-lede">Natural philosopher, toolmaker, and systems engineer in Kent, Washington. Eleven years of commercial arboriculture rigging and about thirteen years of self-directed programming across compilers, graphics, verification, and civic provenance.</p>
  <p class="ds-meta"><span>Kent, Washington</span><span>41 merged upstream PRs across 34 repositories</span><span>1,004,693 Elder ENB downloads</span></p>
  <nav class="ds-ways" aria-label="On this page">
    <a href="#ground">Field work &amp; reverse engineering</a>
    <a href="#through-line">Through-line &amp; five platforms</a>
    <a href="#stand-for">What I stand for</a>
    <a href="/hire.html">Work &amp; Resumes</a>
    <a href="/cv.html">Full CV</a>
  </nav>
</header>

<section class="ds-sec" id="ground" aria-labelledby="h-ground">
  <h2 id="h-ground">Field work, physics, and outside-in engineering</h2>
  <p>I spent eleven years on a commercial tree crew and worked on the ground for all of it as the rigging specialist. I ran the loads and timing, kept the climber safe when heavy timber let go overhead, and brought limbs down cleanly into tight clearances through silent visual coordination. Every rigging cut is applied physics with immediate physical stakes; over eleven years we maintained an extraordinarily tight safety record.</p>
  <p>Tree care was the day job. At night I built software, reversed game engines, traced memory offsets, and wrote shader pipelines to see how real systems behave from the outside. That same outside-in habit drives how I approach AI evaluation and security today: test the live boundary, plant known faults to verify the checker actually catches them, and feed every adversarial finding straight back into stronger defenses.</p>
  <p>One public milestone built entirely on my own time is <strong>E L D E R . E N B</strong>, a lighting and atmospheric rendering preset for Skyrim SE. On Nexus Mods it has crossed one million downloads (1,004,693 total downloads and 179,218 unique accounts as of November 13, 2026). Alongside it, maintainers across 34 external open-source repositories have merged 41 of my pull requests, including DeepEval, Pydantic AI, Datasette, TOMLKit, and Biome.</p>
  <p>I operate independently as a Washington sole proprietor. Every repository, release, empirical study, and tool on this site is self-directed engineering work published with reproducible verification paths.</p>
</section>

<section class="ds-sec" id="through-line" aria-labelledby="h-through-line">
  <h2 id="h-through-line">The through-line, craft, and five platforms</h2>
  <p>My engineering starts from one structural asymmetry: generating plausible text, code, or imagery has become nearly free, while checking whether an output is actually true remains slow and expensive. Whether writing a compiler, debugging a DirectX 12 shader pass, testing an AI agent against planted faults, or measuring how light scatters in dusk and rain, the discipline is identical: separate the proposer from the reference checker, verify the checker against planted failures, and publish null results honestly.</p>
  <p>Eleven years in arboriculture shaped how I design software. A tree manages water transport, wind load, compartmentalized decay, and fungal networks without a central manager; a job site stays safe only when scopes match physical limits and anyone on the ground can call a halt without penalty. That attention carries across my broader craft: horticulture and mycology, atmospheric optics and historical color manuals, perfumery (decomposing impressions into volatile top, heart, and base curves), atmospheric drum and bass and Japanese jazz fusion over natural silence, cinema that honors negative space, and mid-century drafting plates paired with precision instruments.</p>
  <ul class="ds-ledger">
    <li><span class="ds-term"><a href="/playground/">The Playground</a></span><span class="ds-gloss">Unified creative field and rendering engine: C++23 multi-backend RAW renderer (CPU reference, D3D12, Vulkan 1.3, WebGPU), live DX12 Skyrim SE graphics replacement (96/96 moving-camera pass), Estuary continuous property field, Superframe deterministic multi-medium core, Low Water 3D narrative game, Loom, Plotter, Fractals, Type Forge, and Studio instruments.</span></li>
    <li><span class="ds-term"><a href="/buildlang.html">BuildLang</a></span><span class="ds-gloss">Rust-built compiled systems language where function types declare side effects (filesystem, network, C FFI), compiling to deterministic C, HLSL/GLSL, WebAssembly, and native executables, paired with BuildDB (BDB) checksummed SQL and BuildTeX PDF typesetting.</span></li>
    <li><span class="ds-term"><a href="/flywheel.html">The Flywheel</a> &amp; <a href="/articulate.html">Articulate</a></span><span class="ds-gloss">Self-hosted AI workstation and coding harness unifying 31 packages behind cryptographic offline receipts, the Three-Plate Verification Oracle (115/115 recall, 0 false accepts), EMET cross-language byte-integrity witnessing, and deterministic prose linting.</span></li>
    <li><span class="ds-term"><a href="/cmmns.html">The Commons (CMMNS)</a></span><span class="ds-gloss">Local-first, account-free browser extension surfacing source provenance, coordination cues, Content Credentials (C2PA), and fact-checks across nine social platforms.</span></li>
    <li><span class="ds-term"><a href="/research.html">Research, Models &amp; Security</a></span><span class="ds-gloss">Thirty reproducible empirical studies (<a href="/findings/">12 published nulls</a>), 13 DOI-indexed preprints, <a href="/models.html">Local Frontier Model Lab</a>, the capability-public <a href="/security.html">security and purple-team hierarchy</a>, and signed essays on AI accountability.</span></li>
  </ul>
</section>

<section class="ds-sec" id="stand-for" aria-labelledby="h-stand-for">
  <h2 id="h-stand-for">What I stand for</h2>
  <p>I have a young son who will grow up in a world shaped by agentic AI. Independent verification and public-interest tooling cannot remain optional extras owned solely by the organizations deploying systems at scale.</p>
  <ul class="ds-ledger">
    <li><span class="ds-term">Nothing self-warrants</span><span class="ds-gloss">A model, compiler, or institution should never be the sole judge of its own work.</span></li>
    <li><span class="ds-term">Make checking cheaper</span><span class="ds-gloss">Lower the cost of verifying claims for ordinary people instead of locking verification behind proprietary walls.</span></li>
    <li><span class="ds-term">Just culture over blame</span><span class="ds-gloss">Honest errors lead to learning and a clear path back; only hiding failures corrupts the shared record.</span></li>
    <li><span class="ds-term">Neutral tools, signed essays</span><span class="ds-gloss">Personal convictions belong in signed first-person writing, while verification and provenance tools apply symmetric rules to every subject, including my own work.</span></li>
    <li><span class="ds-term">Respect for human attention</span><span class="ds-gloss">Software should return people to their lives calmer and more capable, never trap them with synthetic urgency or clutter.</span></li>
  </ul>
  <p style="margin-top:20px">Explore <a href="/architecture.html">Platform Architecture</a>, download resumes on <a href="/hire.html">Hire</a> or the <a href="/cv.html">Full CV</a>, browse all <a href="/tools.html">159 Public Repositories</a>, watch talks and demos on <a href="https://www.youtube.com/@zaindanaharper">YouTube</a>, or read the <a href="/current-story.html">Current Story</a>.</p>
</section>

<section class="ds-sec" id="intro-video" aria-labelledby="h-intro-video">
  <h2 id="h-intro-video">Two-minute overview (tools, engines, and voice)</h2>
  <p>A 107-second first-person walkthrough covering commercial arboriculture, BuildLang, Flywheel, local GPU verification, and RAW DX12, narrated with a custom voice model trained from my own speech. Nothing autoplays.</p>
  <figure class="ds-video-figure">
    <video controls preload="none" poster="/media/overhaul/astera-residency-intro-2min-1080p-poster.webp" width="1920" height="1080" aria-label="Zain Dana Harper two-minute overview of tools, repositories, and engines">
      <source src="https://github.com/HarperZ9/flywheel/releases/download/astera-residency-intro-2026-11-26/astera-residency-intro-2min-1080p.mp4" type="video/mp4">
    </video>
    <figcaption class="ds-meta"><span>107 s, 1080p 30 fps H.264</span><span>Custom voice model + softly ducked Estuary Rain bed</span><span><a href="https://github.com/HarperZ9/flywheel/releases/tag/astera-residency-intro-2026-11-26">Release &amp; SHA256SUMS</a></span></figcaption>
  </figure>
  <figure class="plate ds-plate" style="margin:36px 0 0">
    <canvas data-specimen="person-plate-01" data-specimen-layers="moire-swirl" aria-hidden="true"></canvas>
    <figcaption class="ds-meta" style="margin-top:10px"><span class="plate-no">Plate 01</span><span class="plate-caption">Crescent meshes spiraling toward a warm core: a closing mark drawn live by the same engine as everything else here.</span></figcaption>
  </figure>
</section>

${provenance("person.html", "2026-11-26", "Direct-voice biography & craft")}
</article>
<script type="module">
import("/system/media-engine/page.mjs")
  .then((p) => p.usePlugin("plate"))
  .then((engine) => {
    const kind = 'plate';
    for (const c of document.querySelectorAll("canvas[data-specimen]")) {
      if (c.dataset.plateMounted === "true") continue;
      c.dataset.plateMounted = "true";
      engine.mount(c, kind, { params: { fromDataset: true }, seed: c.dataset.specimen || "person-plate-01" });
    }
  })
  .catch(() => import("/system/generative-field.js?v=20260902-creative-chassis").then((m) => m.mountSpecimens?.(document)));
</script>`;

  const html = page({
    path: "person.html",
    title: "The person behind it",
    description: "The personal story behind the work: eleven years of arboriculture rigging, thirteen years of programming, and five open-source platforms.",
    body,
    bodyClass: "reading ds-sheet",
    backdrop: false,
  });
  writeChecked("person.html", html);
}

// 4. security.html — Measured Drafting Sheet (preserves engraved aperture SVG plate + full tested hierarchy & advisories)
function buildSecurity() {
  const old = readOrigin("security.html");
  // Extract the verified sections (#map, #hierarchy, #advisories, #private-systems, #authorization, #data) cleanly
  // while keeping exact <div class="index-row" role="listitem"> markup expected by advisory tests.
  const sheetHead = old.indexOf('<header class="ds-sheet-head">');
  const headEnd = sheetHead >= 0 ? old.indexOf("</header>", sheetHead) : -1;
  const provIdx = old.indexOf('<footer class="ds-prov"');
  let inner;
  if (headEnd >= 0 && provIdx > headEnd) {
    inner = old.slice(headEnd + "</header>".length, provIdx).trim();
  } else {
    const mainMatch = old.match(/<main id="main"[^>]*>([\s\S]*?)<\/main>/);
    if (!mainMatch) throw new Error("security.html: <main> not found");
    inner = mainMatch[1];
  }
  inner = inner
    .replace(/<section class="mv"/g, '<section class="ds-sec"')
    .replace(/<div class="index" role="list">/g, '<div class="ds-ledger index" role="list">');

  const body = `<article class="st" id="security-sheet">
<header class="ds-sheet-head">
  <p class="ds-kicker">Measured Drafting Sheet / Security &amp; Authorized Purple-Team Practice</p>
  <h1>Security tools</h1>
  <p class="ds-lede">Public security tools you can install, a grouped verification toolkit, the advisories filed against my own tools, and the full 18-repository security and purple-team hierarchy (2.62M+ measured LOC) used only under written authorization.</p>
  <p class="ds-meta"><span>Machine-readable status: <a href="/security-tools.json">security-tools.json</a></span><span>Lineage: <a href="/architecture.html#lineage">Family Tree #8</a> &amp; <a href="/architecture.html#pipelines">Pipeline WF-08</a></span><span>Advisories updated 2026-09-27</span></p>
  <figure class="ds-art-plate">
    <img class="art-light" src="/art/aperture/pillar-security-light.svg" width="1200" height="900" alt="An iris shutter drawn in fine hatched blades, closed down to a small hole with a bright core showing through it, inside a ringed housing." decoding="async">
    <img class="art-dark" src="/art/aperture/pillar-security-dark.svg" width="1200" height="900" alt="An iris shutter drawn in fine hatched blades, closed down to a small hole with a bright core showing through it, inside a ringed housing." decoding="async">
  </figure>
  <nav class="ds-ways" aria-label="On this page">
    <a href="#map">Maturity index</a>
    <a href="#hierarchy">18-repo hierarchy</a>
    <a href="#advisories">Self-filed advisories (12)</a>
    <a href="#private-systems">Private boundary</a>
    <a href="#authorization">Authorization</a>
  </nav>
</header>
${inner}
${provenance("security.html", "2026-11-26", "Dual-edge oversight | capability-public only")}
</article>`;

  const html = page({
    path: "security.html",
    title: "Security engineering and authorized adversarial work",
    description: "A verified maturity index for public security tools, Phantom, EMET, grouped toolkit work, and authorized private security practice by Zain Dana Harper.",
    body,
    bodyClass: "reading ds-sheet",
    backdrop: false,
  });
  writeChecked("security.html", html);
}

// 5. flywheel.html — Open Ocean (landmark.css + world shell, preserving every tested #demo/#loop/#compare/#next-release/#companions block)
function buildFlywheel() {
  const old = readOrigin("flywheel.html");
  const jsonLdMatch = old.match(/<!-- structured-data:begin[\s\S]*?<!-- structured-data:end -->/);
  const svgDefsMatch = old.match(/<svg class="ns-defs"[\s\S]*?<\/svg>/);
  const demoIdx = old.indexOf('<section class="mv" id="demo"');
  const endArtIdx = demoIdx >= 0 ? old.lastIndexOf("</article>") : -1;
  const endIdx = endArtIdx > demoIdx ? endArtIdx : old.indexOf("</main>", Math.max(0, demoIdx));
  if (demoIdx < 0 || endIdx < 0) throw new Error("flywheel.html: expected #demo..#article block not found");
  const sectionsHtml = old.slice(demoIdx, endIdx).trim()
    .replace(/href="raw\.html"/g, 'href="/playground/#native"')
    .replace(/href="low-water\.html"/g, 'href="/playground/#low-water"')
    .replace(/href="superframe\.html"/g, 'href="/playground/#superframe"')
    .replace(/href="estuary\.html"/g, 'href="/playground/#estuary"')
    .replace(
      'Source-available under <span translate="no">FSL-1.1-MIT</span>.',
      'Open-source under the OSI-approved <span translate="no">MIT</span> License (relicensed via flywheel #574).'
    )
    .replace(
      '<td>Source-available under FSL-1.1-MIT.</td>',
      '<td>Open-source under the OSI-approved MIT License (relicensed via flywheel #574).</td>'
    );

  const ptr1x = readFileSync(path.join(site, "world/ui/shell/pointer/theflywheel-pressed.png")).toString("base64");
  const ptr2x = readFileSync(path.join(site, "world/ui/shell/pointer/theflywheel-pressed@2x.png")).toString("base64");
  const scopedStyle = `<link rel="stylesheet" href="/world/site/landmark.css">
<link rel="stylesheet" href="/system/notebook-sheet.css?v=20260925-void-sheets">
<style>
  html.ptr:not(.plain) article.fw-ocean[data-hue="theflywheel"] { --p-pressed: -webkit-image-set(url("data:image/png;base64,${ptr1x}") 1x, url("data:image/png;base64,${ptr2x}") 2x) 6 6 !important; }
  .fw-ocean .lp-rel, .fw-ocean .lp-run { max-width: 100%; overflow-wrap: anywhere; }
  .fw-ocean .lp-rel code, .fw-ocean .lp-run code { overflow-wrap: anywhere; }
  @media (max-width: 480px) { .fw-ocean .lp-rel code, .fw-ocean .lp-run code { word-break: break-word; } }
  .fw-ocean section.mv { margin: clamp(36px, 5.5vw, 68px) 0 0; padding: 28px 0 0; border-top: 1px solid var(--line); }
  .fw-ocean section.mv p { max-width: 64ch; }
  .fw-ocean a:focus-visible, .fw-ocean button:focus-visible, .fw-ocean summary:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  .fw-ocean section.mv#demo { border-top: 0; padding-top: 0; }
  .fw-ocean .fw-hero { display: grid; gap: 24px 36px; align-items: start; }
  @media (min-width: 62rem) {
    .fw-ocean .fw-hero.has-art { grid-template-columns: minmax(0, 1fr) 23rem; grid-template-areas: "copy media" "text media"; }
    .fw-ocean .fw-hero .hero-copy { grid-area: copy; }
    .fw-ocean .fw-hero .demo-media { grid-area: media; position: sticky; top: 5rem; }
    .fw-ocean .fw-hero .fw-transcript { grid-area: text; }
  }
  .fw-ocean .demo-media { margin: 0; max-width: 24rem; }
  .fw-ocean .demo-media video { display: block; width: 100%; height: auto; aspect-ratio: 9/16; background: #080d11; border: 1px solid var(--line); }
  .fw-ocean .hero-links, .fw-ocean .fw-links { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 0 0 18px; padding: 0; list-style: none; }
  .fw-ocean .hero-links a, .fw-ocean .fw-links a { display: inline-flex; align-items: center; min-height: 44px; font-weight: 700; text-decoration: underline; text-underline-offset: .22em; }
  .fw-ocean .row-list { list-style: none; padding: 0; margin: 18px 0; border-top: 1px solid var(--line); }
  .fw-ocean .row-list > li { padding: 14px 0; border-bottom: 1px solid var(--line); }
  .fw-ocean .row-title { font-weight: 700; margin: 0 0 4px; font-size: 1.08rem; }
  .fw-ocean .row-text { margin: 0; color: var(--soft); }
  .fw-ocean .command-block { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; padding: 10px 0; border-block: 1px solid var(--line); margin: 14px 0; font-family: var(--face-utility); }
  .fw-ocean .command-block code { white-space: pre-wrap; overflow-wrap: anywhere; }
  .fw-ocean .command-block button { font: 600 .88rem/1 var(--face-utility); color: inherit; background: transparent; border: 1px solid currentColor; padding: 8px 14px; min-height: 40px; cursor: pointer; }
  .fw-ocean .table-wrap { overflow-x: auto; margin: 14px 0; border-top: 1px solid var(--line); }
  .fw-ocean table.data-table { width: 100%; border-collapse: collapse; font-size: .95rem; }
  .fw-ocean table.data-table th, .fw-ocean table.data-table td { text-align: left; padding: 8px 12px 8px 0; border-bottom: 1px solid var(--line); }
  .fw-ocean .demo-results dt { font-weight: 700; margin-top: 10px; }
  .fw-ocean .demo-results dd { margin: 2px 0 0; }
  .fw-ocean .ns-sheet { color: #16130f; margin: 24px 0; }
  .fw-ocean .ns-sheet a { color: #0b4a5e; }
  .fw-ocean details.how-we-know { margin: 14px 0; padding: 10px 0; border-top: 1px solid var(--line); }
  .fw-ocean details.how-we-know summary { cursor: pointer; font-weight: 700; min-height: 44px; line-height: 44px; }
</style>
${jsonLdMatch ? jsonLdMatch[0] : ""}`;

  const body = `${svgDefsMatch ? svgDefsMatch[0] : ""}
<article class="lp fw-ocean" data-landmark="flywheel" data-hue="theflywheel">
<header class="lp-head">
  <h1><span class="d-3d">Flywheel</span> <span class="pf-mark">THEFLYWHEEL</span></h1>
  <p class="lp-lede lp-lede-1">An OSI MIT-licensed AI workstation and coding harness for any model, with runs you can recheck offline. Consolidates 31 packages behind cryptographic receipts, Rowan orchestration, Three-Plate Verification Oracle (115/115 recall), Data Forge proof-carrying distillation (283,687.3 rows/s native BuildLang = 158.2x Python 1,792.8 rows/s, bit-exact SHA-256 + RFC 6962 Merkle, 6/6 native + 9/9 pipeline controls), Articulate native BuildLang core (27,606.0 docs/s, 4.19e-13 cadence parity, 6/6 traps), unified Super Solver (6/6 fault catch), PUCT oracle tree search, 34.99x Merkle trace compression, <span class="ident" translate="no">accountable-surface</span> native C11/Win32 actuation, OS keystore/OAuth/RFC 9421 signing, and delegated AgentWorkspace mandates.</p>
  <p class="lp-run"><code>irm https://raw.githubusercontent.com/HarperZ9/flywheel/main/install.ps1 | iex</code></p>
  <p class="lp-rel">Fail-closed <code>SHA256SUMS</code> installer (macOS/Linux: <code>curl -fsSL https://raw.githubusercontent.com/HarperZ9/flywheel/main/install.sh | sh</code>; PyPI: <code>pip install <span class="ident" translate="no">flywheel-verify</span></code> on PyPI). Pure OSI <strong>MIT</strong> License (<a href="https://github.com/HarperZ9/flywheel/pull/574">flywheel #574</a>, <code>fb877d2e</code>); Version 2.0.0 on GitHub and PyPI; on main: <a href="https://github.com/HarperZ9/flywheel/pull/565">#565</a> (<code>super-solver</code> 6/6 fault catch), <a href="https://github.com/HarperZ9/flywheel/pull/566">#566</a> (PUCT + 34.99x Merkle trace), <a href="https://github.com/HarperZ9/flywheel/pull/570">#570</a> (MCP Registry manifests), <a href="https://github.com/HarperZ9/flywheel/pull/571">#571</a> (C11/Win32 surface + BuildLang FFI), <a href="https://github.com/HarperZ9/flywheel/pull/572">#572</a> (DPAPI/CredMan keystore, OAuth PKCE/Device Flow &amp; RFC 9421 signer), and <a href="https://github.com/HarperZ9/flywheel/pull/573">#573</a> (<code>AgentWorkspace</code>, <code>DelegatedMandate</code> &amp; <code>ApprovalValve</code>). Local forge milestones: <a href="/models.html">JFC3P-14B-Oracle v5</a> (66/84 Arm C = 78.57%), INV-01 Symplectic Loom-Titan-1M (194.59 M loops/s, 2.22e-16 parity), and the <a href="/experiments/#receipt-ledger">G9 live SHA-256 receipt ledger</a>.</p>
  <nav class="lp-ways" aria-label="On this page">
    <a href="#demo">Output check demo</a>
    <a href="#what">What Flywheel is</a>
    <a href="#loop">Verification loop</a>
    <a href="#compare">Benchmarks</a>
    <a href="#next-release">Install</a>
    <a href="#companions">Companions</a>
  </nav>
</header>
${sectionsHtml}
</article>
<script type="module">
document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-copy-target]"); if (!btn) return;
  const el = document.querySelector(btn.getAttribute("data-copy-target")); if (!el) return;
  try { await navigator.clipboard.writeText(el.textContent.trim()); const prev = btn.textContent; btn.textContent = "Copied"; setTimeout(() => { btn.textContent = prev; }, 1600); } catch {}
});
</script>`;

  const html = page({
    path: "flywheel.html",
    title: "Flywheel: an AI workstation and coding harness for any model",
    description: "Flywheel is an AI workstation and coding harness that you host yourself and run with any model, hosted or local. It has a desktop app with an assistant, a coding agent that works in your own folders with your permission, and connected tools for research, memory and writing. Every run leaves a record that can be rechecked offline.",
    body,
    bodyClass: "reading landmark fw-page",
    extraHead: scopedStyle,
    live: false,
  }).replace(/alt=""/g, 'alt="Glass and water ocean field"');
  writeChecked("flywheel.html", html);
}

buildModels();
buildTools();
buildPerson();
buildSecurity();
buildFlywheel();
