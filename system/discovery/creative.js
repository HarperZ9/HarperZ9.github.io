// creative.js: the engine's creative organ - deterministic, OWNED generative art. Parametric generators
// produce point-paths; toSVG serialises a plotter-ready vector (mm units, single polyline); pathHash
// content-addresses the result so a design is REPRODUCIBLE and tamper-evident (re-run the generator with
// the same params -> the same hash). This is the witnessed-artifact spine applied to creativity, the basis
// for replacing ad-hoc plotter/generative tools with reproducible, verifiable, owned output. Zero deps.

// A classic harmonograph: damped sinusoids on x and y (pen-plotter staple). Deterministic from params.
export function harmonograph({ a = [1, 0.7], f = [2, 3], p = [0, 1.5], d = [0.004, 0.006], steps = 4000, dt = 0.05 } = {}) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    pts.push([
      a[0] * Math.sin(f[0] * t + p[0]) * Math.exp(-d[0] * t),
      a[1] * Math.sin(f[1] * t + p[1]) * Math.exp(-d[1] * t),
    ]);
  }
  return pts;
}

// Phyllotaxis spiral (sunflower): r = c sqrt(i), theta = i * golden angle.
export function phyllotaxis({ n = 1400, c = 0.9, spread = 1 } = {}) {
  const golden = Math.PI * (3 - Math.sqrt(5)), pts = [];
  for (let i = 0; i < n; i++) { const r = c * Math.sqrt(i) * spread, th = i * golden; pts.push([r * Math.cos(th), r * Math.sin(th)]); }
  return pts;
}

// Rose / rhodonea curve: r = cos(k*theta). A plotter classic.
export function rose({ k = 5, turns = 1, steps = 3000, scale = 90 } = {}) {
  const pts = [];
  for (let i = 0; i <= steps; i++) { const th = (i / steps) * turns * 2 * Math.PI, r = scale * Math.cos(k * th); pts.push([r * Math.cos(th), r * Math.sin(th)]); }
  return pts;
}

export const GENERATORS = { harmonograph, phyllotaxis, rose };

// Serialise points to a plotter-ready SVG (mm page, a single polyline path), fit to the page with a margin.
export function toSVG(points, { width = 200, height = 200, margin = 10, stroke = 0.3 } = {}) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const s = Math.min((width - 2 * margin) / ((maxX - minX) || 1), (height - 2 * margin) / ((maxY - minY) || 1));
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${(margin + (x - minX) * s).toFixed(2)},${(margin + (y - minY) * s).toFixed(2)}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">` +
    `<path d="${d}" fill="none" stroke="black" stroke-width="${stroke}"/></svg>`;
}

// A small deterministic content hash (FNV-1a over rounded coordinates): content-addresses a design.
export function pathHash(points) {
  let h = 0x811c9dc5;
  for (const [x, y] of points) {
    const s = `${Math.round(x * 1000)},${Math.round(y * 1000)};`;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  }
  return ("00000000" + h.toString(16)).slice(-8);
}
