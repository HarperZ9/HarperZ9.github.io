// lib/gl.js: the least WebGL2 needed for a full-screen fragment pass with a few textures. No dependencies.
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

export function createGL(cv) {
  const gl = cv.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const api = {
    gl,
    program(fs) {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(pr));
      return { pr, loc: n => gl.getUniformLocation(pr, n) };
    },
    // texture from an image/canvas, or from { data: Float32Array|Uint8Array, w, h, channels }
    texture(src, o = {}) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      if (src.data) {
        const ch = src.channels || 4, fmt = [null, gl.RED, gl.RG, gl.RGB, gl.RGBA][ch];
        const ifmt = src.data instanceof Float32Array ? [null, gl.R16F, gl.RG16F, gl.RGB16F, gl.RGBA16F][ch] : [null, gl.R8, gl.RG8, gl.RGB8, gl.RGBA8][ch];
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, src.w, src.h, 0, fmt, src.data instanceof Float32Array ? gl.FLOAT : gl.UNSIGNED_BYTE, src.data);
      } else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const filt = o.nearest ? gl.NEAREST : gl.LINEAR;
      if (o.mip) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, o.mip ? gl.LINEAR_MIPMAP_LINEAR : filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, o.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, o.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      return t;
    },
    draw(prog, uniforms = {}, textures = {}) {
      gl.viewport(0, 0, cv.width, cv.height); gl.useProgram(prog.pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      let unit = 0;
      for (const [name, tex] of Object.entries(textures)) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.loc(name), unit++); }
      for (const [name, v] of Object.entries(uniforms)) {
        const l = prog.loc(name); if (!l) continue;
        if (typeof v === 'number') gl.uniform1f(l, v); else if (v.length === 2) gl.uniform2f(l, ...v); else if (v.length === 3) gl.uniform3f(l, ...v); else gl.uniform4f(l, ...v);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
  return api;
}

// Float textures need this extension to be filterable; without it we fall back to 8-bit data.
export const floatLinear = gl => !!gl.getExtension('OES_texture_float_linear');
