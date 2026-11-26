// unified-surface.js: shared interactive reader, search/filter, smooth scroll-snap
// media rail, lightbox, and deterministic Canvas2D generative plates.

const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

function drawSpecimenPlate(canvas) {
  const seedStr = canvas.dataset.plateSeed || "superframe";
  let seed = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    seed = Math.imul(seed ^ seedStr.charCodeAt(i), 16777619);
  }
  const w = canvas.width = 640;
  const h = canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const pal = [
    ["#0c1821", "#1b3a4b", "#4cc9f0", "#f4a261"],
    ["#121619", "#283618", "#90be6d", "#e9c46a"],
    ["#13111c", "#2d2a4a", "#64dfdf", "#f77f00"],
    ["#181414", "#3d2c2e", "#e07a5f", "#f2cc8f"],
  ][Math.abs(seed) % 4];

  ctx.fillStyle = pal[0];
  ctx.fillRect(0, 0, w, h);

  // Subtle drafting grid
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let x = 32; x < w; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 32; y < h; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Deterministic wave interference / caustic curves
  const freqs = 5 + (Math.abs(seed >> 3) % 5);
  const phase = (Math.abs(seed >> 7) % 360) * Math.PI / 180;
  for (let k = 0; k < 22; k++) {
    ctx.beginPath();
    const frac = k / 21;
    ctx.strokeStyle = k % 5 === 0 ? pal[3] : pal[2];
    ctx.globalAlpha = 0.22 + 0.55 * (1 - Math.abs(frac - 0.5) * 1.6);
    ctx.lineWidth = k % 5 === 0 ? 1.8 : 1.0;
    for (let x = 0; x <= w; x += 6) {
      const nx = x / w;
      const y = h * (0.18 + 0.64 * frac)
        + Math.sin(nx * Math.PI * freqs + phase + k * 0.28) * (24 + 14 * Math.cos(k * 0.4))
        + Math.cos(nx * Math.PI * (freqs - 2) - phase * 0.5) * 12;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(240,244,248,0.88)";
  ctx.font = "600 13px Conso, ui-monospace, monospace";
  ctx.fillText(canvas.dataset.plateLabel || seedStr.toUpperCase(), 20, h - 18);
}

export function initSpecimenPlates(root = document) {
  for (const c of root.querySelectorAll("canvas[data-plate-seed]")) {
    drawSpecimenPlate(c);
  }
}

export function initSmoothRails(root = document) {
  for (const wrap of root.querySelectorAll("[data-us-rail-wrap]")) {
    const rail = wrap.querySelector(".us-rail");
    if (!rail) continue;
    const prev = wrap.querySelector("[data-rail-prev]");
    const next = wrap.querySelector("[data-rail-next]");
    const step = () => Math.max(280, Math.round(rail.clientWidth * 0.78));
    if (prev) prev.addEventListener("click", () => rail.scrollBy({ left: -step(), behavior: "smooth" }));
    if (next) next.addEventListener("click", () => rail.scrollBy({ left: step(), behavior: "smooth" }));
    rail.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); rail.scrollBy({ left: step(), behavior: "smooth" }); }
      if (e.key === "ArrowLeft") { e.preventDefault(); rail.scrollBy({ left: -step(), behavior: "smooth" }); }
    });
  }
}

export function initLightbox(root = document) {
  const dlg = root.querySelector("dialog.us-lightbox");
  if (!dlg) return;
  const img = dlg.querySelector("img");
  const cap = dlg.querySelector("figcaption");
  const close = dlg.querySelector("[data-lb-close]");
  if (close) close.addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lightbox-src]");
    if (!btn) return;
    if (img) { img.src = btn.dataset.lightboxSrc; img.alt = btn.dataset.lightboxAlt || ""; }
    if (cap) cap.textContent = btn.dataset.lightboxCap || "";
    dlg.showModal();
  });
}

export function initTabs(root = document) {
  for (const group of root.querySelectorAll("[data-us-tabs]")) {
    const tabs = [...group.querySelectorAll("[role='tab']")];
    const panels = [...group.querySelectorAll("[role='tabpanel']")];
    const activate = (id, pushHash = false) => {
      const target = tabs.find((t) => t.dataset.tab === id) || tabs[0];
      if (!target) return;
      const key = target.dataset.tab;
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === key)));
      panels.forEach((p) => { p.hidden = p.dataset.panel !== key; });
      if (pushHash && history.replaceState) history.replaceState(null, "", "#" + key);
    };
    tabs.forEach((t) => t.addEventListener("click", () => activate(t.dataset.tab, true)));
    const hash = location.hash.replace(/^#/, "");
    activate(hash || tabs[0]?.dataset.tab || "", false);
    window.addEventListener("hashchange", () => {
      const h = location.hash.replace(/^#/, "");
      if (tabs.some((t) => t.dataset.tab === h)) activate(h, false);
    });
  }
}

export async function mountUnifiedPack(el) {
  const packUrl = el.dataset.usPack;
  const filterCat = el.dataset.usCategory || "";
  const extraCatUrl = el.dataset.usRepoCatalog || "";
  const searchEl = el.querySelector("[data-us-search]");
  const pillsEl = el.querySelector("[data-us-pills]");
  const statusEl = el.querySelector("[data-us-status]");
  const gridEl = el.querySelector("[data-us-grid]");
  const readerEl = el.querySelector("[data-us-reader]");
  if (!packUrl || !gridEl) return;

  let items = [];
  try {
    const res = await fetch(packUrl);
    const data = await res.json();
    items = (data.items || []).filter((it) => !filterCat || it.category === filterCat || filterCat.split(",").includes(it.category));
  } catch (err) {
    if (statusEl) statusEl.textContent = "Could not load archive pack: " + String(err);
    return;
  }

  if (extraCatUrl) {
    try {
      const r2 = await fetch(extraCatUrl);
      if (r2.ok) {
        const cat = await r2.json();
        const repos = Array.isArray(cat.repositories) ? cat.repositories : (Array.isArray(cat.repos) ? cat.repos : []);
        for (const r of repos) {
          const slug = "repo-" + String(r.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
          items.push({
            slug,
            title: r.name,
            description: r.description || "",
            category: r.status === "archived" ? "repo-archived" : "repo-active",
            excerpt: r.description || "",
            verified: r.flagship_home ? `Flagship home: ${r.flagship_home} (${r.status || "active"})` : "",
            repos: r.url ? [r.url] : [],
            dois: [],
            word_count: 0,
            body_html: `<p>${esc(r.description || "")}</p><p><strong>Status:</strong> ${esc(r.status || "active")} | <strong>Category:</strong> ${esc(r.category || "public")} | <strong>Flagship home:</strong> ${esc(r.flagship_home || "standalone")}</p>${r.url ? `<p><a href="${esc(r.url)}">Open repository on GitHub</a></p>` : ""}`,
          });
        }
      }
    } catch { /* optional catalog */ }
  }

  let activeCat = "all";
  let filtered = items;
  let currentIdx = -1;

  const cats = ["all", ...new Set(items.map((i) => i.category).filter(Boolean))].slice(0, 14);
  if (pillsEl) {
    pillsEl.innerHTML = cats.map((c) =>
      `<button type="button" class="us-pill" data-cat="${esc(c)}" aria-pressed="${c === "all"}">${esc(c.replace(/-/g, " "))}</button>`
    ).join("");
    pillsEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      activeCat = b.dataset.cat;
      pillsEl.querySelectorAll("[data-cat]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
    });
  }

  function openItem(item, pushHash = true) {
    if (!readerEl || !item) return;
    currentIdx = filtered.indexOf(item);
    const dois = (item.dois || []).map((d) => `<a class="us-pill" href="${esc(d.startsWith("http") ? d : "https://doi.org/" + d)}">${esc(d)}</a>`).join(" ");
    const repos = (item.repos || []).slice(0, 4).map((r) => `<a class="us-pill" href="${esc(r)}">${esc(r.replace("https://github.com/", ""))}</a>`).join(" ");
    readerEl.innerHTML = `
      <div class="us-reader-bar">
        <div><strong>${esc(item.title)}</strong> <small>(${esc(item.category)})</small></div>
        <div class="us-pills">
          <button type="button" class="us-btn" data-us-prev>Prev</button>
          <button type="button" class="us-btn" data-us-next>Next</button>
          <button type="button" class="us-btn" data-us-close>Close</button>
        </div>
      </div>
      ${item.verified ? `<p class="us-verified">Verified: ${esc(item.verified)}</p>` : ""}
      ${dois || repos ? `<div class="us-pills" style="margin-bottom:0.85rem">${dois} ${repos}</div>` : ""}
      <div class="us-reader-body">${item.body_html || `<p>${esc(item.description || item.excerpt)}</p>`}</div>`;
    readerEl.hidden = false;
    readerEl.scrollIntoView({ behavior: "smooth", block: "start" });
    if (pushHash && history.replaceState) history.replaceState(null, "", "#" + item.slug);
    readerEl.querySelector("[data-us-close]")?.addEventListener("click", () => { readerEl.hidden = true; });
    readerEl.querySelector("[data-us-prev]")?.addEventListener("click", () => {
      if (filtered.length) openItem(filtered[(currentIdx - 1 + filtered.length) % filtered.length], true);
    });
    readerEl.querySelector("[data-us-next]")?.addEventListener("click", () => {
      if (filtered.length) openItem(filtered[(currentIdx + 1) % filtered.length], true);
    });
  }

  function render() {
    const q = (searchEl?.value || "").trim().toLowerCase();
    const toks = q ? q.split(/\s+/) : [];
    filtered = items.filter((it) => {
      if (activeCat !== "all" && it.category !== activeCat) return false;
      if (!toks.length) return true;
      const hay = `${it.title} ${it.description} ${it.category} ${it.slug} ${it.excerpt}`.toLowerCase();
      return toks.every((t) => hay.includes(t));
    });
    if (statusEl) statusEl.textContent = `Showing ${filtered.length} of ${items.length} records`;
    const slice = filtered.slice(0, 120);
    gridEl.innerHTML = slice.map((it) => `
      <article class="us-card" id="card-${esc(it.slug)}">
        <div class="us-card-meta"><span>${esc(it.category)}</span><span>${it.word_count ? it.word_count + " words" : "record"}</span></div>
        <h3>${esc(it.title)}</h3>
        <p>${esc((it.description || it.excerpt || "").slice(0, 180))}</p>
        <div class="us-card-actions">
          <button type="button" class="us-card-btn" data-open-slug="${esc(it.slug)}">Read full record</button>
          ${it.repos && it.repos[0] ? `<a class="us-btn" href="${esc(it.repos[0])}">Source</a>` : ""}
        </div>
      </article>`).join("");
  }

  gridEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open-slug]");
    if (!btn) return;
    const found = items.find((i) => i.slug === btn.dataset.openSlug);
    if (found) openItem(found, true);
  });

  if (searchEl) searchEl.addEventListener("input", render);
  render();

  const openFromHash = () => {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!h) return;
    const found = items.find((i) => i.slug === h || i.old_path?.endsWith("/" + h + ".html"));
    if (found) openItem(found, false);
  };
  openFromHash();
  window.addEventListener("hashchange", openFromHash);
}

export function initUnifiedSurfaces() {
  initSpecimenPlates();
  initSmoothRails();
  initLightbox();
  initTabs();
  document.querySelectorAll("[data-us-pack]").forEach((el) => { mountUnifiedPack(el); });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUnifiedSurfaces);
} else {
  initUnifiedSurfaces();
}
