// lib/gl.js: the small WebGL2 kit the living stills and wigglegrams share. One full-screen triangle, one program,
// textures from images or fields. Returns null wherever WebGL2 is missing, so every caller keeps a CPU path.

export function context(canvas) {
  try {
    return canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true, alpha: true });
  } catch (e) { console.warn('alive gl: WebGL2 unavailable', e.message); return null; }
}

export function program(gl, fragSrc) {
  const vs = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }`;
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('alive gl: shader failed: ' + log); }
    return s;
  };
  const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fragSrc)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('alive gl: link failed: ' + gl.getProgramInfoLog(pr));
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uni = {}; const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(pr, i); uni[u.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(pr, u.name); }
  return { pr, vao, uni };
}

// Upload an RGBA image ({w,h,data}) or an HTMLImageElement / bitmap / canvas.
export function texture(gl, src, unit = 0, { linear = true } = {}) {
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  if (src.data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, src.w, src.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(src.data.buffer, src.data.byteOffset, src.data.length));
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
  const f = linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// Pack up to four 0..1 fields into one RGBA8 texture source (depth, wind mask, water mask, spare).
export function packFields(fields) {
  const { w, h } = fields[0], data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) for (let k = 0; k < 4; k++) data[i * 4 + k] = fields[k] ? Math.round(fields[k].data[i] * 255) : 0;
  return { w, h, data };
}

// GLSL twin of lib/img.js hash01 and vnoise, bit for bit on the integer hash (uint arithmetic wraps like Math.imul).
export const GLSL_NOISE = `
float hash01(int seed, int k){
  uint h = (uint(seed) * 0x9e3779b1u) ^ (uint(k) * 0x85ebca77u);
  h = (h ^ (h >> 16u)) * 0x7feb352du; h = (h ^ (h >> 15u)) * 0x846ca68bu;
  return float(h ^ (h >> 16u)) / 4294967296.0;
}
float vnoise(vec2 q, int seed){
  vec2 i = floor(q), f = q - i, u = f * f * (3.0 - 2.0 * f);
  int xi = int(i.x), yi = int(i.y);
  float a = hash01(seed, (xi * 73856093) ^ (yi * 19349663)), b = hash01(seed, ((xi + 1) * 73856093) ^ (yi * 19349663));
  float c = hash01(seed, (xi * 73856093) ^ ((yi + 1) * 19349663)), d = hash01(seed, ((xi + 1) * 73856093) ^ ((yi + 1) * 19349663));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}`;
