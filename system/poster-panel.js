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
  POSTER_FORMATS, POSTER_CELLS, POSTER_BLOCK_KINDS, posterBlockLabel, defaultPosterBlock,
} from "./poster.js?v=20260907-flex-composition";
import { renderRetro } from "./retro-engine.js";
import { applyOpsWet, OP_META } from "./glitch-ops.js";
import { encodePosterProject, decodePosterProject, validateProjectImage, MAX_PROJECT_BYTES } from "./poster-project.js?v=20260907-flex-composition";
import { mountLibrarySave, captureCanvasPreview } from "./project-library-controls.js?v=20260907-workspace";

const PALETTE = ["#f2ecf7", "#c9c2d4", "#8f86a0", "#7de3ea", "#99f147", "#f8cc43", "#ff8334", "#ff35aa", "#111016"];
const HISTORY_LIMIT = 60;
const MIN_BLOCKS = 1;
const MAX_BLOCKS = 8;

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundPosition(value) {
  return Number(value.toFixed(5));
}

export function applyPosterBlockPosition(block, box, point, grabOffset = {}) {
  if (!block || !box || !point) return false;
  const px = finite(point.x);
  const py = finite(point.y);
  if (px == null || py == null) return false;
  const x0 = finite(box.x0);
  const y0 = finite(box.y0);
  const x1 = finite(box.x1);
  const y1 = finite(box.y1);
  if (x0 == null || y0 == null || x1 == null || y1 == null) return false;
  const ox = finite(grabOffset.x) ?? 0;
  const oy = finite(grabOffset.y) ?? 0;
  const boxW = clamp(x1 - x0, 0, 1);
  const boxH = clamp(y1 - y0, 0, 1);
  block.position = {
    x: roundPosition(clamp(px - ox, 0, Math.max(0, 1 - boxW))),
    y: roundPosition(clamp(py - oy, 0, Math.max(0, 1 - boxH))),
  };
  return true;
}

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
function cellPicker(current, onPick, label = "Placement cell") {
  const wrap = el("div", "poster-cellpick");
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", label);
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
  const {
    mount, canvas, renderSpecimen, layerNames, say, perceiveNow, getDetail,
    getRich, download, isActive, resetViewTransform,
  } = deps;
  if (!mount || !canvas) return null;

  const state = defaultPosterState("workshop-" + new Date().toISOString().slice(0, 10));
  let lastBoxes = [];
  let renderT = 0;
  let imageImportEpoch = 0;
  let overlayRaf = 0;
  let dragRaf = 0;
  let resizeObserver = null;
  let selectedIndex = -1;
  let active = typeof isActive === "function" ? !!isActive() : true;
  let drag = null;
  const undoStack = [];
  const redoStack = [];
  const blockEditorNodes = [];
  let undoBtn = null;
  let redoBtn = null;
  let resetPositionsBtn = null;
  let imgInput = null;
  let imgClear = null;

  const root = el("div", "poster-panel");
  mount.innerHTML = "";
  mount.appendChild(root);

  const status = el("p", "poster-status");
  status.setAttribute("role", "status");

  const stage = canvas.closest(".viewport-stage") || canvas.parentElement;
  const overlay = stage ? el("div", "poster-stage-overlay") : null;
  if (overlay) {
    overlay.hidden = true;
    overlay.tabIndex = 0;
    overlay.setAttribute("aria-label", "Poster text blocks");
    overlay.setAttribute("aria-hidden", "true");
    stage.appendChild(overlay);
  }

  // Cover-draw an image into the poster's fixed format dimensions (renderPoster
  // has already sized the canvas), so an imported photo becomes the art layer.
  function coverDrawImage(cv, img) {
    const ctx = cv.getContext("2d");
    if (!ctx || !img) return;
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const cover = Math.max(cv.width / iw, cv.height / ih);
    const dw = iw * cover, dh = ih * cover;
    ctx.drawImage(img, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
  }

  function drawableDimensions(image) {
    if (!image) return null;
    const width = finite(image.naturalWidth ?? image.videoWidth ?? image.width);
    const height = finite(image.naturalHeight ?? image.videoHeight ?? image.height);
    return width != null && height != null && width > 0 && height > 0 ? { width, height } : null;
  }

  function setArtImage(image) {
    if (!image) {
      state.art.image = null;
      if (imgClear) imgClear.hidden = true;
      if (imgInput) imgInput.value = "";
      renderNow();
      critiqueNow(false);
      status.textContent = "Poster art returned to instruments";
      return true;
    }
    if (!drawableDimensions(image)) {
      status.textContent = "Poster art image could not be read";
      return false;
    }
    state.art.image = image;
    if (imgClear) imgClear.hidden = false;
    renderNow();
    critiqueNow(false);
    status.textContent = "Poster art image received";
    return true;
  }

  function blockName(index) {
    const block = state.blocks[index];
    return block ? `${posterBlockLabel(block.kind)} ${index + 1}` : "block";
  }

  function blockSummary(index) {
    const block = state.blocks[index];
    return block ? blockName(index) : "Text block";
  }

  function cloneBlock(block) {
    return JSON.parse(JSON.stringify(block || defaultPosterBlock("standfirst")));
  }

  function clearPlacementHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    syncHistoryButtons();
  }

  function focusBlockText(index) {
    if (typeof requestAnimationFrame !== "function") return;
    requestAnimationFrame(() => {
      const entry = blockEditorNodes[index];
      if (entry?.text) {
        try { entry.text.focus({ preventScroll: true }); } catch (_) { entry.text.focus(); }
      }
    });
  }

  function finishStructuralEdit(index, message) {
    selectedIndex = Math.max(0, Math.min(index, state.blocks.length - 1));
    clearPlacementHistory();
    rebuildBlockEditors();
    renderNow();
    critiqueNow(false);
    selectBlock(selectedIndex, { announce: false });
    focusBlockText(selectedIndex);
    status.textContent = message;
  }

  function addBlock() {
    if (state.blocks.length >= MAX_BLOCKS) return;
    const block = defaultPosterBlock("standfirst");
    block.cell = POSTER_CELLS[state.blocks.length % POSTER_CELLS.length] || "center";
    state.blocks.push(block);
    finishStructuralEdit(state.blocks.length - 1, "Text block added");
  }

  function duplicateBlock(index) {
    if (state.blocks.length >= MAX_BLOCKS || !state.blocks[index]) return;
    const copy = cloneBlock(state.blocks[index]);
    state.blocks.splice(index + 1, 0, copy);
    finishStructuralEdit(index + 1, "Text block duplicated");
  }

  function removeBlock(index) {
    if (state.blocks.length <= MIN_BLOCKS || !state.blocks[index]) return;
    state.blocks.splice(index, 1);
    finishStructuralEdit(Math.min(index, state.blocks.length - 1), "Text block removed");
  }

  function moveBlock(index, delta) {
    const next = index + delta;
    if (!state.blocks[index] || !state.blocks[next]) return;
    const [block] = state.blocks.splice(index, 1);
    state.blocks.splice(next, 0, block);
    finishStructuralEdit(next, delta < 0 ? "Text block moved earlier" : "Text block moved later");
  }

  function clonePosition(pos) {
    const x = pos ? finite(pos.x) : null;
    const y = pos ? finite(pos.y) : null;
    return x == null || y == null ? null : { x: roundPosition(x), y: roundPosition(y) };
  }

  function snapshotPlacement() {
    return state.blocks.map((block) => ({
      cell: block.cell || "center",
      position: clonePosition(block.position),
    }));
  }

  function samePlacement(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function restorePlacement(snapshot) {
    snapshot.forEach((item, index) => {
      const block = state.blocks[index];
      if (!block || !item) return;
      block.cell = item.cell || block.cell || "center";
      if (item.position) block.position = { ...item.position };
      else delete block.position;
    });
    syncBlockEditors();
  }

  function syncHistoryButtons() {
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
    if (resetPositionsBtn) resetPositionsBtn.disabled = !state.blocks.some((block) => clonePosition(block.position));
  }

  function pushPlacement(label, before, after = snapshotPlacement()) {
    if (!before || samePlacement(before, after)) {
      syncHistoryButtons();
      return false;
    }
    undoStack.push({ label, before, after });
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    syncHistoryButtons();
    return true;
  }

  function positionLabel(block) {
    const pos = clonePosition(block.position);
    if (!pos) return `cell ${block.cell || "center"}`;
    return `free x ${Math.round(pos.x * 100)}%, y ${Math.round(pos.y * 100)}%`;
  }

  function syncBlockEditors() {
    blockEditorNodes.forEach((entry, index) => {
      if (!entry || !state.blocks[index]) return;
      const selected = index === selectedIndex;
      entry.box.classList.toggle("is-selected", selected);
      entry.box.setAttribute("aria-current", selected ? "true" : "false");
      if (selected) entry.box.open = true;
      if (entry.position) entry.position.textContent = positionLabel(state.blocks[index]);
    });
    syncHistoryButtons();
  }

  function queueOverlaySync(focusSelected = false) {
    if (!overlay || typeof requestAnimationFrame !== "function") return;
    if (overlayRaf) cancelAnimationFrame(overlayRaf);
    overlayRaf = requestAnimationFrame(() => {
      overlayRaf = 0;
      syncOverlay(focusSelected);
    });
  }

  function focusSelectedBox() {
    if (!overlay || selectedIndex < 0) return;
    const node = overlay.querySelector(`[data-poster-box="${selectedIndex}"]`);
    if (node) {
      try { node.focus({ preventScroll: true }); } catch (_) { node.focus(); }
    }
  }

  function syncOverlay(focusSelected = false) {
    if (!overlay) return;
    if (!active || !lastBoxes.length) {
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = "";
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    overlay.style.left = `${canvasRect.left - stageRect.left}px`;
    overlay.style.top = `${canvasRect.top - stageRect.top}px`;
    overlay.style.width = `${canvasRect.width}px`;
    overlay.style.height = `${canvasRect.height}px`;
    const keepFocus = overlay.contains(document.activeElement);
    overlay.innerHTML = "";
    lastBoxes.forEach((box, index) => {
      const block = state.blocks[index];
      if (!block || !String(block.text || "").trim()) return;
      const button = el("button", "poster-select-box");
      button.type = "button";
      button.dataset.posterBox = String(index);
      button.dataset.label = blockSummary(index);
      button.setAttribute("aria-label", `Select ${blockSummary(index)} text block`);
      button.setAttribute("aria-pressed", String(index === selectedIndex));
      button.style.left = `${Math.max(0, box.x0) * 100}%`;
      button.style.top = `${Math.max(0, box.y0) * 100}%`;
      button.style.width = `${Math.max(0.01, box.x1 - box.x0) * 100}%`;
      button.style.height = `${Math.max(0.01, box.y1 - box.y0) * 100}%`;
      overlay.appendChild(button);
    });
    if (focusSelected || keepFocus) focusSelectedBox();
  }

  function selectBlock(index, opts = {}) {
    selectedIndex = Number.isInteger(index) && state.blocks[index] ? index : -1;
    syncBlockEditors();
    queueOverlaySync(!!opts.focus);
    if (selectedIndex >= 0 && opts.announce !== false) {
      status.textContent = `${blockName(selectedIndex)} selected`;
    }
  }

  function pointFromEvent(event) {
    if (!overlay) return null;
    const rect = overlay.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  }

  function hitTest(point) {
    if (!point) return -1;
    for (let index = lastBoxes.length - 1; index >= 0; index -= 1) {
      const box = lastBoxes[index];
      if (point.x >= box.x0 && point.x <= box.x1 && point.y >= box.y0 && point.y <= box.y1) return index;
    }
    return -1;
  }

  function applyDragFrame() {
    if (!drag) return;
    const box = lastBoxes[drag.index];
    const block = state.blocks[drag.index];
    if (!box || !block) return;
    const before = clonePosition(block.position);
    if (applyPosterBlockPosition(block, box, drag.point, drag.offset)) {
      const after = clonePosition(block.position);
      drag.moved = drag.moved || JSON.stringify(before) !== JSON.stringify(after);
      renderNow({ perceive: false });
      syncBlockEditors();
    }
  }

  function scheduleDragFrame() {
    if (dragRaf || typeof requestAnimationFrame !== "function") return;
    dragRaf = requestAnimationFrame(() => {
      dragRaf = 0;
      applyDragFrame();
    });
  }

  function finishDrag(commit) {
    if (!drag) return;
    if (dragRaf) {
      cancelAnimationFrame(dragRaf);
      dragRaf = 0;
      applyDragFrame();
    }
    const finished = drag;
    drag = null;
    if (commit && finished.moved) {
      renderNow();
      pushPlacement(`Moved ${blockName(finished.index)}`, finished.before);
      critiqueNow(false);
      status.textContent = `${blockName(finished.index)} moved`;
    }
  }

  function cancelDrag(repaint = true) {
    if (!drag) return;
    const cancelled = drag;
    if (dragRaf) {
      cancelAnimationFrame(dragRaf);
      dragRaf = 0;
    }
    drag = null;
    restorePlacement(cancelled.before);
    if (repaint) renderNow({ perceive: false });
    else queueOverlaySync();
    status.textContent = "Move canceled";
  }

  function moveSelectedBy(dx, dy) {
    const box = lastBoxes[selectedIndex];
    const block = state.blocks[selectedIndex];
    if (!box || !block) return;
    const before = snapshotPlacement();
    const pos = clonePosition(block.position) || { x: box.x0, y: box.y0 };
    if (!applyPosterBlockPosition(block, box, { x: pos.x + dx, y: pos.y + dy }, { x: 0, y: 0 })) return;
    renderNow();
    syncBlockEditors();
    pushPlacement(`Moved ${blockName(selectedIndex)}`, before);
    critiqueNow(false);
    status.textContent = `${blockName(selectedIndex)} moved`;
  }

  function undoPlacement() {
    const entry = undoStack.pop();
    if (!entry) return;
    restorePlacement(entry.before);
    redoStack.push(entry);
    syncHistoryButtons();
    renderNow();
    critiqueNow(false);
    status.textContent = `Undid ${entry.label.toLowerCase()}`;
  }

  function redoPlacement() {
    const entry = redoStack.pop();
    if (!entry) return;
    restorePlacement(entry.after);
    undoStack.push(entry);
    syncHistoryButtons();
    renderNow();
    critiqueNow(false);
    status.textContent = `Redid ${entry.label.toLowerCase()}`;
  }

  function resetTextPositions() {
    const before = snapshotPlacement();
    state.blocks.forEach((block) => { delete block.position; });
    renderNow();
    syncBlockEditors();
    pushPlacement("Reset text positions", before);
    critiqueNow(false);
    status.textContent = "Text positions reset to cells";
  }

  function eventIsEditable(event) {
    const target = event.target;
    if (!target || target === overlay || (overlay && overlay.contains(target))) return false;
    const tag = String(target.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || !!target.isContentEditable;
  }

  function onOverlayPointerDown(event) {
    if (!active || !overlay) return;
    if (event.button != null && event.button !== 0) return;
    const point = pointFromEvent(event);
    const index = hitTest(point);
    event.preventDefault();
    event.stopPropagation();
    if (index < 0) {
      selectBlock(-1, { announce: false });
      status.textContent = "";
      return;
    }
    selectBlock(index, { focus: true });
    const box = lastBoxes[index];
    drag = {
      index,
      pointerId: event.pointerId,
      before: snapshotPlacement(),
      offset: { x: point.x - box.x0, y: point.y - box.y0 },
      point,
      moved: false,
    };
    try { overlay.setPointerCapture(event.pointerId); } catch (_) {}
  }

  function onOverlayPointerMove(event) {
    if (!active || !drag || event.pointerId !== drag.pointerId) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    drag.point = point;
    scheduleDragFrame();
  }

  function onOverlayPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    try { overlay.releasePointerCapture(event.pointerId); } catch (_) {}
    finishDrag(true);
  }

  function onOverlayPointerCancel(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    cancelDrag();
  }

  function onOverlayWheel(event) {
    if (!active) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onOverlayClick(event) {
    if (!active) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onOverlayFocusIn(event) {
    if (!active) return;
    const button = event.target.closest("[data-poster-box]");
    if (!button) return;
    const index = Number(button.dataset.posterBox);
    if (index !== selectedIndex) selectBlock(index);
  }

  function onWindowResize() {
    queueOverlaySync();
  }

  function setActive(on) {
    active = !!on;
    if (!active) {
      clearTimeout(renderT);
      imageImportEpoch++;
    }
    if (!active && drag) cancelDrag(false);
    if (stage) stage.classList.toggle("poster-direct-active", active);
    if (!overlay) return;
    overlay.hidden = !active;
    overlay.setAttribute("aria-hidden", String(!active));
    if (active) {
      if (typeof resetViewTransform === "function") {
        try { resetViewTransform(); } catch (_) {}
      }
      queueOverlaySync();
    } else {
      overlay.innerHTML = "";
    }
  }

  function onDocumentKeyDown(event) {
    if (!active) return;
    if (event.key === "Escape") {
      if (drag) {
        event.preventDefault();
        event.stopPropagation();
        cancelDrag();
      } else if (selectedIndex >= 0 && overlay && overlay.contains(document.activeElement)) {
        event.preventDefault();
        event.stopPropagation();
        selectBlock(-1, { announce: false });
        status.textContent = "";
      }
      return;
    }
    const overlayHasFocus = !!(overlay && overlay.contains(document.activeElement));
    if (!overlayHasFocus || eventIsEditable(event) || selectedIndex < 0) return;
    const unit = event.shiftKey ? 10 : 1;
    const dx = event.key === "ArrowLeft" ? -unit / Math.max(1, canvas.width)
      : event.key === "ArrowRight" ? unit / Math.max(1, canvas.width)
      : 0;
    const dy = event.key === "ArrowUp" ? -unit / Math.max(1, canvas.height)
      : event.key === "ArrowDown" ? unit / Math.max(1, canvas.height)
      : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    event.stopPropagation();
    moveSelectedBy(dx, dy);
    queueOverlaySync(true);
  }

  // ── render loop (debounced) ────────────────────────────────────────────────
  function renderNow(opts = {}) {
    const out = renderPoster(canvas, state, { renderSpecimen, drawImage: coverDrawImage, renderRetro, applyOps: applyOpsWet });
    lastBoxes = out.boxes || [];
    if (opts.perceive !== false && typeof perceiveNow === "function") { try { perceiveNow(canvas); } catch (_) {} }
    queueOverlaySync();
    return out;
  }
  function queueRender() {
    clearTimeout(renderT);
    renderT = setTimeout(() => {
      if (!active || (typeof isActive === "function" && !isActive())) return;
      renderNow(); critiqueNow(false);
    }, 160);
  }

  if (overlay) {
    overlay.addEventListener("pointerdown", onOverlayPointerDown);
    overlay.addEventListener("pointermove", onOverlayPointerMove);
    overlay.addEventListener("pointerup", onOverlayPointerUp);
    overlay.addEventListener("pointercancel", onOverlayPointerCancel);
    overlay.addEventListener("wheel", onOverlayWheel, { passive: false });
    overlay.addEventListener("click", onOverlayClick);
    overlay.addEventListener("focusin", onOverlayFocusIn);
  }
  document.addEventListener("keydown", onDocumentKeyDown);
  window.addEventListener("resize", onWindowResize);
  if (stage && typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => queueOverlaySync());
    resizeObserver.observe(stage);
    resizeObserver.observe(canvas);
  }

  // ── the critique ───────────────────────────────────────────────────────────
  const critiqueHost = el("div", "poster-critique");
  const critiqueDetails = el("details", "poster-readability");
  critiqueDetails.append(el("summary", null, "Readability checks"), critiqueHost);
  function critiqueNow(speak = true) {
    if (speak) critiqueDetails.open = true;
    const detail = typeof getDetail === "function" ? getDetail() : null;
    const rich = typeof getRich === "function" ? getRich() : null;
    const findings = critiquePoster(lastBoxes, detail, rich);
    critiqueHost.innerHTML = "";
    for (const f of findings) {
      const blockMatch = f.text.match(/^The (headline|standfirst|folio)/);
      const index = Number.isInteger(f.blockIndex) ? f.blockIndex : blockMatch ? state.blocks.findIndex((b) => b.kind === blockMatch[1]) : -1;
      let findingText = state.blocks[index] && blockMatch ? f.text.replace(/^The (headline|standfirst|folio)/, `The ${blockName(index)}`) : f.text;
      if (Number.isInteger(f.otherBlockIndex) && state.blocks[f.otherBlockIndex]) {
        findingText = findingText.replace(/and the (headline|standfirst|folio)/, `and the ${blockName(f.otherBlockIndex)}`);
      }
      const row = el("div", "poster-finding poster-" + f.level);
      row.appendChild(el("span", "poster-flevel", f.level));
      row.appendChild(el("span", "poster-ftext", findingText));
      // One-click collaboration: a busy-region fix that names a calmer cell
      // gains an APPLY button that moves the block there.
      const cellMatch = f.level === "fix" && f.text.match(/calmest cell is ([a-z-]+)/);
      if (cellMatch && blockMatch && state.blocks[index] && POSTER_CELLS.includes(cellMatch[1])) {
        const apply = el("button", "poster-apply", "apply");
        apply.type = "button";
        apply.setAttribute("aria-label", `Move ${blockName(index)} to ${cellMatch[1]}`);
        apply.addEventListener("click", () => {
          const block = state.blocks[index];
          if (block) {
            const before = snapshotPlacement();
            block.cell = cellMatch[1];
            delete block.position;
            selectBlock(index, { announce: false });
            rebuildBlockEditors();
            renderNow();
            pushPlacement(`Moved ${block.kind}`, before);
            critiqueNow(true);
          }
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
  const formatSelect = el("select", "poster-format");
  formatSelect.setAttribute("aria-label", "Poster format");
  for (const [value, format] of Object.entries(POSTER_FORMATS)) {
    const option = el("option", null, format.label); option.value = value; formatSelect.appendChild(option);
  }
  formatSelect.value = state.format;
  formatSelect.addEventListener("change", () => { state.format = formatSelect.value; queueRender(); });
  gFormat.appendChild(formatSelect);
  root.appendChild(gFormat);

  // art
  const gArt = el("details", "at-group poster-background");
  gArt.appendChild(el("summary", null, "Background & effects"));
  gArt.appendChild(el("span", "at-glab", "Generate artwork"));
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
  // Use your own image as the poster art. It stays in this tab; the veil and
  // the measured critique apply over it exactly as over engine art.
  const imgRow = el("div", "poster-artrow");
  const imgBtn = el("button", "at-mini", "Add image");
  imgBtn.type = "button";
  imgInput = el("input", "poster-imgfile");
  imgInput.type = "file"; imgInput.accept = "image/*"; imgInput.hidden = true;
  imgInput.setAttribute("aria-label", "Use your own image as the poster art");
  imgClear = el("button", "at-mini", "Remove image");
  imgClear.type = "button"; imgClear.hidden = true;
  imgBtn.addEventListener("click", () => imgInput.click());
  imgInput.addEventListener("change", async () => {
    const file = imgInput.files && imgInput.files[0];
    if (!file || !/^image\//.test(file.type)) return;
    const epoch = ++imageImportEpoch;
    let objectUrl;
    try {
      const bmp = typeof createImageBitmap === "function"
        ? await createImageBitmap(file)
        : await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; objectUrl = URL.createObjectURL(file); im.src = objectUrl; });
      if (epoch !== imageImportEpoch || !active || (typeof isActive === "function" && !isActive())) {
        if (typeof bmp.close === "function") bmp.close();
        return;
      }
      setArtImage(bmp);
    } catch (_) { status.textContent = "This image could not be opened. Try another image file."; }
    finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
  });
  imgClear.addEventListener("click", () => {
    setArtImage(null);
  });
  imgRow.append(imgBtn, imgInput, imgClear);
  root.appendChild(imgRow);
  const projectRow = el("div", "poster-artrow poster-project-actions");
  const saveProject = el("button", "at-mini", "Save project");
  const openProject = el("button", "at-mini", "Open project");
  saveProject.type = openProject.type = "button";
  const projectFile = el("input");
  projectFile.type = "file"; projectFile.accept = ".json,application/json"; projectFile.hidden = true;
  projectFile.dataset.posterProjectFile = "";
  projectFile.setAttribute("aria-label", "Open a Poster project file");
  const projectStatus = el("p", "transform-note");
  projectStatus.hidden = true;
  projectStatus.dataset.posterProjectStatus = "";
  projectStatus.setAttribute("role", "status");
  const projectOptions = { layers: names, effects: OP_META.map(item => item.op) };
  let projectOperation = 0;
  const projectMessage = (message, result) => {
    projectStatus.hidden = false;
    projectStatus.textContent = message; projectStatus.dataset.state = result;
  };
  const currentDesign = () => JSON.stringify({ ...state, art: { ...state.art, image: null } });
  function capturePosterProject({ preview = true } = {}) {
    clearTimeout(renderT);
    renderNow();
    let image = null;
    const art = state.art.image;
    if (art) {
      const dimensions = drawableDimensions(art);
      if (!dimensions || dimensions.width > 8192 || dimensions.height > 8192 || dimensions.width * dimensions.height > 32000000) {
        throw new Error("This image is too large to save in a project. Use an image under 8192 pixels per side and 32 megapixels.");
      }
      if (typeof art.src === "string" && art.src.startsWith("data:image/png;base64,")) image = art.src;
      else {
        const surface = document.createElement("canvas");
        surface.width = dimensions.width; surface.height = dimensions.height;
        surface.getContext("2d").drawImage(art, 0, 0);
        image = surface.toDataURL("image/png");
      }
      validateProjectImage(image);
    }
    const projectText = encodePosterProject(state, image, projectOptions);
    return {
      file: new File([projectText], "zentropy-poster.json", { type: "application/json" }),
      title: state.blocks?.[0]?.text || "Poster project",
      preview: preview ? captureCanvasPreview(canvas) : null,
    };
  }
  saveProject.addEventListener("click", () => {
    try {
      const project = capturePosterProject({ preview: false });
      download(project.file, "zentropy-poster.json");
      projectMessage("Project download started. Keep this file to reopen the editable composition.", "saved");
    } catch (error) { projectMessage(error.message || "The project could not be saved. Your work is still here.", "error"); }
  });
  openProject.addEventListener("click", () => projectFile.click());
  projectFile.addEventListener("change", async () => {
    const file = projectFile.files?.[0];
    if (!file) return;
    const operation = ++projectOperation;
    const epoch = ++imageImportEpoch, designBefore = currentDesign(), imageBefore = state.art.image;
    projectMessage("Opening project…", "loading");
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error("This project exceeds the 9 MB file limit. Your work has not changed.");
      const project = decodePosterProject(await file.text(), projectOptions);
      let image = null;
      if (project.image) {
        image = new Image(); image.src = project.image;
        await image.decode();
        const dimensions = drawableDimensions(image);
        if (!dimensions || dimensions.width > 8192 || dimensions.height > 8192 || dimensions.width * dimensions.height > 32000000) throw new Error("The project's image is too large or invalid.");
      }
      if (operation !== projectOperation) return;
      if (epoch !== imageImportEpoch || !active || (typeof isActive === "function" && !isActive())) {
        projectMessage("Opening cancelled after another change. Open the file again to continue.", "cancelled");
        return;
      }
      if (designBefore !== currentDesign() || imageBefore !== state.art.image) {
        projectMessage("You edited the composition while the file was opening. Your changes are kept; open the file again to replace them.", "cancelled");
        return;
      }
      restoreProject(project.state, image);
      projectMessage("Project opened. Text, artwork and layout are editable.", "ready");
    } catch (error) {
      if (operation === projectOperation) projectMessage(error.message || "The file could not be opened. Your current work has not changed.", "error");
    } finally { if (operation === projectOperation) projectFile.value = ""; }
  });
  projectRow.append(saveProject, openProject, projectFile);
  mountLibrarySave(projectRow, capturePosterProject, { className: "at-mini" });
  root.append(projectRow, projectStatus);
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
  // Veil mode: wash darkens the whole frame; panel scrims each type block only,
  // so the art keeps its brightness everywhere else.
  const veilModes = el("div", "poster-artchips at-chips");
  veilModes.setAttribute("role", "group");
  veilModes.setAttribute("aria-label", "Veil mode");
  // Fallback must match renderPoster: a state with no veilMode renders "wash"
  // (pre-wave-8 states were authored under the whole-frame veil).
  [["panel", "Behind type only"], ["wash", "Whole frame"]].forEach(([val, label]) => {
    const b = el("button", "at-chip", label);
    b.type = "button";
    b.setAttribute("aria-pressed", String((state.art.veilMode || "wash") === val));
    b.addEventListener("click", () => {
      state.art.veilMode = val;
      [...veilModes.children].forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      queueRender();
    });
    veilModes.appendChild(b);
  });
  gArt.appendChild(veilModes);
  // Retro treatment: pixel-art the poster's art layer through the Retro Engine.
  // "Keep colors" quantizes to the art's own palette so the instrument choice
  // survives the treatment; the console palettes replace it deliberately.
  gArt.appendChild(el("span", "at-glab", "Retro treatment"));
  const retroChips = el("div", "poster-artchips at-chips");
  const retroTune = el("div", "poster-retro-tune");
  [["off", "Off"], ["keep", "Keep colors"], ["outrun", "Outrun"], ["gameboy", "Game Boy"], ["c64", "C64"], ["ega", "EGA"], ["pico8", "PICO-8"], ["aurora", "Aurora"]]
    .forEach(([val, label], i) => {
      const b = el("button", "at-chip", label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(i === 0));   // Off by default
      b.addEventListener("click", () => {
        state.art.retro = val === "off" ? null : { palette: val };
        retroTune.hidden = !state.art.retro;
        [...retroChips.children].forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
        queueRender();
      });
      retroChips.appendChild(b);
    });
  gArt.appendChild(retroChips);
  // Treatment tuning: pixel grid + how hard the treatment lands over the raw art.
  retroTune.hidden = true;
  const resRow = el("div", "poster-artchips at-chips");
  resRow.setAttribute("role", "group");
  resRow.setAttribute("aria-label", "Treatment pixel grid");
  [["fine", "Fine"], ["standard", "Standard"], ["chunky", "Chunky"]].forEach(([val, label]) => {
    const b = el("button", "at-chip", label);
    b.type = "button";
    b.setAttribute("aria-pressed", String((state.art.retroRes || "standard") === val));
    b.addEventListener("click", () => {
      state.art.retroRes = val;
      [...resRow.children].forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      queueRender();
    });
    resRow.appendChild(b);
  });
  retroTune.appendChild(resRow);
  const mixLab = el("label", "poster-veil-label");
  mixLab.appendChild(el("span", "at-glab", "Treatment strength"));
  const mix = el("input", "at-slider");
  mix.type = "range"; mix.min = "0.2"; mix.max = "1"; mix.step = "0.05";
  mix.value = String(state.art.retroMix ?? 1);
  mix.setAttribute("aria-label", "How hard the treatment lands over the raw art");
  mix.addEventListener("input", () => { state.art.retroMix = Number(mix.value); queueRender(); });
  mixLab.appendChild(mix);
  retroTune.appendChild(mixLab);
  gArt.appendChild(retroTune);

  // The effect rack: the treatments the Retro Engine and the print desk run,
  // reachable here so a poster can be developed rather than only palette-swapped.
  // They land on the art only, under the veil and the type.
  gArt.appendChild(el("span", "at-glab", "Effects"));
  const fxRow = el("div", "poster-artchips at-chips");
  fxRow.setAttribute("role", "group");
  fxRow.setAttribute("aria-label", "Effects over the art");
  const fxTune = el("div", "poster-retro-tune");
  fxTune.hidden = true;
  (Array.isArray(OP_META) ? OP_META : []).forEach((m) => {
    const b = el("button", "at-chip", m.label);
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    if (m.desc) b.title = m.desc;
    b.setAttribute("aria-label", m.desc ? m.label + ": " + m.desc : m.label + " effect, " + m.cat);
    b.addEventListener("click", () => {
      state.art.fx = Array.isArray(state.art.fx) ? state.art.fx : [];
      const at = state.art.fx.indexOf(m.op);
      if (at >= 0) state.art.fx.splice(at, 1); else state.art.fx.push(m.op);
      b.setAttribute("aria-pressed", String(state.art.fx.includes(m.op)));
      fxTune.hidden = state.art.fx.length === 0;
      queueRender();
    });
    fxRow.appendChild(b);
  });
  gArt.appendChild(fxRow);
  const fxLab = el("label", "poster-veil-label");
  fxLab.appendChild(el("span", "at-glab", "Effect strength"));
  const fxAmt = el("input", "at-slider");
  fxAmt.type = "range"; fxAmt.min = "0.1"; fxAmt.max = "1"; fxAmt.step = "0.05";
  fxAmt.value = String(state.art.fxAmount ?? 0.6);
  fxAmt.setAttribute("aria-label", "How strongly the effects land on the art");
  fxAmt.addEventListener("input", () => { state.art.fxAmount = Number(fxAmt.value); queueRender(); });
  fxLab.appendChild(fxAmt);
  fxTune.appendChild(fxLab);
  gArt.appendChild(fxTune);
  root.appendChild(gArt);

  // blocks
  const gBlocks = el("div", "at-group poster-blocks");
  function rebuildBlockEditors() {
    gBlocks.innerHTML = "";
    blockEditorNodes.length = 0;
    const blockHeader = el("div", "poster-blocks-head");
    blockHeader.appendChild(el("span", "at-glab", "Text"));
    const add = el("button", "at-mini", "Add text block");
    add.type = "button";
    add.disabled = state.blocks.length >= MAX_BLOCKS;
    add.setAttribute("aria-label", "Add text block");
    add.addEventListener("click", addBlock);
    blockHeader.appendChild(add);
    gBlocks.appendChild(blockHeader);
    for (let index = 0; index < state.blocks.length; index += 1) {
      const block = state.blocks[index];
      const box = el("details", "poster-block");
      box.dataset.posterBlockIndex = String(index);
      if (block.kind === "headline") box.open = true;
      const sum = el("summary", null, blockSummary(index));
      box.appendChild(sum);
      box.addEventListener("focusin", () => selectBlock(index, { announce: false }));
      const tools = el("div", "poster-block-tools");
      const tool = (text, label, disabled, action) => {
        const button = el("button", "at-mini", text);
        button.type = "button";
        button.disabled = disabled;
        button.setAttribute("aria-label", label);
        button.addEventListener("click", action);
        tools.appendChild(button);
        return button;
      };
      tool("Move up", `Move block ${index + 1} earlier`, index === 0, () => moveBlock(index, -1));
      tool("Move down", `Move block ${index + 1} later`, index === state.blocks.length - 1, () => moveBlock(index, 1));
      tool("Duplicate", `Duplicate block ${index + 1}`, state.blocks.length >= MAX_BLOCKS, () => duplicateBlock(index));
      tool("Remove", `Remove block ${index + 1}`, state.blocks.length <= MIN_BLOCKS, () => removeBlock(index));
      box.appendChild(tools);
      const roleLab = el("label", "poster-role-label");
      roleLab.appendChild(el("span", "poster-mini-label", "Role"));
      const role = el("select", "poster-role-select");
      role.setAttribute("aria-label", `Block ${index + 1} role`);
      for (const kind of POSTER_BLOCK_KINDS) {
        const option = el("option", null, posterBlockLabel(kind));
        option.value = kind;
        role.appendChild(option);
      }
      role.value = POSTER_BLOCK_KINDS.includes(block.kind) ? block.kind : "standfirst";
      role.addEventListener("change", () => {
        selectBlock(index, { announce: false });
        block.kind = role.value;
        rebuildBlockEditors();
        renderNow();
        critiqueNow(false);
        focusBlockText(index);
      });
      roleLab.appendChild(role);
      box.appendChild(roleLab);
      const text = el("textarea", "poster-text");
      text.value = block.text; text.rows = block.kind === "headline" ? 2 : 2;
      text.setAttribute("aria-label", blockName(index) + " text");
      text.addEventListener("input", () => { selectBlock(index, { announce: false }); block.text = text.value; queueRender(); });
      box.appendChild(text);
      box.appendChild(el("span", "poster-mini-label", "Typeface"));
      box.appendChild(chipRow([["brand", "Hanken Grotesk"], ["mono", "Conso"]], block.face === "mono" ? "mono" : "brand", (v) => { selectBlock(index, { announce: false }); block.face = v; queueRender(); }));
      box.appendChild(el("span", "poster-mini-label", "size"));
      const size = el("input", "at-slider");
      size.type = "range"; size.min = "0.01"; size.max = "0.16"; size.step = "0.0001"; size.value = String(block.size);
      size.setAttribute("aria-label", blockName(index) + " size");
      size.addEventListener("input", () => { selectBlock(index, { announce: false }); block.size = Number(size.value); queueRender(); });
      box.appendChild(size);
      box.appendChild(el("span", "poster-mini-label", "Letter spacing"));
      const tr = el("input", "at-slider");
      tr.type = "range"; tr.min = "-0.04"; tr.max = "0.4"; tr.step = "0.01"; tr.value = String(block.tracking);
      tr.setAttribute("aria-label", blockName(index) + " letter spacing");
      tr.addEventListener("input", () => { selectBlock(index, { announce: false }); block.tracking = Number(tr.value); queueRender(); });
      box.appendChild(tr);
      box.appendChild(el("span", "poster-mini-label", "Line spacing"));
      const leading = el("input", "at-slider");
      leading.type = "range"; leading.min = "0.9"; leading.max = "1.8"; leading.step = "0.01";
      leading.value = String(block.leading || 1.1);
      leading.setAttribute("aria-label", blockName(index) + " line spacing");
      leading.addEventListener("input", () => { selectBlock(index, { announce: false }); block.leading = Number(leading.value); queueRender(); });
      box.appendChild(leading);
      box.appendChild(el("span", "poster-mini-label", "Position"));
      const positionOut = el("output", "poster-position-readout", positionLabel(block));
      positionOut.setAttribute("aria-label", `${blockName(index)} position`);
      box.appendChild(positionOut);
      box.appendChild(cellPicker(block.cell, (name) => {
        const before = snapshotPlacement();
        selectBlock(index, { announce: false });
        block.cell = name;
        delete block.position;
        renderNow();
        pushPlacement(`Moved ${block.kind}`, before);
        critiqueNow(false);
      }, `${blockName(index)} placement cell`));
      box.appendChild(el("span", "poster-mini-label", "color"));
      box.appendChild(swatchRow(block.color, (hex) => { selectBlock(index, { announce: false }); block.color = hex; queueRender(); }));
      const caseRow = chipRow([["none", "As typed"], ["upper", "UPPER"], ["lower", "lower"]], block.caseMode, (v) => { selectBlock(index, { announce: false }); block.caseMode = v; queueRender(); });
      box.appendChild(el("span", "poster-mini-label", "case"));
      box.appendChild(caseRow);
      gBlocks.appendChild(box);
      blockEditorNodes[index] = { box, text, position: positionOut };
    }
    syncBlockEditors();
  }
  rebuildBlockEditors();
  root.appendChild(gBlocks);

  function restoreProject(next, image) {
    clearTimeout(renderT);
    if (drag) cancelDrag(false);
    Object.assign(state, next);
    state.art.image = image;
    selectedIndex = -1;
    undoStack.length = redoStack.length = 0;
    syncHistoryButtons();
    formatSelect.value = state.format;
    [...artSel.children].forEach((button, i) => button.setAttribute("aria-pressed", String(state.art.layers.includes(names[i]))));
    seedIn.value = state.art.seed;
    veil.value = String(state.art.veil);
    [...veilModes.children].forEach((button, i) => button.setAttribute("aria-pressed", String(["panel", "wash"][i] === state.art.veilMode)));
    [...retroChips.children].forEach((button, i) => button.setAttribute("aria-pressed", String(["off", "keep", "outrun", "gameboy", "c64", "ega", "pico8", "aurora"][i] === (state.art.retro?.palette || "off"))));
    retroTune.hidden = !state.art.retro;
    [...resRow.children].forEach((button, i) => button.setAttribute("aria-pressed", String(["fine", "standard", "chunky"][i] === state.art.retroRes)));
    mix.value = String(state.art.retroMix);
    [...fxRow.children].forEach((button, i) => button.setAttribute("aria-pressed", String(state.art.fx.includes(OP_META[i].op))));
    fxTune.hidden = !state.art.fx.length;
    fxAmt.value = String(state.art.fxAmount);
    imgClear.hidden = !image; imgInput.value = "";
    rebuildBlockEditors();
    renderNow(); critiqueNow(false);
  }

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
  undoBtn = mkBtn("Undo position", "Undo the last poster text position change", undoPlacement);
  redoBtn = mkBtn("Redo position", "Redo the last poster text position change", redoPlacement);
  resetPositionsBtn = mkBtn("Reset positions", "Reset poster text positions to their placement cells", resetTextPositions);
  syncHistoryButtons();
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
  root.appendChild(critiqueDetails);

  // first render
  renderNow();
  critiqueNow(false);
  setActive(active);
  if (typeof say === "function") {
    say("model", "Your poster is ready to edit. Drag text to position it, choose a background, or add an image. The critique can help spot overlap and readability issues.");
  }

  return {
    state,
    render: renderNow,
    critique: critiqueNow,
    setActive,
    setArtImage,
    setTypography(style) {
      const block = state.blocks[0];
      Object.assign(block, { text: style.text, face: style.family === "conso" ? "mono" : "brand",
        size: style.size / 640, leading: style.line, tracking: style.track, caseMode: "none",
        weight: style.family === "conso" ? 600 : 700 });
      rebuildBlockEditors();
      renderNow();
      critiqueNow(false);
      status.textContent = "Typography added from the font lab. Text and spacing remain editable.";
    },
    setArtSeed(seed) { state.art.seed = seed; seedIn.value = seed; renderNow(); critiqueNow(false); },
    destroy() {
      active = false;
      imageImportEpoch++;
      clearTimeout(renderT);
      if (overlayRaf) cancelAnimationFrame(overlayRaf);
      if (dragRaf) cancelAnimationFrame(dragRaf);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("keydown", onDocumentKeyDown);
      if (overlay) {
        overlay.removeEventListener("pointerdown", onOverlayPointerDown);
        overlay.removeEventListener("pointermove", onOverlayPointerMove);
        overlay.removeEventListener("pointerup", onOverlayPointerUp);
        overlay.removeEventListener("pointercancel", onOverlayPointerCancel);
        overlay.removeEventListener("wheel", onOverlayWheel);
        overlay.removeEventListener("click", onOverlayClick);
        overlay.removeEventListener("focusin", onOverlayFocusIn);
        overlay.remove();
      }
      if (stage) stage.classList.remove("poster-direct-active");
      mount.innerHTML = "";
    },
  };
}
