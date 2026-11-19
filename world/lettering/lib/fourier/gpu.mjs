// lib/fourier/gpu.mjs: one batched draw for every contour on the canvas, with a 2D canvas fallback.
// Fills use the stencil method for any polygon: every contour becomes a fan of triangles from its first point, all
// contours go in one buffer and one draw that counts winding in the stencil (front faces add, back faces subtract),
// then one quad paints where the count is not zero. That is the nonzero rule, which overlapping contours need.
// Lines (the machine's arms, the oscilloscope's beam) go in one more draw per colour.
//   const r = makeRenderer(canvas, k)    k: device pixels per work pixel
//   r.begin(); r.fill(polys, rgba); r.lines(segs, rgba); r.end()      polys: [Float64Array [x0, y0, ...]] in work px
const VS = `#version 300 es
in vec2 p; uniform vec2 u_s; void main(){ gl_Position = vec4(p * u_s * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0); }`;
const FS = `#version 300 es
precision mediump float; uniform vec4 u_c; out vec4 o; void main(){ o = vec4(u_c.rgb * u_c.a, u_c.a); }`;

export function makeRenderer(canvas, k, { prefer = 'gpu' } = {}) {
  const gl = prefer === 'gpu' ? canvas.getContext('webgl2', { stencil: true, antialias: true, premultipliedAlpha: true, alpha: true }) : null;
  return gl ? glRenderer(gl, canvas, k) : ctxRenderer(canvas.getContext('2d'), canvas, k);
}

function glRenderer(gl, canvas, k) {
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('fourier gpu: ' + gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  const buf = gl.createBuffer(), uS = gl.getUniformLocation(pr, 'u_s'), uC = gl.getUniformLocation(pr, 'u_c'), aP = gl.getAttribLocation(pr, 'p');
  let data = new Float32Array(1 << 16);
  const upload = (n) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n), gl.STREAM_DRAW); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0); };
  const grow = (n) => { if (n > data.length) data = new Float32Array(1 << Math.ceil(Math.log2(n))); };
  return {
    kind: 'gpu', draws: 0,
    begin() {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.useProgram(pr); gl.uniform2f(uS, k / canvas.width, k / canvas.height); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); this.draws = 0;
    },
    fill(polys, c) {
      let n = 0; for (const p of polys) n += Math.max(0, p.length / 2 - 2) * 6; grow(n + 12);
      let o = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of polys) {
        const m = p.length / 2, ax = p[0], ay = p[1];
        for (let i = 1; i + 1 < m; i++) { data[o++] = ax; data[o++] = ay; data[o++] = p[2 * i]; data[o++] = p[2 * i + 1]; data[o++] = p[2 * i + 2]; data[o++] = p[2 * i + 3]; }
        for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
      }
      if (!o) return;
      data.set([x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1], o);
      upload(o + 12);
      gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false); gl.stencilFunc(gl.ALWAYS, 0, 0xff);
      gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
      gl.drawArrays(gl.TRIANGLES, 0, o / 2);
      gl.colorMask(true, true, true, true); gl.stencilFunc(gl.NOTEQUAL, 0, 0xff); gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);
      gl.uniform4f(uC, c[0], c[1], c[2], c[3]); gl.drawArrays(gl.TRIANGLES, o / 2, 6); gl.disable(gl.STENCIL_TEST); this.draws += 2;
    },
    lines(segs, c) { if (!segs.length) return; grow(segs.length); data.set(segs); upload(segs.length); gl.uniform4f(uC, c[0], c[1], c[2], c[3]); gl.drawArrays(gl.LINES, 0, segs.length / 2); this.draws++; },
    end() {},
    dispose() { gl.deleteBuffer(buf); gl.deleteProgram(pr); },
  };
}

function ctxRenderer(ctx, canvas, k) {
  const css = (c) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3]})`;
  return {
    kind: '2d', draws: 0,
    begin() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.setTransform(k, 0, 0, k, 0, 0); this.draws = 0; },
    fill(polys, c) {
      const path = new Path2D();
      for (const p of polys) { path.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) path.lineTo(p[i], p[i + 1]); path.closePath(); }
      ctx.fillStyle = css(c); ctx.fill(path, 'nonzero'); this.draws++;
    },
    lines(segs, c) {
      if (!segs.length) return; ctx.beginPath();
      for (let i = 0; i < segs.length; i += 4) { ctx.moveTo(segs[i], segs[i + 1]); ctx.lineTo(segs[i + 2], segs[i + 3]); }
      ctx.strokeStyle = css(c); ctx.lineWidth = 1 / k; ctx.stroke(); this.draws++;
    },
    end() {}, dispose() {},
  };
}
