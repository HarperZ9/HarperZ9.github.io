// studio-shell.js: the Studio's one shell. A source switch that folds the 24 sources away once one
// is chosen, an inspector header that names the source and what it does, and one action bar with
// the same order everywhere: the source's main action, Undo, Redo, Export, Pin. Undo and Redo
// share one history model: every source that joins the shell hands over snapshot() and
// restore(state), and the shell keeps a stack of snapshots per source. Leaving a source never
// discards its stack, so coming back and pressing Undo still walks back through the earlier work.
//
// The history half is pure and runs in Node (studio-shell.test.mjs). The DOM half only proxies
// clicks to the controls each source already had, so every existing control id and handler keeps
// working and the shell changes no drawing.

// One line per source: what the reader can do there. Numbers follow the source menu.
export const SOURCE_GUIDE = Object.freeze({
  atelier:   { name: "Atelier", purpose: "Draw a generative study from a seed. The same seed always draws the same picture." },
  fractal:   { name: "2D Fractal", purpose: "Explore the Mandelbrot, Julia and Burning Ship sets. Scroll to zoom toward the cursor, drag to pan." },
  fractal3d: { name: "3D Fractal", purpose: "Render a Mandelbox or a Mandelbulb and orbit it." },
  ndim:      { name: "Dimensions", purpose: "Rotate a polytope in four or more dimensions and project it onto the screen." },
  spatial:   { name: "Spatial", purpose: "Walk a splat world. A package that fails its SHA-256 receipt does not draw." },
  poster:    { name: "Poster", purpose: "Compose a poster from a seeded field, type and layers." },
  neural:    { name: "Living neural", purpose: "A seeded neural field. It rests on one frame until you press play." },
  sound:     { name: "Seed sound", purpose: "Hear a seed as a melody and measure it while it plays." },
  plotmaps:  { name: "Plot maps", purpose: "Turn a field, a plate or your own picture into a pen-plotter sheet." },
  voxels:    { name: "Voxels", purpose: "Build, carve and paint a seeded voxel scene, then export it." },
  sketch:    { name: "Sketch", purpose: "Draw by hand. Your strokes stay in this browser and export as a plotter sheet." },
  byo:       { name: "Bring your own", purpose: "Drop in an image, a video, a 3D model or a sound, then transform and measure it." },
  watch:     { name: "Watch with me", purpose: "Share a screen or a camera and read it frame by frame in this browser." },
  music:     { name: "Music", purpose: "Visuals that follow the built-in synth, your microphone or a track you load." },
  discovery: { name: "Physics", purpose: "Let the discovery engine find a conserved quantity in a simulated system." },
  showcase:  { name: "Showcase", purpose: "Integrate a system, fit its conserved quantity, and re-check the receipt in this browser." },
  retro:     { name: "Retro Engine", purpose: "A shader through pixelate, palette, dither and a CRT tube." },
  gallery:   { name: "Gallery", purpose: "One plate from the Gallery, drawn from its seed." },
  loom:      { name: "Loom", purpose: "A seeded plate woven into cloth with the Loom's draft maths." },
  type:      { name: "Type forge", purpose: "Set your text in Zain Mint, minted in this browser." },
  splats:    { name: "Splat Lab", purpose: "Where the Splat Lab's scenes live. They draw in the Spatial source." },
  brender:   { name: "BRender", purpose: "Re-hash the BRender restoration's release media in this browser." },
  revival:   { name: "Engine Revival", purpose: "Re-hash Engine Revival's release media in this browser." },
  raw:       { name: "RAW", purpose: "Render one scene with raw-native and check the fast path against the reference." },
});

// The action bar's fixed order. A source leaves out what it does not have; it never reorders.
export const ACTION_ORDER = Object.freeze(["primary", "undo", "redo", "export", "pin"]);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * createHistory({ limit }) -> per-source undo history of snapshots.
 * record(source, state, label) pushes a snapshot unless it equals the current one, and clears that
 * source's redo stack. undo(source) returns the snapshot to restore (the one before the current),
 * or null at the start. redo(source) returns the snapshot to restore going forward, or null.
 */
export function createHistory({ limit = 60 } = {}) {
  const books = new Map();   // source -> { past: [{ state, label }], future: [...] }
  const book = (s) => { let b = books.get(s); if (!b) { b = { past: [], future: [] }; books.set(s, b); } return b; };
  return {
    record(source, state, label = "") {
      if (state == null) return false;
      const b = book(source);
      const top = b.past[b.past.length - 1];
      if (top && same(top.state, state)) return false;
      b.past.push({ state: JSON.parse(JSON.stringify(state)), label });
      if (b.past.length > limit) b.past.shift();
      b.future.length = 0;
      return true;
    },
    undo(source) {
      const b = book(source);
      if (b.past.length < 2) return null;
      b.future.push(b.past.pop());
      return JSON.parse(JSON.stringify(b.past[b.past.length - 1].state));
    },
    redo(source) {
      const b = book(source);
      if (!b.future.length) return null;
      const next = b.future.pop();
      b.past.push(next);
      return JSON.parse(JSON.stringify(next.state));
    },
    canUndo: (source) => book(source).past.length > 1,
    canRedo: (source) => book(source).future.length > 0,
    current: (source) => { const b = book(source); const t = b.past[b.past.length - 1]; return t ? JSON.parse(JSON.stringify(t.state)) : null; },
    depth: (source) => ({ past: book(source).past.length, future: book(source).future.length }),
  };
}

// True when a key event belongs to a text field, where the browser's own undo must win.
export function isTextEntry(el) {
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag !== "input") return false;
  const t = (el.getAttribute("type") || "text").toLowerCase();
  return ["text", "search", "url", "email", "password", "number"].includes(t);
}

// Which history step a key chord asks for: "undo", "redo" or null. Cmd on macOS, Ctrl elsewhere.
export function chordOf(e) {
  if (!e || !(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const k = String(e.key || "").toLowerCase();
  if (k === "z") return e.shiftKey ? "redo" : "undo";
  if (k === "y" && !e.shiftKey) return "redo";
  return null;
}

/**
 * mountShell({ doc, rail, setSource, getSource, contracts }) wires the shell into the page.
 * contracts[source] = { primary, exports?, pin?, snapshot(), restore(state) }: primary and each export
 * are { label, target, title? }, pin is a target, and a target is the id of a control the source
 * already had. A target inside the rail moves into the bar: the shell marks it data-in-bar and
 * studio-shell.css hides the original, so each action shows once.
 * Returns { sourceChanged(next), record(source, label), recordSoon(source, label), undo(), redo() }.
 */
export function mountShell({ doc = globalThis.document, rail, setSource, getSource, contracts = {} }) {
  const history = createHistory();
  const $ = (id) => doc.getElementById(id);
  const sw = $("source-switch");
  const menu = $("studio-source");
  const head = $("inspector-head");
  const bar = $("inspector-actions");
  let restoring = false;

  // ── source switch ─────────────────────────────────────────────────────────
  const setOpen = (open, focusMenu) => {
    if (!rail || !sw) return;
    rail.dataset.sources = open ? "open" : "closed";
    sw.setAttribute("aria-expanded", String(open));
    if (open && focusMenu && menu) {
      const sel = menu.querySelector('[aria-selected="true"]') || menu.querySelector("button");
      if (sel) sel.focus();
    }
  };
  if (sw) sw.addEventListener("click", () => setOpen(rail.dataset.sources !== "open", true));
  if (menu) {
    // A pointer pick, Enter or Space folds the menu away and hands focus to the inspector; arrow
    // keys still walk the sources with the menu open (the tablist's roving focus is unchanged).
    menu.addEventListener("click", (e) => {
      if (!e.target.closest || !e.target.closest("button[data-source]")) return;
      setOpen(false);
      const title = $("inspector-title");
      if (title && e.detail === 0) { try { title.focus({ preventScroll: true }); } catch (_) { title.focus(); } }
    });
    menu.addEventListener("keydown", (e) => { if (e.key === "Escape") { setOpen(false); if (sw) sw.focus(); } });
  }

  // ── inspector header ──────────────────────────────────────────────────────
  const tabs = () => (menu ? [...menu.querySelectorAll("button[data-source]")] : []);
  function paintHead(source) {
    const g = SOURCE_GUIDE[source] || { name: source, purpose: "" };
    const n = String(tabs().findIndex((t) => t.dataset.source === source) + 1).padStart(2, "0");
    if (sw) {
      const num = sw.querySelector("[data-switch-num]"); if (num) num.textContent = n;
      const name = sw.querySelector("[data-switch-name]"); if (name) name.textContent = g.name;
    }
    if (!head) return;
    const t = $("inspector-title"); if (t) t.textContent = g.name;
    const p = $("inspector-purpose"); if (p) p.textContent = g.purpose;
    head.dataset.source = source;
  }

  // ── action bar ────────────────────────────────────────────────────────────
  const proxy = (target) => () => { const el = $(target); if (el && !el.disabled) el.click(); };
  function button(label, cls, onClick, extra = {}) {
    const b = doc.createElement("button");
    b.type = "button"; b.className = cls; b.textContent = label;
    for (const [k, v] of Object.entries(extra)) b.setAttribute(k, v);
    b.addEventListener("click", onClick);
    return b;
  }
  function paintBar(source) {
    if (!bar) return;
    const c = contracts[source];
    bar.replaceChildren();
    if (rail) rail.dataset.inspector = c ? "unified" : "legacy";
    if (!c) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.setAttribute("aria-label", (SOURCE_GUIDE[source] || { name: source }).name + " actions");
    if (c.primary) bar.append(button(c.primary.label, "btn ia-primary", proxy(c.primary.target),
      { "data-action": "primary", ...(c.primary.title ? { title: c.primary.title } : {}) }));
    bar.append(button("Undo", "btn ghost", () => undo(), { "data-action": "undo", "aria-keyshortcuts": "Control+Z Meta+Z" }));
    bar.append(button("Redo", "btn ghost", () => redo(), { "data-action": "redo", "aria-keyshortcuts": "Control+Shift+Z Meta+Shift+Z Control+Y" }));
    if (c.exports && c.exports.length) {
      const d = doc.createElement("details"); d.className = "ia-export"; d.dataset.action = "export";
      const s = doc.createElement("summary"); s.className = "btn ghost"; s.textContent = "Export";
      const list = doc.createElement("div"); list.className = "ia-export-list"; list.setAttribute("role", "group"); list.setAttribute("aria-label", "Export formats");
      for (const x of c.exports) list.append(button(x.label, "btn ghost", () => { d.open = false; proxy(x.target)(); }, { "data-export": x.target }));
      d.append(s, list); bar.append(d);
    }
    if (c.pin) bar.append(button("Pin", "btn ghost", proxy(c.pin), { "data-action": "pin" }));
    syncHistoryButtons(source);
  }
  function syncHistoryButtons(source = getSource()) {
    if (!bar) return;
    const u = bar.querySelector('[data-action="undo"]'), r = bar.querySelector('[data-action="redo"]');
    if (u) u.disabled = !history.canUndo(source);
    if (r) r.disabled = !history.canRedo(source);
  }

  // ── history ───────────────────────────────────────────────────────────────
  function record(source, label) {
    const c = contracts[source];
    if (!c || restoring || source !== getSource()) return false;
    let state = null;
    try { state = c.snapshot(); } catch (err) { console.error("[studio-shell] snapshot failed for " + source + ":", err); return false; }
    const changed = history.record(source, state, label);
    if (changed) syncHistoryButtons(source);
    return changed;
  }
  const timers = new Map();
  function recordSoon(source, label, ms = 400) {
    clearTimeout(timers.get(source));
    timers.set(source, setTimeout(() => record(source, label), ms));
  }
  function apply(source, state) {
    if (state == null) return false;
    restoring = true;
    try { contracts[source].restore(state); }
    catch (err) { console.error("[studio-shell] restore failed for " + source + ":", err); }
    finally { restoring = false; }
    syncHistoryButtons(source);
    return true;
  }
  function undo() { const s = getSource(); return contracts[s] ? apply(s, history.undo(s)) : false; }
  function redo() { const s = getSource(); return contracts[s] ? apply(s, history.redo(s)) : false; }

  doc.addEventListener("keydown", (e) => {
    const step = chordOf(e);
    if (!step || isTextEntry(e.target) || !contracts[getSource()]) return;
    e.preventDefault();
    if (step === "undo") undo(); else redo();
  });

  function sourceChanged(next) {
    paintHead(next);
    paintBar(next);
  }
  // Mark every rail control the bar now carries, so the original stays wired but out of sight.
  for (const c of Object.values(contracts)) {
    for (const t of [c.primary && c.primary.target, c.pin, ...(c.exports || []).map((x) => x.target)]) {
      const el = t && $(t);
      if (el && rail && rail.contains(el)) el.setAttribute("data-in-bar", "");
    }
  }
  paintHead(getSource());
  paintBar(getSource());
  if (rail && !rail.dataset.sources) setOpen(false);
  return { sourceChanged, record, recordSoon, undo, redo, history, setOpen };
}
