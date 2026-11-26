// quick-jump.js: unified Ctrl+K / "/" Quick-Jump search overlay, 5-pillar filter,
// and interior world-page breadcrumb wayfinding. Zero external dependencies.

const PILLAR_META = {
  start: { label: "Start", href: "/site-index.html" },
  platforms: { label: "Platforms & Tools", href: "/architecture.html" },
  demos: { label: "Interactive Demos", href: "/playground/" },
  research: { label: "Research & Writing", href: "/research.html" },
  work: { label: "Work With Me / CV", href: "/hire.html" },
};

const PILLAR_ORDER = ["all", "start", "platforms", "demos", "research", "work"];

const FALLBACK_ITEMS = [
  { t: "Home (Front Door)", u: "/", p: "start", k: "Hub", s: "Front door to all platforms and live surfaces.", q: "home start", f: 1 },
  { t: "Five-Platform Architecture & Benchmarks", u: "/architecture.html", p: "start", k: "Architecture", s: "5 platforms, 7 datasets, 14 frontier lanes, and live metrics.", q: "architecture benchmarks datasets", f: 1 },
  { t: "Site Index (All Sectors)", u: "/site-index.html", p: "start", k: "Directory", s: "Every page grouped by sector.", q: "site index directory", f: 1 },
  { t: "The Playground (Superframe + RAW DX12)", u: "/playground/", p: "platforms", k: "Platform", s: "Deterministic rendering engine, native renderer, and creative suite.", q: "playground superframe raw", f: 1 },
  { t: "BuildLang & BDB", u: "/buildlang.html", p: "platforms", k: "Platform", s: "Effect-typed systems language and embedded SQL engine.", q: "buildlang buildc bdb", f: 1 },
  { t: "The Flywheel & Articulate", u: "/flywheel.html", p: "platforms", k: "Platform", s: "Self-hosted AI workstation with signed offline receipts and 30 tools.", q: "flywheel articulate receipts", f: 1 },
  { t: "The Commons (CMMNS)", u: "/cmmns.html", p: "platforms", k: "Platform", s: "Browser extension inspecting public claims and provenance.", q: "commons cmmns", f: 1 },
  { t: "Research Hub", u: "/research.html", p: "research", k: "Hub", s: "Preregistered investigations, AI safety, findings, and papers.", q: "research papers findings", f: 1 },
  { t: "Writing & 16 Papers (DOIs)", u: "/publications.html", p: "research", k: "Hub", s: "Essays, Who Knew First, briefings, and Zenodo preprints.", q: "writing essays publications", f: 1 },
  { t: "Work With Me / Hire", u: "/hire.html", p: "work", k: "Career", s: "Resumes, Flywheel pilot, and collaboration routes.", q: "hire work cv", f: 1 },
  { t: "Portfolio & 41 Upstream PRs", u: "/portfolio.html", p: "work", k: "Career", s: "41 merged external pull requests plus owned systems.", q: "portfolio prs", f: 1 },
];

let state = {
  initialized: false,
  items: null,
  loading: null,
  dialog: null,
  input: null,
  list: null,
  status: null,
  pillar: "all",
  activeIndex: 0,
  rendered: [],
  returnFocus: null,
};

function assetUrl(rel) {
  try {
    return new URL(rel, import.meta.url).href;
  } catch {
    return "/system/" + rel.replace(/^\.\//, "");
  }
}

function ensureStylesheet(doc) {
  if (!doc || !doc.head || doc.querySelector("link[data-quick-jump-style]")) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = assetUrl("./quick-jump.css?v=20261125-wayfinding");
  link.setAttribute("data-quick-jump-style", "");
  doc.head.appendChild(link);
}

async function loadIndex() {
  if (state.items) return state.items;
  if (!state.loading) {
    state.loading = fetch(assetUrl("./search-index.json?v=20261125-wayfinding"), { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        state.items = data && Array.isArray(data.items) && data.items.length ? data.items : FALLBACK_ITEMS;
        return state.items;
      })
      .catch(() => {
        state.items = FALLBACK_ITEMS;
        return state.items;
      });
  }
  return state.loading;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function scoreItem(item, tokens, raw) {
  if (!tokens.length) return item.f ? 200 : 10;
  const title = (item.t || "").toLowerCase();
  const kind = (item.k || "").toLowerCase();
  const sum = (item.s || "").toLowerCase();
  const kw = (item.q || "").toLowerCase();
  const url = (item.u || "").toLowerCase();
  const haystack = `${title} ${kind} ${kw} ${url} ${sum}`;
  for (const tok of tokens) {
    if (!haystack.includes(tok)) return 0;
  }
  let score = item.f ? 25 : 0;
  if (title === raw) score += 200;
  else if (title.startsWith(raw)) score += 120;
  else if (title.includes(raw)) score += 80;
  for (const tok of tokens) {
    if (title.includes(tok)) score += 32;
    if (kw.includes(tok)) score += 16;
    if (url.includes(tok)) score += 12;
    if (kind.includes(tok)) score += 10;
    if (sum.includes(tok)) score += 6;
  }
  return score;
}

function filterItems(items, query, pillar) {
  const raw = String(query || "").trim().toLowerCase();
  const tokens = raw ? raw.split(/\s+/).filter(Boolean) : [];
  const pool = pillar === "all" ? items : items.filter((it) => it.p === pillar);
  if (!tokens.length) {
    const featured = pool.filter((it) => it.f);
    return (featured.length ? featured : pool).slice(0, 18);
  }
  const scored = [];
  for (const it of pool) {
    const sc = scoreItem(it, tokens, raw);
    if (sc > 0) scored.push({ it, sc });
  }
  scored.sort((a, b) => b.sc - a.sc || a.it.t.localeCompare(b.it.t));
  return scored.slice(0, 28).map((x) => x.it);
}

function updateActiveRow() {
  if (!state.list) return;
  const rows = [...state.list.querySelectorAll(".qj-item")];
  rows.forEach((li, idx) => {
    const on = idx === state.activeIndex;
    li.classList.toggle("is-active", on);
    const link = li.querySelector("a");
    if (link) link.setAttribute("aria-selected", String(on));
    if (on && typeof li.scrollIntoView === "function") {
      li.scrollIntoView({ block: "nearest" });
    }
  });
}

function renderResults() {
  if (!state.list || !state.status) return;
  const items = state.items || FALLBACK_ITEMS;
  const query = state.input ? state.input.value : "";
  const matches = filterItems(items, query, state.pillar);
  state.rendered = matches;
  state.activeIndex = 0;

  const pillarName = state.pillar === "all" ? "all 5 pillars" : PILLAR_META[state.pillar].label;
  if (!query.trim()) {
    state.status.textContent = `Showing ${matches.length} key routes in ${pillarName} (${items.length} indexed total).`;
  } else {
    state.status.textContent = `${matches.length} match${matches.length === 1 ? "" : "es"} in ${pillarName} for "${query.trim()}".`;
  }

  if (!matches.length) {
    state.list.innerHTML = `<li class="qj-empty">No matching pages in ${escapeHtml(pillarName)}. Try another term or switch to All.</li>`;
    return;
  }

  state.list.innerHTML = matches
    .map((item, idx) => {
      const pLabel = (PILLAR_META[item.p] && PILLAR_META[item.p].label) || item.p;
      return `<li class="qj-item${idx === 0 ? " is-active" : ""}" role="presentation">`
        + `<a class="qj-link" role="option" aria-selected="${idx === 0 ? "true" : "false"}" href="${escapeHtml(item.u)}">`
        + `<span class="qj-title">${escapeHtml(item.t)}</span>`
        + `<span class="qj-badges"><span class="qj-badge qj-badge--pillar">${escapeHtml(pLabel)}</span><span class="qj-badge">${escapeHtml(item.k)}</span></span>`
        + (item.s ? `<p class="qj-summary">${escapeHtml(item.s)}</p>` : "")
        + `</a></li>`;
    })
    .join("");
}

function buildDialog(doc) {
  if (state.dialog) return state.dialog;
  const dlg = doc.createElement("dialog");
  dlg.id = "qj-dialog";
  dlg.className = "qj-dialog";
  dlg.setAttribute("aria-label", "Quick-Jump site search");

  const pillsHtml = PILLAR_ORDER.map((id) => {
    const label = id === "all" ? "All" : PILLAR_META[id].label;
    return `<button type="button" class="qj-pill" data-qj-pillar="${id}" aria-pressed="${id === "all" ? "true" : "false"}">${escapeHtml(label)}</button>`;
  }).join("");

  dlg.innerHTML =
    `<div class="qj-head">`
    + `<label class="sr-only" for="qj-input">Search platforms, tools, datasets, papers, and pages</label>`
    + `<input id="qj-input" class="qj-input" type="search" autocomplete="off" spellcheck="false" placeholder="Jump to any platform, tool, dataset, finding, or page..." aria-controls="qj-results">`
    + `<button type="button" class="qj-close" data-qj-close aria-label="Close search">Esc</button>`
    + `</div>`
    + `<div class="qj-pillars" role="group" aria-label="Filter by pillar">${pillsHtml}</div>`
    + `<div class="qj-meta"><span id="qj-status" role="status" aria-live="polite">Loading index...</span><span>Arrow keys + Enter</span></div>`
    + `<ul id="qj-results" class="qj-results" role="listbox" aria-label="Search results"></ul>`
    + `<div class="qj-foot"><span>Shortcuts: Ctrl+K or /</span><a href="/site-index.html">Open full Site Index</a></div>`;

  doc.body.appendChild(dlg);
  state.dialog = dlg;
  state.input = dlg.querySelector("#qj-input");
  state.list = dlg.querySelector("#qj-results");
  state.status = dlg.querySelector("#qj-status");

  dlg.querySelector("[data-qj-close]").addEventListener("click", () => closeQuickJump());
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) closeQuickJump();
  });
  dlg.addEventListener("close", () => {
    if (state.returnFocus && typeof state.returnFocus.focus === "function") {
      try { state.returnFocus.focus(); } catch { /* ignore */ }
    }
    state.returnFocus = null;
  });

  dlg.querySelectorAll("[data-qj-pillar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.pillar = btn.dataset.qjPillar || "all";
      dlg.querySelectorAll("[data-qj-pillar]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      renderResults();
      if (state.input) state.input.focus();
    });
  });

  state.input.addEventListener("input", () => renderResults());
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (state.rendered.length) {
        state.activeIndex = (state.activeIndex + 1) % state.rendered.length;
        updateActiveRow();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (state.rendered.length) {
        state.activeIndex = (state.activeIndex - 1 + state.rendered.length) % state.rendered.length;
        updateActiveRow();
      }
    } else if (e.key === "Enter" && doc.activeElement === state.input) {
      const target = state.rendered[state.activeIndex];
      if (target && target.u) {
        e.preventDefault();
        closeQuickJump();
        window.location.href = target.u;
      }
    }
  });

  return dlg;
}

export async function openQuickJump(initialPillar) {
  if (typeof document === "undefined") return;
  const dlg = buildDialog(document);
  if (initialPillar && PILLAR_ORDER.includes(initialPillar)) {
    state.pillar = initialPillar;
    dlg.querySelectorAll("[data-qj-pillar]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.qjPillar === state.pillar));
    });
  }
  state.returnFocus = document.activeElement;
  if (!dlg.open && typeof dlg.showModal === "function") dlg.showModal();
  if (state.input) {
    state.input.focus();
    state.input.select();
  }
  renderResults();
  await loadIndex();
  renderResults();
}

export function closeQuickJump() {
  if (state.dialog && state.dialog.open) state.dialog.close();
}

function mountShellTriggers(doc, shell) {
  if (shell === "classic") {
    const nav = doc.getElementById("site-nav");
    if (nav && !nav.querySelector("[data-qj-open]")) {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "qj-trigger qj-trigger--classic";
      btn.setAttribute("data-qj-open", "");
      btn.setAttribute("aria-haspopup", "dialog");
      btn.setAttribute("aria-label", "Search site (Ctrl+K or slash)");
      btn.innerHTML = `<span>Search</span><kbd>Ctrl+K</kbd>`;
      const more = nav.querySelector(".sn-more");
      if (more) nav.insertBefore(btn, more);
      else nav.appendChild(btn);
    }
  } else if (shell === "world") {
    const hand = doc.querySelector("header.o-hand");
    if (hand && !hand.querySelector("[data-qj-open]")) {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "qj-trigger qj-trigger--world";
      btn.setAttribute("data-qj-open", "");
      btn.setAttribute("aria-haspopup", "dialog");
      btn.setAttribute("aria-label", "Search site (Ctrl+K or slash)");
      btn.setAttribute("title", "Search site (Ctrl+K)");
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="9" cy="9" r="6"/><path d="M13.6 13.6 18 18"/></svg>`;
      const fold = hand.querySelector('[data-o="fold"]');
      if (fold && fold.parentElement) fold.parentElement.insertBefore(btn, fold.nextSibling);
      else hand.appendChild(btn);
    }
  }
}

function inferWorldPillar(pathname) {
  const p = String(pathname || "/").toLowerCase();
  if (
    p === "/" ||
    p === "/index.html" ||
    p === "/elements.html" ||
    p === "/swatches.html" ||
    p === "/playground/" ||
    p === "/playground/index.html" ||
    p === "/glass-water.html"
  ) {
    return null;
  }
  if (/^\/(findings|experiments)\//.test(p)) return PILLAR_META.research;
  if (/^\/(playground|studies|world|low-water|estuary)/.test(p)) return PILLAR_META.demos;
  if (/^\/(buildlang|raw|superframe|cmmns|accession)/.test(p)) return PILLAR_META.platforms;
  return PILLAR_META.start;
}

function mountWorldBreadcrumb(doc) {
  // World-shell pages use the floating corner hand menu + Ctrl+K dialog directly,
  // with zero pasted breadcrumb box over the ocean or drafting-sheet ground.
  // Opt-in only when a page explicitly declares [data-qj-crumb].
  if (!doc || !doc.location) return;
  const host = doc.querySelector("[data-qj-crumb]");
  if (!host || doc.querySelector("nav.qj-crumb")) return;
  const pathname = doc.location.pathname || "/";
  const pillar = inferWorldPillar(pathname);
  if (!pillar) return;
  const h1 = doc.querySelector("main h1");
  const titleFromDoc = doc.title ? doc.title.split("|")[0].split("\u00b7")[0].trim() : "";
  const pageTitle = titleFromDoc || (h1 && h1.textContent.replace(/\s+/g, " ").trim()) || "Page";

  const nav = doc.createElement("nav");
  nav.className = "qj-crumb";
  nav.setAttribute("aria-label", "Breadcrumb");

  const sameAsHub = pathname.replace(/\/index\.html$/i, "/") === pillar.href.replace(/\/index\.html$/i, "/");
  const trail = [
    `<li><a href="/">Home</a></li>`,
    sameAsHub ? "" : `<li><a href="${escapeHtml(pillar.href)}">${escapeHtml(pillar.label)}</a></li>`,
    `<li><span aria-current="page">${escapeHtml(pageTitle)}</span></li>`,
  ].filter(Boolean).join("");

  nav.innerHTML =
    `<ol class="qj-crumb__trail">${trail}</ol>`
    + `<button type="button" class="qj-crumb__jump" data-qj-open aria-haspopup="dialog">Jump anywhere (Ctrl+K)</button>`;

  host.appendChild(nav);
}

export function initQuickJump({ shell = "classic" } = {}) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  ensureStylesheet(document);
  mountShellTriggers(document, shell);
  if (shell === "world") mountWorldBreadcrumb(document);

  if (state.initialized) return;
  state.initialized = true;

  document.addEventListener("click", (e) => {
    const trigger = e.target && e.target.closest && e.target.closest("[data-qj-open]");
    if (!trigger) return;
    e.preventDefault();
    openQuickJump(trigger.getAttribute("data-qj-pillar") || undefined);
  });

  window.addEventListener("keydown", (e) => {
    // Studio owns Ctrl+K and "/" for its own command palette (studio-palette).
    if (
      document.body &&
      (document.body.classList.contains("studio-page") ||
        document.body.classList.contains("studio-app") ||
        document.querySelector("dialog.studio-palette"))
    ) {
      return;
    }
    const key = (e.key || "").toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && key === "k") {
      e.preventDefault();
      if (state.dialog && state.dialog.open) closeQuickJump();
      else openQuickJump();
      return;
    }
    if (key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const el = document.activeElement;
      const typing = el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      const otherDialog = document.querySelector("dialog[open]");
      if (!typing && !otherDialog) {
        e.preventDefault();
        openQuickJump();
      }
    }
  });

  window.SiteQuickJump = { open: openQuickJump, close: closeQuickJump };
}
