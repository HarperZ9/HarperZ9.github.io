// poster.js: the typography workshop engine. Zero dependencies.
//
// A poster is STATE (format, margins, an engine-drawn art layer, and type
// blocks) rendered onto a canvas, then READ BACK through the perception
// tooling so critique is grounded in measurements, never vibes: contrast
// ratios, busy-region placement, palette distance, breathing room. The same
// packet a no-vision model receives is what drives the advice, so a person
// and a model iterate on the same evidence.

export const POSTER_FORMATS = {
  a3: { w: 1191, h: 1684, label: "A3 portrait" },
  a3l: { w: 1684, h: 1191, label: "A3 landscape" },
  square: { w: 1400, h: 1400, label: "Square" },
  social: { w: 1080, h: 1350, label: "Social 4:5" },
  wide: { w: 1920, h: 1080, label: "Wide 16:9" },
};

export const POSTER_FACES = {
  brand: '"Hanken Grotesk",system-ui,sans-serif',
  display: '"Hanken Grotesk",system-ui,sans-serif',
  body: '"Hanken Grotesk",system-ui,sans-serif',
  mono: '"Conso","JetBrains Mono",ui-monospace,monospace',
};

export const POSTER_BLOCK_LABELS = Object.freeze({
  headline: "Heading",
  standfirst: "Supporting text",
  folio: "Caption",
});
export const POSTER_BLOCK_KINDS = Object.freeze(Object.keys(POSTER_BLOCK_LABELS));

// Nine anchor cells matching the perception grid, so critique and placement
// speak the same spatial language.
export const POSTER_CELLS = [
  "top-left", "top-center", "top-right",
  "middle-left", "center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];

// One base artwork per live poster canvas. Type edits do not need to regenerate
// the same seeded image; the WeakMap releases it with the owning canvas.
const posterArtwork = new WeakMap();

export function posterBlockLabel(kind) {
  return POSTER_BLOCK_LABELS[kind] || "Text";
}

export function defaultPosterBlock(kind = "standfirst") {
  if (kind === "headline") {
    return { kind: "headline", text: "New heading", face: "brand", size: 0.07,
      tracking: 0.02, leading: 1.05, align: "left", cell: "middle-left",
      color: "#f2ecf7", caseMode: "upper" };
  }
  if (kind === "folio") {
    return { kind: "folio", text: "Caption", face: "mono", size: 0.014,
      tracking: 0.18, leading: 1, align: "left", cell: "top-left",
      color: "#8f86a0", caseMode: "upper" };
  }
  return { kind: "standfirst", text: "Supporting text", face: "body", size: 0.024,
    tracking: 0, leading: 1.4, align: "left", cell: "bottom-left",
    color: "#c9c2d4", caseMode: "none" };
}

export function defaultPosterState(seed = "poster-01") {
  return {
    format: "a3",
    margin: 0.07,
    art: { layers: ["showpiece-veil"], seed, opacity: 1, veil: 0.25, veilMode: "panel", fx: [], fxAmount: 0.6 },
    blocks: [
      { kind: "headline", text: "THE LOOKING GLASS", face: "brand", size: 0.09,
        tracking: 0.02, leading: 1.02, align: "left", cell: "middle-left",
        color: "#f2ecf7", caseMode: "upper" },
      { kind: "standfirst", text: "A study in light, texture and the spaces between.",
        face: "body", size: 0.024, tracking: 0, leading: 1.4, align: "left",
        cell: "bottom-left", color: "#c9c2d4", caseMode: "none" },
      { kind: "folio", text: "", face: "mono", size: 0.014,
        tracking: 0.24, leading: 1, align: "left", cell: "top-left",
        color: "#8f86a0", caseMode: "upper" },
    ],
  };
}

// Cell anchor -> normalized x/y of the block's anchor point inside margins.
export function cellAnchor(cell, margin) {
  const i = Math.max(0, POSTER_CELLS.indexOf(cell));
  const col = i % 3, row = Math.floor(i / 3);
  const t = (k) => margin + (1 - 2 * margin) * (k === 0 ? 0 : k === 1 ? 0.5 : 1);
  return { x: t(col), y: t(row), col, row };
}

function applyCase(text, mode) {
  if (mode === "upper") return String(text).toUpperCase();
  if (mode === "lower") return String(text).toLowerCase();
  return String(text);
}

// Rendered width of a line INCLUDING the manual per-glyph tracking applied at draw time.
// The wrap and fit must use this, not the raw measurer, or a tracked line that "fits" on
// measurement renders wider than the frame and clips.
export function trackedWidth(ctx, line, tracking = 0) {
  const s = String(line);
  if (!Number.isFinite(tracking) || Math.abs(tracking) <= 0.01) return ctx.measureText(s).width;
  const glyphs = [...s];
  return Math.max(0, glyphs.reduce((width, glyph) => width + ctx.measureText(glyph).width, 0)
    + tracking * Math.max(0, glyphs.length - 1));
}

// Wrap text to a max width using the canvas measurer, counting letter tracking. Pure given a ctx.
export function wrapText(ctx, text, maxWidth, tracking = 0) {
  const lines = [];
  for (const paragraph of String(text).split(/\r\n|\n|\r/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const probe = line ? line + " " + word : word;
      if (line && trackedWidth(ctx, probe, tracking) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = probe;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampUnit(value) {
  const n = finiteNumber(value);
  if (n == null) return null;
  return Math.max(0, Math.min(1, n));
}

function positionedTopLeft(block, fallbackX, fallbackY, boxW, boxH, fmt) {
  const pos = block && block.position;
  const nx = pos ? clampUnit(pos.x) : null;
  const ny = pos ? clampUnit(pos.y) : null;
  if (nx == null || ny == null) return { x: fallbackX, y: fallbackY, positioned: false };
  const bw = Math.max(0, Math.min(1, boxW / Math.max(1, fmt.w)));
  const bh = Math.max(0, Math.min(1, boxH / Math.max(1, fmt.h)));
  return {
    x: Math.max(0, Math.min(1 - bw, nx)) * fmt.w,
    y: Math.max(0, Math.min(1 - bh, ny)) * fmt.h,
    positioned: true,
  };
}

function lineStartX(lineWidth, boxX, boxW, blockAlign, anchor, margin, fmt) {
  const align = blockAlign === "center" || blockAlign === "right" ? blockAlign : "left";
  if (boxX != null) {
    if (align === "center") return boxX + (boxW - lineWidth) / 2;
    if (align === "right") return boxX + boxW - lineWidth;
    return boxX;
  }
  if (anchor.col === 1) return (fmt.w - lineWidth) / 2;
  if (anchor.col === 2) return fmt.w * (1 - margin) - lineWidth;
  return fmt.w * margin;
}

/* Render the poster: art via the injected engine (renderSpecimen), a
   legibility veil, then the type blocks. Returns per-block layout boxes in
   0..1 fractions - the critique reads these against the perception grid.
   deps: { renderSpecimen } from generative-field.js. */
export function renderPoster(canvas, state, deps = {}) {
  const fmt = POSTER_FORMATS[state.format] || POSTER_FORMATS.a3;
  canvas.width = fmt.w;
  canvas.height = fmt.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, boxes: [] };

  // 1) the art layer. An imported image (deps.drawImage over state.art.image)
  //    takes precedence; else the site engine draws the chosen instruments;
  //    else a flat ground.
  if (state.art && state.art.image && typeof deps.drawImage === "function") {
    try { deps.drawImage(canvas, state.art.image); } catch (_) {}
  } else if (typeof deps.renderSpecimen === "function" && state.art && state.art.layers && state.art.layers.length) {
    // The artwork engine owns its canvas size and drawing transform. Keep it
    // on a separate surface, then composite into the poster's native pixels.
    const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    try {
      const key = JSON.stringify([fmt.w, fmt.h, state.art.seed, state.art.layers, dpr]);
      let cached = posterArtwork.get(canvas);
      const live = state.art.seed == null || String(state.art.seed).toLowerCase() === "live";
      if (live || !cached || cached.key !== key || cached.renderer !== deps.renderSpecimen) {
        const artCanvas = document.createElement("canvas");
        deps.renderSpecimen(artCanvas, state.art.seed, state.art.layers, null, 0.6,
          { size: [fmt.w / dpr, fmt.h / dpr] });
        cached = { key, renderer: deps.renderSpecimen, canvas: artCanvas };
        posterArtwork.set(canvas, cached);
      }
      ctx.drawImage(cached.canvas, 0, 0, fmt.w, fmt.h);
    } catch (_) {}
  } else {
    ctx.fillStyle = "#141018";
    ctx.fillRect(0, 0, fmt.w, fmt.h);
  }
  // 1b) optional retro treatment: pixelate the art layer through the Retro Engine
  //     before the veil and type land on top, so the poster reads as a pixel-art print.
  //     Composition rules that keep treatments from NEGATING the instrument choice:
  //     palette "keep" quantizes to the art's OWN colours (median cut) instead of a
  //     console palette, retroRes picks the pixel grid, and retroMix blends the
  //     treated frame over the untreated one so the treatment can be a texture,
  //     not a replacement.
  if (state.art && state.art.retro && typeof deps.renderRetro === "function") {
    try {
      const tmp = document.createElement("canvas"); tmp.width = fmt.w; tmp.height = fmt.h;
      tmp.getContext("2d").drawImage(canvas, 0, 0);
      const rc = document.createElement("canvas");
      const RES = { fine: 420, standard: 240, chunky: 120 };
      const pal = state.art.retro.palette;
      // Print-oriented defaults (no CRT curvature/scanlines).
      deps.renderRetro(tmp, rc, {
        targetWidth: RES[state.art.retroRes] || 240,
        dither: "bayer4", scanlines: false, curvature: 0, vignette: 0, bloom: 0,
        ...(pal === "keep" ? { palette: "auto", autoK: 12 } : { palette: pal }),
      });
      const mix = Math.max(0, Math.min(1, state.art.retroMix ?? 1));
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = mix;
      ctx.drawImage(rc, 0, 0, fmt.w, fmt.h);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
    } catch (_) {}
  }

  // 1c) the effect rack: the same treatments the Retro Engine and the print desk
  //     run, landing on the ART only. Order matters: after the retro treatment
  //     (so a pixel grid gets treated, not the other way round) and BEFORE the
  //     veil and the type, so a glitch never chews the words.
  if (state.art && Array.isArray(state.art.fx) && state.art.fx.length
      && typeof deps.applyOps === "function") {
    const amt = Math.max(0.05, Math.min(1, state.art.fxAmount ?? 0.6));
    try {
      deps.applyOps(canvas, state.art.fx.map((op, i) => ({
        op, amount: 1, seed: (state.art.seed || "poster") + ":" + op + ":" + i,
      })), amt);
    } catch (_) {}
  }

  // 2) legibility for type over busy art. Two modes: "wash" darkens the whole
  //    frame (the classic veil); "panel" leaves the art alone and puts a soft
  //    scrim behind each type block only, drawn in the type pass below.
  const veil = state.art ? Math.max(0, Math.min(0.85, state.art.veil ?? 0.25)) : 0.25;
  const veilMode = (state.art && state.art.veilMode) || "wash";
  if (veil > 0 && veilMode === "wash") {
    ctx.fillStyle = `rgba(10,6,14,${veil})`;
    ctx.fillRect(0, 0, fmt.w, fmt.h);
  }

  // 3) type blocks
  const boxes = [];
  const margin = Math.max(0.02, Math.min(0.2, state.margin ?? 0.07));
  for (const [index, block] of (state.blocks || []).entries()) {
    const face = POSTER_FACES[block.face] || POSTER_FACES.display;
    const anchor = cellAnchor(block.cell || "center", margin);
    ctx.textBaseline = "top";
    const maxWidth = fmt.w * (1 - 2 * margin) * (anchor.col === 1 ? 1 : 0.72);
    const text = applyCase(block.text || "", block.caseMode);
    const weight = Number.isFinite(block.weight) ? Math.max(100, Math.min(900, block.weight))
      : block.kind === "headline" ? 800 : 500;

    // Fit both dimensions. Search for the largest integer size that fits;
    // wrapping changes as type shrinks, so a single height ratio over-shrinks.
    const maxHeight = fmt.h * (1 - 2 * margin);
    const lineRatio = block.leading || 1.1;
    const layoutAt = size => {
      ctx.font = `${weight} ${size}px ${face}`;
      const spacing = (block.tracking || 0) * size;
      const rows = wrapText(ctx, text, maxWidth, spacing);
      const width = rows.reduce((m, row) => Math.max(m, trackedWidth(ctx, row, spacing)), 0);
      return { rows, width, spacing, height: size * lineRatio * Math.max(0, rows.length - 1) + size };
    };
    let sizePx = Math.max(8, Math.round((block.size || 0.03) * fmt.h));
    let layout = layoutAt(sizePx);
    if (layout.width > maxWidth || layout.height > maxHeight) {
      let low = 1, high = sizePx, fitted = 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = layoutAt(mid);
        if (candidate.width <= maxWidth && candidate.height <= maxHeight) {
          fitted = mid; low = mid + 1;
        } else high = mid - 1;
      }
      sizePx = fitted;
      layout = layoutAt(sizePx);
    }
    const { rows: lines, width: widest, spacing: tracking } = layout;
    const leading = sizePx * lineRatio;
    const blockH = layout.height;
    // anchor: col 0 -> left-aligned at margin; col 1 -> centered; col 2 -> right edge
    const cellX0 = anchor.col === 0 ? fmt.w * margin
      : anchor.col === 1 ? (fmt.w - widest) / 2
      : fmt.w * (1 - margin) - widest;
    const cellY0 = anchor.row === 0 ? fmt.h * margin
      : anchor.row === 1 ? (fmt.h - blockH) / 2
      : fmt.h * (1 - margin) - blockH;
    const placed = positionedTopLeft(block, cellX0, cellY0, widest, blockH, fmt);
    const x0 = placed.x;
    const y0 = placed.y;
    // panel veil: a feathered scrim behind this block only, so the art
    // elsewhere keeps its full brightness
    if (veilMode === "panel" && veil > 0 && text.trim() && lines.length) {
      const padX = sizePx * 0.9, padY = sizePx * 0.55;
      ctx.fillStyle = `rgba(10,6,14,${(veil * 0.34).toFixed(3)})`;
      for (let k = 2; k >= 0; k -= 1) {
        const grow = k * sizePx * 0.35;
        const px = x0 - padX - grow, py = y0 - padY - grow;
        const pw = widest + 2 * (padX + grow), ph = blockH + 2 * (padY + grow);
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(px, py, pw, ph, sizePx * 0.5 + grow);
          ctx.fill();
        } else {
          ctx.fillRect(px, py, pw, ph);
        }
      }
    }
    ctx.fillStyle = block.color || "#f2ecf7";
    lines.forEach((line, li) => {
      const lineW = Math.abs(tracking) > 0.01 ? trackedWidth(ctx, line, tracking) : ctx.measureText(line).width;
      if (Math.abs(tracking) > 0.01) {
        // manual tracking: draw per character, positioned by the tracking-aware width
        let cx = lineStartX(lineW, placed.positioned ? x0 : null, widest, block.align, anchor, margin, fmt);
        for (const chr of line) {
          ctx.fillText(chr, cx, y0 + li * leading);
          cx += ctx.measureText(chr).width + tracking;
        }
      } else {
        const lx = lineStartX(lineW, placed.positioned ? x0 : null, widest, block.align, anchor, margin, fmt);
        ctx.fillText(line, lx, y0 + li * leading);
      }
    });
    boxes.push({
      index,
      kind: block.kind,
      x0: x0 / fmt.w, y0: y0 / fmt.h,
      x1: Math.min(1, (x0 + widest) / fmt.w), y1: Math.min(1, (y0 + blockH) / fmt.h),
      cell: block.cell, positioned: placed.positioned, color: block.color || "#f2ecf7", lines: lines.length,
    });
  }
  return { ok: true, boxes, width: fmt.w, height: fmt.h };
}

/* ── the grounded critique ────────────────────────────────────────────────────
   Rules read the SAME perception detail the no-vision packet carries plus the
   block layout boxes. Every finding cites its numbers. Levels: "fix" (would
   fail a reader), "note" (worth considering), "praise" (earned, specific). */

function hexLuminance(hex) {
  const c = String(hex || "#ffffff").replace("#", "");
  const v = [0, 2, 4].map((i) => {
    const n = parseInt(c.slice(i, i + 2), 16) / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

export function contrastRatio(hexA, hexB) {
  const a = hexLuminance(hexA), b = hexLuminance(hexB);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function cellFor(box) {
  // Use the box's center to find its perception-grid cell.
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const col = cx < 1 / 3 ? 0 : cx < 2 / 3 ? 1 : 2;
  const row = cy < 1 / 3 ? 0 : cy < 2 / 3 ? 1 : 2;
  return { col, row, name: POSTER_CELLS[row * 3 + col] };
}

export function critiquePoster(boxes, detail, rich) {
  const findings = [];
  if (!detail || !detail.grid3) {
    return [{ level: "note", text: "No perception detail available yet; render the poster first." }];
  }
  const grid = detail.grid3;
  const flatCells = [];
  grid.forEach((row, y) => row.forEach((c, x) => flatCells.push({ ...c, x, y, name: POSTER_CELLS[y * 3 + x] })));
  const calmest = flatCells.slice().sort((a, b) => a.edge - b.edge)[0];

  for (const box of boxes) {
    const { col, row, name } = cellFor(box);
    const cell = grid[row][col];
    // 1) type over busy texture
    if (box.kind !== "folio" && cell.edge > 0.4) {
      findings.push({ level: "fix",
        blockIndex: box.index,
        text: `The ${box.kind} sits on a busy region (${name}, edge density ${cell.edge}); the calmest cell is ${calmest.name} (edge ${calmest.edge}). Move it or raise the veil.` });
    }
    // 2) WCAG contrast of the block color vs the cell's mean color
    const ratio = contrastRatio(box.color, cell.hex);
    if (ratio < 3) {
      findings.push({ level: "fix",
        blockIndex: box.index,
        text: `The ${box.kind} reads ${ratio.toFixed(1)}:1 against its ground (${cell.hex} in ${name}) - below even large-text AA (3:1). Lighten the type or deepen the veil.` });
    } else if (ratio < 4.5 && box.kind !== "headline") {
      findings.push({ level: "note",
        blockIndex: box.index,
        text: `The ${box.kind} is ${ratio.toFixed(1)}:1 against ${name}; fine for large type, thin for small. AA for body sizes wants 4.5:1.` });
    } else if (ratio > 7 && box.kind === "headline") {
      findings.push({ level: "praise",
        blockIndex: box.index,
        text: `Headline contrast is strong (${ratio.toFixed(1)}:1 over ${name}) - it will carry at poster distance.` });
    }
  }

  // 3) composition: does type avoid the light mass or fight it?
  const brightest = flatCells.slice().sort((a, b) => b.luma - a.luma)[0];
  const headline = boxes.find((b) => b.kind === "headline");
  if (headline) {
    const hc = cellFor(headline);
    if (hc.name === brightest.name && brightest.luma > 0.55) {
      findings.push({ level: "note",
        blockIndex: headline.index,
        text: `The headline shares its cell with the art's light mass (${brightest.name}, luma ${brightest.luma}); the eye will fight between them. Consider offsetting one.` });
    } else if (Math.abs(hc.col - brightest.x) + Math.abs(hc.row - brightest.y) >= 2) {
      findings.push({ level: "praise",
        blockIndex: headline.index,
        text: `The headline (${hc.name}) and the art's light mass (${brightest.name}) balance across the frame - a classic diagonal tension that reads intentional.` });
    }
  }

  // 4) breathing: blocks crowding each other
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i], b = boxes[j];
      const overlapX = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
      const overlapY = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
      if (overlapX > 0 && overlapY > 0) {
        findings.push({ level: "fix",
          blockIndex: a.index,
          otherBlockIndex: b.index,
          text: `The ${a.kind} and the ${b.kind} overlap (${Math.round(overlapX * 100)}% x ${Math.round(overlapY * 100)}% of the frame); give one a different cell.` });
      }
    }
  }

  // 5) palette kinship: type color vs the art's dominant swatches
  if (rich && rich.dominantSwatches && rich.dominantSwatches.length && headline) {
    let nearest = Infinity;
    for (const s of rich.dominantSwatches) {
      const dr = parseInt(headline.color.slice(1, 3), 16) - s.r;
      const dg = parseInt(headline.color.slice(3, 5), 16) - s.g;
      const db = parseInt(headline.color.slice(5, 7), 16) - s.b;
      nearest = Math.min(nearest, Math.sqrt(dr * dr + dg * dg + db * db));
    }
    if (nearest > 40 && nearest < 110) {
      findings.push({ level: "note",
        blockIndex: headline.index,
        text: `The headline color sits near the art's palette without belonging to it (nearest swatch distance ${Math.round(nearest)}); either match a swatch or commit to full contrast.` });
    }
  }

  if (!findings.some((f) => f.level === "fix")) {
    findings.push({ level: "praise", text: "No legibility failures: every block clears its ground. The poster is structurally sound." });
  }
  return findings;
}
