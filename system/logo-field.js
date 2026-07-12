// logo-field.js: the brand mark as a live WebGL fragment shader, not a cropped tile.
//
// The identity is the same seeded aperture as the favicon (scripts/gen-mark.mjs, seed 58) -- a
// domain-warped corona around a broken void core, ordered-dithered, with one spectral flare -- but
// rendered on the GPU as a WIDE field that is SPLIT ACROSS THREE PARALLAX LAYERS and blends to
// transparent at its edges, so it spreads organically across the header instead of sitting boxed.
//
// Built on the house GL harness (mirrors fractal-gl.js): a full-screen triangle, compile/link, a
// single drawArrays, DPR clamped to <=1.5 for this small surface. Straight-alpha output blended over
// the header (SRC_ALPHA, ONE_MINUS_SRC_ALPHA) so the mark dissipates -- no rounded-rect crop.
//
// mountLogoField(canvas, { seed, reduced }) -> { destroy() }. Animates slowly (the "shift"); pauses
// when the tab is hidden or the canvas scrolls offscreen; renders one static frame under
// prefers-reduced-motion. isLogoFieldAvailable() is the capability probe the callers gate on before
// replacing the static SVG fallback.

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

// mulberry32 + the EXACT rnd() draw order from scripts/gen-mark.mjs, so the shader's aperture is the
// same composition as favicon.svg for a given seed. Keep these two in lockstep.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedParams(seed) {
  const rnd = mulberry32(seed >>> 0);
  return {
    ringR: 0.30 + rnd() * 0.07,
    voidR: 0.085 + rnd() * 0.05,
    arms: 3 + Math.floor(rnd() * 6),
    twist: (rnd() * 2 - 1) * 3.2,
    warpF: 0.7 + rnd() * 1.8,
    warpA: 0.13 + rnd() * 0.2,
    flareA: rnd() * 6.283,
    flareW: 0.42 + rnd() * 0.5,
    sd: seed * 0.017,
  };
}

const FRAG = `precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_ringR, u_voidR, u_arms, u_twist, u_warpF, u_warpA, u_flareA, u_flareW, u_sd;

// 4x4 ordered dither, the same BAYER matrix as gen-mark.mjs.
float bayer(vec2 c){
  int x = int(mod(c.x,4.0)); int y = int(mod(c.y,4.0)); int i = y*4 + x;
  if(i==0)return 0.0/16.0; else if(i==1)return 8.0/16.0; else if(i==2)return 2.0/16.0; else if(i==3)return 10.0/16.0;
  else if(i==4)return 12.0/16.0; else if(i==5)return 4.0/16.0; else if(i==6)return 14.0/16.0; else if(i==7)return 6.0/16.0;
  else if(i==8)return 3.0/16.0; else if(i==9)return 11.0/16.0; else if(i==10)return 1.0/16.0; else if(i==11)return 9.0/16.0;
  else if(i==12)return 15.0/16.0; else if(i==13)return 7.0/16.0; else if(i==14)return 13.0/16.0; return 5.0/16.0;
}
float hash(vec2 p){ return fract(sin(dot(floor(p), vec2(127.1,311.7))) * 43758.5453); }
vec3 hsl2rgb(vec3 c){
  vec3 r = clamp(abs(mod(c.x*6.0 + vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
  return c.z + c.y*(r-0.5)*(1.0-abs(2.0*c.z-1.0));
}

void main(){
  // wide field: y in [-0.5,0.5], x scaled by aspect so the mark has room to spread horizontally.
  // Scaled out a touch so the aperture sits INSIDE the band with margin (never clipped at the edge).
  vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / u_res.y * 1.12;
  // Layer spread tracks aspect: a wide nav band spreads the layers apart; a tall plate
  // pulls them into a fuller centered aperture. Keeps one shader coherent at every size.
  float spread = clamp(u_res.x / u_res.y, 0.5, 1.35);
  float best = 0.0, flare = 0.0, fhue = 0.0;
  // THREE parallax layers, spread on x and drifting at different phases -> the display splits
  // across layers instead of reading as one flat emblem.
  for(int i=0;i<3;i++){
    float fi = float(i);
    vec2 off = vec2((fi-1.0)*0.40*spread, (fi-1.0)*0.05);
    float sc = 1.0 + fi*0.34;
    float ph = u_time*0.12 + fi*2.3 + u_sd;
    vec2 p = (uv - off)/sc;
    p.x += u_warpA*0.72*sin(p.y*5.5*u_warpF + ph);
    p.y += u_warpA*0.72*cos(p.x*5.5*u_warpF + ph*1.4);
    float r = length(p), th = atan(p.y, p.x);
    float arm = 0.42 + 0.58*cos(u_arms*th + u_twist*r*3.1);
    float ring = exp(-pow((r-u_ringR)/0.30, 2.0));
    float halo = exp(-r*1.05)*0.8;
    float armF = pow(max(0.0,arm),1.5)*exp(-abs(r-u_ringR)*0.8);
    float lum = ring*(0.4+0.7*arm) + 0.34*halo + 0.5*armF;
    if(r < u_voidR) lum *= (r/u_voidR)*(r/u_voidR)*0.25;
    lum *= (1.0 - fi*0.24);
    float dA = abs(mod(th - u_flareA + 3.14159, 6.28318) - 3.14159);
    if(dA < u_flareW && r > u_voidR){ if(lum > flare){ flare = lum; fhue = mod(th*52.0 + 200.0, 360.0)/360.0; } }
    best = max(best, lum);
  }
  // dither + fine grain + posterize into the ASCII ramp's ~13 bands + a scanline: instrument texture.
  float lq = best - (bayer(gl_FragCoord.xy)-0.5)*0.5 + (hash(gl_FragCoord.xy)-0.5)*0.14;
  lq = clamp(lq, 0.0, 1.0);
  lq = floor(lq*13.0)/13.0;
  lq *= 0.82 + 0.18*step(0.5, fract(gl_FragCoord.y*0.5 + 0.25));
  vec3 glyph = vec3(0.918, 0.890, 0.968);
  vec3 col = glyph;
  float alpha = clamp(lq*1.18, 0.0, 1.0);
  if(flare > 0.02){
    vec3 fc = hsl2rgb(vec3(fhue, 0.92, 0.63));
    col = mix(col, fc, 0.78);
    alpha = max(alpha, clamp(flare*1.02, 0.0, 1.0));
  }
  // Edge vignette so the field dissipates into the header instead of clipping to a
  // rectangle -- it spreads organically, and fades early on the right into the wordmark.
  vec2 q = gl_FragCoord.xy / u_res;
  float vig = smoothstep(0.0, 0.13, q.x) * smoothstep(0.0, 0.28, 1.0 - q.x)
            * smoothstep(0.0, 0.30, q.y) * smoothstep(0.0, 0.30, 1.0 - q.y);
  alpha *= vig;
  gl_FragColor = vec4(col, alpha);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("logo-field shader compile failed: " + log);
  }
  return sh;
}

export function isLogoFieldAvailable() {
  try {
    if (typeof document === "undefined") return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch (_) { return false; }
}

export function mountLogoField(canvas, opts) {
  const { seed = 58, reduced = false } = opts || {};
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true })
    || canvas.getContext("experimental-webgl", { alpha: true, premultipliedAlpha: false, antialias: true });
  if (!gl) throw new Error("logo-field needs WebGL");

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("logo-field link failed: " + gl.getProgramInfoLog(prog));
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  const U = (n) => gl.getUniformLocation(prog, n);
  const u = {
    res: U("u_res"), time: U("u_time"), ringR: U("u_ringR"), voidR: U("u_voidR"),
    arms: U("u_arms"), twist: U("u_twist"), warpF: U("u_warpF"), warpA: U("u_warpA"),
    flareA: U("u_flareA"), flareW: U("u_flareW"), sd: U("u_sd"),
  };
  const P = seedParams(seed);

  gl.useProgram(prog);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform1f(u.ringR, P.ringR); gl.uniform1f(u.voidR, P.voidR);
  gl.uniform1f(u.arms, P.arms); gl.uniform1f(u.twist, P.twist);
  gl.uniform1f(u.warpF, P.warpF); gl.uniform1f(u.warpA, P.warpA);
  gl.uniform1f(u.flareA, P.flareA); gl.uniform1f(u.flareW, P.flareW);
  gl.uniform1f(u.sd, P.sd);

  let raf = 0, t0 = 0, running = false, disposed = false;

  const size = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round((rect.width || 1) * dpr));
    const h = Math.max(1, Math.round((rect.height || 1) * dpr));
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
    gl.uniform1f(u.time, reduced ? 0 : tms * 0.001);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (tms) => {
    if (!running || disposed) return;
    if (!t0) t0 = tms;
    draw(tms - t0);
    raf = requestAnimationFrame(loop);
  };
  const start = () => { if (running || disposed || reduced) return; running = true; raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  const onVis = () => { if (document.hidden) stop(); else start(); };
  let io = null;
  if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? start() : stop())); }, { threshold: 0.01 });
    io.observe(canvas);
  }
  document.addEventListener("visibilitychange", onVis);

  draw(0);          // one frame immediately (and the only frame under reduced motion)
  if (!reduced) start();

  return {
    destroy() {
      disposed = true; stop();
      document.removeEventListener("visibilitychange", onVis);
      if (io) io.disconnect();
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    },
  };
}
