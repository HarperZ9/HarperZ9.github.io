// architecture.js: interactive platform architecture graph inspector and dataset filter.
// Zero dependencies, keyboard accessible, full static fallback when scripts are off, honors prefers-reduced-motion.

const root = document.querySelector("[data-arch-root]");
if (root) {
  const dataEl = document.getElementById("arch-graph-data");
  const data = dataEl ? JSON.parse(dataEl.textContent) : null;

  if (data) {
    const nodes = [...root.querySelectorAll("[data-graph-node]")];
    const buttons = [...root.querySelectorAll("[data-graph-pick]")];
    const edges = [...root.querySelectorAll("[data-graph-edge]")];
    const edgeLabels = [...root.querySelectorAll("[data-graph-edge-label]")];
    const edgePills = [...root.querySelectorAll("[data-graph-edge-pill]")];
    const inspector = document.getElementById("arch-inspector");
    const byId = new Map(data.platforms.map((p) => [p.id, p]));
    const icons = new Map(Object.entries(data.icons || {}));

    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined) n.textContent = text;
      return n;
    };

    function renderInspector(id) {
      const p = byId.get(id);
      if (!p || !inspector) return;
      inspector.dataset.plat = p.hue;

      const frag = document.createDocumentFragment();
      const h3 = el("h3");
      const iconSvg = icons.get(p.id);
      if (iconSvg) {
        const tpl = document.createElement("template");
        tpl.innerHTML = iconSvg;
        h3.appendChild(tpl.content);
      }
      h3.appendChild(document.createTextNode(p.title));
      frag.appendChild(h3);

      frag.appendChild(el("p", "graph-inspector-mark", `${p.mark} / ${p.repoLabel}`));
      frag.appendChild(el("p", "", p.what));

      const dl = el("dl", "graph-io");
      const addRow = (label, value) => {
        dl.appendChild(el("dt", "", label));
        dl.appendChild(el("dd", "", value));
      };
      addRow("Consumes", p.consumes);
      addRow("Produces", p.produces);
      addRow("Interoperability contract", p.contract);
      frag.appendChild(dl);

      frag.appendChild(el("code", "graph-cmd", p.run));

      const nav = el("nav", "graph-links");
      nav.setAttribute("aria-label", `${p.title} links`);
      for (const [href, label] of p.links) {
        const a = el("a", "", label);
        a.href = href;
        nav.appendChild(a);
      }
      frag.appendChild(nav);

      const ver = el("p", "graph-verified");
      const b = el("b", "", "Verified: ");
      ver.appendChild(b);
      ver.appendChild(document.createTextNode(p.verified));
      frag.appendChild(ver);

      inspector.replaceChildren(frag);
    }

    function selectPlatform(id) {
      const showAll = id === "all";
      for (const btn of buttons) {
        btn.setAttribute("aria-pressed", String(btn.dataset.graphPick === id));
      }
      const connected = new Set([id]);
      for (const edge of edges) {
        const from = edge.dataset.from;
        const to = edge.dataset.to;
        const hit = showAll || from === id || to === id;
        edge.classList.toggle("is-active", !showAll && hit);
        edge.classList.toggle("is-dim", !showAll && !hit);
        if (hit && !showAll) {
          connected.add(from);
          connected.add(to);
        }
      }
      for (const lbl of edgeLabels) {
        const hit = showAll || lbl.dataset.from === id || lbl.dataset.to === id;
        lbl.classList.toggle("is-active", !showAll && hit);
        lbl.classList.toggle("is-dim", !showAll && !hit);
      }
      for (const pill of edgePills) {
        const hit = showAll || pill.dataset.from === id || pill.dataset.to === id;
        pill.classList.toggle("is-active", !showAll && hit);
        pill.classList.toggle("is-dim", !showAll && !hit);
      }
      for (const node of nodes) {
        const nid = node.dataset.graphNode;
        node.classList.toggle("is-selected", !showAll && nid === id);
        node.classList.toggle("is-dim", !showAll && !connected.has(nid));
        node.setAttribute("aria-pressed", String(!showAll && nid === id));
      }
      renderInspector(showAll ? data.platforms[0].id : id);
    }

    for (const btn of buttons) {
      btn.addEventListener("click", () => selectPlatform(btn.dataset.graphPick));
    }
    for (const node of nodes) {
      node.addEventListener("click", () => selectPlatform(node.dataset.graphNode));
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectPlatform(node.dataset.graphNode);
        }
      });
    }
    selectPlatform(data.platforms[0].id);
  }

  // Dataset filter buttons
  const filterBtns = [...root.querySelectorAll("[data-ds-filter]")];
  const dsRows = [...root.querySelectorAll("[data-ds-row]")];
  const dsStatus = document.getElementById("ds-filter-status");
  if (filterBtns.length && dsRows.length) {
    const applyFilter = (key) => {
      let shown = 0;
      for (const btn of filterBtns) {
        btn.setAttribute("aria-pressed", String(btn.dataset.dsFilter === key));
      }
      for (const row of dsRows) {
        const match = key === "all" || (row.dataset.dsPlatform || "").split(" ").includes(key);
        row.hidden = !match;
        if (match) shown++;
      }
      if (dsStatus) dsStatus.textContent = `${shown} of ${dsRows.length} datasets shown`;
    };
    for (const btn of filterBtns) {
      btn.addEventListener("click", () => applyFilter(btn.dataset.dsFilter));
    }
  }
}
