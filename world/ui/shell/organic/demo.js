// demo.js: an element shown working in the FLOW medium. demoFor(element) returns a recipe: drops to seed, plus
// an optional view or viscosity. The recipe is chosen by the element's name, then by its sheet. Each recipe is
// a small set of additives, so the same medium shows a material, a property, a process, a form or a law.
const R = (...drops) => ({ drops });
const pour = (x, y, r = 0.16, amount = 1.6, kind = "ink") => ({ kind, x, y, r, amount, always: true });
const flow = (x, y, vx, vy, r = 0.3) => ({ kind: "current", x, y, vx, vy, r, always: true });
const ring = (x, y, r = 0.2, amount = 14) => ({ kind: "ripple", x, y, r, amount, always: true });
const heat = (x, y, r = 0.25, amount = 1.2) => ({ kind: "warmth", x, y, r, amount, always: true });
const silt = (x, y, r = 0.3, amount = 0.6) => ({ kind: "sediment", x, y, r, aspect: 0.08, amount, always: true });

const BY_NAME = {
  water: R(pour(0.4, 0.5), ring(0.4, 0.5)), air: R(flow(0.3, 0.5, 40, -6, 0.5), pour(0.3, 0.5, 0.08)),
  ink: R(pour(0.5, 0.45, 0.1, 2.2)), pigment: R(pour(0.4, 0.5, 0.14, 1.8), pour(0.6, 0.55, 0.12, 1.6, "wash")),
  "fire-heat": R(heat(0.5, 0.8, 0.3, 2), pour(0.5, 0.75, 0.08)), "cloud-mist": R(pour(0.5, 0.5, 0.28, 0.5), flow(0.5, 0.5, 8, 0, 0.6)),
  "stone-sand": R(silt(0.5, 0.7, 0.4, 0.9), silt(0.5, 0.8, 0.35, 0.7)), viscosity: { ...R(pour(0.5, 0.5), flow(0.5, 0.5, 40, 0)), viscosity: 4 },
  turbulence: R(pour(0.5, 0.5), flow(0.35, 0.4, 40, 30, 0.2), flow(0.65, 0.6, -40, -30, 0.2)), "buoyancy-temperature": R(pour(0.5, 0.75, 0.12), heat(0.5, 0.75, 0.2, 2)),
  "surface-tension": R(pour(0.5, 0.5, 0.12), ring(0.5, 0.5, 0.25, 24)), opacity: R(pour(0.35, 0.5, 0.12, 0.6), pour(0.65, 0.5, 0.12, 2.4)),
  absorbency: R(pour(0.5, 0.5, 0.2, 1.2)), stratification: R(silt(0.5, 0.35), silt(0.5, 0.55), silt(0.5, 0.75)),
  diffusion: R(pour(0.5, 0.5, 0.05, 3)), advection: R(pour(0.3, 0.5, 0.1), flow(0.3, 0.5, 50, 0, 0.4)),
  layering: R(pour(0.42, 0.48, 0.16), pour(0.58, 0.55, 0.14, 1.6, "wash")), overprint: R(pour(0.42, 0.5, 0.15), pour(0.58, 0.5, 0.15, 1.8, "wash")),
  "law-overprint-absorption": R(pour(0.42, 0.5, 0.15), pour(0.58, 0.5, 0.15, 1.8, "wash")),
  erosion: R(silt(0.5, 0.6, 0.4, 0.9), flow(0.2, 0.6, 50, 0, 0.3)), sedimentation: R(pour(0.5, 0.4), silt(0.5, 0.8, 0.4, 0.8)),
  bleed: R(pour(0.5, 0.5, 0.12, 2.4)), "law-coffee-ring": R(pour(0.5, 0.5, 0.2, 1.4)), "tide-line": R(pour(0.5, 0.5, 0.2, 1.4)),
  "law-diffusion": R(pour(0.5, 0.5, 0.05, 3)), "law-snell": R(pour(0.5, 0.5, 0.22, 1.8)), "law-beer-absorption": R(pour(0.3, 0.5, 0.1, 0.6), pour(0.5, 0.5, 0.1, 1.4), pour(0.7, 0.5, 0.1, 2.6)),
  "swarm-flock": R(...[0.2, 0.4, 0.6, 0.8].map((x) => pour(x, 0.5, 0.04, 1.4)), flow(0.5, 0.5, 30, 10, 0.6)),
  "loop-cycle": R(pour(0.5, 0.3, 0.06), flow(0.7, 0.5, 0, 40, 0.15), flow(0.5, 0.7, -40, 0, 0.15), flow(0.3, 0.5, 0, -40, 0.15), flow(0.5, 0.3, 40, 0, 0.15)),
  ribbon: R(pour(0.15, 0.5, 0.06, 2), flow(0.15, 0.5, 60, 4, 0.2)), "path-stroke": R(pour(0.15, 0.6, 0.05, 2), flow(0.15, 0.6, 60, -20, 0.15)),
  "ring-orbit": R(ring(0.5, 0.5, 0.3, 30), pour(0.5, 0.5, 0.05)), spiral: R(pour(0.5, 0.5, 0.08), flow(0.6, 0.5, 0, 40, 0.15), flow(0.4, 0.5, 0, -40, 0.15)),
  "wave-form": R(ring(0.3, 0.5, 0.2, 20), ring(0.7, 0.5, 0.2, 20), pour(0.5, 0.5, 0.06)),
};
const VIEW = { mosaic: "mosaic", "glyph-cell": "mosaic", tessellation: "mosaic", grid: "mosaic", field: "mosaic", "halftone-dither": "mosaic",
  "quantize-pixelate": "mosaic", "rule-andamento-follows-form": "mosaic", "noise-as-signal": "mosaic", "decomposition-measure": "mosaic",
  "witness-transparency": "layers", "depth-planes": "layers", "plane-sheet": "layers", "rule-depth-planes-have-jobs": "layers" };
const BY_SHEET = {
  material: R(pour(0.5, 0.5)), property: R(pour(0.4, 0.5, 0.12), ring(0.6, 0.5, 0.2)), process: R(pour(0.35, 0.5, 0.1), flow(0.35, 0.5, 30, 0, 0.35)),
  form: R(pour(0.5, 0.5, 0.12), flow(0.5, 0.5, 20, 10, 0.4)), composition: R(pour(0.3, 0.62, 0.1), pour(0.7, 0.38, 0.06, 1.2, "wash")),
  rules: R(pour(0.5, 0.5, 0.14), silt(0.5, 0.82, 0.3, 0.5)), meaning: R(pour(0.45, 0.5, 0.12), pour(0.6, 0.55, 0.1, 1.4, "wash"), silt(0.5, 0.85, 0.3, 0.4)),
};

export function demoFor(el) {
  const base = BY_NAME[el.id] || BY_SHEET[el.sheet] || BY_SHEET.material;
  return { ...base, view: VIEW[el.id] || null };
}
