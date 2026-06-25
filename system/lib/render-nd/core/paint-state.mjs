// paint-state.mjs - the pure painting/display state model for the nD geometry.
//
// Holds per-element colour overrides (face / vertex / edge), display toggles (show faces / edges /
// vertices, wireframe vs solid), and the current palette colour. No DOM, no rendering: the renderer
// reads this state and the studio wiring mutates it. Pure + node-testable. ASCII only.
//
// Colours are stored as [r, g, b] byte triples (0..255). The palette source (OKLab/OKLCH) lives in
// sense-core/colour-perceptual.mjs; this model only stores the resolved RGB so it stays renderer-
// and colour-space-agnostic.

export function createPaintState(overrides = {}) {
  return {
    // element-keyed colour maps: index -> [r,g,b]
    faceColors: new Map(),
    vertexColors: new Map(),
    edgeColors: new Map(),
    // display toggles
    showFaces: overrides.showFaces != null ? !!overrides.showFaces : true,
    showEdges: overrides.showEdges != null ? !!overrides.showEdges : true,
    showVertices: overrides.showVertices != null ? !!overrides.showVertices : true,
    wireframe: overrides.wireframe != null ? !!overrides.wireframe : false,
    // the current "brush" colour (what a click paints)
    brush: overrides.brush ? clampRgb(overrides.brush) : [240, 176, 64], // amber default
    // which element type a click targets: "face" | "vertex" | "edge"
    paintTarget: overrides.paintTarget || "face",
  };
}

function clampRgb(c) {
  const b = (v) => Math.max(0, Math.min(255, Math.round(v || 0)));
  return [b(c[0]), b(c[1]), b(c[2])];
}

// Set the brush colour.
export function setBrush(state, rgb) { state.brush = clampRgb(rgb); return state; }

// Set which element type the brush paints.
export function setPaintTarget(state, target) {
  if (target === "face" || target === "vertex" || target === "edge") state.paintTarget = target;
  return state;
}

// Paint a specific element index with the current brush (or an explicit colour).
export function paintElement(state, kind, index, rgb) {
  if (index == null || index < 0) return state;
  const color = clampRgb(rgb || state.brush);
  const map = kind === "vertex" ? state.vertexColors
    : kind === "edge" ? state.edgeColors
      : kind === "face" ? state.faceColors
        : null;
  if (map) map.set(index, color);
  return state;
}

// Paint whatever the current target is, at index.
export function paintAtTarget(state, index, rgb) {
  return paintElement(state, state.paintTarget, index, rgb);
}

// Look up an override; returns null when none (renderer falls back to the depth-cue colour).
export function faceColor(state, i) { return state.faceColors.get(i) || null; }
export function vertexColor(state, i) { return state.vertexColors.get(i) || null; }
export function edgeColor(state, i) { return state.edgeColors.get(i) || null; }

// Toggle a display flag by name; returns the new boolean.
export function toggle(state, flag) {
  if (!(flag in state) || typeof state[flag] !== "boolean") return null;
  state[flag] = !state[flag];
  return state[flag];
}

// Clear all painted overrides (keeps toggles + brush).
export function clearPaint(state) {
  state.faceColors.clear();
  state.vertexColors.clear();
  state.edgeColors.clear();
  return state;
}

// A compact serialisable snapshot (for tests / persistence / debugging). Maps -> arrays of [i,rgb].
export function snapshot(state) {
  const dump = (m) => [...m.entries()].sort((a, b) => a[0] - b[0]);
  return {
    faces: dump(state.faceColors),
    vertices: dump(state.vertexColors),
    edges: dump(state.edgeColors),
    showFaces: state.showFaces,
    showEdges: state.showEdges,
    showVertices: state.showVertices,
    wireframe: state.wireframe,
    brush: state.brush.slice(),
    paintTarget: state.paintTarget,
  };
}
