// A Canvas 2D drawer for Motion frames: the same display list the WebGPU renderer
// draws (vector.mjs), on a CanvasRenderingContext2D, for browsers and devices with
// no WebGPU. One scene, two backends: a page draws with the GPU when it can and
// with this when it cannot.
//
//   import { drawFrame } from "./canvas2d.mjs";
//   const list = scene.frame(t, ctx);                     // { background, camera, items, post }
//   const stats = drawFrame(canvas.getContext("2d"), list, { width: canvas.width, height: canvas.height });
//
// What it draws exactly as the GPU path does: vector items (fills, strokes, joins,
// caps, dashes, clips, the nonzero and evenodd rules), linear, radial and image
// paints, opacity, additive blending, screen items, and the camera with depth
// parallax. What it approximates: blur and depth of field (a canvas blur filter),
// and the default vignette (a radial darkening). What it leaves out and counts in
// stats.skipped: particle systems, Threads and Worlds layers, tile maps, bloom,
// grain and the post passes (paint, film, tube, dither, pixel mode). Colours are
// display values blended in the canvas's own space, as the default finish does.
// One difference by design: background null clears to transparent here (for overlays and
// tests), where the GPU renderer falls back to its default ground.
import { DEFAULT_CAMERA, project } from "./vector.mjs";
import { isPaint } from "./paint.mjs";

const css = (c, opacity = 1) => {
  let r, g, b, a;
  if (typeof c === "string") {
    const h = c.replace("#", ""), n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    [r, g, b, a] = [n(0), n(2), n(4), h.length >= 8 ? n(6) : 1];
  } else [r, g, b, a] = [c[0], c[1], c[2], c[3] ?? 1];
  const q = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgba(${q(r)},${q(g)},${q(b)},${+(Math.max(0, Math.min(1, a * opacity))).toFixed(4)})`;
};
const visible = (c) => c != null && (isPaint(c) || (typeof c === "string" ? !/^#?[0-9a-f]{6}00$/i.test(c) : (c[3] ?? 1) > 0));

// Contours (scene units) as a Path2D in pixels: x * k + ox, y * k + oy.
export function toPath(shape, k, ox, oy, makePath = () => new Path2D()) {
  const p = makePath();
  for (const c of shape) {
    const a = c.pts;
    if (a.length < 4) continue;
    let px = a[0] * k + ox, py = a[1] * k + oy;
    p.moveTo(px, py);
    // Points closer than 1/100 px to the last one are dropped: a near-zero last segment
    // would otherwise turn a butt cap to its own, arbitrary direction.
    let drawn = 0;
    for (let i = 2; i < a.length; i += 2) {
      const x = a[i] * k + ox, y = a[i + 1] * k + oy;
      if (Math.abs(x - px) + Math.abs(y - py) < 0.01) continue;
      p.lineTo(x, y); px = x; py = y; drawn++;
    }
    if (!drawn) p.lineTo(px, py);                    // a dot: a round cap still draws it, as on the GPU
    if (c.closed) p.closePath();
  }
  return p;
}

// An image padded by PAD texels of its own edge, so a pattern clamps at its rect's edge as the
// GPU sampler does instead of fading to transparent. Cached per image.
const PAD = 2, padded = new WeakMap();
function clampImage(im) {
  let c = padded.get(im);
  if (c) return c;
  const iw = im.width || im.naturalWidth, ih = im.height || im.naturalHeight;
  const cv = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(iw + 2 * PAD, ih + 2 * PAD) : Object.assign(document.createElement("canvas"), { width: iw + 2 * PAD, height: ih + 2 * PAD });
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(im, 0, 0, iw, 1, PAD, 0, iw, PAD);                       // top edge
  g.drawImage(im, 0, ih - 1, iw, 1, PAD, ih + PAD, iw, PAD);           // bottom edge
  g.drawImage(im, 0, 0, 1, ih, 0, PAD, PAD, ih);                       // left edge
  g.drawImage(im, iw - 1, 0, 1, ih, iw + PAD, PAD, PAD, ih);           // right edge
  for (const [sx, sy, dx, dy] of [[0, 0, 0, 0], [iw - 1, 0, iw + PAD, 0], [0, ih - 1, 0, ih + PAD], [iw - 1, ih - 1, iw + PAD, ih + PAD]])
    g.drawImage(im, sx, sy, 1, 1, dx, dy, PAD, PAD);                   // corners
  g.drawImage(im, PAD, PAD);
  c = { canvas: cv, iw, ih };
  padded.set(im, c);
  return c;
}

// A paint (paint.mjs) as a canvas style in pixels: a gradient, or an image pattern placed on
// its rect and clamped to its edge texels for PAD texels beyond it.
function style(g, paint, k, ox, oy, images) {
  if (!isPaint(paint)) return css(paint);
  if (paint.image) {
    const im = images && images[paint.image];
    if (!im) throw new Error(`image paint: no image named ${paint.image}`);
    const [x, y, w, h] = paint.rect, { canvas, iw, ih } = clampImage(im);
    const sx = (w * k) / iw, sy = (h * k) / ih;
    const pat = g.createPattern(canvas, "no-repeat");
    pat.setTransform(new DOMMatrix([sx, 0, 0, sy, x * k + ox - PAD * sx, y * k + oy - PAD * sy]));
    return pat;
  }
  let grad = null;
  if (paint.linear) {
    const [x0, y0, x1, y1] = paint.linear;
    // Equal ends: the GPU evaluates t = 0 everywhere, so the paint is the first stop.
    if (x0 === x1 && y0 === y1) return css(((paint.stops || [])[0] || [0, [0, 0, 0, 0]])[1]);
    grad = g.createLinearGradient(x0 * k + ox, y0 * k + oy, x1 * k + ox, y1 * k + oy);
  } else if (paint.radial) {
    const [cx, cy, r] = paint.radial;
    grad = g.createRadialGradient(cx * k + ox, cy * k + oy, 0, cx * k + ox, cy * k + oy, Math.max(1e-3, r * k));
  } else throw new Error("a paint needs linear, radial or image");
  for (const [t, c] of (paint.stops || []).slice(0, 8)) grad.addColorStop(Math.max(0, Math.min(1, t)), css(c));
  return grad;
}

// Draw one item; returns false when it is culled (nothing to draw or behind the camera).
const FILTER = (g) => "filter" in g;
function paintItem(g, item, P, path, rule, images, stats, W, design) {
  const { k, ox, oy, blur, hw } = P;
  if (blur > 0.3) { if (FILTER(g)) g.filter = `blur(${(blur / 2).toFixed(2)}px)`; else if (stats) stats.skipped.blur = (stats.skipped.blur || 0) + 1; }
  if (visible(item.fill)) {
    g.fillStyle = style(g, item.fill, k, ox, oy, images);
    g.fill(path, rule);
  }
  if (visible(item.stroke) && hw > 0) {
    g.strokeStyle = style(g, item.stroke, k, ox, oy, images);
    g.lineWidth = 2 * hw;
    g.lineJoin = item.join || "round";
    g.lineCap = item.cap || "round";
    g.miterLimit = item.miterLimit ?? 4;
    // Dashes are in scene units on the GPU too (path.mjs dash, then the pixel mapping k),
    // also for a hairline, whose width alone is in pixels.
    g.setLineDash(item.dash ? item.dash.map((d) => d * k) : []);
    g.lineDashOffset = (item.dashOffset || 0) * k;
    g.stroke(path);
  }
}

// A scratch canvas the size of the frame, for clipped items. Canvas clip() is not antialiased
// in every browser (Chrome on Linux draws it hard), so a clip is applied by drawing the item
// on the scratch and keeping it where the clip shape, filled with antialiasing, covers it.
let scratch = null;
function layer(W, H) {
  if (typeof OffscreenCanvas === "undefined" && typeof document === "undefined") return null;
  if (!scratch || scratch.width !== W || scratch.height !== H)
    scratch = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), { width: W, height: H });
  return scratch.getContext("2d");
}

function drawItem(g, item, cam, W, H, design, images, makePath, stats) {
  const op = item.opacity ?? 1;
  const hasFill = visible(item.fill) && op > 0, hasStroke = visible(item.stroke) && op > 0;
  if (!hasFill && !hasStroke) return false;
  const P = project(item, cam, W, H, design);
  if (!P) return false;
  const path = toPath(item.shape, P.k, P.ox, P.oy, makePath);
  const rule = item.rule === "evenodd" ? "evenodd" : "nonzero";
  const clipRule = item.clipRule === "evenodd" ? "evenodd" : "nonzero";
  const clipPath = item.clip ? toPath(item.clip.map((c) => ({ pts: c.pts, closed: true })), P.k, P.ox, P.oy, makePath) : null;
  const s2 = clipPath ? layer(W, H) : null;
  g.save();
  try {
    g.globalAlpha = op;
    g.globalCompositeOperation = item.blend === "add" ? "lighter" : "source-over";
    if (clipPath && s2) {
      s2.save();
      try {
        s2.setTransform(1, 0, 0, 1, 0, 0);
        s2.globalAlpha = 1; s2.globalCompositeOperation = "source-over"; if (FILTER(s2)) s2.filter = "none";
        s2.clearRect(0, 0, W, H);
        paintItem(s2, item, P, path, rule, images, stats, W, design);
        if (FILTER(s2)) s2.filter = "none";
        s2.setLineDash([]);
        s2.globalCompositeOperation = "destination-in";
        s2.fillStyle = "#000";
        s2.fill(clipPath, clipRule);
      } finally { s2.restore(); }
      g.drawImage(s2.canvas, 0, 0);
    } else {
      if (clipPath) g.clip(clipPath, clipRule);                     // no scratch canvas here (Node)
      paintItem(g, item, P, path, rule, images, stats, W, design);
    }
  } finally { g.restore(); }
  return true;
}

// Draw a frame list on a 2D context of size width x height. Returns counts:
// { items, culled, skipped: { kind: n } }.
// images: name -> anything drawImage takes (an image, a canvas, an ImageBitmap).
export function drawFrame(g, list, { width, height, design = [1920, 1080], images = {}, vignette = true, makePath } = {}) {
  const W = width ?? g.canvas.width, H = height ?? g.canvas.height;
  const cam = { ...DEFAULT_CAMERA, ...(list.camera || {}) };
  const bg = list.background || [0.024, 0.024, 0.031];
  const stats = { items: 0, culled: 0, skipped: {} };
  g.save();
  try {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    if (FILTER(g)) g.filter = "none";
    g.shadowColor = "rgba(0,0,0,0)";
    if (list.background === null) g.clearRect(0, 0, W, H);     // null: a transparent ground (tests, overlays)
    else { g.fillStyle = css(bg); g.fillRect(0, 0, W, H); }
    for (const item of list.items || []) {
      if (!item) continue;
      if (!item.shape) { const kind = item.kind || "other"; stats.skipped[kind] = (stats.skipped[kind] || 0) + 1; continue; }
      if (drawItem(g, item, cam, W, H, design, images, makePath, stats)) stats.items++;
      else stats.culled++;
    }
    // The default finish multiplies by 1 - vignette * 1.6 * |uv - 0.5|^2, with uv in 0..1 on each
    // axis. In uv units the falloff is radial, so draw the gradient there: s = |uv - 0.5| runs to
    // about 0.707 at a corner, and black at alpha a multiplies by 1 - a.
    const v = vignette ? ({ vignette: 0.35, ...(list.post || {}) }).vignette : 0;
    if (v > 0) {
      g.setTransform(W, 0, 0, H, 0, 0);
      const R = Math.SQRT1_2, grad = g.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, R);
      for (let i = 0; i <= 12; i++) { const s = (i / 12) * R; grad.addColorStop(i / 12, `rgba(0,0,0,${Math.min(1, v * 1.6 * s * s).toFixed(4)})`); }
      g.fillStyle = grad;
      g.fillRect(0, 0, 1, 1);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    const post = list.post || {};
    if ((post.passes || []).length) stats.skipped.post = post.passes.length;
    if (post.colour) stats.skipped.colour = 1;
    if ((post.bloom ?? 0.45) > 0) stats.skipped.bloom = 1;
  } finally { g.restore(); }
  return stats;
}
