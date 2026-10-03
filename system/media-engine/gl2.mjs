// system/media-engine/gl2.mjs
// Small WebGL2 helpers shared by every GPU plugin: one context policy, one full-screen
// triangle, one program builder that reports compile logs instead of throwing.

export const FULLSCREEN_VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

export function getGL2(canvas, attrs = {}) {
  try {
    return canvas.getContext("webgl2", {
      alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false,
      powerPreference: "high-performance", ...attrs,
    });
  } catch (_) { return null; }
}

export function program(gl, fs, vs = FULLSCREEN_VS) {
  const make = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh); gl.deleteShader(sh);
      throw new Error("media-engine shader compile failed: " + log);
    }
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, make(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(prog, 0, "p");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("media-engine link failed: " + gl.getProgramInfoLog(prog));
  const loc = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(prog, i); loc[u.name] = gl.getUniformLocation(prog, u.name); }
  return { prog, loc };
}

// One oversized triangle covers the viewport with three vertices and no seam.
export function fullscreenTriangle(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return { draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); }, dispose() { gl.deleteBuffer(buf); gl.deleteVertexArray(vao); } };
}

export function texture(gl, w, h, { filter = gl.NEAREST, internal = gl.RGBA8, format = gl.RGBA, type = gl.UNSIGNED_BYTE } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (w && h) gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  return t;
}

export function target(gl, w, h, opts) {
  const tex = texture(gl, w, h, opts);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h, ok, dispose() { gl.deleteFramebuffer(fb); gl.deleteTexture(tex); } };
}
