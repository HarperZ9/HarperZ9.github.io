// system/studio-unified-bar.js
// Native 10-Domain Single-Viewport Control Bar inside studio.html (#studio-viewport).
// Zero iframes, zero page jumps: switches #viewport-stage natively across all 10 domains
// and all 7 compiled BuildLang WASM kernels in one cohesive UI.

const DOMAINS = [
  { id: "tools", label: "Tools", source: "superframe" },
  { id: "engine", label: "Engine", source: "raw" },
  { id: "exhibit", label: "Exhibit", source: "gallery" },
  { id: "motion", label: "Motion & Film", source: "films" },
  { id: "data", label: "Data & Visualizer", source: "plotmaps" },
  { id: "sound", label: "Sound", source: "daw" },
  { id: "ink-water", label: "Ink & Water", source: "estuary" },
  { id: "mosaic", label: "Mosaic", source: "loom" },
  { id: "type", label: "Type & Lettering", source: "type" },
  { id: "light-glass", label: "Light & Glass", source: "sand" },
];

function mountUnifiedBar() {
  const viewport = document.getElementById("studio-viewport");
  if (!viewport || viewport.dataset.unifiedBarMounted) return;
  viewport.dataset.unifiedBarMounted = "1";

  const st = document.createElement("style");
  st.textContent = `
    .sub-bar{display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.12);background:rgba(12,14,18,.94);color:#e8edf5;font:500 12px/1.2 system-ui,-apple-system,sans-serif;max-width:100%;box-sizing:border-box}
    .sub-btn{appearance:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#dce4f0;border-radius:4px;padding:4px 9px;font:inherit;cursor:pointer;white-space:nowrap}
    .sub-btn:hover,.sub-btn[aria-pressed="true"]{background:rgba(88,166,255,.24);border-color:rgba(88,166,255,.7);color:#fff}
    .sub-core{margin-left:auto;display:flex;flex-wrap:wrap;gap:8px;font-size:11px;opacity:.85}
    .sub-core a{color:#9ecbff;text-decoration:none}
    .sub-core a:hover{text-decoration:underline}
  `;
  document.head.appendChild(st);

  const bar = document.createElement("div");
  bar.className = "sub-bar";
  bar.id = "studio-unified-10-bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "10 unified domains in one viewport");

  const buttons = new Map();
  for (const d of DOMAINS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sub-btn";
    b.dataset.unifiedDomain = d.id;
    b.setAttribute("aria-pressed", "false");
    b.textContent = d.label;
    b.addEventListener("click", () => {
      for (const [id, el] of buttons) el.setAttribute("aria-pressed", id === d.id ? "true" : "false");
      const tab = document.querySelector(`#studio-source [data-source="${d.source}"]`);
      if (tab) tab.click();
    });
    bar.appendChild(b);
    buttons.set(d.id, b);
  }

  const coreLinks = document.createElement("nav");
  coreLinks.className = "sub-core";
  coreLinks.setAttribute("aria-label", "Core surfaces");
  coreLinks.innerHTML = `<a href="/">Home</a><a href="/research.html">Research</a><a href="/overview.html">Platforms</a><a href="/publications.html">Writing</a><a href="/cv.html">About</a>`;
  bar.appendChild(coreLinks);

  viewport.insertBefore(bar, viewport.firstChild);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountUnifiedBar, { once: true });
} else {
  mountUnifiedBar();
}
