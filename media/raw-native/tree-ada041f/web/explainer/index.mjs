// The explainer kit: Motion primitives for films about how models work, bound to real numbers.
// See web/explainer/README.md. Every module but layers.mjs and parity.mjs is pure and runs in Node.
export { createLayers, INK_RAMP } from "./layers.mjs";
export { ORB, NIGHT, PAPER, AURORA, orbFloats, atmosFloats } from "./pack.mjs";
export { orbAt, atmosphereAt, apertureEdge, bezier, arc, pulseAt, lodKeep, lodFraction, hashUnit, rampAt } from "./ref.mjs";
export { loadBundle, parseNpy, half, extent, quantile, argmax, topk, show } from "./data.mjs";
export { tensorGrid, tokenRow, ellipseLattice } from "./layout.mjs";
export { GROUNDS, FONTS, loadType, typeKit, typeOn } from "./style.mjs";
export { dataCard, bar, matrix, imageGrid, columns } from "./cards.mjs";
export { shots, iris, focusPull, beat, phase } from "./shots.mjs";
