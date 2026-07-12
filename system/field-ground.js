// field-ground.js: one continuous, living GPU field behind the whole site.
//
// A single fixed WebGL canvas renders a calm generative ground that is anchored to the DOCUMENT
// (scroll rides in as a uniform), so every surface floats on the same field and blends into the
// next with no frame and no seam. It is kept faint on a near-void base so light text stays legible;
// the one spectral accent is the only hot mark.
//
// It carries VARIETY, drawn from the inspiration corpus (DESIGN-INSPIRATION.md): a per-page SEED
// (so each page is its own variation) and a MODE that swaps the generative technique --
//   0 aperture-flow (warped corona + flowing contours),
//   1 crystalline   (drifting Voronoi facets, refractive spectral edges),
//   2 growth-rings  (concentric fbm-warped rings that dilate over time).
// All modes share the palette, grain, chromatic shimmer and one flare, so they blend across pages.
// The home passes hero:1 to bloom an intense aperture behind the masthead that dissolves on scroll.
//
// mountFieldGround(canvas, { seed, mode, hero, reduced }) -> { destroy() }.
// seedFromPath / modeFromPath derive per-page variation. isFieldGroundAvailable() gates callers.

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

const FRAG = `precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_scroll;
uniform float u_seed;
uniform float u_hero;
uniform int   u_mode;
uniform vec2  u_pointer;
uniform float u_hue;    // per-principle hue bias (0..1): the emotional colour of the page
uniform float u_gain;   // per-principle intensity: how forcefully the field rises

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  float a = hash(i), b = hash(i+vec2(1.0,0.0)), c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
// Voronoi returning F1 and the edge gap (F2-F1); cells drift so the crystal is alive.
vec2 voronoi(vec2 x){
  vec2 n = floor(x), f = fract(x);
  float f1 = 8.0, f2 = 8.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash2(n+g);
    o = 0.5 + 0.5*sin(u_time*0.3 + 6.2831*o);
    vec2 r = g + o - f; float d = dot(r,r);
    if(d < f1){ f2 = f1; f1 = d; } else if(d < f2){ f2 = d; }
  }
  return vec2(sqrt(f1), sqrt(f2)-sqrt(f1));
}
vec3 hsl2rgb(vec3 c){
  vec3 r = clamp(abs(mod(c.x*6.0 + vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
  return c.z + c.y*(r-0.5)*(1.0-abs(2.0*c.z-1.0));
}

void main(){
  float H = u_res.y;
  vec2 p = vec2(gl_FragCoord.x, (H - gl_FragCoord.y) + u_scroll) / H;

  // databend: a rare, gentle sideways slip on a few bands (organic, not a harsh tear).
  float gblk = floor((gl_FragCoord.y + u_scroll) / 16.0);
  float gOn = step(0.96, hash(vec2(gblk, floor(u_time*2.5))));
  p.x += gOn * (hash(vec2(gblk, floor(u_time*2.5) + 9.0)) - 0.5) * 0.10;

  // liquid + weird: a turbulent domain-warp OF a warp, so the flow folds back on itself into
  // strange organic currents instead of a tame drift. Still smooth, just stranger.
  vec2 wq = p*1.4 + u_time*0.045 + u_seed;
  p += 0.16 * vec2(fbm(wq + fbm(wq)), fbm(wq + 4.0 - u_time*0.04 + fbm(wq*1.3)));

  // The ground is not clean void. It is bitter dark and abstract filth: mottled rot,
  // oxidised patches, a rare corrupted scanline. The rot the light has to rise through.
  // Kept dark (values ~0.02-0.09) so text stays legible on top.
  float rot = fbm(p*2.3 + vec2(0.0, u_time*0.012) + u_seed*3.0);
  vec3 base = mix(vec3(0.016, 0.024, 0.014), vec3(0.050, 0.018, 0.055), rot);
  base += vec3(0.032, 0.012, 0.0) * smoothstep(0.72, 1.0, fbm(p*5.0 - u_seed)) * 0.6;
  float rotband = floor((gl_FragCoord.y + u_scroll) / 6.0);
  base += vec3(0.035, 0.0, 0.05) * step(0.986, hash(vec2(rotband, floor(u_time*3.0)))) * 0.6;
  vec3 glyph = vec3(0.60, 0.585, 0.72);
  vec3 col = base;
  float feat = 0.0, hot = 0.0, hue = 0.55;

  // base continuity: a faint flowing contour, present in every mode and on every page.
  {
    vec2 ctr = vec2(u_res.x/H * 1.12, -0.28);
    vec2 d = p - ctr; float ang = atan(d.y, d.x), rad = length(d);
    float w = fbm(p*1.7 + vec2(0.0, u_time*0.06) + u_seed);
    float ph = rad*6.0 + ang*1.9 + w*2.2;
    // broad, soft gradient bands -> liquid flow
    float band = pow(0.5 + 0.5*sin(ph*6.2831), 1.7);
    // liquid caustics: sharp bright lines like light refracting through moving water
    float caustic = pow(0.5 + 0.5*sin(ph*9.0 + fbm(p*3.2 + u_time*0.12)*5.0), 6.0);
    // gooey: thick viscous blobs oozing through the field so it has weight, not just thin flow
    float goo = smoothstep(0.34, 0.64, fbm(p*1.55 + u_time*0.05 + u_seed));
    feat = max(band * (0.11 + 0.13*fbm(p*2.4 - u_seed)) + caustic*0.07, goo*0.17);
    hue = mod(ang*42.0 + 205.0, 360.0)/360.0;
  }

  // the feature layer: a different generative technique per mode.
  if(u_mode == 1){
    vec2 vd = voronoi(p*3.2 + u_seed);
    float edge = smoothstep(0.055, 0.0, vd.y);
    feat = max(feat, edge*0.5);
    hot = edge * smoothstep(0.4, 0.9, fbm(p*1.3 + u_time*0.05));
    hue = mod(vd.x*220.0 + u_seed*30.0, 360.0)/360.0;
  } else if(u_mode == 2){
    float g = fbm(p*2.4 + u_seed);
    float rings = smoothstep(0.06, 0.0, abs(fract(length(p-vec2(0.5,0.4))*6.0 - u_time*0.15 + g*1.5) - 0.5));
    feat = max(feat, rings*0.36);
    hot = rings * smoothstep(0.6, 1.0, fbm(p*1.1 - u_time*0.02));
    hue = mod(g*300.0 + 180.0, 360.0)/360.0;
  } else if(u_mode == 3){
    // mycelium / roots: a warped branching network threading up through the rot.
    vec2 q = p + 0.16*vec2(fbm(p*2.0 + u_seed), fbm(p*2.0 + 5.0));
    vec2 vd = voronoi(q*4.6 + u_seed);
    float threads = smoothstep(0.05, 0.0, vd.y);
    feat = max(feat, threads*0.5);
    hot = threads * smoothstep(0.3, 0.8, fbm(q*2.0));
    hue = mod(vd.x*90.0 + 120.0, 360.0)/360.0;
  } else if(u_mode == 4){
    // aurora / sky: vertical curtains of light, brighter high overhead.
    float warp = fbm(vec2(p.x*2.0, p.y*0.6) + vec2(u_time*0.05, 0.0));
    float curtain = smoothstep(0.34, 0.0, abs(fract(p.x*3.0 + warp*1.6) - 0.5));
    float up = smoothstep(1.5, 0.1, p.y);
    feat = max(feat, curtain*up*0.42);
    hot = curtain*up;
    hue = mod(p.y*80.0 + 150.0, 360.0)/360.0;
  } else if(u_mode == 5){
    // the sun: a corona of radial filaments around a hot core.
    vec2 c = p - vec2(u_res.x/u_res.y*0.5, 0.45);
    float r = length(c), th = atan(c.y, c.x);
    float fil = 0.5 + 0.5*cos(th*22.0 + fbm(c*3.0 + u_time*0.1)*6.0);
    float corona = pow(fil, 2.0) * exp(-abs(r-0.3)*3.2);
    float core = exp(-r*r*7.0);
    feat = max(feat, corona*0.4 + core*0.55);
    hot = corona + core;
    hue = mod(th*10.0 + 45.0, 360.0)/360.0;
  } else {
    float w2 = fbm(p*3.4 - vec2(u_time*0.02, 0.0) + u_seed*2.0);
    float line2 = smoothstep(0.05, 0.0, abs(fract(length(p-vec2(0.5,0.3))*5.0 + w2*2.0) - 0.5));
    feat = max(feat, line2*0.14);
    hot = smoothstep(0.72, 1.0, fbm(p*1.05 + vec2(u_time*0.02, -u_time*0.014) + 3.1));
  }

  col += glyph*feat*u_gain;
  hue = fract(hue + u_hue);   // rotate the accent toward the page's principle colour (identity at 0)
  col += hsl2rgb(vec3(hue, 0.82, 0.6)) * hot * max(feat, 0.14) * 0.6 * u_gain;

  // the home hero: an intense bleeding aperture that dissolves into the field as you scroll.
  if(u_hero > 0.5){
    float heroT = smoothstep(1.45, 0.12, p.y);
    if(heroT > 0.001){
      vec2 ap = (p - vec2(u_res.x/H * 0.66, 0.44)) * 1.12;
      ap.x += 0.16*sin(ap.y*5.0 + u_time*0.15 + u_seed);
      ap.y += 0.16*cos(ap.x*5.0 + u_time*0.12);
      float r = length(ap), th = atan(ap.y, ap.x);
      float arm = 0.42 + 0.58*cos(6.0*th + 2.0*r*3.1);
      float ring = exp(-pow((r-0.34)/0.34, 2.0));
      float halo = exp(-r*1.0)*0.7;
      float armF = pow(max(0.0,arm),1.5)*exp(-abs(r-0.34)*0.8);
      float al = clamp(ring*(0.4+0.7*arm) + 0.30*halo + 0.5*armF, 0.0, 1.0);
      float dA = abs(mod(th - u_seed + 3.14159, 6.28318) - 3.14159);
      vec3 apCol = glyph * 1.25;
      if(dA < 0.7 && r > 0.05) apCol = hsl2rgb(vec3(fract(mod(th*52.0 + 200.0, 360.0)/360.0 + u_hue), 0.9, 0.62));
      col += apCol * al * heroT * 0.5;
    }
  }

  // the return: having reached the far light, it descends back through the field to mend the
  // broken threads left in the dark — the reconcile as repair. A slow band travels downward,
  // rejoining and brightening the network it crosses.
  float mendY = fract(u_time * 0.05);
  float mend = exp(-pow((fract(p.y*0.42) - mendY)*6.5, 2.0));
  col += glyph * mend * feat * 1.1;
  col += hsl2rgb(vec3(fract(u_hue + 0.12), 0.70, 0.62)) * mend * max(feat, 0.10) * 0.4;

  // manic energy: FAST highs and lows, bipolar. The dark drops out on the lows and the light
  // slams back on the highs, restless and quick, not a breath. The collapse still makes the star.
  float swing = 0.5 + 0.5*sin(u_time*0.72 + sin(u_time*0.27)*1.7);   // fast, irregular
  float low  = pow(1.0 - swing, 2.0);
  float high = pow(swing, 3.0);
  col *= 1.0 - low*0.28;
  col += (glyph*0.5 + hsl2rgb(vec3(fract(u_hue + 0.08), 0.50, 0.72))*0.5) * high * (feat*2.3 + 0.12);

  // and a soft bloom follows the pointer so the field answers the viewer, never inert.
  vec2 ptr = u_pointer * u_res;
  float pd = length(gl_FragCoord.xy - ptr) / u_res.y;
  float bloom = exp(-pd*pd*2.6);
  col += glyph * bloom * 0.09;
  col += hsl2rgb(vec3(mod(u_seed*0.1 + 0.52, 1.0), 0.72, 0.6)) * bloom * 0.06;

  // corpus veil, smoothed: a faint chromatic shimmer, a very occasional soft tear, light grain.
  // The corruption is a whisper now, not a fight with the text.
  float g = 0.018 + 0.026*high;
  col.r += g * sin((gl_FragCoord.y + u_scroll)*0.08 + u_time*1.3);
  col.b += g * sin((gl_FragCoord.y + u_scroll)*0.08 + u_time*1.3 + 2.3);
  float tear = step(0.965, hash(vec2(gblk, floor(u_time*3.0))));
  col += vec3(0.03, -0.012, 0.04) * tear;                             // soft channel-split tear
  col += (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * 0.022;       // light grain

  gl_FragColor = vec4(col, 1.0);
}`;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A stable 32-bit hash of a string, so a page's path becomes its own seed.
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Shortest-path hue interpolation (wraps at 1.0) so a page can bend between its two poles
// without swinging the long way round the wheel.
function hlerp(a, b, t) { let d = b - a; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; return ((a + d * t) % 1 + 1) % 1; }

// Per-page variation derived from the path: a unique seed, and a mode chosen from the three
// techniques. The home ("/", "index.html") is pinned to the aperture-flow mode and seed 58.
export function seedFromPath(pathname) {
  const f = (pathname || "/").split("/").pop() || "index.html";
  if (f === "" || f === "index.html") return 58;
  return hashString(f) % 997;
}
export function modeFromPath(pathname) {
  const f = (pathname || "/").split("/").pop() || "index.html";
  if (f === "" || f === "index.html") return 0;
  return hashString("m:" + f) % 3;
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("field-ground shader compile failed: " + log);
  }
  return sh;
}

export function isFieldGroundAvailable() {
  try {
    if (typeof document === "undefined") return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch (_) { return false; }
}

// A page can be themed on the principle its tool serves. Each entry sets the generative
// technique (mode), the emotional colour (hue 0..1), and how forcefully the field rises
// (gain) — all still rising from the same void. This is a STARTER map for the operator to
// reshape; the emotional assignment of principle-to-page is theirs to make, not presumed.
export const PRINCIPLES = {
  origin:       { mode: 0, hue: 0.00, gain: 1.00 },  // the whole: the aperture rising from filth
  protection:   { mode: 1, hue: 0.62, gain: 0.92 },  // crystalline armour, cold blue-violet
  offense:      { mode: 1, hue: 0.02, gain: 1.08 },  // faceted edge, ember-red
  light:        { mode: 0, hue: 0.30, gain: 1.02 },  // discernment, warm gold-lime
  wonder:       { mode: 2, hue: 0.55, gain: 1.00 },  // growth, spectral cyan
  memory:       { mode: 3, hue: 0.80, gain: 0.86 },  // roots in the dark, deep violet
  judgment:     { mode: 1, hue: 0.09, gain: 1.04 },  // crystalline fire, amber
  // the natural + cosmic vocabulary, each rising through the rot
  mycology:     { mode: 3, hue: 0.30, gain: 1.00 },  // mycelial bioluminescence, green
  arboriculture:{ mode: 3, hue: 0.12, gain: 0.98 },  // branch + root, amber
  roots:        { mode: 3, hue: 0.86, gain: 0.90 },  // tendrils in the deep
  sky:          { mode: 4, hue: 0.55, gain: 0.95 },  // pale atmosphere
  clouds:       { mode: 4, hue: 0.62, gain: 0.85 },  // drifting cover
  aurora:       { mode: 4, hue: 0.40, gain: 1.05 },  // curtains, green-violet
  sun:          { mode: 5, hue: 0.10, gain: 1.10 },  // corona, gold-white
};

export function mountFieldGround(canvas, opts) {
  const o = opts || {};
  const P = (o.principle && PRINCIPLES[o.principle]) || {};
  const seed = o.seed != null ? o.seed : 58;
  const mode = o.mode != null ? o.mode : (P.mode != null ? P.mode : 0);
  const hero = o.hero != null ? o.hero : false;
  const reduced = o.reduced != null ? o.reduced : false;
  const hue = o.hue != null ? o.hue : (P.hue != null ? P.hue : 0);
  const gain = o.gain != null ? o.gain : (P.gain != null ? P.gain : 1);
  // Duality: a page can BEND between the two poles its tool lives between (intentions shift
  // and bend). The field oscillates its colour and intensity between the primary and the bend.
  const P2 = (o.bend && PRINCIPLES[o.bend]) || null;
  const hue2 = P2 && P2.hue != null ? P2.hue : hue;
  const gain2 = P2 && P2.gain != null ? P2.gain : gain;
  const bending = hue2 !== hue || gain2 !== gain;
  // Cover all the moods: the accent hue roams the full spectrum, irregularly, so the field
  // passes through the whole emotional range instead of holding one colour. (The whole/home.)
  const wander = o.wander != null ? o.wander : false;
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" })
    || canvas.getContext("experimental-webgl", { alpha: false, antialias: false });
  if (!gl) throw new Error("field-ground needs WebGL");

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("field-ground link failed: " + gl.getProgramInfoLog(prog));
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  const U = (n) => gl.getUniformLocation(prog, n);
  const u = {
    res: U("u_res"), time: U("u_time"), scroll: U("u_scroll"),
    seed: U("u_seed"), hero: U("u_hero"), mode: U("u_mode"), pointer: U("u_pointer"),
    hue: U("u_hue"), gain: U("u_gain"),
  };
  const seedN = mulberry32(seed >>> 0)() * 10.0;
  let px = 0.5, py = 0.5;

  gl.useProgram(prog);
  gl.uniform1f(u.seed, seedN);
  gl.uniform1f(u.hero, hero ? 1 : 0);
  gl.uniform1i(u.mode, mode | 0);
  gl.uniform2f(u.pointer, px, py);
  gl.uniform1f(u.hue, hue);
  gl.uniform1f(u.gain, gain);

  let raf = 0, t0 = 0, running = false, disposed = false, pending = false;

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(window.innerWidth * dpr));
    const h = Math.max(1, Math.round(window.innerHeight * dpr));
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
  };

  const draw = (tms) => {
    pending = false;
    size();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, reduced ? 0 : tms * 0.0019);   // slower, viscous, gooey ooze
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    gl.uniform1f(u.scroll, (window.scrollY || 0) * dpr);
    gl.uniform2f(u.pointer, px, py);
    if (bending && !reduced) {
      const bt = 0.5 + 0.5 * Math.sin(tms * 0.0018);   // fast ~3.5s bend between the poles
      gl.uniform1f(u.hue, hlerp(hue, hue2, bt));
      gl.uniform1f(u.gain, gain + (gain2 - gain) * bt);
    }
    if (wander && !reduced) {
      const w = tms * 0.00003 + 0.35 * Math.sin(tms * 0.00028) + 0.12 * Math.sin(tms * 0.00097);
      gl.uniform1f(u.hue, ((w % 1) + 1) % 1);   // the mood roams every colour, irregularly
    }
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

  const requestStatic = () => { if (reduced && !pending && !disposed) { pending = true; requestAnimationFrame(draw); } };
  const onVis = () => { if (document.hidden) stop(); else start(); };
  // Pointer bloom only when we are animating; under reduced motion the field stays a still.
  const onPointer = (e) => { px = e.clientX / window.innerWidth; py = 1.0 - e.clientY / window.innerHeight; };

  window.addEventListener("resize", requestStatic, { passive: true });
  window.addEventListener("scroll", requestStatic, { passive: true });
  document.addEventListener("visibilitychange", onVis);
  if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });

  draw(0);
  if (!reduced) start();

  return {
    destroy() {
      disposed = true; stop();
      window.removeEventListener("resize", requestStatic);
      window.removeEventListener("scroll", requestStatic);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVis);
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    },
  };
}
