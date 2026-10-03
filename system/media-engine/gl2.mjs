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

// Free a context's GPU resources now instead of at garbage collection. Browsers cap live contexts
// (about 16 in Chromium), so a probe or a disposed instance should not hold one.
export function releaseContext(gl) {
  try {
    const ext = gl && gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();
  } catch (e) { console.error("[media-engine] could not release a WebGL context:", e); }
}

// Can this browser make a WebGL context of this type? Asked once per page per type; the probe
// context is released at once, so availability checks never leave a live context behind.
const probes = new Map();
export function probeWebGL(type = "webgl") {
  if (probes.has(type)) return probes.get(type);
  let ok = false;
  try {
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      const gl = c.getContext(type) || (type === "webgl" ? c.getContext("experimental-webgl") : null);
      ok = !!gl;
      if (gl) releaseContext(gl);
    }
  } catch (_) { ok = false; }   // no WebGL is a real, reported state
  probes.set(type, ok);
  return ok;
}

// One WebGL2 context per page for the engine's GPU work. Each user draws into the bottom-left
// w x h region of the shared drawing buffer and copies that region into its own 2D canvas in the
// same task (blit), so the page holds one context however many instances draw. The backing grows
// to the largest region asked for and never shrinks, so users of different sizes do not reallocate
// it every frame. Every user sets its own program, framebuffer, viewport and texture bindings.
let shared = null;
export function sharedGL2() {
  if (shared && !shared.gl.isContextLost()) return shared;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1; canvas.height = 1;
  const gl = getGL2(canvas);
  if (!gl) return null;
  shared = {
    gl, canvas,
    fit(w, h) {
      if (canvas.width < w || canvas.height < h) { canvas.width = Math.max(canvas.width, w); canvas.height = Math.max(canvas.height, h); }
    },
    // The region the last draw left at the bottom-left of the buffer, top-down, into ctx at (dx, dy).
    blit(ctx, w, h, dx = 0, dy = 0) { ctx.drawImage(canvas, 0, canvas.height - h, w, h, dx, dy, w, h); },
  };
  return shared;
}
