// Pure contracts for the modular export writers. Canvas-dependent kinds
// (raster/pdf/stitch-render/heightmap-sample) need the browser pass; the
// deterministic string/legend writers are fully testable here.
import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPORT_KINDS, toGplPalette, toCssPalette, toJsonPalette,
  stitchLegend, heightGridToObj, toTextArt,
} from "./exporters-disciplines.js";

const PERCEPTION = {
  longDescription: "a square, dark frame dominated by teal.",
  detail: {
    ascii: " .:-=+*#\n#*+=-:. ",
    braille: "⠁⠃⠇⠏",
    colorGrid16: Array.from({ length: 16 }, (_, y) =>
      Array.from({ length: 16 }, (_, x) => (x + y) % 2 ? "#20a090" : "#0a0a12")),
  },
  rich: {
    dominantSwatches: [
      { hex: "#0a0a12", r: 10, g: 10, b: 18, frac: 0.56 },
      { hex: "#20a090", r: 32, g: 160, b: 144, frac: 0.22 },
      { hex: "#e2942a", r: 226, g: 148, b: 42, frac: 0.08 },
    ],
  },
};

test("EXPORT_KINDS is well-formed: unique kinds, valid needs, every field present", () => {
  const seen = new Set();
  const validNeeds = new Set(["canvas", "perception", "both"]);
  for (const k of EXPORT_KINDS) {
    assert.ok(k.kind && !seen.has(k.kind), "duplicate or empty kind: " + k.kind);
    seen.add(k.kind);
    assert.ok(k.label && k.ext && k.mime && k.discipline, "missing field on " + k.kind);
    assert.ok(validNeeds.has(k.needs), "bad needs on " + k.kind + ": " + k.needs);
  }
  assert.ok(seen.size >= 14, "expected the full discipline spread");
  // disciplines actually span more than raster
  const disciplines = new Set(EXPORT_KINDS.map((k) => k.discipline));
  for (const d of ["print", "design", "textile", "text", "relief / cnc"]) {
    assert.ok(disciplines.has(d), "missing discipline: " + d);
  }
});

test("GPL palette is valid GIMP format with the swatch fractions", () => {
  const gpl = toGplPalette(PERCEPTION, "Test");
  assert.ok(gpl.startsWith("GIMP Palette"));
  assert.ok(gpl.includes("Name: Test"));
  assert.ok(gpl.includes("#0a0a12"));
  assert.ok(/ 10  10  18\t#0a0a12/.test(gpl), "rgb columns + hex");
  assert.ok(gpl.includes("56.0%"));
});

test("CSS palette emits numbered custom properties with fraction comments", () => {
  const css = toCssPalette(PERCEPTION, "plate");
  assert.ok(css.includes(":root {"));
  assert.ok(css.includes("--plate-1: #0a0a12;"));
  assert.ok(css.includes("--plate-3: #e2942a;"));
  assert.ok(css.includes("% of the frame"));
});

test("JSON palette parses and carries swatches + the colour grid", () => {
  const obj = JSON.parse(toJsonPalette(PERCEPTION));
  assert.equal(obj.swatches.length, 3);
  assert.deepEqual(obj.swatches[0].rgb, [10, 10, 18]);
  assert.ok(Array.isArray(obj.colorGrid16));
  assert.equal(obj.colorGrid16.length, 16);
});

test("stitchLegend reduces to <= 12 symbols and assigns every cell once", () => {
  // a busy 24x24 grid of many near-colours must still collapse to <= 12
  const grid = Array.from({ length: 24 }, (_, y) =>
    Array.from({ length: 24 }, (_, x) => {
      const v = ((x * 7 + y * 13) % 40);
      return "#" + [20 + v, 100 + v, 90 + v].map((n) => Math.min(255, n).toString(16).padStart(2, "0")).join("");
    }));
  const { legend, rows } = stitchLegend(grid, 12, 40);
  assert.ok(legend.length <= 12, "legend over cap: " + legend.length);
  assert.equal(rows.length, 24);
  assert.ok(rows.every((r) => r.length === 24 && r.every((i) => i >= 0 && i < legend.length)));
  // deterministic
  const again = stitchLegend(grid, 12, 40);
  assert.deepEqual(again.legend.map((l) => l.hex), legend.map((l) => l.hex));
});

test("heightGridToObj emits correct vertex count and valid face indices", () => {
  const grid = [[0, 0.5, 1], [0.2, 0.7, 0.3]]; // 3x2
  const obj = heightGridToObj(grid, 10);
  const vs = obj.split("\n").filter((l) => l.startsWith("v "));
  const fs = obj.split("\n").filter((l) => l.startsWith("f "));
  assert.equal(vs.length, 6, "3x2 grid = 6 vertices");
  assert.equal(fs.length, 4, "2x1 quads x 2 tris = 4 faces");
  for (const f of fs) {
    const idx = f.slice(2).trim().split(/\s+/).map(Number);
    assert.ok(idx.every((i) => i >= 1 && i <= 6), "face index out of range: " + f);
  }
});

test("text-art carries the ascii, braille, description, and palette", () => {
  const txt = toTextArt(PERCEPTION);
  assert.ok(txt.includes("dominated by teal"));
  assert.ok(txt.includes("ASCII luminance:"));
  assert.ok(txt.includes("Braille luminance"));
  assert.ok(txt.includes("⠁"));
  assert.ok(txt.includes("#0a0a12  56.0%"));
});
