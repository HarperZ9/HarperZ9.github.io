// system/compressed-reader.js
// Clean, zero-dependency reader for compressed JSON buckets (research, platforms, writing, about).
// Supports #slug deep links and instant client-side filtering without 600+ separate HTML pages.

export async function mountCompressedReader(host, bucket) {
  if (!host || host.dataset.crMounted) return;
  host.dataset.crMounted = "1";

  const st = document.createElement("style");
  st.textContent = `
    .cr-wrap{margin:16px 0;font:400 14px/1.55 system-ui,-apple-system,sans-serif}
    .cr-head{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
    .cr-input{flex:1 1 240px;padding:8px 12px;border-radius:6px;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;font:inherit}
    .cr-count{font-size:12px;opacity:.75;font-family:ui-monospace,monospace}
    .cr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
    .cr-card{border:1px solid rgba(128,128,128,.28);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:6px}
    .cr-card[data-active="true"]{border-color:#58a6ff;box-shadow:0 0 0 1px #58a6ff}
    .cr-title{font-weight:600;font-size:14px;margin:0}
    .cr-desc{font-size:12px;opacity:.85;margin:0}
    .cr-path{font-size:11px;opacity:.65;font-family:ui-monospace,monospace}
  `;
  document.head.appendChild(st);

  host.innerHTML = `<div class="cr-wrap"><div class="cr-head"><input class="cr-input" type="search" placeholder="Filter ${bucket}..." aria-label="Filter ${bucket}"><span class="cr-count" role="status" aria-live="polite">Loading...</span></div><div class="cr-grid"></div></div>`;
  const input = host.querySelector(".cr-input");
  const countEl = host.querySelector(".cr-count");
  const grid = host.querySelector(".cr-grid");

  let items = [];
  try {
    const res = await fetch(`/data/compressed/${bucket}.json`, { cache: "no-cache" });
    if (res.ok) {
      const data = await res.json();
      items = Array.isArray(data.items) ? data.items : [];
    }
  } catch {
    items = [];
  }

  function render() {
    const q = (input.value || "").trim().toLowerCase();
    const activeSlug = (window.location.hash || "").replace(/^#/, "").toLowerCase();
    const filtered = items.filter((it) => {
      if (!q) return true;
      return it.title.toLowerCase().includes(q) || (it.description || "").toLowerCase().includes(q) || it.slug.includes(q);
    });
    countEl.textContent = `${filtered.length} of ${items.length} entries`;
    const frag = document.createDocumentFragment();
    for (const it of filtered) {
      const card = document.createElement("article");
      card.className = "cr-card";
      card.id = it.slug;
      if (activeSlug && it.slug === activeSlug) card.dataset.active = "true";
      const h = document.createElement("h3");
      h.className = "cr-title";
      const a = document.createElement("a");
      a.href = it.path;
      a.textContent = it.title;
      h.appendChild(a);
      const p = document.createElement("p");
      p.className = "cr-desc";
      p.textContent = it.description || (it.excerpt || "").slice(0, 180);
      const meta = document.createElement("span");
      meta.className = "cr-path";
      meta.textContent = `#${it.slug}`;
      card.append(h, p, meta);
      frag.appendChild(card);
    }
    grid.innerHTML = "";
    grid.appendChild(frag);
  }

  input.addEventListener("input", render);
  window.addEventListener("hashchange", render);
  render();
}
