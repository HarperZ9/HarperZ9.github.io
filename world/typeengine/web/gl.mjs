// web/gl.mjs: the live renderer. WebGL2, one fragment pass per word: the letter's coverage and signed distance
// come from the CPU (lib/setline.mjs, the forge's own outlines), the material runs in the shader on a clock.
// Shader materials: ink, offset, halftone, engraved, scanline, sand, ledger, ridgeline, glass, crt as fill; glow or
// ink as edge; offset as shadow; drift as motion. Anything else (brush, cloud, feeds, the stroke slot) is drawn by
// the CPU renderer and shown through the same pass as a texture, so every family draws here.
// The field shaders follow lib/fields.mjs at() line for line; tests/browser compares the two renders.
import { instance, faceOf } from '../lib/program.mjs';
import { glyphContext } from '../lib/setline.mjs';
import { renderWord } from '../lib/render.mjs';
import { resolveInputs } from '../lib/inputs.mjs';
import { normalise } from '../lib/fields.mjs';
import { convert } from '../lib/adapters.mjs';
import { FRAG, VERT } from './shaders.mjs';
import { material } from '../lib/materials.mjs';
import { resolveParams } from '../lib/material.mjs';

// Shader parameters per fill material, in the order the fragment shader reads them.
const PACK = {
  halftone: (p) => [[p.pitch, p.heavy, p.light, 0], [0, 0, 0, 0]], engraved: (p) => [[p.pitch, p.heavy, p.light, 0], [0, 0, 0, 0]],
  scanline: (p) => [[p.pitch, p.duty, 0, 0], [0, 0, 0, 0]], sand: (p) => [[p.pitch, 0, p.grain, p.seed], [0, 0, 0, 0]],
  ledger: (p) => [[p.pitch, p.gap, p.floor, p.ceil], [0, 0, 0, 0]], ridgeline: (p) => [[p.pitch, p.amp, p.weight, 0], [0, 0, 0, 0]],
  glass: (p) => [[{ crown: 1.5168, flint: 1.62, dense: 1.7847, silica: 1.4585 }[p.glass] ?? 1.6, p.spread, p.bevel, p.thickness], [p.gap, p.caustic, p.rules, p.film]], crt: (p) => [[p.lines, p.bloom, p.mask, p.snow], [p.exposure, 0, 0, 0]],
};
const FILLS = { ink: 0, offset: 0, halftone: 1, engraved: 2, scanline: 3, sand: 4, ledger: 5, ridgeline: 6, glass: 7, crt: 8 };
const lin = (h) => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map((s) => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };

/** True when the family's bindings are all shader materials; otherwise the CPU texture path is used. */
export function shaderPath(inst) {
  const b = inst.bindings;
  const f = b.fill.feed?.['surface.albedo'];
  const tubeFeed = b.fill.material === 'glass' && f && typeof f === 'object' && f.material === 'crt' && (f.params?.content ?? 'source') === 'source' && Object.keys(b.fill.feed).length === 1;
  if (!(b.fill.material in FILLS) || (b.fill.feed && !tubeFeed)) return false;
  if (b.edge && !['glow', 'ink'].includes(b.edge.material)) return false;
  if (b.shadow && b.shadow.material !== 'offset') return false;
  if (b.interior || b.stroke) return false;
  return true;
}

function compile(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`gl: ${gl.getShaderInfoLog(s)}`); return s; }
function tex(gl, unit, w, h, data, fmt) {
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (fmt === 'rg') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, w, h, 0, gl.RG, gl.FLOAT, data);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
  return t;
}

function linkOn(gl) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`gl: ${gl.getProgramInfoLog(prog)}`);
  return prog;
}

/** createLive(canvas) -> { draw(family, text, { t, loc }), mode, dispose } or null when WebGL2 or float textures are missing. */
export function createLive(canvas) {
  // Prove the shaders on a scratch canvas first: a canvas that once held a WebGL context can never give a 2D one,
  // so a failure here must leave the real canvas free for the Canvas 2D fallback.
  if (typeof document !== 'undefined') { const probe = document.createElement('canvas').getContext('webgl2'); if (!probe) return null; try { linkOn(probe); } finally { probe.getExtension('WEBGL_lose_context')?.loseContext(); } }
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl || !gl.getExtension('OES_texture_float_linear')) return null;
  const prog = linkOn(gl);
  const U = (n) => gl.getUniformLocation(prog, n);
  let key = null, state = null;

  function prepare(family, text, loc) {
    const w = canvas.width, h = canvas.height, inst = instance(family, loc), k = JSON.stringify([family, text, loc, w, h]);
    if (k === key) return state;
    const shader = shaderPath(inst), g = glyphContext(faceOf(inst), text, w, h, { fill: 0.82 });
    const field = new Float32Array(w * h * 2), sdf = g.sdf.data, cov = g.coverage.data;
    for (let i = 0; i < w * h; i++) { field[i * 2] = cov[i]; field[i * 2 + 1] = sdf[i]; }
    const cpu = shader ? null : renderWord(family, text, w, h, { loc }).raster;
    const ext = resolveInputs(inst.inputs), fb = inst.bindings.fill;
    let series = ext['data.series']?.y;
    if (fb.feed?.['data.series'] === 'sound.pcm' && ext['sound.pcm']) series = convert(ext['sound.pcm'], 'data.series').y;
    const ser = new Float32Array(64); if (series) { const n = normalise(series); for (let i = 0; i < 64; i++) { const u = (i / 63) * (n.length - 1), j = Math.floor(u), f = u - j; ser[i] = n[j] * (1 - f) + n[Math.min(n.length - 1, j + 1)] * f; } }
    const gl0 = new Float32Array(64 * 4); g.lay.placed.slice(0, 64).forEach((p, i) => gl0.set([p.x, p.s, p.baseline, p.g.advance], i * 4));
    tex(gl, 0, w, h, field, 'rg'); tex(gl, 1, w, h, cpu ? cpu.data : new Float32Array(w * h * 4), 'rgba');
    key = k; state = { inst, g, shader, glyphs: gl0, n: Math.min(64, g.lay.placed.length), series: ser };
    return state;
  }

  function draw(family, text, { t = 0, loc = {} } = {}) {
    const s = prepare(family, text, loc), b = s.inst.bindings, P = (sl, k, d) => b[sl]?.params?.[k] ?? d;
    gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(prog);
    gl.uniform1i(U('uField'), 0); gl.uniform1i(U('uCpu'), 1);
    gl.uniform2f(U('uSize'), canvas.width, canvas.height); gl.uniform1f(U('uT'), t); gl.uniform1f(U('uEm'), s.g.size); gl.uniform1f(U('uDpr'), canvas.clientWidth ? canvas.width / canvas.clientWidth : 1);
    gl.uniform1i(U('uMode'), s.shader ? FILLS[b.fill.material] : -1); gl.uniform1i(U('uOffsetFill'), b.fill.material === 'offset' ? 1 : 0);
    gl.uniform3fv(U('uGround'), lin(s.inst.ground ?? '#ebe5d8'));
    const fp = resolveParams(material(b.fill.material), b.fill.params ?? {}), pack = PACK[b.fill.material] ?? (() => [[0, 0, 0, 0], [0, 0, 0, 0]]), [p0, p1] = pack(fp);
    gl.uniform4f(U('uP0'), ...p0); gl.uniform4f(U('uP1'), ...p1);
    gl.uniform3fv(U('uTint'), lin(fp.tint ?? '#eef4f1')); gl.uniform3fv(U('uPaper'), lin(fp.paper ?? '#ebe5d8'));
    gl.uniform3fv(U('uInk'), lin(fp.color ?? fp.phosphor ?? '#15130f'));
    const feed = b.fill.feed?.['surface.albedo'], cp = feed?.material === 'crt' ? resolveParams(material('crt'), feed.params ?? {}) : null;
    gl.uniform1i(U('uFeed'), cp ? 1 : 0);
    if (cp) { gl.uniform4f(U('uP2'), cp.lines, cp.bloom, cp.mask, cp.snow); gl.uniform3fv(U('uPhos'), lin(cp.phosphor)); gl.uniform1f(U('uExp'), cp.exposure); }
    gl.uniform1i(U('uEdge'), b.edge ? (b.edge.material === 'glow' ? 1 : 2) : 0);
    gl.uniform3fv(U('uEdgeCol'), lin(P('edge', 'color', b.edge?.material === 'ink' ? '#15130f' : '#ffb34d'))); gl.uniform2f(U('uEdgeP'), P('edge', 'reach', 0.06), P('edge', 'power', P('edge', 'opacity', 1.4)));
    gl.uniform1f(U('uEdgeW'), (s.inst.regions.edge.width ?? 0.018));
    gl.uniform1i(U('uShadow'), b.shadow ? 1 : 0); gl.uniform3fv(U('uShadowCol'), lin(P('shadow', 'color', '#c8553a')));
    gl.uniform3f(U('uShadowP'), b.shadow ? s.inst.regions.shadow.dx : P('fill', 'dx', 0.022), b.shadow ? s.inst.regions.shadow.dy : P('fill', 'dy', 0.014), P('shadow', 'opacity', P('fill', 'opacity', 0.9)));
    gl.uniform1i(U('uDrift'), b.motion?.material === 'drift' ? 1 : 0); gl.uniform2f(U('uDriftP'), P('motion', 'period', 22), P('motion', 'speed', 18));
    gl.uniform4fv(U('uGlyphs'), s.glyphs); gl.uniform1i(U('uN'), s.n); gl.uniform1fv(U('uSeries'), s.series);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return { shader: s.shader, missing: s.g.missing };
  }
  return { draw, mode: 'webgl2', gl, dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext(); } };
}

/** Canvas 2D fallback: the CPU renderer, encoded to sRGB. */
export function drawCanvas2D(canvas, family, text, { t = 0, loc = {} } = {}) {
  const ctx = canvas.getContext('2d'), R = renderWord(family, text, canvas.width, canvas.height, { t, loc }).raster, img = ctx.createImageData(R.w, R.h);
  const enc = (v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.min(1, v) ** (1 / 2.4) - 0.055));
  for (let i = 0; i < R.w * R.h; i++) { for (let c = 0; c < 3; c++) img.data[i * 4 + c] = enc(Math.max(0, R.data[i * 4 + c])); img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return { shader: false, mode: 'canvas2d' };
}
