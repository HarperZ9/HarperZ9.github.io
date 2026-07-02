// preview.js -- render a World to a static SVG (node export + browser fallback). Re-derives each
// layer's artifact from its organ + params and samples it: field layers as colored rects, form
// layers as dots. Zero-dep; the live WebGL render is the chamber's job, this is the portable proof.
import { sampleField } from "./expr.js";
import { getOrgan } from "./organ.js";

const palAt = (pal, t) => { t = Math.max(0, Math.min(1, t)); return pal[Math.min(pal.length - 1, Math.floor(t * (pal.length - 1) + 0.5))]; };

function fieldRects(layer, size) {
  const art = getOrgan(layer.organ).make(layer.params), n = 64, cell = size / n;
  const [lo, hi] = layer.render_program.value_range, pal = layer.render_program.uniforms.u_palette;
  const vals = sampleField(art.expr, n, art.t0 ?? 0);
  let body = "";
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
    const t = (vals[gy * n + gx] - lo) / ((hi - lo) || 1e-6);
    body += `<rect x="${(gx * cell).toFixed(1)}" y="${(gy * cell).toFixed(1)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="${palAt(pal, t)}"/>`;
  }
  return body;
}

function pointDots(layer, size) {
  const pts = getOrgan(layer.organ).make(layer.params).points, pal = layer.render_program.uniforms.u_palette;
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const p of pts) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
  const sp = Math.max(maxx - minx, maxy - miny, 1e-6), pad = size * 0.06, sc = (size - 2 * pad) / sp;
  const ox = (size - (maxx - minx) * sc) / 2 - minx * sc, oy = (size - (maxy - miny) * sc) / 2 - miny * sc;
  let body = "";
  for (let i = 0; i < pts.length; i++) {
    const col = pal[Math.floor(i / pts.length * pal.length) % pal.length];
    body += `<circle cx="${(ox + pts[i][0] * sc).toFixed(1)}" cy="${(oy + pts[i][1] * sc).toFixed(1)}" r="1.2" fill="${col}"/>`;
  }
  return body;
}

export function svgOfWorld(world, size = 640) {
  let body = "";
  for (const layer of [...world.layers].sort((a, b) => a.z - b.z)) {
    body += layer.render_program.target === "glsl-fragment" ? fieldRects(layer, size) : pointDots(layer, size);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#0b0e13"/>${body}</svg>`;
}
