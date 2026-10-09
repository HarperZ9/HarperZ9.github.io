// gallery-desk.js: the Gallery's print desk, moved out of gallery.html's inline script (9 October
// 2026) so the Studio's Gallery source can run the same desk in full. Nothing in the desk changed.
// It boots against the desk markup already in the document (#desk-canvas, #desk-seed, #desk-chips
// and the rest). A host page may set window.__galleryDeskHost before importing it:
//   mirror: false     leave the address bar alone (the Studio owns it)
//   inView()          whether the spacebar reroll applies
//   send(target, c)   hand the plate to "retro" or "loom" without leaving the page
//   workshop(seed)    open the poster workshop with this seed
//   linkPage          the page a copied link opens (gallery.html)
//   search            the query string to read a deep link from ("" for none)
//   onDrawn()         called after every plate the desk draws
import { renderSpecimen, renderSpecimenOver, drawImageFit, specimenLayerNames, specimenLayerFamilies, specimenLayerBlurbs } from "./generative-field.js?v=20260925-void-plates";
import { applyOpsWet, OP_META } from "./glitch-ops.js?v=20260813-wet";

const HOST = (typeof window !== "undefined" && window.__galleryDeskHost) || {};
const daily = `gallery-${new Date().toISOString().slice(0, 10)}`;

// Bring-your-own-material: the visitor's image, influenced by the instruments.
// It stays a bitmap in this tab; there is no upload. When material.active, the
// desk redraws the bitmap and composites the chosen instruments OVER it at the
// influence alpha, instead of drawing a pure seeded plate.
const material = { active: false, bitmap: null, name: "" };

function savePng(canvas) {
  try {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      const seed = (canvas.dataset && canvas.dataset.specimen) || "plate";
      a.href = URL.createObjectURL(blob);
      a.download = `telos-plate-${seed.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  } catch (error) {
    console.error("gallery: save failed", error);
  }
}

/* ── the print desk: seed + instrument mix -> your plate ─────────────────── */
const ALL_LAYERS = specimenLayerNames();
const DESK_MAX = 3;
const deskCanvas = document.getElementById("desk-canvas");
const deskSeed = document.getElementById("desk-seed");
const deskChips = document.getElementById("desk-chips");
const deskStatus = document.getElementById("desk-status");
const deskTitle = document.getElementById("desk-title");
const deskMeta = document.getElementById("desk-meta");
const picked = new Set(["showpiece-aperture"]);
const locked = new Set();
const chipRefs = new Map();

function say(text) { if (deskStatus) deskStatus.textContent = text; }

// A selected chip grows a padlock. Locks pin the SELECTION: a locked
// instrument survives every reroll (the engine draws all layers from one seed
// in one pass, so the lock guards which instruments are in the mix, not a
// per-layer sub-seed - that honesty is stated in the hint copy).
const LOCK_GLYPH =
  '<svg class="lk-open" viewBox="0 0 12 13" width="11" height="12" aria-hidden="true">' +
  '<path d="M4 5.5V4a2.6 2.6 0 0 1 5.1-.9" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
  '<rect x="1.4" y="5.5" width="7.2" height="6" rx="1.3" fill="currentColor"/></svg>' +
  '<svg class="lk-shut" viewBox="0 0 12 13" width="11" height="12" aria-hidden="true">' +
  '<path d="M2.9 5.5V3.9a2.6 2.6 0 0 1 5.2 0v1.6" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
  '<rect x="1.4" y="5.5" width="7.2" height="6" rx="1.3" fill="currentColor"/></svg>';

const LAYER_BLURBS = specimenLayerBlurbs();
function chipFor(name) {
  const wrap = document.createElement("span");
  wrap.className = "chip-wrap";
  const pick = document.createElement("button");
  pick.type = "button";
  pick.className = "chip";
  pick.textContent = name;
  const blurb = LAYER_BLURBS[name];
  if (blurb) {
    pick.title = blurb;
    pick.setAttribute("aria-label", `${name}: ${blurb}`);
  }
  pick.setAttribute("aria-pressed", String(picked.has(name)));
  pick.addEventListener("click", () => {
    if (picked.has(name)) {
      picked.delete(name);
      locked.delete(name);
    } else if (picked.size >= DESK_MAX) {
      say(`three instruments at most - drop one first`);
      return;
    } else {
      picked.add(name);
    }
    say("");
    syncChips();
    drawDesk();
  });
  const lock = document.createElement("button");
  lock.type = "button";
  lock.className = "chip-lock";
  lock.hidden = !picked.has(name);
  lock.setAttribute("aria-pressed", "false");
  lock.setAttribute("aria-label", `Lock ${name} so rerolls keep it in the mix`);
  lock.innerHTML = LOCK_GLYPH;
  lock.addEventListener("click", () => {
    if (!picked.has(name)) return;
    if (locked.has(name)) locked.delete(name); else locked.add(name);
    lock.setAttribute("aria-pressed", String(locked.has(name)));
    say(locked.has(name) ? `${name} locked - rerolls keep it` : `${name} unlocked - rerolls may trade it`);
  });
  wrap.append(pick, lock);
  chipRefs.set(name, { pick, lock });
  return wrap;
}

function syncChips() {
  chipRefs.forEach((refs, name) => {
    if (!picked.has(name)) locked.delete(name);
    refs.pick.setAttribute("aria-pressed", String(picked.has(name)));
    refs.lock.hidden = !picked.has(name);
    refs.lock.setAttribute("aria-pressed", String(locked.has(name)));
  });
}

// The vocabulary shelved by family: each register gets a labeled row, so at
// eighty-plus instruments the wall reads as a library, not noise.
const FAMILY_ORDER = [
  "showpieces", "outrun", "cassette console", "op-art textile", "biomech ink",
  "dark monument", "aperiodic order", "plotter density", "observatory",
  "field studies", "optics", "print & interference", "glitch & ruin",
  "growth", "mathematics", "thread & structure", "neural", "more",
];
if (deskChips) {
  const fam = specimenLayerFamilies();
  const shelves = new Map();
  ALL_LAYERS.forEach((name) => {
    const f = fam[name] || "more";
    if (!shelves.has(f)) shelves.set(f, []);
    shelves.get(f).push(name);
  });
  const order = FAMILY_ORDER.filter((f) => shelves.has(f))
    .concat([...shelves.keys()].filter((f) => !FAMILY_ORDER.includes(f)));
  for (const f of order) {
    const lab = document.createElement("span");
    lab.className = "desk-fam-lab";
    lab.textContent = f;
    deskChips.appendChild(lab);
    shelves.get(f).forEach((name) => deskChips.appendChild(chipFor(name)));
  }
}

// Recipes: named starting combinations. Picking one swaps the selection in
// (locks clear, the seed stays) and draws. Only recipes whose instruments all
// exist are offered, so the list can lead the library by a wave.
const DESK_RECIPES = [
  { name: "open aperture", layers: ["showpiece-aperture", "aurora-leak"] },
  { name: "lantern night", layers: ["showpiece-lantern", "aurora-leak"] },
  { name: "overprint cloth", layers: ["riso-moire", "weave-lattice", "dendrite"] },
  { name: "signal ruin", layers: ["databend", "pixel-sort-ruin", "scanline"] },
  { name: "atlas plate", layers: ["plotter-plate", "contour", "dither"] },
  { name: "glass planet", layers: ["planet-limb", "crystal-lens", "caustic-veils"] },
  { name: "coral etching", layers: ["dla-coral", "groove", "moire-swirl"] },
  { name: "night drive", layers: ["venetian-sun", "laser-ridge", "star-streak"] },
  { name: "control room", layers: ["vu-bank", "patch-catenary", "phosphor-readout"] },
  { name: "interference cloth", layers: ["ikat-drift", "riley-swell"] },
  { name: "spinal machine", layers: ["vertebra-drive", "ribbed-conduit", "chitin-shingles"] },
  { name: "dark tower", layers: ["strata-monolith", "ashfall-horizon", "mourning-veils"] },
  { name: "quasicrystal", layers: ["kite-and-dart", "ammann-ghost", "starburst-grating"] },
  { name: "pen study", layers: ["spiral-tone", "terrace-hatch"] },
  { name: "star atlas", layers: ["engraved-sky", "apsis-ledger"] },
];
const deskRecipes = document.getElementById("desk-recipes");
if (deskRecipes) {
  DESK_RECIPES.filter((r) => r.layers.every((l) => ALL_LAYERS.includes(l)))
    .forEach((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip chip-recipe";
      b.textContent = r.name;
      b.title = r.layers.join(" + ");
      b.setAttribute("aria-label",
        `Recipe ${r.name}: set the instruments to ${r.layers.join(", ")}`);
      b.addEventListener("click", () => {
        picked.clear(); locked.clear();
        r.layers.forEach((l) => picked.add(l));
        say(`${r.name}: ${r.layers.join(" + ")}`);
        syncChips();
        drawDesk();
      });
      deskRecipes.appendChild(b);
    });
}

function deskSeedValue() {
  const raw = (deskSeed && deskSeed.value.trim()) || "";
  return raw.slice(0, 48) || "unnamed";
}

// ── the effect rack ──────────────────────────────────────────────────────────
// The same treatments the Retro Engine runs, reachable without leaving the
// desk. They are a LAYER OVER the drawn plate, never a replacement: the plate
// redraws from its seed first, then every active effect lands in switch-on
// order, so the result stays reproducible from (seed, instruments, effects).
const activeFx = [];                      // ordered: the stack is the order
const fxRefs = new Map();
const deskFx = document.getElementById("desk-fx");
const deskFxTune = document.getElementById("desk-fx-tune");
const deskFxAmount = document.getElementById("desk-fx-amount");

function fxAmount() {
  const v = deskFxAmount ? Number(deskFxAmount.value) : 0.6;
  return Number.isFinite(v) ? Math.max(0.05, Math.min(1, v)) : 0.6;
}
function syncFx() {
  fxRefs.forEach((btn, op) => btn.setAttribute("aria-pressed", String(activeFx.includes(op))));
  if (deskFxTune) deskFxTune.hidden = activeFx.length === 0;
}
// Applied to the plate after it draws. Seeded from the plate's own seed so the
// same seed and the same stack give the same treated plate on any visit.
function applyDeskFx() {
  if (!deskCanvas || !activeFx.length) return;
  const seed = deskSeedValue();
  const amount = fxAmount();
  // ops run at full force; the slider is the wet/dry mix, which is the only
  // strength that means anything across a rack where most ops ignore `amount`
  applyOpsWet(deskCanvas,
    activeFx.map((op, i) => ({ op, amount: 1, seed: seed + ":" + op + ":" + i })),
    amount);
}

if (deskFx && Array.isArray(OP_META)) {
  const shelves = new Map();
  for (const m of OP_META) {
    if (!shelves.has(m.cat)) shelves.set(m.cat, []);
    shelves.get(m.cat).push(m);
  }
  for (const [cat, metas] of shelves) {
    const lab = document.createElement("span");
    lab.className = "desk-fam-lab";
    lab.textContent = cat;
    deskFx.appendChild(lab);
    for (const m of metas) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = m.label;
      b.setAttribute("aria-pressed", "false");
      if (m.desc) b.title = m.desc;
      b.setAttribute("aria-label", m.desc ? `${m.label}: ${m.desc}` : `${m.label} effect, ${cat}`);
      b.addEventListener("click", () => {
        const at = activeFx.indexOf(m.op);
        if (at >= 0) activeFx.splice(at, 1); else activeFx.push(m.op);
        syncFx();
        say(activeFx.length ? activeFx.join(" -> ") : "effects off");
        drawDesk();
      });
      fxRefs.set(m.op, b);
      deskFx.appendChild(b);
    }
  }
}
if (deskFxAmount) deskFxAmount.addEventListener("input", () => drawDesk());
const deskFxClear = document.getElementById("desk-fx-clear");
if (deskFxClear) deskFxClear.addEventListener("click", () => {
  activeFx.length = 0; syncFx(); say("effects off"); drawDesk();
});

// Mirror the drawn state into the address bar so every draw and every reroll
// is immediately linkable; a material plate is marked so the link says
// honestly that its base image lives only in the visitor's browser.
function mirrorDeskState(seed, layers) {
  if (HOST.mirror === false) return;   // inside the Studio the address bar belongs to the Studio
  try {
    const url = new URL(location.href);
    url.searchParams.set("seed", seed);
    url.searchParams.set("layers", layers.join(","));
    // A treated plate is only reproducible if the treatment travels with the
    // link, so the stack and its strength ride along in switch-on order.
    if (activeFx.length) {
      url.searchParams.set("fx", activeFx.join(","));
      url.searchParams.set("fxa", String(fxAmount()));
    } else { url.searchParams.delete("fx"); url.searchParams.delete("fxa"); }
    if (material.active) url.searchParams.set("material", "own"); else url.searchParams.delete("material");
    history.replaceState(null, "", url);
  } catch (error) {
    console.warn("gallery: address-bar state mirror skipped", error);
  }
}

// opts.mirror=false draws without touching the address bar (the arrival
// plate), so a visitor's first link is one they chose to make.
function drawDesk(opts = {}) {
  if (!deskCanvas) return;
  const seed = deskSeedValue();
  const layers = [...picked];
  // Pure-engine mode needs an instrument; material mode can stand on the image
  // alone (instruments then only influence it).
  if (!layers.length && !material.active) { say("pick at least one instrument"); return; }
  deskCanvas.dataset.specimenLayers = layers.join(",");
  if (renderSafe(deskCanvas, seed, layers)) {
    applyDeskFx();          // treatments land over the freshly drawn plate
    if (HOST.onDrawn) { try { HOST.onDrawn(); } catch (e) { console.error("gallery desk: host hook failed", e); } }
    if (material.active) {
      const overed = layers.length ? " · " + layers.join(" + ") + " at " + Math.round(materialInfluence() * 100) + "%" : "";
      if (deskTitle) deskTitle.textContent = "your material · " + material.name;
      if (deskMeta) deskMeta.textContent = "your image" + overed + " · never uploaded";
    } else {
      const fxLine = activeFx.length
        ? ` · treated ${activeFx.join(" -> ")} at ${Math.round(fxAmount() * 100)}%` : "";
      if (deskTitle) deskTitle.textContent = `${seed} · ${layers.join(" + ")}`;
      if (deskMeta) deskMeta.textContent = `seed ${seed} · ${layers.join(" + ")}${fxLine} · reproducible on any visit`;
    }
    if (opts.mirror !== false) mirrorDeskState(seed, layers);
  }
}

// Reroll: a fresh seed plus a fresh draw of every UNLOCKED instrument from
// the full vocabulary; locked instruments hold their place. The result is
// still a plain seeded plate - the new seed and mix land in the caption and
// the share state, so a lucky roll is reproducible and linkable.
function randomWord() {
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    const words = new Uint32Array(1);
    window.crypto.getRandomValues(words);
    return words[0];
  }
  return Math.floor(Math.random() * 4294967295) >>> 0;
}

function rollSeed() {
  return `roll-${randomWord().toString(36)}${randomWord().toString(36)}`;
}

function rerollDesk() {
  if (!picked.size) { say("pick at least one instrument, then reroll"); return; }
  const keep = [...picked].filter((name) => locked.has(name));
  const slots = picked.size - keep.length;
  if (!slots) { say("every instrument is locked - unlock one to reroll"); return; }
  const bag = ALL_LAYERS.filter((name) => !locked.has(name));
  const next = [...keep];
  for (let i = 0; i < slots && bag.length; i += 1) {
    next.push(bag.splice(randomWord() % bag.length, 1)[0]);
  }
  picked.clear();
  next.forEach((name) => picked.add(name));
  if (deskSeed) deskSeed.value = rollSeed();
  syncChips();
  const fresh = next.filter((name) => !keep.includes(name));
  say(keep.length ? `kept ${keep.join(" + ")} - rolled ${fresh.join(" + ")}` : `rolled ${fresh.join(" + ")}`);
  drawDesk();
}

const deskReroll = document.getElementById("desk-reroll");
if (deskReroll) deskReroll.addEventListener("click", rerollDesk);

// Spacebar rerolls when the desk is on screen and nothing interactive holds
// focus (a focused button keeps its native spacebar activation; typing a
// seed is never hijacked; elsewhere on the page, space still scrolls).
function deskInView() {
  if (HOST.inView) return HOST.inView();
  const desk = document.getElementById("printdesk");
  if (!desk) return false;
  const rect = desk.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

document.addEventListener("keydown", (event) => {
  if (event.key !== " " && event.key !== "Spacebar") return;
  const target = event.target;
  if (target && typeof target.closest === "function" &&
      target.closest("input,textarea,select,button,a,[contenteditable]")) return;
  if (!deskInView()) return;
  event.preventDefault();
  rerollDesk();
});

function renderSafe(canvas, seed, layers) {
  try {
    let ok;
    if (material.active && material.bitmap) {
      // The visitor's image is the base; the instruments influence it. Redraw
      // the bitmap at its own resolution, then composite the layers over it.
      drawImageFit(canvas, material.bitmap, { maxBacking: 2048 });
      const influence = materialInfluence();
      ok = layers.length ? renderSpecimenOver(canvas, seed, layers, { alpha: influence }) : true;
    } else {
      ok = renderSpecimen(canvas, seed, layers);
    }
    if (ok && canvas.dataset) {
      canvas.dataset.specimen = seed;
      canvas.dataset.specimenRendered = "true";
    }
    return ok;
  } catch (error) {
    console.error("gallery: desk render failed", error);
    say("that combination failed to draw - try different instruments");
    return false;
  }
}

function materialInfluence() {
  const el = document.getElementById("desk-influence");
  const v = el ? Number(el.value) : 0.5;
  return Number.isFinite(v) ? Math.max(0.1, Math.min(1, v)) : 0.5;
}

// ── bring your own material ──────────────────────────────────────────────────
const importBtn = document.getElementById("desk-import");
const importFile = document.getElementById("desk-import-file");
const influenceWrap = document.getElementById("desk-influence-wrap");
const clearMaterialBtn = document.getElementById("desk-clear-material");
const privacyLine = document.getElementById("desk-privacy");

async function adoptMaterial(file) {
  if (!file || !/^image\//.test(file.type)) { say("that is not an image file"); return; }
  try {
    let bmp;
    if (typeof createImageBitmap === "function") {
      bmp = await createImageBitmap(file);
    } else {
      bmp = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }
    material.active = true;
    material.bitmap = bmp;
    material.name = file.name || "your image";
    if (influenceWrap) influenceWrap.hidden = false;
    if (clearMaterialBtn) clearMaterialBtn.hidden = false;
    if (privacyLine) privacyLine.hidden = false;
    if (deskTitle) deskTitle.textContent = "your material · " + material.name;
    drawDesk();
    say("your image is loaded - pick instruments and set the influence to work it");
  } catch (error) {
    console.error("gallery: material load failed", error);
    say("that image could not be loaded");
  }
}

if (importBtn && importFile) {
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", (e) => { if (e.target.files && e.target.files[0]) adoptMaterial(e.target.files[0]); });
}
if (influenceWrap) {
  const slider = document.getElementById("desk-influence");
  if (slider) slider.addEventListener("input", () => { if (material.active) drawDesk(); });
}
if (clearMaterialBtn) {
  clearMaterialBtn.addEventListener("click", () => {
    material.active = false; material.bitmap = null; material.name = "";
    influenceWrap.hidden = true; clearMaterialBtn.hidden = true; if (privacyLine) privacyLine.hidden = true;
    drawDesk();
    say("back to pure engine mode");
  });
}
// Hand this plate to the Retro Engine as an upload source, so a plate you drew
// here can be pixelated, paletted, and run through the effects rack there.
const deskRetro = document.getElementById("desk-retro");
const deskLoom = document.getElementById("desk-loom");
const sendDesk = async (target) => {
  if (HOST.send) { try { await HOST.send(target, deskCanvas); } catch (e) { console.error("gallery desk: send failed", e); say("that plate could not be handed over"); } return; }
  try {
    const wb = await import("./workbench.js?v=20260812-cohesion");
    if (!wb.sendPiece(target, deskCanvas.toDataURL("image/png"), { surface: "gallery", label: "desk plate, seed " + ((deskCanvas.dataset && deskCanvas.dataset.specimen) || deskSeedValue()) })) {
      if (deskStatus) deskStatus.textContent = "that plate is too large to hand over";
    }
  } catch (err) { if (deskStatus) deskStatus.textContent = "that plate is too large to hand over"; }
};
if (deskRetro && deskCanvas) deskRetro.addEventListener("click", () => sendDesk("retro"));
if (deskLoom && deskCanvas) deskLoom.addEventListener("click", () => sendDesk("loom"));

// The desk sings. Sound arms the note-per-action instrument; Play the plate
// scans the desk canvas ANS-style (rows are pitches, the scan is time).
let deskAudio = null, plateRun = null, plateTimer = 0, plateBusy = false;
async function ensureDeskAudio() {
  const m = await import("./retro-audio.js?v=20261003-retro-sound");
  if (!deskAudio) deskAudio = m.createRetroAudio();
  return deskAudio;
}
const deskSound = document.getElementById("desk-sound");
if (deskSound) deskSound.addEventListener("click", async () => {
  try {
    const a = await ensureDeskAudio();
    if (a.isOn()) {
      a.stop();
      if (plateRun) {
        clearTimeout(plateTimer); plateRun = null;
        const dp = document.getElementById("desk-play");
        if (dp) dp.setAttribute("aria-pressed", "false");
      }
      deskSound.setAttribute("aria-pressed", "false");
      if (deskStatus) deskStatus.textContent = "sound off";
    } else {
      await a.start("gallery-" + deskSeedValue());
      deskSound.setAttribute("aria-pressed", "true");
      if (deskStatus) deskStatus.textContent = "sound on: every redraw and adoption plays a note";
    }
  } catch (_) { if (deskStatus) deskStatus.textContent = "audio needs a click in a quiet tab"; }
});
const deskPlay = document.getElementById("desk-play");
if (deskPlay) deskPlay.addEventListener("click", async () => {
  if (!deskCanvas || plateBusy) return;
  if (plateRun) {
    clearTimeout(plateTimer);
    plateRun.stop(); plateRun = null;
    deskPlay.setAttribute("aria-pressed", "false");
    if (deskStatus) deskStatus.textContent = "plate stopped";
    return;
  }
  plateBusy = true;
  try {
    const a = await ensureDeskAudio();
    const v = await import("./ans-voice.js?v=20260812-cohesion");
    const scan = v.scanImage(deskCanvas, 40, 96);
    plateRun = await a.playScan(scan, v.rowFrequencies(scan.rows, { mode: "penta" }), 9);
    deskPlay.setAttribute("aria-pressed", "true");
    if (deskStatus) deskStatus.textContent = "the plate is playing: rows are pitches, the scan is time";
    clearTimeout(plateTimer);
    plateTimer = setTimeout(() => { plateRun = null; deskPlay.setAttribute("aria-pressed", "false"); }, 9700);
  } catch (_) { if (deskStatus) deskStatus.textContent = "could not play the plate"; }
  plateBusy = false;
});
import("./palpable.js?v=20260812-depth").then((pal) => {
  pal.wirePalpable(document.body, {
    hitSelector: ".plate-redraw, .desk-var",
    ping: (k, val) => { try { if (deskAudio && deskAudio.isOn()) deskAudio.ping(k, val); } catch (_) {} },
  });
}).catch(() => {});
import("./workbench.js?v=20260812-cohesion").then((wb) => {
  wb.mountFlow(document.getElementById("gal-flow"), "gallery");
}).catch(() => {});
// Drag-drop onto the desk plate.
const deskArt = deskCanvas ? deskCanvas.closest(".plate-art") : null;
if (deskArt) {
  deskArt.addEventListener("dragover", (e) => { e.preventDefault(); deskArt.classList.add("desk-material-drop"); });
  deskArt.addEventListener("dragleave", () => deskArt.classList.remove("desk-material-drop"));
  deskArt.addEventListener("drop", (e) => {
    e.preventDefault();
    deskArt.classList.remove("desk-material-drop");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) adoptMaterial(e.dataTransfer.files[0]);
  });
}

const deskDraw = document.getElementById("desk-draw");
if (deskDraw) deskDraw.addEventListener("click", drawDesk);
if (deskSeed) deskSeed.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); drawDesk(); } });

const deskSave = document.getElementById("desk-save");
if (deskSave) deskSave.addEventListener("click", () => { if (deskCanvas && deskCanvas.dataset.specimenRendered === "true") savePng(deskCanvas); else say("draw a plate first"); });

// Plot it: convert the plate to plotter line art and REPLAY it stroke by
// stroke on the plate canvas (watching it draw is the point). When the pen
// finishes, the status offers the plotter-ready SVG.
let _plotHandle = null;
const deskPlot = document.getElementById("desk-plot");
if (deskPlot) deskPlot.addEventListener("click", async () => {
  if (!deskCanvas || deskCanvas.dataset.specimenRendered !== "true") { say("draw a plate first"); return; }
  try {
    if (_plotHandle) _plotHandle.stop();
    const plot = await import("./plotter.js");
    const seed = deskCanvas.dataset.specimen || "desk";
    const { svg, polylines, srcW, srcH, stats } = plot.plotCanvas(deskCanvas, { style: "flow", seed });
    say("plotting - " + stats.lines + " strokes...");
    _plotHandle = plot.replayPlot(deskCanvas, polylines, srcW, srcH, {
      onDone: () => {
        deskCanvas.dataset.specimenRendered = "";
        if (deskStatus) {
          deskStatus.textContent = "plot complete - " + stats.lines + " strokes. ";
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
          a.download = "telos-plot-" + seed.replace(/[^a-z0-9_-]+/gi, "-") + ".svg";
          a.textContent = "download the svg (plotter-ready)";
          deskStatus.appendChild(a);
        }
      },
    });
  } catch (error) {
    console.error("gallery: plot failed", error);
    say("the plot failed to draw - try a different plate");
  }
});

// Variations: four neighboring seeds of the current plate, drawn small.
// Clicking one adopts its seed at the desk - exploration without losing the
// original (the caption still names every seed, so nothing is unrecoverable).
const deskVary = document.getElementById("desk-vary");
const varyHost = document.getElementById("desk-variations");
if (deskVary && varyHost) deskVary.addEventListener("click", () => {
  if (!deskCanvas || deskCanvas.dataset.specimenRendered !== "true") { say("draw a plate first"); return; }
  const base = deskSeedValue();
  const layers = [...picked];
  varyHost.hidden = false;
  varyHost.innerHTML = "";
  for (let v = 1; v <= 4; v += 1) {
    const seed = base + "·" + v;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "desk-var";
    b.setAttribute("aria-label", "Adopt variation " + seed);
    const c = document.createElement("canvas");
    const tag = document.createElement("span");
    tag.className = "dv-tag";
    tag.textContent = seed;
    b.append(c, tag);
    varyHost.appendChild(b);
    try { renderSpecimen(c, seed, layers); } catch (e) { console.error("gallery: variation failed", e); }
    b.addEventListener("click", () => {
      if (deskSeed) deskSeed.value = seed;
      drawDesk();
      say("adopted " + seed);
    });
  }
  say("four neighbors of " + base + " - click one to adopt it");
});

// The workshop link carries the current plate's seed across surfaces.
function syncWorkshopLink() {
  const a = document.getElementById("desk-workshop");
  if (HOST.workshop && a && !a.dataset.hosted) {
    a.dataset.hosted = "1";
    a.addEventListener("click", (e) => { e.preventDefault(); HOST.workshop((deskCanvas && deskCanvas.dataset.specimen) || deskSeedValue()); });
  }
  if (a && deskCanvas && deskCanvas.dataset.specimen) {
    a.href = "studio.html?source=poster&seed=" + encodeURIComponent(deskCanvas.dataset.specimen);
  }
}
setInterval(syncWorkshopLink, 1200);

const deskShare = document.getElementById("desk-share");
if (deskShare) deskShare.addEventListener("click", async () => {
  if (!deskCanvas || deskCanvas.dataset.specimenRendered !== "true") { say("draw a plate first"); return; }
  const url = new URL(HOST.linkPage || location.pathname, location.href);
  url.searchParams.set("seed", deskCanvas.dataset.specimen || "unnamed");
  url.searchParams.set("layers", [...picked].join(","));
  try {
    await navigator.clipboard.writeText(url.toString());
    say(material.active
      ? "link copied - it reproduces the instrument settings, but your image stays on your machine, so it opens on the pure plate"
      : "link copied - it redraws this exact plate");
  } catch (error) {
    say(url.toString());
  }
});

// Deep links: gallery.html?seed=...&layers=a,b renders the visitor's plate
// at the desk on arrival and brings it into view.
const params = new URLSearchParams(HOST.search != null ? HOST.search : location.search);
const linkSeed = (params.get("seed") || "").slice(0, 48);
const linkLayers = (params.get("layers") || "").split(",").map((n) => n.trim()).filter((n) => ALL_LAYERS.includes(n)).slice(0, DESK_MAX);
const linkFx = (params.get("fx") || "").split(",").map((n) => n.trim())
  .filter((n) => fxRefs.has(n)).slice(0, 8);
const linkFxAmount = Number(params.get("fxa"));
if (linkSeed && linkLayers.length && deskCanvas) {
  picked.clear();
  linkLayers.forEach((n) => picked.add(n));
  syncChips();
  // restore the treatment too, or a shared link redraws a different picture
  activeFx.length = 0;
  linkFx.forEach((op) => activeFx.push(op));
  if (deskFxAmount && Number.isFinite(linkFxAmount) && linkFxAmount > 0) {
    deskFxAmount.value = String(Math.max(0.1, Math.min(1, linkFxAmount)));
  }
  syncFx();
  if (deskSeed) deskSeed.value = linkSeed;
  drawDesk();
  const desk = document.getElementById("printdesk");
  if (desk) desk.scrollIntoView();
} else if (deskCanvas && picked.size) {
  // Plain arrival: the desk opens on today's plate with the default pick, so
  // the first frame a visitor sees is a drawing rather than an empty stage.
  // Nothing scrolls and the address bar stays clean until they draw.
  if (deskSeed && !deskSeed.value.trim()) deskSeed.value = daily;
  drawDesk({ mirror: false });
}


// The desk's state as data, for a host that keeps an undo history (the Studio shell).
export function deskState() {
  return { seed: deskSeedValue(), layers: [...picked], locked: [...locked], fx: [...activeFx], fxa: deskFxAmount ? deskFxAmount.value : "0.6" };
}
export function applyDeskState(s) {
  if (!s) return;
  picked.clear(); locked.clear(); activeFx.length = 0;
  (s.layers || []).filter((l) => ALL_LAYERS.includes(l)).slice(0, DESK_MAX).forEach((l) => picked.add(l));
  (s.locked || []).filter((l) => picked.has(l)).forEach((l) => locked.add(l));
  (s.fx || []).filter((op) => fxRefs.has(op)).forEach((op) => activeFx.push(op));
  if (deskFxAmount && s.fxa != null) deskFxAmount.value = String(s.fxa);
  if (deskSeed) deskSeed.value = s.seed || "";
  syncChips(); syncFx();
  drawDesk({ mirror: false });
}
export function redrawDesk() { drawDesk({ mirror: false }); }
