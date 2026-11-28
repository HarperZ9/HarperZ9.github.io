// system/exporters-unified.js
// Unified multimedia export pipeline: registers every discipline format onto StudioExporters
// so every source in The Studio exports through one SHA-256 receipted pipeline.
import { StudioExporters, download } from "./exporters.js";
import { hatchFromLuma, orderPaths, toPlotterSVG, toGcode, PLOT_DETAIL } from "./plotter.js";
import { heightmapToSTL } from "./relief-stl.js";
import { toGplPalette } from "./exporters-disciplines.js";

export const UNIFIED_FORMATS = Object.freeze([
  { id: "png",          label: "Image (.png)",            ext: "png",        category: "Visual" },
  { id: "svg",          label: "Vector (.svg)",           ext: "svg",        category: "Visual" },
  { id: "webm",         label: "Video clip (.webm)",      ext: "webm",       category: "Visual" },
  { id: "plot-svg",     label: "Plotter SVG (.plot.svg)", ext: "plot.svg",   category: "Fabrication" },
  { id: "plot-gcode",   label: "Plotter G-code (.gcode)", ext: "gcode",      category: "Fabrication" },
  { id: "relief-stl",   label: "3D Relief (.stl)",        ext: "stl",        category: "Fabrication" },
  { id: "cloth-wif",    label: "Loom Draft (.wif)",       ext: "wif",        category: "Fabrication" },
  { id: "obj",          label: "3D Mesh (.obj)",          ext: "obj",        category: "3D" },
  { id: "gltf",         label: "glTF 2.0 (.gltf)",        ext: "gltf",       category: "3D" },
  { id: "palette-gpl",  label: "Palette (.gpl)",          ext: "gpl",        category: "Color" },
  { id: "audio-wav",    label: "Audio (.wav)",            ext: "wav",        category: "Audio" },
  { id: "buildlang-bld",label: "BuildLang Score (.bld)",  ext: "bld",        category: "Source" },
  { id: "json",         label: "State + Receipt (.json)", ext: "json",       category: "Source" },
]);

function readCanvasPixels(canvas, extra = {}) {
  if (extra.pixels && extra.pixels.data && extra.pixels.w >= 2 && extra.pixels.h >= 2) {
    return extra.pixels;
  }
  if (!canvas || typeof canvas.getContext !== "function") {
    throw new Error("exporters-unified: canvas or extra.pixels is required");
  }
  const w = canvas.width || 320;
  const h = canvas.height || 180;
  const ctx2d = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx2d) {
    const img = ctx2d.getImageData(0, 0, w, h);
    return { data: img.data, w, h };
  }
  // WebGL / WebGPU fallback: copy through a temporary 2D canvas
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d", { willReadFrequently: true });
  tctx.drawImage(canvas, 0, 0, w, h);
  const img = tctx.getImageData(0, 0, w, h);
  return { data: img.data, w, h };
}

function lumaGridFromPixels({ data, w, h }, gw, gh) {
  const out = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const x0 = Math.floor((i * w) / gw);
      const x1 = Math.max(x0 + 1, Math.floor(((i + 1) * w) / gw));
      const y0 = Math.floor((j * h) / gh);
      const y1 = Math.max(y0 + 1, Math.floor(((j + 1) * h) / gh));
      let s = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * w + x) * 4;
          s += (0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]) / 255;
        }
      }
      out[j * gw + i] = s / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

export function extractPaletteFromPixels({ data, w, h }, count = 8) {
  const buckets = new Map();
  const step = Math.max(1, Math.floor((w * h) / 4096));
  for (let i = 0; i < w * h; i += step) {
    const o = i * 4;
    const r = data[o] & 0xf0;
    const g = data[o + 1] & 0xf0;
    const b = data[o + 2] & 0xf0;
    const key = (r << 16) | (g << 8) | b;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, count);
  const total = sorted.reduce((s, [, c]) => s + c, 0) || 1;
  return sorted.map(([key, c], idx) => {
    const hex = "#" + key.toString(16).padStart(6, "0");
    return { name: `swatch-${idx + 1}`, hex, frac: c / total };
  });
}

export function encodeClothWIF(pixels, name = "studio-weave", shafts = 8) {
  const cols = 48;
  const rows = 48;
  const grid = lumaGridFromPixels(pixels, cols, rows);
  const lines = [
    "[WIF]",
    "Version=1.1",
    "Date=2026-11-27",
    "Developers=The Playground Studio (harperz9.github.io)",
    "Source Program=Unified Multimedia Super-Tool",
    "[CONTENTS]",
    "TEXT=true",
    "WEAVING=true",
    "WARP=true",
    "WEFT=true",
    "THREADING=true",
    "TREADLING=true",
    "TIEUP=true",
    "[TEXT]",
    `Title=${name}`,
    "[WEAVING]",
    `Shafts=${shafts}`,
    `Treadles=${shafts}`,
    "Rising Shed=true",
    "[WARP]",
    `Threads=${cols}`,
    "[WEFT]",
    `Threads=${rows}`,
    "[TIEUP]",
  ];
  for (let t = 1; t <= shafts; t++) {
    const s2 = (t % shafts) + 1;
    lines.push(`${t}=${t},${s2}`);
  }
  lines.push("[THREADING]");
  for (let x = 0; x < cols; x++) {
    let mean = 0;
    for (let y = 0; y < rows; y++) mean += grid[y * cols + x];
    const shaft = Math.min(shafts, Math.max(1, Math.floor((mean / rows) * shafts) + 1));
    lines.push(`${x + 1}=${shaft}`);
  }
  lines.push("[TREADLING]");
  for (let y = 0; y < rows; y++) {
    let mean = 0;
    for (let x = 0; x < cols; x++) mean += grid[y * cols + x];
    const treadle = Math.min(shafts, Math.max(1, Math.floor((mean / cols) * shafts) + 1));
    lines.push(`${y + 1}=${treadle}`);
  }
  return lines.join("\n") + "\n";
}

export function encodePcmWav(samples, sampleRate = 44100) {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

export function synthPreviewTone(seed = "studio", durationSec = 1.5, sampleRate = 44100) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const baseHz = 110 * Math.pow(2, ((h >>> 0) % 12) / 12);
  const n = Math.floor(sampleRate * durationSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 20) * Math.exp(-t * 2.2);
    out[i] = env * (0.45 * Math.sin(2 * Math.PI * baseHz * t) +
                    0.25 * Math.sin(2 * Math.PI * baseHz * 1.5 * t) +
                    0.15 * Math.sin(2 * Math.PI * baseHz * 2.0 * t));
  }
  return out;
}

export function buildBuildLangScore(state = {}) {
  const source = String(state.source || "atelier").replace(/[^a-zA-Z0-9_-]/g, "_");
  const seed = String(state.seed || "estuary-01").replace(/"/g, "");
  const w = Number(state.width) || 960;
  const h = Number(state.height) || 540;
  const palette = Array.isArray(state.palette) && state.palette.length
    ? state.palette.map((p) => (typeof p === "string" ? p : p.hex)).slice(0, 8)
    : ["#132a3a", "#2b5f73", "#d79e35", "#ece5d6"];
  return [
    `// Generated by The Playground Unified Super-Tool (harperz9.github.io/studio.html)`,
    `// Source: ${source} | Seed: "${seed}"`,
    `struct StudioScene {`,
    `    width: i32,`,
    `    height: i32,`,
    `    palette_count: i32,`,
    `}`,
    ``,
    `fn studio_scene_checksum(w: i32, h: i32, n: i32) -> i32 {`,
    `    return (w * 31 + h * 17 + n * 13) % 65521;`,
    `}`,
    ``,
    `fn main() -> i32 {`,
    `    let scene = StudioScene { width: ${w}, height: ${h}, palette_count: ${palette.length} };`,
    `    let _colors = "${palette.join(",")}";`,
    `    let chk = studio_scene_checksum(scene.width, scene.height, scene.palette_count);`,
    `    return chk - chk;`,
    `}`,
    ``,
  ].join("\n");
}

let registered = false;

export function registerUnifiedExporters() {
  if (registered) return;
  registered = true;

  StudioExporters.register("plot-svg", async (canvas, extra = {}) => {
    const pixels = readCanvasPixels(canvas, extra);
    const opts = { ...PLOT_DETAIL.fine, style: "hatch", seed: extra.seed || "studio" };
    const lines = orderPaths(hatchFromLuma(pixels.data, pixels.w, pixels.h, 4, opts));
    return toPlotterSVG(lines, pixels.w, pixels.h, opts);
  });

  StudioExporters.register("plot-gcode", async (canvas, extra = {}) => {
    const pixels = readCanvasPixels(canvas, extra);
    const opts = { ...PLOT_DETAIL.fine, style: "hatch", seed: extra.seed || "studio", widthMm: extra.widthMm || 190 };
    const lines = orderPaths(hatchFromLuma(pixels.data, pixels.w, pixels.h, 4, opts));
    return toGcode(lines, pixels.w, pixels.h, opts);
  });

  StudioExporters.register("relief-stl", async (canvas, extra = {}) => {
    const pixels = readCanvasPixels(canvas, extra);
    const rw = extra.reliefW || 96;
    const rh = extra.reliefH || 72;
    const heights = lumaGridFromPixels(pixels, rw, rh);
    const stl = heightmapToSTL(heights, rw, rh, { widthMM: 100, minMM: 0.8, maxMM: 3.0 });
    return new Blob([stl], { type: "model/stl" });
  });

  StudioExporters.register("palette-gpl", async (canvas, extra = {}) => {
    const palette = Array.isArray(extra.palette) && extra.palette.length
      ? extra.palette.map((p, i) => (typeof p === "string" ? { hex: p, frac: 1 / extra.palette.length, name: `c${i}` } : p))
      : extractPaletteFromPixels(readCanvasPixels(canvas, extra), 8);
    return toGplPalette({ dominantSwatches: palette }, extra.name || "The Playground");
  });

  StudioExporters.register("cloth-wif", async (canvas, extra = {}) => {
    const pixels = readCanvasPixels(canvas, extra);
    return encodeClothWIF(pixels, extra.name || "studio-weave", extra.shafts || 8);
  });

  StudioExporters.register("audio-wav", async (_canvas, extra = {}) => {
    const samples = extra.samples instanceof Float32Array
      ? extra.samples
      : synthPreviewTone(String(extra.seed || "studio"), extra.durationSec || 1.5, extra.sampleRate || 44100);
    const bytes = encodePcmWav(samples, extra.sampleRate || 44100);
    return new Blob([bytes], { type: "audio/wav" });
  });

  StudioExporters.register("buildlang-bld", async (canvas, extra = {}) => {
    return buildBuildLangScore({
      source: extra.source || "studio",
      seed: extra.seed || "estuary-01",
      width: canvas?.width || extra.width || 960,
      height: canvas?.height || extra.height || 540,
      palette: extra.palette,
    });
  });
}

export function mountUnifiedExportHub(host, getContext) {
  if (!host || host.dataset.unifiedExportMounted) return;
  registerUnifiedExporters();
  host.dataset.unifiedExportMounted = "1";

  const bar = document.createElement("div");
  bar.className = "unified-export-hub";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "Unified export pipeline");

  const sel = document.createElement("select");
  sel.id = "unified-export-format";
  sel.className = "poster-seed";
  sel.setAttribute("aria-label", "Export format");
  const groups = new Map();
  for (const f of UNIFIED_FORMATS) {
    if (!groups.has(f.category)) {
      const og = document.createElement("optgroup");
      og.label = f.category;
      groups.set(f.category, og);
      sel.appendChild(og);
    }
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.label;
    groups.get(f.category).appendChild(opt);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "unified-export-go";
  btn.className = "btn primary";
  btn.textContent = "Export + Receipt";

  const status = document.createElement("span");
  status.id = "unified-export-status";
  status.className = "unified-export-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.textContent = `Format: ${UNIFIED_FORMATS[0].label}`;

  sel.addEventListener("change", () => {
    const meta = UNIFIED_FORMATS.find((f) => f.id === sel.value);
    status.textContent = `Format: ${meta ? meta.label : sel.value} (SHA-256 receipt ready)`;
  });

  btn.addEventListener("click", async () => {
    const fmt = sel.value;
    const meta = UNIFIED_FORMATS.find((f) => f.id === fmt) || { ext: fmt };
    const ctx = typeof getContext === "function" ? getContext() : {};
    const canvas = ctx.canvas || document.getElementById("studio-canvas");
    btn.disabled = true;
    status.textContent = `Exporting ${fmt}...`;
    try {
      const { blobOrString, receipt } = await StudioExporters.exportWithReceipt(fmt, canvas, ctx.extra || {});
      const stem = `${ctx.source || "studio"}-${Date.now()}`;
      download(blobOrString, `${stem}.${meta.ext}`);
      const shortHash = receipt?.commitHash ? receipt.commitHash.slice(0, 12) : "sealed";
      status.textContent = `Saved ${stem}.${meta.ext} (sha256:${shortHash})`;
    } catch (err) {
      status.textContent = `Export error: ${err?.message || err}`;
    } finally {
      btn.disabled = false;
    }
  });

  bar.append(sel, btn, status);
  host.appendChild(bar);
}
