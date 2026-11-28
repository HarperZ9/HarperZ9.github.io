import test from "node:test";
import assert from "node:assert/strict";
import { StudioExporters } from "./exporters.js";
import {
  UNIFIED_FORMATS,
  registerUnifiedExporters,
  encodeClothWIF,
  encodePcmWav,
  synthPreviewTone,
  buildBuildLangScore,
  extractPaletteFromPixels,
} from "./exporters-unified.js";

function makeTestPixels(w = 16, h = 12) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = (x * 16) & 255;
      data[i + 1] = (y * 20) & 255;
      data[i + 2] = ((x + y) * 10) & 255;
      data[i + 3] = 255;
    }
  }
  return { data, w, h };
}

test("registerUnifiedExporters wires all discipline formats onto StudioExporters with SHA-256 receipts", async () => {
  registerUnifiedExporters();
  assert.ok(UNIFIED_FORMATS.length >= 13);
  const pixels = makeTestPixels();

  for (const fmt of ["plot-svg", "plot-gcode", "relief-stl", "palette-gpl", "cloth-wif", "audio-wav", "buildlang-bld"]) {
    const { blobOrString, receipt } = await StudioExporters.exportWithReceipt(fmt, null, {
      pixels,
      source: "sand",
      seed: "kiruna-42",
    });
    assert.ok(blobOrString, `${fmt} produced output`);
    assert.match(receipt.commitHash, /^[0-9a-f]{64}$/, `${fmt} sealed with 64-hex SHA-256`);
  }
});

test("encodeClothWIF produces valid WIF 1.1 draft", () => {
  const wif = encodeClothWIF(makeTestPixels(), "estuary-cloth", 8);
  assert.ok(wif.includes("[WIF]\nVersion=1.1"));
  assert.ok(wif.includes("[THREADING]"));
  assert.ok(wif.includes("[TREADLING]"));
});

test("encodePcmWav produces valid RIFF WAVE bytes", () => {
  const samples = synthPreviewTone("estuary", 0.1, 8000);
  const wav = encodePcmWav(samples, 8000);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
  assert.equal(wav.byteLength, 44 + samples.length * 2);
});

test("buildBuildLangScore emits valid BuildLang source with palette and dimensions", () => {
  const src = buildBuildLangScore({ source: "sand", seed: "glass-07", width: 960, height: 540 });
  assert.ok(src.includes("struct StudioScene"));
  assert.ok(src.includes("fn main() -> i32"));
  assert.ok(src.includes("width: 960"));
});

test("extractPaletteFromPixels returns normalized swatches", () => {
  const pal = extractPaletteFromPixels(makeTestPixels(), 6);
  assert.ok(pal.length >= 1 && pal.length <= 6);
  assert.match(pal[0].hex, /^#[0-9a-f]{6}$/);
});
