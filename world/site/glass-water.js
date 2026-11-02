// glass-water.js: glass lettering over live water, in several spaces. Water, sun (or moon), glass and the lettering
// are all parameters that move; a space is one set of them, and moving between spaces eases every parameter at once
// along a path the visitor can see coming (the sun travels, the camera rises, the word re-forms).
// Light: a single-scattering sky with a Henyey-Greenstein sun glow, water as a Fresnel mirror (n 1.33) over a deep
// body colour, waves as a sum of directional sines whose slope fades with distance (no shimmer at the horizon),
// glass as a bevelled slab that refracts the scene with per-channel dispersion. Output is ACES-mapped and dithered,
// so gradients do not band. Reduced motion: each space is one settled still. Paused off screen and in hidden tabs.
const SPACES = {
  "noon": { label: "Noon, from above", word: "water", say: "High sun, seen from a cliff: the water goes clear and blue, and the glass throws the light it bends.",
    p: { sunEl: 1.05, sunAz: 0.7, night: 0, camH: 34.0, pitch: -0.42, wave: 0.55, wind: 0.6, gY: 0.52, gW: 0.46, thick: 1.4, disp: 1.0, expo: 0.85 } },
  "night": { label: "Night", word: "glass", say: "A low moon over a dark sea: one cold path of light, and the glass only where it catches it.",
    p: { sunEl: 0.16, sunAz: -0.22, night: 1, camH: 3.0, pitch: 0.02, wave: 0.22, wind: -0.4, gY: 0.50, gW: 0.46, thick: 1.1, disp: 0.4, expo: 1.9 } },
  "close": { label: "Close to the glass", word: "light", say: "At the water line, close enough that the letters fill the view and the horizon runs through them.",
    p: { sunEl: 0.11, sunAz: 0.25, night: 0, camH: 0.55, pitch: 0.01, wave: 0.18, wind: 0.2, gY: 0.50, gW: 1.25, thick: 1.8, disp: 1.4, expo: 1.0 } },
};
// "Low sun" (the name in glass at a sun just over the horizon) is held back: its sky reads as flat haze where a sun
// that low turns the sky red at the horizon and blue above, which fails the media bar (PASSES.md, pass 6)
const ORDER = Object.keys(SPACES);
// the canvas holds at most 1.5 device pixels per CSS pixel; ?dpr=2 lifts it for a full-resolution still
const CAP = Math.min(3, Number(new URLSearchParams(location.search).get("dpr")) || 1.5);

const VERT = `#version 300 es
in vec2 a; out vec2 v; void main(){ v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;
const FRAG = `#version 300 es
precision highp float;
in vec2 v; out vec4 o;
uniform vec2 uRes; uniform float uT, uSunEl, uSunAz, uNight, uCamH, uPitch, uWave, uWind, uGY, uGW, uThick, uDisp, uExpo, uMix, uAsp0, uAsp1;
uniform sampler2D uTx0, uTx1;
const float PI = 3.14159265;
vec3 sunDir(){ return normalize(vec3(cos(uSunEl) * sin(uSunAz), sin(uSunEl), cos(uSunEl) * cos(uSunAz))); }
vec3 sunCol(){
  vec3 day = mix(vec3(1.0, 0.42, 0.16), vec3(1.0, 0.95, 0.88), smoothstep(0.0, 0.45, uSunEl));
  return mix(day * 22.0, vec3(0.62, 0.72, 0.95) * 1.6, uNight);
}
float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
vec3 sky(vec3 rd, bool disk){
  vec3 s = sunDir(); float mu = dot(rd, s), y = max(rd.y, 0.0);
  float low = 1.0 - smoothstep(0.0, 0.5, uSunEl);
  vec3 zen = mix(vec3(0.16, 0.34, 0.66), vec3(0.22, 0.26, 0.42), low);
  vec3 hor = mix(vec3(0.66, 0.76, 0.86), vec3(0.98, 0.62, 0.38), low);
  vec3 c = mix(hor, zen, pow(y, 0.45));
  c = mix(c, mix(vec3(0.006, 0.010, 0.022), vec3(0.020, 0.030, 0.060), 1.0 - y), uNight);
  float g = 0.78, hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5) / (4.0 * PI);
  c += sunCol() * hg * mix(0.010, 0.006, uNight);
  if (disk) c += sunCol() * smoothstep(0.999955, 0.999975, mu) * mix(2.5, 5.0, uNight);
  // stars: round points of varied brightness, in the sky only (the sea does not mirror points this small)
  if (disk && uNight > 0.5 && rd.y > 0.02) {
    vec2 g = vec2(atan(rd.z, rd.x), asin(rd.y)) * 300.0, cell = floor(g), f = fract(g) - 0.5;
    float h = hash(cell); vec2 off = (vec2(hash(cell + 7.1), hash(cell + 3.3)) - 0.5) * 0.6;
    float st = step(0.996, h) * smoothstep(0.16, 0.0, length(f - off)) * (0.4 + 2.0 * fract(h * 37.0));
    c += vec3(0.9, 0.93, 1.0) * st * 0.35 * uNight * smoothstep(0.02, 0.3, rd.y);
  }
  return c;
}
// waves: directional sines; returns the surface slope, faded with distance so the far field stays calm
vec2 slope(vec2 p, float dist){
  // s is each octave's peak slope, so the sea stays a sea: long swell, then shorter chop, each a little flatter.
  // An octave fades out once its wavelength nears the ground one pixel covers, so near water keeps its fine chop
  // while the far sea neither shimmers nor moires.
  vec2 d = vec2(0.0); float s = 0.55 * uWave, k = 0.16, ang = 0.4 + uWind;
  float foot = dist * 1.6 / uRes.y;
  // two crossing trains per octave, at an irrational spacing and with their own phases, so no lattice forms
  for (int i = 0; i < 12; i++) {
    float wl = 6.2832 / k, keep = clamp((wl / max(foot, 1e-4) - 6.0) / 8.0, 0.0, 1.0);
    float fi = float(i);
    for (int j = 0; j < 2; j++) {
      float a2 = ang + float(j) * 1.13 + 0.37 * sin(fi * 2.9 + float(j));
      vec2 dir = vec2(cos(a2), sin(a2));
      float ph = dot(dir, p) * k * (1.0 + 0.11 * float(j)) + uT * sqrt(9.81 * k) + fi * 1.618 + float(j) * 2.39;
      d += dir * (s * 0.62 * cos(ph)) * keep;
    }
    s *= 0.72; k *= 1.41; ang += 2.399;
  }
  return d * exp(-dist * 0.002);
}
vec3 scene(vec3 ro, vec3 rd){
  if (rd.y >= 0.0) return sky(rd, true);
  float t = -ro.y / rd.y; vec3 p = ro + rd * t;
  vec2 sl = slope(p.xz, t);
  vec3 n = normalize(vec3(-sl.x, 1.0, -sl.y));
  float cosi = clamp(dot(n, -rd), 0.0, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
  vec3 r = reflect(rd, n); r.y = abs(r.y);
  vec3 refl = sky(r, false);
  float spec = pow(max(dot(r, sunDir()), 0.0), mix(900.0, 1400.0, uNight));
  refl += sunCol() * spec * 0.6;
  vec3 body = mix(vec3(0.004, 0.030, 0.045), vec3(0.010, 0.055, 0.075), smoothstep(0.2, 1.0, uSunEl)) * mix(1.0, 0.12, uNight);
  vec3 c = mix(body, refl, F);
  float fog = 1.0 - exp(-t * 0.00045);
  return mix(c, sky(normalize(vec3(rd.x, 0.002, rd.z)), false), fog);
}
vec3 ray(vec2 uv){
  // a tall screen keeps the same horizontal field of view as a wide one, so the sun or moon stays in frame
  float asp = uRes.x / uRes.y;
  vec2 q = (uv - 0.5) * vec2(asp, 1.0) * max(1.0, 1.25 / asp);
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 f = vec3(0.0, sp, cp), rt = vec3(1.0, 0.0, 0.0), up = vec3(0.0, cp, -sp);
  return normalize(f * 1.35 + rt * q.x + up * q.y);
}
// the lettering: R is the antialiased mask, G the blurred height that shapes the bevel
vec4 glass(vec2 uv, sampler2D tx, float asp){
  vec2 c = vec2(0.5, uGY); float w = uGW, h = w / asp * (uRes.x / uRes.y);
  vec2 g = (uv - c) / vec2(w, h) + 0.5;
  if (any(lessThan(g, vec2(0.0))) || any(greaterThan(g, vec2(1.0)))) return vec4(0.0);
  // the bevel's slope from two sampling distances, averaged, so the 8-bit height does not terrace into steps
  vec2 t1 = vec2(1.0 / 2048.0, 1.0 / 512.0);
  float m = texture(tx, g).r, hx = 0.0, hy = 0.0;
  for (int j = 1; j <= 3; j++) {
    vec2 e = t1 * float(j * 2);
    hx += (texture(tx, g + vec2(e.x, 0.0)).g - texture(tx, g - vec2(e.x, 0.0)).g) / float(j);
    hy += (texture(tx, g + vec2(0.0, e.y)).g - texture(tx, g - vec2(0.0, e.y)).g) / float(j);
  }
  return vec4(hx * 0.55, hy * 0.55, texture(tx, g).g, m);
}
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec3 ro = vec3(0.0, uCamH, 0.0);
  vec3 rd = ray(v);
  vec3 col = scene(ro, rd);
  vec4 g0 = glass(v, uTx0, uAsp0), g1 = glass(v, uTx1, uAsp1);
  vec4 gl = mix(g0, g1, uMix);
  if (gl.a > 0.002) {
    vec3 n = normalize(vec3(-gl.x * 9.0 * uThick, -gl.y * 9.0 * uThick, 1.0));
    float bend = 0.085 * uThick;
    vec3 rr = scene(ro, ray(v + n.xy * bend * (1.0 + 0.012 * uDisp)));
    vec3 rg = scene(ro, ray(v + n.xy * bend));
    vec3 rb = scene(ro, ray(v + n.xy * bend * (1.0 - 0.012 * uDisp)));
    // thicker glass absorbs a little more, faintly green, as soda-lime glass does
    vec3 through = vec3(rr.r, rg.g, rb.b) * mix(vec3(1.0), vec3(0.80, 0.90, 0.87), gl.z);
    vec3 vd = vec3(0.0, 0.0, -1.0);
    float F = 0.04 + 0.96 * pow(1.0 - clamp(n.z, 0.0, 1.0), 5.0);
    vec3 wr = reflect(vd, n);
    vec3 refl = sky(normalize(vec3(wr.x, abs(wr.y) + 0.05, -wr.z)), false);
    float hl = pow(max(dot(normalize(vec3(n.x, n.y, n.z)), normalize(sunDir() + vec3(0.0, 0.0, 1.0))), 0.0), 120.0);
    vec3 glassCol = mix(through, refl, F) + sunCol() * hl * 0.04;
    col = mix(col, glassCol, gl.a);
  }
  col = aces(col * uExpo);
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash(gl_FragCoord.xy + fract(uT)) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

function wordTexture(gl, word, font) {
  const W = 2048, H = 512, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  // the word fits the texture with room for its bevel's blur on every side, ascenders and descenders included
  let size = 330, m; const set = () => { x.font = `800 ${size}px ${font}`; m = x.measureText(word); };
  set(); while ((m.width > W * 0.9 || m.actualBoundingBoxAscent + m.actualBoundingBoxDescent > H * 0.78) && size > 40) { size -= 6; set(); }
  const base = H / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  const draw = (blur) => { x.clearRect(0, 0, W, H); x.filter = blur ? `blur(${blur}px)` : "none"; x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillText(word, W / 2, base); return x.getImageData(0, 0, W, H).data; };
  const sharp = draw(0), soft = draw(Math.round(size * 0.055)), px = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { px[i * 4] = sharp[i * 4 + 3]; px[i * 4 + 1] = soft[i * 4 + 3]; px[i * 4 + 3] = 255; }
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // the word's own width over the texture's, so the shader can keep the letters' proportions
  return { tex: t, asp: (W / H) };
}

function program(gl) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export async function mountGlassWater(root) {
  const canvas = root.querySelector("canvas.gw-field"), say = root.querySelector(".gw-say"), buttons = [...root.querySelectorAll("[data-space]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) { root.classList.add("gw-still"); return null; }
  let prog;
  try { prog = program(gl); } catch (e) { console.error("glass-water: shader did not build", e); root.classList.add("gw-still"); return null; }
  await document.fonts.load("800 100px 'Hanken Grotesk'").catch((e) => console.info("glass-water: Hanken not loaded, the system face letters the glass", e.message));
  const font = "'Hanken Grotesk', system-ui, sans-serif";
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const n of ["uRes", "uT", "uSunEl", "uSunAz", "uNight", "uCamH", "uPitch", "uWave", "uWind", "uGY", "uGW", "uThick", "uDisp", "uExpo", "uMix", "uAsp0", "uAsp1", "uTx0", "uTx1"]) U[n] = gl.getUniformLocation(prog, n);
  const words = new Map(); const tex = (w) => { if (!words.has(w)) words.set(w, wordTexture(gl, w, font)); return words.get(w); };

  const start = new URLSearchParams(location.search).get("space");
  let cur = SPACES[start] ? start : "close";
  let from = { ...SPACES[cur].p }, to = from, t0 = 0, dur = 1, tx0 = tex(SPACES[cur].word), tx1 = tx0, running = true, visible = true, clock = 0, last = performance.now();
  const now = () => (reduced.matches ? 1 : Math.min(1, (performance.now() - t0) / dur));
  function params() { const k = ease(now()); const p = {}; for (const key in to) p[key] = from[key] + (to[key] - from[key]) * k; p.mix = k; return p; }
  function size() { const dpr = Math.min(devicePixelRatio || 1, CAP), r = canvas.getBoundingClientRect(), w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } gl.viewport(0, 0, w, h); }
  function frame(ts) {
    if (!running || !visible) return;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts; if (!reduced.matches) clock += dt;
    size(); const p = params();
    gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform1f(U.uT, clock);
    // a slow drift keeps the light alive inside a space: the sun wanders a few degrees, the wind veers
    const drift = reduced.matches ? 0 : 1;
    gl.uniform1f(U.uSunEl, p.sunEl + drift * 0.012 * Math.sin(clock * 0.05)); gl.uniform1f(U.uSunAz, p.sunAz + drift * 0.05 * Math.sin(clock * 0.031));
    for (const [u, k] of [["uNight", "night"], ["uCamH", "camH"], ["uPitch", "pitch"], ["uWave", "wave"], ["uGY", "gY"], ["uGW", "gW"], ["uThick", "thick"], ["uDisp", "disp"], ["uExpo", "expo"]]) gl.uniform1f(U[u], p[k]);
    gl.uniform1f(U.uWind, p.wind + drift * 0.08 * Math.sin(clock * 0.023));
    gl.uniform1f(U.uMix, tx0 === tx1 ? 0 : p.mix);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx0.tex); gl.uniform1i(U.uTx0, 0); gl.uniform1f(U.uAsp0, tx0.asp);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tx1.tex); gl.uniform1i(U.uTx1, 1); gl.uniform1f(U.uAsp1, tx1.asp);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (now() >= 1 && tx0 !== tx1) { tx0 = tx1; from = { ...to }; }
    if (reduced.matches) { running = false; return; }  // one settled still per space
    requestAnimationFrame(frame);
  }
  function go(id) {
    if (!SPACES[id] || id === cur) return;
    const p = params(); from = { ...p }; delete from.mix; to = { ...SPACES[id].p }; tx0 = tx1 === tx0 ? tx0 : tx1; tx1 = tex(SPACES[id].word);
    t0 = performance.now(); dur = 2600; cur = id;
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.space === id));
    if (say) say.textContent = SPACES[id].say;
    canvas.setAttribute("aria-label", `${SPACES[id].label}: ${SPACES[id].say} The glass letters read "${SPACES[id].word}".`);
    const u = new URL(location.href); u.searchParams.set("space", id); history.replaceState(null, "", u);
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  }
  for (const b of buttons) b.addEventListener("click", () => go(b.dataset.space));
  for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.space === cur));
  if (say) say.textContent = SPACES[cur].say;
  canvas.setAttribute("aria-label", `${SPACES[cur].label}: ${SPACES[cur].say} The glass letters read "${SPACES[cur].word}".`);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && running) { last = performance.now(); requestAnimationFrame(frame); } }).observe(canvas);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible && running) { last = performance.now(); requestAnimationFrame(frame); } });
  reduced.addEventListener("change", () => { running = true; last = performance.now(); requestAnimationFrame(frame); });
  addEventListener("resize", () => { if (!running) { running = true; requestAnimationFrame(frame); } });
  requestAnimationFrame(frame);
  return { go, spaces: ORDER };
}

const host = document.querySelector("[data-glass-water]");
if (host) mountGlassWater(host).then((api) => { window.__glassWater = api; }).catch((e) => console.error("glass-water: did not start", e));
