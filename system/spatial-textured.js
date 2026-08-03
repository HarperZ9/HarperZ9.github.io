// system/spatial-textured.js
// The textured hybrid world renderer (reconstruction lane): the spatial
// session's Crystal City pipeline, ported to consume a certified world
// package. Semantic textured depth meshes on a shared grid over a coverage
// backdrop, a depth prepass so atmosphere passes behind structure, and
// selective Gaussian material with material-scoped motion. WebGL1 surface.

import {
  parseSplatRecords,
  clampToBudget,
  buildRunReceipt,
  SPLAT_RECORD_FLOATS,
} from "./engine/world-package.js";
import { clampCamera, sceneTime, pauseMotion, resumeMotion } from "./spatial-core.js";
import { acquireContext } from "./spatial-gl.js";
import { link } from "./spatial-shaders.js";
import {
  CC_BACKDROP_VS, CC_BACKDROP_FS, CC_MESH_VS, CC_MESH_FS,
  CC_DEPTH_FS, CC_POINT_VS, CC_POINT_FS,
} from "./spatial-textured-shaders.js";

const GRID_COLS = 192;
const GRID_ROWS = 240;
const LAYER_MODES = Object.freeze({
  support: 0, deep_sky: 1, haze: 2, celestials: 3, portal: 4,
  city: 5, membrane: 6, beam: 7, water: 8, witness: 9,
});

// Decode the package's raster bytes into bitmaps and luma fields. The bytes
// are the same ones the receipts hashed, so what renders is what was checked.
export async function decodeTexturedAssets(manifest, files) {
  const spec = manifest.textured;
  const bitmap = async (name) =>
    createImageBitmap(new Blob([files[spec.rasters[name]]]));
  const [source, support, backdrop, atmosphere, fieldsBitmap] = await Promise.all([
    bitmap("source"), bitmap("support"), bitmap("backdrop"), bitmap("atmosphere"),
    createImageBitmap(new Blob([files[spec.rasters.fields]])),
  ]);
  const { mask_width: mw, mask_height: mh, field_order: order } = spec;
  const sheet = document.createElement("canvas");
  sheet.width = mw;
  sheet.height = mh * order.length;
  const ctx = sheet.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(fieldsBitmap, 0, 0);
  const fields = {};
  order.forEach((name, index) => {
    const rgba = ctx.getImageData(0, index * mh, mw, mh).data;
    const luma = new Uint8Array(mw * mh);
    for (let i = 0; i < luma.length; i += 1) luma[i] = rgba[i * 4];
    fields[name] = luma;
  });
  return { source, support, backdrop, atmosphere, fields };
}

export async function startTexturedScene(canvas, pkg, opts = {}) {
  const { manifest, files } = pkg;
  const assets = await decodeTexturedAssets(manifest, files);
  const parsed = parseSplatRecords(files[manifest.splats.sidecar], manifest.splats.count);
  const budgeted = clampToBudget(parsed, opts.splatBudget || parsed.count);
  const glOptions = { preserveDrawingBuffer: true, antialias: true, alpha: false, premultipliedAlpha: true };
  const gl = opts.gl || await acquireContext(canvas, "webgl", glOptions);
  if (!gl) throw new Error("WebGL is unavailable on this device");
  const scene = new TexturedScene(canvas, gl, manifest, assets, budgeted, opts);
  scene.start();
  return scene;
}

class TexturedScene {
  constructor(canvas, gl, manifest, assets, splats, opts) {
    this.canvas = canvas;
    this.gl = gl;
    this.manifest = manifest;
    this.spec = manifest.textured;
    this.splats = splats;
    this.controls = { ...this.spec.defaults, ...(opts.controls || {}) };
    this.reducedMotion = !!opts.reducedMotion;
    this.animating = !this.reducedMotion;
    this.motion = { paused: false, pausedAt: 0, offset: 0, freezeAt: this.reducedMotion ? 0.0 : null };
    this.cam = { x: 0, y: 0, z: 0 };
    this.target = { x: 0, y: 0, z: 0 };
    this.stopped = false;
    this.raf = 0;
    this.startStamp = 0;

    // The package renders at its own aspect; the Studio's Fit mode letterboxes.
    canvas.width = this.spec.width;
    canvas.height = this.spec.height;

    this.backdropProgram = link(gl, CC_BACKDROP_VS, CC_BACKDROP_FS, "coverage backdrop");
    this.meshProgram = link(gl, CC_MESH_VS, CC_MESH_FS, "hybrid mesh");
    this.depthProgram = link(gl, CC_MESH_VS, CC_DEPTH_FS, "semantic depth prepass");
    this.pointProgram = link(gl, CC_POINT_VS, CC_POINT_FS, "selective Gaussian atmosphere");

    this.sourceTex = this.imageTex(assets.source);
    this.supportTex = this.imageTex(assets.support);
    this.backdropTex = this.imageTex(assets.backdrop);
    this.atmosphereTex = this.imageTex(assets.atmosphere);
    this.confidenceTex = this.lumaTex(assets.fields.confidence);
    this.maskTex = {};
    this.depthTex = {};
    for (const name of this.spec.color_order) this.maskTex[name] = this.lumaTex(assets.fields[`mask/${name}`]);
    for (const name of [...this.spec.color_order, "support"]) this.depthTex[name] = this.lumaTex(assets.fields[`depth/${name}`]);

    this.buildBuffers();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.010, 0.013, 0.025, 1);
  }

  get splatCount() { return this.splats.count; }
  get splatsDropped() { return this.splats.dropped; }

  imageTex(image) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    return t;
  }

  lumaTex(bytes) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.spec.mask_width, this.spec.mask_height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
    return t;
  }

  buildBuffers() {
    const gl = this.gl;
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const uv = new Float32Array(GRID_COLS * GRID_ROWS * 2);
    let p = 0;
    for (let y = 0; y < GRID_ROWS; y += 1) for (let x = 0; x < GRID_COLS; x += 1) {
      uv[p++] = x / (GRID_COLS - 1);
      uv[p++] = y / (GRID_ROWS - 1);
    }
    const index = new Uint16Array((GRID_COLS - 1) * (GRID_ROWS - 1) * 6);
    p = 0;
    for (let y = 0; y < GRID_ROWS - 1; y += 1) for (let x = 0; x < GRID_COLS - 1; x += 1) {
      const a = y * GRID_COLS + x, b = a + 1, c = a + GRID_COLS, d = c + 1;
      index[p++] = a; index[p++] = c; index[p++] = b;
      index[p++] = b; index[p++] = c; index[p++] = d;
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
    // Every start mounts a fresh canvas, so this canvas is being discarded:
    // release resources AND the context (browsers cap ~16 live contexts).
    this.stopped = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    const gl = this.gl;
    try {
      for (const p of [this.backdropProgram, this.meshProgram, this.depthProgram, this.pointProgram]) gl.deleteProgram(p);
      for (const b of [this.quadBuffer, this.gridVB, this.gridIB, this.pointBuffer]) gl.deleteBuffer(b);
      const textures = [this.sourceTex, this.supportTex, this.backdropTex, this.atmosphereTex, this.confidenceTex,
        ...Object.values(this.maskTex || {}), ...Object.values(this.depthTex || {})];
      for (const t of textures) gl.deleteTexture(t);
    } catch (_) { /* context may already be lost */ }
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) { try { lose.loseContext(); } catch (_) { /* already lost */ } }
  }

  setControl(name, value) {
    if (name in this.controls) this.controls[name] = Number(value);
  }

  setCameraTarget(x, y, z) { this.target = clampCamera({ x, y, z }, this.manifest.camera); }
  nudgeCamera(dx, dy, dz) { this.setCameraTarget(this.target.x + dx, this.target.y + dy, this.target.z + dz); }

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

  setMeshGeometry(program, name, view, proj, time) {
    const gl = this.gl;
    gl.useProgram(program);
    const at = gl.getAttribLocation(program, "aUv");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVB);
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.gridIB);
    gl.uniformMatrix4fv(this.loc(program, "uView"), false, view);
    gl.uniformMatrix4fv(this.loc(program, "uProj"), false, proj);
    gl.uniform1f(this.loc(program, "uTanHalfFov"), Math.tan(Math.PI / 8));
    gl.uniform1f(this.loc(program, "uAspect"), this.spec.width / this.spec.height);
    gl.uniform1f(this.loc(program, "uNearDistance"), 2.3);
    gl.uniform1f(this.loc(program, "uFarDistance"), 6.4);
    gl.uniform1f(this.loc(program, "uTime"), time);
    gl.uniform1f(this.loc(program, "uWaterFlow"), this.controls.waterFlow);
    gl.uniform1f(this.loc(program, "uHazeFlow"), this.controls.atmosphereFlow);
    gl.uniform1f(this.loc(program, "uSkyCurve"), this.controls.skyCurve);
    gl.uniform1i(this.loc(program, "uLayerMode"), LAYER_MODES[name] || 0);
    gl.uniform1i(this.loc(program, "uWater"), name === "water" ? 1 : 0);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex[name]);
    gl.uniform1i(this.loc(program, "uDepth"), 3);
  }

  drawBackdrop(camera, supportMix) {
    const gl = this.gl, p = this.backdropProgram;
    gl.useProgram(p);
    const at = gl.getAttribLocation(p, "aPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    const binds = [[0, this.sourceTex, "uSource"], [1, this.supportTex, "uSupport"], [2, this.backdropTex, "uBackdrop"], [3, this.confidenceTex, "uConfidence"]];
    for (const [unit, tex, name] of binds) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(this.loc(p, name), unit);
    }
    gl.uniform2f(this.loc(p, "uCameraOffset"), -camera.x * 0.22, camera.y * 0.22);
    gl.uniform1f(this.loc(p, "uSupportMix"), supportMix);
    gl.uniform1f(this.loc(p, "uWaterHorizon"), this.spec.water_horizon);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawMesh(name, supportMix, supportPass, view, proj, time) {
    const gl = this.gl, p = this.meshProgram;
    this.setMeshGeometry(p, supportPass ? "support" : name, view, proj, time);
    gl.uniform1i(this.loc(p, "uSource"), 0);
    gl.uniform1i(this.loc(p, "uSupport"), 1);
    gl.uniform1i(this.loc(p, "uAtmosphere"), 2);
    gl.uniform1i(this.loc(p, "uMask"), 4);
    gl.uniform1i(this.loc(p, "uSupportConfidence"), 5);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.supportTex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.atmosphereTex);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, this.confidenceTex);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, supportPass ? this.maskTex.deep_sky : this.maskTex[name]);
    const scale = supportPass
      ? 1.10 + 0.30 * Math.sqrt(Math.max(supportMix, 0))
      : (name === "deep_sky" ? 1.018 : (name === "haze" ? 1.010 : 1.0));
    const c = this.controls;
    const opacity = name === "haze" ? clamp01(c.hazeOpacity * (0.72 + 0.48 * c.atmosphereDensity)) : 1.0;
    const atmosphereMix = name === "haze" ? Math.min(0.92, Math.max(0, 0.38 + 0.34 * c.atmosphereDensity)) : 0;
    gl.uniform1i(this.loc(p, "uUseMask"), supportPass ? 0 : 1);
    gl.uniform1i(this.loc(p, "uSupportPass"), supportPass ? 1 : 0);
    gl.uniform1f(this.loc(p, "uSupportMix"), supportMix);
    gl.uniform1f(this.loc(p, "uCameraAmount"), supportMix);
    gl.uniform1f(this.loc(p, "uAtmosphereMix"), atmosphereMix);
    gl.uniform1f(this.loc(p, "uGeometryScale"), scale);
    gl.uniform1f(this.loc(p, "uOpacity"), opacity);
    gl.uniform1f(this.loc(p, "uTime"), time);
    gl.uniform1f(this.loc(p, "uGlow"), c.glow);
    gl.uniform1f(this.loc(p, "uAtmosphereDensity"), c.atmosphereDensity);
    gl.uniform1f(this.loc(p, "uBeamFlow"), c.beamFlow);
    gl.uniform1f(this.loc(p, "uWaterFlow"), c.waterFlow);
    gl.drawElements(gl.TRIANGLES, this.gridCount, gl.UNSIGNED_SHORT, 0);
  }

  drawDepth(name, view, proj, time) {
    const gl = this.gl, p = this.depthProgram;
    this.setMeshGeometry(p, name, view, proj, time);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex[name]);
    gl.uniform1i(this.loc(p, "uMask"), 4);
    gl.uniform1f(this.loc(p, "uGeometryScale"), 1.0);
    gl.uniform1f(this.loc(p, "uDepthThreshold"), name === "celestials" ? 0.12 : 0.10);
    gl.drawElements(gl.TRIANGLES, this.gridCount, gl.UNSIGNED_SHORT, 0);
  }

  drawPoints(view, proj, time) {
    const gl = this.gl, p = this.pointProgram;
    gl.useProgram(p);
    gl.uniformMatrix4fv(this.loc(p, "uView"), false, view);
    gl.uniformMatrix4fv(this.loc(p, "uProj"), false, proj);
    const c = this.controls;
    gl.uniform1f(this.loc(p, "uTime"), time);
    gl.uniform1f(this.loc(p, "uAtmosphereFlow"), c.atmosphereFlow);
    gl.uniform1f(this.loc(p, "uBeamFlow"), c.beamFlow);
    gl.uniform1f(this.loc(p, "uWaterFlow"), c.waterFlow);
    gl.uniform1f(this.loc(p, "uGlow"), c.glow);
    gl.uniform1f(this.loc(p, "uAtmosphereDensity"), c.atmosphereDensity);
    gl.uniform1f(this.loc(p, "uBokehScale"), c.bokehScale);
    gl.uniform4f(this.loc(p, "uKindVisibilityA"), 1, 1, 1, 1);
    gl.uniform4f(this.loc(p, "uKindVisibilityB"), 1, 1, 1, 1);
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

  frame(wallSeconds) {
    const gl = this.gl;
    // The package renders at its own aspect; the Studio's Fit mode letterboxes
    // the CSS box. Reassert the backing dims if an external sizer changed them
    // (sizeCanvas runs on quality/fullscreen changes and would skew the
    // projection otherwise).
    if (this.canvas.width !== this.spec.width || this.canvas.height !== this.spec.height) {
      this.canvas.width = this.spec.width;
      this.canvas.height = this.spec.height;
    }
    const time = sceneTime(wallSeconds, this.motion);
    for (const k of ["x", "y", "z"]) this.cam[k] += (this.target[k] - this.cam[k]) * 0.12;
    const c = this.cam, par = this.controls.parallax;
    const eye = [c.x * par, c.y * par, c.z * par];
    const view = lookAt(eye, [eye[0], eye[1], eye[2] - 1.0], [0, 1, 0]);
    const proj = perspective(Math.PI / 4, this.spec.width / this.spec.height, 0.1, 20);
    const movement = Math.hypot(c.x, c.y, c.z);
    const supportMix = smoothstep(0.008, 0.115, movement);

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.depthMask(false);
    this.drawBackdrop(c, supportMix);

    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(true);
    this.drawMesh("support", supportMix, true, view, proj, time);

    gl.colorMask(false, false, false, false);
    for (const name of this.spec.structural) this.drawDepth(name, view, proj, time);
    gl.colorMask(true, true, true, true);

    gl.depthMask(false);
    for (const name of this.spec.color_order) this.drawMesh(name, supportMix, false, view, proj, time);
    // Emissive material composites additively, which is order-independent by
    // construction; the buffer order it was drawn in carried no depth meaning.
    gl.blendFunc(gl.ONE, gl.ONE);
    this.drawPoints(view, proj, time);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function lookAt(eye, center, up) {
  const z = normalize([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}
function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

export default { startTexturedScene, decodeTexturedAssets };
