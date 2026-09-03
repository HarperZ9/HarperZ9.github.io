// weave-render.js: thread-level cloth and the four-quadrant draft chart.
// The cloth recipe follows the researched practice: the top thread of each
// cell drawn as a merged float segment with a rounded, lit profile, dive-under
// shadows at the two ends of every float, longer floats reading brighter at
// mid-span (the satin luster cue), warp and weft sheen differing.
// Chart convention: threading top, tie-up corner, treadling down the side,
// drawdown in the body; filled drawdown cell = warp lifted.
// Thread pixels come from weave-thread.js: a spun cylinder with a lit crest,
// twist bands, dive shadows at the float ends, and a mid-span luster.
import { hexToRgb, threadTilePixels, diveSpritePixels, lusterPixels } from "./weave-thread.js";

export function clothLayout(draft, maxW, maxH) {
  const threadPx = Math.max(3, Math.min(14, Math.floor(Math.min(maxW / draft.ends, maxH / draft.picks))));
  return { threadPx, w: draft.ends * threadPx, h: draft.picks * threadPx };
}

const shade = (hex, f) => {
  const v = parseInt(hex.replace("#", ""), 16);
  const ch = (x) => Math.max(0, Math.min(255, Math.round(((v >> x) & 255) * f)));
  return "rgb(" + ch(16) + "," + ch(8) + "," + ch(0) + ")";
};

// Sprites per canvas: thread tiles as repeating patterns keyed by colour and
// orientation, plus the dive and luster sprites for the current thread width.
const stores = new WeakMap();

function sprite(px) {
  const c = document.createElement("canvas");
  c.width = px.w; c.height = px.h;
  c.getContext("2d").putImageData(new ImageData(px.data, px.w, px.h), 0, 0);
  return c;
}

function threadKit(canvas, ctx, t, light) {
  let st = stores.get(canvas);
  if (!st || st.t !== t || st.light !== light) {
    const diveLen = Math.max(1, Math.floor(t * 0.5));
    st = {
      t, light, patterns: new Map(), diveLen,
      dive: {
        vStart: sprite(diveSpritePixels(t, diveLen, true, false)), vEnd: sprite(diveSpritePixels(t, diveLen, true, true)),
        hStart: sprite(diveSpritePixels(t, diveLen, false, false)), hEnd: sprite(diveSpritePixels(t, diveLen, false, true)),
      },
      luster: { v: sprite(lusterPixels(t, 48, true, 0.24 * light)), h: sprite(lusterPixels(t, 48, false, 0.17 * light)) },
    };
    stores.set(canvas, st);
  }
  const pattern = (hex, vertical) => {
    const key = hex + (vertical ? "|v" : "|h");
    let pat = st.patterns.get(key);
    if (!pat) {
      pat = ctx.createPattern(sprite(threadTilePixels(hexToRgb(hex), t, vertical, light)), "repeat");
      st.patterns.set(key, pat);
    }
    return pat;
  };
  return { ctx, t, dive: st.dive, diveLen: st.diveLen, luster: st.luster, pattern };
}

// A warp float over the weft: the weft's dive shadows on both sides (the
// sprite stretched to the float's height), the spun body, a dive shadow at
// both ends of the float itself, and a mid-span luster on floats long enough
// to catch the light.
function warpFloat(kit, x, y, h, hex, runLen) {
  const { ctx, t, dive, diveLen, luster } = kit;
  ctx.drawImage(dive.hEnd, x - diveLen, y, diveLen, h);
  ctx.drawImage(dive.hStart, x + t, y, diveLen, h);
  ctx.fillStyle = kit.pattern(hex, true);
  ctx.fillRect(x, y, t, h);
  ctx.drawImage(dive.vStart, x, y);
  ctx.drawImage(dive.vEnd, x, y + h - diveLen);
  if (runLen >= 3) ctx.drawImage(luster.v, x, y, t, h);
}

// Weft rows: each pick is one full-width run of its spun tile, and runs of
// three or more cells under no warp get their luster. Where the weft dives
// under a warp float is drawn by the float itself.
function weftRows(kit, draft, colors, upTo, w) {
  const { ctx, t, luster } = kit;
  for (let p = 0; p < upTo; p++) {
    ctx.fillStyle = kit.pattern(colors.weftHexAt(p), false);
    ctx.fillRect(0, p * t, w, t);
    let e = 0;
    while (e < draft.ends) {
      if (draft.liftAt(e, p)) { e++; continue; }
      let run = e;
      while (run < draft.ends && !draft.liftAt(run, p)) run++;
      if (run - e >= 3) ctx.drawImage(luster.h, e * t, p * t, (run - e) * t, t);
      e = run;
    }
  }
}

function warpColumns(kit, draft, colors, upTo) {
  const t = kit.t;
  for (let e = 0; e < draft.ends; e++) {
    let p = 0;
    while (p < upTo) {
      if (!draft.liftAt(e, p)) { p++; continue; }
      let run = p;
      while (run < upTo && draft.liftAt(e, run)) run++;
      warpFloat(kit, e * t, p * t, (run - p) * t, colors.warpHex, run - p);
      p = run;
    }
  }
}

export function renderCloth(canvas, draft, colors, opts = {}) {
  const upTo = opts.upTo === undefined ? draft.picks : Math.max(0, Math.min(draft.picks, opts.upTo));
  const light = opts.light === undefined ? 0.65 : opts.light;
  const budgetW = opts.maxWidth || 1280, budgetH = opts.maxHeight || 800;
  const { threadPx, w, h } = clothLayout(draft, budgetW, budgetH);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext("2d");
  const kit = threadKit(canvas, ctx, threadPx, light);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#0b0a10";
  ctx.fillRect(0, 0, w, h);
  // Unwoven warp above the fell line: bare threads under slight tension, drawn
  // narrow through the crest of the same spun tile.
  if (upTo < draft.picks) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = kit.pattern(colors.warpHex, true);
    const bare = Math.max(1, Math.floor(threadPx * 0.4)), inset = Math.floor(threadPx * 0.3);
    for (let e = 0; e < draft.ends; e++) ctx.fillRect(e * threadPx + inset, upTo * threadPx, bare, h - upTo * threadPx);
    ctx.globalAlpha = 1;
  }
  weftRows(kit, draft, colors, upTo, w);
  warpColumns(kit, draft, colors, upTo);
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
