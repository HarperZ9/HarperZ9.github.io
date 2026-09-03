// hero-aperture.js: the aperture, drawn into one element rather than behind the whole page.
//
// The making surfaces (Gallery, Retro Engine, Loom) open on a full-viewport grid whose text column
// caps at 37rem, so on a wide screen the right two thirds of the FIRST SCREEN carried nothing at
// all. A page called Gallery whose front door shows no artwork is the worst version of that. This
// puts the site's recurring form there: a hot pupil, an iris of fine blades, a rim ring at the edge.
//
// It is deliberately NOT field-ground.js. That module is a fixed full-viewport ground, and these
// pages are authored on pure black on purpose (instrument-forms.css: "the ground: pure black, per
// the inspiration doc"). A full-page field would overwrite that decision. This draws into its own
// box, composites premultiplied over whatever is behind it, and scrolls away with the masthead.
//
// Identity comes from three numbers, so one form reads as a different instrument per surface: the
// accent HUE, the BLADE count (how fine the iris mechanism is), and the SEED (which fixes where the
// blades sit and how the rim breathes).
//
// mountHeroAperture(canvas, { hue, blades, seed, radius, reduced }) -> { destroy() }

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

const FRAG = `precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_seed;
uniform float u_hue;
uniform float u_blades;
uniform float u_radius;
uniform float u_gain;

vec3 hsl2rgb(vec3 c){
  vec3 r = clamp(abs(mod(c.x*6.0 + vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
  return c.z + c.y*(r-0.5)*(1.0-abs(2.0*c.z-1.0));
}

void main(){
  // Element-local, normalised on the SHORT axis so the form stays circular at any box shape.
  vec2 ap = (gl_FragCoord.xy - 0.5*u_res) / u_res.y;

  // A slow breathing warp. Enough that the rim is never a drawn circle, small enough that the form
  // still reads as round: a tenth of the iris radius, the same order as the ground field's.
  ap += 0.030 * vec2(sin(ap.y*7.0 + u_time*0.13 + u_seed), cos(ap.x*7.0 + u_time*0.11));

  float r  = length(ap) / u_radius;          // r = 1 sits on the iris rim
  float th = atan(ap.y, ap.x);

  float core  = exp(-r*r*7.5);
  // The clipped-white part of the pupil stays small on purpose. A wide white centre stops reading as
  // a pupil and starts reading as a blown highlight, and the point of the form is that it has
  // structure to look into.
  float pupil = exp(-r*r*38.0);
  float rim   = exp(-pow((r - 1.0)*9.0, 2.0));
  float halo  = exp(-r*r*2.6) * 0.15;        // a contained glow, not a page-wide fog

  // The iris field. Without it the annulus between pupil and rim renders as dead black and the form
  // reads as a bright dot with a separate ring around it rather than as one mechanism.
  float iris  = exp(-pow((r - 0.62)*3.2, 2.0)) * 0.11;

  // Everything ends AT the rim. This one term is the difference between an aperture and a sunburst:
  // a light source spills outward forever, a mechanism has an edge you can point at.
  float gate  = exp(-pow(max(0.0, r - 1.0) * 5.5, 2.0));

  // The blades. pow(...,13) is what keeps them lines rather than lobes, and the smoothstep opens
  // them away from the pupil so the centre stays clean.
  float blades = pow(0.5 + 0.5*cos(th*u_blades + r*1.5 + u_seed), 17.0)
               * smoothstep(0.34, 0.86, r) * gate;

  // Fine concentric ticks, the way a lens barrel or a dial is graduated. This is the instrument
  // register the rest of the site is built in, and it is what keeps the form from reading as a
  // generic glow: the eye finds machined detail when it looks closer instead of more blur.
  float ticks = pow(0.5 + 0.5*cos(r*24.0 + u_seed*2.0), 30.0)
              * smoothstep(0.26, 0.50, r) * (1.0 - smoothstep(0.72, 0.98, r));

  vec3 hotCol = hsl2rgb(vec3(fract(u_hue + 0.02), 0.88, 0.62));
  vec3 rimCol = hsl2rgb(vec3(fract(u_hue - 0.07), 0.72, 0.70));
  vec3 line   = vec3(0.60, 0.585, 0.72);

  vec3 col = hotCol * (core * 0.44 + halo + iris)
           + vec3(0.86, 0.94, 1.00) * pupil * 0.68
           + rimCol * (rim * 0.92 + blades * 0.44 + ticks * 0.16)
           + line * blades * 0.10;

  // Per-surface gain, so the three siblings carry the same weight on the page. Blade count, hue and
  // rim weight all feed into how much light a form throws, and they do not cancel: measured
  // composited over the black ground at 1440x900, the three came out at 24.7 / 28.6 / 37.1 mean
  // luminance with this term at 1. The gains in APERTURES divide those to a common 26, and
  // hero-aperture.test.mjs pins the constants to that measurement.
  col *= u_gain;

  // Premultiplied. Alpha is the form's own coverage, so every component is <= alpha and the canvas
  // composites as light over the black ground instead of painting a black box over it. Where the orb
  // is brightest it also clears what sits behind it, which is what makes the mark read as light
  // rather than as a smudge added on top.
  float a = max(col.r, max(col.g, col.b));
  gl_FragColor = vec4(col, min(a, 1.0));
}
`;

// Per-surface identity. One form, three numbers, three instruments. The hues stay off each other so
// two surfaces are never mistaken for one another, and the blade count reads as the fineness of the
// mechanism: the Retro Engine's iris is coarse because everything on that page is quantised, and the
// Loom's is the finest because a loom's unit is a single thread.
// Shader constants, set once at mount. A canvas whose data-aperture key is not in the table above
// still renders a coherent form from these rather than a black box.
const UNIFORMS = { seed: 3.1, hue: 0.53, blades: 44, radius: 0.30, gain: 1.0 };

export const APERTURES = {
  gallery: { hue: 0.78, blades: 44, seed: 3.1, radius: 0.30, gain: 1.06 },  // violet, the exhibition
  retro:   { hue: 0.06, blades: 16, seed: 5.7, radius: 0.30, gain: 0.92 },  // ember, coarse iris
  loom:    { hue: 0.42, blades: 72, seed: 1.4, radius: 0.30, gain: 0.70 },  // thread green, finest
};

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("hero-aperture shader compile failed: " + log);
  }
  return sh;
}

function makeProgram(gl) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("hero-aperture link failed: " + gl.getProgramInfoLog(prog));
  }
  return prog;
}

export function isHeroApertureAvailable() {
  try {
    if (typeof document === "undefined") return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch (_) {
    return false;
  }
}

function getContext(canvas) {
  const attrs = { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "low-power" };
  return canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
}

/**
 * Drive one draw callback. Animates while the element is on screen and the tab is visible, and
 * paints a single still frame when the page asks for reduced motion.
 *
 * The masthead scrolls away, so once it is gone there is nothing to animate. Without the observer
 * the page keeps painting an off-screen orb for the whole length of the document, and these
 * documents are long: the gallery runs past forty thousand pixels.
 */
function makeRunner(canvas, draw, reduced) {
  let raf = 0, t0 = 0, running = false, disposed = false, pending = false, onScreen = true;

  const frame = (tms) => {
    if (!running || disposed) return;
    if (!t0) t0 = tms;
    draw(tms - t0);
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (running || disposed || reduced || !onScreen || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const redraw = () => {
    if (pending || disposed) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; if (!disposed) draw(0); });
  };

  let io = null;
  if (typeof IntersectionObserver === "function") {
    io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen) start(); else stop();
    }, { rootMargin: "80px" });
    io.observe(canvas);
  }
  const onVis = () => { if (document.hidden) stop(); else start(); };
  window.addEventListener("resize", redraw, { passive: true });
  document.addEventListener("visibilitychange", onVis);

  redraw();
  start();

  return {
    dispose() {
      disposed = true;
      stop();
      if (io) io.disconnect();
      window.removeEventListener("resize", redraw);
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}

export function mountHeroAperture(canvas, opts) {
  const o = opts || {};
  const reduced = o.reduced === true;
  const gl = getContext(canvas);
  if (!gl) throw new Error("hero-aperture needs WebGL");

  const prog = makeProgram(gl);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  const U = (n) => gl.getUniformLocation(prog, n);
  const u = { res: U("u_res"), time: U("u_time") };

  gl.useProgram(prog);
  for (const k in UNIFORMS) gl.uniform1f(U("u_" + k), o[k] != null ? o[k] : UNIFORMS[k]);

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
  };

  const draw = (tms) => {
    size();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, reduced ? 0 : tms * 0.0019);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const runner = makeRunner(canvas, draw, reduced);

  return {
    destroy() {
      runner.dispose();
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    },
  };
}

/**
 * Boot helper for the plain HTML pages. Reads the surface key off the canvas element, honours the
 * same three media queries the home's ground field uses, and does nothing at all when the page asks
 * for reduced motion on a small screen or a coarse pointer. The canvas keeps its place in the layout
 * either way; it just stays empty, which on a black ground is invisible.
 */
export function bootHeroAperture(canvas) {
  if (!canvas) return null;
  const mq = (q) => (typeof window.matchMedia === "function" ? window.matchMedia(q) : { matches: false });
  const reducedMotion = mq("(prefers-reduced-motion: reduce)");
  const wideEnough = mq("(min-width: 900px)").matches && mq("(pointer: fine)").matches;
  if (!wideEnough || !isHeroApertureAvailable()) { canvas.dataset.mode = "static"; return null; }
  const preset = APERTURES[canvas.dataset.aperture] || APERTURES.gallery;
  try {
    const handle = mountHeroAperture(canvas, Object.assign({ reduced: reducedMotion.matches }, preset));
    canvas.dataset.mode = reducedMotion.matches ? "still" : "live";
    return handle;
  } catch (_) {
    canvas.dataset.mode = "static";
    return null;
  }
}

// Self-boot. The three surfaces that use this are static HTML with no bundler, so one script tag is
// the whole integration: every canvas carrying data-aperture gets mounted with its named preset.
if (typeof document !== "undefined") {
  const boot = () => document.querySelectorAll("canvas[data-aperture]").forEach(bootHeroAperture);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
}
