// fractal3d.js: high-fidelity 3D fractals via a WebGL1 fragment-shader raymarcher.
//
// Mandelbox & Mandelbulb distance estimators, sphere-traced per pixel. The GL program is
// built EXACTLY like shared-frame/render.js renderField: a full-screen-triangle vertex shader,
// compile()/linkProgram(), a single drawArrays of 3 vertices, and a RAF loop driving u_time
// (a slow camera orbit). render3D(canvas, opts) returns { stop } to cancel that RAF.
//
// Every DE formula is transcribed verbatim from
//   project-docs/research/fractal-studio/fractal-3d-and-tools.md
// which in turn traces each line to a primary source (Hvidtfeldt/Syntopia for the DEs,
// Inigo Quilez for normals / soft shadows / orbit traps). GLSL ES 1.00 (WebGL1):
//   - gl_FragColor output (not WebGL2 out vars)
//   - all loop bounds are compile-time constants (no uniform loop counts)
//   - u_resolution uniform (no textureSize)
//   - atan(y,x) two-arg form is available

// Full-screen triangle, the same vertex shader render.js uses.
const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

// ── The two distance estimators (research file §1 and §2) ───────────────────
// Each is dropped verbatim into the fragment as the `de(vec3 p)` selected at build time.
// Both also write a running orbit-trap minimum into the global `g_trap` (distance-to-origin
// trap) for coloring, research file §"Orbit Trap Coloring".

const MANDELBOX_DE = `
// --- Mandelbox DE --- (research §1; Hvidtfeldt/Syntopia Part VI 2011, Buddhi scalar DE)
// box fold: clamp(z,-1,1)*2 - z ; sphere fold; dr = dr*abs(scale)+1 ; dist = length(z)/abs(dr)
// MB_FOLD/MINR2/FIXEDR2 are the canonical Tglad defaults; scale & iters are uniforms.
const float MB_FOLD    = 1.0;          // foldLimit
const float MB_MINR2   = 0.25;         // minRadius^2 = 0.5^2
const float MB_FIXEDR2 = 1.0;          // fixedRadius^2 = 1.0^2
const float MB_FACTOR  = MB_FIXEDR2 / MB_MINR2;   // = 4.0  (inner linear scaling)

float de(vec3 pos) {
    vec3  z  = pos;
    float dr = 1.0;
    g_trap   = 1e10;
    for (int i = 0; i < MAX_ITERS; i++) {
        if (i >= u_iterations) break;          // honour the iteration slider (const-bounded loop)
        // Box fold (componentwise reflection across +/- foldLimit)
        z = clamp(z, -MB_FOLD, MB_FOLD) * 2.0 - z;
        // Sphere fold
        float r2 = dot(z, z);
        if (r2 < MB_MINR2) {
            z  *= MB_FACTOR;
            dr *= MB_FACTOR;
        } else if (r2 < MB_FIXEDR2) {
            float k = MB_FIXEDR2 / max(r2, 1e-8);
            z  *= k;
            dr *= k;
        }
        // Scale and translate (the + 1.0 is the additive c term, NOT abs(scale))
        z  = u_scale * z + pos;
        dr = dr * abs(u_scale) + 1.0;
        g_trap = min(g_trap, length(z));       // distance-to-origin orbit trap
    }
    return length(z) / abs(dr);
}`;

const MANDELBULB_DE = `
// --- Mandelbulb DE --- (research §2; Hvidtfeldt/Syntopia Part V 2011; White/Nylander triplex)
// spherical power: dr = power*pow(r,power-1)*dr + 1 ; dist = 0.5*log(r)*r/dr ; bailout r>2
float de(vec3 pos) {
    vec3  z  = pos;
    float dr = 1.0;
    float r  = 0.0;
    g_trap   = 1e10;
    for (int i = 0; i < MAX_ITERS; i++) {
        if (i >= u_iterations) break;
        r = length(z);
        if (r > 2.0) break;                    // bailout sphere
        // spherical coords (clamp acos arg against float drift -> avoids NaN)
        float theta = acos(clamp(z.z / r, -1.0, 1.0));
        float phi   = atan(z.y, z.x);
        // running derivative (before the power): the +1.0 is the additive c (chain rule)
        dr = pow(r, u_power - 1.0) * u_power * dr + 1.0;
        // raise to the power, rotate the angles, convert back, add c = pos
        float rn = pow(r, u_power);
        theta *= u_power;
        phi   *= u_power;
        z = rn * vec3(
            sin(theta) * cos(phi),
            sin(theta) * sin(phi),
            cos(theta)
        ) + pos;
        g_trap = min(g_trap, length(z));        // distance-to-origin orbit trap
    }
    return 0.5 * log(r) * r / dr;
}`;

// ── The shared fragment body (camera, raymarch, normal, shading) ────────────
// MAX_STEPS / MAX_DIST / EPSILON are scene budgets per research §3 (kept real-time at ~512px:
// MAX_STEPS*DE_ITERS well under ~1500). MAX_ITERS is the compile-time upper bound on the DE
// loop; the actual iteration count is the u_iterations uniform, clamped JS-side to [1, MAX_ITERS].

function buildFragment(type) {
  const de = type === "mandelbulb" ? MANDELBULB_DE : MANDELBOX_DE;
  // Mandelbulb needs a tighter far plane (research §3 table: 8.0 vs 20.0) and fewer steps.
  const maxSteps = type === "mandelbulb" ? 96 : 110;
  const maxDist = type === "mandelbulb" ? "8.0" : "20.0";
  // Surface base color per fractal: warm for the box, cooler for the bulb (just an aesthetic seed).
  const baseCol = type === "mandelbulb" ? "vec3(0.55, 0.45, 0.6)" : "vec3(0.6, 0.5, 0.4)";

  return `precision highp float;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_scale;       // Mandelbox scale (ignored by the bulb)
uniform float u_power;       // Mandelbulb power (ignored by the box)
uniform int   u_iterations;  // DE iteration count (<= MAX_ITERS)
uniform float u_yaw;         // camera azimuth offset (user drag, radians)
uniform float u_pitch;       // camera elevation (user drag, radians; clamped JS-side)
uniform float u_dist;        // camera distance multiplier (user wheel-dolly)

const int   MAX_ITERS = 20;          // compile-time DE loop ceiling
const int   MAX_STEPS = ${maxSteps}; // sphere-trace step ceiling
const float MAX_DIST  = ${maxDist};
const float EPSILON   = 0.0008;      // hit threshold

float g_trap;   // running orbit-trap minimum, written by de()

${de}

// Surface normal via DE gradient, Quilez tetrahedron trick (research §3, 4 DE evals).
vec3 calcNormal(vec3 p) {
    const float h = 0.0006;
    const vec2  k = vec2(1.0, -1.0);
    return normalize(
        k.xyy * de(p + k.xyy * h) +
        k.yyx * de(p + k.yyx * h) +
        k.yxy * de(p + k.yxy * h) +
        k.xxx * de(p + k.xxx * h)
    );
}

// Soft shadow, Quilez k*h/t march (research §3, iquilezles.org/articles/rmshadows).
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t   = mint;
    for (int i = 0; i < 48; i++) {
        float h = de(ro + rd * t);
        if (h < 0.0008) return 0.0;
        res = min(res, k * h / t);
        t  += clamp(h, 0.01, 0.4);
        if (t >= maxt) break;
    }
    return clamp(res, 0.0, 1.0);
}

// Orbit-trap -> cosine palette (Inigo Quilez style, research §"Orbit Trap Coloring").
vec3 orbitColor(float trap) {
    vec3 a = vec3(0.5);
    vec3 b = vec3(0.5);
    vec3 c = vec3(1.0, 1.0, 0.5);
    vec3 d = vec3(0.0, 0.33, 0.67);
    return a + b * cos(6.28318 * (c * trap + d));
}

// Orthonormal camera basis (research §3 Camera/Ray Setup).
mat3 makeCam(vec3 ro, vec3 ta) {
    vec3 fwd   = normalize(ta - ro);
    vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up    = cross(right, fwd);
    return mat3(right, up, fwd);
}

void main() {
    // NDC with correct aspect (research §3).
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

    // Camera orbit: a gentle idle auto-orbit on u_time PLUS the user's drag yaw/pitch and wheel
    // dolly (research §"Adopt This" #6/#9 for the idle motion; drag/dolly added for Task 8n
    // interaction). Radius tuned per fractal so the whole form frames (too close = fog + flat read).
    float ang = u_time * 0.25 + u_yaw;
    float baseRad = ${type === "mandelbulb" ? "3.4" : "9.0"};
    float rad = clamp(baseRad * u_dist, baseRad * 0.35, baseRad * 2.4);
    float pitch = clamp(u_pitch, -1.2, 1.2);
    float baseH = ${type === "mandelbulb" ? "1.0" : "3.0"};
    // Spherical: yaw rotates around Y, pitch lifts the eye. Keep baseH as a floor so the default
    // framing matches the pre-interaction look when pitch is 0.
    float ch = cos(pitch);
    vec3 ro = vec3(sin(ang) * rad * ch, baseH + sin(pitch) * rad, cos(ang) * rad * ch);
    vec3 ta = vec3(0.0);
    mat3 cam = makeCam(ro, ta);
    vec3 rd  = cam * normalize(vec3(uv, 1.8));  // ~focal length 1.8

    // Sphere-tracing march, tracking the step count for AO and a thin glow accumulator.
    // glow only accumulates very close to the surface (small exp window) so it stays a rim
    // halo, not whole-frame haze, which is the washout failure mode if the window is too wide.
    float t     = 0.001;
    int   steps = 0;
    float glow  = 0.0;
    bool  hit   = false;
    for (int i = 0; i < MAX_STEPS; i++) {
        vec3  pos = ro + rd * t;
        float d   = de(pos);
        steps = i;
        glow += exp(-40.0 * d);          // tight proximity window -> silhouette rim only
        if (d < EPSILON) { hit = true; break; }
        if (t > MAX_DIST) break;
        t += d;
    }
    glow = min(glow, 6.0);               // clamp so grazing rays can't blow out

    vec3 col;
    if (!hit) {
        // Sky gradient (research §shade) + a faint glow rim where rays grazed the surface.
        col = mix(vec3(0.03, 0.04, 0.09), vec3(0.20, 0.30, 0.48),
                  clamp(rd.y * 0.5 + 0.5, 0.0, 1.0));
        col += vec3(0.18, 0.30, 0.55) * glow * 0.02;
    } else {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);

        // Step-count AO: fewer steps = more open space (research §"Step-count AO"). As a
        // MULTIPLIER on lighting (occlusion darkens crevices); adding it as light is what
        // flattens the image, so it modulates rather than lifts.
        float ao = clamp(1.0 - float(steps) / float(MAX_STEPS), 0.0, 1.0);
        ao = pow(ao, 1.5);

        // Key light: Lambert + Quilez soft shadow.
        vec3  L     = normalize(vec3(0.8, 1.4, 0.9));
        float diff  = max(dot(n, L), 0.0);
        float shad  = softShadow(p + n * 0.003, L, 0.02, ${maxDist}, 10.0);
        // Specular (Blinn-Phong) reads the surface relief as sharp highlights.
        vec3  V     = -rd;
        vec3  H     = normalize(L + V);
        float spec  = pow(max(dot(n, H), 0.0), 24.0) * shad;
        // Sky fill from above (hemisphere ambient): small, tinted, so it doesn't gray out blacks.
        float sky   = clamp(0.5 + 0.5 * n.y, 0.0, 1.0);

        // Orbit-trap glow tints the base surface color (research §"Orbit Trap Coloring").
        vec3 base = ${baseCol} * mix(vec3(1.0), orbitColor(g_trap), 0.75);

        col  = base * diff * shad;                       // direct key light
        col += base * sky * vec3(0.10, 0.13, 0.20);      // cool hemisphere fill
        col *= (0.25 + 0.75 * ao);                       // AO darkens crevices (multiplier)
        col += vec3(1.0) * spec * 0.5;                   // sharp relief highlights
        col += vec3(0.18, 0.30, 0.55) * glow * 0.012;    // thin silhouette rim glow
        // distance fog toward the sky color, light, only at the far plane
        col = mix(col, vec3(0.06, 0.08, 0.14), clamp(t / MAX_DIST, 0.0, 1.0) * 0.35);
    }

    // tone curve + gamma. ACES-ish filmic curve: keeps blacks dark, rolls off highlights.
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
    col = pow(clamp(col, 0.0, 1.0), vec3(0.4545));
    gl_FragColor = vec4(col, 1.0);
}`;
}

// ── GL program build, exactly the render.js pattern ────────────────────────

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("shader compile failed: " + log);
  }
  return sh;
}

/**
 * render3D(canvas, opts): raymarch a Mandelbox or Mandelbulb into `canvas`.
 *
 * opts: { type: "mandelbox"|"mandelbulb", scale?: number, power?: number, iterations?: number }
 * Returns { stop } to cancel the camera-orbit RAF. Throws a clear Error when WebGL is unavailable
 * or the program fails to compile/link (the Studio catches and shows a friendly fallback).
 */
export function render3D(canvas, opts = {}) {
  const type = opts.type === "mandelbulb" ? "mandelbulb" : "mandelbox";
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true })
    || canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true });
  if (!gl) throw new Error("3D fractals need WebGL. This browser/context has none.");

  // Clamp params to the budgets the shader was built for (real-time at ~512px).
  const scale = clampNum(opts.scale, -3.0, 3.0, -2.0);
  const power = clampNum(opts.power, 2.0, 12.0, 8.0);
  const iterations = Math.round(clampNum(opts.iterations, 1, 20, type === "mandelbulb" ? 8 : 12));

  const fragSrc = buildFragment(type);
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("program link failed: " + gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);

  // Full-screen triangle (same buffer layout as render.js).
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const uTime = U("u_time"), uRes = U("u_resolution");
  const uYaw = U("u_yaw"), uPitch = U("u_pitch"), uDist = U("u_dist");
  gl.uniform1f(U("u_scale"), scale);
  gl.uniform1f(U("u_power"), power);
  gl.uniform1i(U("u_iterations"), iterations);

  // Interactive-camera state (Task 8n). yaw/pitch are user drag offsets; dist is the wheel-dolly
  // multiplier (1 = default framing). `idle` controls the gentle auto-orbit: when the user is
  // interacting we freeze the clock (the form holds still under the drag), then resume from where
  // it left off so the orbit never jumps. `userActive` resumes the idle drift after a short pause.
  const cam = { yaw: 0, pitch: 0, dist: 1 };
  let raf = 0, stopped = false, t0 = 0, clock = 0, lastTs = 0, idleHold = false, holdUntil = 0;
  // Reduced motion: the idle auto-orbit never advances on its own; the form
  // renders still and only moves under the user's own drag/dolly input.
  const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function draw(ts) {
    if (stopped) return;
    if (!t0) t0 = ts;
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    // Advance the idle-orbit clock only when not actively held; resume after the hold window.
    const holding = reduceMotion || idleHold || ts < holdUntil;
    if (!holding) clock += dt;
    const w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, clock);
    gl.uniform1f(uYaw, cam.yaw);
    gl.uniform1f(uPitch, cam.pitch);
    gl.uniform1f(uDist, cam.dist);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);

  return {
    stop: () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      // free the GL objects so a re-entry on a fresh canvas starts clean
      try { gl.deleteBuffer(buf); gl.deleteProgram(prog); } catch (e) { /* context may be gone */ }
    },
    // ── interactive camera handle (Task 8n) ──
    // orbit(dx, dy): feed a pointer delta (px) into yaw/pitch. dolly(f): multiply distance.
    // beginInteract()/endInteract(): freeze the idle drift while dragging, resume ~1.4s after.
    orbit: (dx, dy) => { cam.yaw -= dx * 0.006; cam.pitch += dy * 0.006; },
    dolly: (factor) => { cam.dist = Math.max(0.35, Math.min(2.4, cam.dist * factor)); },
    beginInteract: () => { idleHold = true; },
    endInteract: () => { idleHold = false; holdUntil = (typeof performance !== "undefined" ? performance.now() : Date.now()) + 1400; },
    reset: () => { cam.yaw = 0; cam.pitch = 0; cam.dist = 1; clock = 0; },
    state: () => ({ yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist }),
  };
}

function clampNum(v, lo, hi, dflt) {
  const n = typeof v === "number" && isFinite(v) ? v : dflt;
  return Math.max(lo, Math.min(hi, n));
}
