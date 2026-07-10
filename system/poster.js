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
  brand: '"Telos Display","Kilon",system-ui,sans-serif',
  display: '"Kilon",system-ui,sans-serif',
  body: '"Hanken Grotesk",system-ui,sans-serif',
  mono: '"Conso","JetBrains Mono",ui-monospace,monospace',
};

// Nine anchor cells matching the perception grid, so critique and placement
// speak the same spatial language.
export const POSTER_CELLS = [
  "top-left", "top-center", "top-right",
  "middle-left", "center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];

export function defaultPosterState(seed = "poster-01") {
  return {
    format: "a3",
    margin: 0.07,
    art: { layers: ["showpiece-veil"], seed, opacity: 1, veil: 0.25 },
    blocks: [
      { kind: "headline", text: "THE LOOKING GLASS", face: "brand", size: 0.09,
        tracking: 0.02, leading: 1.02, align: "left", cell: "middle-left",
        color: "#f2ecf7", caseMode: "upper" },
      { kind: "standfirst", text: "Drawn live by the engine. Read back by the same eyes the model uses.",
        face: "body", size: 0.024, tracking: 0, leading: 1.4, align: "left",
        cell: "bottom-left", color: "#c9c2d4", caseMode: "none" },
      { kind: "folio", text: "TELOS · PLATE 01", face: "mono", size: 0.014,
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

// Wrap text to a max width using the canvas measurer. Pure given a ctx.
export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const probe = line ? line + " " + word : word;
    if (line && ctx.measureText(probe).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
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
    try { deps.renderSpecimen(canvas, state.art.seed, state.art.layers); } catch (_) {}
  } else {
    ctx.fillStyle = "#141018";
    ctx.fillRect(0, 0, fmt.w, fmt.h);
  }
  // 2) a tunable veil so type keeps AA over busy art
  const veil = state.art ? Math.max(0, Math.min(0.85, state.art.veil ?? 0.25)) : 0.25;
  if (veil > 0) {
    ctx.fillStyle = `rgba(10,6,14,${veil})`;
    ctx.fillRect(0, 0, fmt.w, fmt.h);
  }

  // 3) type blocks
  const boxes = [];
  const margin = Math.max(0.02, Math.min(0.2, state.margin ?? 0.07));
  for (const block of state.blocks || []) {
    const face = POSTER_FACES[block.face] || POSTER_FACES.display;
    const sizePx = Math.max(8, Math.round((block.size || 0.03) * fmt.h));
    const anchor = cellAnchor(block.cell || "center", margin);
    ctx.font = `${block.kind === "headline" ? 800 : 500} ${sizePx}px ${face}`;
    ctx.textBaseline = "top";
    const maxWidth = fmt.w * (1 - 2 * margin) * (anchor.col === 1 ? 1 : 0.72);
    const text = applyCase(block.text || "", block.caseMode);
    const lines = wrapText(ctx, text, maxWidth);
    const leading = sizePx * (block.leading || 1.1);
    const blockH = leading * lines.length;
    let widest = 0;
    for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
    // anchor: col 0 -> left-aligned at margin; col 1 -> centered; col 2 -> right edge
    const x0 = anchor.col === 0 ? fmt.w * margin
      : anchor.col === 1 ? (fmt.w - widest) / 2
      : fmt.w * (1 - margin) - widest;
    const y0 = anchor.row === 0 ? fmt.h * margin
      : anchor.row === 1 ? (fmt.h - blockH) / 2
      : fmt.h * (1 - margin) - blockH;
    ctx.fillStyle = block.color || "#f2ecf7";
    const tracking = (block.tracking || 0) * sizePx;
    lines.forEach((line, li) => {
      if (tracking > 0.01) {
        // manual tracking: draw per character
        let cx = anchor.col === 1 ? (fmt.w - (ctx.measureText(line).width + tracking * Math.max(0, line.length - 1))) / 2
          : anchor.col === 2 ? fmt.w * (1 - margin) - (ctx.measureText(line).width + tracking * Math.max(0, line.length - 1))
          : x0;
        for (const chr of line) {
          ctx.fillText(chr, cx, y0 + li * leading);
          cx += ctx.measureText(chr).width + tracking;
        }
      } else {
        const lx = anchor.col === 1 ? (fmt.w - ctx.measureText(line).width) / 2
          : anchor.col === 2 ? fmt.w * (1 - margin) - ctx.measureText(line).width
          : x0;
        ctx.fillText(line, lx, y0 + li * leading);
      }
    });
    boxes.push({
      kind: block.kind,
      x0: x0 / fmt.w, y0: y0 / fmt.h,
      x1: Math.min(1, (x0 + widest) / fmt.w), y1: Math.min(1, (y0 + blockH) / fmt.h),
      cell: block.cell, color: block.color || "#f2ecf7", lines: lines.length,
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
        text: `The ${box.kind} sits on a busy region (${name}, edge density ${cell.edge}); the calmest cell is ${calmest.name} (edge ${calmest.edge}). Move it or raise the veil.` });
    }
    // 2) WCAG contrast of the block color vs the cell's mean color
    const ratio = contrastRatio(box.color, cell.hex);
    if (ratio < 3) {
      findings.push({ level: "fix",
        text: `The ${box.kind} reads ${ratio.toFixed(1)}:1 against its ground (${cell.hex} in ${name}) - below even large-text AA (3:1). Lighten the type or deepen the veil.` });
    } else if (ratio < 4.5 && box.kind !== "headline") {
      findings.push({ level: "note",
        text: `The ${box.kind} is ${ratio.toFixed(1)}:1 against ${name}; fine for large type, thin for small. AA for body sizes wants 4.5:1.` });
    } else if (ratio > 7 && box.kind === "headline") {
      findings.push({ level: "praise",
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
        text: `The headline shares its cell with the art's light mass (${brightest.name}, luma ${brightest.luma}); the eye will fight between them. Consider offsetting one.` });
    } else if (Math.abs(hc.col - brightest.x) + Math.abs(hc.row - brightest.y) >= 2) {
      findings.push({ level: "praise",
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
        text: `The headline color sits near the art's palette without belonging to it (nearest swatch distance ${Math.round(nearest)}); either match a swatch or commit to full contrast.` });
    }
  }

  if (!findings.some((f) => f.level === "fix")) {
    findings.push({ level: "praise", text: "No legibility failures: every block clears its ground. The poster is structurally sound." });
  }
  return findings;
}
