// plate-gl.js: WebGL2 renderer for the Chladni plate. Draws a plate material, then every grain twice
// (a soft contact shadow, then the lit grain). Fine grains are shaded spheres with size and tone variation;
// letter grains are glyphs from a mip-mapped atlas, lit the same way. Output is dithered (TPDF) so the plate
// gradient does not band. Canvas backing store follows the device pixel ratio (capped at 2.5 and 2600 px).
//
// createPlateRenderer(canvas, { pad, chars }) -> { resize(), draw(sets), dispose() }
//   pad:   plate inset as a fraction of the canvas width (the plate is drawn in [pad, 1 - pad]).
//   chars: string of every glyph letter grains may carry.
//   draw(sets): sets = [{ sand, glyphs: true|false, px: grain diameter in CSS px }], drawn in order.
// Throws if WebGL2 is unavailable; the caller falls back.

const VS_BG = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0., 1.); }`;
const FS_BG = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform vec2 res; uniform float pad; uniform float seed;
float h(vec2 q){ q = fract(q * vec2(443.897, 441.423)); q += dot(q, q.yx + 19.19); return fract((q.x + q.y) * q.x); }
float n1(float x){ float i = floor(x), f = fract(x); float a = h(vec2(i, 3.1)), b = h(vec2(i + 1., 3.1)); return mix(a, b, f * f * (3. - 2. * f)); }
void main(){
  vec2 px = uv * res;
  vec3 ground = vec3(0.020, 0.020, 0.031);
  vec2 lo = vec2(pad), hi = res - pad;
  float inside = step(lo.x, px.x) * step(px.x, hi.x) * step(lo.y, px.y) * step(px.y, hi.y);
  vec2 q = (px - lo) / (hi - lo);
  // brushed plate: fine streaks along x, a broad sheen from upper left, darker toward the rim
  float brush = n1(q.y * 900. + n1(q.x * 3.) * 4.) * 0.5 + n1(q.y * 2300.) * 0.5;
  float sheen = 0.55 + 0.45 * exp(-3.2 * length(q - vec2(0.28, 0.72)));
  float rim = smoothstep(0., 0.05, min(min(q.x, 1. - q.x), min(q.y, 1. - q.y)));
  vec3 plate = vec3(0.060, 0.066, 0.082) * sheen * (0.86 + 0.14 * brush) * (0.7 + 0.3 * rim);
  // a one-pixel bevel on the plate edge so it reads as a sheet, not a hole
  float near = step(lo.x - 2., px.x) * step(px.x, hi.x + 2.) * step(lo.y - 2., px.y) * step(px.y, hi.y + 2.);
  float edge = near * (1. - smoothstep(0., 1.5, min(min(abs(px.x - lo.x), abs(px.x - hi.x)), min(abs(px.y - lo.y), abs(px.y - hi.y)))));
  vec3 c = mix(ground, plate, inside) + edge * vec3(0.10, 0.10, 0.11);
  float d = (h(px + seed) - h(px.yx + seed * 1.7)) / 255.;   // TPDF dither, one code value peak
  o = vec4(c + d, 1.);
}`;
const VS_G = `#version 300 es
in vec2 pos; in vec3 att; // att: size, tone, glyph (-1 = fine grain)
uniform vec2 res; uniform float pad; uniform float px; uniform vec2 shift; uniform float grow;
out float tone; out float glyph; out float psz;
void main(){
  vec2 s = pad + (pos * 0.5 + 0.5) * (res - 2. * pad);
  s += shift;
  gl_Position = vec4(s / res * 2. - 1., 0., 1.); gl_Position.y = -gl_Position.y;
  psz = px * att.x * grow; gl_PointSize = max(1.5, psz);
  tone = att.y; glyph = att.z;
}`;
const FS_G = `#version 300 es
precision highp float; in float tone; in float glyph; in float psz; out vec4 o;
uniform sampler2D atlas; uniform float cols; uniform float shadow;
void main(){
  if (glyph < -1.5) discard;  // a space in the sentence: an empty grain slot
  vec2 c = gl_PointCoord * 2. - 1.;
  vec3 sandLo = vec3(0.56, 0.47, 0.34), sandHi = vec3(0.93, 0.87, 0.74);
  vec3 base = mix(sandLo, sandHi, tone);
  float a; vec3 col;
  vec3 L = normalize(vec3(-0.45, 0.55, 0.70));
  if (glyph < 0.) {
    float r = length(c);
    float aa = 2.6 / max(psz, 1.);   // about 1.3 device px of coverage ramp at any grain size
    a = 1. - smoothstep(1. - aa, 1., r);
    vec3 n = vec3(c.x, -c.y, sqrt(max(0., 1. - r * r)));
    float lit = 0.62 + 0.55 * max(0., dot(n, L)) + 0.22 * pow(max(0., dot(reflect(-L, n), vec3(0, 0, 1))), 12.);
    col = base * lit;
  } else {
    vec2 cell = vec2(mod(glyph, cols), floor(glyph / cols));
    float m = texture(atlas, (cell + gl_PointCoord) / cols).r;
    a = m;
    float lit = 1.0 + 0.3 * (0.5 - gl_PointCoord.y) - 0.1 * gl_PointCoord.x;
    col = base * lit;
  }
  if (shadow > 0.) { o = vec4(vec3(0.), a * shadow); return; }
  o = vec4(col * a, a);
}`;

function program(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('plate-gl shader: ' + gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('plate-gl link: ' + gl.getProgramInfoLog(p));
  return p;
}

function atlasFor(gl, chars, cell = 64) {
  const list = [...new Set([...chars])], cols = Math.ceil(Math.sqrt(list.length)), c = new OffscreenCanvas(cols * cell, cols * cell), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff';
  x.font = `500 ${Math.round(cell * 0.86)}px Conso, ui-monospace, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
  list.forEach((ch, i) => x.fillText(ch, (i % cols) * cell + cell / 2, Math.floor(i / cols) * cell + cell * 0.54));
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, c.width, c.height, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(x.getImageData(0, 0, c.width, c.height).data.filter((_, i) => i % 4 === 0)));
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { tex, cols, index: new Map(list.map((ch, i) => [ch, i])) };
}

export function createPlateRenderer(canvas, { pad = 34 / 900, chars = 'abc' } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('plate-gl: WebGL2 unavailable');
  const bg = program(gl, VS_BG, FS_BG), gp = program(gl, VS_G, FS_G);
  const tri = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tri); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const atlas = atlasFor(gl, chars);
  const per = new Map(); // sand -> { vao, posBuf, n }
  let dpr = 1, cssPad = pad;

  let forced = 0;  // export size in device px; 0 follows the screen
  function resize() {
    if (forced) { if (canvas.width !== forced) { canvas.width = canvas.height = forced; } cssPad = pad * canvas.width; return; }
    dpr = Math.min(devicePixelRatio || 1, 2.5);
    const w = Math.min(2600, Math.round(canvas.clientWidth * dpr)), h = Math.min(2600, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    cssPad = pad * canvas.width;
  }

  function setFor(sand, glyphs) {
    let s = per.get(sand);
    if (s && s.n === sand.n) return s;
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const posBuf = gl.createBuffer(), attBuf = gl.createBuffer(), att = new Float32Array(sand.n * 3);
    for (let i = 0; i < sand.n; i++) {
      att[i * 3] = sand.size[i]; att[i * 3 + 1] = sand.tone[i];
      const g = sand.glyph[i];
      att[i * 3 + 2] = glyphs ? (g === ' ' ? -2 : atlas.index.get(g) ?? -2) : -1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, attBuf); gl.bufferData(gl.ARRAY_BUFFER, att, gl.STATIC_DRAW);
    const la = gl.getAttribLocation(gp, 'att'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, sand.n * 8, gl.DYNAMIC_DRAW);
    const lp = gl.getAttribLocation(gp, 'pos'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    s = { vao, posBuf, n: sand.n, xy: new Float32Array(sand.n * 2), glyphs };
    per.set(sand, s);
    return s;
  }

  function draw(sets, seed = 0) {
    resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(bg);
    const lb = gl.getAttribLocation(bg, 'p'); gl.bindBuffer(gl.ARRAY_BUFFER, tri); gl.enableVertexAttribArray(lb); gl.vertexAttribPointer(lb, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(bg, 'res'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(bg, 'pad'), cssPad);
    gl.uniform1f(gl.getUniformLocation(bg, 'seed'), seed % 97);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(lb);

    gl.useProgram(gp);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(gl.getUniformLocation(gp, 'res'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(gp, 'pad'), cssPad);
    gl.uniform1f(gl.getUniformLocation(gp, 'cols'), atlas.cols);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlas.tex); gl.uniform1i(gl.getUniformLocation(gp, 'atlas'), 0);
    const uShift = gl.getUniformLocation(gp, 'shift'), uShadow = gl.getUniformLocation(gp, 'shadow'), uPx = gl.getUniformLocation(gp, 'px'), uGrow = gl.getUniformLocation(gp, 'grow');
    const k = forced ? forced / 900 : (canvas.clientWidth ? canvas.width / canvas.clientWidth : dpr);
    const prepared = sets.map(({ sand, glyphs, px }) => {
      const s = setFor(sand, glyphs);
      for (let i = 0; i < sand.n; i++) { s.xy[i * 2] = sand.x[i]; s.xy[i * 2 + 1] = sand.y[i]; }
      gl.bindBuffer(gl.ARRAY_BUFFER, s.posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.xy);
      return { s, px: px * k };
    });
    // pass 1: contact shadows (offset down-right, slightly larger); pass 2: lit grains
    for (const pass of [0, 1]) for (const { s, px } of prepared) {
      gl.bindVertexArray(s.vao);
      gl.uniform1f(uPx, px);
      gl.uniform2f(uShift, pass ? 0 : 0.35 * px, pass ? 0 : 0.45 * px);
      gl.uniform1f(uGrow, pass ? 1 : 1.12);
      gl.uniform1f(uShadow, pass ? 0 : (s.glyphs ? 0.55 : 0.65));
      gl.drawArrays(gl.POINTS, 0, s.n);
    }
    gl.bindVertexArray(null);
  }

  // exportPNG(sets, px): render the same frame at px x px (default 3840, QUALITY-SPEC O1) and return a PNG Blob.
  // Grain sizes scale with the export so the still matches the screen at any size; the screen is restored after.
  async function exportPNG(sets, px = 3840) {
    if (!(px >= 512 && px <= 8192)) throw new RangeError('plate-gl: export size must be 512 to 8192 px');
    forced = Math.min(px, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    try { draw(sets, 7); return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('plate-gl: toBlob gave nothing'))), 'image/png')); }
    finally { forced = 0; draw(sets, 7); }
  }
  resize();
  return { resize, draw, exportPNG, gl, dispose() { per.clear(); } };
}
