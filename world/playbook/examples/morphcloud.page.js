// The morphcloud example: one cloud of points passes through a sunflower's spiral, a plate's nodal lines and an
// electron's density, then settles into the page's own title word. Generators combined: morphcloud.js (this
// folder), the glyph mask of lettering/lib/glyph.mjs (the cloud lands under the real h1 text), substrate thin-film
// colour for each point's tint and substrate grain on the ground.
import { MorphCloud, TARGETS } from '../morphcloud.js';
import { hash01, mixOk, rgbToHex, reducedMotion } from '../lib/util.js';
import { rasterText, ensureFont } from '../../lettering/lib/glyph.mjs';
import { filmRgb8 } from '../../substrate/lib/thinfilm.mjs';
import { grainTile, applyGrain, context2d } from '../../substrate/lib/raster.mjs';

const stage = document.querySelector('.stage'), ground = document.getElementById('ground'), dots = document.getElementById('dots');
const word = document.getElementById('word'), label = document.getElementById('label');
const INK = '#eee9df', GROUND = '#0f0f0e';

const VS = `#version 300 es
in vec2 p; in vec3 c; uniform vec2 u_res; uniform float u_size; out vec3 vc;
void main(){ gl_Position = vec4(p.x / u_res.x * 2. - 1., 1. - p.y / u_res.y * 2., 0., 1.); gl_PointSize = u_size; vc = c; }`;
const FS = `#version 300 es
precision highp float; in vec3 vc; uniform float u_size, u_alpha; out vec4 o;
void main(){ float d = length(gl_PointCoord - .5) * u_size, r = u_size * .5 - .75; float a = (1. - smoothstep(r - .75, r + .75, d)) * u_alpha; o = vec4(vc * a, a); }`;

function gl2(canvas) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) throw new Error('morphcloud page: WebGL2 unavailable');
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  const vao = gl.createVertexArray(), pb = gl.createBuffer(), cb = gl.createBuffer(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.enableVertexAttribArray(gl.getAttribLocation(pr, 'p')); gl.vertexAttribPointer(gl.getAttribLocation(pr, 'p'), 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.enableVertexAttribArray(gl.getAttribLocation(pr, 'c')); gl.vertexAttribPointer(gl.getAttribLocation(pr, 'c'), 3, gl.UNSIGNED_BYTE, true, 0, 0);
  const U = (n) => gl.getUniformLocation(pr, n);
  return {
    colours(rgb) { gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, rgb, gl.STATIC_DRAW); },
    draw(pos, w, h, size, alpha) {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(pr); gl.bindVertexArray(vao); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
      gl.uniform2f(U('u_res'), w, h); gl.uniform1f(U('u_size'), size); gl.uniform1f(U('u_alpha'), alpha);
      gl.drawArrays(gl.POINTS, 0, pos.length / 2);
    },
  };
}

let cloud = null, R = null, buf = null, lastStep = -1, W = 0, H = 0, DPR = 1;

async function build() {
  const box = stage.getBoundingClientRect(); W = Math.round(box.width); H = Math.round(box.height); DPR = Math.min(3, devicePixelRatio || 1);
  for (const c of [ground, dots]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
  const g = context2d(ground); g.fillStyle = GROUND; g.fillRect(0, 0, ground.width, ground.height);
  applyGrain(g, ground.width, ground.height, grainTile({ size: 256, sd: 1.8, clump: 2, seed: 23 }));
  await ensureFont(); await document.fonts.ready;
  // the word is set by the lettering lib at the span's own size and centred on the span (the span is the layout box;
  // the real heading is the h1 above it, for reading and search)
  const scale = 2, fs = parseFloat(getComputedStyle(word).fontSize), r = rasterText('Rest', { size: fs, weight: 900, tracking: -0.05, scale }), wb = word.getBoundingClientRect();
  const cx = wb.left - box.left + wb.width / 2, cy = wb.top - box.top + wb.height / 2;
  const n = W < 700 ? 14000 : 24000;
  cloud = new MorphCloud({
    n, w: W, h: H, seed: 11, cell: 2.5, stray: 0.035, halo: 0.05, travel: 0.42, stagger: 0.4, boil: 0.35, shape: { fps: 10, holds: [36, 36, 36, 52] },
    targets: [TARGETS.phyllotaxis({ angleDeg: 137.508, fit: 0.78 }), TARGETS.plate({ m: 3, n: 5, fit: Math.min(0.8, (0.8 * W) / H) }), TARGETS.orbital({ n: 3, l: 2, m: 1, fit: 0.86 }),
      TARGETS.mask({ data: r.mask, mw: r.w, mh: r.h, place: { x: cx - r.w / scale / 2, y: cy - r.h / scale / 2, s: 1 / scale }, label: '' })],
  });
  const rgb = new Uint8Array(3 * n);
  for (let i = 0; i < n; i++) { const f = filmRgb8(300 + 420 * hash01(5, i)), c = mixOk(INK, rgbToHex(f.map((v) => v / 255)), 0.42); rgb.set([1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)), 3 * i); }
  R = R || gl2(dots); R.colours(rgb); buf = new Float32Array(2 * n); lastStep = -1;
}

function frame(t) {
  const s = cloud.shapeAt(t), step = cloud.stepClock.indexAt(t);
  if (step === lastStep) return; lastStep = step;
  cloud.positionsAt(t, buf); R.draw(buf, W, H, 2.1 * DPR, W < 700 ? 0.72 : 0.78);
  if (label.textContent !== s.label) label.textContent = s.label;
}

async function main() {
  await build();
  if (reducedMotion()) { frame(cloud.shapeClock.startOf(3) + 4.5); return; }
  const t0 = performance.now(); const tick = (now) => { frame((now - t0) / 1000); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => build().catch((e) => console.error('morphcloud page: rebuild failed', e)), 200); });
}
main().catch((e) => console.error('morphcloud page:', e));
