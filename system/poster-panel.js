// poster-panel.js: the typography workshop's control surface and loop.
// Builds its own DOM into a mount node; everything else arrives injected
// (renderSpecimen, layer names, perceive, say, detail getters), so the module
// stays dependency-light and node-checkable. The loop:
//   controls -> renderPoster -> perceive -> critiquePoster -> findings
// and every "fix" finding that names a better cell carries an APPLY button -
// the model's suggestion is one click from being taken. That is the
// collaboration: person adjusts, engine draws, the same measured packet the
// model reads produces advice, the person accepts or overrules.

import {
  defaultPosterState, renderPoster, critiquePoster,
  POSTER_FORMATS, POSTER_FACES, POSTER_CELLS,
} from "./poster.js";

const PALETTE = ["#f2ecf7", "#c9c2d4", "#8f86a0", "#7de3ea", "#99f147", "#f8cc43", "#ff8334", "#ff35aa", "#111016"];

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function chipRow(labels, current, onPick, cls = "at-chip") {
  const row = el("div", "at-chips");
  const set = (value) => {
    [...row.children].forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.value === value)));
  };
  for (const [value, label] of labels) {
    const b = el("button", cls, label);
    b.type = "button";
    b.dataset.value = value;
    b.setAttribute("aria-pressed", String(value === current));
    b.addEventListener("click", () => { set(value); onPick(value); });
    row.appendChild(b);
  }
  return row;
}

// The 3x3 cell picker: a tiny grid sharing the perception grid's names.
function cellPicker(current, onPick) {
  const wrap = el("div", "poster-cellpick");
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "Placement cell");
  POSTER_CELLS.forEach((name) => {
    const b = el("button", "poster-cell");
    b.type = "button";
    b.title = name;
    b.setAttribute("aria-label", "Place in " + name);
    b.setAttribute("aria-pressed", String(name === current));
    b.dataset.cell = name;
    b.addEventListener("click", () => {
      [...wrap.children].forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      onPick(name);
    });
    wrap.appendChild(b);
  });
  return wrap;
}

function swatchRow(current, onPick) {
  const row = el("div", "poster-swatches");
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "Type color");
  for (const hex of PALETTE) {
    const b = el("button", "poster-swatch");
    b.type = "button";
    b.style.background = hex;
    b.title = hex;
    b.setAttribute("aria-label", "Type color " + hex);
    b.setAttribute("aria-pressed", String(hex.toLowerCase() === String(current).toLowerCase()));
    b.addEventListener("click", () => {
      [...row.children].forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      onPick(hex);
    });
    row.appendChild(b);
  }
  return row;
}

export function mountPosterWorkshop(deps) {
  const { mount, canvas, renderSpecimen, layerNames, say, perceiveNow, getDetail, getRich, download } = deps;
  if (!mount || !canvas) return null;

  const state = defaultPosterState("workshop-" + new Date().toISOString().slice(0, 10));
  let lastBoxes = [];
  let renderT = 0;

  const root = el("div", "poster-panel");
  mount.innerHTML = "";
  mount.appendChild(root);

  const status = el("p", "poster-status");
  status.setAttribute("role", "status");

  // ── render loop (debounced) ────────────────────────────────────────────────
  function renderNow() {
    const out = renderPoster(canvas, state, { renderSpecimen });
    lastBoxes = out.boxes || [];
    if (typeof perceiveNow === "function") { try { perceiveNow(canvas); } catch (_) {} }
    return out;
  }
  function queueRender() {
    clearTimeout(renderT);
    renderT = setTimeout(() => { renderNow(); critiqueNow(false); }, 160);
  }

  // ── the critique ───────────────────────────────────────────────────────────
  const critiqueHost = el("div", "poster-critique");
  function critiqueNow(speak = true) {
    const detail = typeof getDetail === "function" ? getDetail() : null;
    const rich = typeof getRich === "function" ? getRich() : null;
    const findings = critiquePoster(lastBoxes, detail, rich);
    critiqueHost.innerHTML = "";
    for (const f of findings) {
      const row = el("div", "poster-finding poster-" + f.level);
      row.appendChild(el("span", "poster-flevel", f.level));
      row.appendChild(el("span", "poster-ftext", f.text));
      // One-click collaboration: a busy-region fix that names a calmer cell
      // gains an APPLY button that moves the block there.
      const cellMatch = f.level === "fix" && f.text.match(/calmest cell is ([a-z-]+)/);
      const blockMatch = f.text.match(/^The (headline|standfirst|folio)/);
      if (cellMatch && blockMatch && POSTER_CELLS.includes(cellMatch[1])) {
        const apply = el("button", "poster-apply", "apply");
        apply.type = "button";
        apply.setAttribute("aria-label", `Move the ${blockMatch[1]} to ${cellMatch[1]}`);
        apply.addEventListener("click", () => {
          const block = state.blocks.find((b) => b.kind === blockMatch[1]);
          if (block) { block.cell = cellMatch[1]; rebuildBlockEditors(); renderNow(); critiqueNow(true); }
        });
        row.appendChild(apply);
      }
      critiqueHost.appendChild(row);
    }
    if (speak && typeof say === "function") {
      const spoken = findings.slice(0, 3).map((f) => f.text).join(" ");
      say("model", "Reading the poster with the same eyes as the packet: " + spoken);
    }
    return findings;
  }

  // ── controls ───────────────────────────────────────────────────────────────
  // format
  const gFormat = el("div", "at-group");
  gFormat.appendChild(el("span", "at-glab", "Format"));
  gFormat.appendChild(chipRow(Object.entries(POSTER_FORMATS).map(([k, v]) => [k, v.label]), state.format, (v) => { state.format = v; queueRender(); }));
  root.appendChild(gFormat);

  // art
  const gArt = el("div", "at-group");
  gArt.appendChild(el("span", "at-glab", "Art instrument"));
  const names = (typeof layerNames === "function" ? layerNames() : []) || [];
  const artSel = el("div", "poster-artchips at-chips");
  names.forEach((name) => {
    const b = el("button", "at-chip", name);
    b.type = "button";
    b.setAttribute("aria-pressed", String(state.art.layers.includes(name)));
    b.addEventListener("click", () => {
      state.art.layers = [name];
      [...artSel.children].forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      queueRender();
    });
    artSel.appendChild(b);
  });
  gArt.appendChild(artSel);
  const artRow = el("div", "poster-artrow");
  const seedIn = el("input", "poster-seed");
  seedIn.type = "text"; seedIn.maxLength = 40; seedIn.value = state.art.seed;
  seedIn.setAttribute("aria-label", "Art seed");
  seedIn.addEventListener("input", () => { state.art.seed = seedIn.value.trim() || "workshop"; queueRender(); });
  const reroll = el("button", "at-mini", "reroll art");
  reroll.type = "button";
  reroll.addEventListener("click", () => {
    state.art.seed = "ws-" + Math.random().toString(36).slice(2, 8);
    seedIn.value = state.art.seed;
    renderNow(); critiqueNow(false);
  });
  artRow.appendChild(seedIn); artRow.appendChild(reroll);
  gArt.appendChild(artRow);
  const veilLab = el("label", "poster-veil-label");
  veilLab.appendChild(el("span", "at-glab", "Legibility veil"));
  const veil = el("input", "at-slider");
  veil.type = "range"; veil.min = "0"; veil.max = "0.85"; veil.step = "0.05"; veil.value = String(state.art.veil);
  veil.setAttribute("aria-label", "Darkening veil over the art, for type legibility");
  veil.addEventListener("input", () => { state.art.veil = Number(veil.value); queueRender(); });
  veilLab.appendChild(veil);
  gArt.appendChild(veilLab);
  root.appendChild(gArt);

  // blocks
  const gBlocks = el("div", "at-group poster-blocks");
  function rebuildBlockEditors() {
    gBlocks.innerHTML = "";
    gBlocks.appendChild(el("span", "at-glab", "Type blocks"));
    for (const block of state.blocks) {
      const box = el("details", "poster-block");
      if (block.kind === "headline") box.open = true;
      const sum = el("summary", null, block.kind);
      box.appendChild(sum);
      const text = el("textarea", "poster-text");
      text.value = block.text; text.rows = block.kind === "headline" ? 2 : 2;
      text.setAttribute("aria-label", block.kind + " text");
      text.addEventListener("input", () => { block.text = text.value; queueRender(); });
      box.appendChild(text);
      box.appendChild(el("span", "poster-mini-label", "face"));
      box.appendChild(chipRow(Object.keys(POSTER_FACES).map((k) => [k, k]), block.face, (v) => { block.face = v; queueRender(); }));
      box.appendChild(el("span", "poster-mini-label", "size"));
      const size = el("input", "at-slider");
      size.type = "range"; size.min = "0.01"; size.max = "0.16"; size.step = "0.002"; size.value = String(block.size);
      size.setAttribute("aria-label", block.kind + " size");
      size.addEventListener("input", () => { block.size = Number(size.value); queueRender(); });
      box.appendChild(size);
      box.appendChild(el("span", "poster-mini-label", "tracking"));
      const tr = el("input", "at-slider");
      tr.type = "range"; tr.min = "0"; tr.max = "0.4"; tr.step = "0.01"; tr.value = String(block.tracking);
      tr.setAttribute("aria-label", block.kind + " tracking");
      tr.addEventListener("input", () => { block.tracking = Number(tr.value); queueRender(); });
      box.appendChild(tr);
      box.appendChild(el("span", "poster-mini-label", "placement"));
      box.appendChild(cellPicker(block.cell, (name) => { block.cell = name; queueRender(); }));
      box.appendChild(el("span", "poster-mini-label", "color"));
      box.appendChild(swatchRow(block.color, (hex) => { block.color = hex; queueRender(); }));
      const caseRow = chipRow([["none", "As typed"], ["upper", "UPPER"], ["lower", "lower"]], block.caseMode, (v) => { block.caseMode = v; queueRender(); });
      box.appendChild(el("span", "poster-mini-label", "case"));
      box.appendChild(caseRow);
      gBlocks.appendChild(box);
    }
  }
  rebuildBlockEditors();
  root.appendChild(gBlocks);

  // actions
  const actions = el("div", "at-actions poster-actions");
  const mkBtn = (label, aria, fn) => {
    const b = el("button", "btn ghost", label);
    b.type = "button";
    b.setAttribute("aria-label", aria);
    b.addEventListener("click", fn);
    actions.appendChild(b);
    return b;
  };
  mkBtn("Render", "Render the poster", () => { renderNow(); critiqueNow(false); });
  mkBtn("Critique", "Ask for a measured critique of the poster", () => { renderNow(); critiqueNow(true); });
  mkBtn("PNG", "Download the poster as PNG", () => {
    try {
      canvas.toBlob((blob) => {
        if (blob && typeof download === "function") download(blob, "telos-poster-" + state.art.seed + ".png");
      }, "image/png");
    } catch (_) { status.textContent = "PNG export failed"; }
  });
  mkBtn("Plot SVG", "Convert the poster art to plotter SVG", async () => {
    try {
      const plot = await import("./plotter.js");
      const { svg } = plot.plotCanvas(canvas, { style: "flow", seed: state.art.seed });
      if (typeof download === "function") download(new Blob([svg], { type: "image/svg+xml" }), "telos-poster-plot-" + state.art.seed + ".svg");
    } catch (e) { status.textContent = "plot failed: " + e.message; }
  });
  root.appendChild(actions);
  root.appendChild(status);
  root.appendChild(el("span", "at-glab", "The read"));
  root.appendChild(critiqueHost);

  // first render
  renderNow();
  critiqueNow(false);
  if (typeof say === "function") {
    say("model", "The workshop is live. Set the type, pick an instrument for the art, and ask for a critique - I read the poster through the same measured packet I receive, so every note carries its numbers.");
  }

  return {
    state,
    render: renderNow,
    critique: critiqueNow,
    setArtSeed(seed) { state.art.seed = seed; seedIn.value = seed; renderNow(); critiqueNow(false); },
    destroy() { clearTimeout(renderT); mount.innerHTML = ""; },
  };
}
