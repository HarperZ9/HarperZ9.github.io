// path-render.js: drawing for the road and its stops, on canvases. The numbers come from road.mjs and stop.mjs.
//
//   roadPainter(canvas)  the road ahead, after Bardou's forward garden walk: a low grid of blocks that the walk
//                        pushes outward from the vanishing point and smears, so the ground ahead reads as liquid.
//                        Measured on his clip (reference library, st-benjaminbardou): flow speed 0.22 of the
//                        width a second, coherence 0.26, a dominant period of 0.021 of the width, soft edges.
//                        Ours runs calmer: the walk's speed comes from the visitor's own scroll.
//   drawRibbon(ctx, ...) the unravel move: a ribbon of number tiles, curled, laying itself flat.
//   drawMosaic(ctx, ...) the mosaic move: flat tiles over a picture; each tile turns over whole to show it.
import { ribbon, tileSide, tileTurn, turnFace, seededRank } from "./stop.mjs";

const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// ---------------- the road ----------------
export function roadPainter(canvas, { cols = 176 } = {}) {
  const x = canvas.getContext("2d", { colorSpace: "display-p3" });
  const W = cols, H = Math.round(cols * 0.6), low = new OffscreenCanvas(W, H), l = low.getContext("2d"), fresh = new OffscreenCanvas(W, H), f = fresh.getContext("2d");
  let lastS = null, seed = 7, first = true;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  function paintGround(c, road, s, d) {  // a road to the horizon between banks of blocks in the district's inks
    const hz = H * 0.34, next = Math.ceil(s + 1e-6), banks = [d.accent, d.ink, d.wall, d.accent];
    c.globalAlpha = 1; c.fillStyle = d.wall; c.fillRect(0, 0, W, H);
    const sky = c.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, d.ink); sky.addColorStop(1, d.wall); c.globalAlpha = 0.45; c.fillStyle = sky; c.fillRect(0, 0, W, hz);
    for (let y = Math.floor(hz); y < H; y++) {
      const depth = (H - y) / (H - hz), z = s + depth * 2.4, cen = road.centre(z), half = (1 - depth) * 0.36 + 0.015, cx = W * (0.5 + cen.x * (1 - depth * 0.5));
      // the banks: blocks that grow as they come near, coloured by a slow pattern along the road
      const bw = Math.max(1, Math.round((1 - depth) * 7 + 1));
      for (let x = 0; x < W; x += bw) { if (Math.abs(x - cx) < half * W) continue; let hsh = (Math.floor(z * 9) * 73856093) ^ (Math.floor(x / bw) * 19349663); hsh = (hsh ^ (hsh >>> 13)) >>> 0; const k = hsh & 3; c.globalAlpha = 0.06 + 0.16 * (1 - depth) * ((hsh >>> 4) % 3) / 2; c.fillStyle = banks[k]; c.fillRect(x, y, bw, 1); }
      // the road: pale surface, inked edges, a centre line in beats
      c.globalAlpha = 0.85; c.fillStyle = d.wall; c.fillRect(cx - half * W, y, half * W * 2, 1);
      c.globalAlpha = 0.5 + 0.4 * (1 - depth); c.fillStyle = d.ink; c.fillRect(cx - half * W, y, 1, 1); c.fillRect(cx + half * W - 1, y, 1, 1);
      if (Math.floor(z * 8) % 2 === 0) { c.globalAlpha = 0.35; c.fillRect(cx, y, 1, 1); }
      if (Math.abs(z - next) < 0.025) { c.globalAlpha = 0.9; c.fillStyle = d.accent; c.fillRect(cx - half * W * 0.5, y - 1, half * W, 2); }
    }
    c.globalAlpha = 1;
  }
  return {
    draw(road, s, district, { still = false, drift = 0 } = {}) {
      const ds = lastS == null ? 0 : s - lastS; lastS = s;
      paintGround(f, road, s, district);
      const push = still ? 0 : Math.min(0.08, Math.abs(ds) * 0.6 + drift);
      if (first || push <= 0) { l.globalAlpha = 1; l.drawImage(fresh, 0, 0); first = false; }
      else {
        // the walk: the last frame pushed outward from the vanishing point by how far the visitor moved
        const k = 1 + push, vx = W * (0.5 + road.centre(s + 1).x * 0.4), vy = H * 0.36;
        l.globalAlpha = 1; l.drawImage(low, vx - vx * k, vy - vy * k, W * k, H * k);
        // smear: a few blocks slide outward along the flow (coherence stays low, as measured)
        for (let i = 0; i < 6; i++) { const bw = 2 + Math.floor(rnd() * 5), bh = 1 + Math.floor(rnd() * 3), sx = Math.floor(rnd() * (W - bw)), sy = Math.floor(H * 0.36 + rnd() * (H * 0.6 - bh)); l.drawImage(low, sx, sy, bw, bh, sx + Math.sign(sx - vx) * (1 + push * 20), sy + 1, bw, bh); }
        l.globalAlpha = 0.25; l.drawImage(fresh, 0, 0); l.globalAlpha = 1;  // the true road keeps showing through
      }
      x.imageSmoothingEnabled = false;  // the blocks stay blocks
      x.clearRect(0, 0, canvas.width, canvas.height); x.drawImage(low, 0, 0, canvas.width, canvas.height);
    },
  };
}

// ---------------- unravel ----------------
// n tiles carrying `digits` (one real number each), laid from the left as u goes 0..1. Returns the screen
// centres of tiles that are flat, so the caller can drop ink where each lands.
export function drawRibbon(ctx, { n, u, digits, inks, ink, w, h, face = "Conso, ui-monospace, monospace" }) {
  ctx.clearRect(0, 0, w, h);
  const side = Math.min(w / (n + 3), h * 0.22), y0 = h * 0.42, x0 = side * 1.2, flat = Math.min(n, Math.floor(u * n + 1e-6)), out = [];
  // the laid tiles, left to right, each carrying its digit
  for (let i = 0; i < flat; i++) {
    const cx = x0 + i * side + side / 2;
    ctx.fillStyle = inks[i % inks.length]; ctx.globalAlpha = 0.92; ctx.fillRect(cx - side / 2 + 1, y0 - side / 2 + 1, side - 2, side - 2);
    ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.font = `400 ${Math.round(side * 0.42)}px ${face}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(digits[i % digits.length]), cx, y0 + 1);
    out.push({ i, x: cx, y: y0, side });
  }
  // the rest, still wound: a roll seen end on, one ring per tile, the outermost ring the next tile to lay
  const left = n - flat;
  if (left > 0) {
    const ring = side * 0.11, R = side * 0.32 + left * ring, cx = x0 + flat * side + R * 0.9, cy = y0 + side / 2 - R;
    for (let k = left - 1; k >= 0; k--) { const i = flat + (left - 1 - k); ctx.strokeStyle = inks[i % inks.length]; ctx.lineWidth = ring * 0.92; ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(cx, cy, side * 0.32 + (k + 0.5) * ring, 0, 6.2832); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(cx, cy, side * 0.08, 0, 6.2832); ctx.fill();
    // the free end, peeling off the bottom of the roll toward the laid run
    ctx.strokeStyle = inks[flat % inks.length]; ctx.lineWidth = side * 0.9; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(cx - R * 0.2, cy + R); ctx.lineTo(x0 + flat * side + side * 0.1, y0); ctx.stroke(); ctx.globalAlpha = 1;
  }
  return out;
}

// ---------------- mosaic ----------------
// A cache of the picture's mean colour per tile, per tile size, from a small copy of the picture.
export function mosaicSource(img, w, h) {
  const c = new OffscreenCanvas(w, h), x = c.getContext("2d", { willReadFrequently: true }), s = Math.max(w / img.width, h / img.height);
  x.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
  const data = x.getImageData(0, 0, w, h).data, means = new Map();
  return {
    canvas: c,
    mean(side) {
      if (means.has(side)) return means.get(side);
      const cols = Math.ceil(w / side), rows = Math.ceil(h / side), m = new Array(cols * rows);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = j * side; y < Math.min(h, (j + 1) * side); y += 2) for (let xx = i * side; xx < Math.min(w, (i + 1) * side); xx += 2) { const k = 4 * (y * w + xx); r += data[k]; g += data[k + 1]; b += data[k + 2]; n++; }
        m[j * cols + i] = n ? `rgb(${(r / n) | 0},${(g / n) | 0},${(b / n) | 0})` : "#000";
      }
      const v = { cols, rows, m }; means.set(side, v); return v;
    },
  };
}
// Draw the stop's picture at grammar state g: tiles of side tileSide(g.tileLevel), each flat (its mean colour,
// the mosaic) until its turn comes, then turned over whole to the picture. Tiles never blend two faces.
// rank(i, j, cols, rows) orders the turning (0 first .. 1 last); the default turns from the road's side outward.
export function drawMosaic(ctx, src, g, { w, h, ground, seed = 1, base = 64, rank = null }) {
  if (g.settled) { ctx.drawImage(src.canvas, 0, 0, w, h); return; }
  const side = tileSide(g.tileLevel, base), { cols, rows, m } = src.mean(side);
  ctx.fillStyle = ground; ctx.fillRect(0, 0, w, h);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const turn = tileTurn(g.reveal, rank ? rank(i, j, cols, rows) : seededRank(i, j, cols, rows, seed)), { width, face } = turnFace(turn);
    const x0 = i * side, y0 = j * side, done = turn >= 1, tw = done ? side : Math.max(0, side * width - 1), dx = x0 + (side - tw) / 2;
    if (tw <= 0) continue;
    if (face === "old") { ctx.fillStyle = m[j * cols + i]; ctx.fillRect(dx, y0, tw, side - 1); }
    else ctx.drawImage(src.canvas, x0, y0, side, side, dx, y0, tw, done ? side : side - 1);
  }
}
export { hexRGB };
