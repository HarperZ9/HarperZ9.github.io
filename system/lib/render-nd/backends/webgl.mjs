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

function uploadBuffer(gl, data) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
  return buf;
}

// --- Main export ---

/**
 * drawSceneGL(gl, scene, { width, height })
 * Renders scene.segments (gl.LINES) and scene.points (gl.POINTS) into the given WebGL1 context.
 * Colors are premultiplied (color/255 * opacity) for additive blending.
 */
export function drawSceneGL(gl, scene, { width, height }) {
  gl.viewport(0, 0, width, height);
  gl.clearColor(0.04, 0.05, 0.06, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive glow

  // --- Draw segments as LINES ---
  if (scene.segments && scene.segments.length > 0) {
    const prog = createProgram(gl, LINE_VERT, LINE_FRAG);
    gl.useProgram(prog);

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

    const buf = uploadBuffer(gl, verts);
    const byteStride = stride * 4;
    const aPos = gl.getAttribLocation(prog, "aPos");
    const aColor = gl.getAttribLocation(prog, "aColor");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, byteStride, 0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, byteStride, 2 * 4);

    gl.drawArrays(gl.LINES, 0, scene.segments.length * 2);
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
  }

  // --- Draw points as POINTS ---
  if (scene.points && scene.points.length > 0) {
    const prog = createProgram(gl, POINT_VERT, POINT_FRAG);
    gl.useProgram(prog);

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

    const buf = uploadBuffer(gl, verts);
    const byteStride = stride * 4;
    const aPos = gl.getAttribLocation(prog, "aPos");
    const aColor = gl.getAttribLocation(prog, "aColor");
    const aSize = gl.getAttribLocation(prog, "aSize");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, byteStride, 0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, byteStride, 2 * 4);
    gl.enableVertexAttribArray(aSize);
    gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, byteStride, 6 * 4);

    gl.drawArrays(gl.POINTS, 0, scene.points.length);
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
  }
}
