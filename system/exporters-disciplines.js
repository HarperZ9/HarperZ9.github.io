// exporters-disciplines.js: the modular export registry across artistic
// disciplines. Pure, node-testable helpers plus the registrations that attach
// to StudioExporters. Zero dependencies. Every writer builds bytes by hand so
// a pen plotter, a knitting chart, a GIMP palette, or a relief mill can each
// consume the same live frame. The perception packet (opts.perception) grounds
// the design/textile/text disciplines in the frame's measured numbers.

/* ── discipline registry ──────────────────────────────────────────────────────
   Every kind, so a UI can list exports grouped by discipline without knowing
   the writers. `needs`: "canvas" (reads pixels) | "perception" (reads the
   measured packet) | "both". */
export const EXPORT_KINDS = [
  { kind: "png", label: "PNG image", ext: "png", mime: "image/png", discipline: "raster", needs: "canvas" },
  { kind: "jpeg", label: "JPEG image", ext: "jpg", mime: "image/jpeg", discipline: "raster", needs: "canvas" },
  { kind: "webp", label: "WebP image", ext: "webp", mime: "image/webp", discipline: "raster", needs: "canvas" },
  { kind: "svg", label: "SVG snapshot", ext: "svg", mime: "image/svg+xml", discipline: "vector", needs: "canvas" },
  { kind: "pdf", label: "PDF page", ext: "pdf", mime: "application/pdf", discipline: "print", needs: "canvas" },
  { kind: "palette-gpl", label: "GIMP palette", ext: "gpl", mime: "text/plain", discipline: "design", needs: "perception" },
  { kind: "palette-css", label: "CSS variables", ext: "css", mime: "text/css", discipline: "design", needs: "perception" },
  { kind: "palette-json", label: "JSON palette", ext: "json", mime: "application/json", discipline: "design", needs: "perception" },
  { kind: "stitch", label: "Cross-stitch chart", ext: "png", mime: "image/png", discipline: "textile", needs: "perception" },
  { kind: "text-art", label: "Text art + read", ext: "txt", mime: "text/plain", discipline: "text", needs: "perception" },
  { kind: "heightmap-obj", label: "Relief mesh OBJ", ext: "obj", mime: "text/plain", discipline: "relief / cnc", needs: "canvas" },
  { kind: "obj", label: "Geometry OBJ", ext: "obj", mime: "text/plain", discipline: "3d", needs: "canvas" },
  { kind: "gltf", label: "Geometry glTF", ext: "gltf", mime: "model/gltf+json", discipline: "3d", needs: "canvas" },
  { kind: "webm", label: "WebM clip", ext: "webm", mime: "video/webm", discipline: "motion", needs: "canvas" },
  { kind: "json", label: "Perception JSON", ext: "json", mime: "application/json", discipline: "data", needs: "canvas" },
];

// ── palette writers (pure) ───────────────────────────────────────────────────

function swatchesFrom(perception) {
  const p = perception || {};
  const rich = p.rich || p;
  const list = (rich && rich.dominantSwatches) || p.dominantSwatches || [];
  return list.map((s, i) => {
    const hex = String(s.hex || "#000000").replace(/[^#0-9a-fA-F]/g, "");
    const r = s.r != null ? s.r : parseInt(hex.slice(1, 3), 16) || 0;
    const g = s.g != null ? s.g : parseInt(hex.slice(3, 5), 16) || 0;
    const b = s.b != null ? s.b : parseInt(hex.slice(5, 7), 16) || 0;
    return { hex: "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join(""),
      r, g, b, frac: Number(s.frac) || 0, index: i + 1 };
  });
}

export function toGplPalette(perception, name = "Telos plate") {
  const sw = swatchesFrom(perception);
  const lines = ["GIMP Palette", "Name: " + name, "Columns: " + Math.min(8, sw.length || 1), "#"];
  for (const s of sw) {
    const pct = (s.frac * 100).toFixed(1);
    lines.push(
      String(s.r).padStart(3) + " " + String(s.g).padStart(3) + " " + String(s.b).padStart(3)
      + "\t" + s.hex + " " + pct + "%");
  }
  return lines.join("\n") + "\n";
}

export function toCssPalette(perception, prefix = "plate") {
  const sw = swatchesFrom(perception);
  const rows = sw.map((s) =>
    "  --" + prefix + "-" + s.index + ": " + s.hex + ";  /* " + (s.frac * 100).toFixed(1) + "% of the frame */");
  return ":root {\n" + rows.join("\n") + "\n}\n";
}

export function toJsonPalette(perception) {
  const sw = swatchesFrom(perception);
  const p = perception || {};
  return JSON.stringify({
    source: "Telos generative engine",
    swatches: sw.map((s) => ({ hex: s.hex, rgb: [s.r, s.g, s.b], fraction: s.frac })),
    colorGrid16: (p.detail && p.detail.colorGrid16) || p.colorGrid16 || null,
  }, null, 2) + "\n";
}

// ── cross-stitch chart legend (pure) ─────────────────────────────────────────

const STITCH_SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWX";

function hexToRgb(hex) {
  const c = String(hex || "#000000").replace("#", "");
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) || 0);
}

function colorDist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

/* Reduce a grid of hex cells to <= maxSymbols floss colours. Greedy: each cell
   joins the nearest existing cluster within `merge`, else opens a new one
   (until the cap, after which it joins the nearest regardless). Returns
   { legend:[{symbol,hex,rgb,count}], cellSymbol:(hex)->symbol }. Deterministic. */
export function stitchLegend(gridRows, maxSymbols = 12, merge = 40) {
  const clusters = [];
  const assign = (rgb) => {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < clusters.length; i += 1) {
      const d = colorDist(rgb, clusters[i].sum.map((s) => s / clusters[i].count));
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0 && (bestD <= merge || clusters.length >= maxSymbols)) {
      clusters[best].sum = clusters[best].sum.map((s, k) => s + rgb[k]);
      clusters[best].count += 1;
      return best;
    }
    clusters.push({ sum: rgb.slice(), count: 1 });
    return clusters.length - 1;
  };
  const rows = (gridRows || []).map((row) => row.map((hex) => assign(hexToRgb(hex))));
  const legend = clusters.map((c, i) => {
    const rgb = c.sum.map((s) => Math.round(s / c.count));
    return { symbol: STITCH_SYMBOLS[i] || "?", hex: "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join(""),
      rgb, count: c.count };
  });
  return { legend, rows };
}

// ── relief heightmap OBJ from a luminance grid (pure) ─────────────────────────

/* lumaGrid: rows of 0..1 luminance. Emits an OBJ relief: a vertex per cell
   (z = luma * depth), quad faces triangulated, so a mill or a 3D viewer sees
   the frame as terrain. Deterministic string. */
export function heightGridToObj(lumaGrid, depth = 10, spanX = 100, spanY = 100) {
  const rows = lumaGrid.length;
  const cols = rows ? lumaGrid[0].length : 0;
  if (rows < 2 || cols < 2) return "# empty relief\n";
  const out = ["# Telos relief heightmap", "# " + cols + "x" + rows + " grid, depth " + depth];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const px = (x / (cols - 1) - 0.5) * spanX;
      const py = (0.5 - y / (rows - 1)) * spanY;
      const pz = (lumaGrid[y][x] || 0) * depth;
      out.push("v " + px.toFixed(3) + " " + py.toFixed(3) + " " + pz.toFixed(3));
    }
  }
  const idx = (x, y) => y * cols + x + 1; // OBJ is 1-indexed
  for (let y = 0; y < rows - 1; y += 1) {
    for (let x = 0; x < cols - 1; x += 1) {
      const a = idx(x, y), b = idx(x + 1, y), c = idx(x + 1, y + 1), d = idx(x, y + 1);
      out.push("f " + a + " " + b + " " + c);
      out.push("f " + a + " " + c + " " + d);
    }
  }
  return out.join("\n") + "\n";
}

// ── text-art file body (pure) ────────────────────────────────────────────────

export function toTextArt(perception) {
  const p = perception || {};
  const detail = p.detail || p;
  const parts = ["TELOS FRAME - text read", "=".repeat(32), ""];
  if (p.longDescription) parts.push(p.longDescription, "");
  if (detail.ascii) parts.push("ASCII luminance:", detail.ascii, "");
  if (detail.braille) parts.push("Braille luminance (2x4 dots per cell):", detail.braille, "");
  const sw = swatchesFrom(perception);
  if (sw.length) {
    parts.push("Palette:");
    for (const s of sw) parts.push("  " + s.hex + "  " + (s.frac * 100).toFixed(1) + "%");
  }
  return parts.join("\n") + "\n";
}
