// architecture.js: Progressive enhancement for the interactive 5-platform architecture graph,
// Full Body of Work launcher, 6 Project Family Trees switcher, 14-lane frontier explorer,
// Concept Web & Thinkers filters, and dataset filter. Zero external dependencies.
const root = document.querySelector("[data-arch-root]");
if (root) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // 1. Interactive 5-platform architecture graph & inspector
  const dataEl = document.getElementById("arch-graph-data");
  const inspector = document.getElementById("arch-inspector");
  if (dataEl && inspector) {
    const payload = JSON.parse(dataEl.textContent || "{}");
    const byId = Object.fromEntries((payload.platforms || []).map((p) => [p.id, p]));
    const icons = payload.icons || {};
    const btns = [...root.querySelectorAll("[data-graph-pick]")];
    const nodes = [...root.querySelectorAll("[data-graph-node]")];
    const edges = [...root.querySelectorAll("[data-graph-edge]")];
    const pills = [...root.querySelectorAll("[data-graph-edge-pill]")];
    const labels = [...root.querySelectorAll("[data-graph-edge-label]")];

    const renderInspector = (id) => {
      if (id === "all") {
        inspector.removeAttribute("data-plat");
        inspector.innerHTML = `<h3>All Five Platforms Connected</h3>
          <p class="graph-inspector-mark">7 verified cross-platform flows / one field</p>
          <p>BuildLang compiles bit-exact kernels for The Playground and hashes builds for The Flywheel. The Playground sends engine-receipt/1 render proofs into The Flywheel. The Commons feeds claim threads and the 43K archive to The Flywheel and Research, and Research loops calibration suites back into The Playground.</p>
          <p class="graph-verified"><b>Verified:</b> 25 November 2026: all five platforms live on GitHub with cross-platform receipt schemas and open benchmark datasets.</p>`;
        return;
      }
      const p = byId[id];
      if (!p) return;
      inspector.setAttribute("data-plat", p.hue);
      const links = (p.links || []).map(([h, t]) => `<a href="${esc(h)}">${esc(t)}</a>`).join("");
      inspector.innerHTML = `<h3>${icons[p.id] || ""}${esc(p.title)}</h3>
        <p class="graph-inspector-mark">${esc(p.mark)} / ${esc(p.repoLabel)}</p>
        <p>${esc(p.what)}</p>
        <dl class="graph-io">
          <dt>Consumes</dt><dd>${esc(p.consumes)}</dd>
          <dt>Produces</dt><dd>${esc(p.produces)}</dd>
          <dt>Interoperability contract</dt><dd>${esc(p.contract)}</dd>
        </dl>
        <code class="graph-cmd">${esc(p.run)}</code>
        <nav class="graph-links" aria-label="${esc(p.title)} links">${links}</nav>
        <p class="graph-verified"><b>Verified:</b> ${esc(p.verified)}</p>`;
    };

    const selectPlatform = (id) => {
      btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.graphPick === id)));
      const connected = new Set([id]);
      edges.forEach((e) => {
        const hit = id === "all" || e.dataset.from === id || e.dataset.to === id;
        if (hit && id !== "all") { connected.add(e.dataset.from); connected.add(e.dataset.to); }
        e.classList.toggle("is-active", hit);
        e.classList.toggle("is-dim", !hit);
      });
      [...pills, ...labels].forEach((el) => {
        const hit = id === "all" || el.dataset.from === id || el.dataset.to === id;
        el.classList.toggle("is-active", hit);
        el.classList.toggle("is-dim", !hit);
      });
      nodes.forEach((n) => {
        const nid = n.dataset.graphNode;
        const sel = id !== "all" && nid === id;
        n.classList.toggle("is-selected", sel);
        n.classList.toggle("is-dim", id !== "all" && !connected.has(nid));
        n.setAttribute("aria-pressed", String(sel));
      });
      renderInspector(id);
    };

    btns.forEach((b) => b.addEventListener("click", () => selectPlatform(b.dataset.graphPick)));
    nodes.forEach((n) => {
      n.addEventListener("click", () => selectPlatform(n.dataset.graphNode));
      n.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selectPlatform(n.dataset.graphNode); }
      });
    });
    selectPlatform("playground");
  }

  // 2. Full Body of Work Launcher (category filter + instant search + copy command)
  const bowBtns = [...root.querySelectorAll("[data-bow-cat]")];
  const bowCards = [...root.querySelectorAll("[data-bow-card]")];
  const bowSearch = document.getElementById("bow-search");
  const bowStatus = document.getElementById("bow-status");
  if (bowCards.length) {
    let activeCat = "all";
    const applyBow = () => {
      const q = (bowSearch?.value || "").trim().toLowerCase();
      let shown = 0;
      bowCards.forEach((c) => {
        const catOk = activeCat === "all" || c.dataset.bowCat === activeCat;
        const textOk = !q || (c.dataset.bowSearch || "").includes(q);
        const show = catOk && textOk;
        c.hidden = !show;
        if (show) shown += 1;
      });
      if (bowStatus) bowStatus.textContent = `${shown} of ${bowCards.length} projects shown`;
    };
    bowBtns.forEach((b) => b.addEventListener("click", () => {
      activeCat = b.dataset.bowCat || "all";
      bowBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      applyBow();
    }));
    if (bowSearch) bowSearch.addEventListener("input", applyBow);
  }

  // Copy command buttons
  root.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-copy") || "";
      try {
        await navigator.clipboard.writeText(text);
        const prev = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => { btn.textContent = prev || "Copy"; }, 1400);
      } catch {
        btn.textContent = "Select";
      }
    });
  });

  // 3. Project Family Trees tab switcher (with arrow-key keyboard nav)
  const lineageTabs = [...root.querySelectorAll("[data-lineage-tab]")];
  const lineagePanels = [...root.querySelectorAll("[data-lineage-panel]")];
  if (lineageTabs.length && lineagePanels.length) {
    const activateTab = (id, focusTab = false) => {
      lineageTabs.forEach((t) => {
        const on = t.dataset.lineageTab === id;
        t.setAttribute("aria-selected", String(on));
        t.setAttribute("tabindex", on ? "0" : "-1");
        if (on && focusTab) t.focus();
      });
      lineagePanels.forEach((p) => { p.hidden = p.dataset.lineagePanel !== id; });
    };
    lineageTabs.forEach((t, idx) => {
      t.addEventListener("click", () => activateTab(t.dataset.lineageTab));
      t.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowRight") { ev.preventDefault(); activateTab(lineageTabs[(idx + 1) % lineageTabs.length].dataset.lineageTab, true); }
        if (ev.key === "ArrowLeft") { ev.preventDefault(); activateTab(lineageTabs[(idx - 1 + lineageTabs.length) % lineageTabs.length].dataset.lineageTab, true); }
      });
    });
  }

  // 4. 14 Global-Frontier Engineering Lanes filter + expand/collapse all
  const frBtns = [...root.querySelectorAll("[data-fr-filter]")];
  const frCards = [...root.querySelectorAll("[data-fr-card]")];
  const frStatus = document.getElementById("fr-status");
  const frToggleAll = document.getElementById("fr-toggle-all");
  if (frCards.length) {
    frBtns.forEach((b) => b.addEventListener("click", () => {
      const pick = b.dataset.frFilter || "all";
      frBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      let shown = 0;
      frCards.forEach((c) => {
        const groups = (c.dataset.frGroups || "").split(/\s+/);
        const show = pick === "all" || groups.includes(pick);
        c.hidden = !show;
        if (show) shown += 1;
      });
      if (frStatus) frStatus.textContent = `${shown} of ${frCards.length} lanes shown`;
    }));
    if (frToggleAll) {
      frToggleAll.addEventListener("click", () => {
        const openAll = frToggleAll.getAttribute("aria-pressed") !== "true";
        frToggleAll.setAttribute("aria-pressed", String(openAll));
        frToggleAll.textContent = openAll ? "Collapse all" : "Expand all";
        frCards.forEach((c) => { if (!c.hidden) c.open = openAll; });
      });
    }
  }

  // 5. Concept Web layer filter + 50 Thinkers filter/search
  const cwBtns = [...root.querySelectorAll("[data-cw-layer]")];
  const cwNodes = [...root.querySelectorAll("[data-cw-node]")];
  const cwStatus = document.getElementById("cw-status");
  if (cwNodes.length) {
    cwBtns.forEach((b) => b.addEventListener("click", () => {
      const pick = b.dataset.cwLayer || "all";
      cwBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      let shown = 0;
      cwNodes.forEach((n) => {
        const show = pick === "all" || n.dataset.cwLayer === pick;
        n.hidden = !show;
        if (show) shown += 1;
      });
      if (cwStatus) cwStatus.textContent = `${shown} of ${cwNodes.length} nodes shown`;
    }));
  }

  const thBtns = [...root.querySelectorAll("[data-th-group]")];
  const thRows = [...root.querySelectorAll("[data-th-row]")];
  const thSearch = document.getElementById("th-search");
  const thStatus = document.getElementById("th-status");
  if (thRows.length) {
    let activeTh = "all";
    const applyTh = () => {
      const q = (thSearch?.value || "").trim().toLowerCase();
      let shown = 0;
      thRows.forEach((r) => {
        const grpOk = activeTh === "all" || r.dataset.thGroup === activeTh;
        const txtOk = !q || (r.dataset.thSearch || "").includes(q);
        const show = grpOk && txtOk;
        r.hidden = !show;
        if (show) shown += 1;
      });
      if (thStatus) thStatus.textContent = `${shown} of ${thRows.length} thinkers shown`;
    };
    thBtns.forEach((b) => b.addEventListener("click", () => {
      activeTh = b.dataset.thGroup || "all";
      thBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      applyTh();
    }));
    if (thSearch) thSearch.addEventListener("input", applyTh);
  }

  // 6. Dataset platform filter
  const dsButtons = [...root.querySelectorAll("[data-ds-filter]")];
  const dsRows = [...root.querySelectorAll("[data-ds-row]")];
  const dsStatus = document.getElementById("ds-filter-status");
  if (dsButtons.length && dsRows.length) {
    dsButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const pick = btn.dataset.dsFilter;
        dsButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        let shown = 0;
        dsRows.forEach((row) => {
          const plats = (row.dataset.dsPlatform || "").split(/\s+/);
          const show = pick === "all" || plats.includes(pick);
          row.hidden = !show;
          if (show) shown += 1;
        });
        if (dsStatus) dsStatus.textContent = `${shown} of ${dsRows.length} datasets shown`;
      });
    });
  }
}
