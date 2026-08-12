// weave-render.js: thread-level cloth and the four-quadrant draft chart.
// The cloth recipe follows the researched practice: the top thread of each
// cell drawn as a merged float segment, crest shading across the thread width,
// dive-under shadows at the two ends of every float, longer floats reading
// brighter at mid-span (the satin luster cue), warp and weft sheen differing.
// Chart convention: threading top, tie-up corner, treadling down the side,
// drawdown in the body; filled drawdown cell = warp lifted.

export function clothLayout(draft, maxW, maxH) {
  const threadPx = Math.max(3, Math.min(14, Math.floor(Math.min(maxW / draft.ends, maxH / draft.picks))));
  return { threadPx, w: draft.ends * threadPx, h: draft.picks * threadPx };
}

const shade = (hex, f) => {
  const v = parseInt(hex.replace("#", ""), 16);
  const ch = (x) => Math.max(0, Math.min(255, Math.round(((v >> x) & 255) * f)));
  return "rgb(" + ch(16) + "," + ch(8) + "," + ch(0) + ")";
};

// One thread segment with a rounded profile: body, edge darkening, crest
// highlight, and a dive shadow at both ends. Vertical warp, horizontal weft.
function segment(ctx, x, y, w, h, hex, vertical, runLen, light) {
  ctx.fillStyle = shade(hex, 0.82 + light * 0.25);
  ctx.fillRect(x, y, w, h);
  const t = vertical ? w : h;
  const edge = Math.max(1, Math.floor(t * 0.28));
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  if (vertical) { ctx.fillRect(x, y, edge, h); ctx.fillRect(x + w - edge, y, edge, h); }
  else { ctx.fillRect(x, y, w, edge); ctx.fillRect(x, y + h - edge, w, edge); }
  const lift = Math.min(1, runLen / 5) * 0.18 + 0.10;
  ctx.fillStyle = "rgba(255,255,255," + (lift * (vertical ? 1 : 0.72)).toFixed(3) + ")";
  const crest = Math.max(1, Math.floor(t * 0.22));
  if (vertical) ctx.fillRect(x + Math.floor((w - crest) / 2), y, crest, h);
  else ctx.fillRect(x, y + Math.floor((h - crest) / 2), w, crest);
  const dive = Math.max(1, Math.floor(t * 0.4));
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  if (vertical) { ctx.fillRect(x, y, w, dive); ctx.fillRect(x, y + h - dive, w, dive); }
  else { ctx.fillRect(x, y, dive, h); ctx.fillRect(x + w - dive, y, dive, h); }
}

export function renderCloth(canvas, draft, colors, opts = {}) {
  const upTo = opts.upTo === undefined ? draft.picks : Math.max(0, Math.min(draft.picks, opts.upTo));
  const light = opts.light === undefined ? 0.65 : opts.light;
  const budgetW = opts.maxWidth || 1280, budgetH = opts.maxHeight || 800;
  const { threadPx, w, h } = clothLayout(draft, budgetW, budgetH);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b0a10";
  ctx.fillRect(0, 0, w, h);
  // Unwoven warp above the fell line: bare threads under slight tension.
  ctx.globalAlpha = 1;
  for (let e = 0; e < draft.ends; e++) {
    const x = e * threadPx;
    if (upTo < draft.picks) {
      ctx.fillStyle = shade(colors.warpHex, 0.5);
      ctx.fillRect(x + Math.floor(threadPx * 0.3), upTo * threadPx, Math.max(1, Math.floor(threadPx * 0.4)), h - upTo * threadPx);
    }
  }
  // Weft floats first, then warp floats over them: the two passes together
  // put exactly the lifted thread on top of every cell.
  for (let p = 0; p < upTo; p++) {
    const y = p * threadPx;
    let e = 0;
    while (e < draft.ends) {
      if (!draft.liftAt(e, p)) {
        let run = e;
        while (run < draft.ends && !draft.liftAt(run, p)) run++;
        segment(ctx, e * threadPx, y, (run - e) * threadPx, threadPx, colors.weftHexAt(p), false, run - e, light);
        e = run;
      } else e++;
    }
  }
  for (let e = 0; e < draft.ends; e++) {
    const x = e * threadPx;
    let p = 0;
    while (p < upTo) {
      if (draft.liftAt(e, p)) {
        let run = p;
        while (run < upTo && draft.liftAt(e, run)) run++;
        segment(ctx, x, p * threadPx, threadPx, (run - p) * threadPx, colors.warpHex, true, run - p, light);
        p = run;
      } else p++;
    }
  }
  return { threadPx, w, h };
}

// Chart geometry, pure for tests. Threading (shafts x ends) top left, tie-up
// (shafts x treadles) top right, drawdown (picks x ends) below threading,
// treadling (picks x treadles) below the tie-up. One-cell gutters.
export function chartLayout(draft, width) {
  const cols = draft.ends + draft.treadles + 3;
  const cell = Math.max(3, Math.floor(width / cols));
  const gut = cell;
  const threading = { x: cell, y: cell, w: draft.ends * cell, h: draft.shafts * cell };
  const tieup = { x: threading.x + threading.w + gut, y: cell, w: draft.treadles * cell, h: draft.shafts * cell };
  const drawdown = { x: threading.x, y: threading.y + threading.h + gut, w: draft.ends * cell, h: draft.picks * cell };
  const treadling = { x: tieup.x, y: drawdown.y, w: draft.treadles * cell, h: draft.picks * cell };
  return { cell, threading, tieup, drawdown, treadling,
    width: tieup.x + tieup.w + cell, height: drawdown.y + drawdown.h + cell };
}

function grid(ctx, r, cols, rows, cell) {
  ctx.strokeStyle = "#3a3742";
  ctx.lineWidth = 1;
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(r.x + c * cell + 0.5, r.y); ctx.lineTo(r.x + c * cell + 0.5, r.y + rows * cell); ctx.stroke(); }
  for (let g = 0; g <= rows; g++) { ctx.beginPath(); ctx.moveTo(r.x, r.y + g * cell + 0.5); ctx.lineTo(r.x + cols * cell, r.y + g * cell + 0.5); ctx.stroke(); }
}

export function renderDraftChart(canvas, draft, colors, opts = {}) {
  const L = chartLayout(draft, opts.width || 1200);
  canvas.width = L.width; canvas.height = L.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(0, 0, L.width, L.height);
  const mark = (r, col, row, color) => {
    ctx.fillStyle = color || "#17161c";
    ctx.fillRect(r.x + col * L.cell + 1, r.y + row * L.cell + 1, L.cell - 2, L.cell - 2);
  };
  for (let e = 0; e < draft.ends; e++) mark(L.threading, e, draft.shafts - 1 - draft.threading[e]);
  draft.tieup.forEach((row, t) => row.forEach((on, sh) => { if (on) mark(L.tieup, t, draft.shafts - 1 - sh); }));
  for (let p = 0; p < draft.picks; p++) mark(L.treadling, draft.treadling[p], p);
  for (let p = 0; p < draft.picks; p++) for (let e = 0; e < draft.ends; e++) {
    if (draft.liftAt(e, p)) mark(L.drawdown, e, p, colors && colors.warpHex ? shade(colors.warpHex, 0.4) : "#17161c");
  }
  grid(ctx, L.threading, draft.ends, draft.shafts, L.cell);
  grid(ctx, L.tieup, draft.treadles, draft.shafts, L.cell);
  grid(ctx, L.drawdown, draft.ends, draft.picks, L.cell);
  grid(ctx, L.treadling, draft.treadles, draft.picks, L.cell);
  return L;
}
