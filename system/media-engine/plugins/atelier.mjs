// system/media-engine/plugins/atelier.mjs
// The Studio's Atelier source, render half, as an engine plugin. The Atelier (atelier.js) still
// builds every drawing from its seed, runs the live studies' steps and the reveal timing, and owns
// the pointer play over the settled art; it asks this plugin for each frame it shows. Static: it
// draws only on request. drawStrokes and paintRich moved here from atelier.js unchanged, so a
// drawing's pixels do not depend on which file draws it.
//
// params: { mode = "lines", strokes, W, H, frac = 1, field = null, pens }
//   mode "lines"  draws the strokes, the first `frac` of their points (the reveal and live frames)
//   mode "rich"   the settled drawing: the field ghost, an additive halo, then the crisp line
//   W, H          the drawing size in CSS pixels; the host sets the canvas transform
//   pens          the palette's hex anchors, for the field ghost

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function hexToRgb(h) {
  h = h.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export const MARGIN = 0.055; // shared by canvas and SVG so they match

export function drawStrokes(ctx, W, H, strokes, frac) {
  ctx.clearRect(0, 0, W, H);
  var inner = Math.min(W, H) * (1 - 2 * MARGIN), offx = (W - inner) / 2, offy = (H - inner) / 2;
  var wScale = inner / 1000;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  var total = 0, ti; for (ti = 0; ti < strokes.length; ti++) total += strokes[ti].pts.length;
  var budget = frac >= 1 ? total : Math.floor(total * frac), spent = 0;
  for (var i = 0; i < strokes.length; i++) {
    var s = strokes[i], pts = s.pts, np = pts.length;
    if (spent >= budget) break;
    var take = np;
    if (spent + np > budget) take = budget - spent;
    spent += np;
    if (take < 2) continue;
    ctx.globalAlpha = s.op == null ? 1 : s.op;
    ctx.strokeStyle = s.col;
    ctx.lineWidth = Math.max(0.4, (s.w || 1) * wScale);
    ctx.beginPath();
    ctx.moveTo(offx + pts[0][0] * inner, offy + pts[0][1] * inner);
    for (var j = 1; j < take; j++) ctx.lineTo(offx + pts[j][0] * inner, offy + pts[j][1] * inner);
    if (s.close && take === np) ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ── the settled drawing: the same witnessed lines, rendered with depth ──────────
// paintRich draws ONLY to the screen canvas. It never touches the strokes the export uses, so the
// exported plot and its SHA-256 witness do not depend on it.
var GHOST_CACHE = {}, GHOST_GID = 0;
function fieldGhost(field, pens) {
  if (!field || !field.lum) return null;
  if (field._gid == null) field._gid = ++GHOST_GID;
  var key = field._gid + "|" + pens.join(",");
  if (GHOST_CACHE[key]) return GHOST_CACHE[key];
  var G = 168, off = document.createElement("canvas"); off.width = G; off.height = G;
  var g = off.getContext("2d"), img = g.createImageData(G, G), d = img.data;
  var lo = hexToRgb(pens[0]), hi = hexToRgb(pens[pens.length - 1]);
  for (var y = 0; y < G; y++) for (var x = 0; x < G; x++) {
    var l = clamp(field.lum((x + 0.5) / G, (y + 0.5) / G), 0, 1);
    var sh = l * l * (3 - 2 * l); // smoothstep, let highlights carry the form
    var i = (y * G + x) * 4;
    d[i] = lerp(lo[0], hi[0], sh); d[i + 1] = lerp(lo[1], hi[1], sh);
    d[i + 2] = lerp(lo[2], hi[2], sh); d[i + 3] = Math.round(255 * (0.15 + 0.85 * sh));
  }
  g.putImageData(img, 0, 0);
  GHOST_CACHE[key] = off; return off;
}

export function paintRich(ctx, W, H, strokes, field, pens) {
  ctx.clearRect(0, 0, W, H);
  var inner = Math.min(W, H) * (1 - 2 * MARGIN), offx = (W - inner) / 2, offy = (H - inner) / 2;
  var wScale = inner / 1000;
  // 1. perceived-field ghost: the specimen the algorithm actually read, faint behind the art
  var ghost = fieldGhost(field, pens);
  if (ghost) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.27;
    try { ctx.filter = "blur(2px)"; } catch (e) { /* no canvas filter: the ghost draws unblurred */ }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(ghost, offx, offy, inner, inner);
    ctx.restore();
  }
  // 2. the lines, twice: a wide additive bloom for luminous depth, then crisp ink on top
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  function pass(widthMul, alphaMul, comp) {
    ctx.globalCompositeOperation = comp;
    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i], pts = s.pts, np = pts.length; if (np < 2) continue;
      ctx.globalAlpha = clamp((s.op == null ? 1 : s.op) * alphaMul, 0, 1);
      ctx.strokeStyle = s.col;
      ctx.lineWidth = Math.max(0.35, (s.w || 1) * wScale * widthMul);
      ctx.beginPath();
      ctx.moveTo(offx + pts[0][0] * inner, offy + pts[0][1] * inner);
      for (var j = 1; j < np; j++) ctx.lineTo(offx + pts[j][0] * inner, offy + pts[j][1] * inner);
      if (s.close) ctx.closePath();
      ctx.stroke();
    }
  }
  pass(3.6, 0.16, "lighter");    // halo: overlaps build warmth, the organic glow
  pass(1.0, 1.0, "source-over"); // crisp pen line
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
}

export const atelier = {
  id: "atelier",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params = {} }) {
    let p = { mode: "lines", frac: 1, field: null, ...params };
    let armed = false;
    const inst = {
      backend: "canvas2d",
      static: true,
      frame() {
        if (!armed || !p.strokes || !p.W || !p.H) return;
        armed = false;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        if (p.mode === "rich") paintRich(ctx, p.W, p.H, p.strokes, p.field, p.pens || ["#e9e2d0"]);
        else drawStrokes(ctx, p.W, p.H, p.strokes, p.frac);
      },
      setParams(next) { p = { ...p, ...next }; armed = true; },
      readPixels() {
        const c = canvas.getContext("2d", { willReadFrequently: true });
        return new Uint8Array(c.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      },
      dispose() {},
    };
    return inst;
  },
};
