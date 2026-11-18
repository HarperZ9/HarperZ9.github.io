// field-draw.mjs: how the field is drawn. The scene is world-field.mjs (superframe packages/world, carried unchanged);
// this file only draws it: the medium as light sees it, the rays, the rims, the probe and the dimensions. It runs in
// node too, so the page's still (stillSvg) is drawn by the same rules the live canvas follows.
export const VIEW = Object.freeze({ w: 800, h: 480 });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// The colours: glass and water from the element table's measured colours, the probe in the site's ochre, ink on a
// calm ground from the shell's tokens. dye can be replaced by a colour handed in by the blend.
export const COLOURS = Object.freeze({ glass: '#8a6f60', water: '#557e7d', probe: '#d79e35', voice: '#1d2562', ground: '#c4baa6' });
export const palette = (dark) => (dark ? { wall: '#0a0a0c', ink: '#ece5d6', soft: '#b8b0a0', line: '#2e2c31' } : { wall: '#e8e3d9', ink: '#16130f', soft: '#4a443b', line: '#c4baa6' });

// One pixel of the medium: the ground, tinted by what carries the lens, by the dye and by the sound.
export function paintGround(data, pw, ph, scene, { dark = false, dye = COLOURS.water } = {}) {
  const { g, size: { nx, ny, w, h } } = scene, P = palette(dark), wall = hexRgb(P.wall), ink = hexRgb(P.ink), glass = hexRgb(COLOURS.glass), dyeC = hexRgb(dye);
  const sx = nx / pw, sy = ny / ph;
  for (let py = 0; py < ph; py++) for (let px = 0; px < pw; px++) {
    const gx = Math.min(nx - 2, (px + 0.5) * sx), gy = Math.min(ny - 2, (py + 0.5) * sy), i = gx | 0, j = gy | 0, k = j * nx + i;
    const dx = g.n2[k + 1] - g.n2[k], dy = g.n2[k + nx] - g.n2[k];
    const lens = g.s.lens[k], flow = g.s.flow[k];
    let c = mixRgb(wall, glass, Math.min(0.55, 0.45 * lens * Math.max(0, g.n2[k] - 1)));
    c = mixRgb(c, dyeC, Math.min(0.85, 0.75 * g.dye[k] * Math.max(flow, 0.2)));
    const shade = Math.max(-0.25, Math.min(0.25, (dx + dy) * 1.5 + 0.9 * scene.wave.p[k]));
    c = mixRgb(c, shade > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(shade) * (dark ? 0.6 : 0.45));
    const o = (py * pw + px) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
}

const S = VIEW.w / 2;   // pixels per scene unit; the scene is 2 by 1.2
const pt = ([x, y]) => [x * S, y * S];
// The map: lines every 100 mm of the sheet behind the scene, each point drawn where the light shows it (displaced
// by grad n^2, the thin-sheet rule) and as strongly as the map is carried there.
function graticule(scene) {
  const { g, size: { nx, w, h } } = scene, hc = w / nx, ny = scene.size.ny, K = 0.06, out = [];
  const at = (x, y) => { const i = Math.min(nx - 2, Math.max(0, Math.floor(x / hc))), j = Math.min(ny - 2, Math.max(0, Math.floor(y / hc))), k = j * nx + i;
    return { dx: (K * (g.n2[k + 1] - g.n2[k])) / hc, dy: (K * (g.n2[k + nx] - g.n2[k])) / hc, s: g.s.map[k] }; };
  const line = (pts) => { let s = 0; const d = pts.map(([x, y]) => { const q = at(x, y); s += q.s; return pt([x + q.dx, y + q.dy]); }); s /= pts.length; if (s > 0.004) out.push({ kind: 'grid', d, alpha: Math.min(1, s) }); };
  for (let x = 0.1; x < w - 1e-9; x += 0.1) line(Array.from({ length: 61 }, (_, i) => [x, (i / 60) * h]));
  for (let y = 0.1; y < h - 1e-9; y += 0.1) line(Array.from({ length: 101 }, (_, i) => [(i / 100) * w, y]));
  return out;
}

// The vector parts, as a list of marks both the canvas and the SVG draw: rays, rims, the probe, the dimensions.
export function marks(scene, rays, dims, selected = null) {
  const out = [...graticule(scene)];
  for (const r of rays) out.push({ kind: 'ray', d: r.points.map(pt) });
  for (const el of scene.elements) {
    const top = Math.max(...Object.values(el.carries)); if (top <= 0 || el.id === 'ground') continue;
    out.push({ kind: 'rim', id: el.id, c: pt([el.x, el.y]), r: el.radius * S, inner: (el.radius - el.edge) * S, outer: (el.radius + el.edge) * S, alpha: 0.35 + 0.65 * top, selected: el.id === selected, colour: COLOURS[el.id] || COLOURS.ground, name: el.name });
  }
  if (dims) {
    const c = pt(dims.centroid), a = dims.angle, L = (dims.major.value / 100) * S / 2, M = (dims.minor.value / 100) * S / 2, ca = Math.cos(a), sa = Math.sin(a);
    const alpha = Math.max(...scene.elements.map((e) => e.carries.shape));
    out.push({ kind: 'dim', a: [c[0] - ca * L, c[1] - sa * L], b: [c[0] + ca * L, c[1] + sa * L], text: dims.major.text, alpha });
    out.push({ kind: 'dim', a: [c[0] + sa * M, c[1] - ca * M], b: [c[0] - sa * M, c[1] + ca * M], text: dims.minor.text, alpha });
    out.push({ kind: 'ellipse', c, rx: L, ry: M, angle: a, alpha });
  }
  return out;
}

export function drawMarks(ctx, list, { dark = false } = {}) {
  const P = palette(dark);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const m of list) {
    ctx.save();
    if (m.kind === 'grid') { ctx.globalAlpha = 0.55 * m.alpha; ctx.strokeStyle = P.soft; ctx.lineWidth = 0.75; ctx.beginPath(); m.d.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
    else if (m.kind === 'ray') { ctx.globalAlpha = 0.85; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.4; ctx.beginPath(); m.d.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
    else if (m.kind === 'rim') {
      ctx.globalAlpha = m.alpha; ctx.strokeStyle = m.colour; ctx.lineWidth = m.selected ? 2.5 : 1.5; ctx.setLineDash(m.selected ? [] : [6, 5]);
      ctx.beginPath(); ctx.arc(m.c[0], m.c[1], m.r, 0, 2 * Math.PI); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = m.alpha * 0.35; ctx.lineWidth = 1;
      for (const r of [m.inner, m.outer]) { ctx.beginPath(); ctx.arc(m.c[0], m.c[1], Math.max(0, r), 0, 2 * Math.PI); ctx.stroke(); }
      if (m.id === 'probe') { ctx.globalAlpha = 1; ctx.strokeStyle = m.colour; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.c[0] - 9, m.c[1]); ctx.lineTo(m.c[0] + 9, m.c[1]); ctx.moveTo(m.c[0], m.c[1] - 9); ctx.lineTo(m.c[0], m.c[1] + 9); ctx.stroke(); }
    } else if (m.kind === 'dim') {
      ctx.globalAlpha = m.alpha; ctx.strokeStyle = P.ink; ctx.fillStyle = P.ink; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(...m.a); ctx.lineTo(...m.b); ctx.stroke();
      for (const [p, q] of [[m.a, m.b], [m.b, m.a]]) arrow(ctx, p, q);
      ctx.font = '13px Conso, ui-monospace, monospace'; ctx.fillText(m.text, m.b[0] + 6, m.b[1] - 6);
    } else if (m.kind === 'ellipse') {
      ctx.globalAlpha = 0.6 * m.alpha; ctx.strokeStyle = P.ink; ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(m.c[0], m.c[1], m.rx, m.ry, m.angle, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.restore();
  }
}
function arrow(ctx, p, q) {
  const a = Math.atan2(q[1] - p[1], q[0] - p[0]), s = 7;
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + s * Math.cos(a + 0.35), p[1] + s * Math.sin(a + 0.35)); ctx.lineTo(p[0] + s * Math.cos(a - 0.35), p[1] + s * Math.sin(a - 0.35)); ctx.closePath(); ctx.fill();
}

// The still: the same marks as SVG, on the light ground. One path per ray and per rim, so it reads with scripts off.
export function stillSvg(scene, rays, dims, label) {
  const P = palette(false), f = (v) => v.toFixed(1), parts = [];
  for (const m of marks(scene, rays, dims)) {
    if (m.kind === 'grid') parts.push(`<path d="M${m.d.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}" fill="none" stroke="${P.soft}" stroke-width=".75" opacity="${(0.55 * m.alpha).toFixed(2)}"/>`);
    else if (m.kind === 'ray') parts.push(`<path d="M${m.d.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}" fill="none" stroke="${P.ink}" stroke-width="1.4" opacity=".85"/>`);
    else if (m.kind === 'rim') parts.push(`<circle cx="${f(m.c[0])}" cy="${f(m.c[1])}" r="${f(m.r)}" fill="${m.colour}" fill-opacity=".12" stroke="${m.colour}" stroke-width="1.5" stroke-dasharray="6 5" opacity="${m.alpha.toFixed(2)}"/>`);
    else if (m.kind === 'dim') parts.push(`<path d="M${f(m.a[0])} ${f(m.a[1])}L${f(m.b[0])} ${f(m.b[1])}" stroke="${P.ink}" stroke-width="1" opacity="${m.alpha}"/><text x="${f(m.b[0] + 6)}" y="${f(m.b[1] - 6)}" font-size="13" font-family="Conso, ui-monospace, monospace" fill="${P.ink}">${esc(m.text)}</text>`);
    else if (m.kind === 'ellipse') parts.push(`<ellipse cx="${f(m.c[0])}" cy="${f(m.c[1])}" rx="${f(m.rx)}" ry="${f(m.ry)}" transform="rotate(${f((m.angle * 180) / Math.PI)} ${f(m.c[0])} ${f(m.c[1])})" fill="none" stroke="${P.ink}" stroke-dasharray="2 4" opacity=".6"/>`);
  }
  return `<svg viewBox="0 0 ${VIEW.w} ${VIEW.h}" role="img" aria-label="${esc(label)}"><rect width="${VIEW.w}" height="${VIEW.h}" fill="${P.wall}"/>${parts.join('')}</svg>`;
}
