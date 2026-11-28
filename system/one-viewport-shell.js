// system/one-viewport-shell.js
// Combines the ENTIRE website (all 600+ pages, tools, studies, exhibits, maps, swatches,
// workshops, experiments, findings, research, and platforms) together with all 10 live
// BuildLang WASM creative/engine domains inside ONE single viewport (#viewport-stage)
// and ONE unified UI in studio.html.

const DOMAIN_ROUTES = [
  { id: "tools", label: "Tools", source: "superframe" },
  { id: "engine", label: "Engine", source: "raw" },
  { id: "exhibit", label: "Exhibit", source: "gallery" },
  { id: "motion", label: "Motion & Film", source: "films" },
  { id: "data", label: "Data & Viz", source: "plotmaps" },
  { id: "sound", label: "Sound", source: "daw" },
  { id: "ink-water", label: "Ink & Water", source: "estuary" },
  { id: "mosaic", label: "Mosaic", source: "loom" },
  { id: "type", label: "Type", source: "type" },
  { id: "light-glass", label: "Light & Glass", source: "sand" },
];

const QUICK_SURFACES = [
  { label: "Map", path: "/world/universe/proto/index.html" },
  { label: "Elements", path: "/elements.html" },
  { label: "Swatches", path: "/swatches.html" },
  { label: "Studies", path: "/studies/index.html" },
  { label: "Workshop", path: "/workshop.html" },
  { label: "Experiments", path: "/experiments/index.html" },
  { label: "Everything", path: "/floor.html" },
];

function injectStyles() {
  if (document.getElementById("ovs-style")) return;
  const st = document.createElement("style");
  st.id = "ovs-style";
  st.textContent = `
    .ovs-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.12);background:rgba(12,14,18,.92);color:#e8edf5;font:500 12px/1.25 system-ui,-apple-system,sans-serif;z-index:12;position:relative;max-width:100%;box-sizing:border-box}
    .ovs-group{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
    .ovs-btn{appearance:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#dce4f0;border-radius:4px;padding:4px 8px;font:inherit;cursor:pointer;white-space:nowrap}
    .ovs-btn:hover,.ovs-btn[aria-pressed="true"]{background:rgba(88,166,255,.22);border-color:rgba(88,166,255,.65);color:#fff}
    .ovs-btn-accent{background:rgba(88,166,255,.18);border-color:rgba(88,166,255,.5);color:#fff;font-weight:600}
    .ovs-sep{width:1px;height:16px;background:rgba(255,255,255,.16);margin:0 2px}
    .ovs-stage-overlay{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;background:#0c0e12}
    .ovs-stage-overlay[hidden]{display:none}
    .ovs-frame-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:#141820;border-bottom:1px solid rgba(255,255,255,.14);color:#e8edf5;font:500 12px/1.3 system-ui,-apple-system,sans-serif}
    .ovs-frame-meta{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden}
    .ovs-frame-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
    .ovs-frame-path{opacity:.7;font-family:ui-monospace,monospace;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ovs-frame-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}
    .ovs-frame-actions a{color:#8cc2ff;text-decoration:none;font-size:12px}
    .ovs-iframe{flex:1 1 auto;width:100%;height:100%;border:0;background:#0c0e12}
    .ovs-drawer{position:absolute;inset:0;z-index:25;background:rgba(10,12,16,.97);color:#e8edf5;display:flex;flex-direction:column;padding:12px;box-sizing:border-box;font:400 13px/1.4 system-ui,-apple-system,sans-serif}
    .ovs-drawer[hidden]{display:none}
    .ovs-drawer-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:10px}
    .ovs-search{flex:1 1 220px;min-width:160px;padding:7px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.22);background:#151a22;color:#fff;font:inherit}
    .ovs-cats{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
    .ovs-list{flex:1 1 auto;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px;align-content:start}
    .ovs-item{text-align:left;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#e8edf5;cursor:pointer;display:flex;flex-direction:column;gap:2px}
    .ovs-item:hover{background:rgba(88,166,255,.18);border-color:rgba(88,166,255,.55)}
    .ovs-item-title{font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ovs-item-sub{font-size:11px;opacity:.7;font-family:ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  `;
  document.head.appendChild(st);
}

let cachedManifest = null;
async function loadManifest() {
  if (cachedManifest) return cachedManifest;
  try {
    const res = await fetch("/data/site-universe-manifest.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    cachedManifest = await res.json();
    return cachedManifest;
  } catch {
    return { schema: "site-universe-manifest/1", total: 0, categories: [], items: [] };
  }
}

function mountOneViewportShell() {
  const viewport = document.getElementById("studio-viewport");
  const stage = document.getElementById("viewport-stage");
  if (!viewport || !stage || viewport.dataset.ovsMounted) return;
  viewport.dataset.ovsMounted = "1";
  injectStyles();

  // Unified top bar inside #studio-viewport (zero extra <select>s)
  const bar = document.createElement("div");
  bar.className = "ovs-bar";
  bar.id = "one-viewport-bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Unified site and 10-domain viewport controls");

  const domGroup = document.createElement("div");
  domGroup.className = "ovs-group";
  const domButtons = new Map();
  for (const d of DOMAIN_ROUTES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ovs-btn";
    b.dataset.ovsDomain = d.id;
    b.setAttribute("aria-pressed", "false");
    b.textContent = d.label;
    b.addEventListener("click", () => switchDomain(d.id));
    domGroup.appendChild(b);
    domButtons.set(d.id, b);
  }

  const sep = document.createElement("span");
  sep.className = "ovs-sep";
  sep.setAttribute("aria-hidden", "true");

  const quickGroup = document.createElement("div");
  quickGroup.className = "ovs-group";
  for (const q of QUICK_SURFACES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ovs-btn";
    b.dataset.ovsQuick = q.path;
    b.textContent = q.label;
    b.addEventListener("click", () => openSurface(q.path, q.label, "Site"));
    quickGroup.appendChild(b);
  }

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.id = "ovs-all-btn";
  allBtn.className = "ovs-btn ovs-btn-accent";
  allBtn.textContent = "All Site Pages";
  allBtn.addEventListener("click", () => toggleDrawer());
  quickGroup.appendChild(allBtn);

  bar.append(domGroup, sep, quickGroup);
  viewport.insertBefore(bar, viewport.firstChild);

  // Ensure #viewport-stage is positioned for overlaid surfaces and drawer
  if (getComputedStyle(stage).position === "static") {
    stage.style.position = "relative";
  }

  // Same-viewport embedded surface overlay
  const overlay = document.createElement("div");
  overlay.className = "ovs-stage-overlay";
  overlay.id = "ovs-surface-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="ovs-frame-head">
      <div class="ovs-frame-meta">
        <button type="button" class="ovs-btn ovs-btn-accent" id="ovs-back-canvas">Back to Live Canvas</button>
        <span class="ovs-frame-title" id="ovs-frame-title"></span>
        <span class="ovs-frame-path" id="ovs-frame-path"></span>
      </div>
      <div class="ovs-frame-actions">
        <a id="ovs-open-standalone" href="/" target="_blank" rel="noopener">Open standalone</a>
      </div>
    </div>
    <iframe id="ovs-iframe" class="ovs-iframe" title="Unified site surface viewport"></iframe>
  `;
  stage.appendChild(overlay);

  // Full-site 600+ page searchable drawer inside #viewport-stage
  const drawer = document.createElement("div");
  drawer.className = "ovs-drawer";
  drawer.id = "ovs-universe-drawer";
  drawer.hidden = true;
  drawer.innerHTML = `
    <div class="ovs-drawer-head">
      <strong>Entire Website in One Viewport</strong>
      <input type="search" id="ovs-search-input" class="ovs-search" placeholder="Filter all 600+ pages, tools, studies, findings, exhibits, maps..." aria-label="Filter all site pages">
      <button type="button" class="ovs-btn" id="ovs-drawer-close">Close</button>
    </div>
    <div class="ovs-cats" id="ovs-cats"></div>
    <div class="ovs-list" id="ovs-list"></div>
  `;
  stage.appendChild(drawer);

  const iframe = overlay.querySelector("#ovs-iframe");
  const titleEl = overlay.querySelector("#ovs-frame-title");
  const pathEl = overlay.querySelector("#ovs-frame-path");
  const standaloneEl = overlay.querySelector("#ovs-open-standalone");
  overlay.querySelector("#ovs-back-canvas").addEventListener("click", closeSurface);
  drawer.querySelector("#ovs-drawer-close").addEventListener("click", () => { drawer.hidden = true; });

  let activeCat = "All";
  let searchQuery = "";

  function closeSurface() {
    overlay.hidden = true;
    iframe.src = "about:blank";
  }

  function openSurface(surfacePath, title, cat) {
    drawer.hidden = true;
    const safePath = String(surfacePath || "/").startsWith("/") ? surfacePath : "/" + surfacePath;
    titleEl.textContent = title || safePath;
    pathEl.textContent = (cat ? `[${cat}] ` : "") + safePath;
    standaloneEl.href = safePath;
    iframe.src = safePath;
    overlay.hidden = false;
  }

  function switchDomain(domainId) {
    const route = DOMAIN_ROUTES.find((d) => d.id === domainId);
    if (!route) return;
    closeSurface();
    drawer.hidden = true;
    for (const [id, btn] of domButtons) {
      btn.setAttribute("aria-pressed", id === domainId ? "true" : "false");
    }
    const tab = document.querySelector(`#studio-source [data-source="${route.source}"]`);
    if (tab) tab.click();
  }

  async function renderDrawer() {
    const manifest = await loadManifest();
    allBtn.textContent = `All Site (${manifest.total})`;
    const catsEl = drawer.querySelector("#ovs-cats");
    const listEl = drawer.querySelector("#ovs-list");
    catsEl.innerHTML = "";

    const catList = [{ name: "All", count: manifest.total }, ...manifest.categories];
    for (const c of catList) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ovs-btn";
      b.setAttribute("aria-pressed", activeCat === c.name ? "true" : "false");
      b.textContent = `${c.name} (${c.count})`;
      b.addEventListener("click", () => {
        activeCat = c.name;
        renderList(manifest);
        catsEl.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      });
      catsEl.appendChild(b);
    }
    renderList(manifest);
  }

  function renderList(manifest) {
    const listEl = drawer.querySelector("#ovs-list");
    const q = searchQuery.trim().toLowerCase();
    const filtered = manifest.items.filter((it) => {
      if (activeCat !== "All" && it.c !== activeCat) return false;
      if (!q) return true;
      return it.t.toLowerCase().includes(q) || it.p.toLowerCase().includes(q) || it.c.toLowerCase().includes(q);
    });
    const frag = document.createDocumentFragment();
    for (const it of filtered.slice(0, 250)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ovs-item";
      const t = document.createElement("span");
      t.className = "ovs-item-title";
      t.textContent = it.t;
      const s = document.createElement("span");
      s.className = "ovs-item-sub";
      s.textContent = `${it.c} | ${it.p}`;
      btn.append(t, s);
      btn.addEventListener("click", () => openSurface(it.p, it.t, it.c));
      frag.appendChild(btn);
    }
    listEl.innerHTML = "";
    listEl.appendChild(frag);
  }

  async function toggleDrawer() {
    drawer.hidden = !drawer.hidden;
    if (!drawer.hidden) {
      await renderDrawer();
      drawer.querySelector("#ovs-search-input").focus();
    }
  }

  drawer.querySelector("#ovs-search-input").addEventListener("input", async (e) => {
    searchQuery = e.target.value || "";
    const manifest = await loadManifest();
    renderList(manifest);
  });

  // Update button label with live total count asynchronously
  loadManifest().then((m) => {
    if (m.total > 0) allBtn.textContent = `All Site (${m.total})`;
  });

  // Support deep-link ?surface=/path.html directly inside the single viewport
  const params = new URLSearchParams(window.location.search);
  const initialSurface = params.get("surface");
  if (initialSurface && initialSurface.startsWith("/") && !initialSurface.startsWith("//")) {
    openSurface(initialSurface, initialSurface, "Direct");
  }

  window.OneViewportShell = {
    openSurface,
    closeSurface,
    switchDomain,
    toggleDrawer,
    loadManifest,
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountOneViewportShell, { once: true });
} else {
  mountOneViewportShell();
}
