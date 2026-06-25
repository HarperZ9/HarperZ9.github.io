// webgl.mjs - WebGL1 backend for render-nd. Pure WebGL; no DOM beyond the passed gl context.
// Draws scene.segments as gl.LINES (additive glow) and scene.points as gl.POINTS (soft round falloff).
// drawSceneGL3D additionally draws depth-tested perspective faces (the volumetric path).
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

// ============================================================================
// drawSceneGL3D - the volumetric path: depth-tested perspective faces + edges + points.
// ============================================================================
// Consumes the output of renderSceneVolumetric: faces (triangles), segments, points, each vertex
// already in NDC (x, y) with a normalized depth in [0,1] (0 = near). We map depth -> clip z in
// [-1, 1] and rely on the GL depth buffer so nearer geometry occludes farther geometry, giving a
// real 3D-plus-volume read (not a flat wireframe on a plane). Faces are translucent and were
// painter-sorted far->near by the builder; we draw them with the depth test enabled but the depth
// WRITE masked off (so translucency composes without z-fighting), then draw opaque-ish edges and
// points with depth writes on. Programs/buffers are compiled once per gl context (separate cache
// from the flat drawSceneGL path, so neither disturbs the other).

const FACE_VERT = `
  attribute vec2 aPos;
  attribute float aDepth;
  attribute vec4 aColor;
  varying vec4 vColor;
  void main() {
    // depth in [0,1] (0 = near) -> clip z in [-1,1].
    gl_Position = vec4(aPos, aDepth * 2.0 - 1.0, 1.0);
    vColor = aColor;
  }
`;
const FACE_FRAG = `
  precision mediump float;
  varying vec4 vColor;
  void main() { gl_FragColor = vColor; }
`;

const LINE3D_VERT = `
  attribute vec2 aPos;
  attribute float aDepth;
  attribute vec4 aColor;
  varying vec4 vColor;
  void main() {
    gl_Position = vec4(aPos, aDepth * 2.0 - 1.0, 1.0);
    vColor = aColor;
  }
`;
const POINT3D_VERT = `
  attribute vec2 aPos;
  attribute float aDepth;
  attribute vec4 aColor;
  attribute float aSize;
  varying vec4 vColor;
  void main() {
    gl_Position = vec4(aPos, aDepth * 2.0 - 1.0, 1.0);
    gl_PointSize = aSize;
    vColor = aColor;
  }
`;

const _cache3d = new WeakMap();
function ctx3d(gl) {
  if (_cache3d.has(gl)) return _cache3d.get(gl);
  const faceProg = createProgram(gl, FACE_VERT, FACE_FRAG);
  const lineProg = createProgram(gl, LINE3D_VERT, LINE_FRAG);
  const pointProg = createProgram(gl, POINT3D_VERT, POINT_FRAG);
  const entry = {
    faceProg, lineProg, pointProg,
    faceBuf: gl.createBuffer(), lineBuf: gl.createBuffer(), pointBuf: gl.createBuffer(),
    faceLocs: {
      aPos: gl.getAttribLocation(faceProg, "aPos"),
      aDepth: gl.getAttribLocation(faceProg, "aDepth"),
      aColor: gl.getAttribLocation(faceProg, "aColor"),
    },
    lineLocs: {
      aPos: gl.getAttribLocation(lineProg, "aPos"),
      aDepth: gl.getAttribLocation(lineProg, "aDepth"),
      aColor: gl.getAttribLocation(lineProg, "aColor"),
    },
    pointLocs: {
      aPos: gl.getAttribLocation(pointProg, "aPos"),
      aDepth: gl.getAttribLocation(pointProg, "aDepth"),
      aColor: gl.getAttribLocation(pointProg, "aColor"),
      aSize: gl.getAttribLocation(pointProg, "aSize"),
    },
  };
  _cache3d.set(gl, entry);
  return entry;
}

export function drawSceneGL3D(gl, scene, { width, height }) {
  gl.viewport(0, 0, width, height);
  gl.clearColor(0.051, 0.106, 0.110, 1.0);   // --void (#0d1b1c)
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const { faceProg, lineProg, pointProg, faceBuf, lineBuf, pointBuf, faceLocs, lineLocs, pointLocs } = ctx3d(gl);

  // --- faces (translucent triangles, painter-sorted; depth test ON, depth WRITE OFF) ---
  if (scene.faces && scene.faces.length > 0) {
    gl.useProgram(faceProg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);   // normal alpha for surface translucency
    gl.depthMask(false);                                  // do not occlude later faces incorrectly
    const stride = 7;   // x, y, depth, r, g, b, a
    const data = new Float32Array(scene.faces.length * 3 * stride);
    let vi = 0;
    for (const f of scene.faces) {
      const r = f.color[0] / 255, g = f.color[1] / 255, b = f.color[2] / 255, a = f.opacity;
      const push = (x, y) => { data[vi++] = x; data[vi++] = y; data[vi++] = f.depth; data[vi++] = r; data[vi++] = g; data[vi++] = b; data[vi++] = a; };
      push(f.x1, f.y1); push(f.x2, f.y2); push(f.x3, f.y3);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, faceBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    const bs = stride * 4;
    gl.enableVertexAttribArray(faceLocs.aPos);
    gl.vertexAttribPointer(faceLocs.aPos, 2, gl.FLOAT, false, bs, 0);
    gl.enableVertexAttribArray(faceLocs.aDepth);
    gl.vertexAttribPointer(faceLocs.aDepth, 1, gl.FLOAT, false, bs, 2 * 4);
    gl.enableVertexAttribArray(faceLocs.aColor);
    gl.vertexAttribPointer(faceLocs.aColor, 4, gl.FLOAT, false, bs, 3 * 4);
    gl.drawArrays(gl.TRIANGLES, 0, scene.faces.length * 3);
    gl.depthMask(true);
  }

  // --- edges (additive glow lines; depth test ON so faces in front occlude them) ---
  if (scene.segments && scene.segments.length > 0) {
    gl.useProgram(lineProg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    const stride = 7;
    const data = new Float32Array(scene.segments.length * 2 * stride);
    let vi = 0;
    for (const s of scene.segments) {
      const r = s.color[0] / 255 * s.opacity, g = s.color[1] / 255 * s.opacity, b = s.color[2] / 255 * s.opacity, a = s.opacity;
      data[vi++] = s.x1; data[vi++] = s.y1; data[vi++] = s.depth; data[vi++] = r; data[vi++] = g; data[vi++] = b; data[vi++] = a;
      data[vi++] = s.x2; data[vi++] = s.y2; data[vi++] = s.depth; data[vi++] = r; data[vi++] = g; data[vi++] = b; data[vi++] = a;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    const bs = stride * 4;
    gl.enableVertexAttribArray(lineLocs.aPos);
    gl.vertexAttribPointer(lineLocs.aPos, 2, gl.FLOAT, false, bs, 0);
    gl.enableVertexAttribArray(lineLocs.aDepth);
    gl.vertexAttribPointer(lineLocs.aDepth, 1, gl.FLOAT, false, bs, 2 * 4);
    gl.enableVertexAttribArray(lineLocs.aColor);
    gl.vertexAttribPointer(lineLocs.aColor, 4, gl.FLOAT, false, bs, 3 * 4);
    gl.drawArrays(gl.LINES, 0, scene.segments.length * 2);
  }

  // --- points (vertices; soft round falloff, additive; depth test ON) ---
  if (scene.points && scene.points.length > 0) {
    gl.useProgram(pointProg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    const stride = 8;   // x, y, depth, r, g, b, a, size
    const data = new Float32Array(scene.points.length * stride);
    let vi = 0;
    for (const pt of scene.points) {
      const r = pt.color[0] / 255 * pt.opacity, g = pt.color[1] / 255 * pt.opacity, b = pt.color[2] / 255 * pt.opacity, a = pt.opacity;
      data[vi++] = pt.x; data[vi++] = pt.y; data[vi++] = pt.depth;
      data[vi++] = r; data[vi++] = g; data[vi++] = b; data[vi++] = a; data[vi++] = pt.size;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    const bs = stride * 4;
    gl.enableVertexAttribArray(pointLocs.aPos);
    gl.vertexAttribPointer(pointLocs.aPos, 2, gl.FLOAT, false, bs, 0);
    gl.enableVertexAttribArray(pointLocs.aDepth);
    gl.vertexAttribPointer(pointLocs.aDepth, 1, gl.FLOAT, false, bs, 2 * 4);
    gl.enableVertexAttribArray(pointLocs.aColor);
    gl.vertexAttribPointer(pointLocs.aColor, 4, gl.FLOAT, false, bs, 3 * 4);
    gl.enableVertexAttribArray(pointLocs.aSize);
    gl.vertexAttribPointer(pointLocs.aSize, 1, gl.FLOAT, false, bs, 7 * 4);
    gl.drawArrays(gl.POINTS, 0, scene.points.length);
  }

  // restore: leave depth test off so the flat path / other GL users are unaffected.
  gl.disable(gl.DEPTH_TEST);
}
