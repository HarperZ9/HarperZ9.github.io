// loom-studio.js -- the Loom's controller: a source image becomes threading,
// tie-up, and treadling in a real weave structure, woven pick by pick.
// Sources arrive by sessionStorage handoff from the Retro Engine, the Studio,
// and the Gallery, or by local upload; with neither, a seeded generative plate
// keeps the loom warm on arrival. Exports: WIF draft, chart PNG, cloth PNG,
// and the cloth handed back to the Retro Engine's pixel pipeline.
import { STRUCTURES, computeDraft, draftToWIF, weftPaletteFor, wifToDraft } from "./weave-engine.js?v=20260813-wif";
import { renderCloth, renderDraftChart, chartLayout } from "./weave-render.js?v=20260902-thread";
import { sendPiece, receiveTrail, mountFlow } from "./workbench.js?v=20260907-creative-handoff";
import { mountLibrarySave, captureCanvasPreview } from "./project-library-controls.js?v=20260907-workspace";

const $ = (id) => document.getElementById(id);

const WARPS = { bone: "#e8e2d4", ink: "#14131a", indigo: "#2b3a67", rust: "#8c4a2f", gold: "#c9a227" };
const WEFTS = {
  "bone-ink": ["#e8e2d4", "#14131a"],
  "ember": ["#f2b134", "#e0632f", "#8c2f1b", "#3a1410"],
  "indigo-bone": ["#2b3a67", "#5a6f9e", "#e8e2d4"],
};

function boot() {
  const out = $("wv-out");
  if (!out) return;

  const src = document.createElement("canvas"); src.width = 640; src.height = 400;
  let haveSource = false, draft = null, colors = null, woven = 0, raf = 0, lastPick = 0;
  let structureId = "jacquard", audio = null;
  let sourceOperation = 0, projectOperation = 0, editRevision = 0;
  // An asynchronous open must never overwrite a more recent edit or source.
  for (const event of ["input", "change", "click", "keydown"]) {
    $("wv-panel").addEventListener(event, e => {
      if (!e.target.closest("#wv-project-file, #wv-project-open, #wv-project-save")) editRevision++;
    }, true);
  }

  function status(msg, kind) { const el = $("wv-status"); el.textContent = msg || ""; el.className = "re-status" + (kind ? " " + kind : ""); }
  const ping = (k, v) => { try { if (audio && audio.isOn()) audio.ping(k, v); } catch (_) {} };

  // --- sampling: the image grid the draft is computed from ------------------
  function sample() {
    const ends = +$("wv-sett").value;
    const picks = Math.max(24, Math.round(ends * (src.height / src.width)));
    const g = document.createElement("canvas"); g.width = ends; g.height = picks;
    const ctx = g.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(src, 0, 0, ends, picks);
    const px = ctx.getImageData(0, 0, ends, picks).data;
    let luma = new Float32Array(ends * picks);
    const rowRGB = [];
    for (let p = 0; p < picks; p++) {
      let r = 0, gr = 0, b = 0;
      for (let e = 0; e < ends; e++) {
        const o = (p * ends + e) * 4;
        luma[p * ends + e] = (px[o] * 0.299 + px[o + 1] * 0.587 + px[o + 2] * 0.114) / 255;
        r += px[o]; gr += px[o + 1]; b += px[o + 2];
      }
      rowRGB.push([r / ends, gr / ends, b / ends]);
    }
    // Contrast-stretch to full range before drafting (jacquard practice:
    // the shading input spans true black to true white, or tones bunch up).
    const sorted = Float32Array.from(luma).sort();
    const lo = sorted[(sorted.length * 0.02) | 0], hi = sorted[(sorted.length * 0.98) | 0];
    const span = Math.max(0.05, hi - lo);
    for (let i = 0; i < luma.length; i++) luma[i] = Math.max(0, Math.min(1, (luma[i] - lo) / span));
    return { ends, picks, luma, rowRGB };
  }

  function rebuild(fresh) {
    if (!haveSource) return;
    imported = null;
    syncSourceControls();
    if (edited) { edited = false; status("redrawn from the image; hand edits cleared"); }
    const { ends, picks, luma, rowRGB } = sample();
    draft = computeDraft(luma, ends, picks, structureId, { toneDrive: (+$("wv-tone").value) / 100 });
    const mode = $("wv-weft").value;
    const pal = mode === "image"
      ? weftPaletteFor(draft, (p) => rowRGB[p], "image")
      : weftPaletteFor(draft, (p) => rowRGB[p], WEFTS[mode] || WEFTS["bone-ink"]);
    const warpSel = $("wv-warp").value;
    const warpHex = warpSel === "custom" ? ($("wv-warp-color") ? $("wv-warp-color").value : WARPS.bone) : (WARPS[warpSel] || WARPS.ink);
    colors = { warpHex, weftHexes: pal.hexes, weftHexAt: (p) => pal.hexes[pal.indexAt(p)], weftIndexAt: pal.indexAt };
    const hint = $("wv-structure-hint"), s = STRUCTURES[structureId];
    if (hint && s) hint.textContent = s.perCell ? "per-thread shading, chart + cloth exports" : s.shafts + " shafts, " + s.treadles + " treadles";
    if (fresh) woven = $("wv-weaveit").checked ? 0 : draft.picks;
    draw();
    sync();
  }

  function draw() {
    if (!draft) return;
    renderCloth(out, draft, colors, { upTo: woven, light: 0.65 });
    // The draft chart was computed and thrown away on every rebuild, visible
    // only inside the export handler. It is the thing a weaver actually reads,
    // so it lives on the stage now, behind a view switch.
    const chart = $("wv-chart");
    if (chart && view === "draft") {
      // Render wider as the zoom rises: chartLayout derives its cell size from
      // the width, so this is what actually makes a cell clickable rather than
      // scaling a small chart up and blurring it.
      try { renderDraftChart(chart, draft, colors, { width: 1200 * chartZoom }); } catch (_) {}
      const stage = $("wv-stage-preview");
      if (stage) stage.classList.toggle("wv-zoomed", chartZoom > 1);
      chart.style.width = chartZoom > 1 ? chart.width + "px" : "";
      chart.style.height = chartZoom > 1 ? chart.height + "px" : "";
      positionDraftCursor();
    } else {
      hideDraftCursor();
    }
    paintReadout();
  }

  // What the cloth IS, measured from the draft rather than described in prose:
  // its size, its longest floats (the number a weaver checks first, because a
  // long float snags), and how much of the face is warp.
  function paintReadout() {
    const el = $("wv-readout");
    if (!el || !draft) return;
    let maxWarp = 0, maxWeft = 0, warpUp = 0, total = 0;
    const lift = (e, p) => (draft.liftAt ? draft.liftAt(e, p) : 0);
    for (let e = 0; e < draft.ends; e += 1) {
      let run = 0;
      for (let p = 0; p < draft.picks; p += 1) {
        const up = lift(e, p) ? 1 : 0;
        total += 1; warpUp += up;
        if (up) { run += 1; if (run > maxWarp) maxWarp = run; } else { run = 0; }
      }
    }
    for (let p = 0; p < draft.picks; p += 1) {
      let run = 0;
      for (let e = 0; e < draft.ends; e += 1) {
        if (!lift(e, p)) { run += 1; if (run > maxWeft) maxWeft = run; } else { run = 0; }
      }
    }
    const face = total ? Math.round((warpUp / total) * 100) : 0;
    const st = STRUCTURES[structureId];
    // "Sett" means ends per inch, which is what turns a thread count into a
    // finished size. The slider used to be labelled sett while setting the total
    // end count, so the cloth had no real-world dimensions at all.
    const epiEl = $("wv-epi");
    const epi = epiEl ? Math.max(1, +epiEl.value) : 24;
    const ppi = epi;                       // balanced cloth unless a structure says otherwise
    const wIn = draft.ends / epi, hIn = draft.picks / ppi;
    const dim = `${wIn.toFixed(1)} x ${hIn.toFixed(1)} in`
      + ` (${Math.round(wIn * 2.54)} x ${Math.round(hIn * 2.54)} cm) at ${epi} epi`;
    el.textContent = `${draft.ends} ends x ${draft.picks} picks · ${dim}`
      + ` · longest float ${maxWarp} warp / ${maxWeft} weft`
      + ` · ${face}% warp-faced`
      + ` · ${draft.perCell ? "per-thread" : draft.shafts + " shafts"}`;
  }

  // --- the weaving animation: the shuttle crosses, the row sounds -----------
  function rowBands(p) {
    const B = 6, per = draft.ends / B, bands = new Array(B);
    for (let b = 0; b < B; b++) {
      let m = 0, c = 0;
      for (let e = (b * per) | 0; e < ((b + 1) * per) | 0; e++) { m += draft.lumaAt ? draft.lumaAt(e, p) : 0; c++; }
      bands[b] = Math.min(1, (m / (c || 1)) * 1.15);
    }
    return bands;
  }
  function loop(now) {
    raf = 0;
    if (!draft || !$("wv-weaveit").checked || woven >= draft.picks) return;
    const speed = +$("wv-speed").value;
    if (!lastPick) lastPick = now;
    const due = Math.min(4, Math.floor((now - lastPick) / (1000 / speed)));
    if (due > 0) {
      lastPick = now;
      for (let i = 0; i < due && woven < draft.picks; i++) {
        woven++;
        const tone = draft.pickTone?.[woven - 1] || 0;
        if (speed <= 30) ping("row", tone); else if (woven % 4 === 0) ping("slider", tone);
      }
      if (audio && audio.isOn()) { try { audio.feed(rowBands(woven - 1)); } catch (_) {} }
      draw();
      if (woven >= draft.picks) status("cloth complete: " + draft.picks + " picks", "ok");
    }
    raf = requestAnimationFrame(loop);
  }
  function sync() {
    if (raf) cancelAnimationFrame(raf); raf = 0; lastPick = 0;
    if (draft && $("wv-weaveit").checked && woven < draft.picks) raf = requestAnimationFrame(loop);
  }

  // --- sources --------------------------------------------------------------
  function useImage(img, note) {
    const ctx = src.getContext("2d");
    const sc = Math.min(src.width / img.naturalWidth, src.height / img.naturalHeight);
    ctx.fillStyle = "#07070c"; ctx.fillRect(0, 0, src.width, src.height);
    ctx.drawImage(img, (src.width - img.naturalWidth * sc) / 2, (src.height - img.naturalHeight * sc) / 2,
      img.naturalWidth * sc, img.naturalHeight * sc);
    haveSource = true;
    status(note, "ok");
    rebuild(true);
  }
  function bootHandoff() {
    let dataURL = null;
    try { dataURL = sessionStorage.getItem("re.loom.handoff"); } catch (_) { return false; }
    if (!dataURL) return false;
    const operation = ++sourceOperation;
    try { sessionStorage.removeItem("re.loom.handoff"); } catch (_) {}
    const img = new Image();
    img.onload = () => {
      if (operation !== sourceOperation) return;
      const rec = receiveTrail("loom");
      useImage(img, rec && rec.line ? "arrived: " + rec.line : "warping up the frame you sent over");
    };
    img.onerror = () => { if (operation === sourceOperation) { status("could not read the handed-over image", "err"); bootPlate(); } };
    img.src = dataURL;
    return true;
  }
  async function bootPlate() {
    const operation = ++sourceOperation;
    try {
      const mod = await import("./generative-field.js");
      if (operation !== sourceOperation) return;
      const render = mod.renderSpecimen || mod.renderPlate;
      if (render) {
        // Ask the plate renderer for the loom's own 16:10 frame; without a
        // size it measured this detached canvas as a 640x150 banner and the
        // cover-fit below cropped most of the plate away. The lantern star
        // over caustic veils is the plate whose form survives the draft: its
        // points still read once the tones become lifted and sunk threads.
        const t = document.createElement("canvas"); t.width = 640; t.height = 400;
        render(t, "folded-light", ["caustic-veils", "stellated-lantern"], null, 0.6, { size: [640, 400] });
        const ctx = src.getContext("2d");
        const sc = Math.max(src.width / t.width, src.height / t.height);
        ctx.fillStyle = "#07070c"; ctx.fillRect(0, 0, src.width, src.height);
        ctx.drawImage(t, (src.width - t.width * sc) / 2, (src.height - t.height * sc) / 2, t.width * sc, t.height * sc);
        haveSource = true; rebuild(true); return;
      }
    } catch (_) {}
    status("drop an image in to begin", "");
  }
  $("wv-file").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const operation = ++sourceOperation;
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); if (operation === sourceOperation) useImage(img, "warped up your image"); };
    img.onerror = () => { URL.revokeObjectURL(img.src); if (operation === sourceOperation) status("That image could not be opened. Your work is unchanged.", "err"); };
    img.src = URL.createObjectURL(f);
  });

  // --- controls -------------------------------------------------------------
  const host = $("wv-structures");
  // Cloth or draft on the stage. The chart only renders while it is showing, so
  // a hidden view costs nothing on every rebuild.
  // Starting points. The page used to boot into jacquard with no explanation of
  // what any structure is for, so a visitor who has never woven had nothing to
  // press. Each recipe sets a whole setup in one go.
  const RECIPES = [
    { name: "Dish towel", structure: "twill22", sett: 120, tone: 55, warp: "bone", weft: "bone-ink" },
    { name: "Photo shade", structure: "jacquard", sett: 200, tone: 85, warp: "ink", weft: "image" },
    { name: "Scarf", structure: "satin5", sett: 152, tone: 45, warp: "indigo", weft: "indigo-bone" },
    { name: "Log cabin", structure: "plain", sett: 96, tone: 30, warp: "bone", weft: "bone-ink" },
    { name: "Coverlet", structure: "overshot", sett: 136, tone: 70, warp: "rust", weft: "ember" },
  ];
  const recipeHost = $("wv-recipes");
  if (recipeHost) {
    RECIPES.filter((r) => STRUCTURES[r.structure]).forEach((r, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "re-chip";
      b.textContent = r.name;
      b.title = `${STRUCTURES[r.structure].name} · ${r.sett} ends · ${r.warp} warp`;
      b.setAttribute("aria-label", `Start from ${r.name}: ${b.title}`);
      b.addEventListener("click", () => {
        structureId = r.structure;
        const set = (id, v) => { const el = $(id); if (el) { el.value = String(v); el.dispatchEvent(new Event("input")); } };
        set("wv-sett", r.sett);
        set("wv-tone", r.tone);
        const warp = $("wv-warp"), weft = $("wv-weft");
        if (warp) { warp.value = r.warp; warp.dispatchEvent(new Event("change")); }
        if (weft) { weft.value = r.weft; weft.dispatchEvent(new Event("change")); }
        [...document.querySelectorAll("#wv-structures .re-chip")].forEach((c) =>
          c.setAttribute("aria-checked", String(c.dataset.id === r.structure)));
        ping("chip", i / 5);
        status(`${r.name}: ${STRUCTURES[r.structure].name}, ${r.sett} ends`);
        rebuild(true);
      });
      recipeHost.appendChild(b);
    });
  }


  // ── the draft, edited by hand ────────────────────────────────────────────
  // Threading, tie-up and treadling were pure functions of the structure and the
  // image, so a weaver could look at the draft and change nothing in it. Click a
  // tie-up cell to lift or drop that shaft, click a threading column to move the
  // end to another shaft, click a treadling row to change which treadle the pick
  // uses. The drawdown is recomputed from the edited arrays, so the cloth, the
  // readout, and the WIF export all follow the edit.
  let edited = false, draftCursor = null;
  function draftIsEditable() {
    return !!(draft && !draft.perCell && draft.threading && draft.tieup && draft.treadling && draft.shafts);
  }
  function rebindLift() {
    // liftAt may be a closure over the ORIGINAL arrays; rebind it to the live ones
    draft.liftAt = (e, p) => {
      const row = draft.tieup[draft.treadling[p]];
      return row && row[draft.threading[e]] ? 1 : 0;
    };
  }
  function zoneBounds(zone) {
    if (!draftIsEditable()) return null;
    const treadles = draft.tieup.length;
    if (zone === "threading") return { cols: draft.ends, rows: draft.shafts };
    if (zone === "tieup") return { cols: treadles, rows: draft.shafts };
    if (zone === "treadling") return { cols: treadles, rows: draft.picks };
    return null;
  }
  function zoneRect(L, zone) {
    if (zone === "threading") return L.threading;
    if (zone === "tieup") return L.tieup;
    if (zone === "treadling") return L.treadling;
    return null;
  }
  function visualShaft(row) {
    return draft.shafts - 1 - row;
  }
  function clampDraftCursor() {
    if (!draftCursor) return null;
    const b = zoneBounds(draftCursor.zone);
    if (!b || b.cols < 1 || b.rows < 1) { draftCursor = null; return null; }
    draftCursor.col = Math.max(0, Math.min(b.cols - 1, draftCursor.col | 0));
    draftCursor.row = Math.max(0, Math.min(b.rows - 1, draftCursor.row | 0));
    return draftCursor;
  }
  function draftCellName(cell) {
    if (!cell || !draftIsEditable()) return "draft cell";
    if (cell.zone === "tieup") return `tie-up treadle ${cell.col + 1}, shaft ${visualShaft(cell.row) + 1}`;
    if (cell.zone === "threading") return `threading end ${cell.col + 1}, shaft ${visualShaft(cell.row) + 1}`;
    if (cell.zone === "treadling") return `treadling pick ${cell.row + 1}, treadle ${cell.col + 1}`;
    return "draft cell";
  }
  function draftCellValue(cell) {
    if (!cell || !draftIsEditable()) return "";
    if (cell.zone === "tieup") {
      const row = draft.tieup[cell.col], sh = visualShaft(cell.row);
      return row && row[sh] ? "lifted" : "dropped";
    }
    if (cell.zone === "threading") return draft.threading[cell.col] === visualShaft(cell.row) ? "assigned" : "empty";
    if (cell.zone === "treadling") return draft.treadling[cell.row] === cell.col ? "selected" : "empty";
    return "";
  }
  function ensureDraftCursorEl() {
    let el = $("wv-draft-cursor");
    if (el) return el;
    const stage = $("wv-stage-preview");
    if (!stage) return null;
    el = document.createElement("div");
    el.id = "wv-draft-cursor";
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      position: "absolute",
      zIndex: "2",
      pointerEvents: "none",
      boxSizing: "border-box",
      border: "2px solid var(--ember,#e0632f)",
      background: "rgba(224,99,47,.12)",
      boxShadow: "0 0 0 1px var(--void,#07070c),0 0 0 5px rgba(224,99,47,.22)",
    });
    stage.appendChild(el);
    return el;
  }
  function hideDraftCursor() {
    const el = $("wv-draft-cursor");
    if (el) el.hidden = true;
  }
  function positionDraftCursor() {
    const chart = $("wv-chart");
    const stage = $("wv-stage-preview");
    if (!chart || !stage || chart.hidden || view !== "draft" || !draftIsEditable()) { hideDraftCursor(); return; }
    const cell = clampDraftCursor();
    if (!cell) { hideDraftCursor(); return; }
    const L = chartLayout(draft, 1200 * chartZoom);
    const box = zoneRect(L, cell.zone);
    const el = ensureDraftCursorEl();
    if (!box || !el) return;
    const chartBox = chart.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    if (!chartBox.width || !chartBox.height) { hideDraftCursor(); return; }
    const scaleX = chartBox.width / L.width, scaleY = chartBox.height / L.height;
    const x = box.x + cell.col * L.cell;
    const y = box.y + cell.row * L.cell;
    el.style.left = (chartBox.left - stageBox.left + stage.scrollLeft + x * scaleX) + "px";
    el.style.top = (chartBox.top - stageBox.top + stage.scrollTop + y * scaleY) + "px";
    el.style.width = Math.max(4, L.cell * scaleX) + "px";
    el.style.height = Math.max(4, L.cell * scaleY) + "px";
    el.dataset.zone = cell.zone;
    el.dataset.col = String(cell.col);
    el.dataset.row = String(cell.row);
    el.hidden = false;
  }
  function selectDraftCell(cell, announce) {
    if (!cell || !draftIsEditable()) { draftCursor = null; hideDraftCursor(); return; }
    draftCursor = { zone: cell.zone, col: cell.col, row: cell.row };
    clampDraftCursor();
    positionDraftCursor();
    if (announce) status(`${draftCellName(draftCursor)} is ${draftCellValue(draftCursor)}; Enter or Space edits it`, "");
  }
  function draftCellFromEvent(ev) {
    const chart = $("wv-chart");
    if (!chart || chart.hidden || !draftIsEditable()) return null;
    // MUST match the width the chart was rendered at, or every pointer maps to
    // the wrong cell the moment the zoom is not 1.
    const L = chartLayout(draft, 1200 * chartZoom);
    const r = chart.getBoundingClientRect();
    // the canvas is drawn at L.width x L.height and displayed at r.width x r.height
    const x = (ev.clientX - r.left) * (L.width / r.width);
    const y = (ev.clientY - r.top) * (L.height / r.height);
    const inBox = (b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
    if (inBox(L.tieup)) {
      return { zone: "tieup", col: Math.floor((x - L.tieup.x) / L.cell), row: Math.floor((y - L.tieup.y) / L.cell) };
    }
    if (inBox(L.threading)) {
      return { zone: "threading", col: Math.floor((x - L.threading.x) / L.cell), row: Math.floor((y - L.threading.y) / L.cell) };
    }
    if (inBox(L.treadling)) {
      return { zone: "treadling", col: Math.floor((x - L.treadling.x) / L.cell), row: Math.floor((y - L.treadling.y) / L.cell) };
    }
    return null;
  }
  function applyDraftCell(cell) {
    if (!cell || !draftIsEditable()) return false;
    const b = zoneBounds(cell.zone);
    if (!b || cell.col < 0 || cell.row < 0 || cell.col >= b.cols || cell.row >= b.rows) return false;
    let touched = "", value = "";
    if (cell.zone === "tieup") {
      const sh = visualShaft(cell.row);
      draft.tieup[cell.col][sh] = !draft.tieup[cell.col][sh];
      touched = draftCellName(cell);
      value = draft.tieup[cell.col][sh] ? "lifted" : "dropped";
    } else if (cell.zone === "threading") {
      draft.threading[cell.col] = visualShaft(cell.row);
      touched = draftCellName(cell);
      value = "assigned";
    } else if (cell.zone === "treadling") {
      draft.treadling[cell.row] = cell.col;
      touched = draftCellName(cell);
      value = "selected";
    }
    if (!touched) return false;
    editRevision++;
    edited = true;
    rebindLift();
    ping("chip", 0.5);
    status("edited: " + touched + " " + value + " · the cloth follows the draft", "ok");
    draw();
    return true;
  }
  function chartClick(ev) {
    const chart = $("wv-chart");
    if (!chart || chart.hidden || !draftIsEditable()) return;
    const cell = draftCellFromEvent(ev);
    if (!cell) return;
    if (chart.focus) chart.focus({ preventScroll: true });
    selectDraftCell(cell, false);
    applyDraftCell(draftCursor);
  }
  function defaultDraftCursor() {
    return { zone: "tieup", col: 0, row: 0 };
  }
  function moveDraftCursor(key) {
    if (!draftIsEditable()) return false;
    if (!draftCursor) draftCursor = defaultDraftCursor();
    const cur = { ...draftCursor };
    const b = zoneBounds(cur.zone);
    if (!b) return false;
    if (key === "ArrowRight") {
      if (cur.col < b.cols - 1) cur.col += 1;
      else if (cur.zone === "threading") { cur.zone = "tieup"; cur.col = 0; }
    } else if (key === "ArrowLeft") {
      if (cur.col > 0) cur.col -= 1;
      else if (cur.zone === "tieup") { cur.zone = "threading"; cur.col = Math.max(0, draft.ends - 1); }
    } else if (key === "ArrowDown") {
      if (cur.row < b.rows - 1) cur.row += 1;
      else if (cur.zone === "tieup") { cur.zone = "treadling"; cur.row = 0; }
    } else if (key === "ArrowUp") {
      if (cur.row > 0) cur.row -= 1;
      else if (cur.zone === "treadling") { cur.zone = "tieup"; cur.row = Math.max(0, draft.shafts - 1); }
    } else if (key === "Home") {
      cur.col = 0; cur.row = 0;
    } else if (key === "End") {
      cur.col = b.cols - 1; cur.row = b.rows - 1;
    } else {
      return false;
    }
    selectDraftCell(cur, true);
    return true;
  }
  function chartKeydown(ev) {
    const chart = $("wv-chart");
    if (!chart || ev.currentTarget !== chart || document.activeElement !== chart || chart.hidden || view !== "draft") return;
    if (!draftIsEditable()) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "].includes(ev.key)) {
        ev.preventDefault();
        ev.stopPropagation();
        status("pick a shaft structure to edit threading, tie-up, or treadling", "err");
      }
      return;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      draftCursor = null;
      hideDraftCursor();
      status("draft cursor cleared", "");
      return;
    }
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      ev.stopPropagation();
      if (!draftCursor) selectDraftCell(defaultDraftCursor(), true);
      applyDraftCell(draftCursor);
      return;
    }
    if (moveDraftCursor(ev.key)) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }
  const chartEl = $("wv-chart");
  if (chartEl) {
    chartEl.addEventListener("click", chartClick);
    chartEl.addEventListener("keydown", chartKeydown);
    chartEl.addEventListener("focus", () => {
      if (view !== "draft" || !draftIsEditable()) return;
      if (!draftCursor) selectDraftCell(defaultDraftCursor(), true);
      else selectDraftCell(draftCursor, true);
    });
    chartEl.addEventListener("blur", positionDraftCursor);
    chartEl.style.cursor = "crosshair";
    chartEl.setAttribute("tabindex", "0");
    chartEl.setAttribute("role", "application");
    chartEl.setAttribute("aria-describedby", "wv-edit-hint wv-status");
    chartEl.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space Escape");
  }

  // ── WIF in, and a check on the way out ───────────────────────────────────
  // The exporter had no reader, so nothing could ever verify it. An imported
  // draft replaces the computed one wholesale: its threading, tie-up and
  // treadling are the weaver's, not ours, so the source image stops driving it.
  let imported = null;
  function showImported(res) {
    imported = res;
    draft = res.draft;
    colors = {
      warpHex: res.colors.warpHex,
      weftHexes: res.colors.weftHexes,
      weftHexAt: (p) => res.colors.weftHexes[p % res.colors.weftHexes.length],
      weftIndexAt: (p) => p % res.colors.weftHexes.length,
    };
    haveSource = false;
    edited = false;
    draftCursor = null;
    syncSourceControls();
    woven = $("wv-weaveit").checked ? 0 : draft.picks;
    status(`${res.title}: ${draft.ends} ends, ${draft.picks} picks, ${draft.shafts} shafts`, "ok");
    draw();
    sync();
  }
  const wifIn = $("wv-wif-in"), wifOpen = $("wv-wif-open"), wifCheck = $("wv-wif-check");
  if (wifOpen && wifIn) {
    wifOpen.addEventListener("click", () => wifIn.click());
    wifIn.addEventListener("change", async () => {
      const f = wifIn.files && wifIn.files[0];
      if (!f) return;
      const operation = ++sourceOperation, revision = editRevision;
      try {
        const res = wifToDraft(await f.text());
        if (operation !== sourceOperation || revision !== editRevision) return;
        if (!res) { status("that file did not parse as a WIF draft", "err"); return; }
        showImported(res);
      } catch (e) { status("could not read that file: " + e.message, "err"); }
      wifIn.value = "";
    });
  }
  // The self-check: write the draft out, read it straight back, and compare
  // every crossing. A claim about an export is worth what its check is worth.
  if (wifCheck) {
    wifCheck.addEventListener("click", () => {
      if (!draft) { status("weave something first", "err"); return; }
      if (STRUCTURES[structureId] && STRUCTURES[structureId].perCell && !imported) {
        status("per-thread cloth has no shaft draft to write; pick a shaft structure", "err");
        return;
      }
      try {
        const wif = draftToWIF(draft, {
          title: "self check", warpHex: colors.warpHex,
          weftHexes: colors.weftHexes, weftIndexAt: colors.weftIndexAt,
        });
        const back = wifToDraft(wif);
        if (!back) { status("the export did not read back", "err"); return; }
        let diff = 0, cells = 0;
        for (let e = 0; e < draft.ends; e += 1) {
          for (let pk = 0; pk < draft.picks; pk += 1) {
            cells += 1;
            if ((draft.liftAt(e, pk) ? 1 : 0) !== (back.draft.liftAt(e, pk) ? 1 : 0)) diff += 1;
          }
        }
        status(diff === 0
          ? `export verified: ${cells} crossings re-read identically`
          : `export differs on ${diff} of ${cells} crossings`, diff === 0 ? "ok" : "err");
      } catch (e) { status("check failed: " + e.message, "err"); }
    });
  }

  let view = "cloth", chartZoom = 1;
  const zoomHost = $("wv-zooms");
  if (zoomHost) {
    zoomHost.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-zoom]");
      if (!b) return;
      chartZoom = Math.max(1, Math.min(8, +b.dataset.zoom || 1));
      [...zoomHost.querySelectorAll("[data-zoom]")].forEach((x) =>
        x.setAttribute("aria-checked", String(x === b)));
      ping("chip", 0.4);
      draw();
    });
  }
  const viewHost = $("wv-views");
  if (viewHost) {
    viewHost.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-view]");
      if (!b) return;
      view = b.dataset.view;
      [...viewHost.querySelectorAll("[data-view]")].forEach((x) =>
        x.setAttribute("aria-checked", String(x === b)));
      const chart = $("wv-chart"), cloth = $("wv-out");
      if (chart) chart.hidden = view !== "draft";
      if (cloth) cloth.hidden = view === "draft";
      const zf = $("wv-zoom-field");
      if (zf) zf.hidden = view !== "draft";
      const stage = $("wv-stage-preview");
      if (stage && view !== "draft") stage.classList.remove("wv-zoomed");
      draw();
    });
  }

  Object.keys(STRUCTURES).forEach((id, i) => {
    const b = document.createElement("button");
    b.className = "re-chip"; b.type = "button"; b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(id === structureId));
    b.textContent = STRUCTURES[id].name; b.dataset.id = id;
    b.addEventListener("click", () => {
      structureId = id; ping("chip", i / 4);
      host.querySelectorAll(".re-chip").forEach((c) => c.setAttribute("aria-checked", String(c.dataset.id === id)));
      rebuild(true);
    });
    host.appendChild(b);
  });
  // Radio semantics carry a keyboard contract: arrows walk the structures.
  host.addEventListener("keydown", (e) => {
    const chips = [...host.querySelectorAll(".re-chip")];
    const cur = chips.indexOf(document.activeElement);
    if (cur < 0) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (cur + 1) % chips.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (cur - 1 + chips.length) % chips.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = chips.length - 1;
    if (next < 0) return;
    e.preventDefault();
    chips[next].focus(); chips[next].click();
  });
  const _epi = $("wv-epi");
  if (_epi) _epi.addEventListener("input", () => {
    const v = $("wv-epi-v"); if (v) v.textContent = _epi.value + " epi";
    paintReadout();                       // sett changes the size, not the threading
  });
  [["wv-sett", "wv-sett-v", (v) => v + " ends"], ["wv-tone", "wv-tone-v", (v) => v], ["wv-speed", "wv-speed-v", (v) => v]]
    .forEach(([id, vid, fmt]) => $(id).addEventListener("input", () => {
      $(vid).textContent = fmt($(id).value);
      if (id !== "wv-speed") rebuild(id === "wv-sett");
    }));
  ["wv-warp", "wv-weft"].forEach((id) => $(id).addEventListener("change", () => {
    const c = $("wv-warp-color");
    if (c) c.hidden = $("wv-warp").value !== "custom";
    if (!draft || !colors) return;
    if (id === "wv-warp") colors.warpHex = $("wv-warp").value === "custom" ? c.value : WARPS[$("wv-warp").value];
    else {
      const mode = $("wv-weft").value;
      let rows;
      if (haveSource) rows = sample().rowRGB;
      else rows = Array.from({ length: draft.picks }, (_, p) => {
        const hex = colors.weftHexAt(p).slice(1);
        return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
      });
      const pal = weftPaletteFor(draft, p => rows[p], mode === "image" ? "image" : WEFTS[mode]);
      colors = { ...colors, weftHexes: pal.hexes, weftIndexAt: pal.indexAt, weftHexAt: p => pal.hexes[pal.indexAt(p)] };
    }
    ping("preset"); draw();
  }));
  const warpColor = $("wv-warp-color");
  if (warpColor) warpColor.addEventListener("input", () => {
    if (colors && $("wv-warp").value === "custom") { colors.warpHex = warpColor.value; draw(); }
  });
  $("wv-weaveit").addEventListener("change", () => {
    if ($("wv-weaveit").checked) { if (draft && woven >= draft.picks) woven = 0; }
    else if (draft) { woven = draft.picks; draw(); }
    sync(); ping("chip", 0.6);
  });
  $("wv-sound").addEventListener("change", async () => {
    if ($("wv-sound").checked) {
      try {
        const m = await import("./retro-audio.js?v=20260812-cohesion");
        if (!audio) audio = m.createRetroAudio();
        await audio.start("loom-" + structureId);
        status("the rows will sound as they weave", "ok");
      } catch (e) { status("sound needs a click to start", "err"); $("wv-sound").checked = false; }
    } else if (audio && audio.isOn()) { try { audio.stop(); } catch (_) {} }
  });

  // The cloth as a score: the woven canvas scanned ANS-style, rows to
  // frequencies on the instrument's scale, width to time. The loom's punch
  // card ancestry, played back on itself.
  const playCloth = $("wv-play");
  let clothRun = null, clothTimer = 0, clothBusy = false;
  if (playCloth) playCloth.addEventListener("click", async () => {
    if (!draft || clothBusy) return;
    if (clothRun) {
      clearTimeout(clothTimer);
      clothRun.stop(); clothRun = null;
      playCloth.setAttribute("aria-pressed", "false"); status("cloth stopped", "");
      return;
    }
    clothBusy = true;
    try {
      const am = await import("./retro-audio.js?v=20260812-cohesion");
      if (!audio) audio = am.createRetroAudio();
      const m = await import("./ans-voice.js?v=20260812-cohesion");
      const scan = m.scanImage(out, 36, 88);
      const freqs = m.rowFrequencies(scan.rows, { mode: "penta" });
      clothRun = await audio.playScan(scan, freqs, 10);
    } catch (e) { status("could not play the cloth", "err"); clothBusy = false; return; }
    clothBusy = false;
    playCloth.setAttribute("aria-pressed", "true");
    status("the cloth is playing: weft rows are pitches, the width is time", "ok");
    clearTimeout(clothTimer);
    clothTimer = setTimeout(() => { clothRun = null; playCloth.setAttribute("aria-pressed", "false"); }, 10700);
  });

  // --- exports --------------------------------------------------------------
  function download(name, href) { const a = document.createElement("a"); a.download = name; a.href = href; a.click(); }
  $("wv-wif").addEventListener("click", () => {
    if (!draft) return;
    if (draft.perCell) { status("jacquard is per-thread: no shaft draft exists; export the chart or the cloth, or pick a shaft structure", ""); return; }
    const wif = draftToWIF(draft, { title: "The Loom, " + STRUCTURES[structureId].name, warpHex: colors.warpHex, weftHexes: colors.weftHexes, weftIndexAt: colors.weftIndexAt });
    download("loom-" + structureId + ".wif", URL.createObjectURL(new Blob([wif], { type: "text/plain" })));
    ping("bell"); status("WIF draft saved: open it in any WIF-aware loom tool", "ok");
  });
  $("wv-draft").addEventListener("click", () => {
    if (!draft) return;
    const c = document.createElement("canvas");
    renderDraftChart(c, draft, colors, { width: 1200 });
    download("loom-draft-" + structureId + ".png", c.toDataURL("image/png"));
    ping("bell"); status("draft chart saved", "ok");
  });
  $("wv-save").addEventListener("click", () => { if (draft) { download("loom-cloth.png", out.toDataURL("image/png")); ping("preset"); } });
  $("wv-send-poster").addEventListener("click", () => {
    if (!draft) { status("Choose an image or draft first.", ""); return; }
    if (!sendPiece("poster", out.toDataURL("image/png"), { surface: "loom", label: "woven cloth" })) {
      status("The image could not be carried across. Export the cloth image and open it in Poster instead.", "err");
    }
  });
  $("wv-send-retro").addEventListener("click", () => {
    if (!draft) return;
    const label = STRUCTURES[structureId].name.toLowerCase() + ", " + draft.ends + " ends";
    if (!sendPiece("retro", out.toDataURL("image/png"), { surface: "loom", label })) {
      status("cloth too large to hand off", "err"); return;
    }
    ping("bell"); status("opening the Retro Engine…", "ok");
  });

  // Native projects preserve the actual draft. Settings below are recipes only.
  const projectFile = $("wv-project-file"), projectStatus = $("wv-project-status");
  function projectMessage(message, state) {
    projectStatus.hidden = false;
    projectStatus.textContent = message;
    projectStatus.dataset.state = state;
    projectStatus.className = "re-status" + (state === "error" ? " err" : "");
  }
  function projectSettings() {
    return {
      structureId, sett: +$("wv-sett").value, tone: +$("wv-tone").value,
      warp: $("wv-warp").value, warpColor: $("wv-warp-color").value, weft: $("wv-weft").value,
      speed: +$("wv-speed").value, epi: +$("wv-epi").value,
      weave: $("wv-weaveit").checked, woven, view, zoom: chartZoom,
    };
  }
  function syncSourceControls() {
    for (const el of document.querySelectorAll("#wv-sett, #wv-tone, #wv-structures button, #wv-recipes button")) el.disabled = !haveSource;
    const imageChoice = $("wv-weft").querySelector('option[value="image"]');
    if (imageChoice) imageChoice.disabled = !haveSource;
    if (!haveSource) $("wv-structure-hint").textContent = "Imported draft. Add an image to generate a new structure; crossings and yarn colors remain editable.";
  }
  function restoreProject(project, sourceImage) {
    const s = project.settings;
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (sourceImage) {
      const ctx = src.getContext("2d");
      ctx.clearRect(0, 0, src.width, src.height);
      ctx.drawImage(sourceImage, 0, 0);
    }
    haveSource = !!sourceImage;
    draft = project.draft; colors = project.colors;
    imported = project.imported ? { draft, colors, title: "Imported draft" } : null;
    edited = project.edited; draftCursor = null;
    structureId = s.structureId; woven = s.woven; view = s.view; chartZoom = s.zoom;
    for (const key of ["sett", "tone", "warp", "weft", "speed", "epi"]) $("wv-" + key).value = String(s[key]);
    $("wv-warp-color").value = s.warpColor; $("wv-warp-color").hidden = s.warp !== "custom";
    $("wv-weaveit").checked = s.weave;
    $("wv-sett-v").textContent = s.sett + " ends";
    $("wv-tone-v").textContent = s.tone;
    $("wv-speed-v").textContent = s.speed;
    $("wv-epi-v").textContent = s.epi + " epi";
    host.querySelectorAll(".re-chip").forEach(c => c.setAttribute("aria-checked", String(c.dataset.id === structureId)));
    $("wv-views").querySelectorAll("[data-view]").forEach(c => c.setAttribute("aria-checked", String(c.dataset.view === view)));
    $("wv-zooms").querySelectorAll("[data-zoom]").forEach(c => c.setAttribute("aria-checked", String(+c.dataset.zoom === chartZoom)));
    $("wv-chart").hidden = view !== "draft"; out.hidden = view === "draft";
    $("wv-zoom-field").hidden = view !== "draft";
    $("wv-stage-preview").classList.toggle("wv-zoomed", view === "draft" && chartZoom > 1);
    $("wv-structure-hint").textContent = draft.perCell ? "per-thread shading, chart + cloth exports" : draft.shafts + " shafts, " + draft.treadles + " treadles";
    syncSourceControls();
    $("wv-file").value = ""; $("wv-wif-in").value = "";
    draw(); sync();
  }
  async function captureLoomProject({ preview = true } = {}) {
    if (!draft) { projectMessage("Choose an image or draft before saving.", "error"); return; }
    const revision = editRevision, sourceVersion = sourceOperation;
    const { encodeLoomProject } = await import("./loom-project.js?v=20260907-project-files");
    if (revision !== editRevision || sourceVersion !== sourceOperation) {
      throw Object.assign(new Error("Your work changed while saving was being prepared. Save again to keep the latest version."), { state: "cancelled" });
    }
    const text = encodeLoomProject({ draft, colors, settings: projectSettings(),
      source: haveSource ? src.toDataURL("image/png") : null, edited, imported: !!imported });
    return {
      file: new File([text], "zentropy-loom.json", { type: "application/json" }),
      title: "Loom, " + STRUCTURES[structureId].name,
      preview: preview ? captureCanvasPreview(out) : null,
    };
  }
  $("wv-project-save").addEventListener("click", async () => {
    try {
      const project = await captureLoomProject({ preview: false });
      if (!project) return;
      const url = URL.createObjectURL(project.file);
      download("zentropy-loom.json", url);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      projectMessage("Project download started. Open this file to continue editing.", "saved");
    } catch (error) { projectMessage(error.message || "The project could not be saved. Your work is still here.", error.state || "error"); }
  });
  mountLibrarySave($("wv-project-save").parentElement, captureLoomProject, { className: "re-btn" });
  $("wv-project-open").addEventListener("click", () => projectFile.click());
  projectFile.addEventListener("change", async () => {
    const file = projectFile.files?.[0]; if (!file) return;
    const operation = ++projectOperation, sourceVersion = ++sourceOperation, revision = editRevision;
    projectMessage("Opening project…", "loading");
    try {
      const { decodeLoomProject, MAX_PROJECT_BYTES } = await import("./loom-project.js?v=20260907-project-files");
      if (file.size > MAX_PROJECT_BYTES) throw new Error("This project exceeds the 24 MB file limit. Your work is unchanged.");
      const project = decodeLoomProject(await file.text());
      let image = null;
      if (project.source) {
        image = new Image(); image.src = project.source; await image.decode();
        if (image.naturalWidth !== 640 || image.naturalHeight !== 400) throw new Error("The project's working image has unsupported dimensions.");
      }
      if (operation !== projectOperation) return;
      if (sourceVersion !== sourceOperation || revision !== editRevision) {
        projectMessage("Your newer changes were kept. Open the file again to replace them.", "cancelled"); return;
      }
      restoreProject(project, image);
      projectMessage("Project opened. Draft, colors and layout restored.", "ready");
    } catch (error) {
      if (operation === projectOperation) projectMessage(error.message || "The file could not be opened. Your work is unchanged.", "error");
    } finally { if (operation === projectOperation) projectFile.value = ""; }
  });

  // --- reusable settings: controls only; legacy records remain available -----
  const SETUPS_KEY = "wb.loom.setups.v1";
  const loadSetups = () => { try { const saved = JSON.parse(localStorage.getItem(SETUPS_KEY) || "[]"); return Array.isArray(saved) ? saved.filter(s => s && typeof s === "object").slice(0, 24) : []; } catch (_) { return []; } };
  function refreshSetups() {
    const sel = $("wv-setups"); if (!sel) return;
    sel.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());
    loadSetups().forEach((s, i) => {
      const o = document.createElement("option"); o.value = String(i); o.textContent = s.name; sel.appendChild(o);
    });
  }
  const saveSetupBtn = $("wv-save-setup");
  if (saveSetupBtn) saveSetupBtn.addEventListener("click", async () => {
    const wb = await import("./workbench.js?v=20260907-creative-handoff");
    const setups = loadSetups();
    const name = STRUCTURES[structureId].name.toLowerCase() + " · " + $("wv-sett").value + " ends · " + setups.length;
    setups.unshift({ name, structureId, sett: $("wv-sett").value, tone: $("wv-tone").value,
      warp: $("wv-warp").value, warpColor: $("wv-warp-color") ? $("wv-warp-color").value : undefined,
      weft: $("wv-weft").value, speed: $("wv-speed").value, trail: wb.currentTrail() });
    try { localStorage.setItem(SETUPS_KEY, JSON.stringify(setups.slice(0, 24))); } catch (e) { status("could not keep the setup", "err"); return; }
    refreshSetups(); ping("bell"); status("Settings saved in this browser. The image and hand edits are not included.", "ok");
  });
  const setupsSel = $("wv-setups");
  if (setupsSel) setupsSel.addEventListener("change", async () => {
    const s = loadSetups()[+setupsSel.value]; setupsSel.value = "";
    if (!s) return;
    if (!haveSource) { status("Add a source image before applying saved settings. Your imported draft is unchanged.", "err"); return; }
    structureId = s.structureId in STRUCTURES ? s.structureId : "jacquard";
    host.querySelectorAll(".re-chip").forEach((c) => c.setAttribute("aria-checked", String(c.dataset.id === structureId)));
    $("wv-sett").value = s.sett; $("wv-sett-v").textContent = s.sett + " ends";
    $("wv-tone").value = s.tone; $("wv-tone-v").textContent = s.tone;
    $("wv-warp").value = s.warp; $("wv-weft").value = s.weft;
    const wc = $("wv-warp-color");
    if (wc) { if (s.warpColor) wc.value = s.warpColor; wc.hidden = s.warp !== "custom"; }
    $("wv-speed").value = s.speed; $("wv-speed-v").textContent = s.speed;
    rebuild(true); ping("preset");
    const wb = await import("./workbench.js?v=20260907-creative-handoff");
    status("setup restored: " + s.name + (s.trail && s.trail.length ? " · was " + wb.trailLine(s.trail) : ""), "ok");
  });
  refreshSetups();

  // --- palpable controls + keys + fullscreen (the house feel) ---------------
  const canBuzz = "vibrate" in navigator && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const panel = $("wv-panel");
  panel.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".re-btn,.re-chip,.re-toggle");
    if (!el) return;
    if (canBuzz) try { navigator.vibrate(10); } catch (_) {}
    el.classList.remove("re-hit"); void el.offsetWidth; el.classList.add("re-hit");
  });
  panel.addEventListener("input", (e) => {
    const el = e.target;
    if (el.type !== "range") return;
    const span = (el.max - el.min) / 14, snap = Math.round((el.value - el.min) / span);
    if (el.__detent !== snap) {
      el.__detent = snap;
      if (canBuzz) try { navigator.vibrate(6); } catch (_) {}
      el.classList.remove("re-tick"); void el.offsetWidth; el.classList.add("re-tick");
    }
  });
  async function fullscreen() {
    const stage = $("wv-stage-preview");
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.requestFullscreen(); } catch (_) {}
  }
  $("wv-fullscreen").addEventListener("click", fullscreen);
  out.addEventListener("dblclick", fullscreen);
  document.addEventListener("fullscreenchange", () => {
    $("wv-fullscreen").setAttribute("aria-pressed", String(!!document.fullscreenElement));
  });
  document.addEventListener("keydown", (e) => {
    const t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || (t && t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " ") { e.preventDefault(); $("wv-weaveit").checked = !$("wv-weaveit").checked; $("wv-weaveit").dispatchEvent(new Event("change")); }
    else if (e.key === "s" || e.key === "S") $("wv-save").click();
    else if (e.key === "f" || e.key === "F") fullscreen();
  });

  // --- boot -----------------------------------------------------------------
  mountFlow($("wv-flow"), "loom");
  // A handoff is claimed only when the URL says one was sent; an organic
  // visit must never consume a stale key a cancelled navigation left behind.
  const wantsImport = new URLSearchParams(location.search).get("import") === "render";
  if (!(wantsImport && bootHandoff())) bootPlate();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
