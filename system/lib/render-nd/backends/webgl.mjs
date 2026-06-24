// webgl.mjs — WebGL1 backend for render-nd. Pure WebGL; no DOM beyond the passed gl context.
// Draws scene.segments as gl.LINES (additive glow) and scene.points as gl.POINTS (soft round falloff).
// Zero external dependencies.

// --- Shader sources ---

const LINE_VERT = `
  attribute vec2 aPos;
  attribute vec4 aColor;
  varying vec4 vColor;
  void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
    vColor = aColor;
  }
`;
const LINE_FRAG = `
  precision mediump float;
  varying vec4 vColor;
  void main() {
    gl_FragColor = vColor;
  }
`;

const POINT_VERT = `
  attribute vec2 aPos;
  attribute vec4 aColor;
  attribute float aSize;
  varying vec4 vColor;
  void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
    gl_PointSize = aSize;
    vColor = aColor;
  }
`;
const POINT_FRAG = `
  precision mediump float;
  varying vec4 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = vColor.a * (1.0 - smoothstep(0.25, 0.5, d));
    gl_FragColor = vec4(vColor.rgb, alpha);
  }
`;

// --- Shader/program helpers ---

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("Shader compile error: " + log);
  }
  return sh;
}

function createProgram(gl, vertSrc, fragSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error("Program link error: " + log);
  }
  return prog;
}

// --- Per-context cache: compile programs and allocate buffers ONCE per gl context ---

const _cache = new WeakMap();

function ctx(gl) {
  if (_cache.has(gl)) return _cache.get(gl);

  const lineProg = createProgram(gl, LINE_VERT, LINE_FRAG);
  const pointProg = createProgram(gl, POINT_VERT, POINT_FRAG);

  const lineBuf = gl.createBuffer();
  const pointBuf = gl.createBuffer();

  const entry = {
    lineProg,
    pointProg,
    lineBuf,
    pointBuf,
    lineLocs: {
      aPos:   gl.getAttribLocation(lineProg, "aPos"),
      aColor: gl.getAttribLocation(lineProg, "aColor"),
    },
    pointLocs: {
      aPos:   gl.getAttribLocation(pointProg, "aPos"),
      aColor: gl.getAttribLocation(pointProg, "aColor"),
      aSize:  gl.getAttribLocation(pointProg, "aSize"),
    },
  };

  _cache.set(gl, entry);
  return entry;
}

// --- Main export ---

/**
 * drawSceneGL(gl, scene, { width, height })
 * Renders scene.segments (gl.LINES) and scene.points (gl.POINTS) into the given WebGL1 context.
 * Colors are premultiplied (color/255 * opacity) for additive blending.
 * Programs and buffers are compiled/created once per gl context and reused across calls.
 */
export function drawSceneGL(gl, scene, { width, height }) {
  gl.viewport(0, 0, width, height);
  gl.clearColor(0.04, 0.05, 0.06, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive glow

  const { lineProg, pointProg, lineBuf, pointBuf, lineLocs, pointLocs } = ctx(gl);

  // --- Draw segments as LINES ---
  if (scene.segments && scene.segments.length > 0) {
    gl.useProgram(lineProg);

    // Interleaved: x, y, r, g, b, a — 2 vertices per segment
    const stride = 6; // floats per vertex
    const verts = new Float32Array(scene.segments.length * 2 * stride);
    let vi = 0;
    for (const seg of scene.segments) {
      const r = seg.color[0] / 255 * seg.opacity;
      const g = seg.color[1] / 255 * seg.opacity;
      const b = seg.color[2] / 255 * seg.opacity;
      const a = seg.opacity;
      verts[vi++] = seg.x1; verts[vi++] = seg.y1; verts[vi++] = r; verts[vi++] = g; verts[vi++] = b; verts[vi++] = a;
      verts[vi++] = seg.x2; verts[vi++] = seg.y2; verts[vi++] = r; verts[vi++] = g; verts[vi++] = b; verts[vi++] = a;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW);

    const byteStride = stride * 4;
    gl.enableVertexAttribArray(lineLocs.aPos);
    gl.vertexAttribPointer(lineLocs.aPos, 2, gl.FLOAT, false, byteStride, 0);
    gl.enableVertexAttribArray(lineLocs.aColor);
    gl.vertexAttribPointer(lineLocs.aColor, 4, gl.FLOAT, false, byteStride, 2 * 4);

    gl.drawArrays(gl.LINES, 0, scene.segments.length * 2);
  }

  // --- Draw points as POINTS ---
  if (scene.points && scene.points.length > 0) {
    gl.useProgram(pointProg);

    // Interleaved: x, y, r, g, b, a, size — 1 vertex per point
    const stride = 7;
    const verts = new Float32Array(scene.points.length * stride);
    let vi = 0;
    for (const pt of scene.points) {
      const r = pt.color[0] / 255 * pt.opacity;
      const g = pt.color[1] / 255 * pt.opacity;
      const b = pt.color[2] / 255 * pt.opacity;
      const a = pt.opacity;
      verts[vi++] = pt.x; verts[vi++] = pt.y;
      verts[vi++] = r; verts[vi++] = g; verts[vi++] = b; verts[vi++] = a;
      verts[vi++] = pt.size;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW);

    const byteStride = stride * 4;
    gl.enableVertexAttribArray(pointLocs.aPos);
    gl.vertexAttribPointer(pointLocs.aPos, 2, gl.FLOAT, false, byteStride, 0);
    gl.enableVertexAttribArray(pointLocs.aColor);
    gl.vertexAttribPointer(pointLocs.aColor, 4, gl.FLOAT, false, byteStride, 2 * 4);
    gl.enableVertexAttribArray(pointLocs.aSize);
    gl.vertexAttribPointer(pointLocs.aSize, 1, gl.FLOAT, false, byteStride, 6 * 4);

    gl.drawArrays(gl.POINTS, 0, scene.points.length);
  }
}
