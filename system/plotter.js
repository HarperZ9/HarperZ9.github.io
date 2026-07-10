// plotter.js: plotter-ready line art from any canvas frame. Zero dependencies.
//
// The frame's luminance drives three classic pen idioms:
//   flow    - streamlines that follow iso-luminance directions, seeded densely
//             in dark regions (ink where the image is dark);
//   hatch   - tone-banded parallel hatching at two angles (crosshatch in the
//             darkest band);
//   contour - iso-luminance contour bands, a topographic read of the frame.
// Paths come back nearest-neighbour ordered (orderPaths) to cut pen-up travel,
// can be split across 2-3 pens by sampling the source color (separatePens),
// and export as plotter SVG (paper sizes, Inkscape pen layers) or as minimal
// pen-plotter G-code (toGcode). The raw polylines come back too so the page
// can REPLAY the plot stroke-by-stroke - watching it draw is half the pleasure.
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
  const target = Math.max(40, Math.min(5200, opts.lines || 700));
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

/* Marching-squares case table: bits 1,2,4,8 = TL,TR,BR,BL corner below the
   iso level; entries are flat [edgeA, edgeB, ...] pairs (0 top, 1 right,
   2 bottom, 3 left). Ambiguous cases 5 and 10 take the default pairing. */
const MS_CASES = [
  [], [3, 0], [0, 1], [3, 1],
  [1, 2], [3, 0, 1, 2], [0, 2], [3, 2],
  [2, 3], [0, 2], [0, 1, 2, 3], [1, 2],
  [3, 1], [0, 1], [3, 0], [],
];

function msPoint(edge, x, y, a, b, c, d, t) {
  const f = (v0, v1) => {
    const dv = v1 - v0;
    return Math.abs(dv) < 1e-9 ? 0.5 : (t - v0) / dv;
  };
  if (edge === 0) return [x + f(a, b), y];
  if (edge === 1) return [x + 1, y + f(b, c)];
  if (edge === 2) return [x + f(d, c), y + 1];
  return [x, y + f(a, d)];
}

function marchSegments(field, w, h, t) {
  const segs = [];
  for (let y = 0; y < h - 1; y += 1) {
    for (let x = 0; x < w - 1; x += 1) {
      const a = field[y * w + x], b = field[y * w + x + 1];
      const d = field[(y + 1) * w + x], c = field[(y + 1) * w + x + 1];
      const e = MS_CASES[(a < t ? 1 : 0) | (b < t ? 2 : 0) | (c < t ? 4 : 0) | (d < t ? 8 : 0)];
      for (let i = 0; i < e.length; i += 2) {
        segs.push([msPoint(e[i], x, y, a, b, c, d, t), msPoint(e[i + 1], x, y, a, b, c, d, t)]);
      }
    }
  }
  return segs;
}

/* Chain raw segments into polylines by matching quantized endpoints; walks
   forward from a chain's tail, then backward from its head. Deterministic:
   segments are visited and matched in emission order. */
function chainSegments(segs) {
  const key = (p) => Math.round(p[0] * 32) + "," + Math.round(p[1] * 32);
  const at = new Map();
  segs.forEach((s, i) => {
    for (const p of s) {
      const kk = key(p);
      if (!at.has(kk)) at.set(kk, []);
      at.get(kk).push(i);
    }
  });
  const used = new Uint8Array(segs.length);
  const takeFrom = (p) => {
    const list = at.get(key(p));
    if (list) {
      for (const i of list) {
        if (used[i]) continue;
        used[i] = 1;
        return key(segs[i][0]) === key(p) ? segs[i][1] : segs[i][0];
      }
    }
    return null;
  };
  const polys = [];
  for (let i = 0; i < segs.length; i += 1) {
    if (used[i]) continue;
    used[i] = 1;
    const chain = [segs[i][0], segs[i][1]];
    let nxt;
    while ((nxt = takeFrom(chain[chain.length - 1]))) chain.push(nxt);
    while ((nxt = takeFrom(chain[0]))) chain.unshift(nxt);
    polys.push(chain);
  }
  return polys;
}

/* Iso-luminance contour bands: marching squares at 4-6 luma thresholds,
   chained into polylines - the plot reads like a topographic map of the
   artwork. No randomness: the field alone decides, so it is deterministic. */
export function contourFromLuma(px, w, h, ch = 4, opts = {}) {
  const field = lumaField(px, w, h, ch);
  const levels = Math.max(4, Math.min(6, opts.levels || 5));
  const lines = [];
  for (let li = 0; li < levels; li += 1) {
    const t = 0.15 + (0.7 * li) / (levels - 1);
    for (const poly of chainSegments(marchSegments(field, w, h, t))) {
      if (poly.length > 2) lines.push(poly);
    }
  }
  return lines;
}

/* Nearest-neighbour path ordering with reversal allowed: start from the first
   path, then repeatedly jump to the unvisited path whose nearer endpoint is
   closest to the pen, reversing it when its far end is nearer. Cuts pen-up
   travel massively. O(n^2), comfortable to a few thousand paths. */
export function orderPaths(polylines) {
  const paths = (polylines || []).filter((p) => p && p.length > 1);
  if (paths.length <= 1) return paths;
  const d2 = (p, q) => (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]);
  const used = new Uint8Array(paths.length);
  const out = [paths[0]];
  used[0] = 1;
  let cur = paths[0][paths[0].length - 1];
  for (let step = 1; step < paths.length; step += 1) {
    let best = -1, bestD = Infinity, rev = false;
    for (let i = 0; i < paths.length; i += 1) {
      if (used[i]) continue;
      const p = paths[i];
      const ds = d2(cur, p[0]);
      const de = d2(cur, p[p.length - 1]);
      if (ds < bestD) { bestD = ds; best = i; rev = false; }
      if (de < bestD) { bestD = de; best = i; rev = true; }
    }
    used[best] = 1;
    const next = rev ? paths[best].slice().reverse() : paths[best];
    out.push(next);
    cur = next[next.length - 1];
  }
  return out;
}

function colorDist2(a, b) {
  return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]);
}

/* Average source color under a polyline's midpoints (25/50/75% samples). */
function lineColor(px, w, h, ch, line) {
  const n = line.length;
  const picks = n < 3
    ? [n >> 1]
    : [Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75)];
  let r = 0, g = 0, b = 0;
  for (const i of picks) {
    const xi = Math.max(0, Math.min(w - 1, Math.round(line[i][0])));
    const yi = Math.max(0, Math.min(h - 1, Math.round(line[i][1])));
    const p = (yi * w + xi) * ch;
    r += px[p]; g += px[p + 1]; b += px[p + 2];
  }
  return [r / picks.length, g / picks.length, b / picks.length];
}

function hexColor(c) {
  const two = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + two(c[0]) + two(c[1]) + two(c[2]);
}

/* Deterministic k-means seeds: darkest sample first, most-saturated second,
   then farthest-point for any remaining pens. Ties resolve to lowest index. */
function penSeeds(samples, k) {
  const luma = (c) => (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000;
  const sat = (c) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
  const seeds = [];
  let di = 0;
  for (let i = 1; i < samples.length; i += 1) if (luma(samples[i]) < luma(samples[di])) di = i;
  seeds.push(di);
  if (k > 1) {
    let si = -1, best = -Infinity;
    for (let i = 0; i < samples.length; i += 1) {
      if (i === di) continue;
      if (sat(samples[i]) > best) { best = sat(samples[i]); si = i; }
    }
    if (si >= 0) seeds.push(si);
  }
  while (seeds.length < k) {
    let fi = -1, far = -1;
    for (let i = 0; i < samples.length; i += 1) {
      if (seeds.includes(i)) continue;
      let near = Infinity;
      for (const s of seeds) near = Math.min(near, colorDist2(samples[i], samples[s]));
      if (near > far) { far = near; fi = i; }
    }
    if (fi < 0) break;
    seeds.push(fi);
  }
  return seeds;
}

/* Split one-ink polylines into penCount pens by clustering the source colors
   sampled under each line (k-means-lite, deterministic init). Returns
   [{ color: "#rrggbb" (cluster mean), polylines: [...] }]; every polyline is
   assigned to exactly one pen, so a 2-3 pen plot layers back into the
   artwork's palette. */
export function separatePens(px, w, h, ch = 4, polylines = [], penCount = 2) {
  const lines = polylines.filter((p) => p && p.length > 1);
  if (!lines.length) return [];
  const k = Math.max(1, Math.min(Math.round(penCount) || 2, lines.length, 6));
  const samples = lines.map((l) => lineColor(px, w, h, ch, l));
  const centroids = penSeeds(samples, k).map((i) => samples[i].slice());
  const assign = new Array(samples.length).fill(0);
  for (let iter = 0; iter < 16; iter += 1) {
    let moved = false;
    for (let i = 0; i < samples.length; i += 1) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < centroids.length; c += 1) {
        const d = colorDist2(samples[i], centroids[c]);
        if (d < bd) { bd = d; bi = c; }
      }
      if (assign[i] !== bi) { assign[i] = bi; moved = true; }
    }
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < samples.length; i += 1) {
      const s = sums[assign[i]];
      s[0] += samples[i][0]; s[1] += samples[i][1]; s[2] += samples[i][2]; s[3] += 1;
    }
    for (let c = 0; c < centroids.length; c += 1) {
      if (sums[c][3]) {
        centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
      }
    }
    if (!moved && iter > 0) break;
  }
  return centroids.map((c, ci) => ({
    color: hexColor(c),
    polylines: lines.filter((_, i) => assign[i] === ci),
  }));
}

/* Minimal pen-plotter G-code: G21/G90 header, pen-up travel (G0) to each path
   start, pen-down, G1 through the points, pen-up, return to origin. Servo
   mode toggles the pen with M3 S values; mode "z" uses Z moves instead. Y is
   flipped so the plot comes out upright on a Y-up machine. Deterministic:
   fixed 3-decimal coordinates. */
export function toGcode(polylines, srcW, srcH, opts = {}) {
  // Provenance rides in the file: the seed and style reproduce this plot.
  const provenance = "; telos plot - style " + (opts.style || "flow") + ", seed " + (opts.seed == null ? "live" : opts.seed);
  const widthMm = opts.widthMm || 190;
  const k = widthMm / Math.max(1, srcW);
  const feed = Math.round(opts.feed || 2500);
  const zMode = opts.mode === "z";
  const up = zMode
    ? "G0 Z" + Number(opts.zUp == null ? 5 : opts.zUp).toFixed(3)
    : "M3 S" + Math.round(opts.penUp || 40);
  const down = zMode
    ? "G1 Z" + Number(opts.zDown == null ? 0 : opts.zDown).toFixed(3) + " F" + feed
    : "M3 S" + Math.round(opts.penDown || 90);
  const fx = (x) => (x * k).toFixed(3);
  const fy = (y) => ((srcH - y) * k).toFixed(3);
  const out = [
    "; telos plotter gcode",
    provenance,
    "; source " + srcW + "x" + srcH + " px -> " + widthMm + " mm wide",
    "G21",
    "G90",
    up,
  ];
  for (const line of polylines) {
    if (!line || line.length < 2) continue;
    out.push("G0 X" + fx(line[0][0]) + " Y" + fy(line[0][1]));
    out.push(down);
    out.push("G1 X" + fx(line[1][0]) + " Y" + fy(line[1][1]) + " F" + feed);
    for (let i = 2; i < line.length; i += 1) {
      out.push("G1 X" + fx(line[i][0]) + " Y" + fy(line[i][1]));
    }
    out.push(up);
  }
  if (!zMode) out.push("M5");
  out.push("G0 X0.000 Y0.000");
  return out.join("\n") + "\n";
}

const PAPER_SIZES = { a4: [1122, 793], a5: [793, 559], square: [800, 800] };

/* Plotter SVG. Polylines are in source pixel space, scaled uniformly.
   opts.paper ("a4" | "a5" | "square") letterboxes the art inside a 6% margin;
   opts.pens (separatePens output) emits one labelled Inkscape layer group per
   pen so plotting workflows can split layers by color. Without pens the
   output stays a single stroke group, as before. */
export function toPlotterSVG(polylines, srcW, srcH, opts = {}) {
  const paper = PAPER_SIZES[opts.paper];
  let outW, outH, k, ox = 0, oy = 0;
  if (paper) {
    outW = paper[0]; outH = paper[1];
    const m = Math.min(outW, outH) * 0.06;
    k = Math.min((outW - 2 * m) / srcW, (outH - 2 * m) / srcH);
    ox = (outW - srcW * k) / 2;
    oy = (outH - srcH * k) / 2;
  } else {
    outW = opts.width || 1480;
    outH = Math.round(outW * (srcH / srcW));
    k = outW / srcW;
  }
  const strokeWidth = opts.strokeWidth || 1.4;
  const fmtPt = ([x, y]) => (x * k + ox).toFixed(1) + "," + (y * k + oy).toFixed(1);
  const pathsOf = (lines) => lines
    .filter((line) => line && line.length > 1)
    .map((line) => '<polyline points="' + line.map(fmtPt).join(" ") + '"/>')
    .join("\n    ");
  const groupOf = (lines, stroke, extra) => '<g fill="none" stroke="' + stroke
    + '" stroke-width="' + strokeWidth + '" stroke-linecap="round" stroke-linejoin="round"'
    + (extra || "") + ">\n    " + pathsOf(lines) + "\n  </g>";
  const pens = Array.isArray(opts.pens) && opts.pens.length ? opts.pens : null;
  const body = pens
    ? pens.map((pen, i) => groupOf(pen.polylines, pen.color,
      ' inkscape:groupmode="layer" inkscape:label="pen ' + (i + 1) + " " + pen.color + '"')).join("\n  ")
    : groupOf(polylines, opts.stroke || "#111111", "");
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<!-- plotter-ready: no fills, round caps. Drawn by the Telos engine; '
    + 'style ' + (opts.style || "flow") + ", seed " + (opts.seed == null ? "live" : opts.seed) + ". -->\n"
    + '<svg xmlns="http://www.w3.org/2000/svg"'
    + (pens ? ' xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"' : "")
    + ' width="' + outW + '" height="' + outH + '" viewBox="0 0 ' + outW + " " + outH + '">\n  '
    + body
    + "\n</svg>\n";
}

/* One call from a live canvas to a downloadable plot. Reads a <=240px-wide
   downsample (plot geometry does not need archival resolution), builds the
   polylines (styles: "flow" | "hatch" | "contour"), orders them for least
   pen-up travel, and returns { svg, polylines, srcW, srcH, stats }. Pass
   opts.pens (2-3) to also cluster the plot into color pens: the result gains
   .pens (separatePens output) and the SVG gains one layer group per pen.
   opts.paper flows through to toPlotterSVG. */
/* Detail tiers: how much of the frame the pen is allowed to know.
   standard reads a 220px field; fine 420; ultra 640. Line budgets, walk
   lengths, hatch spacing, and contour levels scale with the tier, and
   opts.density ("airy" | "full" | "dense") multiplies the stroke budget on
   top. Explicit opts (lines/steps/spacing/levels/sampleWidth) still win. */
export const PLOT_DETAIL = {
  standard: { sampleWidth: 220, lines: 700, steps: 110, spacing: 4, levels: 5 },
  fine: { sampleWidth: 420, lines: 1500, steps: 150, spacing: 3, levels: 7 },
  ultra: { sampleWidth: 640, lines: 2600, steps: 190, spacing: 2.4, levels: 9 },
};
const PLOT_DENSITY = { airy: 0.6, full: 1, dense: 1.55 };

export function plotCanvas(canvas, opts = {}) {
  const style = opts.style === "hatch" || opts.style === "contour" ? opts.style : "flow";
  const tier = PLOT_DETAIL[opts.detail] || PLOT_DETAIL.standard;
  const dens = PLOT_DENSITY[opts.density] || 1;
  opts = {
    sampleWidth: tier.sampleWidth,
    lines: Math.round(tier.lines * dens),
    steps: tier.steps,
    spacing: tier.spacing / Math.sqrt(dens),
    levels: tier.levels,
    ...opts,
  };
  const dw = Math.max(16, Math.min(720, opts.sampleWidth || 220));
  const dh = Math.max(16, Math.round(dw * (canvas.height / Math.max(1, canvas.width))));
  const doc = (typeof document !== "undefined") ? document : null;
  const scratch = opts.scratch || (doc ? doc.createElement("canvas") : null);
  if (!scratch) throw new Error("plotCanvas needs a document or an opts.scratch canvas");
  scratch.width = dw; scratch.height = dh;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, dw, dh);
  ctx.drawImage(canvas, 0, 0, dw, dh);
  const px = ctx.getImageData(0, 0, dw, dh).data;
  const raw = style === "hatch" ? hatchFromLuma(px, dw, dh, 4, opts)
    : style === "contour" ? contourFromLuma(px, dw, dh, 4, opts)
      : flowlinesFromLuma(px, dw, dh, 4, opts);
  const polylines = orderPaths(raw);
  const penCount = typeof opts.pens === "number" ? Math.round(opts.pens) : 0;
  const pens = penCount > 1 ? separatePens(px, dw, dh, 4, polylines, penCount) : null;
  const svg = toPlotterSVG(polylines, dw, dh, { ...opts, style, pens });
  let points = 0;
  for (const line of polylines) points += line.length;
  const out = { svg, polylines, srcW: dw, srcH: dh, stats: { lines: polylines.length, points } };
  if (pens) out.pens = pens;
  return out;
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
