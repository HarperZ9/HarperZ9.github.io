// projector.js: one scene graph projected to 2D, with a camera per step.
//
// A scene is a flat list of items in world units, z up: points, lines, faces and labels, each with an optional
// `step` at which it is built (staged build: masses rise from their base, labels fade in). A camera is data:
// { yaw, pitch (deg), zoom (px per unit), target [x, y, z], persp (0 ortho to 1 perspective), dist (units) }.
// Presets cover the plan, the two elevations, the isometric and a perspective. Between steps the camera is
// interpolated with the measured ease-out quad (QUALITY-SPEC M6); ortho to perspective is one continuous family
// (distance D = dist / persp), so no step change pops. Labels stay upright, are placed greedily against each other
// and the frame, keep their side while it stays free, and their offset moves at most 2 px a frame. transition()
// stretches a change until no label anchor moves more than 6 px a frame at 60 Hz, so a label moves at most 8.
//
// Synthesized from several sources: a camera per step from the Heckel explainer, the mono caps legend from our art
// direction, the scale journey of Powers of Ten (zoom interpolates geometrically, as techniques/lib/powers.js does),
// and the staged build. It draws on its own ground; it never floats a dark card over a painting.
import { EASE, clamp, lerp } from './lib/util.js';
import { polygon, line as rline, disc } from './lib/raster.js';
import { defineNode } from './lib/node.js';

const D2R = Math.PI / 180;
export const CAMERAS = Object.freeze({
  plan: { yaw: -90, pitch: 90, zoom: 40, target: [0, 0, 0], persp: 0, dist: 30 },
  front: { yaw: -90, pitch: 0, zoom: 40, target: [0, 0, 0], persp: 0, dist: 30 },
  side: { yaw: 0, pitch: 0, zoom: 40, target: [0, 0, 0], persp: 0, dist: 30 },
  iso: { yaw: -45, pitch: 35.264, zoom: 40, target: [0, 0, 0], persp: 0, dist: 30 },
  persp: { yaw: -62, pitch: 14, zoom: 40, target: [0, 0, 0], persp: 1, dist: 18 },
});
export const camera = (name, over = {}) => ({ ...CAMERAS[name], ...over, target: [...(over.target || CAMERAS[name].target)] });

// Camera basis: dir points from the target toward the eye; right stays horizontal for every pitch.
function basis(c) {
  const y = c.yaw * D2R, p = c.pitch * D2R, cp = Math.cos(p);
  const dir = [cp * Math.cos(y), cp * Math.sin(y), Math.sin(p)], r = [-Math.sin(y), Math.cos(y), 0];
  const f = [-dir[0], -dir[1], -dir[2]], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return { dir, r, u };
}

// Project one world point: [sx, sy, depth, k]. depth grows toward the eye.
export function projector(c, w, h) {
  const { dir, r, u } = basis(c), D = c.dist / Math.max(1e-4, c.persp), cx = w / 2 + (c.offset?.[0] || 0), cy = h / 2 + (c.offset?.[1] || 0);
  return (p) => {
    const v0 = p[0] - c.target[0], v1 = p[1] - c.target[1], v2 = p[2] - c.target[2];
    const xc = v0 * r[0] + v1 * r[1] + v2 * r[2], yc = v0 * u[0] + v1 * u[1] + v2 * u[2], zc = v0 * dir[0] + v1 * dir[1] + v2 * dir[2];
    const near = D - zc < D * 0.05, k = D / Math.max(D * 0.05, D - zc); // near: at or behind the near plane
    return [cx + c.zoom * xc * k, cy - c.zoom * yc * k, zc, k, near];
  };
}

// Camera interpolation: shortest-arc yaw, geometric zoom (a scale journey reads evenly), linear for the rest.
export function lerpCam(a, b, e) {
  let dy = ((b.yaw - a.yaw + 540) % 360) - 180;
  return { yaw: a.yaw + dy * e, pitch: lerp(a.pitch, b.pitch, e), zoom: a.zoom * (b.zoom / a.zoom) ** e, target: a.target.map((v, i) => lerp(v, b.target[i], e)),
    persp: lerp(a.persp, b.persp, e), dist: lerp(a.dist, b.dist, e), offset: [lerp(a.offset?.[0] || 0, b.offset?.[0] || 0, e), lerp(a.offset?.[1] || 0, b.offset?.[1] || 0, e)] };
}

// A speed-limited step change. Ease-out quad peaks at de/dt = 2 / T, so T >= 2 max|dp/de| / (fps maxPx).
export function transition(a, b, { scene = [], w = 1440, h = 900, maxPx = 6, fps = 60, base = 0.65, ease = EASE.outQuad } = {}) {
  const anchors = scene.filter((it) => it.type === 'label').map((it) => it.p); let peak = 0;
  if (anchors.length) {
    let prev = anchors.map(projector(lerpCam(a, b, 0), w, h));
    for (let i = 1; i <= 128; i++) { const cur = anchors.map(projector(lerpCam(a, b, i / 128), w, h)); for (let j = 0; j < cur.length; j++) peak = Math.max(peak, Math.hypot(cur[j][0] - prev[j][0], cur[j][1] - prev[j][1]) * 128); prev = cur; }
  }
  const duration = Math.max(base, (2 * peak) / (fps * maxPx) * 1.04);
  return { duration, at: (t) => lerpCam(a, b, ease(t / duration)) };
}

// Cull a primitive that reaches the near plane, or whose every vertex lies beyond the same edge of the frame (a 2 px margin keeps strokes whole).
const offscreen = (q, w, h) => q.some((p) => p[4]) || q.every((p) => p[0] < -2) || q.every((p) => p[0] > w + 2) || q.every((p) => p[1] < -2) || q.every((p) => p[1] > h + 2);
const lift = (p, base, a) => [p[0], p[1], base + (p[2] - base) * a];

// Project and depth-sort a scene at build stage s (items with step <= s are built; step k rises over s in [k, k+1]).
export function project(scene, cam, w, h, stage = Infinity) {
  const P = projector(cam, w, h), out = [];
  for (const it of scene) {
    const a = EASE.outQuad(clamp(stage - (it.step || 0))); if (a <= 0) continue;
    const zoomFade = it.minZoom ? clamp((cam.zoom - it.minZoom * 0.7) / (it.minZoom * 0.3)) : 1; // a label fades as the scale journey leaves it too small to point at
    if (zoomFade <= 0) continue;
    const base = it.base ?? 0, alpha = (it.alpha ?? 1) * zoomFade * (it.type === 'label' || it.fade ? a : 1), L = (p) => P(lift(p, base, it.type === 'label' ? 1 : a));
    if (it.type === 'face') { const q = it.pts.map(L); if (offscreen(q, w, h)) continue; const d = q.reduce((s, v) => s + v[2], 0) / q.length; out.push({ ...it, q, depth: d + (it.bias || 0), alpha }); }
    else if (it.type === 'line') { const q = [L(it.a), L(it.b)]; if (offscreen(q, w, h)) continue; out.push({ ...it, q, depth: (q[0][2] + q[1][2]) / 2 + (it.bias ?? 0.01), alpha }); }
    else if (it.type === 'point') { const q = [L(it.p)]; out.push({ ...it, q, depth: q[0][2] + 0.02, alpha }); }
    else if (it.type === 'label') out.push({ ...it, q: [L(it.p)], depth: Infinity, alpha });
  }
  return out.sort((x, y) => x.depth - y.depth);
}

// Upright label placement: greedy by priority, sticky side, offset speed capped (px per frame).
const SIDES = [[12, -12, 'start'], [12, 18, 'start'], [-12, -12, 'end'], [-12, 18, 'end'], [0, -20, 'middle'], [0, 28, 'middle']];
export function labelBox(l, x, y, side) {
  const s = l.size || 13, wd = (l.text.length * 0.56 + 0.4) * s, [dx, dy, an] = SIDES[side], x0 = an === 'start' ? x + dx : an === 'end' ? x + dx - wd : x + dx - wd / 2;
  return [x0 - 3, y + dy - s * 0.9, x0 + wd + 3, y + dy + s * 0.35];
}
const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

export function placeLabels(list, w, h, state = new Map(), maxStep = 2) {
  const placed = [], labels = list.filter((x) => x.type === 'label').sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const l of labels) {
    const [x, y] = l.q[0], prev = state.get(l.id ?? l.text), order = prev ? [prev.side, ...SIDES.keys()] : [...SIDES.keys()];
    let side = order.find((k) => { const b = labelBox(l, x, y, k); return b[0] >= 4 && b[2] <= w - 4 && b[1] >= 4 && b[3] <= h - 4 && !placed.some((p) => hit(p, b)); });
    if (side === undefined) side = prev?.side ?? 0;
    placed.push(labelBox(l, x, y, side));
    const [tx, ty] = SIDES[side], cur = prev ? [prev.dx, prev.dy] : [tx, ty], d = Math.hypot(tx - cur[0], ty - cur[1]), m = d > maxStep ? maxStep / d : 1;
    const st = { side, dx: cur[0] + (tx - cur[0]) * m, dy: cur[1] + (ty - cur[1]) * m }; state.set(l.id ?? l.text, st);
    Object.assign(l, { lx: x + st.dx, ly: y + st.dy, anchor: SIDES[side][2] });
  }
  return state;
}

const f1 = (v) => +v.toFixed(1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function toSVG(list, { w, h, ground = null, font = 'Conso, ui-monospace, monospace' } = {}) {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`];
  if (ground) parts.push(`<rect width="${w}" height="${h}" fill="${ground}"/>`);
  for (const it of list) {
    const o = it.alpha < 1 ? ` opacity="${f1(it.alpha * 100) / 100}"` : '';
    if (it.type === 'face') parts.push(`<polygon points="${it.q.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ')}" fill="${it.fill || 'none'}"${it.stroke ? ` stroke="${it.stroke}" stroke-width="${it.w || 1}" stroke-linejoin="round"` : ''}${o}/>`);
    else if (it.type === 'line') parts.push(`<line x1="${f1(it.q[0][0])}" y1="${f1(it.q[0][1])}" x2="${f1(it.q[1][0])}" y2="${f1(it.q[1][1])}" stroke="${it.color}" stroke-width="${it.w || 1}"${it.dash ? ` stroke-dasharray="${it.dash}"` : ''} stroke-linecap="round"${o}/>`);
    else if (it.type === 'point') parts.push(`<circle cx="${f1(it.q[0][0])}" cy="${f1(it.q[0][1])}" r="${it.r || 2}" fill="${it.color}"${o}/>`);
    else if (it.type === 'label') {
      const [x, y] = it.q[0], lx = it.lx ?? x + 12, ly = it.ly ?? y - 12;
      parts.push(`<g${o}><line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(lx)}" y2="${f1(ly + 3)}" stroke="${it.color}" stroke-width="1"/><circle cx="${f1(x)}" cy="${f1(y)}" r="2.5" fill="${it.color}"/>` +
        `<text x="${f1(lx)}" y="${f1(ly)}" fill="${it.color}" font-family="${font}" font-size="${it.size || 13}" letter-spacing="0.06em" text-anchor="${it.anchor || 'start'}">${esc(it.text)}</text></g>`);
    }
  }
  parts.push('</svg>'); return parts.join('');
}

// CPU reference renderer (no fonts in node: a label draws its anchor, leader and a text-height bar).
export function toRaster(list, im) {
  for (const it of list) {
    const a = it.alpha ?? 1;
    if (it.type === 'face') { const pts = it.q.flatMap((p) => [p[0], p[1]]); if (it.fill && it.fill !== 'none') polygon(im, pts, it.fill, a); if (it.stroke) for (let i = 0; i < it.q.length; i++) { const p = it.q[i], n = it.q[(i + 1) % it.q.length]; rline(im, p[0], p[1], n[0], n[1], (it.w || 1) / 2, it.stroke, a); } }
    else if (it.type === 'line') rline(im, it.q[0][0], it.q[0][1], it.q[1][0], it.q[1][1], (it.w || 1) / 2, it.color, a);
    else if (it.type === 'point') disc(im, it.q[0][0], it.q[0][1], it.r || 2, it.color, a);
    else if (it.type === 'label') { const [x, y] = it.q[0], lx = it.lx ?? x + 12, ly = it.ly ?? y - 12; rline(im, x, y, lx, ly + 3, 0.5, it.color, a); disc(im, x, y, 2.5, it.color, a); }
  }
  return im;
}

// Canvas renderer for the browser (labels in Conso, upright).
export function toCanvas(list, ctx) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const it of list) {
    ctx.globalAlpha = it.alpha ?? 1;
    if (it.type === 'face') { ctx.beginPath(); it.q.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); if (it.fill && it.fill !== 'none') { ctx.fillStyle = it.fill; ctx.fill(); } if (it.stroke) { ctx.strokeStyle = it.stroke; ctx.lineWidth = it.w || 1; ctx.stroke(); } }
    else if (it.type === 'line') { ctx.setLineDash(it.dash ? it.dash.split(' ').map(Number) : []); ctx.strokeStyle = it.color; ctx.lineWidth = it.w || 1; ctx.beginPath(); ctx.moveTo(it.q[0][0], it.q[0][1]); ctx.lineTo(it.q[1][0], it.q[1][1]); ctx.stroke(); ctx.setLineDash([]); }
    else if (it.type === 'point') { ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(it.q[0][0], it.q[0][1], it.r || 2, 0, 7); ctx.fill(); }
    else if (it.type === 'label') { const [x, y] = it.q[0], lx = it.lx ?? x + 12, ly = it.ly ?? y - 12; ctx.strokeStyle = ctx.fillStyle = it.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly + 3); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); ctx.font = `${it.size || 13}px Conso, ui-monospace, monospace`; ctx.textAlign = it.anchor === 'end' ? 'right' : it.anchor === 'middle' ? 'center' : 'left'; ctx.fillText(it.text, lx, ly); }
  }
  ctx.globalAlpha = 1;
}

// Adapter for phase-design media/stepper.js: steps of { title, text, draw(g, k, T) } that project this scene with the
// camera eased from the previous step's to this step's. The stepper's own iso helper is not used; g.ctx is.
export function stepperSteps(scene, cams, texts) {
  const state = new Map();
  return cams.map((cam, k) => ({ ...texts[k], draw(g, kk, T) {
    const c = g.ctx.canvas, list = project(scene, lerpCam(cams[Math.max(0, kk - 1)], cam, T), c.width, c.height, kk + T);
    placeLabels(list, c.width, c.height, state); toCanvas(list, g.ctx);
  } }));
}

export const SPEC = Object.freeze({
  inputs: { scene: 'array of {type: point|line|face|label, step?, base?, ...} in world units, z up', camera: 'object, see CAMERAS', stage: 'number, build stage' },
  params: {
    yaw: { range: [-180, 180], unit: 'deg about z', default: -45 }, pitch: { range: [-90, 90], unit: 'deg above the ground plane', default: 35.264 },
    zoom: { range: [0.5, 4000], unit: 'CSS px per world unit', default: 40 }, persp: { range: [0, 1], unit: 'share, 0 orthographic to 1 perspective', default: 0 },
    dist: { range: [2, 400], unit: 'world units, eye distance at persp 1', default: 30 }, maxPx: { range: [1, 8], unit: 'px per frame at 60 Hz, label anchor speed cap', default: 6 },
    duration: { range: [0.2, 4], unit: 's, minimum step change', default: 0.65 },
  },
  determinism: 'pure functions of (scene, camera, stage); label state advances only by placeLabels calls',
  budget: '1440 x 900: projection, sort, label placement and SVG under 8 ms per 1000 items in node (measured in tests); the page redraws only while the camera or the build moves',
});

export const node = defineNode({
  id: 'projector', ports: { in: { scene: 'scene' }, out: { image: 'image' } }, params: SPEC.params, seed: 1,
  render: ({ inputs, params, out }) => { const c = { yaw: params.yaw, pitch: params.pitch, zoom: params.zoom, persp: params.persp, dist: params.dist, target: [0, 0, 0] }; const list = project(inputs.scene, c, out.w, out.h); placeLabels(list, out.w, out.h); return toRaster(list, out); },
});
