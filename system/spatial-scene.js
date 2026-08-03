// system/spatial-scene.js
// The hybrid spatial renderer: coverage backdrop, seed-derived veil layers on
// a shared grid with a depth prepass, and selective Gaussian material with
// material-scoped motion. Consumes a certified world package and exports a
// run receipt. WebGL1 surface throughout; the caller owns the canvas node.

import {
  validateWorldPackage,
  parseSplatRecords,
  clampToBudget,
  buildRunReceipt,
  SPLAT_RECORD_FLOATS,
} from "./engine/world-package.js";
import {
  veilParams,
  clampCamera,
  drawOrder,
  sceneTime,
  pauseMotion,
  resumeMotion,
} from "./spatial-core.js";
import {
  BACKDROP_VS, BACKDROP_FS, VEIL_VS, VEIL_FS, POINT_VS, POINT_FS, link,
} from "./spatial-shaders.js";

const GRID_COLS = 96;
const GRID_ROWS = 96;

const DEFAULT_CONTROLS = Object.freeze({
  parallax: 0.7,
  drift: 0.35,
  glow: 0.5,
  water: 0.25,
});

export async function startSpatialScene(canvas, pkg, opts = {}) {
  const verdict = validateWorldPackage(pkg.manifest);
  if (!verdict.ok) {
    throw new Error(`world package refused: ${verdict.failureCode} at ${verdict.field}`);
  }
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false })
    || canvas.getContext("experimental-webgl");
  if (!gl) throw new Error("WebGL is unavailable on this device");

  const parsed = parseSplatRecords(pkg.splatBytes, pkg.manifest.splats.count);
  const budgeted = clampToBudget(parsed, opts.splatBudget || parsed.count);
  const scene = new SpatialScene(canvas, gl, pkg.manifest, budgeted, opts);
  scene.start();
  return scene;
}

class SpatialScene {
  constructor(canvas, gl, manifest, splats, opts) {
    this.canvas = canvas;
    this.gl = gl;
    this.manifest = manifest;
    this.splats = splats;
    this.controls = { ...DEFAULT_CONTROLS, ...(opts.controls || {}) };
    this.reducedMotion = !!opts.reducedMotion;
    this.animating = !this.reducedMotion;
    this.motion = { paused: false, pausedAt: 0, offset: 0, freezeAt: this.reducedMotion ? 0.0 : null };
    this.cam = { x: 0, y: 0, z: 0 };
    this.target = { x: 0, y: 0, z: 0 };
    this.veils = drawOrder(veilParams(manifest.seed, manifest.layers));
    this.onFrame = typeof opts.onFrame === "function" ? opts.onFrame : null;
    this.raf = 0;
    this.stopped = false;
    this.startStamp = 0;

    this.backdropProgram = link(gl, BACKDROP_VS, BACKDROP_FS, "spatial backdrop");
    this.veilProgram = link(gl, VEIL_VS, VEIL_FS, "spatial veil");
    this.pointProgram = link(gl, POINT_VS, POINT_FS, "spatial points");
    this.buildBuffers();
  }

  get splatCount() { return this.splats.count; }
  get splatsDropped() { return this.splats.dropped; }

  buildBuffers() {
    const gl = this.gl;
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const uv = new Float32Array(GRID_COLS * GRID_ROWS * 2);
    let p = 0;
    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLS; x += 1) {
        uv[p++] = x / (GRID_COLS - 1);
        uv[p++] = y / (GRID_ROWS - 1);
      }
    }
    const index = new Uint16Array((GRID_COLS - 1) * (GRID_ROWS - 1) * 6);
    p = 0;
    for (let y = 0; y < GRID_ROWS - 1; y += 1) {
      for (let x = 0; x < GRID_COLS - 1; x += 1) {
        const a = y * GRID_COLS + x, b = a + 1, c = a + GRID_COLS, d = c + 1;
        index[p++] = a; index[p++] = c; index[p++] = b;
        index[p++] = b; index[p++] = c; index[p++] = d;
      }
    }
    this.gridCount = index.length;
    this.gridVB = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVB);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    this.gridIB = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.gridIB);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);

    this.pointBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.splats.data, gl.STATIC_DRAW);
  }

  start() {
    this.startStamp = performance.now();
    const step = (now) => {
      if (this.stopped) return;
      this.frame((now - this.startStamp) / 1000);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop() {
    this.stopped = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    const lose = this.gl.getExtension("WEBGL_lose_context");
    if (lose) { try { lose.loseContext(); } catch (_) { /* already lost */ } }
  }

  setControl(name, value) {
    if (name in this.controls) this.controls[name] = Number(value);
  }

  setCameraTarget(x, y, z) {
    this.target = clampCamera({ x, y, z }, this.manifest.camera);
  }

  nudgeCamera(dx, dy, dz) {
    this.setCameraTarget(this.target.x + dx, this.target.y + dy, this.target.z + dz);
  }

  setPaused(paused) {
    const wall = (performance.now() - this.startStamp) / 1000;
    this.motion = paused ? pauseMotion(wall, this.motion) : resumeMotion(wall, this.motion);
  }

  receipt() {
    return buildRunReceipt(this.manifest, {
      splatsDrawn: this.splats.count,
      splatsDropped: this.splats.dropped,
      controls: { ...this.controls, camera: { ...this.cam } },
    });
  }

  loc(program, name) { return this.gl.getUniformLocation(program, name); }

  frame(wallSeconds) {
    const gl = this.gl;
    const time = sceneTime(wallSeconds, this.motion);
    for (const k of ["x", "y", "z"]) this.cam[k] += (this.target[k] - this.cam[k]) * 0.12;

    const w = this.canvas.width, h = this.canvas.height;
    const aspect = w / Math.max(1, h);
    const par = this.controls.parallax;
    const eye = [this.cam.x * par, this.cam.y * par, this.cam.z * par];
    const view = lookAt(eye, [eye[0], eye[1], eye[2] - 1], [0, 1, 0]);
    const proj = perspective(Math.PI / 4, aspect, 0.1, 20);

    gl.viewport(0, 0, w, h);
    gl.clearColor(0.010, 0.012, 0.022, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.depthMask(false);
    this.drawBackdrop(time);

    // Depth prepass: the near veil writes depth where its folds are bright, so
    // dust and stars genuinely pass behind the near light. Color stays off.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.colorMask(false, false, false, false);
    const nearVeil = this.veils[this.veils.length - 1];
    this.drawVeil(nearVeil, view, proj, time, aspect, true);
    gl.colorMask(true, true, true, true);

    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const veil of this.veils) this.drawVeil(veil, view, proj, time, aspect, false);
    this.drawPoints(view, proj, time, aspect, h);

    if (this.onFrame) this.onFrame({ time, camera: { ...this.cam } });
  }

  drawBackdrop(time) {
    const gl = this.gl, p = this.backdropProgram;
    gl.useProgram(p);
    const at = gl.getAttribLocation(p, "aPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(this.loc(p, "uTime"), time);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawVeil(veil, view, proj, time, aspect, depthOnly) {
    const gl = this.gl, p = this.veilProgram;
    gl.useProgram(p);
    const at = gl.getAttribLocation(p, "aUv");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVB);
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.gridIB);
    gl.uniformMatrix4fv(this.loc(p, "uView"), false, view);
    gl.uniformMatrix4fv(this.loc(p, "uProj"), false, proj);
    gl.uniform1f(this.loc(p, "uDepth"), veil.depth);
    gl.uniform1f(this.loc(p, "uAspect"), aspect);
    gl.uniform1f(this.loc(p, "uTime"), time);
    gl.uniform1f(this.loc(p, "uFoldFreq"), veil.foldFreq);
    gl.uniform1f(this.loc(p, "uFoldPhase"), veil.foldPhase);
    gl.uniform1f(this.loc(p, "uFoldTilt"), veil.foldTilt);
    gl.uniform1f(this.loc(p, "uDriftRate"), veil.driftRate);
    gl.uniform1f(this.loc(p, "uEdgeSoft"), veil.edgeSoft);
    gl.uniform1f(this.loc(p, "uGlow"), this.controls.glow);
    gl.uniform1f(this.loc(p, "uDrift"), this.controls.drift);
    gl.uniform3f(this.loc(p, "uTint"), veil.tint[0], veil.tint[1], veil.tint[2]);
    gl.uniform1i(this.loc(p, "uDepthOnly"), depthOnly ? 1 : 0);
    gl.drawElements(gl.TRIANGLES, this.gridCount, gl.UNSIGNED_SHORT, 0);
  }

  drawPoints(view, proj, time, aspect, backingHeight) {
    const gl = this.gl, p = this.pointProgram;
    gl.useProgram(p);
    gl.uniformMatrix4fv(this.loc(p, "uView"), false, view);
    gl.uniformMatrix4fv(this.loc(p, "uProj"), false, proj);
    gl.uniform1f(this.loc(p, "uTime"), time);
    gl.uniform1f(this.loc(p, "uAspect"), aspect);
    gl.uniform1f(this.loc(p, "uDrift"), this.controls.drift);
    gl.uniform1f(this.loc(p, "uWater"), this.controls.water);
    gl.uniform1f(this.loc(p, "uGlow"), this.controls.glow);
    gl.uniform1f(this.loc(p, "uPixelScale"), backingHeight / 720);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);
    const stride = SPLAT_RECORD_FLOATS * 4;
    const attribs = [["iPosition", 3, 0], ["iColor", 3, 12], ["iSize", 1, 24], ["iAlpha", 1, 28], ["iKind", 1, 32], ["iSeed", 1, 36]];
    for (const [name, size, offset] of attribs) {
      const at = gl.getAttribLocation(p, name);
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, size, gl.FLOAT, false, stride, offset);
    }
    gl.drawArrays(gl.POINTS, 0, this.splats.count);
  }
}

function lookAt(eye, center, up) {
  const z = normalize([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export default { startSpatialScene };
