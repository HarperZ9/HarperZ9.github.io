// system/spatial-atlas.js
// The Spatial Atlas renderer: NGSF v5 quantized anisotropic Gaussian scenes
// (32-byte records: position, log-scale, quaternion, rgb, opacity, angular
// support, semantic layer, importance, view-response), instanced-quad
// splatting with the covariance axes projected through the warp field, CPU
// back-to-front sort, and an orbit camera. Ported from the spatial session's
// Native Gaussian Splat Atlas v0.5.0 runtime. WebGL2 required; the caller
// shows a labeled fallback when it is absent.

import { buildRunReceipt } from "./engine/world-package.js";
import { acquireContext } from "./spatial-gl.js";

const ATLAS_VS = `#version 300 es
precision highp float; precision highp int;
layout(location=0) in vec2 aCorner; layout(location=1) in vec3 aMean; layout(location=2) in vec3 aScale; layout(location=3) in vec4 aQuat; layout(location=4) in vec3 aColor; layout(location=5) in float aOpacity; layout(location=6) in vec4 aMeta; layout(location=7) in vec3 aViewCoeff;
uniform mat4 uView; uniform mat4 uProjection; uniform float uSplatScale; uniform float uDepthScale; uniform int uMode; uniform float uTime;
uniform vec3 uInvCenter; uniform float uInvRadius; uniform float uInvStrength; uniform float uInvExponent; uniform float uInvShell; uniform float uInvThickness; uniform float uInvTwist; uniform float uInvInner; uniform float uInvOuter;
uniform float uHoloStrength;
out vec2 vCorner; out vec3 vColor; out float vOpacity; out vec4 vMeta; out vec3 vNormal; out vec3 vViewCoeff;
vec3 qrot(vec4 q,vec3 v){return v+2.0*cross(q.yzw,cross(q.yzw,v)+q.x*v);}
vec3 rotY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
vec3 warp(vec3 p){p.z*=uDepthScale;
 if(uMode==1){vec3 q=p-uInvCenter;float r=max(length(q),1e-4);float angle=uInvTwist*(1.0/(r+.22)-1.0);q=rotY(q,angle);float k=pow(uInvRadius/r,2.0*uInvExponent);vec3 inv=uInvCenter+q*k;float sr=uInvRadius+tanh((r-uInvRadius)*3.2)*uInvThickness;vec3 shell=uInvCenter+normalize(q)*sr;vec3 target=mix(inv,shell,uInvShell);p=mix(p,target,uInvStrength);}
 else if(uMode==3){float w=sin(p.x*7.0+uTime*1.7)+sin(p.y*6.0-uTime*1.1)+sin((p.x+p.y)*4.0+uTime*.7);p.z+=w*uHoloStrength*.11;p.x+=sin(p.y*5.0+uTime)*uHoloStrength*.05;}
 return p;}
void main(){
 vec3 base0=vec3(aMean.xy,aMean.z*uDepthScale);float originalR=length(base0-uInvCenter);
 if(uMode==1&&(originalR<uInvInner||originalR>uInvOuter)){gl_Position=vec4(2.0,2.0,2.0,1.0);vCorner=vec2(0);vColor=vec3(0);vOpacity=0.0;vMeta=vec4(0);vNormal=vec3(0,0,1);vViewCoeff=vec3(0);return;}
 vec3 p=warp(aMean);
 vec3 ax0=qrot(aQuat,vec3(aScale.x,0,0));vec3 ay0=qrot(aQuat,vec3(0,aScale.y,0));vec3 n0=normalize(qrot(aQuat,vec3(0,0,1)));
 vec3 ax=warp(aMean+ax0)-p;vec3 ay=warp(aMean+ay0)-p;
 vec4 cp=uProjection*uView*vec4(p,1);vec4 cax=uProjection*uView*vec4(p+ax,1);vec4 cay=uProjection*uView*vec4(p+ay,1);
 vec2 ndc=cp.xy/cp.w;vec2 dx=cax.xy/cax.w-ndc;vec2 dy=cay.xy/cay.w-ndc;
 vec2 finalNdc=ndc+(aCorner.x*dx+aCorner.y*dy)*uSplatScale;
 gl_Position=vec4(finalNdc*cp.w,cp.z,cp.w);
 vCorner=aCorner;vColor=aColor;vOpacity=aOpacity;vMeta=aMeta;vNormal=n0;vViewCoeff=aViewCoeff;}`;

const ATLAS_FS = `#version 300 es
precision highp float; precision highp int;
in vec2 vCorner; in vec3 vColor; in float vOpacity; in vec4 vMeta; in vec3 vNormal; in vec3 vViewCoeff;
uniform float uOpacityScale; uniform float uExposure; uniform float uGamma; uniform int uMode; uniform float uIridescence; uniform float uTime;
out vec4 outColor;
void main(){
 float r2=dot(vCorner,vCorner);if(r2>1.0)discard;
 float a=exp(-3.7*r2)*vOpacity*uOpacityScale;if(a<.008)discard;
 vec3 c=vColor;float ndv=clamp(abs(vNormal.z),0.,1.);c+=vViewCoeff*(ndv-.5);
 if(uMode==3){float phase=dot(normalize(vNormal+vec3(.001)),normalize(vec3(vCorner,.8)))+uTime*.08;c=mix(c,.5+.5*cos(vec3(0,2.1,4.2)+phase*6.283),clamp(uIridescence*.45,0.,.82));}
 c=pow(max(c*uExposure,vec3(0)),vec3(1.0/uGamma));
 outColor=vec4(c*a,a);}`;

function halfLikeScale(u) { return Math.exp((u / 65535) * 8 - 9); }

// NGSF v5: 16-byte header (NGS5, version u16, stride u16, count u32) then
// 32-byte records. Refuses torn or mislabeled models.
export function parseNGSF(buffer) {
  const v = new DataView(buffer);
  if (buffer.byteLength < 16) throw new Error("NGSF model is shorter than its header");
  const magic = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
  if (magic !== "NGS5") throw new Error(`Unsupported model magic: ${magic}`);
  const version = v.getUint16(4, true), stride = v.getUint16(6, true), count = v.getUint32(8, true);
  if (version !== 5 || stride !== 32) throw new Error(`Unsupported NGSF layout v${version}/${stride}`);
  if (16 + count * stride !== buffer.byteLength) throw new Error("NGSF byte count does not match its header");
  const means = new Float32Array(count * 3), scales = new Float32Array(count * 3),
    quats = new Float32Array(count * 4), colors = new Float32Array(count * 3),
    opacity = new Float32Array(count), meta = new Float32Array(count * 4),
    viewCoeff = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const o = 16 + i * stride;
    means[i * 3] = v.getInt16(o, true) / 32767 * 2.5;
    means[i * 3 + 1] = v.getInt16(o + 2, true) / 32767 * 2.5;
    means[i * 3 + 2] = v.getInt16(o + 4, true) / 32767 * 2.5;
    scales[i * 3] = halfLikeScale(v.getUint16(o + 6, true));
    scales[i * 3 + 1] = halfLikeScale(v.getUint16(o + 8, true));
    scales[i * 3 + 2] = halfLikeScale(v.getUint16(o + 10, true));
    let q0 = v.getInt16(o + 12, true) / 32767, q1 = v.getInt16(o + 14, true) / 32767,
      q2 = v.getInt16(o + 16, true) / 32767, q3 = v.getInt16(o + 18, true) / 32767;
    const qn = Math.hypot(q0, q1, q2, q3) || 1;
    quats.set([q0 / qn, q1 / qn, q2 / qn, q3 / qn], i * 4);
    colors[i * 3] = v.getUint8(o + 20) / 255;
    colors[i * 3 + 1] = v.getUint8(o + 21) / 255;
    colors[i * 3 + 2] = v.getUint8(o + 22) / 255;
    opacity[i] = v.getUint8(o + 23) / 255;
    meta[i * 4] = v.getUint8(o + 24) / 21;      /* angular support */
    meta[i * 4 + 1] = v.getUint8(o + 25);       /* semantic layer */
    meta[i * 4 + 2] = v.getUint8(o + 26) / 255; /* importance */
    meta[i * 4 + 3] = v.getUint8(o + 27);       /* flags */
    viewCoeff[i * 3] = v.getInt8(o + 28) / 127;
    viewCoeff[i * 3 + 1] = v.getInt8(o + 29) / 127;
    viewCoeff[i * 3 + 2] = v.getInt8(o + 30) / 127;
  }
  return { count, means, scales, quats, colors, opacity, meta, viewCoeff };
}

// Keep the highest-importance records under a budget: the quantized format
// carries per-splat importance exactly for this tiering.
export function orderByImportance(scene, budget) {
  const limit = Math.min(scene.count, Math.max(200, Math.floor(budget || scene.count)));
  const indices = Array.from({ length: scene.count }, (_, i) => i)
    .sort((a, b) => scene.meta[b * 4 + 2] - scene.meta[a * 4 + 2])
    .slice(0, limit);
  return { indices, dropped: scene.count - indices.length };
}

function gather(scene, indices) {
  const n = indices.length;
  const out = {
    count: n,
    means: new Float32Array(n * 3), scales: new Float32Array(n * 3),
    quats: new Float32Array(n * 4), colors: new Float32Array(n * 3),
    opacity: new Float32Array(n), meta: new Float32Array(n * 4),
    viewCoeff: new Float32Array(n * 3),
  };
  indices.forEach((src, dst) => {
    out.means.set(scene.means.subarray(src * 3, src * 3 + 3), dst * 3);
    out.scales.set(scene.scales.subarray(src * 3, src * 3 + 3), dst * 3);
    out.quats.set(scene.quats.subarray(src * 4, src * 4 + 4), dst * 4);
    out.colors.set(scene.colors.subarray(src * 3, src * 3 + 3), dst * 3);
    out.opacity[dst] = scene.opacity[src];
    out.meta.set(scene.meta.subarray(src * 4, src * 4 + 4), dst * 4);
    out.viewCoeff.set(scene.viewCoeff.subarray(src * 3, src * 3 + 3), dst * 3);
  });
  return out;
}

const norm3 = (v) => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clampN = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

export async function startAtlasScene(canvas, pkg, opts = {}) {
  const gl = opts.gl || await acquireContext(canvas, "webgl2", { antialias: false, alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error("The Spatial Atlas needs WebGL2; this device reports none. The hybrid worlds still run.");
  const scene = new AtlasScene(canvas, gl, pkg, opts);
  await scene.loadScene(opts.sceneId || pkg.manifest.scenes[0].id);
  scene.start();
  return scene;
}

class AtlasScene {
  constructor(canvas, gl, pkg, opts) {
    this.canvas = canvas;
    this.gl = gl;
    this.manifest = pkg.manifest;
    this.baseUrl = pkg.baseUrl;
    this.splatBudget = Number(opts.splatBudget) || Infinity;
    this.reducedMotion = !!opts.reducedMotion;
    this.animating = !this.reducedMotion;
    this.onSceneLoaded = typeof opts.onSceneLoaded === "function" ? opts.onSceneLoaded : null;
    this.mode = 0;
    // Defaults tuned visually against the original Atlas standalone: closer
    // framing, slight lift, and a brighter response so the field carries the
    // artwork's presence instead of reading as gauze.
    this.controls = { splatScale: 1.12, depthScale: 1, opacityScale: 1.0, exposure: 1.18, gamma: 2.2, holoStrength: 0.08, iridescence: 0.42 };
    this.inv = { center: [0, 0, -0.08], radius: 0.86, strength: 1, exponent: 1, shell: 0.24, thickness: 0.28, twist: 0, inner: 0.04, outer: 2.8 };
    this.yaw = 0; this.pitch = 0; this.targetYaw = 0; this.targetPitch = 0;
    this.distance = 2.55; this.target = [0, -0.12, 0];
    this.stopped = false; this.raf = 0; this.sortTimer = 0;
    this.view = new Float32Array(16); this.projection = new Float32Array(16);
    this.setup();
  }

  get splatCount() { return this.activeCount || 0; }
  get splatsDropped() { return this.droppedCount || 0; }
  get sceneList() { return this.manifest.scenes; }

  setup() {
    const gl = this.gl;
    const make = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader error");
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, make(gl.VERTEX_SHADER, ATLAS_VS));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, ATLAS_FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link error");
    this.program = p;
    gl.useProgram(p);
    this.uniform = {};
    for (const n of ["uView", "uProjection", "uSplatScale", "uDepthScale", "uMode", "uTime", "uInvCenter", "uInvRadius", "uInvStrength", "uInvExponent", "uInvShell", "uInvThickness", "uInvTwist", "uInvInner", "uInvOuter", "uHoloStrength", "uOpacityScale", "uExposure", "uGamma", "uIridescence"]) {
      this.uniform[n] = gl.getUniformLocation(p, n);
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.buffers = {};
    const attrs = [[1, "means", 3], [2, "scales", 3], [3, "quats", 4], [4, "colors", 3], [5, "opacity", 1], [6, "meta", 4], [7, "viewCoeff", 3]];
    for (const [loc, name, size] of attrs) {
      const b = gl.createBuffer();
      this.buffers[name] = b;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
    this.bindPointers();
  }

  async loadScene(sceneId) {
    const meta = this.manifest.scenes.find((s) => s.id === sceneId);
    if (!meta) throw new Error(`unknown atlas scene: ${sceneId}`);
    const url = this.baseUrl + meta.model;
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`${meta.model}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let verdict = "UNVERIFIABLE";
    if (globalThis.crypto && crypto.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      verdict = hex === this.manifest.receipts[meta.model] ? "MATCH" : "DRIFT";
    }
    if (verdict === "DRIFT") throw new Error(`${meta.model}: receipt DRIFT; refusing to render`);
    const parsed = parseNGSF(bytes.buffer);
    const { indices, dropped } = orderByImportance(parsed, this.splatBudget);
    this.fullScene = parsed;
    this.droppedCount = dropped;
    this.currentMeta = meta;
    this.sceneVerdict = verdict;
    this.sortAndUpload(indices);
    if (this.onSceneLoaded) this.onSceneLoaded(meta, verdict, indices.length, dropped);
    return { meta, verdict };
  }

  sortAndUpload(baseIndices) {
    const scene = this.fullScene;
    const frame = this.cameraFrame();
    const ds = this.controls.depthScale;
    const order = baseIndices.slice().sort((a, b) => {
      const za = dot3([scene.means[a * 3] - frame.eye[0], scene.means[a * 3 + 1] - frame.eye[1], scene.means[a * 3 + 2] * ds - frame.eye[2]], frame.forward);
      const zb = dot3([scene.means[b * 3] - frame.eye[0], scene.means[b * 3 + 1] - frame.eye[1], scene.means[b * 3 + 2] * ds - frame.eye[2]], frame.forward);
      return zb - za;
    });
    this.baseIndices = baseIndices;
    const gathered = gather(scene, order);
    const gl = this.gl;
    for (const k of ["means", "scales", "quats", "colors", "opacity", "meta", "viewCoeff"]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[k]);
      gl.bufferData(gl.ARRAY_BUFFER, gathered[k], gl.DYNAMIC_DRAW);
    }
    this.activeCount = gathered.count;
  }

  scheduleSort() {
    clearTimeout(this.sortTimer);
    this.sortTimer = setTimeout(() => { if (!this.stopped && this.baseIndices) this.sortAndUpload(this.baseIndices); }, 90);
  }

  cameraFrame() {
    const eye = [
      this.target[0] + Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      this.target[1] + Math.sin(this.pitch) * this.distance,
      this.target[2] + Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
    ];
    const forward = norm3([this.target[0] - eye[0], this.target[1] - eye[1], this.target[2] - eye[2]]);
    const right = norm3(cross3(forward, [0, 1, 0]));
    const up = cross3(right, forward);
    return { eye, forward, right, up };
  }

  bindPointers() {
    const c = this.canvas;
    c.style.touchAction = "none";
    let dragging = false, lastX = 0, lastY = 0;
    c.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      this.targetYaw = clampN(this.targetYaw + (e.clientX - lastX) * 0.0032, -1.25, 1.25);
      this.targetPitch = clampN(this.targetPitch + (e.clientY - lastY) * 0.0028, -0.72, 0.72);
      lastX = e.clientX; lastY = e.clientY;
      this.scheduleSort();
    });
    const end = () => { if (dragging) { dragging = false; this.scheduleSort(); } };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("wheel", (e) => { e.preventDefault(); this.distance = clampN(this.distance + e.deltaY * 0.0018, 0.18, 7.5); this.scheduleSort(); }, { passive: false });
    c.addEventListener("dblclick", () => { this.targetYaw = this.targetPitch = 0; this.distance = 2.55; this.target = [0, -0.12, 0]; this.scheduleSort(); });
  }

  setControl(name, value) {
    if (name === "mode") { this.mode = Number(value) | 0; return; }
    if (name in this.controls) this.controls[name] = Number(value);
    if (name === "depthScale") this.scheduleSort();
  }

  setPaused(paused) { this.paused = paused; }

  receipt() {
    return buildRunReceipt(this.manifest, {
      splatsDrawn: this.activeCount,
      splatsDropped: this.droppedCount,
      controls: {
        ...this.controls, mode: this.mode,
        scene: this.currentMeta && this.currentMeta.id,
        scene_verdict: this.sceneVerdict,
        camera: { yaw: this.yaw, pitch: this.pitch, distance: this.distance },
      },
    });
  }

  start() {
    this.startStamp = performance.now();
    const step = (now) => {
      if (this.stopped) return;
      this.frame(now - this.startStamp);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop() {
    // Every start mounts a fresh canvas, so this canvas is being discarded:
    // release resources AND the context (browsers cap ~16 live contexts).
    this.stopped = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    clearTimeout(this.sortTimer);
    const gl = this.gl;
    try {
      gl.deleteProgram(this.program);
      for (const b of Object.values(this.buffers)) gl.deleteBuffer(b);
      gl.deleteVertexArray(this.vao);
    } catch (_) { /* context may already be lost */ }
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) { try { lose.loseContext(); } catch (_) { /* already lost */ } }
  }

  frame(elapsedMs) {
    const gl = this.gl;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.viewport(0, 0, w, h);
    this.yaw += (this.targetYaw - this.yaw) * 0.12;
    this.pitch += (this.targetPitch - this.pitch) * 0.12;
    const f = this.cameraFrame();
    this.view.set([f.right[0], f.up[0], -f.forward[0], 0, f.right[1], f.up[1], -f.forward[1], 0, f.right[2], f.up[2], -f.forward[2], 0, -dot3(f.right, f.eye), -dot3(f.up, f.eye), dot3(f.forward, f.eye), 1]);
    const fov = 58 * Math.PI / 180, fp = 1 / Math.tan(fov / 2), near = 0.015, far = 60;
    this.projection.fill(0);
    this.projection[0] = fp / (w / h); this.projection[5] = fp;
    this.projection[10] = (far + near) / (near - far); this.projection[11] = -1;
    this.projection[14] = 2 * far * near / (near - far);
    gl.clearColor(0.006, 0.005, 0.009, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    gl.useProgram(this.program);
    const u = this.uniform, c = this.controls, inv = this.inv;
    gl.uniformMatrix4fv(u.uView, false, this.view);
    gl.uniformMatrix4fv(u.uProjection, false, this.projection);
    gl.uniform1f(u.uSplatScale, c.splatScale);
    gl.uniform1f(u.uDepthScale, c.depthScale);
    gl.uniform1i(u.uMode, this.mode);
    gl.uniform1f(u.uTime, this.paused ? 0 : elapsedMs * 0.001 * 0.55);
    gl.uniform3fv(u.uInvCenter, inv.center);
    gl.uniform1f(u.uInvRadius, inv.radius);
    gl.uniform1f(u.uInvStrength, inv.strength);
    gl.uniform1f(u.uInvExponent, inv.exponent);
    gl.uniform1f(u.uInvShell, inv.shell);
    gl.uniform1f(u.uInvThickness, inv.thickness);
    gl.uniform1f(u.uInvTwist, inv.twist);
    gl.uniform1f(u.uInvInner, inv.inner);
    gl.uniform1f(u.uInvOuter, inv.outer);
    gl.uniform1f(u.uHoloStrength, c.holoStrength);
    gl.uniform1f(u.uOpacityScale, c.opacityScale);
    // EV mapping: the slider value feeds the shader as 2^((v-1)*1.6) so the
    // knob has real authority; a linear multiplier was flattened by gamma
    // into a barely visible range (found by the piecewise sweep).
    gl.uniform1f(u.uExposure, Math.pow(2, (c.exposure - 1) * 1.6));
    gl.uniform1f(u.uGamma, c.gamma);
    gl.uniform1f(u.uIridescence, c.iridescence);
    gl.bindVertexArray(this.vao);
    if (this.activeCount) gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.activeCount);
    gl.bindVertexArray(null);
  }
}

export default { startAtlasScene, parseNGSF, orderByImportance };
