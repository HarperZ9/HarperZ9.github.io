// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// gl.js: the small WebGL2 kit the three materials share. A full-screen triangle, programs, float and sRGB textures,
// render targets. Browser only; every caller has a Canvas 2D path when getContext('webgl2') returns null.

export const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

// GLSL helpers shared by every fragment shader: sRGB transfer, exact Fresnel, the environment of glass.js.
export const COMMON = `
vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float fresnel(float ci, float n1, float n2) {
  ci = min(1.0, abs(ci)); float s = (n1 / n2) * (n1 / n2) * (1.0 - ci * ci); if (s >= 1.0) return 1.0;
  float ct = sqrt(1.0 - s), rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct), rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci);
  return 0.5 * (rs * rs + rp * rp);
}
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
`;

export function context(canvas, opts = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, ...opts }); // still plates keep their picture for screenshots and print
  if (!gl) return null;
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');
  return { gl, buf, progs: new Map() };
}

export function program(K, fs, key = fs) {
  if (K.progs.has(key)) return K.progs.get(key);
  const { gl } = K, sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(`gl: shader: ${gl.getShaderInfoLog(o)}`); return o; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`gl: link: ${gl.getProgramInfoLog(p)}`);
  const loc = new Map(), P = { p, u: n => { if (!loc.has(n)) loc.set(n, gl.getUniformLocation(p, n)); return loc.get(n); } };
  K.progs.set(key, P); return P;
}

// Texture from a Float32Array with 1 to 4 channels (16-bit float storage, linear filtering, edge or repeat wrap).
export function floatTex(K, w, h, data, ch = 4, { wrap = 'clamp', filter = 'linear', tex = null } = {}) {
  const { gl } = K, F = [null, [gl.R16F, gl.RED], [gl.RG16F, gl.RG], [gl.RGB16F, gl.RGB], [gl.RGBA16F, gl.RGBA]][ch];
  const t = tex ?? gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, F[0], w, h, 0, F[1], gl.FLOAT, data);
  params(gl, wrap, filter); return t;
}
// Texture from an image, canvas, video or ImageData, stored as sRGB so sampling returns linear light.
export function imageTex(K, src, { wrap = 'clamp', tex = null } = {}) {
  const { gl } = K, t = tex ?? gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
  params(gl, wrap, 'linear'); return t;
}
function params(gl, wrap, filter) {
  const W = wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE, Fi = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, W); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, W);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, Fi); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, Fi);
}
// An sRGB render target (so a pass can feed the next one in linear light without 8-bit banding in the darks).
export function target(K, w, h) {
  const { gl } = K, tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); params(gl, 'clamp', 'linear');
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h };
}

// Run one full-screen pass. textures: { name: texture }, uniforms: { name: number | number[] }.
export function pass(K, P, { out = null, w, h, textures = {}, uniforms = {} }) {
  const { gl } = K; gl.bindFramebuffer(gl.FRAMEBUFFER, out?.fb ?? null); gl.viewport(0, 0, w, h); gl.useProgram(P.p);
  gl.bindBuffer(gl.ARRAY_BUFFER, K.buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  let unit = 0;
  for (const [n, t] of Object.entries(textures)) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(P.u(n), unit++); }
  uniforms = { u_linearOut: out ? 1 : 0, ...uniforms };
  for (const [n, v] of Object.entries(uniforms)) {
    const l = P.u(n); if (l === null) continue;
    if (typeof v === 'number') gl.uniform1f(l, v); else if (v.length > 4) gl.uniform4fv(l, v); else [, gl.uniform1fv, gl.uniform2fv, gl.uniform3fv, gl.uniform4fv][v.length].call(gl, l, v);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
