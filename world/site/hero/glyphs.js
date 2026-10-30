// glyphs.js: the name as glass rods. The words are set on a 2D canvas in the page's display face, the inside of
// each letter gets its exact Euclidean distance to the edge (Felzenszwalb and Huttenlocher's two-pass transform),
// and the height is a round section, h = sqrt(1 - (1 - d/r)^2), with r half the stroke, so each stroke is a rod.
// Returns half-float RG texels (height, coverage), the lamp's x (behind the bowl of the "p", where the old art had
// its sun) and where the waterline meets the glass.
const INF = 1e20;
function edt1(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
export function distanceInside(mask, w, h) {   // squared distance from each inside pixel to the nearest outside one
  const g = new Float64Array(w * h), n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n);
  const v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let i = 0; i < w * h; i++) g[i] = mask[i] ? INF : 0;
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; edt1(f, w, d, v, z); for (let x = 0; x < w; x++) g[y * w + x] = d[x]; }
  return g;
}
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
export function half(x) {
  f32[0] = x; const b = u32[0], s = (b >>> 16) & 0x8000, e = ((b >>> 23) & 0xff) - 112, m = b & 0x7fffff;
  if (e <= 0) return s; if (e >= 31) return s | 0x7c00;
  return s | (e << 10) | (m >>> 13);
}
// lines: the name split for the frame; waterUV: the screen height (from the bottom) where water meets the glass
export function buildGlyphs({ w, h, face, lines, waterUV }) {
  const c = new OffscreenCanvas(w, h), x = c.getContext("2d", { willReadFrequently: true });
  const lead = 1.08, probe = 100;
  x.font = `700 ${probe}px ${face}`;
  const widest = Math.max(...lines.map((l) => x.measureText(l).width));
  const size = Math.min((w * 0.9) / widest * probe, (h * 0.62) / (lines.length * lead));
  x.font = `700 ${size}px ${face}`; x.textBaseline = "alphabetic"; x.fillStyle = "#fff";
  const base = h * (1 - waterUV) - size * 0.06;   // the last line stands just above the waterline
  let lampX = 0.58;
  lines.forEach((line, k) => {
    const y = base - (lines.length - 1 - k) * size * lead, lw = x.measureText(line).width, x0 = (w - lw) / 2;
    x.fillText(line, x0, y);
    const p = line.indexOf("p");
    if (p >= 0) lampX = (x0 + x.measureText(line.slice(0, p)).width + x.measureText("p").width * 0.55) / w;
  });
  const img = x.getImageData(0, 0, w, h).data, mask = new Uint8Array(w * h), cov = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { cov[i] = img[i * 4 + 3] / 255; mask[i] = img[i * 4 + 3] > 127 ? 1 : 0; }
  const d2 = distanceInside(mask, w, h);
  let dmax = 0; for (let i = 0; i < w * h; i++) if (d2[i] > dmax) dmax = d2[i];
  const r = Math.max(2, Math.sqrt(dmax) * 0.92);   // half the boldest stroke: every stroke rounds into a rod
  const out = new Uint16Array(w * h * 2);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const i = y * w + xx, j = (h - 1 - y) * w + xx;   // flip: texture rows run bottom up
    const t = Math.min(1, (Math.sqrt(d2[i]) + cov[i] - 0.5) / r), hh = t > 0 ? Math.sqrt(1 - (1 - t) * (1 - t)) : 0;
    out[j * 2] = half(hh); out[j * 2 + 1] = half(cov[i]);
  }
  return { data: out, lampX, size, rod: r };
}
