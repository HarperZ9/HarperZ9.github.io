// studio-shell.js: the Studio's one shell. A source switch that folds the 26 sources away once one
// is chosen, an inspector header that names the source and what it does, and one action bar with
// the same order everywhere: the source's main action, Undo, Redo, Export, Pin. Undo and Redo
// share one history model: every source that joins the shell hands over snapshot() and
// restore(state), and the shell keeps a stack of snapshots per source. Leaving a source never
// discards its stack, so coming back and pressing Undo still walks back through the earlier work.
//
// Work is also kept in this browser (studio-store.js): every recorded step is saved for its source,
// and the source's first entry after a reload resumes it. "Start fresh" clears it. The readings
// panel folds while the visitor is making (studio-readings.js); the shell reports making actions.
//
// This file is the pure half (history, key chords, the source guide) and runs in Node
// (studio-shell.test.mjs). studio-shell-dom.js is the DOM half; it only proxies clicks to the
// controls each source already had, so every existing control id and handler keeps working and the
// shell changes no drawing.

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
  worlds:    { name: "Worlds", purpose: "Walk around the One Step worlds as small rendered places. Hold the wheel button and drag to turn." },
  threads:   { name: "Threads", purpose: "Particles trace one of fifteen drawn fields and leave light, rendered on your GPU." },
  sketch:    { name: "Sketch", purpose: "Draw by hand. Your strokes stay in this browser and export as a plotter sheet." },
  byo:       { name: "Bring your own", purpose: "Drop in an image, a video, a 3D model or a sound, then transform and measure it." },
  watch:     { name: "Watch with me", purpose: "Share a screen or a camera and read it frame by frame in this browser." },
  music:     { name: "Music", purpose: "Visuals that follow the built-in synth, your microphone or a track you load." },
  discovery: { name: "Physics", purpose: "Let the discovery engine find a conserved quantity in a simulated system." },
  showcase:  { name: "Showcase", purpose: "Integrate a system, fit its conserved quantity, and re-check the receipt in this browser." },
  retro:     { name: "Retro Engine", purpose: "A shader through pixelate, palette, dither and a CRT tube." },
  gallery:   { name: "Gallery", purpose: "The print desk: a seed and up to three of 95 instruments draw a plate. The same seed draws the same plate." },
  loom:      { name: "Loom", purpose: "Weave a picture into cloth: structure, sett, colours and the shuttle, then export a WIF draft." },
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
    clear: (source) => { books.delete(source); },
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

