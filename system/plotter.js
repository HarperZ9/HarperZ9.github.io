// plotter.js: plotter-ready line art from any canvas frame. Zero dependencies.
//
// The frame's luminance drives two classic pen idioms:
//   flow  - streamlines that follow iso-luminance directions, seeded densely
//           in dark regions (ink where the image is dark);
//   hatch - tone-banded parallel hatching at two angles (crosshatch in the
//           darkest band).
// Output is a single-stroke SVG (no fills, round caps) that a pen plotter or
// vpype pipeline consumes directly, plus the raw polylines so the page can
// REPLAY the plot stroke-by-stroke - watching it draw is half the pleasure.
// Deterministic per (frame, seed): same pixels, same seed, same plot.

function hash32(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lumaField(px, w, h, ch = 4) {
  const out = new Float32Array(w * h);
  for (let i = 0, p = 0; i < out.length; i += 1, p += ch) {
    out[i] = (px[p] * 299 + px[p + 1] * 587 + px[p + 2] * 114) / 255000; // 0..1
  }
  return out;
}

function sampleLuma(field, w, h, x, y) {
  const xi = Math.max(0, Math.min(w - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(h - 1, Math.round(y)));
  return field[yi * w + xi];
}

function gradient(field, w, h, x, y) {
  const e = 1.5;
  const gx = sampleLuma(field, w, h, x + e, y) - sampleLuma(field, w, h, x - e, y);
  const gy = sampleLuma(field, w, h, x, y + e) - sampleLuma(field, w, h, x, y - e);
  return { gx, gy };
}

/* Streamlines along iso-luminance contours: at each step move PERPENDICULAR
   to the luminance gradient, so lines wrap around forms the way an engraver
   would carve them. Dark regions get more and longer lines. */
export function flowlinesFromLuma(px, w, h, ch = 4, opts = {}) {
  const field = lumaField(px, w, h, ch);
  const rnd = mulberry(hash32(opts.seed == null ? "plot" : opts.seed));
  const target = Math.max(40, Math.min(2200, opts.lines || 700));
  const maxSteps = Math.max(8, Math.min(400, opts.steps || 110));
  const step = opts.step || 1.6;
  const lines = [];
  let attempts = 0;
  while (lines.length < target && attempts < target * 14) {
    attempts += 1;
    const x0 = rnd() * (w - 2) + 1;
    const y0 = rnd() * (h - 2) + 1;
    const l = sampleLuma(field, w, h, x0, y0);
    // Ink probability rises as luminance falls; near-white is left as paper.
    if (rnd() < l * l) continue;
    const dir = rnd() < 0.5 ? 1 : -1;
    const line = [[x0, y0]];
    let x = x0, y = y0;
    const steps = Math.round(maxSteps * (0.35 + (1 - l) * 0.65));
    for (let s = 0; s < steps; s += 1) {
      const { gx, gy } = gradient(field, w, h, x, y);
      const mag = Math.hypot(gx, gy);
      let tx, ty;
      if (mag < 1e-5) {
        // Flat region: drift on a seed-stable angle so lines stay calm, not jittery.
        const a = (hash32(opts.seed + ":" + lines.length) % 628) / 100;
        tx = Math.cos(a); ty = Math.sin(a);
      } else {
        tx = (-gy / mag) * dir; ty = (gx / mag) * dir;
      }
      x += tx * step; y += ty * step;
      if (x < 1 || y < 1 || x > w - 2 || y > h - 2) break;
      // Stop when the pen wanders into paper-bright territory.
      if (sampleLuma(field, w, h, x, y) > 0.92) break;
      line.push([x, y]);
    }
    if (line.length > 4) lines.push(line);
  }
  return lines;
}

/* Tone-banded hatching: three bands of parallel lines; the darkest band gets
   a second pass at the crossing angle. Segments are clipped to their band. */
export function hatchFromLuma(px, w, h, ch = 4, opts = {}) {
  const field = lumaField(px, w, h, ch);
  const spacing = Math.max(2, opts.spacing || 4);
  const bands = [
    { below: 0.72, angle: (opts.angle == null ? 38 : opts.angle) * Math.PI / 180 },
    { below: 0.45, angle: ((opts.angle == null ? 38 : opts.angle) + 90) * Math.PI / 180 },
    { below: 0.2, angle: ((opts.angle == null ? 38 : opts.angle) + 45) * Math.PI / 180 },
  ];
  const lines = [];
  for (const band of bands) {
    const ca = Math.cos(band.angle), sa = Math.sin(band.angle);
    const diag = Math.hypot(w, h);
    for (let o = -diag; o < diag; o += spacing) {
      let run = null;
      for (let t = 0; t < diag; t += 1) {
        const x = w / 2 + ca * (t - diag / 2) - sa * o;
        const y = h / 2 + sa * (t - diag / 2) + ca * o;
        const inside = x >= 0 && y >= 0 && x < w && y < h && sampleLuma(field, w, h, x, y) < band.below;
        if (inside) {
          if (!run) run = [[x, y]];
          else run.push([x, y]);
        } else if (run) {
          if (run.length > 3) lines.push([run[0], run[run.length - 1]]);
          run = null;
        }
      }
      if (run && run.length > 3) lines.push([run[0], run[run.length - 1]]);
    }
  }
  return lines;
}

/* Single-stroke plotter SVG. Width/height in output units; polylines are in
   source pixel space and scaled uniformly. */
export function toPlotterSVG(polylines, srcW, srcH, opts = {}) {
  const outW = opts.width || 1480;
  const outH = Math.round(outW * (srcH / srcW));
  const k = outW / srcW;
  const stroke = opts.stroke || "#111111";
  const strokeWidth = opts.strokeWidth || 1.4;
  const fmtPt = ([x, y]) => (x * k).toFixed(1) + "," + (y * k).toFixed(1);
  const paths = polylines
    .filter((line) => line && line.length > 1)
    .map((line) => '<polyline points="' + line.map(fmtPt).join(" ") + '"/>')
    .join("\n    ");
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<!-- plotter-ready: single stroke, no fills. Drawn by the Telos engine; '
    + 'style ' + (opts.style || "flow") + ", seed " + (opts.seed == null ? "live" : opts.seed) + ". -->\n"
    + '<svg xmlns="http://www.w3.org/2000/svg" width="' + outW + '" height="' + outH + '" viewBox="0 0 ' + outW + " " + outH + '">\n'
    + '  <g fill="none" stroke="' + stroke + '" stroke-width="' + strokeWidth + '" stroke-linecap="round" stroke-linejoin="round">\n    '
    + paths
    + "\n  </g>\n</svg>\n";
}

/* One call from a live canvas to a downloadable plot. Reads a <=240px-wide
   downsample (plot geometry does not need archival resolution), builds the
   polylines, and returns { svg, polylines, srcW, srcH, stats }. */
export function plotCanvas(canvas, opts = {}) {
  const style = opts.style === "hatch" ? "hatch" : "flow";
  const dw = Math.max(16, Math.min(240, opts.sampleWidth || 220));
  const dh = Math.max(16, Math.round(dw * (canvas.height / Math.max(1, canvas.width))));
  const doc = (typeof document !== "undefined") ? document : null;
  const scratch = opts.scratch || (doc ? doc.createElement("canvas") : null);
  if (!scratch) throw new Error("plotCanvas needs a document or an opts.scratch canvas");
  scratch.width = dw; scratch.height = dh;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, dw, dh);
  ctx.drawImage(canvas, 0, 0, dw, dh);
  const px = ctx.getImageData(0, 0, dw, dh).data;
  const polylines = style === "hatch"
    ? hatchFromLuma(px, dw, dh, 4, opts)
    : flowlinesFromLuma(px, dw, dh, 4, opts);
  const svg = toPlotterSVG(polylines, dw, dh, { ...opts, style });
  let points = 0;
  for (const line of polylines) points += line.length;
  return { svg, polylines, srcW: dw, srcH: dh, stats: { lines: polylines.length, points } };
}

/* Watch it plot: replay polylines stroke-by-stroke on a 2d canvas, in pen
   order, via rAF. Returns a stop() handle. Reduced motion draws instantly. */
export function replayPlot(canvas, polylines, srcW, srcH, opts = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { stop() {} };
  const k = Math.min(canvas.width / srcW, canvas.height / srcH);
  const stroke = opts.stroke || "rgba(230,236,228,0.85)";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (opts.clear !== false) {
    ctx.fillStyle = opts.paper || "#101015";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = opts.strokeWidth || 1.1;
  ctx.lineCap = "round";
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let li = 0, pi = 1, raf = 0, stopped = false;
  const drawLine = (line) => {
    ctx.beginPath();
    ctx.moveTo(line[0][0] * k, line[0][1] * k);
    for (let i = 1; i < line.length; i += 1) ctx.lineTo(line[i][0] * k, line[i][1] * k);
    ctx.stroke();
  };
  if (reduce || opts.instant) {
    for (const line of polylines) drawLine(line);
    ctx.restore();
    if (opts.onDone) opts.onDone();
    return { stop() {} };
  }
  const perFrame = Math.max(24, Math.round((opts.speed || 1) * 90)); // points per frame
  const tick = () => {
    if (stopped) return;
    let budget = perFrame;
    while (budget > 0 && li < polylines.length) {
      const line = polylines[li];
      const to = Math.min(line.length - 1, pi + budget);
      ctx.beginPath();
      ctx.moveTo(line[pi - 1][0] * k, line[pi - 1][1] * k);
      for (let i = pi; i <= to; i += 1) ctx.lineTo(line[i][0] * k, line[i][1] * k);
      ctx.stroke();
      budget -= to - pi + 1;
      pi = to + 1;
      if (pi >= line.length) { li += 1; pi = 1; }
    }
    if (li < polylines.length) raf = requestAnimationFrame(tick);
    else { ctx.restore(); if (opts.onDone) opts.onDone(); }
  };
  raf = requestAnimationFrame(tick);
  return { stop() { stopped = true; if (raf) cancelAnimationFrame(raf); ctx.restore(); } };
}
