// fractal3d-pro.js: the progressive 3D fractal renderer (WebGL2).
//
// Each animation frame adds one jittered sample per pixel to a float target (fractal3d-pro-glsl.js)
// while the camera holds still, so the view converges to an anti-aliased, depth-of-field image;
// any camera or parameter change starts the sum again. The camera is raw-native's explorer camera
// (media/raw-native, vendored and pinned), with the Worlds source's controls: wheel-click or left
// drag to orbit, right or shift drag to pan, wheel to zoom, W A S D and Q E to fly, double-click
// to focus (the lens focuses there too), R to reset.
//
// render3DPro(canvas, opts) returns the same handle as fractal3d.js's render3D, plus setParams(),
// stats() and ownsInput (its controls are bound here, so the Studio's own 3D drag handlers stand
// aside). It throws when WebGL2 is missing, and the Studio then falls back to fractal3d.js.

import { OrbitCamera, bindControls } from "../media/raw-native/web-f2cd6e9/camera.mjs";
import { VERT3, buildSampleProgram, buildDisplayProgram } from "./fractal3d-pro-glsl.js";
import { PALETTES } from "./fractal.js";
import { preparePalette } from "./fractal-color.js";

export const KINDS = ["mandelbox", "mandelbulb", "surf", "menger", "kleinian", "hybrid"];

const DEFAULTS = {
  type: "mandelbox", seq: ["box", "bulb"], iterations: 12, scale: -2, power: 8, fold: 1, minR: 0.5, fixedR: 1,
  kSize: [0.92436, 0.90756, 0.92436], kInv: 1.0, mScale: 3,
  palette: "bone", trapScale: 0.6, trapOffset: 0, roughness: 0.45, metalness: 0.0,
  sunAz: 40, sunEl: 50, shadowK: 12, ao: 1, fog: 0.004, glow: 0.4, aperture: 0, focus: 0,
  exposure: 1.5, bg: 0, maxSamples: 64, maxSteps: 220, fudge: 0.9, turntable: true,
};

// Camera framing per formula: distance from the target and the far plane.
const FRAME = { mandelbox: [9, 30], mandelbulb: [3.2, 8], surf: [8, 30], menger: [4, 12], kleinian: [2.2, 10], hybrid: [7, 30] };

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error("3D fractal shader compile failed: " + gl.getShaderInfoLog(sh));
  return sh;
}
function link(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT3));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "p");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("3D fractal link failed: " + gl.getProgramInfoLog(p));
  return p;
}

// Halton (2, 3): low-discrepancy sub-pixel and lens positions, so few samples cover the area evenly.
function halton(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }

export function render3DPro(canvas, opts = {}) {
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
  if (!gl) throw new Error("the progressive 3D renderer needs WebGL2");
  const floatTarget = !!gl.getExtension("EXT_color_buffer_float") && !!gl.getExtension("EXT_float_blend");
  let p = { ...DEFAULTS, ...opts };
  const kind = () => (KINDS.includes(p.type) ? p.type : "mandelbox");
  const cam = new OrbitCamera({ target: [0, 0, 0], distance: FRAME[kind()][0], yaw: 0.6, pitch: 0.35, fov: 0.85, minDistance: 0.05, maxDistance: 60 });
  let progs = null, progKey = "";
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  let fbo = null, tex = null, fw = 0, fh = 0, pick = null;
  let samples = 0, lastKey = "", raf = 0, stopped = false, last = 0, held = false, holdUntil = 0, frameMs = 0;
  const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function programs() {
    const key = kind() + "|" + (kind() === "hybrid" ? p.seq.join(",") : "");
    if (progs && progKey === key) return progs;
    if (progs) { gl.deleteProgram(progs.sample); }
    const sample = link(gl, buildSampleProgram(kind(), kind() === "hybrid" ? p.seq : null));
    const display = progs ? progs.display : link(gl, buildDisplayProgram());
    progs = { sample, display, uS: (n) => gl.getUniformLocation(sample, n), uD: (n) => gl.getUniformLocation(display, n) };
    progKey = key;
    return progs;
  }

  function target(w, h) {
    if (fbo && fw === w && fh === h) return;
    if (tex) gl.deleteTexture(tex);
    if (fbo) gl.deleteFramebuffer(fbo);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, floatTarget ? gl.RGBA32F : gl.RGBA8, w, h, 0, gl.RGBA, floatTarget ? gl.FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    fw = w; fh = h; samples = 0;
  }

  function palette() {
    const { lab } = preparePalette(Array.isArray(p.gradient) && p.gradient.length >= 2 ? p.gradient : (PALETTES[p.palette] || PALETTES.bone));
    const out = new Float32Array(48);
    lab.slice(0, 16).forEach((s, i) => out.set(s, i * 3));
    return { pal: out, n: Math.min(16, lab.length) };
  }

  function setUniforms(P, w, h, jitter, lens) {
    const u = P.uS;
    const [, far] = FRAME[kind()];
    const cu = cam.uniforms();
    gl.uniform2f(u("u_resolution"), w, h);
    gl.uniform3f(u("u_eye"), cu[0], cu[1], cu[2]);
    gl.uniform1f(u("u_tanHalf"), cu[3]);
    gl.uniform3f(u("u_fwd"), cu[4], cu[5], cu[6]);
    gl.uniform3f(u("u_right"), cu[8], cu[9], cu[10]);
    gl.uniform3f(u("u_up"), cu[12], cu[13], cu[14]);
    gl.uniform1f(u("u_aperture"), p.aperture * cam.distance * 0.02);
    gl.uniform1f(u("u_focus"), p.focus > 0 ? p.focus : cam.distance);
    gl.uniform2f(u("u_jitter"), jitter[0], jitter[1]);
    gl.uniform2f(u("u_lens"), lens[0], lens[1]);
    gl.uniform1i(u("u_iterations"), Math.max(1, Math.min(40, Math.round(p.iterations))));
    gl.uniform1i(u("u_maxSteps"), Math.max(16, Math.min(1024, Math.round(p.maxSteps))));
    gl.uniform1f(u("u_maxDist"), Math.max(far, cam.distance * 3));
    gl.uniform1f(u("u_fudge"), p.fudge);
    const az = p.sunAz * Math.PI / 180, el = p.sunEl * Math.PI / 180;
    gl.uniform3f(u("u_sunDir"), Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    gl.uniform3f(u("u_sunColor"), 4.6, 4.1, 3.5);
    gl.uniform3f(u("u_skyColor"), 0.42, 0.58, 0.86);
    gl.uniform3f(u("u_groundColor"), 0.06, 0.05, 0.045);
    gl.uniform1f(u("u_shadowK"), p.shadowK);
    gl.uniform1f(u("u_aoStrength"), p.ao);
    gl.uniform1f(u("u_roughness"), Math.max(0.03, p.roughness));
    gl.uniform1f(u("u_metalness"), p.metalness);
    gl.uniform1f(u("u_trapScale"), p.trapScale);
    gl.uniform1f(u("u_trapOffset"), p.trapOffset);
    gl.uniform1f(u("u_glow"), p.glow);
    gl.uniform3f(u("u_glowColor"), 0.35, 0.55, 1.0);
    gl.uniform1f(u("u_fog"), p.fog);
    gl.uniform3f(u("u_fogColor"), 0.07, 0.08, 0.11);
    gl.uniform1i(u("u_bgMode"), p.bg);
    gl.uniform1i(u("u_depthOut"), 0);
    gl.uniform1f(u("u_boxScale"), p.scale);
    gl.uniform1f(u("u_boxFold"), p.fold);
    gl.uniform1f(u("u_minR2"), p.minR * p.minR);
    gl.uniform1f(u("u_fixedR2"), p.fixedR * p.fixedR);
    gl.uniform1f(u("u_power"), p.power);
    gl.uniform3f(u("u_kSize"), p.kSize[0], p.kSize[1], p.kSize[2]);
    gl.uniform1f(u("u_kInv"), p.kInv);
    gl.uniform1f(u("u_mScale"), p.mScale);
    const pal = palette();
    gl.uniform3fv(u("u_pal[0]"), pal.pal);
    gl.uniform1i(u("u_palN"), pal.n);
  }

  function drawFull(prog) {
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Everything that, when it changes, makes the accumulated samples stale.
  function stateKey() { return JSON.stringify([Array.from(cam.uniforms()), p, canvas.width, canvas.height]); }

  function frame(ts) {
    raf = 0;
    if (stopped) return;
    if (!canvas.isConnected) { stop(); return; }
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 1 / 60;
    last = ts;
    if (ctl) ctl.keys(dt);
    const idle = !held && ts > holdUntil && (!ctl || ctl.idle() > 1400);
    cam.step(dt, { tour: p.turntable && !reduceMotion && idle });
    const w = canvas.width, h = canvas.height;
    const P = programs();
    target(w, h);
    const key = stateKey();
    if (key !== lastKey) { samples = 0; lastKey = key; }
    const t0 = performance.now();
    if (samples < (floatTarget ? p.maxSamples : 1)) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, w, h);
      if (samples === 0) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      if (floatTarget) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); }
      const i = samples + 1;
      const jitter = samples === 0 ? [0, 0] : [halton(i, 2) - 0.5, halton(i, 3) - 0.5];
      const r = Math.sqrt(halton(i, 5)), a = 2 * Math.PI * halton(i, 7);
      gl.useProgram(P.sample);
      setUniforms(P, w, h, jitter, [r * Math.cos(a), r * Math.sin(a)]);
      drawFull(P.sample);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      samples++;
      gl.viewport(0, 0, w, h);
      gl.useProgram(P.display);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(P.uD("u_acc"), 0);
      gl.uniform1f(P.uD("u_exposure"), p.exposure);
      drawFull(P.display);
      frameMs = performance.now() - t0;
    }
    raf = requestAnimationFrame(frame);
  }

  // Double-click: march the one ray under the pointer on the GPU (the sample program in its depth
  // mode, drawn into a 1 x 1 target), then move the camera toward what it hit and focus the lens
  // there.
  function pickAt(x, y) {
    if (!floatTarget) return;
    const P = programs();
    if (!pick) {
      const ptex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, ptex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const pf = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, pf);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ptex, 0);
      pick = { ptex, pf };
    }
    const w = canvas.width, h = canvas.height;
    // The one fragment of a 1 x 1 viewport sits at (0.5, 0.5); the jitter moves it onto the pixel.
    const px = (x * 0.5 + 0.5) * w, py = (y * 0.5 + 0.5) * h;
    gl.bindFramebuffer(gl.FRAMEBUFFER, pick.pf);
    gl.viewport(0, 0, 1, 1);
    gl.useProgram(P.sample);
    setUniforms(P, w, h, [px - 0.5, py - 0.5], [0, 0]);
    gl.uniform1f(P.uS("u_aperture"), 0);
    gl.uniform1i(P.uS("u_depthOut"), 1);
    drawFull(P.sample);
    gl.uniform1i(P.uS("u_depthOut"), 0);
    const out = new Float32Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const t = out[0];
    if (!(t > 0)) return;   // the ray met nothing
    const ray = cam.ray(x, y, w / h);
    const point = ray.origin.map((o, i) => o + ray.dir[i] * t);
    // The camera eases onto the point as its new target, and the lens focuses at the target
    // distance (focus 0), so the point stays sharp as the camera arrives.
    cam.focus(point, Math.max(cam.minDistance, t * 0.7));
    p = { ...p, focus: 0 };
    lastFocus = { point, t };
  }
  let lastFocus = null;

  let ctl = null;
  try { ctl = bindControls(canvas, cam, { onPick: pickAt, onInput: () => { holdUntil = performance.now() + 1400; } }); } catch (e) { console.warn("[fractal3d] controls not bound:", e); }
  raf = requestAnimationFrame(frame);

  function stop() {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (ctl) { try { ctl.detach(); } catch (_) { /* element gone */ } ctl = null; }
    try {
      if (progs) { gl.deleteProgram(progs.sample); gl.deleteProgram(progs.display); }
      if (tex) gl.deleteTexture(tex);
      if (fbo) gl.deleteFramebuffer(fbo);
      gl.deleteBuffer(buf);
    } catch (_) { /* context may be gone */ }
  }

  return {
    stop,
    ownsInput: !!ctl,
    orbit: (dx, dy) => cam.orbit(dx * 0.006, -dy * 0.006),
    dolly: (f) => cam.zoom(f),
    beginInteract: () => { held = true; },
    endInteract: () => { held = false; holdUntil = performance.now() + 1400; },
    reset: () => { cam.reset(); },
    state: () => ({ yaw: cam.yaw, pitch: cam.pitch, dist: cam.distance, target: [...cam.target] }),
    setParams: (next) => {
      const prevKind = kind();
      p = { ...p, ...next };
      if (kind() !== prevKind) cam.setHome({ target: [0, 0, 0], distance: FRAME[kind()][0], yaw: 0.6, pitch: 0.35 });
    },
    stats: () => ({ samples, maxSamples: floatTarget ? p.maxSamples : 1, frameMs, progressive: floatTarget, focus: lastFocus }),
    pick: pickAt,
  };
}
