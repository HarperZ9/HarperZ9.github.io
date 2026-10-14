// fractal-gradient.js: palettes a visitor brings, read into stops the fractal programs use.
//
// The programs take 2 to 16 stops, evenly spaced around a cyclic ramp. This reads a gradient from
// the forms people have them in, and resamples it in OKLab when it has more stops than that or
// stops at uneven positions:
//   - a list of colours: #rgb, #rrggbb or rgb(r, g, b), separated by anything;
//   - a CSS gradient: linear-gradient(90deg, #112233 0%, #445566 40%, ...), positions honoured;
//   - a Fractint .map file: one "r g b" line per entry (256 of them, usually);
//   - a GIMP .ggr gradient: its segments' end colours at their positions.
// Images are read by the Studio (sampleImage below takes the pixel row it was given).

import { srgbToLinear, srgbEncode, linearToOklab, oklabToLinear } from "./fractal-color.js";

export const MIN_STOPS = 2, MAX_STOPS = 16;


function hexToRgb(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** Resample positioned colours (pos in [0, 1], sRGB bytes) to `count` evenly spaced stops, in OKLab. */
export function resample(points, count) {
  const pts = points.slice().sort((a, b) => a.pos - b.pos);
  const labs = pts.map((p) => linearToOklab(srgbToLinear(p.rgb[0] / 255), srgbToLinear(p.rgb[1] / 255), srgbToLinear(p.rgb[2] / 255)));
  const out = [];
  const lin = [0, 0, 0];
  for (let k = 0; k < count; k++) {
    const t = count === 1 ? 0 : k / (count - 1);
    let j = 0;
    while (j < pts.length - 2 && pts[j + 1].pos < t) j++;
    const a = pts[j], b = pts[Math.min(j + 1, pts.length - 1)];
    const f = b.pos > a.pos ? Math.min(1, Math.max(0, (t - a.pos) / (b.pos - a.pos))) : 0;
    const la = labs[j], lb = labs[Math.min(j + 1, pts.length - 1)];
    oklabToLinear(la[0] + (lb[0] - la[0]) * f, la[1] + (lb[1] - la[1]) * f, la[2] + (lb[2] - la[2]) * f, lin);
    out.push(lin.map((v) => Math.round(srgbEncode(v) * 255)));
  }
  return out;
}

/**
 * Read a gradient from text. Returns { stops, format } with 2 to 16 sRGB byte triples, or throws
 * an Error with a plain reason.
 */
export function parseGradient(text) {
  const src = String(text || "").trim();
  if (!src) throw new Error("nothing to read");
  // GIMP gradient
  if (/^GIMP Gradient/.test(src)) {
    const lines = src.split(/\r?\n/).filter((l) => l.trim());
    const n = parseInt(lines.find((l) => /^\d+$/.test(l.trim())), 10);
    const segs = lines.filter((l) => /^\s*[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]/.test(l)).slice(0, n || 1000);
    const pts = [];
    for (const l of segs) {
      const v = l.trim().split(/\s+/).map(Number);
      pts.push({ pos: v[0], rgb: [v[3] * 255, v[4] * 255, v[5] * 255] });
      pts.push({ pos: v[2], rgb: [v[7] * 255, v[8] * 255, v[9] * 255] });
    }
    if (pts.length < 2) throw new Error("the GIMP gradient has no segments");
    return { stops: resample(pts, MAX_STOPS), format: "GIMP gradient" };
  }
  // Fractint .map: lines of three integers
  const mapLines = src.split(/\r?\n/).map((l) => l.trim().match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\b/)).filter(Boolean);
  if (mapLines.length >= 8 && mapLines.length >= src.split(/\r?\n/).filter((l) => l.trim()).length * 0.8) {
    const pts = mapLines.map((m, i) => ({ pos: i / (mapLines.length - 1), rgb: [+m[1], +m[2], +m[3]] }));
    return { stops: resample(pts, MAX_STOPS), format: "Fractint map" };
  }
  // CSS gradient or a colour list: colours in order, with a percentage after any of them
  const found = [];
  const re = /(#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\))(\s+(-?[\d.]+)%)?/gi;
  let m;
  while ((m = re.exec(src))) {
    let rgb;
    if (m[1][0] === "#") rgb = hexToRgb(m[1]);
    else { const c = /(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(m[1]); if (!c) continue; rgb = [+c[1], +c[2], +c[3]]; }
    found.push({ rgb: rgb.map((v) => Math.min(255, v)), pct: m[3] != null ? parseFloat(m[3]) / 100 : null });
  }
  if (found.length < MIN_STOPS) throw new Error("a gradient needs at least two colours (#rrggbb, rgb(...), a .map or a .ggr)");
  const positioned = found.some((f) => f.pct != null);
  if (!positioned && found.length <= MAX_STOPS) return { stops: found.map((f) => f.rgb), format: "colour list" };
  // Missing positions spread evenly between their neighbours, as CSS does.
  const pos = found.map((f) => f.pct);
  if (pos[0] == null) pos[0] = 0;
  if (pos[pos.length - 1] == null) pos[pos.length - 1] = 1;
  for (let i = 1; i < pos.length - 1; i++) {
    if (pos[i] != null) continue;
    let j = i; while (pos[j] == null) j++;
    for (let k = i; k < j; k++) pos[k] = pos[i - 1] + (pos[j] - pos[i - 1]) * (k - i + 1) / (j - i + 1);
    i = j;
  }
  const pts = found.map((f, i) => ({ pos: pos[i], rgb: f.rgb }));
  return { stops: resample(pts, Math.min(MAX_STOPS, Math.max(MIN_STOPS, found.length))), format: positioned ? "CSS gradient" : "colour list" };
}

/** Stops from a row of RGBA pixels (an image's middle row, read by the caller). */
export function sampleImage(row, count = MAX_STOPS) {
  const w = row.length / 4;
  const pts = [];
  for (let k = 0; k < 64; k++) {
    const x = Math.min(w - 1, Math.round(k / 63 * (w - 1)));
    pts.push({ pos: k / 63, rgb: [row[x * 4], row[x * 4 + 1], row[x * 4 + 2]] });
  }
  return resample(pts, count);
}
