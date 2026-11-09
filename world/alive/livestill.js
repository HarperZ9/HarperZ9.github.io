// livestill.js: a still image put in motion. Our own depth estimate, 2.5D parallax, breathing, wind, water and a
// passing light, on a CPU reference path (node tests, fallback) and a WebGL2 path that runs the same arithmetic.
//
// Depth needs no learned model. Four cues, each a field in 0..1 where 1 is near:
//   ground     lower in the frame is nearer (the ground-plane prior every landscape painter used);
//   haze       bright, low-saturation areas are far (aerial perspective, Leonardo's "perspective of disappearance");
//   detail     locally sharp, busy areas are near or in focus (blurred gradient energy);
//   masks      hand-drawn polygons with a set depth, feathered by a signed distance field.
// The cue mix is a parameter, and the result is smoothed, then stretched between its 2nd and 98th percentiles.
//   figure     what differs from the frame's border is figure, the border is ground (Rubin's vase, 1915).
// On a near-monochrome plate (mean saturation under 0.08, an engraving or a silver print) haze and hatch density
// mislead, since there tone is drawn, not atmospheric, so their weights drop and the figure cue rises.
//
// Motion is an inverse warp: for each output pixel, find where it came from. Parallax offset is
// (depth - pivot) x camera, solved by three fixed-point steps so a near edge stretches instead of tearing.
import { clamp, field, luma, blur, gradient, sdf, polyMask, sample, sampleField, vnoise, image, smooth, guided } from './lib/img.js';
import { context, program, texture, packFields, GLSL_NOISE } from './lib/gl.js';

export const SPEC = Object.freeze({
  params: {
    ground: { range: [0, 1], unit: 'weight of the lower-is-nearer cue', default: 0.45 },
    haze: { range: [0, 1], unit: 'weight of the bright-is-far cue', default: 0.2 },
    detail: { range: [0, 1], unit: 'weight of the sharp-is-near cue', default: 0.35 },
    figure: { range: [0, 1], unit: 'weight of the unlike-the-border-is-near cue', default: 0.2 },
    smoothPx: { range: [0, 32], unit: 'px, depth smoothing radius at working size', default: 6 },
    parallax: { range: [0, 0.05], unit: 'fraction of width moved at the depth extremes', default: 0.012 },
    pivot: { range: [0, 1], unit: 'depth that stays still', default: 0.5 },
    breathe: { range: [0, 0.02], unit: 'scale amplitude of the breath', default: 0.004 },
    breathPeriod: { range: [2, 20], unit: 's', default: 6.4 },
    wind: { range: [0, 0.02], unit: 'fraction of width, sway inside the wind mask', default: 0.004 },
    water: { range: [0, 0.02], unit: 'fraction of height, ripple inside the water mask', default: 0.003 },
    light: { range: [0, 0.4], unit: 'peak gain of the passing light', default: 0.1 },
    lightPeriod: { range: [4, 60], unit: 's for one pass', default: 25.6 },
  },
  determinism: 'a frame is a pure function of (image, depth, masks, params, t, seed)',
  budget: 'GL: one full-screen pass; CPU reference: about 60 ns a pixel in node',
});
const DEFAULTS = Object.fromEntries(Object.entries(SPEC.params).map(([k, p]) => [k, p.default]));

// Depth from cues and masks. masks: [{ poly: [[x,y],...] (0..1), depth: 0..1, feather: px }]
export function estimateDepth(im, { ground = DEFAULTS.ground, haze = DEFAULTS.haze, detail = DEFAULTS.detail, figure = DEFAULTS.figure, smoothPx = DEFAULTS.smoothPx, masks = [] } = {}) {
  const { w, h } = im, L = luma(im), d = im.data, out = field(w, h);
  const g = blur(gradient(L), Math.max(2, Math.round(Math.min(w, h) / 40)));
  const gMax = percentile(g.data, 0.98) || 1, Lb = blur(L, Math.max(2, Math.round(Math.min(w, h) / 30)));
  // the border is the background: what differs from it is figure (Rubin's figure and ground)
  let bsum = 0, bn = 0, satSum = 0; const m = Math.max(1, Math.round(Math.min(w, h) * 0.06));
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, gg, b); satSum += mx ? (mx - Math.min(r, gg, b)) / mx : 0;
    if (x < m || y < m || x >= w - m || y >= h - m) { bsum += Lb.data[i]; bn++; }
  }
  const mono = satSum / (w * h) < 0.08, bg = bsum / bn, wH = mono ? haze * 0.2 : haze, wD = mono ? detail * 0.4 : detail, wF = mono ? figure + 0.25 : figure;
  let fMax = 1e-6; const fig = new Float32Array(w * h); for (let i = 0; i < w * h; i++) { fig[i] = Math.abs(Lb.data[i] - bg); if (fig[i] > fMax) fMax = fig[i]; }
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    const sat = mx ? (mx - mn) / mx : 0, far = L.data[i] * (1 - sat);
    out.data[i] = ground * (y / (h - 1)) + wH * (1 - far) + wD * clamp(g.data[i] / gMax) + wF * (fig[i] / fMax);
  }
  // smooth, then let the depth edges snap to the picture's own edges (guided by a lightly blurred luma)
  let dep = guided(blur(out, smoothPx), blur(L, 1, 1), Math.max(2, smoothPx), 2e-3);
  const lo = percentile(dep.data, 0.02), hi = percentile(dep.data, 0.98), span = hi - lo || 1;
  for (let i = 0; i < w * h; i++) dep.data[i] = clamp((dep.data[i] - lo) / span);
  for (const mk of masks) applyMask(dep, mk);
  return dep;
}

function applyMask(dep, { poly, depth = 1, feather = 6 }) {
  const cov = polyMask(dep.w, dep.h, poly), dist = sdf(cov);
  for (let i = 0; i < dep.data.length; i++) { const a = smooth(-feather, feather, dist.data[i]); dep.data[i] = dep.data[i] * (1 - a) + depth * a; }
}

export function percentile(arr, q) {
  const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
}

// A region field from normalised rectangles [x0, y0, x1, y1] and polygons, feathered by `soft` px.
export function region(w, h, { rects = [], polys = [], soft = 8 } = {}) {
  let f = field(w, h);
  for (const [x0, y0, x1, y1] of rects) polyMask(w, h, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 1, f);
  for (const p of polys) polyMask(w, h, p, 1, f);
  return soft ? blur(f, soft, 2) : f;
}

// The state of the camera and the clocks at time t. pointer (-1..1) adds to the drift; it never replaces it.
export function pose(t, p = {}, pointer = [0, 0]) {
  const q = { ...DEFAULTS, ...p }, w = (2 * Math.PI) / q.breathPeriod;
  return {
    cam: [q.parallax * (0.7 * Math.sin(w * 0.5 * t) + 0.3 * pointer[0]), q.parallax * (0.35 * Math.sin(w * 0.25 * t + 1.3) + 0.3 * pointer[1])],
    scale: 1 + q.breathe * Math.sin(w * t),
    lightPhase: ((t / q.lightPeriod) % 1) * 1.6 - 0.3,
  };
}

// CPU reference frame. src: RGBA image; dep: depth field; masks: { wind, water } fields (optional).
export function renderFrame(src, dep, t = 0, p = {}, { wind = null, water = null, pointer = [0, 0], seed = 7, out = null, ps = null, crop = [0, 0, 1, 1], size = null } = {}) {
  const q = { ...DEFAULTS, ...p }, [w, h] = size || [src.w, src.h], o = out || image(w, h), px = [0, 0, 0, 0];
  ps = ps || pose(t, q, pointer);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = crop[0] + (crop[2] * (x + 0.5)) / w, v = crop[1] + (crop[3] * (y + 0.5)) / h, s = warp(u, v, t, q, ps, dep, wind, water, seed);
    sample(src, s.u * src.w - 0.5, s.v * src.h - 0.5, px);
    const gain = 1 + s.light, k = (y * w + x) * 4;
    o.data[k] = px[0] * gain; o.data[k + 1] = px[1] * gain; o.data[k + 2] = px[2] * gain; o.data[k + 3] = px[3];
  }
  return o;
}

// The warp, shared in spirit with the shader below (keep the two in step). Returns source uv and light gain.
export function warp(u, v, t, q, ps, dep, wind, water, seed) {
  const D = (uu, vv) => sampleField(dep, uu * dep.w - 0.5, vv * dep.h - 0.5);
  let cu = 0.5 + (u - 0.5) / ps.scale, cv = 0.5 + (v - 0.5) / ps.scale, su = cu, sv = cv;
  for (let k = 0; k < 3; k++) { const d = D(su, sv) - q.pivot; su = cu - d * ps.cam[0]; sv = cv - d * ps.cam[1] * (dep.w / dep.h); }
  if (wind && q.wind) { const m = sampleField(wind, su * wind.w - 0.5, sv * wind.h - 0.5); if (m > 0) su += m * q.wind * (vnoise(su * 3 + t * 0.35, sv * 6, seed) - 0.5) * 2 * (1 - 0.5 * D(su, sv)); }
  if (water && q.water) {
    const m = sampleField(water, su * water.w - 0.5, sv * water.h - 0.5);
    if (m > 0) { const ph = sv * 90 - t * 1.7 + 4 * vnoise(su * 4, sv * 10 + t * 0.2, seed + 1); su += m * q.water * 0.6 * Math.sin(ph * 0.7); sv += m * q.water * Math.sin(ph); }
  }
  // the light: a soft band on a diagonal, brighter where the relief faces it
  const band = Math.exp(-(((u * 0.8 + v * 0.45) / 1.25 - ps.lightPhase) ** 2) / 0.012);
  const e = 1 / Math.max(dep.w, 64), nx = D(su + e, sv) - D(su - e, sv), ny = D(su, sv + e) - D(su, sv - e);
  const facing = clamp(0.55 - 18 * (nx * 0.8 + ny * 0.45));
  return { u: su, v: sv, light: q.light * band * facing };
}

const FRAG = `#version 300 es
precision highp float; precision highp int;
in vec2 uv; out vec4 o;
uniform sampler2D img, fld; uniform vec4 crop; uniform vec2 cam, fsize; uniform float scale, lightPhase, pivot, windA, waterA, lightA, t, aspect; uniform int seed;
${GLSL_NOISE}
float D(vec2 q){ return texture(fld, q).r; }
void main(){
  vec2 q = crop.xy + uv * crop.zw, c = 0.5 + (q - 0.5) / scale, s = c;
  for (int k = 0; k < 3; k++){ float d = D(s) - pivot; s = c - d * vec2(cam.x, cam.y * aspect); }
  vec4 m = texture(fld, s);
  if (windA > 0.0 && m.g > 0.0) s.x += m.g * windA * (vnoise(vec2(s.x * 3.0 + t * 0.35, s.y * 6.0), seed) - 0.5) * 2.0 * (1.0 - 0.5 * D(s));
  if (waterA > 0.0 && m.b > 0.0){ float ph = s.y * 90.0 - t * 1.7 + 4.0 * vnoise(vec2(s.x * 4.0, s.y * 10.0 + t * 0.2), seed + 1); s += m.b * waterA * vec2(0.6 * sin(ph * 0.7), sin(ph)); }
  float band = exp(-pow((q.x * 0.8 + q.y * 0.45) / 1.25 - lightPhase, 2.0) / 0.012);
  float e = 1.0 / max(fsize.x, 64.0), nx = D(s + vec2(e, 0)) - D(s - vec2(e, 0)), ny = D(s + vec2(0, e)) - D(s - vec2(0, e));
  float facing = clamp(0.55 - 18.0 * (nx * 0.8 + ny * 0.45), 0.0, 1.0);
  vec4 px = texture(img, s); o = vec4(px.rgb * (1.0 + lightA * band * facing), px.a);
}`;

// Browser: a living still on a canvas. source: an <img> (decoded) or RGBA image. Falls back to CPU at low size.
export class LiveStill {
  constructor(canvas, source, { params = {}, depth = null, masks = [], wind = null, water = null, seed = 7, work = 256 } = {}) {
    this.canvas = canvas; this.p = { ...DEFAULTS, ...params }; this.base = { ...this.p }; this.seed = seed; this.pointer = [0, 0]; this.crop = [0, 0, 1, 1]; this.lightPhase = null;
    const small = toImage(source, work);
    this.depth = depth || estimateDepth(small, { ...this.p, masks });
    this.wind = wind ? region(small.w, small.h, wind) : null; this.water = water ? region(small.w, small.h, water) : null;
    this.gl = context(canvas);
    if (this.gl) {
      const gl = this.gl; this.prog = program(gl, FRAG);
      this.tImg = texture(gl, source.data ? source : source, 0); this.tFld = texture(gl, packFields([this.depth, this.wind, this.water]), 1);
    } else { this.small = small; this.ctx = canvas.getContext('2d'); }
  }
  draw(t) {
    const ps = pose(t, this.p, this.pointer);
    if (this.fixedCam) { ps.cam = this.fixedCam; ps.scale = 1; }
    if (this.lightPhase != null) ps.lightPhase = this.lightPhase;
    if (!this.gl) { const f = renderFrame(this.small, this.depth, t, this.p, { wind: this.wind, water: this.water, pointer: this.pointer, seed: this.seed, ps, crop: this.crop, size: this.cpuSize() }); drawImage(this.ctx, this.canvas, f); return; }
    const gl = this.gl, { pr, vao, uni } = this.prog;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.useProgram(pr); gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tImg); gl.uniform1i(uni.img, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tFld); gl.uniform1i(uni.fld, 1);
    gl.uniform2f(uni.cam, ps.cam[0], ps.cam[1]); gl.uniform1f(uni.scale, ps.scale); gl.uniform1f(uni.lightPhase, ps.lightPhase);
    gl.uniform1f(uni.pivot, this.p.pivot); gl.uniform1f(uni.windA, this.wind ? this.p.wind : 0); gl.uniform1f(uni.waterA, this.water ? this.p.water : 0);
    gl.uniform1f(uni.lightA, this.p.light); gl.uniform1f(uni.t, t); gl.uniform1f(uni.aspect, this.depth.w / this.depth.h);
    gl.uniform2f(uni.fsize, this.depth.w, this.depth.h); gl.uniform1i(uni.seed, this.seed); gl.uniform4f(uni.crop, ...this.crop);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // CPU fallback size: the canvas aspect at no more than 320 px wide.
  cpuSize() { const k = Math.min(1, 320 / this.canvas.width); return [Math.max(1, Math.round(this.canvas.width * k)), Math.max(1, Math.round(this.canvas.height * k))]; }
  dispose() { const gl = this.gl; if (gl) { gl.deleteTexture(this.tImg); gl.deleteTexture(this.tFld); gl.deleteProgram(this.prog.pr); } }
}

// An <img>, bitmap or canvas to an RGBA image no wider than `max` (browser only), or pass an image through.
export function toImage(src, max = 256) {
  if (src.data) return src;
  const s = Math.min(1, max / Math.max(src.naturalWidth || src.width, src.naturalHeight || src.height));
  const w = Math.max(1, Math.round((src.naturalWidth || src.width) * s)), h = Math.max(1, Math.round((src.naturalHeight || src.height) * s));
  const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h); return { w, h, data: d.data };
}
function drawImage(ctx, canvas, im) {
  const tmp = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(im.w, im.h) : Object.assign(document.createElement('canvas'), { width: im.w, height: im.h });
  tmp.getContext('2d').putImageData(new ImageData(im.data, im.w, im.h), 0, 0);
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}
export { DEFAULTS };
