// DOM-less smoke for the one-shot specimen renderer in generative-field.js.
// A Proxy-based fake 2d context records every method call and property set,
// so we can assert the render is deterministic per seed without a browser.
// Visual correctness still needs a real browser pass; this guards the
// contract: no throw, seed-stable output, seed-sensitive output, idempotent
// mounting, graceful handling of bad inputs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderSpecimen, mountSpecimens, specimenLayerNames } from "./generative-field.js";

function round(value) {
  return typeof value === "number" ? Number(value.toFixed(6)) : String(value);
}

function makeCtx(log) {
  const gradient = {
    addColorStop(offset, color) { log.push(["addColorStop", round(offset), color]); },
  };
  const target = {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop === "createRadialGradient" || prop === "createLinearGradient") {
        return (...args) => { log.push([prop, ...args.map(round)]); return gradient; };
      }
      if (prop in t) return t[prop];
      if (typeof prop === "symbol") return undefined;
      return (...args) => { log.push([prop, ...args.map(round)]); };
    },
    set(t, prop, value) {
      t[prop] = value;
      log.push([`set:${String(prop)}`, round(value)]);
      return true;
    },
  });
}

function makeCanvas(width = 640, height = 150) {
  const log = [];
  const ctx = makeCtx(log);
  const canvas = {
    width: 0,
    height: 0,
    dataset: {},
    style: {},
    clientWidth: width,
    clientHeight: height,
    getBoundingClientRect: () => ({ width, height }),
    getContext: () => ctx,
  };
  return { canvas, log };
}

function renderLog(seed, layers, width = 640, height = 150) {
  const { canvas, log } = makeCanvas(width, height);
  const ok = renderSpecimen(canvas, seed, layers);
  assert.equal(ok, true, `renderSpecimen should succeed for seed "${seed}"`);
  return { log, canvas };
}

test("renderSpecimen is deterministic for a given seed and layer list", () => {
  const a = renderLog("overview", ["orbit", "contour"]).log;
  const b = renderLog("overview", ["orbit", "contour"]).log;
  assert.ok(a.length > 50, `expected a substantial draw log, got ${a.length} ops`);
  assert.deepEqual(a, b);
});

test("renderSpecimen output changes with the seed", () => {
  const a = renderLog("research", ["contour", "crystal"]).log;
  const b = renderLog("writing", ["contour", "crystal"]).log;
  assert.notDeepEqual(a, b);
});

test("every page layer set renders without throwing", () => {
  const sets = [
    ["overview", ["orbit", "contour"]],
    ["research", ["contour", "crystal"]],
    ["writing", ["lamp", "dither"]],
    ["publications", ["crystal", "dither"]],
    ["guide", ["hydra", "contour"]],
  ];
  for (const [seed, layers] of sets) {
    const { log } = renderLog(seed, layers);
    assert.ok(log.length > 0, `${seed} produced an empty draw log`);
  }
});

test("unknown layer names are skipped, not fatal", () => {
  const { log } = renderLog("guide", ["no-such-layer", "contour"]);
  assert.ok(log.length > 0);
});

test("renderSpecimen sizes the backing store from the element box, dpr-capped", () => {
  const { canvas } = renderLog("overview", ["orbit"], 800, 120);
  // Node has no window, so dpr resolves to 1: backing store equals CSS box.
  assert.equal(canvas.width, 800);
  assert.equal(canvas.height, 120);
});

test("renderSpecimen rejects a non-canvas input", () => {
  assert.equal(renderSpecimen(null, "x"), false);
  assert.equal(renderSpecimen({}, "x"), false);
});

test("mountSpecimens renders each data-specimen canvas once", () => {
  const { canvas } = makeCanvas();
  canvas.dataset.specimen = "research";
  canvas.dataset.specimenLayers = "contour,crystal";
  const doc = { querySelectorAll: () => [canvas] };
  assert.equal(mountSpecimens(doc), 1);
  assert.equal(canvas.dataset.specimenRendered, "true");
  // Second pass is a no-op: already rendered.
  assert.equal(mountSpecimens(doc), 0);
});

test("mountSpecimens tolerates a missing document", () => {
  assert.equal(mountSpecimens(null), 0);
});

/* ---------------------------------------------------------------------------
   Fixture layers (2026-07-09): crystal-lens, scanline, facets, groove,
   ca-quadrant. Same contract as the older library: deterministic per seed,
   seed-sensitive, and visibly non-blank (the draw log must grow well past
   what the backdrop alone produces).
--------------------------------------------------------------------------- */
const FIXTURE_LAYERS = ["crystal-lens", "scanline", "facets", "groove", "ca-quadrant"];

test("all five fixture layers are registered under their gallery names", () => {
  const names = specimenLayerNames();
  for (const layer of FIXTURE_LAYERS) {
    assert.ok(names.includes(layer), `SPECIMEN_LAYERS is missing "${layer}"`);
  }
});

test("each fixture layer renders deterministically for a fixed seed", () => {
  for (const layer of FIXTURE_LAYERS) {
    const a = renderLog(`fixture-${layer}`, [layer]).log;
    const b = renderLog(`fixture-${layer}`, [layer]).log;
    assert.ok(a.length > 0, `${layer} produced an empty draw log`);
    assert.deepEqual(a, b, `${layer} is not deterministic for a fixed seed`);
  }
});

test("each fixture layer draws substantially more than the backdrop alone", () => {
  // ["no-such-layer"] is a non-empty list whose lookup fails, so the render
  // is backdrop-only: the honest baseline for a non-blank assertion.
  const baseline = renderLog("fixture-baseline", ["no-such-layer"]).log.length;
  for (const layer of FIXTURE_LAYERS) {
    const drawn = renderLog("fixture-baseline", [layer]).log.length;
    assert.ok(
      drawn > baseline + 40,
      `${layer} added only ${drawn - baseline} ops over the bare backdrop`,
    );
  }
});

test("each fixture layer output changes with the seed", () => {
  for (const layer of FIXTURE_LAYERS) {
    const a = renderLog("gallery-seed-a", [layer]).log;
    const b = renderLog("gallery-seed-b", [layer]).log;
    assert.notDeepEqual(a, b, `${layer} ignored the seed`);
  }
});

test("gallery.html requests at least 10 tiles and only registered layer names", () => {
  const html = readFileSync(new URL("../gallery.html", import.meta.url), "utf8");
  const registered = new Set(specimenLayerNames());
  const tiles = [...html.matchAll(/data-specimen-layers="([^"]+)"/g)];
  assert.ok(tiles.length >= 10, `expected at least 10 fixture tiles, found ${tiles.length}`);
  const requested = new Set();
  for (const [, list] of tiles) {
    for (const name of list.split(",").map((part) => part.trim()).filter(Boolean)) {
      assert.ok(registered.has(name), `gallery.html requests unregistered layer "${name}"`);
      requested.add(name);
    }
  }
  for (const layer of FIXTURE_LAYERS) {
    assert.ok(requested.has(layer), `gallery.html never exhibits the "${layer}" layer`);
  }
});

/* ── wave 2: plate-grade layers, live mode, the databend finisher ────────── */
import { applyDatabend } from "./generative-field.js";

const WAVE2_LAYERS = [
  "caustic-veils", "caustic-paper", "planet-limb", "aurora-leak",
  "obsidian-burst", "dendrite", "riso-moire", "moire-swirl",
  "plotter-plate", "acid-duotone", "databend",
  "showpiece-veil", "showpiece-burst", "showpiece-weave",
];

test("wave-2 layers are all registered", () => {
  const names = specimenLayerNames();
  for (const layer of WAVE2_LAYERS) {
    assert.ok(names.includes(layer), `missing layer: ${layer}`);
  }
});

test("each wave-2 layer renders without throwing and adds ops over the backdrop", () => {
  // An unknown layer name is skipped, so this render is backdrop-only.
  const baseline = renderLog("wave2-base", ["__backdrop-only__"]).log.length;
  for (const layer of WAVE2_LAYERS) {
    const { log } = renderLog(`wave2-${layer}`, [layer]);
    assert.ok(log.length > baseline + 20, `${layer} drew only ${log.length - baseline} ops over backdrop`);
  }
});

test("seeded wave-2 renders stay deterministic", () => {
  for (const layer of ["caustic-veils", "obsidian-burst", "showpiece-weave", "databend"]) {
    const a = renderLog(`det-${layer}`, [layer]).log;
    const b = renderLog(`det-${layer}`, [layer]).log;
    assert.deepEqual(a, b, `${layer} not deterministic for a fixed seed`);
  }
});

test("seed 'live' produces a different frame on each call", () => {
  const a = renderLog("live", ["obsidian-burst"]).log;
  const b = renderLog("live", ["obsidian-burst"]).log;
  assert.notDeepEqual(a, b, "live mode should be a one-off every render");
});

test("applyDatabend draws over an existing frame and respects null seed randomness", () => {
  const { canvas, log } = makeCanvas(640, 300);
  const ctx = canvas.getContext();
  const before = log.length;
  assert.equal(applyDatabend(ctx, 640, 300, "bend-seed", 0.5), true);
  assert.ok(log.length > before + 10, "seeded databend should draw");
  const mid = log.length;
  assert.equal(applyDatabend(ctx, 640, 300, null, 0.5), true);
  assert.ok(log.length > mid + 10, "random databend should draw");
});

/* ── wave 3: the deep corpus ─────────────────────────────────────────────── */
const WAVE3_LAYERS = [
  "stellated-lantern", "fiber-strands", "pixel-sort-ruin", "ifs-veil",
  "dla-coral", "weave-lattice", "fiber-terrain",
  "showpiece-lantern", "showpiece-ruin",
];

test("wave-3 layers are registered and draw over the backdrop", () => {
  const names = specimenLayerNames();
  const baseline = renderLog("wave3-base", ["__backdrop-only__"]).log.length;
  for (const layer of WAVE3_LAYERS) {
    assert.ok(names.includes(layer), `missing layer: ${layer}`);
    const { log } = renderLog(`wave3-${layer}`, [layer]);
    assert.ok(log.length > baseline + 20, `${layer} drew only ${log.length - baseline} ops over backdrop`);
  }
});

test("seeded wave-3 renders stay deterministic", () => {
  for (const layer of ["stellated-lantern", "dla-coral", "showpiece-ruin"]) {
    const a = renderLog(`det3-${layer}`, [layer]).log;
    const b = renderLog(`det3-${layer}`, [layer]).log;
    assert.deepEqual(a, b, `${layer} not deterministic for a fixed seed`);
  }
});

/* ── editor primitives (2026-07-10): renderSpecimenOver + drawImageFit ─────── */
import { renderSpecimenOver, drawImageFit } from "./generative-field.js";

test("renderSpecimenOver composites without clearing or a backdrop wash", () => {
  const { canvas, log } = makeCanvas(640, 400);
  canvas.width = 640; canvas.height = 400;   // an existing backing (imported image)
  const ok = renderSpecimenOver(canvas, "edit", ["orbit", "contour"], { alpha: 0.5 });
  assert.equal(ok, true);
  const ops = log.map((e) => e[0]);
  assert.ok(!ops.includes("clearRect"), "must not clear the imported content");
  assert.ok(log.some((e) => e[0] === "set:globalAlpha"), "alpha must be applied");
  assert.ok(log.length > 20, "layers should draw");
});

test("renderSpecimenOver is deterministic per seed and skips unknown layers", () => {
  const a = (() => { const { canvas, log } = makeCanvas(320, 200); canvas.width = 320; canvas.height = 200; renderSpecimenOver(canvas, "s", ["orbit", "__nope__"], {}); return log; })();
  const b = (() => { const { canvas, log } = makeCanvas(320, 200); canvas.width = 320; canvas.height = 200; renderSpecimenOver(canvas, "s", ["orbit", "__nope__"], {}); return log; })();
  assert.deepEqual(a, b);
});

test("drawImageFit sizes from natural dimensions and draws cover-fit", () => {
  const { canvas, log } = makeCanvas(0, 0);
  const img = { naturalWidth: 800, naturalHeight: 600 };
  const out = drawImageFit(canvas, img, { maxBacking: 400 });
  assert.equal(out.width, 400);
  assert.equal(out.height, 300);
  assert.ok(log.some((e) => e[0] === "drawImage"), "must draw the image");
});

test("drawImageFit honors an explicit width, deriving height from aspect", () => {
  const { canvas } = makeCanvas(0, 0);
  const out = drawImageFit(canvas, { naturalWidth: 1000, naturalHeight: 500 }, { width: 600 });
  assert.equal(out.width, 600);
  assert.equal(out.height, 300);
});

/* ── neural instruments (2026-07-10): CPPN field + neural SDF surface ──────── */
test("neural layers are registered and render deterministically per seed", () => {
  const names = specimenLayerNames();
  assert.ok(names.includes("neural-field"), "neural-field must be registered");
  assert.ok(names.includes("neural-sdf"), "neural-sdf must be registered");
  assert.ok(names.includes("neural-voxel"), "neural-voxel must be registered");
  for (const layer of ["neural-field", "neural-sdf", "neural-voxel"]) {
    const a = renderLog(`neu-${layer}`, [layer], 240, 160).log;
    const b = renderLog(`neu-${layer}`, [layer], 240, 160).log;
    assert.ok(a.length > 30, `${layer} should draw (got ${a.length} ops)`);
    assert.deepEqual(a, b, `${layer} must be deterministic for a seed`);
    const c = renderLog(`neu-${layer}-other`, [layer], 240, 160).log;
    assert.notDeepEqual(a, c, `${layer} must vary with the seed`);
  }
});
