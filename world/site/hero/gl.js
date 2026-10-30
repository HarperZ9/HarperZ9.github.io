// gl.js: the small WebGL2 helpers the hero uses (programs, half-float targets, a full-screen triangle pair).
export function program(gl, vs, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error("hero shader: " + log); }
    return s;
  };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("hero link: " + gl.getProgramInfoLog(p));
  const loc = new Map(), u = (name) => { if (!loc.has(name)) loc.set(name, gl.getUniformLocation(p, name)); return loc.get(name); };
  return { p, u };
}
export function quad(gl) {
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return () => { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
}
export function texture(gl, w, h, { internal = gl.RGBA16F, format = gl.RGBA, type = gl.HALF_FLOAT, data = null, wrap = gl.CLAMP_TO_EDGE, filter = gl.LINEAR } = {}) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return t;
}
export function target(gl, w, h, opts) {
  const tex = texture(gl, w, h, opts), fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) throw new Error("hero: half-float target incomplete");
  return { tex, fb, w, h, free() { gl.deleteTexture(tex); gl.deleteFramebuffer(fb); } };
}
// GPU time per frame where EXT_disjoint_timer_query_webgl2 exists (most desktop browsers hide it; then null)
export function gpuTimer(gl) {
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2"); if (!ext) return null;
  const pending = []; let last = null;
  return {
    begin() { if (pending.length > 3) return null; const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); return q; },
    end(q) { if (!q) return; gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q); },
    poll() {
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift(); if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) last = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(q);
      }
      return last;
    },
  };
}
