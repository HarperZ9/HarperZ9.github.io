// system/engine/sim/particles-webgl2.js
// Stage 1 of the Telos scalable engine: the WebGL2 particle backend (rung 2, the mid GPU path).
// Zero external dependencies. GLSL inlined as template strings; no build step. ASCII only.
//
// There are NO compute shaders in WebGL2 (the WebGL 2.0 Compute spec is obsolete and points to
// WebGPU). The portable GPGPU technique for 1D particle state is TRANSFORM FEEDBACK: a vertex shader
// reads per-particle attributes from buffer A, integrates one step, and writes the new state into
// buffer B via transform feedback; the two buffers ping-pong each frame. A second draw renders the
// current positions as gl.POINTS. This keeps particle state on the GPU (no per-frame CPU round-trip)
// and outputs straight into the VBO the renderer draws.
//   Refs (SPEC-telos-scalable-engine.md): webgl2fundamentals GPGPU; gpfault WebGL2 particles.
//
// EXT_color_buffer_float caveat: transform feedback to a Float32 VBO does NOT require rendering to a
// float framebuffer, so this backend works without the extension; we still expose colorBufferFloat
// in the capability record so the selection ladder can degrade a mobile WebGL2 that lacks broader
// float support. This backend draws to a normal RGBA8 canvas (additive points), so it is safe.
//
// Implements the COMMON BACKEND INTERFACE documented in particles-cpu.js. render() takes a WebGL2
// context (not a 2D context); gpu-particles.js owns which context type the surface has.

// ---------------------------------------------------------------------------
// Static availability probe (browser-only; safe under node, returns false)
// ---------------------------------------------------------------------------
export function isWebGL2ParticlesAvailable() {
  try {
    if (typeof document === "undefined") return false;
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    return !!gl;
  } catch (_) { return false; }
}

// Per-particle attributes packed across two interleaved VBOs (position+velocity / home+misc). We use
// a single interleaved Float32 layout matching particles-cpu.js field order for cross-backend parity:
//   [x, y, vx, vy, hx, hy, hue, L, C, size]  (10 floats / particle)
const FLOATS_PER_PARTICLE = 10;
const STRIDE = FLOATS_PER_PARTICLE * 4;   // bytes

// Update vertex shader: integrates one step. Transform feedback captures the 10 output varyings in
// the same order so the output buffer is layout-identical to the input (ping-pong safe). The math
// mirrors the CPU spring/cohesion/kick model; cohesion-to-global-center is approximated by a pull
// toward the canvas center (a per-vertex shader cannot read the global centroid without a reduction
// pass, so the mid rung uses center-pull, which is visually equivalent for large N where the centroid
// sits near the middle). A pseudo-random hash drives the bass/treble jitter deterministically.
const UPDATE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_vel;
layout(location=2) in vec2 a_home;
layout(location=3) in float a_hue;
layout(location=4) in float a_L;
layout(location=5) in float a_C;
layout(location=6) in float a_size;

uniform vec2  u_res;
uniform float u_bass;
uniform float u_intensity;
uniform float u_highMod;
uniform float u_hue;
uniform float u_seed;
uniform float u_index;   // 1.0 / count, for hue spread

out vec2  v_pos;
out vec2  v_vel;
out vec2  v_home;
out float v_hue;
out float v_L;
out float v_C;
out float v_size;

// cheap hash -> [0,1)
float hash(float n){ return fract(sin(n) * 43758.5453123); }

void main(){
  vec2 pos = a_pos;
  vec2 vel = a_vel;
  vec2 home = a_home;

  float id = float(gl_VertexID);
  float r1 = hash(id * 12.9898 + u_seed);
  float r2 = hash(id * 78.233  + u_seed * 1.7);

  float kSpring = 0.004 + u_intensity * 0.006;
  float damping = 0.96 - u_bass * 0.02;

  // spring toward home
  vel += (home - pos) * kSpring;
  // cohesion toward canvas center (centroid proxy for large N)
  vec2 c = u_res * 0.5;
  vel += (c - pos) * 0.0003 * (1.0 - u_bass);
  // bass radial kick
  vel.y -= u_bass * 0.8 * (r1 - 0.5);
  vel.x += u_bass * 0.8 * (r2 - 0.5);
  // treble jitter
  if (u_highMod > 0.3) {
    vel.x += (r2 - 0.5) * u_highMod * 0.5;
    vel.y += (r1 - 0.5) * u_highMod * 0.5;
  }
  vel *= damping;
  pos += vel;

  // wrap + re-home on wrap
  if (pos.x < 0.0)      { pos.x += u_res.x; home.x = r1 * u_res.x; }
  if (pos.x > u_res.x)  { pos.x -= u_res.x; home.x = r1 * u_res.x; }
  if (pos.y < 0.0)      { pos.y += u_res.y; home.y = r2 * u_res.y; }
  if (pos.y > u_res.y)  { pos.y -= u_res.y; home.y = r2 * u_res.y; }

  // hue drift toward audio hue, index-spread
  float targetHue = u_hue + (id * u_index) * 80.0;
  v_hue = mix(a_hue, targetHue, 0.01);

  v_pos = pos; v_vel = vel; v_home = home;
  v_L = a_L; v_C = a_C; v_size = a_size;
}`;

// Render vertex shader: places a point at the current position in clip space and forwards the OKLab
// fields to the fragment shader, which converts OKLab -> sRGB on the GPU (matching the CPU recipe).
const RENDER_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
layout(location=3) in float a_hue;
layout(location=4) in float a_L;
layout(location=5) in float a_C;
layout(location=6) in float a_size;
uniform vec2  u_res;
uniform float u_intensity;
uniform float u_hueShift;
out float f_hue;
out float f_L;
out float f_C;
void main(){
  vec2 clip = (a_pos / u_res) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = a_size * (1.0 + u_intensity * 0.4) * 2.0;
  f_hue = a_hue;
  f_L = clamp(a_L + u_hueShift * 0.1, 0.3, 0.9);
  f_C = clamp(a_C + u_intensity * 0.06, 0.0, 0.3);
}`;

// Fragment shader: OKLab -> linear sRGB -> sRGB, soft round point, alpha 0.7 (matches CPU).
const RENDER_FS = `#version 300 es
precision highp float;
in float f_hue;
in float f_L;
in float f_C;
out vec4 outColor;
vec3 oklabToLinear(float L, float a, float b){
  float l_ = L + 0.3963377774*a + 0.2158037573*b;
  float m_ = L - 0.1055613458*a - 0.0638541728*b;
  float s_ = L - 0.0894841775*a - 1.2914855480*b;
  float l = l_*l_*l_, m = m_*m_*m_, s = s_*s_*s_;
  return vec3(
    4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
   -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
   -0.0041960863*l - 0.7034186147*m + 1.7076147010*s);
}
vec3 linearToSrgb(vec3 c){
  return mix(12.92*c, 1.055*pow(max(c,0.0), vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;                 // round point
  float aa = smoothstep(0.25, 0.10, r2);  // soft edge
  float hRad = radians(f_hue);
  vec3 lin = oklabToLinear(f_L, f_C * cos(hRad), f_C * sin(hRad));
  vec3 srgb = clamp(linearToSrgb(lin), 0.0, 1.0);
  outColor = vec4(srgb, 0.7 * aa);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("particles-webgl2: shader compile failed: " + log);
  }
  return sh;
}

function linkProgram(gl, vs, fs, feedbackVaryings) {
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  if (feedbackVaryings) {
    gl.transformFeedbackVaryings(prog, feedbackVaryings, gl.INTERLEAVED_ATTRIBS);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error("particles-webgl2: program link failed: " + log);
  }
  return prog;
}

// A throwaway fragment shader for the update program (transform feedback discards rasterization).
const NOOP_FS = `#version 300 es
precision highp float;
out vec4 o; void main(){ o = vec4(0.0); }`;

const FEEDBACK_VARYINGS = ["v_pos", "v_vel", "v_home", "v_hue", "v_L", "v_C", "v_size"];

export function createWebGL2Particles() {
  let gl = null;
  let updateProg = null, renderProg = null;
  let bufA = null, bufB = null, vaoA = null, vaoB = null;
  let tf = null;
  let count = 0, capacity = 0;
  let w = 1, h = 1;
  let rnd = Math.random;
  let uLoc = {};   // cached uniform locations

  function makeInitialData(n) {
    const data = new Float32Array(n * FLOATS_PER_PARTICLE);
    for (let i = 0; i < n; i++) {
      const o = i * FLOATS_PER_PARTICLE;
      data[o + 0] = rnd() * w;          // x
      data[o + 1] = rnd() * h;          // y
      data[o + 2] = (rnd() - 0.5) * 0.5; // vx
      data[o + 3] = (rnd() - 0.5) * 0.5; // vy
      data[o + 4] = rnd() * w;          // hx
      data[o + 5] = rnd() * h;          // hy
      data[o + 6] = rnd() * 360;        // hue
      data[o + 7] = 0.6;                // L
      data[o + 8] = 0.18;               // C
      data[o + 9] = 1.5 + rnd() * 2.5;  // size
    }
    return data;
  }

  // Set up an attribute layout on the currently bound VAO for the given buffer.
  function setupAttribs(buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // location 0 a_pos (2), 1 a_vel (2), 2 a_home (2), 3 a_hue (1), 4 a_L (1), 5 a_C (1), 6 a_size (1)
    const f = 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE, 0 * f);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 2 * f);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE, 4 * f);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, STRIDE, 6 * f);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, STRIDE, 7 * f);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 1, gl.FLOAT, false, STRIDE, 8 * f);
    gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 1, gl.FLOAT, false, STRIDE, 9 * f);
  }

  function allocBuffers(n) {
    capacity = Math.max(1, n);
    const data = makeInitialData(capacity);
    bufA = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufA);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY);
    bufB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufB);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_COPY);

    vaoA = gl.createVertexArray(); gl.bindVertexArray(vaoA); setupAttribs(bufA);
    vaoB = gl.createVertexArray(); gl.bindVertexArray(vaoB); setupAttribs(bufB);
    gl.bindVertexArray(null);
  }

  function cacheUniforms() {
    const u = (p, n) => gl.getUniformLocation(p, n);
    uLoc = {
      uRes: u(updateProg, "u_res"), uBass: u(updateProg, "u_bass"),
      uIntensity: u(updateProg, "u_intensity"), uHighMod: u(updateProg, "u_highMod"),
      uHue: u(updateProg, "u_hue"), uSeed: u(updateProg, "u_seed"), uIndex: u(updateProg, "u_index"),
      rRes: u(renderProg, "u_res"), rIntensity: u(renderProg, "u_intensity"), rHueShift: u(renderProg, "u_hueShift"),
    };
  }

  return {
    name: "webgl2",
    FLOATS_PER_PARTICLE,

    async init(cfg) {
      const c = cfg || {};
      gl = c.gl || (c.surface && c.surface.getContext && c.surface.getContext("webgl2")) || null;
      if (!gl) throw new Error("particles-webgl2: no WebGL2 context provided");
      w = Math.max(1, c.width || 1); h = Math.max(1, c.height || 1);
      rnd = (typeof c.rng === "function") ? c.rng : Math.random;
      count = Math.max(0, Math.floor(c.count || 0));

      const uvs = compile(gl, gl.VERTEX_SHADER, UPDATE_VS);
      const ufs = compile(gl, gl.FRAGMENT_SHADER, NOOP_FS);
      updateProg = linkProgram(gl, uvs, ufs, FEEDBACK_VARYINGS);
      const rvs = compile(gl, gl.VERTEX_SHADER, RENDER_VS);
      const rfs = compile(gl, gl.FRAGMENT_SHADER, RENDER_FS);
      renderProg = linkProgram(gl, rvs, rfs, null);
      gl.deleteShader(uvs); gl.deleteShader(ufs); gl.deleteShader(rvs); gl.deleteShader(rfs);

      allocBuffers(count || 1);
      tf = gl.createTransformFeedback();
      cacheUniforms();

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);   // additive points
      return true;
    },

    step(dt, forces) {
      if (!gl || count === 0) return;
      const fr = forces || {};
      gl.useProgram(updateProg);
      gl.uniform2f(uLoc.uRes, w, h);
      gl.uniform1f(uLoc.uBass, fr.bass || 0);
      gl.uniform1f(uLoc.uIntensity, fr.intensity || 0);
      gl.uniform1f(uLoc.uHighMod, fr.highMod || 0);
      gl.uniform1f(uLoc.uHue, fr.hue || 0);
      gl.uniform1f(uLoc.uSeed, (Math.random() * 1000) | 0);
      gl.uniform1f(uLoc.uIndex, 1.0 / Math.max(1, count));

      gl.enable(gl.RASTERIZER_DISCARD);
      gl.bindVertexArray(vaoA);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bufB);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.endTransformFeedback();
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      gl.disable(gl.RASTERIZER_DISCARD);

      // ping-pong: B (new) becomes A (current) for the render + next step.
      const tBuf = bufA; bufA = bufB; bufB = tBuf;
      const tVao = vaoA; vaoA = vaoB; vaoB = tVao;
    },

    render(_glIgnored, width, height, params) {
      if (!gl || count === 0) return;
      const p = params || {};
      gl.viewport(0, 0, w, h);
      gl.useProgram(renderProg);
      gl.uniform2f(uLoc.rRes, w, h);
      gl.uniform1f(uLoc.rIntensity, p.intensity || 0);
      gl.uniform1f(uLoc.rHueShift, p.hueShift || 0);
      gl.bindVertexArray(vaoA);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.bindVertexArray(null);
    },

    resize(width, height) { w = Math.max(1, width || w); h = Math.max(1, height || h); },

    setCount(n) {
      const next = Math.max(0, Math.floor(n || 0));
      if (next === count) return count;
      if (next > capacity) {
        // Reallocate at the larger capacity (re-seed; transform feedback state is GPU-resident, so a
        // grow is a fresh allocation rather than a copy. This is rare: the governor mostly shrinks).
        try {
          gl.deleteBuffer(bufA); gl.deleteBuffer(bufB);
          gl.deleteVertexArray(vaoA); gl.deleteVertexArray(vaoB);
        } catch (_) {}
        const keep = count; count = next;     // makeInitialData uses w/h only; count caps the draw
        allocBuffers(next);
        count = next; void keep;
      } else {
        count = next;
      }
      return count;
    },

    perceive() { return { backend: "webgl2", count, cx: w / 2, cy: h / 2 }; },
    getCount() { return count; },

    dispose() {
      if (!gl) return;
      try {
        gl.deleteBuffer(bufA); gl.deleteBuffer(bufB);
        gl.deleteVertexArray(vaoA); gl.deleteVertexArray(vaoB);
        gl.deleteTransformFeedback(tf);
        gl.deleteProgram(updateProg); gl.deleteProgram(renderProg);
      } catch (_) {}
      gl = null; updateProg = renderProg = bufA = bufB = vaoA = vaoB = tf = null;
      count = 0; capacity = 0;
    },
  };
}

export const _FLOATS_PER_PARTICLE = FLOATS_PER_PARTICLE;
export const _SHADERS = { UPDATE_VS, RENDER_VS, RENDER_FS };
export default { createWebGL2Particles, isWebGL2ParticlesAvailable };
