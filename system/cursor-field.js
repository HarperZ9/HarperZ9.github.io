// cursor-field.js: the brand aperture as a cursor aura that trails the pointer across the whole
// site, the same luminous-orb identity as the logo, rendered live on the GPU. It eases after the
// real cursor (kept for precision), screens over the content, and never intercepts pointer events.
//
// Mounted once per page (a module-level singleton). Skipped on coarse/touch pointers (no mouse to
// follow) and under prefers-reduced-motion. mountCursorField(opts) -> { destroy() } | null.

let __cursorHandle = null;

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

const FRAG = `precision highp float;
uniform vec2 u_res; uniform float u_time;
float hash(vec2 p){ return fract(sin(dot(floor(p), vec2(127.1,311.7))) * 43758.5453); }
vec3 hsl2rgb(vec3 c){ vec3 r = clamp(abs(mod(c.x*6.0 + vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0); return c.z + c.y*(r-0.5)*(1.0-abs(2.0*c.z-1.0)); }
void main(){
  // centered, y-normalized, scaled out so the aperture sits inside the disc with margin to fade
  vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / u_res.y * 1.35;
  float t = u_time;
  vec2 p = uv;
  p.x += 0.10*sin(p.y*6.0 + t*0.8);          // gentle domain warp -> the field breathes
  p.y += 0.10*cos(p.x*6.0 + t*1.0);
  float r = length(p), th = atan(p.y, p.x);
  float arm  = 0.42 + 0.58*cos(5.0*th + 1.6*r*3.1 + t*0.3);   // spiral arms
  float ring = exp(-pow((r-0.32)/0.12, 2.0));                 // the corona ring
  float halo = exp(-r*2.6)*0.7;
  float armF = pow(max(0.0,arm),1.5)*exp(-abs(r-0.32)*2.4);
  float lum = ring*(0.4+0.7*arm) + 0.34*halo + 0.5*armF;
  float voidR = 0.11;                                         // the broken void core
  if(r < voidR) lum *= (r/voidR)*(r/voidR)*0.25;
  // one drifting spectral flare, the same signature as the logo
  float fA = t*0.5;
  float dA = abs(mod(th - fA + 3.14159, 6.28318) - 3.14159);
  vec3 col = vec3(0.70, 0.92, 0.35);
  if(dA < 0.5 && r > voidR){ col = mix(col, hsl2rgb(vec3(fract(th*0.16 + 0.55), 0.9, 0.62)), 0.7); }
  float alpha = clamp(lum*1.25, 0.0, 1.0);
  alpha *= smoothstep(0.5, 0.34, r);                          // circular fade, never a square edge
  alpha += (hash(gl_FragCoord.xy + t) - 0.5) * 0.05 * alpha;  // faint instrument grain
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;

function compile(gl, type, src){
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(sh); gl.deleteShader(sh); throw new Error("cursor-field compile: " + log); }
  return sh;
}

export function isCursorFieldAvailable(){
  try {
    if (typeof window === "undefined" || typeof document === "undefined") return false;
    if (!(window.matchMedia && window.matchMedia("(pointer: fine)").matches)) return false;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch (_) { return false; }
}

export function mountCursorField(opts){
  const o = opts || {};
  if (__cursorHandle) return __cursorHandle;          // one aura per page
  if (!isCursorFieldAvailable()) return null;         // no mouse, or reduced motion, or no WebGL

  const size = o.size || 104;                          // css px
  const canvas = document.createElement("canvas");
  canvas.className = "cursor-field";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed", left: "0", top: "0", width: size + "px", height: size + "px",
    pointerEvents: "none", zIndex: "2147483000", mixBlendMode: "screen",
    opacity: "0", transition: "opacity 0.4s ease", willChange: "transform",
    transform: "translate(-9999px, -9999px)",
  });
  document.body.appendChild(canvas);

  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true })
    || canvas.getContext("experimental-webgl", { alpha: true, premultipliedAlpha: false });
  if (!gl) { canvas.remove(); return null; }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); throw new Error("cursor-field link: " + gl.getProgramInfoLog(prog)); }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.max(1, Math.round(size * dpr));
  canvas.height = Math.max(1, Math.round(size * dpr));
  gl.useProgram(prog);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let tx = -9999, ty = -9999, cx = -9999, cy = -9999, seen = false;
  const onMove = (e) => {
    tx = e.clientX; ty = e.clientY;
    if (!seen) { seen = true; cx = tx; cy = ty; canvas.style.opacity = "1"; }
  };
  const hide = () => { canvas.style.opacity = "0"; };
  const show = () => { if (seen) canvas.style.opacity = "1"; };
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("mouseleave", hide);
  document.addEventListener("mouseenter", show);
  window.addEventListener("blur", hide);
  window.addEventListener("focus", show);

  let raf = 0, t0 = 0, running = false, disposed = false;
  const draw = (tms) => {
    cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;     // ease after the pointer (a soft trail)
    canvas.style.transform = "translate(" + (cx - size / 2) + "px, " + (cy - size / 2) + "px)";
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, tms * 0.001);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = (tms) => { if (!running || disposed) return; if (!t0) t0 = tms; draw(tms - t0); raf = requestAnimationFrame(loop); };
  const start = () => { if (running || disposed) return; running = true; raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const onVis = () => { if (document.hidden) stop(); else start(); };
  document.addEventListener("visibilitychange", onVis);
  start();

  __cursorHandle = {
    destroy(){
      disposed = true; stop();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", hide);
      document.removeEventListener("mouseenter", show);
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
      document.removeEventListener("visibilitychange", onVis);
      const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext();
      canvas.remove(); __cursorHandle = null;
    },
  };
  return __cursorHandle;
}
