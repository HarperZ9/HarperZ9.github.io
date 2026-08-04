// fractal-precision-probe.js: does this GPU actually separate neighbouring pixels at a given zoom?
//
// The deep-zoom question is not "does the image look nice", it is "do two adjacent pixels address
// two different points of the complex plane". Pixel colour cannot answer that: escape-time colouring
// is chaotic at the boundary (two renderers that agree to 1e-15 still disagree by whole palette
// cycles), and 8-bit output quantises smooth gradients anyway. So this probe measures the coordinate
// itself.
//
// The test is a round trip. Build the per-pixel coordinate exactly as the renderer does — centre
// plus sub-pixel offset — then subtract the centre back off and ask which pixel index the survivor
// names. If the arithmetic holds the offset, the index advances by one per pixel and the frame is a
// one-pixel stripe pattern. If the arithmetic drops it, whole blocks of pixels return the same index
// and the stripes fatten into bands whose width IS the precision loss, in pixels.
//
// The df64 helpers come from fractal-gl.js by import, not by copy, so the probe cannot pass while
// the shipped shader fails. This also catches the one failure mode that source review cannot: a
// driver that folds `cona - (cona - a.x)` back to `a.x` and silently un-does the Dekker split.
//
// Nothing in the Studio imports this; it is loaded by the visual-QA harness. Receipts live in
// project-docs/2026-08-03-fractal-precision.md.

import { _DS_LIB } from "./fractal-gl.js";

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

// Mirrors the coordinate lines of the shipped programs:
//   single: u_center.x + ndc.x * u_scale
//   double: dsAdd(u_centerX, vec2(ndc.x * u_scale, 0.0))
// `u_index` reports floor(recovered_offset / pixelStep), rendered as a 1-bit stripe so the run
// lengths are trivially countable off the framebuffer.
const FRAG = `precision highp float;

uniform vec2  u_resolution;
uniform vec2  u_centerX;    // (hi, lo) limbs; the single-precision path reads only .x
uniform float u_scale;
uniform float u_pixelStep;  // one pixel of the view, in complex units
uniform int   u_mode;       // 0 = float32 coordinates, 1 = df64 coordinates
${_DS_LIB}

void main() {
  vec2 ndc = gl_FragCoord.xy / u_resolution - 0.5;
  float offset;
  if (u_mode == 1) {
    vec2 ux = dsAdd(u_centerX, vec2(ndc.x * u_scale, 0.0));   // the coordinate, as shipped
    vec2 back = dsAdd(ux, -u_centerX);                        // recover the offset that survived
    offset = back.x + back.y;
  } else {
    float ux = u_centerX.x + ndc.x * u_scale;                 // the coordinate, as shipped
    // dsBar() here for the same reason it exists at all: without it this compiler folds the round
    // trip back to the raw offset and reports a perfect result for the very path that is broken.
    offset = dsBar(ux) - u_centerX.x;                         // recover the offset that survived
  }
  // Bias by a large integer so the floor is well-defined either side of the centre.
  float idx = floor(offset / u_pixelStep + 4096.0);
  gl_FragColor = vec4(vec3(mod(idx, 2.0)), 1.0);
}`;

function compile(gl, kind, src) {
  const sh = gl.createShader(kind);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("fractal-precision-probe compile failed: " + log);
  }
  return sh;
}

/**
 * measureCoordinateSeparation(canvas, { cx, scale, mode }) → {
 *   mode, width, pixelStep, distinctColumns, meanBlockPx, maxBlockPx, separatesEveryPixel
 * }
 *
 * `distinctColumns` is how many of the canvas's columns the arithmetic can actually tell apart:
 * `width` means every pixel is its own point, and anything less is the precision wall showing.
 * `meanBlockPx` is the average number of columns that collapse onto one coordinate.
 */
export function measureCoordinateSeparation(canvas, opts) {
  const { cx = -0.744539761, scale = 6.25e-6, mode = "double" } = opts || {};
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false });
  if (!gl) throw new Error("the precision probe needs WebGL");
  const w = canvas.width, h = canvas.height;

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("fractal-precision-probe link failed: " + gl.getProgramInfoLog(prog));
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const hi = Math.fround(cx), lo = Math.fround(cx - hi);
  const pixelStep = scale / w;
  gl.useProgram(prog);
  gl.viewport(0, 0, w, h);
  gl.uniform2f(gl.getUniformLocation(prog, "u_resolution"), w, h);
  gl.uniform2f(gl.getUniformLocation(prog, "u_centerX"), hi, lo);
  gl.uniform1f(gl.getUniformLocation(prog, "u_scale"), scale);
  gl.uniform1f(gl.getUniformLocation(prog, "u_pixelStep"), pixelStep);
  gl.uniform1i(gl.getUniformLocation(prog, "u_mode"), mode === "double" ? 1 : 0);
  gl.uniform1f(gl.getUniformLocation(prog, "u_one"), 1.0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();

  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

  // One scanline is enough: the pattern is constant down the frame.
  const row = [];
  for (let x = 0; x < w; x++) row.push(px[x * 4] > 127 ? 1 : 0);
  let blocks = 1, maxBlock = 1, run = 1;
  for (let x = 1; x < w; x++) {
    if (row[x] === row[x - 1]) { run++; if (run > maxBlock) maxBlock = run; }
    else { blocks++; run = 1; }
  }
  return {
    mode, width: w, pixelStep,
    distinctColumns: blocks,
    meanBlockPx: +(w / blocks).toFixed(2),
    maxBlockPx: maxBlock,
    separatesEveryPixel: blocks === w,
  };
}
